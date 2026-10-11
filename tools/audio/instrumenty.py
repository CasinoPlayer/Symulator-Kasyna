"""
instrumenty.py — instrumenty zbudowane z prymitywów dsp.py: perkusja syntetyczna (stopa, werbel, hi-hat,
klaśnięcie, tom, rimshot, szczotki, shaker, taiko, darbuka, czynele, gong, dzwon, talerz) oraz instrumenty
melodyczne (piano elektryczne FM, pad, basy, arpeggiator, lead, supersaw, „dęte”, chór, dzwonki, celesta,
kalimba, ud, ney, smyczki, ton Sheparda).

Każda funkcja zwraca sygnał mono (n,), chyba że opis mówi inaczej. Panoramę, pogłos i miks robi sekwencer.
"""

from __future__ import annotations

import numpy as np

import dsp
from dsp import SR, czas, n_probek


def _rng(rng, ziarno=0):
    return rng if rng is not None else np.random.default_rng(ziarno)


# ================================================================================================
# Perkusja
# ================================================================================================
def stopa(dlugosc=0.45, f0=120.0, f1=45.0, t_gliss=0.05, tau=0.14, klik=0.35, nas=1.6, rng=None,
          jasnosc_kliku=4000.0):
    """Stopa (kick): sinus z szybko opadającą wysokością f0 → f1 (wykładniczo), zanik tau, „klik” pałki
    (krótki szum + wysoki ton) i nasycenie tanh (harmoniczne — stopa słyszalna także na telefonie)."""
    rng = _rng(rng, 11)
    t = czas(dlugosc)
    f = f1 + (f0 - f1) * np.exp(-t / max(t_gliss / 3.0, 1e-4))
    cialo = dsp.sinus(f, len(t)) * dsp.atak_zanik(dlugosc, 0.0006, tau)
    cialo = dsp.nasycenie(cialo, nas) if nas else cialo
    k = dsp.bp(dsp.szum(len(t), rng) * np.exp(-t / 0.0025), jasnosc_kliku, 0.8)
    k += 0.5 * dsp.sinus(1600, len(t)) * np.exp(-t / 0.004)
    return cialo + klik * k


def werbel(dlugosc=0.35, ton=185.0, tau_ton=0.06, szum_fc=2500.0, tau_szum=0.1, miks_szumu=0.75, rng=None):
    """Werbel: dwa mody membrany (ton i ton·1,65) + szum sprężyn (BP) + krótki „trzask” ataku."""
    rng = _rng(rng, 12)
    t = czas(dlugosc)
    f = ton * (1 + 0.25 * np.exp(-t / 0.01))
    membrana = (dsp.sinus(f, len(t)) * np.exp(-t / tau_ton)
                + 0.45 * dsp.sinus(f * 1.65, len(t)) * np.exp(-t / (tau_ton * 0.6)))
    sprezyny = dsp.bp(dsp.szum(len(t), rng), szum_fc, 0.7) * dsp.atak_zanik(dlugosc, 0.001, tau_szum)
    sprezyny += 0.4 * dsp.hp(dsp.szum(len(t), rng), 6000) * dsp.atak_zanik(dlugosc, 0.0005, tau_szum * 0.5)
    trzask = dsp.bp(dsp.szum(len(t), rng), 4500, 1.2) * np.exp(-t / 0.003)
    return 0.8 * membrana + miks_szumu * sprezyny + 0.6 * trzask


_HAT_F = np.array([205.3, 304.4, 369.6, 522.7, 540.0, 800.0])   # klasyczny metaliczny zestaw (Roland TR-808)


def hihat(dlugosc=0.08, otwarty=False, tau=None, rng=None, jasnosc=1.0):
    """Hi-hat: sześć fal prostokątnych o nieharmonicznych częstotliwościach (metal) + szum, filtr HP/BP.
    Zamknięty: zanik ~25 ms; otwarty: ~150 ms."""
    rng = _rng(rng, 13)
    tau = tau or (0.15 if otwarty else 0.022)
    dl = max(dlugosc, tau * 5)
    t = czas(dl)
    metal = sum(dsp.kwadrat(f * 1.47, len(t), faza0=rng.random()) for f in _HAT_F)
    metal = dsp.bp(metal, 10000 * jasnosc, 0.9)
    metal = dsp.hp(metal, 7000 * jasnosc, rzad=2)
    sz = dsp.hp(dsp.szum(len(t), rng), 8000 * jasnosc)
    env = dsp.atak_zanik(dl, 0.0004, tau)
    return dopnij(0.6 * metal / 3 + 0.5 * sz, env)


