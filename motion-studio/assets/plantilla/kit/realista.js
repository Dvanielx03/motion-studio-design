// Motion Studio · kit/realista.js — acabado 3D «realista estilizado» para la ruta 2.5D (módulo ES).
// Nació del Short «The Hotel That Rose With the Guests Inside» (18 nov 2026), tras medir que la referencia del nicho
// (Ricks Clips, Shorts del 5 y 15 nov) usa luz física: cielo real, sombras suaves, oclusión ambiental, brillo en las luces
// y materiales con relieve, mientras nuestros pilotos usaban colores por bandas (MeshToonMaterial).
//
// Qué da:
//  · crearMotorRealista(): PBR con tono ACES, oclusión ambiental (GTAO), brillo (bloom) y sombras suaves, y un pase
//    aparte para los personajes 2D (capa CAPA_PERSONAJES): se dibujan DESPUÉS del tono y del AO, con la profundidad del
//    escenario, así que conservan su color plano (toneMapped:false), los tapa lo que está delante y no se oscurecen.
//  · cieloFisico(): cielo de Preetham (three/addons Sky) + mapa de entorno PMREM para la luz ambiente.
//  · entornoInterior(): luz ambiente de interior (RoomEnvironment) para escenas cerradas.
//  · luzSol(): sol con sombra suave que también recibe la sombra de los billboards (capa CAPA_SOMBRA).
//  · texturaPBR(): texturas procedurales sembradas (color + relieve + rugosidad): ladrillo, madera, tablones, barro,
//    tierra, piedra, adoquín, yeso, hierro, tela.
//  · prepararPersonaje() / prepararManada(): pasa un billboard o una manada de kit/escena3d.js al pase de personajes.
//  · nubes(): nubes pintadas en planos lejanos.
//
// Contrato determinista (lo que se comprobó al crearlo):
//  · GTAOPass (three 0.170) crea su ruido de eliminación de grano con SimplexNoise() → Math.random: cada página (cada
//    trabajador del render) tendría otro ruido y los segmentos no casarían. Aquí se sustituye por uno sembrado.
//  · Se dibuja dos veces por fotograma (como crearMotor) y sin MSAA; el suavizado sale del supermuestreo ss×.
//  · Las texturas se generan una vez al cargar con semillas: no dependen del orden de los t.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { Sky } from 'three/addons/objects/Sky.js';
import { SimplexNoise } from 'three/addons/math/SimplexNoise.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

export const CAPA_PERSONAJES = 1;   // billboards y manadas: pase propio, sin tono ni AO
export const CAPA_SOMBRA = 2;       // proyectores de sombra de los billboards: solo los ve la cámara de sombras

