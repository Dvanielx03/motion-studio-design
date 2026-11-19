# Fase 2 · Diagnóstico de nuestras producciones frente a la referencia

> Copia del informe del proyecto de contenidos (18 nov 2026), incorporada al repositorio como registro de observaciones. Las rutas son relativas a esa carpeta de trabajo, no a este repositorio. Las cifras públicas y lo observado se separan de las hipótesis.

18 nov 2026.

**Producciones revisadas:**
- Torre Eiffel, completo v2: crítica 6,7;
- Concreto romano, completo v1: crítica 6,3;
- demostración de fluidez del gancho del concreto.

**Evidencia:**
- `ancient-jar/comparacion/ANALISIS-COMPARATIVO.md`;
- `2026-11-18_piloto-us/VALIDACION.md` y `03-proyecto-fluidez/DEMO.md`;
- `05-render/comparacion_completos.jpg`: la referencia, la Torre y el concreto, cada 5 s;
- los dos Shorts recientes de Ricks Clips vistos hoy (`01-INVESTIGACION-RICKS-CLIPS.md`).

## 1. Matriz de deficiencias

**Prioridad:** A = lo que más separa de la referencia; B = importante; C = acabado.

| Área | Deficiencia | Causa probable | Evidencia | Prio. | Corrección técnica (y si ya está en este video) |
|---|---|---|---|---|---|
| Fidelidad visual | Escenarios de volúmenes planos y colores por bandas frente a escenarios con luz física | `MeshToonMaterial` con rampa de 3–4 bandas, sin luz ambiente de cielo, sin AO ni relieve | Comparación de completos: el concreto de 10 a 60 s tiene paredes lisas y suelos sin textura | **A** | **`kit/realista.js`**: PBR con cielo físico + PMREM, ACES, GTAO sembrado, bloom, texturas procedurales con relieve, pasto instanciado. **Hecho** |
| Fidelidad visual | Atrezo escaso: menos de 8 piezas por escenario | Se modelaba solo lo que cita el guion | Torre: comisaría y expediente vacíos; concreto: laboratorio blanco | **A** | `escena/detalle.js` con telégrafo, carteles, bandera, contraventanas, grava, paja, árboles y multitudes instanciadas; atrezo por escenario ≥ 15 piezas. **Hecho** |
| Personajes | Personajes sin integrar en la luz del lugar | El billboard era un `MeshBasic` sin tinte en todas las escenas | Comparación: mismo blanco en el laboratorio y en el exterior | B | **Pase de personajes** después del tono y del AO (sin oscurecerse ni ensuciarse), con **tinte por escena** y sombra de media luna en la cara (`est.luz`). **Hecho** |
| Personajes | Vestuario sin época | `cuento.js` solo traía túnicas, toga y bata | — | B | `cuento.js`: chistera, bombín, gorra, obrero con tirantes, vestido, delantal, levita con solapas y chaleco, banda de senador. **Hecho** |
| Fluidez | Cámara casi quieta en el 55 % del gancho | Claves por tramo sin motivo | DEMO.md: 108 de 198 fotogramas | **A** | `director.js` (`camaraContinua` con claves en palabras), una subida o barrido por beat y desenfoque de movimiento. **Hecho en los 5 planos de la muestra** |
| Fluidez | Poses en línea recta sin anticipación | Cambio de pose en 4 dibujos | DEMO.md | B | `crearActuacion` con gestos 0,25 s antes de su palabra. **Hecho** |
| Cámara y composición | Tomas de 6–7 s con el mismo encuadre | Planos dictados por línea de guion, no por beat | VALIDACION: obra a 13–23 s, cúpula a 25–31 s | **A** | Guion técnico con cámara y palabra ancla por beat; ninguna toma > 4 s sin cambio de escala o ángulo. **Hecho** |
| Cámara y composición | Personajes cortados o tapando el plano | Cámara que pasa junto a billboards | Concreto: la cabeza de la doctora pasa cortada en el paneo; aquí, los obreros tapaban el gancho en la 1.ª versión | B | Los billboards y los miembros de una multitud a menos de 1,6–1,8 m de la cámara se ocultan solos. **Hecho** (regla nueva) |
| Luz y materiales | Luces y negros fuera de rango y un color sin atmósfera | Sin gradación ni niebla atmosférica | ANALISIS: negros 47 frente a 58 | B | `gradoFinal` + niebla exponencial + exposición por escena. **Hecho** (falta medir con `comparar.py`) |
| Escenarios | Suelo húmedo que parecía hielo | En three r170, con `scene.environment`, `material.envMapIntensity` **no se aplica**: el cielo blanco se reflejaba a ras de suelo | Hoja de diseño v1 y v2 | B | `materialPBR({ especular })` → `MeshPhysicalMaterial.specularIntensity`. **Hecho** (lección nueva) |
| Ritmo y claridad | Gancho que no presenta el objeto de cerca | Plano medio con caras cortadas | Crítica del concreto: gancho 5/10 | **A** | Cuadro 0 con el hotel sobre torres de cuñas y gatos, desde la zanja, con los obreros girando las barras. **Hecho** |
| Ritmo y claridad | Voz lenta: 2,79 p/s frente a 3,63 | v3 dirigida actúa despacio | VALIDACION | B | Tempo por línea (1,2–1,35) y silencios internos a 0,12 s: **2,99 p/s**. El gancho dura 5,4 s (objetivo 4,5). **Parcial** |
| Sincronía | Subtítulos pequeños y blancos sin énfasis | El preset `nicho` copiaba el tamaño de la referencia y no admitía color de énfasis (fallo: `enfasis` era a la vez la lista y el color) | Crítica: texto 6/10 | B | Un 20 % más grandes (4,4 % del alto) y `colorEnfasis` amarillo en la palabra clave. **Hecho** (fallo del kit corregido) |
| Sincronía | Efectos por palabra de más (60 en 61 s en la Torre) | Un efecto por cada palabra | ANALISIS | C | 36 acentos en 64 s (0,56 por segundo) más ambientes por acto. **Hecho** (se mide en la mezcla) |
| Render | Personajes tapados en el pase de profundidad | `overrideMaterial` reactiva `depthWrite` en haces y manchas transparentes | Hoja de diseño: el huésped del té no aparecía | B | Lo translúcido se oculta en el pase de profundidad. **Hecho** (lección nueva) |
| Render | Ruido no determinista en el AO | `GTAOPass` usa `SimplexNoise()` con `Math.random` | Lectura del código de three | **A** | Ruido sembrado en `crearMotorRealista`. `--determinismo` 6/6. **Hecho** |

