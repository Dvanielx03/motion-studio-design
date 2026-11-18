# Tutorial NoCodeHack: técnicas de Blender y coste real de render

17 de noviembre de 2026. Complementa `2026-11-06-make-short-integrado.md` (flujo con Claude, capítulos, rúbrica); aquí solo se trata el aspecto en Blender y su coste en nuestro equipo. Material de trabajo en `review/tutorial-nocodehack/` (video, repositorio clonado, experimentos).

## 1. Qué se vio y qué no se pudo verificar

- Video `gH__ujN5Joo` descargado a 1080p (`video/tut.mp4`, 128 MB). Los subtítulos automáticos dieron HTTP 429; se transcribió en local con faster-whisper (CPU, int8). **La transcripción local quedó cortada en 7:52** (el proceso no terminó de escribir el resto); lo posterior (hardtack de 15 s, render de ~8 min, lecciones del crítico) se toma del análisis del 6 nov. Fotogramas: 65 capturas cada 10 s, vistas en hojas de contacto de 4x4, no una a una a tamaño completo.
- En pantalla solo aparece Blender en un par de planos breves (vista del campamento en el visor con el árbol de escena, hacia 3:40, y los renders). **Nunca se ven los paneles de ajustes ni el código de materiales.** Todo lo que sigue sobre motor, muestras, nodos y cámara procede del repositorio MIT `nocodehack/make-short` (`v3/scene.py`, `lib/look.py`, `lib/chars.py`, `lib/sets.py`), no del video. Que el video use exactamente esa versión es plausible (el autor lo publica como la skill) pero no está demostrado fotograma a fotograma.
- Lo que sí confirma el video: el resultado es 3D con cámara en perspectiva, personajes "bean" de cabeza blanca y piernas finas, contorno oscuro grueso, hierba y decorados con volumen, desenfoque de fondo y 32 a 53 planos por Short en las referencias (cifras del autor).

## 2. Conclusión principal: es 3D real con aspecto 2D, no 2.5D

El tutorial llama "2D/2.5D" a lo que en el código es **3D completo con shading de dibujo animado**:

| Elemento | Qué es en el código | ¿2.5D? |
|---|---|---|
| Personajes | Primitivas bmesh (esfera, cilindro, cono) con jerarquía de vacíos; cabeza esfera blanca, torso, piernas largas (3,2 cabezas de altura), ojos con párpado por escala, cejas, formas clave (`shape_key_add`) para caras | No: volumen 3D, la silueta "plana" es de diseño |
| Decorados | Mallas con perspectiva real (suelo, tiendas, barriles, árboles, hierba de cuchillas), texturas pintadas tileables 512 px generadas con PIL (`tex/*.png`) | No |
| Rayos de luz | `fx_godrays`: 7 planos verticales con material emisivo transparente (`BLENDED`), cara a cámara | Sí, es un truco de billboards |
| Nubes, nieve/lluvia, humo | Planos o mallas pequeñas; puff = icosferas unidas con contorno | Parcial |
| Profundidad | Cámara 3D + DOF + niebla de volumen (solo noche) + "haze" por distancia en el compositor | 3D real |

Para nuestro "2.5D" (planos con recortes, paralaje) esto es un enfoque distinto: aquí no hay recortes. Lo reutilizable es el **look** (materiales, contorno, grade), que funciona igual sobre planos con textura.

## 3. Procedimiento paso a paso con valores del código

### 3.1 Motor y color

