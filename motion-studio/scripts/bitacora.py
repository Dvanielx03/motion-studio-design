#!/usr/bin/env python3
"""Bitácora de producción: tiempo por etapa, renders y cuellos de botella (por proyecto y entre proyectos).

    python bitacora.py --proyecto <carpeta> inicio guion        abre la etapa «guion»
    python bitacora.py --proyecto <carpeta> fin guion --nota "aprobado a la 2.ª"
    python bitacora.py --proyecto <carpeta> resumen              etapas + renders de ese video
    python bitacora.py global                                    medianas por etapa de todos los videos

Proyecto = carpeta del VIDEO. --proyecto vale la del video (videos/2026-11-17_x) o la del render
(videos/2026-11-17_x/03-proyecto): si el nombre empieza por «NN-», cuenta su carpeta padre. La clave de cada fila es
el nombre de la carpeta del video («2026-11-17_x»), la misma que anota render.mjs; las claves antiguas
(«videos/2026-11-17_x», «2026-11-17_x/03-proyecto») se normalizan al leer. Las etapas se anotan en
<video>/review/bitacora.jsonl y en la bitácora global (~/.motion-studio/bitacora.jsonl o MOTION_STUDIO_HOME);
`resumen` une <video>/review y <video>/NN-*/review (render.mjs anota en la review de su carpeta).

Etapas (las 10 de references/produccion-25d.md): concepto, guion, storyboard, diseno, animatic, produccion, render,
sonido, qc, optimizacion. Se admiten otras.
Renders: render.mjs anota cada uno (vista, prueba, borrador, final) con su duración y salen como «render:<modo>»
(tiempo de máquina, intervalo [fecha − segundos, fecha]). La etapa «render» es la que marcas a mano con inicio/fin;
si no la marcas, vale el tiempo de los render:<modo>. Los render:<modo> son su desglose: nunca se suman otra vez.
Tiempo de pared = unión de los intervalos (lo que corre en paralelo cuenta una vez). La suma por etapa puede ser
mayor («hay etapas en paralelo») o menor, si render.mjs corrió fuera de las etapas marcadas con «render» a mano
(«X de render.mjs fuera de las etapas marcadas»). El % del cuello de botella es sobre el tiempo de pared.
Mide tiempo de pared del equipo; no mide tokens ni créditos (anótalos con --nota si interesan).
"""
import argparse
import json
import os
import re
import statistics
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

ETAPAS = ["concepto", "guion", "storyboard", "diseno", "animatic", "produccion", "render", "sonido", "qc", "optimizacion"]
GLOBAL = Path(os.environ.get("MOTION_STUDIO_HOME", Path.home() / ".motion-studio")) / "bitacora.jsonl"
NN = re.compile(r"^\d\d-")


def carpeta_video(carpeta):
    """Contrato con render.mjs: si la carpeta se llama «NN-…» (03-proyecto), el video es su carpeta padre."""
    return carpeta.parent if NN.match(carpeta.name) else carpeta


def clave(proyecto):
    """Clave normalizada de una fila: nombre de la carpeta del video (acepta las antiguas «padre/hijo»)."""
    partes = [x for x in str(proyecto).replace("\\", "/").split("/") if x] or ["?"]
    return partes[-2] if len(partes) > 1 and NN.match(partes[-1]) else partes[-1]


def ahora():
    return datetime.now(timezone.utc).isoformat(timespec="milliseconds")   # milisegundos: sin duraciones nulas


def fecha(texto):
    t = datetime.fromisoformat(texto.replace("Z", "+00:00"))   # render.mjs escribe toISOString(), con «Z»
    return t if t.tzinfo else t.replace(tzinfo=timezone.utc)


def anotar(video, fila):
    fila = {"fecha": ahora(), "proyecto": video.name, **fila}
    linea = json.dumps(fila, ensure_ascii=False) + "\n"
    for destino in (video / "review" / "bitacora.jsonl", GLOBAL):
        destino.parent.mkdir(parents=True, exist_ok=True)
        with open(destino, "a", encoding="utf-8") as f:
            f.write(linea)


