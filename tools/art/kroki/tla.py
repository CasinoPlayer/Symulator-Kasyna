"""
tla.py — obrazy PELNE: tła gier i lobby, okładki kafli, banery (02 § 5.17–5.18).

Po co to jest
-------------
Tła wypełniają cały ekran (jak CSS ``object-fit: cover``) na ekranach od telefonu do 4K, a ChatGPT oddaje
najwyżej 1536 px. Robimy więc kilka wariantów szerokości (``srcset`` / wybór wg poziomu jakości), przy
powiększaniu dodajemy lekkie ziarno (maskuje miękkość i pasma w ciemnych gradientach), a do szybkiego
startu strony — miniaturę LQIP (kilkaset bajtów, pokazywana rozmyta, zanim przyjdzie właściwy plik).
"""

from __future__ import annotations

import base64
import hashlib
import io

import numpy as np

from .obraz import do_pil, hex_do_rgb, jasnosc, rozmyj
from .skala import skaluj

TLO_STRONY = hex_do_rgb("#07060F")   # --bg-0: na nim spłaszczamy ewentualną przezroczystość
LIMIT_POWIEKSZENIA_TLA = 1.67         # tła są ciemne i częściowo przykryte bębnami (02 § 2.6)


def splaszcz(rgba: np.ndarray, uwagi: list) -> np.ndarray:
    a = rgba[..., 3:4]
    if float((a < 0.98).mean()) > 0.001:
        uwagi.append(("ostrzezenie", "Q03", "obraz PELNE ma przezroczyste obszary — spłaszczono na #07060F"))
    return rgba[..., :3] * a + TLO_STRONY * (1 - a)


def kadruj(rgb: np.ndarray, proporcja: float, focus=(0.5, 0.5)) -> np.ndarray:
    """Wycina największy prostokąt o zadanej proporcji (szer./wys.) wokół punktu ogniskowego."""
    H, W = rgb.shape[:2]
    if abs(W / H - proporcja) < 0.005:
        return rgb
    if W / H > proporcja:
        nw = int(round(H * proporcja))
        x = int(round(np.clip(focus[0] * W - nw / 2, 0, W - nw)))
        return rgb[:, x:x + nw]
    nh = int(round(W / proporcja))
    y = int(round(np.clip(focus[1] * H - nh / 2, 0, H - nh)))
    return rgb[y:y + nh]


def ziarno(rgb: np.ndarray, sila: float, ziarno_id: str) -> np.ndarray:
    """Szum trójkątny ±sila (w jednostkach 0–1), mocniejszy w ciemnych partiach. Ziarno losowania zależy od ID,
    więc wynik jest powtarzalny (te same wejścia = te same bajty)."""
    seed = int(hashlib.sha256(ziarno_id.encode()).hexdigest()[:8], 16)
    rng = np.random.default_rng(seed)
    H, W = rgb.shape[:2]
    szum = (rng.random((H, W, 1), dtype=np.float32) - rng.random((H, W, 1), dtype=np.float32)) * sila
    L = jasnosc(rgb)[..., None]
    waga = 0.6 + 0.4 * (1 - np.clip(L * 3, 0, 1))
    return np.clip(rgb + szum * waga, 0, 1)


def wariant_szerokosci(rgb: np.ndarray, szer: int, ziarno_id: str, uwagi: list | None = None,
                       limit: float = LIMIT_POWIEKSZENIA_TLA) -> np.ndarray | None:
    """Skaluje do szerokości ``szer``. Powiększenie ponad limit → None (wariantu nie robimy)."""
    H, W = rgb.shape[:2]
    k = szer / W
    if k > limit + 1e-6:
        if uwagi is not None:
            uwagi.append(("info", "Q20", f"pominięto wariant w{szer} (wymagałby powiększenia ×{k:.2f})"))
        return None
    wys = int(round(H * k))
    rgba = np.concatenate([rgb, np.ones_like(rgb[..., :1])], -1)
    out = skaluj(rgba, szer, wys)[..., :3]
    # dithering przeciw pasmom: ±1/255 zawsze, przy powiększeniu ziarno proporcjonalnie mocniejsze
    sila = 1.0 / 255 + (max(0.0, k - 1.0) * 2.5 / 255)
    return ziarno(out, sila, f"{ziarno_id}:{szer}")


def lqip(rgb: np.ndarray, w: int, h: int) -> str:
    """Miniatura (np. 24×16) WebP q30 jako data URI — ~250–400 bajtów prosto w manifest.json."""
    im = do_pil(rgb).resize((w, h), resample=3)
    buf = io.BytesIO()
    im.save(buf, "WEBP", quality=30, method=6)
    return "data:image/webp;base64," + base64.b64encode(buf.getvalue()).decode("ascii")


def rozmyte(rgb: np.ndarray, szer: int) -> np.ndarray:
    """Mocno rozmyta, przyciemniona miniatura (zamiast kosztownego backdrop-filter pod modalami)."""
    H, W = rgb.shape[:2]
    maly = skaluj(np.concatenate([rgb, np.ones_like(rgb[..., :1])], -1), szer, int(round(H * szer / W)),
                  wyostrz=False)[..., :3]
    return np.clip(rozmyj(maly, 0.03 * szer) * 0.75, 0, 1)
