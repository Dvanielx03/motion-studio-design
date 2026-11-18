# Leccionero 2.5D

Lecciones comprobadas en producciones reales. Cada una dice qué pasó, dónde se vio y qué regla o herramienta la evita. Cuando un defecto se repite en dos videos, se añade aquí y, si es posible, se convierte en una comprobación automática. Fuentes: piloto de Hanói v1 y v2 (nov 2026), lecciones de make-short (MIT; se citan por número), análisis de Ricks Clips y la revisión adversarial de la skill del 17 nov 2026.

Los números no cambian al añadir lecciones (otras guías y el código los citan): cada lección nueva toma el siguiente número libre y va en su sección.

## Narrativa y retención
1. **Voz lenta = video largo sin más contenido.** Hanói v1 iba a 2,3 palabras/s: 81 s que equivalen a unos 50 s de las referencias (3,5–3,8). → `revisar_guion.py` (objetivo 2,9–3,8).
2. **El gancho se mide en segundos, no en frases.** «En 1902, Hanói pagó…» tardaba 6,5 s en cerrar la paradoja; la v2, 6,1 s. → Gancho ≤ 4,5 s; el dato visual antes de 3 s aunque la frase siga.
3. **El objeto extraño en el primer cuadro.** Los Shorts más vistos de Ricks Clips lo muestran desde el fotograma 0 (n = 6, pista, no prueba). → En el storyboard, el fotograma 0 es el protagonista o el objeto de la paradoja.
4. **El giro necesita puesta en escena propia.** Hanói v1 contaba su revelación en un plano soleado e igual de saturado que el resto. → Color por acto y un cambio de luz, de cámara o de sonido en el giro.
5. **Cada beat se ve en el fotograma de su palabra** (make-short 9, 19: solo 9 de 22 se veían). → `produccion.json` con impactos por palabra; el crítico los comprueba (±0,25 s).
6. **Querer visible, escalada con costo, remate ganado y bucle** (story-rules de make-short): una opción entre las estructuras que se comparan, no una fórmula.

## Imagen y animación
7. **Subtítulos que tapan al personaje.** En Hanói v1 (30–32, 41–43 y 51–52 s) el subtítulo caía sobre cuerpos y manos. → `qc_escena.mjs` con `window.__qc`; banda protegida en la composición.
8. **Saltos de un dibujo.** En la muestra de Hanói v2, el mordisco de la rata pasaba de una pose a otra sin intermedio (f14 → f15); nadie lo vio en las hojas. → `pops.py` sobre cada muestra y completo; poses con al menos un dibujo intermedio.
9. **Sombra rectangular de un billboard.** `WebGLShadowMap` copia `map`/`alphaTest` del material principal al de profundidad: un plano proyector sin textura proyecta su rectángulo. → Corregido en `kit/escena3d.js`.
10. **Un primer plano excesivo hace ilegible el objeto** (make-short 35). → Encuadre del objeto del gag en la mano del personaje.
11. **La variedad sale de los cortes y la cámara, no del movimiento perpetuo** (make-short 17). Las referencias enlazan con cámara continua y fundidos; el corte seco queda para los golpes.
24. **La rampa de color no teñía, y una comparación a ojo dijo que sí.** MeshToonMaterial (three 0.170) solo lee el canal `.r` del `gradientMap`: `rampaColor()` daba bandas grises con el valor del rojo de cada parada. Se dio por buena mirando capturas lado a lado; la revisión del 17 nov lo encontró leyendo el shader. → `material()` parchea el shader para leer `.rgb`. Un cambio de color se comprueba midiendo (media RGB de una cara frente a la rampa gris), no a ojo: tras el parche, la fachada izquierda del ejemplo pasó de (79,75,84) con la rampa gris a (71,68,82) con la cálida (medido antes del parche contra el acné de sombra, que cambia esas caras).

27. **El cambio visual debe pasar dentro de la acción** (Torre Eiffel v7 → v8, 17 nov). Con 8 cortes y un barrido en 13 s, la información llegaba al cambiar de encuadre. → Cada toma tiene posición inicial, punto de mira, llegada y qué información aparece; la cámara sigue una mano o un objeto. 5 cortes en 13 s bastaron.
28. **Liberar una cara puede sacar de cuadro el objeto de la acción** (Torre completo v1, 33,5–40,3 s). Se subió la cámara para que el subtítulo no tapara la cara, y el guante con el fajo y el saco quedó por debajo del cuadro: el pago no se veía. El QC solo daba AVISO de foco fuera. → `qc_escena.mjs`: `imprescindible: true` en el protegido del objeto de la acción hace FALLA. La caja protegida de una cara va de los ojos a la barbilla, no al sombrero.
29. **Una cámara por claves con suavizado por tramo se para en cada clave.** `camaraClaves` hace *ease-in-out* por tramo, así que un movimiento de tres claves daba dos paradas. → `camaraContinua` (Hermite con tangentes en el tiempo).
30. **La posición del subtítulo es por tramo, no fija.** Las 27 FALLA de zona segura y de caras tapadas del completo de la Torre se resolvieron con `subY` como función del tiempo y ajustes de encuadre. La referencia del nicho usa subtítulos pequeños de 1–2 palabras, que casi no chocan. → `kit/subtitulos.js` (preset `'nicho'` y `yDe`).
31. **Lo que parece mejor hay que medirlo contra la referencia.** «Más saturado y más contraste» parecía más vivo; medido, la referencia tiene los negros a 58 y las luces a 163, y nosotros a 47 y 181, con picos de saturación más altos. → `scripts/comparar.py` y `gradoFinal`.

