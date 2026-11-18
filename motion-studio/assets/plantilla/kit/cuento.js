// Personajes «de cuento» para la ruta 2.5D: cabeza clara y redonda con cara mínima (ojos de punto, cejas gruesas que
// actúan, boca de línea), cuerpo de VESTUARIO sólido (túnica, toga, armadura…), brazos de línea con manos redondas y
// símbolos de expresión (lágrimas de risa, sudor, «Z», «!», «?», venas, estrellas, rubor). Es el registro de los Shorts
// narrados de historia más vistos (análisis del 18 nov 2026, references/produccion-25d.md), con diseño propio: no
// copia personajes ni identidad de ningún canal.
//
// Uso (billboard de kit/escena3d.js; los pies quedan en el borde inferior y el cuerpo centrado):
//   import { dibujarPersonaje, PERSONAJE } from './kit/cuento.js';
//   const b = E3.crearBillboard({ ancho: 1.3, alto: 1.8, res: 1600, dibujar: dibujarPersonaje, luz });
//   b.actualizar(q24(t), camara, { ...PERSONAJE.inventor, cara: 'sorpresa', pose: 'senala', simbolos: ['exclamacion'] });
//
// est (todo opcional):
//   ropa: { tipo: 'tunica'|'tunica_corta'|'toga'|'armadura'|'sacerdote'|'levita'|'bata'|'chaleco_obra', color, ribete, cinturon }
//   piel, pelo: 'calvo'|'corto'|'coleta'|'rizos'|'largo'|'mono', colorPelo, bigote: 'fino'|'grueso'|'barba'|'chiva', gafas,
//   sombrero: 'corona'|'laurel'|'gorro'|'casco'|'capucha'|'turbante'|'birrete'|'mitra'|'casco_obra', colorSombrero
//   cara: 'neutral'|'feliz'|'firme'|'sorpresa'|'risa'|'carcajada'|'enojo'|'suspicaz'|'miedo'|'dormido'|'orgullo'|
//         'verguenza'|'triste';  boca (anula la de la cara): 'o'|'abierta'|'sonrisa'|'linea'|'triste'|'dientes'
//   mira [x, y] (−1..1), giro (−1..1: la cara gira a un lado), lado (−1 = espejo), luz [lx, ly]
//   pose: 'reposo'|'senala'|'brazos_arriba'|'manos_boca'|'manos_cara'|'sostiene'|'ofrece'|'cruzados'|'menton'|
//         'camina'|'corre'|'empuja'|'encoge';  poseB + mezcla (0–1): transición entre dos poses
//   dir (grados de 'senala', 0 = derecha, −90 = arriba), fase (0–1 del ciclo de camina/corre; si falta, sale de t)
//   objeto(c, s, x, y): dibuja lo que sostiene entre las manos (pose 'sostiene'/'ofrece'), rebote (0–1), simbolos []
// Determinista: todo sale de t (cuantízalo a 12/24 dibujos/s al llamar) y de est. Sin fuentes: los símbolos son trazos.
const TINTA = '#1E1A22';
const k01 = x => Math.min(1, Math.max(0, x));
const mix = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k];

export const PERSONAJE = {
  // fichas de ejemplo (ajusta colores por video y guárdalas en la biblioteca del canal)
  inventor: { ropa: { tipo: 'tunica', color: '#3E6FB0', ribete: '#E8C76A', cinturon: '#E8C76A' }, pelo: 'coleta', colorPelo: '#2A2230', bigote: 'chiva' },
  rey: { ropa: { tipo: 'tunica', color: '#7A2238', ribete: '#F0C24A', cinturon: '#F0C24A' }, sombrero: 'corona', bigote: 'grueso' },
  guardia: { ropa: { tipo: 'armadura', color: '#8A8F9C', ribete: '#7A2A22' }, sombrero: 'casco', colorSombrero: '#9AA0AC' },
  sacerdote: { ropa: { tipo: 'sacerdote', color: '#E9E1CF', ribete: '#B8862E' }, sombrero: 'mitra', colorSombrero: '#E9E1CF', bigote: 'barba', colorPelo: '#CFC8BC' },
  aldeano: { ropa: { tipo: 'tunica_corta', color: '#8A6A44', ribete: '#5A4630', cinturon: '#3A2E22' }, pelo: 'corto', colorPelo: '#3A2A20' },
  cientifica: { ropa: { tipo: 'bata', color: '#F2F4F6', ribete: '#4A7AB0' }, pelo: 'largo', colorPelo: '#5A3A28', gafas: true },
  obrero_moderno: { ropa: { tipo: 'chaleco_obra', color: '#F28C28', ribete: '#E8EEF2' }, sombrero: 'casco_obra', pelo: 'corto', colorPelo: '#2A2230' },
};