def dopnij(x, env):
    return x * env


def klasniecie(rng=None, dlugosc=0.35, fc=1200.0):
    """Klaśnięcie: 4 krótkie impulsy szumu co ~8 ms (kilka dłoni) i dłuższy ogon, filtr pasmowy."""
    rng = _rng(rng, 14)
    t = czas(dlugosc)
    env = np.zeros(len(t))
    for i, d in enumerate([0.0, 0.009, 0.017, 0.026]):
        tt = t - d
        env += np.where(tt >= 0, np.exp(-np.maximum(tt, 0) / 0.004), 0) * (0.8 + 0.2 * i / 3)
    tt = t - 0.026
    env += 0.7 * np.where(tt >= 0, np.exp(-np.maximum(tt, 0) / 0.06), 0)
    sz = dsp.szum(len(t), rng)
    return dsp.bp(sz, fc, 1.1) * env + 0.35 * dsp.bp(sz, fc * 2.2, 1.5) * env


def tom(f=140.0, dlugosc=0.5, tau=0.15, rng=None):
    """Tom-tom: sinus z opadającą wysokością (1,35·f → f) + uderzenie szumu."""
    rng = _rng(rng, 15)
    t = czas(dlugosc)
    ff = f * (1 + 0.35 * np.exp(-t / 0.03))
    cialo = dsp.sinus(ff, len(t)) * dsp.atak_zanik(dlugosc, 0.001, tau)
    cialo += 0.25 * dsp.sinus(ff * 1.5, len(t)) * np.exp(-t / (tau * 0.4))
    uderz = dsp.lp(dsp.szum(len(t), rng), 3000) * np.exp(-t / 0.008)
    return dsp.nasycenie(cialo, 1.3) + 0.3 * uderz


def rimshot(rng=None, dlugosc=0.08):
    """Rimshot: krótki trzask obręczy (BP 1,8 kHz) i ton drewna 400 Hz."""
    rng = _rng(rng, 16)
    t = czas(dlugosc)
    return (dsp.bp(dsp.szum(len(t), rng), 1800, 2.5) * np.exp(-t / 0.006) * 1.4
            + dsp.sinus(400, len(t)) * np.exp(-t / 0.012) * 0.7
            + dsp.sinus(1720, len(t)) * np.exp(-t / 0.005) * 0.3)


def szczotka(rng=None, dlugosc=0.2, akcent=1.0):
    """Szczotki: miękkie „przeciągnięcie” szumu HP 6 kHz (obwiednia narasta ~30 ms, gaśnie ~90 ms)."""
    rng = _rng(rng, 17)
    t = czas(dlugosc)
    env = (1 - np.exp(-t / 0.015)) * np.exp(-t / (0.06 + 0.03 * akcent))
    return dsp.hp(dsp.bp(dsp.szum(len(t), rng), 7000, 0.6), 4500) * env * akcent


def shaker(rng=None, dlugosc=0.12, fc=7000.0):
    """Shaker / piasek: szum BP z łagodnym atakiem."""
    rng = _rng(rng, 18)
    t = czas(dlugosc)
    env = (1 - np.exp(-t / 0.008)) * np.exp(-t / 0.035)
    return dsp.bp(dsp.szum(len(t), rng), fc, 1.2) * env


def taiko(dlugosc=1.0, f0=70.0, f1=38.0, tau=0.3, rng=None):
    """Taiko: głęboki sinus 70 → 38 Hz, szum membrany LP 500 Hz, „klapnięcie” skóry, nasycenie."""
    rng = _rng(rng, 19)
    t = czas(dlugosc)
    f = f1 + (f0 - f1) * np.exp(-t / 0.06)
    cialo = dsp.sinus(f, len(t)) * dsp.atak_zanik(dlugosc, 0.002, tau)
    cialo += 0.3 * dsp.sinus(f * 1.58, len(t)) * np.exp(-t / (tau * 0.35))
    skora = dsp.lp(dsp.szum(len(t), rng), 500) * dsp.atak_zanik(dlugosc, 0.001, 0.05)
    klap = dsp.bp(dsp.szum(len(t), rng), 900, 1.0) * np.exp(-t / 0.01)
    return dsp.nasycenie(cialo + 0.5 * skora, 2.0) + 0.4 * klap


