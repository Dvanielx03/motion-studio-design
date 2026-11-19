// Motion Studio · qc_escena.mjs — revisión automática de composición sobre el video entero, sin renderizarlo.
//
//   node qc_escena.mjs                cada 0,25 s de toda la pieza          -> review/qc/qc.json + hojas de los fallos
//   node qc_escena.mjs --paso=0.1 --desde=0 --hasta=6.5
//
// Contrato (opcional) de la página: window.__qc(t) dibuja t y devuelve las cajas en píxeles del cuadro. Puede ser async
// (y entonces debe esperar a seek: `window.__qc = async t => { await window.seek(t); return {...}; }`):
//   { textos: [{ id, x, y, w, h, letras }], protegidos: [{ id, x, y, w, h, foco?: true, imprescindible?: true, visible?: false, fuera?: true }] }
//   · textos: subtítulos, rótulos y cifras dibujados encima (no los diegéticos que ya viven en el escenario).
//     letras = caracteres visibles del texto, para la regla 4; cuenta el MÁXIMO visto en cada aparición (un texto que se
//     escribe letra a letra mide con su largo final). Sin `letras`: AVISO «lectura no comprobada» por texto;
//     letras: 0 = no es texto que se lea, p. ej. un icono.
//   · protegidos: lo que el texto no debe tapar (cara, manos, objeto del gag); foco: true = debe verse entero.
//     visible: false (o caja vacía) = no está en cuadro en ese instante: no cuenta para ninguna regla.
//     fuera: true = está en escena pero fuera del encuadre (p. ej. detrás de la cámara; lo da rectPantalla del kit 3D):
//     no cuenta para la regla 2 ni para los tamaños y, con foco, es un 100 % fuera en la regla 3 (aunque traiga visible: false).
// Reglas (motion.config.json → qc puede cambiarlas):
//   1. texto dentro de la zona segura (vertical 1080×1920: 250 px arriba, 400 abajo, 120 a la derecha; rubricas.md §7);
//   2. texto sobre un protegido: más del 12 % de su parte VISIBLE tapada = FALLA. Se divide por el área de la caja dentro
//      del cuadro: rectPantalla no la recorta (la regla 3 la necesita entera) y un primer plano enorme no diluye el %;
//   3. un protegido con foco fuera de cuadro en más del 35 % (o con fuera: true) = AVISO; con imprescindible: true = FALLA;
//   4. texto en pantalla menos de max(1,2 s, letras/30) = AVISO (rubricas.md §7: «al menos 1,2 s, o unos 3 caracteres
//      cada 0,1 s»; qc.lecturaMin y qc.letrasPorSeg). La duración se mide con la precisión de --paso.
// Las muestras van por índice k (t = desde + k·paso): apariciones y hallazgos se agrupan por k seguidos, no por tiempos
// redondeados, así que un --paso con muchos decimales (0.0333 = 1/30 s) no parte nada.
// Código 1 si hay FALLA; 2 si falla la revisión misma (motion.config.json sin video.ancho/alto/duracion, argumentos).
// Hojas, primero las FALLA (todas, hasta 40) y luego avisos hasta 12: en rojo el texto, en verde la parte del protegido
// que cae en el cuadro y en cian la zona segura. qc.json trae además el alto mínimo y máximo de cada protegido por
// plano, en % del alto del cuadro (tamaño del protagonista, critica.md; los planos salen de window.__info.planos si la
// página los publica con la forma de render.mjs, [[id, inicio, fin, salidaDur?], ...]; con otra forma se avisa, el
// aviso cuenta en el resumen y se mide sin planos, «—»).
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const arg = (k, d) => { const a = process.argv.find(x => x.startsWith('--' + k + '=')); return a ? +a.split('=')[1] : d; };
const cfg = JSON.parse(fs.readFileSync(path.join(root, 'motion.config.json'), 'utf8').replace(/^\uFEFF/, ''));
const W = Number(cfg.video?.ancho), H = Number(cfg.video?.alto), DUR = Number(cfg.video?.duracion);
// Lo que falta en la configuración se dice como tal (no como un --hasta mal puesto). video.duracion solo hace falta
// si no se pasa --hasta.
const malCfg = [!(W > 0) && 'video.ancho', !(H > 0) && 'video.alto',
  !process.argv.some(x => x.startsWith('--hasta=')) && !(Number.isFinite(DUR) && DUR > 0) && 'video.duracion'].filter(Boolean);
