"""python tests/animacion/lote_audio_test.py

Pruebas sin red de scripts/audio_video.py (anclas de tiempo, cues, falta de voz) y scripts/lote.py (estado, rutas
relativas, crítica, publicar sin puerta y publicador con una orden falsa). Nada llama a ElevenLabs ni renderiza.
"""
import importlib.util
import io
import json
import os
import subprocess
import sys
import tempfile
import unittest
from contextlib import redirect_stdout
from types import SimpleNamespace

SCRIPTS = os.path.join(os.path.dirname(__file__), "..", "..", "motion-studio", "scripts")


def cargar(nombre):
    spec = importlib.util.spec_from_file_location(nombre, os.path.join(SCRIPTS, f"{nombre}.py"))
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


AV = cargar("audio_video")
LT = cargar("lote")


def escribir(ruta, datos):
    os.makedirs(os.path.dirname(ruta), exist_ok=True)
    with open(ruta, "w", encoding="utf-8") as f:
        json.dump(datos, f, ensure_ascii=False)


def leer(ruta):
    with open(ruta, encoding="utf-8") as f:
        return json.load(f)


def texto(ruta, contenido, modo="w"):
    with open(ruta, modo, **({} if "b" in modo else {"encoding": "utf-8"})) as f:
        f.write(contenido)


class AudioVideo(unittest.TestCase):
    def setUp(self):
        self.d = tempfile.mkdtemp()
        escribir(os.path.join(self.d, "video.json"), {
            "voz": {}, "cola": 0.6,
            "lineas": [{"id": "L01", "texto": "The hole opened."}, {"id": "L02", "texto": "Then the hole closed again."}],
            "sfx": {"golpe": ["a thud", 0.5], "viento": ["wind", 4.0]},
            "cues": [{"t": "@hole#2", "sfx": "golpe"}, {"t": "L02$-0.25", "sfx": "golpe", "g": -2},
                     {"t": "@hole@L02+0.1", "sfx": "viento", "amb": True, "fin": "FIN"}]})
        escribir(os.path.join(self.d, "audio", "tiempos_voz.json"),
                 {"duracion": 4.0, "lineas": [{"id": "L01", "inicio": 0.08, "fin": 1.5}, {"id": "L02", "inicio": 1.8, "fin": 3.6}]})
        escribir(os.path.join(self.d, "audio", "voz.palabras.json"), {"words": [
            {"word": " The", "start": 0.08, "end": 0.2}, {"word": " hole", "start": 0.2, "end": 0.5},
            {"word": " opened.", "start": 0.5, "end": 1.5}, {"word": " Then", "start": 1.8, "end": 2.0},
            {"word": " the", "start": 2.0, "end": 2.1}, {"word": " hole", "start": 2.1, "end": 2.4},
            {"word": " closed", "start": 2.4, "end": 2.9}, {"word": " again.", "start": 2.9, "end": 3.6}]})

    def test_anclas(self):
        P = AV.Proyecto(self.d)
        self.assertEqual(P.tiempo("@hole"), 0.2)
        self.assertEqual(P.tiempo("@hole#2"), 2.1)
        self.assertEqual(P.tiempo("@hole@L02"), 2.1)
        self.assertEqual(P.tiempo("L02$-0.25"), 3.35)
        self.assertEqual(P.tiempo("L01"), 0.08)
        self.assertEqual(P.tiempo("FIN"), 4.6)
        self.assertEqual(P.tiempo(1.25), 1.25)
        self.assertEqual(P.tiempo("@open"), 0.5)          # prefijo: «open» encuentra «opened»
        with self.assertRaises(SystemExit):
            P.tiempo("@hole#3")
        with self.assertRaises(SystemExit):
            P.tiempo("hole")

    def test_cues(self):
        with redirect_stdout(io.StringIO()):
            AV.cues(AV.Proyecto(self.d))
        C = leer(os.path.join(self.d, "audio", "cues.json"))
        self.assertEqual([round(c["t"], 3) for c in C], [2.1, 2.2, 3.35])
        self.assertEqual(C[1]["fin"], 4.6)
        escribir(os.path.join(self.d, "video.json"), {**leer(os.path.join(self.d, "video.json")),
                                                       "cues": [{"t": 1.0, "sfx": "no-existe"}]})
        with self.assertRaises(SystemExit):
            AV.cues(AV.Proyecto(self.d))

    def test_grabar_sin_voz(self):
        with self.assertRaises(SystemExit) as e:
            AV.grabar(AV.Proyecto(self.d), [])
        self.assertIn("voz.id", str(e.exception))

    def test_clave_sin_imprimir(self):
        os.makedirs(os.path.join(self.d, "credenciales"))
        texto(os.path.join(self.d, "credenciales", "elevenlabs.env"), "# clave\nELEVENLABS_API_KEY=abc123\n")
        viejo = os.environ.pop("ELEVENLABS_API_KEY", None)
        try:
            self.assertEqual(AV.ElevenLabs(os.path.join(self.d, "audio")).clave(), "abc123")
        finally:
            if viejo is not None:
                os.environ["ELEVENLABS_API_KEY"] = viejo


