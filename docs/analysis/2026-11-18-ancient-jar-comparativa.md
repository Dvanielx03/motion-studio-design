# Análisis comparativo · referencia vs. producción actual

> Copia del informe del proyecto de contenidos (18 nov 2026), incorporada al repositorio como registro de observaciones. Las rutas son relativas a esa carpeta de trabajo, no a este repositorio. Las cifras públicas y lo observado se separan de las hipótesis.

18 nov 2026. **Referencia:** «The Ancient Jar That Warned an Empire» (`../ancient-jar.mp4`, SHA-256 `4c0f2ccb…`, 720 × 1280, 30 fps, 64,9 s). **Producción actual:** «Te vendieron la Torre Eiffel», completo v2. El `v8.mp4` recibido es el mismo archivo, con SHA-256 `4c2699…` idéntico a `05-render/torre-eiffel_completo_v2.mp4`: 1080 × 1920, 30 fps, 61,3 s.

**Método.** Las dos piezas se midieron con las mismas herramientas de la skill:
- `scripts/referencia.py`: color y luminancia a 1 fps, con FFmpeg `signalstats`;
- `ritmo.py` y `pops.py`: movimiento, cortes y golpes de sonido;
- FFmpeg `ebur128`: sonoridad;
- faster-whisper: transcripción de la narración con tiempos por palabra;
- `_fondo.py`: nivel del fondo sonoro entre palabras.

Las observaciones visuales salen de hojas de contacto a 1 fps (`../analisis/…/hoja-0N.jpg` y `nuestra/…/hoja-0N.jpg`) y de los fotogramas revisados durante la producción. Este documento distingue lo **medido** de lo **observado**.

## Métricas medidas

| Métrica | Referencia | Nuestra (v2) | Lectura |
|---|---|---|---|
| Narración | 235 palabras en 64,8 s = **3,63 p/s** (inglés, 3.ª persona, pasado) | 3,06 p/s (español, 2.ª persona, presente) | En la referencia, más historia por segundo |
| Movimiento mediano (`ritmo.py`) | **11,31** | 8,43 | La referencia se mueve un 34 % más |
| Cortes duros (`ritmo.py`) | **0** detectados (`pops.py` ve 8 cambios bruscos) | 15 cortes secos | La referencia enlaza con fundidos y cámara continua |
| Cambios de plano contados en las hojas | ≈ 22 en 65 s (uno cada ≈ 3 s) | 16 planos (uno cada ≈ 3,8 s) | Cambia de plano tanto o más que nosotros, pero sin cortes secos |
| Luminancia media (YAVG, mediana) | 101,7 | 99,9 | Igual |
| Saturación (SATAVG, mediana / p90) | 22,8 / **33,9** | 24,2 / **42,0** | Parecida de media; nuestros picos saturan más (plano cian, cortinas rojas) |
| Negros (YLOW, mediana) | **58** | 46 | La referencia levanta las sombras (bruma de cuento) |
| Altas luces (YHIGH, mediana) | **158** | 172 | La referencia comprime las luces: menos contraste |
| Sonoridad integrada / LRA | −14,1 LUFS / 2,1 LU | −14,0 LUFS / 2,0 LU | Igual |
| Fondo (música + ambiente) en los huecos de la voz | **≈ 9 dB** bajo la voz | ≈ 12 dB bajo la voz | En la referencia, la música está más presente |
| Golpes sonoros por segundo (`ritmo.py`) | **1,3–2,3** | 3,5–4,6 | Usamos el doble de acentos |
| Ancho estéreo | 0,02–0,04 | 0,03–0,18 | Las dos son casi mono |
| Subtítulo | 1–2 palabras, minúsculas como se dicen, ≈ 3,5 % del alto, blanco con contorno fino, siempre a ≈ 0,66 del alto | 2–4 palabras, MAYÚSCULAS, 5 % del alto, posición variable según el plano | Nuestro texto ocupa 3–4 veces más área y salta de sitio |

## 1. Animación

