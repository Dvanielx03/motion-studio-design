"""Compara un video con su referencia de nicho con las mismas medidas, para demostrar una mejora con números.

    python comparar.py referencia.mp4 nuestro.mp4 [--palabras-ref ref.json] [--palabras nuestro.json] [--json salida.json]

Mide en los dos (18 nov 2026, piloto de la Torre Eiffel frente a «The Ancient Jar That Warned an Empire»):
  · movimiento: diferencia media entre cuadros a 10 fps y 90×160 en gris (mediana y p25 por segundo);
  · cortes duros: saltos de cuadro muy por encima del movimiento local (no ve fundidos ni barridos: cuéntalos en la hoja);
  · fluidez (18 nov, demostración del gancho del piloto US), a 30 fps y 180×320: fotogramas congelados (nada se mueve),
    tirones por minuto (saltos de 2,5× el movimiento de su segundo que no son cortes: dibujos que saltan, cámara que
    arranca o frena de golpe) y aspereza (variación mediana del movimiento entre fotogramas / su mediana: baja = el
    movimiento fluye; alta = a golpes). Medido: referencia 45 tirones/min y aspereza 0,07; concreto v1 44 y 0,07;
    Torre v2 100 y 0,15;
  · color: YAVG, SATAVG, YLOW e YHIGH de FFmpeg signalstats a 2 fps (mediana y p90, antes de reducir);
  · sonido: sonoridad integrada y LRA (ebur128), golpes por segundo (flujo espectral) y, con las palabras de la voz
    (JSON de faster-whisper o de produccion.py), cuántos dB queda el fondo (música + ambiente) bajo la voz en los huecos.
Imprime una tabla con la diferencia y si cae dentro de la tolerancia frente a la referencia. Las tolerancias son una
guía para decidir, no un contrato: una medida dentro de rango no prueba que el video funcione (produccion-25d.md).
Código 0 siempre que mida; 2 si falta un archivo o FFmpeg falla.
"""
import argparse
import json
import re
import subprocess
import sys

import numpy as np


def ff(*args, salida=True):
    r = subprocess.run(["ffmpeg", "-hide_banner", "-v", "error", *args], capture_output=True)
    if r.returncode:
        sys.exit(f"ffmpeg falló: {r.stderr.decode('utf-8', 'replace')[-400:]}")
    return r.stdout if salida else r


def movimiento(v):
    raw = ff("-i", v, "-vf", "fps=10,scale=90:160,format=gray", "-f", "rawvideo", "-")
    f = np.frombuffer(raw, np.uint8).reshape(-1, 160, 90).astype(np.float32)
    dif = np.abs(np.diff(f, axis=0)).mean(axis=(1, 2))
    seg = [dif[i:i + 10].mean() for i in range(0, len(dif), 10)]
    # corte duro: salto ≥ 6× la mediana de su vecindad (±1 s) y ≥ 18 niveles
    cortes = [i for i in range(len(dif)) if dif[i] >= 18 and dif[i] >= 6 * np.median(dif[max(0, i - 10):i + 10])]
    return {"mov_mediana": float(np.median(seg)), "mov_p25": float(np.percentile(seg, 25)),
            "cortes_duros": len(cortes), "cortes_t": [round((i + 1) / 10, 1) for i in cortes], "dur": len(f) / 10}