// generador sembrado sin estado global (mulberry32)
export function semillero(seed) {
  let a = seed >>> 0;
  return () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

// ── Motor ────────────────────────────────────────────────────────────────────────────────────────────────────────
export function crearMotorRealista({ W, H, ss = 1.5, exposicion = 1.0, ao = {}, bloom = {}, sombras = true } = {}) {
  const GW = Math.round(W * ss), GH = Math.round(H * ss);
  const gl = document.createElement('canvas'); gl.width = GW; gl.height = GH;
  const renderer = new THREE.WebGLRenderer({ canvas: gl, antialias: false, alpha: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(1); renderer.setSize(GW, GH, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = exposicion;
  renderer.shadowMap.enabled = sombras; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(GW, GH, { type: THREE.HalfFloatType }));
  composer.setPixelRatio(1); composer.setSize(GW, GH);
  const pRender = new RenderPass(new THREE.Scene(), new THREE.PerspectiveCamera());
  composer.addPass(pRender);
  let pAO = null;
  if (ao) {
    pAO = new GTAOPass(new THREE.Scene(), new THREE.PerspectiveCamera(), GW, GH);
    // ruido sembrado (el de three usa Math.random)
    const tam = 64, datos = new Uint8Array(tam * tam * 4), sx = new SimplexNoise({ random: semillero(ao.semilla ?? 9) });
    for (let i = 0; i < tam; i++) for (let j = 0; j < tam; j++) {
      const k = (i * tam + j) * 4;
      datos[k] = (sx.noise(i, j) * 0.5 + 0.5) * 255; datos[k + 1] = (sx.noise(i + tam, j) * 0.5 + 0.5) * 255;
      datos[k + 2] = (sx.noise(i, j + tam) * 0.5 + 0.5) * 255; datos[k + 3] = (sx.noise(i + tam, j + tam) * 0.5 + 0.5) * 255;
    }
    const ruido = new THREE.DataTexture(datos, tam, tam); ruido.wrapS = ruido.wrapT = THREE.RepeatWrapping; ruido.needsUpdate = true;
    pAO.pdNoiseTexture.dispose(); pAO.pdNoiseTexture = ruido; pAO.pdMaterial.uniforms.tNoise.value = ruido;
    pAO.updateGtaoMaterial({ radius: ao.radio ?? 0.55, distanceExponent: ao.exponente ?? 1.5, thickness: ao.grosor ?? 1.2, scale: ao.escala ?? 1.0, samples: ao.muestras ?? 16 });
    pAO.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 16 });
    pAO.blendIntensity = ao.intensidad ?? 1.0;
    composer.addPass(pAO);
  }
  let pBloom = null;
  if (bloom) { pBloom = new UnrealBloomPass(new THREE.Vector2(GW, GH), bloom.fuerza ?? 0.35, bloom.radio ?? 0.5, bloom.umbral ?? 1.0); composer.addPass(pBloom); }
  composer.addPass(new OutputPass());
  const soloProfundidad = new THREE.MeshBasicMaterial({ colorWrite: false });
  const _transl = new WeakMap();   // por escena: objetos transparentes (se recalcula si cambia el número de hijos)
  function translucidos(escena) {
    let n = 0; escena.traverse(() => { n++; });
    const c = _transl.get(escena); if (c && c.n === n) return c.lista;
    const lista = [];
    escena.traverse(o => { const m = o.material; if (!m || o.isSky) return; const ms = Array.isArray(m) ? m : [m];
      if ((o.isMesh || o.isPoints || o.isSprite) && ms.every(x => x.transparent || x.depthWrite === false || x.blending === THREE.AdditiveBlending)) lista.push(o); });
    _transl.set(escena, { n, lista }); return lista;
  }

  function pase(escena, camara) {
    const capas = camara.layers.mask, fondo = escena.background;
    renderer.toneMappingExposure = escena.userData.exposicion ?? exposicion;
    camara.layers.set(0);
    pRender.scene = escena; pRender.camera = camara;
    if (pAO) { pAO.scene = escena; pAO.camera = camara; }
    renderer.autoClear = true;
    composer.render();
    // personajes encima: profundidad del escenario y después la capa de personajes (sin tono: color plano del dibujo)
    renderer.setRenderTarget(null); renderer.autoClear = false; renderer.clearDepth();
    // lo transparente o sin escritura de profundidad (haces, nubes, manchas, polvo) NO tapa a los personajes: el material
    // de reemplazo escribiría su profundidad (con overrideMaterial, depthWrite vuelve a ser true)
    const ocultos = translucidos(escena), previo = ocultos.map(o => o.visible);
    ocultos.forEach(o => { o.visible = false; });
    escena.background = null; escena.overrideMaterial = soloProfundidad;
    renderer.render(escena, camara);
    escena.overrideMaterial = null;
    ocultos.forEach((o, i) => { o.visible = previo[i]; });
    camara.layers.set(CAPA_PERSONAJES);
    renderer.render(escena, camara);
    escena.background = fondo; camara.layers.mask = capas; renderer.autoClear = true;
  }
  const _proy = new THREE.Matrix4(), _proyInv = new THREE.Matrix4();
  function dibujar(ctx, escena, camara, { x = 0, y = 0, w = W, h = H } = {}) {
    if (!(w > 0 && h > 0)) return;
    const asp = w / h, aspPrevio = camara.aspect, cambia = camara.isPerspectiveCamera && Math.abs(camara.aspect - asp) > 1e-9;
    if (cambia) { _proy.copy(camara.projectionMatrix); _proyInv.copy(camara.projectionMatrixInverse); camara.aspect = asp; camara.updateProjectionMatrix(); }
    try { pase(escena, camara); pase(escena, camara); }
    finally { if (cambia) { camara.aspect = aspPrevio; camara.projectionMatrix.copy(_proy); camara.projectionMatrixInverse.copy(_proyInv); } }
    ctx.save(); ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(gl, 0, 0, GW, GH, x, y, w, h); ctx.restore();
  }
  return { renderer, gl, ss, W, H, composer, ao: pAO, bloom: pBloom, dibujar };
}

// ── Personajes en su pase ─────────────────────────────────────────────────────────────────────────────────────────
// Billboard de E3.crearBillboard(): el plano visible pasa a CAPA_PERSONAJES (color plano, sin tono ni AO) y el proyector
// de sombra a CAPA_SOMBRA (solo lo ve la cámara de sombras de luzSol()). brillo > 1 compensa un dibujo que se quiere más
// luminoso que el blanco del lienzo (no hace falta: sin tono, el blanco del dibujo sale blanco).
export function prepararPersonaje(b, { brillo = 1, tinte = null } = {}) {
  b.plano.layers.set(CAPA_PERSONAJES);
  b.plano.material.toneMapped = false; b.plano.material.color.setScalar(brillo); if (tinte) b.plano.material.color.multiply(new THREE.Color(tinte));
  for (const h of b.objeto.children) if (h !== b.plano && h.castShadow) h.layers.set(CAPA_SOMBRA);
  return b;
}
export function prepararManada(m, { tinte = null } = {}) {
  m.objeto?.traverse?.(o => { if ((o.isInstancedMesh && o.material?.map) || (o.isMesh && o.material?.map && o.material.alphaTest > 0)) { o.layers.set(CAPA_PERSONAJES); o.material.toneMapped = false; if (tinte) o.material.color.multiply(new THREE.Color(tinte)); } });
  return m;
}

// ── Luz ─────────────────────────────────────────────────────────────────────────────────────────────────────────
export function luzSol(escena, { color = '#fff1dc', intensidad = 3.2, dir = [-6, 9, 7], foco = [0, 0, 0], radio = 18, res = 4096, lejos = 90, bias = -0.0003, normalBias = 0.03, radioSombra = 3 } = {}) {
  const luz = new THREE.DirectionalLight(color, intensidad);
  luz.position.set(foco[0] + dir[0], foco[1] + dir[1], foco[2] + dir[2]); luz.target.position.set(...foco);
  luz.castShadow = true; luz.shadow.mapSize.set(res, res);
  Object.assign(luz.shadow.camera, { left: -radio, right: radio, top: radio, bottom: -radio, near: 0.5, far: lejos });
  luz.shadow.camera.layers.enable(CAPA_SOMBRA);
  luz.shadow.bias = bias; luz.shadow.normalBias = normalBias; luz.shadow.radius = radioSombra;
  escena.add(luz, luz.target);
  return luz;
}
// Cielo físico (Preetham) + entorno PMREM. elevacion/azimut en grados. Devuelve { cielo, sol (vector unitario), entorno }.
// El cielo se usa como fondo (malla grande sin niebla) y su PMREM como luz ambiente de los materiales PBR.
export function cieloFisico(renderer, escena, { elevacion = 18, azimut = 210, turbidez = 6, rayleigh = 1.6, mie = 0.004, mieG = 0.82, escala = 900, intensidadEntorno = 1, tinte = null } = {}) {
  const cielo = new Sky(); cielo.scale.setScalar(escala);
  const u = cielo.material.uniforms;
  u.turbidity.value = turbidez; u.rayleigh.value = rayleigh; u.mieCoefficient.value = mie; u.mieDirectionalG.value = mieG;
  const fi = THREE.MathUtils.degToRad(90 - elevacion), th = THREE.MathUtils.degToRad(azimut);
  const sol = new THREE.Vector3().setFromSphericalCoords(1, fi, th); u.sunPosition.value.copy(sol);
  escena.add(cielo);
  const pm = new THREE.PMREMGenerator(renderer);
  const e2 = new THREE.Scene(); const c2 = new Sky(); c2.scale.setScalar(escala); c2.material.uniforms = THREE.UniformsUtils.clone(u); e2.add(c2);
  if (tinte) { const h = new THREE.HemisphereLight(tinte, tinte, 0.0); e2.add(h); }
  const entorno = pm.fromScene(e2, 0.02).texture; pm.dispose();
  escena.environment = entorno; escena.environmentIntensity = intensidadEntorno;
  return { cielo, sol, entorno };
}
export function entornoInterior(renderer, escena, { intensidad = 0.6 } = {}) {
  const pm = new THREE.PMREMGenerator(renderer);
  const entorno = pm.fromScene(new RoomEnvironment(), 0.04).texture; pm.dispose();
  escena.environment = entorno; escena.environmentIntensity = intensidad;
  return entorno;
}

// ── Texturas procedurales PBR ──────────────────────────────────────────────────────────────────────────────────────
// Ruido de valor sembrado y tileable (periodo = tam/escala). Todo en JS, una vez al cargar.
function ruidoTile(tam, celdas, rnd) {
  const g = new Float32Array(celdas * celdas); for (let i = 0; i < g.length; i++) g[i] = rnd();
  const out = new Float32Array(tam * tam), f = celdas / tam, sm = k => k * k * (3 - 2 * k);
  for (let y = 0; y < tam; y++) for (let x = 0; x < tam; x++) {
    const fx = x * f, fy = y * f, x0 = Math.floor(fx), y0 = Math.floor(fy), tx = sm(fx - x0), ty = sm(fy - y0);
    const a = g[(y0 % celdas) * celdas + x0 % celdas], b = g[(y0 % celdas) * celdas + (x0 + 1) % celdas];
    const c = g[((y0 + 1) % celdas) * celdas + x0 % celdas], d = g[((y0 + 1) % celdas) * celdas + (x0 + 1) % celdas];
    out[y * tam + x] = (a + (b - a) * tx) + ((c + (d - c) * tx) - (a + (b - a) * tx)) * ty;
  }
  return out;
}
function fbm(tam, rnd, octavas = 5, base = 4) {
  const out = new Float32Array(tam * tam); let amp = 1, total = 0;
  for (let o = 0; o < octavas; o++) { const r = ruidoTile(tam, base << o, rnd); for (let i = 0; i < out.length; i++) out[i] += r[i] * amp; total += amp; amp *= 0.5; }
  for (let i = 0; i < out.length; i++) out[i] /= total;
  return out;
}
const _hex = h => { const c = new THREE.Color(h); return [c.r * 255, c.g * 255, c.b * 255]; };
const _mixc = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
function _tex(datos, tam, color) {
  const t = new THREE.DataTexture(datos, tam, tam, THREE.RGBAFormat);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true; t.anisotropy = 8; if (color) t.colorSpace = THREE.SRGBColorSpace; t.needsUpdate = true; return t;
}
const _cache = new Map();
// tipo: 'ladrillo' | 'madera' | 'tablones' | 'barro' | 'tierra' | 'piedra' | 'adoquin' | 'yeso' | 'hierro' | 'tela'
// colores: [oscuro, medio, claro] (+ 'junta' para ladrillo/adoquín). Devuelve { map, normalMap, roughnessMap, rugosidad }.
export function texturaPBR(tipo, { semilla = 1, tam = 512, colores = null, relieve = 2.2, filas = 8, columnas = 4, junta = '#8C8378', humedad = 0 } = {}) {
  const clave = JSON.stringify([tipo, semilla, tam, colores, relieve, filas, columnas, junta, humedad]);
  if (_cache.has(clave)) return _cache.get(clave);
  const rnd = semillero(semilla * 131 + tipo.length * 977), N = tam * tam;
  const alt = new Float32Array(N), rug = new Float32Array(N), col = new Array(N);
  const P = colores || { ladrillo: ['#6E2A1E', '#9C4430', '#C06A4C'], madera: ['#4A3020', '#7A5536', '#A47A52'], tablones: ['#5A3E28', '#86603E', '#B08A60'],
    barro: ['#2E2416', '#4E3B26', '#6E5638'], tierra: ['#5A4630', '#7E6648', '#A48A68'], piedra: ['#6E6A62', '#948E84', '#BAB4A8'],
    adoquin: ['#55524C', '#7C776E', '#A29C90'], yeso: ['#BFB4A0', '#D8CFBC', '#EEE7D8'], hierro: ['#26282C', '#44474C', '#6A6E74'], tela: ['#5A1E22', '#80303A', '#A84A52'] }[tipo];
  const C = P.map(_hex), J = _hex(junta);
  const n1 = fbm(tam, rnd, 5, 4), n2 = fbm(tam, rnd, 4, 16);
  for (let y = 0; y < tam; y++) for (let x = 0; x < tam; x++) {
    const i = y * tam + x, u = x / tam, v = y / tam; let h = 0.5, r = 0.85, c;
    if (tipo === 'ladrillo' || tipo === 'adoquin') {
      const fila = Math.floor(v * filas), desf = (fila % 2) * 0.5, cu = u * columnas + desf, col_ = Math.floor(cu) % columnas;
      const fu = cu - Math.floor(cu), fv = v * filas - fila, mj = tipo === 'ladrillo' ? 0.06 : 0.09;
      const borde = Math.min(fu, 1 - fu, fv * (filas / columnas) * 0.5 + 0, (1 - fv) * (filas / columnas) * 0.5);
      const bj = Math.min(fu / mj, (1 - fu) / mj, fv / (mj * columnas / filas * 2), (1 - fv) / (mj * columnas / filas * 2));
      const id = semillero(fila * 977 + col_ * 131 + semilla)();
      if (bj < 1) { h = 0.15 + n2[i] * 0.1; c = _mixc(J, C[0], n2[i] * 0.3); r = 0.95; }
      else { const k = Math.min(1, (bj - 1) * 0.6); h = 0.55 + 0.35 * k + (n1[i] - 0.5) * 0.25 + (n2[i] - 0.5) * 0.15;
        const base = _mixc(C[0], C[2], 0.25 + id * 0.6); c = _mixc(base, C[1], n1[i] * 0.4); r = 0.78 + n2[i] * 0.15; }
      void borde;
    } else if (tipo === 'madera' || tipo === 'tablones') {
      const tablas = tipo === 'tablones' ? filas : 1, ft = v * tablas, tb = Math.floor(ft), fv = ft - tb;
      const id = semillero(tb * 733 + semilla)(), veta = Math.sin((u * 18 + n1[i] * 6 + id * 10) * Math.PI) * 0.5 + 0.5;
      const ranura = tipo === 'tablones' ? Math.min(fv, 1 - fv) < 0.035 : false;
      h = ranura ? 0.1 : 0.55 + veta * 0.18 + (n2[i] - 0.5) * 0.2;
      c = ranura ? C[0].map(z => z * 0.6) : _mixc(_mixc(C[0], C[2], 0.2 + id * 0.5), C[1], veta * 0.5);
      r = 0.7 + n2[i] * 0.2;
    } else if (tipo === 'barro' || tipo === 'tierra') {
      const charco = tipo === 'barro' ? Math.max(0, (n1[i] - 0.64 + humedad * 0.12) * 7) : 0;
      h = 0.4 + n1[i] * 0.35 + (n2[i] - 0.5) * 0.25 - Math.min(1, charco) * 0.3;
      c = _mixc(_mixc(C[0], C[2], n1[i]), C[1], n2[i] * 0.5);
      if (charco > 0) { c = _mixc(c, C[0].map(z => z * 0.55), Math.min(1, charco)); }
      r = Math.max(0.5, 0.92 - Math.min(1, charco) * 0.45 - humedad * 0.1);
      if (tipo === 'tierra' && n2[i] > 0.62) { c = _mixc(c, C[2], 0.5); h += 0.15; }   // piedrecitas
    } else if (tipo === 'piedra' || tipo === 'yeso') {
      h = 0.5 + (n1[i] - 0.5) * 0.4 + (n2[i] - 0.5) * (tipo === 'piedra' ? 0.35 : 0.12);
      c = _mixc(_mixc(C[0], C[2], n1[i]), C[1], 0.4 + n2[i] * 0.2); r = tipo === 'piedra' ? 0.85 : 0.9;
    } else if (tipo === 'hierro') {
      h = 0.5 + (n2[i] - 0.5) * 0.3; c = _mixc(C[0], C[2], n1[i] * 0.6 + n2[i] * 0.2); r = 0.45 + n1[i] * 0.35;
      if (n1[i] > 0.66) { c = _mixc(c, _hex('#7A4A2A'), (n1[i] - 0.66) * 2.5); r = 0.9; }   // óxido
    } else { // tela
      const tr = (Math.sin(u * tam * 0.9) * Math.sin(v * tam * 0.9)) * 0.5 + 0.5;
      h = 0.5 + tr * 0.15 + (n2[i] - 0.5) * 0.1; c = _mixc(_mixc(C[0], C[2], n1[i] * 0.6), C[1], tr * 0.3); r = 0.92;
    }
    alt[i] = h; rug[i] = r; col[i] = c;
  }
  const dc = new Uint8Array(N * 4), dn = new Uint8Array(N * 4), dr = new Uint8Array(N * 4);
  for (let y = 0; y < tam; y++) for (let x = 0; x < tam; x++) {
    const i = y * tam + x, xl = y * tam + (x - 1 + tam) % tam, xr = y * tam + (x + 1) % tam, yu = ((y - 1 + tam) % tam) * tam + x, yd = ((y + 1) % tam) * tam + x;
    const nx = (alt[xl] - alt[xr]) * relieve, ny = (alt[yd] - alt[yu]) * relieve, nz = 1, l = Math.hypot(nx, ny, nz);
    dn.set([(nx / l * 0.5 + 0.5) * 255, (ny / l * 0.5 + 0.5) * 255, (nz / l * 0.5 + 0.5) * 255, 255], i * 4);
    dc.set([col[i][0], col[i][1], col[i][2], 255].map(z => Math.max(0, Math.min(255, Math.round(z)))), i * 4);
    const rr = Math.max(0, Math.min(255, Math.round(rug[i] * 255))); dr.set([rr, rr, rr, 255], i * 4);
  }
  const out = { map: _tex(dc, tam, true), normalMap: _tex(dn, tam, false), roughnessMap: _tex(dr, tam, false) };
  _cache.set(clave, out); return out;
}
// Material PBR con una textura procedural repetida rep[0]×rep[1] veces. metal 0–1.
// especular (0–1): con scene.environment, three r170 IGNORA material.envMapIntensity (manda scene.environmentIntensity); para
// quitar el brillo de cielo a ras de suelo (barro que parecía hielo) se baja el especular con MeshPhysicalMaterial.
export function materialPBR(tipo, { rep = [1, 1], metal = 0, tinte = '#ffffff', normal = 1, emisivo = null, intensidadEmisivo = 1, lados = THREE.FrontSide, especular = null, ...opts } = {}) {
  const t = texturaPBR(tipo, opts);
  const clon = tex => { const c = tex.clone(); c.repeat.set(rep[0], rep[1]); c.needsUpdate = true; return c; };
  const Clase = especular === null ? THREE.MeshStandardMaterial : THREE.MeshPhysicalMaterial;
  const m = new Clase({ map: clon(t.map), normalMap: clon(t.normalMap), roughnessMap: clon(t.roughnessMap), roughness: 1,
    metalness: metal, color: new THREE.Color(tinte), side: lados, ...(especular === null ? {} : { specularIntensity: especular }) });
  m.normalScale.set(normal, normal);
  if (emisivo) { m.emissive = new THREE.Color(emisivo); m.emissiveIntensity = intensidadEmisivo; }
  return m;
}
// Material liso (pintura, metal pulido, cristal opaco, luces): sin textura.
export function materialLiso(color, { rugosidad = 0.6, metal = 0, emisivo = null, intensidadEmisivo = 1, lados = THREE.FrontSide, especular = null } = {}) {
  const m = especular === null ? new THREE.MeshStandardMaterial({ color, roughness: rugosidad, metalness: metal, side: lados })
    : new THREE.MeshPhysicalMaterial({ color, roughness: rugosidad, metalness: metal, side: lados, specularIntensity: especular });
  if (emisivo) { m.emissive = new THREE.Color(emisivo); m.emissiveIntensity = intensidadEmisivo; }
  return m;
}
// Malla con sombras (proyecta y recibe).
export function malla(geo, mat, { x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, s = 1, sombra = true } = {}) {
  const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx, ry, rz); m.scale.setScalar(s);
  m.castShadow = sombra; m.receiveShadow = true; return m;
}

