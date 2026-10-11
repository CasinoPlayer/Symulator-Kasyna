"""
eksport.py — kodowanie ffmpeg (Opus w WebM, AAC w M4A), dekodowanie do kontroli, pomiar EBU R128 przez
ffmpeg i budowa assets/audio/manifest.json (kontrakt 09 § 3 + rozszerzenia z doc 05 § 7.5).

Flagi -map_metadata -1 -fflags +bitexact -flags:a +bitexact usuwają metadane i numer wersji kodera:
ten sam WAV daje te same bajty, więc ``git diff`` pokazuje tylko dźwięki, które naprawdę się zmieniły.
"""

from __future__ import annotations

import hashlib
import json
import re
import subprocess
from pathlib import Path

import numpy as np

from dsp import SR

BITRATE = {  # (Opus, AAC) w kb/s — doc 05 § 7.1
    1: (64, 96),
    2: (96, 128),
}
WSPOLNE = ["-map_metadata", "-1", "-fflags", "+bitexact", "-flags:a", "+bitexact"]


def _ffmpeg(argumenty: list[str], wejscie: bytes | None = None) -> subprocess.CompletedProcess:
    return subprocess.run(["ffmpeg", "-y", "-hide_banner", "-nostdin", "-loglevel", "error", *argumenty],
                          input=wejscie, capture_output=True, check=True)


def koduj(wav: Path, katalog: Path, id_: str, kanaly: int) -> tuple[Path, Path]:
    """WAV → <ID>.webm (Opus VBR) i <ID>.m4a (AAC-LC)."""
    opus, aac = BITRATE[kanaly]
    webm = katalog / f"{id_}.webm"
    m4a = katalog / f"{id_}.m4a"
    katalog.mkdir(parents=True, exist_ok=True)
    _ffmpeg(["-i", str(wav), "-c:a", "libopus", "-b:a", f"{opus}k", "-vbr", "on", "-compression_level", "10",
             "-application", "audio", "-frame_duration", "20", *WSPOLNE, str(webm)])
    _ffmpeg(["-i", str(wav), "-c:a", "aac", "-b:a", f"{aac}k", "-movflags", "+faststart", *WSPOLNE, str(m4a)])
    return webm, m4a


def dekoduj(plik: Path, kanaly: int) -> np.ndarray:
    """Plik audio → float (mono (n,) albo stereo (2, n)) w 48 kHz — tak, jak zdekoduje go przeglądarka."""
    wynik = subprocess.run(["ffmpeg", "-hide_banner", "-nostdin", "-loglevel", "error", "-i", str(plik),
                            "-f", "f32le", "-ac", str(kanaly), "-ar", str(SR), "-"], capture_output=True, check=True)
    x = np.frombuffer(wynik.stdout, dtype="<f4").astype(np.float64)
    return x if kanaly == 1 else x.reshape(-1, kanaly).T


def ebur128(plik: Path) -> dict:
    """Pomiar ffmpeg (filtr ebur128, szczyt prawdziwy): {'I': LUFS, 'TP': dBTP} — niezależna kontrola."""
    wynik = subprocess.run(["ffmpeg", "-hide_banner", "-nostdin", "-nostats", "-i", str(plik), "-af",
                            "ebur128=peak=true", "-f", "null", "-"], capture_output=True, text=True)
    tekst = wynik.stderr[wynik.stderr.rfind("Summary:"):]
    m_i = re.search(r"I:\s+(-?[\d.]+|-inf)\s+LUFS", tekst)
    m_tp = re.search(r"Peak:\s+(-?[\d.]+|-inf)\s+dBFS", tekst)
    zamien = lambda m: float("-inf") if (not m or m.group(1) == "-inf") else float(m.group(1))  # noqa: E731
    return {"I": zamien(m_i), "TP": zamien(m_tp)}


def skrot_plikow(pliki: list[Path]) -> str:
    """Wersja manifestu = skrót zawartości wszystkich plików (zmienia się tylko, gdy zmienił się dźwięk)."""
    h = hashlib.sha256()
    for p in sorted(pliki, key=lambda q: q.name):
        h.update(p.name.encode())
        h.update(p.read_bytes())
    return h.hexdigest()[:12]


def zapisz_manifest(sciezka: Path, wpisy: dict, katalog_audio: Path) -> dict:
    """Zapisuje manifest.json: {"version", "sounds": {ID: {...}}}; kolejność ID jak w briefie."""
    pliki = []
    for w in wpisy.values():
        pliki += [katalog_audio / w["webm"], katalog_audio / w["m4a"]]
    dane = {"version": skrot_plikow([p for p in pliki if p.exists()]), "sounds": wpisy}
    sciezka.write_text(json.dumps(dane, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return dane
