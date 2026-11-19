#!/usr/bin/env python3
"""Revisión automática del guion CON la voz medida (no sustituye la dirección: avisa, no decide).

    python revisar_guion.py                 mide audio/guion.json con los tiempos de la voz
    python revisar_guion.py --estricto      código 1 si algún aviso es de los marcados como bloqueantes
    python revisar_guion.py --guardar       si los tiempos salen de voz.palabras.json, los escribe en audio/tiempos_voz.json

Qué necesita (carpeta del proyecto, junto a este script; ninguna otra herramienta los escribe por ti):
- audio/guion.json: lista JSON con el texto de cada línea de la voz, en orden y tal como se locuta. Lo escribes al
  cerrar el guion; una línea = una frase o golpe de la voz. También vale [{"id": "L01", "texto": "..."}, ...].
      ["Hanói, 1902. Pagas un centavo por cada rata muerta…", "Tus ingenieros acaban de terminar cloacas…", ...]
- Los tiempos de cada línea, de una de estas dos fuentes:
  · audio/tiempos_voz.json (si existe, manda): {"duracion": 66.05, "lineas": [{"id": "L01", "inicio": 0.10,
    "fin": 6.23, "texto": "…"}, ...]}, una entrada por línea del guion y en el mismo orden. «texto» es opcional: si
    está, se compara con el guion y un desajuste es bloqueante.
  · audio/voz.palabras.json: {"words": [{"word", "start", "end"}, ...]}, lo escribe
    `python produccion.py --transcribir audio/voz.wav`. Se alinean sus palabras con las del guion y cada línea va
    de la primera palabra reconocida a la última. Es una estimación del ASR: revísala (--guardar la deja escrita).
  voz.palabras.json da además las palabras de los primeros 3 s. Con tiempos_voz.json se lee en modo tolerante: si
  está vacío, roto o con otra forma (null, un número, segmentos sin palabras…), solo hay un aviso (no bloqueante) y
  se mide igual.
- motion.config.json: video.duracion y, opcional, los objetivos en «guion».

Mide: palabras por segundo (al hablar y global), duración del gancho (primera línea) y palabras en los primeros 3 s,
pausas y silencios, duración total y si el cierre retoma palabras del inicio (bucle). Los objetivos por defecto salen
de las investigaciones de retención del 16–17 nov 2026 (docs/analysis/2026-11-17-ricks-clips-canal.md y
INVESTIGACION-COMPETENCIA.md): ganadores a 2,9–3,8 palabras/s, gancho completo en ≤ 4,5 s, 40–65 s.
Se cambian en motion.config.json → guion: {"pps": [2.9, 3.8], "gancho_max": 4.5, "duracion": [40, 65], "silencio_min": 0.5}.
Un número dentro del rango no prueba que el guion funcione; uno fuera es una pregunta para el director.
Código 2 si falta un archivo o no tiene el formato de arriba.
"""
import argparse
import difflib
import json
import math
import re
import sys
import unicodedata
from pathlib import Path

AQUI = Path(__file__).resolve().parent
FORMATOS = """Formato (carpeta audio/ del proyecto):
  guion.json         lista de líneas de texto, en orden: ["Primera línea…", "Segunda línea…"]
  tiempos_voz.json   {"duracion": 66.05, "lineas": [{"id": "L01", "inicio": 0.10, "fin": 6.23}, ...]}, una por línea
  o bien, sin tiempos_voz.json:
  voz.palabras.json  {"words": [{"word", "start", "end"}, ...]} de `python produccion.py --transcribir audio/voz.wav`;
                     los tiempos de cada línea se derivan alineando sus palabras con las del guion."""


class Falta(Exception):
    pass


def norm(p):
    p = unicodedata.normalize("NFD", p.lower())
    return re.sub(r"[^a-z0-9ñ]", "", "".join(c for c in p if unicodedata.category(c) != "Mn"))


# normalizadas con norm(), igual que las palabras con las que se comparan («más» → «mas»)
VACIAS = {norm(w) for w in "el la los las un una unos unas de del a al y o que en por con para se su sus tu tus mi mis es no lo le les ya muy más pero".split()}


def hablar_numeros(texto):
    """Cuenta palabras HABLADAS: «1902» se dice en 3 palabras, «20.000» en 2."""
    n = 0
    for w in texto.split():
        d = re.sub(r"[^\d]", "", w)
        n += (3 if len(d) == 4 else 2 if len(d) > 4 else 1) if d and d == re.sub(r"[^\w]", "", w) else 1
    return n


