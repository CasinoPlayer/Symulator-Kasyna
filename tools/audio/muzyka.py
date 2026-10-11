"""
muzyka.py — 8 pętli muzycznych Cebulion Casino (doc 05 § 4): aranżacje zapisane danymi dla sekwencera.

Każdy utwór: tempo, liczba taktów (długość pętli = całkowita liczba taktów), siatka akordów, ścieżki
(instrument, rytm, melodia, poziom względny w LU) i wspólny pogłos. Funkcja utworu zwraca stereo DOKŁADNIE
okresowe o długości pętli; mastering (korekcja, kompresja szyny, limiter, −14 LUFS) robi mastering.py.

Poziomy ścieżek z doc 05 („poziom względny”) realizujemy pomiarem: każdą ścieżkę normalizujemy do zadanej
głośności LUFS względem ścieżki odniesienia — miks jest powtarzalny i liczbowo uzasadniony.
"""

from __future__ import annotations

import os

import numpy as np

import analiza
import dsp
import instrumenty as ins
from dsp import SR, hz, n_probek
from sekwencer import Utwor, rytm

PRZEPISY_MUZYKI: dict[str, dict] = {}
DEBUG = os.environ.get("AUDIO_DEBUG") == "1"


def utwor(id_: str, *, bpm: float, takty: int, metrum: int = 4, packs=("gry-dalsze",), gain_db: float = 0.0,
          dlugosc: float | None = None, **meta):
    """Dekorator: rejestruje utwór (pętlę muzyczną) z metadanymi manifestu."""
    def rejestruj(funkcja):
        dl = dlugosc if dlugosc is not None else takty * metrum * 60.0 / bpm
        PRZEPISY_MUZYKI[id_] = dict(funkcja=funkcja, rodzaj="muzyka", bus="music", gainDb=gain_db, priority=0,
                                    loop=True, stereo=True, dlugosc=dl, okres=dl, packs=list(packs),
                                    meta=dict(meta, bpm=bpm, beatsPerBar=metrum) if bpm else dict(meta))
        return funkcja
    return rejestruj


# ================================================================================================
# Wspólne narzędzia miksu
# ================================================================================================
def wyrownaj(sciezki: dict, odniesienie: float = -24.0) -> dict:
    """Normalizuje każdą ścieżkę do LUFS = odniesienie + poziom (poziom względny z doc 05)."""
    wynik = {}
    for nazwa, (x, poziom) in sciezki.items():
        g = analiza.lufs(x, okresowy=True)
        if not np.isfinite(g):
            continue
        wynik[nazwa] = x * dsp.db(odniesienie + poziom - g)
        if DEBUG:
            print(f"    {nazwa:12s} {g:7.1f} LUFS → {odniesienie + poziom:6.1f}")
    return wynik


def poglos_szyna(sciezki: dict, wysylki: dict, rt60: float, poziom: float, **kw) -> np.ndarray:
    """Wspólny pogłos (szyna wysyłkowa): suma ścieżek × wysyłka → splot kołowy → tylko sygnał mokry."""
    L = next(iter(sciezki.values())).shape[-1]
    suma = np.zeros((2, L))
    for nazwa, w in wysylki.items():
        if nazwa in sciezki:
            suma += dsp.stereo(sciezki[nazwa]) * w
    return dsp.poglos(suma, rt60, 1.0, okresowy=True, **kw) * poziom


def ton_okresowy(f: float, L: int, rozstrojenie_c=(0.0,), ksztalt="pila", vib_hz=0.0, vib_c=0.0, rng=None):
    """Ciągły ton (bordun) dokładnie okresowy w pętli: częstotliwość zaokrąglona do całkowitej liczby
    cykli na pętlę (błąd < 0,5 centa), wibrato jako modulacja fazy o całkowitej liczbie cykli."""
    rng = rng or np.random.default_rng(0)
    t = np.arange(L) / SR
    dl = L / SR
    wynik = np.zeros(L)
    for c in rozstrojenie_c:
        fc = round(dsp.centy(f, c) * dl) / dl
        fv = dsp.lfo_okresowe(vib_hz, dl) if vib_hz else 0.0
        beta = (fc * (2 ** (vib_c / 1200) - 1) / fv) if fv else 0.0       # dewiacja → indeks modulacji fazy
        ph = fc * t + beta * np.sin(dsp.DWA_PI * (fv * t + rng.random())) / dsp.DWA_PI + rng.random()
        wynik += dsp._czytaj_tabele("pila", ph, fc * 1.01) if ksztalt == "pila" else np.sin(dsp.DWA_PI * ph)
    return wynik / len(rozstrojenie_c)


def szum_okresowy(L: int, rng, kolor="bialy"):
    """Szum, który jest okresowy (kształtowany w FFT o rozmiarze pętli) — tła bez szwu."""
    return dsp.szum(L, rng, kolor)


def tasma(x: np.ndarray, okres_s: float, centy_dev: float = 3.0, hz_cel: float = 0.5) -> np.ndarray:
    """Falowanie „taśmy”: opóźnienie modulowane wolnym LFO (całkowita liczba cykli na pętlę)."""
    L = x.shape[-1]
    f = dsp.lfo_okresowe(hz_cel, okres_s)
    amp = (2 ** (centy_dev / 1200) - 1) / (dsp.DWA_PI * f) * SR       # amplituda opóźnienia w próbkach
    t = np.arange(L) / SR
    d = 50 + amp * np.sin(dsp.DWA_PI * f * t)
    return np.vstack([dsp.opoznienie_ulamkowe(k, d, okresowy=True) for k in dsp.stereo(x)])


def segmenty(u: Utwor, siatka):
    """Rozwija siatkę akordów [(takt, miara, czas_miar, bas, 'nuty'), …] (wygodny zapis kilku akordów w takcie)."""
    wynik = []
    for wpis in siatka:
        takt, akordy = wpis[0], wpis[1:]
        if isinstance(akordy[0], str):
            akordy = [(0.0, u.metrum, akordy[0], akordy[1])]
        for m, d, bas, voic in akordy:
            wynik.append((takt, m, d, bas, voic.split()))
    return wynik


def _dwa(takt, a, b, c, d, metrum=4):
    """Takt z dwoma akordami po pół taktu."""
    return (takt, (0.0, metrum / 2, a, b), (metrum / 2, metrum / 2, c, d))


