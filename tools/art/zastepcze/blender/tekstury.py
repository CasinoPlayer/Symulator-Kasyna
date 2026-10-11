"""
tekstury.py — mapy wysokości (Pillow + NumPy) używane przez modele Blendera: relief awersu monety
i promienisty „sunburst” na emaliowanym polu emblematu.

Po co osobno: relief łatwiej NARYSOWAĆ w 2D (kształty, gwiazdki, perełki) niż wymodelować. Blender dostaje
gotową mapę wysokości i przemieszcza nią siatkę (modyfikator Displace) — powstaje prawdziwa płaskorzeźba,
w której odbija się światło studia.
"""

from __future__ import annotations

import math
import sys
from pathlib import Path

import numpy as np
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import biblioteka as B  # noqa: E402

WYJ = B.RENDERY / "tekstury"


def _zapisz16(h: np.ndarray, nazwa: str) -> Path:
    WYJ.mkdir(parents=True, exist_ok=True)
    p = WYJ / nazwa
    v = (np.clip(h, 0, 1) * 65535).astype(np.uint16)
    Image.fromarray(v).save(p)
    return p


def sylwetka_cebuli_w_koronie(N: int, cx: float, cy: float, s: float):
    """Maski (cebula, korona) w pikselach: wspólny motyw monety, emblematu i ornamentów."""
    def cebula(d, k):
        pts = []
        for i in range(81):
            t = i / 80
            r = math.sin(math.pi * t ** 0.62) ** 1.05
            pts.append((r, t))
        lewa = [((cx - r * 0.5 * s) * k, (cy + 0.45 * s - t * 0.95 * s) * k) for r, t in pts]
        prawa = [((cx + r * 0.5 * s) * k, (cy + 0.45 * s - t * 0.95 * s) * k) for r, t in reversed(pts)]
        d.polygon(lewa + prawa, fill=255)

    def korona(d, k):
        y0 = cy - 0.36 * s
        w = 0.26 * s
        d.rectangle([(cx - w) * k, (y0 - 0.02 * s) * k, (cx + w) * k, (y0 + 0.07 * s) * k], fill=255)
        for i, dx in enumerate((-1, -0.5, 0, 0.5, 1)):
            x = cx + dx * w * 0.92
            wys = (0.24 if i % 2 == 0 else 0.17) * s
            d.polygon([((x - 0.06 * s) * k, (y0 - 0.0 * s) * k), ((x + 0.06 * s) * k, y0 * k),
                       (x * k, (y0 - wys) * k)], fill=255)
            rr = 0.035 * s
            d.ellipse([(x - rr) * k, (y0 - wys - rr) * k, (x + rr) * k, (y0 - wys + rr) * k], fill=255)
    return B.maska_rysunku(N, N, cebula), B.maska_rysunku(N, N, korona)


def relief_monety(N: int = 1024) -> Path:
    p = WYJ / "relief_monety.png"
    if p.exists():
        return p
    jedn = N / (2 * 0.82)                     # 1 jednostka modelu w pikselach
    c = N / 2
    ceb, kor = sylwetka_cebuli_w_koronie(N, c, c + 0.06 * jedn, 0.62 * jedn)
    h = B.kopula(ceb, 1.0, 0.12 * jedn) * 0.9
    h = np.maximum(h, B.wysokosc(kor, 0.03 * jedn, "okragly") / (0.03 * jedn) * 0.75)

    def gwiazdy(d, k):
        for sx in (-1, 1):
            x0, y0, R = c + sx * 0.5 * jedn, c + 0.02 * jedn, 0.075 * jedn
            pts = []
            for i in range(10):
                a = -math.pi / 2 + i * math.pi / 5
                rr = R if i % 2 == 0 else R * 0.42
                pts.append(((x0 + rr * math.cos(a)) * k, (y0 + rr * math.sin(a)) * k))
            d.polygon(pts, fill=255)

    def laur(d, k):
        for s in (-1, 1):
            for i in range(6):
                a = math.radians(90 + s * (22 + i * 12))
                r = 0.6 * jedn
                x, y = c + r * math.cos(a), c + r * math.sin(a)
                dl, sz = 0.07 * jedn, 0.03 * jedn
                ka = a + math.pi / 2 + s * 0.6
                pts = []
                for j in range(16):
                    t = 2 * math.pi * j / 16
                    px, py = dl * math.cos(t), sz * math.sin(t)
                    pts.append(((x + px * math.cos(ka) - py * math.sin(ka)) * k,
                                (y + px * math.sin(ka) + py * math.cos(ka)) * k))
                d.polygon(pts, fill=255)

    def perly(d, k):
        R = 0.765 * jedn
        r = 0.02 * jedn
        for i in range(60):
            a = 2 * math.pi * i / 60
            x, y = c + R * math.cos(a), c + R * math.sin(a)
            d.ellipse([(x - r) * k, (y - r) * k, (x + r) * k, (y + r) * k], fill=255)
    mg = B.maska_rysunku(N, N, gwiazdy)
    ml = B.maska_rysunku(N, N, laur)
    mp = B.maska_rysunku(N, N, perly)
    h = np.maximum(h, B.wysokosc(mg, 0.03 * jedn, "skos") / (0.03 * jedn) * 0.55)
    h = np.maximum(h, B.kopula(ml, 0.5, 0.025 * jedn))
    h = np.maximum(h, B.kopula(mp, 0.55, 0.02 * jedn))
    h = B.rozmyj(h, 0.8)
    return _zapisz16(h, "relief_monety.png")


def sunburst(N: int = 512, promienie: int = 36) -> Path:
    p = WYJ / "sunburst.png"
    if p.exists():
        return p
    yy, xx = np.mgrid[0:N, 0:N].astype(np.float32)
    a = np.arctan2(yy - N / 2, xx - N / 2)
    r = np.sqrt((xx - N / 2) ** 2 + (yy - N / 2) ** 2) / (N / 2)
    h = 0.5 + 0.5 * np.cos(a * promienie)
    h = h ** 2 * np.clip(r * 1.4, 0, 1) * (1 - 0.3 * r)
    return _zapisz16(h, "sunburst.png")
