// Subtítulos dibujados sincronizados con la voz (texto del guion + tiempos por palabra del ASR).
// Dos presets medidos (ver references/produccion-25d.md, «Nivel de referencia»):
//   'nicho'  → el de los Shorts narrados de historia en inglés (referencia Ricks Clips, medido el 18 nov 2026):
//              1–2 palabras por golpe, tal como se dicen (sin pasar a mayúsculas), ≈ 3,6 % del alto, blanco con
//              contorno fino y posición fija a 0,66 del alto (solo se mueve si choca con un protegido).
//   'grande' → el de Hanói v1 / Torre Eiffel: MAYÚSCULAS, 2–4 palabras, 5 % del alto y una palabra clave en color.
// Uso:
//   const subs = crearSubtitulos({ guion, palabras, preset: 'nicho', idioma: 'en', cortes });
//   window.seek = t => { …; rect = subs.dibujar(ctx, tx, t, W, H, { yDe }); };   // tx = crearTexto(ctx) de lib.js
// `dibujar` devuelve la caja del texto ({ id, letras, x, y, w, h }) para window.__qc, o null.
// `cortes`: un golpe que empezó ≥ 0,35 s antes de un corte termina en el corte (no cruza al plano siguiente).
// `yDe(t)`: altura (fracción) por instante, p. ej. por plano; se evalúa en el centro del golpe para que no salte.
const PRESETS = {
  nicho: { maxPal: 2, mayusculas: false, tam: 0.036, borde: 0.2, enfasis: null, halo: 0.22, pop: 0.03, y: 0.66, fuente: 'Titular' },
  grande: { maxPal: 4, mayusculas: true, tam: 0.05, borde: 0.24, enfasis: '#FFD23F', halo: 0.42, pop: 0.06, y: 0.66, fuente: 'Titular' },
};
const DEBILES = {
  es: ['un', 'una', 'el', 'la', 'los', 'las', 'de', 'del', 'por', 'con', 'en', 'a', 'y', 'e', 'que', 'tu', 'tus', 'su', 'se', 'no', 'lo', 'te', 'le', 'al', 'para', 'ya', 'si', 'es', 'fue', 'eso', 'mas'],
  en: ['a', 'an', 'the', 'of', 'to', 'in', 'on', 'and', 'or', 'but', 'his', 'her', 'its', 'at', 'for', 'with', 'from', 'by', 'as', 'that', 'this', 'he', 'she', 'it', 'was', 'is', 'were', 'be', 'into', 'so', 'if', 'than', 'then', 'they', 'their', 'you', 'your', 'i', 'we', 'my', 'our'],
};
const norm = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9ñ]/g, '');

