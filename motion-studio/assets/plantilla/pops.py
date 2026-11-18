#!/usr/bin/env python3
"""Detector de saltos ("pops"): un cambio fuerte que nadie planificó y que dura 1–3 fotogramas o es mucho mayor que los
de su alrededor. Ve lo que las hojas de contacto y `ritmo.py` no ven a 1 fps: un ojo que salta, una moneda que aparece
un fotograma, un dibujo equivocado durante 2–3 fotogramas, un objeto que se teletransporta en una costura de segmentos.

    python pops.py exportaciones/video.mp4                    (lee solos los cortes e impactos planificados)
    python pops.py review/pruebas/movimiento-600-780.mp4      (deduce --desde del nombre: f600 del máster = 20 s a 30 fps)
    python pops.py otro-clip.mp4 --desde 20                   (--desde va en SEGUNDOS del máster, no en fotogramas)
    python pops.py video.mp4 --permitir 35,95,150-158 --k 3
    python pops.py video.mp4 --zona-ignorada 0,0.72,1,0.16    (saca la banda de subtítulos: x,y,ancho,alto en fracciones)

Se permiten (con ±tol fotogramas, 3 por defecto):
  · los cortes de plano: review/planos.json (lo escribe render.mjs desde window.__info.planos) o --planos;
  · los impactos: de sincro.json (produccion.py ya los resuelve, también los anclados a «palabra»); si no existe, los de
    produccion.json (los de «palabra» con audio/voz.palabras.json o --voz); y los re-ganchos de motion.config.json →
    curva.reganches. Todo se pasa a segundos y luego a los fps de ESTE video (vale para la --vista a 15 fps);
  · lo que pases con --permitir (fotogramas sueltos o rangos del video).
Un pico cuenta si es único: ≥ --unico × cualquier otro pico a ±12 fotogramas, sin contar sus vecinos a ±3 ni las
ventanas permitidas. Si es transitorio (el peor bloque vuelve a su estado previo en ≤ 3 fotogramas, o ≤ 0,1 s a más
fps) y aislado, su vuelta y la de otro salto cercano tampoco cuentan; si se repite más (un parpadeo rítmico), no.
Cada transitorio inesperado se clasifica:
  · recurrente: dura 2 fotogramas o más (NUNCA 1) y hay al menos otros 2 transitorios de 2 fotogramas o más con su
    firma (mismo peor bloque ±1, duración ±1 e intensidad ×0,5–2) a ±5 s (--ventana-recurrencia), a más de 12 fotogramas
    y en su MISMO plano (review/planos.json o --planos; sin planos, en todo el clip). Es un efecto que se repite dentro
    de su toma (un parpadeo cada 2–5 s, una boca): se informa y no falla;
  · si no, es un SALTO: un transitorio de 1 fotograma (un fallo de costura de segmentos, aunque se repita cada pocos
    segundos) o uno de 2–3 que no se repite 2 veces en su ventana, por corto que sea su plano: un parpadeo único no se
    distingue de un dibujo equivocado, así que falla hasta que lo mires y lo pases con --permitir.
Un salto permitido que cambia todo el cuadro de golpe se avisa como corte duro, sin fallar.
Limitaciones conocidas:
  · un parpadeo que no reúne 2 repeticiones en ±5 s de su plano sale como SALTO: el único, los de un plano de menos de
    ~4 s, el primero y el último de una serie más espaciada que 2,5 s y los de una cara que la cámara desplaza más de un
    bloque (≈ 6 % del ancho) entre uno y otro. Míralos y pásalos con la línea --permitir que se imprime (o amplía
    --ventana-recurrencia si la serie es regular);
  · en la --vista a 15 fps un parpadeo de 2 fotogramas del máster dura 1 y sale como SALTO («1 fotograma que se repite
    en …»): compruébalo en una prueba a los fps del máster (render.mjs --prueba);
  · al revés, un dibujo equivocado de 2–3 fotogramas que coincide con la firma de un parpadeo o una boca de su plano (en
    el mismo bloque, con duración e intensidad parecidas y a ±5 s de otras 2) sale como recurrente y no falla. Sin
    review/planos.json ni --planos todo el clip cuenta como un plano, así que eso vale también entre escenas distintas:
    mira la hoja, que incluye los 2 primeros recurrentes;
  · los subtítulos palabra a palabra cambian la misma franja con cada palabra o frase y casi nunca vuelven atrás, así
    que no son transitorios: cada cambio único en su ventana sale como SALTO. --zona-ignorada x,y,w,h (fracciones del
    cuadro, se puede repetir) saca esa franja del cambio medio y del peor bloque; lo que pase dentro deja de vigilarse.
    Mide la franja en la hoja antes|después (y = borde superior del texto / alto del cuadro).
Salida: lista, hoja antes|después de los saltos y de 2 recurrentes (<video>-pops.jpg) y review/pops.json («avisos» son
los cortes duros permitidos). Código 0 si no hay saltos inesperados (los recurrentes y los cortes duros no fallan), 1 si
los hay, 2 si hay un error. Un salto es un CANDIDATO: míralo a velocidad normal antes de corregirlo (un parpadeo o un
golpe pueden ser correctos).

Idea adaptada de qa-pops.mjs de make-short (MIT, github.com/nocodehack/make-short); implementación propia.
"""
import argparse
import json
import math
import re
import subprocess
import sys
import tempfile
from collections import deque
from pathlib import Path

