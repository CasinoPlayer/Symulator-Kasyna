"""
warianty.py — warianty pochodne obrazów, liczone raz przy obróbce zamiast w każdej klatce gry (02 § 5.15–5.16).

Po co to jest
-------------
Filtr rozmycia albo poświaty w PixiJS liczy się na GPU co klatkę dla każdego obiektu osobno. Przy 30 symbolach
to 30 dodatkowych przebiegów renderowania. Gotowa tekstura kosztuje prawie zero — kod tylko ją podmienia:

* ``ruch1`` / ``ruch2`` — pionowe rozmycie ruchu (bęben się kręci: słabe / mocne),
* ``syl`` — biała sylwetka (błysk przy lądowaniu symbolu, poziom jakości Low),
* ``glow`` — miękka biała poświata do zabarwienia ``tint`` w trybie ``add``; ``glowzl`` — już złota (dla HTML),
* ``cien`` — rozmyta czarna sylwetka (cień rzucany ustawia kod),
* ``mini`` / ``male`` / ``ikona`` / ``naglowek`` — wyostrzone małe wersje (lepsze niż zmniejszanie w locie).
"""

from __future__ import annotations

import numpy as np

from .obraz import dylatacja, hex_do_rgb, liniowy_do_srgb, rozmyj, srgb_do_liniowego
from .skala import parzyste, skaluj


def _rozmycie_pionowe(rgba: np.ndarray, L: int) -> np.ndarray:
    """Dwa rozmycia pudełkowe o długości L/2 w pionie (≈ jądro trójkątne) w świetle liniowym z alfą
    premultiplikowaną; płótno dopełnione o L/2 u góry i u dołu, żeby smuga się nie ucinała."""
    pad = L // 2
    lin = srgb_do_liniowego(rgba[..., :3]) * rgba[..., 3:4]
    p = np.pad(np.concatenate([lin, rgba[..., 3:4]], -1), ((pad, pad), (0, 0), (0, 0)))
    r = max(1, L // 4)
    for _ in range(2):
        c = np.cumsum(np.pad(p, ((r + 1, r), (0, 0), (0, 0))), axis=0)
        p = (c[2 * r + 1:] - c[:-2 * r - 1]) / (2 * r + 1)
    a = np.clip(p[..., 3:4], 0, 1)
    kol = np.where(a > 1e-6, p[..., :3] / np.maximum(a, 1e-6), 0)
    return np.concatenate([liniowy_do_srgb(kol), a], -1).astype(np.float32)


def ruch(rgba1x: np.ndarray, L: int, mocny: bool) -> np.ndarray:
    img = rgba1x
    if mocny:
        h, w = img.shape[:2]
        img = skaluj(img, w, parzyste(h * 1.04), wyostrz=False)
    out = _rozmycie_pionowe(img, L)
    if mocny:
        out[..., :3] *= 0.95
    return out


def sylwetka(rgba1x: np.ndarray) -> np.ndarray:
    out = np.ones_like(rgba1x)
    out[..., 3] = rgba1x[..., 3]
    return out


def poswiata(rgba1x: np.ndarray, S: float, kolor: str = "#FFFFFF") -> np.ndarray:
    """Sylwetka → dylatacja 2% S → rozmycie σ = 5% S → normalizacja → gamma 0,8; płótno +15% S z każdej strony."""
    m = int(round(0.15 * S))
    a = np.pad(rgba1x[..., 3], m)
    a = dylatacja(a > 0.5, max(1, int(0.02 * S))).astype(np.float32)
    a = rozmyj(a, 0.05 * S)
    a = (a / max(float(a.max()), 1e-6)) ** 0.8
    out = np.empty(a.shape + (4,), dtype=np.float32)
    out[..., :3] = hex_do_rgb(kolor)
    out[..., 3] = a
    return out


def cien(rgba1x: np.ndarray, S: float, sigma_proc: float = 0.04) -> np.ndarray:
    m = int(round(3 * sigma_proc * S))
    a = rozmyj(np.pad(rgba1x[..., 3], m), sigma_proc * S)
    out = np.zeros(a.shape + (4,), dtype=np.float32)
    out[..., 3] = np.clip(a, 0, 1)
    return out


def zmniejsz(rgba: np.ndarray, bok: int) -> np.ndarray:
    """Skalowanie tak, by dłuższy bok = ``bok`` (z wyostrzeniem małych rozmiarów)."""
    h, w = rgba.shape[:2]
    k = bok / max(h, w)
    return skaluj(rgba, max(1, int(round(w * k))), max(1, int(round(h * k))))


def polowa(rgba: np.ndarray) -> np.ndarray:
    h, w = rgba.shape[:2]
    return skaluj(rgba, max(1, (w + 1) // 2), max(1, (h + 1) // 2), wyostrz=False)
