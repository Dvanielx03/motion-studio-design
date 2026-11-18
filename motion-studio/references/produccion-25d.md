# Producción 2.5D en 10 etapas (pipeline diario)

Guía de producción de Shorts narrados en 2.5D: escenarios 3D, personajes 2D dibujados por código y voz como reloj. Reúne lo aprendido en el piloto de Hanói (nov 2026), la auditoría de make-short y el análisis de Ricks Clips (`docs/analysis/2026-11-17-*.md` del repositorio). Las autorizaciones de `SKILL.md` no cambian: guion antes de pagar voz, muestra antes del completo y nada se publica sin el «sí» del usuario.

**Principio:** se automatiza lo repetible (medir, sincronizar, renderizar, revisar) y se reserva al director lo que decide la calidad (premisa, cómo contarla, actuación, color, ritmo emocional). Una métrica dentro de rango no prueba que el video funcione; una fuera de rango es una pregunta.

## Mapa de etapas

| # | Etapa | Decide el director | Automatizado | Evidencia | Puerta |
|---|---|---|---|---|---|
| 1 | Investigación y concepto | Tema, premisa real, ángulo propio | `referencia.py` (medir referencias); yt-dlp para métricas públicas | Ficha de tema con fuente verificable y 3–4 enfoques | — |
| 2 | Guion y dirección | Enfoque, gancho, giro, cierre | `revisar_guion.py` (con la voz) | Guion con tiempos estimados | **Aprobación del guion** |
| 3 | Storyboard | Planos, cámara, color por acto, enlaces | `produccion.json` / `planos.js` validados | Fichas por plano, curva de energía | — |
| 4 | Diseño visual | Personajes, escenarios, paleta, luz | Biblioteca de escenarios y personajes | Hoja de personajes y escenarios | Visto bueno si el diseño es nuevo |
| 5 | Animatic | Duraciones y lectura | `render.mjs --vista` (NVENC) | `review/vista/vista.mp4` con la voz | — |
| 6 | Producción | Actuación, gags, reacciones | `kit/escena3d.js`, `recursos25d.py` (Blender), caché por plano | Fotogramas por plano | **Muestra autorizada** |
| 7 | Render y composición | Acabado (grano, viñeta, color) | `--prueba` y `--final` en paralelo, caché por plano | Muestra y completo CRF 12 | **Completo autorizado** |
| 8 | Diseño sonoro | Música por actos, silencios, acentos | Voz, efectos y música por API; `audio/musica.py --voz` (y `--sincro`) mezcla a −14 LUFS | `audio/final.wav` medido | Voz aprobada antes del completo |
| 9 | Control de calidad | Juicio artístico final | `auditar.mjs`, `--determinismo`, `qc_escena.mjs`, `pops.py`, `ritmo.py`, `verificar.py`; crítico independiente | `REVISION.md` con tiempos y fotogramas | Máximo 2 rondas de crítica |
| 10 | Optimización | Qué regla nueva entra | `scripts/bitacora.py`, `references/leccionero.md` | Lección registrada y tiempos por etapa | — |

## Detalle por etapa

### 1. Investigación y concepto
- Premisa **real y verificable**, con un objeto o una situación que se pueda mostrar en el primer cuadro. En Ricks Clips (31 Shorts 2.5D, mediana de 8,9 M vistas) los más vistos abren con el objeto extraño ya visible y una paradoja en 4 s o menos; la ficción inventada fue la de peor rendimiento (n = 1, solo una pista).
- Compara 3–4 formas de contarla (regla de narrativa creativa): paradoja en 2.ª persona, consecuencia primero, «cada pero abre otro», perspectiva inesperada. Elige y justifica.
- Mide las referencias con `scripts/referencia.py`; las métricas públicas (vistas, duración) se separan de las hipótesis de retención.

