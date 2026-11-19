"""Cadena de audio de un Short a partir de <proyecto>/video.json (el guion técnico aprobado, en datos). Motion Studio.

    python audio_video.py <proyecto> grabar [L01 …]   2 tomas por línea (ElevenLabs v3) -> audio/voz/v3/LNN_a|b.mp3 (no repite)
    python audio_video.py <proyecto> elegir           toma con más entonación y ritmo válido -> audio/voz/elegidas.json
    python audio_video.py <proyecto> montar           tempo y pausas por línea -> audio/voz.wav, tiempos_voz.json, guion.json
    python audio_video.py <proyecto> transcribir      marcas por palabra (faster-whisper, idioma de video.json) -> audio/voz.palabras.json
    python audio_video.py <proyecto> envolvente       boca de los personajes -> audio/voz.envolvente.json
    python audio_video.py <proyecto> cues             cada efecto en su palabra -> audio/cues.json (falla si falta un ancla)
    python audio_video.py <proyecto> musica           ElevenLabs Music por secciones -> audio/musica/musica_1.mp3 (no repite)
    python audio_video.py <proyecto> sfx [n …]        efectos con reintentos, 4 en paralelo -> audio/sfx/<n>.mp3 (no repite)
    python audio_video.py <proyecto> mezcla           -> audio/final.wav (48 kHz estéreo, −14 LUFS, ≤ −1,5 dBTP)
    python audio_video.py <proyecto> todo             montar…mezcla tras grabar y elegir (no paga dos veces lo que ya existe)

Tiempos en video.json (cues, fin, hasta de la música):
    número                segundos
    "L05" / "L05$"        inicio / fin de la línea L05 (tiempos_voz.json)
    "@word" "@word#2"     inicio de la 1.ª / 2.ª palabra que EMPIEZA por «word» (prefijo; ojo con «lift» → «lifted»)
    "@word@L05"           primera desde el inicio de L05 (combinable: "@turn#2@L08")
    "FIN"                 final de la pieza (voz + cola)
    y un desfase opcional al final: "@hole+0.6", "L07-0.25".
Clave de ElevenLabs: variable ELEVENLABS_API_KEY o un archivo credenciales/elevenlabs.env (ELEVENLABS_API_KEY=...) en la
carpeta del proyecto o en una superior. Nunca se imprime. Los pasos que pagan (grabar, musica, sfx) no repiten lo que ya
existe; si el agente corre en un sandbox, necesitan permiso de red para api.elevenlabs.io.
Python para el ASR: MOTION_STUDIO_PY, o el .venv más cercano hacia arriba, o el intérprete actual.
Plantilla de video.json: assets/lote/ejemplo.video.json (el hotel de Dani Clips). Guía: references/lotes.md.
"""
import json
import os
import re
import subprocess
import sys
from concurrent.futures import ThreadPoolExecutor

import urllib.error
import urllib.request

import numpy as np

SKILL_SCRIPTS = os.path.dirname(os.path.abspath(__file__))
API = "https://api.elevenlabs.io/v1"
SR_VOZ = 44100
SR = 48000


def _hacia_arriba(desde, nombre):
    d = os.path.abspath(desde)
    while True:
        if os.path.exists(os.path.join(d, nombre)):
            return os.path.join(d, nombre)
        if os.path.dirname(d) == d:
            return None
        d = os.path.dirname(d)


def python_asr(desde):
    """Intérprete con faster-whisper: MOTION_STUDIO_PY, el .venv más cercano hacia arriba o el actual."""
    if os.environ.get("MOTION_STUDIO_PY"):
        return os.environ["MOTION_STUDIO_PY"]
    for rel in (os.path.join(".venv", "Scripts", "python.exe"), os.path.join(".venv", "bin", "python")):
        r = _hacia_arriba(desde, rel)
        if r:
            return r
    return sys.executable


