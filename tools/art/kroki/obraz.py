"""
obraz.py — podstawowe operacje na pikselach (NumPy), z których składają się wszystkie kroki pipeline'u.

Po co osobny moduł: pipeline ma działać na „gołym” Pythonie z Pillow i NumPy (bez SciPy), więc kilka
klasycznych algorytmów przetwarzania obrazu piszemy sami — krótko i z komentarzem, żeby dało się je omówić:

* konwersje kolorów: sRGB ↔ światło liniowe, sRGB → CIELAB (odległość kolorów ΔE),
* rozmycie Gaussa (przybliżone trzema rozmyciami pudełkowymi liczonymi sumami skumulowanymi),
* morfologia binarna (dylatacja / erozja kwadratem) — łączenie kawałków jednego elementu arkusza,
* etykietowanie spójnych składowych metodą przebiegów (run-length) + union-find,
* „rozlewanie” koloru z pikseli pewnych na niepewne (zamiast transformaty odległości).

Konwencja: obrazy RGBA trzymamy jako ``float32`` w zakresie 0–1, kształt (H, W, 4), alfa NIE premultiplikowana.
"""

from __future__ import annotations

import numpy as np
from PIL import Image


# ------------------------------------------------------------------------------------------------
# Wczytywanie i zapis
# ------------------------------------------------------------------------------------------------
def wczytaj_rgba(sciezka) -> np.ndarray:
    """Wczytuje dowolny obraz (PNG/JPEG/WebP, tryby P/L/LA/RGB/RGBA) jako RGBA float32 0–1."""
    with Image.open(sciezka) as im:
        im.load()
        if im.mode in ("I;16", "I"):
            im = im.point(lambda v: v / 256).convert("L")
        im = im.convert("RGBA")
        return np.asarray(im, dtype=np.float32) / 255.0


def do_pil(rgba: np.ndarray) -> Image.Image:
    """float32 0–1 (H, W, 3|4) → obraz Pillow 8 bit (z zaokrągleniem, nie obcięciem)."""
    a = np.clip(rgba * 255.0 + 0.5, 0, 255).astype(np.uint8)
    return Image.fromarray(a, "RGBA" if a.shape[2] == 4 else "RGB")


# ------------------------------------------------------------------------------------------------
# Kolory
# ------------------------------------------------------------------------------------------------
def srgb_do_liniowego(c: np.ndarray) -> np.ndarray:
    """Dokładna krzywa sRGB (IEC 61966-2-1). W świetle liniowym można uczciwie uśredniać piksele."""
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4).astype(np.float32)


def liniowy_do_srgb(c: np.ndarray) -> np.ndarray:
    c = np.clip(c, 0.0, 1.0)
    return np.where(c <= 0.0031308, c * 12.92, 1.055 * np.power(c, 1 / 2.4) - 0.055).astype(np.float32)


def rgb_do_lab(rgb: np.ndarray) -> np.ndarray:
    """sRGB (0–1) → CIELAB (D65). Lab jest „równomierny dla oka”: ΔE ≈ 2 to granica zauważalnej różnicy."""
    lin = srgb_do_liniowego(rgb)
    m = np.array([[0.4124564, 0.3575761, 0.1804375],
                  [0.2126729, 0.7151522, 0.0721750],
                  [0.0193339, 0.1191920, 0.9503041]], dtype=np.float32)
    xyz = lin @ m.T
    xyz /= np.array([0.95047, 1.0, 1.08883], dtype=np.float32)
    e = 216 / 24389
    k = 24389 / 27
    f = np.where(xyz > e, np.cbrt(xyz), (k * xyz + 16) / 116)
    lab = np.empty_like(xyz)
    lab[..., 0] = 116 * f[..., 1] - 16
    lab[..., 1] = 500 * (f[..., 0] - f[..., 1])
    lab[..., 2] = 200 * (f[..., 1] - f[..., 2])
    return lab


def jasnosc(rgb: np.ndarray) -> np.ndarray:
    """Jasność postrzegana (luma Rec. 601) — szybka miara do progów."""
    return (0.299 * rgb[..., 0] + 0.587 * rgb[..., 1] + 0.114 * rgb[..., 2]).astype(np.float32)


def nasycenie(rgb: np.ndarray) -> np.ndarray:
    """max(R,G,B) − min(R,G,B): 0 = szarość, 1 = czysty kolor."""
    return (rgb.max(axis=-1) - rgb.min(axis=-1)).astype(np.float32)


def smoothstep(x, a, b):
    """Płynne przejście 0 → 1 między a i b (jak w shaderach)."""
    t = np.clip((x - a) / (b - a), 0.0, 1.0)
    return t * t * (3 - 2 * t)


def hex_do_rgb(h: str) -> np.ndarray:
    h = h.lstrip("#")
    return np.array([int(h[i:i + 2], 16) / 255.0 for i in (0, 2, 4)], dtype=np.float32)