# ================================================================================================
# 4.3.1. mus_lobby — „Złoty salon” (96 BPM, a-moll, 16 taktów, lounge / deep house)
# ================================================================================================
SIATKA_LOBBY = [
    (1, "A1", "C4 E4 G4 B4"), (2, "F1", "A3 C4 E4 G4"), (3, "C2", "B3 D4 E4 G4"), (4, "G1", "A3 B3 D4 E4"),
    (5, "A1", "C4 E4 G4 B4"), (6, "F1", "A3 C4 E4 G4"), (7, "C2", "B3 D4 E4 G4"), (8, "G1", "A3 B3 D4 E4"),
    (9, "D2", "F3 A3 C4 E4"), (10, "A1", "C4 E4 G4 B4"), (11, "F1", "A3 C4 E4 G4"),
    _dwa(12, "E2", "A3 B3 D4 E4", "E2", "G#3 B3 D4 E4"),
    (13, "D2", "F3 A3 C4 E4"), (14, "A1", "C4 E4 G4 B4"), (15, "Bb1", "A3 C4 D4 F4"), (16, "E2", "G#3 B3 D4 F4"),
]


@utwor("mus_lobby", bpm=96, takty=16, packs=["lobby"])
def mus_lobby(rng):
    u = Utwor("mus_lobby", 96, 16, ziarno=101)
    seg = segmenty(u, SIATKA_LOBBY)
    m = u.miara
    for i, (takt, m0, dm, bas, voic) in enumerate(seg):
        f_nut = [hz(n) for n in voic]
        # piano elektryczne: synkopowane akordy na „i” 2 i „i” 4 (+ cichy akord na „raz” co drugi takt)
        uderzenia = [(1.5, 0.75, 0.85), (3.5, 0.9, 0.8)]
        if takt % 2 == 1:
            uderzenia.insert(0, (0.0, 1.2, 0.6))
        for mi, dl, sila in uderzenia:
            if not (m0 <= mi < m0 + dm):
                continue
            sila *= u.rng.uniform(0.9, 1.1)
            for j, f in enumerate(f_nut):
                x = ins.piano_el(f, dl * m + 1.6, gate=dl * m, sila=sila)
                u.dodaj("ep", x, takt, mi, pan=(j - 1.5) * 0.18, przesuniecie_s=u.human(8) + j * 0.004)
        # pad aksamitny: cały akord przez czas segmentu
        for j, f in enumerate([hz(bas) * 4] + f_nut):
            x = ins.pad_nuta(f, dm * m + 1.0, atak=0.6, wybrzmienie=0.9, rozstrojenie_c=7, rng=u.rng, gate=dm * m)
            u.dodaj("pad", x, takt, m0, pan=(j - 2) * 0.3)
        # bas: „raz” i „i” 3 (pryma, w co drugim takcie kwinta), przejście w taktach 4/8/12/16
        fb = hz(bas)
        if m0 == 0:
            u.dodaj("bas", ins.bas_sub(fb, 1.25 * m, nas=1.6), takt, 0.0)
        if m0 + dm > 2.5:
            f2 = fb * (1.5 if takt % 2 == 0 and takt not in (12, 16) else 1.0)
            u.dodaj("bas", ins.bas_sub(f2, 0.9 * m, nas=1.6), takt, 2.5)
        if takt in (4, 8, 12, 16) and m0 + dm >= 4:
            nast = seg[(i + 1) % len(seg)][3]
            u.dodaj("bas", ins.bas_sub(hz(nast) * 2 ** (-1 / 12), 0.45 * m, nas=1.6), takt, 3.5)
    for takt in range(1, 17):
        for mi in (0, 2):                                     # miękka stopa na 1 i 3
            u.dodaj("stopa", ins.stopa(0.6, 58, 42, 0.03, 0.18, 0.08, 1.3, u.rng), takt, mi)
        for mi in (1, 3):                                     # rimshot na 2 i 4
            u.dodaj("rim", ins.rimshot(u.rng), takt, mi, pan=0.15, przesuniecie_s=u.human(5))
        for k in range(4):                                    # szczotki: ósemki ze swingiem 58%
            for off, akc in ((0.0, 0.6), (0.58, 1.0)):
                u.dodaj("szczotki", ins.szczotka(u.rng, 0.22, akc * u.rng.uniform(0.85, 1.1)), takt, k + off,
                        pan=-0.25, przesuniecie_s=u.human(4))
        if takt >= 13:                                        # hi-hat szesnastkami w taktach 13–16
            for k in range(16):
                u.dodaj("hat", ins.hihat(0.05, rng=u.rng) * (1.0 if k % 2 else 0.6), takt, k * 0.25, pan=0.3)
    for takt in (1, 9):                                        # dzwonek z motywem Cebuliona
        for mi, nu, dl in ((0.0, "G4", 0.5), (0.5, "C5", 0.5), (1.0, "E5", 0.5), (1.5, "G5", 2.0)):
            u.dodaj("dzwonek", ins.dzwonek(hz(nu), 2.5, r=2.0, i0=2.0, i1=0.2, tau=0.9), takt, mi, pan=0.2)

    L = u.L
    s = {n: u.zawin(n) for n in u.sciezki}
    pomp = u.pompowanie(2.5, miary=(0, 2))
    s["ep"] = dsp.chorus(s["ep"] * (1 + 0.12 * u.lfo(2 / u.takt_s)[None, :] * np.array([[1], [-1]])), 0.6, 1.5, 9, 0.25,
                         okresowy=True)
    s["pad"] = dsp.chorus(dsp.lp(s["pad"], 1100, rzad=2, okresowy=True), 0.4, 3.0, 14, 0.5, okresowy=True) * pomp
    s["bas"] = dsp.lp(s["bas"], 900, okresowy=True) * pomp
    s["dzwonek"] = dsp.echo(s["dzwonek"], 0.75 * u.miara, 0.35, 0.45, pingpong=True, lp_hz=4500, okresowy=True)
    s["szczotki"] = dsp.szerokosc(s["szczotki"], 1.2)
    poziomy = {"ep": 0, "pad": -8, "bas": -3, "stopa": -6, "rim": -16, "szczotki": -17, "dzwonek": -9, "hat": -22}
    s = wyrownaj({k: (v, poziomy[k]) for k, v in s.items()})
    mokry = poglos_szyna(s, {"ep": 0.35, "pad": 0.45, "dzwonek": 0.6, "rim": 0.4, "szczotki": 0.3, "hat": 0.3,
                             "bas": 0.0, "stopa": 0.05}, 2.2, 0.45, jasnosc=0.5)
    return u.miks(s) + mokry


