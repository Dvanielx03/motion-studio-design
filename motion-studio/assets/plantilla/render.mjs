// Motion Studio · render determinista de un video que es una función pura de t.
//
//   node render.mjs --frames=0,1.5,3      fotogramas sueltos        -> review/frames/
//   node render.mjs --prueba=2,6          muestra con calidad final y mezcla si existe (max. 10 s) -> review/pruebas/
//   node render.mjs --sheet               un fotograma por pulso    -> review/beats/ (luego: python sheet.py)
//   node render.mjs --determinismo        comprueba que un fotograma depende solo de t (ver abajo)  [--t=0,1.5,3]
//   node render.mjs --ritmo               vista a 10 fps del video entero -> review/ritmo/vista.mp4 y `python ritmo.py`
//   node render.mjs --vista               previsualización rápida del video entero (animatic): escala y fps de
//                                         motion.config.json → vista (0,5 y 15 por defecto), NVENC si hay (si falla,
//                                         se repite con libx264) -> review/vista/
//   node render.mjs --borrador            video completo, calidad de borrador (crf 16)
//   node render.mjs --final               video completo, calidad final (crf 12, preset slow)
//
// Opciones: --workers=N  --gpu=alto-rendimiento|bajo-consumo|auto|cpu  --swiftshader (= --gpu=cpu)
//           --pagina=kit/ejemplo.html   renderiza otra página del proyecto en lugar de index.html
//           --sin-audio               prueba visual explícitamente muda
// La configuración vive en motion.config.json (resolución, fps, GPU, calidad, salida).
// --prueba, --vista y los completos reparten el trabajo entre `workers` navegadores.
// Caché por plano: con motion.config.json → dependencias y window.__info.planos, un cambio en un escenario solo rehace
// los segmentos de 5 s donde aparece (ver cache.mjs). Cada render se anota en review/bitacora.jsonl y en la bitácora
// global de las herramientas compartidas (~/.motion-studio/bitacora.jsonl): tiempos por etapa y cuellos de botella.
// La página puede leer ?vista=<escala> para dibujar a menor tamaño (y sin supermuestreo); si no lo admite,
// la vista se captura a tamaño completo y se reduce con FFmpeg.
import http from 'node:http';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createRequire } from 'node:module';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { huellaProyecto, huellasPorPlano, claveSegmento } from './cache.mjs';

const root = path.dirname(fileURLToPath(import.meta.url));
const arg = k => { const a = process.argv.find(x => x === '--' + k || x.startsWith('--' + k + '=')); return a ? (a.split('=')[1] ?? true) : null; };

// ── configuración ────────────────────────────────────────────────────────────
const DEFECTO = {
  video: { ancho: 1920, alto: 1080, fps: 60, duracion: 10 },
  gpu: { modo: 'alto-rendimiento', angle: 'd3d11', coincidir: '', nombre: '' },
  codificacion: { borrador: { crf: 16, preset: 'medium' }, final: { crf: 12, preset: 'slow' } },
  salida: { carpeta: 'exportaciones', nombre: 'video' },
  workers: 6,
  revision: { desfase: 0.2 },
  vista: { escala: 0.5, fps: 15, calidad: 30 },
};
const leerConfigCruda = () => JSON.parse(fs.readFileSync(path.join(root, 'motion.config.json'), 'utf8').replace(/^\uFEFF/, ''));
function cargarConfig() {
  const u = leerConfigCruda();
  const c = {};
  for (const k of Object.keys(DEFECTO)) {
    c[k] = typeof DEFECTO[k] === 'object' ? { ...DEFECTO[k], ...(u[k] || {}) } : (u[k] ?? DEFECTO[k]);
  }
  c.codificacion = { borrador: { ...DEFECTO.codificacion.borrador, ...(u.codificacion?.borrador || {}) },
                     final: { ...DEFECTO.codificacion.final, ...(u.codificacion?.final || {}) } };
  // Índices de fotograma enteros: con fps no entero (29,97) los segmentos de 5 s caerían fuera de la rejilla y la caché
  // no se reutilizaría nunca; con lados impares yuv420p no codifica.
  const v = c.video; for (const k of ['ancho', 'alto', 'fps', 'duracion']) v[k] = Number(v[k]);
  const malo = [
    !(Number.isInteger(v.fps) && v.fps > 0) && `video.fps = ${v.fps} (entero positivo; 29,97 o 23,976 no se admiten)`,
    !(Number.isFinite(v.duracion) && v.duracion > 0) && `video.duracion = ${v.duracion} (segundos, mayor que 0)`,
    ...['ancho', 'alto'].filter(k => !(Number.isInteger(v[k]) && v[k] > 0 && v[k] % 2 === 0)).map(k => `video.${k} = ${v[k]} (entero par positivo)`),
  ].filter(Boolean);
  if (malo.length) { console.error(`motion.config.json no es válido: ${malo.join('; ')}`); process.exit(1); }
  return c;
}
const cfg = cargarConfig();
const { ancho: W, alto: H, fps: FPS, duracion: DUR } = cfg.video;
// Capturas RGB del navegador -> YUV SDR con matriz/rango definidos y etiquetas coherentes.
// No es una conversión de HDR ni un sistema de gestión de perfiles ICC.
const COLOR_SDR = ['-vf', 'scale=out_color_matrix=bt709:out_range=tv,setparams=range=limited:color_primaries=bt709:color_trc=bt709:colorspace=bt709',
  '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv'];

