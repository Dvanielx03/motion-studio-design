// Motion Studio · kit/escena3d.js — motor 2.5D con Three.js (módulo ES).
// Escenarios 3D con sombreado por bandas y contorno, personajes 2D como billboards que proyectan sombra,
// manadas instanciadas (multitudes, animales, partículas grandes), cámara 3D por claves, supermuestreo
// determinista y exportación .glb para revisar o retocar el escenario en Blender.
// Nació del piloto «La recompensa que llenó Hanói de ratas» (nov 2026). Guía: references/25d.md.
//
//   <script src="lib.js"></script>                      ← ease, prog, lerp, srand (globales)
//   <script type="importmap">{ "imports": { "three": "/node_modules/three/build/three.module.js",
//                                           "three/addons/": "/node_modules/three/examples/jsm/" } }</script>
//   <script type="module" src="composicion.js"></script>
//
//   import * as THREE from 'three';
//   import * as E3 from './kit/escena3d.js';
//   const motor = E3.crearMotor({ W, H, ss: 2, fondo: '#10141c' });
//   const escena = new THREE.Scene(), camara = new THREE.PerspectiveCamera(35, W / H, 0.1, 500);
//   ... escenario con E3.material() y E3.contorno(), personajes con E3.crearBillboard() ...
//   window.seek = t => { ctx.reset(); E3.aplicarCamara(camara, E3.camaraClaves(t, CLAVES)); pj.actualizar(t, camara);
//                        motor.dibujar(ctx, escena, camara); /* textos 2D encima */ };
//
// Contrato determinista (lo que rompió y arregló el piloto):
//  · Sin MSAA (antialias:false): con transparencias cambiaba aristas entre ejecuciones (Δ ≤ 5). El suavizado sale
//    de dibujar a ss× y reducir en el lienzo 2D.
//  · Cada fotograma se dibuja dos veces y se usa el segundo: las cachés perezosas de la GPU (sombras, programas,
//    límites de instancias) quedan fijadas por el mismo t, no por el fotograma anterior.
//  · precalentar(): cada plano se dibuja dos veces al cargar, para que ningún fotograma capturado sea el primero.
//  · Todo se calcula desde t y semillas: nada de Clock, AnimationMixer.update(delta), Math.random ni estado.

import * as THREE from 'three';

const _ease = (typeof ease !== 'undefined') ? ease : {
  lineal: k => k, suave: k => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2),
  sale: k => 1 - Math.pow(1 - k, 3), entra: k => k * k * k, seno: k => -(Math.cos(Math.PI * k) - 1) / 2,
};
const _clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const _lerp = (a, b, k) => a + (b - a) * k;
// valor sembrado sin estado (misma fórmula que srand de lib.js)
function _srand(seed, i = 0) {
  let a = (seed * 7919 + i * 104729 + 13) | 0;
  a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a);
  t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296;
}