function el(c, x, y, rx, ry, rot = 0) { c.beginPath(); c.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot, 0, Math.PI * 2); }
function relleno(c, s, color, g = 1.3) { c.fillStyle = color; c.fill(); c.lineWidth = s * g; c.strokeStyle = TINTA; c.lineJoin = 'round'; c.lineCap = 'round'; c.stroke(); }
function linea(c, pts, g, color = TINTA) {
  c.lineJoin = 'round'; c.lineCap = 'round'; c.strokeStyle = color; c.lineWidth = g;
  c.beginPath(); c.moveTo(...pts[0]); for (let i = 1; i < pts.length; i++) c.lineTo(...pts[i]); c.stroke();
}
function ik(a, t, l1, l2, dir) {
  let dx = t[0] - a[0], dy = t[1] - a[1], d = Math.hypot(dx, dy); const dmax = (l1 + l2) * 0.999;
  if (d > dmax) { dx *= dmax / d; dy *= dmax / d; d = dmax; }
  const ang = Math.atan2(dy, dx), off = Math.acos(Math.min(1, Math.max(-1, (l1 * l1 + d * d - l2 * l2) / (2 * l1 * Math.max(d, 1e-6)))));
  return [[a[0] + Math.cos(ang + dir * off) * l1, a[1] + Math.sin(ang + dir * off) * l1], [a[0] + dx, a[1] + dy]];
}

// manos objetivo por pose (unidades s; cx = centro). Devuelve { m: [izq, der], codo: [dir, dir], lean, frente }
function pose(nombre, s, cx, d, est, hy) {
  const H = (x, y) => [cx + x * s, y * s];
  const fase = est.fase ?? ((d / 12) % (nombre === 'corre' ? 0.34 : 0.5)) / (nombre === 'corre' ? 0.34 : 0.5);
  switch (nombre) {
    case 'senala': { const a = (est.dir ?? -35) * Math.PI / 180; return { m: [H(-9, 60), [cx + 7 * s + Math.cos(a) * 23 * s, 39 * s + Math.sin(a) * 23 * s]], codo: [1, -1], dedo: 1 }; }
    case 'brazos_arriba': { const w = Math.sin(d * 1.4) * 2; return { m: [H(-14 + w, 17), H(14 - w, 17)], codo: [1, -1] }; }
    case 'manos_boca': return { m: [H(-3, hy / s + 9), H(3, hy / s + 9)], codo: [-1, 1], frente: true };
    case 'manos_cara': return { m: [H(-12.5, hy / s + 4), H(12.5, hy / s + 4)], codo: [1, -1], frente: true };
    case 'sostiene': return { m: [H(-6, est.alturaObjeto ?? 54), H(6, est.alturaObjeto ?? 54)], codo: [1, -1], frente: true };
    case 'ofrece': return { m: [H(-9, 60), H(18, est.alturaObjeto ?? 50)], codo: [1, -1], palma: 1 };
    case 'cruzados': return { m: [H(5, 50), H(-5, 52)], codo: [1, -1], frente: true };
    case 'menton': return { m: [H(-1, 52), H(2.5, hy / s + 12)], codo: [1, -1], frente: true };
    case 'empuja': return { m: [H(17, 49), H(17, 56)], codo: [1, 1], lean: 0.12, frente: true };
    case 'encoge': return { m: [H(-14, 43), H(14, 43)], codo: [1, -1], hombros: 2 };
    case 'camina': case 'corre': {
      const corre = nombre === 'corre', a = Math.sin(fase * Math.PI * 2), amp = corre ? 11 : 6;
      return { m: [H(-3 + a * amp, corre ? 50 : 60), H(3 - a * amp, corre ? 50 : 60)], codo: corre ? [-1, -1] : [1, -1], lean: corre ? 0.16 : 0.04, ciclo: fase, corre };
    }
    default: return { m: [H(-9, 60), H(9, 60)], codo: [1, -1] };
  }
}

