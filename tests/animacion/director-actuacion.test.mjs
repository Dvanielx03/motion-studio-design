// node tests/animacion/director-actuacion.test.mjs
// Funciones puras de kit/director.js (anclas a palabras, movimientos de cámara, revisión de tomas, velocidad,
// desenfoque por acumulación) y kit/actuacion.js (curva de pose con anticipación/exceso, claves de actuación, habla,
// arcos), más un humo de kit/cuento.js con los campos nuevos sobre un contexto 2D falso.
import assert from 'node:assert/strict';

const kit = '../../motion-studio/assets/plantilla/kit/';
const { crearDirector, mov, encadenar, revisarTomas, velocidadCamara, acumularMovimiento } = await import(kit + 'director.js');
const { curvaPose, crearActuacion, crearHabla, arco } = await import(kit + 'actuacion.js');
const { dibujarPersonaje, PERSONAJE } = await import(kit + 'cuento.js');
const { camaraContinua } = await import(kit + 'escena3d.js').catch(() => ({}));   // necesita three: opcional
let casos = 0;
const cerca = (a, b, eps = 1e-6, msg) => { assert.ok(Math.abs(a - b) <= eps, msg || `${a} ≈ ${b}`); casos++; };

// ── director: anclas a palabras ──
const palabras = [
  { word: ' Sloppy', start: 0.10, end: 0.52 }, { word: 'Romans?', start: 0.60, end: 1.05 }, { word: 'crack', start: 2.0, end: 2.3 },
  { word: 'the', start: 2.31, end: 2.4 }, { word: 'Crack.', start: 3.5, end: 3.9 }, { word: 'Señal', start: 4.2, end: 4.6 },
];
const D = crearDirector({ palabras });
cerca(D.en('sloppy'), 0.10); cerca(D.fin('romans'), 1.05); cerca(D.en('crack', 2), 3.5);
cerca(D.t('@crack#2+0.15'), 3.65); cerca(D.t('@crack#2$'), 3.9); cerca(D.t('@Romans-0.08'), 0.52); cerca(D.t(1.25), 1.25);
cerca(D.t('@rom'), 0.60, 1e-9, 'prefijo de 3+ letras');
cerca(D.t('@senal'), 4.2, 1e-9, 'sin tildes');
// t('@palabra', n): la ocurrencia como 2.º argumento (antes se ignoraba en silencio: P09 del hotel cayó en la 1.ª «and»)
cerca(D.t('@crack', 2), D.t('@crack#2'), 1e-9, 't(ancla, n) = ancla#n'); cerca(D.t('@crack', 2, 0), D.t('@crack#2'), 1e-9);
assert.throws(() => D.t('@crack#2', 2), /ocurrencia inválida/); assert.throws(() => D.t('@crack', 0), /ocurrencia inválida/);
assert.throws(() => D.t('@nada'), /no encuentro/); assert.throws(() => D.en('crack', 3), /n\.º 3/); assert.throws(() => D.t('crack'), /ancla inválida/);
const sb = D.resolver({ planos: [{ id: 'P01', inicio: 0, fin: '@crack$', camara: [['@sloppy', { pos: [0, 1, 5], mira: [0, 1, 0] }], ['@crack#2', { pos: [0, 1, 3], mira: [0, 1, 0] }, 'suave']] }],
  actuacion: { doctora: [['@crack#2', { pose: 'senala' }], ['@sloppy', { pose: 'reposo' }]] } });
cerca(sb.planos[0].fin, 2.3); cerca(sb.planos[0].camara[1][0], 3.5); assert.equal(sb.planos[0].camara[1][2], 'suave');
cerca(sb.actuacion.doctora[0][0], 0.10, 1e-9, 'actuación ordenada por tiempo'); casos += 1;

