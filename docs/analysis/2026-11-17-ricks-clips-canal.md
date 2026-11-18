# Ricks Clips (@RicksClips3000): qué acompaña a su rendimiento

17 de noviembre de 2026. Análisis de 6 Shorts del canal, con comparación contra el piloto Hanói v1. Datos en `review/ricks-clips/metricas.json`; hojas, scripts y videos (360×640) en `review/ricks-clips/`. No se publicó nada ni se redistribuyen los videos.

## Resumen en cinco líneas

1. Los Shorts 2.5D de Ricks Clips son una serie de 31 videos en 6 semanas (7 oct–17 nov) con mediana de **8,9 M** de vistas. Los 122 Shorts anteriores del canal son otra cosa (sketches de 9–12 s, mediana mucho menor).
2. Las métricas de forma que medimos (palabras/s, cambios de escena, sonoridad, duración) son **casi iguales** entre el top y el control. Lo que separa a los ganadores en lo observable es **la premisa y el gancho**, no el ritmo de edición.
3. Frente a Hanói v1: ellos hablan a ~3,7 palabras/s (nosotros 2,3), casi **no tienen cortes duros** (0–2 por video; Hanói 32 en 81 s) y enlazan escenas con movimiento de cámara y fundidos; su densidad de cambios de escena (14–20/min) es parecida a la nuestra (22/min). La diferencia es *cómo* se pasa de una escena a otra.
4. Todo lo que sigue sobre retención son **hipótesis**; no tenemos Analytics de ellos.
5. Límite honesto: no se hizo una escucha perceptiva del audio (música/efectos); solo se midió sonoridad, silencios y transcripción.

## 1. El canal en números (observable)

Fuente: lista pública con `yt_dlp --flat-playlist` (153 Shorts) y extracción individual de los 31 de la serie 2.5D (fecha, duración, likes, comentarios). Vistas redondeadas por YouTube en la lista; las del individual son exactas al momento de la lectura.

| Conjunto | n | Mediana | Q1 | Q3 | P90 | Máx. | Mín. |
|---|---|---|---|---|---|---|---|
| Canal completo (153 Shorts) | 153 | 680 k | 151 k | 4,0 M | 9,6 M | 35 M | 21 k |
| Serie 2.5D (31, desde 7 oct) | 31 | 8,93 M | 4,32 M | 11,72 M | 16,78 M | 35,0 M | 42 k* |

\* El mínimo (42 k) es el Short del 17 nov, con menos de un día publicado. Duración mediana de la serie: 60 s (rango 31–78 s). Por tramos: 40–50 s → mediana 8,2 M (8 videos); 50–60 s → 8,5 M (7); 60–70 s → 9,9 M (15); el único de 70+ s → 0,57 M (n = 1, no concluyente). Correlación duración–log(vistas) en la serie: 0,22 (débil).

**Cautela con la edad.** Los 31 salieron en 6 semanas, así que el tiempo acumulado varía de 0 a 41 días. Aun así, el del 15 nov ya tenía 8,5 M a los 2 días y el del 29 oct tiene 5,7 M, por lo que parece que la mayoría de las vistas llega en los primeros días y la edad explica poco entre los de más de 3–4 días. Los de los últimos 1–3 días (por ejemplo, 42 k el 17 nov) no son comparables y no se usaron para concluir nada.

**Top 10 % de la serie** (3 de 31, ≥ 18,7 M): VS1Z_Q-Klt8 (35,0 M, jarra que avisaba de terremotos), 7xS87iActkU (30,0 M, ferrocarriles) y 0m6G8pDtzNs (18,7 M, la sala de no hacer nada en Japón). Justo debajo, entre 16 y 17 M: Mz72MuPgnGY (aceite de tormenta; junto con 7xS87iActkU, ya analizado el 6 nov), PL-Yro2meY4 (bolas de acero y siesta) y eQR3pgMiUF0. Temas del top: historia/ingeniería antigua, cultura/trabajo, neurociencia aplicada.

## 2. Muestra analizada