def fluidez(v, fps=30):
    raw = ff("-i", v, "-vf", f"fps={fps},scale=180:320,format=gray", "-f", "rawvideo", "-")
    f = np.frombuffer(raw, np.uint8).reshape(-1, 320, 180).astype(np.float32)
    d = np.abs(np.diff(f, axis=0)).mean(axis=(1, 2))
    med = float(np.median(d))
    loc = np.array([np.median(d[max(0, i - fps // 2):i + fps // 2]) for i in range(len(d))])
    tirones = int(np.sum((d > 2.5 * np.maximum(loc, 0.3)) & (d < 18)))
    return {"congelados_pct": float(np.mean(d < 0.25) * 100), "tirones_min": tirones * 60 / max(1e-6, len(f) / fps),
            "aspereza": float(np.median(np.abs(np.diff(d))) / max(med, 1e-6))}


def color(v):
    r = subprocess.run(["ffmpeg", "-hide_banner", "-i", v, "-vf", "fps=2,signalstats,metadata=print", "-f", "null", "-"],
                       capture_output=True)
    txt = r.stderr.decode("utf-8", "replace")
    out = {}
    for k in ("YAVG", "SATAVG", "YLOW", "YHIGH"):
        xs = [float(x) for x in re.findall(rf"lavfi\.signalstats\.{k}=([\d.]+)", txt)]
        out[k] = (float(np.median(xs)), float(np.percentile(xs, 90))) if xs else (float("nan"), float("nan"))
    return out


def audio(v):
    r = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-i", v, "-af", "ebur128", "-f", "null", "-"], capture_output=True)
    t = r.stderr.decode("utf-8", "replace")
    I = re.findall(r"I:\s+(-?[\d.]+) LUFS", t); LRA = re.findall(r"LRA:\s+([\d.]+) LU", t)
    x = np.frombuffer(ff("-i", v, "-ac", "1", "-ar", "16000", "-f", "f32le", "-"), np.float32)
    # golpes: picos del flujo espectral (ventana 1024, salto 256) sobre un umbral adaptativo
    n, hop = 1024, 256
    if len(x) < n * 4:
        return {"lufs": float(I[-1]) if I else float("nan"), "lra": float(LRA[-1]) if LRA else float("nan"), "golpes_s": 0.0, "x": x}
    fr = np.lib.stride_tricks.sliding_window_view(x, n)[::hop] * np.hanning(n)
    mag = np.abs(np.fft.rfft(fr, axis=1))
    flujo = np.maximum(0, np.diff(np.log1p(mag), axis=0)).sum(axis=1)
    med = np.convolve(flujo, np.ones(31) / 31, mode="same")
    picos = [i for i in range(1, len(flujo) - 1) if flujo[i] > 2.2 * med[i] and flujo[i] >= flujo[i - 1] and flujo[i] >= flujo[i + 1]]
    picos = [p for k, p in enumerate(picos) if k == 0 or p - picos[k - 1] > 6]   # ≥ 0,1 s entre golpes
    dur = len(x) / 16000
    return {"lufs": float(I[-1]) if I else float("nan"), "lra": float(LRA[-1]) if LRA else float("nan"), "golpes_s": len(picos) / dur, "x": x}


def fondo(x, palabras):
    w = json.load(open(palabras, encoding="utf-8"))
    if isinstance(w, dict):
        w = w.get("words", w.get("palabras", w))
    if w and isinstance(w[0], dict) and "palabras" in w[0]:
        w = [{"start": p[0], "end": p[1]} for s in w for p in s["palabras"]]
    sr = 16000; voz = np.zeros(len(x), bool)
    for p in w:
        voz[int(p["start"] * sr):int(p["end"] * sr)] = True
    idx = np.flatnonzero(np.diff(np.r_[0, (~voz).astype(int), 0])); m = np.zeros(len(x), bool)
    for a, b in zip(idx[::2], idx[1::2]):
        if (b - a) / sr >= 0.2:
            m[a + int(0.05 * sr):b - int(0.05 * sr)] = True
    db = lambda y: 20 * np.log10(np.sqrt(np.mean(y ** 2)) + 1e-9)
    return float(db(x[voz]) - db(x[m])) if m.any() and voz.any() else float("nan")


def medir(v, palabras):
    a = audio(v); d = {**movimiento(v), **fluidez(v), **{f"{k}": c for k, c in color(v).items()}, "lufs": a["lufs"], "lra": a["lra"], "golpes_s": a["golpes_s"]}
    d["fondo_db"] = fondo(a["x"], palabras) if palabras else float("nan")
    return d


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("referencia"); ap.add_argument("nuestro")
    ap.add_argument("--palabras-ref"); ap.add_argument("--palabras"); ap.add_argument("--json")
    a = ap.parse_args()
    R, N = medir(a.referencia, a.palabras_ref), medir(a.nuestro, a.palabras)
    filas = [
        # (nombre, valor ref, valor nuestro, ¿dentro?)
        ("movimiento (mediana)", R["mov_mediana"], N["mov_mediana"], N["mov_mediana"] >= 0.8 * R["mov_mediana"]),
        ("movimiento (p25, tramos quietos)", R["mov_p25"], N["mov_p25"], N["mov_p25"] >= 0.7 * R["mov_p25"]),
        ("fotogramas congelados (%)", R["congelados_pct"], N["congelados_pct"], N["congelados_pct"] <= R["congelados_pct"] + 2),
        ("tirones por minuto", R["tirones_min"], N["tirones_min"], N["tirones_min"] <= 1.5 * R["tirones_min"] + 5),
        ("aspereza del movimiento", R["aspereza"], N["aspereza"], N["aspereza"] <= R["aspereza"] + 0.05),
        ("cortes duros por minuto", R["cortes_duros"] * 60 / R["dur"], N["cortes_duros"] * 60 / N["dur"], N["cortes_duros"] * 60 / N["dur"] <= R["cortes_duros"] * 60 / R["dur"] + 4),
        ("YAVG mediana", R["YAVG"][0], N["YAVG"][0], abs(N["YAVG"][0] - R["YAVG"][0]) <= 12),
        ("YLOW mediana (negros)", R["YLOW"][0], N["YLOW"][0], abs(N["YLOW"][0] - R["YLOW"][0]) <= 8),
        ("YHIGH mediana (luces)", R["YHIGH"][0], N["YHIGH"][0], abs(N["YHIGH"][0] - R["YHIGH"][0]) <= 10),
        ("SATAVG mediana", R["SATAVG"][0], N["SATAVG"][0], abs(N["SATAVG"][0] - R["SATAVG"][0]) <= 5),
        ("SATAVG p90 (picos)", R["SATAVG"][1], N["SATAVG"][1], N["SATAVG"][1] <= R["SATAVG"][1] + 3),
        ("sonoridad LUFS", R["lufs"], N["lufs"], abs(N["lufs"] - R["lufs"]) <= 1),
        ("golpes por segundo", R["golpes_s"], N["golpes_s"], 0.7 * R["golpes_s"] <= N["golpes_s"] <= 1.4 * R["golpes_s"]),
        ("fondo bajo la voz (dB)", R["fondo_db"], N["fondo_db"], abs(N["fondo_db"] - R["fondo_db"]) <= 2 if R["fondo_db"] == R["fondo_db"] and N["fondo_db"] == N["fondo_db"] else None),
    ]
    print(f"{'medida':36s} {'referencia':>11s} {'nuestro':>9s} {'dif':>8s}  estado")
    for nombre, r, n, ok in filas:
        estado = "—" if ok is None else ("OK" if ok else "FUERA")
        print(f"{nombre:36s} {r:11.2f} {n:9.2f} {n - r:+8.2f}  {estado}")
    print(f"cortes duros (s): referencia {R['cortes_t']} · nuestro {N['cortes_t']}")
    fuera = [f[0] for f in filas if f[3] is False]
    print("FUERA de la referencia: " + (", ".join(fuera) if fuera else "nada"))
    if a.json:
        json.dump({"referencia": {k: v for k, v in R.items()}, "nuestro": {k: v for k, v in N.items()},
                   "filas": [{"medida": f[0], "referencia": f[1], "nuestro": f[2], "ok": f[3]} for f in filas]},
                  open(a.json, "w", encoding="utf-8"), ensure_ascii=False, indent=1)


if __name__ == "__main__":
    main()