// ── movimientos ──
const dist = c => Math.hypot(...c.pos.map((v, i) => v - c.mira[i]));
const e = mov.empuje({ t0: 1, t1: 3, sujeto: [0, 1.5, 0], dist: [6, 3], angulo: 0.3, alto: 0.2 });
cerca(e[0][0], 1); cerca(e.at(-1)[0], 3); cerca(Math.hypot(e[0][1].pos[0], e[0][1].pos[2]), 6, 1e-9); cerca(Math.hypot(e.at(-1)[1].pos[0], e.at(-1)[1].pos[2]), 3, 1e-9);
const o = mov.orbita({ t0: 0, t1: 2, centro: [1, 1, 1], radio: 3, ang: [0, 1.2], alto: 0 });
for (const [, c] of o) cerca(dist(c), 3, 1e-9, 'órbita a radio constante');
const vt = mov.vertigo({ t0: 0, t1: 2, sujeto: [0, 1, 0], dist: [6, 2.5], fov0: 30 });
const h0 = Math.tan(30 * Math.PI / 360) * 6;
for (const [, c] of vt) cerca(Math.tan(c.fov * Math.PI / 360) * dist(c), h0, 1e-9, 'vértigo: el sujeto conserva tamaño');
assert.ok(vt.at(-1)[1].fov > 60, 'vértigo abre el fov al acercarse'); casos++;
const gr = mov.grua({ t0: 0, t1: 1, sujeto: [0, 0, 0], alto: [0.5, 6], dist: [4, 7], miraAlto: [1, 0] });
assert.ok(gr.at(-1)[1].pos[1] > gr[0][1].pos[1]); casos++;
const ch = encadenar(e, mov.orbita({ t0: 3, t1: 5, centro: [0, 1.5, 0], radio: 3, ang: [0.3, -0.4], alto: 0.2 }));
assert.throws(() => encadenar(e, mov.orbita({ t0: 3, t1: 5, centro: [0, 1.5, 0], radio: 3, ang: [0.3, -0.4] })), /salto de cámara/, 'junta que no coincide'); casos++;
const hc = encadenar(e, mov.hacia({ t1: 4, pos: [1, 2, 3], mira: [0, 1, 0], por: [[3.5, { pos: [0.9, 1.9, 3], mira: [0, 1.2, 0], fov: 42 }]] }));
assert.equal(hc.length, e.length + 2); assert.deepEqual(hc.at(-1)[1].pos, [1, 2, 3]); assert.equal(hc.at(-1)[1].fov, 42, 'hacia hereda el fov'); casos += 3;
assert.equal(ch.filter(k => Math.abs(k[0] - 3) < 1e-6).length, 1, 'encadenar no repite la clave de la junta');
for (let i = 1; i < ch.length; i++) assert.ok(ch[i][0] > ch[i - 1][0]); casos += 2;
const sg = mov.seguir({ t0: 0, t1: 2, trayectoria: t => [t * 2, 0, 0], offset: [0, 1, 4], retardo: 0.4 });
assert.ok(sg.at(-1)[1].pos[0] < 4 && sg.at(-1)[1].pos[0] > 3, 'seguir: la cámara llega con retardo');
assert.ok(sg.at(-1)[1].mira[0] > sg.at(-1)[1].pos[0], 'seguir: deja aire por delante del movimiento'); casos += 2;
const rv = mov.revelar({ t0: 0, t1: 1, sujeto: [0, 1, 0], lado: -1, barrido: 2 });
cerca(rv[0][1].pos[0], -2); cerca(rv.at(-1)[1].pos[0], 0);

// ── revisión de tomas y velocidad (sobre camaraContinua si three está disponible; si no, interpolación lineal) ──
const interp = camaraContinua || ((t, K) => { let i = 1; while (i < K.length - 1 && t > K[i][0]) i++; const [a, A] = K[i - 1], [b, B] = K[i], k = Math.min(1, Math.max(0, (t - a) / (b - a)));
  const L = (x, y) => x.map((v, j) => v + (y[j] - v) * k); return { pos: L(A.pos, B.pos), mira: L(A.mira, B.mira), fov: (A.fov ?? 42) + ((B.fov ?? 42) - (A.fov ?? 42)) * k }; });
const quieto = [[0, { pos: [0, 1, 5], mira: [0, 1, 0], fov: 40 }], [8, { pos: [0.05, 1, 5], mira: [0, 1, 0], fov: 40 }]];
const vivo = encadenar(mov.empuje({ t0: 0, t1: 4, sujeto: [0, 1, 0], dist: [6, 3.5] }), mov.orbita({ t0: 4, t1: 8, centro: [0, 1, 0], radio: 3.5, ang: [0, 0.8] }));
const av1 = revisarTomas([{ id: 'Q', inicio: 0, fin: 8 }], t => interp(t, quieto));
const av2 = revisarTomas([{ id: 'V', inicio: 0, fin: 8 }], t => interp(t, vivo));
assert.ok(av1.length >= 1 && av1[0].plano === 'Q', 'toma quieta detectada'); assert.equal(av2.length, 0, 'toma con empuje y órbita pasa'); casos += 2;
cerca(velocidadCamara(t => interp(t, quieto), 4, 30), 0, 0.01, 'cámara casi quieta');
const rapida = [[0, { pos: [0, 1, 5], mira: [0, 1, 0], fov: 40 }], [0.4, { pos: [5, 1, 0], mira: [0, 1, 0], fov: 40 }]];
assert.ok(velocidadCamara(t => interp(t, rapida), 0.2, 30) > 1.2, 'whip de órbita: supera el umbral de desenfoque'); casos++;