// ── Nubes pintadas ─────────────────────────────────────────────────────────────────────────────────────────────
// n nubes en planos lejanos (miran a +Z salvo que se giren con el grupo). Determinista por semilla.
export function nubes({ n = 7, semilla = 3, radio = 380, altura = [60, 140], ancho = [70, 150], color = '#FFFFFF', sombra = '#C9D2E6', opacidad = 0.95, brillo = 1.25, arco = [-1.2, 1.2], centro = 0 } = {}) {
  const g = new THREE.Group(); g.name = 'nubes'; const rnd = semillero(semilla);
  for (let i = 0; i < n; i++) {
    const cv = document.createElement('canvas'); cv.width = 512; cv.height = 256; const c = cv.getContext('2d');
    const bolas = 7 + Math.floor(rnd() * 5);
    for (let pasada = 0; pasada < 2; pasada++) for (let b = 0; b < bolas; b++) {
      const r2 = semillero(semilla * 97 + i * 31 + b)(), r3 = semillero(semilla * 53 + i * 17 + b * 7)();
      const bx = 90 + (b / (bolas - 1)) * 330 + (r2 - 0.5) * 40, by = 150 - Math.sin(b / (bolas - 1) * Math.PI) * 55 + (r3 - 0.5) * 30, br = 38 + r2 * 46;
      const gr = c.createRadialGradient(bx, by - br * 0.3, br * 0.1, bx, by, br);
      if (pasada === 0) { gr.addColorStop(0, sombra); gr.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = gr; c.beginPath(); c.arc(bx, by + 10, br, 0, Math.PI * 2); c.fill(); }
      else { gr.addColorStop(0, color); gr.addColorStop(0.75, color); gr.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = gr; c.beginPath(); c.arc(bx, by - 6, br * 0.92, 0, Math.PI * 2); c.fill(); }
    }
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: opacidad, depthWrite: false, fog: false });
    mat.color.setScalar(brillo);
    const w = ancho[0] + rnd() * (ancho[1] - ancho[0]), a = centro + arco[0] + rnd() * (arco[1] - arco[0]);
    const p = new THREE.Mesh(new THREE.PlaneGeometry(w, w / 2), mat);
    p.position.set(Math.sin(a) * radio, altura[0] + rnd() * (altura[1] - altura[0]), -Math.cos(a) * radio); p.lookAt(0, p.position.y * 0.6, 0);
    p.renderOrder = -1; g.add(p);
  }
  return g;
}