import numpy as np

AQUI = Path(__file__).resolve().parent
VUELTA = 0.4  # transitorio: el peor bloque queda a ≤ 40 % de su salto respecto al cuadro previo
LOCAL = 12  # ventana local (fotogramas) de la regla de «único»; más allá, otro momento del video
VENTANA = 5.0  # s (±): un parpadeo natural se repite cada 2–5 s (references/kit.md, «Vida en reposo»)
REPETICIONES = 2  # otros transitorios con la misma firma, en la ventana y el plano, para ser «recurrente»
MIN_RECURRENTE = 2  # fotogramas: uno de 1 (un fallo de costura) nunca es recurrente


def leer(ruta):
    try:
        return json.loads(Path(ruta).read_text(encoding="utf-8-sig"))
    except ValueError as e:
        raise ValueError(f"{ruta}: JSON mal formado ({e})") from None


def sonda(video):
    r = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height,r_frame_rate",
                        "-of", "json", str(video)], capture_output=True, text=True)
    if r.returncode or not json.loads(r.stdout or "{}").get("streams"):
        raise RuntimeError(f"ffprobe no lee un video en {video}: {r.stderr.strip()[-300:] or 'sin pista de video'}")
    s = json.loads(r.stdout)["streams"][0]
    num, den = map(int, s["r_frame_rate"].split("/"))
    return num / den, s["width"], s["height"]


def cuadros(video, ancho, alto, fmt="gray", solo=None):
    """Fotograma a fotograma desde el pipe de FFmpeg (nunca el video entero en memoria). `solo`: índices a extraer."""
    vf = f"scale={ancho}:{alto}:flags=area,format={fmt}"
    if solo:
        vf = "select='" + "+".join(f"eq(n,{i})" for i in solo) + "'," + vf
    forma = (alto, ancho, 3) if fmt == "rgb24" else (alto, ancho)
    tam = int(np.prod(forma))
    with tempfile.TemporaryFile() as err:
        p = subprocess.Popen(["ffmpeg", "-v", "error", "-i", str(video), "-an", "-vf", vf, "-fps_mode", "passthrough",
                              "-f", "rawvideo", "-"], stdout=subprocess.PIPE, stderr=err)
        try:
            while len(buf := p.stdout.read(tam)) == tam:
                yield np.frombuffer(buf, np.uint8).reshape(forma)
        finally:
            p.stdout.close(); p.wait()
        if p.returncode:
            err.seek(0); raise RuntimeError("FFmpeg: " + err.read().decode(errors="replace").strip()[-400:])


