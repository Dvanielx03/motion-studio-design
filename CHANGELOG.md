# Registro de mejoras

Las entradas describen cambios del repositorio, no versiones publicadas ni garantías de calidad audiovisual.

## Sin versión publicada — 2026-11-18

### Acabado 3D realista estilizado, vestuario de época y anclas por ocurrencia

- **Necesidad:** en los Shorts recientes de la referencia del nicho (Ricks Clips, 5 y 15 nov, vistos fotograma a fotograma), los escenarios tienen luz física (cielo, sombras suaves, oclusión ambiental, brillo y materiales con relieve). Nuestros pilotos usaban colores por bandas. El usuario eligió el acabado «3D realista estilizado» para «The Hotel That Rose With the Guests Inside» y aprobó la hoja de diseño v2 y la muestra.
- **`kit/realista.js` (nuevo):**
  - `crearMotorRealista`: PBR con ACES, GTAO, bloom y sombras suaves;
  - un **pase aparte para los personajes 2D**: después del tono y del AO, con la profundidad del escenario;
  - `cieloFisico` (Preetham + PMREM), `entornoInterior` y `luzSol` (ve la capa de los proyectores de sombra);
  - texturas procedurales sembradas con relieve y rugosidad (`texturaPBR`, `materialPBR`, `materialLiso`), con `especular` para suelos húmedos;
  - `prepararPersonaje` y `prepararManada` (tinte por escena), `nubes` y `pasto` instanciado.
- **Determinismo:**
  - el ruido de `GTAOPass` usaba `Math.random`: ahora va sembrado;
  - lo translúcido se oculta en el pase de profundidad (con `overrideMaterial` tapaba a los personajes);
  - `--determinismo`: 6 de 6 instantes idénticos.
  - **Coste medido:** 11 s por segundo de video (RTX 3050, ss 1,5, 3 trabajadores).
- **`kit/cuento.js`:**
  - sombreros: chistera, bombín y gorra;
  - vestuario: obrero con tirantes, vestido, delantal y banda;
  - levita con solapas, chaleco y pajarita.
  - **Compatibilidad:** sin los campos nuevos, todo se dibuja igual.
- **`kit/subtitulos.js`:** `colorEnfasis`. Con el preset `nicho` era imposible dar color a la palabra clave, porque `enfasis` era a la vez la lista de palabras y el color.
- **`kit/director.js`:** `t('@palabra', n)` acepta la ocurrencia y lanza un error si es inválida. Antes el 2.º argumento se ignoraba en silencio y un plano se ancló al segundo 10 en vez del 43.
  - **Prueba:** `director-actuacion.test.mjs`, 77 comprobaciones.
- **`kit/escena3d.js` → `camaraContinua`:** rechaza claves desordenadas o repetidas. Un ancla que casaba por prefijo («lift» → «lifted») dejó una clave 6 s antes que sus vecinas y la cámara saltó sin aviso.
- **`_diag.mjs` en la plantilla:** evalúa una expresión en la página con la GPU del render. Encontró en 2 llamadas el fallo del pase de profundidad.
- **Guías:**
  - `produccion-25d.md`: § «Acabado realista estilizado»;
  - `25d.md`: tabla del kit;
  - `leccionero.md`: lecciones 40–47;
  - `SKILL.md`: una línea.
- **Sin cambiar:** el contrato `seek(t)`, `crearMotor` y el look por bandas (siguen disponibles), las autorizaciones y el render.

### Fluidez: guion y storyboard anclados a la voz, cámara con intención y actuación con principios de animación

- **Necesidad:** el usuario pidió que las animaciones tengan más fluidez y un movimiento de cámara creativo, integrados con el guion, el storyboard y las etapas de producción. Medido en el gancho del completo v1 del piloto US (0–6,6 s):
  - la cámara estaba casi quieta en 108 de 198 fotogramas;
  - las poses cambiaban en 4 dibujos en línea recta;
  - la boca no hablaba;
  - el gesto de señalar tapaba la cara.

  Ningún control lo marcaba.
- **`kit/director.js` (nuevo):**
  - tiempos anclados a palabras de la voz (`D.t('@palabra#n±s')`, `D.resolver` para un storyboard en datos);
  - movimientos `mov.empuje`, `orbita`, `grua`, `seguir` (con retardo y aire delante), `revelar`, `vertigo`, `fijo` y `hacia`, que devuelven claves para `camaraContinua`;
  - `encadenar`, que rechaza juntas en las que la cámara no coincide;
  - `revisarTomas` (ventanas sin cambio de ángulo o escala), `velocidadCamara` (°/fotograma) y `acumularMovimiento` (desenfoque de movimiento determinista).
  - **Justificación:** el movimiento de cámara tiene que tener un motivo (palabra, gesto u objeto) y sobrevivir a una voz regrabada.
- **`kit/actuacion.js` (nuevo):**
  - `crearActuacion` (claves con herencia, anticipación, exceso con resorte, acento, inercia y sostén vivo);
  - `curvaPose`;
  - `crearHabla` (boca con la envolvente de la voz o parloteo);
  - `arco` (la mano viaja en arco).
- **`kit/cuento.js`:**
  - `mezcla` admite −0,4..1,4 (antes se recortaba a 0–1);
  - las manos viajan en arco (`arco: 0` vuelve a la recta);
  - campos nuevos `acento`, `inercia`, `inclina` y `habla`.
  - **Compatibilidad:** sin los campos nuevos, todo se dibuja como antes, salvo el arco de las manos durante una transición `poseB`/`mezcla`, que ahora se abomba (`arco: 0` lo deja como antes).
- **`scripts/envolvente.py` (nuevo):** la envolvente de la voz por fotograma para la boca. El suelo va en el percentil 35 y la caída en 25 ms: con p10 y 80 ms la boca quedaba abierta el 80 % del tiempo.
- **`scripts/comparar.py`:** añade fotogramas congelados, tirones por minuto y aspereza del movimiento a 30 fps. Medido:

  | Video | Tirones/min | Aspereza |
  |---|---|---|
  | Referencia | 45 | 0,07 |
  | Concreto v1 | 44 | 0,07 |
  | Torre v2 | 100 | 0,15 |
- **Guías:**
  - `produccion-25d.md`: § «Fluidez», que dice qué cambia en guion, storyboard, animatic, producción y QC, con la tabla medida;
  - `preproduccion.md`: ficha de movimiento 2.5D (campos Movimiento y Actuación por palabra);
  - `25d.md`: tabla del kit;
  - `leccionero.md`: lecciones 34–39;
  - `SKILL.md`: una línea.
- **Pruebas:** `tests/animacion/director-actuacion.test.mjs` con 75 comprobaciones. Las de encuadre-zona, kit-tecnicas, secuencia-cache y produccion_test siguen pasando.
- **Demostración** (en una copia del proyecto del piloto, sin tocar el completo aprobado): el gancho rehecho con el director y la actuación.

  | Medida | v1 | Demo |
  |---|---|---|
  | Cámara casi quieta | 55 % de los fotogramas | 4 % |
  | Aspereza | 0,26 | 0,10 |

  El QC no da FALLA y el render va a 8,3 s por segundo de video. Pendiente: en el paneo, la cabeza de quien señala pasa cortada en primer término.
- **Sin cambiar:** las autorizaciones, el contrato `seek(t)` y el comportamiento de `camaraContinua`, `camaraClaves` y de los subtítulos.

### Nivel de referencia del nicho: de un análisis comparativo a herramientas de la skill

