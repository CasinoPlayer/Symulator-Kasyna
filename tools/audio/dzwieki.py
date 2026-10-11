"""
dzwieki.py — przepisy 59 efektów dźwiękowych Cebulion Casino (ID wiążące: brief § 10, opis: doc 05 § 3).

Każdy ID to jedna funkcja z dekoratorem @dzwiek(...). Dekorator zapisuje metadane, które trafiają prosto do
assets/audio/manifest.json (szyna, gainDb, priorytet, warianty, keyTrack, syncPoint, pakiet ładowania…).
Funkcja dostaje generator liczb losowych z ziarnem wyliczonym z ID (render deterministyczny) i zwraca
tablicę NumPy: mono (n,) albo stereo (2, n). Pętle (loop=True) zwracają sygnał DOKŁADNIE okresowy o długości
``okres`` — ogony wystające poza koniec są zawijane na początek (doc 05 § 7.3).

Normalizację (szczyt −1 dBTP / −18 LUFS dla pętli), filtr HP 20 Hz i krótkie wejście/wyjście robi
mastering.py — przepisy skupiają się na brzmieniu.

Wszystkie tonalne efekty są w pentatonice C (C D E G A); silnik transponuje je do tonacji gry (keyTrack).
"""

from __future__ import annotations

import numpy as np

import dsp
import instrumenty as ins
from dsp import SR, czas, db, hz, n_probek, wstaw

PRZEPISY: dict[str, dict] = {}


def dzwiek(id_: str, *, bus: str = "sfx", gain_db: float = 0.0, priority: int = 3, loop: bool = False,
           stereo: bool = False, dlugosc: float, packs=("gry-dalsze",), **meta):
    """Dekorator: rejestruje przepis efektu pod danym ID z metadanymi manifestu."""
    def rejestruj(funkcja):
        PRZEPISY[id_] = dict(funkcja=funkcja, rodzaj="sfx", bus=bus, gainDb=gain_db, priority=priority, loop=loop,
                             stereo=stereo, dlugosc=dlugosc, packs=list(packs), meta=meta)
        return funkcja
    return rejestruj


# ================================================================================================
# Wspólne klocki (materiały dźwiękowe marki: złoto, szkło, moneta, aksamit, głębia — doc 05 § 1.2)
# ================================================================================================
PENTA_MONET = ["C7", "D7", "E7", "G7", "A7"]


def _bufor(dlugosc, st=False):
    n = n_probek(dlugosc)
    return np.zeros((2, n)) if st else np.zeros(n)


def _wybrzmienie(x, od: float, krzywa: float = 2.0):
    """Łagodne wyciszenie od czasu ``od`` do końca (ogon pogłosu nie urywa się)."""
    x = np.array(x, dtype=float)
    n = x.shape[-1]
    a = min(n, n_probek(od))
    if n - a > 1:
        x[..., a:] *= np.cos(np.linspace(0, np.pi / 2, n - a)) ** krzywa
    return x


def _poglos_mono(x, rt60, miks, **kw):
    return dsp.mono(dsp.poglos(x, rt60, miks, **kw)) * 1.15


def _zawin(x, okres_s):
    """Zawija sygnał do okresu (pętla): wszystko, co wystaje poza koniec, trafia na początek."""
    L = n_probek(okres_s)
    x = np.asarray(x, dtype=float)
    wynik = np.zeros(x.shape[:-1] + (L,))
    for s in range(0, x.shape[-1], L):
        kaw = x[..., s:s + L]
        wynik[..., :kaw.shape[-1]] += kaw
    return wynik


def moneta(f0: float, nuta, rng, dlugosc: float = 0.22, ton_db: float = -6.0, jasnosc: float = 1.0):
    """Model monety: uderzenie (1 ms szumu HP 3 kHz) + 5 tłumionych parcjałów (synteza modalna)
    + warstwa tonalna: dzwonek FM 1:2 na nucie pentatoniki (melodyjny „ting”)."""
    t = czas(dlugosc)
    n = len(t)
    uderzenie = dsp.hp(dsp.szum(n, rng) * (t < 0.001), 3000) * 0.9
    cialo = dsp.parcjaly(f0, [1, 1.47, 2.09, 2.56, 3.39], [0.18, 0.12, 0.09, 0.06, 0.04], dlugosc,
                         [1.0, 0.7, 0.55 * jasnosc, 0.4 * jasnosc, 0.3 * jasnosc], rng=rng, rozstrojenie_hz=4.0)
    ton = db(ton_db) * dsp.dzwon_fm(hz(nuta), dlugosc, r=2.0, i0=1.6, i1=0.1, tau=0.14, tau_i=0.04)
    return uderzenie + 0.7 * cialo + ton


def iskry(dlugosc, liczba, t0, t1, rng, fmin=3000.0, fmax=6000.0, tau=0.03, pan=0.7, st=True, poziom=0.25):
    """Iskry: krótkie, wysokie sinusy (z lekkim glissandem) losowo rozrzucone w czasie i panoramie."""
    buf = _bufor(dlugosc, st)
    for _ in range(liczba):
        f = np.exp(rng.uniform(np.log(fmin), np.log(fmax)))
        d = tau * 4
        tt = czas(d)
        s = np.sin(dsp.DWA_PI * dsp.faza(f * (1 + 0.04 * tt / d), len(tt))) * dsp.atak_zanik(d, 0.0008, tau)
        s *= poziom * rng.uniform(0.4, 1.0)
        start = rng.uniform(t0, t1)
        wstaw(buf, dsp.panorama(s, rng.uniform(-pan, pan)) if st else s, start)
    return buf


def uderzenie(dlugosc, f0=55.0, f1=30.0, t_gliss=0.25, tau=0.4, rng=None, trzask=0.6, nas=3.0):
    """Kinowe uderzenie basu: sinus z opadającą wysokością + nasycenie tanh (harmoniczne 120–400 Hz —
    słyszalne na telefonie) + trzask szumu na początku."""
    rng = rng or np.random.default_rng(5)
    t = czas(dlugosc)
    f = f1 + (f0 - f1) * np.exp(-t / (t_gliss / 3))
    sub = dsp.sinus(f, len(t)) * dsp.atak_zanik(dlugosc, 0.001, tau)
    sub = dsp.nasycenie(sub, nas) * 0.9
    tr = dsp.lp(dsp.szum(len(t), rng), 2500) * np.exp(-t / 0.004) * trzask
    return sub + tr


def narastanie_odwrocone(zrodlo, dlugosc_narastania: float, rt60: float = 1.5, rng_ziarno: int = 3):
    """„Odwrócony pogłos”: pogłos dźwięku odwrócony w czasie — zasysające narastanie, które kończy się
    dokładnie w chwili uderzenia (koniec zwróconego sygnału = moment uderzenia)."""
    mokry = dsp.poglos(zrodlo, rt60, 1.0, ziarno=rng_ziarno, ogon=rt60, hp_mokry=200)
    odw = dsp.odwroc(mokry)
    n = n_probek(dlugosc_narastania)
    odw = odw[..., -n:] if odw.shape[-1] >= n else dsp.dopasuj(odw[..., ::-1], n)[..., ::-1]
    return odw * np.linspace(0.3, 1.0, n) ** 2


def szum_przemiatany(dlugosc, typ, f0, f1, q=1.0, rng=None, kolor="rozowy", d_przem=None, punkty=None):
    rng = rng or np.random.default_rng(6)
    x = dsp.szum(n_probek(dlugosc), rng, kolor)
    return dsp.przemiataj(x, typ, f0, f1, d_przem, q=q, punkty=punkty)


def deta_akord(nuty, dlugosc, f_od=400.0, f_do=8000.0, tau_filtra=0.25, atak=0.008, rng=None, szer=0.6, gate=None):
    """Akord „dętych” syntezatorowych rozłożony w stereo."""
    rng = rng or np.random.default_rng(7)
    buf = _bufor(dlugosc, True)
    for i, nu in enumerate(nuty):
        x = ins.deta_nuta(hz(nu), dlugosc, gate=gate, f_od=f_od, f_do=f_do, tau_filtra=tau_filtra, atak=atak, rng=rng)
        pan = (i / max(1, len(nuty) - 1) * 2 - 1) * szer
        wstaw(buf, dsp.panorama(x, pan), 0)
    return buf / np.sqrt(len(nuty))


def dzwony_akord(nuty, dlugosc, r=2.0, i0=2.5, i1=0.2, tau=0.7, odstep=0.0, start=0.0, szer=0.4):
    buf = _bufor(dlugosc, True)
    for i, nu in enumerate(nuty):
        x = dsp.dzwon_fm(hz(nu), dlugosc - start - i * odstep, r=r, i0=i0, i1=i1, tau=tau)
        pan = (i / max(1, len(nuty) - 1) * 2 - 1) * szer if len(nuty) > 1 else 0
        wstaw(buf, dsp.panorama(x, pan), start + i * odstep)
    return buf / np.sqrt(len(nuty))


def klik_szklany(rng, dlugosc=0.07):
    """Warstwy 1–2 dźwięku ui_klik: szklany trzask (szum 2 ms → BP 3,5 kHz) + ton 1200 → 1050 Hz."""
    t = czas(dlugosc)
    n = len(t)
    trzask = dsp.bp(dsp.szum(n, rng) * (t < 0.002), 3500, 2.0) * 2.5
    ton = dsp.sinus(dsp.przemiatanie(1200, 1050, dlugosc, 0.03), n) * dsp.atak_zanik(dlugosc, 0.0008, 0.02)
    return trzask + 0.8 * ton