### 2. Guion y dirección creativa
- Velocidad objetivo: **2,9–3,8 palabras/s** al hablar. Las referencias ganadoras van a 3,5–3,8; nuestro Hanói v1 iba a 2,3 y la v2 a 2,7.
- Gancho completo en **≤ 4,5 s**; querer o conflicto visible en el fotograma 1; al menos dos intentos que escalan con costo visible; un giro ganado, no azaroso; un cierre que enlaza con el primer cuadro (bucle). Duración de 40–65 s.
- Tras grabar la voz, `python revisar_guion.py` mide velocidad, gancho, palabras en los 3 primeros segundos, pausas, duración y bucle. Corrige con la toma o el texto, no con efectos.
  - Necesita `audio/guion.json`, que se escribe a mano al cerrar el guion: una lista con el texto de cada línea de la voz, en orden y tal como se locuta (también vale `[{"id": "L01", "texto": "…"}]`).
  - Y los tiempos de cada línea: `audio/tiempos_voz.json` (`{"duracion", "lineas": [{"id", "inicio", "fin", "texto?"}]}`, manda si existe) o, si no, los deriva de `audio/voz.palabras.json` (`python produccion.py --transcribir audio/voz.wav`) alineando sus palabras con las del guion. Es una estimación del ASR: revísala; `--guardar` la deja en `audio/tiempos_voz.json`.
  - Código 2 si falta un archivo o el formato no vale (imprime el formato esperado); con `--estricto`, código 1 si hay un aviso bloqueante (líneas que no cuadran con el guion, tiempos imposibles, objetivos fuera de rango).
- Voz de ElevenLabs: `speed` de 1,1–1,2 en la API y, si hace falta, `atempo` ≤ 1,1 al montar (conserva el tono). Pausas diseñadas en el montaje de la voz, no las que deja el TTS.

### 3. Storyboard
- Ficha por plano (`preproduccion.md`): intención, cámara, luz, acción, sonido y enlace. Guion de color por actos, con un **motivo de color** reservado para una idea (p. ej., el rojo de sello solo para el dinero).
- **Enlaces:** las referencias enlazan casi siempre con cámara continua, fundido o barrido (0–2 cortes duros por Short) y cambian de escena 14–20 veces por minuto. El corte seco se reserva para los golpes.
- Cada plano se declara en `planos.js` (o `produccion.json`) con `id`, `inicio` y `fin` anclados a palabras de la voz; la página publica `window.__info.planos = [[id, inicio, fin, salidaDur], ...]`, con `salidaDur = tr.duracion(p.salida)` (contrato en `25d.md`).

### 4. Diseño visual
- Personajes 2D dibujados por código (billboards de `kit/escena3d.js`) a 12 dibujos/s: siluetas legibles, contorno de tinta y poses escalonadas con dibujos intermedios (`pops.py` detecta los saltos de un dibujo). Ninguna identidad de otro canal se copia.
- Escenarios en Three.js con bandas (`material`, `caja`, `contorno`), niebla y luz motivada. **Un archivo por escenario** (`escena/<lugar>.js`): es la unidad de la caché por plano.
- Biblioteca reutilizable: personajes y escenarios aprobados se copian a la biblioteca del proyecto o del canal con una ficha (paleta, escala, anclas) y no se rediseñan en cada video.
- Para revisar o retocar un escenario en Blender: `node exportar_glb.mjs <lugar> --blender`.

### 5. Animatic
- `node render.mjs --vista`: todo el video a 540×960 y 15 fps, NVENC y voz. Sirve para revisar duraciones, lectura de subtítulos, encuadres y sincronía antes de gastar horas de render. Medido: 66,6 s de video en 58 s (con la mayoría de los planos aún en marcador).
- La composición debe leer `?vista=<escala>` (tamaño reducido y `ss: 1`) y publicar `window.__vista`; si no, `render.mjs` captura a tamaño completo y reduce, que es más lento.

### 6. Producción
- **Ruta Three.js** (`nuevo.py --25d`): la habitual para iterar rápido. **Ruta Blender** (`recursos25d.py`): planos que necesitan iluminación, materiales o volumen que Three.js no da; se componen como secuencias con `kit/secuencia.js`. Ver `25d.md`.
- Las reacciones siguen anticipación → acción → exageración → asentamiento, y se sostienen de 12 a 24 fotogramas tras cada gag; la capa de movimiento en reposo baja durante un hold cómico.
- Precalentamiento, doble render y supermuestreo 2× (`crearMotor`); `willReadFrequently` en los lienzos que se repintan por fotograma (el kit ya lo lleva en los billboards, en `brillo()`, en `crearTexto` y en `escritura.js`; los lienzos propios de la pieza lo necesitan también). Si no, falla el determinismo (lección 13).