def medir(video, zonas=(), ancho=270):
    """g = cambio medio del cuadro; blk = peor bloque de 16×16 (un cambio local fuerte); donde = (fila, columna) de ese
    bloque; dura[i] = fotogramas hasta que el peor bloque de i vuelve al cuadro i−1 (0 = no vuelve). `zonas`: rectángulos
    (x, y, w, h) en fracciones que no cuentan ni en g ni en el peor bloque. En flujo: solo guarda los últimos cuadros."""
    fps, w, h = sonda(video)
    alto = int(round(h * ancho / w / 2) * 2)
    hb, wb = alto // 16 * 16, ancho // 16 * 16
    nby, nbx = hb // 16, wb // 16
    pix = np.ones((alto, ancho), bool)  # píxeles que cuentan
    for x, y, zw, zh in zonas:
        pix[int(y * alto):math.ceil((y + zh) * alto), int(x * ancho):math.ceil((x + zw) * ancho)] = False
    usar = pix[:hb, :wb].reshape(nby, 16, nbx, 16).all(axis=(1, 3))  # un bloque que toca una zona no cuenta
    if not usar.any():
        raise ValueError("--zona-ignorada cubre todo el cuadro: no queda ningún bloque que vigilar")
    todo = bool(pix.all())
    maxL = max(3, round(0.1 * fps))
    g, blk, donde, vuelta = [0.0], [0.0], [None], [[]]
    previos = deque(maxlen=maxL + 1)
    for m, c in enumerate(cuadros(video, ancho, alto)):
        a = c.astype(np.int16)
        if previos:
            d = np.abs(a - previos[-1])
            mapa = d[:hb, :wb].reshape(nby, 16, nbx, 16).mean(axis=(1, 3))
            mapa[~usar] = -1
            k = int(mapa.argmax())
            g.append(float(d.mean() if todo else d[pix].mean())); blk.append(float(mapa.flat[k]))
            donde.append(divmod(k, nbx)); vuelta.append([])
            # el cuadro m frente al previo a cada inicio i = m − L, en el peor bloque de i
            for L in range(1, min(maxL, len(previos) - 1) + 1):
                y, x = donde[m - L]
                zona = np.s_[y * 16:(y + 1) * 16, x * 16:(x + 1) * 16]
                vuelta[m - L].append(float(np.abs(a[zona] - previos[-1 - L][zona]).mean()))
        previos.append(a)
    if len(g) < 2:
        raise RuntimeError(f"{video}: el video no tiene fotogramas legibles")
    dura = [next((L for L, r in enumerate(v, 1) if r <= VUELTA * b), 0) if b > 0 else 0 for v, b in zip(vuelta, blk)]
    return np.array(g), np.array(blk), dura, donde, fps, (ancho, alto)


def zona(texto):
    """--zona-ignorada x,y,w,h en fracciones del cuadro (0–1)."""
    try:
        x, y, w, h = (float(v) for v in texto.split(","))
    except ValueError:
        raise argparse.ArgumentTypeError(f"«{texto}»: se esperan 4 fracciones x,y,w,h (p. ej. 0,0.72,1,0.16)") from None
    if not (0 <= x < 1 and 0 <= y < 1 and w > 0 and h > 0 and x + w <= 1.001 and y + h <= 1.001):
        raise argparse.ArgumentTypeError(f"«{texto}»: x,y,w,h van en fracciones del cuadro (0–1) y la zona debe caber en él")
    return x, y, w, h


def segundos(texto):
    """--ventana-recurrencia: segundos ≥ 0."""
    try:
        s = float(texto)
    except ValueError:
        s = -1
    if not s >= 0 or math.isinf(s):
        raise argparse.ArgumentTypeError(f"«{texto}»: se esperan segundos ≥ 0 (p. ej. 5)")
    return s