# ================================================================================================
# 3.1. Interfejs (8, szyna ui)
# ================================================================================================
@dzwiek("ui_hover", bus="ui", gain_db=-16, priority=1, dlugosc=0.04, packs=["ui"], pitchCents=30,
        gainJitterDb=0.5, maxVoices=1, cooldownMs=80)
def ui_hover(rng):
    d = 0.04
    t = czas(d)
    x = dsp.sinus(2600, len(t)) * dsp.atak_zanik(d, 0.003, 0.012)
    x += db(-14) * dsp.sinus(2600 * 2.76, len(t)) * dsp.atak_zanik(d, 0.002, 0.006)
    x += db(-18) * dsp.hp(dsp.szum(len(t), rng), 6000) * dsp.atak_zanik(d, 0.001, 0.003) * (t < 0.008)
    return x


@dzwiek("ui_klik", bus="ui", gain_db=-8, priority=3, dlugosc=0.07, packs=["ui"], pitchCents=30, gainJitterDb=0.5)
def ui_klik(rng):
    d = 0.07
    t = czas(d)
    x = klik_szklany(rng, d)
    x += db(-10) * dsp.sinus(220, len(t)) * dsp.atak_zanik(d, 0.001, 0.015)
    return _wybrzmienie(_poglos_mono(x, 0.3, 0.08), 0.05)


def _otworz_zamknij(rng, d, f_od, f_do, nuty, rt):
    t = czas(d)
    n = len(t)
    sz = dsp.przemiataj(dsp.szum(n, rng, "rozowy"), "bp", f_od, f_do, 0.22, q=1.2)
    sz *= dsp.obwiednia([(0, 0), (0.06, 1), (0.2, 0.5), (d, 0)], d) * 0.5
    x = sz
    for i, nu in enumerate(nuty):
        b = dsp.dzwon_fm(hz(nu), d - 0.04 * i, r=2.0, i0=1.2, i1=0.0, tau=0.18 * d / 0.3, tau_i=0.06)
        wstaw(x, 0.5 * b, 0.04 * i)
    return _wybrzmienie(_poglos_mono(x, rt, 0.2), d * 0.7)


@dzwiek("ui_otworz", bus="ui", gain_db=-10, priority=3, dlugosc=0.3, packs=["ui"], pitchCents=30, gainJitterDb=0.5)
def ui_otworz(rng):
    return _otworz_zamknij(rng, 0.3, 800, 4000, ["E5", "B5"], 0.6)


@dzwiek("ui_zamknij", bus="ui", gain_db=-12, priority=3, dlugosc=0.24, packs=["ui"], pitchCents=30, gainJitterDb=0.5)
def ui_zamknij(rng):
    return _otworz_zamknij(rng, 0.24, 4000, 900, ["B5", "E5"], 0.4)


@dzwiek("ui_blad", bus="ui", gain_db=-8, priority=4, dlugosc=0.26, packs=["ui"])
def ui_blad(rng):
    d = 0.26
    x = _bufor(d)
    for nu, start, dl in (("C#4", 0.0, 0.09), ("C4", 0.12, 0.11)):
        n = n_probek(dl)
        ton = dsp.kwadrat(hz(nu), n) * dsp.adsr(n, 0.004, 0.05, 0.8, 0.025)
        ton += 0.5 * dsp.sinus(hz(nu), n) * dsp.adsr(n, 0.004, 0.05, 0.8, 0.025)
        wstaw(x, ton, start)
        t = czas(0.08)
        wstaw(x, 0.9 * dsp.sinus(120, len(t)) * dsp.atak_zanik(0.08, 0.001, 0.025), start)
    return dsp.lp(x, 1400, rzad=2)


@dzwiek("ui_przelacznik", bus="ui", gain_db=-10, priority=3, dlugosc=0.1, packs=["ui"], pitchCents=0)
def ui_przelacznik(rng):
    x = _bufor(0.1)
    k1 = klik_szklany(rng, 0.05)
    wstaw(x, k1, 0.0)
    # drugi klik o 3 półtony wyżej (odczyt z prędkością 2^(3/12))
    k2 = klik_szklany(rng, 0.06)
    pos = np.arange(n_probek(0.05)) * 2 ** (3 / 12)
    k2 = np.interp(pos, np.arange(len(k2)), k2)
    wstaw(x, 0.9 * k2, 0.045)
    return x


def _zaklad(rng, nuta, kier):
    d = 0.13
    x = _bufor(d)
    for fc, start in ((2200, 0.0), (3100, 0.018)):
        t = czas(0.03)
        wstaw(x, dsp.bp(dsp.szum(len(t), rng) * dsp.atak_zanik(0.03, 0.0005, 0.004), fc, 6.0) * 3.0, start)
    t = czas(0.11)
    f = hz(nuta) * 2 ** (kier * 50 / 1200 * np.clip(t / 0.06, 0, 1))
    dz = np.sin(dsp.DWA_PI * dsp.faza(f, len(t)) + 0.8 * np.exp(-t / 0.03) * np.sin(dsp.DWA_PI * dsp.faza(2 * f, len(t))))
    wstaw(x, 0.55 * dz * dsp.atak_zanik(0.11, 0.002, 0.08), 0.012)
    return x


@dzwiek("ui_zaklad_gora", bus="ui", gain_db=-9, priority=3, dlugosc=0.13, packs=["ui"])
def ui_zaklad_gora(rng):
    return _zaklad(rng, "G5", +1)


@dzwiek("ui_zaklad_dol", bus="ui", gain_db=-10, priority=3, dlugosc=0.13, packs=["ui"])
def ui_zaklad_dol(rng):
    return _zaklad(rng, "E5", -1)


# ================================================================================================
# 3.2. Globalne (13)
# ================================================================================================
@dzwiek("sfx_logowanie", gain_db=-6, priority=3, stereo=True, dlugosc=1.8, packs=["lobby"])
def sfx_logowanie(rng):
    d = 1.8
    x = _bufor(d, True)
    # motyw Cebuliona G4–C5–E5–G5 w złotych dzwonach FM 1:2
    for i, (nu, start) in enumerate((("G4", 0.0), ("C5", 0.11), ("E5", 0.22), ("G5", 0.33))):
        dl = d - start
        b = dsp.dzwon_fm(hz(nu), dl, r=2.0, i0=2.5, i1=0.3, tau=0.9, tau_i=0.4 / 2.3)
        b += db(-14) * dsp.dzwon_fm(hz(nu) * 2, dl, r=2.0, i0=1.5, i1=0.1, tau=0.5)
        wstaw(x, dsp.panorama(b * 0.55, (-0.25, 0.1, -0.1, 0.25)[i]), start)
    # aksamitny pad Cmaj9: po 2 piły ±8 c, LP 1200 Hz, atak 400 ms, zanik od 900 ms
    pad = _bufor(d, True)
    for i, nu in enumerate(("C3", "G3", "B3", "D4", "E4")):
        p = ins.pad_nuta(hz(nu), d, atak=0.4, wybrzmienie=0.9, rozstrojenie_c=8, rng=rng, sinus_pod=0.0, gate=0.9)
        wstaw(pad, dsp.panorama(p, (i - 2) * 0.25), 0)
    pad = dsp.lp(pad, 1200, rzad=2)
    x += 0.22 * pad
    x += iskry(d, 14, 0.2, 0.9, rng, 3000, 6000, 0.03, 0.7, poziom=0.18)
    x += db(-12) * dsp.panorama(uderzenie(d, 65, 45, 0.2, 0.35, rng, trzask=0.0, nas=1.5), 0)
    y = dsp.poglos(x, 1.8, 0.25, jasnosc=0.6)
    return _wybrzmienie(y, 1.25)


def _skrzypienie(rng, dl):
    """Skrzypienie drewna: seria impulsów „stick-slip” o zmiennej częstotliwości przez rezonanse drewna."""
    n = n_probek(dl)
    imp = np.zeros(n)
    t = 0.0
    while t < dl:
        f = 70 + 80 * (t / dl) + 15 * np.sin(dsp.DWA_PI * 3 * t)
        k = n_probek(t)
        if k < n:
            imp[k] += rng.uniform(0.5, 1.0)
        t += (1.0 / f) * rng.uniform(0.85, 1.15)
    x = (dsp.bp(imp, 420, 6) * 1.0 + dsp.bp(imp, 950, 8) * 0.8 + dsp.bp(imp, 1750, 10) * 0.5)
    x *= dsp.obwiednia([(0, 0), (0.05, 1), (dl * 0.7, 0.8), (dl, 0)], dl)
    return x * 3


@dzwiek("sfx_skrzynia_otwarcie", gain_db=-4, priority=3, stereo=True, dlugosc=1.3,
        packs=["lobby", "gry-dalsze"])
