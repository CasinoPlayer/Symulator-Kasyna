"""
dsp.py — prymitywy syntezy dźwięku Cebulion Casino (Python 3 + NumPy, bez SciPy).

Konwencje:
  * częstotliwość próbkowania SR = 48 000 Hz w całym pipeline (Opus pracuje wewnętrznie tylko w 48 kHz),
  * sygnał mono = tablica kształtu (n,), stereo = (2, n), próbki float64 w zakresie mniej więcej −1…1,
  * czasy w sekundach, częstotliwości w Hz, poziomy w dB, wysokości w centach (100 c = półton),
  * każda funkcja losowa przyjmuje ``rng`` (np.random.Generator) — render jest deterministyczny.

Zawartość (opis „do obrony” jest w tools/audio/README.md):
  czas i nuty · obwiednie (ADSR, zanik, punkty) · oscylatory (sinus, piła/kwadrat/trójkąt z tablic falowych
  bez aliasingu, PWM, supersaw, FM) · szumy (biały, różowy, brązowy) · filtry (biquad RBJ przez FFT, filtr
  zmiennych stanu SVF przestrajany w czasie, filtr STFT dla przemiatań i formantów) · efekty (pogłos splotowy
  z generowaną odpowiedzią impulsową, echo/ping-pong, chorus, nasycenie, redukcja bitów) · dynamika (kompresor,
  limiter z wyprzedzeniem na szczyt prawdziwy) · stereo (panorama stałej mocy, szerokość M/S) · zapis WAV 24 bit.
"""

from __future__ import annotations

import functools
import re
import wave
from pathlib import Path

import numpy as np

SR = 48_000
DWA_PI = 2.0 * np.pi


# ================================================================================================
# Czas, poziomy, nuty
# ================================================================================================
def n_probek(sekundy: float) -> int:
    """Liczba próbek odpowiadająca czasowi (zaokrąglenie do najbliższej próbki)."""
    return max(0, int(round(float(sekundy) * SR)))


def czas(dlugosc) -> np.ndarray:
    """Oś czasu w sekundach: 0, 1/SR, 2/SR, … (argument: sekundy jako float albo liczba próbek jako int)."""
    n = dlugosc if isinstance(dlugosc, (int, np.integer)) else n_probek(dlugosc)
    return np.arange(n) / SR


def db(wartosc_db) -> float | np.ndarray:
    """Decybele → współczynnik liniowy (−6 dB ≈ 0,5)."""
    return 10.0 ** (np.asarray(wartosc_db, dtype=float) / 20.0)


def na_db(x, minimum=-200.0) -> float:
    """Współczynnik liniowy → decybele (z dolnym ograniczeniem zamiast −inf)."""
    return float(max(minimum, 20.0 * np.log10(max(float(x), 1e-12))))


_NUTY = {"C": 0, "D": 2, "E": 4, "F": 5, "G": 7, "A": 9, "B": 11, "H": 11}
_WZOR_NUTY = re.compile(r"^([A-Ha-h])([#♯b♭]*)(-?\d+)$")


def midi(nuta) -> float:
    """Nazwa nuty (np. 'C#4', 'Eb5', 'A4') albo numer MIDI → numer MIDI (A4 = 69)."""
    if isinstance(nuta, (int, float, np.integer, np.floating)):
        return float(nuta)
    m = _WZOR_NUTY.match(str(nuta).strip())
    if not m:
        raise ValueError(f"nieznana nuta: {nuta!r}")
    litera, znaki, oktawa = m.groups()
    przes = sum(1 if z in "#♯" else -1 for z in znaki)
    return 12 * (int(oktawa) + 1) + _NUTY[litera.upper()] + przes


def hz(nuta) -> float:
    """Nazwa nuty → częstotliwość w Hz (strój równomiernie temperowany, A4 = 440 Hz). Liczba > 127 = już Hz."""
    if isinstance(nuta, (float, np.floating)) and nuta > 127:
        return float(nuta)
    return 440.0 * 2.0 ** ((midi(nuta) - 69.0) / 12.0)


def centy(f, c):
    """Przesunięcie częstotliwości o c centów."""
    return np.asarray(f, dtype=float) * 2.0 ** (np.asarray(c, dtype=float) / 1200.0)


# ================================================================================================
# Pomocnicze: mono/stereo, wstawianie, miks
# ================================================================================================
def stereo(x: np.ndarray) -> np.ndarray:
    """Mono (n,) → stereo (2, n); stereo zostaje bez zmian."""
    x = np.asarray(x, dtype=float)
    return np.vstack([x, x]) if x.ndim == 1 else x


def mono(x: np.ndarray) -> np.ndarray:
    """Stereo → mono (średnia kanałów); mono zostaje bez zmian."""
    x = np.asarray(x, dtype=float)
    return x.mean(axis=0) if x.ndim == 2 else x


def dlugosc_sygnalu(x) -> int:
    return np.asarray(x).shape[-1]


def dopasuj(x: np.ndarray, n: int) -> np.ndarray:
    """Przycina albo dopełnia ciszą do n próbek (ostatnia oś)."""
    x = np.asarray(x, dtype=float)
    m = x.shape[-1]
    if m == n:
        return x
    if m > n:
        return x[..., :n]
    pad = [(0, 0)] * (x.ndim - 1) + [(0, n - m)]
    return np.pad(x, pad)


def wstaw(cel: np.ndarray, sygnal: np.ndarray, start, wzm: float = 1.0, zawijaj: bool = False) -> None:
    """Dodaje ``sygnal`` do bufora ``cel`` od pozycji ``start`` (sekundy jako float albo próbki jako int).

    zawijaj=True: to, co wystaje poza koniec, trafia na początek (pętle — § 7.3 dokumentu 05).
    Mono wstawione do stereo trafia do obu kanałów.
    """
    s = start if isinstance(start, (int, np.integer)) else n_probek(start)
    sig = np.asarray(sygnal, dtype=float) * wzm
    if cel.ndim == 2 and sig.ndim == 1:
        sig = np.vstack([sig, sig])
    if cel.ndim == 1 and sig.ndim == 2:
        sig = sig.mean(axis=0)
    n = cel.shape[-1]
    m = sig.shape[-1]
    if zawijaj:
        s %= n
        pozycja = 0
        while pozycja < m:
            kawalek = min(m - pozycja, n - s)
            cel[..., s:s + kawalek] += sig[..., pozycja:pozycja + kawalek]
            pozycja += kawalek
            s = 0
        return
    if s >= n or s + m <= 0:
        return
    a = max(0, -s)
    b = min(m, n - s)
    cel[..., s + a:s + b] += sig[..., a:b]


def miks(*warstwy) -> np.ndarray:
    """Suma warstw różnej długości; jeśli którakolwiek jest stereo, wynik jest stereo."""
    warstwy = [np.asarray(w, dtype=float) for w in warstwy if w is not None]
    n = max(w.shape[-1] for w in warstwy)
    czy_stereo = any(w.ndim == 2 for w in warstwy)
    wynik = np.zeros((2, n) if czy_stereo else n)
    for w in warstwy:
        wstaw(wynik, w, 0)
    return wynik