| Tiempo | Referencia: qué funciona | Nuestra: qué falla | Corrección técnica |
|---|---|---|---|
| R 0,0–4,0 | La expresión cambia con cada palabra clave: neutra → firme («this ever») → ojos saltones («out!»). El brazo lleva la bola a la boca del dragón | **N 0–1,8:** Lustig hace un solo gesto; su mano pasa por delante de la cara (0,6–1,0) | Una pose o expresión por palabra clave, en la ficha de plano. Comprobar que la mano no cruza la cara (QC de pose) |
| R 5–7 / 23–26 | La risa se actúa con el cuerpo: rebote, dientes, ojos cerrados, **lágrimas de risa** (24 s) | **N 13–22:** Lustig «explica» con un balanceo de mano; los invitados no cambian de pose | Biblioteca de **símbolos de expresión** (lágrimas, sudor, «Z», estrellas, venas) y ciclos de risa o susto con rebote |
| R 33–40 | Duerme («Z Z»), se despierta de golpe, corre y suda entre rejas | **N 48–52:** te das la vuelta en 2 dibujos y te sonrojas: se lee, pero es un cambio de estado sin acción | Actuación en 4 tiempos (anticipación → acción → exageración → asentamiento), ya en la guía y poco aplicada: falta biblioteca de poses |
| R 49–57 | El mecanismo se anima **causa → efecto**: el péndulo choca con la varilla, la varilla abre la mandíbula y cae la bola | **N 13–22:** la torre dibujada se desmonta y caen monedas. Es la mejor metáfora visual de nuestro video (la crítica coincide) | Dedicar un acto a un **objeto protagonista con mecanismo** animado en 3D |
| Personajes en general | Siluetas de vestuario (túnica, armadura, corona) con cabeza blanca redonda y cara mínima (puntos, cejas gruesas, boca de línea) | Figura de palitos con cabeza color piel, ojos grandes con brillo y contorno muy grueso: el registro es más infantil y no cambia de vestuario por escena | Nuevo modelo de personaje «cuento» (ver §3) |

## 2. Cinematografía

| Tiempo | Referencia | Nuestra | Corrección |
|---|---|---|---|
| R 5→6, 7, 13, 40 | **Fundidos** (doble exposición a 7 s) y empujes que atraviesan un objeto (13 s: entra en la boca de la rana) | N 22,7 / 24,4 / 30,9 / 33,5 / 40,3 / 42,15 / 48,3 / 52,0 / 59,6: cortes secos | Fundido de 0,3–0,5 s o *match move* como enlace por defecto; el corte seco solo en los golpes (`transiciones.js` ya los tiene) |
| R 8–12 | Órbita lenta alrededor de la vasija: muestra las ocho cabezas sin cortar | N 52–57: arco alrededor de Lustig. Bien, pero es el único arco del video | Una órbita o un travelling largo por acto, con `camaraContinua` (Hermite) |
| R 14–16, 27–31, 46–48 | Planos generales con escala y mucha profundidad: el ejército de cientos de figuras, la puerta de la ciudad, la colina al atardecer, la ciudad en ruinas | Planos generales solo en París (3,3–5,6) y la torre (52–59) | Al menos un plano general de situación por acto, con multitud (`crearManada`) o paisaje en capas |
| R 20 | Plano creativo: el emperador **reflejado en el vino** («not even a ripple») | Sin planos de ese tipo | En la ficha de plano: «¿qué objeto cuenta esta línea?» |
| **N 33,5–40,3 y 42,15–48,3** | — | 6–7 s con el mismo encuadre: el guante y la cara, y los papeles en gris (la crítica los marcó como monótonos) | Ninguna toma de más de 4 s sin un cambio de escala, de ángulo o de foco |

## 3. Diseño visual

| Tema | Referencia | Nuestra | Corrección |
|---|---|---|---|
| Escenarios | **Densidad de atrezo:** vitrales, tronos, alfombras con dibujo, estandartes, antorchas, mesas de banquete, huertos, árboles, montañas, nubes | Pocas piezas: la torre y los tejados son buenos; el pasillo, la comisaría y el expediente son planos y vacíos | Un «presupuesto de atrezo» de ≥ 8 elementos por escenario, en tres profundidades (primer término, medio, fondo) |
| Objeto protagonista | Vasija de bronce con dragones dorados, ranas y péndulo interior: material metálico y detalle 3D | Cartel, carta y plano: objetos planos con textura | Un objeto 3D detallado por video (modelado por código o en Blender, `recursos25d.py`) |
| Proporciones | Cabeza ≈ 1/3 del cuerpo, cuerpo de vestuario sólido | Cabeza ≈ 40 % del cuerpo y cuerpo de palitos | Hoja de personaje con proporción y vestuario por época |
| Coherencia | Un acabado de cuento uniforme en todos los escenarios | La torre y el salón destacan; el expediente y la comisaría se ven más pobres (la crítica lo marcó) | Biblioteca de materiales y texturas común a todos los escenarios |

## 4. Iluminación y atmósfera