| ID | Título | Fecha | Dur. | Vistas | Rol |
|---|---|---|---|---|---|
| VS1Z_Q-Klt8 | The Ancient Jar That Warned an Empire | 19 oct | 64,9 s | 35,0 M | Top (historia/ingeniería) |
| 0m6G8pDtzNs | The Job Nobody Wants in Japan | 22 oct | 60,5 s | 18,7 M | Top (cultura/trabajo) |
| PL-Yro2meY4 | Your Brain's Secret Idea Zone | 11 oct | 39,1 s | 16,5 M | Top (ciencia/mente) |
| HxqtHI62otM | The Pink Prison Cell Experiment | 4 nov | 65,3 s | 11,3 M | Top (psicología/experimento) |
| i4hYq1oSXTg | How One Cart Stopped an Entire Army | 11 nov | 66,9 s | 8,9 M | Control: mediana de la serie |
| t3OXkhlI6NQ | Every Memory Has a Price | 26 oct | 77,8 s | 0,57 M | Control: cola baja de la serie |

Nota sobre los controles: el brief pedía dos cerca de la mediana. El canal completo tiene mediana 680 k, pero casi todo lo que hay cerca de esa cifra son sketches antiguos de 10 s, de otro formato; no sirven como control. Se usó por eso la mediana de la serie 2.5D (i4hYq1oSXTg) y, como contraste, el peor rendimiento de duración comparable (t3OXkhlI6NQ). Sigue siendo n = 1 por grupo: **no hay base estadística**, solo observaciones.

Los videos bajaron a 360×640 a 30 fps (el formato disponible sin runtime JS); sirve para medir y mirar, no para juzgar acabados de píxel.

## 3. Métricas observables

Métodos: duración con ffprobe; transcripción con faster-whisper (`small`, int8) con marcas por palabra; sonoridad con `ebur128`; silencios con `silencedetect` (−40 dB, ≥ 0,25 s); cambios con diferencia de fotogramas (ver abajo); hojas de 6 fps (primeros 3 s) y 1 fps (completo), todas generadas; se miraron 5 de las 6 hojas completas/de gancho (VS1Z completa y primeros 3 s, 0m6G, t3OX y PL-Yro completas, HxqtHI primeros 3 s).

| Video | Dur. s | Palabras | Pal./s | Cortes duros | Cambios de escena (est.) | Cambios/min | Escena media s | LUFS | LRA | Silencios ≥ 0,25 s |
|---|---|---|---|---|---|---|---|---|---|---|
| VS1Z (top) | 64,9 | 235 | 3,63 | 1 | 20 | 18,5 | 3,1 | −14,0 | 2,2 | 0 |
| 0m6G (top) | 60,5 | 224 | 3,73 | 0 | 20 | 19,8 | 2,9 | −14,0 | 1,8 | 0 |
| PL-Yro (top) | 39,1 | 145 | 3,76 | 0 | 11 | 16,9 | 3,3 | −15,6 | 3,5 | 0 |
| HxqtHI (top) | 65,3 | 237 | 3,65 | 2 | 17 | 15,6 | 3,6 | −14,1 | 2,2 | 0 |
| i4hYq (control) | 66,9 | 235 | 3,53 | 1 | 16 | 14,4 | 3,9 | −14,1 | 2,9 | 0 |
| t3OX (control) | 77,8 | 295 | 3,80 | 0 | 24 | 18,5 | 3,1 | −14,0 | 1,9 | 0 |
| **Media de los 6** | | | **3,68** | | | **17,3** | **3,3** | −14,3 | 2,4 | 0 |
| Hanói v1 (nuestro) | 81,3 | 174 | **2,3** | **32** | 30 | 22,1 | 2,7 | −14,1 | 5,9 | 0 |

**Sobre los cortes.** El detector estándar (`scdet` con umbral 10) encontró 0–2 cortes por video en los 6 Shorts, y en Hanói v1 encontró decenas. No es que los de Ricks no cambien de escena (las hojas muestran un cambio de lugar cada ~3 s): casi no usan corte seco, sino mezclas y movimientos de cámara que enlazan una escena con la siguiente. Por eso se midió también con un detector propio (`scripts/cortes.py`: diferencia de fotogramas a baja resolución; «cambio de escena» = variación sostenida mayor a un umbral, fusionando cambios a menos de 0,7 s). Esa cifra es una **estimación**, no un recuento de planos: no cuenta movimientos de cámara dentro de una escena, y el tutorial del 6 nov mostró 32/53/48 planos para los otros tres Shorts, cifras mayores porque cuentan planos con cámara viva dentro de cada escena. Aplicado el mismo detector a Hanói v1 da 32 cortes duros y 30 cambios.

