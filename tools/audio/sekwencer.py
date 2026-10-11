"""
sekwencer.py — sekwencer nut dla muzyki: tempo i siatka taktów, skale, akordy, rytmy zapisane tekstem,
ścieżki (stemy) z własną obróbką, zawijanie do pętli i miks.

Utwór opisujemy danymi (akordy, rytmy, melodie), a nie kodem nuta po nucie — akordy i rytmy z doc 05 § 4.3
widać w kodzie muzyka.py jeden do jednego.

Kluczowa zasada pętli: długość = całkowita liczba taktów (np. 16 taktów × 4 miary × 0,6 s = 38,4 s =
1 843 200 próbek). Nuty wstawiamy do bufora dłuższego o „ogon”, a na końcu wszystko, co wystaje poza
koniec pętli, zawijamy na jej początek (ogony pogłosu i wybrzmień ostatniego taktu brzmią w pierwszym).
Wszystkie efekty po zawinięciu liczymy kołowo (okresowy=True), więc wynik jest okresowy co do próbki.
"""

from __future__ import annotations

import numpy as np

import dsp
from dsp import SR, hz, n_probek

SKALE = {
    "dur": [0, 2, 4, 5, 7, 9, 11],
    "mol": [0, 2, 3, 5, 7, 8, 10],
    "pentatonika_dur": [0, 2, 4, 7, 9],
    "pentatonika_mol": [0, 3, 5, 7, 10],
    "hidzaz": [0, 1, 4, 5, 7, 8, 10],          # frygijska dominantowa: D E♭ F♯ G A B♭ C
    "lidyjska": [0, 2, 4, 6, 7, 9, 11],        # E F♯ G♯ A♯ B C♯ D♯
}


def skala(tonika: str, nazwa: str, oktawy: int = 2) -> list[float]:
    """Dźwięki skali od toniki (np. skala('D4', 'hidzaz')) jako numery MIDI, przez kilka oktaw."""
    baza = dsp.midi(tonika)
    return [baza + 12 * o + s for o in range(oktawy) for s in SKALE[nazwa]]


def nuty(tekst: str) -> list[float]:
    """'C4 E4 G4' → lista częstotliwości w Hz."""
    return [hz(n) for n in tekst.split()]


def rytm(wzor: str, krok: float = 0.5) -> list[tuple[float, str]]:
    """Rytm zapisany tekstem: każdy znak to jeden krok (w miarach), '.' = pauza, inne znaki = uderzenie
    (litera określa rodzaj, np. maqsum 'DT.TD.T.'). Zwraca [(pozycja_w_miarach, znak), …]."""
    wzor = wzor.replace(" ", "")
    return [(i * krok, z) for i, z in enumerate(wzor) if z != "."]


class Utwor:
    """Bufor utworu z siatką taktów i ścieżkami (stemami) stereo."""

    def __init__(self, id_: str, bpm: float, takty: int, metrum: int = 4, ogon: float = 7.0, ziarno: int = 0):
        self.id = id_
        self.bpm = bpm
        self.takty = takty
        self.metrum = metrum
        self.miara = 60.0 / bpm                       # długość miary (ćwierćnuty) w sekundach
        self.takt_s = self.miara * metrum
        dl = takty * self.takt_s
        self.L = n_probek(dl)
        if abs(self.L - dl * SR) > 1e-6:
            raise ValueError(f"{id_}: pętla {dl} s nie jest całkowitą liczbą próbek")
        self.n = self.L + n_probek(ogon)
        self.sciezki: dict[str, np.ndarray] = {}
        self.rng = np.random.default_rng(ziarno)

    @property
    def dlugosc(self) -> float:
        return self.L / SR

    def pozycja(self, takt: int, miara: float = 0.0) -> float:
        """Czas (s) od początku pętli: takt numerowany od 1, miara od 0 (ułamki dozwolone)."""
        return ((takt - 1) * self.metrum + miara) * self.miara

    def czas_miar(self, miary: float) -> float:
        return miary * self.miara

    def sciezka(self, nazwa: str) -> np.ndarray:
        if nazwa not in self.sciezki:
            self.sciezki[nazwa] = np.zeros((2, self.n))
        return self.sciezki[nazwa]

    def dodaj(self, nazwa: str, sygnal, takt: int = 1, miara: float = 0.0, wzm_db: float = 0.0, pan=0.0,
              przesuniecie_s: float = 0.0):
        """Wstawia sygnał (mono → panorama, stereo bez zmian) na ścieżkę w podanym miejscu siatki."""
        sig = np.asarray(sygnal, dtype=float) * dsp.db(wzm_db)
        if sig.ndim == 1:
            sig = dsp.panorama(sig, pan)
        start = n_probek(self.pozycja(takt, miara) + przesuniecie_s) % self.L
        dsp.wstaw(self.sciezka(nazwa), sig, int(start))

    def human(self, ms: float = 6.0) -> float:
        """Drobne, deterministyczne przesunięcie w czasie (s) — „ludzki” groove bez mechanicznej sztywności."""
        return float(self.rng.normal(0.0, ms / 1000.0 / 2))

    def zawin(self, nazwa: str) -> np.ndarray:
        """Ścieżka zawinięta do długości pętli (okresowa)."""
        x = self.sciezka(nazwa)
        wynik = np.zeros((2, self.L))
        for s in range(0, x.shape[-1], self.L):
            kaw = x[:, s:s + self.L]
            wynik[:, :kaw.shape[-1]] += kaw
        return wynik

    def lfo(self, hz_cel: float, faza: float = 0.0) -> np.ndarray:
        """Sinusoidalne LFO o całkowitej liczbie cykli na pętlę (szew bez skoku fazy modulacji)."""
        f = dsp.lfo_okresowe(hz_cel, self.dlugosc)
        t = np.arange(self.L) / SR
        return np.sin(dsp.DWA_PI * (f * t + faza))

    def pompowanie(self, glebokosc_db: float = 4.0, miary=(0, 1, 2, 3), atak: float = 0.005,
                   powrot: float = None) -> np.ndarray:
        """Obwiednia „pompowania” (sidechain) zsynchronizowana ze stopą: na każdą miarę z listy ściszenie
        o glebokosc_db z szybkim powrotem — bas i pad „oddychają” w rytmie stopy. Wpisana w syntezę,
        bo znamy pozycje stóp z góry (okresowa z definicji)."""
        powrot = powrot or self.miara * 0.6
        t = np.arange(self.L) / SR
        w_takcie = (t % self.takt_s) / self.miara
        g = np.ones(self.L)
        for m in miary:
            od = w_takcie - m
            od = np.where(od < 0, od + self.metrum, od) * self.miara
            krzywa = 1.0 - (1.0 - dsp.db(-glebokosc_db)) * np.exp(-od / (powrot / 3)) * np.clip(od / atak, 0, 1)
            g = np.minimum(g, krzywa)
        return g

    def miks(self, sciezki: dict[str, np.ndarray]) -> np.ndarray:
        """Suma przygotowanych (już zawiniętych i obrobionych) ścieżek."""
        wynik = np.zeros((2, self.L))
        for x in sciezki.values():
            wynik += dsp.stereo(x)
        return wynik
