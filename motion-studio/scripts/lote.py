"""Producción por lotes de Shorts 2.5D con Motion Studio: del guion aprobado al hueco del calendario, con puerta de calidad.

    python lote.py estado                          tabla del lote (huecos, estado de cada video y siguiente paso)
    python lote.py nuevo DC-03                      crea <videos>/<carpeta>/ y copia el proyecto base (kit y escenarios)
    python lote.py audio DC-03 [paso]               audio_video.py: todo (montar → mezcla) o un paso (grabar, elegir…)
    python lote.py render DC-03 --muestra 0,8       prueba con audio (≤ 10 s) → 05-render/muestra_<slug>_vN.mp4
    python lote.py render DC-03 --final             completo CRF 12 slow → 05-render/<slug>_completo_vN.mp4
    python lote.py puerta DC-03 [--mp4 RUTA]        auditar, determinismo, qc_escena, verificar, pops, ritmo y comparar → review/puerta.json
    python lote.py critica DC-03 7.2 [--ronda 1]    anota la nota del crítico independiente (references/critica.md)
    python lote.py publicar DC-03 --aprobado "…"    publicar.json con el hueco del lote; con «publicador» en lote.json, lo lanza
                                                    (--programar: también su paso de programar)

El lote vive en <carpeta>/lote.json (--lote; por defecto, el lotes/20*/lote.json más reciente bajo el directorio actual).
Nada se publica sin la puerta en PASA y la aprobación final del usuario con sus palabras (--aprobado). Formato de lote.json
y del publicador: references/lotes.md (plantilla en assets/lote/ejemplo.lote.json).
"""
import argparse
import glob
import json
import os
import re
import shutil
import subprocess
import sys
from datetime import datetime

SKILL_SCRIPTS = os.path.dirname(os.path.abspath(__file__))
NO_COPIAR = {"audio", "review", "exportaciones", "REVISION.md", "sincro.json", "subtitulos.srt", "node_modules", ".cache"}
ESTADOS = ["parrilla", "guion", "guion-aprobado", "proyecto", "audio", "render", "puerta", "aprobado", "programado"]
SIGUIENTE = {"parrilla": "escribir el guion técnico", "guion": "aprobación del guion (usuario)", "guion-aprobado": "lote.py nuevo",
             "proyecto": "grabar la voz y lote.py audio", "audio": "dirigir los planos y lote.py render --final",
             "render": "lote.py puerta + crítica", "puerta": "aprobación final (usuario)", "aprobado": "lote.py publicar",
             "programado": "métricas a 24/48/72 h"}
ZONAS_SUBTITULOS = ["0,0.6,1,0.25", "0,0.1,1,0.2"]   # pops.py no vigila los subtítulos palabra a palabra


def _hacia_arriba(desde, nombre):
    d = os.path.abspath(desde)
    while True:
        if os.path.exists(os.path.join(d, nombre)):
            return os.path.join(d, nombre)
        if os.path.dirname(d) == d:
            return None
        d = os.path.dirname(d)


def python_medidas(desde):
    """Intérprete con numpy/faster-whisper: MOTION_STUDIO_PY, el .venv más cercano hacia arriba o el actual."""
    if os.environ.get("MOTION_STUDIO_PY"):
        return os.environ["MOTION_STUDIO_PY"]
    for rel in (os.path.join(".venv", "Scripts", "python.exe"), os.path.join(".venv", "bin", "python")):
        r = _hacia_arriba(desde, rel)
        if r:
            return r
    return sys.executable


def carpeta_lote(arg):
    if arg:
        return os.path.abspath(arg)
    c = sorted(d for d in glob.glob(os.path.join(os.getcwd(), "lotes", "20*")) if os.path.exists(os.path.join(d, "lote.json")))
    if not c:
        raise SystemExit("no hay ningún lotes/<fecha>_<canal>/lote.json bajo el directorio actual: usa --lote <carpeta>")
    return c[-1]


def leer_json(ruta_):
    with open(ruta_, encoding="utf-8") as f:
        return json.load(f)


def escribir_json(ruta_, datos, indent=1):
    with open(ruta_, "w", encoding="utf-8") as f:
        json.dump(datos, f, ensure_ascii=False, indent=indent)


def cargar(dl):
    return leer_json(os.path.join(dl, "lote.json"))


def guardar(dl, L):
    escribir_json(os.path.join(dl, "lote.json"), L)


def ruta(dl, r):
    """Ruta de lote.json: absoluta tal cual; relativa, desde la carpeta del lote."""
    return r if os.path.isabs(r) else os.path.normpath(os.path.join(dl, r))


def video(L, vid):
    for v in L["videos"]:
        if v["id"].lower() == vid.lower():
            return v
    raise SystemExit(f"{vid} no está en el lote")


