"""
analiza.py — pomiary dźwięku bez słuchania: głośność EBU R128 / ITU-R BS.1770-4 (LUFS), szczyt prawdziwy
(dBTP), RMS, składowa stała, szew pętli, korelacja stereo i spektrogram PNG.

Pomiar LUFS jest zaimplementowany tutaj (NumPy) i niezależnie sprawdzany przez ffmpeg (filtr ebur128) w
sprawdz.py — dwa niezależne pomiary, które muszą się zgadzać, to dobry argument na obronie.
"""

from __future__ import annotations

from pathlib import Path

import numpy as np

import dsp
from dsp import SR

# Filtr ważący K z normy BS.1770-4 dla 48 kHz: półka wysoka (+4 dB ≈ wpływ głowy) i górnoprzepustowy RLB.
_K_POLKA = (np.array([1.53512485958697, -2.69169618940638, 1.19839281085285]),
            np.array([1.0, -1.69065929318241, 0.73248077421585]))
_K_HP = (np.array([1.0, -2.0, 1.0]), np.array([1.0, -1.99004745483398, 0.99007225036621]))


def lufs(x: np.ndarray, okresowy: bool = False) -> float:
    """Głośność zintegrowana (LUFS) według BS.1770-4: ważenie K, bloki 400 ms co 100 ms, bramka
    bezwzględna −70 LUFS i względna −10 LU. Pętle (okresowy=True) mierzymy po powieleniu do ≥ 4 s.
    Dźwięk krótszy niż 400 ms zwraca −inf (tak samo jak ffmpeg)."""
    x = dsp.stereo(x) if np.asarray(x).ndim == 2 else np.asarray(x, dtype=float)[None, :]
    if okresowy:
        powt = max(2, int(np.ceil(4.0 * SR / x.shape[-1])))
        x = np.tile(x, (1, powt))
    n = x.shape[-1]
    blok, krok = dsp.n_probek(0.4), dsp.n_probek(0.1)
    if n < blok:
        return float("-inf")
    y = dsp.filtruj(x, [_K_POLKA, _K_HP], okresowy=okresowy)
    kw = np.concatenate([np.zeros((y.shape[0], 1)), np.cumsum(y ** 2, axis=1)], axis=1)
    starty = np.arange(0, n - blok + 1, krok)
    ms = (kw[:, starty + blok] - kw[:, starty]) / blok           # średni kwadrat każdego bloku i kanału
    z = ms.sum(axis=0)
    gl = -0.691 + 10 * np.log10(np.maximum(z, 1e-20))
    z1 = z[gl > -70.0]
    if not len(z1):
        return float("-inf")
    prog = -0.691 + 10 * np.log10(z1.mean()) - 10.0
    z2 = z[(gl > -70.0) & (gl > prog)]
    return float(-0.691 + 10 * np.log10(z2.mean()))