**Sobre el audio.** Ninguno tiene un silencio ≥ 0,25 s bajo −40 dB; la voz arranca en el segundo 0,0 en los seis y no hay pausas largas de voz (solo 2 pausas ≥ 0,4 s, ambas en 0m6G, 13,1 s y 21,2 s). La sonoridad integrada es −14 LUFS en cinco (−15,6 en PL-Yro) y el rango dinámico es bajo (LRA 1,8–3,5 LU). O sea, el audio de Ricks es **plano y denso**; no usan el silencio como golpe. Lo que sí hacen distinto es la velocidad: 3,5–3,8 palabras/s de media sin pausas.

## 4. Análisis por Short

Todas las citas de transcripción van parafraseadas o muy cortas.

### VS1Z — la jarra que avisaba de terremotos (35 M)

- **Gancho (0–3 s):** primera imagen, un funcionario de rostro pequeño y expresivo sosteniendo una bola dorada junto a una jarra gigante con dragones; en menos de 3 s la cámara se mete en la boca del dragón (macro, luz de brasero). Primera frase (~19 palabras, cerca del límite): un hombre pone una bola en la boca de un dragón y avisa al emperador de que, si cae, huya. Promete: una **predicción absurda** y una pregunta (¿qué pasa cuando cae?). El elemento extraño (bola + dragón + rana) está en el primer fotograma.
- **Estructura:** 0–7 s gancho y burla de la corte; 7–18 s planteamiento (8 dragones, ranas) y soberbia del emperador; 18–29 s primer intento fallido (cae una bola, nada) y expulsión; 29–46 s soledad, la noche en que caen todas, la advertencia ignorada y las burlas; 46–58 s consecuencia (palacio en ruinas) y mecanismo del péndulo; 58–65 s remate: una bola = temblor lejano; ocho = el terremoto mayor, justo debajo. No hay cierre de loop textual; termina en una imagen (corte geológico).
- **Animación:** personajes 2D de contorno grueso, cabeza redonda blanca, rasgos mínimos y mucha expresión de ojos; escenarios 3D con textura y luz (salón del trono, murallas, cielo del amanecer, mazmorra nocturna); cambios de paleta por acto (cálido → atardecer → noche azul → ámbar). Cámara: macros y empujes continuos, y vistas de otro ángulo del mismo objeto (interior del péndulo). Transiciones: fundidos y barridos; un único corte duro en 3,07 s.
- **Ritmo:** densidad constante de cambio cada ~3 s; no se aprecia una frenada marcada en el giro (a 46 s hay un cambio de escena largo con humo, pero la voz no se detiene).
- **Captions:** 1–3 palabras, mayúscula/minúscula normal, blancas con borde oscuro, en el tercio inferior-medio, sin color de énfasis. Se leen sobre los personajes a ratos.

### 0m6G — la «sala de no hacer nada» en Japón (18,7 M)

- **Gancho:** botón rojo de FIRE con pantalla azul y cuadros de oficina; frase: es imposible despedir en Japón, pero las empresas encontraron algo peor. Promete un castigo oculto. Es una **tesis seguida de una promesa de peor cosa**, en segunda persona a partir del segundo 4 («imagina que tu jefe…»).
- **Estructura:** 0–4 s gancho; 4–20 s POV (te llevan a la sala vacía), 20–41 s escalada social (miradas, correos que paran, escritorio ocupado), 41–45 s giro (el compañero ya no está), 49–60 s explicación legal y remate («no hay ley contra hacerte miserable»).
- **Animación:** el diseño más «cómico» de los analizados, con cámara que gira alrededor de objetos (reloj, teléfono, puerta), fondos con iluminación diurna y nocturna, y un cambio de paleta frío/violeta para el acto final. Fundidos y barridos frecuentes (no hay corte duro).
- **Narrativa clave:** el espectador es el protagonista (segunda persona), y la revelación llega de forma humana (la ausencia del compañero) antes de la explicación legal.