// Validar el intervalo antes de abrir navegadores. Es una prueba corta, no una exportación completa.
const prueba = arg('prueba');
let rangoPrueba;
if (prueba !== null) {
  const partes = typeof prueba === 'string' ? prueba.split(',') : [];
  const [inicio, fin] = partes.map(Number);
  if (partes.length !== 2 || partes.some(s => !s.trim()) || !Number.isFinite(inicio) || !Number.isFinite(fin)
    || inicio < 0 || fin <= inicio || fin > DUR || fin - inicio > 10) {
    console.error('Usa --prueba=inicio,fin: 0 <= inicio < fin <= duracion; intervalo maximo de 10 s.');
    process.exit(1);
  }
  if (['frames', 'sheet', 'determinismo', 'ritmo', 'borrador', 'final'].some(k => arg(k) !== null)) {
    console.error('--prueba se ejecuta sin otros modos de render.'); process.exit(1);
  }
  rangoPrueba = [Math.ceil(inicio * FPS), Math.ceil(fin * FPS)];
  if (rangoPrueba[1] <= rangoPrueba[0]) { console.error('El intervalo no contiene fotogramas.'); process.exit(1); }
}

// ── Playwright: primero el del proyecto (o una carpeta superior); si no, el de las herramientas compartidas
// que instala `python scripts/preparar.py` de la skill (MOTION_STUDIO_HOME, por defecto ~/.motion-studio) ──
const HERRAMIENTAS = process.env.MOTION_STUDIO_HOME || path.join(os.homedir(), '.motion-studio');
let chromium;
try { ({ chromium } = await import('playwright')); }
catch {
  try { ({ chromium } = createRequire(path.join(HERRAMIENTAS, 'package.json'))('playwright')); }
  catch { console.error(`Falta Playwright. Desde la carpeta de la skill ejecuta:\n  python scripts/preparar.py\n(instala Playwright, Chromium y las fuentes en ${HERRAMIENTAS})`); process.exit(1); }
}

// ── GPU ──────────────────────────────────────────────────────────────────────
// Chrome sin interfaz elige la GPU por su cuenta; sin la bandera de alto rendimiento suele quedarse con la integrada.
const modoGpu = arg('swiftshader') ? 'cpu' : (typeof arg('gpu') === 'string' ? arg('gpu') : cfg.gpu.modo);
const CPU_ARGS = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
function argsGpu(modo) {
  if (modo === 'cpu') return CPU_ARGS;
  const base = [`--use-angle=${cfg.gpu.angle}`, '--enable-gpu', '--ignore-gpu-blocklist', '--enable-gpu-rasterization'];
  if (modo === 'alto-rendimiento') base.splice(1, 0, '--force_high_performance_gpu');
  else if (modo === 'bajo-consumo') base.splice(1, 0, '--force_low_power_gpu');
  else if (modo !== 'auto') throw new Error(`gpu.modo desconocido: ${modo}`);
  return base;
}
const LAUNCH = { headless: true, args: argsGpu(modoGpu) };

// ── servidor estático ───────────────────────────────────────────────────────
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json',
  '.ttf': 'font/ttf', '.otf': 'font/otf', '.woff2': 'font/woff2', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml',
  '.glb': 'model/gltf-binary', '.wav': 'audio/wav', '.mp3': 'audio/mpeg' };
// /node_modules/... se sirve desde el primer node_modules hacia arriba que tenga ese archivo (p. ej. three.js) y,
// si ninguno lo tiene, desde las herramientas compartidas (fuentes @fontsource instaladas por preparar.py)
function raizNodeModules(rel) {
  for (let d = root; ; d = path.dirname(d)) {
    if (fs.existsSync(path.join(d, '.' + rel))) return d;
    if (d === path.dirname(d)) return fs.existsSync(path.join(HERRAMIENTAS, '.' + rel)) ? HERRAMIENTAS : root;
  }
}
const server = http.createServer((req, res) => {
  const rel = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const base = rel.startsWith('/node_modules/') ? raizNodeModules(rel) : root;
  const file = path.resolve(base, '.' + (rel === '/' ? '/index.html' : rel));
  if (!file.startsWith(base + path.sep)) { res.writeHead(403).end(); return; }
  fs.readFile(file, (err, b) => {
    if (err) { res.writeHead(404).end(); return; }
    res.setHeader('Content-Type', MIME[path.extname(file)] || 'application/octet-stream'); res.end(b);
  });
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const url = `http://127.0.0.1:${server.address().port}/` + (typeof arg('pagina') === 'string' ? arg('pagina').replace(/^\/+/, '') : '');

// ── navegadores: uno por proceso de render, cada uno con su propio proceso de GPU ──
const browsers = [];
async function lanzar() { const b = await chromium.launch(LAUNCH); browsers.push(b); return b; }
async function comprobarGpu() {
  const b = await lanzar(), p = await b.newPage();
  const r = await p.evaluate(() => { const g = document.createElement('canvas').getContext('webgl2'); const e = g && g.getExtension('WEBGL_debug_renderer_info'); return e ? g.getParameter(e.UNMASKED_RENDERER_WEBGL) : 'sin WebGL'; });
  await p.close();
  console.log(`WebGL: ${r}  (modo ${modoGpu})`);
  if (modoGpu === 'cpu') return;
  if (/SwiftShader|sin WebGL/i.test(r)) console.warn('AVISO: no se obtuvo la GPU; el render usará la CPU (mucho más lento). Revisa references/gpu.md.');
  else if (cfg.gpu.coincidir && !new RegExp(cfg.gpu.coincidir, 'i').test(r)) console.warn(`AVISO: se esperaba una GPU que coincida con «${cfg.gpu.coincidir}»${cfg.gpu.nombre ? ` (${cfg.gpu.nombre})` : ''} y se usa otra.`);
}

// escala < 1 (modo --vista): la página recibe ?vista=<escala>; si publica window.__vista === escala, se captura a ese
// tamaño; si no, se captura completa y FFmpeg reduce (page.__reducir = true).
async function abrirPagina(escala = 1) {
  const b = await lanzar();
  try {
    const page = await b.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
    page.on('pageerror', e => console.error('PAGEERROR', e.message));
    page.on('console', m => { if (m.type() === 'error') console.error('CONSOLE', m.text()); });
    await page.goto(escala < 1 ? url + (url.includes('?') ? '&' : '?') + `vista=${escala}` : url);
    await page.waitForFunction(() => window.ready || window.loadError, null, { timeout: 120000 });
    const err = await page.evaluate(() => window.loadError);
    if (err) throw new Error(err);
    page.__reducir = false;
    // Los cortes planificados quedan en review/planos.json: pops.py y las revisiones los leen sin abrir la página.
    if (!abrirPagina.planos) {
      abrirPagina.planos = await page.evaluate(() => window.__info?.planos || null);
      if (abrirPagina.planos) {
        fs.mkdirSync(path.join(root, 'review'), { recursive: true });
        fs.writeFileSync(path.join(root, 'review', 'planos.json'), JSON.stringify(abrirPagina.planos));
      }
    }
    if (escala < 1) {
      const admite = await page.evaluate(e => window.__vista === e, escala);
      if (admite) await page.setViewportSize({ width: Math.round(W * escala), height: Math.round(H * escala) });
      else page.__reducir = true;
    }
    return page;
  } catch (e) {
    // Quien llama no recibe la página y no podría cerrarlo: el navegador (y su memoria de video) se libera aquí.
    const i = browsers.indexOf(b); if (i >= 0) browsers.splice(i, 1);
    await b.close().catch(() => {});
    throw e;
  }
}
async function foto(page, t, dest, type = 'png') {
  await page.evaluate(t => window.seek(t), t);
  return page.screenshot({ path: dest, type, quality: type === 'jpeg' ? 92 : undefined, animations: 'disabled', caret: 'hide' });
}
const trabajadores = () => +(arg('workers') || cfg.workers);

// ── NVENC (codificador por GPU de NVIDIA): solo para la vista rápida; las entregas siguen en libx264 ──
let _nvenc = null;
function tieneNvenc() {
  if (_nvenc !== null) return _nvenc;
  const r = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i', 'color=c=black:s=256x256:d=0.2',
    '-c:v', 'h264_nvenc', '-f', 'null', '-'], { encoding: 'utf8' });
  return (_nvenc = r.status === 0);
}