if (malCfg.length) {
  console.error(`ERROR motion.config.json → ${malCfg.join(', ')}: falta o no es un número mayor que 0`
    + (malCfg.includes('video.duracion') ? ' (o pasa --hasta=<segundos>)' : ''));
  process.exit(2);
}
const vertical = H > W;
const Q = { arriba: vertical ? 250 / 1920 : 0.06, abajo: vertical ? 400 / 1920 : 0.1, izquierda: 0.05, derecha: vertical ? 120 / 1080 : 0.05,
  tapado: 0.12, fuera: 0.35, lecturaMin: 1.2, letrasPorSeg: 30, ...(cfg.qc || {}) };
const PASO = arg('paso', 0.25), DESDE = arg('desde', 0), HASTA = arg('hasta', DUR);
if (!(PASO > 0) || !(HASTA > DESDE)) {   // con --paso=0 el recorrido no acabaría nunca
  console.error(`ERROR --paso debe ser > 0 y --hasta mayor que --desde (paso ${PASO}, ${DESDE}–${HASTA} s)`); process.exit(2);
}

const HERR = process.env.MOTION_STUDIO_HOME || path.join(os.homedir(), '.motion-studio');
let chromium;
try { ({ chromium } = await import('playwright')); } catch { ({ chromium } = createRequire(path.join(HERR, 'package.json'))('playwright')); }
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.woff2': 'font/woff2',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.glb': 'model/gltf-binary' };
const raiz = rel => { for (let d = root; ; d = path.dirname(d)) { if (fs.existsSync(path.join(d, '.' + rel))) return d;
  if (d === path.dirname(d)) return fs.existsSync(path.join(HERR, '.' + rel)) ? HERR : root; } };
