"""
petle.py — bezszwowe pętle (doc 05 § 7.3, § 11.3).

Pętle z syntezy są okresowe z definicji: ogony wystające poza koniec zawijamy na początek (sekwencer),
a efekty liczymy kołowo. Ten moduł:
  * sprawdza okresowość i jakość szwu (analiza.szew_petli),
  * opcjonalnie dokleja zakładki (koniec pętli przed nią i początek za nią) dla silnika z loopStart/loopEnd,
  * wycina pętlę z pliku zewnętrznego (Suno): pomiar tempa, wybór fragmentu o stałej energii od kreski taktowej,
    dopasowanie szwu korelacją i przenikanie o stałej mocy „wypalone” w pliku.
"""

from __future__ import annotations

import numpy as np

import analiza
import dsp
from dsp import SR, n_probek


def dodaj_zakladki(x: np.ndarray, zakladka_s: float) -> tuple[np.ndarray, float, float]:
    """[koniec pętli] + pętla + [początek pętli]. Zwraca (sygnał, loopStart_s, loopEnd_s)."""
    z = n_probek(zakladka_s)
    if z <= 0:
        return x, 0.0, x.shape[-1] / SR
    L = x.shape[-1]
    y = np.concatenate([x[..., L - z:], x, x[..., :z]], axis=-1)
    return y, z / SR, (z + L) / SR


# ------------------------------------------------------------------------------------------------
# Pliki zewnętrzne (Suno / Udio): wycięcie pętli
# ------------------------------------------------------------------------------------------------
def obwiednia_uderzen(x: np.ndarray, krok: int = 256) -> tuple[np.ndarray, float]:
    """Funkcja „nowości” (onset strength): dodatni przyrost energii w pasmach STFT. Zwraca (wartości, fs)."""
    s = dsp.mono(x)
    nfft = 1024
    ramki = (len(s) - nfft) // krok
    if ramki < 8:
        return np.zeros(1), SR / krok
    idx = np.arange(nfft)[None, :] + krok * np.arange(ramki)[:, None]
    S = np.log1p(100 * np.abs(np.fft.rfft(s[idx] * np.hanning(nfft), axis=1)))
    nowosc = np.maximum(np.diff(S, axis=0), 0).sum(axis=1)
    nowosc -= np.convolve(nowosc, np.ones(16) / 16, mode="same")
    return np.maximum(nowosc, 0), SR / krok


def zmierz_tempo(x: np.ndarray, bpm_oczekiwane: float | None = None, zakres=(60, 180)) -> tuple[float, float]:
    """Tempo z autokorelacji obwiedni uderzeń. Zwraca (bpm, pewność 0…1). Jeśli podano oczekiwane tempo,
    szukamy w jego okolicy (±8%) i uwzględniamy wielokrotności (pół/dwa razy)."""
    o, fs = obwiednia_uderzen(x)
    if len(o) < 64:
        return float(bpm_oczekiwane or 0), 0.0
    o = o - o.mean()
    n = len(o)
    ac = np.fft.irfft(np.abs(np.fft.rfft(o, 2 * n)) ** 2)[:n]
    ac /= ac[0] + 1e-12
    if bpm_oczekiwane:
        kandydaci = [bpm_oczekiwane * k for k in (0.5, 1.0, 2.0)]
        najlepszy, wart = bpm_oczekiwane, -1.0
        for c in kandydaci:
            for bpm in np.linspace(c * 0.92, c * 1.08, 161):
                lag = 60.0 / bpm * fs
                i0 = int(lag)
                if i0 + 1 >= n:
                    continue
                v = ac[i0] + (lag - i0) * (ac[i0 + 1] - ac[i0])
                if v > wart:
                    najlepszy, wart = bpm * bpm_oczekiwane / c, v
        return float(najlepszy), float(max(0.0, wart))
    lagi = np.arange(int(60.0 / zakres[1] * fs), int(60.0 / zakres[0] * fs))
    i = lagi[np.argmax(ac[lagi])]
    return float(60.0 * fs / i), float(max(0.0, ac[i]))


