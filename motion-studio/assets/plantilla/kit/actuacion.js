// Actuación fluida para los personajes de kit/cuento.js (y cualquier billboard por estados): convierte una lista de
// CLAVES de actuación [[t, est], …] (salidas del storyboard, ancladas a palabras con kit/director.js) en el estado de
// cada instante con los principios que separan «animación» de «poses que cambian»:
//   · ANTICIPACIÓN: antes de ir a la pose nueva, la mano retrocede un poco (mezcla < 0)
//   · EXCESO y ASENTAMIENTO: llega pasada (mezcla > 1) y vuelve con un resorte amortiguado
//   · ACENTO: la cabeza y los hombros «marcan» el cambio (est.acento 0–1, decae en ~0,3 s)
//   · INERCIA: el bajo de la ropa, el pelo y el sombrero siguen el movimiento con retraso (est.inercia −1..1)
//   · SOSTÉN VIVO: en una pose larga el cuerpo nunca está congelado (balanceo lento por ruido suave, est.inclina)
//   · HABLA: la boca abre con la envolvente real de la voz (scripts/envolvente.py) o con un parloteo procedural
// Puro y sin estado: el resultado depende solo de t y de las claves (determinista; se prueba en Node).
//
//   import { crearActuacion, crearHabla } from './kit/actuacion.js';
//   const habla = crearHabla(envolvente, { ventanas: [[12.1, 14.6]] });      // audio/voz.envolvente.json
//   const doctora = crearActuacion([[0, { cara: 'sorpresa', pose: 'senala' }], [2.4, { cara: 'feliz', pose: 'brazos_arriba' }]],
//                                  { base: FICHA.doctora, habla });
//   billboard.actualizar(q(t), camara, doctora(t));      // q = cuantizar a 24 dibujos/s; doctora(t) ya trae poseB/mezcla
//
// Campos que añade al est (cuento.js los entiende; otros dibujos los pueden ignorar):
//   pose, poseB, mezcla (puede salir de 0–1: anticipación y exceso), acento, inercia, inclina, habla
const k01 = x => Math.min(1, Math.max(0, x));
const suave = k => k * k * (3 - 2 * k);

// Curva de una transición de pose en función del tiempo transcurrido τ (s) desde la clave.
//   anticipa: cuánto retrocede (fracción del recorrido), tAnt: lo que dura la anticipación (s)
//   dura: tiempo hasta llegar por primera vez (s), exceso: cuánto se pasa, frecuencia del asentamiento (Hz),
//   amortigua: decaimiento del asentamiento (1/s). Devuelve el progreso (0 al empezar, 1 al asentar).
export function curvaPose(tau, { anticipa = 0.12, tAnt = 0.1, dura = 0.26, exceso = 0.1, frecuencia = 2.6, amortigua = 9 } = {}) {
  if (tau <= 0) return 0;
  if (tau < tAnt) return -anticipa * Math.sin(Math.PI / 2 * tau / tAnt);           // retrocede
  const u = tau - tAnt;
  // acelera y frena (smoothstep): con easeOutCubic la mano recorría casi media pose en UN fotograma a 30 fps (medido)
  if (u < dura) { const k = u / dura, e = k * k * (3 - 2 * k);
    return -anticipa + (1 + exceso + anticipa) * e; }
  const v = u - dura;                                                                 // resorte: 1+exceso → 1
  return 1 + exceso * Math.exp(-amortigua * v) * Math.cos(2 * Math.PI * frecuencia * v);
}
// velocidad de la curva (derivada numérica centrada) normalizada a −1..1 aprox.: alimenta la inercia
const velocidad = (tau, op) => (curvaPose(tau + 0.02, op) - curvaPose(tau - 0.02, op)) / 0.04;

// ruido suave determinista (suma de senos con fases de semilla): para el sostén vivo
function ruido(t, semilla = 1) {
  const f = [0.21, 0.37, 0.59], p = [semilla * 1.7, semilla * 2.9, semilla * 4.1];
  return (Math.sin(t * f[0] * 2 * Math.PI + p[0]) * 0.5 + Math.sin(t * f[1] * 2 * Math.PI + p[1]) * 0.33 + Math.sin(t * f[2] * 2 * Math.PI + p[2]) * 0.17);
}