32. **Una voz que lee bien no basta: la narración tiene que actuar** (piloto de EE. UU., 18 nov). Se rechazaron siete tomas limpias y rápidas (predeterminadas, turbo a 3,9 p/s y «enérgicas»): «ninguna genera impacto emocional». Se aprobó la de Arthur en v3 con dirección extrema por frase, mezclada con música y efectos. → `produccion-25d.md` §8: voz de biblioteca de *storytelling*, v3 creativo, etiquetas de actuación, 2 tomas por línea y aprobación con la escucha mezclada.
33. **La regla `imprescindible` detecta lo que una revisión a ojo deja pasar** (muestra del piloto de EE. UU., 18 nov). Al acercar la cámara a la grieta del puente, el QC dio FALLA porque la grieta quedaba un 40 % fuera de cuadro, con su arranque en la base fuera de plano. Se reencuadró la pila entera y la grieta se ve trepar. → `imprescindible: true` en el objeto de cada acción (lección 28).

## Determinismo y render
12. **MSAA de WebGL** cambiaba aristas junto a transparencias (Hanói v1). → Supermuestreo 2× en `crearMotor`.
13. **Lienzos 2D que Chrome cambia de GPU a CPU** a mitad del render: Δ 1–7 en los bordes según el orden de los `t` (Hanói v2). La causa se atribuyó al conjunto de lienzos que se repintan por fotograma: no se aisló cuál lo provocaba. → `willReadFrequently` en los lienzos que se repintan por fotograma. El kit lo lleva en los billboards y en `brillo()` (`escena3d.js`), en el lienzo de `crearTexto` (`lib.js`) y en los lienzos O y M de `escritura.js`; los lienzos propios de la pieza que se repinten lo necesitan también. Un lienzo que se dibuja una sola vez al cargar (el atlas de `crearManada`) no lo necesita.
14. **Estado que no se restaura al retroceder:** la tapa de una alcantarilla quedaba invisible si se pedía un `t` anterior. → Toda propiedad se fija en cada `seek`, también `visible`.
15. **Un solo navegador en las pruebas:** 4 min 16 s para 6,45 s de muestra. → `--prueba` en paralelo: 71 s.
16. **Un cambio global exige re-renderizar los planos ya aprobados** y compararlos (make-short 24, 36). → La caché por plano solo reutiliza lo que no cambió; lo común invalida todo.
17. **Residual conocido:** 1–2 de 12 instantes pueden diferir 1 nivel en 1 píxel en bordes de tejados contra el cielo (GPU). No se tapa: se anota en `REVISION.md`.
25. **`-shortest` perdía fotogramas sin avisar.** Al unir la imagen con una mezcla más corta, FFmpeg cortaba el video donde acababa el audio: con una mezcla 2 s más corta, un video de 348 fotogramas salía con 288 (prueba de la revisión del 17 nov). → `unir()` de `render.mjs` rellena o recorta el audio a la duración exacta del video (`apad` + `-t`, sin `-shortest`) y cuenta los fotogramas con ffprobe: si no cuadran, falla.
26. **Editar durante un render invalida la caché.** La huella se calcula al empezar y cada segmento se guarda con esa clave: tras editar una fuente a mitad, el siguiente render calcula otra huella y no reutiliza lo que se acaba de renderizar; y si la página carga algo tarde (una imagen, un import dinámico), un segmento puede salir con la versión nueva bajo la clave vieja. → Fuentes fijas mientras dura el render ([paralelo.md](paralelo.md)); los cambios, después.

## Sonido
18. **Efectos alineados al ataque visible**, no al inicio de la palabra (make-short 27, 29: el árbol iba 9 fotogramas adelantado). → En el piloto lo hacía `mezcla.py`, un script del proyecto de Hanói (no de la skill), que alinea por el primer instante sobre −30 dB. En la skill, `audio/musica.py --sincro sincro.json --voz audio/voz.wav` coloca sus efectos sintetizados en el fotograma de cada impacto; un efecto externo (ElevenLabs) se recorta a su ataque antes de mezclarlo.
19. **Las pausas del TTS no son las del guion:** ElevenLabs dejaba 0,6 s tras «1902». → Montaje de voz con pausas diseñadas (en el piloto, `montar_voz.py`, otro script del proyecto de Hanói que la skill no trae).

## Proceso
20. **El constructor puntúa ≈ 2 puntos por encima** (make-short 15, 28, 50). → `critica.md`: crítico independiente con las sospechas del constructor.
21. **Auditoría numérica al inicio** (make-short 47: siete rondas no vieron cuerpos a 2,6 cabezas frente a 3,2). → Tabla de `critica.md`.
22. **Archivar cada ronda** (make-short 39). → `review/critica/ronda-N/`.
23. **Costo:** la v1 de Hanói, con siete subagentes constructores, gastó ≈ 18 % del límite semanal. → Un constructor, biblioteca reutilizable y subagentes con Sonnet para lo mecánico.
27. **El código «probado» tenía 40 defectos.** La revisión adversarial del 17 nov (agentes que buscan fallos y los reproducen con datos sintéticos) confirmó 40 en herramientas que ya habían pasado sus pruebas: una caché que reutilizaba la paleta vieja si su archivo empezaba por `_`, ids de plano con otra mayúscula que nunca invalidaban nada, `-shortest` que perdía fotogramas o un `pops.py` que cargaba el video entero en memoria. Una segunda ronda encontró defectos en los propios arreglos. → Tras construir o cambiar una herramienta, revisión adversarial con reproducción antes de darla por buena; cada arreglo, con una prueba que fallaba antes.