def darbuka(rodzaj="D", rng=None):
    """Darbuka / bęben ramowy: 'D' = dum (nisko), 'T' = tek (jasny brzeg), 'K' = ka (ciemniejszy tek)."""
    rng = _rng(rng, 20)
    if rodzaj == "D":
        dl = 0.5
        t = czas(dl)
        f = 60 + 35 * np.exp(-t / 0.04)
        x = dsp.sinus(f, len(t)) * dsp.atak_zanik(dl, 0.001, 0.15)
        x += 0.5 * dsp.lp(dsp.szum(len(t), rng), 300) * np.exp(-t / 0.03)
        x += 0.15 * dsp.sinus(f * 2.3, len(t)) * np.exp(-t / 0.05)
        return dsp.nasycenie(x, 1.5)
    dl = 0.18
    t = czas(dl)
    jasny = rodzaj == "T"
    fc = 3000 if jasny else 2000
    x = dsp.bp(dsp.szum(len(t), rng), fc, 3.0) * np.exp(-t / (0.03 if jasny else 0.022)) * 1.6
    x += dsp.sinus(900 if jasny else 700, len(t)) * np.exp(-t / 0.01) * 0.6
    x += 0.25 * dsp.parcjaly(1450 if jasny else 1150, [1, 1.62, 2.31], [0.05, 0.03, 0.02], dl, rng=rng)
    return x * (1.0 if jasny else 0.5)


def czynele_palcowe(f=2350.0, dlugosc=1.0, tau=0.25, rng=None):
    """Czynele palcowe: dzwon FM o niecałkowitym stosunku 1:2,76 (metaliczne, nieharmoniczne)."""
    x = dsp.dzwon_fm(f, dlugosc, r=2.76, i0=3.0, i1=0.6, tau=tau, tau_i=tau * 0.5)
    x += 0.5 * dsp.dzwon_fm(f * 1.007, dlugosc, r=2.76, i0=2.0, i1=0.4, tau=tau * 1.3)
    return x


_GONG_STOSUNKI = [1, 1.52, 2.03, 2.48, 2.97, 3.53, 4.11, 4.75, 5.42, 6.20, 7.10, 8.30]


def gong(f0=73.42, dlugosc=3.5, rng=None, skala_zanikow=1.0, stereo_wyj=True, jasnosc=1.0):
    """Wielki gong świątynny (doc 05 § 3.5): 12 parcjałów, zaniki 4,0 → 1,2 s (wyższe krócej), ROZKWIT
    (parcjały od 5. narastają 100–400 ms po uderzeniu — cecha prawdziwego gongu), dryft wysokości −15 c
    w 2 s, dudnienia (każdy parcjał jako para sinusów odstrojonych o 0,3–1,5 Hz), pałka (szum LP 300 Hz),
    stereo przez różne fazy i dudnienia w L i P. Zwraca stereo (2, n) albo mono."""
    rng = _rng(rng, 21)
    t = czas(dlugosc)
    dryf = 2.0 ** (-15.0 / 1200.0 * np.clip(t / 2.0, 0, 1))
    kanaly = []
    for kanal in range(2 if stereo_wyj else 1):
        x = np.zeros(len(t))
        for i, s in enumerate(_GONG_STOSUNKI):
            f = f0 * s
            tau = np.interp(i, [0, 11], [4.0, 1.2]) * skala_zanikow / 3.0
            amp = (1.0 / (1 + 0.25 * i)) * (jasnosc if i > 5 else 1.0)
            d = 0.3 + 1.2 * rng.random()
            ph1, ph2 = rng.random(), rng.random()
            sig = (np.sin(dsp.DWA_PI * (dsp.faza(f * dryf - d / 2, len(t)) + ph1))
                   + np.sin(dsp.DWA_PI * (dsp.faza(f * dryf + d / 2, len(t)) + ph2))) * 0.5
            env = np.exp(-t / tau)
            if i >= 4:
                t_rozk = 0.1 + 0.3 * (i - 4) / 7
                env = env * (0.25 + 0.75 * (1 - np.exp(-t / (t_rozk / 2.5))))
            x += amp * sig * env
        palka = dsp.lp(dsp.szum(len(t), rng), 300) * np.exp(-t / 0.03) * 1.2
        x += palka
        x *= np.clip(t / 0.002, 0, 1)
        kanaly.append(x)
    return np.vstack(kanaly) if stereo_wyj else kanaly[0]