def sfx_skrzynia_otwarcie(rng):
    d = 1.3
    x = _bufor(d, True)
    # 0 ms: dwa kliki zatrzasku + metaliczny dźwięk okucia
    for start in (0.0, 0.035):
        t = czas(0.05)
        k = dsp.bp(dsp.szum(len(t), rng) * dsp.atak_zanik(0.05, 0.0003, 0.004), 2800, 8.0) * 4
        k += 0.3 * dsp.parcjaly(1850, [1, 2.3, 3.9], [0.03, 0.02, 0.012], 0.05, rng=rng)
        wstaw(x, dsp.panorama(k, -0.15), start)
    # 40–340 ms: skrzypienie wieka
    wstaw(x, dsp.panorama(0.35 * _skrzypienie(rng, 0.3), 0.1), 0.04)
    # 250 ms: „łup” wieka
    t = czas(0.4)
    lup = dsp.lp(dsp.szum(len(t), rng), 600) * dsp.atak_zanik(0.4, 0.001, 0.06) * 1.2
    lup += dsp.sinus(dsp.przemiatanie(110, 80, 0.4, 0.05), len(t)) * dsp.atak_zanik(0.4, 0.001, 0.09)
    wstaw(x, dsp.nasycenie(lup, 1.5) * 0.9, 0.25)
    # 250–1300 ms: magiczne rozbłyśnięcie złota
    dl = 1.05
    sz = szum_przemiatany(dl, "bp", 1000, 8000, 3.0, rng, d_przem=0.6)
    sz *= dsp.obwiednia([(0, 0), (0.15, 1), (0.5, 0.6), (dl, 0)], dl) * 0.25
    akord = _bufor(dl, True)
    for i, nu in enumerate(("C4", "E4", "G4", "C5", "E5", "G5")):
        p = dsp.pila(dsp.centy(hz(nu), rng.uniform(-10, 10)), n_probek(dl), rng.random())
        wstaw(akord, dsp.panorama(p, (i / 5 * 2 - 1) * 0.7), 0)
    akord = dsp.przemiataj(akord, "lp", 500, 6000, 0.5, q=1.0)
    akord *= dsp.obwiednia([(0, 0), (0.25, 1), (0.6, 0.7), (dl, 0)], dl) * 0.12
    wstaw(x, dsp.stereo(sz) + akord, 0.25)
    x += iskry(d, 12, 0.3, 1.0, rng, 4000, 8000, 0.025, 0.8, poziom=0.15)
    y = dsp.poglos(x, 1.5, 0.22)
    return _wybrzmienie(y, 1.0)


@dzwiek("sfx_monety_fontanna", gain_db=-10, priority=2, loop=True, stereo=True, dlugosc=2.0, okres=2.0,
        packs=["lobby", "gry-dalsze"], maxVoices=1)
def sfx_monety_fontanna(rng):
    L = 2.0
    x = _bufor(L, True)
    liczba = 90                                   # ~45 uderzeń na sekundę
    for i in range(liczba):
        start = (i + rng.uniform(-0.4, 0.4)) * L / liczba
        dl = rng.uniform(0.06, 0.18)
        f0 = rng.uniform(1900, 2900)
        nuta = PENTA_MONET[rng.integers(0, 5)]
        m = moneta(f0, nuta, rng, dl + 0.05, ton_db=-8, jasnosc=rng.uniform(0.7, 1.0))
        m *= np.exp(-czas(dl + 0.05) / dl)
        g = db(rng.uniform(-12, 0))
        wstaw(x, dsp.panorama(m * g, rng.uniform(-0.8, 0.8)), start % L, zawijaj=True)
    szelest = dsp.hp(dsp.szum(n_probek(L), rng), 4000, okresowy=True)
    x += db(-26) * dsp.stereo(szelest) * np.array([[1.0], [0.9]])
    return dsp.poglos(x * 0.5, 0.8, 0.15, okresowy=True)


def _moneta_przepis(f0, nuta, dl):
    def przepis(rng):
        return moneta(f0, nuta, rng, dl)
    return przepis


def key_track(nuta: str):
    """keyTrack dla pliku jednonutowego (doc 05 § 1.2): nuty D i A w S2 przesuwamy o +100 c (D → E♭, A → B♭),
    bo +200 c dałoby E i B spoza hidżazu; pozostałe nuty — transpozycja kontekstu (true)."""
    return {"s2": 100} if nuta[0] in "DA" else True


for _i, (_f0, _nuta, _dl) in enumerate(((1900, "C7", 0.22), (2100, "D7", 0.21), (2300, "E7", 0.20),
                                        (2500, "G7", 0.19), (2700, "A7", 0.18)), start=1):
    dzwiek(f"sfx_moneta_{_i}", gain_db=-14, priority=1, dlugosc=_dl, packs=["lobby", "gry-krytyczne"],
           group="moneta", maxVoices=6, cooldownMs=25, pitchCents=5, gainJitterDb=1, keyTrack=key_track(_nuta))(
        _moneta_przepis(_f0, _nuta, _dl))


@dzwiek("sfx_licznik_tik", gain_db=-16, priority=2, loop=True, dlugosc=0.5, okres=0.5,
        packs=["lobby", "gry-krytyczne"], keyTrack=True, maxVoices=1)
def sfx_licznik_tik(rng):
    L = 0.5
    x = _bufor(L)
    for k in range(8):
        nuta = "G6" if k % 2 == 0 else "C7"           # tylko C/E/G — jedna transpozycja pasuje też do S2
        tik = dsp.dzwon_fm(hz(nuta), 0.06, r=3.5, i0=1.5, i1=0.2, tau=0.015, atak=0.0006)
        t = czas(0.06)
        tik += 0.35 * dsp.hp(dsp.szum(len(t), rng) * (t < 0.001), 2500)
        wstaw(x, tik * (1.0 if k % 2 == 0 else 0.85), k * 0.0625, zawijaj=True)
    return x


@dzwiek("sfx_licznik_koniec", gain_db=-8, priority=3, dlugosc=0.8, packs=["lobby", "gry-krytyczne"],
        pitchCents=5, keyTrack=True)
def sfx_licznik_koniec(rng):
    d = 0.8
    x = _bufor(d)
    e5 = dsp.dzwon_fm(hz("E5"), 0.3, r=2.0, i0=2.0, i1=0.2, tau=0.12)
    wstaw(x, 0.5 * e5, 0.0)
    for i, nu in enumerate(("C6", "E6", "G6")):
        b = dsp.dzwon_fm(hz(nu), d - 0.11, r=2.0, i0=3.0, i1=0.0, tau=0.32, tau_i=0.4 / 2.3)
        wstaw(x, 0.45 * b, 0.11 + 0.008 * i)
    t = czas(0.3)
    wstaw(x, 0.6 * dsp.sinus(80, len(t)) * dsp.atak_zanik(0.3, 0.002, 0.06), 0.11)
    x += dsp.mono(iskry(d, 6, 0.12, 0.4, rng, 5500, 6500, 0.025, 0, st=False, poziom=0.12))
    return _wybrzmienie(_poglos_mono(x, 1.2, 0.2), 0.55)


@dzwiek("sfx_saldo_puls", gain_db=-16, priority=2, dlugosc=0.18, packs=["lobby", "gry-krytyczne"],
        pitchCents=5, keyTrack=True, maxVoices=1, cooldownMs=150)
def sfx_saldo_puls(rng):
    d = 0.18
    t = czas(d)
    x = dsp.sinus(dsp.przemiatanie(hz("E5"), hz("G5"), d, 0.04), len(t)) * dsp.atak_zanik(d, 0.004, 0.11)
    x = dsp.lp(x, 3000)
    x += db(-24) * dsp.hp(dsp.szum(len(t), rng), 5000) * dsp.atak_zanik(d, 0.002, 0.02) * (t < 0.06)
    return x


@dzwiek("sfx_bankrut", gain_db=-6, priority=5, dlugosc=2.0, packs=["lobby", "gry-dalsze"])
def sfx_bankrut(rng):
    d = 2.0
    x = _bufor(d)
    # „dęte” z tłumikiem: G4 – F♯4 – F4 (po 200 ms) i E4 trzymane 500 ms z narastającym wibratem
    nuty = [(0.0, 0.2, hz("G4")), (0.2, 0.2, hz("F#4")), (0.4, 0.2, hz("F4")), (0.6, 0.55, hz("E4"))]
    dl = 1.25
    ton, fz, env = ins.linia_mono(nuty, dl, "pila", glide=0.03, vibrato=(5.0, 15.0, 0.05), atak=0.02,
                                  wybrzmienie=0.12, legato=False)
    t = czas(dl)
    wib = 1 + np.clip((t - 0.6) / 0.5, 0, 1)                  # wibrato rośnie do ±30 c na ostatniej nucie
    ton2 = dsp.pila(fz ** 1.0 * 2 ** ((wib - 1) * 15 * np.sin(dsp.DWA_PI * 5 * t) / 1200), len(t)) * env
    # tłumik „wa-wa”: filtr pasmowy otwierany na każdej nucie
    fc = np.full(len(t), 500.0)
    for s, dd, _ in nuty:
        u = np.clip((t - s) / dd, 0, 1)
        fc += np.where((t >= s) & (t < s + dd), 600 * np.sin(np.pi * u) ** 0.7, 0)
    y = dsp.svf(ton2, fc, 2.2, "bp") * 1.6 + 0.3 * dsp.lp(ton2, 900)
    wstaw(x, dsp.nasycenie(y * 0.9, 1.3), 0.0)
    # 300 ms: „klap” pustej kieszeni
    tt = czas(0.1)
    wstaw(x, 0.5 * dsp.lp(dsp.szum(len(tt), rng), 1200) * dsp.atak_zanik(0.1, 0.002, 0.018), 0.3)
    # 900–2000 ms: moneta wirująca na stole — uderzenia coraz gęściej (120 → 8 ms) i ciszej
    t0, koniec = 0.9, 1.85
    tk = t0
    while tk < koniec:
        u = (tk - t0) / (koniec - t0)
        odstep = 0.12 * (0.008 / 0.12) ** (u ** 0.8)
        g = (1 - u) ** 1.2 * 0.35 + 0.03
        m = moneta(2400 + 200 * u, "E7", rng, 0.06, ton_db=-14, jasnosc=0.8) * np.exp(-czas(0.06) / 0.02)
        wstaw(x, m * g, tk)
        tk += odstep
    # położenie się monety
    wstaw(x, 0.25 * moneta(2300, "C7", rng, 0.12, ton_db=-12), koniec)
    return _wybrzmienie(_poglos_mono(x, 1.0, 0.12), 1.9)


@dzwiek("sfx_przejscie_whoosh", gain_db=-8, priority=3, stereo=True, dlugosc=0.65,
        packs=["lobby", "gry-dalsze"], pitchCents=100, gainJitterDb=1.5)
