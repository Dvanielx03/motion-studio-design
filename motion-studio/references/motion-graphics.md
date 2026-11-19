# Motion graphics con intención

Consulta esta guía para convertir el brief en decisiones visuales y revisar si la animación ayuda a entender el mensaje.

Cuando haya referencias de estilo o señales de una presentación de diapositivas, aplica también [direccion-movimiento.md](direccion-movimiento.md). Las imágenes fijas y el determinismo no permiten aprobar la calidad del movimiento.

## Qué caracteriza este lenguaje

Motion graphics es diseño gráfico en el tiempo: tipografía, formas, iconos, imágenes, interfaces o datos se animan para comunicar. Puede combinar 2D y 3D, sonido e imagen real; no exige personajes, partículas, una cámara 3D ni movimiento permanente.

Es especialmente útil para hacer visibles relaciones, cambios, comparaciones y procesos, y para presentar una marca o producto con un lenguaje coherente. La técnica elegida debe corresponder a lo que necesita ver el público.

| Necesidad | Recurso que puede servir | Comprobación |
| --- | --- | --- |
| Explicar un proceso | Diagrama que se construye por pasos. | Se distingue el orden y la causa de cada cambio. |
| Mostrar un producto digital | Interfaz relevante y foco sobre una tarea. | El espectador reconoce la acción y su resultado. |
| Comparar cantidades | Gráfico con unidades, escala y fuente. | Las proporciones y los datos son correctos. |
| Comunicar una frase | Tipografía cinética y pausas de lectura. | Las palabras importantes se entienden sin perseguirlas. |
| Presentar una identidad | Formas, composición y ritmo de marca. | Los recursos pertenecen al mismo lenguaje visual. |
| Explicar volumen o espacio | 3D cuando esa profundidad aporta información. | La cámara deja comprender el objeto o la relación. |

## Criterios prácticos de diseño

Estas son recomendaciones adaptadas para Motion Studio, no garantías de efectividad ni reglas universales:

- **Jerarquía:** un foco principal por momento; ordena entradas y evita que varios titulares, cifras y cámara compitan a la vez.
- **Movimiento con función:** antes de animar, escribe qué debe comprender el espectador. Haz que una transición conserve un objeto, una dirección o una relación cuando eso facilite seguir la historia.
- **Timing y spacing:** define duración, trayectoria y aceleración según el peso visual y el tono. Un rebote o una sacudida no sirve para cualquier marca. Mantén consistencia entre movimientos equivalentes.
- **Composición antes de efectos:** prueba que las escenas clave funcionen como imágenes fijas: contraste, tipografía, alineación y espacio para leer. El movimiento no arregla una composición ilegible.
- **Ritmo con pausas:** alterna acción y lectura. Valida textos a tamaño de entrega, incluyendo móvil si es el canal. Revisa durante cuánto tiempo el texto permanece estable, no solo cuánto dura la escena.
- **Audio con propósito:** sincroniza acentos relevantes; no hace falta sonorizar cada objeto. Si el video se consumirá en silencio, comprueba que el mensaje siga siendo comprensible.
- **Continuidad:** conecta escenas mediante transformaciones o relaciones gráficas que se entiendan. Repetir entradas de texto sobre fondos distintos no basta para explicar un proceso.
- **Fidelidad:** usa activos y pantallas del producto cuando existan. Marca las reconstrucciones y datos ilustrativos; una demostración visual no acredita resultados comerciales.

No traslades tiempos de microinteracciones de interfaces directamente a un video. Los principios de foco y continuidad pueden servir, pero la lectura, el sonido y la intención de cada pieza determinan su duración.

## Del storyboard a la coreografía gráfica

Usa la ficha de plano existente, sin otro cuestionario ni documento obligatorio. Describe qué relación cambia y qué elemento conecta con la siguiente composición. Separa el material mostrado (por ejemplo, siete obras de estilos distintos en un showreel) del sistema gráfico que lo organiza. No rediseñes las obras para uniformarlas.