- **Necesidad:** el piloto 2.5D «Te vendieron la Torre Eiffel» (completo v2) pasó todos los controles técnicos, pero una crítica independiente le dio 6,0. Se comparó con la referencia de estilo «The Ancient Jar That Warned an Empire» (Ricks Clips; 35 M de vistas según vidIQ el 18 nov). Lo medido (FFmpeg `signalstats`, `ebur128`, faster-whisper) y lo observado se separaron en un análisis por secuencias y marcas de tiempo, fuera de este repositorio: `biblioteca/referencias/ancient-jar/comparacion/` del proyecto de contenidos.
- **`scripts/comparar.py` (nuevo):** mide dos videos con las mismas medidas y da la diferencia y el estado frente a la referencia: movimiento, cortes duros, negros, luces, saturación media y de picos, sonoridad, golpes por segundo y, con las palabras de la voz, el fondo bajo la voz. **Justificación:** en esta skill una mejora se demuestra midiendo (lección 24), y faltaba la herramienta que lo hiciera contra una referencia. Probado con los dos videos: marca FUERA el movimiento (9,6 frente a 13,7), los cortes duros (13,7/min frente a 3,7), los negros (47 frente a 58), las luces (181 frente a 163), los picos de saturación (42,5 frente a 33,9) y el fondo (11,9 frente a 9,2 dB).
- **`kit/escena3d.js`:**
  - `camaraContinua`: Hermite con tangentes en el tiempo; `camaraClaves` se paraba en cada clave intermedia (lección 29). Probada en el completo de la Torre.
  - `gradoFinal`: gradación determinista de negros, luces y picos de saturación.
  - `crearCielo`: degradado, sol, halo y haces.
  - **Justificación:** son las tres brechas medidas de movimiento, color y atmósfera. Las funciones existentes no cambian.
- **`kit/cuento.js` (nuevo):** personajes de cuento con vestuario, 13 caras, 13 poses con transición, sombreros y símbolos de expresión. **Justificación:** la crítica marcó la actuación pobre (5/10), y la referencia actúa con el cuerpo y con símbolos (lágrimas de risa, sudor, «Z»). Antes cada proyecto dibujaba sus personajes desde cero. Diseño propio, sin copiar identidades.
- **`kit/subtitulos.js` (nuevo):** el módulo de subtítulos del piloto, generalizado con los presets `'nicho'` (1–2 palabras, minúsculas, 3,6 % del alto, medido en la referencia) y `'grande'` (Hanói y Torre), en español o inglés. Cada golpe termina en el corte siguiente.
- **`qc_escena.mjs`:** `imprescindible: true` convierte en FALLA el objeto de la acción fuera de cuadro. **Justificación:** el pago del completo v1 de la Torre no se veía y el QC solo avisó (lección 28). Los protegidos sin esa marca se comportan igual que antes.
- **Guías:**
  - `produccion-25d.md`: sección «Nivel de referencia del nicho», con los rangos medidos y qué cambia en cada etapa, y la comparación medida como paso 5 del QC;
  - `25d.md`: tabla del kit;
  - `leccionero.md`: lecciones 27–31;
  - `critica.md`: brecha con la referencia en la auditoría numérica;
  - `SKILL.md`: una línea en el modo 2.5D.
- **Narración (piloto de EE. UU., 18 nov):**
  - en `produccion-25d.md` §8, el método que el usuario aprobó tras rechazar siete voces que solo leían: voz de biblioteca de *storytelling*, v3 creativo, etiquetas de actuación por frase, 2 tomas por línea y escucha mezclada;
  - lecciones 32 (narración) y 33: la regla `imprescindible` detectó la grieta fuera de cuadro en la muestra.
- **Sin cambiar:** las autorizaciones (guion, voz, muestra, completo, publicación), la regla del usuario sobre el nivel de la música (el valor medido se le propone; no se aplica) y el comportamiento de todas las funciones existentes.

## Sin versión publicada — 2026-11-17

### Producción 2.5D en el navegador: del piloto de Hanói a un flujo de la skill

- **Necesidad:** el piloto «La recompensa que llenó Hanói de ratas» produjo Shorts 2.5D con escenarios Three.js y personajes 2D, pero el método vivía dentro del proyecto. La v1 tuvo una crítica independiente de 6,0 y 6,9, iba a 2,3 palabras/s, tenía 32 cortes duros en 81 s y subtítulos sobre los personajes; en la muestra de la v2, un salto de un dibujo (f14 → f15) no se vio en las hojas.
- **Investigación** (`docs/analysis/2026-11-17-*.md`):
  - **Ricks Clips:** 31 Shorts 2.5D con mediana de 8,9 M de vistas. Las métricas de forma (palabras/s, cambios de escena, sonoridad, duración) son casi iguales entre los más vistos y el control; lo que los separa en lo observable es la premisa y el gancho. Hablan a ~3,7 palabras/s y casi no tienen cortes duros (0–2 por video): enlazan con cámara y fundidos. Lo de retención son hipótesis: no hay Analytics de ese canal.
  - **Tutorial de Blender / make-short:** no es 2.5D de recortes, sino 3D real con sombreado de dibujo animado. Medido en la RTX 3050: ~1,16 s por fotograma nativo frente a ~0,4 s de la ruta del navegador en paralelo. Se adoptan rampa de color, bloom ligero, bruma y luz por acto; no se adoptan Kuwahara ni la tinta Sobel (costo o determinismo).
  - **Auditoría de make-short** (commit `5a17d35`, MIT): su validador de planos no detiene el proceso y su ejemplo no lo cumple; `qa-pops.mjs` aporta una revisión que no teníamos; de sus lecciones se toman el crítico con las sospechas del constructor, la auditoría numérica al inicio y el archivo de cada ronda.
- **Motor:** `kit/escena3d.js` y la capa `assets/plantilla-25d/` (`nuevo.py --25d`): supermuestreo 2× sin MSAA, doble render y precalentamiento por determinismo; bandas con contorno, rampa de color y brillo; billboards con sombra hacia el sol; manadas instanciadas; cámara 3D por claves; cajas en pantalla para el QC; exportación del decorado a `.glb` con anclas y apertura en Blender (`exportar_glb.mjs`, `scripts/abrir_en_blender.py`). `preparar.py` instala y comprueba Three.js 0.170.0 en las herramientas compartidas. Medido con el ejemplo: `--determinismo` idéntico en 5 instantes y 6 s de 1080×1920 a 30 fps en ~49 s.
- **Render:** `--vista` (animatic del video entero con NVENC; 66,6 s de video en 58 s), `--prueba` en paralelo (11 s por segundo de video, antes 40 con un navegador) y anotación de cada vista, prueba, borrador y final en `review/bitacora.jsonl` y en la bitácora global, con `scripts/bitacora.py` para los tiempos por etapa.
- **Caché por plano:** `motion.config.json` → `dependencias` y `window.__info.planos`; editar un escenario solo rehace los segmentos de 5 s donde aparece y lo no declarado sigue siendo común.
- **QC automático:** `pops.py` (saltos no planificados; idea de `qa-pops.mjs`, implementación propia), `qc_escena.mjs` (zona segura, texto sobre personajes, foco fuera de cuadro y lectura, sin renderizar) y `revisar_guion.py` (guion con la voz medida).
- **Crítica y pipeline:** `references/critica.md` (crítico que no construyó los planos, auditoría numérica, rúbrica de 7 criterios, máximo 2 rondas), `references/produccion-25d.md` (10 etapas, qué va en serie y qué en paralelo) y `references/leccionero.md` (lecciones comprobadas, con la regla o herramienta que evita cada una).

### Revisión adversarial en tres rondas

- **Ronda 1:** agentes revisores confirmaron 40 defectos en herramientas que ya habían pasado sus pruebas, y se corrigieron por grupos de archivos. Entre ellos:
  - la caché dejaba fuera todo archivo `_*` (una `escena/_paleta.js` editada reutilizaba la paleta vieja); ahora solo los `_*.mjs` / `_*.cjs` de la raíz;
  - un id de `dependencias` con otra mayúscula nunca invalidaba nada; ahora avisa y sus archivos cuentan como comunes;
  - `-shortest` perdía fotogramas con una mezcla más corta (348 → 288); `unir()` rellena o recorta el audio y cuenta los fotogramas;
  - `motion.config.json` invalidaba la caché por claves de herramientas (`workers`, `vista`, `qc`…); ahora entra como configuración, con la GPU efectiva;
  - la caché ignoraba la transición de salida de cada plano (contrato `[id, inicio, fin, salidaDur]`);
  - `pops.py` cargaba el video entero en memoria (pico de 444,2 MiB frente a 2,3 MiB ahora en un 1080×1920 de 10 s), no veía saltos de 2–3 fotogramas ni los de junto a un corte, y no resolvía los impactos anclados a palabra ni los fps de la vista;
  - la rampa de color no teñía (solo se leía `.r`), el umbral de `brillo()` no cortaba en su valor, el contorno dependía de la escala, `mirarCamara` fallaba con mallas desplazadas, la sombra real de las manadas era el atlas entero y `exportarGLB` exportaba manadas inválidas;
  - un 404 de three dejaba a `render.mjs`, `qc_escena.mjs` y `exportar_glb.mjs` esperando 120 s; ahora fallan al momento (0,93 s en la prueba con `qc_escena.mjs`);
  - `exportar_glb --blender` pisaba un `.blend` retocado; ahora necesita `--forzar`;
  - `bitacora.py` contaba dos veces el render y separaba un mismo video en dos proyectos; `revisar_guion.py` no decía qué archivos necesitaba y rompía con tiempos nulos.