class Lote(unittest.TestCase):
    def setUp(self):
        self.raiz = tempfile.mkdtemp()
        self.dl = os.path.join(self.raiz, "lotes", "2026-11-18_prueba")
        self.L = {"canal": "c", "ritmo": "1 al día", "nota_minima": 7.0, "carpeta_videos": "../../videos",
                  "videos": [{"id": "DC-01", "slug": "uno", "carpeta": "2026-11-18_uno", "fecha": "2026-11-18", "hora": "12:00",
                              "titulo": "Uno", "estado": "render"}]}
        escribir(os.path.join(self.dl, "lote.json"), self.L)

    def args(self, **k):
        return SimpleNamespace(**k)

    def test_estado_y_rutas(self):
        L = LT.cargar(self.dl)
        out = io.StringIO()
        with redirect_stdout(out):
            LT.c_estado(self.dl, L, self.args())
        self.assertIn("lote.py puerta + crítica", out.getvalue())
        self.assertEqual(os.path.normpath(LT.proyecto(self.dl, L, L["videos"][0])),
                         os.path.normpath(os.path.join(self.raiz, "videos", "2026-11-18_uno", "03-proyecto")))
        antes = os.getcwd()
        try:
            os.chdir(self.raiz)
            self.assertEqual(os.path.normpath(LT.carpeta_lote(None)), os.path.normpath(self.dl))
        finally:
            os.chdir(antes)

    def test_critica_y_publicar_sin_puerta(self):
        L = LT.cargar(self.dl)
        with redirect_stdout(io.StringIO()):
            LT.c_critica(self.dl, L, self.args(id="dc-01", nota=7.4, ronda=2))
        self.assertEqual(LT.cargar(self.dl)["videos"][0]["criticas"], [{"ronda": 2, "nota": 7.4}])
        with self.assertRaises(SystemExit) as e:
            LT.c_publicar(self.dl, LT.cargar(self.dl), self.args(id="DC-01", aprobado="«Sí»", programar=False))
        self.assertIn("puerta", str(e.exception))

    def test_publicador(self):
        dv = os.path.join(self.raiz, "videos", "2026-11-18_uno")
        mp4 = os.path.join(dv, "05-render", "uno_completo_v1.mp4")
        os.makedirs(os.path.dirname(mp4)); texto(mp4, b"", "wb")
        escribir(os.path.join(dv, "03-proyecto", "review", "puerta.json"), {"pasa": True, "mp4": mp4})
        texto(os.path.join(dv, "PUBLICACION.md"), "# t\n")
        L = LT.cargar(self.dl)
        py = sys.executable
        L["publicador"] = {"cwd": ".", "pasos": [[py, "-c", "import sys\nwith open('pasos.txt', 'a', encoding='utf-8') as f: f.write(' '.join(sys.argv[1:]))", "{ref}"]],
                           "programar": [py, "-c", "print('ok https://youtu.be/XYZ123')"]}
        LT.guardar(self.dl, L)
        with redirect_stdout(io.StringIO()):
            LT.c_publicar(self.dl, LT.cargar(self.dl), self.args(id="DC-01", aprobado="«Sí, súbelo»", programar=True))
        pub = LT.leer_json(os.path.join(dv, "publicar.json"))
        self.assertEqual(pub["master"], "05-render/uno_completo_v1.mp4")
        self.assertEqual(pub["programacion"], {"fecha": "2026-11-18", "hora": "12:00"})
        with open(os.path.join(self.dl, "pasos.txt"), encoding="utf-8") as f:
            self.assertEqual(f.read(), "c/dc-01-uno")
        v = LT.cargar(self.dl)["videos"][0]
        self.assertEqual((v["estado"], v["video_id"]), ("programado", "XYZ123"))


if __name__ == "__main__":
    unittest.main(verbosity=1)