// ── Motor: WebGL a ss× → lienzo 2D de salida ────────────────────────────────────────────────────────────────
export function crearMotor({ W, H, ss = 2, fondo = '#000000', sombras = true } = {}) {
  const gl = document.createElement('canvas'); gl.width = W * ss; gl.height = H * ss;
  const renderer = new THREE.WebGLRenderer({
    canvas: gl, antialias: false, alpha: false, preserveDrawingBuffer: true, powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(1); renderer.setSize(W * ss, H * ss, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.setClearColor(new THREE.Color(fondo), 1);
  renderer.shadowMap.enabled = sombras;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  // Dibuja la escena en el rectángulo (x, y, w, h) del contexto 2D (por defecto, todo el cuadro). La cámara perspectiva
  // toma la proporción w/h y el lienzo WebGL (W·ss × H·ss) se estira al rectángulo: las proporciones salen bien y solo
  // cambia la resolución por eje. Con cámara ortográfica, ajusta tú left/right/top/bottom a w/h.
  // No deja estado: si cambia el aspecto de la cámara para dibujar, le devuelve el aspecto y la proyección que tenía
  // (rectPantalla() mide aparte con la proporción del cuadro que le pases). Un rectángulo sin área (w o h ≤ 0, p. ej. un
  // panel de pantalla dividida que se abre desde 0) no dibuja nada ni toca la cámara.
  const _proy = new THREE.Matrix4(), _proyInv = new THREE.Matrix4();
  function dibujar(ctx, escena, camara, { x = 0, y = 0, w = W, h = H } = {}) {
    if (!(w > 0 && h > 0) || !Number.isFinite(w / h)) return;
    const asp = w / h, aspPrevio = camara.aspect;
    const cambia = camara.isPerspectiveCamera && Math.abs(camara.aspect - asp) > 1e-9;
    if (cambia) {
      _proy.copy(camara.projectionMatrix); _proyInv.copy(camara.projectionMatrixInverse);
      camara.aspect = asp; camara.updateProjectionMatrix();
    }
    try {
      renderer.render(escena, camara);
      renderer.render(escena, camara);
    } finally {
      if (cambia) { camara.aspect = aspPrevio; camara.projectionMatrix.copy(_proy); camara.projectionMatrixInverse.copy(_proyInv); }
    }
    ctx.save();
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(gl, 0, 0, W * ss, H * ss, x, y, w, h);
    ctx.restore();
  }
  return { renderer, gl, ss, W, H, dibujar };
}

// ── Look: sombreado por bandas (cel shading) y contorno ────────────────────────────────────────────────────
// bandas = niveles de luz de la rampa, de sombra a luz. 2–3 bandas = animación 2D; más = más volumen.
// En una malla que recibe sombras solo se ven las de la mitad alta (ver «ACNÉ DE SOMBRA» en material()).
const _rampas = new Map();
export function rampa(bandas = [0.55, 0.82, 1]) {
  const k = bandas.join(',');
  if (_rampas.has(k)) return _rampas.get(k);
  const datos = new Uint8Array(bandas.length * 4);
  bandas.forEach((v, i) => { const c = Math.round(_clamp(v) * 255); datos.set([c, c, c, 255], i * 4); });
  const tex = new THREE.DataTexture(datos, bandas.length, 1, THREE.RGBAFormat);
  tex.minFilter = tex.magFilter = THREE.NearestFilter; tex.generateMipmaps = false; tex.needsUpdate = true;
  _rampas.set(k, tex); return tex;
}
// Rampa de COLOR (receta del ColorRamp de 5 paradas de make-short/Blender, adaptada): cada banda tiñe la luz.
// paradas = ['#5B4A8A', '#9C86A8', '#E8D2B8', '#FFF1D6'] de sombra a luz (sombras violetas, luces cálidas).
// La sombra deja de ser «el mismo color más oscuro»: cambia de tono, como en la ilustración. En una malla que recibe
// sombras solo se ven las paradas de la mitad alta (ver «ACNÉ DE SOMBRA»): las de sombra, con receiveShadow:false.
const _rampasColor = new Map();
export function rampaColor(paradas) {
  const k = paradas.join(',');
  if (_rampasColor.has(k)) return _rampasColor.get(k);
  const datos = new Uint8Array(paradas.length * 4);
  paradas.forEach((hex, i) => { const c = new THREE.Color(hex); datos.set([c.r * 255, c.g * 255, c.b * 255, 255].map(Math.round), i * 4); });
  const tex = new THREE.DataTexture(datos, paradas.length, 1, THREE.RGBAFormat);
  tex.minFilter = tex.magFilter = THREE.NearestFilter; tex.generateMipmaps = false; tex.needsUpdate = true;
  _rampasColor.set(k, tex); return tex;
}
export const RAMPAS = {
  calida: ['#4B3F78', '#8E7AA6', '#E6CDB2', '#FFF3DC'],     // sombra violeta, luz cálida (la de make-short)
  noche: ['#1E2850', '#3F4F86', '#9AA7D6', '#E9EEFF'],      // azul nocturno
  sepia: ['#4A3426', '#8A6A4E', '#D9BF98', '#FFF0D2'],
};

// Material de escenario. plano:true ignora la luz (letreros, cielos, recortes pintados).
// rampa: lista de colores (rampaColor) en lugar de bandas grises.
// OJO: MeshToonMaterial (three 0.170) solo lee el canal .r del gradientMap; con rampa de color se parchea el shader para
// leer .rgb (los datos ya están en lineal: la textura sigue en NoColorSpace). El tinte afecta a la luz directa (sol) por
// orientación; en la sombra arrojada y, si la malla recibe sombras, en las caras de espaldas al sol solo queda el relleno
// de cielo (HemisphereLight), que no pasa por la rampa. Por eso, en una malla que recibe sombras solo se ven las paradas
// de la mitad alta (ver «ACNÉ DE SOMBRA»).
const _toonColor = THREE.ShaderChunk.gradientmap_pars_fragment.replace('coord ).r )', 'coord ).rgb )');
if (_toonColor === THREE.ShaderChunk.gradientmap_pars_fragment) console.warn('escena3d: no se pudo parchear gradientmap_pars_fragment (¿otra versión de three?); la rampa de color saldrá gris');
// ACNÉ DE SOMBRA: WebGLShadowMap dibuja en el mapa de sombras las caras TRASERAS de los materiales FrontSide, así que la
// cara que da la espalda al sol se compara consigo misma y salen rayas diagonales (acné) y manchas falsas de «sombra» de los
// edificios vecinos. Con materiales físicos no se nota (dotNL < 0 ya no recibe luz directa), pero el toon ilumina esas
// caras con las bandas bajas de la rampa (0,55 de sol en la rampa gris por defecto), así que el acné queda a la vista.
// Arreglo coherente (_dorsoEnSombra): una cara de espaldas a una luz con sombra (dotNL ≤ 0, el mismo dotNL que usa la
// rampa) está SIEMPRE en sombra de esa luz: factor 1 − shadow.intensity (0 con la intensidad por defecto, el mismo tono
// que da el mapa a una sombra arrojada) sin consultar el mapa, así que no hay acné, y da igual que la cara quede dentro o
// fuera del alcance del mapa (el radio de iluminar()). Con dotNL > 0 se usa el mapa normal: una cara de cara al sol dentro
// de la sombra de otro objeto sigue oscura, y una de espaldas nunca sale más clara que una iluminada. Vale para el sol, los
// focos y los puntos con sombra; con receiveShadow:false o sin castShadow en la luz no cambia nada.
// Consecuencia visible: la rampa va de dotNL −1 a 1 (coord = dotNL·0,5 + 0,5), así que en una malla que recibe sombras
// solo se ven las bandas de la mitad alta (dotNL > 0; con 3 bandas, 0,82 y 1; con 4 paradas, las 2 claras) y el tono de
// sombra lo pone el relleno de cielo (HemisphereLight), igual que en la sombra arrojada. Para ver las bajas en una malla,
// receiveShadow:false (pierde la sombra arrojada). Las sombras de contacto (suelo, pies, manadas) no cambian, así que
// iluminar() no necesita más bias (más bias despegaría las sombras de los pies).
// Solo vale para los materiales de material()/caja(): un MeshToonMaterial creado a mano no lleva el parche.
let _parchesSombra = 0;
const _dorsoEnSombra = THREE.ShaderChunk.lights_fragment_begin.replace(
  /\( directLight\.visible && receiveShadow \) \? (get(?:Point)?Shadow\( \w+\[ i \], (\w+)\.shadowMapSize,[^;]*\)) : 1\.0;/g,
  (_, sombra, luz) => {
    _parchesSombra++;
    const dorso = sombra.includes('.shadowIntensity') ? `1.0 - ${luz}.shadowIntensity` : '0.0';   // three sin shadow.intensity: 0
    return `( directLight.visible && receiveShadow ) ? ( dot( geometryNormal, directLight.direction ) > 0.0 ? ${sombra} : ${dorso} ) : 1.0;`;
  });
if (_parchesSombra !== 3) console.warn(`escena3d: lights_fragment_begin parcheado en ${_parchesSombra} de 3 luces (¿otra versión de three?); las caras de espaldas al sol pueden mostrar acné de sombra`);
export function material(color, { bandas, rampa: rc = null, plano = false, emisivo = null, mapa = null, lados = THREE.FrontSide } = {}) {
  if (plano) return new THREE.MeshBasicMaterial({ color, map: mapa, side: lados });
  const m = new THREE.MeshToonMaterial({ color, gradientMap: rc ? rampaColor(rc) : rampa(bandas), map: mapa, side: lados });
  // un solo onBeforeCompile con los dos parches; la clave distingue las dos variantes del programa (gris / color)
  m.onBeforeCompile = s => {
    s.fragmentShader = s.fragmentShader.replace('#include <lights_fragment_begin>', _dorsoEnSombra);
    if (rc) s.fragmentShader = s.fragmentShader.replace('#include <gradientmap_pars_fragment>', _toonColor);
  };
  m.customProgramCacheKey = () => (rc ? 'toonColor' : 'toon') + '+dorsoEnSombra';
  if (emisivo) { m.emissive = new THREE.Color(emisivo); m.emissiveIntensity = 1; }
  return m;
}
// Contorno por casco invertido: copia la malla con normales suavizadas, la infla `grosor` (unidades de mundo) y
// dibuja solo sus caras traseras. Se marca para no exportarlo a Blender (allí se usa Line Art o Freestyle).
export function contorno(malla, { grosor = 0.025, color = '#15110d' } = {}) {
  const g = malla.geometry.clone();
  for (const a of Object.keys(g.attributes)) if (a !== 'position') g.deleteAttribute(a);
  const unida = _unirVertices(g); unida.computeVertexNormals();
  const mat = new THREE.MeshBasicMaterial({ color, side: THREE.BackSide });
  // Se infla en espacio de vista (= unidades de mundo con una cámara sin escala) con normalMatrix (inversa traspuesta):
  // el trazo no cambia con la escala de la malla ni de sus padres, aunque no sea uniforme. mvPosition sigue valiendo
  // para la niebla y los planos de recorte. (Sin instancias ni batching: el casco es una Mesh normal.)
  mat.onBeforeCompile = s => {
    s.uniforms.uGrosor = { value: grosor };
    s.vertexShader = 'uniform float uGrosor;\n' + s.vertexShader.replace('#include <project_vertex>',
      'vec4 mvPosition = modelViewMatrix * vec4( transformed, 1.0 );\n mvPosition.xyz += normalize( normalMatrix * normal ) * uGrosor;\n gl_Position = projectionMatrix * mvPosition;');
  };
  mat.customProgramCacheKey = () => 'contornoVista';
  const casco = new THREE.Mesh(unida, mat);
  casco.userData.noExportar = true; casco.castShadow = false; casco.receiveShadow = false;
  malla.add(casco);
  return casco;
}
function _unirVertices(g, tol = 1e-4) {
  const pos = g.attributes.position, idx = g.index ? g.index.array : null;
  const n = idx ? idx.length : pos.count, mapa = new Map(), nuevos = [], indices = new Uint32Array(n);
  for (let k = 0; k < n; k++) {
    const i = idx ? idx[k] : k;
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const clave = `${Math.round(x / tol)},${Math.round(y / tol)},${Math.round(z / tol)}`;
    let j = mapa.get(clave);
    if (j === undefined) { j = nuevos.length / 3; nuevos.push(x, y, z); mapa.set(clave, j); }
    indices[k] = j;
  }
  const r = new THREE.BufferGeometry();
  r.setAttribute('position', new THREE.Float32BufferAttribute(nuevos, 3)); r.setIndex(new THREE.BufferAttribute(indices, 1));
  return r;
}
// Atajo: caja de escenario con material por bandas y contorno. Devuelve la malla (ya con sombras).
export function caja(ancho, alto, fondo, color, { x = 0, y = 0, z = 0, rotY = 0, bandas, rampa = null, linea = 0.02, colorLinea } = {}) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(ancho, alto, fondo), material(color, { bandas, rampa }));
  m.position.set(x, y + alto / 2, z); m.rotation.y = rotY; m.castShadow = true; m.receiveShadow = true;
  if (linea > 0) contorno(m, { grosor: linea, color: colorLinea });
  return m;
}
// Luz de la escena 2.5D: un sol con sombra nítida + relleno de cielo. `foco` = centro de la zona con sombras.
// bias y normalBias son pequeños a propósito: más bias despega la sombra de los pies (peter-panning). El acné de las caras
// de espaldas al sol no se arregla aquí sino en material() (ver «ACNÉ DE SOMBRA»).
export function iluminar(escena, { sol = '#fff3dd', intensidad = 2.2, cielo = '#9fb4d6', suelo = '#3a2f28', relleno = 1.1,
  dir = [-4, 9, 6], foco = [0, 0, 0], radio = 14, resolucion = 2048 } = {}) {
  const hemi = new THREE.HemisphereLight(cielo, suelo, relleno); escena.add(hemi);
  const luz = new THREE.DirectionalLight(sol, intensidad);
  luz.position.set(foco[0] + dir[0], foco[1] + dir[1], foco[2] + dir[2]); luz.target.position.set(...foco);
  luz.castShadow = true; luz.shadow.mapSize.set(resolucion, resolucion);
  Object.assign(luz.shadow.camera, { left: -radio, right: radio, top: radio, bottom: -radio, near: 0.5, far: 60 });
  luz.shadow.bias = -0.0004; luz.shadow.normalBias = 0.02; luz.shadow.radius = 2;
  escena.add(luz, luz.target);
  return { hemi, luz };
}
export function niebla(escena, color, cerca = 12, lejos = 60) { escena.fog = new THREE.Fog(color, cerca, lejos); }

// ── Personaje 2D como billboard ────────────────────────────────────────────────────────────────────────────
// dibujar(ctx, t, estado, w, h) pinta el personaje en su propio lienzo (fondo transparente, pies en el borde
// inferior y centrado). El plano gira solo en Y para mirar a la cámara (no se inclina con picados).
// sombra: 'real' (proyecta la silueta con el sol), 'mancha' (óvalo en el suelo) o null. Con 'real' pasa `luz`
// (la DirectionalLight de iluminar()): la silueta que proyecta mira al sol y no cambia cuando se mueve la cámara.
// inclinar (0–1): fracción del picado de la cámara que el plano se inclina hacia ella, con el pivote en los pies.
// Con cámaras altas (mesa vista desde arriba) evita que el dibujo se vea aplastado; 0 = vertical (por defecto).
export function crearBillboard({ ancho, alto, res = 768, dibujar, sombra = 'real', luz = null, tinte = '#ffffff', suave = false, nombre = 'personaje', inclinar = 0 }) {
  const lienzo = document.createElement('canvas');
  lienzo.height = res; lienzo.width = Math.max(2, Math.round(res * ancho / alto));
  // willReadFrequently: rasterizado por CPU desde el principio. Si no, Chrome puede pasar el lienzo de GPU a CPU a mitad
  // del render y los bordes suavizados cambian (Δ 1–7) según el orden de los t (medido en ratas-de-hanoi-v2).
  const c2 = lienzo.getContext('2d', { willReadFrequently: true });
  const tex = new THREE.CanvasTexture(lienzo);
  tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  const geo = new THREE.PlaneGeometry(ancho, alto); geo.translate(0, alto / 2, 0);
  const mat = new THREE.MeshBasicMaterial({ map: tex, color: tinte, side: THREE.DoubleSide,
    alphaTest: suave ? 0.02 : 0.5, transparent: suave, depthWrite: !suave });
  const plano = new THREE.Mesh(geo, mat); plano.name = nombre;
  const objeto = new THREE.Group(); objeto.name = nombre; objeto.add(plano);
  const profundidad = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: tex, alphaTest: 0.5, side: THREE.DoubleSide });
  let proyector = null;
  if (sombra === 'real' && luz) {
    // plano invisible en color que solo escribe en el mapa de sombras, siempre de cara al sol
    // OJO: WebGLShadowMap copia map/alphaTest del material PRINCIPAL al de profundidad; sin ellos la sombra sale rectangular
    proyector = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: tex, alphaTest: 0.5, colorWrite: false, depthWrite: false, side: THREE.DoubleSide }));
    proyector.castShadow = true; proyector.customDepthMaterial = profundidad; proyector.userData.noExportar = true;
    objeto.add(proyector);
  } else if (sombra === 'real') {
    plano.castShadow = true; plano.customDepthMaterial = profundidad;
  } else if (sombra === 'mancha') {
    objeto.add(mancha(ancho * 0.9, ancho * 0.35));
  }
  let ultimo = null;
  function actualizar(t, camara, estado = {}) {
    const clave = JSON.stringify([t, estado]);
    if (clave !== ultimo) {   // misma entrada → mismo lienzo; no depende del orden de los t
      c2.setTransform(1, 0, 0, 1, 0, 0); c2.clearRect(0, 0, lienzo.width, lienzo.height);
      dibujar(c2, t, estado, lienzo.width, lienzo.height);
      tex.needsUpdate = true; ultimo = clave;
    }
    mirarCamara(plano, camara);
    if (inclinar) {
      const p = new THREE.Vector3(); objeto.getWorldPosition(p);
      const c = new THREE.Vector3(); camara.getWorldPosition(c);
      const elev = Math.atan2(c.y - p.y, Math.hypot(c.x - p.x, c.z - p.z));
      plano.rotation.set(-elev * inclinar, plano.rotation.y, 0, 'YXZ');
    }
    plano.scale.x = estado.espejo ? -1 : 1;
    if (proyector) {   // dirección al sol en el espacio de `objeto` (vale con padres girados o escalados)
      const d = objeto.worldToLocal(luz.getWorldPosition(new THREE.Vector3())).sub(objeto.worldToLocal(luz.target.getWorldPosition(new THREE.Vector3())));
      proyector.rotation.set(0, Math.atan2(d.x, d.z), 0);
      proyector.scale.x = plano.scale.x;
    }
  }
  // caja en píxeles del cuadro (para window.__qc y qc_escena.mjs): llamar después de actualizar()
  const rect = (camara, W, H, extra = {}) => ({ id: nombre, ...rectPantalla(plano, camara, W, H), ...extra });
  return { objeto, plano, lienzo, textura: tex, actualizar, rect };
}
// Caja en píxeles de un objeto visto por `camara` en un cuadro W×H. Pasa las 8 esquinas de su caja de mundo a espacio
// de vista, recorta las 12 aristas contra los planos cercano y lejano (lo que queda detrás de la cámara no se proyecta)
// y proyecta lo que queda. Con cámara perspectiva mide con la proporción W/H (la misma con que la dibuja motor.dibujar),
// no con el aspect que tenga la cámara; para una vista en un rectángulo, pasa su w y h y suma su x, y.
// Devuelve { x, y, w, h, visible, fuera }:
//  · oculto (el objeto o algún ascendiente con visible:false, o caja vacía) → visible:false, fuera:false, caja 0;
//  · fuera del frustum en profundidad (entero detrás de la cámara o más allá del plano lejano) → visible:false,
//    fuera:true, caja 0;
//  · delante de la cámara pero entero fuera del cuadro por un lado → visible:true, fuera:true y su caja (fuera de 0–W/0–H);
//  · si no, visible:true, fuera:false.
// La caja NO se recorta al cuadro: qc_escena mide con ella cuánto del foco queda fuera (regla 3) y cuenta fuera:true como
// 100 % fuera de cuadro; visible:false sin fuera = no está en escena y no cuenta.
const _NADA = (fuera = false) => ({ x: 0, y: 0, w: 0, h: 0, visible: false, fuera });
// Proyección de una cámara perspectiva con otro aspecto, sin tocarla. Solo copia los parámetros de la proyección (no usa
// Object3D.copy, que clona userData con JSON y lanzaría con un userData no serializable).
const _camRect = new THREE.PerspectiveCamera();
function _proyeccionCon(camara, aspecto) {
  for (const k of ['fov', 'zoom', 'near', 'far', 'filmGauge', 'filmOffset', 'coordinateSystem']) _camRect[k] = camara[k];
  _camRect.view = camara.view; _camRect.aspect = aspecto; _camRect.updateProjectionMatrix(); _camRect.view = null;
  return _camRect.projectionMatrix;
}
export function rectPantalla(obj, camara, W, H) {
  for (let o = obj; o; o = o.parent) if (!o.visible) return _NADA();
  obj.updateWorldMatrix(true, true); camara.updateWorldMatrix(true, false);
  const caja = new THREE.Box3().setFromObject(obj, true);
  if (caja.isEmpty()) return _NADA();
  const proy = camara.isPerspectiveCamera && Math.abs(camara.aspect - W / H) > 1e-9 ? _proyeccionCon(camara, W / H) : camara.projectionMatrix;
  const esq = [];
  for (let i = 0; i < 8; i++) esq.push(new THREE.Vector3(i & 1 ? caja.max.x : caja.min.x, i & 2 ? caja.max.y : caja.min.y,
    i & 4 ? caja.max.z : caja.min.z).applyMatrix4(camara.matrixWorldInverse));
  const zMax = -camara.near, zMin = -camara.far, pts = [];   // en vista se mira hacia −Z
  for (let i = 0; i < 8; i++) for (const bit of [1, 2, 4]) {
    if (i & bit) continue;
    const a = esq[i], b = esq[i | bit], dz = b.z - a.z;
    let s0 = 0, s1 = 1;
    if (Math.abs(dz) < 1e-12) { if (a.z < zMin || a.z > zMax) continue; }
    else { let u = (zMin - a.z) / dz, w = (zMax - a.z) / dz; if (u > w) [u, w] = [w, u]; s0 = Math.max(0, u); s1 = Math.min(1, w); if (s0 > s1) continue; }
    pts.push(a.clone().lerp(b, s0), a.clone().lerp(b, s1));
  }
  if (!pts.length) return _NADA(true);
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const v of pts) {
    v.applyMatrix4(proy);
    const px = (v.x + 1) / 2 * W, py = (1 - v.y) / 2 * H;
    x0 = Math.min(x0, px); y0 = Math.min(y0, py); x1 = Math.max(x1, px); y1 = Math.max(y1, py);
  }
  // la caja proyectada contiene al objeto: si no toca el cuadro, el objeto tampoco (sin falsos «fuera»)
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0, visible: true, fuera: x1 <= 0 || y1 <= 0 || x0 >= W || y0 >= H };
}