- **Ronda 2:** limpieza de parciales en `--prueba` y `--vista`; el navegador se cierra si falla la carga de una página; dependencias con `/` inicial normalizadas y con otras mayúsculas rechazadas con la ruta correcta; una sola regla de duración en `transiciones.js` (`tr.duracion`: sin `dur`, 0,4 s también en `montaje()`); `auditar.mjs` audita todos los `_*` salvo los diagnósticos de la raíz; `motor.dibujar` ya no deja estado en la cámara; `rectPantalla` mide con la proporción del cuadro y devuelve `fuera`, que `qc_escena.mjs` cuenta; parche contra el acné de sombra (sustituido en la ronda 3); la plantilla 2.5D añade `actualizar(t, camara)` y `reposo` por entorno y exporta en reposo; `pops.py` separa los transitorios recurrentes y los avisos, y admite `--zona-ignorada`.
- **Ronda 3:**
  - **Acné de sombra, arreglo coherente:** en una malla que recibe sombras, toda cara de espaldas a una luz con sombra queda en sombra (factor `1 − shadow.intensity`, sin consultar el mapa); las que miran a la luz usan el mapa normal. Desaparecen el acné y la luz invertida del parche de la ronda 2, que aclaraba esas caras aunque estuvieran dentro de la sombra de otro volumen.
  - `rectPantalla` ya no copia la cámara entera (`Object3D.copy`): solo sus parámetros de proyección, sin tocar `userData` ni la cámara real.
  - `plantilla-25d/composicion.js` publica `salidaDur` con `tr.duracion(p.salida)`, la regla de `tr.montaje` (con un kit antiguo sin `tr.duracion`, `salida.dur` o 0).
  - `pops.py`: la recurrencia es local (al menos otras 2 repeticiones con la misma firma a ±5 s y en el mismo plano; `--ventana-recurrencia`), un transitorio de 1 fotograma nunca es recurrente y desaparece la clase AVISO del plano corto: lo que no es recurrente es SALTO, con su motivo. En `review/pops.json`, `avisos` son ahora los cortes duros permitidos.
  - `render.mjs`: si la salida está abierta en un reproductor, el resultado se conserva como `<salida>.conservado-<pid>.mp4`, que la poda no borra; `--prueba` también cuenta los fotogramas; la clave `skill` de `motion.config.json` ya no invalida la caché.
  - `cache.mjs`: una dependencia vacía o que nombra la raíz, una fuera del proyecto y una carpeta con `/` final que no existe dan error con el plano y la ruta.
  - `qc_escena.mjs` sale con código 2 y dice qué falta si `motion.config.json` no trae `video.ancho`, `alto` o `duracion`, y cuenta el aviso de planos mal formados; `revisar_guion.py` trata cualquier forma inesperada de `voz.palabras.json` (null, un número, segmentos sin palabras) como «sin palabras», sin trazas; `preparar.py` fija con `--save-exact` un three 0.170.0 que `package.json` pedía con rango (`^0.170.0`), sin contarlo como falta.
- **Cambios que se ven en la imagen:** el brillo tiene menos halo con el umbral por defecto. La rampa de color tiñe de verdad, pero en las mallas que reciben sombras (todo `caja()` y el suelo de la plantilla) solo se ven sus paradas claras: la sombra la pone el relleno de cielo y las violetas de `RAMPAS.calida` ya no aparecen en el decorado. Las caras de espaldas al sol pasan de una mezcla rayada a un tono liso, el de la sombra arrojada: el muro del ejemplo con la rampa cálida, a t = 4,5, mide (61,64,51) con acné, (90,85,70) con el parche de la ronda 2 y (46,54,42) ahora. Un `tipo` de transición mal escrito, que antes hacía un corte en silencio, ahora lanza «transición desconocida».
- **Validación:** pruebas sintéticas por grupo (caché 26/26, render 25/25 y configuración 14/14 en la ronda 1; 21 videos sintéticos de FFmpeg para `pops.py`), FFmpeg real para la unión con mezclas más cortas y más largas, Chrome con la RTX 3050 para el motor (sombra de manada 0,92 frente a 0,22; esfera en un rectángulo 400×200 con proporción 1,0 frente a 2,0) y `--determinismo` idéntico en 3 instantes de la prueba 2.5D tras la ronda 1. En la ronda 3: render en Chrome de la prueba 2.5D con el kit del repositorio (muro de espaldas al sol liso, esfera dentro de la sombra de un edificio oscura entera, sombras de contacto sin cambios); `pops.py` contrastado con la versión de la ronda 2 sobre 75 videos sintéticos de FFmpeg y la muestra y el completo de Hanói v2; `cache.mjs` en un proyecto de prueba (`/`, carpeta inexistente, `../otra/`, cambio de `salida.carpeta` y de `dependencias`). Documentación alineada con el código: `SKILL.md`, `kit.md` (regla única de duración de las transiciones), `requisitos.md`, `25d.md`, `produccion-25d.md`, `rubricas.md`, `critica.md` y `leccionero.md` (lecciones 24–27 nuevas y 13 matizada).
- **Límites:**
  - Tras el parche de sombra de la ronda 3 no se corrió `--determinismo`, ni se cargaron en Chrome la plantilla 2.5D ni la página de Hanói tras el cambio de `salidaDur` (se probó con el `transiciones.js` real de cada kit).
  - **Decisión pendiente:** con el arreglo del acné, las paradas violetas de `RAMPAS.calida` no se ven en el decorado. Se recuperan en una malla con `receiveShadow = false` (pierde la sombra arrojada); teñir de violeta la sombra arrojada exigiría otro cambio en el shader, que no está hecho.
  - `pops.py`: un salto que cae entre el inicio y la vuelta de un transitorio recurrente queda cubierto y sale como recurrente con código 0, aunque sea de otro bloque, dure 1 fotograma o no vuelva. Sin corregir.
  - `pops.py`: un parpadeo que no reúne 2 repeticiones a ±5 s en su plano (el único, los de planos de menos de ~4 s, el primero y el último de una serie espaciada) y los parpadeos de la vista a 15 fps salen como SALTO: hay que mirarlos y pasarlos con `--permitir`. Al revés, un dibujo equivocado con la firma de un parpadeo de su plano sale como recurrente (sin `review/planos.json`, también entre escenas).
  - Cambiar `salida.carpeta` cuando la anterior no se llama `exportaciones` rehace todos los segmentos: esa carpeta pasa a contar en la huella.
  - Las transiciones no se han revisado en Chrome tras la regla única de duración: se comprobaron con dobles de canvas.
  - La primera exportación con la plantilla nueva rehace todos los segmentos una vez. Los proyectos ya creados (Hanói v2, Torre Eiffel) llevan copias propias de `render.mjs`, `cache.mjs`, `auditar.mjs`, `pops.py` y del kit, y no reciben los arreglos hasta que se copien; el kit de Hanói v2 sigue sin el parche de sombra y sin `tr.duracion`.
  - Las conclusiones sobre retención son hipótesis; ningún cambio acredita calidad artística.

## Sin versión publicada — 2026-11-06

### Catálogo de capacidades y estado de validación

- **Necesidad:** el README distribuía las funciones entre varias secciones y no ofrecía una vista conjunta del flujo actual después de integrar 2.5D y delegación.
- **Cambio:** catálogo enlazado de preproducción, animación, kit, 2.5D, audio, edición, subagentes, render y revisión; inventario ampliado de herramientas y contrato. Se distinguen capacidades disponibles, pruebas realizadas y límites pendientes.
- **Validación:** contraste con la skill, referencias, herramientas y reportes existentes; comprobación de enlaces locales y `git diff --check`. No se ejecutaron nuevas pruebas audiovisuales para este cambio de documentación.
- **Límites:** sin cambios de código o autorizaciones; la prueba de delegación acredita planificación, sin afirmar aceleración de producción ni bloqueo automático de archivos.