// claves: [[t, est], …] (cualquier orden). Cada clave cambia lo que trae; lo demás se hereda de las anteriores.
// opciones: base (ficha del personaje), curva (opciones de curvaPose), acento (fuerza 0–1 del marcado), sosten (amplitud
// del balanceo en rad; 0 lo quita), semilla, habla (función t → 0–1 de crearHabla)
export function crearActuacion(claves, { base = {}, curva = {}, acento = 1, sosten = 0.018, semilla = 1, habla = null } = {}) {
  const K = [...claves].sort((a, b) => a[0] - b[0]);
  // estado acumulado en cada clave (herencia)
  const acum = []; let prev = { ...base };
  for (const [t, e] of K) { prev = { ...prev, ...e }; acum.push([t, prev]); }
  const dur = (curva.tAnt ?? 0.1) + (curva.dura ?? 0.26) + 0.5;   // tras esto la transición ya asentó
  return function est(t) {
    let i = -1; while (i + 1 < acum.length && acum[i + 1][0] <= t) i++;
    if (i < 0) return { ...(acum[0]?.[1] || base), inclina: sosten * ruido(t, semilla), habla: habla ? habla(t) : 0 };
    const [ti, ei] = acum[i], tau = t - ti, anterior = i > 0 ? acum[i - 1][1] : ei;
    const out = { ...ei };
    const cambiaPose = (anterior.pose || 'reposo') !== (ei.pose || 'reposo');
    if (cambiaPose && tau < dur) {
      out.pose = anterior.pose || 'reposo'; out.poseB = ei.pose || 'reposo'; out.mezcla = +curvaPose(tau, curva).toFixed(4);
      // la cara cambia en la anticipación (los ojos van antes que las manos)
      out.cara = tau < (curva.tAnt ?? 0.1) * 0.5 ? (anterior.cara ?? ei.cara) : ei.cara;
    }
    // acento en cualquier clave que cambie pose o cara: golpe que decae
    const cambia = cambiaPose || (anterior.cara !== ei.cara);
    out.acento = cambia && i > 0 ? +(acento * Math.exp(-tau / 0.12) * k01(tau / 0.04)).toFixed(4) : 0;
    out.inercia = cambiaPose && i > 0 && tau < dur ? +Math.max(-1, Math.min(1, -velocidad(tau - 0.06, curva) / 6)).toFixed(4) : 0;
    // sostén vivo: crece al quedarse quieto (no se pelea con la transición)
    out.inclina = +(sosten * ruido(t, semilla) * suave(k01((tau - 0.3) / 0.8)) + (ei.inclina || 0)).toFixed(5);
    if (habla) out.habla = +habla(t).toFixed(3);
    return out;
  };
}

// Boca con la voz. envolvente: { fps, valores: [0–1, …] } de scripts/envolvente.py (o null para parloteo procedural).
// ventanas: [[t0, t1], …] en las que ESTE personaje habla (fuera, 0). dps: dibujos/s de la boca (12 = animación limitada).
// Con envolvente, la boca sigue la voz real; sin ella, abre y cierra a ~6 sílabas/s con variación determinista.
export function crearHabla(envolvente, { ventanas = null, dps = 12, umbral = 0.08, ganancia = 1.2, semilla = 3 } = {}) {
  const dentro = t => !ventanas || ventanas.some(([a, b]) => t >= a && t < b);
  return t => {
    if (!dentro(t)) return 0;
    const tq = Math.floor(t * dps + 1e-6) / dps;
    let v;
    if (envolvente && envolvente.valores?.length) {
      const i = Math.min(envolvente.valores.length - 1, Math.max(0, Math.round(tq * envolvente.fps)));
      v = envolvente.valores[i];
    } else {
      const s = Math.sin(tq * 2 * Math.PI * 3.1 + semilla) * 0.5 + Math.sin(tq * 2 * Math.PI * 5.3 + semilla * 2) * 0.5;
      v = 0.35 + 0.4 * s;
    }
    return v < umbral ? 0 : Math.min(1, (v - umbral) / (1 - umbral) * ganancia);
  };
}

// Arco de una mano entre dos posiciones (en lugar de la recta): el punto medio se abomba hacia fuera del cuerpo.
// a, b: [x, y]; k: progreso (puede salir de 0–1); cx: centro del cuerpo en x; curvatura: fracción de la distancia.
export function arco(a, b, k, cx, curvatura = 0.22) {
  const x = a[0] + (b[0] - a[0]) * k, y = a[1] + (b[1] - a[1]) * k;
  const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy);
  if (L < 1e-6) return [x, y];
  let nx = -dy / L, ny = dx / L;                                       // normal
  const medio = (a[0] + b[0]) / 2;
  if (Math.abs(nx) < 0.3) { if (ny < 0) { nx = -nx; ny = -ny; } }       // recorrido casi horizontal: péndulo hacia abajo
  else if ((medio - cx) * nx < 0) { nx = -nx; ny = -ny; }              // si no, hacia fuera del cuerpo
  const bulto = Math.sin(Math.PI * k01(k)) * L * curvatura;
  return [x + nx * bulto, y + ny * bulto];
}