export function crearSubtitulos({ guion, palabras, preset = 'grande', idioma = 'es', enfasis = [], ocultos = [], cortes = [], ...opciones }) {
  const P = { ...PRESETS[preset], ...opciones }, DEBIL = new Set(DEBILES[idioma] || DEBILES.es);
  // 1) tokens del guion con su línea
  const G = [];
  guion.forEach((txt, li) => String(txt.texto ?? txt).split(/\s+/).filter(Boolean).forEach(w => G.push({ w, li, n: norm(w) })));
  // 2) alineación con el ASR (programación dinámica por igualdad normalizada); lo que no casa («7,000» ↔ «7000»…) se interpola
  const A = (palabras.words || palabras).map(p => ({ ini: p.start, fin: p.end, n: norm(p.word ?? p.w) }));
  const n = G.length, m = A.length, dp = Array.from({ length: n + 1 }, () => new Int32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--)
    dp[i][j] = G[i].n && G[i].n === A[j].n ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  for (let i = 0, j = 0; i < n && j < m;) {
    if (G[i].n && G[i].n === A[j].n) { G[i].ini = A[j].ini; G[i].fin = A[j].fin; i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) i++; else j++;
  }
  for (let i = 0; i < n; i++) if (G[i].ini === undefined) {
    let a = i - 1; while (a >= 0 && G[a].fin === undefined) a--;
    let b = i + 1; while (b < n && G[b].ini === undefined) b++;
    const t0 = a >= 0 ? G[a].fin : 0, t1 = b < n ? G[b].ini : t0 + 0.4, k = (i - a) / (b - a);
    G[i].ini = t0 + (t1 - t0) * (k - 0.5 / (b - a)); G[i].fin = t0 + (t1 - t0) * (k + 0.5 / (b - a));
  }
  // 3) golpes de hasta maxPal palabras: se corta en la puntuación y no se termina en palabra débil
  const frases = []; let f = [];
  G.forEach(g => { if (f.length && g.li !== f[0].li) { frases.push(f); f = []; } f.push(g); if (/[,.:;…!?]["”’]?$/.test(g.w)) { frases.push(f); f = []; } });
  if (f.length) frases.push(f);
  const grupos = [];
  for (const fr of frases) {
    const partes = Math.ceil(fr.length / P.maxPal); let i0 = 0;
    for (let p = 1; p <= partes; p++) {
      let corte = p === partes ? fr.length : Math.round(fr.length * p / partes);
      while (corte > i0 + 1 && corte < fr.length && DEBIL.has(norm(fr[corte - 1].w))) corte--;
      if (corte > i0) grupos.push(fr.slice(i0, corte)); i0 = corte;
    }
    if (i0 < fr.length) grupos.push(fr.slice(i0));
  }
  const limpiar = w => { const x = w.replace(/[,.:;…]+(["”’]?)$/, '$1'); return P.mayusculas ? x.toUpperCase() : x; };
  const lista = grupos.map((ws, k) => {
    const ini = ws[0].ini, sig = grupos[k + 1] ? grupos[k + 1][0].ini : Infinity;
    let fin = Math.min(sig, ws[ws.length - 1].fin + 0.3);
    const corte = cortes.find(c => c > ini + 0.35 && c < fin); if (corte) fin = corte;
    let iE = -1;
    if (P.enfasis) {
      iE = ws.findIndex(w => enfasis.some(e => norm(w.w) === norm(e)));
      if (iE < 0 && P.maxPal > 2) { let mejor = -1; ws.forEach((w, i) => { if (!DEBIL.has(norm(w.w)) && (mejor < 0 || norm(w.w).length > norm(ws[mejor].w).length)) mejor = i; }); iE = mejor; }
    }
    return { ws: ws.map(w => limpiar(w.w)), ini, fin, enf: iE };
  });
  return { lista, dibujar: (ctx, tx, t, W, H, op = {}) => dibujar(ctx, tx, t, W, H, lista, ocultos, P, op) };
}

function dibujar(ctx, tx, t, W, H, lista, ocultos, P, op) {
  const g = lista.find(x => t >= x.ini && t < x.fin);
  if (!g || ocultos.some(([a, b]) => g.ini >= a && g.ini < b)) return null;
  let size = Math.round(H * P.tam);
  const font = s => `${s}px ${P.fuente}`, borde = s => Math.max(2, Math.round(s * P.borde));
  const sep = s => s * 0.26, MAXW = W * 0.8;
  const anchoDe = (ws, s) => ws.reduce((a, w, i) => a + tx.medir(w, font(s), { borde: borde(s) }) + (i ? sep(s) : 0), 0);
  let lineas = [g.ws.map((w, i) => i)];
  if (anchoDe(g.ws, size) > MAXW && g.ws.length > 1) {
    let mejor = 1, dif = Infinity;
    for (let c = 1; c < g.ws.length; c++) { const d = Math.abs(anchoDe(g.ws.slice(0, c), size) - anchoDe(g.ws.slice(c), size)); if (d < dif) { dif = d; mejor = c; } }
    lineas = [g.ws.slice(0, mejor).map((_, i) => i), g.ws.slice(mejor).map((_, i) => i + mejor)];
  }
  const anchoLinea = (l, s) => anchoDe(l.map(i => g.ws[i]), s);
  while (Math.max(...lineas.map(l => anchoLinea(l, size))) > MAXW && size > H * 0.025) size -= 1;
  // centro de la zona útil de Shorts (5 % a la izquierda, 120 px de botones a la derecha en 1080)
  const lh = size * 1.12, cx = Math.round(W * (0.05 + (1 - 120 / 1080)) / 2);
  const altoBloque = (lineas.length - 1) * lh + size * 1.6;
  const yFrac = op.yDe ? op.yDe((g.ini + Math.min(g.fin, g.ini + 3)) / 2) : (op.y ?? P.y);
  const y = Math.min(Math.round(H * yFrac), Math.round(H * (1 - 400 / 1920) - 6 - altoBloque * 1.08 / 2));
  const k = Math.min(1, Math.max(0, (t - g.ini) / 0.14));
  const e = k < 0.6 ? 1 + P.pop - (P.pop + 0.02) * (k / 0.6) : 0.98 + 0.02 * ((k - 0.6) / 0.4);
  const anchoMax = Math.max(...lineas.map(l => anchoLinea(l, size)));
  if (P.halo > 0) {
    const hb = (lineas.length - 1) * lh + size * 1.2, gr = ctx.createRadialGradient(cx, y, 0, cx, y, anchoMax * 0.62);
    gr.addColorStop(0, `rgba(12,8,20,${P.halo})`); gr.addColorStop(1, 'rgba(12,8,20,0)');
    ctx.save(); ctx.fillStyle = gr; ctx.translate(cx, y); ctx.scale(1, hb / anchoMax * 1.25); ctx.translate(-cx, -y);
    ctx.beginPath(); ctx.arc(cx, y, anchoMax * 0.62, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  }
  ctx.save(); ctx.translate(cx, y); ctx.scale(e, e);
  lineas.forEach((l, j) => {
    const total = anchoLinea(l, size), ly = Math.round((j - (lineas.length - 1) / 2) * lh);
    let x = -total / 2;
    l.forEach((i, nn) => {
      if (nn) x += sep(size);
      const c = i === g.enf && P.enfasis ? P.enfasis : '#FFFFFF';
      x += tx.texto(g.ws[i], font(size), c, Math.round(x), ly, { align: 'left', borde: borde(size), colorBorde: '#15121A', sombra: true });
    });
  });
  ctx.restore();
  return { id: g.ws.join(' '), letras: g.ws.join(' ').length, x: cx - anchoMax * e / 2, y: y - altoBloque * e / 2, w: anchoMax * e, h: altoBloque * e };
}