# ------------------------------------------------------------------------------------------------
# Rozmycia
# ------------------------------------------------------------------------------------------------
def _rozmyj_pudelkowo_os(a: np.ndarray, r: int, os: int) -> np.ndarray:
    """Średnia w oknie 2r+1 wzdłuż jednej osi, liczona sumami skumulowanymi (koszt nie zależy od r)."""
    if r <= 0:
        return a
    pad = [(0, 0)] * a.ndim
    pad[os] = (r + 1, r)
    p = np.pad(a, pad, mode="edge")
    c = np.cumsum(p, axis=os, dtype=np.float64)
    n = a.shape[os]
    gora = np.take(c, np.arange(2 * r + 1, 2 * r + 1 + n), axis=os)
    dol = np.take(c, np.arange(0, n), axis=os)
    return ((gora - dol) / (2 * r + 1)).astype(np.float32)


def rozmyj(a: np.ndarray, sigma: float) -> np.ndarray:
    """Rozmycie ≈ Gaussa: trzy rozmycia pudełkowe (twierdzenie graniczne). Działa na (H,W) i (H,W,C)."""
    if sigma < 0.35:
        return a.astype(np.float32)
    # promień pudełka dający po trzech przebiegach wariancję σ²: 3·((2r+1)² − 1)/12 = σ²
    r = max(1, int(round((np.sqrt(4 * sigma * sigma + 1) - 1) / 2)))
    wynik = a.astype(np.float32)
    for _ in range(3):
        wynik = _rozmyj_pudelkowo_os(wynik, r, 0)
        wynik = _rozmyj_pudelkowo_os(wynik, r, 1)
    return wynik


# ------------------------------------------------------------------------------------------------
# Morfologia binarna
# ------------------------------------------------------------------------------------------------
def _max_okno(a: np.ndarray, r: int, os: int) -> np.ndarray:
    if r <= 0:
        return a
    pad = [(0, 0)] * a.ndim
    pad[os] = (r, r)
    p = np.pad(a, pad, mode="constant", constant_values=0)
    okna = np.lib.stride_tricks.sliding_window_view(p, 2 * r + 1, axis=os)
    return okna.max(axis=-1)


def dylatacja(maska: np.ndarray, r: int) -> np.ndarray:
    """Pogrubienie maski kwadratem (2r+1)×(2r+1) — dwa przebiegi 1D (rozdzielność)."""
    if r <= 0:
        return maska.copy()
    m = maska.astype(np.uint8)
    return _max_okno(_max_okno(m, r, 0), r, 1).astype(bool)


def erozja(maska: np.ndarray, r: int) -> np.ndarray:
    return ~dylatacja(~maska.astype(bool), r)


def domkniecie(maska: np.ndarray, r: int) -> np.ndarray:
    """Dylatacja, potem erozja: skleja bliskie fragmenty (np. kropki wiązki iskier) w jeden element."""
    p = np.pad(maska, r + 1)
    w = erozja(dylatacja(p, r), r)
    return w[r + 1:-r - 1, r + 1:-r - 1]