### Delegación nativa de Claude Code dentro de Motion Studio

- **Problema:** el flujo no definía cómo repartir construcción y correcciones entre subagentes mientras avanzan los renders, ni protegía sus fuentes frente a ediciones concurrentes.
- **Cambio:** `references/paralelo.md` dirige al coordinador y subagentes en segundo plano, con contexto explícito, un escritor por archivo, dependencias e interfaces acordadas, entregas verificadas y crítica independiente. El coordinador centraliza la GPU y fija las fuentes de cada render; el equipo avanza en trabajo que no las altere. Equipo proporcional, sin modelos impuestos ni activación automática de funciones experimentales.
- **Uso:** enlace desde `SKILL.md` y `25d.md`, ficha adaptable `assets/paralelo/CONTRATO.md` y prompt breve en guía/README. Se conservan modos, motores, autorizaciones y controles existentes.
- **Validación:** Claude Code 2.1.316 ejecutó una prueba de planificación de solo lectura con dos subagentes nativos en segundo plano (contrato/reparto y dependencias/render). Devolvió sus entregas y un plan que bloquea la producción sin aprobación, conserva la voz pendiente y fija las fuentes activas. Se comprobó además estructura de skill y enlaces. Evidencia local: `review/prueba-paralelo/`.
- **Límites:** se comprobó delegación y planificación, sin renders ni edición concurrente de un video. La guía no bloquea escrituras por software; el coordinador debe asegurar fuentes fijas o una copia aislada. El ahorro frente a producción secuencial sigue sin medirse.

### Producción 2.5D con referencias, voz medida y recursos reanudables

- **Problema:** faltaba un recorrido reutilizable para medir referencias, coordinar acción/voz/efectos y componer recursos 3D sin reescribir esas operaciones por proyecto. La caché de exportación podía reutilizar imagen de fuentes anteriores.
- **Integración:** `references/25d.md`, `scripts/referencia.py`, `produccion.py`, `kit/sincro.js` y `kit/secuencia.js`; procedencia/huellas/hojas, tiempos reales por palabra, validación de planos e impactos, SRT y lectura de PNG por tiempo con ImageBitmap acotados. Blender sigue siendo un generador opcional de recursos; el exportador es `render.mjs`.
- **Recursos:** `recursos25d.py` exige GPU real, valida PNG, conserva el alcance al regenerar `--solo`, separa informes de los manifiestos estables y compara repeticiones mediante Pillow. Se eliminan fecha/coste variables de los metadatos PNG. El ejemplo original de seis segundos demuestra el recorrido sin imponer personajes o estilo a otros proyectos.
- **Render/audio:** huella de fuentes/configuración/página/perfil para reanudación; la mezcla se vuelve a unir sin rehacer imagen. Manejo de salida temprana/error de FFmpeg durante el envío. `musica.py --sincro` coloca efectos por fotograma y normaliza a −14 LUFS con margen de pico; el modo musical clásico se conserva.
- **Pruebas reales:** tres referencias conseguidas y medidas; Claude «2D CANAL» generó 180 PNG nativos de Blender. Se exportaron dos muestras de 6 s/180 f en 1080×1920/30, H.264/yuv420p/BT.709, −14,1 LUFS y −1,3 dBTP. El ejemplo integrado generó 72 dibujos a 12/s y repitió tres instantes sin diferencias. Cuatro instantes por reproductor idénticos en repetición y orden inverso. Reanudación de imagen: 2/2 segmentos reutilizados en 3,43 s totales.
- **Regresiones:** seis casos de plan/voz y tres pruebas JS nuevas; exportación real con invalidación/reutilización y encoder inválido; adaptador real con rango parcial, metadatos estables y rechazo de GPU/tamaño. Encuadre, kit y carta SDR de muestra/borrador/final pasan; sintaxis, auditoría y validador correctos. Copia de Claude actualizada con respaldo y 52 archivos comprobados por contenido.
- **Límites:** pruebas cortas, sin escucha subjetiva ni reproducción continua perceptiva; no se acredita el nivel artístico de las referencias ni producción larga. El generador upstream conserva defectos observados y no pasó una prueba de orden inverso. ASR requiere revisión; SRT no se incrusta automáticamente; no se usaron voz de pago ni publicación. Se mantienen capacidades, estructura y autorizaciones existentes.
- [Investigación, pruebas, rutas y pendientes](docs/analysis/2026-11-06-make-short-integrado.md).

## Sin versión publicada — 2026-11-05

### Revisión de DANZO: lectura del gag, cadencia y salida SDR

- **Problema observado:** en una comedia 2.5D por capas, el acercamiento de cámara coincidía con el crecimiento del pelo y recortaba la reacción. El montaje entregaba 24 fps a partir de 12 dibujos/s y saltaba la ruta de exportación de la skill. Faltaban etiquetas de color; la conversión del renderizador también era implícita.
- **Dirección:** `estilos.md` y la guía de movimiento protegen el cambio principal con cámara, poses extremas, recorte y grafismo revisados juntos. Distinguen cadencia de dibujos de fps de entrega y generador de recursos de reproductor. Se conservan el motor, las autorizaciones, los personajes y las técnicas pendientes de otros trabajos.
- **Render:** muestra, borrador y final fijan matriz YUV BT.709, rango limitado y propiedades/etiquetas SDR. La caché de segmentos lleva el sufijo `-bt709-tv`; los segmentos anteriores se conservan sin reutilizarlos como si tuvieran la conversión nueva. No se añade gestión HDR/ICC.
- **Prueba real:** muestra aislada de C07–C09, 2,75 s/66 fotogramas, 720p24 y RTX 3050. Solo se regenera el plano crítico con cámara estable y rótulo despejado; los adyacentes reutilizan sus capas. La cabeza permanece dentro del margen del 5 % en los 10 dibujos de C08 y la reacción resulta más legible en las imágenes. La mezcla se conserva; correlación interior de audio 0,999994.
- **Validación:** `tests/animacion/color_sdr.py` exporta una carta real por los tres modos y comprueba matriz/rango, etiquetas, RGB y fotogramas (error máximo observado 1/255). El reproductor pasa cuatro instantes deterministas. Sintaxis, auditoría (11 archivos sin errores/avisos), validador y regresiones de encuadre/kit correctos.
- **Límites:** las poses del generador corregido coinciden al repetir tres instantes en orden inverso, pero una imagen conserva 3 píxeles con diferencia de un nivel; no se declara exactitud total de Blender. Claridad local 5 → 8/10 provisional, sin acreditar 9/10 global, fluidez o calidad sonora artística. Faltan escucha, carrera y contacto pelo/lámpara; no hay benchmark de rendimiento ni exportación completa. Los 53 scripts de origen conservan sus huellas.
- [Análisis por estilo, comparación y límites](docs/analysis/2026-11-05-danzo-review.md).

## Sin versión publicada — 2026-11-04

### Técnicas de imagen de un corto de referencia (fase 1)

- **Problema observado:** al estudiar un corto animado de referencia, se vio que su acabado cinematográfico depende de recursos que el kit no ofrecía:
  - profundidad de campo;
  - plano sobre el hombro;
  - acercamientos casi imperceptibles;
  - transición de párpados;
  - escritura a mano sincronizada;
  - diálogo dentro de la escena;
  - citas línea a línea;
  - luz nocturna;
  - lluvia y hojas;
  - guion de color medido.

  Cada proyecto los reescribía a mano o no los usaba.
