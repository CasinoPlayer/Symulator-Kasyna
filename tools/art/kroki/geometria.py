"""
geometria.py — pomiary kształtu: okno ramki bębnów, marginesy 9-slice, normalizacja symboli (02 § 5.6, 5.12, 5.13).

Po co to jest
-------------
* **Okno ramki** — ramka automatu ma w środku przezroczysty prostokąt, pod którym kod rysuje bębny. Front musi znać
  jego granice (``frames.<ID>.window`` w manifeście), żeby bębny trafiły dokładnie w okno na każdym ekranie.
* **9-slice** — panel i przyciski rozciągamy jak w CSS ``border-image``: rogi zostają, środek się rozciąga.
  Trzeba wiedzieć, gdzie kończą się ozdobne rogi i zaczyna jednolity środek.
* **Normalizacja symboli** — symbole jednej gry muszą mieć spójną „masę” na bębnie; wąska siódemka nie może
  wyglądać na chudszą od szerokiej tabliczki BAR.
"""

from __future__ import annotations

import numpy as np

from .obraz import Skladowe, rgb_do_lab, rozmyj

# Wypełnienie pola symbolu (dłuższy bok obiektu / bok pola) — te same proporcje co 80 : 83 : 85% kadru
# z 01 § 5.1, więc hierarchia wielkości niskie < wysokie < specjalne zostaje zachowana.
WYPELNIENIE = {"niskie": 0.86, "wysokie": 0.89, "specjalne": 0.92}
MAKS_WYPELNIENIE = 0.94


# ------------------------------------------------------------------------------------------------
# Okno ramki
# ------------------------------------------------------------------------------------------------
def wykryj_okno(rgba: np.ndarray, uwagi: list) -> tuple[int, int, int, int] | None:
    """Największa przezroczysta składowa NIE dotykająca brzegu = okno. Krawędzie doprecyzowujemy medianą
    skanów w środkowych 60% każdego boku (mediana ignoruje ornamenty wchodzące w okno). Zwraca (x0, y0, x1, y1)."""
    a = rgba[..., 3]
    H, W = a.shape
    sk = Skladowe(a <= 16 / 255)
    kand = np.flatnonzero(~sk.brzeg)
    kand = kand[kand > 0]
    obiekt = np.argwhere(a > 0.5)
    if len(obiekt) == 0:
        return None
    oy0, ox0 = obiekt.min(0)
    oy1, ox1 = obiekt.max(0) + 1
    pole_ramki = (ox1 - ox0) * (oy1 - oy0)
    if len(kand) == 0 or sk.pole[kand].max() < 0.25 * pole_ramki:
        okno = _okno_zamalowane(rgba, uwagi)
        if okno is None:
            uwagi.append(("blad", "Q15", "nie znaleziono przezroczystego okna ramki"))
        return okno
    k = int(kand[np.argmax(sk.pole[kand])])
    x0, y0, x1, y1 = sk.x0[k], sk.y0[k], sk.x1[k], sk.y1[k]
    prost = sk.pole[k] / float((x1 - x0) * (y1 - y0))
    if prost < 0.95:
        uwagi.append(("blad", "Q15", f"okno nie jest prostokątem (prostokątność {prost:.3f})"))
    elif prost < 0.97:
        uwagi.append(("ostrzezenie", "Q15", f"okno ma zaokrąglone rogi (prostokątność {prost:.3f})"))
    return _doprecyzuj(a, (x0, y0, x1, y1))


def _doprecyzuj(a: np.ndarray, okno):
    """Od środka okna na zewnątrz: pierwszy piksel z α ≥ 0,5 na każdej linii skanowania; mediana = krawędź."""
    x0, y0, x1, y1 = okno
    cx, cy = (x0 + x1) // 2, (y0 + y1) // 2
    w, h = x1 - x0, y1 - y0
    ys = np.arange(y0 + int(0.2 * h), y1 - int(0.2 * h))
    xs = np.arange(x0 + int(0.2 * w), x1 - int(0.2 * w))

    def pierwszy(linie, start, krok, granica):
        wyn = []
        for lin in linie:
            idx = np.arange(start, granica, krok)
            trafienia = np.flatnonzero(lin[idx] >= 0.5)
            if len(trafienia):
                wyn.append(idx[trafienia[0]])
        return int(np.median(wyn)) if wyn else None

    W, H = a.shape[1], a.shape[0]
    lewa = pierwszy([a[y] for y in ys], cx, -1, -1)
    prawa = pierwszy([a[y] for y in ys], cx, 1, W)
    gora = pierwszy([a[:, x] for x in xs], cy, -1, -1)
    dol = pierwszy([a[:, x] for x in xs], cy, 1, H)
    nx0 = (lewa + 1) if lewa is not None else x0
    nx1 = prawa if prawa is not None else x1
    ny0 = (gora + 1) if gora is not None else y0
    ny1 = dol if dol is not None else y1
    return int(nx0), int(ny0), int(nx1), int(ny1)