def sfx_przejscie_whoosh(rng):
    d = 0.65
    n = n_probek(d)
    sz = dsp.szum(n, rng, "rozowy")
    pkt = [(0.0, 300.0), (0.38, 3500.0), (0.65, 1000.0)]
    y = dsp.przemiataj(sz, "bp", 0, 0, q=1.5, punkty=pkt)
    y *= dsp.obwiednia([(0, 0.3), (0.3, 0.8), (0.38, 1.0), (0.65, 0.0)], d, "lin") ** 1.5
    pan = dsp.obwiednia([(0, -0.7), (0.65, 0.7)], d)
    x = dsp.panorama(y, pan)
    t = czas(d)
    sub = dsp.sinus(dsp.przemiatanie(50, 35, d), n) * dsp.obwiednia([(0, 0), (0.35, 1), (0.65, 0)], d)
    x += db(-8) * dsp.stereo(sub) * 1.5
    y = dsp.poglos(x, 0.8, 0.2)
    return _wybrzmienie(y, 0.5)


# ================================================================================================
# 3.3. Wspólne dla gier (27)
# ================================================================================================
@dzwiek("sfx_spin_start", gain_db=-8, priority=4, dlugosc=0.38, packs=["gry-krytyczne"], pitchCents=5,
        keyTrack=True)
def sfx_spin_start(rng):
    d = 0.38
    x = _bufor(d)
    wstaw(x, klik_szklany(rng, 0.07), 0.0)
    t = czas(0.12)
    klunk = dsp.lp(dsp.szum(len(t), rng), 400) * dsp.atak_zanik(0.12, 0.001, 0.02) * 1.5
    klunk += dsp.sinus(dsp.przemiatanie(140, 90, 0.12, 0.04), len(t)) * dsp.atak_zanik(0.12, 0.001, 0.035)
    wstaw(x, dsp.nasycenie(klunk, 1.5), 0.015)
    dl = 0.22
    sw = szum_przemiatany(dl, "bp", 600, 2400, 2.0, rng)
    sw *= dsp.obwiednia([(0, 0), (0.06, 1), (0.16, 0.6), (dl, 0)], dl) * 0.6
    wstaw(x, sw, 0.04)
    n = n_probek(0.03)
    wstaw(x, db(-12) * dsp.kwadrat(hz("C5"), n) * dsp.adsr(n, 0.002, 0.01, 0.8, 0.008), 0.02)
    return x


@dzwiek("sfx_beben_petla_s1", gain_db=-16, priority=2, loop=True, dlugosc=1.0, okres=1.0, packs=["s1"],
        maxVoices=1)
def sfx_beben_petla_s1(rng):
    L = 1.0
    n = n_probek(L)
    t = np.arange(n) / SR
    x = np.zeros(n)
    for k in range(24):
        tt = czas(0.03)
        klik = dsp.bp(dsp.szum(len(tt), rng) * dsp.atak_zanik(0.03, 0.0003, 0.004), 2000, 3.0) * 2.0
        wstaw(x, klik * (db(3) if k % 8 == 0 else 1.0), k / 24.0, zawijaj=True)
    buczenie = dsp.lp(dsp.pila(55, n), 250, okresowy=True) * 0.35
    pw = 0.3 + 0.15 * np.sin(dsp.DWA_PI * 1.0 * t)
    wir = dsp.lp(dsp.kwadrat(110, n, pw), 800, okresowy=True) * (0.6 + 0.4 * np.sin(dsp.DWA_PI * 12 * t)) * 0.18
    return dsp.redukcja_bitow(x * 0.6 + buczenie + wir, 12)


@dzwiek("sfx_beben_petla_s2", gain_db=-16, priority=2, loop=True, dlugosc=1.2, okres=1.2, packs=["s2"],
        maxVoices=1)
def sfx_beben_petla_s2(rng):
    L = 1.2
    n = n_probek(L)
    t = np.arange(n) / SR
    x = np.zeros(n)
    for k in range(24):
        tt = czas(0.06)
        klik = dsp.bp(dsp.szum(len(tt), rng) * dsp.atak_zanik(0.06, 0.0004, 0.006), 1200, 3.0) * 2.0
        klik += 0.8 * dsp.sinus(320, len(tt)) * dsp.atak_zanik(0.06, 0.0005, 0.015)
        wstaw(x, klik * rng.uniform(0.8, 1.0), k / 20.0, zawijaj=True)
    dudnienie = dsp.lp(dsp.szum(n, rng, "brazowy"), 180, okresowy=True) * 0.5
    piasek = dsp.hp(dsp.szum(n, rng), 5000, okresowy=True) * db(-26) * (0.7 + 0.3 * np.sin(dsp.DWA_PI * t / L))
    return x * 0.6 + dudnienie + piasek * 2


_NUTY_STOPOW = {1: "C5", 2: "D5", 3: "E5", 4: "G5", 5: "A5", 6: "C6"}


def _stop_przepis(nuta):
    def przepis(rng):
        d = 0.28
        t = czas(d)
        n = len(t)
        tunk = dsp.sinus(dsp.przemiatanie(110, 55, d, 0.06), n) * dsp.atak_zanik(d, 0.0008, 0.07)
        tunk = dsp.nasycenie(tunk, 2.0)
        klak = dsp.bp(dsp.szum(n, rng) * (t < 0.012) * np.exp(-t / 0.004), 1800, 2.0) * 1.6
        zatrzask = dsp.hp(dsp.szum(n, rng) * (t < 0.002), 3000) * 0.5
        ping = db(-10) * dsp.dzwon_fm(hz(nuta), d, r=2.0, i0=1.5, i1=0.0, tau=0.12, tau_i=0.08 / 2.3) * 1.6
        korpus = 0.35 * dsp.lp(dsp.szum(n, rng), 350) * dsp.atak_zanik(d, 0.001, 0.02)
        return tunk + 0.5 * klak + zatrzask + ping + korpus
    return przepis


for _k, _nuta in _NUTY_STOPOW.items():
    dzwiek(f"sfx_beben_stop_{_k}", gain_db=-7, priority=4, dlugosc=0.28, packs=["gry-krytyczne"],
           keyTrack=key_track(_nuta),
           pitchCents=5, gainJitterDb=1, group="beben_stop", maxVoices=3)(_stop_przepis(_nuta))


@dzwiek("sfx_antycypacja_narastanie", gain_db=-6, priority=4, stereo=True, dlugosc=1.2,
        packs=["gry-dalsze"], wyjscie_ms=3, keyTrack=True, syncPoint=1.2)
def sfx_antycypacja_narastanie(rng):
    """Narastanie kończące się DOKŁADNIE na końcu pliku (syncPoint = 1,2 s = stop antycypowanego bębna).
    Klaster smyczków to pusta kwinta C3–G3–C4 — po transpozycji T: C–G (S1), D–A (S2, bordun hidżazu), E–B (S3)."""
    d = 1.2
    n = n_probek(d)
    t = np.arange(n) / SR
    narast = db(-12 + 12 * (t / d) ** 1.5)                     # +12 dB w czasie pliku
    sz = dsp.przemiataj(dsp.szum(n, rng, "rozowy"), "bp", 400, 6000, d, q=4.0)
    x = dsp.panorama(sz * 0.6, 0) * np.array([[1.0], [1.0]])
    # klaster „smyczków” (6 pił: po 2 na nutę C3, G3, C4, ±20 c) z tremolo 8 → 16 Hz
    tremolo_f = 8 + 8 * (t / d)
    trem = 0.5 + 0.5 * np.sin(dsp.DWA_PI * dsp.faza(tremolo_f, n))
    for i, (nu, c) in enumerate((("C3", -20), ("C3", 20), ("G3", -20), ("G3", 20), ("C4", -20), ("C4", 20))):
        s = dsp.pila(dsp.centy(hz(nu), c * rng.uniform(0.6, 1.0)), n, rng.random())
        s = dsp.przemiataj(s, "bp", 1000, 3000, d, q=0.8)
        wstaw(x, dsp.panorama(s * trem * 0.35, (i % 2 * 2 - 1) * 0.5), 0)
    shep = ins.ton_sheparda(d, okres=1.6, f_baza=40, glosy=8, srodek=700, sigma_okt=1.0)
    x += dsp.stereo(shep) * 0.8
    x = x * narast
    sub = dsp.sinus(dsp.przemiatanie(40, 80, d), n) * (t / d) ** 2 * 0.5
    return x + dsp.stereo(sub)


@dzwiek("sfx_bicie_serca", gain_db=-8, priority=4, loop=True, dlugosc=0.6, okres=0.6, packs=["gry-dalsze"],
        maxVoices=1)
def sfx_bicie_serca(rng):
    L = 0.6
    x = _bufor(L)
    for start, f0, f1, g in ((0.0, 70, 45, 1.0), (0.15, 60, 42, db(-4))):
        d = 0.45
        t = czas(d)
        s = dsp.sinus(dsp.przemiatanie(f0, f1, d, 0.08), len(t)) * dsp.atak_zanik(d, 0.004, 0.09)
        s += 0.3 * dsp.lp(dsp.szum(len(t), rng), 150) * dsp.atak_zanik(d, 0.002, 0.03)
        wstaw(x, s * g, start, zawijaj=True)
    x = dsp.lp(x, 200, okresowy=True)                    # LP PRZED nasyceniem — harmoniczne 90–420 Hz zostają
    return dsp.nasycenie(x * 1.4, 3.0, asymetria=0.3)