def bitacoras_del_video(video):
    """<video>/review/bitacora.jsonl y la de cada subcarpeta «NN-…» (03-proyecto, donde anota render.mjs)."""
    subs = sorted(c for c in video.iterdir() if c.is_dir() and NN.match(c.name)) if video.is_dir() else []
    return [video / "review" / "bitacora.jsonl", *(c / "review" / "bitacora.jsonl" for c in subs)]


def leer(*rutas):
    """Filas de una o varias bitácoras, sin repetir las idénticas."""
    filas, vistas = [], set()
    for ruta in rutas:
        if not ruta.exists():
            continue
        for l in ruta.read_text(encoding="utf-8").splitlines():
            try:
                f = json.loads(l)
            except json.JSONDecodeError:
                continue
            k = json.dumps(f, sort_keys=True, ensure_ascii=False)
            if isinstance(f, dict) and k not in vistas:
                vistas.add(k); filas.append(f)
    return filas


def intervalos(filas):
    """({proyecto: {etapa: [(t0, t1), ...]}}, {(proyecto, etapa): inicio} de las abiertas).
    Etapas manuales: cada par inicio→fin. Filas de render.mjs: «render:<modo>» en [fecha − segundos, fecha]."""
    con_fecha = []
    for f in filas:
        try:
            con_fecha.append((fecha(f["fecha"]), f))
        except (KeyError, TypeError, ValueError, AttributeError):
            pass   # fila sin fecha legible: se ignora
    iv, abiertas = {}, {}
    for t, f in sorted(con_fecha, key=lambda x: x[0]):   # varias bitácoras: ordenar antes de emparejar
        p = clave(f.get("proyecto", "?"))
        if f.get("evento") in ("inicio", "fin") and f.get("etapa"):
            k = (p, f["etapa"])
            if f["evento"] == "inicio":
                abiertas[k] = t
            elif k in abiertas:
                iv.setdefault(p, {}).setdefault(f["etapa"], []).append((abiertas.pop(k), t))
        elif "modo" in f and isinstance(f.get("segundos"), (int, float)):
            iv.setdefault(p, {}).setdefault(f"render:{f['modo']}", []).append((t - timedelta(seconds=f["segundos"]), t))
    return iv, abiertas


def pared(xs):
    """Segundos de la unión de intervalos: lo que se solapa cuenta una vez."""
    total, fin = 0.0, None
    for a, b in sorted(x for x in xs if x[1] > x[0]):
        if fin is None or a >= fin:
            total += (b - a).total_seconds(); fin = b
        elif b > fin:
            total += (b - fin).total_seconds(); fin = b
    return total


def etapas_de(por_etapa):
    """({etapa: s}, {modo: s}). «render» es el inicio/fin manual o, si no se marcó, el tiempo de render.mjs."""
    etapas = {e: pared(xs) for e, xs in por_etapa.items() if not e.startswith("render:")}
    maquina = {e.split(":", 1)[1]: pared(xs) for e, xs in por_etapa.items() if e.startswith("render:")}
    if maquina and "render" not in etapas:
        etapas["render"] = pared([x for e, xs in por_etapa.items() if e.startswith("render:") for x in xs])
    return etapas, maquina


def intervalos_de_etapas(por_etapa):
    """Los intervalos que cuentan en alguna etapa: los marcados a mano y, si «render» no se marcó, los de render.mjs
    (que entonces SON la etapa «render»). Con «render» manual, los render:<modo> son solo desglose y no entran."""
    manual = "render" in por_etapa
    return [x for e, xs in por_etapa.items() if not (manual and e.startswith("render:")) for x in xs]


def hms(s):
    s = int(round(s)); return f"{s // 3600}h{s % 3600 // 60:02d}m" if s >= 3600 else f"{s // 60}m{s % 60:02d}s"