def glosnosc_chwilowa_max(x: np.ndarray, okno: float = 0.4) -> float:
    """Największa głośność chwilowa (okno 400 ms; dla krótszych dźwięków — cały dźwięk)."""
    x = dsp.stereo(x) if np.asarray(x).ndim == 2 else np.asarray(x, dtype=float)[None, :]
    y = dsp.filtruj(x, [_K_POLKA, _K_HP])
    blok = min(dsp.n_probek(okno), y.shape[-1])
    kw = np.concatenate([np.zeros((y.shape[0], 1)), np.cumsum(y ** 2, axis=1)], axis=1)
    st = np.arange(0, y.shape[-1] - blok + 1, max(1, blok // 4))
    z = ((kw[:, st + blok] - kw[:, st]) / blok).sum(axis=0)
    return float(-0.691 + 10 * np.log10(max(z.max(), 1e-20)))


def dbtp(x: np.ndarray) -> float:
    """Szczyt prawdziwy w dBTP (interpolacja ×4)."""
    return dsp.na_db(dsp.szczyt_prawdziwy(x))


def rms_db(x: np.ndarray) -> float:
    x = np.asarray(x, dtype=float)
    return dsp.na_db(np.sqrt(np.mean(x ** 2)))


def dc_db(x: np.ndarray) -> float:
    """Składowa stała (średnia próbek) w dBFS — największa z kanałów."""
    x = np.asarray(x, dtype=float)
    m = np.abs(x.mean(axis=-1))
    return dsp.na_db(float(np.max(m)))


def szew_petli(x: np.ndarray, okno: float = 0.02) -> dict:
    """Ocena szwu pętli (koniec → początek) bez słuchania.

    * skok_db — różnica próbek x[0] − x[−1] względem RMS całości (dB),
    * wsp_predykcji — błąd przewidywania liniowego w szwie (x[0] vs 2·x[−1] − x[−2]) podzielony przez
      99. percentyl takich błędów w oknie ±20 ms wokół szwu. ≤ 1,5 → szew nie odstaje od zwykłego przebiegu
      fali (brak trzasku); trzask daje wartości rzędu kilku–kilkudziesięciu,
    * roznica_widma_db — średnia różnica widm 20 ms przed i 20 ms po szwie (skok barwy)."""
    x = dsp.stereo(x) if np.asarray(x).ndim == 2 else np.asarray(x, dtype=float)[None, :]
    n = x.shape[-1]
    w = dsp.n_probek(okno)
    zszyte = np.concatenate([x[:, n - w:], x[:, :w]], axis=1)    # fragment wokół szwu: koniec + początek
    e = zszyte[:, 2:] - 2 * zszyte[:, 1:-1] + zszyte[:, :-2]       # błąd predykcji liniowej (2. różnica)
    idx_szwu = w - 2                                               # e[k] przewiduje próbkę k+2 → x[0] to k = w−2
    e_szew = np.abs(e[:, idx_szwu]).max()
    e_tlo = np.percentile(np.abs(np.delete(e, [idx_szwu - 1, idx_szwu, idx_szwu + 1], axis=1)), 99)
    rms = np.sqrt(np.mean(x ** 2)) + 1e-12
    skok = np.abs(x[:, 0] - x[:, -1]).max()
    okno_h = np.hanning(w)

    def roznica_widm(przed, po):
        A = np.abs(np.fft.rfft(przed * okno_h, axis=1)).mean(axis=0) + 1e-9
        B = np.abs(np.fft.rfft(po * okno_h, axis=1)).mean(axis=0) + 1e-9
        waga = (A + B) / (A + B).sum()
        return float(np.sum(waga * np.abs(20 * np.log10(A / B))))

    p = n // 2                                                     # odniesienie: ta sama miara w środku pętli
    return {
        "skok_db": dsp.na_db(skok / rms),
        "wsp_predykcji": float(e_szew / (e_tlo + 1e-12)),
        "roznica_widma_db": roznica_widm(x[:, n - w:], x[:, :w]),
        "roznica_widma_srodek_db": roznica_widm(x[:, p - w:p], x[:, p:p + w]),
    }


def korelacja_stereo(x: np.ndarray) -> tuple[float, float]:
    """(korelacja L/P, spadek głośności po zsumowaniu do mono w dB). Mono → (1, 0)."""
    x = np.asarray(x, dtype=float)
    if x.ndim == 1:
        return 1.0, 0.0
    l, p = x[0] - x[0].mean(), x[1] - x[1].mean()
    kor = float(np.sum(l * p) / (np.sqrt(np.sum(l ** 2) * np.sum(p ** 2)) + 1e-12))
    e_st = np.mean(x ** 2)
    e_mono = np.mean(((x[0] + x[1]) / 2) ** 2)
    return kor, float(10 * np.log10((e_st + 1e-20) / (e_mono + 1e-20)))


def mierz(x: np.ndarray, petla: bool = False) -> dict:
    """Komplet pomiarów jednego sygnału."""
    kor, spadek = korelacja_stereo(x)
    wynik = {
        "czas_s": np.asarray(x).shape[-1] / SR,
        "kanaly": 1 if np.asarray(x).ndim == 1 else 2,
        "lufs": lufs(x, okresowy=petla),
        "chwilowa_max": glosnosc_chwilowa_max(x),
        "dbtp": dbtp(x),
        "rms_db": rms_db(x),
        "dc_db": dc_db(x),
        "korelacja": kor,
        "spadek_mono_db": spadek,
    }
    if petla:
        wynik.update(szew_petli(x))
    return wynik


# ================================================================================================
# Spektrogram PNG (NumPy + Pillow) — do obejrzenia „okiem”: aliasing, sam szum, ucięte pasmo, trzaski
# ================================================================================================
def _paleta(v: np.ndarray) -> np.ndarray:
    """Mapa kolorów (czarny → fiolet → pomarańcz → żółty → biały) dla v w 0…1."""
    punkty = np.array([0.0, 0.25, 0.5, 0.75, 1.0])
    kolory = np.array([[0, 0, 4], [80, 18, 123], [212, 72, 66], [252, 186, 40], [252, 255, 220]], dtype=float)
    return np.stack([np.interp(v, punkty, kolory[:, k]) for k in range(3)], axis=-1).astype(np.uint8)


def spektrogram_png(x: np.ndarray, sciezka, tytul: str = "", szer: int = 1000, wys: int = 420,
                    zakres_db: float = 100.0, log_f: bool = False) -> None:
    """Spektrogram (okno Hanna 2048, krok dobrany do szerokości). Oś pionowa: częstotliwość liniowo
    0–24 kHz (aliasing widać jako linie „odbite” od góry) albo logarytmicznie 20 Hz–24 kHz."""
    from PIL import Image, ImageDraw

    s = dsp.mono(x)
    nfft = 2048
    krok = max(64, (len(s) - nfft) // szer + 1)
    s = np.concatenate([np.zeros(nfft // 2), s, np.zeros(nfft)])
    ramki = max(1, (len(s) - nfft) // krok)
    idx = np.arange(nfft)[None, :] + krok * np.arange(ramki)[:, None]
    S = np.abs(np.fft.rfft(s[idx] * np.hanning(nfft), axis=1)) / (nfft / 4)
    S_db = 20 * np.log10(S + 1e-10)
    S_db = np.clip((S_db + zakres_db) / zakres_db, 0, 1)        # 0 dBFS → 1, −zakres → 0
    f = np.fft.rfftfreq(nfft, 1.0 / SR)
    if log_f:
        fy = np.geomspace(20, SR / 2, wys)
    else:
        fy = np.linspace(0, SR / 2, wys)
    kolumny = np.stack([np.interp(fy, f, S_db[r]) for r in range(ramki)], axis=1)   # (wys, ramki)
    xs = np.linspace(0, ramki - 1, szer)
    obraz = np.stack([np.interp(xs, np.arange(ramki), kolumny[r]) for r in range(wys)], axis=0)
    rgb = _paleta(obraz[::-1])
    margines_l, margines_d = 52, 22
    img = Image.new("RGB", (szer + margines_l, wys + margines_d + 18), (20, 20, 24))
    img.paste(Image.fromarray(rgb), (margines_l, 18))
    d = ImageDraw.Draw(img)
    d.text((margines_l, 2), tytul, fill=(230, 230, 230))
    for fz in ([100, 1000, 10000] if log_f else [1000, 5000, 10000, 15000, 20000]):
        if log_f:
            y = 18 + wys - int(np.interp(np.log(fz), np.log(fy), np.arange(wys)))
        else:
            y = 18 + wys - int(fz / (SR / 2) * wys)
        d.line([(margines_l - 4, y), (margines_l + szer, y)], fill=(90, 90, 100))
        d.text((2, y - 6), f"{fz / 1000:g}k", fill=(200, 200, 200))
    dl = len(dsp.mono(x)) / SR
    for i in range(int(dl) + 1):
        xx = margines_l + int(i / max(dl, 1e-6) * szer)
        d.line([(xx, 18 + wys), (xx, 18 + wys + 4)], fill=(200, 200, 200))
        d.text((xx + 2, 18 + wys + 5), f"{i}s", fill=(200, 200, 200))
    Path(sciezka).parent.mkdir(parents=True, exist_ok=True)
    img.save(sciezka)


def przebieg_png(x: np.ndarray, sciezka, tytul: str = "", szer: int = 1000, wys: int = 200) -> None:
    """Przebieg czasowy (obwiednia min/max) — widać ucięcia, trzaski, ciszę, kształt obwiedni."""
    from PIL import Image, ImageDraw

    s = dsp.mono(x)
    kol = np.array_split(s, szer)
    mn = np.array([k.min() if len(k) else 0 for k in kol])
    mx = np.array([k.max() if len(k) else 0 for k in kol])
    img = Image.new("RGB", (szer, wys + 16), (20, 20, 24))
    d = ImageDraw.Draw(img)
    d.text((4, 2), tytul, fill=(230, 230, 230))
    srod = 16 + wys // 2
    for i in range(szer):
        d.line([(i, srod - int(mx[i] * wys / 2)), (i, srod - int(mn[i] * wys / 2))], fill=(250, 190, 60))
    d.line([(0, srod), (szer, srod)], fill=(80, 80, 90))
    img.save(sciezka)