### 7. Render y composición
| Perfil | Comando | Uso | Medido en Hanói v2 (RTX 3050) |
|---|---|---|---|
| Fotogramas | `--frames=t1,t2` | Composición y tipografía | ~1 s por fotograma |
| Vista | `--vista` | Animatic técnico | ~0,9 s por segundo de video |
| Muestra | `--prueba=a,b` (paralelo) | Calidad final con mezcla | 11 s por segundo de video (antes 40, con un solo navegador) |
| Completo | `--final` | Entrega CRF 12 slow | Segmentos de 5 s con caché por plano |

- **Caché por plano:** declara en `motion.config.json` → `dependencias` qué archivos usa cada plano (`{"P01": ["escena/oficina.js"]}`). Editar un escenario solo rehace los segmentos donde aparece; lo no declarado es común y lo invalida todo, así que nunca se reutiliza algo viejo por error.
  - Los ids de `dependencias` deben ser los que publica la página, con las mismas mayúsculas; si uno no se publica, `render.mjs` avisa y sus archivos cuentan como comunes. Las rutas con otras mayúsculas dan error con la sugerencia correcta.
  - Solo los `_*.mjs` / `_*.cjs` de la raíz quedan fuera de la huella; `motion.config.json` entra como configuración, sin las claves de las herramientas (`workers`, `vista`, `qc`, `guion`, `skill`…). Editar la propia lista `dependencias` cambia el reparto de la huella y suele rehacer todo una vez. Lista completa en `25d.md` («Qué invalida la caché»).
  - La primera ejecución con la plantilla del 17 nov rehace todos los segmentos una vez. No edites fuentes mientras dura un render.
- Grano y viñeta **fijos** (no animados) como acabado de la identidad.

### 8. Diseño sonoro
- Voz → tiempos por palabra (`produccion.py --transcribir`, faster-whisper local) → música por actos (ElevenLabs Music con `composition_plan`, secciones del largo exacto de cada acto) → efectos en tres capas (ambiente, textura, acento), alineados por su **ataque real** al fotograma del golpe.
- Criterio del usuario: música ~20 dB bajo la voz y −12 dB más mientras habla; efectos ~3 dB bajo la voz; ambientes con ducking y J-cuts de 0,2–0,4 s. Salida a −14 LUFS y ≤ −1,5 dBTP.
- Las referencias no usan silencios: si se planifica uno (el giro), que sea una decisión de guion, declarada en `curva.pausas`.

### 9. Control de calidad
Orden y costo (de barato a caro):
1. `node auditar.mjs` (contrato) → `python revisar_guion.py` (guion con voz).
2. `node qc_escena.mjs`: texto fuera de la zona segura (FALLA), texto que tapa más del 12 % de la parte visible de un protegido (FALLA), foco fuera de cuadro en más del 35 % o detrás de la cámara (AVISO) y tiempo de lectura (AVISO).
   - Necesita `window.__qc(t)`: puede ser `async` y entonces debe esperar a `seek`; devuelve `textos` con `letras` (caracteres visibles; sin ellas sale «lectura no comprobada») y `protegidos` con `foco`, `visible` y `fuera` (contrato en `25d.md` y en su cabecera).
   - Lectura: cada aparición de un texto debe durar al menos `max(1,2 s, letras/30)`; se cambia con `qc.lecturaMin` y `qc.letrasPorSeg` en `motion.config.json`, y cuenta las letras máximas de la aparición (un texto que se escribe letra a letra mide con su largo final). Es el mínimo de `rubricas.md` §7; para los textos clave usa una regla más estricta (§7).
   - Deja `review/qc/qc.json` con los hallazgos y el alto mínimo y máximo de cada protegido por plano (`tamanos`, % del alto), más hojas con las FALLA primero. Código 1 si hay FALLA, 2 si hay un error.
