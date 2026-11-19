#!/usr/bin/env python3
"""Crea la carpeta de un video nuevo desde la plantilla de Motion Studio y configura la GPU.

    python nuevo.py <carpeta> [--nombre NOMBRE] [--gpu "texto del nombre"] [--duracion S] [--fps N] [--vertical]
                    [--sin-preparar] [--listar-gpus] [--edicion] [--25d]

- Copia assets/plantilla/ a <carpeta> (no pisa nada: si <carpeta> ya existe y no esta vacia, se detiene).
- Con --edicion crea un proyecto de edición de video real (assets/edicion/ + verificar.py y ritmo.py) con
  fuentes/camara, fuentes/pantalla, fuentes/broll y fuentes/audio, y guarda el perfil del equipo (preparar.py --perfil).
- Con --25d añade la capa 2.5D (assets/plantilla-25d/): escenarios Three.js con kit/escena3d.js, personajes 2D como
  billboards, manadas instanciadas, cámara 3D y exportar_glb.mjs para abrir los escenarios en Blender (references/25d.md).
- Detecta las GPU del equipo (Windows) y escribe la elegida en <carpeta>/motion.config.json.
  Si hay varias y no usas --gpu, elige la dedicada (NVIDIA > Radeon RX/Arc) y te lo dice: confirmalo con el usuario.
- Escribe la duracion, los fps y la orientacion del brief (--vertical = 1080x1920) en motion.config.json.
- Ejecuta preparar.py: instala lo que falte a nivel de usuario (Playwright, Chromium, fuentes, numpy, Pillow) en las
  herramientas compartidas y comprueba Node, FFmpeg y la GPU. Con --sin-preparar solo comprueba, sin instalar.
"""
import argparse
import json
import re
import shutil
import subprocess
import sys
from pathlib import Path

PLANTILLA = Path(__file__).resolve().parent.parent / "assets" / "plantilla"
EDICION = Path(__file__).resolve().parent.parent / "assets" / "edicion"
CAPA_25D = Path(__file__).resolve().parent.parent / "assets" / "plantilla-25d"
# herramientas de la plantilla de animación que el modo edición reutiliza tal cual
COMPARTIDAS = ["verificar.py", "ritmo.py"]
# (patron del nombre, texto para `gpu.coincidir`, prioridad: menor = mas probable que sea la dedicada)
MARCAS = [(r"NVIDIA|GeForce|RTX|GTX", "NVIDIA", 0), (r"Radeon RX|Radeon Pro|\bRX \d", "Radeon", 1), (r"Intel.*Arc|\bArc\b", "Arc", 2),
          (r"AMD|Radeon", "AMD|Radeon", 3), (r"Intel", "Intel", 4)]


def buscar_blender():
    """Ruta de blender.exe (o del binario) si está instalado: BLENDER, PATH o la carpeta estándar de Windows/macOS."""
    import os
    candidatos = [os.environ.get("BLENDER"), shutil.which("blender")]
    raiz = Path(os.environ.get("ProgramFiles", "C:/Program Files")) / "Blender Foundation"
    if raiz.is_dir():
        candidatos += [str(p) for p in sorted(raiz.glob("Blender */blender.exe"), reverse=True)]
    candidatos.append("/Applications/Blender.app/Contents/MacOS/Blender")
    for c in candidatos:
        if c and Path(c).is_file():
            return str(Path(c)).replace("\\", "/")
    return None


def listar_gpus():
    if sys.platform != "win32":
        return []
    try:
        r = subprocess.run(["powershell", "-NoProfile", "-Command",
                            "Get-CimInstance Win32_VideoController | ForEach-Object { $_.Name }"],
                           capture_output=True, text=True, timeout=30)
    except (OSError, subprocess.TimeoutExpired):
        return []
    return [n.strip() for n in r.stdout.splitlines() if n.strip() and "Basic Render" not in n]


def clasificar(nombre):
    for patron, coincidir, prio in MARCAS:
        if re.search(patron, nombre, re.I):
            return coincidir, prio
    return "", 9


def elegir(gpus, preferida):
    """Devuelve (nombre, coincidir, modo)."""
    if preferida:
        for n in gpus:
            if preferida.lower() in n.lower():
                return n, clasificar(n)[0], "alto-rendimiento"
        # nombre dado por el usuario que no esta en la lista detectada: se respeta tal cual
        return preferida, clasificar(preferida)[0], "alto-rendimiento"
    if not gpus:
        return "", "", "auto"
    if len(gpus) == 1:
        return gpus[0], clasificar(gpus[0])[0], "auto"
    mejor = min(gpus, key=lambda n: clasificar(n)[1])
    return mejor, clasificar(mejor)[0], "alto-rendimiento"


def preparar(instalar):
    """Herramientas compartidas (Playwright, Chromium, fuentes, numpy, Pillow) y comprobación de Node, FFmpeg y GPU.
    Delegado en preparar.py para que haya una sola definición de lo que necesita la skill."""
    cmd = [sys.executable, str(Path(__file__).resolve().parent / "preparar.py")] + ([] if instalar else ["--comprobar"])
    sys.stdout.flush()   # que el resumen del proyecto salga antes que el informe de herramientas
    return subprocess.run(cmd).returncode == 0