def carpeta_video(dl, L, v):
    return os.path.join(ruta(dl, L.get("carpeta_videos", os.path.join("..", "..", "videos"))), v["carpeta"])


def proyecto(dl, L, v):
    return os.path.join(carpeta_video(dl, L, v), "03-proyecto")


def marcar(dl, L, v, estado, nota=None):
    v["estado"] = estado
    v.setdefault("historial", []).append({"cuando": datetime.now().isoformat(timespec="minutes"), "estado": estado, **({"nota": nota} if nota else {})})
    guardar(dl, L)


def correr(cmd, cwd, **kw):
    print("$ " + " ".join(str(c) for c in cmd), flush=True)
    return subprocess.run(cmd, cwd=cwd, **kw)


def siguiente_version(dirr, patron):
    n = [int(m.group(1)) for f in os.listdir(dirr) if (m := re.fullmatch(patron, f))] if os.path.isdir(dirr) else []
    return max(n, default=0) + 1


# ---- comandos ------------------------------------------------------------------------------------------------------
def c_estado(dl, L, a):
    print(f"Lote {os.path.basename(dl)} · canal {L['canal']} · {L.get('ritmo', '')}")
    print(f"{'id':6} {'hueco':17} {'estado':15} {'historia':52} siguiente")
    for v in L["videos"]:
        print(f"{v['id']:6} {v['fecha'] + ' ' + v['hora']:17} {v['estado']:15} {v['titulo'][:50]:52} {SIGUIENTE.get(v['estado'], '')}")


def c_nuevo(dl, L, a):
    v = video(L, a.id)
    base = os.path.abspath(a.base) if a.base else ruta(dl, L["proyecto_base"])
    dv, dp = carpeta_video(dl, L, v), proyecto(dl, L, v)
    if os.path.exists(dp):
        raise SystemExit(f"ya existe {dp}")
    for sub in ("00-investigacion", "01-guion", "02-diseno", "05-render"):
        os.makedirs(os.path.join(dv, sub), exist_ok=True)
    shutil.copytree(base, dp, ignore=lambda d, fs: [f for f in fs if f in NO_COPIAR or f.startswith("_completo") or f.endswith(".mp4")]
                    if os.path.abspath(d) == base else [f for f in fs if f in ("__pycache__",)])
    for sub in ("audio", "review", "exportaciones"):
        os.makedirs(os.path.join(dp, sub), exist_ok=True)
    rc = os.path.join(dp, "motion.config.json")
    mc = leer_json(rc)
    mc["salida"]["nombre"] = v["slug"]
    escribir_json(rc, mc, indent=2)
    vj = os.path.join(dv, "01-guion", "video.json")
    if os.path.exists(vj):                 # el guion técnico aprobado, en datos
        shutil.copy(vj, os.path.join(dp, "video.json"))
    print(f"proyecto creado: {dp}\n  base: {base}\n  video.json: {'copiado de 01-guion' if os.path.exists(vj) else 'FALTA (escríbelo en 01-guion/video.json)'}")
    marcar(dl, L, v, "proyecto")


def c_audio(dl, L, a):
    v = video(L, a.id)
    dp = proyecto(dl, L, v)
    vj = os.path.join(carpeta_video(dl, L, v), "01-guion", "video.json")
    if os.path.exists(vj) and (not os.path.exists(os.path.join(dp, "video.json")) or os.path.getmtime(vj) > os.path.getmtime(os.path.join(dp, "video.json"))):
        shutil.copy(vj, os.path.join(dp, "video.json"))
    r = correr([sys.executable, os.path.join(SKILL_SCRIPTS, "audio_video.py"), dp, a.paso or "todo"] + (a.extra or []), dp)
    if r.returncode:
        raise SystemExit(r.returncode)
    if (a.paso or "todo") in ("todo", "mezcla"):
        marcar(dl, L, v, "audio")


def c_render(dl, L, a):
    v = video(L, a.id)
    dp, dr = proyecto(dl, L, v), os.path.join(carpeta_video(dl, L, v), "05-render")
    os.makedirs(dr, exist_ok=True)
    if a.final:
        r = correr(["node", "render.mjs", "--final"], dp)
        if r.returncode:
            raise SystemExit(r.returncode)
        n = siguiente_version(dr, rf"{re.escape(v['slug'])}_completo_v(\d+)\.mp4")
        dst = os.path.join(dr, f"{v['slug']}_completo_v{n}.mp4")
        shutil.copy(os.path.join(dp, "exportaciones", f"{v['slug']}.mp4"), dst)
        print(f"completo: {dst}")
        marcar(dl, L, v, "render", os.path.basename(dst))
    else:
        r = correr(["node", "render.mjs", f"--prueba={a.muestra}"], dp)
        if r.returncode:
            raise SystemExit(r.returncode)
        pr = max(glob.glob(os.path.join(dp, "review", "pruebas", "*.mp4")), key=os.path.getmtime)
        n = siguiente_version(dr, rf"muestra_{re.escape(v['slug'])}_v(\d+)\.mp4")
        dst = os.path.join(dr, f"muestra_{v['slug']}_v{n}.mp4")
        shutil.copy(pr, dst)
        print(f"muestra: {dst}")


