# Crítica independiente de un Short

El constructor puntúa su propio trabajo unos 2 puntos por encima (lecciones 15, 28 y 50 de make-short; lo confirmó el piloto de Hanói v1: crítica de 6,0 y 6,9 contra la autoevaluación). Por eso la revisión artística la hace **otro agente que no construyó los planos**, sobre artefactos terminados y con evidencia por tiempo.

## Cuándo
- Sobre la muestra autorizada (antes de pedir el completo) y sobre el primer completo.
- **Máximo 2 rondas** (regla del usuario). Si persisten defectos, se entrega con pendientes y se acuerda cómo seguir. Cuando las mejoras bajan a unas décimas por ronda, busca una palanca sistémica (resolución nativa, la voz, el guion), no más arreglos por plano.

## Qué recibe el crítico (y qué no)
- El video (MP4), el brief, el guion con tiempos, `review/planos.json`, hojas de contacto a 1 fps y del gancho a 6 fps, y las salidas de `qc_escena.mjs` (`review/qc/qc.json`), `pops.py` (`review/pops.json`: los saltos en `inesperados`, con su motivo si son transitorios; los `recurrentes`, con dónde se repiten; y en `avisos`, los cortes duros permitidos), `ritmo.py` y `verificar.py`.
- **Las sospechas del constructor**, como lista breve («el giro de 35 s se siente corto», «el subtítulo de 41 s cae sobre el oficial»).
- Las referencias del canal (hojas, métricas), no sus videos para imitar.
- **No recibe** la autoevaluación del constructor ni sus notas: lo ancla.

## Auditoría numérica primero (5 min, antes de opinar)
| Medida | Cómo | Rango de referencia |
|---|---|---|
| Palabras por segundo | `revisar_guion.py` | 2,9–3,8 |
| Gancho completo | primera línea | ≤ 4,5 s |
| Cambios de escena/min | `ritmo.py` y hojas | 14–20 (referencias), sin cuota |
| Tamaño de la cara del protagonista | `review/qc/qc.json` → `tamanos` (alto mínimo y máximo de cada protegido por plano, en % del alto; también en la consola de `qc_escena.mjs`) y la hoja. Mide la caja que publica la página: con `billboard.rect()` es el cuerpo entero, no la cara | ≥ 12 % del alto en los planos de emoción |
| Nitidez | varianza del laplaciano por plano (`lapvar`) | sin caída respecto al resto del video |
| Subtítulos | altura de mayúscula ≥ 3,5 % del alto; contorno visible | dentro de la zona segura |
| Beat visible en su palabra | fotograma de cada impacto frente a su palabra | ±0,25 s |
| Brecha con la referencia del nicho | `scripts/comparar.py ref.mp4 nuestro.mp4` (movimiento, cortes duros, negros, luces, saturación, golpes/s y fondo bajo la voz) | filas «FUERA» explicadas |

Una medida fuera de rango no es un defecto por sí sola: es una pregunta que el crítico responde mirando.

## Rúbrica (1–10, con evidencia)
| Criterio | 9–10 | 6–7 | ≤ 4 |
|---|---|---|---|
| **Calidad de animación** | Poses legibles con anticipación, exageración y asentamiento; intermedios donde hace falta; sin saltos | Correcta pero rígida en partes | Saltos, poses que no se leen, personajes deslizándose |
| **Dirección artística y composición** | Identidad propia, un foco por plano, color por actos que cuenta | Bonito pero genérico | Plano sin foco, texto sobre lo importante |
| **Coherencia visual** | Escala, paleta, luz y contorno constantes entre escenas | Cambios menores | Escenas que parecen de videos distintos |
| **Narrativa y retención** | Gancho ≤ 4,5 s con dato visual, escalada, giro ganado, bucle | Estructura correcta con tramos planos | Arranque lento o final que no resuelve |
| **Audio** | Voz clara en altavoz de móvil, música que estructura, acentos en el fotograma | Equilibrado sin intención | Voz tapada, picos, efectos fuera de sitio |
| **Fluidez, resolución y errores** | `verificar.py`, `pops.py`, `qc_escena.mjs` y `--determinismo` en OK; nada raro a velocidad normal | Avisos menores justificados | Fallos bloqueantes o artefactos visibles |
| **Tiempo y recursos** | Dentro de la mediana de la bitácora; reutiliza biblioteca y caché | Algo por encima, con causa conocida | Rehechos evitables o renders completos repetidos |

La nota global no supera en más de 1 punto a la peor. Un criterio sin evidencia observada se marca **pendiente**, no se puntúa.

## Formato de la devolución
```
P07 · 34,6–35,3 s · f1038–1059 · animación · El oficial se desliza sin pasos (pies fijos mientras avanza 0,6 m).
Evidencia: review/critica/r1_f1038-1059.jpg. Severidad: alta. Propuesta: ciclo de pasos a 12 dibujos/s o corte antes del avance.
```
Una línea por defecto: plano, tiempo, fotogramas, criterio, qué se ve, evidencia, severidad y propuesta. El constructor **confirma cada defecto a tamaño de entrega** antes de corregirlo y responde en `REVISION.md` (corregido, rechazado con motivo o pendiente).

## Encargo para el agente crítico (plantilla)
```text
Eres crítico audiovisual independiente; no construiste este video. Lee <skill>/references/critica.md.
Video: <ruta mp4>. Brief y guion: <rutas>. Planos: review/planos.json. Hojas: <rutas>. QC: review/qc/qc.json, review/pops.json,
salida de ritmo.py y verificar.py. Sospechas del constructor: <lista>. Referencias del canal: <ruta del análisis>.
1) Auditoría numérica (tabla de critica.md). 2) Rúbrica de 7 criterios con evidencia por tiempo/fotograma; marca pendiente
lo que no puedas observar (p. ej., escucha). 3) Los 5 defectos de mayor impacto en el formato de línea, con imágenes
recortadas en review/critica/. No edites archivos del proyecto fuera de review/critica/.
```
Archiva cada ronda (video y crítica) en `review/critica/ronda-N/`: sin el video de la ronda no se puede comprobar una mejora.