class ElevenLabs:
    """Cliente mínimo (urllib). La clave sale de ELEVENLABS_API_KEY o de credenciales/elevenlabs.env hacia arriba."""

    def __init__(self, desde):
        self.desde = desde
        self._clave = None

    def clave(self):
        if self._clave:
            return self._clave
        if os.environ.get("ELEVENLABS_API_KEY"):
            self._clave = os.environ["ELEVENLABS_API_KEY"]
            return self._clave
        ruta = _hacia_arriba(self.desde, os.path.join("credenciales", "elevenlabs.env"))
        if not ruta:
            raise SystemExit("falta la clave de ElevenLabs: define ELEVENLABS_API_KEY o crea credenciales/elevenlabs.env")
        datos = dict(l.strip().split("=", 1) for l in open(ruta, encoding="utf-8") if "=" in l and not l.startswith("#"))
        if not datos.get("ELEVENLABS_API_KEY"):
            raise SystemExit("credenciales/elevenlabs.env no tiene ELEVENLABS_API_KEY")
        self._clave = datos["ELEVENLABS_API_KEY"]
        return self._clave

    def pedir(self, ruta, cuerpo=None, binario=False):
        req = urllib.request.Request(API + ruta, data=json.dumps(cuerpo).encode() if cuerpo else None,
                                     headers={"xi-api-key": self.clave(), "Content-Type": "application/json", "Accept": "*/*"},
                                     method="POST" if cuerpo else "GET")
        try:
            with urllib.request.urlopen(req, timeout=float(os.environ.get("TIMEOUT_API", "180"))) as r:
                datos = r.read()
                return datos if binario else json.loads(datos)
        except urllib.error.HTTPError as e:
            raise SystemExit(f"HTTP {e.code} en {ruta.split('?')[0]}: {e.read().decode('utf-8', 'replace')[:400]}")

    def tts(self, voz, texto, destino, modelo, ajustes):
        audio = self.pedir(f"/text-to-speech/{voz}?output_format=mp3_44100_192",
                           {"text": texto, "model_id": modelo, "voice_settings": ajustes}, binario=True)
        open(destino, "wb").write(audio)
        return len(audio)


def duracion(mp3):
    r = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", mp3], capture_output=True, text=True)
    return float(r.stdout.strip())


class Proyecto:
    def __init__(self, raiz):
        self.raiz = os.path.abspath(raiz)
        self.audio = os.path.join(self.raiz, "audio")
        self.cfg = json.load(open(os.path.join(self.raiz, "video.json"), encoding="utf-8"))
        vz = self.cfg.get("voz", {})
        self.voz_id = vz.get("id")                                  # voice_id de ElevenLabs elegido por el usuario
        self.modelo = vz.get("modelo", "eleven_v3")                 # v3: etiquetas de actuación ([whispers], [shouting]...)
        self.idioma = self.cfg.get("idioma", "en")
        self.tempo = vz.get("tempo", 1.2)
        self.silencio = vz.get("silencio_interno", 0.12)
        self.ajustes = vz.get("ajustes", {"stability": 0.0, "similarity_boost": 0.8, "style": 0.0, "speed": 1.0})
        self.cola = self.cfg.get("cola", 0.6)
        self.lineas = self.cfg["lineas"]
        self.dir_tomas = os.path.join(self.audio, "voz", vz.get("version", "v3"))
        self.api = ElevenLabs(self.raiz)

    def a(self, *p):
        return os.path.join(self.audio, *p)

    # ---- tiempos -------------------------------------------------------------------------------------------------
    def _tv(self):
        if not hasattr(self, "_tv_c"):
            self._tv_c = json.load(open(self.a("tiempos_voz.json"), encoding="utf-8"))
        return self._tv_c

    @property
    def dur(self):
        return self._tv()["duracion"] + self.cola

    def _palabras(self):
        if not hasattr(self, "_w"):
            w = json.load(open(self.a("voz.palabras.json"), encoding="utf-8"))
            self._w = w.get("words", w)
        return self._w

    def tiempo(self, spec):
        if isinstance(spec, (int, float)):
            return float(spec)
        m = re.fullmatch(r"\s*(@[^#@+\-\s]+(?:#\d+)?(?:@L\d+)?|L\d+\$?|FIN|\d+(?:\.\d+)?)\s*([+-]\s*\d+(?:\.\d+)?)?\s*", spec)
        if not m:
            raise SystemExit(f"tiempo no válido: «{spec}»")
        base, off = m.group(1), float((m.group(2) or "0").replace(" ", ""))
        L = {l["id"]: l for l in self._tv()["lineas"]}
        if base == "FIN":
            t = self.dur
        elif base.startswith("@"):
            mm = re.fullmatch(r"@([^#@]+)(?:#(\d+))?(?:@(L\d+))?", base)
            palabra, n, desde = mm.group(1).lower(), int(mm.group(2) or 1), mm.group(3)
            t0 = L[desde]["inicio"] if desde else 0.0
            lim = lambda s: s.strip().lower().strip('",.?!:;“”')
            c = [x["start"] for x in self._palabras() if lim(x["word"]).startswith(palabra) and x["start"] >= t0 - 1e-6]
            if len(c) < n:
                raise SystemExit(f"cues: no encuentro «{palabra}» #{n}" + (f" desde {desde}" if desde else "") + " en voz.palabras.json")
            t = c[n - 1]
        elif base.startswith("L"):
            fin = base.endswith("$")
            l = L[base.rstrip("$")]
            t = l["fin"] if fin else l["inicio"]
        else:
            t = float(base)
        return round(t + off, 3)


