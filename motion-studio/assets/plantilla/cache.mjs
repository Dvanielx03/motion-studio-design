// La reanudación solo reutiliza segmentos de las mismas fuentes y configuración.
//
// Caché por plano (opcional): si motion.config.json declara
//   "dependencias": { "P01": ["escena/oficina.js"], "P02": ["escena/calle.js", "assets/calle/"] }
// y la página publica window.__info.planos = [[id, inicio, fin, salidaDur?], ...], cada segmento de 5 s se identifica
// con la huella COMÚN (todo el proyecto salvo los archivos asignados a planos) + la huella de los planos que toca. Así,
// editar un escenario solo rehace los segmentos donde aparece. Un archivo que no esté asignado a ningún plano sigue
// siendo común: lo no declarado nunca se reutiliza por error. `salidaDur` (opcional) es la duración en segundos de la
// transición de SALIDA del plano: mientras dura, el plano se sigue dibujando después de `fin`. Un id de `dependencias`
// que la página no publique (errata, plano renombrado o fusionado) deja sus archivos en la huella común (`ausentes`).
// Rutas relativas a la raíz del proyecto: una vacía («», «/», «.»), una fuera del proyecto («../otra/»), un archivo o
// una carpeta con «/» final que no existen, o una ruta con otras mayúsculas dan error con el plano y la ruta.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const OMITIR = new Set(['.git', 'node_modules', '__pycache__', 'review', 'exportaciones']);
// La mezcla se vuelve a unir en cada exportación; cambiar solo el audio no rehace la imagen. La bitácora tampoco.
const SIN_IMAGEN = /\.(md|log|pyc|wav|mp3|m4a|aac|flac|ogg|opus|jsonl)$/i;
// Herramientas que no cambian la imagen: Python (revisión, audio, producción), revisores/exportadores de Node y los
// scripts de diagnóstico de la RAÍZ «_*.mjs» / «_*.cjs». render.mjs y cache.mjs SÍ cuentan (definen la codificación).
// Cualquier otro «_*» (escena/_paleta.js, assets/_fondo.png, _comun.js) puede cargarlo la página: entra en la huella.
const HERRAMIENTAS = new Set(['auditar.mjs', 'qc_escena.mjs', 'exportar_glb.mjs']);
const noImagen = (n, enRaiz) => SIN_IMAGEN.test(n) || /\.py$/i.test(n) || HERRAMIENTAS.has(n) || (enRaiz && /^_.*\.(mjs|cjs)$/i.test(n));
const rel = (root, f) => path.relative(root, f).split(path.sep).join('/');
const coincide = (r, e) => (e.endsWith('/') ? r.startsWith(e) : r === e);
const filtrar = (root, lista, excluir) => lista.filter(f => !excluir.some(e => coincide(rel(root, f), e)));

function archivos(root, dir, salida, lista = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const file = path.join(dir, entry.name);
    if (file === salida || OMITIR.has(entry.name) || entry.isSymbolicLink()) continue;
    if (entry.isDirectory()) { archivos(root, file, salida, lista); continue; }
    if (!entry.isFile() || noImagen(entry.name, dir === root)) continue;
    lista.push(file);
  }
  return lista;
}

function resumir(root, lista, extra) {
  const h = crypto.createHash('sha256');
  const buffer = Buffer.alloc(1024 * 1024);
  for (const file of lista) {
    h.update(rel(root, file) + '\0');
    const fd = fs.openSync(file, 'r');
    try {
      let n;
      while ((n = fs.readSync(fd, buffer, 0, buffer.length, null)) > 0) h.update(buffer.subarray(0, n));
    } finally { fs.closeSync(fd); }
    h.update('\0');
  }
  if (extra !== null) h.update(JSON.stringify(extra ?? {}));
  return h.digest('hex').slice(0, 20);
}

// Huella de todo el proyecto (comportamiento original). `excluir`: rutas relativas (archivo, o carpeta con «/» final).
export function huellaProyecto(root, { salida = 'exportaciones', extra = {}, excluir = [] } = {}) {
  return resumir(root, filtrar(root, archivos(root, root, path.resolve(root, salida)), excluir), extra);
}

