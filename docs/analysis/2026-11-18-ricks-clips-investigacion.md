# Fase 1 · Investigación del canal de referencia (Ricks Clips, @RicksClips3000)

> Copia del informe del proyecto de contenidos (18 nov 2026), incorporada al repositorio como registro de observaciones. Las rutas son relativas a esa carpeta de trabajo, no a este repositorio. Las cifras públicas y lo observado se separan de las hipótesis.

18 nov 2026. **Separo tres cosas:**
- **DATO:** medido o leído de una fuente pública, con la fuente al lado.
- **OBSERVADO:** visto por mí en fotogramas o en la transcripción.
- **HIPÓTESIS:** mi lectura de por qué retiene. No está medida.

**No hay datos de retención de este canal:** solo su Studio los tiene, y no se inventan. vidIQ sigue con **0 créditos** (se renuevan el 3 dic), así que no hay outliers ni datos demográficos nuevos.

**Base previa, que no se repite:**
- `04-Herramientas/skill/docs/analysis/2026-11-17-ricks-clips-canal.md`: 6 Shorts medidos con faster-whisper y FFmpeg, top frente a control;
- `biblioteca/referencias/ancient-jar/comparacion/` (ANALISIS-COMPARATIVO.md y AUDIENCIA.md).

## 1. Muestra (DATO: página Shorts del canal, leída en el navegador el 18 nov; vistas redondeadas por YouTube)

La serie 2.5D tiene **31 Shorts**. La **mediana es de 9,5 M** de vistas. El Short del samurái (550 K) tiene menos de 2 días y no entra en las comparaciones.

| Grupo | Short (id) | Vistas | Por qué está en la muestra |
|---|---|---|---|
| Más exitoso | The Ancient Jar That Warned an Empire (VS1Z_Q-Klt8) | 35 M | n.º 1; análisis completo en `ancient-jar/` |
| Más exitoso | Why Perfect Railroads Don't Work (7xS87iActkU) | 30 M | n.º 2 (analizado el 6 nov) |
| Reciente y exitoso | **This Shape Saved Roller Coasters** (QlDPMzGmYac, 5 nov, 63,2 s) | 12 M | **visto hoy**: fotogramas cada 2 s y transcripción desde 23 s |
| Reciente | **The Instinct That Makes You Crash** (aD73kaL_PtY, 15 nov, 59,5 s) | 9,5 M | **visto hoy**: fotogramas cada 2 s y transcripción completa con tiempos |
| El más nuevo | Why Samurai Feared The Flying Thunder (R-mWVMM-LAs) | 550 K | solo metadatos (menos de 2 días) |
| Cola baja | Every Memory Has a Price (t3OXkhlI6NQ) | 570 K | control: ficción triste de 78 s (analizado el 17 nov) |

**Método de hoy (sin descargar archivos):**
- el Short se reproduce en el panel del navegador;
- con JavaScript se capturan fotogramas del `<video>` cada 2 s y el texto de los subtítulos de YouTube con su `currentTime`;
- no se redistribuye nada; las hojas solo se miraron.

Con ese método, la transcripción del de las montañas rusas empezó en el segundo 23: lo anterior se deduce de las palabras que aparecen en pantalla.

## 2. Desglose por marcas de tiempo (OBSERVADO)

### «The Instinct That Makes You Crash» (9,5 M · 59,5 s · ≈ 200 palabras ≈ 3,4 p/s)

| Tiempo | Narrativa y guion | Imagen y cámara | Acting y edición |
|---|---|---|---|
| 0–4,4 | **Gancho condicional con paradoja**: «si plantas un árbol junto a una carretera vacía, los coches irán directo a él» | Un granjero planta un árbol en el cuadro 0, con campo, cielo con nubes y carretera recta. Luego, plano general del árbol solo junto al asfalto | Cara de satisfacción; el texto 1–2 palabras |
| 4,4–12 | «You see,» y planteamiento: kilómetros de recta y un solo árbol que alguien golpea cada semana | Plano aéreo de la recta infinita (escala), regreso al árbol con un cartel de «días sin choque» | Cambio de plano cada ≈ 2 s |
| 12–22 | **Escalada 1**: el pueblo clava una flecha luminosa y los choques se duplican. **Gag**: el de la grúa espera con su silla plegable y nunca ganó tanto | Flecha de neón (objeto con brillo), grúa roja y el coche patrulla | El de la grúa, sentado y feliz: gag sostenido |
| 22–42 | **Escalada 2**: el sheriff va a 15 mph con las dos manos y se estrella. Tala el árbol mientras el de la grúa ve caer su negocio, y luego choca contra el tocón | Coche patrulla en carretera aérea; tala; hacha | La ironía se apila: cada solución empeora el problema |
| 42–55 | **Pivote** «So how does this keep happening?» → «target fixation» y el mecanismo (los ojos se fijan y las manos giran el volante) | **Noche, lluvia, POV desde dentro del coche**: salpicadero detallado, faros, niebla volumétrica, el letrero «TARGET FIXATION» en el mundo | Cambia por completo el registro visual en la explicación |
| 55–59,5 | Remate que devuelve al chiste: hasta un tocón atrae al conductor | Volante girando hacia la flecha | Termina en la ironía, sin moraleja |

### «This Shape Saved Roller Coasters» (12 M · 63,2 s)