def leer_json(nombre):
    ruta = AQUI / nombre
    if not ruta.exists():
        return None
    try:
        return json.loads(ruta.read_text(encoding="utf-8-sig"))
    except (OSError, ValueError) as e:
        raise Falta(f"{nombre} no se puede leer como JSON ({e})")


def leer_guion(datos):
    if not isinstance(datos, list) or not datos:
        raise Falta("audio/guion.json debe ser una lista no vacía con el texto de cada línea")
    salida = []
    for x in datos:
        t = x if isinstance(x, str) else x.get("texto", x.get("text")) if isinstance(x, dict) else None
        if not isinstance(t, str) or not t.strip():
            raise Falta(f"audio/guion.json: línea sin texto: {x!r}")
        salida.append(t.strip())
    return salida


def leer_palabras(d):
    """voz.palabras.json de produccion.py ({"words": [...]}), una lista de palabras o el formato con segmentos.
    Cualquier otra forma (null, un número, «words» o «segments» que no son listas, segmentos que no son objetos…)
    cuenta como «sin palabras»: Falta, nunca una traza."""
    def lista(x):
        return x if isinstance(x, list) else []

    def segundos(v):   # true/false o NaN no son tiempos
        return isinstance(v, (int, float)) and not isinstance(v, bool) and math.isfinite(v)
    forma = d
    if isinstance(d, dict):
        d = lista(d.get("words")) or [w for s in (lista(d.get("segments")) or lista(d.get("lines")))
                                       if isinstance(s, dict) for w in lista(s.get("words"))]
    pal = [w for w in lista(d) if isinstance(w, dict) and str(w.get("word", "")).strip()
           and segundos(w.get("start")) and segundos(w.get("end"))]
    if not pal:
        tipo = ("" if isinstance(forma, (dict, list)) else
                f" (trae {'null' if forma is None else type(forma).__name__}, no {{\"words\": [...]}})")
        raise Falta(f"audio/voz.palabras.json no trae palabras con start y end{tipo}")
    return pal