# ---- voz ---------------------------------------------------------------------------------------------------------
def _leer_voz(mp3):
    r = subprocess.run(["ffmpeg", "-v", "error", "-i", mp3, "-ac", "1", "-ar", str(SR_VOZ), "-f", "f32le", "-"], capture_output=True, check=True)
    return np.frombuffer(r.stdout, np.float32)


def _recortar(x, umbral=0.012):
    a = np.flatnonzero(np.abs(x) > umbral)
    return x[max(0, a[0] - int(0.02 * SR_VOZ)):a[-1] + int(0.06 * SR_VOZ)] if len(a) else x


def _entonacion(x):
    """Varianza del tono (semitonos) en tramos con voz + variación de intensidad: más alto = más expresivo."""
    n, hop = 2048, 512
    f0, rms = [], []
    for i in range(0, len(x) - n, hop):
        w = x[i:i + n] * np.hanning(n)
        e = np.sqrt(np.mean(w ** 2)); rms.append(e)
        if e < 0.02:
            continue
        ac = np.correlate(w, w, "full")[n - 1:]
        lo, hi = SR_VOZ // 400, SR_VOZ // 70
        k = lo + int(np.argmax(ac[lo:hi]))
        if ac[k] > 0.3 * ac[0]:
            f0.append(SR_VOZ / k)
    st = 12 * np.log2(np.array(f0) / np.median(f0)) if len(f0) > 5 else np.zeros(1)
    r = np.array(rms); r = r[r > 0.01]
    return float(np.std(st)), float(np.std(20 * np.log10(r)) if len(r) else 0)


def _limpio(texto):
    return re.sub(r"\s+", " ", re.sub(r"\[[^\]]*\]", "", texto)).strip()


def _n_palabras(texto):
    return len(_limpio(texto).split())


def grabar(P, ids):
    if not P.voz_id:
        raise SystemExit("video.json -> voz.id: falta el voice_id de ElevenLabs (lo elige el usuario tras escuchar muestras)")
    os.makedirs(P.dir_tomas, exist_ok=True)
    for l in P.lineas:
        if ids and l["id"] not in ids:
            continue
        for toma in l.get("tomas", "ab"):
            destino = os.path.join(P.dir_tomas, f"{l['id']}_{toma}.mp3")
            if os.path.exists(destino):
                continue
            P.api.tts(P.voz_id, l["texto"], destino, P.modelo, P.ajustes)
            print(f"{l['id']}_{toma}: {duracion(destino):.2f} s")


