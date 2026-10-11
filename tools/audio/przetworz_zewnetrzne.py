#!/usr/bin/env python3
"""
przetworz_zewnetrzne.py — podmiana dźwięku syntezowanego na plik zewnętrzny (muzyka z Suno/Udio, efekt CC0).

Jak to działa (doc 05 § 8.8 i § 11.3):
  1. Plik trafia do tools/audio/zrodla/<ID>.<rozszerzenie> (albo audio/zrodla/ — oba katalogi są sprawdzane).
     Plik o nazwie = ID ma pierwszeństwo nad przepisem syntezy. Usunięcie pliku = powrót do syntezy.
  2. Dekodowanie ffmpeg do 48 kHz float.
  3. Muzyka / pętle: pomiar tempa (autokorelacja obwiedni uderzeń), wybór fragmentu N taktów od kreski
     taktowej w części o stałej energii, dopasowanie szwu (korelacja ±20 ms), przenikanie o stałej mocy
     50 ms wypalone w pliku → długość pliku = dokładnie N taktów, pętla bez trzasku.
     Efekty jednorazowe: przycięcie ciszy.
  4. Ten sam mastering, eksport (Opus + AAC), manifest i kontrole co przy syntezie (generuj_wszystko.py).
  5. Wpis do LICENCJE.md (obowiązkowy — kontrola A14).

Przykłady:
    python3 tools/audio/przetworz_zewnetrzne.py mus_s2 ~/Pobrane/skarbiec.mp3 --serwis "Suno (Pro)" \\
            --licencja "Suno Pro — prawa komercyjne" --autor "właściciel projektu"
    python3 tools/audio/przetworz_zewnetrzne.py mus_s2 ~/Pobrane/skarbiec.mp3 --start 12.0   # ręczny start pętli
    python3 tools/audio/przetworz_zewnetrzne.py --usun mus_s2                               # wróć do syntezy
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
import shutil
import subprocess
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))

import dsp  # noqa: E402
import katalog  # noqa: E402
import petle  # noqa: E402
from dsp import SR  # noqa: E402

PLIK_LICENCJI = "LICENCJE.md"
NAGLOWEK_LICENCJI = (
    "# Licencje plików zewnętrznych (audio)\n\n"
    "Każdy plik w tym katalogu musi mieć tu wiersz (kontrola A14 w tools/audio/sprawdz.py).\n\n"
    "| ID | Plik źródłowy | Autor | Źródło / serwis | Licencja | Sprawdzono | Zmiany |\n"
    "|---|---|---|---|---|---|---|\n"
)


def wczytaj(sciezka: Path, kanaly: int = 2) -> np.ndarray:
    """Dowolny format obsługiwany przez ffmpeg → float 48 kHz."""
    wynik = subprocess.run(["ffmpeg", "-hide_banner", "-nostdin", "-loglevel", "error", "-i", str(sciezka),
                            "-f", "f32le", "-ac", str(kanaly), "-ar", str(SR), "-"], capture_output=True, check=True)
    x = np.frombuffer(wynik.stdout, dtype="<f4").astype(np.float64)
    return x if kanaly == 1 else x.reshape(-1, kanaly).T


def przygotuj(sciezka: Path, przepis: dict, start_s: float | None = None) -> tuple[np.ndarray, dict]:
    """Plik zewnętrzny → sygnał gotowy do masteringu + pola nadpisujące manifest (np. zmierzone bpm).
    Wywoływane przez generuj_wszystko.py dla każdego ID, który ma plik w zrodla/."""
    kanaly = 2 if przepis["stereo"] else 1
    x = wczytaj(sciezka, 2)
    meta = przepis.get("meta", {})
    ustawienia = sciezka.with_suffix(".json")            # opcjonalnie: {"start_s": 12.0} zapisane przez --start
    if start_s is None and ustawienia.is_file():
        start_s = json.loads(ustawienia.read_text(encoding="utf-8")).get("start_s")
    nadpisz: dict = {}
    if przepis["loop"]:
        bpm = meta.get("bpm")
        okres = przepis.get("okres", przepis["dlugosc"])
        if bpm:
            metrum = meta.get("beatsPerBar", 4)
            takty = int(round(okres / (metrum * 60.0 / bpm)))
            zmierzone, pewnosc = petle.zmierz_tempo(x, bpm)
            if abs(zmierzone - bpm) / bpm > 0.004 and pewnosc > 0.1:
                print(f"  {sciezka.name}: zmierzone tempo {zmierzone:.2f} BPM (zamówione {bpm}) — używam zmierzonego")
                bpm = round(zmierzone, 3)
                nadpisz["bpm"] = bpm
            y, info = petle.wytnij_petle(x, bpm, takty, metrum, start_s=start_s)
        else:
            # pętla bez tempa (np. warstwa efektu): długość z przepisu, szew jak wyżej (1 „takt” = cała pętla)
            y, info = petle.wytnij_petle(x, 60.0 / okres * 4, 1, 4, start_s=start_s)
        print(f"  {sciezka.name}: start {info['start_s']:.3f} s, korekta szwu {info['korekta_szwu_ms']:+.1f} ms, "
              f"korelacja {info['korelacja_szwu']:.3f}, szew: {info['szew']}")
    else:
        y = petle.przytnij_cisze(x)
    return (dsp.mono(y) if kanaly == 1 else y), nadpisz


def dopisz_licencje(katalog_zrodel: Path, id_: str, plik: str, autor: str, serwis: str, licencja: str) -> None:
    sciezka = katalog_zrodel / PLIK_LICENCJI
    if not sciezka.exists():
        sciezka.write_text(NAGLOWEK_LICENCJI, encoding="utf-8")
    dzis = dt.date.today().isoformat()
    with sciezka.open("a", encoding="utf-8") as f:
        f.write(f"| {id_} | {plik} | {autor} | {serwis} | {licencja} | {dzis} | pętla/przycięcie, normalizacja, "
                f"kodowanie (tools/audio) |\n")


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("id", help="ID dźwięku z briefu § 10 (np. mus_s2)")
    ap.add_argument("plik", nargs="?", help="plik zewnętrzny (WAV, FLAC, MP3, M4A…)")
    ap.add_argument("--start", type=float, default=None, help="ręczny początek pętli w sekundach (kreska taktowa)")
    ap.add_argument("--autor", default="(uzupełnić)")
    ap.add_argument("--serwis", default="(uzupełnić: serwis / adres strony pliku, plan konta)")
    ap.add_argument("--licencja", default="(uzupełnić)")
    ap.add_argument("--zrodla", default=str(katalog.KATALOG_NARZEDZI / "zrodla"), help="katalog plików źródłowych")
    ap.add_argument("--usun", action="store_true", help="usuń plik źródłowy ID (powrót do syntezy)")
    a = ap.parse_args(argv)
    if a.id not in katalog.WYMAGANE_ID:
        print(f"BŁĄD: {a.id} nie jest ID z briefu § 10")
        return 2
    kat = Path(a.zrodla)
    kat.mkdir(parents=True, exist_ok=True)
    if a.usun:
        for p in kat.glob(f"{a.id}.*"):
            p.unlink()
            print("usunięto", p)
    elif a.plik:
        zrodlo = Path(a.plik).expanduser()
        if not zrodlo.is_file():
            print("BŁĄD: nie ma pliku", zrodlo)
            return 2
        for p in kat.glob(f"{a.id}.*"):
            p.unlink()
        cel = kat / f"{a.id}{zrodlo.suffix.lower()}"
        if zrodlo.resolve() != cel.resolve():
            shutil.copyfile(zrodlo, cel)
        if a.start is not None:
            (kat / f"{a.id}.json").write_text(json.dumps({"start_s": a.start}) + "\n", encoding="utf-8")
        dopisz_licencje(kat, a.id, zrodlo.name, a.autor, a.serwis, a.licencja)
        print(f"skopiowano → {cel} (wpis w {kat / PLIK_LICENCJI} — uzupełnij dane licencji, jeśli brakuje)")
    import generuj_wszystko
    return generuj_wszystko.main(["--tylko", a.id])


if __name__ == "__main__":
    sys.exit(main())
