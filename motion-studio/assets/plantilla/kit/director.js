// Director: del guion y el storyboard a los planos. Ancla los tiempos a PALABRAS de la voz (si la voz cambia, todo se
// recoloca solo) y compone movimientos de cámara con intención (empuje, tirón, órbita, grúa, seguimiento, revelado)
// que devuelven claves para camaraContinua (kit/escena3d.js). Sin estado y sin three: se puede probar en Node.
//
//   import { crearDirector, mov, encadenar } from './kit/director.js';
//   const D = crearDirector({ palabras });                 // audio/voz.palabras.json (faster-whisper o produccion.py)
//   D.en('cracking')            → inicio de la 1.ª «cracking»;  D.en('crack', 2) → la 2.ª;  D.fin('stone') → su final
//   D.t('@crack#2+0.15')        → ancla en texto (storyboard); un número pasa tal cual
//   const camara = encadenar(
//     mov.empuje({ t0: D.t('@Sloppy'), t1: D.t('@pointing'), sujeto: [0, 1.6, 0.6], dist: [5, 3.4], alto: 0.1, angulo: 0.15 }),
//     mov.orbita({ t0: D.t('@pointing'), t1: D.t('@wall'), centro: [0, 1.7, 0.4], radio: 3.4, ang: [0.15, -0.35], alto: [0.1, 0.5] }));
//   { id: 'P01', inicio: 0, fin: D.t('@Romans-0.08'), continua: true, camara }
//
// Regla de la referencia medida (produccion-25d.md): algo cambia de escala o de ángulo cada 2–4 s. revisarTomas() lo
// comprueba sobre las claves; qc_escena.mjs lo comprueba sobre el render (regla «toma sin cambio»).
const norm = s => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9ñ]/g, '');