// ── desenfoque por acumulación: promedio exacto y determinista ──
const W = 4, H = 2, buf = new Uint8ClampedArray(W * H * 4);
const ctx = { getImageData: () => ({ data: buf.slice() }), createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }), putImageData(img) { buf.set(img.data); } };
const vistos = [];
acumularMovimiento(ctx, W, H, 1, ts => { vistos.push(ts); buf.fill(Math.round((ts - 1) * 30 * 200 + 100)); }, { muestras: 4, obturador: 0.5, fps: 30 });
assert.equal(vistos.length, 4); cerca(vistos[0], 1 - 0.375 * 0.5 / 30, 1e-6); cerca((vistos[0] + vistos[3]) / 2, 1, 1e-9, 'obturador centrado');
cerca(buf[0], 100, 1, 'promedio de las submuestras');

// ── actuación ──
const op = { anticipa: 0.12, tAnt: 0.1, dura: 0.26, exceso: 0.1 };
cerca(curvaPose(0, op), 0); assert.ok(curvaPose(0.08, op) < 0, 'anticipa'); casos++;
let maxi = -1; for (let t = 0; t < 1; t += 1 / 240) maxi = Math.max(maxi, curvaPose(t, op));
cerca(maxi, 1.1, 0.01, 'exceso'); cerca(curvaPose(0.9, op), 1, 0.01, 'asienta');
let salto = 0; for (let t = 0; t < 1; t += 1 / 30) salto = Math.max(salto, Math.abs(curvaPose(t + 1 / 30, op) - curvaPose(t, op)));
assert.ok(salto < 0.3, `sin saltos grandes entre fotogramas (máx ${salto.toFixed(3)})`); casos++;
const act = crearActuacion([[2, { pose: 'brazos_arriba', cara: 'feliz' }], [0, { pose: 'reposo', cara: 'neutral', ropa: { tipo: 'bata' } }]], { base: PERSONAJE.cientifica });
const a0 = act(1), a1 = act(2.05), a2 = act(2.3), a3 = act(4);
assert.equal(a0.pose, 'reposo'); assert.equal(a0.poseB, undefined);
assert.equal(a1.pose, 'reposo'); assert.equal(a1.poseB, 'brazos_arriba'); assert.ok(a1.mezcla < 0, 'anticipación en la clave');
assert.ok(a2.mezcla > 0.5); assert.equal(a3.poseB, undefined); assert.equal(a3.pose, 'brazos_arriba'); assert.equal(a3.ropa.tipo, 'bata', 'hereda de claves anteriores');
assert.equal(a3.gafas, true, 'hereda la ficha'); assert.ok(a1.acento > 0.3 && a3.acento < 0.01, 'acento decae'); assert.ok(Math.abs(a2.inercia) > 0, 'inercia en la transición');
assert.ok(Math.abs(a3.inclina) <= 0.018 + 1e-9 && a3.inclina !== 0, 'sostén vivo acotado'); casos += 12;
assert.deepEqual(act(2.13), act(2.13), 'determinista'); casos++;
const hp = crearHabla(null, { ventanas: [[1, 2]] }), he = crearHabla({ fps: 10, valores: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.9, 0.05, 0.5] }, { dps: 10 });
cerca(hp(0.5), 0); assert.ok(hp(1.5) >= 0 && hp(1.5) <= 1); cerca(he(1.0), 1, 1e-9); cerca(he(1.1), 0, 1e-9, 'bajo el umbral la boca cierra'); assert.ok(he(1.2) > 0.4 && he(1.2) < 0.7); casos++;
const a = [0, 0], b = [10, -10], m = arco(a, b, 0.5, -5, 0.22);
cerca(arco(a, b, 0, -5)[0], 0); cerca(arco(a, b, 1, -5)[1], -10);
assert.ok(m[0] > 5 && m[1] > -5, 'el arco se abomba hacia fuera del cuerpo'); casos++;
const hz = arco([0, 0], [10, 0], 0.5, 0); assert.ok(hz[1] > 0, 'recorrido horizontal: péndulo hacia abajo (y crece hacia abajo)'); casos++;

// ── cuento.js con los campos nuevos sobre un contexto 2D falso (solo que no rompa y respete save/restore) ──
let pila = 0;
const falso = new Proxy({}, { get: (o, k) => k === 'save' ? () => pila++ : k === 'restore' ? () => pila-- : (k in o ? o[k] : () => {}), set: (o, k, v) => (o[k] = v, true) });
for (const mezcla of [-0.4, 0, 0.5, 1.12, 1.4]) for (const habla of [0, 0.3, 0.9]) for (const lado of [1, -1])
  dibujarPersonaje(falso, 1.25, { ...PERSONAJE.inventor, pose: 'reposo', poseB: 'senala', mezcla, habla, acento: 0.6, inercia: -0.7, inclina: 0.02, lado, cara: 'feliz', pelo: 'largo' }, 400, 560);
assert.equal(pila, 0, 'save/restore equilibrados'); casos++;

console.log(`OK director-actuacion: ${casos} comprobaciones${camaraContinua ? ' (con camaraContinua)' : ' (sin three: interpolación lineal)'}`);