### PL-Yro — dormir con dos bolas de acero (16,5 M; 39 s)

- **Gancho:** primer fotograma: personaje con ojos cerrados de pie sobre círculos concéntricos, con bola de acero a cada lado; frase: si te duermes sosteniendo dos bolas de acero, podrías despertar genio. Promesa directa de **beneficio personal** (hazlo tú).
- **Estructura (39 s):** 0–4 s promesa; 4–12 s instrucciones del experimento; 12–19 s mecánica del despertar (cerebro translúcido en azul); 19–23 s referencia a Edison; 23–31 s explicación (hipnagogia, escena de «fondo del mar» para los niveles de sueño); 31–39 s remate y vuelta al plano inicial (loop visual: termina con las bolas en las manos).
- **Animación:** el más cercano a «motion explicativo»: infografías diegéticas (escala de profundidad del sueño, tablón de pistas con hilos, ascensor), cerebro translúcido, cara con efecto de agua. Cámara: fija en plano frontal para las instrucciones, con acercamientos a ojos; paleta oscura cálida.
- Es el más corto del muestreo y de los de mayor rendimiento por segundo.

### HxqtHI — la celda rosa (11,3 M)

- **Gancho:** el primer plano es un guardia pintando con rodillo largo una pared que va a quedar de un rosa fuerte, con luz de ventana; frase: pintaron la celda de rosa, y no cualquier rosa. Pregunta: ¿qué rosa y por qué? La receta exacta sale en un cartel diegético a los 3 s (texto dentro del mundo).
- **Estructura:** 0–14 s montaje del experimento; 14–22 s regla extraña (15 minutos con cronómetro); 22–37 s demostración (el preso enorme y la «prueba» del pulso, con un chiste al segundo 36); 37–53 s el guardia olvida a un preso y todo se rompe; 53–65 s explicación y remate (a los 15 minutos calma; después, lo contrario). Cierre cuantitativo («15 minutos») que repite el dato del gancho.
- **Animación:** personajes caricaturescos (guardia con gorra, preso corpulento), fondos de bloque con luz de ventana, paleta fría con un solo color saturado (el rosa) como motivo. Es el mejor ejemplo de **un motivo de color por historia**.

### i4hYq — carro de flechas cohete (8,9 M, control cercano a la mediana)

- **Gancho:** frase de ~30 palabras en una sola oración larga («perforó 82 agujeros… mientras todos afilaban espadas»): se entiende, pero el gancho es más largo (6 s para llegar al «raro») y la pregunta es menos inmediata. Dos lecturas posibles: un buen ritmo de intriga o una frase que tarda en llegar a la promesa.
- **Estructura:** la intriga es buena (el comandante bromea, la cuerda que nadie toca, la lluvia, el ejército cerca) y el remate visual está bien conseguido. Pero la cadena sólo cobra sentido en el último tramo (48–66 s).
- **Animación:** muy parecida a los top (misma cadencia de ~14 cambios/min, 1 corte duro, 3,9 s por escena). No hay diferencia técnica visible con los top.

### t3OX — «Every Memory Has a Price» (0,57 M, control cola baja)

- **Gancho:** primera imagen oscura (mostrador, figura sombría), frase: vendió su recuerdo más feliz a un extraño detrás de un mostrador. Es **una premisa de ficción** (un mundo inventado), no un hecho del mundo real, y arranca con una escena abstracta; el espectador no tiene un dato verificable ni un «¿es verdad?».
- **Estructura:** 78 s (la más larga, la única de más de 70 s), con mucho planteamiento del mundo (0–31 s) antes del conflicto del hermano enfermo; tono triste (final trágico). Sin giro de «mecanismo real» ni explicación del tipo «por eso funciona así».
- **Animación:** de las más cuidadas de la muestra (paletas por lugar, medidor de felicidad, tablón de años vendidos) y con un ritmo de cambios igual al de los top (18,5/min). Es decir, **el rendimiento no se explica por una peor animación ni por un ritmo distinto**.
- Dato curioso: su tasa de likes por vista (3,8 %) es la más alta de los seis, así que quien lo ve lo valora; lo que parece fallar es que llegue a más gente. Es una pista, no una prueba.