export function dibujarPersonaje(c, t, est = {}, w, h) {
  const s = h / 100, d = Math.floor(t * 12 + 1e-6), lado = est.lado ?? 1;
  const ropa = { tipo: 'tunica', color: '#3E6FB0', ribete: '#E8C76A', ...(est.ropa || {}) };
  const piel = est.piel || '#F5EFE6', cara = est.cara || 'neutral';
  c.save();
  if (lado < 0) { c.translate(w, 0); c.scale(-1, 1); }
  const cx = w / 2, SUELO = 97.5 * s;
  // rebote (risa, salto) y respiración
  const reb = (est.rebote || 0) * Math.abs(Math.sin(d * 1.35)) * 2.2 * s, resp = Math.sin(d * 0.5) * 0.25 * s;
  const hy = 22 * s - reb + resp, R = 14 * s;
  // pose (con transición) y postura
  const pA = pose(est.pose || 'reposo', s, cx, d, est, hy), pB = est.poseB ? pose(est.poseB, s, cx, d, est, hy) : null, km = k01(est.mezcla ?? 0);
  const P = pB ? { ...pB, ...(km < 0.5 ? pA : {}), m: [mix(pA.m[0], pB.m[0], km), mix(pA.m[1], pB.m[1], km)], lean: (pA.lean || 0) * (1 - km) + (pB.lean || 0) * km } : pA;
  const lean = P.lean || 0;
  c.translate(cx, SUELO); c.rotate(lean); c.translate(-cx, -SUELO);
  c.translate(0, -reb);
  const corta = ropa.tipo === 'tunica_corta' || ropa.tipo === 'armadura' || ropa.tipo === 'chaleco_obra' || ropa.tipo === 'bata';
  const hombroY = 38.5 * s - (P.hombros || 0) * s + resp, bajo = (corta ? 79 : 90) * s;
  // ── piernas (visibles bajo la túnica corta; si no, solo los zapatos asoman) ──
  const ciclo = P.ciclo, paso = ciclo !== undefined ? Math.sin(ciclo * Math.PI * 2) : 0, zancada = P.corre ? 7 : 4;
  const pie = i => [cx + (i ? 3.4 : -3.4) * s + (i ? -paso : paso) * zancada * s, SUELO - Math.max(0, (i ? -paso : paso)) * (P.corre ? 3 : 1.5) * s];
  for (const i of [0, 1]) {
    const p = pie(i);
    if (corta) linea(c, [[cx + (i ? 3 : -3) * s, bajo - 1 * s], p], (ropa.tipo === 'bata' || ropa.tipo === 'chaleco_obra' ? 3.2 : 1.7) * s, ropa.tipo === 'bata' || ropa.tipo === 'chaleco_obra' ? (ropa.pantalon || '#3A4A66') : TINTA);
    el(c, p[0] + 1.6 * s, p[1] - 0.6 * s, 3 * s, 1.6 * s); relleno(c, s, '#3A2A22', 1);
  }
  // ── cuerpo de vestuario (A con vuelo; el bajo se mece al caminar) ──
  const vuelo = paso * 1.2 * s;
  const cuerpo = () => {
    c.beginPath(); c.moveTo(cx - 6.5 * s, hombroY);
    c.quadraticCurveTo(cx - 8.5 * s, hombroY + 2 * s, cx - 9.5 * s, hombroY + 10 * s);
    c.lineTo(cx - (corta ? 10.5 : 12.5) * s + vuelo, bajo);
    c.quadraticCurveTo(cx, bajo + 2 * s, cx + (corta ? 10.5 : 12.5) * s + vuelo, bajo);
    c.lineTo(cx + 9.5 * s, hombroY + 10 * s);
    c.quadraticCurveTo(cx + 8.5 * s, hombroY + 2 * s, cx + 6.5 * s, hombroY); c.closePath();
  };
  // brazo de atrás antes del cuerpo si la pose no lleva las manos al frente
  const brazo = i => {
    const sh = [cx + (i ? 7 : -7) * s, hombroY + 1 * s], [codo, mano] = ik(sh, P.m[i], 13 * s, 12 * s, P.codo[i]);
    linea(c, [sh, codo, mano], 1.6 * s);
    el(c, mano[0], mano[1], 2.6 * s, 2.6 * s); relleno(c, s, piel, 1.1);
    if (i === 1 && P.dedo) { const a = Math.atan2(mano[1] - codo[1], mano[0] - codo[0]); linea(c, [mano, [mano[0] + Math.cos(a) * 3.6 * s, mano[1] + Math.sin(a) * 3.6 * s]], 1.4 * s, TINTA); }
    if (i === 1 && P.palma) for (let f = 0; f < 3; f++) linea(c, [[mano[0] - 1.5 * s + f * 1.5 * s, mano[1] - 1.6 * s], [mano[0] - 1.8 * s + f * 1.6 * s, mano[1] - 4 * s]], 1.2 * s, TINTA);
    return mano;
  };
  if (!P.frente) brazo(0);
  cuerpo(); relleno(c, s, ropa.color, 1.3);
  // detalles del vestuario
  c.save(); cuerpo(); c.clip();
  c.fillStyle = 'rgba(255,255,255,0.12)'; c.fillRect(cx - 12 * s, hombroY, 6 * s, bajo - hombroY);   // luz lateral suave
  c.fillStyle = 'rgba(30,20,40,0.16)'; c.fillRect(cx + 5 * s, hombroY, 9 * s, bajo - hombroY);
  if (ropa.tipo === 'toga') { c.fillStyle = ropa.ribete; c.beginPath(); c.moveTo(cx - 7 * s, hombroY); c.lineTo(cx - 2 * s, hombroY); c.lineTo(cx + 12 * s, bajo - 18 * s); c.lineTo(cx + 12 * s, bajo - 10 * s); c.closePath(); c.fill(); }
  if (ropa.tipo === 'sacerdote') { c.fillStyle = ropa.ribete; for (const sx of [-1, 1]) c.fillRect(cx + sx * 3.2 * s - 1.3 * s, hombroY, 2.6 * s, bajo - hombroY); }
  if (ropa.tipo === 'armadura') { c.fillStyle = 'rgba(30,30,40,0.35)'; for (let i = 0; i < 4; i++) c.fillRect(cx - 12 * s, hombroY + (6 + i * 5.5) * s, 24 * s, 0.9 * s);
    c.fillStyle = ropa.ribete; for (let i = -3; i <= 3; i++) c.fillRect(cx + i * 3 * s - 1.1 * s, bajo - 9 * s, 2.2 * s, 9 * s); }
  if (ropa.tipo === 'bata') { c.fillStyle = ropa.camisa || '#7FA8D8'; c.beginPath(); c.moveTo(cx - 3 * s, hombroY); c.lineTo(cx, hombroY + 9 * s); c.lineTo(cx + 3 * s, hombroY); c.fill();
    linea(c, [[cx, hombroY + 9 * s], [cx, bajo]], 0.9 * s, 'rgba(40,40,60,0.6)'); c.fillStyle = 'rgba(40,40,60,0.18)'; c.fillRect(cx + 4 * s, hombroY + 12 * s, 4.5 * s, 3.2 * s);
    if (ropa.ribete) { c.fillStyle = ropa.ribete; c.fillRect(cx + 5 * s, hombroY + 10.5 * s, 0.8 * s, 3 * s); } }
  if (ropa.tipo === 'chaleco_obra') { c.fillStyle = ropa.camisa || '#4A6A9A'; c.fillRect(cx - 14 * s, hombroY, 5 * s, 30 * s); c.fillRect(cx + 9 * s, hombroY, 5 * s, 30 * s);
    c.fillStyle = ropa.ribete || '#E8EEF2'; for (const yy of [16, 26]) c.fillRect(cx - 12 * s, hombroY + yy * s, 24 * s, 2 * s); }
  if (ropa.tipo === 'levita') { c.fillStyle = 'rgba(255,255,255,0.85)'; c.beginPath(); c.moveTo(cx - 2 * s, hombroY); c.lineTo(cx, hombroY + 12 * s); c.lineTo(cx + 2 * s, hombroY); c.fill(); }
  if (ropa.ribete && !['armadura', 'bata', 'chaleco_obra'].includes(ropa.tipo)) { c.fillStyle = ropa.ribete; c.fillRect(cx - 14 * s, bajo - 2.2 * s, 28 * s, 2.2 * s); }
  if (ropa.cinturon) { c.fillStyle = ropa.cinturon; c.fillRect(cx - 12 * s, hombroY + 17 * s, 24 * s, 2.4 * s); }
  c.restore();
  cuerpo(); c.lineWidth = 1.3 * s; c.strokeStyle = TINTA; c.stroke();
  // cuello del vestido
  el(c, cx, hombroY + 0.5 * s, 4 * s, 1.6 * s); relleno(c, s, ropa.ribete || ropa.color, 1);
  // ── cabeza ──
  const g = est.giro || 0, fx = cx + g * 4 * s;
  if (est.pelo === 'largo') { c.beginPath(); c.moveTo(cx - R * 1.05, hy - R * 0.2); c.quadraticCurveTo(cx - R * 1.25, hy + R * 1.1, cx - R * 0.6, hy + R * 1.35); c.lineTo(cx + R * 0.6, hy + R * 1.35); c.quadraticCurveTo(cx + R * 1.25, hy + R * 1.1, cx + R * 1.05, hy - R * 0.2); c.closePath(); relleno(c, s, est.colorPelo || '#5A3A28', 1.1); }
  if (est.pelo === 'mono') { el(c, cx - g * 2 * s, hy - R * 1.02, 4.2 * s, 3.4 * s); relleno(c, s, est.colorPelo || '#2A2230', 1.1); }
  if (est.pelo === 'coleta') { el(c, cx - g * 3 * s, hy - R * 0.95, 3.4 * s, 3 * s); relleno(c, s, est.colorPelo || '#2A2230', 1.1); }
  el(c, cx, hy, R * 1.02, R * 0.96); relleno(c, s, piel, 1.4);
  if (est.luz) {   // media luna de sombra fría y borde cálido del lado de la luz
    const [lx, ly] = est.luz, n = Math.hypot(lx, ly) || 1, ux = lx / n, uy = ly / n;
    c.save(); el(c, cx, hy, R * 0.99, R * 0.93); c.clip();
    c.beginPath(); c.rect(cx - 2 * R, hy - 2 * R, 4 * R, 4 * R); c.ellipse(cx + ux * R * 0.3, hy + uy * R * 0.3, R * 1.02, R * 0.96, 0, 0, Math.PI * 2);
    c.fillStyle = 'rgba(80,70,120,0.18)'; c.fill('evenodd'); c.restore();
  }
  if (est.pelo === 'corto' || est.pelo === 'rizos' || est.pelo === 'largo' || est.pelo === 'mono') {
    c.save(); el(c, cx, hy, R * 1.02, R * 0.96); c.clip(); c.fillStyle = est.colorPelo || '#3A2A20';
    c.beginPath(); c.ellipse(cx - g * 2 * s, hy - R * 0.85, R * 1.1, R * 0.45, 0, 0, Math.PI * 2); c.fill(); c.restore();
    el(c, cx, hy, R * 1.02, R * 0.96); c.lineWidth = 1.4 * s; c.strokeStyle = TINTA; c.stroke();
  }
  cara_(c, s, fx, hy, R, cara, est, d, piel);
  if (est.gafas) { for (const sx of [-1, 1]) { el(c, fx + sx * 4.6 * s, hy + 0.4 * s, 3.4 * s, 3 * s); c.lineWidth = 0.9 * s; c.strokeStyle = TINTA; c.stroke(); c.fillStyle = 'rgba(200,230,255,0.18)'; c.fill(); }
    linea(c, [[fx - 1.2 * s, hy], [fx + 1.2 * s, hy]], 0.8 * s); }
  sombrero(c, s, cx - g * 1.5 * s, hy, R, est);
  // ── brazos de delante ──
  if (P.frente) { if (est.objeto) est.objeto(c, s, (P.m[0][0] + P.m[1][0]) / 2, (P.m[0][1] + P.m[1][1]) / 2); brazo(0); }
  else if (est.objeto) est.objeto(c, s, P.m[1][0], P.m[1][1]);
  brazo(1);
  simbolos(c, s, fx, hy, R, [...(est.simbolos || []), ...(cara === 'carcajada' ? ['lagrimas'] : []), ...(cara === 'dormido' ? ['zzz'] : []), ...(cara === 'miedo' ? ['sudor'] : []), ...(cara === 'verguenza' ? ['rubor'] : [])], d, g);
  c.restore();
}