# ================================================================================================
# 4.3.2. mus_s1 — „Neon Highway” (120 BPM, a-moll, 16 taktów, synthwave)
# ================================================================================================
SIATKA_S1 = [
    (1, "A1", "A3 C4 E4"), (2, "F1", "A3 C4 F4"), (3, "C2", "G3 C4 E4"), (4, "G1", "G3 B3 D4"),
    (5, "A1", "A3 C4 E4"), (6, "F1", "A3 C4 F4"), (7, "C2", "G3 C4 E4"), (8, "G1", "G3 B3 D4"),
    (9, "F1", "A3 C4 F4"), (10, "G1", "G3 B3 D4"), (11, "E2", "G3 B3 E4"), (12, "A1", "A3 C4 E4"),
    (13, "F1", "A3 C4 F4"), (14, "G1", "G3 B3 D4"), (15, "E2", "A3 B3 E4"), (16, "E2", "G#3 B3 E4"),
]
# lead (takty 9–16): (takt, miara, czas w miarach, nuta); w takcie 9 motyw Cebuliona G–C–E–G
LEAD_S1 = [
    (9, 0, 0.5, "G4"), (9, 0.5, 0.5, "C5"), (9, 1.0, 0.5, "E5"), (9, 1.5, 2.0, "G5"), (9, 3.5, 0.5, "E5"),
    (10, 0, 1.0, "A5"), (10, 1, 0.5, "G5"), (10, 1.5, 0.5, "E5"), (10, 2, 1.5, "D5"), (10, 3.5, 0.5, "E5"),
    (11, 0, 1.5, "E5"), (11, 1.5, 0.5, "D5"), (11, 2, 1.0, "C5"), (11, 3, 1.0, "D5"),
    (12, 0, 3.0, "E5"), (12, 3, 1.0, "A4"),
    (13, 0, 0.5, "C5"), (13, 0.5, 0.5, "D5"), (13, 1, 1.0, "E5"), (13, 2, 1.0, "G5"), (13, 3, 1.0, "E5"),
    (14, 0, 1.5, "D5"), (14, 1.5, 0.5, "E5"), (14, 2, 1.0, "D5"), (14, 3, 1.0, "C5"),
    (15, 0, 2.0, "A4"), (15, 2, 1.0, "D5"), (15, 3, 1.0, "E5"),
    (16, 0, 3.0, "E5"), (16, 3, 0.75, "B4"),
]


@utwor("mus_s1", bpm=120, takty=16, packs=["s1"])
def mus_s1(rng):
    u = Utwor("mus_s1", 120, 16, ziarno=102)
    seg = segmenty(u, SIATKA_S1)
    m = u.miara
    for takt, m0, dm, bas, voic in seg:
        f_nut = [hz(n) for n in voic]
        # pad supersaw: cały takt
        pad = sum(dsp.supersaw(f, dm * m + 0.6, 7, 15, u.rng, 0.9) for f in f_nut)
        pad *= dsp.adsr(n_probek(dm * m + 0.6), 0.08, 0.3, 0.85, 0.5, gate=dm * m)
        u.dodaj("pad", pad, takt, m0)
        # bas: pulsujące ósemki na prymie (co druga ósemka lekko ciszej)
        for k in range(8):
            x = ins.bas_pila(hz(bas), 0.5 * m * 0.92, fc=500, env_hz=1200, tau=0.12, q=1.1, sub=0.5)
            u.dodaj("bas", x * (1.0 if k % 2 == 0 else 0.85), takt, k * 0.5)
        # arpeggiator: szesnastki góra-dół po dźwiękach akordu (oktawy 4–5)
        dzw = sorted(f_nut)
        tony = [f * 2 for f in dzw] + [f * 4 for f in dzw]
        wzor = [0, 1, 2, 3, 4, 5, 4, 3, 2, 1, 0, 1, 2, 3, 4, 3]
        for k in range(16):
            x = ins.arp_kwadrat(tony[wzor[k] % len(tony)], 0.3, 0.25, 0.12, 3200)
            u.dodaj("arp", x * (1.0 if k % 4 == 0 else 0.8), takt, k * 0.25)
    nuty_lead = [(u.pozycja(t, mi), d * m * 0.96, hz(n)) for t, mi, d, n in LEAD_S1]
    lead, _, _ = ins.linia_mono(nuty_lead, u.dlugosc + 0.5, "pila", glide=0.04, vibrato=(5.5, 12.0, 0.25),
                                atak=0.012, wybrzmienie=0.15, okres=u.dlugosc)
    lead2, _, _ = ins.linia_mono([(s, d, f * 1.004) for s, d, f in nuty_lead], u.dlugosc + 0.5, "kwadrat",
                                 glide=0.04, vibrato=(5.5, 12.0, 0.25), atak=0.012, wybrzmienie=0.15, okres=u.dlugosc)
    u.dodaj("lead", dsp.svf(lead + 0.4 * lead2, 2800, 0.8, "lp"), 1, 0.0)
    for takt in range(1, 17):
        for mi in range(4):
            u.dodaj("stopa", ins.stopa(0.45, 120, 45, 0.04, 0.12, 0.35, 1.8, u.rng), takt, mi)
        for mi in (1, 3):
            u.dodaj("werbel", ins.werbel(0.3, 190, 0.05, 2200, 0.09, 0.85, u.rng), takt, mi)
        for k in range(8):
            otwarty = (k == 7 and takt % 2 == 0)
            h = ins.hihat(0.3 if otwarty else 0.06, otwarty=otwarty, rng=u.rng)
            u.dodaj("hat", h * (1.0 if k % 2 else 0.7), takt, k * 0.5, pan=0.25, przesuniecie_s=u.human(3))
    for k, f in enumerate([180, 180, 140, 140, 110, 110]):          # przejście tom-tomów w takcie 16
        u.dodaj("tomy", ins.tom(f, 0.5, 0.15, u.rng) * (0.8 + 0.04 * k), 16, 2.5 + k * 0.25, pan=0.4 - 0.16 * k)

    s = {n: u.zawin(n) for n in u.sciezki}
    pomp = u.pompowanie(4.0)
    s["bas"] = s["bas"] * pomp
    s["pad"] = dsp.chorus(dsp.lp(s["pad"], 2500, rzad=2, okresowy=True), 0.5, 2.5, 12, 0.4, okresowy=True) * pomp
    s["arp"] = dsp.redukcja_bitow(s["arp"], 12)
    s["arp"] = dsp.echo(s["arp"], 0.75 * m, 0.35, 0.55, pingpong=True, lp_hz=3500, okresowy=True)
    s["lead"] = dsp.echo(dsp.chorus(s["lead"], 0.8, 1.2, 8, 0.3, okresowy=True), 0.75 * m, 0.25, 0.3,
                         pingpong=True, lp_hz=3000, okresowy=True)
    # werbel z bramkowanym pogłosem (gated reverb lat 80.): pogłos 1,2 s ucięty bramką po 250 ms
    mokry_w = dsp.poglos(s["werbel"], 1.2, 1.0, okresowy=True)
    t = np.arange(u.L) / SR
    od_uderzenia = (t - m) % (2 * m)
    bramka = np.clip((0.25 - od_uderzenia) / 0.02, 0, 1)
    s["werbel"] = s["werbel"] + 0.8 * mokry_w * bramka
    poziomy = {"bas": -3, "arp": -8, "pad": -9, "lead": -5, "stopa": 0, "werbel": -4, "hat": -16, "tomy": -8}
    s = wyrownaj({k: (v, poziomy[k]) for k, v in s.items()}, odniesienie=-22)
    mokry = poglos_szyna(s, {"pad": 0.3, "lead": 0.35, "arp": 0.25, "werbel": 0.2, "tomy": 0.4, "hat": 0.1},
                         1.6, 0.35, jasnosc=0.55)
    return tasma(u.miks(s) + mokry, u.dlugosc, 3.0, 0.5)