def _okno_zamalowane(rgba: np.ndarray, uwagi: list):
    """Generator narysował ciemne szkło zamiast przezroczystości: wypełnianie od środka z tolerancją ΔE < 10;
    jeśli wynik jest prostokątny i duży — wycinamy okno (α = 0) i ostrzegamy (02 § 5.12 pkt 4)."""
    H, W = rgba.shape[:2]
    ys, xs = np.nonzero(rgba[..., 3] > 0.5)
    if len(xs) == 0:
        return None
    cy, cx = (ys.min() + ys.max()) // 2, (xs.min() + xs.max()) // 2      # środek RAMKI, nie płótna
    lab = rgb_do_lab(rgba[..., :3])
    srodek = lab[cy - 4:cy + 4, cx - 4:cx + 4].reshape(-1, 3).mean(0)
    podobne = (np.linalg.norm(lab - srodek, axis=-1) < 10) & (rgba[..., 3] > 0.5)
    pole_ramki = (xs.max() - xs.min()) * (ys.max() - ys.min())
    for maska, opis in ((podobne, "okno było zamalowane"),
                        (_okno_w_szachownicy(rgba, cx, cy, xs, ys), "okno miało narysowaną szachownicę")):
        if maska is None:
            continue
        sk = Skladowe(maska)
        k = sk.etykiety[cy, cx]
        if k == 0 or sk.brzeg[k]:
            continue
        x0, y0, x1, y1 = sk.x0[k], sk.y0[k], sk.x1[k], sk.y1[k]
        prost = sk.pole[k] / float((x1 - x0) * (y1 - y0))
        if prost < 0.95 or (x1 - x0) * (y1 - y0) < 0.25 * pole_ramki:
            continue
        rgba[y0:y1, x0:x1, 3] = 0.0
        uwagi.append(("ostrzezenie", "Q15", f"{opis} — wycięte automatycznie"))
        return int(x0), int(y0), int(x1), int(y1)
    return None


def _okno_w_szachownicy(rgba: np.ndarray, cx: int, cy: int, xs: np.ndarray, ys: np.ndarray):
    """Ramka z prawdziwą alfą NA ZEWNĄTRZ, ale z szachownicą narysowaną w oknie (częsta pomyłka generatora).
    Szachownicę wykrywamy na wycinku ze środka ramki, a potem szukamy wszystkich pikseli zgodnych z tym wzorem."""
    from .alfa import odleglosc_od_wzoru, wykryj_szachownice   # import lokalny: alfa nie zależy od geometrii
    p = int(0.15 * min(xs.max() - xs.min(), ys.max() - ys.min()))
    if p < 24:
        return None
    y0, x0 = max(0, cy - p), max(0, cx - p)
    s = wykryj_szachownice(rgba[y0:cy + p, x0:cx + p, :3])
    if s is None or s.pewnosc < 0.8:
        return None
    s.x0 += x0                                   # faza wzoru we współrzędnych całego obrazu
    s.y0 += y0
    D, _ = odleglosc_od_wzoru(rgba[..., :3], s)
    return (D <= 14 / 255) & (rgba[..., 3] > 0.5)


def sprawdz_proporcje_okna(okno, siatka, uwagi):
    """Okno musi pasować do siatki bębnów (pola kwadratowe): ±3% OK, 3–15% ostrzeżenie, > 15% błąd."""
    x0, y0, x1, y1 = okno
    jest = (x1 - x0) / max(1, (y1 - y0))
    ma_byc = siatka[0] / siatka[1]
    odch = jest / ma_byc - 1
    if abs(odch) > 0.15:
        uwagi.append(("blad", "Q15", f"proporcja okna {jest:.3f} zamiast {ma_byc:.3f} ({odch:+.1%})"))
    elif abs(odch) > 0.03:
        uwagi.append(("ostrzezenie", "Q15", f"proporcja okna {jest:.3f} zamiast {ma_byc:.3f} ({odch:+.1%}) "
                                            "→ rozciąganie pasów 9-slice"))
    return odch