## 5. Patrones transversales (observables)

**Voz y captions.** Voz masculina neutra, con locución continua y rápida (3,5–3,8 palabras/s medidas), sin pausas, desde el segundo 0. Captions de 1–3 palabras, blancas con borde, sin color de énfasis en lo visto, a la altura del tercio inferior del encuadre; en varios planos tapan parte del personaje.

**Identidad visual.** Personajes 2D de contorno grueso con cabeza redonda blanca, ojos grandes expresivos, cuerpos de dos trazos; escenarios 3D con textura, luz y profundidad. La combinación 2D sobre 3D es la marca. Cada historia usa una paleta propia y cambia de paleta por acto.

**Gancho.** En los seis, la imagen de apertura contiene el objeto extraño de la promesa (bola en la boca del dragón, botón FIRE, bolas de acero, rosa en la pared). Cuatro de los seis abren con una **paradoja o contradicción** («es imposible despedir pero…», «pagaron… y terminó…») o con una **orden/predicción absurda**; uno abre con una orden concreta de «hazlo tú». El control de cola baja abre con una premisa inventada.

**Narración.** Esquema dominante: promesa/paradoja → planteamiento corto → intentos fallidos o escalada → giro → explicación breve → remate que reencuadra («así que lo absurdo tenía lógica»). Las explicaciones técnicas llegan al final, ya con el espectador enganchado por la historia. En segunda persona o con un protagonista concreto (inventor, empleado, guardia).

**Cámara y transiciones.** Casi todo el movimiento es de cámara dentro de un mundo 3D continuo: empujes, órbitas, macros; entre lugares, mezclas y barridos en vez de cortes duros (0–2 por video).

**Sonido (límite).** Se midió que no hay silencios y que la sonoridad es estable. No se auditó la música ni los efectos de forma perceptiva, así que no se afirma nada sobre su diseño.

## 6. Top frente a control: diferencias observables

| Aspecto | Top (4) | Control mediana (1) | Control bajo (1) | ¿Diferencia observable? |
|---|---|---|---|---|
| Palabras/s | 3,63–3,76 | 3,53 | 3,80 | No |
| Cambios/min | 15,6–19,8 | 14,4 | 18,5 | No (el de la mediana es algo menor) |
| Escena media (s) | 2,9–3,6 | 3,9 | 3,1 | Leve (más lento el de la mediana) |
| LUFS / LRA | −14 / 1,8–3,5 | −14,1 / 2,9 | −14,0 / 1,9 | No |
| Duración | 39–65 s | 66,9 s | 77,8 s | Posible (el bajo es el más largo; n = 1) |
| Naturaleza de la premisa | Hecho/mecanismo del mundo real, paradoja visible | Hecho real, gancho largo | Ficción original, mundo inventado | **Sí** |
| Gancho (≤15 palabras) | Promesa o paradoja corta, objeto extraño visible | Una frase larga que tarda en llegar al «raro» | Premisa abstracta sobre una imagen oscura | **Sí** |
| Final | Mecanismo o regla que reencuadra todo | Remate visual fuerte | Giro emocional sin dato real | Probable |

**Lectura.** La edición (ritmo de cambio, voz, mezcla) es una constante del canal: es **fábrica**, no ventaja diferencial entre sus ganadores y sus perdedores. Lo observable que cambia con el rendimiento es el tipo de premisa y el gancho. Con n = 4 + 2 esto es una pista, no un resultado.

## 7. Hipótesis sobre retención (no medidas)