| Ajuste | Valor | Fuente |
|---|---|---|
| Motor | `BLENDER_EEVEE` (EEVEE de 5.2), sin Cycles | `look.setup_render` |
| Resolución | 720x1280 por defecto; `NATIVE=1` => 1080x1920 al 100 % (go.sh lo exporta) | look.py, scene.py:33 |
| FPS / formato | 30 fps, PNG, `film_transparent=False` | look.py |
| Muestras | `taa_render_samples=40` en setup_render, **sobrescrito a 12** (`SAMPLES=12`, y `render.sh` pasa 12) | scene.py:15,596 |
| Ray tracing | Desactivado (`use_raytracing=False`) | look.py |
| Sombras | Activadas; `shadow_ray_count=2`, `shadow_step_count=6`, sombras volumétricas off | look.py |
| Volumen | `volumetric_samples=48`, tile 4; niebla `VolumeScatter` densidad 0,012 solo en noche | look.py |
| AO | No se configura ninguno específico | verificado por ausencia en el código |
| Bokeh | `bokeh_max_size=24` | look.py |
| Gestión de color | `Standard`, look `None`, exposición 0, gamma 1 (el grade lo hace el compositor; no usa Filmic ni AgX) | look.py |
| Motion blur | Desactivado | scene.py:597 |
| Pase Z | Activado (alimenta el contorno de profundidad y la bruma) | look.py |

### 3.2 Sombreado por bandas (`toon_mat`)

Cadena: `Diffuse BSDF (blanco)` -> `Shader to RGB` -> `RGB to BW` -> `ColorRamp` lineal con cinco paradas y transiciones cortas (0,00/0,20 sombra violeta fría (0,45, 0,42, 0,70); 0,27/0,50 medio (0,80, 0,76, 0,88); 0,57 luz cálida (1,12, 1,0, 0,80)). Ese resultado se multiplica por el color base (o textura de caja `BOX` con mezcla 0,2), por un ruido 3D de "pincelada" (escala 14, detalle 5, rango 0,84 a 1,08), por un tinte que recoge el color de la luz (mezcla 0,4) y se suma una autoemisión ~0,2 y un borde fresnel azul claro (Layer Weight 0,3, rango 0,55 a 0,9, hasta 0,5). La salida es una **Emission** (la luz solo decide el escalón). Una línea de tinta interior por `Layer Weight Facing > 0,93`.

### 3.3 Contornos

Casco invertido (`ink_hull`): modificador `SOLIDIFY` con `offset=1`, normales invertidas, `use_rim=False`, segundo slot de material de emisión casi negra (0,012, 0,01, 0,03) con **backface culling**. Grosores: cabeza 0,022, cuerpo y gorra 0,015, multiplicados por `INK_K=2,5` (≈6,6 % del ancho de cabeza); props 0,008 a 0,035. Se añade además tinta de profundidad en el compositor: `Filter Sobel` sobre el pase Z (recortado a 40 m), `MapRange` de 0,35 a 1,2 hacia 1,0 a 0,15, multiplicado sobre la imagen. No usa Freestyle ni Line Art.

### 3.4 Iluminación

Rig fijo reutilizado por "mood" (`MOODS`, 11 variantes: day, night, interior, dusk...): `LOOK_Sun` (SUN, ángulo 4°, día energía 2,6 cálida), `LOOK_Fill` (AREA 6 m, 90 a 190 W, fría), `LOOK_Rim` (SUN, solo noche, 3,2, azul blanquecino desde atrás: el contraluz), `LOOK_Lamp` (POINT, 300 a 700 W, naranja: fuego o linterna), y cielo en degradado por coordenada Z. Cada plano lleva su mood con claves **CONSTANT** (cambios secos al cortar).

### 3.5 Cámara

Sensor 36 mm horizontal, `clip_start=0,05`, `clip_end=400`. La focal sale de cada plano (p. ej. 70 mm en macro). DOF siempre activo con `focus_distance` al objetivo; `aperture_fstop = 8` si focal >= 70, si no **20** (casi sin desenfoque salvo macros). El encuadre es automático: calcula la distancia para que la cabeza ocupe una fracción de altura (`FRAC`: CU 0,36, MED 0,15, WIDE 0,09, XW 0,05) y comprueba oclusiones con `ray_cast`, ocultando atrezo por plano. Movimiento de cámara dentro del plano: claves en SINE ease in/out (continuo, no escalonado); la última clave de cada plano es CONSTANT.