3. `node render.mjs --determinismo` con instantes de cada plano.
4. Tras la muestra o el completo: `python pops.py <mp4>`, `python ritmo.py <mp4>`, `python verificar.py`.
   - `pops.py` busca saltos no planificados de 1–3 fotogramas: los de un fotograma y los transitorios (algo que cambia y vuelve en ≤ 3 fotogramas, o ≤ 0,1 s a más fps), también junto a un corte. Respeta cortes, impactos y re-ganchos, y lo pasa todo a los fps del video, así que vale para la `--vista`.
   - `python pops.py review/pruebas/movimiento-F0-F1.mp4` deduce `--desde` del nombre (F0 son fotogramas del máster). Para cualquier otro clip, pasa `--desde <segundos>`: va en **segundos**, no en fotogramas, y avisa si no cuadra con el nombre o cae fuera del máster.
   - Impactos: los de `sincro.json` (ya resueltos, también los anclados a «palabra»; avisa si está desfasado frente a `produccion.json`) o, si no existe, los de `produccion.json`, con los de «palabra» resueltos con `audio/voz.palabras.json` o `--voz`. Avisa del impacto que no pueda resolver.
   - **Recurrente** (no falla): un transitorio de 2 fotogramas o más que se repite al menos otras 2 veces con la misma firma (mismo peor bloque ±1, duración ±1, intensidad ×0,5–2) a ±5 s y en su mismo plano, como un parpadeo o una boca. Los planos salen de `review/planos.json` o `--planos`; sin ellos, todo el clip cuenta como un plano. La ventana se cambia con `--ventana-recurrencia S` (0 = nada es recurrente).
   - **SALTO** (falla): todo lo demás. Un transitorio de 1 fotograma nunca es recurrente, aunque se repita (un fallo de costura entre segmentos; la nota dice dónde se repite). Uno de 2–3 que no reúne sus 2 repeticiones también falla, por corto que sea su plano: un parpadeo único no se distingue de un dibujo equivocado. Eso incluye los parpadeos de planos de menos de ~4 s y en la `--vista` a 15 fps, donde un parpadeo de 2 fotogramas del máster dura 1 (compruébalo con `--prueba`, a los fps del máster). Míralo y, si es correcto, pásalo con la línea `--permitir` que imprime. Cada salto lleva su motivo en `review/pops.json`.
   - Los subtítulos palabra a palabra salen como SALTO: sácalos con `--zona-ignorada x,y,w,h` (fracciones del cuadro; se puede repetir) y lo de dentro deja de vigilarse. Un salto permitido que cambia todo el cuadro se avisa como corte duro, sin fallar (los `avisos` de `review/pops.json`).
   - Límite actual: un salto que cae entre el inicio y la vuelta de un transitorio recurrente queda cubierto por él y sale como recurrente, aunque sea de otro bloque, dure 1 fotograma o no vuelva. Mira la hoja, que incluye los 2 primeros recurrentes.
   - Código 0 sin SALTO, 1 si hay alguno, 2 si hay un error. Un salto es un candidato: míralo a velocidad normal.
5. **Comparación medida con la referencia del nicho:** `python <skill>/scripts/comparar.py ref.mp4 nuestro.mp4` (movimiento, cortes duros, negros, luces, saturación, sonoridad, golpes/s y, con las palabras de la voz, fondo bajo la voz). Es lo que demuestra una mejora: no se da por buena a ojo (lección 24).
6. **Crítico independiente** (`critica.md`): otro agente que no construyó los planos, con la rúbrica de 7 criterios y evidencia por segundo o fotograma. Máximo 2 rondas (regla del usuario); después se entrega con pendientes.

### 10. Optimización
- `python <skill>/scripts/bitacora.py --proyecto . inicio <etapa>` / `fin <etapa>`; `render.mjs` anota sus renders solo. `bitacora.py resumen` muestra el cuello de botella del proyecto; `bitacora.py global`, las medianas entre proyectos.
  - `--proyecto` acepta la carpeta del video (`videos/2026-11-17_x`) o su `03-proyecto`: las dos dan la misma clave, el nombre de la carpeta del video, la misma que anota `render.mjs`. `resumen` une `<video>/review` y `<video>/NN-*/review`, y las claves antiguas se normalizan al leer.
  - Los renders salen como `render:<modo>` (vista, prueba, borrador, final): son el desglose de la etapa «render», no una etapa más. Si no marcas «render» a mano, esa etapa vale el tiempo de los `render:<modo>`; nunca se suman dos veces.
  - El tiempo de pared es la unión de intervalos (lo que corre en paralelo cuenta una vez) y el % del cuello de botella se calcula sobre él. Mide tiempo de equipo, no tokens ni créditos (anótalos con `--nota`).