- **Cambio:**
  - **Módulos nuevos del kit:**
    - `profundidad.js`: capas por distancia con desenfoque relativo al foco, niebla, `bokeh()` y `bokehSembrado()`;
    - `luz.js`: `halo`, `haz`, `charco`, `nieblaHorizonte`, `vineta` y `tramado`;
    - `particulas.js`: `lluvia` con luz por zona, `salpicaduras`, `hojas` y `polvo`;
    - `escritura.js`: `crearTrazado`, `escribir` con la punta, marcas a mano y `crearEscritura().revelar()`;
    - `textos.js`: `bocadillo`, `cita` y `lecturaMinima`.
  - **En `camara.js`:** `encuadreHombro()`, `respira()` y `proyectar()`.
  - **En `transiciones.js`:** el tipo `parpados` y `aceleracion()` para montajes que se aceleran.
  - **En `lib.js`:** `colorAlfa()`, y `crearTexto` acepta `op.ctx` para dibujar en el lienzo de un plano.
  - **En `ritmo.py`:** mide saturación y luminancia por tramo y avisa, sin fallar, si se declara `curva.color`.
  - **Plantilla:** `index.html` carga los módulos y `kit/tecnicas.html` los muestra funcionando.
  - **Documentación:** se actualizan `kit.md`, `SKILL.md` y el README. Ninguna pieza se presenta como arreglo de un tramo muerto: siguen las reglas de ritmo existentes.
- **Validación real:**
  - **Auditoría y render:** en una copia aislada de la plantilla, `auditar.mjs` dio 0 errores y 0 avisos. `kit/tecnicas.html` se renderizó con la RTX 3050 y se revisaron 10 fotogramas. Eso destapó dos defectos, ya corregidos: la máscara de `revelar()` borraba todo y el bocadillo no seguía a la cámara, de ahí `proyectar()`.
  - **Determinismo:** `--determinismo` dio 13 instantes idénticos, repetidos y en orden inverso. Los instantes incluyen mitad de los párpados, cambio de foco, X en aceleración, escritura, lluvia y cita.
  - **Pruebas nuevas:** `tests/animacion/kit-tecnicas.test.mjs` hace 18 comprobaciones: `proyectar`, `respira` con punto fijo, `encuadreHombro`, `aceleracion` contigua y monótona, largo de trazados y semillas, `lecturaMinima`, y lluvia y hojas con las mismas llamadas de dibujo en cualquier orden de t.
  - **`ritmo.py`:** con un video de 33,6 s mostró las columnas de saturación y luminancia. Avisó solo del tramo de color planeado que se salía.
- **Límites:**
  - `revelar()` no traza letra por letra; para eso hacen falta datos de una fuente de un solo trazo.
  - Las transiciones y la profundidad de campo cuestan un lienzo por capa; no se midió el tiempo de render frente al kit anterior.
  - `tests/animacion/puntos-3d.test.mjs` no se pudo ejecutar en este equipo porque falta el paquete `three`. No cambió.
  - No se acredita una mejora de calidad de ningún video: son recursos, no resultados.
  - Siguen pendientes la fase 2 (rig silueta, escala por profundidad, interfaces, poses cenitales) y la fase 3 (exteriores 3D con Three.js).
- [Análisis de la referencia, tabla de técnicas y plan por fases](docs/analysis/2026-11-04-referencia-1-minute.md).

## Sin versión publicada — 2026-11-03

### Revisión de nevera_redes.mp4: divulgación 3D y visibilidad del mecanismo

- **Problema observado:** un Short 3D low-poly con tipografía retro y acabado nítido perdía los extremos de sus flujos en el encuadre vertical; personajes y rótulos competían con la explicación. La guía no distinguía suficientemente este lenguaje del corto ilustrado o el pixel art y desaconsejaba los diagramas en el desarrollo.
- **Cambio:** `references/estilos.md` concreta lenguaje, acabado e identidad en el brief existente. Para divulgación prioriza causa, recorrido y resultado; protege elementos críticos frente a recortes/oclusiones, reduce competencia de interfaz y distingue números ilustrativos de mediciones. Se actualizan entrada, dirección, preproducción, rúbricas y README, sin otro cuestionario ni aprobación rutinaria.
- **Código:** `comprobarPuntos3D()` añade al kit un diagnóstico opcional de puntos del mundo para cámaras Three.js, con margen y profundidad; no requiere Three.js en proyectos 2D. No detecta oclusión, volumen completo, textos o calidad artística.
- **Validación real:** copia aislada del proyecto identificado por SHA-256; muestra de 3,5 s/105 fotogramas en 1080p30 con RTX 3050, mezcla y CRF 12/slow; cuatro instantes deterministas y decodificación correcta. En cinco instantes, 2/4 → 4/4 puntos críticos dentro del margen tras abrir cámara y acortar recorridos. Pruebas de perspectiva/ortográfica, recorte, márgenes e inmutabilidad; sintaxis, auditoría y validador de la skill.
- **Resultado y límites:** mejora provisional de claridad del plano de 6 a 8/10, sin acreditar 9/10 global, retención, fluidez percibida o mejora de velocidad. La muestra no lleva etiquetas de color y no sustituye la validación del final. Quedan pendientes escucha, salto/aterrizaje, precisión del guion y enlaces con los planos vecinos. Original y proyecto conservados.
- [Análisis por estilo, notas, comparación y feedback](docs/analysis/2026-11-03-nevera-review.md).

### Revisión de 3.mp4: foco narrativo, encuadre por zona y muestras en dos etapas

- **Problema observado:** en un corto lento y oscuro, una reacción importante quedaba en un encuadre amplio; al acercarse, sus capas rasterizadas necesitaban más detalle. Persistían reglas rígidas de cámara, rebotes, paleta y densidad sonora incompatibles con adaptar el estilo.
- **Cambio:** `encuadreZona()` en el kit ajusta una región declarada en ambos ejes con margen. Preproducción, dirección y rúbricas priorizan lectura del foco, cobertura emocional y pausas motivadas; se documenta la densidad de capas para el acercamiento máximo, sin aumentar globalmente resolución o fps.
- **Render:** `--prueba` separa la codificación de imagen y la unión del audio, copiando el video sin recomprimirlo. Conserva el perfil final, los tiempos alineados y los casos sin mezcla. La espera del intento inicial no se atribuye con certeza a un interbloqueo ni se afirma una mejora de velocidad.
- **Validación:** 27 casos de encuadre y 7 entradas inválidas; muestra aislada de 4 s/240 fotogramas en 1080p60 con cinco instantes deterministas; cuatro casos de regresión de audio. Sintaxis, auditoría, enlaces y estructura de la skill correctos.
- **Resultado y límites:** el rostro ocupa un 45,2 % más de altura geométrica y mejora su lectura en las imágenes revisadas. La toma requiere densidad extra y tuvo un coste alto, sin benchmark comparativo. No se acredita 9/10 global, fluidez perceptiva ni calidad sonora artística. El original se conserva.
- [Análisis, notas, comparación y límites](docs/analysis/2026-11-03-video-3-review.md).

### Ficha breve por plano en el storyboard

- **Problema:** la lista de preproducción ya pedía acción, cámara y sonido, pero no ofrecía una ficha reutilizable ni exigía concretar la iluminación por plano.
- **Cambio:** `preproduccion.md` integra seis campos (intención, cámara y composición, iluminación, acción, sonido y enlace), identificador, escena, tiempos y papel narrativo. Incluye plantilla y dos planos conectados. Las definiciones comunes se heredan por identificador dentro del storyboard o brief; se completan los storyboards existentes sin otro documento obligatorio ni nuevas aprobaciones.
- **Adaptación:** permite cámara fija, gráficos planos sin sombras y piezas silenciosas; no impone iluminación volumétrica ni una estética. Los pendientes se declaran y se resuelven antes de presentar el plano como listo para animar.
- **Validación:** revisión editorial de los dos planos (6 s en total, continuidad de mano, cuaderno, luz y audio), enlaces locales, formato y estructura de la skill. Se actualizan README, entrada de la skill y rúbrica de preproducción para usar la misma ficha.
- **Límites:** esta entrega define el formato y su revisión editorial; no añade puntuación por escena ni un validador automático de storyboards. No se renderizó un video ni se acredita calidad audiovisual con el ejemplo escrito.

### Coherencia de la guía al publicar

- Se corrige una frase antigua del Paso 0 que aún enumeraba la edición de grabaciones como no disponible. Ahora remite al modo edición y conserva sus límites documentados.

### Modo edición de videos grabados (fases 1–3 de la propuesta)

**Problema.** La skill solo podía dibujar videos. Editar una grabación (el usuario hablando a cámara, pantallas de OBS) era imposible: no había ingesta, transcripción, línea de tiempo de clips ni render de video real. La propuesta aprobada (análisis → planificación → edición → render → evaluación → iteración) se implementa por fases. Esta entrega cubre las fases 1–3.

