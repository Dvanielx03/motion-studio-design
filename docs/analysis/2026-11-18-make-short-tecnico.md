# Fase 3 · Investigación técnica: make-short y el pipeline

> Copia del informe del proyecto de contenidos (18 nov 2026), incorporada al repositorio como registro de observaciones. Las rutas son relativas a esa carpeta de trabajo, no a este repositorio. Las cifras públicas y lo observado se separan de las hipótesis.

18 nov 2026.
- **Repositorio:** `nocodehack/make-short`, licencia MIT.
- **Estado:** `git ls-remote` da HEAD = `5a17d351343c2b5422d3ebda244c349c98ea9397`, el mismo commit de la auditoría del 17 nov (`04-Herramientas/skill/docs/analysis/2026-11-17-make-short-auditoria.md`). **No hay commits nuevos**: la auditoría sigue siendo válida y no se repite.

## 1. Resumen de make-short (de la auditoría, comprobado contra el commit)

| Pieza | Qué hace | Veredicto para `/motion-studio` |
|---|---|---|
| Motor (`v3/scene.py`, Blender 5.x EEVEE) | Escena completa en Blender: decorados con texturas numpy, personajes de primitivas, compositor Kuwahara + tinta + bloom; 3 procesos por tercios | No se adopta: sin contrato determinista (hash salpimentado por proceso para los parpadeos) y atado a una sola historia |
| Escenas (`lib/sets.py`) | 4 decorados de un campamento | Descartar (contenido de una sola historia) |
| Personajes (`lib/chars.py`) | Rig de primitivas con tabla de reacciones y habla por sílaba | Ya adaptado en `kit/actuacion.js` (anticipación, exceso, asentamiento, habla con envolvente) |
| Cámara (`frame_cam`, raycast de oclusión) | Encuadra desde las posiciones reales y aparta lo que tapa | **Adaptado hoy de otra forma**: los billboards y las multitudes a menos de 1,6–1,8 m de la cámara se ocultan (más simple que el raycast y determinista) |
| Sincronía de voz (`whisper-to-timing.mjs`) | Reparte palabras por conteo (falla con contracciones) | Descartado; usamos faster-whisper con alineación por programación dinámica (`subtitulos.js`) y anclas `@palabra` (`director.js`) |
| Validación visual (`gate.py`, `qa-pops.mjs`) | Un fotograma por plano; detector de saltos | `pops.py` ya integrado; el gate no aporta |
| Agente crítico (`critic/RUBRIC-blank.md`) | Subagente nuevo con rúbrica y sospechas | Ya integrado en `references/critica.md`; hoy se usa con la **rúbrica ponderada del encargo** |

## 2. Qué se integró en este video (mejoras con valor comprobable)

| Mejora | Dónde | Valor comprobado |
|---|---|---|
| **Acabado 3D realista estilizado** | `kit/realista.js` (nuevo) | Hoja de diseño v1→v2 y muestra. `--determinismo`: 6 de 6 instantes idénticos con AO, bloom y PBR |
| GTAO con ruido sembrado | `crearMotorRealista` | Sin el arreglo, cada trabajador del render tendría otro ruido (`SimplexNoise` → `Math.random`) |
| Pase de personajes aparte (tras tono y AO, con la profundidad del escenario) | `crearMotorRealista`, `prepararPersonaje`, `prepararManada` | El dibujo conserva su color; lo tapa lo que está delante. Lo translúcido no escribe profundidad (si no, desaparecían personajes) |
| Exposición por escena | `escena.userData.exposicion` | Interior, barro y hora dorada con un solo motor |
| Barro sin brillo de hielo | `materialPBR({ especular })` | En r170, `envMapIntensity` no se aplica con `scene.environment` |
| Vestuario de época | `kit/cuento.js` | Reparto de 1861 en la hoja de diseño v2 |
| Color de énfasis con el preset `nicho` | `kit/subtitulos.js` (`colorEnfasis`) | Antes era imposible: `enfasis` era a la vez la lista y el color |
| Ocultar lo que está pegado a la cámara | composición y `detalle.multitud` | En la muestra, los obreros dejan de tapar el gancho |
| `_diag.mjs` | proyecto | Evalúa una expresión en la página con la misma GPU que el render; encontró el fallo de profundidad en 2 llamadas |

## 3. Límites y dependencias del pipeline

- **Dependencias:**
  - Node 26, Python 3.12 (`.venv` de productividad con faster-whisper 1.2.1), FFmpeg 9.0.2;
  - Chromium de Playwright con ANGLE D3D11 en la **RTX 3050 6 GB** (se comprueba al arrancar);
  - Three.js 0.170.0;
  - Blender 5.2.3 instalado: no se usó en este video, porque Three.js PBR cubrió la brecha sin perder el contrato `seek(t)`.
- **Coste de GPU:** a ss = 1,5 con GTAO y bloom, cada fotograma se dibuja dos veces (determinismo), y ×4 en los tramos con desenfoque de movimiento. Se usan **3 trabajadores** para no pasar de los 6 GB de VRAM.
- **ElevenLabs:**
  - la API de sonido no respondió durante horas el 18 nov (tiempo de espera también en `api.us`);
  - la consulta de créditos devolvió 500;
  - **la red del sandbox de Claude Code bloquea `api.elevenlabs.io`**: hay que llamarla fuera del sandbox.
- **Límite de `--prueba`:** 10 s. La muestra de 24 s se renderizó con `--final` acotando la duración (los segmentos de 5 s quedan en caché).
- **Lo que no da el pipeline:** vegetación y vehículos de nivel comercial (habría que importar modelos con licencia o modelarlos en Blender); multitudes con IK por persona.