// Captura los fotogramas [a, b) a `fpsTramo` y los codifica en `archivo` con `codec` (argumentos de salida de FFmpeg).
// Devuelve el número de fotogramas. Si la página no admite la vista reducida, `filtro` reduce aquí. Si otro tramo
// falla (`cancelar.hecho`), este se detiene en el siguiente fotograma.
async function codificarTramo(page, a, b, fpsTramo, archivo, codec, filtro = null, cancelar = null) {
  const ff = spawn('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'image2pipe', '-c:v', 'png', '-framerate', String(fpsTramo), '-i', '-',
    ...(filtro ? ['-vf', filtro] : []), ...codec, '-r', String(fpsTramo), archivo], { stdio: ['pipe', 'inherit', 'inherit'] });
  let errorFF;
  const finFF = new Promise(resolve => { ff.once('error', e => { errorFF = e; resolve(-1); }); ff.once('close', resolve); });
  ff.stdin.on('error', e => { errorFF = e; });
  const fallo = codigo => new Error(`FFmpeg falló en ${path.basename(archivo)} (código ${codigo ?? ff.exitCode}; ${errorFF?.message || 'salida prematura'})`);
  try {
    for (let i = a; i < b; i++) {
      if (cancelar?.hecho) throw new Error(`${path.basename(archivo)} cancelado: falló otro tramo`);
      const buf = await foto(page, i / fpsTramo, undefined, 'png');
      if (errorFF || ff.exitCode !== null) throw fallo();
      if (!ff.stdin.write(buf)) await Promise.race([new Promise(r => ff.stdin.once('drain', r)), finFF.then(c => { throw fallo(c); })]);
    }
    ff.stdin.end();
    const codigo = await finFF;
    if (codigo !== 0 || errorFF) throw fallo(codigo);
  } catch (e) { ff.stdin.destroy(); ff.kill(); await finFF; throw e; }
  return b - a;
}

const borrar = ruta => { try { fs.rmSync(ruta, { recursive: true, force: true }); } catch {} };
// Parciales «*.part.mp4» de más de 1 h en `dir`: restos de ejecuciones interrumpidas (los de una en curso son recientes).
function podarParciales(dir) {
  try { for (const f of fs.readdirSync(dir)) if (f.endsWith('.part.mp4') && Date.now() - fs.statSync(path.join(dir, f)).mtimeMs > 3600e3) borrar(path.join(dir, f)); } catch {}
}