def _scatter_przepis(nr):
    def przepis(rng):
        d = (0.9, 1.1, 1.7)[nr - 1]
        rt = (1.6, 2.0, 2.4)[nr - 1]
        x = _bufor(d)
        sync = 0.08
        # odwrócony pogłos szumu (start 80 ms przed lądowaniem)
        imp = dsp.hp(dsp.szum(n_probek(0.05), rng), 2000) * np.exp(-czas(0.05) / 0.01)
        wstaw(x, dsp.mono(narastanie_odwrocone(imp, sync, 1.2)) * 0.8, 0.0)
        if nr == 1:
            b = dsp.dzwon_fm(hz("C6"), d - sync, r=3.5, i0=4.0, i1=0.5, tau=0.5)
            b += db(-8) * dsp.dzwon_fm(hz("C7"), d - sync, r=3.5, i0=2.5, i1=0.3, tau=0.35)
            wstaw(x, b * 0.6, sync)
        elif nr == 2:
            b = dsp.dzwon_fm(hz("E6"), d - sync, r=3.5, i0=4.0, i1=0.5, tau=0.6)
            b += 0.7 * dsp.dzwon_fm(hz("G5"), d - sync, r=3.5, i0=3.0, i1=0.4, tau=0.6)
            b += db(-8) * dsp.dzwon_fm(hz("E7"), d - sync, r=3.5, i0=2.0, i1=0.3, tau=0.35)
            t = czas(d - sync)
            b += 0.6 * dsp.nasycenie(dsp.sinus(hz("C2"), len(t)) * dsp.atak_zanik(d - sync, 0.003, 0.3), 1.8, 0.2)
            wstaw(x, b * 0.5, sync)
        else:
            for i, nu in enumerate(("C6", "E6", "G6", "C7")):
                b = dsp.dzwon_fm(hz(nu), d - sync - 0.03 * i, r=3.5, i0=3.5, i1=0.4, tau=0.7)
                wstaw(x, b * 0.32, sync + 0.03 * i)
            ch = ins.chor([hz("C4"), hz("E4"), hz("G4"), hz("C5")], d - sync, "a", atak=0.2, wybrzmienie=0.8, rng=rng)
            wstaw(x, ch * 0.5, sync)
            wstaw(x, 0.55 * uderzenie(d - sync, 55, 35, 0.3, 0.45, rng, trzask=0.4, nas=2.0), sync)
            wstaw(x, dsp.mono(iskry(d, 10, sync, 0.8, rng, 4000, 8000, 0.03, st=False, poziom=0.15)), 0)
        y = _poglos_mono(x, rt, 0.3, jasnosc=0.7)
        return _wybrzmienie(y, d * 0.65)
    return przepis


for _nr in (1, 2, 3):
    dzwiek(f"sfx_scatter_{_nr}", gain_db=(-6, -5, -3)[_nr - 1], priority=(4, 4, 5)[_nr - 1],
           dlugosc=(0.9, 1.1, 1.7)[_nr - 1], packs=["gry-krytyczne"], pitchCents=5, keyTrack=True, syncPoint=0.08,
           group="scatter", maxVoices=2, cooldownMs=40)(_scatter_przepis(_nr))


@dzwiek("sfx_wild", gain_db=-5, priority=4, dlugosc=1.0, packs=["gry-krytyczne"], pitchCents=5, keyTrack=True,
        syncPoint=0.15, maxVoices=2, cooldownMs=40)
def sfx_wild(rng):
    d = 1.0
    sync = 0.15
    x = _bufor(d)
    zrodlo = dsp.hp(dsp.szum(n_probek(0.05), rng), 1500) * np.exp(-czas(0.05) / 0.012)
    zrodlo = dsp.miks(zrodlo, 0.5 * dsp.mono(dzwony_akord(["C5", "G5", "C6"], 0.3, tau=0.2)))
    wstaw(x, dsp.mono(narastanie_odwrocone(zrodlo, sync, 1.4)) * 1.2, 0.0)
    wstaw(x, 0.8 * uderzenie(d - sync, 80, 40, 0.12, 0.25, rng, trzask=0.8, nas=2.5), sync)
    for i, nu in enumerate(("C5", "G5", "C6", "E6")):
        b = dsp.dzwon_fm(hz(nu), d - sync, r=2.0, i0=2.5, i1=0.2, tau=0.7)
        wstaw(x, 0.3 * b, sync + 0.006 * i)
    wstaw(x, dsp.mono(iskry(d, 10, sync, 0.6, rng, 4000, 8000, 0.03, st=False, poziom=0.16)), 0)
    return _wybrzmienie(_poglos_mono(x, 1.8, 0.25), 0.7)


def _wygrana_small_przepis(nuty, dl, i0):
    def przepis(rng):
        x = _bufor(dl)
        for i, nu in enumerate(nuty):
            f = hz(nu)
            b = dsp.dzwon_fm(f, dl - 0.06 * i, r=1.0, i0=i0, i1=0.0, tau=0.35, tau_i=0.12)
            b += db(-8) * dsp.karplus_strong(f / 2, dl - 0.06 * i, 0.5, 0.995, rng) * np.exp(-czas(dl - 0.06 * i) / 0.35)
            wstaw(x, 0.45 * b, 0.06 * i)
        return _wybrzmienie(_poglos_mono(x, 1.2, 0.18), dl * 0.7)
    return przepis


for _nr, (_nuty, _dl, _i0) in enumerate(((("C5", "E5", "G5"), 0.7, 1.2), (("E5", "G5", "C6"), 0.75, 1.2),
                                          (("G5", "C6", "E6"), 0.8, 1.6)), start=1):
    dzwiek(f"sfx_wygrana_small_{_nr}", gain_db=-9, priority=4, dlugosc=_dl, packs=["gry-krytyczne"], pitchCents=5,
           gainJitterDb=1, keyTrack=True)(_wygrana_small_przepis(_nuty, _dl, _i0))


@dzwiek("sfx_wygrana_medium", gain_db=-6, priority=4, dlugosc=1.6, packs=["gry-krytyczne"], pitchCents=5,
        keyTrack=True)
def sfx_wygrana_medium(rng):
    d = 1.6
    x = _bufor(d)
    for i, nu in enumerate(("C5", "E5", "G5", "C6", "E6")):
        b = dsp.dzwon_fm(hz(nu), d - 0.04 * i, r=2.0, i0=2.0, i1=0.2, tau=0.5 if i < 4 else 0.9)
        wstaw(x, 0.4 * b, 0.04 * i)
    dl = 0.6
    ss = dsp.mono(sum(dsp.supersaw(hz(nu), dl, 7, 12, rng) for nu in ("C4", "E4", "G4", "C5")))
    ss = dsp.lp(ss, 3000, rzad=2) * dsp.adsr(dl, 0.01, 0.15, 0.6, 0.25, gate=0.3) * 0.12
    wstaw(x, ss, 0.2)
    t = czas(0.6)
    wstaw(x, 0.6 * dsp.nasycenie(dsp.sinus(hz("C2"), len(t)) * dsp.atak_zanik(0.6, 0.003, 0.2), 2.0, 0.2), 0.2)
    for k in range(6):
        nuta = ("C7", "E7", "G7")[rng.integers(0, 3)]      # tylko C/E/G — jedna transpozycja (§ 1.2)
        wstaw(x, 0.18 * moneta(rng.uniform(2000, 2800), nuta, rng, 0.2), 0.25 + k * 0.08 + rng.uniform(0, 0.03))
    return _wybrzmienie(_poglos_mono(x, 1.8, 0.22), 1.1)


@dzwiek("sfx_linia", gain_db=-12, priority=3, dlugosc=0.34, packs=["gry-krytyczne"], maxVoices=3, cooldownMs=80)
def sfx_linia(rng):
    d = 0.34
    t = czas(d)
    n = len(t)
    env = dsp.atak_zanik(d, 0.004, 0.15)
    ton = dsp.sinus(dsp.przemiatanie(800, 1600, d, 0.12), n) * env
    sz = db(-8) * dsp.bp(dsp.szum(n, rng), 4000, 6.0) * env * 2
    x = ton + sz
    return _wybrzmienie(dsp.mono(dsp.echo(x, 0.09, 0.25, 0.4, lp_hz=6000)), 0.26)


@dzwiek("sfx_bigwin_wejscie", gain_db=-3, priority=5, stereo=True, dlugosc=2.4, packs=["gry-dalsze"],
        syncPoint=0.3)
def sfx_bigwin_wejscie(rng):
    d = 2.4
    sync = 0.3
    x = _bufor(d, True)
    # 0–300 ms: odwrócony talerz (zasysające narastanie)
    tal = ins.talerz(0.9, 0.5, rng, odwrocony=True)
    tal = tal[-n_probek(sync):] * np.linspace(0.2, 1, n_probek(sync)) ** 2
    wstaw(x, dsp.szerokosc(np.vstack([tal, np.roll(tal, 37)]), 1.0) * 0.8, 0.0)
    # 300 ms: uderzenie + akord „dętych” C3–G3–C4–E4–G4–C5 (LP 400 → 8000 Hz w 80 ms)
    wstaw(x, dsp.stereo(uderzenie(d - sync, 55, 30, 0.6, 0.6, rng, trzask=0.9, nas=3.0)) * 0.9, sync)
    wstaw(x, dsp.stereo(ins.taiko(1.0, 75, 40, 0.35, rng)) * 0.5, sync)
    akord = deta_akord(["C3", "G3", "C4", "E4", "G4", "C5"], d - sync, f_od=400, f_do=8000, tau_filtra=0.5,
                       atak=0.006, rng=rng, gate=d - sync - 0.6)
    wstaw(x, akord * 0.55, sync)
    # 500–1300 ms: motyw Cebuliona G4–C5–E5–G5 po 120 ms (fanfara dętych + dzwony w unisono)
    motyw = [(0.5, 0.12, "G4"), (0.62, 0.12, "C5"), (0.74, 0.12, "E5"), (0.86, 1.2, "G5")]
    for s, dl, nu in motyw:
        tr = ins.deta_nuta(hz(nu), dl + 0.3, gate=dl, f_od=900, f_do=7000, tau_filtra=0.2, atak=0.01, rng=rng)
        wstaw(x, dsp.panorama(tr * 0.4, 0.0), s)
        b = dsp.dzwon_fm(hz(nu) * 2, 1.0, r=2.0, i0=2.0, i1=0.2, tau=0.5)
        wstaw(x, dsp.panorama(b * 0.18, 0.2), s)
    ch = ins.chor([hz(n) for n in ("C4", "E4", "G4", "C5")], d - 0.5, "a", atak=0.4, wybrzmienie=0.8, rng=rng)
    wstaw(x, dsp.szerokosc(dsp.stereo(ch), 1.0) * 0.3, 0.5)
    x += iskry(d, 26, 0.35, 2.2, rng, 5000, 9000, 0.03, 0.8, poziom=0.12)
    y = dsp.poglos(x, 2.5, 0.25, jasnosc=0.6)
    return _wybrzmienie(y, 1.7)