def resumen(filas, titulo):
    iv, abiertas = intervalos(filas)
    if not iv and not abiertas:
        print("Sin registros todavía."); return
    print(titulo)
    for p in sorted(set(iv) | {pa for pa, _ in abiertas}):
        etapas, maquina = etapas_de(iv.get(p, {}))
        muro = pared([x for xs in iv.get(p, {}).values() for x in xs])
        suma = sum(etapas.values())
        # suma ≠ pared por dos causas que hay que distinguir (pueden darse a la vez y compensarse):
        # · suma > tiempo cubierto por las etapas → hay etapas que se solapan (en paralelo);
        # · pared > tiempo cubierto → render.mjs corrió fuera de las etapas marcadas (solo con «render» a mano).
        cubierto = pared(intervalos_de_etapas(iv.get(p, {})))
        causas = (["hay etapas en paralelo"] if round(suma - cubierto) > 0 else []) + \
                 ([f"{hms(muro - cubierto)} de render.mjs fuera de las etapas marcadas"] if round(muro - cubierto) > 0 else [])
        print(f"\n  {p}  · tiempo de pared {hms(muro)}"
              + (f" · suma por etapa {hms(suma)} ({'; '.join(causas)})" if causas else ""))
        if not etapas:
            print("    sin etapas cerradas todavía")
        tope = max(etapas.values(), default=0)
        for e, s in sorted(etapas.items(), key=lambda x: -x[1]):
            barra = ("█" * round(30 * s / tope) if tope > 0 else "") or "▏"
            print(f"    {e:22} {hms(s):>8}  {barra}")
        if maquina:
            manual = "render" in iv.get(p, {})
            print("    render.mjs: " + ", ".join(f"{m} {hms(s)}" for m, s in sorted(maquina.items(), key=lambda x: -x[1]))
                  + (" (máquina; «render» es el marcado a mano)" if manual else " (desglose de «render»; no se suma aparte)"))
        if etapas:
            e, s = max(etapas.items(), key=lambda x: x[1])
            print(f"    cuello de botella: {e}" + (f" ({round(100 * s / muro)} % del tiempo de pared)" if muro > 0 else " (duraciones nulas)"))
        for (pa, e), t in sorted(abiertas.items(), key=lambda x: x[1]):
            if pa == p:
                print(f"    abierta sin cerrar: {e} desde {t.isoformat(timespec='minutes')}")


def global_(filas):
    iv, _ = intervalos(filas)
    por_etapa = {}
    for d in iv.values():
        etapas, maquina = etapas_de(d)
        for e, s in [*etapas.items(), *((f"render:{m}", s) for m, s in maquina.items())]:
            por_etapa.setdefault(e, []).append(s)
    print(f"Bitácora global ({GLOBAL}) · {len(iv)} proyectos")
    for e, xs in sorted(por_etapa.items(), key=lambda x: -statistics.median(x[1])):
        print(f"  {e:22} mediana {hms(statistics.median(xs)):>8} · máx {hms(max(xs)):>8} · n={len(xs)}")
    if any(e.startswith("render:") for e in por_etapa):
        print("  (render:<modo> = tiempo de render.mjs por modo: desglose de «render», no una etapa más)")


def main():
    if hasattr(sys.stdout, "reconfigure"):   # antes de argparse: --help con la salida redirigida no cabe en cp1252 («−»)
        sys.stdout.reconfigure(encoding="utf-8")
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--proyecto", type=Path, default=Path("."), help="carpeta del video o su 03-proyecto (es la misma)")
    ap.add_argument("accion", choices=["inicio", "fin", "resumen", "global"])
    ap.add_argument("etapa", nargs="?")
    ap.add_argument("--nota", default="")
    a = ap.parse_args()
    video = carpeta_video(a.proyecto.resolve())
    if a.accion in ("inicio", "fin"):
        if not a.etapa:
            ap.error("falta la etapa")
        if a.etapa not in ETAPAS:
            print(f"AVISO: «{a.etapa}» no es una de las 10 etapas ({', '.join(ETAPAS)}); se anota igual.")
        anotar(video, {"evento": a.accion, "etapa": a.etapa, **({"nota": a.nota} if a.nota else {})})
        print(f"{a.accion} {a.etapa} · {video.name}")
    elif a.accion == "resumen":
        resumen(leer(*bitacoras_del_video(video)), f"Bitácora de {video.name}")
    else:
        global_(leer(GLOBAL))


if __name__ == "__main__":
    main()