def nuevo_edicion(destino, a):
    """Proyecto de edición de video real: las herramientas de assets/edicion, las de revisión compartidas con la
    animación y las carpetas de fuentes. La salida (resolución, fps) la propone analizar.py desde las grabaciones,
    salvo que se fije aquí con --fps o --vertical."""
    shutil.copytree(EDICION, destino, dirs_exist_ok=True, ignore=shutil.ignore_patterns("__pycache__"))
    for f in COMPARTIDAS:
        shutil.copy2(PLANTILLA / f, destino / f)
    for sub in ("camara", "pantalla", "broll", "audio"):
        (destino / "fuentes" / sub).mkdir(parents=True, exist_ok=True)
    salida = {"nombre": a.nombre or re.sub(r"[^A-Za-z0-9_-]+", "-", destino.name).strip("-") or "video"}
    if a.fps:
        salida["fps"] = a.fps
    if a.vertical:
        salida["ancho"], salida["alto"] = 1080, 1920
    (destino / "montaje.json").write_text(json.dumps({"version": 1, "salida": salida, "fuentes": {}, "clips": [],
                                                      "curva": {"reganches": [], "pausas": []}}, ensure_ascii=False, indent=1) + "\n",
                                          encoding="utf-8")
    print(f"Proyecto de edición creado: {destino}")
    print("Copia las grabaciones en fuentes/camara (tú a cámara), fuentes/pantalla (OBS), fuentes/broll y, si grabaste")
    print("la voz aparte, fuentes/audio. Después: python analizar.py")
    print()
    sys.stdout.flush()
    r = subprocess.run([sys.executable, str(Path(__file__).resolve().parent / "preparar.py"), "--perfil"])
    if r.returncode:
        print("AVISO: falta alguna herramienta (ver arriba). Sin faster-whisper el proyecto trabaja en nivel núcleo.")
    return 0


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("carpeta", nargs="?")
    ap.add_argument("--nombre", help="nombre del archivo de salida (por defecto, el de la carpeta)")
    ap.add_argument("--gpu", help="parte del nombre de la GPU a usar, p. ej. \"RTX 3050\"")
    ap.add_argument("--duracion", type=float, help="segundos del video (la plantilla trae un ejemplo)")
    ap.add_argument("--fps", type=int, help="fotogramas por segundo, p. ej. 30 o 60")
    ap.add_argument("--vertical", action="store_true", help="1080x1920 (shorts, reels) en lugar de 1920x1080")
    ap.add_argument("--sin-preparar", action="store_true", help="no instalar herramientas que falten; solo comprobarlas")
    ap.add_argument("--listar-gpus", action="store_true")
    ap.add_argument("--edicion", action="store_true", help="proyecto del modo edición de video real (references/edicion.md)")
    ap.add_argument("--25d", dest="d25", action="store_true",
                    help="animación 2.5D con Three.js: escenarios 3D, billboards y exportación a Blender (references/25d.md)")
    a = ap.parse_args()

    gpus = listar_gpus()
    if a.listar_gpus or not a.carpeta:
        print("\n".join(gpus) if gpus else "No se detectaron GPU (o el sistema no es Windows): configura gpu.* a mano.")
        return 0

    destino = Path(a.carpeta).resolve()
    if destino.exists() and any(destino.iterdir()):
        print(f"ERROR: {destino} ya existe y no esta vacia; no se sobrescribe nada.", file=sys.stderr)
        return 1
    if a.edicion:
        return nuevo_edicion(destino, a)
    shutil.copytree(PLANTILLA, destino, dirs_exist_ok=True)
    if a.d25:
        shutil.copytree(CAPA_25D, destino, dirs_exist_ok=True, ignore=shutil.ignore_patterns("__pycache__"))

    nombre_gpu, coincidir, modo = elegir(gpus, a.gpu)
    ruta = destino / "motion.config.json"
    cfg = json.loads(ruta.read_text(encoding="utf-8"))
    cfg["gpu"].update({"modo": modo, "coincidir": coincidir, "nombre": nombre_gpu})
    cfg["salida"]["nombre"] = a.nombre or re.sub(r"[^A-Za-z0-9_-]+", "-", destino.name).strip("-") or "video"
    if a.duracion:
        cfg["video"]["duracion"] = a.duracion
    if a.fps:
        cfg["video"]["fps"] = a.fps
    if a.vertical:
        cfg["video"]["ancho"], cfg["video"]["alto"] = 1080, 1920
    if a.d25:
        blender = buscar_blender()
        if blender:
            cfg["blender"] = blender
    ruta.write_text(json.dumps(cfg, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    print(f"Proyecto creado: {destino}")
    print(f"GPU detectadas: {', '.join(gpus) if gpus else 'ninguna'}")
    print(f"GPU configurada: {nombre_gpu or '(automatica)'}  modo={modo}")
    v = cfg["video"]
    print(f"Video: {v['ancho']}x{v['alto']} · {v['fps']} fps · {v['duracion']} s"
          + ("" if a.duracion else "  (duracion de ejemplo: ajustala al brief con --duracion o en motion.config.json)"))
    if len(gpus) > 1 and not a.gpu:
        print("AVISO: hay varias GPU; se eligio la dedicada. Confirma con el usuario y cambia motion.config.json si no es la que quiere.")
    if a.d25:
        print(f"Capa 2.5D: composicion.js + kit/escena3d.js + exportar_glb.mjs · Blender: {cfg.get('blender') or 'no encontrado (opcional)'}")
    print()
    if not preparar(instalar=not a.sin_preparar):
        print("AVISO: faltan herramientas (ver arriba). El proyecto está creado, pero no se podrá renderizar hasta resolverlo.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