H1. **Paradoja verificable en el primer cuadro.** Si la imagen inicial contiene el objeto raro y la frase lo declara en menos de 4 s, el espectador tiene motivo para esperar el giro. Apoyo: los 4 top y el gancho de VS1Z/HxqtHI.
H2. **Una historia real que termina en una regla.** El remate que explica el mecanismo («así funcionaba la jarra», «así funciona la hipnagogia») da una razón para compartir o reverlo. Apoyo: top frente a la ficción de t3OX.
H3. **Segunda persona y desafío.** «Imagina que tu jefe…» y «si te duermes sosteniendo…» interpelan al espectador. Apoyo parcial: 0m6G y PL-Yro.
H4. **Velocidad de voz sostenida (~3,7 palabras/s) más una escena nueva cada ~3 s** mantiene la sensación de movimiento sin recurrir al corte duro. No se puede aislar su efecto, porque también el control lo hace.
H5. **Paleta por acto y un motivo de color** (el rosa de HxqtHI) ayudan a recordar y a distinguir actos. Sin prueba.
H6. **Un Short de 39 s con la historia comprimida puede rendir como uno de 65 s.** Apoyo débil: PL-Yro (39 s, 16,5 M) frente al resto.
H7. **Los Shorts de más de 70 s o con ficción triste tienen techo menor.** Un solo ejemplo (t3OX); no concluyente.

Nada de esto equivale a tasas de retención: no tenemos Analytics de ese canal.

## 8. Comparación con Hanói v1

Datos de Hanói: `DIAGNOSTICO-V1.md` y medición propia con el mismo detector (32 cortes duros, 30 cambios de escena estimados en 81,3 s). No se reabrieron las hojas de Hanói para este informe; la comparación visual se apoya en el diagnóstico existente y en las hojas de Ricks.

| Dimensión | Ricks (media de los 6) | Hanói v1 | Diferencia |
|---|---|---|---|
| Duración | 39–78 s (mediana 65 s) | 81,3 s | Más largo que todos ellos |
| Palabras/s al hablar | 3,5–3,8 | 2,3 | −35 % en nosotros |
| Palabras totales | 145–295 | 174 en 81 s | Con 81 s a su ritmo cabrían ~300 palabras |
| Transición entre escenas | Fundido/barrido y cámara continua; 0–2 cortes duros | 32 cortes secos (2,4 s de media) | Distinto estilo, misma densidad de cambio |
| Cambios de escena/min | 14–20 | 22 | Nosotros ya cambiamos tanto o más |
| Sonoridad / LRA | −14 / 1,8–3,5 | −14,1 / 5,9 | Mismo nivel; nuestra dinámica es mayor |
| Silencios | 0 | 0 | Igual |
| Primera imagen y frase | Objeto extraño de la promesa en el primer cuadro | Frase que abre con la fecha (según el diagnóstico); la paradoja se completa a los 6,5 s | Nosotros llegamos más tarde |
| Captions | 1–3 palabras blancas con borde, sin énfasis | 1–3 palabras con amarillo en palabras que no importan | Similares en tipografía; el amarillo no aporta |
| Personajes | 2D de contorno grueso sobre decorado 3D | Ratas y oficial con contorno grueso sobre 2.5D | **Parecidos** (ver más abajo) |
| Motivos por historia | Paleta por acto, un motivo de color | Saturación constante | Nos falta guion de color |

Dos matices importantes para no sacar la conclusión equivocada:

- **No estamos cortando de menos ni de más.** La preocupación de «28 cortes en 81 s» no es lo que nos separa de ellos: su cambio de escena es igual de frecuente. Lo que cambia es que ellos esconden los cambios en la cámara y en fundidos, y nosotros usamos corte seco con cámara casi fija.
- **El problema fuerte es la voz y el gancho.** 2,3 palabras/s contra 3,7 convierte nuestros 81 s en lo que ellos cuentan en ~50 s. Y el «más ratas» llega a los 6 s, no en el primer cuadro.

## 9. Patrones aplicables a nuestros Shorts (por impacto)

