"""
render.py — etap Blendera: renderuje modele 3D grafiki zastępczej do ``art/zastepcze/_render/<nazwa>.png``.

Uruchamia go ``generuj_wszystko.py`` interpreterem Pythona z zainstalowanym ``bpy`` (pip install bpy):

    <python-z-bpy> tools/art/zastepcze/blender/render.py [--tylko nazwa1,nazwa2] [--od-nowa]

Bez ``--od-nowa`` istniejące rendery są pomijane (render trwa sekundy–minuty, a modele zmieniają się rzadko).
"""

from __future__ import annotations

import argparse
import sys
import time
from pathlib import Path

TU = Path(__file__).resolve().parent
sys.path.insert(0, str(TU))

import modele  # noqa: E402
import modele_postacie  # noqa: E402
from scena import renderuj  # noqa: E402

WYJ = TU.parents[2].parent / "art" / "zastepcze" / "_render"


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument("--tylko", help="nazwy renderów rozdzielone przecinkami (albo prefiksy, np. matcap_)")
    ap.add_argument("--od-nowa", action="store_true", help="renderuj także te, które już istnieją")
    ap.add_argument("--wyjscie", default=str(WYJ))
    arg = ap.parse_args(argv)
    wszystkie = {**modele.RENDERY, **modele_postacie.RENDERY}
    nazwy = list(wszystkie)
    if arg.tylko:
        wz = [w.strip() for w in arg.tylko.split(",")]
        nazwy = [n for n in nazwy if any(n == w or (w.endswith("_") and n.startswith(w)) for w in wz)]
    wyj = Path(arg.wyjscie)
    wyj.mkdir(parents=True, exist_ok=True)
    for n in nazwy:
        cel = wyj / f"{n}.png"
        if cel.exists() and not arg.od_nowa:
            continue
        t = time.time()
        fn, _ = wszystkie[n]
        fn()
        renderuj(cel)
        print(f"RENDER {n}: {time.time() - t:.1f} s", flush=True)


if __name__ == "__main__":
    main(sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else sys.argv[1:])