@dzwiek("sfx_poziom_w_gore", gain_db=-4, priority=5, dlugosc=1.4, packs=["gry-dalsze"], syncPoint=0.25, maxVoices=1)
def sfx_poziom_w_gore(rng):
    d = 1.4
    sync = 0.25
    x = _bufor(d)
    sw = szum_przemiatany(sync, "bp", 500, 6000, 1.8, rng)
    sw *= np.linspace(0.1, 1, n_probek(sync)) ** 2
    t = czas(sync)
    sw += 0.3 * dsp.sinus(dsp.przemiatanie(200, 1600, sync), len(t)) * np.linspace(0.1, 1, len(t)) ** 2
    wstaw(x, sw * 0.8, 0.0)
    wstaw(x, uderzenie(d - sync, 60, 32, 0.3, 0.45, rng, trzask=0.9, nas=3.0) * 0.8, sync)
    dl = d - sync
    nn = n_probek(dl)
    tt = czas(dl)
    moc = np.zeros(nn)
    for nu in ("F2", "C3", "F3", "C4"):
        moc += dsp.pila(dsp.centy(hz(nu), rng.uniform(-6, 6)), nn, rng.random())
    moc = dsp.nasycenie(moc * 0.5, 4.0)
    for nu in ("F4", "C5"):
        moc += 0.5 * ins.deta_nuta(hz(nu), dl, gate=0.6, f_od=1000, f_do=7000, rng=rng)
    moc = dsp.svf(moc, 600 + 6400 * (1 - np.exp(-tt / 0.02)) * (0.4 + 0.6 * np.exp(-tt / 0.5)), 0.8, "lp")
    moc *= dsp.adsr(nn, 0.004, 0.3, 0.7, 0.5, gate=0.6) * 0.3
    wstaw(x, moc, sync)
    wstaw(x, dsp.mono(iskry(d, 12, sync, 1.0, rng, 4000, 9000, 0.03, st=False, poziom=0.14)), 0)
    return _wybrzmienie(_poglos_mono(x, 2.0, 0.22), 1.0)


@dzwiek("sfx_bigwin_koniec", gain_db=-4, priority=5, stereo=True, dlugosc=2.2, packs=["gry-dalsze"])
def sfx_bigwin_koniec(rng):
    d = 2.2
    x = _bufor(d, True)
    g = deta_akord(["G3", "B3", "D4", "G4"], 0.35, f_od=700, f_do=6000, rng=rng, gate=0.15)
    wstaw(x, g * 0.5, 0.0)
    c = deta_akord(["C3", "G3", "D4", "E4", "G4", "C5"], d - 0.18, f_od=600, f_do=7000, tau_filtra=0.6, rng=rng,
                   gate=0.8)
    wstaw(x, c * 0.55, 0.18)
    wstaw(x, dzwony_akord(["C6", "D6", "E6", "G6"], d - 0.18, r=2.0, i0=2.5, tau=0.9, odstep=0.02) * 0.3, 0.18)
    t = czas(1.2)
    wstaw(x, dsp.stereo(dsp.nasycenie(dsp.sinus(hz("C2"), len(t)) * dsp.atak_zanik(1.2, 0.005, 0.4), 2.0, 0.2)) * 0.6,
          0.18)
    for k in range(20):
        start = 0.2 + k * 0.05 + rng.uniform(0, 0.02)
        m = moneta(rng.uniform(1900, 2900), PENTA_MONET[rng.integers(0, 5)], rng, 0.22)
        wstaw(x, dsp.panorama(m * 0.13 * (1 - k / 25), rng.uniform(-0.8, 0.8)), start)
    x += iskry(d, 20, 0.3, 1.9, rng, 5000, 9000, 0.03, 0.8, poziom=0.1)
    y = dsp.poglos(x, 2.5, 0.25, jasnosc=0.6)
    return _wybrzmienie(y, 1.4)


@dzwiek("sfx_blysk", gain_db=-12, priority=3, dlugosc=0.42, packs=["lobby", "gry-dalsze"], pitchCents=100,
        gainJitterDb=1.5, syncPoint=0.03, maxVoices=2, cooldownMs=333)
def sfx_blysk(rng):
    d = 0.42
    sync = 0.03
    x = _bufor(d)
    t = czas(d - sync)
    n = len(t)
    sz = dsp.hp(dsp.szum(n, rng), 5000, rzad=2) * dsp.atak_zanik(d - sync, 0.002, 0.12)
    ton = sum(dsp.sinus(f, n, rng.random()) for f in (6000, 8200, 11000)) * dsp.atak_zanik(d - sync, 0.002, 0.2) * db(-10)
    wstaw(x, sz + ton, sync)
    wstaw(x, 0.7 * dsp.mono(narastanie_odwrocone(sz[:n_probek(0.05)], sync, 0.8)), 0.0)
    return _wybrzmienie(_poglos_mono(x, 1.0, 0.3, jasnosc=0.8), 0.3)


@dzwiek("sfx_uderzenie_basu", gain_db=-5, priority=4, dlugosc=1.0, packs=["lobby", "gry-dalsze"], pitchCents=30,
        maxVoices=2)
def sfx_uderzenie_basu(rng):
    d = 1.0
    t = czas(d)
    n = len(t)
    sub = dsp.sinus(dsp.przemiatanie(60, 32, d, 0.25), n) * dsp.atak_zanik(d, 0.004, 0.4)
    sub = dsp.nasycenie(sub, 3.0, asymetria=0.3)       # asym.: także parzyste harmoniczne 120, 240 Hz…
    klik = dsp.lp(dsp.szum(n, rng) * (t < 0.002), 2000) * 0.8
    return dsp.lp(sub + klik, 4000)


@dzwiek("sfx_free_spins_start", gain_db=-3, priority=5, stereo=True, dlugosc=3.2, packs=["gry-dalsze"],
        keyTrack=True, syncPoint=1.0)
def sfx_free_spins_start(rng):
    d = 3.2
    sync = 1.0
    x = _bufor(d, True)
    n0 = n_probek(sync)
    t0 = np.arange(n0) / SR
    narast = (t0 / sync) ** 2
    sz = dsp.przemiataj(dsp.szum(n0, rng, "rozowy"), "bp", 300, 8000, sync, q=2.0) * narast
    shep = ins.ton_sheparda(sync, okres=0.8, f_baza=40, glosy=8, srodek=800, sigma_okt=1.0) * narast
    wstaw(x, dsp.stereo(sz * 0.5 + shep * 0.7), 0.0)
    for k in range(16):                                   # werbel szesnastkami z crescendo od −30 dB
        g = db(-30 + 28 * (k / 15) ** 1.2)
        w = ins.werbel(0.2, 210, 0.04, 2800, 0.06, 0.8, rng)
        wstaw(x, dsp.panorama(w * g * 0.6, 0.15 * (-1) ** k), k * sync / 16)
    dl = d - sync
    wstaw(x, dsp.stereo(uderzenie(dl, 50, 28, 0.8, 0.7, rng, trzask=1.0, nas=3.0)) * 0.85, sync)
    tal = ins.talerz(dl, 0.9, rng, jasnosc=1.0)
    wstaw(x, np.vstack([tal, np.roll(tal, 53)]) * 0.35, sync)
    nn = n_probek(dl)
    narost = dsp.adsr(nn, 0.6, 0.4, 0.8, 1.2, gate=1.2)
    akord = deta_akord(["C3", "G3", "C4", "E4", "G4"], dl, f_od=500, f_do=6000, tau_filtra=1.0, atak=0.3, rng=rng,
                       gate=1.2)
    wstaw(x, akord * 0.5, sync)
    ch = ins.chor([hz(nn_) for nn_ in ("C4", "E4", "G4", "C5")], dl, "a", atak=0.6, wybrzmienie=1.0, rng=rng)
    wstaw(x, dsp.szerokosc(dsp.stereo(ch * narost), 1.0) * 0.35, sync)
    wstaw(x, dzwony_akord(["C6", "E6", "G6"], dl, r=2.0, i0=3.0, tau=1.0, odstep=0.04) * 0.3, sync)
    x += iskry(d, 24, sync, 2.6, rng, 5000, 9000, 0.03, 0.8, poziom=0.1)
    y = dsp.poglos(x, 3.0, 0.25, jasnosc=0.6)
    return _wybrzmienie(y, 2.4)


@dzwiek("sfx_free_spins_koniec", gain_db=-5, priority=5, stereo=True, dlugosc=2.4, packs=["gry-dalsze"],
        keyTrack=True)