def rangos(texto):
    out = []
    for tok in [t.strip() for t in str(texto or "").split(",") if t.strip()]:
        a, _, b = tok.partition("-")
        out.append((int(a), int(b or a)))
    return out


def inicios_voz(ruta):
    """Inicio de cada palabra, con la misma lectura que produccion.py (Whisper, make-short o words)."""
    datos = leer(ruta)
    clave = "segments" if "segments" in datos else "lines" if "lines" in datos else None
    return [w["start"] for w in ([w for s in datos[clave] for w in s.get("words", [])] if clave else datos.get("words", []))]


def impactos(args, fpsm):
    """Impactos planificados en SEGUNDOS: de sincro.json (ya resueltos) o, si no existe, de produccion.json."""
    sincro, prod = AQUI / "sincro.json", AQUI / "produccion.json"
    voz = Path(args.voz) if args.voz else AQUI / "audio" / "voz.palabras.json"
    if sincro.exists():
        nuevos = [x.name for x in (prod, voz) if x.exists() and x.stat().st_mtime > sincro.stat().st_mtime]
        if nuevos:
            print(f"AVISO: sincro.json es más antiguo que {' y '.join(nuevos)}; vuelve a correr produccion.py")
        return [(im["t"], im.get("id", "")) for im in leer(sincro).get("impactos", [])]
    if not prod.exists():
        return []
    out, palabras = [], None
    ruta = voz.relative_to(AQUI) if voz.is_absolute() and voz.is_relative_to(AQUI) else voz
    for p in leer(prod).get("planos", []):
        for im in p.get("impactos", []):
            if "fotograma" in im:  # fotogramas del máster
                out.append((im["fotograma"] / fpsm, im.get("id", "")))
            elif "palabra" in im:
                if palabras is None:
                    palabras = inicios_voz(voz) if voz.exists() else False
                i, nombre = im["palabra"], im.get("id", "")
                if palabras is False:
                    print(f"AVISO: el impacto {nombre} va anclado a la palabra {i}, no hay sincro.json y faltan las marcas de voz "
                          f"{ruta}; no se permite. Corre: python produccion.py --voz <marcas>, o pasa --voz <marcas>")
                elif isinstance(i, bool) or not isinstance(i, int):
                    print(f"AVISO: el impacto {nombre}: «palabra» debe ser un índice entero de {ruta} y vale {i!r}; "
                          "no se permite. Revisa produccion.json")
                elif not 0 <= i < len(palabras):
                    print(f"AVISO: el impacto {nombre}: la palabra {i} no existe en {ruta} ({len(palabras)} palabras"
                          + (f", de 0 a {len(palabras) - 1}" if palabras else "") + "); no se permite. Revisa produccion.json")
                else:  # mismo redondeo que produccion.py
                    out.append((math.floor((palabras[i] + im.get("desfase", 0)) * fpsm + 0.5) / fpsm, nombre))
    return out


def leer_planos(args):
    """[[id, inicio, fin, salidaDur?], ...] en segundos del máster (contrato de window.__info.planos), o []."""
    planos = Path(args.planos) if args.planos else AQUI / "review" / "planos.json"
    return leer(planos) if planos.exists() else []


def permitidos(args, fps, desde, cfg, planos):
    """Ventanas permitidas en fotogramas del VIDEO (no del máster): cortes, impactos y re-ganchos."""
    ventanas = [(a, b, "permitido") for a, b in rangos(args.permitir)]
    for p in planos:
        f = round(p[1] * fps) - desde
        ventanas.append((f, f, f"corte {p[0]}"))
    for t, nombre in impactos(args, cfg.get("video", {}).get("fps") or fps):
        f = round(t * fps) - desde
        ventanas.append((f, f, f"impacto {nombre}"))
    for t in cfg.get("curva", {}).get("reganches", []):
        f = round(t * fps) - desde
        ventanas.append((f, f, f"re-gancho {t}"))
    return [(a - args.tol, b + args.tol, por) for a, b, por in ventanas]