const server = http.createServer((req, res) => {
  const rel = decodeURIComponent(new URL(req.url, 'http://x').pathname), base = rel.startsWith('/node_modules/') ? raiz(rel) : root;
  const file = path.resolve(base, '.' + (rel === '/' ? '/index.html' : rel));
  if (!file.startsWith(base + path.sep)) { res.writeHead(403).end(); return; }
  fs.readFile(file, (e, b) => { if (e) { res.writeHead(404).end(); return; } res.setHeader('Content-Type', MIME[path.extname(file)] || 'application/octet-stream'); res.end(b); });
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const gpu = cfg.gpu || {};
const browser = await chromium.launch({ headless: true, args: ['--use-angle=' + (gpu.angle || 'd3d11'), '--enable-gpu', '--ignore-gpu-blocklist',
  ...((gpu.modo || 'alto-rendimiento') === 'alto-rendimiento' ? ['--force_high_performance_gpu'] : [])] });
const area = r => Math.max(0, r.w) * Math.max(0, r.h);
const recorte = (a, b) => { const x = Math.max(a.x, b.x), y = Math.max(a.y, b.y);   // a ∩ b (w o h ≤ 0 = vacío)
  return { x, y, w: Math.min(a.x + a.w, b.x + b.w) - x, h: Math.min(a.y + a.h, b.y + b.h) - y }; };
const inter = (a, b) => area(recorte(a, b));
let codigo = 0;
try {
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  page.on('pageerror', e => console.error('PAGEERROR', e.message));
  page.on('console', m => { if (m.type() === 'error') console.error('CONSOLE', m.text()); });
  await page.goto(`http://127.0.0.1:${server.address().port}/`);
  await page.waitForFunction(() => window.ready || window.loadError, null, { timeout: 120000 });
  const err = await page.evaluate(() => window.loadError); if (err) throw new Error(err);
  if (!(await page.evaluate(() => typeof window.__qc === 'function'))) {
    console.log('La página no publica window.__qc(t): no hay cajas que revisar (ver cabecera de qc_escena.mjs).'); process.exit(0);
  }
  // Planos: la misma forma que valida render.mjs ([[id, inicio, fin, salidaDur?], ...]). Se valida dentro de la página
  // (un valor que no se pueda serializar no rompe la revisión) y, si no vale, se avisa y los tamaños van sin planos.
  const avisos = [];
  const lp = await page.evaluate(() => {
    const p = window.__info?.planos;
    if (p == null) return null;
    return Array.isArray(p) && p.every(x => Array.isArray(x) && x.length >= 3) ? { planos: p.map(x => x.slice(0, 4)) } : { mala: true };
  });
  const planos = lp?.planos || [];
  if (lp?.mala) {
    avisos.push('window.__info.planos no tiene la forma [[id, inicio, fin, salidaDur?], ...]: no se usa (tamaños sin planos, «—»)');
    console.warn('AVISO: ' + avisos.at(-1));
  }
  const planoEn = t => (planos.find(([, i, f]) => t >= i && t < f) || ['—'])[0];
  const seg = { x: W * Q.izquierda, y: H * Q.arriba, w: W * (1 - Q.izquierda - Q.derecha), h: H * (1 - Q.arriba - Q.abajo) };
  const cuadro = { x: 0, y: 0, w: W, h: H };
  const hallazgos = [], apariciones = [], abiertos = new Map(), tamanos = {};
  // Recorrido por índice de muestra k: t = DESDE + k·PASO sin acumular error, y «seguido» = k consecutivos (k − último ≤ 1).
  for (let k = 0; DESDE + k * PASO < HASTA - 1e-6; k++) {
    const tt = +(DESDE + k * PASO).toFixed(3), r = (await page.evaluate(t => window.__qc(t), tt)) || {};   // evaluate espera si __qc es async
    const todos = r.protegidos || [];
    // en cuadro: visibles, con caja y sin fuera: true (regla 2 y tamaños); los fuera: true con foco cuentan en la regla 3
    const prot = todos.filter(p => p.visible !== false && p.fuera !== true && area(p) > 0);
    for (const p of prot) {
      const pl = (tamanos[planoEn(tt)] ||= {}), s = (pl[p.id] ||= [Infinity, 0]), a = p.h / H * 100;
      s[0] = Math.min(s[0], a); s[1] = Math.max(s[1], a);
    }
    for (const tx of r.textos || []) {
      // cada aparición seguida de un texto cuenta aparte (un id que vuelve más tarde no suma el hueco)
      let v = abiertos.get(tx.id);
      if (!v || k - v.kHasta > 1) { v = { id: tx.id, letras: undefined, desde: tt, kDesde: k, kHasta: k }; apariciones.push(v); abiertos.set(tx.id, v); }
      v.kHasta = k;
      // letras: el máximo de la aparición (escritura letra a letra: la primera muestra trae pocas)
      if (Number.isFinite(tx.letras)) v.letras = Math.max(v.letras ?? 0, tx.letras);
      if (inter(tx, seg) < area(tx) * 0.98) hallazgos.push({ t: tt, k, nivel: 'FALLA', regla: 'zona segura', texto: tx.id, caja: tx });
      for (const p of prot) {
        const pv = recorte(p, cuadro), vis = area(pv);   // solo lo que se ve del protegido; fuera del cuadro no hay qué tapar
        if (vis <= 0) continue;
        const tap = inter(tx, pv) / vis;
        if (tap > Q.tapado) hallazgos.push({ t: tt, k, nivel: 'FALLA', regla: 'texto sobre protegido', texto: tx.id, protegido: p.id, tapado: +tap.toFixed(2), caja: tx, cajaP: p });
      }
    }
    for (const p of todos.filter(p => p.foco)) {
      let fuera;
      if (p.fuera === true) fuera = 1;   // en escena pero fuera del encuadre (detrás de la cámara…): rectPantalla
      else if (p.visible !== false && area(p) > 0) fuera = 1 - inter(p, cuadro) / area(p);
      else continue;                     // oculto o sin caja: no está en escena
      // imprescindible: true (el objeto de la acción: el guante que cobra, la carta que cae) → FALLA; si no, AVISO.
      // Lección 28: al mover la cámara para liberar una cara, el guante del soborno salió de cuadro y nadie lo vio en el QC.
      if (fuera > Q.fuera) hallazgos.push({ t: tt, k, nivel: p.imprescindible ? 'FALLA' : 'AVISO', regla: p.imprescindible ? 'objeto imprescindible fuera de cuadro' : 'foco fuera de cuadro', protegido: p.id, fuera: +fuera.toFixed(2), cajaP: p });
    }
  }
  const sinLetras = new Set();
  for (const v of apariciones) {
    if (typeof v.letras !== 'number') {
      if (!sinLetras.has(v.id)) { sinLetras.add(v.id); hallazgos.push({ t: v.desde, k: v.kDesde, nivel: 'AVISO', regla: 'lectura no comprobada (falta «letras»)', texto: v.id }); }
      continue;
    }
    const minimo = Math.max(Q.lecturaMin, v.letras / Q.letrasPorSeg), dura = (v.kHasta - v.kDesde + 1) * PASO;
    if (v.letras > 0 && dura < minimo - 1e-6) hallazgos.push({ t: v.desde, k: v.kDesde, nivel: 'AVISO', regla: 'tiempo de lectura', texto: v.id,
      letras: v.letras, dura: +dura.toFixed(2), minimo: +minimo.toFixed(2) });
  }
  // agrupar muestras seguidas (k consecutivos) con la misma regla y elementos
  const grupos = [], ultimo = new Map();
  for (const h of hallazgos.sort((a, b) => a.k - b.k)) {
    const clave = [h.nivel, h.regla, h.texto, h.protegido].join('|'), g = ultimo.get(clave);
    if (g && h.k - g.kHasta <= 1) { g.hasta = h.t; g.kHasta = h.k; }
    else { const n = { clave, desde: h.t, hasta: h.t, kHasta: h.k, ...h }; grupos.push(n); ultimo.set(clave, n); }
  }
  const out = path.join(root, 'review', 'qc'); fs.rmSync(out, { recursive: true, force: true }); fs.mkdirSync(out, { recursive: true });
  // hojas: primero las FALLA (todas, hasta 40), luego los avisos hasta completar 12; en orden de tiempo dentro de cada nivel
  const nivel = { FALLA: 0, AVISO: 1 }, conCaja = grupos.filter(g => g.caja || g.cajaP).sort((a, b) => nivel[a.nivel] - nivel[b.nivel] || a.desde - b.desde);
  const nHojas = Math.min(40, Math.max(12, conCaja.filter(g => g.nivel === 'FALLA').length));
  for (const [i, g] of conCaja.slice(0, nHojas).entries()) {
    // El protegido se dibuja recortado al cuadro (menos medio trazo, para que el verde se vea entero): un primer plano
    // mayor que el cuadro dejaría sus cuatro lados fuera. Es su parte visible, la misma con la que se mide la regla 2.
    // Con fuera: true (detrás de la cámara…) su caja no es fiable: no se dibuja.
    const bVisible = g.cajaP && g.cajaP.fuera !== true && recorte(g.cajaP, { x: 3, y: 3, w: W - 6, h: H - 6 });
    await page.evaluate(async ({ t, a, b, s }) => {
      await window.__qc(t); const c = document.querySelector('canvas').getContext('2d'); c.save(); c.lineWidth = 6;
      c.strokeStyle = '#00E0FF'; c.setLineDash([18, 12]); c.strokeRect(s.x, s.y, s.w, s.h); c.setLineDash([]);
      if (b && b.w > 0 && b.h > 0) { c.strokeStyle = '#2BD94A'; c.strokeRect(b.x, b.y, b.w, b.h); }   // fuera: true o del todo fuera: nada
      if (a) { c.strokeStyle = '#FF2A2A'; c.strokeRect(a.x, a.y, a.w, a.h); }
      c.restore();
    }, { t: g.desde, a: g.caja, b: bVisible, s: seg });
    await page.screenshot({ path: path.join(out, `${String(i).padStart(2, '0')}_${g.nivel}_t${g.desde.toFixed(2)}.jpg`), type: 'jpeg', quality: 80 });
  }
  const limpio = grupos.map(({ clave, k, kHasta, caja, cajaP, t, ...g }) => g);
  for (const pl of Object.values(tamanos)) for (const id in pl) pl[id] = { altoMin: +pl[id][0].toFixed(1), altoMax: +pl[id][1].toFixed(1) };
  fs.writeFileSync(path.join(out, 'qc.json'), JSON.stringify({ paso: PASO, zona: Q, ...(avisos.length ? { avisos } : {}), hallazgos: limpio, tamanos }, null, 1));
  console.log(`QC escena ${DESDE}–${HASTA} s cada ${PASO} s · zona segura ${Math.round(seg.x)},${Math.round(seg.y)} ${Math.round(seg.w)}×${Math.round(seg.h)}`);
  for (const g of limpio) console.log(`  ${g.nivel.padEnd(5)} ${g.desde.toFixed(2)}–${g.hasta.toFixed(2)} s  ${g.regla}: ${[g.texto, g.protegido].filter(Boolean).join(' sobre ')}`
    + (g.tapado ? ` (${Math.round(g.tapado * 100)} % tapado)` : '') + (g.fuera ? ` (${Math.round(g.fuera * 100)} % fuera)` : '') + (g.minimo ? ` (${g.dura} s de ${g.minimo} s, ${g.letras} letras)` : ''));
  const altos = Object.entries(tamanos).flatMap(([pl, ids]) => Object.entries(ids).map(([id, s]) => `${pl} ${id} ${s.altoMin}–${s.altoMax}`));
  if (altos.length) console.log(`  Alto de los protegidos (% del cuadro): ${altos.join(' · ')}`);
  for (const a of avisos) console.log(`  AVISO ${a}`);   // planos mal formados: también en el resumen y en la cuenta
  const fallas = limpio.filter(g => g.nivel === 'FALLA').length, nAvisos = limpio.length - fallas + avisos.length;
  console.log(fallas ? `FALLA: ${fallas} problema(s) de composición y ${nAvisos} aviso(s); hojas en ${out}` : `OK: sin fallas (${nAvisos} avisos)`);
  codigo = fallas ? 1 : 0;
} catch (e) { console.error('ERROR', e.message || e); codigo = 2; }
finally { await browser.close(); server.close(); }
process.exit(codigo);