# ------------------------------------------------------------------------------------------------
# Spójne składowe (etykietowanie)
# ------------------------------------------------------------------------------------------------
class Skladowe:
    """Etykietowanie 8-spójnych składowych maski binarnej.

    Algorytm „przebiegów” (run-length): w każdym wierszu maska to kilka ciągłych odcinków. Odcinek łączymy
    (union-find) z odcinkami poprzedniego wiersza, które się z nim stykają (także po skosie). Pętla w Pythonie
    idzie po odcinkach, nie po pikselach, więc obraz 1536×1024 to ułamek sekundy.

    Atrybuty: ``etykiety`` (H, W) int32 (0 = tło, 1..n = składowe), ``n``, oraz tablice długości n+1:
    ``pole``, ``x0``, ``y0``, ``x1``, ``y1`` (prostokąt, x1/y1 wyłącznie), ``brzeg`` (czy dotyka krawędzi obrazu).
    """

    def __init__(self, maska: np.ndarray):
        maska = np.asarray(maska, dtype=bool)
        H, W = maska.shape
        p = np.zeros((H, W + 2), dtype=np.int8)
        p[:, 1:-1] = maska
        d = np.diff(p, axis=1)
        st = np.argwhere(d == 1)
        en = np.argwhere(d == -1)
        wiersz = st[:, 0]
        x_od = st[:, 1]
        x_do = en[:, 1]                       # wyłącznie
        n_odc = len(wiersz)
        rodzic = np.arange(n_odc)

        def korzen(i):
            while rodzic[i] != i:
                rodzic[i] = rodzic[rodzic[i]]
                i = rodzic[i]
            return i

        # granice odcinków każdego wiersza
        poczatki = np.searchsorted(wiersz, np.arange(H + 1))
        for y in range(1, H):
            a0, a1 = poczatki[y - 1], poczatki[y]
            b0, b1 = poczatki[y], poczatki[y + 1]
            if a0 == a1 or b0 == b1:
                continue
            i, j = a0, b0
            while i < a1 and j < b1:
                # 8-spójność: odcinki stykają się, jeśli [x_od-1, x_do+1) się przecinają
                if x_od[i] <= x_do[j] and x_od[j] <= x_do[i]:
                    ri, rj = korzen(i), korzen(j)
                    if ri != rj:
                        rodzic[max(ri, rj)] = min(ri, rj)
                if x_do[i] < x_do[j]:
                    i += 1
                else:
                    j += 1
        korzenie = np.array([korzen(i) for i in range(n_odc)], dtype=np.int64) if n_odc else np.zeros(0, np.int64)
        unik, etyk_odc = np.unique(korzenie, return_inverse=True)
        etyk_odc = etyk_odc + 1
        self.n = len(unik)

        # malowanie etykiet (wektorowo)
        dl = x_do - x_od
        etykiety = np.zeros(H * W, dtype=np.int32)
        if n_odc:
            start = wiersz * W + x_od
            idx = np.repeat(start - np.concatenate(([0], np.cumsum(dl)[:-1])), dl) + np.arange(dl.sum())
            etykiety[idx] = np.repeat(etyk_odc, dl)
        self.etykiety = etykiety.reshape(H, W)

        n1 = self.n + 1
        self.pole = np.bincount(etyk_odc, weights=dl, minlength=n1).astype(np.int64)
        self.x0 = np.full(n1, W, np.int64)
        self.y0 = np.full(n1, H, np.int64)
        self.x1 = np.zeros(n1, np.int64)
        self.y1 = np.zeros(n1, np.int64)
        np.minimum.at(self.x0, etyk_odc, x_od)
        np.minimum.at(self.y0, etyk_odc, wiersz)
        np.maximum.at(self.x1, etyk_odc, x_do)
        np.maximum.at(self.y1, etyk_odc, wiersz + 1)
        self.brzeg = (self.x0 == 0) | (self.y0 == 0) | (self.x1 == W) | (self.y1 == H)
        self.brzeg[0] = False

    def maska(self, ktore) -> np.ndarray:
        """Maska sumy wskazanych składowych (lista etykiet albo tablica bool długości n+1)."""
        wybor = np.zeros(self.n + 1, dtype=bool)
        if isinstance(ktore, np.ndarray) and ktore.dtype == bool:
            wybor[:] = ktore
        else:
            wybor[list(ktore)] = True
        wybor[0] = False
        return wybor[self.etykiety]


# ------------------------------------------------------------------------------------------------
# Rozlewanie koloru
# ------------------------------------------------------------------------------------------------
def rozlej_kolor(rgb: np.ndarray, pewne: np.ndarray, kroki: int = 8) -> tuple[np.ndarray, np.ndarray]:
    """Dla pikseli niepewnych szuka koloru najbliższych pikseli pewnych.

    Działa jak fala: w każdym kroku piksel niepewny, który ma pewnego sąsiada (3×3), dostaje średni kolor
    pewnych sąsiadów i sam staje się „pewny”. Po k krokach znamy kolor odniesienia do odległości k px —
    tyle wystarczy do odkażania krawędzi. Zwraca (kolor, maska_pokrycia).
    """
    kol = rgb * pewne[..., None]
    wag = pewne.astype(np.float32)
    znane = pewne.copy()
    for _ in range(kroki):
        if znane.all():
            break
        s = np.zeros_like(kol)
        w = np.zeros_like(wag)
        kp = np.pad(kol, ((1, 1), (1, 1), (0, 0)))
        wp = np.pad(wag, 1)
        H, W = wag.shape
        for dy in (0, 1, 2):
            for dx in (0, 1, 2):
                s += kp[dy:dy + H, dx:dx + W]
                w += wp[dy:dy + H, dx:dx + W]
        nowe = (~znane) & (w > 0)
        kol = np.where(nowe[..., None], s / np.maximum(w, 1e-6)[..., None], kol)
        wag = np.where(nowe, 1.0, wag).astype(np.float32)
        znane = znane | nowe
    return kol, znane


def otsu(wartosci: np.ndarray, biny: int = 256) -> float:
    """Próg Otsu: dzieli wartości na dwie grupy o najmniejszej wariancji wewnątrzgrupowej."""
    h, kraw = np.histogram(wartosci, bins=biny, range=(0.0, 1.0))
    h = h.astype(np.float64)
    srodki = (kraw[:-1] + kraw[1:]) / 2
    w0 = np.cumsum(h)
    w1 = w0[-1] - w0
    m0 = np.cumsum(h * srodki)
    mu0 = m0 / np.maximum(w0, 1)
    mu1 = (m0[-1] - m0) / np.maximum(w1, 1)
    miedzy = w0 * w1 * (mu0 - mu1) ** 2
    return float(srodki[int(np.argmax(miedzy))])


def pas_brzegowy(H: int, W: int, szer: int) -> np.ndarray:
    """Maska zewnętrznego pasa obrazu o szerokości ``szer`` px."""
    m = np.zeros((H, W), dtype=bool)
    m[:szer, :] = True
    m[-szer:, :] = True
    m[:, :szer] = True
    m[:, -szer:] = True
    return m
