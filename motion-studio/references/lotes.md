# Producción por lotes de Shorts 2.5D

`scripts/lote.py` y `scripts/audio_video.py` sirven para producir varios Shorts seguidos (por ejemplo, 2 al día) con la calidad de un piloto. La tubería no se reconstruye en cada video:
- **lo creativo** se queda en manos del agente y del usuario: el guion, la dirección de planos en `composicion.js` y `escena/`, y la crítica;
- **lo mecánico** son órdenes repetibles: el proyecto, la cadena de audio, el render, la puerta de calidad y la publicación.

Nacieron con el lote de Dani Clips del 18–23 nov 2026 («The Hotel That Rose With the Guests Inside» y siguientes). Sus reglas de etapa están en `produccion-25d.md`.

## Carpetas

```
lotes/<fecha>_<canal>/lote.json          calendario y estado de cada video (plantilla: assets/lote/ejemplo.lote.json)
lotes/<fecha>_<canal>/PLAN-LOTE.md       capacidad, parrilla, experimento, puertas y KPI (texto libre)
videos/<carpeta>/01-guion/GUION-TECNICO.md   guion con dirección (lo aprueba el usuario)
videos/<carpeta>/01-guion/video.json     el guion en datos (plantilla: assets/lote/ejemplo.video.json)
videos/<carpeta>/03-proyecto/            proyecto de motion-studio, copiado del proyecto base
videos/<carpeta>/05-render/              muestras y completos versionados (<slug>_completo_vN.mp4)
videos/<carpeta>/PUBLICACION.md          título, descripción con fuentes y etiquetas
```

## Flujo por video

1. **Guion técnico** en `01-guion/GUION-TECNICO.md`.
   - Antes de escribirlo, compara 3–4 formas de contar la historia y elige la de más retención.
   - El usuario aprueba los guiones en tandas de 2–3.
2. **Pasar el guion a datos:** `01-guion/video.json` (formato abajo).
3. `python lote.py nuevo DC-0N`
   - copia el proyecto base (kit, escenarios y herramientas) sin audio, review ni exportaciones;
   - fija `salida.nombre` y copia `video.json`.
4. **Audio:**
   1. `python lote.py audio DC-0N grabar`: 2 tomas por línea, de pago;
   2. `… audio DC-0N elegir`: la toma con más entonación y un ritmo válido;
   3. el usuario escucha la mezcla y aprueba la voz;
   4. `… audio DC-0N`: montar → transcribir → envolvente → cues → música → efectos → mezcla.
   - Lo que ya existe no se vuelve a pagar.
5. **Dirigir los planos** en `composicion.js` y `escena/` con `kit/director.js`, `kit/actuacion.js` y `kit/realista.js`.
   - Es trabajo creativo y no se automatiza.
   - Después vienen `python lote.py render DC-0N --muestra a,b` (≤ 10 s, con audio) y `--final`.
6. **Puerta y crítica:**
   1. `python lote.py puerta DC-0N`;
   2. un **crítico independiente** que no produjo el video revisa con `critica.md`;
   3. se anota la nota con `python lote.py critica DC-0N <nota> --ronda N`;
   4. se repite `puerta`.
   - Hay como máximo 2 rondas de crítica; después se entrega con los pendientes anotados.
7. **Aprobación final del usuario** con sus palabras.
   - Entonces se ejecuta `python lote.py publicar DC-0N --aprobado "«sus palabras»" [--programar]`.

**Nada se publica** sin la puerta en PASA y sin las palabras del usuario.

## Puerta de calidad (`lote.py puerta`)

| Paso | Bloquea | Qué mira |
|---|---|---|
| `auditar.mjs` | sí | contrato de la página (`seek` puro, sin relojes ni azar) |
| `render.mjs --determinismo` | sí | el mismo fotograma, igual en otro orden (admite la `determinismo_tolerancia` de `lote.json`, p. ej. ≤ 12 px con Δ ≤ 2, solo si se documenta por qué) |
| `qc_escena.mjs` | sí | zona segura, textos sobre caras, objetos imprescindibles y lectura |
| `verificar.py` | sí | máster: códec, color, sonoridad y duración |
| `pops.py` | sí | saltos de 1–3 fotogramas (los subtítulos quedan fuera con `pops_zonas`; los saltos ya revisados van en `pops_permitir` del video) |
| `ritmo.py` | no | informe de ritmo |
| `comparar.py` | no | frente a la referencia del nicho (`referencia` en `lote.json`) |
| crítica | sí | nota ≥ `nota_minima` (7,0 en el lote de Dani Clips) |

El informe queda en `03-proyecto/review/puerta.json` y el detalle en `puerta.log`.

## `lote.json`

| Campo | Para qué |
|---|---|
| `canal`, `nombre`, `ritmo`, `aprobacion` | identificación y reglas del lote (texto) |
| `nota_minima` | la nota de la crítica que exige la puerta |
| `carpeta_videos` | dónde viven las carpetas de video (relativa a `lote.json`; por defecto, `../../videos`) |
| `proyecto_base` | el proyecto del que se copian kit, escenarios y herramientas (`nuevo`) |
| `referencia` | `{mp4, palabras}` del Short de referencia, para `comparar.py` (opcional) |
| `determinismo_tolerancia` | `{px, delta, nota}`: ruido de rasterizado aceptado, con su motivo |
| `pops_zonas` | zonas que `pops.py` no vigila (los subtítulos palabra a palabra) |
| `publicador` | órdenes que publican el `publicar.json` escrito (opcional; ver abajo) |
| `videos[]` | `id`, `slug`, `carpeta`, `fecha`, `hora`, `titulo`, `estado`, `portada_s`, `pops_permitir`; `lote.py` añade `historial`, `critica(s)` y `video_id` |

