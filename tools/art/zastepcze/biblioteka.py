"""
biblioteka.py — narzędzia 2D (Pillow + NumPy) wspólne dla wszystkich generatorów grafiki zastępczej.

Po co to jest
-------------
Większość grafiki zastępczej to obrazy „2,5D”: napisy, ramki, przyciski, ikony, reliefy egipskie. Zamiast
modelować każdy w 3D, rysujemy KSZTAŁT (maskę) w Pillow, zamieniamy go na mapę wysokości (faza krawędzi),
liczymy normalne i kolorujemy techniką **matcap**: matcap to zdjęcie kuli z danego materiału (złoto, chrom,
emalia…) wyrenderowane w Blenderze w tym samym studiu co obiekty 3D. Normalna piksela wskazuje punkt na kuli,
z którego bierzemy kolor. Efekt: płaski kształt wygląda jak wytłoczone, polerowane złoto z tym samym światłem
(key z lewej-góry, cyjanowy i magentowy rim), co prawdziwe rendery 3D.

Konwencja: obrazy to tablice float32 0–1, RGBA niepremultiplikowane, kształt (H, W, 4).
"""

from __future__ import annotations

import math
import sys
from functools import lru_cache
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

NARZEDZIA = Path(__file__).resolve().parents[1]          # tools/art
REPO = NARZEDZIA.parents[1]
sys.path.insert(0, str(NARZEDZIA))

from kroki.obraz import dylatacja, erozja, hex_do_rgb, rozmyj, smoothstep  # noqa: E402,F401

ZASTEPCZE = REPO / "art" / "zastepcze"
RENDERY = ZASTEPCZE / "_render"           # pośrednie rendery Blendera (też generowane, też w .gitignore)
FONTY = REPO / "src" / "main" / "resources" / "static" / "fonts"
FONTY_NPM = REPO / "tools" / "node_modules" / "@fontsource"

# Paleta (brief § 1, 01 § 3) — w jednym miejscu, żeby generatory nie wymyślały własnych odcieni.
P = {
    "bg0": "#07060F", "bg1": "#120B2A", "bg2": "#1E1442",
    "gold_hi": "#FFF6D6", "gold1": "#FFE08A", "gold2": "#F5C542", "gold3": "#B8860B",
    "gold_deep": "#5C3A00", "gold_core": "#2B1A00",
    "magenta": "#FF2E88", "cyan": "#21E6FF", "win": "#3DFF8F", "danger": "#FF4D4D",
    "text1": "#FFFFFF", "text2": "#C9C3E6", "kontur": "#1A0B33", "violet_epic": "#8F3DFF",
    # S1
    "s1_noc": "#0B0624", "s1_synth": "#3A0CA3", "s1_ultra": "#2B6BFF", "s1_slonce1": "#FF7A3D",
    "s1_slonce2": "#FFD04D", "s1_chrom": "#E6ECF5", "s1_chrom_c": "#6B7590", "s1_czerwien": "#E3122B",
    # S2
    "s2_lapis": "#1B3FA0", "s2_lapis_c": "#0E2466", "s2_turkus": "#2EC4B6", "s2_piaskowiec": "#C89B5A",
    "s2_piaskowiec_c": "#6B4A26", "s2_karneol": "#C8321E", "s2_malachit": "#1FA35B", "s2_ametyst": "#8E4BD8",
    "s2_obsydian": "#15121C", "s2_pochodnia": "#FFA45C", "s2_plomien": "#FF7A1A", "s2_noc": "#0A1030",
    "s2_gwiazdy": "#E8F0FF", "s2_wiazka": "#9FE8FF",
    # S3
    "s3_jaskinia": "#070A1F", "s3_jaskinia2": "#0D1638", "s3_teal": "#19F5D2", "s3_szafir": "#2F6BFF",
    "s3_szmaragd": "#19D17A", "s3_ametyst": "#A64DFF", "s3_topaz": "#FFB23D", "s3_rubin": "#FF2D55",
    "s3_diament": "#E8FBFF", "s3_opal": "#FF8AD8", "s3_zorza1": "#5CFFB0", "s3_zorza2": "#B66BFF",
}


def kol(h: str) -> np.ndarray:
    return hex_do_rgb(P.get(h, h))


# ================================================================================================
# Pliki
# ================================================================================================
def wczytaj(sciezka) -> np.ndarray:
    with Image.open(sciezka) as im:
        return np.asarray(im.convert("RGBA"), dtype=np.float32) / 255.0