| Decisión en la ficha | Ejemplo | Error que resolver antes de animar |
| --- | --- | --- |
| Estado inicial → transformación → resultado | Una celda conserva su imagen y se abre hasta ser el siguiente plano. | Pantallas completas que solo entran y salen. |
| Jerarquía temporal | Primero la obra, después la palabra; la etiqueta técnica queda subordinada. | Varias capas reclaman atención durante el mensaje principal. |
| Entrada → lectura → salida | Las letras se ensamblan, la frase queda completa y luego enlaza con otra forma. | Contar como lectura la aparición parcial o dejar que el texto derive hasta recortarse. |
| Enlace y dirección | La ventana de una imagen conserva posición y se convierte en máscara. | Repetir zoom, flash o barrido sin relación con la composición. |
| Acento audiovisual | Un evento compartido fija el fotograma del sello y el efecto. | Imagen y audio mantienen copias distintas de los mismos tiempos. |

Una pausa de lectura puede ser quieta mientras el material continúa. La variedad puede venir de escala, espacio, organización o transformación, sin una cuota de efectos. Anticipación, overshoot y squash dependen del peso y la identidad de la pieza.

## Tipografía, máscaras e integración

- Mide la frase completa con la fuente cargada. Protege su encuadre durante la lectura **después** de cámara, escala, giro y recorte. Una entrada intencional fuera de cuadro no equivale a recortar el mensaje asentado. El margen y el tiempo de lectura se eligen para la pieza, no son constantes universales.
- Para una línea, `kit/grafica.js` ofrece `crearTitularGrafico`: ajusta ancho, exige el tiempo de lectura solicitado y devuelve poses sin estado. El alto, los glifos con salientes, bordes y efectos posteriores requieren revisión; no dibuja, decide colores ni garantiza contraste. Para varias líneas, mide y compón cada una; no reduzcas texto ilimitadamente hasta hacerlo ilegible.
- Una máscara de video en las letras puede perder legibilidad aunque sus dimensiones sean correctas. Revisa fondos claros, oscuros y detallados; conserva una silueta legible mediante relleno, contorno o separación local según la dirección elegida. Oscurecer toda la obra no es la única solución.
- Decide cómo encuadrar el material: contener, recortar con foco o deformar deliberadamente. Verifica rostros, interfaces y textos quemados con el recorte final. Distingue resolución de entrega, resolución del recurso y cadencia: exportar a 60 fps no añade poses a un clip de 30 fps.
- Las etiquetas técnicas pueden mostrar proceso si el público lo necesita. No confundas un `seek(t)` o nombre de PNG deliberado con un fallo del render. Una firma o contacto aún sin resolver queda pendiente; no inventes la identidad para cerrar la entrega.

Después de cargar fuentes, `lib.js` y `kit/grafica.js`:

```js
const { texto, medir } = crearTexto(ctx);
const titular = crearTitularGrafico({
  texto: 'CADA HISTORIA', inicio: 1, fin: 4, ancho: W, y: H / 2,
  medir, fuente: px => `${px}px Titular`, margen: W * 0.08,
  tamanoMax: 220, tamanoMin: 72, entrada: 0.35, salida: 0.25, lecturaMin: 1,
});
// Dentro de seek(t), con el contexto restablecido. Valores del ejemplo, no estándar universal.
const p = titular.evaluar(t);
ctx.save(); ctx.globalAlpha = p.alfa;
texto(p.texto, p.fuente, '#F3F1EC', p.x, p.y);
ctx.restore();
```

## Revisión específica y comparación justa