_DZWON_STOSUNKI = [0.5, 1.0, 1.183, 1.506, 2.0, 2.514, 2.662, 3.011, 4.166, 5.433]


def dzwon(f=440.0, dlugosc=3.0, tau=1.2, rng=None):
    """Dzwon kościelny / „złoty” dzwon: parcjały strojone jak w odlewanym dzwonie (hum, pryma, tercja
    mała, kwinta, nominał…), wyższe gasną szybciej."""
    rng = _rng(rng, 22)
    taus = [tau * 1.6, tau, tau * 0.8, tau * 0.7, tau * 0.6, tau * 0.4, tau * 0.35, tau * 0.3, tau * 0.2, tau * 0.15]
    amp = [0.5, 1.0, 0.6, 0.35, 0.5, 0.25, 0.2, 0.15, 0.1, 0.06]
    return dsp.parcjaly(f, _DZWON_STOSUNKI, taus, dlugosc, amp, rng=rng, rozstrojenie_hz=0.6)


def talerz(dlugosc=2.0, tau=0.9, rng=None, jasnosc=1.0, odwrocony=False):
    """Talerz (crash): ~60 nieharmonicznych parcjałów 400 Hz–14 kHz + szum HP, długi zanik.
    odwrocony=True: odwrócony w czasie (narastanie przed uderzeniem)."""
    rng = _rng(rng, 23)
    t = czas(dlugosc)
    f = np.exp(rng.uniform(np.log(400), np.log(14000), 60))
    x = np.zeros(len(t))
    for fi in f:
        x += np.sin(dsp.DWA_PI * (fi * t + rng.random())) * np.exp(-t / (tau * rng.uniform(0.3, 1.0))) / np.sqrt(fi / 400)
    x = dsp.hp(x, 2500 * jasnosc) * 0.15
    sz = dsp.hp(dsp.szum(len(t), rng), 4000 * jasnosc) * np.exp(-t / (tau * 0.8)) * 0.5
    y = (x + sz) * np.clip(t / 0.001, 0, 1)
    return dsp.odwroc(y) if odwrocony else y


def szklany_tik(f=8000.0, rng=None, dlugosc=0.03):
    """Szklany „tik” (zamiast hi-hatu w S3): bardzo krótki dzwon FM 1:3,5."""
    return dsp.dzwon_fm(f, dlugosc, r=3.5, i0=1.5, i1=0.3, tau=0.008, atak=0.0005)


def kropla(rng=None, f0=1200.0, f1=500.0):
    """Kropla wody: sinus z szybkim glissandem w dół (30 ms) i krótkim zanikiem."""
    dl = 0.09
    t = czas(dl)
    f = dsp.przemiatanie(f0, f1, dl, 0.03)
    return dsp.sinus(f, len(t)) * dsp.atak_zanik(dl, 0.001, 0.02)


# ================================================================================================
# Instrumenty melodyczne
# ================================================================================================
def piano_el(f, dlugosc, gate=None, sila=1.0, rng=None):
    """Piano elektryczne FM (w stylu Rhodesa): nośna 1:1 z indeksem malejącym 1,8 → 0,4 (τ 1,2 s) oraz
    „młoteczek” — modulator 14:1 o bardzo krótkim indeksie (τ 15 ms), który daje charakterystyczny dzwonek ataku.
    Niższe nuty brzmią dłużej, mocniejsze uderzenie = jaśniejsza barwa."""
    gate = dlugosc - 0.15 if gate is None else gate
    t = czas(dlugosc)
    n = len(t)
    i1 = (0.4 + 1.4 * sila * np.exp(-t / 1.2)) * (0.75 + 0.25 * sila)
    i2 = 0.6 * sila * np.exp(-t / 0.015)
    ph = dsp.faza(f, n)
    x = np.sin(dsp.DWA_PI * ph + i1 * np.sin(dsp.DWA_PI * ph) + i2 * np.sin(dsp.DWA_PI * 14 * ph))
    x += 0.25 * np.sin(dsp.DWA_PI * 2 * ph * 1.0007) * np.exp(-t / 0.5)         # druga harmoniczna — „ciało”
    tau = 1.8 * (220.0 / f) ** 0.35
    env = np.clip(t / 0.002, 0, 1) * np.exp(-t / tau)
    env *= np.where(t < gate, 1.0, np.exp(-(t - gate) / 0.05))
    return x * env * (0.6 + 0.4 * sila)