// Gira `malla` en torno al eje Y de su padre para mirar a la cámara. Usa la posición de la propia malla y pasa la cámara
// al espacio del padre, así que vale con mallas desplazadas y padres girados o movidos. Con padres inclinados en X/Z
// sigue girando en torno al Y del padre (inherente a un plano que no se inclina hacia la cámara).
export function mirarCamara(malla, camara) {
  const c = camara.getWorldPosition(new THREE.Vector3()), pa = malla.parent;
  if (pa) { pa.updateWorldMatrix(true, false); pa.worldToLocal(c); }
  malla.rotation.set(0, Math.atan2(c.x - malla.position.x, c.z - malla.position.z), 0);
}
// Mancha de sombra (contacto) en el suelo
let _texMancha = null;
export function mancha(ancho, fondo, opacidad = 0.38) {
  if (!_texMancha) {
    const cv = document.createElement('canvas'); cv.width = cv.height = 128; const c = cv.getContext('2d');
    const g = c.createRadialGradient(64, 64, 4, 64, 64, 62); g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g; c.fillRect(0, 0, 128, 128); _texMancha = new THREE.CanvasTexture(cv);
  }
  const m = new THREE.Mesh(new THREE.PlaneGeometry(ancho, fondo),
    new THREE.MeshBasicMaterial({ map: _texMancha, transparent: true, opacity: opacidad, depthWrite: false }));
  m.rotation.x = -Math.PI / 2; m.position.y = 0.01; m.renderOrder = 1; m.userData.noExportar = true;
  return m;
}