1. Prueba un tramo con la dificultad real: frase completa, transformación máxima, enlace y sonido. Conserva recursos, intervalo, resolución, fps y perfil; deja el audio idéntico si solo corriges imagen. Usa una copia aislada y registra versión, huellas y alcance autorizado.
2. Ejecuta auditoría, determinismo y controles técnicos existentes. El helper rechaza geometría, tiempos o mediciones inválidas; **no detecta** colisiones con otras capas, contraste, mala dirección o pérdidas de foco. `ritmo.py` tampoco los certifica.
3. Inspecciona entrada, lectura, salida y ambos lados del enlace, también a tamaño de consumo. Registra recortes, oclusión, cambios de contraste, aparición incompleta y competencia entre elementos. El muestreo temporal localiza defectos; no demuestra toda la fluidez.
4. Reproduce y escucha la muestra cuando sea posible. Distingue sincronización técnica por eventos de sincronía percibida. No renormalices el fragmento para hacerlo más impactante: su LUFS puede diferir del programa completo. Si `verificar.py` aplica el objetivo del completo a una muestra dinámica, registra el fallo, compara con el mismo intervalo original y verifica el programa por separado; no declares que todo pasó. Lo no observado queda pendiente.

Puntúa de 1 a 10, con evidencia y la escala de `rubricas.md`: dirección de arte, composición, animación, tipografía cinética, transiciones, ritmo audiovisual, creatividad, calidad técnica e integración. Un 9–10 requiere resolver errores críticos y observar los aspectos temporales/sonoros aplicables en reproducción. No extrapoles la nota de la muestra al completo ni subas la nota por añadir movimiento.

Este flujo es específico de Motion Graphics. Si un principio merece incorporarse a otros estilos, propón ese cambio aparte con su evidencia; no modifiques sus reglas por esta guía.

Fundamento técnico: [TextMetrics](https://developer.mozilla.org/en-US/docs/Web/API/TextMetrics) y [composición Canvas](https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/globalCompositeOperation). Son APIs, no validaciones de calidad artística.

## Por qué se añadió preproducción

| Límite del flujo anterior | Decisión adoptada |
| --- | --- |
| Pasaba del tema al guion sin fijar público ni objetivo. | Brief breve con mensaje, evidencia y canal. |
| Pedía aprobar un guion sin concretar siempre el aspecto visual. | Storyboard con composición, foco y función de cada movimiento; después, pruebas de estilo autorizadas. |
| Trataba un cambio cada 2–4 segundos como regla rígida. | Ritmo ajustado a lectura y comprensión. |
| La hoja de contacto y las notas podían parecer prueba de calidad completa. | Separar observación visual, pruebas técnicas y revisión temporal/auditiva. |
| No distinguía claramente pruebas y exportación completa. | Dos autorizaciones con alcance y versión registrados. |

## Fuentes y alcance

Consultadas el 28 de octubre de 2026. La secuencia de autorizaciones, el brief y los límites de revisión son decisiones de esta skill basadas en las necesidades del usuario; las fuentes no validan su ejecución por un modelo.

- [Autodesk — Motion Graphics](https://www.autodesk.com/solutions/motion-graphics): definición, usos para comunicar información y recomendaciones de concepto, objetivo y coherencia. Su descripción distingue el valor de 2D y 3D según la necesidad del proyecto.
- [School of Motion — The 5-Step Blueprint Pro Motion Designers Use](https://schoolofmotion.com/blog/5-step-blueprint-motion-designers-use): caso práctico que prepara brief, concepto y diseño antes de animar, y trabaja el audio como parte del resultado.
- [Simon Rankin — The motion design development process](https://www.simonrankin.com/learn/2020/07/28/the-motion-design-development-process-thumbnails-storyboards-style-boards-and-animatics): funciones distintas del storyboard, las imágenes de estilo y el animatic para discutir narrativa, apariencia y tiempos.
- [Google — Material motion](https://m1.material.io/motion/material-motion.html): foco, relaciones, intención y coherencia del movimiento en interfaces. Aquí se adapta su criterio de claridad, no sus duraciones ni sus reglas de interacción como estándar audiovisual.