def elegir(P):
    ruta = P.a("voz", "elegidas.json")
    previo = json.load(open(ruta, encoding="utf-8")) if os.path.exists(ruta) else {}
    out = {}
    for l in P.lineas:
        tempo = l.get("tempo", P.tempo)
        cand = []
        for f in sorted(os.listdir(P.dir_tomas)):
            mm = re.fullmatch(rf"{l['id']}_([a-z])\.mp3", f)
            if not mm:
                continue
            x = _recortar(_leer_voz(os.path.join(P.dir_tomas, f)))
            d = len(x) / SR_VOZ
            pps = _n_palabras(l["texto"]) / d * tempo
            tono, inten = _entonacion(x)
            valida = 1.8 <= pps <= 4.6          # fuera: el TTS alucinó, repitió o se comió palabras
            cand.append({"toma": mm.group(1), "dur": round(d, 2), "pps_montado": round(pps, 2), "tono_st": round(tono, 2),
                         "intensidad_db": round(inten, 2), "valida": valida, "puntos": (tono + 0.25 * inten) if valida else -1})
        if not cand:
            raise SystemExit(f"{l['id']}: no hay tomas en {P.dir_tomas}")
        mejor = max(cand, key=lambda c: c["puntos"])
        fija = l.get("toma") or (previo.get(l["id"], {}).get("fijada") and previo[l["id"]]["elegida"])
        out[l["id"]] = {"elegida": fija or mejor["toma"], "fijada": bool(fija), "candidatas": cand}
        print(f"{l['id']}: " + " · ".join(f"{c['toma']} {c['dur']:.1f}s {c['pps_montado']:.2f}p/s tono {c['tono_st']:.1f}"
                                          f"{'' if c['valida'] else ' (NO)'}" for c in cand) + f"  → {out[l['id']]['elegida']}"
              + (" (fijada)" if fija else ""))
        if not any(c["valida"] for c in cand):
            print(f"  AVISO {l['id']}: ninguna toma tiene un ritmo válido; regrabar")
    json.dump(out, open(ruta, "w", encoding="utf-8"), indent=1)