def pad_nuta(f, dlugosc, atak=0.6, wybrzmienie=0.8, rozstrojenie_c=7.0, rng=None, sinus_pod=0.3,
             gate=None):
    """Nuta aksamitnego padu: dwie piły odstrojone o ±rozstrojenie (dudnienia = „żywość”) + sinus
    oktawę niżej. Filtrowanie LP i chorus robi się na całej ścieżce."""
    rng = _rng(rng, 30)
    n = n_probek(dlugosc)
    x = (dsp.pila(dsp.centy(f, rozstrojenie_c), n, rng.random()) + dsp.pila(dsp.centy(f, -rozstrojenie_c), n, rng.random())) * 0.5
    x += sinus_pod * dsp.sinus(f / 2, n, rng.random())
    gate = dlugosc - wybrzmienie if gate is None else gate
    return x * dsp.adsr(n, atak, 0.4, 0.85, wybrzmienie, gate=gate)


def bas_sub(f, dlugosc, gate=None, nas=1.4):
    """Miękki bas: sinus + 2. harmoniczna (−9 dB), lekkie nasycenie (słyszalny na małych głośnikach)."""
    n = n_probek(dlugosc)
    gate = dlugosc - 0.06 if gate is None else gate
    x = dsp.sinus(f, n) + dsp.db(-9) * dsp.sinus(2 * f, n)
    return dsp.nasycenie(x * 0.8, nas) * dsp.adsr(n, 0.006, 0.25, 0.75, 0.06, gate=gate)


def bas_pila(f, dlugosc, gate=None, fc=700.0, env_hz=1200.0, tau=0.12, q=1.0, sub=0.4, nas=1.3):
    """Bas syntezatorowy: piła (+ sinus oktawę niżej) przez filtr LP z obwiednią (fc + env·e^(−t/τ))."""
    n = n_probek(dlugosc)
    t = np.arange(n) / SR
    gate = dlugosc - 0.03 if gate is None else gate
    x = dsp.pila(f, n) + sub * dsp.sinus(f / 2 if f > 50 else f, n)
    x = dsp.svf(x, fc + env_hz * np.exp(-t / tau), q, "lp")
    return dsp.nasycenie(x * 0.7, nas) * dsp.adsr(n, 0.003, 0.2, 0.8, 0.03, gate=gate)


def arp_kwadrat(f, dlugosc, pw=0.25, tau=0.16, jasnosc=3500.0):
    """Nuta arpeggiatora: kwadrat 25% (z lekką modulacją wypełnienia), krótka obwiednia „pluck”, LP."""
    n = n_probek(dlugosc)
    t = np.arange(n) / SR
    pwt = pw + 0.06 * np.sin(dsp.DWA_PI * 3.0 * t)
    x = dsp.kwadrat(f, n, pwt)
    x = dsp.svf(x, jasnosc * (0.35 + 0.65 * np.exp(-t / 0.08)) + 300, 0.9, "lp")
    return x * dsp.atak_zanik(dlugosc, 0.002, tau) * 0.7