# ------------------------------------------------------------------------------------------------
# 9-slice
# ------------------------------------------------------------------------------------------------
def _jednolity_odcinek(p: np.ndarray, os: int, tol_sasiad=1.5 / 255, tol_srodek=3 / 255):
    """Najdłuższy ciągły odcinek wokół środka, w którym CAŁE kolumny (os=1) albo wiersze (os=0) są prawie
    identyczne — tylko takie można rozciągać bez zniekształceń. Porównujemy pełne kolumny, a nie tylko pasmo
    środkowe, bo ozdobny róg sięgający w głąb krawędzi też musi trafić do wycinka narożnika."""
    if os == 0:
        p = p.transpose(1, 0, 2)
    # lekkie wygładzenie wzdłuż kierunku rozciągania tłumi szum generatora (inaczej każda kolumna „różna”)
    p = rozmyj(p, 1.0) if min(p.shape[:2]) > 8 else p
    n = p.shape[1]
    c = n // 2
    sasiad = np.zeros(n, dtype=np.float32)
    sasiad[1:] = np.abs(np.diff(p, axis=1)).max(-1).mean(0)
    od_srodka = np.abs(p - p[:, c:c + 1]).max(-1).mean(0)
    ok = (sasiad <= tol_sasiad) & (od_srodka <= tol_srodek)
    lo = c
    while lo - 1 >= 0 and ok[lo - 1] and ok[lo]:
        lo -= 1
    hi = c
    while hi + 1 < n and ok[hi + 1]:
        hi += 1
    return lo, hi


def marginesy_9slice(rgba: np.ndarray, pigulka: bool, uwagi: list) -> dict:
    """Wyznacza wycinki 9-slice jako ułamki wymiarów (02 § 5.13). Obraz musi być już przycięty."""
    H, W = rgba.shape[:2]
    # premultiplikacja: kolumny różniące się tylko kolorem pod przezroczystością nie są „różne”
    p = rgba.copy()
    p[..., :3] *= p[..., 3:4]
    xl, xr = _jednolity_odcinek(p, 1)
    yt, yb = _jednolity_odcinek(p, 0)
    left, right = xl + 2, W - xr + 2
    if pigulka:
        # pigułka: w pionie jest gradient fazy, więc rozciąga się tylko 2-pikselowy pasek w środku wysokości
        top = bottom = H // 2 - 1
        # lewy/prawy wycinek nie krótszy niż zaokrąglenie (≈ połowa wysokości)
        left = max(left, int(0.5 * H))
        right = max(right, int(0.5 * H))
    else:
        top, bottom = yt + 2, H - yb + 2
    srodek_w = (W - left - right) / W
    srodek_h = (H - top - bottom) / H
    if srodek_w < 0.2 or (not pigulka and srodek_h < 0.2):
        uwagi.append(("blad", "Q16", f"jednolity środek 9-slice za mały ({srodek_w:.0%} × {srodek_h:.0%})"))
    return {"top": round(top / H, 4), "right": round(right / W, 4),
            "bottom": round(bottom / H, 4), "left": round(left / W, 4)}


# ------------------------------------------------------------------------------------------------
# Normalizacja symboli
# ------------------------------------------------------------------------------------------------
def pokrycie(rgba: np.ndarray, skala: float, pole: int) -> float:
    """Jaką część pola (pole×pole px) zajmie obiekt po przeskalowaniu (piksele z α > 50%)."""
    return float((rgba[..., 3] > 0.5).sum()) * skala * skala / (pole * pole)


def srodek_optyczny(rgba: np.ndarray) -> tuple[float, float]:
    """Środek „dla oka”: średnia ze środka ciężkości alfy i środka prostokąta (02 § 5.6)."""
    a = rgba[..., 3]
    H, W = a.shape
    s = float(a.sum())
    if s <= 0:
        return W / 2, H / 2
    yy, xx = np.mgrid[0:H, 0:W]
    cx, cy = float((xx * a).sum() / s), float((yy * a).sum() / s)
    return 0.5 * cx + 0.5 * W / 2, 0.5 * cy + 0.5 * H / 2


def skale_symboli(grupa: dict, pole: int, poziom: str) -> dict:
    """Skala każdego symbolu grupy: najpierw dłuższy bok = wypełnienie × pole, potem wyrównanie pokrycia
    alfą do mediany grupy (tolerancja ±12%), ale dłuższy bok nie więcej niż 0,94 pola.

    ``grupa`` = {id: obraz przycięty ciasno (bez marginesu)}; zwraca {id: skala względem źródła}.
    """
    skale = {}
    for id_, img in grupa.items():
        h, w = img.shape[:2]
        skale[id_] = WYPELNIENIE[poziom] * pole / max(h, w)
    pokr = {i: pokrycie(grupa[i], skale[i], pole) for i in grupa}
    mediana = float(np.median(list(pokr.values())))
    for id_, img in grupa.items():
        p = pokr[id_]
        if p <= 0:
            continue
        if abs(p / mediana - 1) > 0.12:
            cel = mediana * (1.12 if p > mediana else 0.88)
            nowa = skale[id_] * np.sqrt(cel / p)
            h, w = img.shape[:2]
            skale[id_] = min(nowa, MAKS_WYPELNIENIE * pole / max(h, w))
    return skale