// ── Manada: muchas copias de un dibujo 2D animado (ratas, palomas, gente al fondo) ───────────────────────
// cuadros = número de dibujos del ciclo; dibujarCuadro(ctx, k, w, h) pinta el dibujo k (fondo transparente).
// pose(i, t) → { x, z, y?, escala?, cuadro?, espejo?, visible? } para el miembro i en el instante t (sin estado).
export function crearManada({ cantidad, ancho, alto, cuadros = 4, res = 160, dibujarCuadro, pose, sombra = 'mancha', nombre = 'manada' }) {
  const cw = Math.max(2, Math.round(res * ancho / alto)), ch = res;
  const atlas = document.createElement('canvas'); atlas.width = cw * cuadros; atlas.height = ch;
  const ca = atlas.getContext('2d');
  for (let k = 0; k < cuadros; k++) { ca.save(); ca.translate(k * cw, 0); ca.beginPath(); ca.rect(0, 0, cw, ch); ca.clip(); dibujarCuadro(ca, k, cw, ch); ca.restore(); }
  const tex = new THREE.CanvasTexture(atlas); tex.colorSpace = THREE.SRGBColorSpace;
  const geo = new THREE.PlaneGeometry(ancho, alto); geo.translate(0, alto / 2, 0);
  const aCuadro = new THREE.InstancedBufferAttribute(new Float32Array(cantidad), 1);
  geo.setAttribute('aCuadro', aCuadro);
  const mat = new THREE.MeshBasicMaterial({ map: tex, alphaTest: 0.5, side: THREE.DoubleSide });
  mat.onBeforeCompile = s => {
    s.uniforms.uCuadros = { value: cuadros };
    s.vertexShader = 'attribute float aCuadro;\nuniform float uCuadros;\n' + s.vertexShader.replace('#include <uv_vertex>',
      '#include <uv_vertex>\n#ifdef USE_MAP\n vMapUv.x = (vMapUv.x + aCuadro) / uCuadros;\n#endif');
  };
  mat.customProgramCacheKey = () => 'manada' + cuadros;
  const malla = new THREE.InstancedMesh(geo, mat, cantidad); malla.name = nombre;
  malla.frustumCulled = false; malla.castShadow = sombra === 'real';
  if (sombra === 'real') {
    // WebGLShadowMap no copia el onBeforeCompile al material de profundidad: sin este, la sombra sería el atlas entero
    const prof = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: tex, alphaTest: 0.5, side: THREE.DoubleSide });
    prof.onBeforeCompile = mat.onBeforeCompile; prof.customProgramCacheKey = () => 'manadaProf' + cuadros;
    malla.customDepthMaterial = prof;
  }
  // no va a Blender: GLTFExporter sacaría aCuadro como atributo de vértice con otro count (glTF inválido) y los miembros
  // ocultos (escala 0) darían cuaterniones NaN en EXT_mesh_gpu_instancing
  malla.userData.noExportar = true;
  const objeto = new THREE.Group(); objeto.name = nombre; objeto.add(malla); objeto.userData.noExportar = true;
  let sombras = null;
  if (sombra === 'mancha') {
    const ms = mancha(ancho * 0.9, ancho * 0.35, 0.3);
    sombras = new THREE.InstancedMesh(ms.geometry, ms.material, cantidad);
    sombras.frustumCulled = false; sombras.renderOrder = 1; sombras.userData.noExportar = true; objeto.add(sombras);
  }
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), s = new THREE.Vector3();
  const qs = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0));
  function actualizar(t, camara, f = 1) {
    // las poses son locales a `malla`: la cámara pasa a ese espacio (vale aunque se mueva o gire `objeto`)
    const c = camara.getWorldPosition(new THREE.Vector3()); malla.updateWorldMatrix(true, false); malla.worldToLocal(c);
    for (let i = 0; i < cantidad; i++) {
      const p = pose(i, t, f) || {};
      const vis = p.visible !== false, esc = vis ? (p.escala ?? 1) : 0;
      v.set(p.x ?? 0, p.y ?? 0, p.z ?? 0);
      e.set(0, Math.atan2(c.x - v.x, c.z - v.z), 0); q.setFromEuler(e);
      s.set(esc * (p.espejo ? -1 : 1), esc, esc);
      malla.setMatrixAt(i, m4.compose(v, q, s));
      aCuadro.setX(i, Math.floor(_clamp(p.cuadro ?? 0, 0, cuadros - 1)));
      if (sombras) { s.set(esc, esc, esc); v.y = 0.012; sombras.setMatrixAt(i, m4.compose(v, qs, s)); }
    }
    malla.instanceMatrix.needsUpdate = true; aCuadro.needsUpdate = true;
    if (sombras) sombras.instanceMatrix.needsUpdate = true;
  }
  return { objeto, malla, atlas, actualizar };
}
// Ciclo de dibujos a `dps` dibujos por segundo (12 = animación tradicional), con desfase por miembro.
export const cuadroCiclo = (t, cuadros, dps = 12, desfase = 0) => Math.floor(t * dps + desfase * cuadros) % cuadros;