# ================================================================================================
# 4.3.3–4.3.4. mus_s2 / mus_s2_fs — „Skarbiec Faraona” / „Noc nad piramidami” (100 BPM, D hidżaz, 16 taktów)
# ================================================================================================
AKORDY_S2 = ["D", "D", "Eb", "D", "Gm", "Cm", "Eb", "D", "Gm", "Gm", "D", "D", "Eb", "Cm", "Eb", "D"]
VOICING_S2 = {"D": "D3 F#3 A3", "Eb": "Eb3 G3 Bb3", "Gm": "D3 G3 Bb3", "Cm": "C3 Eb3 G3"}
CHOR_S2 = {"D": "D3 F#3 A3 D4", "Eb": "Eb3 G3 Bb3 Eb4", "Gm": "D3 G3 Bb3 D4", "Cm": "C3 Eb3 G3 C4"}
KOMORKA_S2 = {"D": "D4 Eb4 F#4 G4", "Eb": "Eb4 F#4 G4 Bb4", "Gm": "G3 A3 Bb3 D4", "Cm": "C4 D4 Eb4 G4"}
# „ud”: frazy 2-taktowe w taktach 1–8, odpowiedzi w 9–16 (takt, miara, czas w miarach, nuta)
UD_S2 = [
    (1, 0, .5, "D4"), (1, .5, .5, "Eb4"), (1, 1, .5, "F#4"), (1, 1.5, .5, "G4"), (1, 2, 1, "A4"), (1, 3, .5, "G4"),
    (1, 3.5, .5, "F#4"), (2, 0, 1.5, "Eb4"), (2, 1.5, 2.5, "D4"),
    (3, 0, .5, "G4"), (3, .5, .5, "F#4"), (3, 1, .5, "G4"), (3, 1.5, .5, "Bb4"), (3, 2, 1, "A4"), (3, 3, .5, "G4"),
    (3, 3.5, .5, "F#4"), (4, 0, 1, "Eb4"), (4, 1, .5, "F#4"), (4, 1.5, .5, "Eb4"), (4, 2, 2, "D4"),
    (5, 0, .5, "Bb4"), (5, .5, .5, "A4"), (5, 1, 1, "G4"), (5, 2, .5, "D4"), (5, 2.5, .5, "G4"), (5, 3, 1, "Bb4"),
    (6, 0, 1, "C5"), (6, 1, .5, "Bb4"), (6, 1.5, .5, "A4"), (6, 2, 1, "G4"), (6, 3, 1, "Eb4"),
    (7, 0, .5, "G4"), (7, .5, .5, "F#4"), (7, 1, 1, "Eb4"), (7, 2, .5, "F#4"), (7, 2.5, .5, "G4"), (7, 3, .5, "F#4"),
    (7, 3.5, .5, "Eb4"), (8, 0, 3, "D4"),
    (10, 2, .5, "G4"), (10, 2.5, .5, "A4"), (10, 3, 1, "Bb4"),
    (12, 2, .5, "A4"), (12, 2.5, .5, "G4"), (12, 3, .5, "F#4"), (12, 3.5, .5, "Eb4"),
    (14, 2, .5, "Eb4"), (14, 2.5, .5, "D4"), (14, 3, 1, "C4"),
    (16, 2, .5, "F#4"), (16, 2.5, .5, "G4"), (16, 3, .25, "F#4"), (16, 3.25, .25, "Eb4"), (16, 3.5, .5, "D4"),
]
NEY_S2 = [
    (9, 0, 3, "D5"), (9, 3, 1, "C5"), (10, 0, 2, "Bb4"), (10, 2, 2, "A4"), (11, 0, 4, "A4"),
    (12, 0, 2, "F#4"), (12, 2, 1, "G4"), (12, 3, 1, "A4"), (13, 0, 3, "Bb4"), (13, 3, 1, "G4"),
    (14, 0, 2, "Eb5"), (14, 2, 2, "D5"), (15, 0, 2, "C5"), (15, 2, 1, "Bb4"), (15, 3, 1, "A4"), (16, 0, 2, "A4"),
]