**Qué se añade:**
- **`preparar.py --perfil`:** guarda el perfil del equipo en `estado.json`.
  - Prueba de verdad cada codificador H.264 (NVENC, AMF, QSV, VideoToolbox, x264).
  - Mide GPU y VRAM, RAM, disco y núcleos.
  - Comprueba Whisper: CUDA solo si carga y transcribe.
  - Fija el nivel efectivo (núcleo, completo o avanzado).
- **`preparar.py --edicion [--modelo] [--whisper-gpu]`:** instala el nivel completo (faster-whisper y el modelo).
- **`nuevo.py --edicion`:** proyecto con `fuentes/` y las herramientas de `assets/edicion/`, más `verificar.py` y `ritmo.py` de la plantilla.
- **`analizar.py`:**
  - ingesta;
  - salida propuesta desde la cámara (nada fijo);
  - copias a fps constante con el codificador del perfil;
  - sincronía por correlación de ataques de audio;
  - transcripción por palabra;
  - bordes de frase corregidos con la energía (Whisper adelanta los tiempos);
  - sonidos sin palabra (muletillas que Whisper omite);
  - palabras sin voz (alucinaciones);
  - tomas repetidas con la elegida y el motivo;
  - luz por segundo y escenas de pantalla.
- **`planificar.py`:** el corte en papel (`GUION-MONTAJE.md` y `analisis/guion.json`). Quita tomas descartadas, muletillas, alucinaciones y pausas largas, con márgenes medidos sobre la voz real y zoom alterno en los jump cuts.
- **`montaje.py`:** la línea de tiempo como fuente de verdad.
  - Operaciones: `validar`, `info [--palabras]`, `cortar`, `quitar --palabras|--desde/--hasta`, `layout completo|pantalla|pantalla+pip` (pantalla sincronizada por el desfase), `zoom`, `transicion`, `diff` y `deshacer`.
  - Se guardan versiones y se valida antes de guardar.
  - Los bordes se ajustan a fotograma y a pausas entre palabras, y no se crean clips de menos de 0,2 s.
- **`editar.py`:**
  - render por segmentos con caché por hash;
  - revisión con el codificador por hardware y final con x264 (configurable en `salida`);
  - voz con muestras exactas y microfundidos solo donde la voz salta;
  - `loudnorm` en dos pasadas;
  - salida BT.709 en `yuv420p`.
- **`qc.py`:**
  - **Bloqueante:** montaje válido; cortes dentro de palabras o con la voz sonando; palabras del guion perdidas; duración; clics; WER de la retranscripción; determinismo de un segmento; `verificar.py` en el final.
  - **Aviso:** lo quitado que vuelve, jump cuts sin cambio y silencios largos.
- **`verificar.py`:** sin `motion.config.json`, toma la salida y la duración de `montaje.json`.
- **Pruebas:** `tests/edicion/sintetico.py` (material con respuestas conocidas) y `tests/edicion/probar.py` (de principio a fin, fallos provocados y regresión del modo animación).
- **Documentación:**
  - `references/edicion.md`;
  - rúbricas §15–19 en `rubricas.md`;
  - la sección 9 de `requisitos.md`;
  - "Dos modos" en `SKILL.md`, cuya descripción incluye ahora la edición de grabaciones;
  - el README.

**Validación** (Windows 11, RTX 3050, Ryzen 7 7445HS):
- **`probar.py`: 22/22.**
  - Desfase medido 1,370 s frente a 1,37 s esperados.
  - Las 2 tomas repetidas agrupadas y resueltas a favor de la versión completa.
  - Las 5 frases que se conservan, enteras.
  - Las 2 tomas descartadas y la muletilla, fuera.
  - Render final 1080×1920 con `qc.py --retranscribir --determinismo` OK (WER 0 %) y `verificar.py` OK, incluidos BT.709 y −1,0 dBTP.
  - Los tres fallos provocados (corte dentro de una palabra, palabra perdida, clic) se detectan.
  - La plantilla de animación pasa `auditar.mjs`, `--determinismo`, `--final` y `verificar.py`.
- **Tiempos con 33 s de material:**
  - transcripción en CPU: 18–23 s con large-v3-turbo;
  - render de revisión: unos 5 s;
  - render final: 10–16 s.
- **Nivel núcleo** (sin transcripción): funciona; deja avisos de silencios de unos 0,6–0,7 s.
- **Errores encontrados y corregidos durante la validación:**
  - Whisper daba finales 0,1–0,3 s antes que la voz real, lo que recortaba sílabas.
  - Un cambio de layout sobre voz continua llevaba microfundido, lo que dejaba un hueco a mitad de palabra.
  - `quitar` no eliminaba una palabra más corta de 0,2 s.
  - La API de PyAV instalada con Python 3.14 rompía la lectura de archivos de faster-whisper; ahora se le pasa el audio ya decodificado.

**Límites:**
- **Solo material sintético** (voz de Windows, sin ruido real ni muletillas naturales). Falta la grabación real del usuario para validar la elección de tomas, las muletillas y la sincronía móvil–OBS.
- **Whisper en GPU sin probar:** no se instalaron las bibliotecas CUDA.
- **macOS y Linux sin validar.**
- **Pendiente (fases 4–6):** subtítulos, B-roll, pantalla dividida, zooms animados, gráficos con transparencia, música, limpieza de voz, color, curva de retención sobre la línea de tiempo y modo autónomo.

### Rúbricas de calidad, requisitos por funcionalidad y verificación de la exportación

**Problema:**
- La revisión puntuaba siete aspectos generales sin criterios por funcionalidad. Las auditorías mostraron notas propias infladas y defectos técnicos que nadie detectaba: color sin etiquetar y true peak de −0,2 y +1,7 dBTP.
- Los requisitos estaban repartidos entre el README y `preparar.py`, sin hardware mínimo, sin cifras de rendimiento y sin una lista de lo que la skill no hace.

**Qué se añade:**
- **`references/rubricas.md`:** escala común (1–10 con bandas de entrega) y 14 funcionalidades. Para cada una: criterios medibles, errores frecuentes, cómo se detectan, cómo se corrigen y qué comprobación automática la cubre.
  - Funcionalidades: entorno, preproducción, animación, cámara, transiciones y montaje, motion graphics, texto y subtítulos, audio, sincronización, determinismo, ritmo, render, exportación y proceso de revisión.
  - Reglas: una comprobación bloqueante que falle limita esa funcionalidad a 4, y la nota global no supera en más de 1 punto a la peor.
  - Los fallos de `ritmo.py` exigen diagnóstico, pero no fijan la nota artística, como en la revisión del episodio Ojalá No.
- **`references/requisitos.md`:** sistemas (solo Windows validado), hardware mínimo y recomendado, software y versiones, instalación, comandos de verificación, limitaciones y alternativas para cada funcionalidad. Incluye una tabla de lo que **no** está disponible (edición de grabaciones reales, subtítulos desde voz, capas con transparencia, etiquetas de color y limitador de pico), para avisar al usuario antes de empezar.
- **`verificar.py` (plantilla):**
  - **Falla (código 1)** si el códec no es H.264 o los píxeles no son `yuv420p`; si resolución, fps, duración o número de fotogramas no coinciden con la config; si hay fps variable; si falta el audio o no está a −14 ±1 LUFS cuando hay `audio/final.wav`; si audio y video duran distinto; o si hay negro casi puro de 1 s o más sin declarar.
  - **Avisa** del color sin etiquetas BT.709, del true peak por encima de −1 dBTP y de la imagen congelada 4 s o más fuera de las pausas declaradas.
  - Fuera del proyecto, no compara con la config.
  - El informe queda en `review/verificacion.json`.
- **`SKILL.md`:** el Paso 0 remite a los requisitos y a la lista de lo no disponible; el Paso 3 puntúa con las rúbricas; el Paso 4 sustituye la comprobación manual con `ffprobe` por `verificar.py`. El README enlaza ambos documentos.