// ── Cámara 3D por claves ───────────────────────────────────────────────────────────────────────────────────
// claves = [[t, { pos:[x,y,z], mira:[x,y,z], fov?, giro? }, curva?], ...]; curva = nombre de `ease` para llegar a
// esa clave ('suave' por defecto; 'escalon' = corte seco).
export function camaraClaves(t, claves) {
  if (t <= claves[0][0]) return _copia(claves[0][1]);
  for (let i = 1; i < claves.length; i++) {
    const [t1, b, curva = 'suave'] = claves[i];
    if (t < t1) {
      const [t0, a] = claves[i - 1];
      if (curva === 'escalon') return _copia(a);
      const k = (_ease[curva] || _ease.suave)(_clamp((t - t0) / (t1 - t0)));
      return {
        pos: a.pos.map((x, j) => _lerp(x, b.pos[j], k)), mira: a.mira.map((x, j) => _lerp(x, b.mira[j], k)),
        fov: _lerp(a.fov ?? 35, b.fov ?? 35, k), giro: _lerp(a.giro ?? 0, b.giro ?? 0, k),
      };
    }
  }
  return _copia(claves[claves.length - 1][1]);
}
const _copia = c => ({ pos: [...c.pos], mira: [...c.mira], fov: c.fov ?? 35, giro: c.giro ?? 0 });
// Temblor suave sembrado: golpes = [[t, fuerza], ...]; decae en `dura` s. Devuelve [dx, dy, dz] en unidades de mundo.
export function temblor3D(t, golpes, semilla = 7, { dura = 0.45, frecuencia = 18 } = {}) {
  const r = [0, 0, 0];
  for (const [tg, fuerza] of golpes) {
    const d = t - tg; if (d < 0 || d > dura) continue;
    const amp = fuerza * Math.pow(1 - d / dura, 2), u = d * frecuencia, i = Math.floor(u), f = u - i;
    for (let j = 0; j < 3; j++) {
      const a = _srand(semilla + j * 31, i) * 2 - 1, b = _srand(semilla + j * 31, i + 1) * 2 - 1;
      r[j] += amp * _lerp(a, b, f * f * (3 - 2 * f));
    }
  }
  return r;
}
// Respiración de cámara en mano: deriva lenta sembrada (amplitud en unidades de mundo).
export function respiracion3D(t, amp = 0.015, semilla = 3) {
  return [0, 1, 2].map(j => amp * (Math.sin(t * (0.7 + j * 0.23) + _srand(semilla, j) * 6.28) * 0.6
    + Math.sin(t * (1.9 + j * 0.31) + _srand(semilla, j + 9) * 6.28) * 0.4));
}
export function aplicarCamara(camara, c, extra = [0, 0, 0]) {
  camara.position.set(c.pos[0] + extra[0], c.pos[1] + extra[1], c.pos[2] + extra[2]);
  camara.up.set(0, 1, 0);
  camara.lookAt(c.mira[0] + extra[0], c.mira[1] + extra[1], c.mira[2] + extra[2]);
  if (c.giro) camara.rotateZ(c.giro);
  if (camara.isPerspectiveCamera && c.fov && camara.fov !== c.fov) { camara.fov = c.fov; camara.updateProjectionMatrix(); }
  camara.updateMatrixWorld(true);
}