// Reparte [desde, hasta) en tramos contiguos entre `n` navegadores, dentro de una carpeta propia de esta ejecución en
// `base` (dos ejecuciones a la vez no se pisan los tramos). Devuelve { lista, carpeta }; quien llama borra `carpeta`.
// Si un tramo falla, cancela los demás, espera a que suelten sus archivos, borra la carpeta y lanza el primer error.
async function renderParalelo(desde, hasta, fpsTramo, base, codec, escala = 1, filtro = null) {
  fs.mkdirSync(base, { recursive: true });
  // Restos de ejecuciones interrumpidas: la carpeta fija de versiones anteriores y tramos de hace más de 12 h.
  try { for (const d of fs.readdirSync(base)) if (d === '_tramos' || (d.startsWith('_tramos-') && Date.now() - fs.statSync(path.join(base, d)).mtimeMs > 12 * 3600e3)) borrar(path.join(base, d)); } catch {}
  const carpeta = fs.mkdtempSync(path.join(base, '_tramos-'));
  const total = hasta - desde, n = Math.max(1, Math.min(trabajadores(), Math.ceil(total / 30)));
  const cortes = Array.from({ length: n + 1 }, (_, k) => desde + Math.round(total * k / n));
  const archivos = cortes.slice(0, -1).map((_, k) => path.join(carpeta, `t${String(k).padStart(3, '0')}.mp4`));
  const cancelar = { hecho: false, error: null };
  await Promise.allSettled(archivos.map(async (archivo, k) => {
    let page;
    try { page = await abrirPagina(escala); await codificarTramo(page, cortes[k], cortes[k + 1], fpsTramo, archivo, codec, page.__reducir ? filtro : null, cancelar); }
    catch (e) { if (!cancelar.hecho) Object.assign(cancelar, { hecho: true, error: e }); }
    // Se cierra el navegador entero (no solo la página): libera memoria de vídeo antes de un posible reintento.
    finally { if (page) await page.context().browser().close().catch(() => {}); }
  }));
  if (cancelar.error) { borrar(carpeta); throw cancelar.error; }
  const lista = path.join(carpeta, 'lista.txt');
  fs.writeFileSync(lista, archivos.map(f => `file '${path.basename(f)}'`).join('\n'));
  return { lista, carpeta };
}

// Fotogramas (paquetes) de video de un MP4, sin decodificarlo.
function paquetesVideo(archivo) {
  const r = spawnSync('ffprobe', ['-v', 'error', '-count_packets', '-select_streams', 'v:0', '-show_entries', 'stream=nb_read_packets', '-of', 'csv=p=0', archivo], { encoding: 'utf8' });
  return +String(r.stdout || '').trim();
}

// Une la imagen ya codificada (concat de `lista`, sin recomprimir) con la mezcla en `destino`. Sin -shortest: el audio
// se rellena con silencio o se recorta a la duración exacta del video, y se comprueba que no se perdió ningún fotograma.
function unir(lista, audio, fotogramas, fps, kbps, destino) {
  const dur = String(fotogramas / fps);
  const r = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', lista,
    ...(audio ? ['-i', audio, '-filter_complex', `[1:a]apad=whole_dur=${dur}[a]`, '-map', '0:v:0', '-map', '[a]',
      '-c:v', 'copy', '-c:a', 'aac', '-b:a', kbps, '-t', dur] : ['-map', '0:v:0', '-c:v', 'copy']),
    '-movflags', '+faststart', destino], { stdio: 'inherit' });
  if (r.error || r.status !== 0) throw new Error(`FFmpeg falló al unir ${path.basename(destino)}`);
  const n = paquetesVideo(destino);
  if (n !== fotogramas) throw new Error(`${path.basename(destino)} tiene ${n} fotogramas y se esperaban ${fotogramas}`);
}

// Sustituye `destino` por el archivo terminado `parcial`. Si no se puede (abierto en un reproductor), el resultado se
// conserva como «<destino sin .mp4>.conservado-<pid>.mp4»: sin «.part», la poda de parciales no lo borra. El error
// empieza siempre por «no pude reemplazar» (quien llama no borra entonces el parcial) y dice dónde quedó.
function reemplazar(parcial, destino) {
  try { fs.renameSync(parcial, destino); return; }
  catch (e) {
    const motivo = `no pude reemplazar ${destino} (${e.code || e.message}; ¿está abierto en un reproductor?)`;
    const conservado = destino.replace(/\.mp4$/i, '') + `.conservado-${process.pid}.mp4`;
    try { fs.renameSync(parcial, conservado); }
    catch { throw new Error(`${motivo}. El resultado quedó en ${parcial} (renómbralo: los «.part.mp4» de review/ se podan pasada 1 h)`); }
    throw new Error(`${motivo}. El resultado quedó en ${conservado} (no se poda: bórralo o renómbralo cuando cierres el reproductor)`);
  }
}

// ── bitácora de tiempos: proyecto y global ──
// Clave del proyecto = nombre de la carpeta del VIDEO, la misma que usa scripts/bitacora.py: si render.mjs vive en una
// carpeta «NN-…» (p. ej., videos/2026-11-17_x/03-proyecto), la de su carpeta padre; si no, la de la propia carpeta.
const PROYECTO = /^\d\d-/.test(path.basename(root)) ? path.basename(path.dirname(root)) : path.basename(root);
function registrar(datos) {
  const fila = JSON.stringify({ fecha: new Date().toISOString(), proyecto: PROYECTO,
    gpu: modoGpu, workers: trabajadores(), ...datos }) + '\n';
  try { fs.mkdirSync(path.join(root, 'review'), { recursive: true }); fs.appendFileSync(path.join(root, 'review', 'bitacora.jsonl'), fila); } catch {}
  try { fs.mkdirSync(HERRAMIENTAS, { recursive: true }); fs.appendFileSync(path.join(HERRAMIENTAS, 'bitacora.jsonl'), fila); } catch {}
}
const INICIO = Date.now();

// ── sonoridad: la regla es -14 LUFS ────────────────────────────────────────
function lufs(archivo) {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-nostats', '-i', archivo, '-af', 'ebur128', '-f', 'null', '-'], { encoding: 'utf8' });
  const m = [...r.stderr.matchAll(/I:\s+(-?\d+(?:\.\d+)?)\s+LUFS/g)];
  return m.length ? +m[m.length - 1][1] : null;
}

