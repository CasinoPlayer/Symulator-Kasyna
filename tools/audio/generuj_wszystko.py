#!/usr/bin/env python3
"""
generuj_wszystko.py — pipeline dźwięku Cebulion Casino: synteza → pętle → mastering → WAV 48 kHz →
ffmpeg (Opus/WebM + AAC/M4A) → kontrola szczytu po dekodowaniu → manifest.json → raport jakości.

    tools/audio/dzwieki.py, muzyka.py (przepisy)      tools/audio/zrodla/<ID>.* albo audio/zrodla/<ID>.*
                         │                                       (Suno, CC0 — mają pierwszeństwo)
                         ▼                                                  │
               render NumPy (float64, 48 kHz) ◀─────── przetworz_zewnetrzne.py (dekodowanie, pętla)
                         ▼
               mastering.py (HP, normalizacja, limiter) → tools/audio/build/wav/<ID>.wav (24 bit)
                         ▼
               eksport.py: ffmpeg → src/main/resources/static/assets/audio/<ID>.webm, <ID>.m4a
                         ▼
               manifest.json + sprawdz.py (raport: tools/audio/build/raport.md)

Przykłady:
    python3 tools/audio/generuj_wszystko.py                          # wszystkie 67 ID
    python3 tools/audio/generuj_wszystko.py --tylko sfx_wild mus_s2  # wybrane ID (reszta manifestu zostaje)
    python3 tools/audio/generuj_wszystko.py --tylko sfx_moneta       # prefiks: wszystkie warianty monet
    python3 tools/audio/generuj_wszystko.py --bez-kodowania          # tylko WAV do odsłuchu
    python3 tools/audio/generuj_wszystko.py --zakladki               # pętle z zakładkami (silnik z loopStart/loopEnd)

Kody wyjścia: 0 — w porządku, 1 — ostrzeżenia kontroli, 2 — błędy.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
import zlib
from concurrent.futures import ProcessPoolExecutor, as_completed
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))

import analiza  # noqa: E402
import dsp  # noqa: E402
import eksport  # noqa: E402
import katalog  # noqa: E402
import mastering  # noqa: E402
import petle  # noqa: E402
from dsp import SR  # noqa: E402

ZAKLADKA_SFX = 0.1          # doc 05 § 7.3 (tylko z --zakladki)
ZAKLADKA_MUZYKA = 0.25
POLA_META = ("group", "maxVoices", "cooldownMs", "pitchCents", "gainJitterDb", "keyTrack", "syncPoint", "bpm",
             "beatsPerBar")
ROZSZERZENIA_ZRODEL = (".wav", ".flac", ".mp3", ".m4a", ".ogg", ".opus", ".webm", ".aif", ".aiff")


def znajdz_zrodlo(id_: str, katalogi) -> Path | None:
    """Plik zewnętrzny o nazwie = ID (ma pierwszeństwo nad syntezą, jak art/zrodla w pipeline obrazów)."""
    for k in katalogi:
        for roz in ROZSZERZENIA_ZRODEL:
            p = Path(k) / f"{id_}{roz}"
            if p.is_file():
                return p
    return None


def _master(x, przepis, sufit):
    if przepis["rodzaj"] == "muzyka":
        if przepis.get("meta", {}).get("bpm"):
            return mastering.master_muzyka(x, sufit)
        return mastering.master_napiecie(x, sufit)
    if przepis["loop"]:
        return mastering.master_petla_sfx(x, sufit)
    return mastering.master_jednorazowy(x, sufit, wyjscie_ms=przepis["meta"].get("wyjscie_ms", 5.0))


_PRZEPISY_PROCESU: dict | None = None


def przetworz(id_: str, ust: dict) -> dict:
    """Pełna obróbka jednego ID (wywoływana w osobnym procesie; przepis bierzemy z rejestru po ID,
    bo funkcji z fabryk przepisów nie da się przekazać między procesami)."""
    global _PRZEPISY_PROCESU
    if _PRZEPISY_PROCESU is None:
        _PRZEPISY_PROCESU = katalog.wszystkie_przepisy()
    przepis = _PRZEPISY_PROCESU[id_]
    t0 = time.time()
    kanaly = 2 if przepis["stereo"] else 1
    zrodlo = znajdz_zrodlo(id_, ust["zrodla"])
    nadpisz = {}
    if zrodlo:
        import przetworz_zewnetrzne
        x, nadpisz = przetworz_zewnetrzne.przygotuj(zrodlo, przepis)
        source = "zrodla"
    else:
        rng = np.random.default_rng(zlib.crc32(id_.encode()))
        x = przepis["funkcja"](rng)
        source = "synteza"
    x = np.asarray(x, dtype=float)
    x = dsp.stereo(x) if kanaly == 2 else dsp.mono(x)
    if not np.all(np.isfinite(x)):
        raise ValueError(f"{id_}: NaN/inf w sygnale")
    if przepis["loop"] and source == "synteza":
        oczekiwane = dsp.n_probek(przepis.get("okres", przepis["dlugosc"]))
        if x.shape[-1] != oczekiwane:
            raise ValueError(f"{id_}: pętla ma {x.shape[-1]} próbek, oczekiwano {oczekiwane}")
    wav = Path(ust["wav"]) / f"{id_}.wav"
    sufit = mastering.CEL_DBTP if not przepis["loop"] else mastering.CEL_DBTP - 0.2
    proby = []
    loop_start, loop_end = 0.0, None
    for proba in range(6):
        y = _master(x, przepis, sufit)
        if przepis["loop"] and ust["zakladki"]:
            z = ZAKLADKA_MUZYKA if przepis["rodzaj"] == "muzyka" else ZAKLADKA_SFX
            y, loop_start, loop_end = petle.dodaj_zakladki(y, z)
        dsp.zapisz_wav(wav, y)
        if ust["bez_kodowania"]:
            break
        webm, m4a = eksport.koduj(wav, Path(ust["wyj"]), id_, kanaly)
        tp_w = analiza.dbtp(eksport.dekoduj(webm, kanaly))
        tp_m = analiza.dbtp(eksport.dekoduj(m4a, kanaly))
        proby.append((round(sufit, 2), round(tp_w, 2), round(tp_m, 2)))
        nad = max(tp_w, tp_m) - mastering.CEL_DBTP
        if nad <= 0.0:
            break
        sufit -= nad + 0.08          # szczyt po kodowaniu za wysoko → niższy sufit i ponowne kodowanie
    dur = y.shape[-1] / SR
    wpis = {"webm": f"{id_}.webm", "m4a": f"{id_}.m4a", "loop": bool(przepis["loop"]), "duration": round(dur, 4),
            "bus": przepis["bus"], "channels": kanaly, "gainDb": przepis["gainDb"]}
    if przepis["rodzaj"] != "muzyka":
        wpis["priority"] = przepis["priority"]
    meta = dict(przepis.get("meta", {}))
    meta.update({k: v for k, v in nadpisz.items() if k in POLA_META})
    for k in POLA_META:
        if meta.get(k):
            wpis[k] = meta[k]
    if przepis["loop"]:
        wpis["loopStart"] = round(loop_start, 4)
        wpis["loopEnd"] = round(loop_end if loop_end is not None else dur, 4)
    wpis["pack"] = przepis["packs"][0]
    wpis["packs"] = przepis["packs"]
    wpis["source"] = source
    return {"id": id_, "wpis": wpis, "czas": time.time() - t0, "proby": proby, "zrodlo": str(zrodlo or "")}


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--tylko", nargs="*", help="ID albo prefiksy ID do wygenerowania")
    ap.add_argument("--bez-kodowania", action="store_true", help="tylko WAV (bez ffmpeg i manifestu)")
    ap.add_argument("--zakladki", action="store_true", help="pętle z zakładkami (loopStart/loopEnd ≠ 0/duration)")
    ap.add_argument("--wav", default=str(katalog.KATALOG_BUDOWY / "wav"), help="katalog plików pośrednich WAV")
    ap.add_argument("--wyj", default=str(katalog.KATALOG_AUDIO), help="katalog wynikowy assets/audio")
    ap.add_argument("-j", "--procesy", type=int, default=min(4, os.cpu_count() or 1))
    ap.add_argument("--bez-sprawdzania", action="store_true", help="pomiń raport sprawdz.py")
    a = ap.parse_args(argv)

    przepisy = katalog.wszystkie_przepisy()
    brak = [i for i in katalog.WYMAGANE_ID if i not in przepisy]
    if brak:
        print("BŁĄD: brak przepisów dla:", ", ".join(brak))
        return 2
    ids = list(przepisy)
    if a.tylko:
        ids = [i for i in ids if any(i == t or i.startswith(t) for t in a.tylko)]
        if not ids:
            print("Nic nie pasuje do --tylko", a.tylko)
            return 2
    ust = {"wav": a.wav, "wyj": a.wyj, "bez_kodowania": a.bez_kodowania, "zakladki": a.zakladki,
           "zrodla": [str(k) for k in katalog.KATALOGI_ZRODEL]}
    Path(a.wav).mkdir(parents=True, exist_ok=True)
    # najdłuższe (muzyka) najpierw — lepsze rozłożenie pracy na procesy
    kolejnosc = sorted(ids, key=lambda i: -przepisy[i]["dlugosc"] * (20 if przepisy[i]["rodzaj"] == "muzyka" else 1))
    print(f"Generuję {len(ids)} ID ({a.procesy} procesy)…")
    t0 = time.time()
    wyniki = {}
    with ProcessPoolExecutor(max_workers=a.procesy) as pula:
        zadania = {pula.submit(przetworz, i, ust): i for i in kolejnosc}
        for z in as_completed(zadania):
            i = zadania[z]
            r = z.result()
            wyniki[i] = r
            proby = " ".join(f"[sufit {s} → webm {w} / m4a {m} dBTP]" for s, w, m in r["proby"])
            print(f"  {i:28s} {r['wpis']['duration']:7.3f} s  {r['czas']:5.1f} s  {r['wpis']['source']}  {proby}")
    print(f"Gotowe w {time.time() - t0:.1f} s")
    if a.bez_kodowania:
        return 0
    sciezka_manifestu = Path(a.wyj) / "manifest.json"
    stare = {}
    if sciezka_manifestu.exists() and a.tylko:
        stare = json.loads(sciezka_manifestu.read_text(encoding="utf-8")).get("sounds", {})
    wpisy = {}
    for i in katalog.WYMAGANE_ID + [i for i in przepisy if i not in katalog.WYMAGANE_ID]:
        if i in wyniki:
            wpisy[i] = wyniki[i]["wpis"]
        elif i in stare:
            wpisy[i] = stare[i]
    dane = eksport.zapisz_manifest(sciezka_manifestu, wpisy, Path(a.wyj))
    print(f"manifest.json: {len(dane['sounds'])} dźwięków, wersja {dane['version']}")
    if a.bez_sprawdzania:
        return 0
    import sprawdz
    return sprawdz.main(["--wav", a.wav, "--katalog", a.wyj])


if __name__ == "__main__":
    sys.exit(main())