| Tiempo | Referencia | Nuestra | Corrección |
|---|---|---|---|
| R 30–31 | Atardecer: cielo degradado rosa y naranja, sol con **rayos**, colina en silueta | N 3,3–5,6: el cielo nocturno de París está bien, pero no hay rayos ni capas | Utilidad `crearCielo` (degradado, sol, rayos y nubes en capas) |
| R 33–45 | Noche azul con luna y antorchas cálidas (contraste frío y cálido) | N 30,9–40,3: el pasillo frío con aplique ámbar va en esa dirección | Mantener: una luz cálida motivada en cada escena fría |
| R 46–48 | Polvo y humo naranja, pájaros: la consecuencia se ve en la atmósfera | N 42–48: la verdad en gris, sin atmósfera | Partículas o humo en el giro (`kit/particulas.js`) |
| Medido | Negros a 58 y luces a 158: imagen suave | Negros a 46, luces a 172 y picos saturados (p90 de 42) | **Gradación final** (`gradoFinal`): levantar negros, comprimir luces y limitar la saturación al rango de la referencia; verificarlo con `comparar.py` |

## 5. Narrativa y ritmo

| Tiempo | Referencia | Nuestra |
|---|---|---|
| Gancho | **R 0–5:** una cita con amenaza («if this ever falls out, run!»). El objeto y el personaje están en el fotograma 0 | **N 0–3,2:** «Te están vendiendo la Torre Eiffel… y vas a pagar». Fuerte; el objeto está en el fotograma 0 |
| Progresión | La burla escala tres veces (corte, emperador, guardias) → exilio → catástrofe → explicación → amenaza total | Cuatro hechos en fila (carta, reunión, plano, periódico) → soborno → huida → verdad → vergüenza → vuelve |
| Humor | Un chiste cada ≈ 5–8 s («the world's most expensive toy», «the toy guy», «did your frogs get hungry again?») | Casi sin chistes: tono de crónica |
| Diálogo | Frases citadas de personajes (3) | Ninguna: todo lo cuenta el narrador |
| Giro | Se **muestra**: ruinas (47 s) y mecanismo (49–57 s) | Se **dice**: «si pide un soborno, tiene que ser…» (34–38 s), con un primer plano |
| Cierre | Revela lo que estaba en juego: el terremoto bajo el imperio (62–65 s, corte geológico) | Moraleja y bucle (57–61 s) |

## 6. Sonido

- **Medido:** la referencia mantiene un fondo musical más presente (≈ 9 dB bajo la voz en los huecos frente a ≈ 12 dB nuestros) y la mitad de golpes por segundo. Su paisaje sonoro es más continuo y menos «efecto por palabra».
- **Observado** (sin escucha humana: ningún agente puede oír): nuestra mezcla tiene 60 efectos en 61 s. Lo más probable es que suene recargada frente a la referencia.
- **Corrección:** densidad objetivo de 1,5–2,5 acentos por segundo, medida con `ritmo.py`. El nivel de la música se decide por nicho con `comparar.py` contra su referencia. La regla del usuario (música unos 20 dB bajo la voz) se mantiene como predeterminada y la desviación se le propone medida, no impuesta.

## Prioridades para la skill (de mayor a menor impacto)

1. **Personajes de cuento y actuación:**
   - hoja de personaje con vestuario;
   - símbolos de expresión;
   - ciclos de risa, susto y carrera;
   - una expresión por palabra clave.
2. **Enlaces suaves y tomas que se mueven:** fundido o *match move* por defecto, `camaraContinua`, ninguna toma de más de 4 s sin cambio y un plano general por acto.
3. **Atmósfera y gradación:** `crearCielo`, partículas en el giro y `gradoFinal` con los rangos medidos de la referencia.
4. **Atrezo y objeto protagonista:** presupuesto de atrezo por escenario y un objeto 3D con mecanismo animado.
5. **Narrativa del nicho para EE. UU.:**
   - 3.ª persona en pasado;
   - un diálogo como gancho;
   - burla o error que escala;
   - el giro mostrado;
   - un cierre que revela lo que estaba en juego;
   - 3,5–3,8 p/s.
6. **Subtítulos del nicho:** 1–2 palabras, minúsculas como se dicen, tamaño pequeño y posición fija salvo colisión.
7. **Sonido menos denso** y música medida contra la referencia del nicho.
8. **Verificación:** `comparar.py` produce esta tabla de métricas para cualquier par de videos, de modo que una mejora se demuestre con números y no a ojo.

## 2. Audiencia

Ver [AUDIENCIA.md](AUDIENCIA.md). Ahí se separa lo verificable (vistas, fechas, canal) de las hipótesis de retención.