def sfx_free_spins_koniec(rng):
    d = 2.4
    x = _bufor(d, True)
    dl = 0.6
    sw = szum_przemiatany(dl, "bp", 6000, 400, 1.5, rng)
    sw *= dsp.obwiednia([(0, 0.2), (0.1, 1), (dl, 0)], dl)
    wstaw(x, dsp.panorama(sw * 0.6, dsp.obwiednia([(0, 0.5), (dl, -0.3)], dl)), 0.0)
    # Bez kadencji F → C (po T akord F byłby G-dur w S2 i A-dur w S3 — obce skalom gier): dzwony opadają po
    # dźwiękach C-dur G6–E6–C6–G5 co 120 ms i lądują na trzymanym akordzie C-dur (pad + dzwony, 900 ms).
    for i, nu in enumerate(("G6", "E6", "C6", "G5")):
        b = dsp.dzwon_fm(hz(nu), 1.2, r=2.0, i0=2.2, i1=0.2, tau=0.45)
        wstaw(x, dsp.panorama(b * 0.3, 0.45 - 0.3 * i), 0.15 + 0.12 * i)
    start, dl = 0.15 + 0.12 * 4, 2.4 - 0.63
    pad = _bufor(dl, True)
    nuty = ("C3", "G3", "C4", "E4", "G4")
    for i, nu in enumerate(nuty):
        p = ins.pad_nuta(hz(nu), dl, atak=0.08, wybrzmienie=0.8, rng=rng, gate=0.9)
        wstaw(pad, dsp.panorama(p, (i / (len(nuty) - 1) * 2 - 1) * 0.6), 0)
    wstaw(x, dsp.lp(pad, 2200, rzad=2) * 0.2, start)
    wstaw(x, dzwony_akord(["C5", "E5", "G5", "C6"], dl, r=2.0, i0=2.0, tau=0.7, odstep=0.025) * 0.28, start)
    t = czas(1.5)
    sub = dsp.sinus(hz("C2"), len(t)) * dsp.atak_zanik(1.5, 0.01, 0.5)
    wstaw(x, dsp.stereo(dsp.nasycenie(sub, 2.0, 0.2)) * 0.5, start)
    y = dsp.poglos(x, 2.0, 0.25)
    return _wybrzmienie(y, 1.7)


# ================================================================================================
# 3.4. S1 „Cebulowy 777”
# ================================================================================================
def _migotanie_neonu(d):
    """Obwiednia migotania świetlówki — TA SAMA tablica czasów co animacja neonu (04, E50):
    zapalenie 0–40 ms, przygaszenie do 60% w 200–260 ms i w 450–500 ms, potem stałe świecenie."""
    return dsp.obwiednia([(0, 0), (0.04, 1), (0.2, 1), (0.215, 0.6), (0.26, 0.6), (0.27, 1), (0.45, 1),
                          (0.46, 0.6), (0.5, 0.6), (0.51, 1), (d, 1)], d)


CZASY_TRZASKOW_NEONU = (0.2, 0.215, 0.26, 0.45, 0.46, 0.5)


@dzwiek("sfx_s1_neon_bzyk", gain_db=-9, priority=3, dlugosc=0.65, packs=["s1"], pitchCents=20)
def sfx_s1_neon_bzyk(rng):
    d = 0.65
    n = n_probek(d)
    t = np.arange(n) / SR
    bucz = dsp.pila(100, n) + 0.5 * dsp.pila(200.3, n)
    bucz = dsp.bp(bucz, 1700, 0.6) * 1.2 + 0.4 * dsp.lp(bucz, 300)
    env = _migotanie_neonu(d) * np.where(t > 0.5, np.exp(-(t - 0.5) / 0.2), 1.0)
    x = bucz * env * 0.6
    dl = 0.15
    nz = n_probek(dl)
    zap = dsp.kwadrat(dsp.przemiatanie(220, 880, dl), nz) * dsp.adsr(nz, 0.002, 0.05, 0.8, 0.03)
    zap = dsp.redukcja_bitow(zap * 0.5, 8, 11025)
    wstaw(x, zap * 0.7, 0.0)
    for tz in CZASY_TRZASKOW_NEONU:
        k = n_probek(tz)
        imp = np.zeros(n_probek(0.02))
        imp[:n_probek(0.0005)] = rng.choice([-1, 1]) * rng.uniform(0.6, 1.0)
        wstaw(x, dsp.hp(imp, 1500) * 1.5, k)
    return x