function ceja(c, s, x, y, ancho, ang, g = 1.6) {
  const dx = Math.cos(ang) * ancho / 2, dy = Math.sin(ang) * ancho / 2;
  linea(c, [[x - dx, y - dy], [x + dx, y + dy]], g * s);
}
function cara_(c, s, fx, hy, R, cara, est, d, piel) {
  const mira = est.mira || [0, 0], parp = ((d + 23) % 41) === 0;
  const ex = 4.6 * s, ey = hy + 0.5 * s, cy = hy - 4.4 * s;
  // ojos
  const ojoPunto = (x, y, k = 1) => { el(c, x + mira[0] * 0.9 * s, y + mira[1] * 0.8 * s, 1.25 * s * k, 1.75 * s * k); c.fillStyle = TINTA; c.fill(); };
  const ojoGrande = (x, y) => { el(c, x, y, 3.1 * s, 3.5 * s); relleno(c, s, '#FFFFFF', 1); el(c, x + mira[0] * 1.2 * s, y + mira[1] * 1.2 * s, 1.0 * s, 1.15 * s); c.fillStyle = TINTA; c.fill(); };
  const ojoCerrado = (x, y, arriba = true) => { c.beginPath(); c.moveTo(x - 2 * s, y); c.quadraticCurveTo(x, y + (arriba ? -2.2 : 1.6) * s, x + 2 * s, y); c.lineWidth = 1.3 * s; c.strokeStyle = TINTA; c.lineCap = 'round'; c.stroke(); };
  for (const sx of [-1, 1]) {
    const x = fx + sx * ex;
    if (parp && !['risa', 'carcajada', 'dormido', 'orgullo'].includes(cara)) { ojoCerrado(x, ey, false); continue; }
    if (cara === 'sorpresa' || cara === 'miedo') ojoGrande(x, ey - 0.6 * s);
    else if (cara === 'risa' || cara === 'orgullo') ojoCerrado(x, ey, true);
    else if (cara === 'carcajada') { linea(c, [[x - 1.8 * s * sx, ey - 1.6 * s], [x + 1.4 * s * sx, ey], [x - 1.8 * s * sx, ey + 1.6 * s]], 1.3 * s); }
    else if (cara === 'dormido') ojoCerrado(x, ey + 0.5 * s, false);
    else if (cara === 'suspicaz') { ojoPunto(x, ey, 0.9); linea(c, [[x - 2.2 * s, ey - 1.2 * s], [x + 2.2 * s, ey - 1.2 * s]], 1.2 * s); }
    else if (cara === 'verguenza') ojoPunto(x, ey + 0.6 * s, 0.85);
    else ojoPunto(x, ey);
  }
  // cejas (la actuación vive aquí)
  const C = { neutral: [0, 0], feliz: [0.08, -0.6], firme: [-0.12, 0.3], sorpresa: [0.12, -2.4], risa: [0.12, -1.2], carcajada: [-0.2, -0.6],
    enojo: [-0.42, 0.9], miedo: [0.35, -1.6], dormido: [0, 0.4], orgullo: [0.1, -1], verguenza: [0.35, -0.8], triste: [0.38, -0.4] }[cara] || [0, 0];
  for (const sx of [-1, 1]) {
    let ang = -sx * C[0], dy = C[1] * s;
    if (cara === 'suspicaz') { ang = sx > 0 ? -0.25 : 0.12; dy = sx > 0 ? -1.8 * s : 0.6 * s; }
    ceja(c, s, fx + sx * ex, cy + dy, 4.6 * s, ang, 1.7);
  }
  // bigote / barba
  const by = hy + 6.6 * s;
  if (est.bigote === 'grueso') { el(c, fx - 2.2 * s, by - 1.2 * s, 2.8 * s, 1.3 * s, 0.2); relleno(c, s, est.colorPelo || '#2A2230', 0.8); el(c, fx + 2.2 * s, by - 1.2 * s, 2.8 * s, 1.3 * s, -0.2); relleno(c, s, est.colorPelo || '#2A2230', 0.8); }
  if (est.bigote === 'fino') for (const sx of [-1, 1]) { c.beginPath(); c.moveTo(fx, by - 1.4 * s); c.quadraticCurveTo(fx + sx * 3 * s, by - 2.4 * s, fx + sx * 4.6 * s, by - 0.8 * s); c.lineWidth = 0.9 * s; c.strokeStyle = TINTA; c.stroke(); }
  // boca
  const boca = est.boca || { neutral: 'linea', feliz: 'sonrisa', firme: 'linea', sorpresa: 'o', risa: 'abierta', carcajada: 'abierta', enojo: 'triste', suspicaz: 'lado',
    miedo: 'ondas', dormido: 'o', orgullo: 'sonrisa', verguenza: 'ondas', triste: 'triste' }[cara] || 'linea';
  const my = hy + 7.8 * s;
  if (boca === 'linea') linea(c, [[fx - 2 * s, my], [fx + 2 * s, my]], 1.1 * s);
  else if (boca === 'lado') linea(c, [[fx - 1.2 * s, my + 0.3 * s], [fx + 2.6 * s, my - 0.6 * s]], 1.1 * s);
  else if (boca === 'sonrisa') { c.beginPath(); c.moveTo(fx - 2.6 * s, my - 0.4 * s); c.quadraticCurveTo(fx, my + 2.2 * s, fx + 2.6 * s, my - 0.4 * s); c.lineWidth = 1.1 * s; c.strokeStyle = TINTA; c.stroke(); }
  else if (boca === 'triste') { c.beginPath(); c.moveTo(fx - 2.4 * s, my + 1 * s); c.quadraticCurveTo(fx, my - 1.4 * s, fx + 2.4 * s, my + 1 * s); c.lineWidth = 1.1 * s; c.strokeStyle = TINTA; c.stroke(); }
  else if (boca === 'o') { el(c, fx, my + 0.4 * s, 1.3 * s, 1.6 * s); relleno(c, s, '#4A2028', 0.9); }
  else if (boca === 'ondas') linea(c, [[fx - 2.4 * s, my], [fx - 1.2 * s, my - 0.6 * s], [fx, my], [fx + 1.2 * s, my - 0.6 * s], [fx + 2.4 * s, my]], 1 * s);
  else if (boca === 'abierta' || boca === 'dientes') {
    c.beginPath(); c.moveTo(fx - 3.6 * s, my - 1 * s); c.lineTo(fx + 3.6 * s, my - 1 * s); c.quadraticCurveTo(fx + 3.4 * s, my + 4 * s, fx, my + 4.2 * s); c.quadraticCurveTo(fx - 3.4 * s, my + 4 * s, fx - 3.6 * s, my - 1 * s);
    relleno(c, s, '#4A2028', 1);
    c.save(); c.clip(); c.fillStyle = '#FFFFFF'; c.fillRect(fx - 4 * s, my - 1 * s, 8 * s, 1.5 * s); el(c, fx, my + 3.8 * s, 2.2 * s, 1.3 * s); c.fillStyle = '#D85A6A'; c.fill(); c.restore();
  }
  if (est.bigote === 'barba' || est.bigote === 'chiva') {
    c.beginPath(); const bw = est.bigote === 'barba' ? 7 : 2.6;
    c.moveTo(fx - bw * s, hy + 9.4 * s); c.quadraticCurveTo(fx, hy + (est.bigote === 'barba' ? 19 : 15) * s, fx + bw * s, hy + 9.4 * s);
    c.quadraticCurveTo(fx, hy + 11.4 * s, fx - bw * s, hy + 9.4 * s); relleno(c, s, est.colorPelo || '#2A2230', 0.9);
  }
}