### 3.6 Animación

- Poses "en doses" con interpolación CONSTANT, anticipación y rebote. **Ojo, corrección respecto a la hipótesis de partida:** en 30 fps "en doses" son 15 dibujos/s, no 12. El código no usa 12 fps en ninguna parte.
- Posición y giro de raíz: LINEAR (el desplazamiento es suave; solo el cuerpo se escalona). Parpadeos automáticos en bucle (BLINK_LEN 2400 fotogramas). Capa de "acting" aditiva (inclinaciones de cabeza, respiración) horneada también en doses (`apply_acting`; la ejecución del ejemplo informó 122 beats).
- Atrezo: `hide_render` CONSTANT; gags como la balanza o el martillazo con claves manuales.

### 3.7 Compositor (Blender 5, `compositing_node_group`)

`Render Layers` -> **Kuwahara Classic** tamaño 2 (0 de noche) -> **Glare Bloom** (umbral 1,0, fuerza 0,25, tamaño 0,6) -> `Color Balance` Lift/Gamma/Gain por mood -> `Hue/Sat` (saturación 1,2 a 2,0) -> bruma por profundidad -> multiplicación con la tinta de profundidad -> viñeta (elipse 0,9 + blur 260) -> dither azul solo de noche (0,6 %) -> desenfoque de barrido horizontal y "dip to ink" en las transiciones. Sin grano.

### 3.8 Cómo salen stills y secuencias

`scene.py -- gate DIR ids...` renderiza el fotograma central de cada plano; `-- frames DIR A B 12` renderiza A..B-1 como PNG. `go.sh` lanza **3 procesos de Blender en paralelo** (tercios del rango), a 1080x1920, y codifica con `ffmpeg libx264 crf16 yuv420p`. Los stills se miden con `gate.py` (números), de ahí el "check script".

## 4. Qué es automatizable, creativo y mejorable

**Automatizable con Blender Python (ya lo hacen):** materiales toon, contornos, rig de luces por mood, compositor, encuadre por altura de cabeza, anti-oclusión, claves en doses, parpadeos, render en tercios, medición de stills.
**Requiere decisión creativa:** diseño de personajes y poses, gags y su timing, elección de mood por escena, qué decorados, paleta, remates cómicos, juicio de la crítica (el propio autor dice que la puntuación es un juicio).
**Mejorable (propuestas nuestras):**
- Dejar los fotogramas con cámara estática renderizar una sola vez por dibujo (ver 5.3): hasta -59 % de tiempo.
- Perfil de previsualización a 50 % y 4 muestras: 2,4 veces más rápido que el final (5.2).
- El código tiene muchos parches por plano (`scene.py` ~625 líneas con coordenadas y nombres de props de un solo guion): para plantilla genérica hay que desacoplar rig, looks y guion.
- Evitar 11 moods casi duplicados; compartir una paleta paramétrica.
- Registrar el tiempo por plano en el log (el original no lo hace).

## 5. Experimentos medidos

GPU verificada antes de cada serie: `NVIDIA GeForce RTX 3050 6GB Laptop GPU`, Blender 5.2.3 LTS, `--gpu-backend opengl`. Un solo proceso de Blender a la vez. CSV: `experimentos/b_perfiles/tiempos.csv` y `experimentos/c_anim/tiempos.csv`; registros `b_log.txt`, `c_log_*.txt`, `a_makeshort/log.txt`.

### 5.1 Escena de ejemplo de make-short (3 stills nativos)

Se copió `example-60s/shots.json` y `acting.json` a `v3/`, y se ejecutó `scene.py -- gate` con `NATIVE=1`, 12 muestras, planos `s05` (campamento día, plano medio), `s22` (noche con lluvia, CU) y `s30` (macro de mesa). Imágenes en `experimentos/a_makeshort/` (`hoja_a.jpg` es la hoja de comparación). Los tres se ven fieles al tutorial: contorno grueso, sombras violetas, bloom, pincelada, lluvia, DOF.