def linia_mono(nuty, dlugosc, oscylator="pila", glide=0.04, vibrato=(5.5, 12.0, 0.25), atak=0.01,
               wybrzmienie=0.12, legato=True, okres=None):
    """Monofoniczna linia melodyczna (lead, ney, flet): jedna ciągła faza oscylatora, portamento między
    nutami (wykładnicze dojście do nowej wysokości w czasie ``glide``), wibrato narastające po ``vibrato[2]`` s
    od początku nuty, obwiednia głośności z bramką (legato: bez ponownego ataku przy nutach stykających się).

    nuty: lista (start_s, czas_s, częstotliwość). Zwraca (sygnał, krzywa częstotliwości, obwiednia)."""
    n = n_probek(dlugosc)
    t = np.arange(n) / SR
    cel = np.zeros(n)
    bramka = np.zeros(n)
    start_nuty = np.full(n, -10.0)
    nuty = sorted(nuty)
    for i, (s, d, f) in enumerate(nuty):
        a, b = n_probek(s), min(n, n_probek(s + d))
        nastepna = n_probek(nuty[i + 1][0]) if i + 1 < len(nuty) else n
        cel[a:min(n, nastepna)] = f
        bramka[a:b] = 1.0
        start_nuty[a:min(n, nastepna)] = s
    pierwsza = nuty[0][2] if nuty else 440.0
    cel[: n_probek(nuty[0][0]) if nuty else n] = pierwsza
    # portamento: jednobiegunowe wygładzanie log-częstotliwości (rekurencja na zdecymowanej siatce)
    dec = 32
    logc = np.log(cel[::dec])
    k = 1.0 - np.exp(-1.0 / (max(glide, 1e-3) / 3.0 * SR / dec))
    y = [0.0] * len(logc)
    v = logc[0]
    for i, c in enumerate(logc.tolist()):
        v += k * (c - v)
        y[i] = v
    logf = np.interp(np.arange(n), np.arange(len(y)) * dec, y)
    vf, vc, vd = vibrato
    if okres:
        vf = dsp.lfo_okresowe(vf, okres)
    od_startu = t - start_nuty
    glebokosc = vc * np.clip((od_startu - vd) / 0.3, 0, 1)
    fz = np.exp(logf) * 2.0 ** (glebokosc * np.sin(dsp.DWA_PI * vf * t) / 1200.0)
    if oscylator == "pila":
        x = dsp.pila(fz, n)
    elif oscylator == "kwadrat":
        x = dsp.kwadrat(fz, n, 0.5)
    elif oscylator == "trojkat":
        x = dsp.trojkat(fz, n)
    else:
        x = dsp.sinus(fz, n)
    # obwiednia: atak / wybrzmienie jako wygładzanie bramki (różne stałe w górę i w dół)
    ka = 1.0 - np.exp(-1.0 / (atak / 3.0 * SR / dec))
    kr = 1.0 - np.exp(-1.0 / (wybrzmienie / 3.0 * SR / dec))
    bd = bramka[::dec]
    if not legato:
        for s, d, f in nuty:
            i0 = n_probek(s) // dec
            if 0 < i0 < len(bd):
                bd[i0 - 1] = 0.0
    e = [0.0] * len(bd)
    v = 0.0
    for i, g in enumerate(bd.tolist()):
        v += (ka if g > v else kr) * (g - v)
        e[i] = v
    env = np.interp(np.arange(n), np.arange(len(e)) * dec, e)
    return x * env, fz, env


def deta_nuta(f, dlugosc, gate=None, f_od=800.0, f_do=5000.0, tau_filtra=0.15, atak=0.02, sila=1.0, rng=None,
              t_otwarcia=0.02):
    """„Dęte” syntezatorowe: 3 piły ±8 c + kwadrat oktawę wyżej przez LP otwierany od f_od do f_do
    i zamykany z czasem (obwiednia filtra). Nasycenie dla „brudu” blachy. t_otwarcia > 1 s → narastanie (swell)."""
    rng = _rng(rng, 31)
    n = n_probek(dlugosc)
    t = np.arange(n) / SR
    gate = dlugosc - 0.15 if gate is None else gate
    x = sum(dsp.pila(dsp.centy(f, c), n, rng.random()) for c in (-8, 0, 8)) / 3
    x += 0.35 * dsp.kwadrat(2 * f, n, 0.5, rng.random())
    otw = 1 - np.exp(-t / t_otwarcia)
    fc = f_od + (f_do - f_od) * sila * otw * (0.45 + 0.55 * np.exp(-t / tau_filtra))
    x = dsp.svf(x, fc, 0.9, "lp")
    x = dsp.nasycenie(x * 1.2, 1.5)
    return x * dsp.adsr(n, atak, 0.3, 0.75, 0.15, gate=gate)


def chor(nuty_hz, dlugosc, samogloska="a", atak=0.35, wybrzmienie=0.6, rng=None, okresowy=False,
         sciezka_samoglosek=None):
    """Chór „aaa”: dla każdej nuty 6 odstrojonych pił z wolnym wibratem, suma przez filtr formantowy
    (F1/F2/F3 samogłoski). sciezka_samoglosek: funkcja t → 0…1 (0 = 'a', 1 = 'o') — płynna zmiana."""
    rng = _rng(rng, 32)
    n = n_probek(dlugosc)
    t = np.arange(n) / SR
    x = np.zeros(n)
    for f in nuty_hz:
        for _ in range(6):
            vib = 2.0 ** (8.0 * np.sin(dsp.DWA_PI * (rng.uniform(4.5, 5.8) * t + rng.random())) / 1200.0)
            x += dsp.pila(dsp.centy(f, rng.uniform(-14, 14)) * vib, n, rng.random())
    x /= max(1, len(nuty_hz)) * 3.0
    x += 0.04 * dsp.szum(n, rng)            # oddech
    a = {"F1": 700.0, "F2": 1100.0, "F3": 2600.0}
    o = {"F1": 450.0, "F2": 800.0, "F3": 2830.0}
    s = sciezka_samoglosek or (lambda tt: np.zeros_like(tt) + (1.0 if samogloska == "o" else 0.0))
    mieszaj = lambda k: (lambda tt: a[k] + (o[k] - a[k]) * s(tt))  # noqa: E731
    y = dsp.formanty(x, [(mieszaj("F1"), 130.0, 1.0), (mieszaj("F2"), 160.0, 0.7), (mieszaj("F3"), 260.0, 0.25)],
                     okresowy=okresowy)
    return dsp.lp(y, 4500) * dsp.adsr(n, atak, 0.5, 0.9, wybrzmienie) * 2.2