def zapisz(rgba: np.ndarray, sciezka) -> None:
    sciezka = Path(sciezka)
    sciezka.parent.mkdir(parents=True, exist_ok=True)
    a = np.clip(rgba * 255 + 0.5, 0, 255).astype(np.uint8)
    Image.fromarray(a, "RGBA" if a.shape[2] == 4 else "RGB").save(sciezka, optimize=False, compress_level=6)


def render(nazwa: str) -> np.ndarray:
    """Wczytuje render Blendera z art/zastepcze/_render/<nazwa>.png."""
    p = RENDERY / f"{nazwa}.png"
    if not p.exists():
        raise FileNotFoundError(f"brak renderu {p} — uruchom najpierw etap Blendera (generuj_wszystko.py)")
    return wczytaj(p)


def plotno(w: int, h: int, kolor=None) -> np.ndarray:
    out = np.zeros((h, w, 4), np.float32)
    if kolor is not None:
        out[..., :3] = kol(kolor) if isinstance(kolor, str) else kolor
        out[..., 3] = 1
    return out


# ================================================================================================
# Kompozycja
# ================================================================================================
def nakladaj(dst: np.ndarray, src: np.ndarray, x: int = 0, y: int = 0, krycie: float = 1.0,
             tryb: str = "normal") -> np.ndarray:
    """Kładzie ``src`` na ``dst`` w punkcie (x, y) — operator „over” (albo ``add`` / ``screen`` dla światła)."""
    H, W = dst.shape[:2]
    h, w = src.shape[:2]
    x0, y0 = max(0, x), max(0, y)
    x1, y1 = min(W, x + w), min(H, y + h)
    if x1 <= x0 or y1 <= y0:
        return dst
    s = src[y0 - y:y1 - y, x0 - x:x1 - x]
    d = dst[y0:y1, x0:x1]
    sa = s[..., 3:4] * krycie
    if tryb == "add":
        d[..., :3] = np.clip(d[..., :3] + s[..., :3] * sa, 0, 1)
        d[..., 3:4] = np.clip(d[..., 3:4] + sa * (1 - d[..., 3:4]), 0, 1)
    elif tryb == "screen":
        d[..., :3] = 1 - (1 - d[..., :3]) * (1 - s[..., :3] * sa)
        d[..., 3:4] = np.clip(d[..., 3:4] + sa * (1 - d[..., 3:4]), 0, 1)
    else:
        da = d[..., 3:4]
        oa = sa + da * (1 - sa)
        kol_ = (s[..., :3] * sa + d[..., :3] * da * (1 - sa)) / np.maximum(oa, 1e-6)
        d[..., :3] = np.where(oa > 1e-6, kol_, d[..., :3])
        d[..., 3:4] = oa
    return dst


def nakladaj_srodek(dst, src, cx, cy, **kw):
    return nakladaj(dst, src, int(round(cx - src.shape[1] / 2)), int(round(cy - src.shape[0] / 2)), **kw)


def skaluj(rgba: np.ndarray, w: int, h: int | None = None) -> np.ndarray:
    """Skalowanie z alfą premultiplikowaną (bez ciemnych obwódek)."""
    if h is None:
        h = max(1, int(round(rgba.shape[0] * w / rgba.shape[1])))
    pm = rgba.copy()
    pm[..., :3] *= pm[..., 3:4]
    kan = [np.asarray(Image.fromarray(pm[..., i], "F").resize((w, h), Image.Resampling.LANCZOS)) for i in range(4)]
    out = np.stack(kan, -1)
    out[..., 3] = np.clip(out[..., 3], 0, 1)
    out[..., :3] = np.where(out[..., 3:4] > 1e-5, out[..., :3] / np.maximum(out[..., 3:4], 1e-5), 0)
    return np.clip(out, 0, 1).astype(np.float32)


def przytnij_alfa(rgba: np.ndarray, margines: int = 0) -> np.ndarray:
    ys, xs = np.nonzero(rgba[..., 3] > 0.01)
    if len(xs) == 0:
        return rgba
    y0, y1 = max(0, ys.min() - margines), min(rgba.shape[0], ys.max() + 1 + margines)
    x0, x1 = max(0, xs.min() - margines), min(rgba.shape[1], xs.max() + 1 + margines)
    return rgba[y0:y1, x0:x1]


def wpasuj(rgba: np.ndarray, w: int, h: int, wypelnienie: float = 0.84, dy: float = 0.0) -> np.ndarray:
    """Kładzie obiekt (przycięty do alfy) na przezroczystym płótnie w×h, tak by zajmował ``wypelnienie`` kadru
    — tak jak ChatGPT oddaje obrazy ALFA (obiekt ~80–85% kadru, margines ≥ 6%)."""
    obj = przytnij_alfa(rgba)
    k = min(w * wypelnienie / obj.shape[1], h * wypelnienie / obj.shape[0])
    obj = skaluj(obj, max(1, int(round(obj.shape[1] * k))), max(1, int(round(obj.shape[0] * k))))
    out = plotno(w, h)
    return nakladaj_srodek(out, obj, w / 2, h / 2 + dy * h)