## 2. Comparativa: referencia frente a nuestras producciones

| Dimensión | Referencia (Ricks Clips) | Torre v2 | Concreto v1 | **Hotel (esta producción)** |
|---|---|---|---|---|
| Premisa | Paradoja real o fábula con mecanismo real | Estafa real (buena) | Mecanismo real (bueno) | Hecho real con mecanismo visible |
| Gancho | Objeto absurdo en el cuadro 0 | Cartel y saco | Plano medio débil | Hotel sobre gatos desde la zanja |
| Luz y materiales | Física, con cielo, AO y bloom | Bandas | Bandas | Física (PBR, GTAO, bloom y cielo de Preetham) |
| Atrezo | Muy denso | Medio | Bajo | Alto en E1; medio en E2 y E3 |
| Cámara | Continua con fundidos | 15 cortes secos | Fundidos con tomas largas | Continua, anclada a palabras, con desenfoque |
| Voz | 3,6 p/s neutra | 3,1 p/s en español | 2,8 p/s, actuada | 3,0 p/s, actuada |
| Cierre | Ironía que vuelve al gancho | Moraleja | Bucle | Ironía: la escalera que crece |

Lo que todavía no alcanzamos y no se resuelve en este video:
- vegetación y coches de calidad comercial (la referencia usa modelos tipo biblioteca);
- personajes con más ángulos (siempre los vemos de frente);
- multitudes de cientos de figuras con variedad de animación.