- Cada defecto que se repita en dos videos se convierte en una lección de `leccionero.md` o en una comprobación automática, no en un recordatorio.

## Nivel de referencia del nicho (medido el 18 nov 2026)

Comparación de «The Ancient Jar That Warned an Empire» (Ricks Clips, 35 M de vistas según vidIQ el 18 nov) con nuestro piloto «Te vendieron la Torre Eiffel» (completo v2). Análisis completo en `biblioteca/referencias/ancient-jar/comparacion/` del proyecto de contenidos. Se mide con `scripts/comparar.py` (§9). Las cifras son de **una** referencia: un rango para decidir, no una ley.

| Medida (`comparar.py`) | Referencia | Torre v2 | Regla que entra en la skill |
|---|---|---|---|
| Movimiento mediano | 13,7 | 9,6 | Ninguna toma de más de 4 s sin cambio de escala, de ángulo o de foco. Una órbita o un travelling largo por acto |
| Cortes duros por minuto | 3,7 | 13,7 | Enlace por defecto: fundido de 0,3–0,5 s o *match move* (`transiciones.js`). El corte seco solo en los golpes. Se sigue cambiando de plano cada ~3 s |
| Negros (YLOW) / luces (YHIGH) | 58 / 163 | 47 / 181 | `gradoFinal` al final de `seek`: negros ≈ 55–60 y luces ≈ 160–165 |
| Saturación mediana / p90 | 22,8 / 33,9 | 24,0 / 42,5 | `gradoFinal({ satMax })` para cortar los picos; la mediana ya coincide |
| Fondo (música + ambiente) bajo la voz | 9,2 dB | 11,9 dB | La regla del usuario (música ~20 dB bajo la voz) sigue como predeterminada. Para este nicho se le **propone** el valor medido; no se aplica sin su «sí» |
| Narración | 3,63 p/s en inglés, 3.ª persona en pasado, con diálogos citados | 3,06 p/s en español, 2.ª persona | Ver §2 (narrativa del nicho) |

**Observado en las hojas** (no medido):
- **Personajes de vestuario** con cabeza clara y redonda, cara mínima y cejas que actúan. Una expresión por palabra clave y símbolos (lágrimas de risa, sudor, «Z», «!»).
- **Escenarios densos** en atrezo y en tres profundidades.
- **Atmósfera por escena**: cielo degradado con sol y rayos, noche con luna y antorchas, polvo en la consecuencia.
- Un **objeto protagonista** en 3D con su mecanismo animado causa → efecto.
- **Subtítulos** de 1–2 palabras en minúsculas, pequeños y a altura fija.

### Qué cambia en cada etapa
- **1. Concepto:**
  - premisa verificable con un objeto que se pueda mostrar y un **mecanismo** que se pueda explicar en imagen;
  - comprueba que el tema no esté saturado: las copias del sismoscopio en 4 semanas no pasaron de 26 k vistas frente a 35 M del original;
  - la dramatización se marca como tal en la ficha.
- **2. Guion (Shorts para EE. UU.):**
  - 3.ª persona en pasado;
  - gancho con una frase citada que amenaza o promete en ≤ 4,5 s;
  - burla o error que escala 2–3 veces con un chiste cada 5–8 s;
  - el giro se **muestra** (consecuencia en imagen);
  - un acto de «cómo funcionaba» con el mecanismo;
  - un cierre que revela lo que estaba en juego;
  - 3,5–3,8 p/s.
- **3. Storyboard:**
  - en cada ficha, «¿qué objeto o qué gesto cuenta esta línea?»;
  - una pose o expresión por palabra clave;
  - un plano general de situación por acto (multitud con `crearManada` o paisaje en capas).
- **4. Diseño:**
  - personajes con `kit/cuento.js` (fichas en `PERSONAJE`, guardadas en la biblioteca del canal);
  - presupuesto de **≥ 8 piezas de atrezo** por escenario, en primer término, medio y fondo;
  - `crearCielo` en exteriores;
  - un objeto protagonista con detalle 3D.
