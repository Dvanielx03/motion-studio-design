"""Envolvente de la voz para animar bocas (kit/actuacion.js → crearHabla).

    python envolvente.py audio/voz.wav [--fps 30] [--suelo 35] [--salida audio/voz.envolvente.json]

Lee el audio con FFmpeg (mono, 16 kHz), mide la energía RMS por fotograma con una ventana de 1,5 fotogramas, la pasa a
dB y la lleva a 0–1 entre un suelo (percentil 35 de la voz) y el pico (percentil 98). Suaviza con ataque de 20 ms y
caída de 25 ms: la boca abre de golpe y CIERRA entre sílabas. Medido en la narración del piloto US (18 nov 2026): con
suelo p10 y caída de 80 ms la boca quedaba abierta el 80 % del tiempo y cerraba 1 vez/s (parecía un «aaa» continuo);
con estos valores, abierta el 60 % y 2,4 cierres/s, cerca del ritmo silábico de la voz. Determinista.
Salida: {"fps": 30, "duracion": s, "valores": [0–1, …]} (un valor por fotograma).
"""
import argparse
import json
import subprocess
import sys

import numpy as np


def leer(ruta, sr=16000):
    r = subprocess.run(["ffmpeg", "-hide_banner", "-v", "error", "-i", ruta, "-ac", "1", "-ar", str(sr), "-f", "s16le", "-"],
                       capture_output=True)
    if r.returncode:
        sys.exit(f"ffmpeg falló: {r.stderr.decode('utf-8', 'replace')[-400:]}")
    return np.frombuffer(r.stdout, dtype=np.int16).astype(np.float32) / 32768.0


def envolvente(x, sr=16000, fps=30, ataque=0.02, caida=0.025, percentil_suelo=35):
    paso = sr / fps
    n = int(np.ceil(len(x) / paso))
    medio = int(paso * 0.75)
    db = np.empty(n, dtype=np.float64)
    for i in range(n):
        c = int(i * paso)
        v = x[max(0, c - medio): c + medio]
        rms = float(np.sqrt(np.mean(v * v))) if len(v) else 0.0
        db[i] = 20 * np.log10(max(rms, 1e-6))
    voz = db[db > -60]
    suelo = max(-50.0, float(np.percentile(voz, percentil_suelo)) if len(voz) else -50.0)
    pico = float(np.percentile(voz, 98)) if len(voz) else -10.0
    v = np.clip((db - suelo) / max(6.0, pico - suelo), 0, 1)
    # ataque rápido / caída lenta (constantes de tiempo en s): seguidor de envolvente por fotograma
    a_up = 1 - np.exp(-1 / max(1e-3, ataque * fps))
    a_dn = 1 - np.exp(-1 / max(1e-3, caida * fps))
    out = np.empty_like(v)
    y = 0.0
    for i, s in enumerate(v):
        y += (s - y) * (a_up if s > y else a_dn)
        out[i] = y
    return out


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("audio")
    ap.add_argument("--fps", type=int, default=30)
    ap.add_argument("--suelo", type=float, default=35, help="percentil del suelo (más alto = la boca cierra más)")
    ap.add_argument("--salida")
    a = ap.parse_args()
    x = leer(a.audio)
    e = envolvente(x, fps=a.fps, percentil_suelo=a.suelo)
    datos = {"fps": a.fps, "duracion": round(len(x) / 16000, 3), "valores": [round(float(v), 3) for v in e]}
    salida = a.salida or a.audio.rsplit(".", 1)[0] + ".envolvente.json"
    with open(salida, "w", encoding="utf-8") as f:
        json.dump(datos, f, separators=(",", ":"))
    abierta = float(np.mean(e > 0.08))
    b = e > 0.12
    cierres = float(np.sum(b[:-1] & ~b[1:])) / max(1e-6, len(e) / a.fps)
    print(f"OK {salida}: {len(e)} fotogramas a {a.fps} fps; boca abierta el {abierta:.0%} del tiempo; {cierres:.1f} cierres/s")


if __name__ == "__main__":
    main()