def c_puerta(dl, L, a):
    v = video(L, a.id)
    dp, dr = proyecto(dl, L, v), os.path.join(carpeta_video(dl, L, v), "05-render")
    completos = glob.glob(os.path.join(dr, f"{v['slug']}_completo_v*.mp4"))
    if not a.mp4 and not completos:
        raise SystemExit(f"no hay {v['slug']}_completo_vN.mp4 en {dr}: lote.py render {v['id']} --final")
    mp4 = os.path.abspath(a.mp4) if a.mp4 else max(completos, key=os.path.getmtime)   # absoluta: los pasos corren en 03-proyecto
    env = dict(os.environ, PYTHONIOENCODING="utf-8")
    zonas = [x for z in L.get("pops_zonas", ZONAS_SUBTITULOS) for x in ("--zona-ignorada", z)]
    pasos = [
        ("auditar", ["node", "auditar.mjs"], True),
        ("determinismo", ["node", "render.mjs", "--determinismo"], True),
        ("qc_escena", ["node", "qc_escena.mjs"], True),
        ("verificar", [sys.executable, "verificar.py", mp4], True),
        ("pops", [sys.executable, "pops.py", mp4] + zonas + (["--permitir", v["pops_permitir"]] if v.get("pops_permitir") else []), True),
        ("ritmo", [sys.executable, "ritmo.py", mp4], False),     # informativo: el ritmo del nicho se juzga con comparar y el crítico
    ]
    ref = L.get("referencia")                                    # {"mp4": …, "palabras": …}: comparar.py contra el nicho
    if ref and ref.get("mp4"):
        cmd = [python_medidas(dl), os.path.join(SKILL_SCRIPTS, "comparar.py"), ruta(dl, ref["mp4"]), mp4]
        if ref.get("palabras"):
            cmd += ["--palabras-ref", ruta(dl, ref["palabras"]), "--palabras", os.path.join("audio", "voz.palabras.json")]
        pasos.append(("comparar", cmd + ["--json", os.path.join("review", "comparar.json")], False))
    res, log = {}, []
    for nombre, cmd, bloquea in pasos:
        r = correr(cmd, dp, capture_output=True, text=True, encoding="utf-8", errors="replace", env=env)
        salida = (r.stdout + r.stderr).strip().splitlines()
        codigo = r.returncode
        if nombre == "determinismo" and codigo:   # tolerancia documentada en lote.json: ruido de rasterizado de ≤ N px con Δ ≤ D
            tol = L.get("determinismo_tolerancia", {"px": 0, "delta": 0})
            difs = [(int(m.group(1)), int(m.group(2))) for m in re.finditer(r"(\d+) px distintos · Δ máx (\d+)", r.stdout + r.stderr)]
            if difs and all(n <= tol["px"] and d <= tol["delta"] for n, d in difs):
                codigo = 0; salida.append(f"(dentro de la tolerancia del lote: ≤ {tol['px']} px con Δ ≤ {tol['delta']})")
        res[nombre] = {"codigo": codigo, "codigo_real": r.returncode, "bloquea": bloquea, "resumen": salida[-6:]}
        log += [f"== {nombre} (código {r.returncode})"] + salida[-40:]
        print(f"  {nombre:13} {'OK' if codigo == 0 else ('FALLA' if bloquea else 'aviso')}" + (' (tolerancia)' if codigo != r.returncode else ''), flush=True)
    nota = v.get("critica")
    pasa_tec = all(x["codigo"] == 0 for x in res.values() if x["bloquea"])
    pasa = pasa_tec and nota is not None and nota >= L.get("nota_minima", 7.0)
    informe = {"mp4": mp4, "fecha": datetime.now().isoformat(timespec="minutes"), "pasos": res, "critica": nota,
               "nota_minima": L.get("nota_minima", 7.0), "pasa_tecnica": pasa_tec, "pasa": pasa}
    os.makedirs(os.path.join(dp, "review"), exist_ok=True)
    escribir_json(os.path.join(dp, "review", "puerta.json"), informe)
    with open(os.path.join(dp, "review", "puerta.log"), "w", encoding="utf-8") as f:
        f.write("\n".join(log))
    print(f"PUERTA {'PASA' if pasa else 'NO PASA'} · técnica {'OK' if pasa_tec else 'FALLA'} · crítica {nota if nota is not None else 'pendiente'}"
          f" (mínimo {L.get('nota_minima', 7.0)}) · detalle en review/puerta.log")
    if pasa:
        marcar(dl, L, v, "puerta")