def przesun(x: np.ndarray, sekundy: float) -> np.ndarray:
    """Opóźnia sygnał o podany czas (dopisuje ciszę na początku)."""
    n = n_probek(sekundy)
    pad = [(0, 0)] * (np.asarray(x).ndim - 1) + [(n, 0)]
    return np.pad(np.asarray(x, dtype=float), pad)


def odwroc(x: np.ndarray) -> np.ndarray:
    """Odwrócenie w czasie (np. „odwrócony pogłos” — zasysające narastanie)."""
    return np.asarray(x, dtype=float)[..., ::-1].copy()


# ================================================================================================
# Obwiednie
# ================================================================================================
def zanik(t: np.ndarray, tau: float) -> np.ndarray:
    """Obwiednia wykładnicza: po czasie tau głośność spada do 37% (−8,7 dB), po 3·tau do 5%."""
    return np.exp(-np.asarray(t) / max(tau, 1e-6))


def atak_zanik(dlugosc, atak=0.002, tau=0.2, krzywa_ataku=1.0) -> np.ndarray:
    """Najczęstsza obwiednia perkusyjna: krótki atak (bez trzasku), potem zanik wykładniczy."""
    t = czas(dlugosc)
    a = np.clip(t / max(atak, 1e-6), 0, 1) ** krzywa_ataku
    return a * np.exp(-np.maximum(t - atak, 0) / max(tau, 1e-6))


def adsr(dlugosc, a=0.01, d=0.1, s=0.7, r=0.2, gate=None) -> np.ndarray:
    """Obwiednia ADSR: atak (liniowo), zanik wykładniczy do poziomu s, podtrzymanie do ``gate``,
    wybrzmienie wykładnicze (do −60 dB po czasie r). Bez skoków wartości — brak trzasków."""
    n = dlugosc if isinstance(dlugosc, (int, np.integer)) else n_probek(dlugosc)
    t = np.arange(n) / SR
    gate = (n / SR - r) if gate is None else gate
    gate = max(gate, 0.0)
    env = np.where(t < a, t / max(a, 1e-6), s + (1 - s) * np.exp(-(t - a) / max(d / 3, 1e-6)))
    poziom_gate = (gate / max(a, 1e-6)) if gate < a else s + (1 - s) * np.exp(-(gate - a) / max(d / 3, 1e-6))
    wybrzmienie = poziom_gate * np.exp(-6.9 * (t - gate) / max(r, 1e-6))
    return np.where(t < gate, env, wybrzmienie)


def obwiednia(punkty, dlugosc, krzywa: str = "lin") -> np.ndarray:
    """Obwiednia z punktów [(t, wartość), …]; krzywa 'lin' (liniowa) albo 'exp' (liniowa w dB/log)."""
    t = czas(dlugosc)
    tp = np.array([p[0] for p in punkty], dtype=float)
    vp = np.array([p[1] for p in punkty], dtype=float)
    if krzywa == "exp":
        return np.exp(np.interp(t, tp, np.log(np.maximum(vp, 1e-9))))
    return np.interp(t, tp, vp)


def przemiatanie(f0, f1, dlugosc, t_zmiany=None, krzywa="exp", t_start=0.0) -> np.ndarray:
    """Krzywa częstotliwości f0 → f1 (wykładniczo albo liniowo) w czasie t_zmiany, potem stała."""
    t = czas(dlugosc)
    t_zmiany = dlugosc if t_zmiany is None else t_zmiany
    u = np.clip((t - t_start) / max(t_zmiany, 1e-6), 0, 1)
    if krzywa == "exp":
        return f0 * (f1 / f0) ** u
    return f0 + (f1 - f0) * u


def wycisz(x: np.ndarray, wejscie=0.002, wyjscie=0.005) -> np.ndarray:
    """Krótkie wejście i wyjście (rampa sin²) — usuwa trzaski na początku i końcu pliku."""
    x = np.array(x, dtype=float)
    n = x.shape[-1]
    nw, ny = min(n, n_probek(wejscie)), min(n, n_probek(wyjscie))
    if nw > 1:
        x[..., :nw] *= np.sin(np.linspace(0, np.pi / 2, nw)) ** 2
    if ny > 1:
        x[..., n - ny:] *= np.cos(np.linspace(0, np.pi / 2, ny)) ** 2
    return x


# ================================================================================================
# Oscylatory
# ================================================================================================
def faza(f, n: int, faza0: float = 0.0) -> np.ndarray:
    """Faza w cyklach (nie radianach) dla stałej albo zmiennej częstotliwości: całka f dt.

    Całkowanie zamiast sin(2π·f(t)·t) daje glissanda i wibrata bez skoków fazy (bez trzasków)."""
    f = np.asarray(f, dtype=float)
    if f.ndim == 0:
        return faza0 + np.arange(n) * (float(f) / SR)
    f = np.broadcast_to(f, (n,))
    ph = np.empty(n)
    ph[0] = 0.0
    np.cumsum(f[:-1] / SR, out=ph[1:])
    return ph + faza0


def sinus(f, dlugosc, faza0: float = 0.0) -> np.ndarray:
    """Sinus o stałej albo zmiennej częstotliwości (f może być tablicą długości sygnału)."""
    n = dlugosc if isinstance(dlugosc, (int, np.integer)) else n_probek(dlugosc)
    return np.sin(DWA_PI * faza(f, n, faza0))


# --- tablice falowe z ograniczonym pasmem (bez aliasingu) ---------------------------------------
_N_TAB = 4096
_POZIOMY = 27.5 * 2.0 ** (np.arange(0, 21) / 2.0)   # 27,5 Hz … 28 160 Hz co pół oktawy