def _s2_wspolne(u: Utwor, rng):
    """Bordun smyczków D2 A2 D3 A3 (ciągły, okresowy) z tremolo — wspólny dla mus_s2 i mus_s2_fs."""
    dron = np.zeros(u.L)
    for f in ("D2", "A2", "D3", "A3"):
        dron += ton_okresowy(hz(f), u.L, (-10, 10), "pila", 5.0, 6.0, rng)
    trem = 1.0 + 0.1 * u.lfo(2.5 / u.miara)
    return dsp.lp(dsp.stereo(dron * trem) * np.array([[1.0], [0.97]]), 1500, rzad=2, okresowy=True)


def _maqsum(u: Utwor, nazwa, takt, glosnosc=1.0, wypelnienie=False):
    for poz, z in rytm("DT.TD.T.", 0.5):
        u.dodaj(nazwa, ins.darbuka(z, u.rng) * glosnosc * u.rng.uniform(0.85, 1.05), takt, poz,
                pan=-0.2 if z == "D" else 0.15, przesuniecie_s=u.human(6))
    for poz in (1.0, 3.5):                                      # ciche „ka” w pauzach — groove
        u.dodaj(nazwa, ins.darbuka("K", u.rng) * 0.5 * glosnosc, takt, poz, pan=0.25, przesuniecie_s=u.human(6))
    if wypelnienie:
        for k in range(8):
            u.dodaj(nazwa, ins.darbuka("T" if k % 2 == 0 else "K", u.rng) * (0.6 + 0.05 * k) * glosnosc, takt,
                    2.0 + k * 0.25, pan=0.3 * (-1) ** k)


@utwor("mus_s2", bpm=100, takty=16, packs=["s2"])
def mus_s2(rng):
    u = Utwor("mus_s2", 100, 16, ziarno=103)
    m = u.miara
    for takt, ak in enumerate(AKORDY_S2, start=1):
        for j, nu in enumerate(VOICING_S2[ak].split()):
            x = ins.smyczki_nuta(hz(nu), 4 * m + 1.0, atak=0.8, wybrzmienie=1.0, rng=u.rng, gate=4 * m)
            u.dodaj("akordy", x, takt, 0, pan=(j - 1) * 0.4)
        _maqsum(u, "darbuka", takt)
        for k in range(16):
            u.dodaj("shaker", ins.shaker(u.rng) * (1.0 if k % 2 else 0.55), takt, k * 0.25, pan=0.35,
                    przesuniecie_s=u.human(4))
        if takt % 2 == 1:
            u.dodaj("czynele", ins.czynele_palcowe(2350, 1.2, 0.25, u.rng), takt, 0, pan=0.3)
        if takt in (1, 5, 9, 13):
            u.dodaj("taiko", ins.taiko(1.2, 70, 38, 0.3, u.rng), takt, 0)
    for takt, mi, d, nu in UD_S2:
        x = ins.ud(hz(nu), d * m + 0.8, u.rng)
        x *= dsp.adsr(len(x), 0.001, 0.3, 0.9, 0.25, gate=d * m + 0.3)
        u.dodaj("ud", x, takt, mi, pan=-0.15, przesuniecie_s=u.human(7))
    ney = ins.ney_linia([(u.pozycja(t, mi), d * m * 0.95, hz(nu)) for t, mi, d, nu in NEY_S2], u.dlugosc + 1.0,
                        u.rng, okres=u.dlugosc)
    u.dodaj("ney", ney, 1, 0, pan=0.15)

    s = {n: u.zawin(n) for n in u.sciezki}
    s["bordun"] = _s2_wspolne(u, rng)
    s["akordy"] = dsp.lp(s["akordy"], 1200, okresowy=True)
    s["ney"] = dsp.chorus(s["ney"], 0.3, 1.0, 10, 0.2, okresowy=True)
    poziomy = {"bordun": -12, "akordy": -15, "darbuka": -3, "taiko": -3, "ud": -5, "ney": -6, "czynele": -15,
               "shaker": -21}
    s = wyrownaj({k: (v, poziomy[k]) for k, v in s.items()})
    mokry = poglos_szyna(s, {"ud": 0.4, "ney": 0.5, "darbuka": 0.3, "taiko": 0.35, "czynele": 0.5, "akordy": 0.3,
                             "bordun": 0.2, "shaker": 0.2}, 2.8, 0.5, jasnosc=0.4, odbicia_ms=(25, 41, 67))
    return u.miks(s) + mokry


