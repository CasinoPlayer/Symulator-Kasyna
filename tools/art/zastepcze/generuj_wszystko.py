#!/usr/bin/env python3
"""
generuj_wszystko.py — orkiestrator grafiki zastępczej: wszystkie 85 assetów → art/zastepcze/<pakiet>/<ID>.png.

Po co to jest
-------------
Zanim przyjdzie grafika z ChatGPT, aplikacja musi mieć KOMPLET obrazów w docelowych formatach (1024×1024,
1536×1024, 1024×1536, typy tła ALFA / CZARNE / PELNE), żeby front i pipeline działały od pierwszego dnia.
Grafika zastępcza jest w pełni odtwarzalna (ten skrypt), więc nie trzymamy jej w repozytorium.

Etapy:
1. **Blender** (``blender/render.py``, interpreter z modułem ``bpy``): obiekty 3D (owoce, klejnoty, moneta,
   emblemat, maskotka, skrzynia, awatary) i matcapy materiałów → ``art/zastepcze/_render/``.
2. **Pillow/NumPy** (moduły ``gen_*.py``): tła, efekty, UI, napisy, ramki, kompozycje symboli, okładki.

Użycie:
    python3 tools/art/zastepcze/generuj_wszystko.py                  # wszystko (rendery tylko brakujące)
    python3 tools/art/zastepcze/generuj_wszystko.py --tylko s1       # pakiet albo lista ID
    python3 tools/art/zastepcze/generuj_wszystko.py --bpy ~/venv-bpy/bin/python --od-nowa
    python3 tools/art/zastepcze/generuj_wszystko.py --przetworz      # na końcu uruchom tools/art/przetworz.py

Interpreter z ``bpy``: opcja ``--bpy``, zmienna środowiskowa ``KASYNO_BPY_PYTHON`` albo bieżący Python, jeśli
ma ``bpy``. Bez Blendera etap 1 jest pomijany — wtedy potrzebne są wcześniej wygenerowane rendery.
"""

from __future__ import annotations

import argparse
import importlib
import os
import re
import subprocess
import sys
import time
import traceback
from concurrent.futures import ProcessPoolExecutor
from pathlib import Path

TU = Path(__file__).resolve().parent
sys.path.insert(0, str(TU))
sys.path.insert(0, str(TU.parent))

import katalog  # noqa: E402

MODULY = ["gen_marka", "gen_napisy", "gen_ui", "gen_fx", "gen_tla", "gen_s1", "gen_s2", "gen_s3", "gen_okladki"]
# kolejność ma znaczenie: okładki i banery składają się z gotowych symboli i logotypów
POZNIEJ = {"s1_okladka", "s1_baner", "s2_okladka", "s2_baner", "s3_okladka", "s3_baner", "s2_wild_rozszerzony"}


def generatory() -> dict:
    wynik = {}
    for nazwa in MODULY:
        try:
            mod = importlib.import_module(nazwa)
        except ModuleNotFoundError as e:
            if e.name == nazwa:
                continue
            raise
        wynik.update(mod.GENERATORY)
    return wynik


def znajdz_bpy(arg: str | None) -> str | None:
    for kand in (arg, os.environ.get("KASYNO_BPY_PYTHON")):
        if kand and Path(kand).exists():
            return kand
    try:
        import bpy  # noqa: F401
        return sys.executable
    except ImportError:
        return None


def etap_blendera(python_bpy: str, od_nowa: bool, tylko: str | None) -> None:
    cmd = [python_bpy, str(TU / "blender" / "render.py")]
    if od_nowa:
        cmd.append("--od-nowa")
    if tylko:
        cmd += ["--tylko", tylko]
    print("Etap 1 — Blender:", " ".join(cmd), flush=True)
    t = time.time()
    # wypisujemy postęp na bieżąco (render jednego modelu trwa kilka–kilkadziesiąt sekund)
    proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, bufsize=1)
    ogon = []
    for linia in proc.stdout:
        ogon = (ogon + [linia])[-60:]
        # komunikaty Cycles (bufor stdio w C) mogą wpaść w środek linii — szukamy wzorca, nie początku linii
        for m in re.finditer(r"RENDER \S+: [\d.]+ s", linia):
            print("  " + m.group(0), flush=True)
    if proc.wait() != 0:
        print("".join(ogon))
        raise SystemExit("Etap Blendera zakończony błędem")
    print(f"  rendery gotowe ({time.time() - t:.0f} s)")