1. **Locución a 3,3–3,8 palabras/s, sin pausas largas, desde el segundo 0** (impacto alto, coste bajo). Meta: 175–200 palabras por 55–60 s. Probar en el guion v2 antes de rodar nada.
2. **Gancho de ≤ 15 palabras con la paradoja y el objeto extraño visible en el primer cuadro** (alto). Plantilla: sujeto + acción absurda + consecuencia que se promete. Para Hanói: la rata con la moneda, el cartel de «1 centavo por rata» y la frase del pago en los primeros 3 s.
3. **Elegir premisas con mecanismo real y remate que reencuadra** (alto, hipótesis H2). Ranking de temas: paradoja histórica/ingeniería, «cómo funcionaba»; evitar mundos inventados tristes de más de 70 s.
4. **Segunda persona o desafío en el planteamiento** (medio-alto): «imagina que…», «haz esto y…».
5. **Pasar de escena con cámara o fundido motivado en lugar de corte seco** (medio): empujes, macros, enlaces por forma. Encaja con la lista de oportunidades ya escrita en `DIAGNOSTICO-V1.md` (cámara que acompaña, enlace moneda → alcantarilla → sello).
6. **Una paleta por acto y un solo motivo de color** (medio): en Hanói, el rojo del sello y el ámbar del farol.
7. **Remate con un dato o regla en la última frase** y, si se puede, volver a la imagen inicial (loop visual, como PL-Yro) (medio).
8. **Duración 40–65 s** (bajo-medio, evidencia débil): preferible 45–60 s con la historia comprimida.
9. **Un solo caption de 1–3 palabras sin color de énfasis salvo la palabra clave real** (bajo): lo hacen ellos, pero no es lo que los diferencia.

**Un error que evitar al imitar el ritmo:** el silencio y el cambio de dinámica no son una táctica de ellos (no tienen silencios). El silencio en el giro es una idea nuestra (`DIAGNOSTICO-V1.md`), no una técnica observada en Ricks Clips; habría que probarla por separado.

## 10. Qué NO copiar

- **Identidad:** personajes de cabeza redonda con ojos expresivos y contorno grueso sobre fondo 3D es su firma; los nuestros ya se parecen demasiado (ratas y oficial de contorno grueso). Conviene separar el diseño de personaje y de color: el «Libro de cuentas» de la v2 va en esa dirección.
- **Caption en blanco con borde en el tercio inferior** es el estilo genérico de la categoría; no aporta identidad.
- **Guiones, giros y temas de ellos:** no reutilizar jarra de Zhang Heng, celda rosa, siesta de Edison, ni sus estructuras escena por escena. Tomar el *tipo* de patrón, no la historia.
- **Derechos:** no extraer ni redistribuir sus imágenes, personajes, voz ni música; los videos de este análisis son material de estudio y no deben publicarse. Tampoco imitar su marca visual para confundir al público.
- **Precisión de las historias:** varias de sus historias (jarra, celda rosa, siesta de Edison) mezclan hechos con licencias de relato; comprobar datos propios antes de publicar, en lugar de tomar sus versiones.
- **Duración y ficción triste de 78 s** del control bajo: no es lo que funcionó para ellos.

## 11. Limitaciones

- n = 6 videos de un solo canal; ningún dato de retención, CTR ni fuente de tráfico. Vistas, likes y comentarios son los públicos.
- La estimación de cambios de escena es propia y aproximada; `scdet` estándar no sirve para este estilo. Se revisaron las hojas de 1 fps para comprobarlo en 5 de los 6 videos, no todos los cortes.
- Resolución de 360p; los rasgos de acabado fino (texturas, grano, bordes de caption) no se juzgan.
- No se auditó el audio de forma perceptiva (música, efectos, mezcla relativa); solo transcripción, sonoridad y silencios.
- Los otros tres Shorts del 6 nov (storm oil, railroads, mirror horse race) se tomaron del informe previo y no se repitieron; tienen estructura y duración (~64–65 s) coherentes con lo aquí visto.
- Hanói: no se revisaron de nuevo las hojas 01–05; se usó el diagnóstico escrito y una nueva medición de cortes.

## Archivos

- `review/ricks-clips/metricas.json`: métricas, rol y agregados por video.
- `review/ricks-clips/metricas_raw.json`, `cortes_raw.json`, `hanoi_cortes_raw.json`: salidas crudas (palabras con marcas, cortes).
- `review/ricks-clips/hojas/<id>/primeros3s.jpg` y `completo1fps.jpg`.
- `review/ricks-clips/scripts/` (`medir.py`, `cortes.py`, `armar_json.py`, `stats.py`, listas de vistas y metadatos).
- `review/ricks-clips/videos/`: los 6 MP4 descargados (material de estudio, no se redistribuye).