def z_maska(maska: np.ndarray, kolor) -> np.ndarray:
    out = np.zeros(maska.shape + (4,), np.float32)
    out[..., :3] = kol(kolor) if isinstance(kolor, str) else kolor
    out[..., 3] = np.clip(maska, 0, 1)
    return out


def obrys(rgba: np.ndarray, grubosc: float, kolor="kontur", miekkosc: float = 1.0) -> np.ndarray:
    """Ciemny kontur pod obiektem (01 § 7.8: oddziela złote litery od jasnych wybuchów)."""
    a = rgba[..., 3]
    m = rozmyj((a > 0.5).astype(np.float32), grubosc * 0.6)
    m = np.clip((m - 0.02) * 3.0, 0, 1)
    m = np.maximum(m, a)
    if miekkosc:
        m = rozmyj(m, miekkosc)
    pod = z_maska(m, kolor)
    return nakladaj(pod, rgba)


def poswiata(rgba: np.ndarray, promien: float, kolor, sila: float = 1.0, margines: int | None = None) -> np.ndarray:
    """Zwarta poświata wokół obiektu (dla obrazów ALFA ≤ 4–6% rozmiaru, 01 § 4.5)."""
    m = int(margines if margines is not None else promien * 2)
    a = np.pad(rgba, ((m, m), (m, m), (0, 0)))
    g = rozmyj(a[..., 3], promien) * sila
    pod = z_maska(np.clip(g, 0, 1), kolor)
    return nakladaj(pod, a)


# ================================================================================================
# Szum i gradienty
# ================================================================================================
def szum(h: int, w: int, skala: float, oktawy: int = 4, seed: int = 0, trwalosc: float = 0.5) -> np.ndarray:
    """Szum fraktalny (fBm): suma kilku warstw losowej siatki powiększonej bikubicznie. Wynik 0–1."""
    rng = np.random.default_rng(seed)
    wynik = np.zeros((h, w), np.float32)
    amp, suma = 1.0, 0.0
    for o in range(oktawy):
        s = skala / (2 ** o)
        gh, gw = max(2, int(h / s) + 3), max(2, int(w / s) + 3)
        siatka = rng.random((gh, gw), dtype=np.float32)
        im = Image.fromarray(siatka, "F").resize((int(gw * s), int(gh * s)), Image.Resampling.BICUBIC)
        a = np.asarray(im)[:h, :w]
        if a.shape != (h, w):
            a = np.pad(a, ((0, h - a.shape[0]), (0, w - a.shape[1])), mode="edge")
        wynik += a * amp
        suma += amp
        amp *= trwalosc
    wynik /= suma
    lo, hi = np.percentile(wynik, 1), np.percentile(wynik, 99)
    return np.clip((wynik - lo) / max(hi - lo, 1e-6), 0, 1)


def gradient_pionowy(h: int, w: int, stopy: list[tuple[float, str]]) -> np.ndarray:
    """Pionowy gradient z listy (pozycja 0–1, kolor)."""
    t = np.linspace(0, 1, h, dtype=np.float32)
    poz = [s[0] for s in stopy]
    kolory = np.array([kol(s[1]) for s in stopy])
    rgb = np.stack([np.interp(t, poz, kolory[:, i]) for i in range(3)], -1)
    return np.broadcast_to(rgb[:, None, :], (h, w, 3)).astype(np.float32).copy()


def radialny(h, w, cx, cy, r, ostrosc: float = 1.0) -> np.ndarray:
    """1 w środku → 0 na promieniu r (gładko)."""
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    d = np.sqrt((xx - cx) ** 2 + (yy - cy) ** 2) / max(r, 1e-6)
    return np.clip(1 - d, 0, 1) ** ostrosc


def ziarno(rgb: np.ndarray, sila: float = 0.012, seed: int = 1) -> np.ndarray:
    rng = np.random.default_rng(seed)
    n = (rng.random(rgb.shape[:2], dtype=np.float32) - rng.random(rgb.shape[:2], dtype=np.float32))[..., None]
    return np.clip(rgb + n * sila, 0, 1)


def winieta(rgb: np.ndarray, sila: float = 0.35, ksztalt: float = 1.6) -> np.ndarray:
    h, w = rgb.shape[:2]
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    d = np.sqrt(((xx - w / 2) / (w / 2)) ** 2 + ((yy - h / 2) / (h / 2)) ** 2) / math.sqrt(2)
    return rgb * (1 - sila * np.clip(d, 0, 1) ** ksztalt)[..., None]