// ── Brillo difuso (bloom ligero) sobre el cuadro 2D final ──────────────────────────────────────────────────
// Aísla las zonas claras (brillo/contraste), las desenfoca a 1/4 de resolución y las suma en «screen». Imita el Bloom del
// compositor de Blender sin EffectComposer. fuerza 0–1; umbral u (0–0,98) = valor por debajo del cual no brilla nada:
// brightness(1/(1+u)) y contrast((1+u)/(1−u)) dan f(x) = (x − u)/(1 − u), con f(u) = 0 y f(1) = 1.
let _brillo = null;
export function brillo(ctx, W, H, { fuerza = 0.35, umbral = 0.62, radio = 0.012 } = {}) {
  const w = Math.max(2, Math.round(W / 4)), h = Math.max(2, Math.round(H / 4));
  if (!_brillo || _brillo.width !== w || _brillo.height !== h) { _brillo = document.createElement('canvas'); _brillo.width = w; _brillo.height = h; }
  const b = _brillo.getContext('2d', { willReadFrequently: true });
  b.reset();   // reset() devuelve la calidad de suavizado a 'low': la reducción 4× se saltaría luces de 1–2 px
  b.imageSmoothingEnabled = true; b.imageSmoothingQuality = 'high';
  const u = _clamp(umbral, 0, 0.98);
  b.filter = `brightness(${(1 / (1 + u)).toFixed(4)}) contrast(${((1 + u) / (1 - u)).toFixed(4)}) blur(${Math.max(1, Math.round(H * radio / 4))}px)`;
  b.drawImage(ctx.canvas, 0, 0, w, h);
  ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.globalAlpha = fuerza; ctx.imageSmoothingEnabled = true;
  ctx.drawImage(_brillo, 0, 0, W, H); ctx.restore();
}