def dzwonek(f, dlugosc=1.0, r=2.0, i0=2.0, i1=0.2, tau=0.7, tau_i=None):
    """Dzwonek FM: r = 2 → „złoty”, harmoniczny; r = 3,5 → „kryształowy”, szklany."""
    return dsp.dzwon_fm(f, dlugosc, r=r, i0=i0, i1=i1, tau=tau, tau_i=tau_i)


def krysztal(f, dlugosc=1.5, i0=3.0, i1=0.6, tau=0.9):
    """Kryształowy dzwonek FM 1:3,5 z drugą, lekko odstrojoną warstwą (połysk)."""
    x = dsp.dzwon_fm(f, dlugosc, r=3.5, i0=i0, i1=i1, tau=tau)
    x += 0.35 * dsp.dzwon_fm(f * 2.0013, dlugosc, r=3.5, i0=i0 * 0.6, i1=0.2, tau=tau * 0.6)
    return x


def celesta(f, dlugosc=1.2, tau=0.6):
    """Celesta: dzwon FM 1:1 (I 2 → 0) + parcjał ×4 (−18 dB) — miękki, „pozytywkowy” metal."""
    t = czas(dlugosc)
    x = dsp.dzwon_fm(f, dlugosc, r=1.0, i0=2.0, i1=0.0, tau=tau, tau_i=0.08)
    x += dsp.db(-18) * dsp.sinus(4 * f, len(t)) * np.exp(-t / (tau * 0.3))
    return x


def kalimba(f, dlugosc=1.0, rng=None):
    """Kalimba: Karplus–Strong z krótkim, jasnym wybrzmieniem + sinus korpusu (drewniane pudło)."""
    rng = _rng(rng, 33)
    t = czas(dlugosc)
    ks = dsp.karplus_strong(f, dlugosc, jasnosc=0.35, wybrzmienie=0.992, rng=rng)
    cialo = dsp.sinus(f, len(t)) * dsp.atak_zanik(dlugosc, 0.001, 0.4)
    klik = dsp.sinus(f * 5.4, len(t)) * np.exp(-t / 0.01) * 0.3
    return (0.5 * ks + 0.7 * cialo + klik) * np.exp(-t / 0.5)


def glockenspiel(f, dlugosc=1.2, tau=0.7):
    """Dzwonki orkiestrowe (glockenspiel): FM 1:3,5 (I 2) + wysoki parcjał 2,76."""
    t = czas(dlugosc)
    x = dsp.dzwon_fm(f, dlugosc, r=3.5, i0=2.0, i1=0.3, tau=tau)
    x += 0.3 * dsp.sinus(f * 2.76, len(t)) * np.exp(-t / (tau * 0.25))
    return x


def ud(f, dlugosc=1.2, rng=None, jasnosc=0.62):
    """„Ud” (lutnia arabska): szarpana struna Karplusa–Stronga z jasnym atakiem; na początku wysokość
    −30 c → 0 w 40 ms (szarpnięcie). Rezonanse pudła wzmacniamy korektorem."""
    rng = _rng(rng, 34)
    surowy = dsp.karplus_strong(f, dlugosc + 0.05, jasnosc=jasnosc, wybrzmienie=0.997, rng=rng)
    n = n_probek(dlugosc)
    t = np.arange(n) / SR
    c = -30.0 * np.exp(-t / 0.013)
    tempo = 2.0 ** (c / 1200.0)
    poz = np.concatenate([[0], np.cumsum(tempo[:-1])])
    x = np.interp(poz, np.arange(len(surowy)), surowy)
    kostka = dsp.bp(dsp.szum(n, rng), 2500, 1.5) * np.exp(-t / 0.004) * 0.4
    x = dsp.eq(x + kostka, [("peak", 260, 1.2, 4.0), ("peak", 1200, 1.5, 2.0), ("highshelf", 5000, 0.7, -4.0)])
    return x * dsp.adsr(n, 0.001, 0.5, 0.9, 0.1)


