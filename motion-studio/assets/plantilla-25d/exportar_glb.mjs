// Motion Studio · exportar_glb.mjs — exporta escenarios 2.5D del proyecto a .glb (+ anclas) para Blender.
//
//   node exportar_glb.mjs calle            un escenario
//   node exportar_glb.mjs --todos          todos los que declare la página (window.__entornos)
//   node exportar_glb.mjs calle --blender  además abre el .glb en Blender y guarda calle.blend al lado
//   node exportar_glb.mjs calle --blender --forzar   reemplaza un calle.blend que ya exista; sin --forzar NO se pisa
//                                                     (puede tener retoques a mano) y solo se avisa
//
// --blender usa scripts/abrir_en_blender.py de la skill, que se busca en: MOTION_STUDIO_SKILL (carpeta de la skill
// motion-studio), "skill" en motion.config.json (una ruta relativa se toma desde la carpeta del proyecto, no desde donde
// se lance node), ~/.agents/skills/motion-studio y ~/.claude/skills/motion-studio.
// Blender: BLENDER, "blender" en motion.config.json o la ruta estándar de Windows. Si Blender o su script fallan
// (--python-exit-code 1) o no se guarda el .blend, sale con código 1 y muestra el error.
//
// La página (index.html → composicion.js) debe definir:
//   window.__entornos = ['calle', ...]
//   window.exportar = async nombre => ({ glb: base64, anclas: { camara: { pos, mira, fov }, ... } })   // E3.exportarGLB
// Salida: exportaciones/blender/<nombre>.glb y <nombre>.anclas.json. Blender: references/25d.md («Escenarios Three.js»).
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const cfg = JSON.parse(fs.readFileSync(path.join(root, 'motion.config.json'), 'utf8'));
const W = cfg.video.ancho, H = cfg.video.alto;
const args = process.argv.slice(2);
const conBlender = args.includes('--blender'), forzar = args.includes('--forzar');
let nombres = args.filter(a => !a.startsWith('--'));

// scripts/abrir_en_blender.py de la skill instalada (antes de abrir el navegador: si falta, se dice ya)
let scriptBlender = null;
if (conBlender) {
  // cfg.skill relativa → contra root (la carpeta del proyecto), no contra process.cwd(); una absoluta queda igual
  const casa = os.homedir(), delProyecto = typeof cfg.skill === 'string' && cfg.skill ? path.resolve(root, cfg.skill) : null;
  const cand = [process.env.MOTION_STUDIO_SKILL, delProyecto, path.join(casa, '.agents', 'skills', 'motion-studio'),
    path.join(casa, '.claude', 'skills', 'motion-studio')].filter(Boolean).map(d => path.join(d, 'scripts', 'abrir_en_blender.py'));
  scriptBlender = cand.find(f => fs.existsSync(f));
  if (!scriptBlender) {
    console.error('No encuentro scripts/abrir_en_blender.py de la skill. Buscado en:\n  ' + cand.join('\n  ')
      + '\nDefine MOTION_STUDIO_SKILL=<carpeta de la skill motion-studio> o "skill" en motion.config.json.');
    process.exit(1);
  }
}

const HERRAMIENTAS = process.env.MOTION_STUDIO_HOME || path.join(os.homedir(), '.motion-studio');
let chromium;
try { ({ chromium } = await import('playwright')); }
catch { ({ chromium } = createRequire(path.join(HERRAMIENTAS, 'package.json'))('playwright')); }

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json',
  '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.glb': 'model/gltf-binary' };
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
  fs.readFile(file, (err, b) => { if (err) { res.writeHead(404).end(); return; }
    res.setHeader('Content-Type', MIME[path.extname(file)] || 'application/octet-stream'); res.end(b); });
});
await new Promise(r => server.listen(0, '127.0.0.1', r));

const gpu = cfg.gpu || {};
const lanzar = ['--use-angle=' + (gpu.angle || 'd3d11'), '--enable-gpu', '--ignore-gpu-blocklist'];
if ((gpu.modo || 'alto-rendimiento') === 'alto-rendimiento') lanzar.push('--force_high_performance_gpu');
const browser = await chromium.launch({ headless: true, args: lanzar });
const salida = path.join(root, 'exportaciones', 'blender');
fs.mkdirSync(salida, { recursive: true });
let codigo = 0;
try {
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  page.on('pageerror', e => console.error('PAGEERROR', e.message));
  page.on('console', m => { if (m.type() === 'error') console.error('CONSOLE', m.text()); });
  await page.goto(`http://127.0.0.1:${server.address().port}/?exportar=1`);
  await page.waitForFunction(() => window.ready || window.loadError, null, { timeout: 120000 });
  const err = await page.evaluate(() => window.loadError);
  if (err) throw new Error(err);
  if (args.includes('--todos')) nombres = await page.evaluate(() => window.__entornos || []);
  if (!nombres.length) throw new Error('Indica un escenario (node exportar_glb.mjs calle) o --todos');
  for (const n of nombres) {
    const r = await page.evaluate(async n => window.exportar(n), n);
    const glb = path.join(salida, `${n}.glb`);
    fs.writeFileSync(glb, Buffer.from(r.glb, 'base64'));
    fs.writeFileSync(path.join(salida, `${n}.anclas.json`), JSON.stringify({ _salida: [W, H], ...r.anclas }, null, 2));
    console.log(`OK  ${path.relative(root, glb)}  (${(fs.statSync(glb).size / 1024).toFixed(0)} KB, ${Object.keys(r.anclas || {}).length} anclas)`);
    if (conBlender) {
      const exe = process.env.BLENDER || cfg.blender || 'C:/Program Files/Blender Foundation/Blender 5.2/blender.exe';
      // --python-exit-code 1: una excepción del script termina Blender con código 1 (sin ella, sale con 0)
      const b = spawnSync(exe, ['-b', '--factory-startup', '--python-exit-code', '1', '--python', scriptBlender, '--', glb, '--guardar',
        ...(forzar ? ['--forzar'] : [])], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
      const out = b.stdout || '', guardado = /^Guardado /m.test(out), existe = /^Ya existe /m.test(out);
      const lineas = out.split(/\r?\n/).filter(l => /Anclas|Guardado|Ya existe|Error/.test(l));
      if (lineas.length) console.log(lineas.join('\n'));
      if (existe && !guardado) console.log('AVISO: se conserva el .blend existente (puede tener retoques a mano)');
      if (b.error || b.status !== 0 || !(guardado || existe)) {
        console.error(`ERROR Blender (${b.error ? b.error.message : 'código ' + b.status}${guardado || existe ? '' : ', sin «Guardado»'}): ${exe}`);
        const cola = (b.stderr || '').trim() || out.trim();
        if (cola) console.error(cola.split(/\r?\n/).slice(-25).join('\n'));
        codigo = 1;
      }
    }
  }
} catch (e) { console.error(String(e && e.stack || e)); codigo = 1; }
finally { await browser.close(); server.close(); }
process.exit(codigo);