// ── Precalentamiento ───────────────────────────────────────────────────────────────────────────────────────
// planos = [{ inicio, fin, ... }]; dibujarPlano(ctx, t, plano). Dibuja cada plano dos veces en un lienzo aparte.
export function precalentar(W, H, planos, dibujarPlano, vueltas = 2) {
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const c = cv.getContext('2d');
  for (let v = 0; v < vueltas; v++) for (const P of planos) { c.reset(); dibujarPlano(c, (P.inicio + P.fin) / 2, P); }
}

// ── Exportación a Blender (.glb + anclas) ─────────────────────────────────────────────────────────────────
// Exporta lo visible de `grupo` (el decorado del entorno, no la escena entera) sin contornos, manchas, proyectores ni
// manadas (userData.noExportar). anclas = { nombre: { pos:[x,y,z], mira:[x,y,z], fov } } con las cámaras/posiciones
// clave del escenario; viajan en un JSON aparte y abrir_en_blender.py las convierte en cámaras. Devuelve { glb: base64, anclas }.
// OJO: exporta el estado del último fotograma dibujado (precalentar() deja cada plano en su t medio). Si el decorado se
// anima, la página debe ponerlo en un t de reposo antes de llamar a exportarGLB (p. ej. con su actualizar(t)).
export async function exportarGLB(grupo, anclas = {}) {
  const { GLTFExporter } = await import('three/addons/exporters/GLTFExporter.js');
  const ocultos = [];
  grupo.traverse(o => { if (o.userData.noExportar && o.visible) { o.visible = false; ocultos.push(o); } });
  try {
    const glb = await new GLTFExporter().parseAsync(grupo, { binary: true, onlyVisible: true });
    const bytes = new Uint8Array(glb); let bin = '';
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return { glb: btoa(bin), anclas };
  } finally { for (const o of ocultos) o.visible = true; }
}