def bokeh(rgb: np.ndarray, punkty, seed: int = 3, tryb: str = "add") -> np.ndarray:
    """Rozmyte światła w tle (żyrandole, neony): miękkie koła z jaśniejszym brzegiem jak w obiektywie.
    ``punkty`` = lista (x, y, r, kolor, jasnosc)."""
    h, w = rgb.shape[:2]
    warstwa = np.zeros_like(rgb)
    for (x, y, r, k, j) in punkty:
        x0, x1 = int(max(0, x - r - 2)), int(min(w, x + r + 3))
        y0, y1 = int(max(0, y - r - 2)), int(min(h, y + r + 3))
        if x1 <= x0 or y1 <= y0:
            continue
        yy, xx = np.mgrid[y0:y1, x0:x1].astype(np.float32)
        d = np.sqrt((xx - x) ** 2 + (yy - y) ** 2) / r
        dysk = smoothstep(d, 1.0, 0.8)
        brzeg = np.exp(-((d - 0.88) / 0.07) ** 2) * 0.12
        warstwa[y0:y1, x0:x1] += (dysk * (0.75 + 0.25 * (1 - d * d).clip(0)) + brzeg)[..., None] * (kol(k) * j)
    return np.clip(rgb + warstwa, 0, 1) if tryb == "add" else 1 - (1 - rgb) * (1 - np.clip(warstwa, 0, 1))


# ================================================================================================
# Fonty i tekst
# ================================================================================================
FONT_PLIKI = {
    "cinzel900": "cinzel-{s}-900-normal.woff2",
    "cinzel700": "cinzel-{s}-700-normal.woff2",
    "cinzeldeco900": "cinzel-decorative-{s}-900-normal.woff2",
    "cinzeldeco700": "cinzel-decorative-{s}-700-normal.woff2",
    "bungee": "bungee-{s}-400-normal.woff2",
    "marcellus": "marcellus-{s}-400-normal.woff2",
    "manrope800": "manrope-{s}-800-normal.woff2",
    "manrope700": "manrope-{s}-700-normal.woff2",
}


@lru_cache(maxsize=64)
def _font(nazwa: str, podzbior: str, rozmiar: int):
    plik = FONT_PLIKI[nazwa].format(s=podzbior)
    for kat in (FONTY, FONTY_NPM / nazwa.rstrip("0123456789").replace("cinzeldeco", "cinzel-decorative") / "files"):
        if (kat / plik).exists():
            return ImageFont.truetype(str(kat / plik), rozmiar)
    return ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf", rozmiar)


@lru_cache(maxsize=4096)
def _ma_znak(nazwa, podzbior, rozmiar, znak) -> bool:
    f = _font(nazwa, podzbior, rozmiar)
    a = np.array(f.getmask(znak))
    b = np.array(f.getmask("\U0010FFFD"))
    return not (a.shape == b.shape and (a == b).all())


def font_dla(nazwa: str, rozmiar: int, znak: str):
    """Pakiety @fontsource dzielą kroje na podzbiory latin / latin-ext (Ł jest w latin-ext) — wybieramy plik,
    który ma dany znak."""
    for pod in ("latin", "latin-ext"):
        if _ma_znak(nazwa, pod, rozmiar, znak):
            return _font(nazwa, pod, rozmiar)
    return _font(nazwa, "latin", rozmiar)


