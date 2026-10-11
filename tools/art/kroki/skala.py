"""
skala.py — skalowanie i kodowanie (02 § 5.7–5.8).

Po co to jest
-------------
* **Skalowanie w świetle liniowym z alfą premultiplikowaną.** Uśrednianie pikseli w przestrzeni sRGB (gamma)
  przyciemnia jasne odblaski na złocie i „wychudza” cienkie jasne linie (rdzenie neonów). Premultiplikacja
  (kolor × alfa) zapobiega ciemnym/kolorowym obwódkom od niewidocznych pikseli z α = 0.
* **Lekkie wyostrzenie** po zmniejszeniu przywraca „chrupkość” krawędzi (tylko RGB, nie alfa).
* **WebP**: obrazy z alfą — stratny kolor + bezstratna alfa; UI — mniejszy z bezstratnego i stratnego q90;
  efekty CZARNE i tła — bez kanału alfa (mniejszy plik).
"""

from __future__ import annotations

import hashlib
import io
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

from .obraz import do_pil, liniowy_do_srgb, srgb_do_liniowego

METODA_WEBP = 4   # 0–6: 6 = najmniejsze pliki, ale wielokrotnie wolniej (opcja --dokladnie)


def ustaw_metode(m: int) -> None:
    global METODA_WEBP
    METODA_WEBP = m


def skaluj(rgba: np.ndarray, w: int, h: int, wyostrz: bool = True) -> np.ndarray:
    """Zmienia rozmiar RGBA (float 0–1) do (w, h). Lanczos w świetle liniowym, alfa premultiplikowana."""
    H, W = rgba.shape[:2]
    if (W, H) == (w, h):
        return rgba.copy()
    ma_alfe = rgba.shape[2] == 4
    lin = srgb_do_liniowego(rgba[..., :3])
    a = rgba[..., 3] if ma_alfe else np.ones((H, W), np.float32)
    kanaly = [lin[..., i] * a for i in range(3)] + ([a] if ma_alfe else [])
    wynik = []
    for k in kanaly:
        im = Image.fromarray(k.astype(np.float32), "F")
        wynik.append(np.asarray(im.resize((w, h), Image.Resampling.LANCZOS), dtype=np.float32))
    if ma_alfe:
        na = np.clip(wynik[3], 0, 1)
        kol = np.stack(wynik[:3], -1) / np.maximum(na, 1e-6)[..., None]
        kol = np.where(na[..., None] > 1e-6, kol, 0)
        out = np.concatenate([liniowy_do_srgb(kol), na[..., None]], -1)
    else:
        out = liniowy_do_srgb(np.stack(wynik, -1))
    if wyostrz:
        out = _wyostrz(out, powiekszenie=(w > W), maly=max(w, h) <= 128)
    return out.astype(np.float32)


def _wyostrz(rgba: np.ndarray, powiekszenie: bool, maly: bool) -> np.ndarray:
    """UnsharpMask tylko na kolorze: po zmniejszeniu delikatnie, po powiększeniu mocniej (02 § 5.7 pkt 2–3)."""
    if powiekszenie:
        filtr = ImageFilter.UnsharpMask(radius=1.0, percent=35, threshold=2)
    elif maly:
        filtr = ImageFilter.UnsharpMask(radius=0.5, percent=70, threshold=2)
    else:
        filtr = ImageFilter.UnsharpMask(radius=0.6, percent=40, threshold=2)
    rgb = do_pil(rgba[..., :3]).filter(filtr)
    out = rgba.copy()
    out[..., :3] = np.asarray(rgb, dtype=np.float32) / 255.0
    return out


def wklej_na_plotno(obraz: np.ndarray, w: int, h: int, cx: float, cy: float) -> np.ndarray:
    """Kładzie obraz na przezroczystym płótnie w×h tak, by jego punkt (cx, cy) wypadł w środku płótna."""
    plotno = np.zeros((h, w, 4), dtype=np.float32)
    oh, ow = obraz.shape[:2]
    x = int(round(w / 2 - cx))
    y = int(round(h / 2 - cy))
    sx0, sy0 = max(0, -x), max(0, -y)
    dx0, dy0 = max(0, x), max(0, y)
    sw = min(ow - sx0, w - dx0)
    sh = min(oh - sy0, h - dy0)
    if sw > 0 and sh > 0:
        plotno[dy0:dy0 + sh, dx0:dx0 + sw] = obraz[sy0:sy0 + sh, sx0:sx0 + sw]
    return plotno


def parzyste(v: float) -> int:
    """@1x zaokrąglamy w górę do liczby parzystej, żeby @2x było dokładnie 2× (02 § 5.7 pkt 4)."""
    n = int(np.ceil(v - 1e-6))
    return n + (n % 2)


# ------------------------------------------------------------------------------------------------
# Zapis
# ------------------------------------------------------------------------------------------------
def zakoduj_webp(rgba: np.ndarray, rodzaj: str) -> bytes:
    """Koduje obraz do WebP. ``rodzaj``: 'alfa' (q82 + bezstratna alfa), 'ui' (mniejszy z bezstratnego i q90),
    'pelne' (q80, bez alfy), 'pelne_kafel' (q78 — okładki i banery), 'czarne' (q80, bez alfy), 'miekkie' (q70 — poświaty, cienie, rozmycia)."""
    if rodzaj in ("pelne", "pelne_kafel", "czarne"):
        im = do_pil(rgba[..., :3])
    else:
        im = do_pil(rgba if rgba.shape[2] == 4 else np.concatenate([rgba, np.ones_like(rgba[..., :1])], -1))
    buf = io.BytesIO()
    if rodzaj == "ui":
        im.save(buf, "WEBP", lossless=True, method=METODA_WEBP, exact=False)
        bez = buf.getvalue()
        buf = io.BytesIO()
        im.save(buf, "WEBP", quality=90, method=METODA_WEBP, alpha_quality=100)
        stratny = buf.getvalue()
        return bez if len(bez) <= len(stratny) else stratny
    # PELNE q80: grafika z ChatGPT jest bardzo szczegółowa (bogate tła, key art), a q85 → q80 oszczędza ~17% wagi
    # przy różnicy < 1 dB PSNR — tło leży pod bębnami i UI, a budżety z briefu § 5 są twarde
    jakosc = {"alfa": 82, "pelne": 80, "pelne_kafel": 78, "czarne": 80, "miekkie": 70}[rodzaj]
    opcje = dict(quality=jakosc, method=METODA_WEBP)
    if im.mode == "RGBA":
        opcje["alpha_quality"] = 100
    im.save(buf, "WEBP", **opcje)
    return buf.getvalue()


def zapisz(sciezka: Path, dane: bytes) -> str:
    """Zapisuje plik tylko, gdy treść się zmieniła (git nie widzi fałszywych zmian). Zwraca 8 znaków SHA-256."""
    sciezka.parent.mkdir(parents=True, exist_ok=True)
    if not sciezka.exists() or sciezka.read_bytes() != dane:
        sciezka.write_bytes(dane)
    return hashlib.sha256(dane).hexdigest()[:8]
