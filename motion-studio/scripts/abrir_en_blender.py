"""Abre en Blender un escenario 2.5D exportado por kit/escena3d.js (exportar_glb.mjs) para revisarlo o retocarlo.

Uso (Blender 5.2 LTS probado):
  blender --factory-startup --python abrir_en_blender.py -- exportaciones/blender/calle.glb [--guardar] [--linea]
  blender -b --factory-startup --python abrir_en_blender.py -- calle.glb --guardar --captura calle_cam.png

- Importa el .glb (coordenadas de Three.js: Y arriba; el importador glTF de Blender ya las convierte a Z arriba).
- Si existe <nombre>.anclas.json al lado, crea una cámara por ancla ({pos, mira, fov} en coordenadas de Three.js)
  y deja activa la primera.
- --linea añade Line Art de Grease Pencil a toda la escena (contorno parecido al del navegador).
- --guardar escribe <nombre>.blend junto al .glb (no pisa uno existente salvo con --forzar).
- --captura RUTA renderiza la cámara activa con EEVEE a 1080 px de alto (comprobación visual rápida).
No cambia preferencias de Blender ni del sistema.
"""
import json
import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector

args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
if not args:
    raise SystemExit('Falta la ruta del .glb: blender --python abrir_en_blender.py -- escenario.glb')
glb = Path(args[0]).resolve()
if not glb.is_file():
    raise SystemExit(f'No existe {glb}')
opc = set(a for a in args[1:] if a.startswith('--'))
captura = None
if '--captura' in args:
    i = args.index('--captura')
    captura = Path(args[i + 1]).resolve() if i + 1 < len(args) else None

# escena vacía
for o in list(bpy.data.objects):
    bpy.data.objects.remove(o, do_unlink=True)
bpy.ops.import_scene.gltf(filepath=str(glb))
escena = bpy.context.scene
escena.name = glb.stem


def three_a_blender(p):
    """(x, y, z) de Three.js (Y arriba) → Blender (Z arriba), igual que el importador glTF."""
    x, y, z = p
    return Vector((x, -z, y))


anclas_json = glb.with_suffix('.anclas.json')
camaras = []
if anclas_json.is_file():
    anclas = json.loads(anclas_json.read_text(encoding='utf-8'))
    ancho, alto = anclas.pop('_salida', [1080, 1920]) if isinstance(anclas.get('_salida'), list) else (1080, 1920)
    escena.render.resolution_x, escena.render.resolution_y = int(ancho), int(alto)
    for nombre, a in anclas.items():
        if not isinstance(a, dict) or 'pos' not in a:
            continue
        datos = bpy.data.cameras.new(nombre)
        cam = bpy.data.objects.new(nombre, datos)
        escena.collection.objects.link(cam)
        cam.location = three_a_blender(a['pos'])
        direccion = three_a_blender(a.get('mira', [0, 0, 0])) - cam.location
        cam.rotation_euler = direccion.to_track_quat('-Z', 'Y').to_euler()
        # fov de Three.js es VERTICAL; en Blender se fija con sensor ajustado a la altura
        datos.sensor_fit = 'VERTICAL'
        datos.angle_y = math.radians(a.get('fov', 35))
        camaras.append(cam)
    if camaras:
        escena.camera = camaras[0]
    print(f'Anclas: {len(camaras)} cámaras ({", ".join(c.name for c in camaras)})')
else:
    print('Sin anclas (.anclas.json): no se crean cámaras')

# Luz de revisión: el .glb trae solo el decorado. `_sol` en las anclas = {"dir": [x, y, z] (hacia el sol, coordenadas
# de Three.js), "fuerza": 3}; si no está, un sol alto desde la izquierda. El cielo da relleno uniforme.
if not any(o.type == 'LIGHT' for o in escena.objects):
    sol_cfg = {}
    if anclas_json.is_file():
        sol_cfg = json.loads(anclas_json.read_text(encoding='utf-8')).get('_sol', {}) or {}
    datos_sol = bpy.data.lights.new('Sol', 'SUN')
    datos_sol.energy = float(sol_cfg.get('fuerza', 3.0))
    datos_sol.angle = math.radians(2)
    sol = bpy.data.objects.new('Sol', datos_sol)
    escena.collection.objects.link(sol)
    hacia = three_a_blender(sol_cfg.get('dir', [-6, 10, 4])).normalized()
    sol.rotation_euler = (-hacia).to_track_quat('-Z', 'Y').to_euler()
    mundo = escena.world or bpy.data.worlds.new('Mundo')
    escena.world = mundo
    mundo.use_nodes = True
    fondo = mundo.node_tree.nodes.get('Background')
    if fondo:
        fondo.inputs[0].default_value = (0.42, 0.46, 0.55, 1)
        fondo.inputs[1].default_value = 1.0

if '--linea' in opc:
    bpy.ops.object.grease_pencil_add(type='LINEART_SCENE')
    gp = bpy.context.active_object
    gp.name = 'Linea'
    for m in gp.modifiers:
        if m.type == 'LINEART':
            if hasattr(m, 'radius'):        # Blender 5.x (Grease Pencil v3): radio en metros
                m.radius = 0.006
            elif hasattr(m, 'thickness'):   # Blender 4.2 y anteriores: grosor en píxeles
                m.thickness = 3
            m.show_viewport = False  # si no, se recalcula en cada actualización de la vista (muy lento)

if '--guardar' in opc:
    destino = glb.with_suffix('.blend')
    if destino.exists() and '--forzar' not in opc:
        print(f'Ya existe {destino}; usa --forzar para reemplazarlo')
    else:
        bpy.ops.wm.save_as_mainfile(filepath=str(destino))
        print(f'Guardado {destino}')

if captura and escena.camera:
    escena.render.engine = 'BLENDER_EEVEE'
    escena.render.resolution_percentage = round(100 * 1080 / max(escena.render.resolution_y, 1))
    escena.render.filepath = str(captura)
    bpy.ops.render.render(write_still=True)
    print(f'Captura {captura}')