// «./escena\oficina.js» o «/escena/oficina.js» → «escena/oficina.js» (relativa a la raíz del proyecto); una carpeta
// existente sin «/» final la recibe (si no, no casaría nada). «», «/», «.» o «escena/..» (la raíz) quedan en «».
function normalizar(root, e) {
  let r = path.posix.normalize(String(e).replace(/\\/g, '/')).replace(/^\.\//, '').replace(/^\/+/, '');
  if (r === '.') r = '';
  if (r && !r.endsWith('/') && esCarpeta(root, r)) r += '/';
  return r;
}
const esCarpeta = (root, r) => { try { return fs.statSync(path.join(root, r)).isDirectory(); } catch { return false; } };
// «../otra/», «..» o «C:/otra» (tras normalizar): fuera de la raíz del proyecto, nunca entran en la huella.
const fueraDelProyecto = r => r === '..' || r.startsWith('../') || /^[a-z]:(\/|$)/i.test(r);

// Ruta de la huella que solo difiere de `e` en mayúsculas (archivo, o carpeta con «/» final), o null. En Windows y macOS
// «ESCENA/Oficina.js» existe en disco, pero la huella guarda la ruta real y no casaría: se avisa con la correcta. Sin «/»
// final se busca primero un archivo y, si no hay, una carpeta (en Linux «ESCENA» no existe y no recibe la barra).
function rutaReal(e, enHuella) {
  const partes = e.replace(/\/$/, '').toLowerCase().split('/'), n = partes.length, clave = partes.join('/');
  const buscar = carpeta => {
    for (const r of enHuella) {
      const rp = r.split('/');
      if (carpeta ? rp.length <= n : rp.length !== n) continue;
      const pre = rp.slice(0, n).join('/');
      if (pre.toLowerCase() === clave) return pre + (carpeta ? '/' : '');
    }
    return null;
  };
  return e.endsWith('/') ? buscar(true) : (buscar(false) ?? buscar(true));
}
const sugerir = (e, enHuella) => { const r = rutaReal(e, enHuella); return r && r !== e ? `${e}: ¿quisiste decir ${r}? las rutas distinguen mayúsculas` : null; };

// Huellas por plano y común, según motion.config.json → dependencias. `excluir` como en huellaProyecto. `publicados`:
// ids de window.__info.planos; un id de dependencias que no esté entre ellos deja sus archivos en la común (aunque otro
// plano también los declare) y se devuelve en `ausentes`, para avisar sin reutilizar imagen vieja por error.
export function huellasPorPlano(root, dependencias, { salida = 'exportaciones', extra = {}, excluir = [], publicados = null } = {}) {
  const todos = filtrar(root, archivos(root, root, path.resolve(root, salida)), excluir);
  const enHuella = new Set(todos.map(f => rel(root, f)));
  const pub = publicados ? new Set(publicados.map(String)) : null;
  const asignados = new Set(), aComun = new Set(), porPlano = {}, ausentes = [];
  for (const [id, lista] of Object.entries(dependencias || {})) {
    const originales = [].concat(lista), rutas = originales.map(e => normalizar(root, e));
    // «», «/», «.», « » o null casarían con todo (o con nada): se nombra el plano y lo que se escribió.
    const vacias = originales.filter((e, i) => e == null || !rutas[i].replace(/[\s/]/g, ''));
    if (vacias.length) throw new Error(`dependencia vacía en ${id}: ${vacias.map(e => `«${e}»`).join(', ')} no nombra ningún archivo ni carpeta del proyecto (la raíz no vale)`);
    const ajenas = rutas.filter(fueraDelProyecto);
    if (ajenas.length) throw new Error(`dependencias de ${id}: ${ajenas.join(', ')} ${ajenas.length > 1 ? 'están' : 'está'} fuera del proyecto (las rutas son relativas a su raíz)`);
    // Mayúsculas distintas: un archivo (o una carpeta sin ningún archivo que case) cuya ruta real sí está en la huella.
    const mayus = rutas.filter(e => e.endsWith('/') ? ![...enHuella].some(r => r.startsWith(e)) : !enHuella.has(e))
      .map(e => sugerir(e, enHuella)).filter(Boolean);
    if (mayus.length) throw new Error(`dependencias de ${id}: ${mayus.join('; ')}`);
    // Un archivo que no existe, o una carpeta con «/» final que no existe (o es un archivo): no casaría nunca.
    const faltan = rutas.filter(e => e.endsWith('/') ? !esCarpeta(root, e) : !fs.existsSync(path.join(root, e)));
    if (faltan.length) throw new Error(`dependencias de ${id}: no existen ${faltan.map(e => e.endsWith('/')
      && fs.existsSync(path.join(root, e.slice(0, -1))) ? `${e} (es un archivo: quita la «/» final)` : e).join(', ')}`);
    // Un archivo que existe pero no entra en la huella aportaría un hash vacío: editarlo nunca invalidaría el plano.
    const fuera = rutas.filter(e => !e.endsWith('/') && !enHuella.has(e));
    if (fuera.length) throw new Error(`dependencias de ${id}: ${fuera.join(', ')} no entra en la huella (no cambia la imagen: audio, .py, .md, motion.config.json o diagnósticos «_*.mjs» / «_*.cjs» de la raíz; o está en review, node_modules, exportaciones o la carpeta de salida, o es un enlace simbólico)`);
    const suyos = todos.filter(f => rutas.some(e => coincide(rel(root, f), e)));
    if (pub && !pub.has(String(id))) { ausentes.push(id); suyos.forEach(f => aComun.add(f)); continue; }
    suyos.forEach(f => asignados.add(f));
    porPlano[id] = resumir(root, suyos, null);
  }
  const comun = resumir(root, todos.filter(f => !asignados.has(f) || aComun.has(f)), extra);
  return { comun, porPlano, ausentes };
}

// Clave de un segmento [a, b) (en fotogramas): común + planos que lo tocan. Margen para las transiciones: cada plano
// empieza `margen` s antes y termina max(margen, salidaDur + 0,25) s después de su `fin`. Un plano con tiempos que no
// son números cuenta siempre (ante la duda, se rehace).
export function claveSegmento({ comun, porPlano }, planos, a, b, fps, margen = 0.5) {
  const t0 = a / fps, t1 = b / fps;
  const toca = ([, i, f, s]) => !(Number.isFinite(+i) && Number.isFinite(+f))
    || (+f + Math.max(margen, (Number.isFinite(+s) ? +s : 0) + 0.25) > t0 && +i - margen < t1);
  const tocan = [...new Set((planos || []).filter(toca).map(([id]) => String(id)))].sort();
  const h = crypto.createHash('sha256').update(comun);
  for (const id of tocan) h.update(`|${id}:${porPlano[id] ?? 'comun'}`);
  h.update(`|${a}-${b}@${fps}`);
  return { clave: h.digest('hex').slice(0, 24), planos: tocan };
}