def _jeden(id_: str) -> tuple[str, str, float]:
    """Generuje jeden asset (w osobnym procesie) i zapisuje PNG."""
    import numpy as np
    import biblioteka as B
    t = time.time()
    a = katalog.PO_ID[id_]
    try:
        obraz = generatory()[id_]()
        w, h = a.wymiary_zrodla
        if obraz.shape[1] != w or obraz.shape[0] != h:
            raise ValueError(f"zły rozmiar {obraz.shape[1]}×{obraz.shape[0]}, oczekiwano {w}×{h}")
        if a.tlo != "ALFA":
            obraz = obraz.copy()
            obraz[..., 3] = 1.0                       # CZARNE i PELNE nie mają przezroczystości
        B.zapisz(np.clip(obraz, 0, 1), B.ZASTEPCZE / a.pakiet / f"{id_}.png")
        return id_, "ok", time.time() - t
    except Exception:
        return id_, traceback.format_exc(), time.time() - t


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description="Grafika zastępcza Cebulion Casino (85 assetów).")
    ap.add_argument("--tylko", help="ID albo pakiety (global, s1, s2, s3) rozdzielone przecinkami")
    ap.add_argument("--bpy", help="interpreter Pythona z modułem bpy (Blender)")
    ap.add_argument("--od-nowa", action="store_true", help="renderuj w Blenderze także istniejące rendery")
    ap.add_argument("--bez-blendera", action="store_true", help="pomiń etap Blendera (użyj istniejących renderów)")
    ap.add_argument("--rendery", help="w etapie Blendera tylko te rendery (nazwy z blender/modele*.py)")
    ap.add_argument("--watki", type=int, default=min(4, os.cpu_count() or 1))
    ap.add_argument("--przetworz", action="store_true", help="na końcu uruchom tools/art/przetworz.py")
    arg = ap.parse_args(argv)

    if not arg.bez_blendera:
        py = znajdz_bpy(arg.bpy)
        if py:
            etap_blendera(py, arg.od_nowa, arg.rendery)
        else:
            print("UWAGA: nie znaleziono Pythona z modułem bpy — pomijam etap Blendera "
                  "(pip install bpy albo --bpy <ścieżka>)")

    gen = generatory()
    wzorce = [w.strip() for w in arg.tylko.split(",")] if arg.tylko else None
    wybrane = [a.id for a in katalog.wybierz(wzorce)]
    brak = [i for i in wybrane if i not in gen]
    if brak:
        print(f"UWAGA: brak generatora dla {len(brak)} ID: {', '.join(brak)}")
    teraz = [i for i in wybrane if i in gen and i not in POZNIEJ]
    potem = [i for i in wybrane if i in gen and i in POZNIEJ]
    print(f"Etap 2 — Pillow/NumPy: {len(teraz) + len(potem)} obrazów ({arg.watki} proc.)", flush=True)
    t0 = time.time()
    bledy = 0
    for partia in (teraz, potem):
        if not partia:
            continue
        if arg.watki > 1:
            with ProcessPoolExecutor(arg.watki) as pula:
                wyniki = list(pula.map(_jeden, partia))
        else:
            wyniki = [_jeden(i) for i in partia]
        for id_, stan, czas in wyniki:
            if stan == "ok":
                print(f"  {id_:<24} {czas:5.1f} s")
            else:
                bledy += 1
                print(f"  {id_:<24} BŁĄD\n{stan}")
    print(f"Gotowe: {len(teraz) + len(potem) - bledy} obrazów w art/zastepcze/ ({time.time() - t0:.0f} s), błędy: {bledy}")
    if arg.przetworz and not bledy:
        kod = subprocess.call([sys.executable, str(TU.parent / "przetworz.py")] +
                              (["--tylko", arg.tylko] if arg.tylko else []))
        return kod
    return 1 if bledy else 0


if __name__ == "__main__":
    sys.exit(main())