def montar(P):
    el = json.load(open(P.a("voz", "elegidas.json"), encoding="utf-8"))
    partes, lineas, t = [np.zeros(int(0.08 * SR_VOZ), np.float32)], [], 0.08
    for l in P.lineas:
        e = el.get(l["id"]) or el.get(str(int(l["id"][1:])))
        tempo = l.get("tempo", P.tempo)
        x = _recortar(_leer_voz(os.path.join(P.dir_tomas, f"{l['id']}_{e['elegida']}.mp3")))
        tmp = os.path.join(P.dir_tomas, "_t.f32"); x.astype(np.float32).tofile(tmp)
        r = subprocess.run(["ffmpeg", "-v", "error", "-f", "f32le", "-ar", str(SR_VOZ), "-ac", "1", "-i", tmp, "-af",
                            f"silenceremove=stop_periods=-1:stop_duration=0.3:stop_threshold=-42dB:stop_silence={P.silencio},atempo={tempo}",
                            "-f", "f32le", "-"], capture_output=True, check=True)
        y = np.frombuffer(r.stdout, np.float32); os.remove(tmp)
        lineas.append({"id": l["id"], "inicio": round(t, 3), "fin": round(t + len(y) / SR_VOZ, 3)})
        partes.append(y); t += len(y) / SR_VOZ
        pa = l.get("pausa", 0.15) / tempo
        partes.append(np.zeros(int(pa * SR_VOZ), np.float32)); t += pa
    v = np.concatenate(partes + [np.zeros(int(0.5 * SR_VOZ), np.float32)])
    tmp = P.a("_voz.f32"); v.astype(np.float32).tofile(tmp)
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "f32le", "-ar", str(SR_VOZ), "-ac", "1", "-i", tmp, "-ar", "48000", P.a("voz.wav")], check=True)
    os.remove(tmp)
    dur = len(v) / SR_VOZ
    json.dump({"duracion": round(dur, 2), "lineas": lineas}, open(P.a("tiempos_voz.json"), "w", encoding="utf-8"), indent=1)
    json.dump([_limpio(l["texto"]) for l in P.lineas], open(P.a("guion.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    # la pieza dura lo que la voz más la cola, redondeado a fotogramas
    rc = os.path.join(P.raiz, "motion.config.json")
    mc = json.load(open(rc, encoding="utf-8"))
    fps = mc["video"]["fps"]
    total = round(round((round(dur, 2) + P.cola) * fps) / fps, 3)
    mc["video"]["duracion"] = total
    if "duracion" in mc:
        mc["duracion"] = total
    json.dump(mc, open(rc, "w", encoding="utf-8"), indent=2, ensure_ascii=False)
    n = sum(_n_palabras(l["texto"]) for l in P.lineas)
    gancho = lineas[0]["fin"]
    print(f"voz.wav: {dur:.2f} s · {n} palabras · {n / (dur - 0.58):.2f} p/s · gancho (L01) termina en {gancho:.2f} s"
          + ("  AVISO: gancho > 4,5 s" if gancho > 4.5 else "") + f" · pieza {total} s")


def transcribir(P):
    subprocess.run([python_asr(P.raiz), os.path.join(P.raiz, "produccion.py"), "--transcribir", P.a("voz.wav"), "--idioma", P.idioma],
                   cwd=P.raiz, check=True)
    w = json.load(open(P.a("voz.palabras.json"), encoding="utf-8"))
    json.dump(w, open(P.a("voz.palabras.asr.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    asr = [x["word"].strip().lower().strip('",.?!:;“”') for x in w["words"]]
    guion = [p.lower().strip('",.?!:;“”') for l in P.lineas for p in _limpio(l["texto"]).split()]
    import difflib
    r = difflib.SequenceMatcher(None, guion, asr).ratio()
    print(f"ASR frente al guion: {r:.0%} de coincidencia ({len(asr)} palabras reconocidas, {len(guion)} en el guion)"
          + ("  AVISO: revisa voz.palabras.json, la voz pudo comerse o cambiar palabras" if r < 0.85 else ""))


def envolvente(P):
    fps = json.load(open(os.path.join(P.raiz, "motion.config.json"), encoding="utf-8"))["video"]["fps"]
    subprocess.run([sys.executable, os.path.join(SKILL_SCRIPTS, "envolvente.py"), P.a("voz.wav"), "--fps", str(fps)], cwd=P.raiz, check=True)


# ---- música, efectos y cues ---------------------------------------------------------------------------------------
def musica(P):
    d = P.a("musica"); os.makedirs(d, exist_ok=True); destino = os.path.join(d, "musica_1.mp3")
    if os.path.exists(destino):
        print("musica_1: ya existe, no se vuelve a pagar"); return
    M = P.cfg["musica"]
    secciones, t0 = [], 0.0
    for s in M["secciones"]:
        fin = P.tiempo(s.get("hasta", "FIN"))
        secciones.append({"section_name": s["nombre"], "positive_local_styles": s["estilos"], "negative_local_styles": s.get("evitar", []),
                          "duration_ms": int(round((fin - t0) * 1000)), "lines": []})
        t0 = fin
    plan = {"positive_global_styles": M["global"], "negative_global_styles": M.get("negativo", []), "sections": secciones}
    audio = P.api.pedir("/music?output_format=mp3_44100_192", {"composition_plan": plan, "model_id": "music_v1", "respect_sections_durations": True}, binario=True)
    open(destino, "wb").write(audio)
    json.dump(plan, open(destino.replace(".mp3", ".plan.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(f"musica_1: {len(audio) // 1024} KB · {duracion(destino):.1f} s")


def _un_sfx(api, d, n, texto, dur):
    destino = os.path.join(d, f"{n}.mp3")
    if os.path.exists(destino):
        return n, "ya existe"
    for intento in range(3):   # ElevenLabs da 500 y cortes por tiempo de espera a ratos: se reintenta
        try:
            audio = api.pedir("/sound-generation?output_format=mp3_44100_192",
                            {"text": texto, "duration_seconds": max(0.5, dur), "prompt_influence": 0.6}, binario=True)
            open(destino, "wb").write(audio)
            return n, f"{len(audio) // 1024} KB"
        except (SystemExit, Exception) as e:
            err = str(e)[:80]
    return n, f"FALLÓ 3 veces ({err})"


def sfx(P, nombres):
    d = P.a("sfx"); os.makedirs(d, exist_ok=True)
    S = P.cfg["sfx"]
    with ThreadPoolExecutor(4) as ex:
        for n, r in ex.map(lambda n: _un_sfx(P.api, d, n, *S[n]), nombres or list(S)):
            print(f"sfx {n}: {r}")


def cues(P):
    S = P.cfg["sfx"]
    C = []
    for c in P.cfg["cues"]:
        if c["sfx"] not in S:
            raise SystemExit(f"cues: el efecto «{c['sfx']}» no está en video.json → sfx")
        d = dict(c)
        d["t"] = P.tiempo(c["t"])
        if "fin" in c:
            d["fin"] = P.tiempo(c["fin"])
        C.append(d)
    C.sort(key=lambda c: c["t"])
    json.dump(C, open(P.a("cues.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    acentos = sum(1 for c in C if not c.get("amb"))
    print(f"cues.json: {len(C)} efectos ({acentos} acentos) · {acentos / P.dur:.2f} acentos por segundo")


# ---- mezcla: música bajo la voz con ducking, efectos en su ataque, −14 LUFS ----------------------------------------------
def _leer(ruta, mono=False):
    r = subprocess.run(["ffmpeg", "-v", "error", "-i", ruta, "-ac", "1" if mono else "2", "-ar", str(SR), "-f", "f32le", "-"],
                       capture_output=True, check=True)
    x = np.frombuffer(r.stdout, dtype=np.float32).copy()
    return x if mono else x.reshape(-1, 2)


def _lufs(x):
    x2 = x if x.ndim == 2 else np.stack([x, x], 1)
    r = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-f", "f32le", "-ar", str(SR), "-ac", "2", "-i", "-",
                        "-af", "ebur128", "-f", "null", "-"], input=x2.astype(np.float32).tobytes(), capture_output=True)
    m = re.findall(r"I:\s+(-?[\d.]+) LUFS", r.stderr.decode("utf-8", "replace"))
    return float(m[-1]) if m else -70.0


def _db(g):
    return 10 ** (g / 20)


def _env_voz(v, umbral=-38.0, ataque=0.04, suelta=0.35):
    n = int(0.01 * SR); k = len(v) // n
    rms = np.sqrt(np.mean(v[:k * n].reshape(k, n) ** 2, axis=1) + 1e-12)
    activo = (20 * np.log10(rms) > umbral).astype(np.float32)
    env = np.zeros_like(activo); a, s = 0.01 / ataque, 0.01 / suelta; e = 0.0
    for i, x in enumerate(activo):
        e = e + (x - e) * (a if x > e else s); env[i] = e
    return np.repeat(env, n)


def _ataque(x, umbral=-30.0):
    m = np.abs(x).max(axis=1) if x.ndim == 2 else np.abs(x)
    return np.argmax(m > _db(umbral) * max(m.max(), 1e-9)) / SR


def mezcla(P):
    MZ = P.cfg.get("mezcla", {})
    bajo, duck, duck_amb = MZ.get("musica_bajo_voz", -15.0), MZ.get("duck_musica", -7.0), MZ.get("duck_amb", -8.0)
    N = int(P.dur * SR)
    voz = _leer(P.a("voz.wav"), mono=True)[:N]; voz = np.pad(voz, (0, N - len(voz)))
    Lv = _lufs(voz)
    env = _env_voz(voz); env = np.pad(env, (0, max(0, N - len(env))))[:N]
    mus = _leer(P.a("musica", "musica_1.mp3"))[:N]; mus = np.pad(mus, ((0, N - len(mus)), (0, 0)))
    Lm = _lufs(mus)
    gm = _db(Lv + bajo - Lm) * (1 + (_db(duck) - 1) * env)
    for s in MZ.get("silencios", []):          # corte seco de la música: {"desde": spec, "hasta": spec, "vuelve": s}
        c0, c1, vuelve = P.tiempo(s["desde"]), P.tiempo(s["hasta"]), s.get("vuelve", 0.3)
        i0, i1, i2 = int(c0 * SR), int(c1 * SR), int((c1 + vuelve) * SR); f = int(0.015 * SR)
        gm[i0 - f:i0] *= np.linspace(1, 0, f); gm[i0:i1] = 0; gm[i1:i2] *= np.linspace(0, 1, i2 - i1)
    mezcla_ = mus * gm[:, None]
    C = json.load(open(P.a("cues.json"), encoding="utf-8"))
    faltan = sorted({c["sfx"] for c in C if not os.path.exists(P.a("sfx", c["sfx"] + ".mp3"))})
    if faltan:
        print(f"AVISO: faltan {len(faltan)} efectos (ElevenLabs no respondió): {', '.join(faltan)}")
    C = [c for c in C if c["sfx"] not in faltan]
    cache = {}
    for c in C:
        if c["sfx"] not in cache:
            x = _leer(P.a("sfx", c["sfx"] + ".mp3")); cache[c["sfx"]] = (x, _lufs(x), _ataque(x))
        x, Lx, at = cache[c["sfx"]]
        y = x * _db(Lv - 3 - Lx + c.get("g", 0))
        t0 = c["t"] - (0 if c.get("amb") else at)
        if c.get("fin"):
            largo = int((c["fin"] - c["t"]) * SR)
            if largo < len(y):
                y = y[:largo].copy(); f = min(len(y), int(0.25 * SR)); y[-f:] *= np.linspace(1, 0, f)[:, None]
        if c.get("entra"):
            f = int(c["entra"] * SR); y = y.copy(); y[:f] *= np.linspace(0, 1, f)[:, None]
        ang = (c.get("pan", 0.0) + 1) * np.pi / 4
        y = y * np.array([np.cos(ang), np.sin(ang)]) * np.sqrt(2)
        i0 = int(round(t0 * SR)); i1 = min(N, i0 + len(y))
        if i0 >= N or i1 <= 0:
            continue
        seg = y[max(0, -i0):i1 - i0]
        if c.get("amb"):
            seg = seg * (1 + (_db(duck_amb) - 1) * env[max(0, i0):i1])[:, None]
        mezcla_[max(0, i0):i1] += seg
    mezcla_ += np.stack([voz, voz], 1)
    tmp = P.a("_mezcla_previa.wav")
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "f32le", "-ar", str(SR), "-ac", "2", "-i", "-", "-c:a", "pcm_f32le", tmp],
                   input=mezcla_.astype(np.float32).tobytes(), check=True)
    r = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-i", tmp, "-af", "loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json",
                        "-f", "null", "-"], capture_output=True)
    med = json.loads(re.search(r"\{[^{}]*\"input_i\"[^{}]*\}", r.stderr.decode("utf-8", "replace")).group(0))
    filtro = (f"loudnorm=I=-14:TP=-1.5:LRA=11:measured_I={med['input_i']}:measured_TP={med['input_tp']}:"
              f"measured_LRA={med['input_lra']}:measured_thresh={med['input_thresh']}:offset={med['target_offset']}:linear=true")
    final = P.a("final.wav")
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", tmp, "-af", filtro + ",aresample=48000", "-c:a", "pcm_s24le", final], check=True)
    os.remove(tmp)
    r = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-i", final, "-af", "ebur128=peak=true", "-f", "null", "-"], capture_output=True)
    e = r.stderr.decode("utf-8", "replace")
    I = re.findall(r"I:\s+(-?[\d.]+) LUFS", e)[-1]; tp = re.findall(r"Peak:\s+(-?[\d.]+) dBFS", e)
    print(f"final.wav: {P.dur:.2f} s · {I} LUFS · true peak {tp[-1] if tp else '?'} dBTP · {len(C)} efectos"
          + (f" · FALTAN {len(faltan)}" if faltan else ""))


PASOS = ["montar", "transcribir", "envolvente", "cues", "musica", "sfx", "mezcla"]


def main():
    for f in (sys.stdout, sys.stderr):            # consolas de Windows en cp1252: acentos y «·» sin romper
        if hasattr(f, "reconfigure"):
            f.reconfigure(encoding="utf-8", errors="replace")
    if len(sys.argv) < 3:
        print(__doc__); raise SystemExit(2)
    raiz, paso, resto = sys.argv[1], sys.argv[2], sys.argv[3:]
    acciones = {"grabar": lambda P: grabar(P, resto), "elegir": elegir, "montar": montar, "transcribir": transcribir,
                "envolvente": envolvente, "cues": cues, "musica": musica, "sfx": lambda P: sfx(P, resto), "mezcla": mezcla}
    for p in (PASOS if paso == "todo" else [paso]):
        if paso == "todo":
            print(f"== {p}", flush=True)
        acciones[p](Proyecto(raiz))   # cada paso relee video.json, tiempos y palabras recién escritos


if __name__ == "__main__":
    main()