// ── Cámara continua (18 nov 2026, piloto de la Torre Eiffel) ───────────────────────────────────────────────
// Igual que camaraClaves, pero sin pararse en las claves intermedias: Hermite cúbico con tangentes por diferencias en
// el TIEMPO (la velocidad es continua aunque las claves no estén equiespaciadas); reposo solo al principio y al final.
// Úsala cuando la intención del movimiento continúa a través de una clave (seguir una acción, una grúa que se inclina).
export function camaraContinua(t, claves) {
  const n = claves.length, cp = c => ({ pos: [...c.pos], mira: [...c.mira], fov: c.fov ?? 35, giro: c.giro ?? 0 });
  if (t <= claves[0][0]) return cp(claves[0][1]);
  if (t >= claves[n - 1][0]) return cp(claves[n - 1][1]);
  let i = 1; while (t >= claves[i][0]) i++;
  const t0 = claves[i - 1][0], t1 = claves[i][0], h = t1 - t0, u = (t - t0) / h;
  const h00 = 2 * u ** 3 - 3 * u ** 2 + 1, h10 = u ** 3 - 2 * u ** 2 + u, h01 = -2 * u ** 3 + 3 * u ** 2, h11 = u ** 3 - u ** 2;
  const val = f => {
    const tan = j => (j === 0 || j === n - 1) ? 0 : (f(claves[j + 1][1]) - f(claves[j - 1][1])) / (claves[j + 1][0] - claves[j - 1][0]);
    return h00 * f(claves[i - 1][1]) + h10 * h * tan(i - 1) + h01 * f(claves[i][1]) + h11 * h * tan(i);
  };
  return { pos: [0, 1, 2].map(d => val(c => c.pos[d])), mira: [0, 1, 2].map(d => val(c => c.mira[d])), fov: val(c => c.fov ?? 35), giro: val(c => c.giro ?? 0) };
}

// ── Gradación final del cuadro (determinista, CPU) ───────────────────────────────────────────────────────
// Lleva el acabado a los rangos de la referencia medida con scripts/comparar.py: levanta los negros (bruma de cuento),
// comprime las altas luces, limita los picos de saturación y templa. Opera con getImageData, así que el lienzo principal
// debe crearse con getContext('2d', { willReadFrequently: true }) (lección 13). Coste medido: ~15 ms en 1080×1920.
//   negros: valor de salida del negro (0–255; la referencia de historia mide YLOW ≈ 58 frente a 46 sin gradar)
//   altas: valor de salida del blanco (≤ 255), saturacion: factor global, satMax: tope de croma (0–1) con rodilla suave,
//   calidez: −1..1 (desplaza rojo/azul ±10 niveles)
export function gradoFinal(ctx, W, H, { negros = 0, altas = 255, saturacion = 1, satMax = 1, calidez = 0 } = {}) {
  const img = ctx.getImageData(0, 0, W, H), p = img.data, lut = new Uint8ClampedArray(256);
  for (let v = 0; v < 256; v++) lut[v] = negros + v * (altas - negros) / 255;
  const cr = Math.round(calidez * 10), rod = satMax * 0.8;
  for (let i = 0; i < p.length; i += 4) {
    let r = lut[p[i]] + cr, g = lut[p[i + 1]], b = lut[p[i + 2]] - cr;
    const L = 0.2126 * r + 0.7152 * g + 0.0722 * b, croma = (Math.max(r, g, b) - Math.min(r, g, b)) / 255;
    let k = saturacion;
    if (satMax < 1 && croma * saturacion > rod) { const c2 = croma * saturacion, sal = rod + (satMax - rod) * (1 - Math.exp(-(c2 - rod) / Math.max(1e-3, satMax - rod))); k = saturacion * sal / c2; }
    p[i] = L + (r - L) * k; p[i + 1] = L + (g - L) * k; p[i + 2] = L + (b - L) * k;
  }
  ctx.putImageData(img, 0, 0);
}

// ── Cielo de cuento: degradado, sol con halo y rayos, en una esfera (textura estática) ────────────────────
// paradas: colores de arriba a abajo (cénit → horizonte → bajo el horizonte); sol: { azimut (rad, 0 = −z), altura (rad),
// color, tam (0–1) }, rayos: número de haces del sol (0 = ninguno). No usa niebla. Devuelve la malla.
export function crearCielo({ paradas = ['#3A5BA8', '#9FB8E8', '#F4D6B0', '#C8A07A'], sol = null, rayos = 0, radio = 400, semilla = 5 } = {}) {
  const W = 2048, H = 1024, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const c = cv.getContext('2d', { willReadFrequently: true });
  const gr = c.createLinearGradient(0, 0, 0, H);
  paradas.forEach((col, i) => gr.addColorStop(i === paradas.length - 1 ? 1 : Math.min(0.5, i * 0.5 / Math.max(1, paradas.length - 2)), col));
  c.fillStyle = gr; c.fillRect(0, 0, W, H);
  if (sol) {
    const x = ((sol.azimut ?? 0) / (Math.PI * 2) + 0.75) % 1 * W, y = H / 2 - (sol.altura ?? 0.1) / (Math.PI / 2) * H / 2, r = (sol.tam ?? 0.05) * H;
    for (let i = 0; i < rayos; i++) {
      const a = (i / rayos) * Math.PI * 2 + srand(semilla, i) * 0.3, ab = 0.05 + srand(semilla + 1, i) * 0.06, L = H * (0.6 + srand(semilla + 2, i) * 0.6);
      const gg = c.createRadialGradient(x, y, r, x, y, L); gg.addColorStop(0, 'rgba(255,240,200,0.28)'); gg.addColorStop(1, 'rgba(255,240,200,0)');
      c.fillStyle = gg; c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(a - ab) * L, y + Math.sin(a - ab) * L); c.lineTo(x + Math.cos(a + ab) * L, y + Math.sin(a + ab) * L); c.closePath(); c.fill();
    }
    const halo = c.createRadialGradient(x, y, r * 0.6, x, y, r * 5); halo.addColorStop(0, 'rgba(255,236,190,0.75)'); halo.addColorStop(1, 'rgba(255,236,190,0)');
    c.fillStyle = halo; c.fillRect(0, 0, W, H);
    c.fillStyle = sol.color || '#FFF2C8'; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill();
  }
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.generateMipmaps = false; tex.minFilter = THREE.LinearFilter;
  const m = new THREE.Mesh(new THREE.SphereGeometry(radio, 48, 24), new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide, fog: false, depthWrite: false }));
  m.name = 'cielo'; m.userData.noExportar = true; m.renderOrder = -10;
  return m;
}