export function crearDirector({ palabras = [] } = {}) {
  const W = (palabras.words || palabras).map(p => ({ n: norm(p.word ?? p.w), ini: p.start, fin: p.end }));
  const buscar = (palabra, n = 1) => {
    const q = norm(palabra); let k = 0;
    for (const w of W) if (w.n === q || (q.length >= 3 && w.n.startsWith(q))) { if (++k === n) return w; }
    throw new Error(`director: no encuentro «${palabra}» n.º ${n} en la voz (revisa voz.palabras.json)`);
  };
  const en = (palabra, n = 1) => buscar(palabra, n).ini;
  const fin = (palabra, n = 1) => buscar(palabra, n).fin;
  // ancla de texto: '@palabra', '@palabra#2', '@palabra+0.2', '@palabra#2-0.1', '@palabra$' (final de la palabra)
  const t = spec => {
    if (typeof spec === 'number') return spec;
    const m = /^@([^#+\-$]+)(?:#(\d+))?(\$)?([+-]\d*\.?\d+)?$/.exec(String(spec).trim());
    if (!m) throw new Error(`director: ancla inválida «${spec}» (usa '@palabra', '@palabra#2', '@palabra+0.2', '@palabra$')`);
    const w = buscar(m[1], m[2] ? +m[2] : 1);
    return +((m[3] ? w.fin : w.ini) + (m[4] ? +m[4] : 0)).toFixed(3);
  };
  // resuelve un storyboard con anclas: planos [{ id, inicio:'@…', fin:'@…', camara: [[ancla, clave, curva?], …], … }]
  // y actuación { personaje: [[ancla, estado], …] } → números listos para la composición
  const resolver = ({ planos = [], actuacion = {} }) => ({
    planos: planos.map(p => ({ ...p, inicio: t(p.inicio), fin: t(p.fin), camara: p.camara && p.camara.map(([a, c, curva]) => curva ? [t(a), c, curva] : [t(a), c]) })),
    actuacion: Object.fromEntries(Object.entries(actuacion).map(([k, v]) => [k, v.map(([a, e]) => [t(a), e]).sort((x, y) => x[0] - y[0])])),
  });
  return { en, fin, t, resolver, palabras: W };
}

// ── movimientos de cámara: cada uno devuelve claves [[t, {pos, mira, fov}], …] ──
const lerp = (a, b, k) => a + (b - a) * k;
const par = (v, k) => Array.isArray(v) ? lerp(v[0], v[1], k) : v;
const suave = k => k * k * (3 - 2 * k);
const muestrear = (t0, t1, n, f) => Array.from({ length: n + 1 }, (_, i) => { const k = i / n; return [+(t0 + (t1 - t0) * k).toFixed(3), f(k)]; });

export const mov = {
  // EMPUJE / TIRÓN: la cámara avanza (o retrocede) hacia el sujeto por una dirección fija; dist: [desde, hasta] en m.
  // angulo: rumbo alrededor del sujeto (rad, 0 = +z); alto: altura relativa al sujeto (m) o [desde, hasta]
  empuje({ t0, t1, sujeto, dist, angulo = 0, alto = 0, fov = 42, mira = [0, 0, 0], giro = 0, pasos = 2 }) {
    return muestrear(t0, t1, pasos, k => { const d = par(dist, k), a = par(angulo, k), h = par(alto, k);
      return { pos: [sujeto[0] + Math.sin(a) * d, sujeto[1] + h, sujeto[2] + Math.cos(a) * d], mira: sujeto.map((v, i) => v + mira[i]), fov: par(fov, k), giro: par(giro, k) }; });
  },
  // ÓRBITA: arco alrededor del sujeto a radio constante (o variable); ang: [desde, hasta] (rad). Revela posiciones.
  orbita({ t0, t1, centro, radio, ang, alto = 0, fov = 42, giro = 0, pasos = 6 }) {
    return muestrear(t0, t1, pasos, k => { const r = par(radio, k), a = par(ang, k), h = par(alto, k);
      return { pos: [centro[0] + Math.sin(a) * r, centro[1] + h, centro[2] + Math.cos(a) * r], mira: [...centro], fov: par(fov, k), giro: par(giro, k) }; });
  },
  // GRÚA: sube o baja mientras inclina la mirada (revela escala: del personaje al lugar, o del cielo al suelo)
  grua({ t0, t1, sujeto, alto, dist, angulo = 0, miraAlto = [0, 0], fov = 42, giro = 0, pasos = 3 }) {
    return muestrear(t0, t1, pasos, k => { const d = par(dist, k), a = par(angulo, k);
      return { pos: [sujeto[0] + Math.sin(a) * d, sujeto[1] + par(alto, k), sujeto[2] + Math.cos(a) * d], mira: [sujeto[0], sujeto[1] + par(miraAlto, k), sujeto[2]], fov: par(fov, k), giro: par(giro, k) }; });
  },
  // SEGUIR: acompaña a un sujeto que se mueve (trayectoria(t) → [x,y,z]) con un RETARDO de cámara (la cámara llega un
  // poco tarde, como un operador): la posición sale de la trayectoria suavizada en [t − retardo, t]; espacio por delante
  // del movimiento con `adelanto` (m en la dirección del avance)
  seguir({ t0, t1, trayectoria, offset = [0, 0.2, 4], retardo = 0.3, adelanto = 0.4, fov = 42, pasos = 8 }) {
    const P = t => trayectoria(t), media = t => { const q = [0, 0, 0]; for (let i = 0; i < 5; i++) { const p = P(Math.max(t0, t - retardo * i / 4)); q[0] += p[0] / 5; q[1] += p[1] / 5; q[2] += p[2] / 5; } return q; };
    return muestrear(t0, t1, pasos, k => { const t = t0 + (t1 - t0) * k, c = media(t), a = P(Math.min(t1, t + 0.25)), b = P(Math.max(t0, t - 0.25)), v = [a[0] - b[0], a[1] - b[1], a[2] - b[2]], n = Math.hypot(...v) || 1;
      return { pos: [c[0] + offset[0], c[1] + offset[1], c[2] + offset[2]], mira: [c[0] + v[0] / n * adelanto, c[1] + 0.1, c[2] + v[2] / n * adelanto], fov }; });
  },
  // REVELAR: desliza la cámara en lateral desde detrás de un oclusor en primer término (columna, cortina, objeto) para
  // descubrir al sujeto: el oclusor cruza el cuadro más rápido que el fondo (paralaje)
  revelar({ t0, t1, sujeto, dist = 4, lado = 1, barrido = 1.2, alto = 0, fov = 42, giro = 0, pasos = 3 }) {
    return muestrear(t0, t1, pasos, k => { const e = suave(k), dx = lado * barrido * (1 - e);
      return { pos: [sujeto[0] + dx, sujeto[1] + alto, sujeto[2] + dist], mira: [sujeto[0] + dx * 0.25, sujeto[1], sujeto[2]], fov, giro: par(giro, k) }; });
  },
  // VÉRTIGO (dolly zoom): la cámara se acerca o se aleja mientras el fov compensa; el sujeto conserva su tamaño y el
  // fondo se estira o se comprime. Para la revelación que «marea» (el descubrimiento, el miedo). fov0: fov al empezar.
  vertigo({ t0, t1, sujeto, dist, fov0 = 40, angulo = 0, alto = 0, pasos = 4 }) {
    const d0 = dist[0], h0 = Math.tan(fov0 * Math.PI / 360) * d0;
    return muestrear(t0, t1, pasos, k => { const d = par(dist, k), a = par(angulo, k);
      return { pos: [sujeto[0] + Math.sin(a) * d, sujeto[1] + par(alto, k), sujeto[2] + Math.cos(a) * d], mira: [...sujeto], fov: Math.atan(h0 / d) * 360 / Math.PI }; });
  },
  // FIJO con respiración mínima (para un remate cómico: el quieto también es una decisión, pero dura poco)
  fijo({ t0, t1, pos, mira, fov = 42 }) { return [[t0, { pos, mira, fov }], [t1, { pos: pos.map((v, i) => v + (i === 2 ? -0.05 : 0)), mira, fov }]]; },
  // HACIA: enlaza desde donde acabó el tramo anterior hasta una clave destino (p. ej. el inicio del tramo siguiente):
  // un paneo motivado que sigue un gesto, una mirada o un objeto. Se usa dentro de encadenar(); `por` añade claves
  // intermedias [[t, clave], …] para dar forma al recorrido.
  hacia({ t1, pos, mira, fov, giro, por = [] }) {
    return ult => [ult, ...por, [t1, { pos, mira, fov: fov ?? ult[1].fov, giro: giro ?? ult[1].giro ?? 0 }]];
  },
};

// Une tramos de claves consecutivos. Un tramo puede ser una función (ultimaClave) → claves (mov.hacia). Si un tramo
// empieza donde acaba el anterior se quita la clave repetida, pero solo si la cámara coincide: dentro de un plano
// continuo, una junta con otra posición sería un salto (un corte que nadie pidió), y encadenar lo rechaza.
const igualClave = (a, b) => ['pos', 'mira'].every(c => a[c].every((v, i) => Math.abs(v - b[c][i]) < 1e-3)) && Math.abs((a.fov ?? 42) - (b.fov ?? 42)) < 1e-3 && Math.abs((a.giro ?? 0) - (b.giro ?? 0)) < 1e-4;
export function encadenar(...tramos) {
  const out = [];
  for (const tr0 of tramos.filter(Boolean)) {
    const tr = typeof tr0 === 'function' ? tr0(out.at(-1)) : tr0;
    for (const k of tr) {
      if (out.length && Math.abs(out.at(-1)[0] - k[0]) < 1e-3) {
        if (!igualClave(out.at(-1)[1], k[1])) throw new Error(`encadenar: salto de cámara en t=${k[0]} (el tramo nuevo no empieza donde acabó el anterior; usa mov.hacia o ajusta sus parámetros)`);
        out[out.length - 1] = k;
      } else out.push(k);
    }
  }
  return out;
}

// revisión de tomas sobre las claves (antes de renderizar): ventanas de `ventana` s sin cambio de ángulo ≥ minGrados ni de
// escala ≥ minEscala (distancia de la cámara a su punto de mira × fov) dentro de un mismo plano. Devuelve avisos.
export function revisarTomas(planos, camaraEn, { ventana = 4, minGrados = 12, minEscala = 0.15, paso = 0.25 } = {}) {
  const avisos = [];
  for (const p of planos) {
    const muestras = [];
    for (let t = p.inicio; t < p.fin; t += paso) { const c = camaraEn(t, p); const d = c.mira.map((v, i) => v - c.pos[i]), L = Math.hypot(...d);
      muestras.push({ t, dir: d.map(v => v / L), escala: L * (c.fov || 42) }); }
    for (let i = 0; i < muestras.length; i++) {
      const j = muestras.findIndex(m => m.t >= muestras[i].t + ventana); if (j < 0) break;
      let ang = 0, esc = 0;
      for (let k = i; k <= j; k++) { const a = muestras[i], b = muestras[k];
        ang = Math.max(ang, Math.acos(Math.min(1, a.dir.reduce((s, v, q) => s + v * b.dir[q], 0))) * 180 / Math.PI);
        esc = Math.max(esc, Math.abs(b.escala / a.escala - 1)); }
      if (ang < minGrados && esc < minEscala) { avisos.push({ plano: p.id, desde: +muestras[i].t.toFixed(2), hasta: +muestras[j].t.toFixed(2), grados: +ang.toFixed(1), escala: +esc.toFixed(2) }); i = j; }
    }
  }
  return avisos;
}

// ── velocidad de la cámara y desenfoque de movimiento ──────────────────────────────────────────────────────────────
// velocidadCamara: cuánto cambia el cuadro entre dos fotogramas: grados que gira la mirada + cambio de encuadre por
// traslación (grados equivalentes: desplazamiento lateral / distancia al punto de mira) + cambio de fov. camaraEn(t) →
// {pos, mira, fov}. Por encima de ~1,2°/fotograma el ojo ve «saltos» en 30 fps: es cuando el desenfoque ayuda.
export function velocidadCamara(camaraEn, t, fps = 30) {
  const a = camaraEn(t - 0.5 / fps), b = camaraEn(t + 0.5 / fps);
  const dir = c => { const d = c.mira.map((v, i) => v - c.pos[i]), L = Math.hypot(...d); return { u: d.map(v => v / L), L }; };
  const A = dir(a), B = dir(b);
  const gira = Math.acos(Math.min(1, A.u.reduce((s, v, i) => s + v * B.u[i], 0))) * 180 / Math.PI;
  const mov = b.pos.map((v, i) => v - a.pos[i]), avance = mov.reduce((s, v, i) => s + v * A.u[i], 0);
  const lateral = Math.hypot(...mov.map((v, i) => v - avance * A.u[i]));
  const traslada = Math.atan2(lateral, A.L) * 180 / Math.PI;
  const escala = Math.abs(avance / A.L) * (a.fov ?? 42) / 2 + Math.abs((b.fov ?? 42) - (a.fov ?? 42)) / 2;   // el borde del cuadro se mueve con el zoom
  return +(gira + traslada + escala).toFixed(3);
}

// Desenfoque de movimiento por acumulación (determinista): pinta el cuadro en `muestras` instantes repartidos en el
// obturador (fracción del fotograma, 0,5 = 180°) y los promedia. pintar(tSub) dibuja la ESCENA en ctx (sin textos ni
// subtítulos: van después, nítidos). Coste: muestras × el render normal; úsalo solo cuando velocidadCamara supere el
// umbral (whips, órbitas rápidas, golpes) o en objetos que cruzan rápido. El lienzo necesita willReadFrequently.
//   if (velocidadCamara(camEn, t) > 1.2) acumularMovimiento(ctx, W, H, t, ts => pintarEscena(ts), { muestras: 4 });
//   else pintarEscena(t);
export function acumularMovimiento(ctx, W, H, t, pintar, { muestras = 4, obturador = 0.5, fps = 30 } = {}) {
  const suma = new Uint32Array(W * H * 4);
  for (let i = 0; i < muestras; i++) {
    const ts = t + ((i + 0.5) / muestras - 0.5) * obturador / fps;
    pintar(+ts.toFixed(6));
    const d = ctx.getImageData(0, 0, W, H).data;
    for (let j = 0; j < d.length; j++) suma[j] += d[j];
  }
  const img = ctx.createImageData(W, H), o = img.data, m = muestras, medio = m >> 1;
  for (let j = 0; j < o.length; j++) o[j] = ((suma[j] + medio) / m) | 0;
  ctx.putImageData(img, 0, 0);
}
