"""
fx.py — efekty świetlne z czarnym tłem (typ CZARNE, 02 § 5.11).

Po co to jest
-------------
Błyski, promienie, iskry i dym rysujemy w trybie mieszania ``add``: czarny piksel (0,0,0) niczego nie dodaje,
więc znika, a miękka poświata zachowuje pełne przejście tonalne. Dlatego czerń ZOSTAJE (bez kanału alfa).
Musimy tylko dopilnować, żeby czerń była naprawdę czarna (nawet 4/255 na dużym sprite'cie daje widoczny
jaśniejszy prostokąt na ekranie OLED) i żeby żaden efekt nie miał twardej krawędzi na brzegu obrazu.
"""

from __future__ import annotations

import numpy as np

from .obraz import jasnosc, nasycenie, pas_brzegowy, smoothstep


def splaszcz_na_czarne(rgba: np.ndarray, uwagi: list) -> np.ndarray:
    """Obraz CZARNE z kanałem alfa → kolor × α na czerni (efekt w trybie add tego właśnie potrzebuje)."""
    a = rgba[..., 3:4]
    if float((a < 0.98).mean()) > 0.001:
        uwagi.append(("ostrzezenie", "Q11", "efekt miał kanał alfa — spłaszczono na czerń"))
    return np.concatenate([rgba[..., :3] * a, np.ones_like(a)], -1)


def zeruj_czern(rgba: np.ndarray, uwagi: list) -> np.ndarray:
    """``v' = (v − b) · 255/(255 − b)``, gdzie b = 2. percentyl jasności pasa brzegowego."""
    H, W = rgba.shape[:2]
    pas = pas_brzegowy(H, W, max(4, int(0.03 * min(H, W))))
    L = jasnosc(rgba[..., :3])
    b = float(np.percentile(L[pas], 2))
    if float(np.median(L[pas])) > 40 / 255:
        uwagi.append(("blad", "Q11", "tło efektu nie jest czarne — obraz do ponownego wygenerowania"))
    out = rgba.copy()
    out[..., :3] = np.clip((rgba[..., :3] - b) / max(1e-6, 1 - b), 0, 1)
    return out


def winieta_krawedzi(rgba: np.ndarray, uwagi: list | None = None, proc: float = 0.06) -> np.ndarray:
    """Mnożnik smoothstep(0, 6% krótszego boku, odległość od krawędzi): na samej krawędzi zawsze 0."""
    H, W = rgba.shape[:2]
    d = proc * min(H, W)
    yy, xx = np.mgrid[0:H, 0:W]
    odl = np.minimum(np.minimum(xx + 0.5, W - xx - 0.5), np.minimum(yy + 0.5, H - yy - 0.5))
    m = smoothstep(odl, 0, d)[..., None]
    przed = float(rgba[..., :3].sum())
    out = rgba.copy()
    out[..., :3] = rgba[..., :3] * m
    if uwagi is not None and przed > 0:
        zabrane = 1 - float(out[..., :3].sum()) / przed
        if zabrane > 0.03:
            uwagi.append(("ostrzezenie", "Q11", f"poświata dotyka krawędzi (winieta zabrała {zabrane:.0%} energii)"))
    return out


def wysrodkuj(rgba: np.ndarray, uwagi: list) -> np.ndarray:
    """Kod obraca promienie i skaluje flarę wokół środka — środek ciężkości jasności musi być w środku obrazu."""
    H, W = rgba.shape[:2]
    L = jasnosc(rgba[..., :3])
    s = float(L.sum())
    if s <= 0:
        return rgba
    yy, xx = np.mgrid[0:H, 0:W]
    cx, cy = float((xx * L).sum() / s), float((yy * L).sum() / s)
    dx, dy = W / 2 - cx, H / 2 - cy
    if max(abs(dx) / W, abs(dy) / H) <= 0.02:
        return rgba
    dx, dy = int(round(dx)), int(round(dy))
    out = np.zeros_like(rgba)
    out[..., 3] = 1
    ys = slice(max(0, dy), min(H, H + dy))
    xs = slice(max(0, dx), min(W, W + dx))
    ys2 = slice(max(0, -dy), min(H, H - dy))
    xs2 = slice(max(0, -dx), min(W, W - dx))
    out[ys, xs] = rgba[ys2, xs2]
    uwagi.append(("info", "Q11", f"przesunięto środek efektu o ({dx}, {dy}) px"))
    return out


def ogranicz_dym(rgba: np.ndarray) -> np.ndarray:
    """Dym: 99. percentyl jasności sprowadzamy do ~70% (czysta biel w trybie add prześwietla ekran)."""
    L = jasnosc(rgba[..., :3])
    p = float(np.percentile(L, 99))
    if p <= 0.7:
        return rgba
    out = rgba.copy()
    out[..., :3] *= 0.7 / p
    return out


CIEPLA_BIEL = np.array([1.0, 0.965, 0.88], dtype=np.float32)   # między #FFFFFF a #FFF3D1 z promptów (03)


def neutralizuj_barwe(rgba: np.ndarray, uwagi: list) -> np.ndarray:
    """Efekty mają być prawie białe — kolor nadaje kod przez ``tint`` (04 § 2.3: jeden arkusz iskier służy jako
    złote iskry BIG WIN, cyjanowe w S1 i turkusowe w S2). ChatGPT mimo promptu „warm white” potrafi oddać złote
    albo niebieskie efekty; złota tekstura zabarwiona na cyjan daje błotnistą zieleń. Dlatego kolorowy efekt
    sprowadzamy do ciepłej bieli z zachowaniem jasności: v = ½ · (luma + max(R, G, B)) — sama luma za bardzo
    przyciemniłaby nasycone poświaty (pomarańcz ma niską lumę, a na ekranie świeci mocno)."""
    rgb = rgba[..., :3]
    L = jasnosc(rgb)
    jasne = L > 0.25
    if jasne.sum() <= 100 or float(nasycenie(rgb)[jasne].mean()) <= 0.25:
        return rgba
    v = 0.5 * (L + rgb.max(-1))
    out = rgba.copy()
    out[..., :3] = np.clip(v[..., None] * CIEPLA_BIEL, 0, 1)
    uwagi.append(("info", "Q11", "efekt był kolorowy — sprowadzony do ciepłej bieli (kolor nadaje kod tintem, 04 § 2.3)"))
    return out


def przygotuj_fx(rgba: np.ndarray, uwagi: list, srodek: bool = False, dym: bool = False) -> np.ndarray:
    out = splaszcz_na_czarne(rgba, uwagi)
    out = zeruj_czern(out, uwagi)
    if srodek:
        out = wysrodkuj(out, uwagi)
    if dym:
        out = ogranicz_dym(out)
    out = winieta_krawedzi(out, uwagi)
    return neutralizuj_barwe(out, uwagi)