// Pasto: briznas como triángulos finos instanciados (geometría, sin alfa: no ensucian el AO ni la profundidad).
// zona(rnd) → [x, z] o null para descartar. altura en m. Determinista por semilla.
export function pasto({ cantidad = 4000, zona, semilla = 5, altura = [0.18, 0.45], colores = ['#4E6B2A', '#7A9A3A', '#A8B85A'], y = 0 } = {}) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute([-0.018, 0, 0, 0.018, 0, 0, 0.004, 1, 0.01, -0.018, 0, 0, 0.004, 1, 0.01, 0.0, 0, 0.02], 3));
  geo.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({ roughness: 0.85, side: THREE.DoubleSide, vertexColors: false });
  const im = new THREE.InstancedMesh(geo, mat, cantidad); im.castShadow = false; im.receiveShadow = true;
  const rnd = semillero(semilla), m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), cs = colores.map(c => new THREE.Color(c));
  let k = 0;
  for (let tries = 0; k < cantidad && tries < cantidad * 8; tries++) {
    const p = zona(rnd); if (!p) continue;
    const h = altura[0] + rnd() * (altura[1] - altura[0]);
    e.set((rnd() - 0.5) * 0.5, rnd() * Math.PI * 2, (rnd() - 0.5) * 0.5); q.setFromEuler(e);
    m.compose(new THREE.Vector3(p[0], p[2] ?? y, p[1]), q, new THREE.Vector3(1 + rnd(), h, 1)); im.setMatrixAt(k, m);
    const c = cs[Math.floor(rnd() * cs.length)].clone().lerp(cs[0], rnd() * 0.3); im.setColorAt(k, c); k++;
  }
  im.count = k; im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true;
  return im;
}