**Validación:**
- **Render medido de la plantilla:** 6 s en 1080p60 con CRF 12 `slow` y 6 workers en la RTX 3050 tardó 21 s (unos 17 fotogramas por segundo, con el arranque incluido).
- **`verificar.py` sobre:**
  - **la plantilla:** OK, con aviso de color;
  - **el video stickman:** OK, con avisos de color y de pico de −0,2 dBTP;
  - **`manana.mp4`:** OK, con aviso de pico de +1,7 dBTP.
- **Casos de fallo provocados:**
  - 2 s de negro en mitad del video;
  - `audio/final.wav` presente sin pista de audio;
  - sonoridad de −47,9 LUFS;
  - recodificación a 30 fps (detectó fps, duración y fotogramas).
- **Ajuste durante la prueba:** con el umbral inicial (`pix_th` 0,06 y 0,25 s), el fondo azul marino de la plantilla y un fundido a negro de 0,4 s del video stickman se marcaban como negro. Se fijó en `pix_th` 0,02 y 1 s.

**Límites:**
- Las rúbricas no son una prueba automática de calidad artística; la nota sigue saliendo de ver y escuchar.
- macOS y Linux siguen sin validar. El consumo de RAM por worker no está medido.
- Los avisos de color y pico se mantienen hasta que se apruebe la mejora "perfil de publicación".

### Revisión del episodio Ojalá No: encuadre y muestras con audio

- El resultado real mostraba texto recortado por acercamientos y correcciones de ritmo mediante cámara continua. Se priorizan acción y lectura, cámara con límites y curvas según intención; se retiran las obligaciones de rebote, deriva permanente y puntuación artística condicionada al detector de ritmo.
- `--prueba` incorpora el intervalo de `audio/final.wav` si existe, alineado al primer fotograma capturado, con AAC y el perfil final de video. `--sin-audio` mantiene la prueba muda; si falta mezcla se informa del pendiente. No añade normalización por fragmento ni modifica la autorización del completo.
- Se evita renderizar obligatoriamente el ejemplo del kit y se pide que la muestra represente las dificultades reales, usando las revisiones existentes.
- Validación: muestra aislada de 7,5 s/450 fotogramas 1080p60 en RTX 3050, cuatro instantes deterministas, decodificación y metadatos correctos. Fixture fraccional a 12 fps: audio alineado (correlación 0,99675), casos mudo y sin mezcla correctos. Sintaxis, auditoría y validador estructural correctos.
- [Análisis, notas provisionales y comparación](docs/analysis/2026-11-03-ojala-review.md). Se verifica una mejora de lectura, no una nota global 9/10 ni retención; reproducción/escucha perceptiva pendiente. El proyecto original se conserva.

### Comprobaciones adicionales al preparar el commit

- Sintaxis Python/JavaScript, configuración JSON, enlaces locales y validación estructural de la skill correctos. La auditoría de la plantilla revisó cinco archivos sin errores ni avisos.
- El ejemplo del kit pasó seis instantes repetidos y en orden inverso, incluidos 1,15 y 1,16 s, en una copia técnica vertical de 1080 × 1920 a 12 fps usando CPU.
- Un video sintético de 24 s, con 8 s de movimiento y 16 s de imagen fija, activó la detección de caída de energía. Al declarar esa pausa, dejó de fallar por ese motivo; los demás umbrales se ajustaron en la prueba para aislar ese comportamiento.
- Estas comprobaciones no repiten las auditorías artísticas o de videos anteriores descritas abajo, ni acreditan la calidad de un encargo nuevo completo.

### Curva de energía: re-ganchos planificados en el storyboard y medidos por tramos

**Problema.** En la auditoría de un video stickman de 121 s hecho por Claude con la skill (6,5/10), los primeros 15 s eran fuertes, pero el resto decaía:
- El movimiento mediano cayó de 4,5 a 1,1–1,4 en 30–45 s, 60–75 s y 75–90 s, con un 53–60 % de tiempo casi quieto.
- Los golpes de sonido bajaron un 45 % tras el gancho y el estéreo se quedó estrecho y sin cambios (0,14–0,24).
- Aun así, `ritmo.py` lo aprobaba, porque la media global de la pieza escondía esos tramos.
- Nada en la skill pedía planificar re-ganchos ni repartir los recursos de la apertura.

**Qué se añade:**
- **Preproducción** (`references/preproduccion.md`): sección "Curva de energía y re-ganchos".
  - La curva se diseña al estructurar el guion: gancho, re-ganchos (cada 8–12 s en piezas de menos de 60 s, cada 15–25 s en las largas), pausas con motivo, clímax de acto y cierre.
  - Cada re-gancho nace del contenido. Los recursos de la apertura se catalogan y se reparten por los clímax.
  - Las láminas de título duran 1,5 s como máximo; ningún diagrama fijo pasa de 4 s; el sonido sigue la curva.
  - Cada plano del storyboard indica su papel en la curva. Los tiempos se copian a `motion.config.json` → `curva`.
- **`ritmo.py`:** tabla por tramos (15 s, o una cuarta parte en piezas de menos de 60 s) comparada con la apertura.
  - Falla si un tramo cae por debajo de `caidaMin` (0,5) del movimiento de la apertura con al menos `caidaQuieto` (30 %) de tiempo quieto, o si dos tramos seguidos pasan de `tramoQuietoMax` (50 %) de tiempo quieto.
  - Las pausas declaradas en `curva.pausas` no cuentan como caída ni como tramo muerto.
  - Avisa si un re-gancho planificado no tiene corte ni movimiento fuerte, si pasa demasiado tiempo entre re-ganchos (25 s; 12 s en piezas de menos de 60 s) o si un proyecto de más de 20 s no tiene curva.
  - Con sonido, avisa si los golpes por segundo bajan del 60 % de la apertura, si el nivel cae más de 4 dB o si el estéreo no pasa de 0,3.
  - `--calibrar` deriva también `caidaMin` y `tramoQuietoMax` de las referencias.
  - La curva planificada solo se aplica a videos del propio proyecto, no a referencias externas.
- **`SKILL.md`** (Paso 1 y Paso 3) y **`references/direccion-movimiento.md`**: construir siguiendo la curva, nueva señal de deriva hacia una presentación y declaración de pausas.

**Validación:**
- El video stickman pasa a fallar en 30–45 s, 60–75 s y 75–90 s, con avisos de densidad sonora y estéreo.
- Con una curva de prueba en una copia del proyecto:
  - una pausa declarada en 75–90 s deja de contar;
  - los huecos de más de 25 s sin re-gancho se avisan;
  - dos re-ganchos puestos en momentos quietos (36 s y 80 s) se detectan como "no se ve".
- Nueve shorts propios anteriores (`studio-8bit`, `motion-idea`):
  - cuatro pasan;
  - tres fallan por caídas con un 44–60 % de tiempo quieto (dos de ellos ya fallaban por tramos muertos);
  - uno falla solo por micromovimiento global, como antes;
  - uno falla por una caída nueva, `ojos-de-perro` (12–24 s, 46 %, 50 % quieto).
  - El cierre calmado pero en movimiento de `tunel-a-traves-de-la-tierra` (43 %, 10 % quieto) ya no falla gracias a la condición de tiempo quieto.

**Límites:**
- Los umbrales son una primera calibración sobre pocos videos; conviene recalibrarlos con referencias del estilo buscado.
- La detección de golpes sonoros es heurística: por eso el sonido solo avisa.
- La regla de re-ganchos no se ha probado todavía en un encargo nuevo de principio a fin.

## Sin versión publicada — 2026-11-02

### Muestra aprobada y completo con la misma calidad alta

- `--prueba` usa el perfil `codificacion.final` del proyecto en lugar de CRF 20/preset `fast`. Conserva resolución y fps; sigue siendo una muestra sin audio de hasta 10 segundos.
- El aviso «Aprobar y generar completo» valida la muestra y autoriza continuar con `--final` en calidad alta. No se pide otra vez la misma aprobación ni se intercala automáticamente `--borrador`; este modo se conserva para quien lo elija expresamente.
- El primer completo sigue sujeto a revisión y correcciones, con el acabado y calidad visual aprobados. La vista diagnóstica `--ritmo` no se presenta como una muestra de calidad final.
- Validación: pruebas técnicas aisladas con los perfiles 12/slow (por defecto) y 17/medium (personalizado). En cada caso, la muestra de 1 s/12 fotogramas y el completo de 2 s/24 fotogramas conservaron 320 × 180 a 12 fps y las mismas opciones x264, verificadas en el flujo codificado; ambos archivos se decodificaron correctamente. Se validaron sintaxis, estructura y enlaces. No se produjo un video del usuario ni se evaluó un resultado artístico nuevo.