def maska_tekstu(tekst: str, nazwa: str, rozmiar: int, odstep: float = 0.0, nadprobkowanie: int = 2) -> np.ndarray:
    """Maska napisu (float 0–1), litera po literze (różne pliki fontu dla różnych znaków), z odstępem
    ``odstep`` (ułamek rozmiaru) między literami. Rysujemy w 2× i zmniejszamy — gładsze krawędzie."""
    s = nadprobkowanie
    R = rozmiar * s
    znaki = []
    x = 0.0
    for z in tekst:
        f = font_dla(nazwa, R, z)
        adv = f.getlength(z)
        znaki.append((z, f, x))
        x += adv + odstep * R
    szer = int(x - odstep * R) + 4 * s
    asc, desc = _font(nazwa, "latin", R).getmetrics()
    wys = asc + desc + 4 * s
    im = Image.new("L", (max(1, szer), wys), 0)
    d = ImageDraw.Draw(im)
    for z, f, xx in znaki:
        d.text((xx + 2 * s, 2 * s), z, font=f, fill=255)
    im = im.resize((max(1, szer // s), max(1, wys // s)), Image.Resampling.LANCZOS)
    m = np.asarray(im, dtype=np.float32) / 255
    return przytnij_maske(m)


def przytnij_maske(m: np.ndarray, margines: int = 0) -> np.ndarray:
    ys, xs = np.nonzero(m > 0.01)
    if len(xs) == 0:
        return m
    return m[max(0, ys.min() - margines):ys.max() + 1 + margines, max(0, xs.min() - margines):xs.max() + 1 + margines]


def wysrodkuj_maske(m: np.ndarray, w: int, h: int) -> np.ndarray:
    out = np.zeros((h, w), np.float32)
    mh, mw = m.shape
    y, x = (h - mh) // 2, (w - mw) // 2
    out[max(0, y):max(0, y) + min(mh, h), max(0, x):max(0, x) + min(mw, w)] = \
        m[max(0, -y):max(0, -y) + min(mh, h), max(0, -x):max(0, -x) + min(mw, w)]
    return out


def luk(m: np.ndarray, wysokosc_luku: float) -> np.ndarray:
    """Wygina napis w łagodny „uśmiech”: środek wyżej niż końce o ``wysokosc_luku`` (ułamek wysokości maski)."""
    h, w = m.shape
    dy = wysokosc_luku * h
    pad = int(abs(dy)) + 2
    p = np.pad(m, ((pad, pad), (0, 0)))
    out = np.zeros_like(p)
    for x in range(w):
        t = (x / max(1, w - 1)) * 2 - 1
        przes = int(round(-dy * (1 - t * t)))
        out[:, x] = np.roll(p[:, x], przes)
    return przytnij_maske(out)


def maska_rysunku(w: int, h: int, rysuj, nadprobkowanie: int = 3) -> np.ndarray:
    """Maska z rysunku Pillow (``rysuj(draw, s)`` dostaje skalę nadpróbkowania) — gładkie krawędzie."""
    s = nadprobkowanie
    im = Image.new("L", (w * s, h * s), 0)
    rysuj(ImageDraw.Draw(im), s)
    im = im.resize((w, h), Image.Resampling.LANCZOS)
    return np.asarray(im, dtype=np.float32) / 255


# ================================================================================================
# Relief: maska → wysokość → normalne → matcap
# ================================================================================================
def _erfinv(x):
    """Odwrotna funkcja błędu (przybliżenie M. Gilesa) — potrzebna do zamiany rozmycia na odległość."""
    x = np.clip(x, -0.999999, 0.999999)
    w = -np.log((1.0 - x) * (1.0 + x))
    w1 = w - 2.5
    p1 = 2.81022636e-08
    for c in (3.43273939e-07, -3.5233877e-06, -4.39150654e-06, 0.00021858087, -0.00125372503,
              -0.00417768164, 0.246640727, 1.50140941):
        p1 = c + p1 * w1
    w2 = np.sqrt(w) - 3.0
    p2 = -0.000200214257
    for c in (0.000100950558, 0.00134934322, -0.00367342844, 0.00573950773, -0.0076224613,
              0.00943887047, 1.00167406, 2.83297682):
        p2 = c + p2 * w2
    return np.where(w < 5.0, p1, p2) * x


def odleglosc(maska: np.ndarray, zasieg: float) -> np.ndarray:
    """Przybliżona odległość ze znakiem od krawędzi maski (px, dodatnia w środku), wiarygodna do ±``zasieg``.

    Sztuczka: rozmycie Gaussa krawędzi prostej daje profil Φ(d/σ) (dystrybuanta rozkładu normalnego), więc
    d = σ·Φ⁻¹(rozmycie). W narożnikach wynik jest lekko zaokrąglony — dla fazy to wręcz zaleta."""
    sigma = max(0.7, zasieg / 2.3)
    b = rozmyj(np.clip(maska, 0, 1).astype(np.float32), sigma)
    d = sigma * math.sqrt(2) * _erfinv(2 * np.clip(b, 1e-5, 1 - 1e-5) - 1)
    return np.clip(d, -zasieg, zasieg).astype(np.float32)


def wysokosc(maska: np.ndarray, faza: float, profil: str = "okragly", plaski: float = 1.0) -> np.ndarray:
    """Mapa wysokości z maski: faza o szerokości ``faza`` px przy krawędzi, płaski blat w środku.
    ``profil``: 'skos' (ostra faza), 'okragly' (zaokrąglona krawędź), 'poduszka' (miękka, wypukła)."""
    d = odleglosc(maska, faza)
    t = np.clip(d / faza, 0, 1)
    if profil == "skos":
        h = t
    elif profil == "poduszka":
        h = np.sin(t * math.pi / 2) ** 0.8
    else:
        h = np.sqrt(1 - (1 - t) ** 2)
    return (h * faza * plaski).astype(np.float32)


def kopula(maska: np.ndarray, wysokosc_px: float, zasieg: float | None = None) -> np.ndarray:
    """Wypukła „poduszka” na całym kształcie (kamień szlachetny, owoc, kropla)."""
    zasieg = zasieg or max(4.0, 0.25 * min(maska.shape))
    d = odleglosc(maska, zasieg)
    t = np.clip(d / zasieg, 0, 1)
    return (np.sqrt(1 - (1 - t) ** 2) * wysokosc_px).astype(np.float32)


def normalne(h: np.ndarray, sila: float = 1.0) -> np.ndarray:
    """Normalne powierzchni z mapy wysokości (układ kamery: x w prawo, y w górę, z do widza)."""
    gy, gx = np.gradient(h.astype(np.float32))
    n = np.stack([-gx * sila, gy * sila, np.ones_like(h)], -1)
    return n / np.linalg.norm(n, axis=-1, keepdims=True)


@lru_cache(maxsize=64)
def matcap(nazwa: str) -> np.ndarray:
    """Matcap z renderów Blendera (art/zastepcze/_render/matcap_<nazwa>.png), RGB float."""
    return render(f"matcap_{nazwa}")[..., :3].copy()


def probkuj_matcap(n: np.ndarray, mc: np.ndarray) -> np.ndarray:
    """Kolor z matcapu dla normalnych n (dwuliniowo). Kula zajmuje cały kadr renderu."""
    H, W = mc.shape[:2]
    r = 0.985
    u = (0.5 + 0.5 * r * n[..., 0]) * (W - 1)
    v = (0.5 - 0.5 * r * n[..., 1]) * (H - 1)
    x0 = np.clip(np.floor(u).astype(np.int32), 0, W - 2)
    y0 = np.clip(np.floor(v).astype(np.int32), 0, H - 2)
    fx = (u - x0)[..., None]
    fy = (v - y0)[..., None]
    c = (mc[y0, x0] * (1 - fx) * (1 - fy) + mc[y0, x0 + 1] * fx * (1 - fy)
         + mc[y0 + 1, x0] * (1 - fx) * fy + mc[y0 + 1, x0 + 1] * fx * fy)
    return c.astype(np.float32)


def material(n: np.ndarray, rodzaj: str, gra: str = "global", kolor=None, polysk: float = 1.0) -> np.ndarray:
    """Kolor powierzchni z normalnych. ``rodzaj``: 'zloto', 'zloto_satyna', 'chrom', 'bialezloto', 'szklo',
    albo 'emalia' (kolor × matcap rozproszony + odblaski z matcapu lakieru), 'kamien' (emalia matowa)."""
    if rodzaj in ("zloto", "zloto_satyna"):
        nazwa = f"{rodzaj}_{gra}" if (RENDERY / f"matcap_{rodzaj}_{gra}.png").exists() else f"{rodzaj}_global"
        return probkuj_matcap(n, matcap(nazwa))
    if rodzaj in ("chrom", "bialezloto", "szklo"):
        return probkuj_matcap(n, matcap(rodzaj))
    k = kol(kolor) if isinstance(kolor, str) else np.asarray(kolor, np.float32)
    dif = probkuj_matcap(n, matcap(f"emalia_dif_{gra}"))
    spek = probkuj_matcap(n, matcap(f"emalia_spek_{gra}"))
    if rodzaj == "kamien":
        return np.clip(k * dif * 1.05 + spek * 0.12 * polysk, 0, 1)
    return np.clip(k * dif + spek * polysk, 0, 1)


def ao(h: np.ndarray, promien: float, sila: float = 1.0) -> np.ndarray:
    """Okluzja otoczenia (przyciemnienie zagłębień): piksel niżej niż średnia okolicy = w zagłębieniu."""
    sr = rozmyj(h, promien)
    return np.clip(1 - np.maximum(sr - h, 0) / max(promien, 1e-6) * sila, 0.35, 1.0)[..., None]


def relief(maska: np.ndarray, rodzaj: str, faza: float, gra: str = "global", kolor=None, profil="okragly",
           sila: float = 1.0, h: np.ndarray | None = None, ao_sila: float = 0.6, polysk: float = 1.0) -> np.ndarray:
    """Najczęstszy przypadek: jeden kształt z jednego materiału → RGBA."""
    if h is None:
        h = wysokosc(maska, faza, profil)
    n = normalne(h, sila)
    rgb = material(n, rodzaj, gra, kolor, polysk) * ao(h, faza * 1.5, ao_sila)
    return np.concatenate([rgb, np.clip(maska, 0, 1)[..., None]], -1).astype(np.float32)


def ekstruzja(gora: np.ndarray, glebokosc: int, rodzaj="zloto", gra="global", kolor=None,
              kierunek=(0.25, 1.0), ciemniej: float = 0.55) -> np.ndarray:
    """Bryła wyciągnięta w głąb: pod licem rysujemy przesunięte kopie (ściany boczne) coraz ciemniejsze —
    tak wygląda litera 3D widziana lekko od dołu (01 § 4.3)."""
    H, W = gora.shape[:2]
    dx, dy = kierunek
    pad = glebokosc + 2
    out = np.zeros((H + 2 * pad, W + 2 * pad, 4), np.float32)
    a = gora[..., 3]
    # kolor ścian: z matcapu dla normalnej skierowanej w dół-prawo
    n = np.array([[[0.25, -0.85, 0.46]]], np.float32)
    n /= np.linalg.norm(n)
    bok = material(n, rodzaj, gra, kolor)[0, 0]
    for d in range(glebokosc, 0, -1):
        t = d / glebokosc
        warstwa = np.zeros_like(gora)
        warstwa[..., :3] = bok * (1 - ciemniej * t) * (0.85 + 0.15 * (d % 3 == 0))
        warstwa[..., 3] = a
        nakladaj(out, warstwa, pad + int(round(dx * d)), pad + int(round(dy * d)))
    nakladaj(out, gora, pad, pad)
    return przytnij_alfa(out)


def blysk(rgba: np.ndarray, x: float, y: float, r: float, sila: float = 1.0) -> np.ndarray:
    """4-ramienna gwiazdka odblasku (drobne błyski na krawędziach złota)."""
    H, W = rgba.shape[:2]
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    dx, dy = (xx - x) / r, (yy - y) / r
    g = np.exp(-(dx * dx + dy * dy) * 6) + 0.8 * (np.exp(-np.abs(dy) * 30) * np.exp(-np.abs(dx) * 2.2)
                                                + np.exp(-np.abs(dx) * 30) * np.exp(-np.abs(dy) * 2.2))
    g = np.clip(g * sila, 0, 1)
    out = rgba.copy()
    out[..., :3] = 1 - (1 - out[..., :3]) * (1 - g[..., None] * np.array([1.0, 0.97, 0.88]))
    out[..., 3] = np.maximum(out[..., 3], g)
    return out


# ================================================================================================
# Napisy 3D (złote litery: banery wygranych, logotypy, cyfry)
# ================================================================================================
def gradient_lica(maska: np.ndarray, gora=(1.12, 1.06, 0.92), dol=(0.86, 0.74, 0.55)) -> np.ndarray:
    """Pionowy gradient lica liter (01 § 2.3: --gold-1 u góry → --gold-3 u dołu), mnożony przez matcap."""
    ys = np.nonzero(maska.max(1) > 0.05)[0]
    h = maska.shape[0]
    y0, y1 = (ys.min(), ys.max()) if len(ys) else (0, h - 1)
    t = np.clip((np.arange(h) - y0) / max(1, y1 - y0), 0, 1)[:, None, None]
    return (np.array(gora) * (1 - t) + np.array(dol) * t).astype(np.float32)


def zloty_napis(maska: np.ndarray, faza: float = 12, glebokosc: int = 18, kontur: float = 8,
                rodzaj: str = "zloto", gra: str = "global", kolor=None, poswiata_r: float = 0,
                poswiata_kolor="gold2", wypuklosc: float = 0.35, gradient: bool = True,
                wkladki: list | None = None, kontur_kolor="kontur", sila: float = 1.3,
                profil: str = "okragly", zwroc_lico: bool = False) -> np.ndarray:
    """Maska napisu → litery z fazą, lekko wypukłym licem, ekstruzją w dół, ciemnym konturem i poświatą.

    ``wkladki`` = lista (maska, rodzaj, kolor, profil) — inkrustacje na licu: lapis w literach S2, fioletowy
    metal w EPIC WIN, klejnoty w MEGA WIN, kryształ w ULTRA WIN. ``kolor`` może być tablicą (H, W, 3) —
    np. tęczowy gradient kryształu."""
    pad = int(faza + 4)
    m = np.pad(maska, pad)
    h = wysokosc(m, faza, profil)
    if wypuklosc:
        ys = np.nonzero(m.max(1) > 0.05)[0]
        yc, hh = (ys.min() + ys.max()) / 2, max(1, (ys.max() - ys.min()) / 2)
        yy = np.arange(m.shape[0], dtype=np.float32)[:, None]
        h = h + wypuklosc * faza * 3 * np.clip(1 - ((yy - yc) / hh) ** 2, 0, 1) * (m > 0.01)
    n = normalne(h, sila)
    rgb = material(n, rodzaj, gra, kolor)
    if gradient and rodzaj.startswith("zloto"):
        rgb = rgb * gradient_lica(m)
    for (wm, w_rodzaj, w_kolor, w_profil) in (wkladki or []):
        w = np.pad(wm, pad)
        if isinstance(w_kolor, np.ndarray) and w_kolor.ndim == 3:
            w_kolor = np.pad(w_kolor, ((pad, pad), (pad, pad), (0, 0)), mode="edge")
        if w_profil == "kopula":
            hw = kopula(w, faza * 0.8, max(3.0, faza * 0.7))
        elif w_profil == "skos":
            hw = wysokosc(w, max(3.0, faza * 0.9), "skos") * 1.4
        else:
            hw = wysokosc(w, max(2.0, faza * 0.4), "okragly") * 0.6
        nw = normalne(h * 0.25 + hw, sila * (1.6 if w_profil == "skos" else 1.0))
        if isinstance(w_kolor, np.ndarray) and w_kolor.ndim == 3:
            dif = probkuj_matcap(nw, matcap(f"emalia_dif_{gra}"))
            spek = probkuj_matcap(nw, matcap(f"emalia_spek_{gra}"))
            kol_w = np.clip(w_kolor * (0.35 + 0.8 * dif) + spek * 1.4, 0, 1)
        elif w_rodzaj == "swiecace":
            kol_w = np.broadcast_to(kol(w_kolor), rgb.shape) * (0.85 + 0.3 * np.clip(hw / max(hw.max(), 1e-6), 0, 1))[..., None]
        else:
            kol_w = material(nw, w_rodzaj, gra, w_kolor)
        rgb = rgb * (1 - w[..., None]) + kol_w * w[..., None]
    rgb = rgb * ao(h, faza * 1.2, 0.5)
    gora = np.concatenate([np.clip(rgb, 0, 1), m[..., None]], -1).astype(np.float32)
    if zwroc_lico:
        return gora
    out = ekstruzja(gora, glebokosc, rodzaj, gra, kolor) if glebokosc else przytnij_alfa(gora)
    if kontur:
        out = obrys(np.pad(out, ((int(kontur * 2),) * 2, (int(kontur * 2),) * 2, (0, 0))), kontur, kontur_kolor)
    if poswiata_r:
        out = poswiata(out, poswiata_r, poswiata_kolor, 0.45)
    return przytnij_alfa(out)


def tecza(h: int, w: int, kolory=("#21E6FF", "#8F3DFF", "#FF2E88", "#FFE08A"), kat: float = 0.35) -> np.ndarray:
    """Tęczowy gradient po skosie (kryształ ULTRA WIN, logo S3)."""
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    t = (xx / max(1, w) * math.cos(kat) + yy / max(1, h) * math.sin(kat))
    t = (t - t.min()) / max(1e-6, t.max() - t.min())
    poz = np.linspace(0, 1, len(kolory))
    k = np.array([kol(c) for c in kolory])
    return np.stack([np.interp(t, poz, k[:, i]) for i in range(3)], -1).astype(np.float32)


def wiersze_napisu(wiersze: list[str], font: str, wys_litery: int, odstep_liter=0.02, odstep_wierszy=0.18,
                   luk_proc: float = 0.0) -> np.ndarray:
    """Kilka wierszy napisu wyśrodkowanych jeden pod drugim, litery wszystkich wierszy tej samej wysokości."""
    maski = []
    for w in wiersze:
        m = maska_tekstu(w, font, int(wys_litery * 1.4), odstep_liter)
        k = wys_litery / max(1, m.shape[0])
        im = Image.fromarray((m * 255).astype(np.uint8)).resize((max(1, int(m.shape[1] * k)), wys_litery),
                                                                Image.Resampling.LANCZOS)
        m = np.asarray(im, dtype=np.float32) / 255
        if luk_proc:
            m = luk(np.pad(m, ((int(wys_litery * luk_proc) + 2,) * 2, (0, 0))), luk_proc)
        maski.append(m)
    W = max(m.shape[1] for m in maski)
    odst = int(wys_litery * odstep_wierszy)
    H = sum(m.shape[0] for m in maski) + odst * (len(maski) - 1)
    out = np.zeros((H, W), np.float32)
    y = 0
    for m in maski:
        x = (W - m.shape[1]) // 2
        out[y:y + m.shape[0], x:x + m.shape[1]] = np.maximum(out[y:y + m.shape[0], x:x + m.shape[1]], m)
        y += m.shape[0] + odst
    return out
