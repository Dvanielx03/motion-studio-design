// Motion Studio · plantilla 2.5D — composición de ejemplo (6 s, dos planos). Reemplázala por el video del brief.
// Escenario 3D con bandas y contorno, un personaje 2D como billboard con sombra real, una manada instanciada,
// cámara 3D por claves y textos 2D encima. Guía: references/25d.md («Escenarios Three.js»).
import * as THREE from 'three';
import * as E3 from './kit/escena3d.js';

try {
  const cfg = await (await fetch('motion.config.json')).json();
  // ?vista=0.5 (render.mjs --vista): menor tamaño y sin supermuestreo para el animatic técnico
  const VISTA = Math.min(1, +new URLSearchParams(location.search).get('vista') || 1);
  const W = Math.round(cfg.video.ancho * VISTA), H = Math.round(cfg.video.alto * VISTA);
  const cv = document.getElementById('c'); cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d');
  await document.fonts.ready;
  const { texto } = crearTexto(ctx);
  const tr = crearTransiciones(W, H);
  const motor = E3.crearMotor({ W, H, ss: VISTA < 1 ? 1 : 2, fondo: '#202a3a' });

  // ── Paleta de EJEMPLO (la del video sale del brief / de la referencia) ──
  const C = { suelo: '#6d6a72', acera: '#8c8792', muro: ['#c98f5e', '#a8b07a', '#d2b48c', '#8fa3b8', '#b98579'],
    ventana: '#2d3445', luzVentana: '#f2c46b', linea: '#1b1714', niebla: '#3a4660', piel: '#e2b48f', ropa: '#3f6fb5', rata: '#5b5150' };

  // ── Escenario «calle»: todo lo que es decorado va en `decorado` (es lo que se exporta a Blender) ──
  function crearCalle() {
    const escena = new THREE.Scene(), decorado = new THREE.Group(); decorado.name = 'calle';
    escena.add(decorado);
    E3.niebla(escena, C.niebla, 14, 48);
    const { luz } = E3.iluminar(escena, { foco: [0, 0, -4], radio: 16, dir: [-6, 10, 4] });
    const suelo = new THREE.Mesh(new THREE.PlaneGeometry(40, 80), E3.material(C.suelo));
    suelo.rotation.x = -Math.PI / 2; suelo.position.z = -20; suelo.receiveShadow = true; decorado.add(suelo);
    for (const lado of [-1, 1]) {
      decorado.add(E3.caja(2.4, 0.15, 60, C.acera, { x: lado * 3.4, z: -20, linea: 0.015, colorLinea: C.linea }));
      for (let i = 0; i < 6; i++) {
        const alto = 4 + srand(11, i * 2 + (lado > 0)) * 5, z = 2 - i * 6.2;
        const edificio = E3.caja(4.6, alto, 5.6, C.muro[(i + (lado > 0 ? 2 : 0)) % C.muro.length],
          { x: lado * 7, z, linea: 0.03, colorLinea: C.linea });
        decorado.add(edificio);
        for (let f = 0; f < Math.floor(alto / 1.6); f++) for (const dz of [-1.4, 1.4]) {
          const encendida = srand(23, i * 40 + f * 2 + (dz > 0) + (lado > 0) * 500) > 0.6;
          const v = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 1.0), E3.material(encendida ? C.luzVentana : C.ventana, { plano: true }));
          v.position.set(lado * (7 - 2.31), 1.4 + f * 1.6, z + dz); v.rotation.y = -lado * Math.PI / 2; decorado.add(v);
        }
      }
    }
    const anclas = { general: { pos: [0, 1.6, 9], mira: [0, 1.4, 0], fov: 38 }, ras_suelo: { pos: [2.2, 0.35, 1.5], mira: [0, 0.3, -1], fov: 45 } };
    // actualizar(t, camara): lo que se ANIMA del decorado (faroles que parpadean, toldos, puertas…) va aquí, desde t y sin
    // estado; no en P.actores. reposo = el t en que el decorado está en su estado base (lo que se exporta a Blender);
    // sin reposo, se usa el inicio del primer plano del entorno. Este decorado de ejemplo no se anima.
    const actualizar = (t, camara) => {};
    return { escena, decorado, luz, anclas, actualizar, reposo: 0 };
  }
  const ENT = { calle: crearCalle() };

  // ── Personaje 2D (billboard): un dibujo por estado, 12 dibujos por segundo ──
  function dibujarPaseante(c, t, est, w, h) {
    const paso = Math.floor(t * 12) / 12, a = Math.sin(paso * Math.PI * 2 * 1.1) * 0.45, s = h / 100;
    c.lineCap = 'round'; c.lineJoin = 'round'; c.strokeStyle = C.linea; c.lineWidth = 2.2 * s;
    const pierna = (ang, x0) => { c.beginPath(); c.moveTo(x0, 52 * s); c.lineTo(x0 + Math.sin(ang) * 46 * s, 52 * s + Math.cos(ang) * 46 * s); c.stroke(); };
    c.save(); c.lineWidth = 7 * s; c.strokeStyle = '#2b2b33'; pierna(a, w / 2 - 3 * s); pierna(-a, w / 2 + 3 * s); c.restore();
    c.fillStyle = C.ropa; c.beginPath(); c.roundRect(w / 2 - 13 * s, 24 * s, 26 * s, 32 * s, 9 * s); c.fill(); c.stroke();
    c.fillStyle = C.piel; c.beginPath(); c.arc(w / 2, 14 * s, 10 * s, 0, Math.PI * 2); c.fill(); c.stroke();
    c.fillStyle = C.linea; c.beginPath(); c.arc(w / 2 + 3.5 * s, 13 * s, 1.4 * s, 0, Math.PI * 2); c.fill();
  }
  const paseante = E3.crearBillboard({ ancho: 0.95, alto: 1.75, res: 640, dibujar: dibujarPaseante, luz: ENT.calle.luz, nombre: 'paseante' });
  ENT.calle.escena.add(paseante.objeto);

  // ── Manada: 28 ratas con un ciclo de 4 dibujos ──
  function dibujarRata(c, k, w, h) {
    const s = h / 40, y = 30 * s + (k % 2) * 1.5 * s;
    c.fillStyle = C.rata; c.strokeStyle = C.linea; c.lineWidth = 1.6 * s; c.lineCap = 'round';
    c.beginPath(); c.ellipse(w * 0.5, y - 6 * s, 15 * s, 8 * s, 0, 0, Math.PI * 2); c.fill(); c.stroke();
    c.beginPath(); c.ellipse(w * 0.22, y - 8 * s, 7 * s, 5.5 * s, -0.3, 0, Math.PI * 2); c.fill(); c.stroke();
    c.beginPath(); c.moveTo(w * 0.8, y - 5 * s); c.quadraticCurveTo(w * 0.95, y - 16 * s + k * 3 * s, w * 0.99, y - 4 * s); c.stroke();
    for (const [x0, f] of [[0.38, 1], [0.62, -1]]) {
      c.beginPath(); c.moveTo(w * x0, y); c.lineTo(w * x0 + f * Math.sin(k * Math.PI / 2) * 4 * s, y + 6 * s); c.stroke();
    }
  }
  const ratas = E3.crearManada({ cantidad: 28, ancho: 0.55, alto: 0.3, cuadros: 4, dibujarCuadro: dibujarRata, nombre: 'ratas',
    pose: (i, t) => {
      const sale = 3.2 + srand(5, i) * 1.4, vel = 3.2 + srand(6, i) * 1.4, x = 5 - (t - sale) * vel;
      return { x, z: -0.4 - srand(7, i) * 2.6, escala: 0.85 + srand(8, i) * 0.4, cuadro: E3.cuadroCiclo(t, 4, 12, srand(9, i)),
        espejo: false, visible: t >= sale && x > -7 };
    } });
  ENT.calle.escena.add(ratas.objeto);

  // ── Planos ──
  const PLANOS = [
    { id: 'P01', inicio: 0, fin: 3, entorno: 'calle', salida: { tipo: 'corte' },
      camara: [[0, ENT.calle.anclas.general], [3, { pos: [0, 1.5, 6], mira: [0, 1.3, -2], fov: 38 }, 'suave']],
      actores: t => { paseante.objeto.position.set(0.6, 0, lerp(-6, -1.2, prog(t, 0, 3))); return { paseante: {} }; } },
    { id: 'P02', inicio: 3, fin: 6, entorno: 'calle',
      camara: [[3, ENT.calle.anclas.ras_suelo], [6, { pos: [1.6, 0.3, 0.8], mira: [-0.5, 0.3, -1], fov: 45 }, 'suave']],
      golpes: [[4.0, 0.06]],
      actores: t => { paseante.objeto.position.set(-0.9, 0, -2.6); return { paseante: { espejo: true } }; } },
  ];
  const camara = new THREE.PerspectiveCamera(38, W / H, 0.05, 200);

  function dibujarPlano(c, t, P) {
    const E = ENT[P.entorno];
    const extra = E3.respiracion3D(t, 0.012), sac = E3.temblor3D(t, P.golpes || []);
    E3.aplicarCamara(camara, E3.camaraClaves(t, P.camara), extra.map((v, j) => v + sac[j]));
    E.actualizar?.(t, camara);
    const est = P.actores(t);
    paseante.actualizar(t, camara, est.paseante);
    ratas.actualizar(t, camara);
    motor.dibujar(c, E.escena, camara);
    texto(P.id + ' · plantilla 2.5D', `600 ${Math.round(H * 0.022)}px system-ui, sans-serif`, '#f2efe8', W / 2, H * 0.93,
      { ctx: c, sombra: true });
  }
  const lista = PLANOS.map(P => ({ fin: P.fin, salida: P.salida, plano: (c, t) => dibujarPlano(c, t, P) }));
  window.seek = t => { ctx.reset(); tr.montaje(ctx, t, lista); };
  // planos (caché por plano, pops.py): [id, inicio, fin, salidaDur]. salidaDur = lo que dura la transición de SALIDA, que
  // sigue dibujando el plano después de su `fin`; la caché amplía el plano por ella. Se mide con tr.duracion, la misma
  // regla que tr.montaje (un corte dura 0; sin `dur`, DUR_TRANSICION). Un kit antiguo sin tr.duracion: salida.dur o 0.
  const salidaDur = p => tr.duracion ? tr.duracion(p.salida) : (p.salida?.dur ?? 0);
  window.__info = { planos: PLANOS.map(p => [p.id, p.inicio, p.fin, salidaDur(p)]) };
  // revisión automática de composición (qc_escena.mjs): espera a seek; textos: [{ id, x, y, w, h, letras }]
  window.__qc = async t => { await window.seek(t); return { textos: [], protegidos: [paseante.rect(camara, W, H, { foco: true })] }; };

  // exportación a Blender (node exportar_glb.mjs calle). exportarGLB saca el estado del ÚLTIMO fotograma dibujado
  // (precalentar y seek dejan el decorado en cualquier t): antes se pone el entorno en su t de reposo, así el .glb no
  // depende de qué se dibujó por última vez.
  window.__entornos = Object.keys(ENT);
  window.exportar = async n => {
    const E = ENT[n];
    if (!E) throw new Error(`entorno desconocido: «${n}» (hay: ${Object.keys(ENT).join(', ')})`);
    const reposo = E.reposo ?? PLANOS.find(P => P.entorno === n)?.inicio ?? 0;
    E.actualizar?.(reposo, camara);
    return E3.exportarGLB(E.decorado, E.anclas);
  };

  E3.precalentar(W, H, PLANOS, dibujarPlano);
  window.seek(0);
  if (VISTA < 1) window.__vista = VISTA;
  window.ready = true;
} catch (e) { window.loadError = String(e && e.stack || e); }