def derivar_tiempos(guion, pal):
    """Tiempos por línea desde el ASR: alinea las palabras normalizadas del guion con las de la voz (difflib); cada
    línea va del inicio de su primera palabra emparejada al fin de la última. Error si la voz no es este guion.
    El inicio se ancla en la primera palabra emparejada «equal» (exacta) de la línea; delante de ella solo cuentan las
    del reparto proporcional de un bloque «replace» que no caen en palabras de la voz ya usadas por la línea anterior
    («veinte mil» ↔ «20.000» al empezar la línea). Si un «replace» cruza la frontera entre líneas y la voz trae ahí más
    palabras que el guion, el reparto puede dar a esta línea alguna que era del final de la anterior y adelantar su
    inicio; nunca por debajo del fin de la línea anterior."""
    g = [(n, norm(w)) for n, l in enumerate(guion) for w in l.split()]
    g = [(n, w) for n, w in g if w]
    sm = difflib.SequenceMatcher(None, [w for _, w in g], [norm(str(w["word"])) for w in pal], autojunk=False)
    mapa, iguales, sobran = {}, set(), 0
    for op, i1, i2, j1, j2 in sm.get_opcodes():
        if op == "equal":
            mapa.update({i1 + k: j1 + k for k in range(i2 - i1)}); iguales.update(range(i1, i2))
        elif op == "replace":   # «veinte mil» ↔ «20.000»: reparto proporcional dentro del bloque
            mapa.update({i1 + k: j1 + min(j2 - j1 - 1, k * (j2 - j1) // (i2 - i1)) for k in range(i2 - i1)})
        elif op == "insert":
            sobran += j2 - j1
    if len(iguales) < 0.6 * len(g):
        raise Falta(f"la voz no parece este guion: solo {len(iguales)} de {len(g)} palabras coinciden con "
                    "audio/voz.palabras.json (¿otra toma o guion cambiado?). Vuelve a transcribir o escribe tiempos_voz.json")
    lineas, dudosas = [], []
    j_prev, fin_prev = -1, 0.0   # última palabra de la voz y fin de la línea anterior
    for n, txt in enumerate(guion):
        ks = [k for k, (m, _) in enumerate(g) if m == n]
        js = [mapa[k] for k in ks if k in mapa]
        if not js:
            raise Falta(f"la línea {n + 1} («{txt[:60]}») no aparece en audio/voz.palabras.json: ¿no se grabó o se cortó? "
                        "Revisa la toma o escribe audio/tiempos_voz.json a mano")
        reconocidas = sum(k in iguales for k in ks)
        if reconocidas < 0.5 * len(ks):
            dudosas.append(f"L{n + 1:02d} ({reconocidas}/{len(ks)} palabras reconocidas)")
        # palabras de la voz que no usó la línea anterior; el mapa es monótono, así que las «equal» siempre lo son
        propias = [j for j in js if j > j_prev]
        ancla = next((mapa[k] for k in ks if k in iguales), None)
        if ancla is None:   # línea sin ninguna palabra exacta: la primera propia del reparto, o la compartida
            j0 = min(propias) if propias else min(js)
        else:               # la primera «equal», o antes si un «replace» propio la precede («20.000 ratas…»)
            j0 = min([ancla, *(j for j in propias if j < ancla)])
        inicio = max(round(pal[j0]["start"], 2), fin_prev)
        fin = max(round(pal[max(js)]["end"], 2), inicio)
        lineas.append({"id": f"L{n + 1:02d}", "inicio": inicio, "fin": fin, "texto": txt})
        j_prev, fin_prev = max(js), fin
    avisos = ([f"tiempos poco fiables en {', '.join(dudosas)}: la voz no dice lo que pone el guion; "
               "¿línea sin grabar o reescrita?"] if dudosas else []) + \
             ([f"la voz tiene {sobran} palabras que no están en el guion: ¿línea añadida o improvisada?"] if sobran > 0.15 * len(pal) else [])
    return lineas, avisos


def main():
    if hasattr(sys.stdout, "reconfigure"):   # antes de argparse: --help con la salida redirigida no cabe en cp1252 («≤», «↔»)
        sys.stdout.reconfigure(encoding="utf-8")
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--estricto", action="store_true")
    ap.add_argument("--guardar", action="store_true", help="escribe en audio/tiempos_voz.json los tiempos derivados de la voz")
    a = ap.parse_args()
    try:
        return revisar(a)
    except Falta as e:
        print(f"ERROR: {e}\n\n{FORMATOS}")
        return 2


def revisar(a):
    cfg = leer_json("motion.config.json")
    if not isinstance(cfg, dict) or not isinstance(cfg.get("video", {}).get("duracion"), (int, float)):
        raise Falta("falta motion.config.json con video.duracion (ejecuta el script desde la carpeta del proyecto)")
    obj = {"pps": [2.9, 3.8], "gancho_max": 4.5, "duracion": [40, 65], "silencio_min": 0.5, **cfg.get("guion", {})}
    datos = leer_json("audio/guion.json")
    if datos is None:
        raise Falta("falta audio/guion.json: escríbelo con el texto de cada línea de la voz (ninguna herramienta lo genera)")
    guion = leer_guion(datos)
    tv = leer_json("audio/tiempos_voz.json")
    avisos, bloqueantes = [], []
    try:
        pj = leer_json("audio/voz.palabras.json")
        # un archivo con `null` existe: no es «no hay archivo», pasa por leer_palabras y avisa como uno sin palabras
        pal = leer_palabras(pj) if (AQUI / "audio" / "voz.palabras.json").exists() else []
    except Falta as e:
        if tv is None:   # sin tiempos_voz.json las palabras son la única fuente de tiempos: es un error
            raise
        # con tiempos_voz.json las palabras solo dan los primeros 3 s: modo tolerante, aviso que no bloquea
        pal = []
        avisos.append(f"{e}: se mide con audio/tiempos_voz.json, sin las palabras de los primeros 3 s "
                      "(vuelve a transcribir: python produccion.py --transcribir audio/voz.wav)")
    if tv is not None:
        lineas = tv.get("lineas") if isinstance(tv, dict) else None
        if not isinstance(lineas, list) or not all(isinstance(l, dict) and isinstance(l.get("inicio"), (int, float))
                                                   and isinstance(l.get("fin"), (int, float)) for l in lineas):
            raise Falta("audio/tiempos_voz.json debe ser {\"lineas\": [{\"id\", \"inicio\", \"fin\"}, ...]} con números en segundos")
        print("Tiempos: audio/tiempos_voz.json")
    elif pal:
        lineas, dudas = derivar_tiempos(guion, pal)
        print("Tiempos: derivados de audio/voz.palabras.json (estimación del ASR: revísalos)")
        avisos += dudas; bloqueantes += ["tiempos"] * bool(dudas)
        if a.guardar:
            (AQUI / "audio" / "tiempos_voz.json").write_text(json.dumps(
                {"duracion": round(pal[-1]["end"], 2), "origen": "voz.palabras.json (ASR, revisar)", "lineas": lineas},
                ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
            print("Escrito audio/tiempos_voz.json")
    else:
        raise Falta("faltan los tiempos de la voz: ni audio/tiempos_voz.json ni audio/voz.palabras.json "
                    "(python produccion.py --transcribir audio/voz.wav)")
    # emparejado por posición: el número de líneas y, si tiempos_voz trae «texto», el texto deben coincidir
    if len(lineas) != len(guion):
        avisos.append(f"{len(guion)} líneas en el guion y {len(lineas)} en los tiempos de voz: solo se miden las "
                      f"{min(len(lineas), len(guion))} primeras y pueden ir desplazadas. Vuelve a sacar los tiempos de esta voz")
        bloqueantes.append("lineas")
    distintas = [str(l.get("id", i + 1)) for i, (l, txt) in enumerate(zip(lineas, guion))
                 if isinstance(l.get("texto"), str) and norm(l["texto"]) != norm(txt)]
    if distintas:
        avisos.append(f"el texto de los tiempos de voz no coincide con el guion en {', '.join(distintas)}: "
                      "cada línea se mediría con los tiempos de otra"); bloqueantes.append("lineas")
    print(f"{'línea':6} {'inicio':>7} {'dura':>5} {'pal':>4} {'pal/s':>6}  texto")
    total_p = total_s = 0
    con_voz, nulas = [], []
    for i, (l, txt) in enumerate(zip(lineas, guion)):
        d = l["fin"] - l["inicio"]; p = hablar_numeros(txt)
        if d > 0:
            total_p += p; total_s += d; con_voz.append(txt)
        else:
            nulas.append(str(l.get("id", i + 1)))
        print(f"{l.get('id', i + 1)!s:6} {l['inicio']:7.2f} {d:5.2f} {p:4d} {(f'{p / d:6.2f}' if d > 0 else '     —')}  {txt[:70]}")
    if nulas:
        avisos.append(f"líneas sin duración (fin ≤ inicio): {', '.join(nulas)}; no cuentan en la velocidad"); bloqueantes.append("tiempos")
    pps = total_p / total_s if total_s else 0
    dur = cfg["video"]["duracion"]
    gancho = lineas[0]["fin"] - lineas[0]["inicio"] if lineas else 0
    print(f"\nPalabras habladas {total_p} · {pps:.2f} palabras/s al hablar · {total_p / dur if dur else 0:.2f} global · duración {dur:.1f} s")
    if not obj["pps"][0] <= pps <= obj["pps"][1]:
        avisos.append(f"velocidad {pps:.2f} palabras/s fuera de {obj['pps']} (referencias ganadoras: 2,9–3,8)"); bloqueantes.append("pps")
    if gancho > obj["gancho_max"]:
        avisos.append(f"el gancho (primera línea) dura {gancho:.2f} s > {obj['gancho_max']} s: la promesa o paradoja llega tarde"); bloqueantes.append("gancho")
    if pal:
        en3 = [w for w in pal if w["start"] < 3.0]
        print(f"Primeros 3 s: {len(en3)} palabras · «{' '.join(str(w['word']).strip() for w in en3)}»")
    huecos = [(lineas[i]["fin"], lineas[i + 1]["inicio"]) for i in range(len(lineas) - 1)
              if lineas[i + 1]["inicio"] - lineas[i]["fin"] >= obj["silencio_min"]]
    print(f"Pausas ≥ {obj['silencio_min']} s entre líneas: " + (", ".join(f"{x:.1f}–{y:.1f}" for x, y in huecos) or "ninguna"))
    if not obj["duracion"][0] <= dur <= obj["duracion"][1]:
        avisos.append(f"duración {dur:.1f} s fuera de {obj['duracion']}")
    if con_voz:   # el cierre es la última línea que tiene voz, no una línea del guion sin grabar
        ini = {norm(w) for w in guion[0].split()} - VACIAS - {""}
        fin = {norm(w) for w in con_voz[-1].split()} - VACIAS - {""}
        comunes = sorted(ini & fin)
        print("Bucle cierre↔inicio (palabras compartidas): " + (", ".join(comunes) or "ninguna"))
        if not comunes:
            avisos.append("el cierre no retoma ninguna palabra del gancho: revisar si hay bucle visual o verbal")
    print()
    for x in avisos:
        print("AVISO", x)
    if not avisos:
        print("OK: dentro de los objetivos")
    return 1 if a.estricto and bloqueantes else 0


if __name__ == "__main__":
    sys.exit(main())