| Tiempo | Narrativa | Imagen | Acting |
|---|---|---|---|
| 0–6 | Un dueño de feria construye un rizo «perfecto» (círculo) que le costó todo | Obrero con gorra roja y peto en el cuadro 0, con el rizo detrás; parque de día con hierba, árboles y cielo azul | Sonrisa orgullosa; muestra el dinero |
| 6–12 | Rival con pizarra; la noche antes de abrir prueba con un muñeco | Cartel «OPENING TOMORROW» en el mundo y vía de madera iluminada | Cambio de luz: de día a noche con luna y anillos de luz |
| 12–24 | El muñeco queda aplastado; el dueño martillea el rizo toda la noche; el rival se burla | Martillo, noche azul y bombillas cálidas | Gags físicos y cara de rabia |
| 24–30 | El rival sabotea: aprieta el rizo y lo deja alto y estrecho | Rizo en forma de lágrima | Risa malvada |
| 30–43 | Día de apertura, cola en la alfombra roja, los dos suben; el dueño ve el rizo deformado y ya es tarde | Feria llena de figurantes, globo rojo y noria | Miedo |
| 43–60 | **«You see»**: analogía cotidiana (una curva cerrada a 60) y el mecanismo (la curva suave abajo y la cerrada arriba) | Coche en carretera (relacionable para EE. UU.) y vista técnica del rizo | Explicación visual con objetos, sin pizarras |
| 60–63 | **Ironía final**: el carrito del rival llega al fondo de su círculo perfecto | Explosión de cómic | Corte en el golpe |

### Patrones comunes (OBSERVADO en los 3 analizados a fondo + los 6 del 17 nov)

**Guion**
- **Fábula con personajes ficticios alrededor de un mecanismo real** (fijación del objetivo, clotoide), o un hecho histórico (la vasija).
- Gancho con paradoja ≤ 4,5 s.
- «You see» como bisagra hacia el planteamiento o la explicación.
- Escalada en la que cada solución empeora el problema.
- Un gag cada 5–8 s.
- Explicación hacia el 70 % del video.
- **Última línea = ironía que devuelve al gancho**, sin moraleja.
- Presente narrativo en los recientes; pasado en la vasija.

**Animación**
- Personajes 2D de cabeza blanca redonda, ojos de punto y contorno grueso, con vestuario por oficio.
- Escenarios 3D con **luz física**: cielo con nubes, sombras suaves, vegetación densa casi fotorrealista y coches con detalle de modelo comercial.
- La actuación vive en la cara y en gags sostenidos.

**Cámara**
- Planos generales de escala (aérea, recta infinita).
- Empujes suaves hacia el objeto.
- POV en el clímax explicativo.
- Cambio de plano cada 2–3 s.
- Enlaces por fundido o barrido; casi sin corte seco (medido el 17 nov: 0–2 por video).

**Iluminación y escenografía**
- Paleta por acto: el día para la historia; la noche o la tormenta para la tensión y la explicación.
- Brillo (bloom) en neones, faroles y bombillas.
- Mucho atrezo y letreros dentro del mundo.

**Sonido** (DATO medido el 17 nov):
- voz continua a 3,5–3,8 p/s, sin silencios ≥ 0,25 s;
- −14 LUFS y LRA 1,8–3,5;
- fondo musical ≈ 9 dB bajo la voz.

## 3. Hipótesis de retención (NO medidas)

| # | Hipótesis | Apoyo |
|---|---|---|
| H1 | El cuadro 0 con el objeto absurdo y la paradoja en ≤ 4,5 s hacen que el espectador se quede | Los 9 Shorts analizados |
| H2 | La escalada en la que cada solución empeora el problema mantiene el «¿y ahora qué?» | Instinct (flecha, sheriff, tocón) y montañas rusas (muñeco, sabotaje) |
| H3 | La explicación llega tarde (≈ 70 %), cuando ya hay inversión emocional | Instinct a 42 s; montañas rusas a 43 s |
| H4 | La ironía final que conecta con el gancho invita a volver a verlo | Tocón ↔ árbol; círculo perfecto ↔ rizo perfecto |
| H5 | El cambio de registro visual en la explicación (noche, POV) es un re-gancho | Instinct a 44 s |
| H6 | La calidad del 3D (realismo de entorno) **no** separa a los ganadores de los controles: lo que cambia es la premisa (17 nov: el control bajo tenía buena animación) | Comparación top frente a control |

## 4. Lo que se aplicó a «The Hotel That Rose With the Guests Inside»

- **Premisa:** hecho real comprobable con mecanismo visible (los gatos a una señal) y gag de cierre que devuelve al gancho (la escalera que crece ↔ el huésped del té).
- **Escalada:**
  1. barro;
  2. la ciudad entierra sus calles;
  3. el hotel en un pozo;
  4. todos se ríen;
  5. Pullman;
  6. la señal y la sincronía.
- **Visual:** 3D con luz física (H6 dice que no basta, pero el usuario lo eligió y es la brecha visual medida).
- **No se copió:** ni historia, ni personajes, ni letreros, ni planos concretos de los Shorts vistos. Del plano del vino «sin una onda» de la vasija se evitó deliberadamente su equivalente (la taza que no tiembla); se usó un ratón y una rendija.

## Fuentes
- Página Shorts de @RicksClips3000 (leída el 18 nov 2026); Shorts QlDPMzGmYac y aD73kaL_PtY vistos en el navegador.
- Informes previos citados arriba. Revid y vidIQ, según AUDIENCIA.md.