@utwor("mus_s2_fs", bpm=100, takty=16, packs=["s2", "gry-dalsze"])
def mus_s2_fs(rng):
    u = Utwor("mus_s2_fs", 100, 16, ziarno=104)
    m = u.miara
    for takt, ak in enumerate(AKORDY_S2, start=1):
        # zespół taiko ósemkami (nisko / średnio na zmianę), akcent na 1 i 3
        for k in range(8):
            nisko = k % 2 == 0
            akcent = 1.0 if k in (0, 4) else 0.65
            x = ins.taiko(0.9, 70 if nisko else 105, 38 if nisko else 60, 0.25 if nisko else 0.18, u.rng)
            u.dodaj("taiko", x * akcent, takt, k * 0.5, pan=-0.2 if nisko else 0.2, przesuniecie_s=u.human(4))
        _maqsum(u, "darbuka", takt, 0.9, wypelnienie=(takt % 4 == 0))
        # ostinato smyczków szesnastkami (komórka dopasowana do akordu, w skali hidżaz)
        kom = [hz(n) for n in KOMORKA_S2[ak].split()]
        for k in range(16):
            f = kom[k % 4] * (2 if (k // 4) % 2 else 1)
            x = ins.smyczki_nuta(f, 0.16, atak=0.005, wybrzmienie=0.06, rozstrojenie_c=6, rng=u.rng, gate=0.08)
            u.dodaj("ostinato", x * (1.0 if k % 4 == 0 else 0.75), takt, k * 0.25, pan=0.3 * (-1) ** (k // 2))
        # chór „aaa”: cały takt
        ch = ins.chor(nuty_hz(CHOR_S2[ak]), 4 * m + 0.8, "a", atak=0.3, wybrzmienie=0.7, rng=u.rng)
        u.dodaj("chor", dsp.szerokosc(dsp.stereo(ch), 1.0), takt, 0)
        # gwiazdy: szesnastkowe arpeggio dzwonków FM 1:3,5 w oktawie 6
        tony = sorted(nuty_hz(VOICING_S2[ak]))
        for k in range(16):
            f = tony[k % 3] * 8 * (2 if k % 8 >= 4 else 1)
            u.dodaj("gwiazdy", ins.krysztal(f, 0.6, 2.5, 0.4, 0.25), takt, k * 0.25, pan=0.6 * np.sin(k * 1.3))
        # „dęte”: narastanie przez cały takt co 4 takty (wejście w następny „raz”)
        if takt % 4 == 0:
            nast = AKORDY_S2[takt % 16]
            for j, nu in enumerate(CHOR_S2[nast].split()):
                x = ins.deta_nuta(hz(nu), 4 * m + 0.3, gate=4 * m, f_od=300, f_do=3500, tau_filtra=10.0, atak=4 * m * 0.9,
                                  rng=u.rng, t_otwarcia=4 * m * 0.5)
                u.dodaj("dete", x, takt, 0, pan=(j - 1.5) * 0.3)
        if takt in (1, 9):
            u.dodaj("gong", ins.gong(73.42, 5.0, u.rng, skala_zanikow=0.5), takt, 0)
    s = {n: u.zawin(n) for n in u.sciezki}
    s["bordun"] = _s2_wspolne(u, rng)
    s["ostinato"] = dsp.lp(s["ostinato"], 2500, okresowy=True)
    s["dete"] = dsp.lp(s["dete"], 5000, okresowy=True)
    poziomy = {"taiko": 0, "darbuka": -5, "ostinato": -6, "chor": -7, "dete": -7, "gwiazdy": -14, "gong": -9,
               "bordun": -12}
    s = wyrownaj({k: (v, poziomy[k]) for k, v in s.items()}, odniesienie=-22)
    mokry = poglos_szyna(s, {"ostinato": 0.3, "chor": 0.5, "dete": 0.4, "gwiazdy": 0.6, "gong": 0.4, "taiko": 0.25,
                             "darbuka": 0.2, "bordun": 0.2}, 3.5, 0.5, jasnosc=0.45)
    return u.miks(s) + mokry


def nuty_hz(tekst):
    return [hz(n) for n in tekst.split()]


# ================================================================================================
# 4.3.5–4.3.6. mus_s3 / mus_s3_fs — „Echo jaskini” / „Komnata zorzy” (90 BPM, E lidyjska, 12 taktów)
# ================================================================================================
SIATKA_S3 = [
    (1, "E2", "G#3 B3 D#4 F#4"), (2, "E2", "A#3 C#4 F#4"), (3, "E2", "G#3 B3 D#4 F#4"), (4, "E2", "A#3 C#4 F#4"),
    (5, "G#2", "G#3 B3 D#4 F#4"), (6, "C#2", "E3 G#3 B3 D#4"), _dwa(7, "B1", "B3 E4 F#4", "B1", "B3 D#4 F#4"),
    (8, "A#1", "A#3 C#4 F#4"), (9, "E2", "G#3 B3 D#4 F#4"), (10, "E2", "A#3 C#4 F#4"), (11, "C#2", "E3 G#3 B3 D#4"),
    _dwa(12, "B1", "B3 E4 F#4", "B1", "B3 D#4 F#4"),
]
CELESTA_S3 = [
    (5, 0, 1, "B5"), (5, 1, 1, "G#5"), (5, 2, 1, "F#5"), (5, 3, 1, "D#5"),
    (6, 0, 1.5, "E5"), (6, 1.5, .5, "G#5"), (6, 2, 2, "B5"),
    (7, 0, 1, "F#5"), (7, 1, 1, "E5"), (7, 2, 2, "D#5"),
    (8, 0, 1, "C#5"), (8, 1, 2, "A#5"), (8, 3, 1, "F#5"),
    (9, 0, 2, "G#5"), (9, 2, 1, "F#5"), (9, 3, 1, "D#5"),
    (10, 0, 1.5, "A#5"), (10, 1.5, .5, "C#6"), (10, 2, 1, "A#5"), (10, 3, 1, "F#5"),
    (11, 0, 1, "G#5"), (11, 1, 1, "E5"), (11, 2, 1, "D#5"), (11, 3, 1, "B4"),
    (12, 0, 1, "E5"), (12, 1, 1, "F#5"), (12, 2, 2, "D#5"),
]


def _s3_wspolne(u: Utwor, seg, celesta=True, arp_szesnastki=False):
    m = u.miara
    for i, (takt, m0, dm, bas, voic) in enumerate(seg):
        f_nut = [hz(n) for n in voic]
        for j, f in enumerate(f_nut):                         # pad: sinusy + przyciemnione piły, wolny atak
            n = n_probek(dm * m + 1.6)
            x = dsp.sinus(dsp.centy(f, 6), n, u.rng.random()) + dsp.sinus(dsp.centy(f, -6), n, u.rng.random())
            x += 0.15 * dsp.sinus(f * 2, n) + dsp.db(-18) * dsp.pila(f, n, u.rng.random()) * 2
            x *= dsp.adsr(n, 1.2, 0.5, 0.9, 1.4, gate=dm * m)
            u.dodaj("pad", x, takt, m0, pan=(j - 1.5) * 0.35)
        u.dodaj("sub", ins.bas_sub(hz(bas), dm * m + 0.3, gate=dm * m - 0.1, nas=1.2), takt, m0)
        # kryształowe dzwonki: arpeggio (ósemki albo szesnastki) po dźwiękach akordu, oktawy 5–6
        tony = sorted(f_nut)
        tony = [f * 2 for f in tony] + [f * 4 for f in tony]
        krok = 0.25 if arp_szesnastki else 0.5
        liczba = int(dm / krok)
        wzor = list(range(len(tony))) + list(range(len(tony) - 2, 0, -1))
        for k in range(liczba):
            idx = wzor[(k + int(m0 / krok)) % len(wzor)]
            x = ins.krysztal(tony[idx], 1.6, 3.0, 0.6, 0.9 if not arp_szesnastki else 0.5)
            u.dodaj("dzwonki", x * (1.0 if k % 2 == 0 else 0.8), takt, m0 + k * krok, pan=0.4 * (-1) ** k,
                    przesuniecie_s=u.human(4))
        # kalimba: 2-taktowe ostinato
        if m0 == 0:
            tk = sorted(f_nut)
            wz = ([(0, 0), (0.75, 2), (1.5, 1), (2.5, 3), (3.0, 2), (3.5, 1)] if takt % 2 == 1
                  else [(0, 1), (1.0, 3), (1.75, 2), (2.5, 0), (3.25, 2)])
            for poz, idx in wz:
                u.dodaj("kalimba", ins.kalimba(tk[idx % len(tk)] * 2, 1.2, u.rng), takt, poz, pan=-0.3,
                        przesuniecie_s=u.human(5))
    if celesta:
        for takt, mi, d, nu in CELESTA_S3:
            u.dodaj("celesta", ins.celesta(hz(nu), d * m + 1.2, 0.6), takt, mi, pan=0.1, przesuniecie_s=u.human(5))


@utwor("mus_s3", bpm=90, takty=12, packs=["s3"])
def mus_s3(rng):
    u = Utwor("mus_s3", 90, 12, ziarno=105)
    seg = segmenty(u, SIATKA_S3)
    _s3_wspolne(u, seg)
    for takt in range(1, 13):
        u.dodaj("stopa", ins.stopa(0.8, 55, 40, 0.04, 0.22, 0.05, 1.2, u.rng), takt, 0)
        for k in range(8):
            u.dodaj("tiki", ins.szklany_tik(u.rng.uniform(7000, 9000), u.rng) * (1.0 if k % 2 else 0.6), takt, k * 0.5,
                    pan=u.rng.uniform(-0.5, 0.5))
    krople = int(0.3 * u.dlugosc)
    for _ in range(krople):
        t0 = u.rng.uniform(0, u.dlugosc)
        f0 = u.rng.uniform(900, 1500)
        u.dodaj("krople", ins.kropla(u.rng, f0, f0 * 0.42), 1, 0, pan=u.rng.uniform(-0.8, 0.8), przesuniecie_s=t0)
    s = {n: u.zawin(n) for n in u.sciezki}
    s["pad"] = dsp.chorus(dsp.lp(s["pad"], 1800, okresowy=True), 6 / u.dlugosc, 3.0, 15, 0.5, okresowy=True)
    poziomy = {"dzwonki": -10, "celesta": -6, "kalimba": -9, "pad": -11, "sub": -9, "stopa": -8, "tiki": -24,
               "krople": -18}
    s = wyrownaj({k: (v, poziomy[k]) for k, v in s.items()})
    mokry = poglos_szyna(s, {"dzwonki": 0.6, "celesta": 0.5, "kalimba": 0.45, "pad": 0.4, "krople": 0.7, "tiki": 0.5,
                             "stopa": 0.1}, 3.5, 0.6, predelay=0.04, jasnosc=0.6)
    return u.miks(s) + mokry


@utwor("mus_s3_fs", bpm=90, takty=12, packs=["s3", "gry-dalsze"])
def mus_s3_fs(rng):
    u = Utwor("mus_s3_fs", 90, 12, ziarno=106)
    m = u.miara
    seg = segmenty(u, SIATKA_S3)
    _s3_wspolne(u, seg, celesta=True, arp_szesnastki=True)
    for takt, m0, dm, bas, voic in seg:
        for k in range(int(dm / 0.5)):                       # pulsujący bas ósemkami
            x = ins.bas_pila(hz(bas) * 2, 0.5 * m * 0.9, fc=350, env_hz=900, tau=0.1, q=1.0, sub=0.6)
            u.dodaj("bas", x * (1.0 if k % 2 == 0 else 0.8), takt, m0 + k * 0.5)
        ch_f = [hz(n) for n in voic][:3]
        okres_samoglosek = 6 * u.takt_s                      # „a” → „o” w 3 takty i z powrotem (2 cykle na pętlę)
        t_off = u.pozycja(takt, m0)
        sciezka = (lambda tt, t_off=t_off: 0.5 - 0.5 * np.cos(dsp.DWA_PI * (tt + t_off) / okres_samoglosek))
        ch = ins.chor(ch_f, dm * m + 0.8, atak=0.4, wybrzmienie=0.7, rng=u.rng, sciezka_samoglosek=sciezka)
        u.dodaj("chor", dsp.szerokosc(dsp.stereo(ch), 1.0), takt, m0)
    for takt in range(1, 13):
        for mi in range(4):
            u.dodaj("stopa", ins.stopa(0.6, 70, 42, 0.04, 0.18, 0.08, 1.3, u.rng), takt, mi)
        if takt % 4 == 0:                                     # narastanie: szum + ton Sheparda przez ostatnią miarę
            d = m
            n = n_probek(d)
            t = np.arange(n) / SR
            sz = dsp.przemiataj(dsp.szum(n, u.rng, "rozowy"), "bp", 800, 7000, d, q=2.0)
            x = (sz * 0.6 + ins.ton_sheparda(d, 1.2, 60, 7, srodek=900, sigma_okt=1.0)) * (t / d) ** 2
            u.dodaj("narastanie", x, takt, 3)
    for _ in range(int(4 * u.dlugosc)):
        f = u.rng.uniform(6000, 10000)
        x = dsp.sinus(f, 0.06) * dsp.atak_zanik(0.06, 0.001, 0.015)
        u.dodaj("iskry", x, 1, 0, pan=u.rng.uniform(-0.8, 0.8), przesuniecie_s=u.rng.uniform(0, u.dlugosc))
    s = {n: u.zawin(n) for n in u.sciezki}
    s["pad"] = dsp.chorus(dsp.lp(s["pad"], 1800, okresowy=True), 6 / u.dlugosc, 3.0, 15, 0.5, okresowy=True)
    pomp = u.pompowanie(3.0)
    s["bas"] = dsp.lp(s["bas"], 1200, okresowy=True) * pomp
    s["pad"] = s["pad"] * pomp
    poziomy = {"bas": -4, "dzwonki": -9, "chor": -8, "stopa": -5, "narastanie": -12, "iskry": -22, "pad": -11,
               "celesta": -7, "kalimba": -12, "sub": -12}
    s = wyrownaj({k: (v, poziomy[k]) for k, v in s.items()}, odniesienie=-22)
    mokry = poglos_szyna(s, {"dzwonki": 0.55, "chor": 0.5, "celesta": 0.5, "pad": 0.4, "iskry": 0.7, "kalimba": 0.4,
                             "narastanie": 0.5}, 4.0, 0.6, predelay=0.04, jasnosc=0.6)
    return u.miks(s) + mokry


# ================================================================================================
# 4.3.7. mus_bigwin — „Złoty deszcz” (128 BPM, C-dur, 8 taktów)
# ================================================================================================
SIATKA_BW = [
    (1, "C2", "E4 G4 C5"), (2, "B1", "D4 G4 B4"), (3, "A1", "E4 A4 C5"), (4, "F1", "F4 A4 C5"),
    (5, "G1", "E4 G4 C5"), (6, "F1", "F4 A4 C5"), (7, "D2", "D4 F4 A4 C5"), (8, "G1", "D4 F4 G4 B4"),
]


@utwor("mus_bigwin", bpm=128, takty=8, packs=["gry-dalsze"], gain_db=4)
def mus_bigwin(rng):
    u = Utwor("mus_bigwin", 128, 8, ziarno=107)
    m = u.miara
    seg = segmenty(u, SIATKA_BW)
    for takt, m0, dm, bas, voic in seg:
        f_nut = [hz(n) for n in voic]
        for mi in (0.0, 1.5):                                 # „dęte”: uderzenia na „raz” i „i” 2
            for j, f in enumerate(f_nut):
                x = ins.deta_nuta(f, 0.55, gate=0.28, f_od=800, f_do=5000, tau_filtra=0.15, atak=0.006, rng=u.rng)
                u.dodaj("dete", x, takt, mi, pan=(j - 1) * 0.35)
        for k in range(8):                                    # supersaw ósemkami
            x = sum(dsp.supersaw(f, 0.5 * m * 0.9, 7, 12, u.rng, 0.9) for f in f_nut)
            x *= dsp.adsr(n_probek(0.5 * m * 0.9), 0.004, 0.08, 0.7, 0.05)
            u.dodaj("supersaw", x, takt, k * 0.5)
        for k in range(8):                                    # bas oktawowy
            f = hz(bas) * (2 if k % 2 else 1)
            u.dodaj("bas", ins.bas_pila(f, 0.5 * m * 0.9, fc=400, env_hz=900, tau=0.08, sub=0.4), takt, k * 0.5)
        if takt not in (1, 5):                                # dzwonki: szesnastkowe arpeggio
            tony = sorted(f_nut)
            tony = [f * 2 for f in tony] + [f * 4 for f in tony]
            for k in range(16):
                idx = [0, 1, 2, 3, 2, 1][k % 6] % len(tony)
                u.dodaj("dzwonki", ins.glockenspiel(tony[idx], 0.8, 0.35), takt, k * 0.25, pan=0.3 * (-1) ** k)
    for takt in (1, 5):                                        # motyw Cebuliona w dzwonkach
        for mi, nu in ((0.0, "G5"), (0.5, "C6"), (1.0, "E6"), (1.5, "G6")):
            u.dodaj("dzwonki", ins.glockenspiel(hz(nu), 1.5, 0.7) * 1.4, takt, mi, pan=0.1)
    for takt in range(1, 9):
        for mi in range(4):
            u.dodaj("stopa", ins.stopa(0.45, 110, 45, 0.04, 0.14, 0.35, 1.8, u.rng), takt, mi)
        for mi in (1, 3):
            u.dodaj("klask", ins.klasniecie(u.rng), takt, mi, pan=0.05)
        for mi in (0.5, 1.5, 2.5, 3.5):
            u.dodaj("hat", ins.hihat(0.3, otwarty=True, tau=0.12, rng=u.rng), takt, mi, pan=0.25)
    for takt in (4, 8):                                        # przejścia kotłów / tom-tomów
        for k, f in enumerate([100, 100, 80, 80]):
            u.dodaj("tomy", ins.tom(f, 0.6, 0.25, u.rng), takt, 3 + k * 0.25, pan=0.3 - 0.2 * k)
    s = {n: u.zawin(n) for n in u.sciezki}
    pomp = u.pompowanie(6.0)
    s["supersaw"] = dsp.lp(s["supersaw"], 6000, rzad=2, okresowy=True) * pomp
    s["bas"] = dsp.lp(s["bas"], 500, okresowy=True) * u.pompowanie(3.0)
    poziomy = {"dete": 0, "supersaw": -8, "stopa": 0, "klask": -6, "hat": -16, "dzwonki": -9, "tomy": -6, "bas": -4}
    s = wyrownaj({k: (v, poziomy[k]) for k, v in s.items()}, odniesienie=-22)
    s["klask"] = s["klask"] + dsp.poglos(s["klask"], 0.6, 1.0, okresowy=True) * 0.3
    mokry = poglos_szyna(s, {"dete": 0.3, "supersaw": 0.2, "dzwonki": 0.45, "klask": 0.3, "tomy": 0.4},
                         1.8, 0.35, jasnosc=0.6)
    return u.miks(s) + mokry


# ================================================================================================
# 4.3.8. mus_napiecie — warstwa napięcia (bez tempa i tonacji, 8 s)
# ================================================================================================
@utwor("mus_napiecie", bpm=0, takty=0, packs=["gry-dalsze"], dlugosc=8.0, gain_db=-6)
def mus_napiecie(rng):
    L = n_probek(8.0)
    t = np.arange(L) / SR
    shep = ins.ton_sheparda(8.0, okres=8.0, f_baza=27.5, glosy=9, srodek=440, sigma_okt=1.2, petla=True)
    shep_st = np.vstack([shep, np.roll(shep, n_probek(0.011))])          # lekka szerokość (dekorelacja 11 ms)
    trem = 1.0 - 0.6 * (0.5 + 0.5 * np.sin(dsp.DWA_PI * 12.0 * t))       # 96 cykli na pętlę
    sm = dsp.bp(np.vstack([szum_okresowy(L, rng, "rozowy"), szum_okresowy(L, rng, "rozowy")]), 1700, 0.9,
                okresowy=True) * trem
    dud = dsp.lp(szum_okresowy(L, rng, "brazowy"), 80, rzad=2, okresowy=True)
    dud = dud * (0.55 + 0.45 * np.sin(dsp.DWA_PI * 0.25 * t))              # 2 cykle na pętlę
    sciezki = {"shepard": (shep_st, 0), "smyczki": (sm, -10), "dudnienie": (dsp.stereo(dud), -6)}
    s = wyrownaj(sciezki)
    return sum(s.values())