def hoja(video, lista, tam, rep):
    """Antes|después de cada (etiqueta, pico): vuelve a extraer solo esos fotogramas con FFmpeg."""
    from PIL import Image, ImageDraw
    idx = sorted({j for _, p in lista for j in (max(0, p["f"] - 1), p["f"])})
    img = dict(zip(idx, cuadros(video, *tam, fmt="rgb24", solo=idx)))
    filas = []
    for etiqueta, p in lista:
        i = p["f"]
        par = [Image.fromarray(img[j]) for j in (max(0, i - 1), i) if j in img]
        if len(par) < 2:
            continue
        w, h = par[0].size
        fila = Image.new("RGB", (w * 2 + 6, h + 26), "white")
        for k, im in enumerate(par):
            fila.paste(im, (k * (w + 6), 26))
        ImageDraw.Draw(fila).text((6, 6), f"{etiqueta} f{i - 1} | f{i}  (t={p['t']} s)", fill="black")
        filas.append(fila)
    if not filas:
        return None
    out = Image.new("RGB", (sum(x.width for x in filas) + 8 * (len(filas) - 1), max(x.height for x in filas)), "white")
    x = 0
    for fila in filas:
        out.paste(fila, (x, 0)); x += fila.width + 8
    out.save(rep, quality=90)
    return rep