try {
  if (!arg('frames') && !rangoPrueba && !arg('vista') && !arg('sheet') && !arg('determinismo') && !arg('ritmo') && !arg('borrador') && !arg('final')) {
    console.log('Uso: node render.mjs --frames=t1,t2 | --prueba=inicio,fin | --vista | --sheet | --determinismo | --ritmo | --borrador | --final   [--workers=N] [--gpu=modo]');
  } else {
    await comprobarGpu();
    if (arg('frames')) {
      const page = await abrirPagina();
      const out = path.join(root, 'review', 'frames'); fs.mkdirSync(out, { recursive: true });
      for (const s of String(arg('frames')).split(',')) { const t = +s; await foto(page, t, path.join(out, `t${t.toFixed(2).padStart(6, '0')}.png`)); }
      console.log('frames ->', out);
    } else if (rangoPrueba) {
      const [desde, hasta] = rangoPrueba;
      const out = path.join(root, 'review', 'pruebas'); fs.mkdirSync(out, { recursive: true }); podarParciales(out);
      // Los parciales llevan el pid: dos pruebas del mismo intervalo a la vez no se pisan. Un intento fallido borra los
      // suyos; los de un proceso que murió a medias los poda podarParciales() pasada 1 h.
      const salida = path.join(out, `movimiento-${desde}-${hasta}.mp4`), parcial = `${salida}.${process.pid}.part.mp4`;
      const videoParcial = `${salida}.${process.pid}.video.part.mp4`;
      const audio = path.join(root, 'audio', 'final.wav');
      const hayAudio = !arg('sin-audio') && fs.existsSync(audio);
      const segundos = (hasta - desde) / FPS;
      if (!hayAudio) console.warn('AVISO: prueba visual sin audio; la sincronización y la mezcla quedan pendientes.');
      // Tramos en paralelo (uno por navegador) con la calidad final; se concatenan sin recomprimir.
      const { lista, carpeta } = await renderParalelo(desde, hasta, FPS, out,
        ['-an', '-c:v', 'libx264', '-preset', cfg.codificacion.final.preset, '-crf', String(cfg.codificacion.final.crf),
          ...COLOR_SDR, '-pix_fmt', 'yuv420p']);
      try {
        const cat = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', lista,
          '-c', 'copy', '-movflags', '+faststart', videoParcial], { stdio: 'inherit' });
        if (cat.error || cat.status !== 0) throw new Error('FFmpeg falló al unir los tramos de la prueba');
        // La captura entrega solo imagen. Con el archivo cerrado se une la mezcla;
        // el video ya codificado se copia sin una segunda compresión.
        if (hayAudio) {
          const mux = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', videoParcial, '-i', audio,
            '-filter_complex', `[1:a]atrim=start=${desde / FPS}:duration=${segundos},asetpts=PTS-STARTPTS,apad=whole_dur=${segundos}[a]`,
            '-map', '0:v:0', '-map', '[a]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '320k',
            '-t', String(segundos), '-movflags', '+faststart', parcial], { stdio: 'inherit' });
          if (mux.error || mux.status !== 0) throw new Error('FFmpeg falló al unir la mezcla de la prueba');
          borrar(videoParcial);
        }
        // Como unir(): ningún fotograma perdido en la unión de tramos ni en la mezcla (atrim/apad/-t).
        const hecho = hayAudio ? parcial : videoParcial, nf = paquetesVideo(hecho);
        if (nf !== hasta - desde) throw new Error(`${path.basename(salida)} tiene ${nf} fotogramas y se esperaban ${hasta - desde}`);
        reemplazar(hecho, salida);
      } catch (e) {
        // Un intento fallido no deja parciales. Si lo que falló fue el renombrado final (salida abierta en un reproductor),
        // el resultado se conserva aparte («.conservado-<pid>.mp4», fuera de la poda): el mensaje dice dónde quedó.
        if (!/no pude reemplazar/.test(e.message)) { borrar(parcial); borrar(videoParcial); }
        throw e;
      } finally { borrar(carpeta); }
      const seg = (Date.now() - INICIO) / 1000;
      console.log(`OK prueba ${hayAudio ? 'con mezcla' : 'sin audio'}: ${salida} · ${segundos} s · ${hasta - desde} fotogramas · CRF ${cfg.codificacion.final.crf} / ${cfg.codificacion.final.preset} · ${seg.toFixed(0)} s (${(seg / segundos).toFixed(1)} s por segundo de video)`);
      registrar({ modo: 'prueba', rango: [desde / FPS, hasta / FPS], segundos: +seg.toFixed(1), fotogramas: hasta - desde });
    } else if (arg('vista')) {
      // Animatic técnico: todo el video, menor tamaño y fps, codificado por GPU si hay NVENC. Sirve para revisar
      // tiempos, encuadres, lectura y sincronía antes de pagar un completo; no es una entrega.
      const v = cfg.vista, escala = +v.escala, fpsV = +v.fps, nV = Math.round(DUR * fpsV);
      const w2 = Math.round(W * escala / 2) * 2, h2 = Math.round(H * escala / 2) * 2;
      let nvenc = tieneNvenc();
      const x264 = ['-an', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', String(v.calidad - 4), '-pix_fmt', 'yuv420p'];
      const codec = nvenc ? ['-an', '-c:v', 'h264_nvenc', '-preset', 'p4', '-cq', String(v.calidad), '-pix_fmt', 'yuv420p'] : x264;
      const out = path.join(root, 'review', 'vista'), filtro = `scale=${w2}:${h2}:flags=area`;
      podarParciales(out);
      let tramos;
      try { tramos = await renderParalelo(0, nV, fpsV, out, codec, escala, filtro); }
      catch (e) {
        // tieneNvenc() prueba una sola sesión; con `workers` sesiones a la vez (o el codificador ocupado por OBS u otra
        // sesión) alguna puede no abrirse. Se repite la vista entera: tramos NVENC y x264 no se concatenan sin recomprimir.
        if (!nvenc || !/FFmpeg falló/.test(e.message)) throw e;
        console.warn(`AVISO: NVENC falló en la vista (${e.message}); la repito entera con libx264.`);
        nvenc = false; tramos = await renderParalelo(0, nV, fpsV, out, x264, escala, filtro);
      }
      const audio = path.join(root, 'audio', 'final.wav'), hayAudio = fs.existsSync(audio);
      const salida = path.join(out, 'vista.mp4'), parcial = path.join(out, `vista.${process.pid}.part.mp4`);
      try { unir(tramos.lista, hayAudio ? audio : null, nV, fpsV, '160k', parcial); reemplazar(parcial, salida); }
      catch (e) { if (!/no pude reemplazar/.test(e.message)) borrar(parcial); throw e; }
      finally { borrar(tramos.carpeta); }
      const seg = (Date.now() - INICIO) / 1000;
      console.log(`OK vista: ${salida} · ${w2}×${h2} · ${fpsV} fps · ${nV} fotogramas · ${nvenc ? 'NVENC' : 'libx264'} · ${seg.toFixed(0)} s (${(seg / DUR).toFixed(1)} s por segundo de video)`);
      registrar({ modo: 'vista', segundos: +seg.toFixed(1), fotogramas: nV, escala, fps: fpsV, codificador: nvenc ? 'nvenc' : 'libx264' });
    } else if (arg('determinismo')) {
      // Un fotograma debe depender solo de t. Se comprueba con el hash de cada captura:
      //  1) el mismo t dos veces seguidas en una página (detecta estado que se arrastra entre fotogramas);
      //  2) los mismos t en orden inverso en otro navegador (detecta dependencia del historial o del reloj).
      const lista = arg('t') ? String(arg('t')).split(',').map(Number)
        : Array.from({ length: 10 }, (_, i) => +Math.min(DUR - 1 / FPS, i * DUR / 9).toFixed(3));
      const hash = b => crypto.createHash('sha256').update(b).digest('hex');
      const A = await abrirPagina(), B = await abrirPagina();
      const adelante = {}, repetido = {}, inverso = {};
      for (const t of lista) { adelante[t] = await foto(A, t); repetido[t] = await foto(A, t); }
      for (const t of [...lista].reverse()) inverso[t] = await foto(B, t);
      // Si difieren, se guardan ambas capturas y se mide dónde y cuánto: un Δ de 1-2 niveles en bordes de texto suele ser
      // la caché de glifos (texto con fillText bajo escala: usa crearTexto); un Δ grande, estado o reloj en el código.
      const out = path.join(root, 'review', 'determinismo'); fs.rmSync(out, { recursive: true, force: true });
      const comparar = (a, b) => A.evaluate(async ([a, b]) => {
        const leer = async s => { const im = await createImageBitmap(await (await fetch('data:image/png;base64,' + s)).blob());
          const c = new OffscreenCanvas(im.width, im.height), x = c.getContext('2d'); x.drawImage(im, 0, 0); return x.getImageData(0, 0, im.width, im.height).data; };
        const [p, q] = await Promise.all([leer(a), leer(b)]), w = innerWidth;
        let n = 0, max = 0, x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1;
        for (let i = 0; i < p.length; i += 4) {
          const d = Math.max(Math.abs(p[i] - q[i]), Math.abs(p[i + 1] - q[i + 1]), Math.abs(p[i + 2] - q[i + 2]));
          if (d) { n++; max = Math.max(max, d); const k = i / 4, x = k % w, y = (k - x) / w; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
        }
        return { n, max, zona: `${x0},${y0}–${x1},${y1}` };
      }, [a.toString('base64'), b.toString('base64')]);
      let fallos = 0, soloBordes = true;
      for (const t of lista) {
        const ok1 = hash(adelante[t]) === hash(repetido[t]), ok2 = hash(adelante[t]) === hash(inverso[t]);
        console.log(`t=${t.toFixed(3).padStart(8)}  ${ok1 ? 'igual   ' : 'DISTINTO'} (repetido)   ${ok2 ? 'igual   ' : 'DISTINTO'} (orden inverso)`);
        if (ok1 && ok2) continue;
        fallos++; fs.mkdirSync(out, { recursive: true });
        const otra = ok1 ? inverso[t] : repetido[t], d = await comparar(adelante[t], otra), base = path.join(out, `t${t.toFixed(3)}`);
        fs.writeFileSync(base + '_a.png', adelante[t]); fs.writeFileSync(base + '_b.png', otra);
        if (d.max > 2) soloBordes = false;
        console.log(`           ${d.n} px distintos · Δ máx ${d.max} · zona ${d.zona} -> ${path.relative(root, base)}_a.png / _b.png`);
      }
      console.log(fallos ? `FALLA: ${fallos} de ${lista.length} instantes no son deterministas` : `OK: ${lista.length} instantes idénticos`);
      if (fallos) console.log(soloBordes
        ? 'Pista: diferencias de 1-2 niveles. Si la zona es texto, es la caché de glifos: dibuja el texto con crearTexto (lib.js).'
        : 'Pista: hay estado que se arrastra entre fotogramas (acumuladores, cachés, contexto 2D sin ctx.reset()) o un reloj real.');
      if (fallos) process.exitCode = 1;
    } else if (arg('ritmo')) {
      // El ritmo no se ve en una hoja de contacto: se mide sobre el video entero a 10 fps, sin esperar al borrador.
      const R = 10, n = Math.floor(DUR * R), capturas = new Array(n);
      const out = path.join(root, 'review', 'ritmo'); fs.mkdirSync(out, { recursive: true });
      const vista = path.join(out, 'vista.mp4');
      let next = 0;
      await Promise.all(Array.from({ length: Math.min(trabajadores(), n) }, async () => {
        const page = await abrirPagina();
        while (next < n) { const i = next++; capturas[i] = await foto(page, i / R, undefined, 'jpeg'); }
        await page.close();
      }));
      const ff = spawn('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'image2pipe', '-c:v', 'mjpeg', '-framerate', String(R), '-i', '-',
        '-vf', 'scale=480:-2', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23', '-pix_fmt', 'yuv420p', vista], { stdio: ['pipe', 'inherit', 'inherit'] });
      for (const buf of capturas) if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
      ff.stdin.end(); await new Promise(r => ff.on('close', r));
      console.log(`vista de ritmo: ${path.relative(root, vista)} · ${n} fotogramas a ${R} fps`);
      const py = spawnSync(process.platform === 'win32' ? 'python' : 'python3', ['ritmo.py', vista], { cwd: root, stdio: 'inherit' });
      if (py.error) console.error('No pude ejecutar ritmo.py (¿Python con numpy en el PATH?):', py.error.message);
      if (py.status) process.exitCode = py.status;
    } else if (arg('sheet')) {
      // un fotograma por pulso, unos instantes después del golpe para ver la reacción
      const beats = JSON.parse(fs.readFileSync(path.join(root, 'beats.json'), 'utf8')).beats;
      const out = path.join(root, 'review', 'beats'); fs.rmSync(out, { recursive: true, force: true }); fs.mkdirSync(out, { recursive: true });
      const pages = await Promise.all(Array.from({ length: trabajadores() }, abrirPagina));
      let next = 0;
      await Promise.all(pages.map(async page => {
        while (next < beats.length) { const i = next++; await foto(page, Math.max(0, beats[i] + cfg.revision.desfase), path.join(out, `${String(i).padStart(3, '0')}.jpg`), 'jpeg'); }
      }));
      console.log('beats ->', out, beats.length);
    } else {
      const modo = arg('borrador') ? 'borrador' : 'final', enc = cfg.codificacion[modo];
      // segmentos de 5 s: si se interrumpe, al relanzar solo rehace los que faltan (cada modo tiene los suyos)
      const n = Math.round(FPS * DUR), SEG = FPS * 5, nSeg = Math.ceil(n / SEG);
      // Huella: solo lo que cambia la imagen. motion.config.json NO se hashea como archivo: entra aquí sin las claves de
      // las herramientas (cambiar workers, ritmo, curva, revisión, vista, qc, guion, verificación, blender, skill o salida
      // no rehace nada; con salida.carpeta, la carpeta anterior entra en la huella si no se llama «exportaciones»), pero
      // con cualquier otra clave de nivel superior, la lea la página o no. `dependencias` no entra como valor, pero
      // reparte los archivos entre la huella común y la de cada plano: editarla suele rehacer todo una vez. video y
      // codificación van ya resueltos (los de este modo) y la GPU efectiva (--gpu/--swiftshader) cuenta: no se mezclan
      // segmentos de SwiftShader y de NVIDIA.
      const crudo = leerConfigCruda(), deps = crudo.dependencias;
      const CFG_FUERA = new Set(['workers', 'ritmo', 'curva', 'revision', 'vista', 'dependencias', 'qc', 'guion', 'verificacion',
        'blender', 'skill', 'salida', 'video', 'gpu', 'codificacion']);
      const propias = Object.fromEntries(Object.entries(crudo).filter(([k]) => !CFG_FUERA.has(k)));
      const extra = { cfg: { ...propias, video: cfg.video, codificacion: enc }, gpu: { modo: modoGpu, angle: cfg.gpu.angle },
        pagina: arg('pagina'), modo, color: COLOR_SDR };
      const excluir = ['motion.config.json'];
      // Caché por plano: necesita motion.config.json → dependencias y window.__info.planos en la página.
      let planos = null;
      if (deps) {
        const p = await abrirPagina(); planos = await p.evaluate(() => window.__info?.planos || null); await p.close();
        if (!planos) console.warn('AVISO: hay «dependencias» pero la página no publica window.__info.planos: caché de todo el proyecto.');
        else if (!(Array.isArray(planos) && planos.every(x => Array.isArray(x) && x.length >= 3))) {
          console.warn('AVISO: window.__info.planos no tiene la forma [[id, inicio, fin, salidaDur?], ...]: caché de todo el proyecto.');
          planos = null;
        }
      }
      const huellas = planos ? huellasPorPlano(root, deps, { salida: cfg.salida.carpeta, extra, excluir, publicados: planos.map(x => x[0]) })
                             : { comun: huellaProyecto(root, { salida: cfg.salida.carpeta, extra, excluir }), porPlano: {} };
      if (huellas.ausentes?.length) console.warn(`AVISO: dependencias de ${huellas.ausentes.join(', ')} no coincide con ningún plano`
        + ` publicado (${planos.map(x => x[0]).join(', ')}; los ids distinguen mayúsculas). Sus archivos cuentan como comunes: editarlos rehace todo.`);
      // Otro espacio de caché: los segmentos antiguos no acreditan esta conversión de color.
      const tmp = path.join(root, 'review', 'segcache-' + modo + '-bt709-tv'); fs.mkdirSync(tmp, { recursive: true });
      const claves = Array.from({ length: nSeg }, (_, k) => claveSegmento(huellas, planos, k * SEG, Math.min(n, (k + 1) * SEG), FPS));
      const segPath = k => path.join(tmp, `s${String(k).padStart(3, '0')}-${claves[k].clave}.mp4`);
      const okSeg = k => {
        if (!fs.existsSync(segPath(k))) return false;
        const r = spawnSync('ffprobe', ['-v', 'error', '-count_frames', '-select_streams', 'v:0', '-show_entries', 'stream=nb_read_frames', '-of', 'csv=p=0', segPath(k)], { encoding: 'utf8' });
        return +r.stdout.trim() === Math.min(SEG, n - k * SEG);
      };
      const todo = []; for (let k = 0; k < nSeg; k++) if (!okSeg(k)) todo.push(k);
      console.log(`${modo}: crf ${enc.crf} ${enc.preset} · segmentos ${nSeg - todo.length}/${nSeg} reutilizados, faltan ${todo.length}`
        + (planos ? ` · caché por plano (${[...new Set(todo.flatMap(k => claves[k].planos))].join(', ') || 'nada cambió'})` : ''));
      const t0 = Date.now(); let hechos = 0, next = 0;
      await Promise.all(Array.from({ length: Math.min(trabajadores(), todo.length) }, async () => {
        const page = await abrirPagina();
        while (next < todo.length) {
          const k = todo[next++], a = k * SEG, b = Math.min(n, a + SEG), part = segPath(k) + '.part.mp4';
          const ff = spawn('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'image2pipe', '-c:v', 'png', '-framerate', String(FPS), '-i', '-',
            '-c:v', 'libx264', '-preset', enc.preset, '-crf', String(enc.crf), ...COLOR_SDR, '-pix_fmt', 'yuv420p', '-r', String(FPS), part], { stdio: ['pipe', 'inherit', 'inherit'] });
          let errorFF;
          // Registrar desde spawn: FFmpeg puede salir antes de terminar de enviar los PNG.
          const finFF = new Promise(resolve => {
            ff.once('error', e => { errorFF = e; resolve(-1); });
            ff.once('close', resolve);
          });
          ff.stdin.on('error', e => { errorFF = e; });
          const fallo = codigo => new Error(`FFmpeg falló en el segmento ${k} (código ${codigo ?? ff.exitCode}; ${errorFF?.message || 'salida prematura'})`);
          try {
            for (let i = a; i < b; i++) {
              const buf = await foto(page, i / FPS, undefined, 'png');
              if (errorFF || ff.exitCode !== null) throw fallo();
              if (!ff.stdin.write(buf)) await Promise.race([
                new Promise(r => ff.stdin.once('drain', r)),
                finFF.then(codigo => { throw fallo(codigo); }),
              ]);
              if (++hechos % (FPS * 5) === 0) console.log(`${hechos}/${todo.length * SEG}  ${((Date.now() - t0) / 1000).toFixed(0)} s`);
            }
            ff.stdin.end();
            const codigo = await finFF;
            if (codigo !== 0 || errorFF) throw fallo(codigo);
          } catch (e) {
            ff.stdin.destroy(); ff.kill(); await finFF; throw e;
          }
          fs.renameSync(part, segPath(k));
        }
        await page.close();
      }));
      fs.writeFileSync(path.join(tmp, 'list.txt'), Array.from({ length: nSeg }, (_, k) => `file '${path.basename(segPath(k))}'`).join('\n'));
      const exp = path.resolve(root, cfg.salida.carpeta); fs.mkdirSync(exp, { recursive: true });
      const salida = path.join(exp, `${cfg.salida.nombre}${modo === 'borrador' ? '_borrador' : ''}.mp4`);
      const audio = path.join(root, 'audio', 'final.wav'), hayAudio = fs.existsSync(audio);
      if (hayAudio) {
        const l = lufs(audio);
        if (l === null) console.warn('AVISO: no se pudo medir la sonoridad de audio/final.wav');
        else if (Math.abs(l + 14) > 1) console.warn(`AVISO: audio/final.wav mide ${l.toFixed(1)} LUFS y la regla es -14.`);
        else console.log(`Sonoridad: ${l.toFixed(1)} LUFS`);
      } else console.warn('AVISO: no hay audio/final.wav; el video saldrá sin sonido.');
      const parcial = `${salida}.${process.pid}.part.mp4`;
      try { unir(path.join(tmp, 'list.txt'), hayAudio ? audio : null, n, FPS, '320k', parcial); reemplazar(parcial, salida); }
      catch (e) { if (!/no pude reemplazar/.test(e.message)) borrar(parcial); throw new Error(`falló el ensamblado final (mux): ${e.message}`); }
      // Poda tras un mux correcto: de cada segmento queda la versión actual (aunque sea la más antigua, si se reutilizó) y,
      // como mucho, la anterior más reciente. Fuera también los .part huérfanos (> 1 h) y los índices que ya no existen.
      const actuales = new Set(Array.from({ length: nSeg }, (_, k) => path.basename(segPath(k)))), otras = {};
      for (const f of fs.readdirSync(tmp)) {
        const m = /^s(\d+)-.+\.mp4$/.exec(f); if (!m || actuales.has(f)) continue;
        const ruta = path.join(tmp, f), mt = fs.statSync(ruta).mtimeMs;
        if (f.endsWith('.part.mp4')) { if (Date.now() - mt > 3600e3) borrar(ruta); }
        else if (+m[1] >= nSeg) borrar(ruta);
        else (otras[m[1]] ??= []).push({ ruta, mt });
      }
      for (const v of Object.values(otras)) v.sort((a, b) => b.mt - a.mt).slice(1).forEach(x => borrar(x.ruta));
      const seg = (Date.now() - INICIO) / 1000;
      console.log('OK', salida, seg.toFixed(0) + ' s', `(${hechos} fotogramas nuevos, ${(nSeg - todo.length)} segmentos reutilizados)`);
      registrar({ modo, segundos: +seg.toFixed(1), fotogramas_nuevos: hechos, segmentos: nSeg, reutilizados: nSeg - todo.length,
        planos_rehechos: [...new Set(todo.flatMap(k => claves[k].planos))] });
    }
  }
} catch (e) {
  console.error(e.message || e); process.exitCode = 1;
} finally {
  await Promise.all(browsers.map(b => b.close().catch(() => {}))); server.close();
}
