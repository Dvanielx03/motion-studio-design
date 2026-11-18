// Diagnóstico: abre la página como render.mjs (misma GPU) y evalúa una expresión JS en ella. Por empezar por «_» queda
// fuera de la caché de render y de auditar.mjs. Expón en la página lo que quieras medir (p. ej. window.__dbg).
//   node _diag.mjs "(await window.seek(12), JSON.stringify(window.__dbg.rect('pullman')))"   [página.html]
// (Nació en «The Hotel That Rose With the Guests Inside», 18 nov 2026: encontró en 2 llamadas por qué un personaje no
// salía en su ventana.)
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import os from 'node:os';
import { createRequire } from 'node:module';
const root = path.resolve('.'), HERR = path.join(os.homedir(), '.motion-studio');
const { chromium } = createRequire(path.join(HERR, 'package.json'))('playwright');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.woff2': 'font/woff2', '.png': 'image/png' };
const srv = http.createServer((req, res) => {
  const rel = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  let base = root; if (rel.startsWith('/node_modules/') && !fs.existsSync(path.join(root, '.' + rel))) base = HERR;
  fs.readFile(path.join(base, '.' + (rel === '/' ? '/index.html' : rel)), (e, b) => { if (e) { res.writeHead(404).end(); return; } res.setHeader('Content-Type', MIME[path.extname(rel === '/' ? 'index.html' : rel)] || 'application/octet-stream'); res.end(b); });
});
await new Promise(r => srv.listen(0, '127.0.0.1', r));
const b = await chromium.launch({ headless: true, args: ['--use-angle=d3d11', '--force_high_performance_gpu', '--enable-gpu', '--ignore-gpu-blocklist'] });
const p = await b.newPage(); p.on('console', m => console.log('[pág]', m.text()));
await p.goto(`http://127.0.0.1:${srv.address().port}/${process.argv[3] || ''}`);
await p.waitForFunction(() => window.ready || window.loadError, null, { timeout: 180000 });
const err = await p.evaluate(() => window.loadError); if (err) { console.log('loadError:', err); process.exit(1); }
console.log(await p.evaluate(`(async () => { ${process.argv[2].startsWith('return') ? process.argv[2] : 'return ' + process.argv[2]} })()`));
await b.close(); srv.close();