def revisar(a):
    zonas = a.zona_ignorada or []
    g, blk, dura, donde, fps, tam = medir(a.video, zonas)
    n = len(g)
    cfg = leer(AQUI / "motion.config.json") if (AQUI / "motion.config.json").exists() else {}
    fpsm, durm = cfg.get("video", {}).get("fps") or fps, cfg.get("video", {}).get("duracion")
    # Las pruebas de render.mjs se llaman movimiento-<f0>-<f1>.mp4, en FOTOGRAMAS del máster.
    nom = re.fullmatch(r"movimiento-(\d+)-(\d+)", Path(a.video).stem)
    if a.desde is None:
        desde_s = int(nom[1]) / fpsm if nom else 0.0
        if nom:
            print(f"--desde deducido del nombre: f{nom[1]} del máster = {desde_s:g} s")
    else:
        desde_s = a.desde
        if nom and abs(desde_s * fpsm - int(nom[1])) > 1:
            print(f"AVISO: --desde {a.desde:g} s no coincide con el nombre (f{nom[1]} del máster = {int(nom[1]) / fpsm:g} s); "
                  "--desde va en SEGUNDOS")
    if durm and desde_s >= durm:
        print(f"AVISO: --desde {desde_s:g} s cae fuera del máster ({durm} s); ¿pasaste fotogramas en vez de segundos?")
    if nom and abs(n - (int(nom[2]) - int(nom[1])) * fps / fpsm) > 1:
        print(f"AVISO: el clip tiene {n} fotogramas y su nombre indica {int(nom[2]) - int(nom[1])}; ¿cambió motion.config.json?")
    desde = round(desde_s * fps)
    planos = leer_planos(a)
    ventanas = permitidos(a, fps, desde, cfg, planos)
    por = lambda i: next((w for x, y, w in ventanas if x <= i <= y), None)
    libre = [por(j) is None for j in range(n)]
    MIN, SUELO = {"g": 2.5, "blk": a.min_bloque}, {"g": 0.5, "blk": 3.0}
    # Transitorios: el peor bloque vuelve a su estado previo. Su pico de vuelta (a 1–3 fotogramas) no le quita lo único.
    trans = np.array([bool(dura[i]) and blk[i] >= MIN["blk"] for i in range(n)])
    marcados = {j for i in np.flatnonzero(trans) for j in range(i, i + dura[i] + 1)}
    acum = np.concatenate([[0], np.cumsum(trans)])
    picos = []
    for i in range(1, n):
        # aislado = como mucho otro transitorio a ±12 (dos saltos seguidos); si hay más, es un efecto que se repite
        aislado = trans[i] and acum[min(n, i + LOCAL + 1)] - acum[max(0, i - LOCAL)] <= 2
        # el salto, su vuelta (y los del otro salto si van en pareja) no suben la media local
        fuera = marcados if aislado else range(i, i + (dura[i] if trans[i] else 0) + 1)
        mejor = None
        for nombre, d in (("g", g), ("blk", blk)):
            vecinos = [d[j] for j in range(max(1, i - 6), min(n, i + 7)) if j != i and j not in fuera]
            otros = [d[j] for j in range(max(1, i - LOCAL), min(n, i + LOCAL + 1))
                     if abs(j - i) > 3 and libre[j] and not (aislado and j in marcados)]
            ratio = d[i] / max(np.mean(vecinos) if vecinos else 0, SUELO[nombre])
            if blk[i] >= MIN["blk"] and d[i] >= MIN[nombre] and ratio >= a.k and d[i] >= a.unico * (max(otros) if otros else 0):
                if not mejor or ratio > mejor[1]:
                    mejor = (nombre, ratio)
        if mejor:
            picos.append({"f": i, "t": round((i + desde) / fps, 3), "g": round(float(g[i]), 2), "bloque": round(float(blk[i]), 1),
                          "ratio": round(float(mejor[1]), 1), "dura": dura[i] if trans[i] else 0, "permitido": por(i)})
    # un evento = picos seguidos o a ≤ 3 fotogramas con la misma condición (la ida y la vuelta de un transitorio)
    eventos = []
    for p in picos:
        e = eventos[-1] if eventos else None
        hueco = p["f"] - max(q["f"] + q["dura"] for q in e) if e else 99
        if e and (hueco <= 1 or (hueco <= 3 and bool(p["permitido"]) == any(q["permitido"] for q in e))):
            e.append(p)
        else:
            eventos.append([p])
    # Firma de cada transitorio del video (no solo de los picos): un parpadeo deja la misma en cada repetición.
    tidx = np.flatnonzero(trans)
    dur = np.array(dura)
    by = np.array([p[0] if p else -9 for p in donde]); bx = np.array([p[1] if p else -9 for p in donde])
    # Plano de cada fotograma de este video (sin planos.json, el clip entero es un plano): un parpadeo se repite dentro
    # de su toma; una coincidencia con otra escena no prueba nada.
    limites = sorted({0, n} | {f for p in planos for t in p[1:3] for f in [round(t * fps) - desde] if 0 < f < n})
    plano = np.searchsorted(limites, np.arange(n), side="right") - 1
    ven = round(a.ventana_recurrencia * fps)

    def parecidos(i):
        """Otros transitorios con la firma de i (peor bloque ±1, duración ±1, intensidad ×0,5–2), a más de LOCAL
        fotogramas, a ±--ventana-recurrencia y en el mismo plano."""
        j = tidx[(np.abs(tidx - i) > LOCAL) & (np.abs(tidx - i) <= ven) & (plano[tidx] == plano[i])]
        return j[(np.abs(by[j] - by[i]) <= 1) & (np.abs(bx[j] - bx[i]) <= 1) & (np.abs(dur[j] - dur[i]) <= 1)
                 & (blk[j] >= 0.5 * blk[i]) & (blk[j] <= 2 * blk[i])].tolist()

    def repite(i):
        """Las repeticiones que cuentan para «recurrente»: i y cada una duran MIN_RECURRENTE fotogramas o más."""
        return [j for j in parecidos(i) if dur[j] >= MIN_RECURRENTE] if dur[i] >= MIN_RECURRENTE else []

    def lista_f(js):
        return ", ".join(f"f{j}" for j in js[:4]) + (" …" if len(js) > 4 else "")

    def motivo(tr):
        """Por qué un evento con transitorios no es recurrente (se imprime y va en pops.json)."""
        if max(q["dura"] for q in tr) < MIN_RECURRENTE:
            pares = sorted({j for q in tr for j in parecidos(q["f"])})
            return ("1 fotograma: nunca es recurrente" + (f"; se repite en {lista_f(pares)}: ¿fallo de costura repetido?"
                    + (" A estos fps también puede ser un parpadeo: míralo en una prueba a los fps del máster" if fps < 24
                       else "") if pares else ""))
        reps = [repite(q["f"]) for q in tr]
        if any(len(r) >= REPETICIONES for r in reps):
            return "se repite, pero el evento incluye un cambio que no vuelve a su estado: míralo"
        pares, sitio = sorted({j for r in reps for j in r}), f"a ±{a.ventana_recurrencia:g} s en su plano"
        if pares:
            return f"solo se repite en {lista_f(pares)} {sitio} y hacen falta {REPETICIONES}: ¿parpadeo o dibujo equivocado? míralo"
        return f"no se repite {sitio}: ¿parpadeo único o dibujo equivocado? míralo"

    clases = []  # (estado, pico principal, detalle) por evento
    for e in eventos:
        top = max(e, key=lambda p: p["ratio"]); ok = next((p["permitido"] for p in e if p["permitido"]), None)
        tr = [p for p in e if p["dura"]]
        rep = {q["f"]: repite(q["f"]) for q in tr}
        # recurrente: cada pico del evento es un transitorio con REPETICIONES repeticiones o la vuelta de uno de ellos
        cubre = lambda p: any(q["f"] <= p["f"] <= q["f"] + q["dura"] and len(rep[q["f"]]) >= REPETICIONES for q in tr)
        if ok:
            clases.append(("ok", top, ok))
        elif tr and all(cubre(p) for p in e):
            clases.append(("recurrente", top, sorted({j for js in rep.values() for j in js})))
        else:
            clases.append(("SALTO", top, motivo(tr) if tr else None))
    malos = [dict(top, motivo=x) if x else top for est, top, x in clases if est == "SALTO"]
    recurrentes = [dict(top, repite_en=x) for est, top, x in clases if est == "recurrente"]
    avisos = [dict(top, aviso="corte duro") for est, top, _ in clases if est == "ok" and top["g"] >= a.corte]

    print(f"POPS {a.video}: {n} fotogramas a {fps:g} fps · desde f{desde} · {len(ventanas)} ventanas permitidas · k={a.k}"
          + f" · recurrencia ±{a.ventana_recurrencia:g} s en {len(limites) - 1} plano(s)"
          + "".join(f" · zona ignorada {','.join(f'{v:g}' for v in z)}" for z in zonas))
    for e, (est, top, x) in zip(eventos, clases):
        vuelve = max(p["dura"] for p in e)
        nota = ""
        if est == "ok":
            nota = f"  [{x}]" + ("  (corte duro: cambia todo el cuadro)" if top["g"] >= a.corte else "")
        elif est == "recurrente":
            nota = f"  (se repite en {lista_f(x)}: parpadeo o boca)"
        elif x:
            nota = f"  ({x})"
        print(f"  {est:<10} f{top['f']:<5} t={top['t']:7.3f}s  cambio {top['g']:5.1f} · bloque {top['bloque']:5.1f} · x{top['ratio']:.1f}"
              + (f" · vuelve en {vuelve} f" if vuelve else "") + nota)
    revisar_ojo = [(est, top) for est, top, _ in clases if est == "SALTO"]
    if revisar_ojo or recurrentes:
        lista = (revisar_ojo + [("recurrente", p) for p in recurrentes[:2]])[:8]
        rep = hoja(a.video, lista, tam, Path(a.video).with_name(Path(a.video).stem + "-pops.jpg"))
        if rep:
            print(f"  hoja antes|después: {rep}")
    if revisar_ojo:  # línea lista para copiar si, al verlos, son correctos
        tramos = []
        for e, (est, top, _) in zip(eventos, clases):
            if est == "SALTO":
                f0, f1 = min(p["f"] for p in e), max(p["f"] + p["dura"] for p in e)
                tramos.append(f"{f0}-{f1}" if f1 > f0 else f"{f0}")
        print(f"  si al verlos son correctos (un parpadeo, una boca, un golpe): --permitir {','.join(tramos)}"
              + (f",{a.permitir}" if a.permitir else ""))
    (AQUI / "review").mkdir(exist_ok=True)
    (AQUI / "review" / "pops.json").write_text(json.dumps({"video": str(a.video), "desde": desde, "zonas_ignoradas": zonas,
                                                           "ventana_recurrencia": a.ventana_recurrencia,
                                                           "eventos": eventos, "inesperados": malos, "avisos": avisos,
                                                           "recurrentes": recurrentes}, indent=1, ensure_ascii=False), encoding="utf-8")
    resto = (f"{sum(est == 'ok' for est, _, _ in clases)} en ventanas permitidas, {len(recurrentes)} recurrente(s)"
             + (f", {len(avisos)} corte(s) duro(s)" if avisos else ""))
    if malos:
        print(f"FALLA: {len(malos)} salto(s) inesperado(s) ({resto}). Míralos a velocidad normal; "
              "si son planificados o correctos, añádelos con --permitir.")
        return 1
    print(f"OK: sin saltos inesperados ({resto})")
    return 0


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("video")
    ap.add_argument("--permitir", default="", help="fotogramas o rangos permitidos del video: 35,95,150-158")
    ap.add_argument("--planos", help="JSON [[id, inicio, fin, salidaDur?], ...] en segundos (por defecto review/planos.json)")
    ap.add_argument("--desde", type=float, default=None,
                    help="SEGUNDO del máster en que empieza este video; si falta, se deduce de movimiento-<f0>-<f1>.mp4 o es 0")
    ap.add_argument("--voz", help="marcas por palabra para los impactos con «palabra» si no hay sincro.json (audio/voz.palabras.json)")
    ap.add_argument("--tol", type=int, default=3)
    ap.add_argument("--k", type=float, default=3.0, help="veces sobre la media local que cuenta como salto")
    ap.add_argument("--unico", type=float, default=1.5, help="veces sobre cualquier otro pico a ±12 fotogramas")
    ap.add_argument("--min-bloque", type=float, default=30.0, help="cambio mínimo del peor bloque (0–255)")
    ap.add_argument("--corte", type=float, default=40.0, help="cambio medio que se considera corte duro")
    ap.add_argument("--ventana-recurrencia", type=segundos, default=VENTANA, metavar="S",
                    help=f"± segundos (dentro del mismo plano) en que un transitorio debe repetirse {REPETICIONES} veces para "
                         f"ser recurrente (por defecto {VENTANA:g}; 0 = ninguno es recurrente)")
    ap.add_argument("--zona-ignorada", type=zona, action="append", metavar="X,Y,W,H",
                    help="rectángulo en fracciones del cuadro (0–1) que no cuenta, p. ej. la banda de subtítulos "
                         "0,0.72,1,0.16; se puede repetir")
    for s in (sys.stdout, sys.stderr):
        getattr(s, "reconfigure", lambda **k: None)(errors="replace")  # consola cp1252: «≤» o «→» no rompen la salida
    a = ap.parse_args()
    try:
        return revisar(a)
    except Exception as e:  # el código 1 queda solo para «hay saltos»
        print(f"ERROR: {type(e).__name__}: {e}")
        return 2


if __name__ == "__main__":
    sys.exit(main())