- **6. Producción:** `camaraContinua` cuando la intención atraviesa una clave; partículas (`kit/particulas.js`) en el giro; protegidos con `imprescindible: true` para el objeto de cada acción.
- **7. Acabado:** `gradoFinal` con los rangos medidos. El lienzo principal debe crearse con `willReadFrequently: true` (lección 13).
- **8. Sonido — la narración es lo que más pesa en este nicho** (piloto de EE. UU., 18 nov):
  - el usuario rechazó 7 voces que solo leían bien (predeterminadas, «enérgicas» y aceleradas) porque «no generan impacto emocional»;
  - lo que funcionó:
    1. una voz de la biblioteca hecha para *storytelling* viral (Arthur, «Energetic American Male Narrator»), elegida por sus vistas previas gratuitas;
    2. el modelo **v3 en modo creativo** (`stability: 0`);
    3. una **dirección de actuación por frase** con etiquetas (`[scoffing, mocking]`, `[whispers, suspense]`, `[triumphant, shouting]`, `[gulps]`…) que sigue el arco emocional del guion;
    4. **2 tomas por línea**, eligiendo la de más variación de tono e intensidad;
    5. tempo de montaje de hasta ~1,18 (por encima de 1,1, solo si la toma es lenta por la actuación);
  - la emoción se juzga con la **escucha mezclada** (voz, música por secciones y efectos), no con la voz seca;
  - método en el proyecto piloto (`audio/voz_dirigida.py`, `audio/sonido.py`).
- **8. Sonido (medidas):**
  - densidad de golpes dentro de ×0,7–1,4 de la referencia (`comparar.py`): menos «un efecto por palabra» y más fondo continuo;
  - **subtítulos** con `kit/subtitulos.js`, preset `'nicho'` (inglés) o `'grande'` (el de Hanói y la Torre).
- **9. QC:** `python <skill>/scripts/comparar.py referencia.mp4 completo.mp4 --palabras-ref … --palabras …` antes del crítico. Una fila «FUERA» es una pregunta para el crítico y se anota en `REVISION.md`.

## Fluidez: del guion a la cámara y la actuación (18 nov 2026)

Medido en el gancho del piloto US (0–6,6 s, completo v1): la cámara estaba **casi quieta en 108 de 198 fotogramas**
(< 0,15°/fotograma con `velocidadCamara`); los personajes cambiaban de pose en 4 dibujos en línea recta, sin
anticipación ni asentamiento; la doctora dice «Sloppy work» con la boca quieta; y el gesto de señalar cruzaba la mano por
delante de la cara. Ningún control lo marcaba: el movimiento medio estaba dentro de la referencia. Con `kit/director.js`
y `kit/actuacion.js` se rehízo el gancho en una copia del proyecto (`03-proyecto-fluidez`):

| Medida (gancho 0–6,6 s) | Completo v1 | Demostración | Cómo se mide |
|---|---|---|---|
| Fotogramas con la cámara casi quieta | 108 de 198 (55 %) | 8 (4 %) | `velocidadCamara` sobre las claves |
| Velocidad de cámara mediana / máxima (°/fotograma) | 0,14 / 0,47 | 0,41 / 2,36 | ídem |
| Fotogramas con desenfoque de movimiento | 0 | 33 | velocidad > 1,2°/fotograma |
| Aspereza del movimiento (baja = fluye) | 0,26 | 0,10 | `comparar.py` (30 fps) |
| Movimiento mediano a 30 fps | 5,2 | 6,8 | ídem |
| Boca que habla con la voz | no | sí (abre el 60 %, 2,4 cierres/s) | `scripts/envolvente.py` |
| QC (`qc_escena.mjs`, cada 0,1 s) | — | sin FALLA; 8 avisos (lectura y caras que salen en el paneo) | |

Lo que cambia en cada etapa:
- **2. Guion:** cada línea lleva, además del texto, su **beat** (qué cambia), la **emoción**, la **palabra ancla** donde
  aterriza el gesto o la cámara y el **motivo de cámara** (seguir un gesto, revelar escala, acercarse al detalle). Una
  línea sin palabra ancla es una línea en la que no pasa nada en imagen.