function sombrero(c, s, x, hy, R, est) {
  const tipo = est.sombrero, col = est.colorSombrero, top = hy - R * 0.92;
  if (!tipo) return;
  c.save();
  if (tipo === 'corona') { c.beginPath(); c.moveTo(x - 8 * s, top + 1 * s); c.lineTo(x - 8.5 * s, top - 6 * s); c.lineTo(x - 4.2 * s, top - 2.4 * s); c.lineTo(x, top - 7.4 * s); c.lineTo(x + 4.2 * s, top - 2.4 * s); c.lineTo(x + 8.5 * s, top - 6 * s); c.lineTo(x + 8 * s, top + 1 * s); c.closePath(); relleno(c, s, col || '#F0C24A', 1.1);
    for (const dx of [-4.5, 0, 4.5]) { el(c, x + dx * s, top - 1 * s, 1 * s, 1 * s); c.fillStyle = '#C8304A'; c.fill(); } }
  else if (tipo === 'laurel') { for (const sx of [-1, 1]) for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + sx * (0.5 + i * 0.32); el(c, x + Math.cos(a) * R * 0.98, hy + Math.sin(a) * R * 0.9, 2.2 * s, 1 * s, a + sx * 0.6); relleno(c, s, col || '#6FA04A', 0.6); } }
  else if (tipo === 'gorro') { c.beginPath(); c.moveTo(x - 10 * s, top + 3 * s); c.quadraticCurveTo(x - 9 * s, top - 7 * s, x + 2 * s, top - 7 * s); c.quadraticCurveTo(x + 9 * s, top - 6 * s, x + 6 * s, top - 1 * s); c.lineTo(x + 10 * s, top + 3 * s); c.closePath(); relleno(c, s, col || '#B23A3A', 1.1); }
  else if (tipo === 'casco') { c.beginPath(); c.ellipse(x, top + 3 * s, R * 0.98, R * 0.62, 0, Math.PI, 0); c.closePath(); relleno(c, s, col || '#9AA0AC', 1.1);
    c.beginPath(); c.moveTo(x - 6 * s, top - 4 * s); c.quadraticCurveTo(x, top - 11 * s, x + 6 * s, top - 4 * s); c.lineTo(x + 4 * s, top - 3 * s); c.quadraticCurveTo(x, top - 7 * s, x - 4 * s, top - 3 * s); c.closePath(); relleno(c, s, '#B23A3A', 0.9); }
  else if (tipo === 'capucha') { c.beginPath(); c.ellipse(x, hy, R * 1.12, R * 1.06, 0, Math.PI * 0.95, Math.PI * 2.05); c.lineTo(x + R * 0.8, hy + R * 0.2); c.quadraticCurveTo(x, hy - R * 0.85, x - R * 0.8, hy + R * 0.2); c.closePath(); relleno(c, s, col || '#5A4A3A', 1.1); }
  else if (tipo === 'turbante') { for (let i = 0; i < 3; i++) { el(c, x, top + (2 - i * 2.4) * s, R * (0.98 - i * 0.12), 3 * s); relleno(c, s, col || '#E8E0CC', 1); } }
  else if (tipo === 'birrete') { c.beginPath(); c.rect(x - 7 * s, top - 3 * s, 14 * s, 4.4 * s); relleno(c, s, col || '#2A2A34', 1); c.beginPath(); c.moveTo(x - 11 * s, top - 3 * s); c.lineTo(x, top - 7 * s); c.lineTo(x + 11 * s, top - 3 * s); c.lineTo(x, top + 0.5 * s); c.closePath(); relleno(c, s, col || '#2A2A34', 1); }
  else if (tipo === 'casco_obra') { c.beginPath(); c.ellipse(x, top + 3.5 * s, R * 0.98, R * 0.72, 0, Math.PI, 0); c.closePath(); relleno(c, s, col || '#F2C42A', 1.1);
    el(c, x, top + 3.6 * s, R * 1.18, 1.6 * s); relleno(c, s, col || '#F2C42A', 1); linea(c, [[x, top - 5.6 * s], [x, top + 2.4 * s]], 1.2 * s, 'rgba(40,30,10,0.45)'); }
  else if (tipo === 'mitra') { c.beginPath(); c.moveTo(x - 8 * s, top + 2 * s); c.lineTo(x - 6 * s, top - 9 * s); c.quadraticCurveTo(x, top - 15 * s, x + 6 * s, top - 9 * s); c.lineTo(x + 8 * s, top + 2 * s); c.closePath(); relleno(c, s, col || '#E9E1CF', 1.1);
    c.fillStyle = '#B8862E'; c.fillRect(x - 1 * s, top - 12 * s, 2 * s, 13 * s); }
  c.restore();
}

