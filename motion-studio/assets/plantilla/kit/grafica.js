'use strict';
// Motion graphics: titular de una línea con entrada, lectura estable y salida.
// Cargar después de las fuentes; pasar medir de crearTexto. No dibuja ni decide la estética.
function crearTitularGrafico({
  texto, inicio, fin, ancho, y, medir, fuente = px => `${px}px sans-serif`,
  margen = ancho * 0.08, tamanoMax = 240, tamanoMin = 12,
  entrada = 0.35, salida = 0.25, lecturaMin = 0, distancia = 72, direccion = 1,
}) {
  const valores = { inicio, fin, ancho, y, margen, tamanoMax, tamanoMin,
    entrada, salida, lecturaMin, distancia, direccion };
  for (const [nombre, valor] of Object.entries(valores)) {
    if (!Number.isFinite(valor)) throw new TypeError(`${nombre} debe ser finito`);
  }
  if (typeof texto !== 'string' || !texto.trim() || /[\r\n]/.test(texto))
    throw new TypeError('El titular debe contener una línea de texto');
  if (typeof medir !== 'function' || typeof fuente !== 'function')
    throw new TypeError('Se necesitan medir y fuente');
  if (ancho <= 0 || margen < 0 || margen * 2 >= ancho || tamanoMin <= 0 || tamanoMax < tamanoMin)
    throw new RangeError('Ancho, márgenes o tamaños inválidos');
  if (fin <= inicio || entrada < 0 || salida < 0 || lecturaMin < 0 || distancia < 0 || ![-1, 1].includes(direccion))
    throw new RangeError('Intervalo o movimiento inválido');
  const leerDesde = inicio + entrada, leerHasta = fin - salida;
  if (leerHasta < leerDesde || leerHasta - leerDesde + 1e-9 < lecturaMin)
    throw new RangeError('La entrada/salida no deja la lectura acordada');

  const disponible = ancho - 2 * margen;
  const medirEn = px => {
    const valor = medir(texto, fuente(px));
    if (!Number.isFinite(valor) || valor <= 0) throw new RangeError('Medición de texto inválida');
    return valor;
  };
  // Se calcula una vez, no en cada fotograma. La fuente debe estar cargada y crecer con px.
  let bajo = Math.ceil(tamanoMin), alto = Math.floor(tamanoMax), elegido = 0;
  while (bajo <= alto) {
    const medio = Math.floor((bajo + alto) / 2);
    if (medirEn(medio) <= disponible) { elegido = medio; bajo = medio + 1; }
    else alto = medio - 1;
  }
  if (!elegido) throw new RangeError('El texto no cabe al tamaño mínimo; dividir o recomponer');
  const anchoTexto = medirEn(elegido), font = fuente(elegido);
  const clamp01 = v => Math.min(1, Math.max(0, v));
  const suave = p => p * p * (3 - 2 * p);
  return Object.freeze({
    texto, fuente: font, tamano: elegido, anchoTexto,
    lectura: Object.freeze({ inicio: leerDesde, fin: leerHasta }),
    evaluar(t) {
      if (!Number.isFinite(t)) throw new TypeError('t debe ser finito');
      const dentro = t >= inicio && t < fin;
      const qi = entrada ? suave(clamp01((t - inicio) / entrada)) : (t >= inicio ? 1 : 0);
      const qo = salida ? suave(clamp01((t - leerHasta) / salida)) : (t >= fin ? 1 : 0);
      const fase = !dentro ? 'fuera' : t < leerDesde ? 'entrada' : t >= leerHasta ? 'salida' : 'lectura';
      const x = ancho / 2 + direccion * distancia * (1 - qi - qo);
      return { texto, fuente: font, tamano: elegido, x, y, alfa: dentro ? qi * (1 - qo) : 0,
        fase, izquierda: x - anchoTexto / 2, derecha: x + anchoTexto / 2 };
    },
  });
}