@functools.lru_cache(maxsize=256)
def _tabela(ksztalt: str, poziom: int) -> np.ndarray:
    """Jeden okres fali złożony tylko z harmonicznych, które dla najwyższej częstotliwości poziomu
    mieszczą się poniżej ~20 kHz. Dzięki temu odczyt tablicy nigdy nie tworzy aliasingu."""
    f_gora = _POZIOMY[poziom]
    harm = int(min(_N_TAB // 2 - 1, max(1, 20_000 // f_gora)))
    h = np.arange(1, harm + 1)
    widmo = np.zeros(_N_TAB // 2 + 1, dtype=complex)
    if ksztalt == "pila":            # opadająca piła 1 → −1: Σ sin(hx)/h
        amp = 2.0 / (np.pi * h)
    elif ksztalt == "trojkat":       # tylko nieparzyste, 1/h², naprzemienne znaki
        amp = np.where(h % 2 == 1, 8.0 / (np.pi ** 2 * h ** 2) * (-1.0) ** ((h - 1) // 2), 0.0)
    else:
        raise ValueError(ksztalt)
    widmo[1:harm + 1] = -1j * amp * _N_TAB / 2.0
    tab = np.fft.irfft(widmo, _N_TAB)
    return np.append(tab, tab[0])    # dodatkowa próbka do interpolacji na końcu okresu


def _czytaj_tabele(ksztalt: str, ph: np.ndarray, f_max: float) -> np.ndarray:
    poziom = int(np.searchsorted(_POZIOMY, max(f_max, 1.0)))
    poziom = min(poziom, len(_POZIOMY) - 1)
    tab = _tabela(ksztalt, poziom)
    idx = (ph % 1.0) * _N_TAB
    i0 = idx.astype(np.int64)
    frac = idx - i0
    return tab[i0] * (1.0 - frac) + tab[i0 + 1] * frac


def pila(f, dlugosc, faza0: float = 0.0) -> np.ndarray:
    """Piła z ograniczonym pasmem (tablica falowa wybrana według najwyższej częstotliwości)."""
    n = dlugosc if isinstance(dlugosc, (int, np.integer)) else n_probek(dlugosc)
    return _czytaj_tabele("pila", faza(f, n, faza0), float(np.max(f)))


def trojkat(f, dlugosc, faza0: float = 0.0) -> np.ndarray:
    n = dlugosc if isinstance(dlugosc, (int, np.integer)) else n_probek(dlugosc)
    return _czytaj_tabele("trojkat", faza(f, n, faza0), float(np.max(f)))


def kwadrat(f, dlugosc, pw=0.5, faza0: float = 0.0) -> np.ndarray:
    """Fala prostokątna o wypełnieniu pw (może być tablicą → PWM) jako różnica dwóch pił
    przesuniętych w fazie o pw — obie bez aliasingu, więc wynik też."""
    n = dlugosc if isinstance(dlugosc, (int, np.integer)) else n_probek(dlugosc)
    ph = faza(f, n, faza0)
    fm = float(np.max(f))
    pw = np.asarray(pw, dtype=float)
    # obie piły mają średnią 0, więc różnica też (wartości 2·pw i 2·pw − 2) — bez korekty składowej stałej
    return _czytaj_tabele("pila", ph, fm) - _czytaj_tabele("pila", ph + pw, fm)


def supersaw(f, dlugosc, glosy: int = 7, rozstrojenie_c: float = 15.0, rng=None,
             szerokosc: float = 0.8, miks_srodka: float = 0.55) -> np.ndarray:
    """Supersaw: ``glosy`` pił odstrojonych symetrycznie o ±rozstrojenie_c centów, z losową fazą,
    rozłożonych w panoramie (szerokość 0…1). Zwraca stereo (2, n), znormalizowane do ~±1."""
    n = dlugosc if isinstance(dlugosc, (int, np.integer)) else n_probek(dlugosc)
    rng = rng or np.random.default_rng(1)
    rozklad = np.linspace(-1.0, 1.0, glosy)
    rozklad = np.sign(rozklad) * np.abs(rozklad) ** 1.3          # gęściej przy środku (jak JP-8000)
    wynik = np.zeros((2, n))
    for i, r in enumerate(rozklad):
        g = miks_srodka if abs(r) < 1e-9 else (1.0 - miks_srodka) * 2.0 / max(1, glosy - 1)
        sig = pila(centy(f, r * rozstrojenie_c), n, faza0=rng.random())
        p = r * szerokosc
        wynik += panorama(sig * g, p)
    return wynik * 1.6


def fm(fc, dlugosc, stosunek=2.0, indeks=1.0, f_mod=None, faza_mod=0.0) -> np.ndarray:
    """Synteza FM (modulacja fazy): sin(2π·fc·t + I(t)·sin(2π·fm·t)), fm = fc·stosunek.

    Stosunek całkowity (1, 2) → widmo harmoniczne („złoto”, ciepły dzwon, piano elektryczne);
    niecałkowity (3,5; 2,76) → nieharmoniczne parcjały („szkło”, kryształ, czynele)."""
    n = dlugosc if isinstance(dlugosc, (int, np.integer)) else n_probek(dlugosc)
    pc = faza(fc, n)
    pm = faza(np.asarray(fc, dtype=float) * stosunek if f_mod is None else f_mod, n, faza_mod)
    return np.sin(DWA_PI * pc + np.asarray(indeks) * np.sin(DWA_PI * pm))


def dzwon_fm(f, dlugosc, r=2.0, i0=2.5, i1=0.0, tau=0.6, tau_i=None, atak=0.0015) -> np.ndarray:
    """Dzwon FM: indeks modulacji maleje od i0 do i1 (stała tau_i), amplituda zanika (tau).
    Jasny atak, łagodniejące wybrzmienie — jak w prawdziwym dzwonie, gdzie wysokie parcjały gasną pierwsze."""
    t = czas(dlugosc)
    tau_i = tau / 2.0 if tau_i is None else tau_i
    indeks = i1 + (i0 - i1) * np.exp(-t / max(tau_i, 1e-6))
    env = np.clip(t / max(atak, 1e-6), 0, 1) * np.exp(-t / max(tau, 1e-6))
    return env * fm(f, len(t), stosunek=r, indeks=indeks)


def parcjaly(f0, stosunki, taus, dlugosc, amplitudy=None, rng=None, atak=0.0008, rozstrojenie_hz=0.0,
             fazy_losowe=True) -> np.ndarray:
    """Synteza addytywna / modalna: suma sinusów f0·stosunek_i z własnym zanikiem tau_i.

    Tak drgają przedmioty (moneta, gong, szkło): każdy „mod” drga niezależnie i gaśnie we własnym tempie.
    rozstrojenie_hz > 0: każdy parcjał jako para sinusów odstrojonych o ±… Hz → naturalne dudnienia."""
    t = czas(dlugosc)
    rng = rng or np.random.default_rng(0)
    amplitudy = np.ones(len(stosunki)) if amplitudy is None else np.asarray(amplitudy, dtype=float)
    wynik = np.zeros(len(t))
    for s, tau, a in zip(stosunki, taus, amplitudy):
        f = f0 * s
        if f >= 0.47 * SR:
            continue
        ph = rng.random() if fazy_losowe else 0.0
        if rozstrojenie_hz:
            d = rozstrojenie_hz * (0.5 + rng.random())
            sig = 0.5 * (np.sin(DWA_PI * ((f - d / 2) * t + ph)) + np.sin(DWA_PI * ((f + d / 2) * t + ph * 1.7)))
        else:
            sig = np.sin(DWA_PI * (f * t + ph))
        wynik += a * sig * np.exp(-t / tau)
    env = np.clip(t / max(atak, 1e-6), 0, 1)
    return wynik * env


def karplus_strong(f, dlugosc, jasnosc=0.5, wybrzmienie=0.996, rng=None, pobudzenie=None) -> np.ndarray:
    """Szarpana struna Karplusa–Stronga: bufor szumu krąży w pętli opóźnienia, a uśrednianie sąsiednich
    próbek (filtr dolnoprzepustowy) z każdym obiegiem przyciemnia dźwięk — jak drgająca struna.

    Okres ma całkowitą liczbę próbek, więc dokładny strój uzyskujemy przepróbkowaniem wyniku."""
    rng = rng or np.random.default_rng(0)
    okres = max(4, int(SR / f))
    a = float(np.clip(jasnosc, 0.0, 1.0))
    f_rzecz = SR / (okres + (1.0 - a))            # uśrednianie dokłada (1 − a) próbki opóźnienia
    stosunek = f / f_rzecz
    n_cel = n_probek(dlugosc)
    n_gen = int(n_cel * stosunek) + okres + 2
    obiegi = int(np.ceil(n_gen / okres))
    y = np.empty((obiegi, okres))
    y[0] = rng.uniform(-1, 1, okres) if pobudzenie is None else dopasuj(pobudzenie, okres)
    y[0] -= y[0].mean()
    for k in range(1, obiegi):
        p = y[k - 1]
        y[k] = wybrzmienie * (a * p + (1.0 - a) * np.roll(p, 1))   # y[n] = a·y[n−N] + (1−a)·y[n−N−1]
    surowy = y.ravel()
    # przepróbkowanie: odczyt z prędkością `stosunek` → dokładna częstotliwość f
    pozycje = np.arange(n_cel) * stosunek
    return np.interp(pozycje, np.arange(len(surowy)), surowy)


# ================================================================================================
# Szumy
# ================================================================================================
def szum(dlugosc, rng, kolor: str = "bialy") -> np.ndarray:
    """Szum biały (płaskie widmo), różowy (−3 dB/okt.) albo brązowy (−6 dB/okt.), RMS = 1.

    Różowy i brązowy kształtujemy w dziedzinie częstotliwości (FFT): amplituda ∝ 1/√f albo 1/f."""
    n = dlugosc if isinstance(dlugosc, (int, np.integer)) else n_probek(dlugosc)
    x = rng.standard_normal(n)
    if kolor == "bialy" or n < 4:
        return x
    X = np.fft.rfft(x)
    f = np.fft.rfftfreq(n, 1.0 / SR)
    f[0] = f[1] if len(f) > 1 else 1.0
    f = np.maximum(f, 10.0)
    X *= (1.0 / np.sqrt(f)) if kolor == "rozowy" else (1.0 / f)
    y = np.fft.irfft(X, n)
    return y / (np.std(y) + 1e-12)


# ================================================================================================
# Filtry
# ================================================================================================
def _rozmiar_fft(n: int) -> int:
    """Najmniejsza liczba ≥ n postaci 2^a·3^b·5^c (szybkie FFT)."""
    najlepszy = 1 << (int(n) - 1).bit_length()
    p5 = 1
    while p5 < najlepszy:
        p35 = p5
        while p35 < najlepszy:
            q = p35
            while q < n:
                q *= 2
            najlepszy = min(najlepszy, q)
            p35 *= 3
        p5 *= 5
    return najlepszy


def biquad(typ: str, fc: float, q: float = 0.7071, wzm_db: float = 0.0):
    """Współczynniki filtru bikwadratowego (R. Bristow-Johnson, „Audio EQ Cookbook”).

    typ: 'lp', 'hp', 'bp' (0 dB w szczycie), 'notch', 'peak', 'lowshelf', 'highshelf'."""
    fc = float(np.clip(fc, 5.0, 0.49 * SR))
    w0 = DWA_PI * fc / SR
    cw, sw = np.cos(w0), np.sin(w0)
    alfa = sw / (2.0 * q)
    A = 10.0 ** (wzm_db / 40.0)
    if typ == "lp":
        b = [(1 - cw) / 2, 1 - cw, (1 - cw) / 2]; a = [1 + alfa, -2 * cw, 1 - alfa]
    elif typ == "hp":
        b = [(1 + cw) / 2, -(1 + cw), (1 + cw) / 2]; a = [1 + alfa, -2 * cw, 1 - alfa]
    elif typ == "bp":
        b = [alfa, 0.0, -alfa]; a = [1 + alfa, -2 * cw, 1 - alfa]
    elif typ == "notch":
        b = [1.0, -2 * cw, 1.0]; a = [1 + alfa, -2 * cw, 1 - alfa]
    elif typ == "peak":
        b = [1 + alfa * A, -2 * cw, 1 - alfa * A]; a = [1 + alfa / A, -2 * cw, 1 - alfa / A]
    elif typ in ("lowshelf", "highshelf"):
        sq = 2 * np.sqrt(A) * alfa
        if typ == "lowshelf":
            b = [A * ((A + 1) - (A - 1) * cw + sq), 2 * A * ((A - 1) - (A + 1) * cw), A * ((A + 1) - (A - 1) * cw - sq)]
            a = [(A + 1) + (A - 1) * cw + sq, -2 * ((A - 1) + (A + 1) * cw), (A + 1) + (A - 1) * cw - sq]
        else:
            b = [A * ((A + 1) + (A - 1) * cw + sq), -2 * A * ((A - 1) + (A + 1) * cw), A * ((A + 1) + (A - 1) * cw - sq)]
            a = [(A + 1) - (A - 1) * cw + sq, 2 * ((A - 1) - (A + 1) * cw), (A + 1) - (A - 1) * cw - sq]
    else:
        raise ValueError(typ)
    b = np.array(b) / a[0]
    a = np.array(a) / a[0]
    return b, a


def odpowiedz(sekcje, f) -> np.ndarray:
    """Zespolona odpowiedź częstotliwościowa kaskady sekcji [(b, a), …] w punktach f (Hz)."""
    z1 = np.exp(-1j * DWA_PI * np.asarray(f, dtype=float) / SR)
    h = np.ones_like(z1)
    for b, a in sekcje:
        h *= (b[0] + b[1] * z1 + b[2] * z1 ** 2) / (a[0] + a[1] * z1 + a[2] * z1 ** 2)
    return h


def filtruj(x: np.ndarray, sekcje, okresowy: bool = False, ogon: float = 0.6) -> np.ndarray:
    """Filtr IIR o stałych współczynnikach zastosowany przez FFT: widmo sygnału × odpowiedź filtru.

    To dokładnie ten sam filtr przyczynowy co rekurencja próbka po próbce (ta sama faza), tylko liczony
    w dziedzinie częstotliwości, więc w NumPy jest setki razy szybszy niż pętla w Pythonie.
    okresowy=True: splot kołowy (dla pętli — wynik pozostaje okresowy); inaczej sygnał jest dopełniany
    ciszą o ``ogon`` sekund, żeby odpowiedź impulsowa filtru nie zawinęła się na początek."""
    x = np.asarray(x, dtype=float)
    if isinstance(sekcje, tuple) and len(sekcje) == 2 and np.ndim(sekcje[0]) == 1:
        sekcje = [sekcje]
    n = x.shape[-1]
    N = n if okresowy else _rozmiar_fft(n + n_probek(ogon))
    X = np.fft.rfft(x, N, axis=-1)
    H = odpowiedz(sekcje, np.fft.rfftfreq(N, 1.0 / SR))
    return np.fft.irfft(X * H, N, axis=-1)[..., :n]


_BUTTERWORTH_Q = {1: [0.7071], 2: [0.5412, 1.3066], 3: [0.5176, 0.7071, 1.9319]}


def lp(x, fc, q=None, rzad=1, okresowy=False):
    """Dolnoprzepustowy; rzad = liczba sekcji (1 → 12 dB/okt., 2 → 24 dB/okt. Butterwortha)."""
    qs = [q] * rzad if q is not None else _BUTTERWORTH_Q[rzad]
    return filtruj(x, [biquad("lp", fc, qq) for qq in qs], okresowy)


def hp(x, fc, q=None, rzad=1, okresowy=False):
    qs = [q] * rzad if q is not None else _BUTTERWORTH_Q[rzad]
    return filtruj(x, [biquad("hp", fc, qq) for qq in qs], okresowy)


def bp(x, fc, q=1.0, rzad=1, okresowy=False):
    return filtruj(x, [biquad("bp", fc, q)] * rzad, okresowy)


def eq(x, pasma, okresowy=False):
    """Korektor: lista (typ, fc, q, wzm_db), np. [('peak', 3000, 1.0, -3), ('hp', 30, 0.707, 0)]."""
    return filtruj(x, [biquad(t, f, q, g) for t, f, q, g in pasma], okresowy)


def svf(x: np.ndarray, fc, q=0.7071, tryb: str = "lp") -> np.ndarray:
    """Filtr zmiennych stanu (SVF, topologia TPT — Zavalishin) przestrajany w czasie.

    fc może być tablicą (przemiatanie: świsty, narastania, „wah”). Rekurencja próbka po próbce w czystym
    Pythonie na listach — używamy go tylko dla krótkich dźwięków (do kilku sekund), dla długich: filtr_stft.
    tryb 'bp' ma wzmocnienie 1,0 w częstotliwości środkowej."""
    x = np.asarray(x, dtype=float)
    if x.ndim == 2:
        return np.vstack([svf(k, fc, q, tryb) for k in x])
    n = len(x)
    fcs = np.broadcast_to(np.clip(np.asarray(fc, dtype=float), 10.0, 0.45 * SR), (n,))
    g = np.tan(np.pi * fcs / SR)
    k = np.broadcast_to(1.0 / np.asarray(q, dtype=float), (n,))
    a1 = 1.0 / (1.0 + g * (g + k))
    a2 = g * a1
    a3 = g * a2
    xs, A1, A2, A3 = x.tolist(), a1.tolist(), a2.tolist(), a3.tolist()
    v1s = [0.0] * n
    v2s = [0.0] * n
    ic1 = ic2 = 0.0
    for i in range(n):
        v3 = xs[i] - ic2
        v1 = A1[i] * ic1 + A2[i] * v3
        v2 = ic2 + A2[i] * ic1 + A3[i] * v3
        ic1 = 2.0 * v1 - ic1
        ic2 = 2.0 * v2 - ic2
        v1s[i] = v1
        v2s[i] = v2
    v1 = np.array(v1s)
    v2 = np.array(v2s)
    if tryb == "lp":
        return v2
    if tryb == "bp":
        return k * v1
    if tryb == "hp":
        return x - k * v1 - v2
    if tryb == "notch":
        return x - k * v1
    raise ValueError(tryb)


def filtr_stft(x: np.ndarray, modul_widma, okno: int = 1024, krok: int = 256, okresowy: bool = False) -> np.ndarray:
    """Filtr zmienny w czasie w dziedzinie STFT (krótkoczasowa transformata Fouriera).

    Sygnał dzielimy na nakładające się ramki (okno Hanna), każdą mnożymy w widmie przez charakterystykę
    ``modul_widma(t_ramki, f) → |H|`` i składamy z powrotem (overlap-add). Tanie i bez trzasków —
    idealne do przemiatania szumu (whoosh, narastania) i do formantów chóru (płynna zmiana samogłoski).
    modul_widma: funkcja (t: (ramki, 1), f: (1, biny)) → tablica (ramki, biny)."""
    x = np.asarray(x, dtype=float)
    if x.ndim == 2:
        return np.vstack([filtr_stft(k, modul_widma, okno, krok, okresowy) for k in x])
    n = len(x)
    if okresowy:
        sig = np.concatenate([x[-okno:], x, x[:okno]]) if n >= okno else np.tile(x, 3)
        pre = okno if n >= okno else n
    else:
        sig = np.concatenate([np.zeros(okno), x, np.zeros(okno)])
        pre = okno
    ramki = 1 + (len(sig) - okno) // krok
    dl = (ramki - 1) * krok + okno
    sig = dopasuj(sig, dl)
    w = np.sqrt(np.hanning(okno + 1)[:-1])            # √Hann na wejściu i wyjściu → Hann² sumuje się do stałej
    idx = np.arange(okno)[None, :] + krok * np.arange(ramki)[:, None]
    X = np.fft.rfft(sig[idx] * w, axis=1)
    t = ((np.arange(ramki) * krok + okno / 2 - pre) / SR)[:, None]
    f = np.fft.rfftfreq(okno, 1.0 / SR)[None, :]
    Y = np.fft.irfft(X * modul_widma(t, f), okno, axis=1) * w
    wyj = np.zeros(dl)
    norm = np.zeros(dl)
    for r0 in range(okno // krok):                     # overlap-add grupami ramek, które się nie nakładają
        sel = slice(r0, ramki, okno // krok)
        poz = idx[sel].ravel()
        wyj[poz] += Y[sel].ravel()
        norm[poz] += np.tile(w ** 2, len(range(r0, ramki, okno // krok)))
    wyj /= np.maximum(norm, 1e-3)
    return wyj[pre:pre + n]


def modul_biquad(typ: str, fc_t, q: float = 0.7071, wzm_db: float = 0.0):
    """Charakterystyka |H| filtru biquad o częstotliwości zmiennej w czasie — do filtr_stft.

    fc_t: funkcja t → fc (Hz) albo para (czasy, wartości) interpolowana liniowo w skali log."""
    if isinstance(fc_t, tuple):
        tp, fp = np.asarray(fc_t[0], float), np.log(np.asarray(fc_t[1], float))
        fc_t = lambda t, tp=tp, fp=fp: np.exp(np.interp(t, tp, fp))  # noqa: E731

    def modul(t, f):
        fc = np.clip(fc_t(t), 10.0, 0.49 * SR)
        w0 = DWA_PI * fc / SR
        cw, sw = np.cos(w0), np.sin(w0)
        alfa = sw / (2.0 * q)
        z1 = np.exp(-1j * DWA_PI * f / SR)
        den = (1 + alfa) - 2 * cw * z1 + (1 - alfa) * z1 ** 2
        if typ == "lp":
            num = (1 - cw) / 2 * (1 + 2 * z1 + z1 ** 2)
        elif typ == "hp":
            num = (1 + cw) / 2 * (1 - 2 * z1 + z1 ** 2)
        elif typ == "bp":
            num = alfa * (1 - z1 ** 2)
        elif typ == "peak":
            A = 10.0 ** (wzm_db / 40.0)
            num = (1 + alfa * A) - 2 * cw * z1 + (1 - alfa * A) * z1 ** 2
            den = (1 + alfa / A) - 2 * cw * z1 + (1 - alfa / A) * z1 ** 2
        else:
            raise ValueError(typ)
        return np.abs(num / den)

    return modul


def przemiataj(x, typ: str, f0, f1, dlugosc_przemiatania=None, q=0.7071, krzywa="exp", okresowy=False,
               punkty=None):
    """Wygodny filtr przemiatany f0 → f1 (np. szum BP 300 → 3 500 Hz) liczony w STFT."""
    n = dlugosc_sygnalu(x)
    d = (n / SR) if dlugosc_przemiatania is None else dlugosc_przemiatania
    if punkty is not None:
        fc_t = (np.array([p[0] for p in punkty]), np.array([p[1] for p in punkty]))
    elif krzywa == "exp":
        fc_t = lambda t: f0 * (f1 / f0) ** np.clip(t / d, 0, 1)  # noqa: E731
    else:
        fc_t = lambda t: f0 + (f1 - f0) * np.clip(t / d, 0, 1)  # noqa: E731
    return filtr_stft(x, modul_biquad(typ, fc_t, q), okresowy=okresowy)


def formanty(x, sciezki, okresowy: bool = False, okno: int = 2048, krok: int = 512):
    """Filtr formantowy (samogłoski chóru): suma rezonansów o częstotliwościach zmiennych w czasie.

    sciezki: lista (funkcja t → f_środka, szerokość pasma Hz, wzmocnienie liniowe)."""
    def modul(t, f):
        h = np.zeros(np.broadcast_shapes(t.shape, f.shape))
        for fc_t, bw, g in sciezki:
            fc = fc_t(t)
            h += g / (1.0 + ((f - fc) / (bw / 2.0)) ** 2)
        return h
    return filtr_stft(x, modul, okno=okno, krok=krok, okresowy=okresowy)


# ================================================================================================
# Efekty: nasycenie, redukcja bitów, panorama, szerokość, chorus, echo, pogłos
# ================================================================================================
def nasycenie(x, k: float = 2.0, asymetria: float = 0.0):
    """Miękkie obcinanie tanh(k·x)/tanh(k): dodaje harmoniczne (bas słyszalny na telefonie, „brud” dętych).
    asymetria > 0 dodaje parzyste harmoniczne (cieplejsze, „lampowe”)."""
    x = np.asarray(x, dtype=float)
    if asymetria:
        y = np.tanh(k * (x + asymetria)) - np.tanh(k * asymetria)
        return y / np.tanh(k)
    return np.tanh(k * x) / np.tanh(k)


def redukcja_bitow(x, bity: int = 12, fs: float | None = None):
    """Retro: kwantyzacja do ``bity`` bitów i (opcjonalnie) próbkowanie z fs Hz (sample & hold)."""
    x = np.asarray(x, dtype=float)
    if fs:
        krok = SR / fs
        idx = (np.floor(np.arange(x.shape[-1]) / krok) * krok).astype(np.int64)
        x = x[..., idx]
    poziomy = 2 ** (bity - 1)
    return np.round(x * poziomy) / poziomy


def panorama(x, pan=0.0):
    """Mono → stereo z prawem stałej mocy (pan −1 lewo … +1 prawo; może być tablicą — automatyka)."""
    x = np.asarray(x, dtype=float)
    if x.ndim == 2:
        x = x.mean(axis=0)
    kat = (np.clip(np.asarray(pan, dtype=float), -1, 1) + 1.0) * np.pi / 4.0
    return np.vstack([x * np.cos(kat), x * np.sin(kat)]) * np.sqrt(2.0)


def szerokosc(x, w: float = 1.0):
    """Szerokość stereo przez M/S: w = 0 → mono, 1 → bez zmian, > 1 → szerzej."""
    x = stereo(x)
    m = (x[0] + x[1]) / 2
    s = (x[0] - x[1]) / 2 * w
    return np.vstack([m + s, m - s])


def bas_mono(x, fc: float = 150.0, okresowy=False):
    """Pasmo poniżej fc sprowadzone do środka (mono-kompatybilność basu, § 4.1 pkt 7)."""
    x = stereo(x)
    m = (x[0] + x[1]) / 2
    s = (x[0] - x[1]) / 2
    s = hp(s, fc, rzad=2, okresowy=okresowy)
    return np.vstack([m + s, m - s])


def opoznienie_ulamkowe(x, opozn_probki, okresowy=False):
    """Odczyt sygnału z opóźnieniem zmiennym w czasie (interpolacja liniowa) — chorus, flanger, „taśma”."""
    x = np.asarray(x, dtype=float)
    n = len(x)
    pos = np.arange(n) - np.asarray(opozn_probki, dtype=float)
    if okresowy:
        pos = pos % n
        i0 = np.floor(pos).astype(np.int64)
        fr = pos - i0
        return x[i0 % n] * (1 - fr) + x[(i0 + 1) % n] * fr
    return np.interp(pos, np.arange(n), x, left=0.0, right=0.0)


def lfo_okresowe(hz_cel: float, okres_s: float | None) -> float:
    """Częstotliwość modulacji zaokrąglona do całkowitej liczby cykli na długość pętli (szew bez skoku fazy)."""
    if not okres_s:
        return hz_cel
    cykle = max(1, round(hz_cel * okres_s))
    return cykle / okres_s


def chorus(x, czest: float = 0.4, glebokosc_ms: float = 2.5, opozn_ms: float = 14.0, miks_mokry: float = 0.45,
           okresowy=False):
    """Chorus stereo: dwie kopie z opóźnieniem modulowanym wolnym LFO (L i P w przeciwfazie) — „aksamit”."""
    x = stereo(x)
    n = x.shape[-1]
    t = np.arange(n) / SR
    f = lfo_okresowe(czest, n / SR if okresowy else None)
    wyj = np.empty_like(x)
    for k, fz in enumerate((0.0, 0.5)):
        d = (opozn_ms + glebokosc_ms * np.sin(DWA_PI * (f * t + fz))) * SR / 1000.0
        mokry = opoznienie_ulamkowe(x[k], d, okresowy)
        wyj[k] = x[k] * (1 - miks_mokry * 0.5) + mokry * miks_mokry
    return wyj


def echo(x, opoznienie: float, sprzezenie: float = 0.35, miks_mokry: float = 0.3, pingpong: bool = False,
         lp_hz: float | None = 5000.0, okresowy: bool = False, ogon: float = 0.0):
    """Echo (linia opóźniająca ze sprzężeniem). Każde kolejne powtórzenie jest ciszej (×sprzezenie) i
    ciemniej (filtr LP — jak w echu taśmowym). pingpong: powtórzenia na zmianę w lewym i prawym kanale.
    Liczone wektorowo jako suma przesuniętych kopii (bez pętli po próbkach)."""
    x = stereo(x)
    if ogon and not okresowy:
        x = dopasuj(x, x.shape[-1] + n_probek(ogon))
    n = x.shape[-1]
    d = n_probek(opoznienie)
    if d <= 0:
        return x
    mokry = np.zeros_like(x)
    biezacy = (np.vstack([x.mean(axis=0), np.zeros(n)]) if pingpong else x.copy())
    g = 1.0
    for k in range(1, 64):
        if okresowy:
            biezacy = np.roll(biezacy, d, axis=-1)
        else:
            biezacy = np.pad(biezacy, ((0, 0), (d, 0)))[:, :n]
        if lp_hz:
            biezacy = lp(biezacy, lp_hz, okresowy=okresowy)
        if pingpong and k > 1:
            biezacy = biezacy[::-1]
        mokry += g * biezacy
        g *= sprzezenie
        if g < 1e-3 or (not okresowy and k * d >= n):
            break
    return x + miks_mokry * mokry


@functools.lru_cache(maxsize=64)
def ir_poglosu(rt60: float, ziarno: int = 7, predelay: float = 0.0, jasnosc: float = 0.5,
               odbicia_ms: tuple = (), dlugosc: float | None = None) -> np.ndarray:
    """Syntetyczna odpowiedź impulsowa sali (stereo, energia każdego kanału = 1).

    Budowa: niezależny szum w L i P (dekorelacja → szerokość), podzielony na 8 pasm, z których każde gaśnie
    do −60 dB we własnym czasie RT60 (wysokie szybciej — jak powietrze i miękkie ściany), łagodne narastanie
    gęstości w pierwszych ms, wczesne odbicia (kamienne ściany skarbca) i opóźnienie wstępne."""
    rng = np.random.default_rng(ziarno)
    dl = dlugosc or min(rt60 * 1.15, 7.0)
    n = n_probek(dl)
    t = np.arange(n) / SR
    szum_lr = rng.standard_normal((2, n))
    X = np.fft.rfft(szum_lr, axis=-1)
    f = np.fft.rfftfreq(n, 1.0 / SR)
    srodki = np.array([90, 250, 500, 1000, 2000, 4000, 8000, 16000], dtype=float)
    lf = np.log2(np.maximum(f, 20.0))
    ls = np.log2(srodki)
    # współczynnik RT60 dla pasma: bas trochę dłużej, góra krócej (jasnosc 0 = ciemna sala, 1 = jasna)
    mnozniki = np.interp(ls, np.log2([90, 500, 2000, 8000, 16000]),
                         [1.2, 1.05, 0.9, 0.45 + 0.35 * jasnosc, 0.25 + 0.35 * jasnosc])
    ir = np.zeros((2, n))
    for i in range(len(srodki)):
        # trójkątne wagi w skali log (sumują się do 1) — płynne przejścia między pasmami
        lewy = ls[i - 1] if i > 0 else ls[i] - 1
        prawy = ls[i + 1] if i < len(ls) - 1 else ls[i] + 1
        w = np.where(lf < ls[i], (lf - lewy) / (ls[i] - lewy), (prawy - lf) / (prawy - ls[i]))
        w = np.clip(w, 0, 1)
        if i == 0:
            w = np.where(lf < ls[0], 1.0, w)
        if i == len(ls) - 1:
            w = np.where(lf > ls[-1], 1.0, w)
        pasmo = np.fft.irfft(X * w, n, axis=-1)
        ir += pasmo * 10.0 ** (-3.0 * t / (rt60 * mnozniki[i]))
    ir *= 1.0 - np.exp(-t / 0.012)                  # narastanie gęstości odbić
    if odbicia_ms:
        odb = np.zeros((2, n))
        for j, ms in enumerate(odbicia_ms):
            k = n_probek(ms / 1000.0)
            if k < n:
                g = 0.9 * 0.75 ** j
                odb[0, k] += g * (1.0 if j % 2 == 0 else 0.6)
                odb[1, min(n - 1, k + n_probek(0.0007 * (j + 1)))] += g * (0.6 if j % 2 == 0 else 1.0)
        odb = lp(odb, 6000)
        ir = ir / np.sqrt(np.sum(ir ** 2, axis=1, keepdims=True)) + odb * 0.6
    if predelay > 0:
        ir = np.pad(ir, ((0, 0), (n_probek(predelay), 0)))
    return ir / np.sqrt(np.sum(ir ** 2, axis=1, keepdims=True))


def splot(a: np.ndarray, b: np.ndarray, okresowy: bool = False, n_wyj: int | None = None) -> np.ndarray:
    """Splot przez FFT (zamiast scipy.signal.fftconvolve); okresowy=True → splot kołowy o okresie len(a)."""
    n = a.shape[-1]
    if okresowy:
        if b.shape[-1] > n:      # odpowiedź dłuższa niż okres: zawijamy ją (to też jest splot kołowy)
            bb = np.zeros(b.shape[:-1] + (n,))
            for s in range(0, b.shape[-1], n):
                kaw = b[..., s:s + n]
                bb[..., :kaw.shape[-1]] += kaw
            b = bb
        return np.fft.irfft(np.fft.rfft(a, n, axis=-1) * np.fft.rfft(b, n, axis=-1), n, axis=-1)
    m = n + b.shape[-1] - 1
    N = _rozmiar_fft(m)
    y = np.fft.irfft(np.fft.rfft(a, N, axis=-1) * np.fft.rfft(b, N, axis=-1), N, axis=-1)
    return y[..., :(n_wyj or m)]


def poglos(x, rt60: float = 1.5, miks_mokry: float = 0.25, predelay: float = 0.0, jasnosc: float = 0.5,
           odbicia_ms: tuple = (), ziarno: int = 7, okresowy: bool = False, ogon: float = 0.0,
           hp_mokry: float = 150.0) -> np.ndarray:
    """Pogłos splotowy: sygnał splatamy z generowaną odpowiedzią impulsową (ir_poglosu). Zwraca stereo.

    Ścieżka mokra jest filtrowana HP (bez „błota” w basie). ogon > 0 wydłuża wynik o tyle sekund
    (wybrzmienie); okresowy=True — splot kołowy dla pętli (ogon końca pętli wraca na jej początek)."""
    x = stereo(x)
    ir = ir_poglosu(float(rt60), int(ziarno), float(predelay), float(jasnosc), tuple(odbicia_ms))
    if okresowy:
        mokry = splot(x, ir, okresowy=True)
        if hp_mokry:
            mokry = hp(mokry, hp_mokry, okresowy=True)
        return (1.0 - miks_mokry) * x + miks_mokry * mokry
    n = x.shape[-1] + n_probek(ogon)
    mokry = splot(x, ir, n_wyj=n)
    mokry = dopasuj(mokry, n)
    if hp_mokry:
        mokry = hp(mokry, hp_mokry)
    return (1.0 - miks_mokry) * dopasuj(x, n) + miks_mokry * mokry


# ================================================================================================
# Dynamika: kompresor, limiter
# ================================================================================================
def _wygladz_obwiednie(det: np.ndarray, atak_k: float, zwol_k: float) -> np.ndarray:
    """Detektor obwiedni z osobną stałą ataku i zwolnienia (rekurencja na zdecymowanym sygnale)."""
    wyj = [0.0] * len(det)
    e = 0.0
    for i, v in enumerate(det.tolist()):
        e = e + (atak_k if v > e else zwol_k) * (v - e)
        wyj[i] = e
    return np.array(wyj)


def kompresor(x, prog_db: float = -18.0, stosunek: float = 3.0, atak: float = 0.01, zwolnienie: float = 0.15,
              kolano_db: float = 6.0, makeup_db: float = 0.0, okresowy: bool = False, decymacja: int = 16):
    """Kompresor (sprzężenie w przód, kanały połączone). Detektor szczytowy liczony na blokach po
    ``decymacja`` próbek (szybko), krzywa z miękkim kolanem, wzmocnienie interpolowane do pełnej rozdzielczości.
    okresowy=True: przetwarzamy dwie kopie pętli i bierzemy drugą — stan detektora na szwie jest ciągły."""
    x = np.asarray(x, dtype=float)
    n = x.shape[-1]
    xx = np.concatenate([x, x], axis=-1) if okresowy else x
    a = np.abs(xx) if xx.ndim == 1 else np.max(np.abs(xx), axis=0)
    nb = int(np.ceil(len(a) / decymacja))
    a = dopasuj(a, nb * decymacja).reshape(nb, decymacja).max(axis=1)
    fs_b = SR / decymacja
    atak_k = 1.0 - np.exp(-1.0 / (max(atak, 1e-4) * fs_b))
    zwol_k = 1.0 - np.exp(-1.0 / (max(zwolnienie, 1e-4) * fs_b))
    env = _wygladz_obwiednie(a, atak_k, zwol_k)
    lvl = 20 * np.log10(np.maximum(env, 1e-9))
    nad = lvl - prog_db
    # miękkie kolano
    redukcja = np.where(nad <= -kolano_db / 2, 0.0,
                        np.where(nad >= kolano_db / 2, nad * (1 - 1 / stosunek),
                                 (1 - 1 / stosunek) * (nad + kolano_db / 2) ** 2 / (2 * max(kolano_db, 1e-6))))
    g_db = makeup_db - redukcja
    tb = (np.arange(nb) + 0.5) * decymacja
    g = 10 ** (np.interp(np.arange(xx.shape[-1]), tb, g_db) / 20)
    y = xx * g
    return y[..., n:] if okresowy else y


def _szczyt_na_probke(x: np.ndarray, nadprobkowanie: int = 4, blok: int = 1 << 17, zapas: int = 512) -> np.ndarray:
    """Obwiednia szczytu prawdziwego: max |x| po interpolacji ×4 w obrębie każdej próbki (kanały połączone).

    Interpolacja przez FFT liczona blokami z zakładką (stała pamięć także dla 40 s muzyki stereo)."""
    x = stereo(x)
    n = x.shape[-1]
    wynik = np.empty(n)
    for s in range(0, n, blok):
        a, b = max(0, s - zapas), min(n, s + blok + zapas)
        kaw = x[:, a:b]
        m = kaw.shape[-1]
        up = np.fft.irfft(np.fft.rfft(kaw, axis=-1), m * nadprobkowanie, axis=-1) * nadprobkowanie
        pk = np.abs(up).max(axis=0).reshape(m, nadprobkowanie).max(axis=1)
        e = min(n, s + blok)
        wynik[s:e] = pk[s - a:s - a + (e - s)]
    return wynik


def szczyt_prawdziwy(x: np.ndarray) -> float:
    """Szczyt prawdziwy (true peak, interpolacja ×4) jako współczynnik liniowy."""
    return float(_szczyt_na_probke(x).max()) if np.asarray(x).shape[-1] else 0.0


def _min_przesuwne(v: np.ndarray, okno: int) -> np.ndarray:
    """Minimum w oknie [i, i+okno) — przez podwajanie (log2(okno) kroków wektorowych)."""
    wynik = v.copy()
    szer = 1
    while szer < okno:
        krok = min(szer, okno - szer)
        przes = np.concatenate([wynik[krok:], np.full(krok, wynik[-1])])
        wynik = np.minimum(wynik, przes)
        szer += krok
    return wynik


def limiter(x, sufit_db: float = -1.0, wyprzedzenie: float = 0.004, zwolnienie: float = 0.08,
            okresowy: bool = False, decymacja: int = 8) -> np.ndarray:
    """Limiter z wyprzedzeniem (look-ahead) na szczyt prawdziwy.

    1) wymagane wzmocnienie g_req = min(1, sufit / szczyt_prawdziwy) dla każdej próbki,
    2) minimum w oknie wyprzedzenia (redukcja zaczyna się PRZED szczytem),
    3) zwolnienie wykładnicze, 4) średnia krocząca o długości okna (gładki atak bez zniekształceń).
    Średnia z wartości ≤ g_req w całym oknie jest ≤ g_req w szczycie — gwarancja, że sufit nie zostanie
    przekroczony (z dokładnością interpolacji ×4)."""
    x = np.asarray(x, dtype=float)
    n = x.shape[-1]
    # pętla: dwie kopie + początek trzeciej (wyprzedzenie widzi szczyty zza szwu), wynik = druga kopia
    xx = np.concatenate([x, x, x[..., :n_probek(0.2)]], axis=-1) if okresowy else x
    sufit = 10 ** (sufit_db / 20)
    pk = _szczyt_na_probke(xx)
    g_req = np.minimum(1.0, sufit / np.maximum(pk, 1e-9))
    w = max(1, n_probek(wyprzedzenie))
    g1 = _min_przesuwne(g_req, w + 1)
    nb = int(np.ceil(len(g1) / decymacja))
    gb = np.pad(g1, (0, nb * decymacja - len(g1)), constant_values=1.0).reshape(nb, decymacja).min(axis=1)
    rel_k = 1.0 - np.exp(-1.0 / (max(zwolnienie, 1e-4) * SR / decymacja))
    gs = [1.0] * nb
    g = 1.0
    for i, v in enumerate(gb.tolist()):
        g = v if v < g else g + rel_k * (v - g)
        gs[i] = g
    g2 = np.repeat(np.array(gs), decymacja)[:len(g1)]
    g2 = np.minimum(g2, g1)
    c = np.concatenate([[0.0], np.cumsum(g2)])
    idx = np.arange(len(g2))
    lo = np.maximum(0, idx - w)
    g3 = (c[idx + 1] - c[lo]) / (idx + 1 - lo)
    y = xx * g3
    return y[..., n:2 * n] if okresowy else y


# ================================================================================================
# Zapis / odczyt WAV
# ================================================================================================
def zapisz_wav(sciezka, x: np.ndarray, bity: int = 24) -> None:
    """Zapis WAV PCM 16/24 bit (moduł wave z biblioteki standardowej)."""
    x = np.asarray(x, dtype=float)
    kanaly = 1 if x.ndim == 1 else x.shape[0]
    dane = (x if x.ndim == 1 else x.T).reshape(-1)
    dane = np.clip(dane, -1.0, 1.0)
    if bity == 24:
        calk = np.round(dane * (2 ** 23 - 1)).astype("<i4")
        surowe = calk.view(np.uint8).reshape(-1, 4)[:, :3].tobytes()
    elif bity == 16:
        surowe = np.round(dane * 32767).astype("<i2").tobytes()
    else:
        raise ValueError(bity)
    Path(sciezka).parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(sciezka), "wb") as w:
        w.setnchannels(kanaly)
        w.setsampwidth(bity // 8)
        w.setframerate(SR)
        w.writeframes(surowe)


def wczytaj_wav(sciezka) -> np.ndarray:
    """Odczyt WAV PCM 16/24/32 bit → float (mono (n,) albo stereo (2, n))."""
    with wave.open(str(sciezka), "rb") as w:
        k, sw, n = w.getnchannels(), w.getsampwidth(), w.getnframes()
        surowe = w.readframes(n)
    if sw == 3:
        b = np.frombuffer(surowe, dtype=np.uint8).reshape(-1, 3)
        calk = (b[:, 0].astype(np.int32) | (b[:, 1].astype(np.int32) << 8) | (b[:, 2].astype(np.int32) << 16))
        calk = np.where(calk >= 2 ** 23, calk - 2 ** 24, calk)
        dane = calk / (2 ** 23 - 1)
    elif sw == 2:
        dane = np.frombuffer(surowe, dtype="<i2") / 32767.0
    elif sw == 4:
        dane = np.frombuffer(surowe, dtype="<i4") / (2 ** 31 - 1)
    else:
        raise ValueError(sw)
    dane = dane.reshape(-1, k).T
    return dane[0] if k == 1 else dane