def ney_linia(nuty, dlugosc, rng=None, okres=None):
    """„Ney” (flet trzcinowy): sinus z 2. i 3. harmoniczną, szum oddechu przez wąski BP wokół nuty
    (Q 8) i szeroki HP, atak 150 ms, wibrato 5 Hz ±20 c narastające od 200 ms."""
    rng = _rng(rng, 35)
    ton, fz, env = linia_mono(nuty, dlugosc, "sinus", glide=0.06, vibrato=(5.0, 20.0, 0.2), atak=0.15,
                              wybrzmienie=0.2, okres=okres)
    n = len(ton)
    ph = dsp.faza(fz, n)
    harm = dsp.db(-16) * np.sin(dsp.DWA_PI * 2 * ph) + dsp.db(-24) * np.sin(dsp.DWA_PI * 3 * ph)
    oddech_szum = dsp.szum(n, rng)
    srednia_f = float(np.median(fz))
    oddech = dsp.bp(oddech_szum, srednia_f, 8.0) * dsp.db(-8) + dsp.hp(oddech_szum, 2500) * dsp.db(-30)
    return ton + harm * env + oddech * env


def smyczki_nuta(f, dlugosc, atak=0.4, wybrzmienie=0.6, rozstrojenie_c=10.0, rng=None, gate=None):
    """Smyczki (bordun, ostinato): dwie piły ±10 c z lekkim wibratem; filtr LP na ścieżce."""
    rng = _rng(rng, 36)
    n = n_probek(dlugosc)
    t = np.arange(n) / SR
    vib = 2.0 ** (6.0 * np.sin(dsp.DWA_PI * (5.2 * t + rng.random())) / 1200.0)
    x = (dsp.pila(dsp.centy(f, rozstrojenie_c) * vib, n, rng.random())
         + dsp.pila(dsp.centy(f, -rozstrojenie_c) * vib, n, rng.random())) * 0.5
    gate = dlugosc - wybrzmienie if gate is None else gate
    return x * dsp.adsr(n, atak, 0.3, 0.9, wybrzmienie, gate=gate)


def ton_sheparda(dlugosc, okres=8.0, f_baza=27.5, glosy=9, kierunek=1.0, srodek=440.0, sigma_okt=1.2,
                 petla=False):
    """Ton Sheparda–Risseta: sinusy co oktawę, każdy wznosi się o oktawę w czasie ``okres``; amplituda
    według okna Gaussa w skali log (środek, σ w oktawach) — najniższy i najwyższy są niesłyszalne,
    więc wrażenie „nieustannego wznoszenia” nie ma końca.

    petla=True: fazy początkowe dobrane rekurencyjnie (doc 05 § 8.4), tak że po czasie ``okres`` sinus i
    przechodzi w sinus i+1 z ciągłą fazą — sygnał jest okresowy (pętla idealna z definicji)."""
    n = n_probek(okres if petla else dlugosc)
    t = np.arange(n) / SR
    wynik = np.zeros(n)
    ln2 = np.log(2.0)
    # fazy początkowe (w cyklach): φ_(i+1)(0) = φ_i(T) mod 1, gdzie φ_i(T) = φ_i(0) + f_b·2^i·T / ln2
    fazy0 = np.zeros(glosy + 1)
    for i in range(glosy):
        fazy0[i + 1] = (fazy0[i] + f_baza * 2.0 ** i * okres / ln2) % 1.0
    for i in range(glosy):
        if petla:
            f_chwil = f_baza * 2.0 ** (i + t / okres)
            ph = fazy0[i] + f_baza * 2.0 ** i * okres * (2.0 ** (t / okres) - 1.0) / ln2
        else:
            f_chwil = f_baza * 2.0 ** (i + kierunek * t / okres)
            ph = dsp.faza(f_chwil, n)
        oktawy = np.log2(f_chwil / srodek)
        amp = np.exp(-0.5 * (oktawy / sigma_okt) ** 2)
        wynik += amp * np.sin(dsp.DWA_PI * ph)
    return wynik / 2.5
