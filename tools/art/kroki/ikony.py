"""
ikony.py — favicony i ikony aplikacji z emblematu ``g_emblemat`` (02 § 5.19).

Po co to jest: karta przeglądarki, zakładka, ekran główny telefonu potrzebują małych ikon w kilku rozmiarach
i formatach. Nie generujemy osobnego obrazu — zmniejszamy emblemat, osobno dla każdego rozmiaru, z lekkim
wyostrzeniem (w 16 px zostaje złoty krążek z ząbkami korony, co wystarcza do rozpoznania).
"""

from __future__ import annotations

import io
import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageEnhance, ImageFilter

from .obraz import do_pil, hex_do_rgb
from .skala import skaluj, zapisz


def _kwadrat(rgba: np.ndarray) -> np.ndarray:
    h, w = rgba.shape[:2]
    b = max(h, w)
    out = np.zeros((b, b, 4), dtype=np.float32)
    out[(b - h) // 2:(b - h) // 2 + h, (b - w) // 2:(b - w) // 2 + w] = rgba
    return out


def _ikona(emb: np.ndarray, bok: int, wypelnienie: float = 1.0, tlo: np.ndarray | None = None) -> Image.Image:
    wew = max(1, int(round(bok * wypelnienie)))
    male = skaluj(emb, wew, wew)
    plotno = np.zeros((bok, bok, 4), dtype=np.float32) if tlo is None else tlo.copy()
    o = (bok - wew) // 2
    a = male[..., 3:4]
    plotno[o:o + wew, o:o + wew, :3] = male[..., :3] * a + plotno[o:o + wew, o:o + wew, :3] * (1 - a)
    plotno[o:o + wew, o:o + wew, 3:4] = a + plotno[o:o + wew, o:o + wew, 3:4] * (1 - a)
    im = do_pil(plotno)
    if bok <= 48:
        rgb = im.convert("RGB").filter(ImageFilter.UnsharpMask(radius=0.5, percent=80, threshold=1))
        rgb = ImageEnhance.Contrast(rgb).enhance(1.10)
        im = Image.merge("RGBA", (*rgb.split(), im.getchannel("A")))
    return im


def _gradient_radialny(bok: int, srodek: str, brzeg: str) -> np.ndarray:
    yy, xx = np.mgrid[0:bok, 0:bok]
    r = np.sqrt((xx - bok / 2 + 0.5) ** 2 + (yy - bok / 2 + 0.5) ** 2) / (bok * 0.7071)
    t = np.clip(r, 0, 1)[..., None]
    rgb = hex_do_rgb(srodek) * (1 - t) + hex_do_rgb(brzeg) * t
    return np.concatenate([rgb, np.ones((bok, bok, 1))], -1).astype(np.float32)


def generuj_ikony(emblemat: np.ndarray, katalog: Path) -> dict:
    """Zapisuje pliki ikon do ``katalog`` (assets/img/global/) i zwraca słownik do manifest.json → icons."""
    emb = _kwadrat(emblemat)
    pliki = {}

    buf = io.BytesIO()
    obrazy = [_ikona(emb, b) for b in (16, 32, 48)]
    obrazy[-1].save(buf, "ICO", sizes=[(16, 16), (32, 32), (48, 48)], append_images=obrazy[:-1])
    zapisz(katalog / "favicon.ico", buf.getvalue())
    pliki["favicon.ico"] = "global/favicon.ico"

    def png(nazwa, im):
        b = io.BytesIO()
        im.save(b, "PNG", optimize=True)
        zapisz(katalog / nazwa, b.getvalue())
        pliki[nazwa] = f"global/{nazwa}"

    png("favicon-32.png", obrazy[1])
    png("icon-192.png", _ikona(emb, 192))
    png("icon-512.png", _ikona(emb, 512))
    # maskable: system przycina ikonę do własnego kształtu → emblemat w kole bezpiecznym 80% (skala 0,62)
    png("icon-maskable-512.png", _ikona(emb, 512, 0.62, tlo=_gradient_radialny(512, "#1E1442", "#120B2A")))
    # iOS zamienia przezroczystość na czerń → pełne tło z gradientem marki
    png("apple-touch-icon.png", _ikona(emb, 180, 0.82, tlo=_gradient_radialny(180, "#1E1442", "#07060F")).convert("RGB"))

    webmanifest = {
        "name": "Cebulion Casino",
        "short_name": "Cebulion",
        "description": "Symulator kasyna z wirtualną walutą cebulion — bez prawdziwych pieniędzy.",
        "icons": [
            {"src": "icon-192.png", "sizes": "192x192", "type": "image/png"},
            {"src": "icon-512.png", "sizes": "512x512", "type": "image/png"},
            {"src": "icon-maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable"},
        ],
        "theme_color": "#07060F",
        "background_color": "#07060F",
        "display": "standalone",
    }
    zapisz(katalog / "site.webmanifest",
           (json.dumps(webmanifest, ensure_ascii=False, indent=2) + "\n").encode("utf-8"))
    pliki["site.webmanifest"] = "global/site.webmanifest"
    return pliki