def c_critica(dl, L, a):
    v = video(L, a.id)
    v["critica"] = a.nota
    v.setdefault("criticas", []).append({"ronda": a.ronda, "nota": a.nota})
    guardar(dl, L)
    print(f"{v['id']}: crítica {a.nota} (ronda {a.ronda})")


def _orden(plantilla, campos):
    return [str(x).format(**campos) for x in plantilla]


def c_publicar(dl, L, a):
    v = video(L, a.id)
    dv, dp = carpeta_video(dl, L, v), proyecto(dl, L, v)
    pj = os.path.join(dp, "review", "puerta.json")
    if not os.path.exists(pj) or not leer_json(pj)["pasa"]:
        raise SystemExit("la puerta no está en PASA: no se prepara la publicación")
    if not a.aprobado:
        raise SystemExit("falta --aprobado con las palabras del usuario (aprobación final)")
    if not os.path.exists(os.path.join(dv, "PUBLICACION.md")):
        raise SystemExit("falta PUBLICACION.md (título, descripción con fuentes, etiquetas)")
    mp4 = leer_json(pj)["mp4"]
    pieza = f"{v['id'].lower()}-{v['slug']}"
    pub = {"canal": L["canal"], "pieza": pieza, "formato": "short",
           "master": os.path.relpath(mp4, dv).replace("\\", "/"), "metadatos": "PUBLICACION.md", "lista": None,
           "miniatura": {"archivo": None, "fotograma_origen_s": v.get("portada_s", 2.0)}, "creditos": None,
           "sintetico_realista": False, "programacion": {"fecha": v["fecha"], "hora": v["hora"]},
           "aprobado_final": a.aprobado, "notas": f"Lote {os.path.basename(dl)} · crítica {v.get('critica')} · puerta PASA."}
    escribir_json(os.path.join(dv, "publicar.json"), pub, indent=2)
    marcar(dl, L, v, "aprobado", a.aprobado)
    P = L.get("publicador")
    if not P:
        print(f"publicar.json escrito en {dv}. Sin «publicador» en lote.json: súbelo con tu sistema de publicación.")
        return
    cwd = ruta(dl, P.get("cwd", "."))
    campos = {"py": python_medidas(cwd), "canal": L["canal"], "pieza": pieza, "ref": f"{L['canal']}/{pieza}", "carpeta": dv}
    for paso in P.get("pasos", []):
        r = correr(_orden(paso, campos), cwd)
        if r.returncode:
            raise SystemExit(f"publicador: «{' '.join(_orden(paso, campos))}» falló ({r.returncode})")
    if a.programar and P.get("programar"):
        r = correr(_orden(P["programar"], campos), cwd, capture_output=True, text=True, encoding="utf-8", errors="replace")
        print(r.stdout + r.stderr)
        m = re.search(r"https://youtu\.be/(\S+)", r.stdout)
        if r.returncode or not m:
            raise SystemExit("programar no devolvió un enlace de YouTube: revisa el publicador")
        v["video_id"] = m.group(1)
        marcar(dl, L, v, "programado", m.group(0))


def main():
    for f in (sys.stdout, sys.stderr):            # consolas de Windows en cp1252
        if hasattr(f, "reconfigure"):
            f.reconfigure(encoding="utf-8", errors="replace")
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--lote")
    sp = ap.add_subparsers(dest="cmd", required=True)
    sp.add_parser("estado")
    p = sp.add_parser("nuevo"); p.add_argument("id"); p.add_argument("--base")
    p = sp.add_parser("audio"); p.add_argument("id"); p.add_argument("paso", nargs="?"); p.add_argument("extra", nargs="*")
    p = sp.add_parser("render"); p.add_argument("id"); g = p.add_mutually_exclusive_group(required=True)
    g.add_argument("--muestra"); g.add_argument("--final", action="store_true")
    p = sp.add_parser("puerta"); p.add_argument("id"); p.add_argument("--mp4")
    p = sp.add_parser("critica"); p.add_argument("id"); p.add_argument("nota", type=float); p.add_argument("--ronda", type=int, default=1)
    p = sp.add_parser("publicar"); p.add_argument("id"); p.add_argument("--aprobado"); p.add_argument("--programar", action="store_true")
    a = ap.parse_args()
    dl = carpeta_lote(a.lote)
    L = cargar(dl)
    {"estado": c_estado, "nuevo": c_nuevo, "audio": c_audio, "render": c_render, "puerta": c_puerta,
     "critica": c_critica, "publicar": c_publicar}[a.cmd](dl, L, a)


if __name__ == "__main__":
    main()