Los estados son: `parrilla → guion → guion-aprobado → proyecto → audio → render → puerta → aprobado → programado`. `lote.py estado` dice el siguiente paso de cada video.

**Publicador.** `publicar` siempre escribe `videos/<carpeta>/publicar.json`, con el máster, `PUBLICACION.md`, el hueco del lote y las palabras de la aprobación.
- Si `lote.json` trae `publicador`, ejecuta sus `pasos` en `cwd` y, con `--programar`, también `programar`, que debe imprimir el enlace `https://youtu.be/…`.
- Marcadores: `{py}` (el Python con dependencias), `{canal}`, `{pieza}`, `{ref}` (= `canal/pieza`) y `{carpeta}`.
- En la plantilla está el ejemplo de un centro de publicación con `detectar → validar → aprobar → programar`.

## `video.json`

```json
{
  "idioma": "en",
  "voz": {"id": "<voice_id de ElevenLabs>", "modelo": "eleven_v3", "tempo": 1.2, "silencio_interno": 0.12, "version": "v3",
          "ajustes": {"stability": 0.0, "similarity_boost": 0.8, "style": 0.0, "speed": 1.0}},
  "cola": 0.6,
  "lineas": [{"id": "L01", "texto": "[excited, storytelling hook] In 1861, Chicago lifted a giant brick hotel…", "tempo": 1.35, "pausa": 0.2}],
  "musica": {"global": ["…"], "negativo": ["…"], "secciones": [{"nombre": "M1", "hasta": "L04-0.1", "estilos": ["…"], "evitar": ["…"]}]},
  "sfx": {"viga_cruje": ["deep wooden beams creaking under strain", 2.0]},
  "cues": [{"sfx": "viga_cruje", "t": "@lifted", "g": -7, "nota": "«lifted»: crujen las vigas"},
           {"sfx": "amb_obra", "t": 0, "g": -14, "amb": true, "fin": "L02+0.2"}],
  "mezcla": {"musica_bajo_voz": -15, "duck_musica": -7, "duck_amb": -8, "silencios": [{"desde": "@still", "hasta": "L05", "vuelve": 0.3}]}
}
```

- **Líneas:** `texto` lleva las etiquetas de actuación de v3 (la voz tiene que actuar, no solo leer). `tempo` y `pausa` son de esa línea. `tomas` (por defecto `"ab"`) y `toma` (fija una toma elegida a oído).
- **Tiempos** en `cues`, `fin`, `hasta` y `silencios`:
  - un número (segundos);
  - `"L05"` o `"L05$"`: inicio o fin de la línea;
  - `"@word"` o `"@word#2"`: la palabra que **empieza** por «word», n.º 2. Ojo: `@lift` encuentra «lifted»;
  - `"@word@L05"`: la primera desde el inicio de L05;
  - `"FIN"`: fin de la pieza;
  - todos admiten un desfase final: `"@hole+0.6"`, `"L07-0.25"`.
- **Cues:**
  - `g`: dB sobre −3 dB bajo la voz;
  - `pan`: −1..1;
  - `amb`: ambiente, que no se alinea al ataque y se agacha bajo la voz;
  - `fin` y `entra`: corte y fundido.
- **Mezcla:**
  - música a `musica_bajo_voz` dB bajo la voz, con ducking;
  - los efectos se alinean a su ataque;
  - el resultado sale a −14 LUFS y ≤ −1,5 dBTP, en 48 kHz estéreo (`audio/final.wav`, que `render.mjs` une al video).

## `audio_video.py` por separado

`python audio_video.py <proyecto> <paso>` funciona sin lote, con cualquier proyecto que tenga `video.json` y `motion.config.json`.
- **Pasos:** `grabar`, `elegir`, `montar`, `transcribir`, `envolvente`, `cues`, `musica`, `sfx`, `mezcla` y `todo`.
- **Clave:** `ELEVENLABS_API_KEY` o `credenciales/elevenlabs.env` en la carpeta del proyecto o en una superior. Nunca se imprime.
- **Python para el ASR:** `MOTION_STUDIO_PY` o el `.venv` más cercano.
- **`montar`** recorta silencios internos, aplica el tempo de cada línea y fija `motion.config.json → video.duracion` a voz + cola, redondeado a fotogramas. Avisa si el gancho (L01) pasa de 4,5 s.
- **`elegir`** descarta las tomas fuera de 1,8–4,6 palabras/s montadas, porque el TTS repitió o se comió palabras.

**Comprobado (19 nov 2026):** con las tomas, las elecciones y las palabras del hotel, `montar` y `cues` reproducen su `tiempos_voz.json` (12 líneas, diferencia 0,0 s) y sus 43 efectos al mismo instante. Pruebas sin red en `tests/animacion/lote_audio_test.py`.