| Still | Contenido | Tiempo | Nota |
|---|---|---|---|
| s05 | día, MED | no aislable | el primer still incluye construir las 5 sets y 39 planos y el primer arranque de shaders: **262 s hasta guardarlo** (construcción + render) |
| s22 | noche, CU, lluvia + niebla | **13,6 s** | el log (marcas de tiempo de Blender) incluye compilar shaders de otro set |
| s30 | macro mesa interior | **6,3 s** | idem |

Es una medida gruesa (marcas de 0,1 s del log de Blender, no un cronómetro por fotograma) y mezcla compilación de shaders; no mido segundos por fotograma limpios del ejemplo. Extrapolación sin verificar: a ~6 a 14 s por fotograma, los 1.815 fotogramas del ejemplo serían entre 3 y 7 horas en un solo proceso aquí; el autor declara ~8 min para 15 s (450 fotogramas) en su máquina con 3 procesos (≈1 s/fotograma efectivo), cifra que no podemos comprobar porque no sabemos su GPU. Las escenas de noche (volumen, lluvia) son claramente más caras que las de día.

### 5.2 Escena propia con el look del tutorial (perfiles)

`experimentos/exp_b.py` reutiliza `look.py` tal cual (toon_mat, ink_hull, apply_mood 'day', setup_compositor, DOF f/3,2 con enfoque en la cabeza, contraluz LOOK_Rim 3,0). Contiene suelo, muro, caja, barril, y un personaje de primitivas con gorra, brazos con pivote y ojos. Cámara 50 mm. 3 fotogramas por perfil; el primero incluye recompilar shaders.

| Perfil | Resolución | Muestras | Primer fotograma | Media de los siguientes |
|---|---|---|---|---|
| Final del autor (nativo) | 1080x1920 | 12 | 2,54 s | **1,16 s** |
| Calidad 40 (default de setup_render) | 1080x1920 | 40 | 2,04 s | **2,38 s** |
| Calidad 64 | 1080x1920 | 64 | 3,33 s | **4,6 s** (3,22 y 5,99: ruidoso) |
| Original sin escalar | 720x1280 | 12 | 1,29 s | **0,64 s** |
| Preview 50 % | 540x960 | 4 | 0,44 s | **0,49 s** |
| Preview 50 % sin DOF ni sombras | 540x960 | 4 | 38,8 s (recompilación de shaders al quitar sombras) | **0,54 s** |
| Preview mínimo (sin compositor) | 540x960 | 1 | 0,50 s | **0,28 s** |
| Workbench (solo layout) | 540x960 | n/a | 0,41 s | **0,11 s** |

Aspecto (`b_perfiles/hoja_b.jpg`): 12 y 64 muestras se ven prácticamente iguales a tamaño reducido (el toon es plano y el contorno es geometría, no ruido); el preview al 50 % con DOF y sombras conserva el look completo; quitar sombras pierde la sombra proyectada de personaje y cajas; Workbench sirve para blocking (gris, sin look). **Salvedad importante:** esta escena tiene ~10 objetos; la de make-short tiene cientos (hierba, barriles, tiendas) más niebla y lluvia, por lo que los tiempos absolutos no son comparables, solo las proporciones entre perfiles. La rareza de 38,8 s en la 6ª fila es recompilación, no coste por fotograma, y conviene evitar cambiar `use_shadows` a mitad de sesión.

### 5.3 Animación escalonada y 1 s completo

`exp_b.py anim`: 12 dibujos en 1 s (claves en fotogramas 0, 2, 5, 8, 10, 12... por redondeo de k*2,5), interpolación CONSTANT para brazo, cuerpo y cabeza; la cámara avanza continua (SINE). Se renderizó 1 s a 30 fps (30 PNG) y se codificó `anim_1s.mp4`.