### Kit de movimiento: curvas, cámara y transiciones (sin personaje genérico)

**Problema.** La skill no aportaba medios para el movimiento ni el montaje: cada modelo dibujaba desde cero con primitivas de canvas. En la auditoría de 2026-11-02 (4,75/10) sobre dos pruebas de otros modelos (Gemini 4 Argon en `procrastinacion-short`, y `el-contador-invisible`), el resultado fueron figuras de palo, poses interpoladas sin anticipación ni rebote, y una cámara limitada a zoom o corte.

**Qué se añade:**
- **`lib.js`:** catálogo `ease` (incluye `saleBack`, `saleExpo`, `saleElastica` y `escalon`), `resorte()` (oscilador amortiguado analítico, sin estado), `mezclar()` de números, arrays y objetos, `claves()` para animación pose a pose, y `ruidoSuave()` con semilla.
- **`kit/camara.js`:** `encuadre()` (general, conjunto, medio, medioCorto, primerPlano, detalle) calculado desde la base y el alto del sujeto, `temblor()` por impulsos con ruido suave, `camaraEnMano()`, `aplicarCamara()` y `paralaje()` por capas.
- **`kit/transiciones.js`:** corte, whip con estela de movimiento, empuje, barrido, iris, zoom a través, flash y corte por forma, más `montaje()` para encadenar planos. Los lienzos auxiliares se crean una vez y se limpian con `reset()` en cada uso.
- **`kit/ejemplo.html`:** 8 s verticales.
  - Una pelota con anticipación, caída que acelera, aplastamiento en el impacto y rebotes que se asientan.
  - Corte a detalle con temblor y paralaje.
  - Whip a tipografía que cae con resorte, iris y contrapicado con estrellas.
- **`render.mjs --pagina=`:** renderiza otra página del proyecto, como el ejemplo. La plantilla `index.html` carga el kit.
- **Documentación:** `references/kit.md` (timing, gramática de planos, transiciones y una guía para diseñar y animar personajes propios). La sección "Estilo visual" del `SKILL.md` remite a ella.

**Personaje genérico retirado.** Durante este cambio se probó un `kit/personaje.js` (esqueleto de vista frontal con IK, 12 poses, 10 caras y ciclos de caminar) y se eliminó antes del commit.
- **Prueba:** Codex (GPT-6.1 Sol), con un encargo nuevo y sin referencias ("Apagón", 28 s), lo usó.
- **Resultado:** el cuerpo actuó como una marioneta. Caminaba deslizándose de frente, un brazo subía con el resto congelado y no había desplazamiento de peso ni movimiento secundario.
- **Contraste:** los mejores momentos del mismo video (ojos, parpadeo, mirada al cielo, cortes) no dependían del rig.
- **Conclusión:** la plantilla de cuerpo limitaba al modelo en lugar de ayudarle. Se sustituye por principios de actuación y diseño por plano.

**Validación**, en un proyecto vertical de 1080×1920 a 30 fps generado con `nuevo.py`:
- Auditoría sin errores ni avisos.
- `--determinismo` OK en 10 instantes del ejemplo, incluidos el impacto con corte (1,15–1,16 s), el centro del whip y el del iris.
- `--ritmo` del ejemplo: mediana 4,37, micro 14 %, racha 1 s, 37,5 cortes/min.
- Revisión de fotogramas.
- La versión con personaje corrigió dos defectos durante su revisión: el whip dejaba un fotograma vacío en su centro, y una cámara cortaba la cabeza en un salto. La corrección del whip se conserva.

**Límites:**
- El kit no dibuja nada por sí mismo: la calidad de personajes y escenarios sigue dependiendo del modelo y del brief.
- La guía de personajes no se ha probado todavía en un encargo real.
- Las métricas no acreditan calidad artística.

### Convención de commits y documentación continua

- Se añaden `CONTRIBUTING.md` y `AGENTS.md` para mantener Conventional Commits, agrupar cambios por propósito y registrar mejoras junto con su código. La historia publicada se conserva.
- El README enlaza el changelog y la guía de contribución. Las entradas separan comportamiento, comprobaciones y límites; no se asigna una versión de lanzamiento inexistente.
- Validación: enlaces locales, bloques Markdown y `git diff --check`. La convención de mensajes se revisa manualmente; no se añadió un hook automático.

### Audio, ritmo y diagnóstico del render

- Se añade `audio/musica.py` a la plantilla: síntesis con semilla, escritura de pulsos en `beats.json`, medición de una pista externa y mezcla opcional de voz con reducción de música. Se busca −14 LUFS mediante medición de FFmpeg.
- Se añade `render.mjs --ritmo`: captura la composición completa a 10 fps y genera una vista de 480 px de ancho. `ritmo.py` estima movimiento, intervalos de baja variación y cortes, con umbrales configurables y calibración por referencias.
- El renderizador puede resolver Playwright y fuentes desde las herramientas compartidas. `crearTexto(ctx)` rasteriza texto en lienzos auxiliares; la plantilla reinicia el contexto entre fotogramas. La auditoría avisa sobre texto directo y contextos sin reinicio, y el diagnóstico de determinismo guarda imágenes con diferencias y sus zonas.
- Se documentan las herramientas y la narración en el README y en la skill.
- Validación: comprobación de sintaxis JavaScript/Python y auditoría estática sin errores ni avisos. La plantilla aislada de 640 × 360 pasó diez instantes de determinismo y produjo una prueba de 4 s/48 fotogramas. Se generaron dos WAV de 6 s idénticos byte a byte, medidos a −14,0 LUFS, y una vista de ritmo de 6 s a 10 fps. El análisis de esa plantilla emitió código 1 por baja variación, conforme a sus umbrales; no se interpreta como fallo del render ni como evaluación artística completa.
- Límites: pendientes las ramas con pista externa, voz/ducking y calibración con múltiples referencias. No se realizó escucha subjetiva. La diferencia de píxeles y la detección de cortes son heurísticas sensibles a tamaño, contraste y composición; no acreditan actuación ni calidad narrativa por sí solas.

### Preparación del entorno y configuración de proyectos

- Se añade `motion-studio/scripts/preparar.py` para preparar Playwright, Chromium y fuentes en una carpeta compartida, comprobar Python/NumPy/Pillow, Node.js, FFmpeg/FFprobe y detectar el renderizador WebGL. La ubicación se configura con `MOTION_STUDIO_HOME`.
- Los instaladores pueden ejecutar esa preparación. Permiten omitirla con `-SinHerramientas` en PowerShell o `MOTION_SIN_HERRAMIENTAS=1` en Bash; la instalación de programas del sistema requiere `-Sistema`/`--sistema`.
- `nuevo.py` admite duración, fps y orientación vertical al generar el proyecto; `--sin-preparar` ejecuta solo la comprobación del entorno. Se conserva la protección frente a sobrescribir proyectos existentes.
- Validación: sintaxis Python, PowerShell y Bash; generación aislada con duración de 8 s, 24 fps y orientación vertical; confirmación de que `--sin-preparar` no solicita instalación y rechazo de un destino ya ocupado. La llamada a la preparación se simuló en esta prueba. Pendiente verificar la instalación completa real en Windows/macOS/Linux y los gestores del sistema.

### Dirección creativa y revisión de movimiento ya publicadas

- El commit [b6e1481](https://github.com/TuMinipeka/motion-studio-design/commit/b6e1481aa121f999bf175e96aef1be13385dd4bc) incorporó dirección creativa, storyboard, avisos breves con recomendaciones y análisis del lenguaje de referencia.
- Se añadió `--prueba=inicio,fin` para revisar un fragmento animado y se sustituyó la plantilla de barras por una demostración de continuidad de un sujeto.
- Validación de esa entrega: prueba técnica de 4 segundos y 48 fotogramas, decodificación y determinismo en diez instantes. Falta una evaluación del flujo actualizado ejecutado por Gemini/Argon sobre un encargo real. Detalles en [el análisis del resultado](docs/analysis/2026-11-02-motion-review.md).