// símbolos de expresión: trazos animados por dibujo (d), sin fuentes
function simbolos(c, s, fx, hy, R, lista, d, g) {
  const L = new Set(lista);
  if (L.has('rubor')) for (const sx of [-1, 1]) { el(c, fx + sx * 7.4 * s, hy + 4.4 * s, 2.8 * s, 1.5 * s); c.fillStyle = 'rgba(232,70,80,0.55)'; c.fill();
    for (let i = -1; i <= 1; i++) linea(c, [[fx + sx * 7.4 * s + i * 1.6 * s - 0.6 * s, hy + 5.4 * s], [fx + sx * 7.4 * s + i * 1.6 * s + 0.6 * s, hy + 3.4 * s]], 0.6 * s, 'rgba(160,30,40,0.8)'); }
  if (L.has('lagrimas')) for (const sx of [-1, 1]) {
    const k = (d % 4) / 4;
    c.beginPath(); c.moveTo(fx + sx * 6.4 * s, hy + 0.6 * s); c.quadraticCurveTo(fx + sx * 11 * s, hy - 3 * s, fx + sx * 13.5 * s, hy + 3 * s); c.lineWidth = 1.6 * s; c.strokeStyle = '#7FC8F0'; c.stroke();
    el(c, fx + sx * (13.5 + k * 1.5) * s, hy + (4 + k * 6) * s, 1.1 * s, 1.5 * s); c.fillStyle = '#7FC8F0'; c.fill();
  }
  if (L.has('sudor')) { const k = (d % 12) / 12, x = fx + R * 0.9, y = hy - R * 0.5 + k * 5 * s;
    c.beginPath(); c.moveTo(x, y - 2.6 * s); c.quadraticCurveTo(x + 1.8 * s, y + 0.4 * s, x, y + 1.4 * s); c.quadraticCurveTo(x - 1.8 * s, y + 0.4 * s, x, y - 2.6 * s); relleno(c, s, '#9AD6F4', 0.7); }
  if (L.has('zzz')) for (let i = 0; i < 3; i++) {
    const k = ((d / 12 + i * 0.33) % 1), x = fx + R * 0.7 + k * 8 * s + i * 1.5 * s, y = hy - R * 0.8 - k * 12 * s, z = (1.4 + i * 0.5) * s;
    c.globalAlpha = 1 - k * 0.8; linea(c, [[x - z, y - z], [x + z, y - z], [x - z, y + z], [x + z, y + z]], 0.9 * s, '#F2F2F8'); c.globalAlpha = 1;
  }
  if (L.has('exclamacion')) { const e = 1 + 0.15 * Math.max(0, 1 - (d % 6) / 3), x = fx + R * 0.95, y = hy - R * 1.25;
    c.save(); c.translate(x, y); c.scale(e, e); linea(c, [[0, -4 * s], [0, 1.2 * s]], 1.6 * s, '#F2C14A'); el(c, 0, 3.4 * s, 0.9 * s, 0.9 * s); c.fillStyle = '#F2C14A'; c.fill(); c.restore(); }
  if (L.has('interrogacion')) { const x = fx + R * 0.95, y = hy - R * 1.25; c.beginPath(); c.arc(x, y - 2 * s, 2.2 * s, Math.PI, Math.PI * 2.4); c.lineTo(x, y + 1.6 * s); c.lineWidth = 1.5 * s; c.strokeStyle = '#F2F2F8'; c.lineCap = 'round'; c.stroke(); el(c, x, y + 4 * s, 0.8 * s, 0.8 * s); c.fillStyle = '#F2F2F8'; c.fill(); }
  if (L.has('venas')) { const x = fx + R * 0.55, y = hy - R * 0.6; for (const a of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) { c.beginPath(); c.arc(x + Math.cos(a + 0.785) * 1.6 * s, y + Math.sin(a + 0.785) * 1.6 * s, 1.1 * s, a + Math.PI * 0.75, a + Math.PI * 1.25); c.lineWidth = 0.8 * s; c.strokeStyle = '#D83A3A'; c.stroke(); } }
  if (L.has('estrellas')) for (let i = 0; i < 3; i++) { const a = d * 0.6 + i * 2.1, x = fx + Math.cos(a) * R * 0.9, y = hy - R * 1.05 + Math.sin(a) * 2 * s;
    c.beginPath(); for (let j = 0; j < 10; j++) { const r = (j % 2 ? 0.7 : 1.7) * s, b = j * Math.PI / 5 - Math.PI / 2; c.lineTo(x + Math.cos(b) * r, y + Math.sin(b) * r); } c.closePath(); c.fillStyle = '#F2D24A'; c.fill(); }
}