- **3. Storyboard:** cada ficha añade el campo **Movimiento** (preset de `mov`, sujeto, motivo y llegada) y la
  **Actuación por palabra** como datos que el director resuelve (`D.resolver`): `['@palabra±s', estado]`. Plantilla en
  `preproduccion.md` («Ficha de movimiento 2.5D»). Si la voz se regraba, los planos se recolocan solos.
- **5. Animatic:** antes de renderizar, `revisarTomas(planos, camaraEn, { ventana: 2.5 })` sobre las claves: una ventana
  sin cambio de ángulo (≥ 12°) ni de escala (≥ 15 %) es un aviso, salvo que el plano lo pida (remate cómico, `mov.fijo`).
- **6. Producción:**
  - cámara: `encadenar(mov.empuje(…), mov.hacia(…), mov.grua(…))` sobre `camaraContinua`. `encadenar` rechaza una junta
    en la que la cámara no coincide (sería un salto dentro de un plano continuo);
  - los gestos empiezan **0,25 s antes** de la palabra que los motiva (`D.t('@palabra') - 0.25`): la anticipación y el
    movimiento principal aterrizan sobre ella;
  - actuación: `crearActuacion(claves, { base, habla })` da anticipación, exceso con resorte, acento de cabeza, inercia
    de ropa, pelo y sombrero y sostén vivo; la mano viaja en **arco**;
  - quien habla en pantalla mueve la boca con `crearHabla(envolvente, { ventanas })`
    (`python <skill>/scripts/envolvente.py audio/voz.wav`);
  - desenfoque: `acumularMovimiento` solo cuando `velocidadCamara` > 1,2°/fotograma, con 4 submuestras y obturador de
    180°. La actuación se queda en el instante del fotograma (los dibujos a 24/s siguen nítidos) y la cámara se emborrona.
    Cuesta ×4 en esos fotogramas: la muestra del gancho se renderizó a 8,3 s por segundo de video;
  - señalar: con `dir` entre −40° y −70° para señalar arriba, o `lado: −1` si el objetivo está al otro lado. Con `dir`
    −125° la mano tapa la cara (lección 35).
- **9. QC:** `comparar.py` incluye fotogramas congelados, **tirones por minuto** y **aspereza**. Medido: la referencia da
  45 tirones/min y 0,07 de aspereza; el concreto v1, 44 y 0,07; la Torre v2, 100 y 0,15 (a golpes).

Límites conocidos: los tirones también cuentan los rebotes de risa a 12 dibujos/s, que son estilo, no fallo (mira dónde
caen); y al seguir un gesto hacia arriba la cámara puede pasar por encima de la cabeza de quien señala: elige `angulo`
para pasar a su lado y compruébalo en los fotogramas.

## Producción diaria: qué va en serie y qué en paralelo

**En serie (cada paso depende del anterior):** guion aprobado → voz grabada → tiempos de voz → planos anclados → muestra autorizada → completo → QC final → entrega.

**En paralelo:**
- Tras aprobar el guion: la voz (API), la música por actos (API, cuando los tiempos de voz estén fijos) y los efectos.
- Durante la producción: escenarios y personajes en archivos distintos (un escritor por archivo, `paralelo.md`); el render de un plano mientras se construye el siguiente (la cola de GPU es una: un trabajo pesado a la vez).
- Investigación del video siguiente mientras se renderiza el actual: CPU/red frente a GPU.

**Cuellos de botella esperados** (confirmar con `bitacora.py`): construir escenarios y personajes nuevos (el trabajo de Claude), el render del completo (GPU) y las rondas de corrección. Mitigaciones: biblioteca reutilizable, caché por plano, vista antes de la muestra, QC automático antes del crítico.

**Escalar a varios videos al día** solo si la bitácora lo demuestra: con una RTX 3050 de 6 GB, un completo de ~60 s a 11 s por segundo de video ocupa la GPU unos 11–12 min, y caben varios al día. El límite real suele ser el trabajo creativo y el costo de la suscripción. Cada video en una sesión nueva y corta, con el estado en archivos; Sonnet para lo mecánico (`costo-por-video`).

**Nunca se automatiza:** la elección del tema, la aprobación del guion, la de la voz y la de la muestra, ni la publicación.