@dzwiek("sfx_s1_jackpot", gain_db=-3, priority=5, stereo=True, dlugosc=4.0, packs=["s1"], syncPoint=0.3)
def sfx_s1_jackpot(rng):
    d = 4.0
    sync = 0.3
    x = _bufor(d, True)
    # 0–300 ms: przepięcie neonu (szum z rezonansem 2 kHz przestrajanym w górę + buczenie 100 Hz)
    n0 = n_probek(sync)
    t0 = np.arange(n0) / SR
    sz = dsp.svf(dsp.szum(n0, rng), dsp.przemiatanie(800, 4000, sync), 6.0, "bp") * (t0 / sync) ** 2
    bz = dsp.bp(dsp.pila(100, n0), 1500, 0.8) * (t0 / sync) * 0.4
    wstaw(x, dsp.stereo(sz * 0.8 + bz), 0.0)
    # 300 ms: uderzenie
    wstaw(x, dsp.stereo(uderzenie(1.5, 45, 30, 0.4, 0.5, rng, trzask=1.0, nas=3.0)) * 0.8, sync)
    # 350–850 ms: 8-bitowy podbieg (kwadrat 25%, C–E–G w górę, po 31 ms)
    bieg = ["C4", "E4", "G4", "C5", "E5", "G5", "C6", "C5", "E5", "G5", "C6", "E6", "G6", "C7"]
    for i, nu in enumerate(bieg):
        nn = n_probek(0.031 if i < len(bieg) - 1 else 0.85 - 0.35 - 0.031 * i)
        s = dsp.kwadrat(hz(nu), nn, 0.25) * dsp.adsr(nn, 0.001, 0.01, 0.9, 0.004)
        s = dsp.redukcja_bitow(s * 0.5, 8, 22050)
        wstaw(x, dsp.panorama(s * 0.5, 0.2 * np.sin(i)), 0.35 + i * 0.031)
    # 850–3850 ms: fanfara 120 BPM — akordy C → F → G → C po 750 ms, arpeggia szesnastkowe supersaw
    akordy = [("C4", "E4", "G4"), ("F4", "A4", "C5"), ("G4", "B4", "D5"), ("C4", "E4", "G4")]
    t_fan = 0.85
    for a_i, ak in enumerate(akordy):
        s0 = t_fan + a_i * 0.75
        dl = 0.75 if a_i < 3 else d - s0
        pad = sum(dsp.supersaw(hz(nu), dl, 7, 14, rng) for nu in ak)
        pad = dsp.lp(pad, 3500, rzad=2) * dsp.adsr(n_probek(dl), 0.01, 0.2, 0.7, 0.15 if a_i < 3 else 0.8) * 0.08
        wstaw(x, pad, s0)
        wzor = list(ak) + [ak[0][:-1] + str(int(ak[0][-1]) + 1)]
        kroki = 6 if a_i < 3 else 8
        for k in range(kroki):
            nu = wzor[k % 4] if (k // 4) % 2 == 0 else wzor[3 - k % 4]
            nn = n_probek(0.2)
            s = dsp.mono(dsp.supersaw(hz(nu) * 2, nn, 5, 10, rng)) * dsp.atak_zanik(0.2, 0.002, 0.08)
            s = dsp.lp(s, 6000)
            wstaw(x, dsp.panorama(s * 0.22, 0.4 * (-1) ** k), s0 + k * 0.125)
        bas = ins.bas_pila(hz(ak[0][:-1] + "2"), dl, fc=500, env_hz=1500, tau=0.1)
        wstaw(x, dsp.stereo(bas) * 0.25, s0)
    for tw in (1.35, 2.35, 3.35):                           # werbel z bramkowanym pogłosem na 2 i 4
        w = ins.werbel(0.35, 190, 0.05, 2200, 0.09, 0.8, rng)
        wp = dsp.poglos(w, 1.2, 0.5, ogon=0.4)
        bram = dsp.obwiednia([(0, 1), (0.25, 1), (0.28, 0), (0.75, 0)], wp.shape[-1] / SR)
        wstaw(x, wp * bram * 0.45, tw)
    for tk in np.arange(t_fan, 3.85, 0.5):
        wstaw(x, dsp.stereo(ins.stopa(0.4, 120, 45, 0.04, 0.12, 0.3, 1.6, rng)) * 0.45, tk)
    x += iskry(d, 30, 0.9, 3.9, rng, 5000, 9000, 0.03, 0.8, poziom=0.09)
    y = dsp.poglos(x, 1.6, 0.18, jasnosc=0.6)
    return _wybrzmienie(y, 3.6)


# ================================================================================================
# 3.5. S2 „Złoty Faraon” (w tonacji gry: D hidżaz)
# ================================================================================================
@dzwiek("sfx_s2_wild_rozszerzenie", gain_db=-4, priority=4, stereo=True, dlugosc=1.6, packs=["s2"],
        syncPoint=0.6, maxVoices=2)
def sfx_s2_wild_rozszerzenie(rng):
    d = 1.6
    sync = 0.6
    x = _bufor(d, True)
    n0 = n_probek(sync)
    t0 = np.arange(n0) / SR
    kamien = dsp.przemiataj(dsp.szum(n0, rng, "brazowy"), "bp", 200, 900, sync, q=1.5) * 1.5
    ziarna = np.zeros(n0)
    for k in range(int(40 * sync)):
        p = n_probek(rng.uniform(0, sync))
        if p < n0 - 200:
            ziarna[p:p + 200] += dsp.bp(dsp.szum(200, rng), rng.uniform(800, 2500), 3) * np.exp(-np.arange(200) / 40)
    blask = dsp.przemiataj(dsp.szum(n0, rng), "bp", 2000, 9000, sync, q=2.0) * 0.3
    narast = (0.3 + 0.7 * t0 / sync)
    wstaw(x, dsp.panorama((kamien + 0.5 * ziarna) * narast, -0.1), 0.0)
    wstaw(x, dsp.panorama(blask * narast ** 2, 0.2), 0.0)
    # 300–1600 ms: chór (formanty „a”) — akord D–F♯–A z ozdobnikiem E♭ → D
    dl = d - 0.3
    ch = ins.chor([hz("D4"), hz("F#4"), hz("A4")], dl, "a", atak=0.3, wybrzmienie=0.6, rng=rng)
    wstaw(x, dsp.szerokosc(dsp.stereo(ch), 1.0) * 0.45, 0.3)
    orn, _, env = ins.linia_mono([(0.0, 0.15, hz("Eb5")), (0.15, 0.9, hz("D5"))], 1.1, "pila", glide=0.03,
                                 vibrato=(5.0, 15.0, 0.2), atak=0.05, wybrzmienie=0.3)
    orn = dsp.formanty(orn, [(lambda t: 700 + 0 * t, 130, 1.0), (lambda t: 1100 + 0 * t, 160, 0.7),
                             (lambda t: 2600 + 0 * t, 260, 0.25)])
    wstaw(x, dsp.panorama(orn * 0.6, 0.0), sync - 0.05)
    wstaw(x, dsp.stereo(uderzenie(d - sync, 55, 35, 0.3, 0.45, rng, trzask=0.7, nas=2.5)) * 0.7, sync)
    g = ins.gong(73.42, d - sync, rng, skala_zanikow=0.25, stereo_wyj=True)
    wstaw(x, g * 0.25, sync)
    y = dsp.poglos(x, 2.2, 0.25, jasnosc=0.45, odbicia_ms=(25, 41, 67))
    return _wybrzmienie(y, 1.15)


@dzwiek("sfx_s2_gong", gain_db=-5, priority=4, stereo=True, dlugosc=3.5, packs=["s2"])
def sfx_s2_gong(rng):
    d = 3.5
    g = ins.gong(73.42, d, rng, skala_zanikow=1.0, stereo_wyj=True)
    g = dsp.szerokosc(g, 0.5)                            # L i P mają różne dudnienia — zwężamy dla mono-zgodności
    y = dsp.poglos(g, 2.8, 0.15, jasnosc=0.4, odbicia_ms=(25, 41, 67))
    return _wybrzmienie(y, 2.8)


# ================================================================================================
# 3.6. S3 „Kryształowa Kaskada” (w tonacji gry: E lidyjska)
# ================================================================================================
def _pekniecie_przepis(nr, dl, f_min, f_max, odlamki):
    def przepis(rng):
        x = _bufor(dl)
        t = czas(dl)
        n = len(t)
        # trzask celowo umiarkowany: przy normalizacji szczytem zbyt ostry transjent ścisza „ciało” pęknięcia
        x += dsp.hp(dsp.szum(n, rng) * (t < 0.003) * np.exp(-t / 0.001), 3000) * 0.5
        fr = np.exp(rng.uniform(np.log(f_min), np.log(f_max), 10))
        taus = rng.uniform(0.04, 0.2, 10)
        x += 0.9 * dsp.parcjaly(1.0, fr, taus, dl, rng.uniform(0.3, 1.0, 10), rng=rng)
        for k in range(odlamki):
            u = (k / odlamki) ** 1.6                          # malejąca gęstość odłamków w czasie
            start = 0.08 + u * 0.37 + rng.uniform(-0.01, 0.01)
            dd = rng.uniform(0.02, 0.04)
            f = rng.uniform(4000, 10000)
            g = dsp.parcjaly(f, [1, 1.53, 2.21], [dd / 3, dd / 4, dd / 6], dd, rng=rng)
            g += 0.3 * dsp.hp(dsp.szum(n_probek(dd), rng), 5000) * np.exp(-czas(dd) / 0.003)
            wstaw(x, g * 0.5 * (1 - 0.7 * u) * rng.uniform(0.5, 1.0), start)
        x += 0.5 * dsp.sinus(180, n) * dsp.atak_zanik(dl, 0.001, 0.03)
        return _wybrzmienie(_poglos_mono(x, 0.9, 0.15, jasnosc=0.8), dl * 0.75)
    return przepis


for _nr, (_dl, _fmin, _fmax, _od) in enumerate(((0.6, 2500, 9000, 16), (0.55, 2500, 9000, 14),
                                                (0.5, 2000, 6000, 12), (0.65, 4000, 10000, 20)), start=1):
    dzwiek(f"sfx_s3_pekniecie_{_nr}", gain_db=-10, priority=3, dlugosc=_dl, packs=["s3"], pitchCents=80,
           gainJitterDb=1.5, group="pekniecie", maxVoices=3, cooldownMs=25)(_pekniecie_przepis(_nr, _dl, _fmin, _fmax, _od))


@dzwiek("sfx_s3_opad", gain_db=-12, priority=3, dlugosc=0.75, packs=["s3"], pitchCents=5)
def sfx_s3_opad(rng):
    d = 0.75
    x = _bufor(d)
    dl = 0.42
    sw = szum_przemiatany(dl, "bp", 3000, 800, 1.6, rng, d_przem=0.4)
    sw *= dsp.obwiednia([(0, 0), (0.08, 1), (0.3, 0.6), (dl, 0)], dl) * 0.7
    wstaw(x, sw, 0.0)
    for i, nu in enumerate(("E7", "C#7", "B6", "G#6", "F#6", "E6")):
        p = dsp.dzwon_fm(hz(nu), 0.25, r=3.5, i0=1.8, i1=0.3, tau=0.025 * 2.5, atak=0.0008)
        wstaw(x, p * 0.35 * (1 - 0.08 * i), 0.4 + i * 0.055 + rng.uniform(0, 0.01))
    return _wybrzmienie(_poglos_mono(x, 1.4, 0.25, jasnosc=0.8), 0.6)


@dzwiek("sfx_s3_mnoznik", gain_db=-7, priority=4, dlugosc=1.1, packs=["s3"], maxVoices=2)
def sfx_s3_mnoznik(rng):
    d = 1.1
    t = czas(d)
    n = len(t)
    x = 0.45 * dsp.dzwon_fm(hz("E4"), d, r=3.5, i0=5.0, i1=0.8, tau=0.8)
    x += 0.35 * dsp.dzwon_fm(hz("E5"), d, r=3.5, i0=4.0, i1=0.6, tau=0.7)
    mmm = dsp.sinus(82.41, n) * (0.6 + 0.4 * np.sin(dsp.DWA_PI * 6 * t)) * dsp.atak_zanik(d, 0.06, 0.6)
    x += 0.6 * dsp.nasycenie(mmm, 2.0)
    wstaw(x, 0.5 * ins.szklany_tik(7500, rng, 0.04), 0)
    y = _poglos_mono(x, 3.0, 0.3, predelay=0.04, jasnosc=0.7)
    return _wybrzmienie(y, 0.8)


@dzwiek("sfx_s3_mnoznik_zbior", gain_db=-4, priority=5, stereo=True, dlugosc=1.8, packs=["s3"], syncPoint=0.9)
def sfx_s3_mnoznik_zbior(rng):
    d = 1.8
    sync = 0.9
    x = _bufor(d, True)
    for i, (start, pan0) in enumerate(((0.0, -0.7), (0.15, 0.7), (0.3, -0.4))):
        dl = 0.3
        sw = szum_przemiatany(dl, "bp", 1000, 5000, 2.0, rng)
        sw *= dsp.obwiednia([(0, 0), (0.15, 1), (dl, 0)], dl) * 0.5
        wstaw(x, dsp.panorama(sw, dsp.obwiednia([(0, pan0), (dl, 0)], dl)), start)
    for i, nu in enumerate(("E5", "G#5", "B5", "D#6", "F#6")):
        b = dsp.dzwon_fm(hz(nu), 0.8, r=3.5, i0=3.0, i1=0.4, tau=0.35)
        wstaw(x, dsp.panorama(b * 0.3, (i - 2) * 0.2), 0.6 + i * 0.06)
    wstaw(x, dsp.stereo(uderzenie(d - sync, 41, 30, 0.3, 0.45, rng, trzask=0.6, nas=3.0)) * 0.8, sync)
    wstaw(x, dsp.stereo(_pekniecie_przepis(0, 0.5, 3000, 9000, 10)(rng)) * 0.5, sync)
    dl = d - sync
    wstaw(x, dzwony_akord(["E5", "G#5", "B5", "A#5"], dl, r=3.5, i0=3.0, i1=0.5, tau=0.9, odstep=0.01) * 0.4, sync)
    pad = _bufor(dl, True)
    for i, nu in enumerate(("E3", "B3", "G#4", "A#4")):
        wstaw(pad, dsp.panorama(ins.pad_nuta(hz(nu), dl, atak=0.05, wybrzmienie=0.6, rng=rng, gate=0.4), (i - 1.5) * 0.4), 0)
    wstaw(x, dsp.lp(pad, 2500) * 0.15, sync)
    x += iskry(d, 16, sync, 1.6, rng, 6000, 10000, 0.03, 0.8, poziom=0.1)
    y = dsp.poglos(x, 3.0, 0.28, predelay=0.04, jasnosc=0.7)
    return _wybrzmienie(y, 1.3)