def wytnij_petle(x: np.ndarray, bpm: float, takty: int, metrum: int = 4, start_s: float | None = None,
                 przenikanie_s: float = 0.05, szukaj_ms: float = 20.0) -> tuple[np.ndarray, dict]:
    """Wycina z nagrania pętlę o długości ``takty`` taktów (doc 05 § 11.3).

    1) Fragment: od kreski taktowej po wstępie, w części o najbardziej stałej energii (gdy start_s nie podano).
    2) Szew: wokół końca (±szukaj_ms) szukamy przesunięcia, przy którym 100 ms przed końcem najbardziej
       przypomina 100 ms przed początkiem (korelacja) — to naturalne miejsce zszycia.
    3) Przenikanie o stałej mocy (sin/cos) ``przenikanie_s``: końcówka pętli przechodzi w materiał sprzed
       jej początku, więc koniec → początek łączy się bez skoku. Długość pliku = dokładnie N taktów."""
    x = dsp.stereo(x)
    takt = metrum * 60.0 / bpm
    L = n_probek(takty * takt)
    n = x.shape[-1]
    if n < L + n_probek(1.0):
        raise ValueError(f"nagranie za krótkie: {n / SR:.1f} s, pętla potrzebuje {L / SR:.1f} s + zapas")
    info = {}
    if start_s is None:
        # kandydaci: kolejne kreski taktowe od 2. taktu; kryterium: stałość głośności krótkoterminowej
        krok = n_probek(takt)
        okno = n_probek(0.4)
        e = np.convolve(dsp.mono(x) ** 2, np.ones(okno) / okno, mode="same")
        e_db = 10 * np.log10(e[::krok // 4] + 1e-12)
        najlepszy, ocena = krok, np.inf
        pp = przenikanie_s
        for s0 in range(krok, n - L - n_probek(pp) - 1, krok):
            a, b = s0 // (krok // 4), (s0 + L) // (krok // 4)
            fr = e_db[a:b]
            if len(fr) < 4:
                continue
            o = np.std(fr) + 0.5 * max(0.0, np.median(e_db) - np.median(fr))
            if o < ocena:
                najlepszy, ocena = s0, o
        s0 = najlepszy
    else:
        s0 = n_probek(start_s)
    # dopasowanie szwu: przesunięcie końca o ±szukaj_ms
    w = n_probek(0.1)
    ref = dsp.mono(x[:, max(0, s0 - w):s0])
    najlepsze_d, najlepsza_k = 0, -np.inf
    zakres = n_probek(szukaj_ms / 1000.0)
    for d in range(-zakres, zakres + 1, 4):
        e_ = s0 + L + d
        if e_ - w < 0 or e_ > n:
            continue
        kand = dsp.mono(x[:, e_ - w:e_])
        k = float(np.dot(ref, kand) / (np.linalg.norm(ref) * np.linalg.norm(kand) + 1e-12))
        if k > najlepsza_k:
            najlepsza_k, najlepsze_d = k, d
    # pętla = [s0, s0+L+d) przepróbkowana do dokładnie L próbek (d jest rzędu ms → zmiana tempa < 0,1%)
    kawalek = x[:, s0:s0 + L + najlepsze_d]
    if najlepsze_d:
        pos = np.linspace(0, kawalek.shape[-1] - 1, L)
        kawalek = np.vstack([np.interp(pos, np.arange(kawalek.shape[-1]), k) for k in kawalek])
    # przenikanie o stałej mocy: koniec pętli → materiał sprzed początku (ciągłość szwu)
    p = n_probek(przenikanie_s)
    przed = x[:, s0 - p:s0] if s0 >= p else np.zeros((2, p))
    u = np.linspace(0, 1, p)
    kawalek = kawalek.copy()
    kawalek[:, L - p:] = kawalek[:, L - p:] * np.cos(u * np.pi / 2) + przed * np.sin(u * np.pi / 2)
    info.update(start_s=s0 / SR, korekta_szwu_ms=najlepsze_d / SR * 1000, korelacja_szwu=najlepsza_k,
                szew=analiza.szew_petli(kawalek))
    return kawalek, info


def przytnij_cisze(x: np.ndarray, prog_db: float = -60.0) -> np.ndarray:
    """Usuwa ciszę z początku i końca (efekty jednorazowe z plików zewnętrznych)."""
    m = np.abs(dsp.mono(x))
    prog = dsp.db(prog_db) * (m.max() + 1e-12)
    nz = np.nonzero(m > prog)[0]
    if not len(nz):
        return x
    a = max(0, nz[0] - n_probek(0.002))
    b = min(len(m), nz[-1] + n_probek(0.05))
    return x[..., a:b]