| Configuración | Fotogramas renderizados | Tiempo total | Por fotograma |
|---|---|---|---|
| Nativo 1080x1920, 12 muestras, todos | 30 | **33,1 s** | 1,10 s |
| Nativo 12 muestras, solo 12 dibujos únicos | 12 | **13,5 s** | 1,12 s |
| Calidad 40 muestras, todos | 30 | **55,1 s** | 1,84 s |
| Preview 540x960, 4 muestras, todos | 30 | **14,2 s** | 0,47 s |

Hallazgos: (1) el cuerpo se ve escalonado y la cámara suave, como en el original (`anim_1s.mp4`, tira `tira.jpg`); (2) renderizar solo los dibujos únicos ahorra 59 %, pero **solo si nada más se mueve** (cámara continua o DOF animado obligan a renderizar todos los fotogramas: el control md5 mostró 30 imágenes distintas en nuestra prueba). Con cámara fija en los gags de actuación, la regla "un dibujo y repetir con ffmpeg" es una optimización real. (3) Extrapolado a un Short de 15 s en esta escena ligera: ~8 min final, ~3,5 min preview, mientras que en una escena como la del ejemplo (6 a 14 s por fotograma) serían de 45 a 105 minutos en un proceso, a verificar.

## 6. Perfiles recomendados para una plantilla

| Perfil | Uso | Ajustes | Coste medido (escena ligera) |
|---|---|---|---|
| **preview** | blocking y encuadre | 540x960 (50 %), EEVEE, 4 muestras, DOF y sombras como en final (cambiarlas fuerza recompilar), compositor on | ~0,5 s/fotograma |
| **muestra** | revisar look y gags | 720x1280, 12 muestras, look completo | ~0,64 s |
| **final** | entrega | 1080x1920 nativo, 12 muestras (sin salto visible frente a 40/64 en estilo toon; mejor 16 en planos con bloom y niebla), compositor completo | ~1,16 s (escena ligera); 6 a 14 s en escenas densas |

Antes de adoptar 12 muestras a ciegas, comprobar en un plano nocturno con niebla (el dither y Kuwahara 0 de noche existen justo por el banding).

Ajustes a fijar en la plantilla: `Standard` + look `None`; `use_raytracing=False`; `shadow_ray_count=2`, `shadow_step_count=6`; bokeh 24; pase Z; motion blur off; `fps=30` y escala 15 dibujos/s (en doses) como valor por defecto del acting (12/s si queremos el aspecto del título del tutorial: claves en fotogramas 0, 2/3, 5...); contorno por casco invertido con grosor en función del ancho de cabeza; rig de 4 luces con contraluz; render en 3 procesos (la RTX 3050 de 6 GB lo soporta con escenas ligeras: no medido aquí, riesgo de memoria en escenas densas); salida PNG + `libx264 crf 16` (para subir seguimos con nuestro master CRF 12 slow). Dejar el `--gpu-backend opengl` y comprobar `gpu.platform.renderer_get()` al inicio de cada proceso.

## 7. Qué no sabemos

- Los ajustes reales que usó el autor en el video: solo se confirmó el código público.
- Segundos por fotograma limpios de la escena del ejemplo (solo marcas de 0,1 s en el log).
- Coste con 3 procesos en paralelo en esta GPU de 6 GB.
- Memoria de vídeo con texturas 1080x1920 en sets densos.
- La calidad subjetiva a 12 contra 40 muestras en planos nocturnos, no se comparó visualmente.

## 8. Archivos

- `review/tutorial-nocodehack/video/` (tut.mp4, transcripcion.txt parcial, frames/, hojas de contacto)
- `review/tutorial-nocodehack/make-short/` (clon del repositorio; se copiaron `shots.json` y `acting.json` en `v3/`)
- `review/tutorial-nocodehack/experimentos/` (`exp_b.py`, `gpu.py`, `transcribe.py`, `a_makeshort/`, `b_perfiles/`, `c_anim/`, logs y CSV)
