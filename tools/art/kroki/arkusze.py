"""
arkusze.py — cięcie arkuszy (SHEET) na elementy i budowa fontu bitmapowego z cyfr (02 § 5.10, 5.14).

Po co to jest
-------------
ChatGPT rysuje np. 12 ikon na jednym obrazie w siatce 4×3, ale siatka nigdy nie jest idealna co do piksela.
Dlatego NIE tniemy „na sztywno” co 1/4 szerokości, tylko szukamy elementów jako spójnych plam alfy (albo jasności
na czarnym tle) i dopiero potem przypisujemy je do komórek w kolejności wierszami. Dzięki temu przesunięty
o kilkadziesiąt pikseli element nadal trafia do właściwej komórki.
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np

from .obraz import Skladowe, domkniecie


@dataclass
class Element:
    """Jeden element arkusza: prostokąt w źródle (x0, y0, x1, y1) i maska jego pikseli (w tym prostokącie)."""
    x0: int
    y0: int
    x1: int
    y1: int
    maska: np.ndarray

    @property
    def srodek(self):
        return (self.x0 + self.x1) / 2, (self.y0 + self.y1) / 2


def maska_elementow(rgba: np.ndarray, czarne: bool) -> np.ndarray:
    """ALFA → α ≥ 24/255; CZARNE → max(R, G, B) ≥ 12/255 (po zerowaniu czerni)."""
    if czarne:
        return rgba[..., :3].max(-1) >= 12 / 255
    return rgba[..., 3] >= 24 / 255


def _grupuj_wiersze(ys: np.ndarray, wiersze: int) -> np.ndarray:
    """Dzieli środki elementów na ``wiersze`` grup według największych przerw w osi Y (nierówna siatka OK)."""
    if wiersze <= 1 or len(ys) <= 1:
        return np.zeros(len(ys), dtype=int)
    kolej = np.argsort(ys)
    przerwy = np.diff(ys[kolej])
    ciecia = np.sort(np.argsort(przerwy)[-(wiersze - 1):])
    nr = np.zeros(len(ys), dtype=int)
    wiersz = 0
    for i, idx in enumerate(kolej):
        nr[idx] = wiersz
        if wiersz < wiersze - 1 and i == ciecia[wiersz]:
            wiersz += 1
    return nr


def _wyglada_na_podpis(sk: Skladowe, k: int, ziarno: int) -> bool:
    """Plama ``k`` to raczej podpis niż kawałek elementu ``ziarno``: niska i szeroka (linijka tekstu, po domknięciu
    litery zlewają się w jeden pasek), cała pod albo nad elementem i wyraźnie od niego mniejsza. ChatGPT często
    dopisuje nazwy pod ikonami, choć prompt mówi „bez tekstu” — doklejony podpis zepsułby ikonę."""
    w, h = sk.x1[k] - sk.x0[k], sk.y1[k] - sk.y0[k]
    pod_albo_nad = sk.y0[k] >= sk.y1[ziarno] or sk.y1[k] <= sk.y0[ziarno]
    return w >= 2.5 * h and pod_albo_nad and sk.pole[k] < 0.25 * sk.pole[ziarno]


def tnij(rgba: np.ndarray, siatka: tuple[int, int], oczekiwane: int, czarne: bool, uwagi: list) -> list[Element | None]:
    """Zwraca listę elementów w kolejności komórek (wierszami). ``None`` = pusta komórka."""
    H, W = rgba.shape[:2]
    kol, wie = siatka
    maska = maska_elementow(rgba, czarne)
    r = max(2, int(0.012 * min(H, W)))
    sklejona = domkniecie(maska, r)
    sk = Skladowe(sklejona)
    duze = [k for k in range(1, sk.n + 1) if sk.pole[k] >= 0.0005 * H * W]

    elementy = None
    if len(duze) >= oczekiwane:
        # Zbyt wiele plam (rozbity element): największe są „ziarnami”, resztę dołączamy do najbliższego ziarna.
        duze.sort(key=lambda k: -sk.pole[k])
        ziarna = duze[:oczekiwane]
        przydzial = {z: [z] for z in ziarna}
        srodki = {k: ((sk.x0[k] + sk.x1[k]) / 2, (sk.y0[k] + sk.y1[k]) / 2) for k in duze}
        podpisy = 0
        for k in duze[oczekiwane:]:
            najbl = min(ziarna, key=lambda z: (srodki[z][0] - srodki[k][0]) ** 2 + (srodki[z][1] - srodki[k][1]) ** 2)
            if _wyglada_na_podpis(sk, k, najbl):
                podpisy += 1                                 # tekst pod/nad elementem nie należy do grafiki
                continue
            przydzial[najbl].append(k)
        if podpisy:
            uwagi.append(("ostrzezenie", "Q13", f"pominięto {podpisy} podpis(y) pod/nad elementami arkusza "
                                                "(ChatGPT dopisał tekst) — sprawdź komórki w raporcie"))
        if len(duze) - podpisy > oczekiwane:
            uwagi.append(("info", "Q13", f"połączono rozbite elementy arkusza ({len(duze) - podpisy} plam → {oczekiwane})"))
        elementy = []
        for z, czlonki in przydzial.items():
            m = sk.maska(czlonki) & maska
            ys, xs = np.nonzero(m)
            if len(xs) == 0:
                continue
            x0, x1, y0, y1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
            elementy.append(Element(int(x0), int(y0), int(x1), int(y1), m[y0:y1, x0:x1]))
    if elementy is None or len(elementy) != oczekiwane:
        elementy = _plan_awaryjny(maska, siatka, uwagi)

    # kolejność: wiersze wg największych przerw w Y, w wierszu od lewej
    ys = np.array([e.srodek[1] for e in elementy])
    nr = _grupuj_wiersze(ys, wie)
    wynik: list[Element | None] = []
    for w in range(wie):
        wiersz = sorted([e for e, n in zip(elementy, nr) if n == w], key=lambda e: e.srodek[0])
        wynik.extend(wiersz)
        wynik.extend([None] * (kol - len(wiersz)))       # puste pola na końcu wiersza (np. cyfry: 2 ostatnie)
    if len(elementy) != oczekiwane:
        uwagi.append(("blad", "Q13", f"arkusz: znaleziono {len(elementy)} elementów zamiast {oczekiwane}"))
    return wynik


def _plan_awaryjny(maska: np.ndarray, siatka, uwagi) -> list[Element]:
    """(a) profile rzutów: cięcie w środkach przerw; (b) równa siatka z 3% marginesu wewnętrznego."""
    H, W = maska.shape
    kol, wie = siatka

    def przedzialy(profil, n, dlugosc):
        zera = profil == 0
        ciecia = []
        i = 0
        while i < dlugosc:
            if zera[i]:
                j = i
                while j < dlugosc and zera[j]:
                    j += 1
                if i > 0 and j < dlugosc and (j - i) >= 0.01 * dlugosc:
                    ciecia.append((i + j) // 2)
                i = j
            else:
                i += 1
        if len(ciecia) == n - 1:
            return [0] + ciecia + [dlugosc]
        return None

    xs = przedzialy(maska.sum(0), kol, W)
    ys = przedzialy(maska.sum(1), wie, H)
    if xs is None or ys is None:
        uwagi.append(("ostrzezenie", "Q13", "arkusz: plan awaryjny — równa siatka"))
        xs = [round(i * W / kol) for i in range(kol + 1)]
        ys = [round(i * H / wie) for i in range(wie + 1)]
    else:
        uwagi.append(("ostrzezenie", "Q13", "arkusz: plan awaryjny — profile rzutów"))
    wynik = []
    for r in range(wie):
        for c in range(kol):
            x0, x1, y0, y1 = xs[c], xs[c + 1], ys[r], ys[r + 1]
            m = maska[y0:y1, x0:x1]
            yy, xx = np.nonzero(m)
            if len(xx) < 0.001 * (x1 - x0) * (y1 - y0):
                continue
            ex0, ex1, ey0, ey1 = x0 + xx.min(), x0 + xx.max() + 1, y0 + yy.min(), y0 + yy.max() + 1
            wynik.append(Element(int(ex0), int(ey0), int(ex1), int(ey1), maska[ey0:ey1, ex0:ex1].copy()))
    return wynik


def wytnij(rgba: np.ndarray, e: Element, margines: int, czarne: bool) -> np.ndarray:
    """Wycina element z marginesem. Dla ALFA zeruje alfę pikseli spoza elementu (sąsiedzi nie przeciekają)."""
    H, W = rgba.shape[:2]
    x0, y0 = max(0, e.x0 - margines), max(0, e.y0 - margines)
    x1, y1 = min(W, e.x1 + margines), min(H, e.y1 + margines)
    wyc = rgba[y0:y1, x0:x1].copy()
    if not czarne:
        # tylko piksele należące do tej plamy (z małym zapasem na miękką krawędź)
        from .obraz import dylatacja
        m = np.zeros((y1 - y0, x1 - x0), dtype=bool)
        m[e.y0 - y0:e.y1 - y0, e.x0 - x0:e.x1 - x0] = e.maska
        m = dylatacja(m, 3)
        wyc[..., 3] *= m
    return wyc


# ------------------------------------------------------------------------------------------------
# BitmapFont z cyfr
# ------------------------------------------------------------------------------------------------
def metryki_cyfr(elementy: list[Element | None], nazwy: list[str], uwagi: list) -> dict:
    """Linia bazowa i wysokość cyfr w źródle (02 § 5.14 pkt 2). Zwraca {nazwa: (element, linia_bazowa)} i H."""
    cyfry = [(n, e) for n, e in zip(nazwy, elementy) if e is not None and n.isdigit()]
    if len(cyfry) < 10:
        uwagi.append(("blad", "Q26", f"brakuje cyfr w arkuszu ({len(cyfry)}/10)"))
    # wiersze cyfr: 0–4 i 5–9; linia bazowa wiersza = mediana dołów prostokątów
    wiersz1 = [e.y1 for n, e in cyfry if int(n) <= 4]
    wiersz2 = [e.y1 for n, e in cyfry if int(n) >= 5]
    b1 = float(np.median(wiersz1)) if wiersz1 else 0.0
    b2 = float(np.median(wiersz2)) if wiersz2 else b1
    b3 = b2 + (b2 - b1)                      # wiersz znaków: ta sama odległość między wierszami
    H = float(np.median([e.y1 - e.y0 for _, e in cyfry])) if cyfry else 1.0
    bazy = {}
    for n, e in zip(nazwy, elementy):
        if e is None:
            continue
        bazy[n] = b1 if (n.isdigit() and int(n) <= 4) else b2 if n.isdigit() else b3
    # kontrola: linia bazowa każdej cyfry ±2 px @1x (H → 96 px)
    skala = 96.0 / H
    for n, e in cyfry:
        odch = abs(e.y1 - bazy[n]) * skala
        if odch > 2 and n not in "359":          # 3, 5, 9 mogą schodzić pod linię (cyfry nautyczne)
            uwagi.append(("ostrzezenie", "Q26", f"cyfra {n}: odchylenie od linii bazowej {odch:.1f} px @1x"))
    return {"bazy": bazy, "H": H}


def plik_fnt(nazwa_fontu: str, rozmiar: int, line_height: int, base: int, strona: str, sw: int, sh: int,
             znaki: list[dict]) -> str:
    """Tekstowy format BMFont (czyta go loader BitmapFont w PixiJS 8)."""
    linie = [
        f'info face="{nazwa_fontu}" size={rozmiar} bold=0 italic=0 charset="" unicode=1 stretchH=100 smooth=1 '
        f'aa=1 padding=0,0,0,0 spacing=4,4',
        f"common lineHeight={line_height} base={base} scaleW={sw} scaleH={sh} pages=1 packed=0",
        f'page id=0 file="{strona}"',
        f"chars count={len(znaki)}",
    ]
    for z in znaki:
        linie.append(f"char id={z['id']} x={z['x']} y={z['y']} width={z['w']} height={z['h']} "
                     f"xoffset={z['xoffset']} yoffset={z['yoffset']} xadvance={z['xadvance']} page=0 chnl=15")
    return "\n".join(linie) + "\n"
