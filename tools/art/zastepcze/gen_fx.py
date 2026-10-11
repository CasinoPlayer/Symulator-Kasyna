"""
gen_fx.py — efekty świetlne grafiki zastępczej (01 § 4.8): promienie, flara, iskry, pioruny, dym (na czarnym
tle, do mieszania ``add``), konfetti (przezroczyste tło) i świecące hieroglify S2.

Efekty są proceduralne (NumPy): współrzędne biegunowe, funkcje Gaussa, szum fraktalny, łamana z przemieszczaniem
punktu środkowego (pioruny). Barwa prawie biała z ciepłym odcieniem #FFF3D1 — kolor nadaje kod przez ``tint``.
"""

from __future__ import annotations

import math

import numpy as np

import biblioteka as B

CIEPLY = np.array([1.0, 0.953, 0.82], np.float32)     # #FFF3D1


def _biegunowe(n, cx=None, cy=None):
    cx = n / 2 if cx is None else cx
    cy = n / 2 if cy is None else cy
    yy, xx = np.mgrid[0:n, 0:n].astype(np.float32)
    return np.sqrt((xx - cx) ** 2 + (yy - cy) ** 2), np.arctan2(yy - cy, xx - cx)


def _rgb(jasnosc, kolor=CIEPLY):
    j = np.clip(jasnosc, 0, None)
    # tone mapping: bardzo jasne miejsca dążą do bieli, reszta zachowuje barwę
    rgb = 1 - np.exp(-j[..., None] * kolor * 1.6)
    out = np.concatenate([rgb, np.ones_like(j)[..., None]], -1)
    return out.astype(np.float32)


def g_fx_promienie():
    n = 1024
    r, a = _biegunowe(n)
    rng = np.random.default_rng(11)
    j = np.zeros((n, n), np.float32)
    k = 22
    for i in range(k):
        th = 2 * math.pi * i / k + rng.uniform(-0.08, 0.08)
        w = rng.uniform(0.035, 0.11)
        L = rng.uniform(0.6, 1.0) * 0.43 * n
        d = np.angle(np.exp(1j * (a - th)))
        promien = np.exp(-(d / w) ** 2) * np.clip(1 - r / L, 0, 1) ** 1.6
        j += promien * rng.uniform(0.5, 1.0)
    smugi = B.szum(n, n, 6, 2, 3)
    j *= 0.75 + 0.25 * smugi
    j += np.exp(-(r / (0.045 * n)) ** 2) * 1.1             # miękki rdzeń ≤ 10% średnicy
    return _rgb(j * 0.9)


def g_fx_flara():
    n = 1024
    yy, xx = np.mgrid[0:n, 0:n].astype(np.float32)
    x, y = (xx - n / 2) / n, (yy - n / 2) / n
    r = np.sqrt(x * x + y * y)
    j = np.exp(-(r / 0.018) ** 2) * 3.0 + np.exp(-(r / 0.06) ** 2) * 0.6           # gorący rdzeń
    j += (np.exp(-np.abs(y) / 0.0035) * np.exp(-np.abs(x) / 0.17)
          + np.exp(-np.abs(x) / 0.0035) * np.exp(-np.abs(y) / 0.17)) * 1.2         # 4 długie ramiona
    u, v = (x + y) / math.sqrt(2), (x - y) / math.sqrt(2)
    j += (np.exp(-np.abs(u) / 0.003) * np.exp(-np.abs(v) / 0.07)
          + np.exp(-np.abs(v) / 0.003) * np.exp(-np.abs(u) / 0.07)) * 0.6          # 4 krótsze ukośne
    j += np.exp(-((r - 0.12) / 0.006) ** 2) * 0.18                                  # cienki pierścień halo
    j += np.exp(-np.abs(y) / 0.006) * np.exp(-np.abs(x) / 0.33) * 0.35             # smuga anamorficzna
    return _rgb(j)


def _iskra(rodzaj: str, n: int) -> np.ndarray:
    yy, xx = np.mgrid[0:n, 0:n].astype(np.float32)
    x, y = (xx - n / 2) / n, (yy - n / 2) / n
    r = np.sqrt(x * x + y * y)
    a = np.arctan2(y, x)
    if rodzaj == "gwiazda4":
        j = np.exp(-(r / 0.03) ** 2) * 2 + (np.exp(-np.abs(y) / 0.008) * np.exp(-np.abs(x) / 0.12)
                                           + np.exp(-np.abs(x) / 0.008) * np.exp(-np.abs(y) / 0.12)) * 1.4
    elif rodzaj == "gwiazda6":
        j = np.exp(-(r / 0.03) ** 2) * 2
        for k in range(3):
            th = k * math.pi / 3
            u = x * math.cos(th) + y * math.sin(th)
            v = -x * math.sin(th) + y * math.cos(th)
            j += np.exp(-np.abs(v) / 0.007) * np.exp(-np.abs(u) / 0.1) * 1.2
    elif rodzaj == "kula":
        j = np.exp(-(r / 0.13) ** 2) * 1.0 + np.exp(-(r / 0.04) ** 2) * 1.2
    elif rodzaj == "krzyz":
        j = (np.exp(-np.abs(y) / 0.004) * np.exp(-(x / 0.3) ** 2)
             + np.exp(-np.abs(x) / 0.004) * np.exp(-(y / 0.3) ** 2)) * 1.6 + np.exp(-(r / 0.02) ** 2)
    elif rodzaj == "romb":
        d = np.abs(x) / 0.1 + np.abs(y) / 0.22
        j = np.exp(-d ** 2 * 3) * 1.6 + np.exp(-(r / 0.02) ** 2)
    elif rodzaj == "smuga":
        u, v = (x + y) / math.sqrt(2), (x - y) / math.sqrt(2)
        j = np.exp(-np.abs(v) / 0.01) * np.exp(-(u / 0.28) ** 2) * np.clip(0.5 + u * 1.6, 0, 1.4) * 1.5
        j += np.exp(-((u - 0.2) ** 2 + v ** 2) / 0.0012) * 1.5
    elif rodzaj == "wiazka":
        rng = np.random.default_rng(5)
        j = np.zeros_like(r)
        for _ in range(7):
            px, py = rng.uniform(-0.25, 0.25, 2)
            s = rng.uniform(0.012, 0.03)
            rr = np.sqrt((x - px) ** 2 + (y - py) ** 2)
            j += np.exp(-(rr / s) ** 2) * 1.8 + (np.exp(-np.abs(y - py) / 0.003) * np.exp(-np.abs(x - px) / (s * 2.5))
                                               + np.exp(-np.abs(x - px) / 0.003) * np.exp(-np.abs(y - py) / (s * 2.5))) * 0.8
    else:  # pierscien
        j = np.exp(-((r - 0.2) / 0.012) ** 2) * 1.2 + np.exp(-(r / 0.03) ** 2) * 1.0
    del a
    return _rgb(j)


def g_fx_iskry():
    W, H = 1536, 1024
    out = B.plotno(W, H, "#000000")
    cw, ch = W / 4, H / 2
    n = int(min(cw, ch) * 0.8)
    for i, rodzaj in enumerate(["gwiazda4", "gwiazda6", "kula", "krzyz", "romb", "smuga", "wiazka", "pierscien"]):
        r, c = divmod(i, 4)
        B.nakladaj_srodek(out, _iskra(rodzaj, n), c * cw + cw / 2, r * ch + ch / 2, tryb="add")
    return out


def _piorun(w, h, seed):
    """Piorun: łamana z przemieszczaniem punktu środkowego + 2–4 odgałęzienia, biały rdzeń, chłodna poświata."""
    rng = np.random.default_rng(seed)

    def lamana(p0, p1, rozrzut, glebokosc):
        if glebokosc == 0:
            return [p0, p1]
        mx, my = (p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2
        dx, dy = p1[0] - p0[0], p1[1] - p0[1]
        dl = math.hypot(dx, dy)
        nx, ny = -dy / dl, dx / dl
        o = rng.normal(0, rozrzut * dl)
        m = (min(max(mx + nx * o, w * 0.14), w * 0.86), my + ny * o)     # piorun nie wychodzi poza komórkę
        return lamana(p0, m, rozrzut, glebokosc - 1)[:-1] + lamana(m, p1, rozrzut, glebokosc - 1)
    glowna = lamana((w * 0.5 + rng.uniform(-0.1, 0.1) * w, h * 0.075), (w * 0.5 + rng.uniform(-0.15, 0.15) * w, h * 0.925), 0.22, 7)
    galezie = []
    for _ in range(rng.integers(2, 5)):
        i = rng.integers(len(glowna) // 6, len(glowna) * 2 // 3)
        p0 = glowna[i]
        kier = rng.choice([-1, 1])
        p1 = (min(max(p0[0] + kier * rng.uniform(0.12, 0.25) * w, w * 0.16), w * 0.84),
              p0[1] + rng.uniform(0.12, 0.28) * h)
        galezie.append(lamana(p0, p1, 0.25, 5))

    def rys(grubosc):
        def f(d, s):
            d.line([(x * s, y * s) for x, y in glowna], fill=255, width=max(1, int(grubosc * s)), joint="curve")
            for g in galezie:
                d.line([(x * s, y * s) for x, y in g], fill=200, width=max(1, int(grubosc * 0.55 * s)), joint="curve")
        return f
    rdzen = B.maska_rysunku(w, h, rys(w * 0.012))
    blask = B.rozmyj(rdzen, w * 0.02) * 2.5 + B.rozmyj(rdzen, w * 0.06) * 1.2
    jas = rdzen * 2.5
    rgb = 1 - np.exp(-(jas[..., None] * np.array([1.0, 1.0, 1.0]) + blask[..., None] * np.array([0.55, 0.75, 1.0])) * 1.5)
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    brzeg = B.smoothstep(np.minimum(np.minimum(xx, w - xx), np.minimum(yy, h - yy)), 0, 0.08 * w)
    return np.concatenate([rgb * brzeg[..., None], np.ones((h, w, 1))], -1).astype(np.float32)


def g_fx_blyskawice():
    W, H = 1536, 1024
    out = B.plotno(W, H, "#000000")
    cw = W // 3
    for i in range(3):
        p = _piorun(int(cw * 0.86), int(H * 0.92), 40 + i * 7)
        p[..., :3] *= (1.0, 0.85, 0.7)[i]
        B.nakladaj_srodek(out, p, i * cw + cw / 2, H / 2, tryb="add")
    return out


def g_fx_dym():
    """Obłok dymu: kilkanaście miękkich „kłębów” (funkcje Gaussa) × szum fraktalny, brzeg rozmyty do czerni."""
    n = 1024
    rng = np.random.default_rng(23)
    yy, xx = np.mgrid[0:n, 0:n].astype(np.float32) / n
    gest = np.zeros((n, n), np.float32)
    for _ in range(16):
        cx, cy = 0.5 + rng.normal(0, 0.11), 0.5 + rng.normal(0, 0.08)
        r = rng.uniform(0.08, 0.17)
        gest += np.exp(-(((xx - cx) ** 2 + (yy - cy) ** 2) / (r * r))) * rng.uniform(0.5, 1.0)
    s1 = B.szum(n, n, 140, 5, 21)
    s2 = B.szum(n, n, 45, 4, 22)
    gest = np.clip(gest * 0.7, 0, 1.4) * (0.45 + 0.55 * s1) * (0.75 + 0.25 * s2)
    gest = B.smoothstep(gest, 0.05, 1.0) ** 1.2
    r = np.sqrt((xx - 0.5) ** 2 + (yy - 0.5) ** 2)
    gest *= B.smoothstep(0.47 - r, 0.0, 0.12)
    rgb = np.clip(gest[..., None] * 0.7 * np.array([0.95, 0.94, 1.0]), 0, 1)
    return np.concatenate([rgb, np.ones((n, n, 1))], -1).astype(np.float32)


# ------------------------------------------------------------------------------------------------
# Konfetti (ALFA SHEET 4×3): metaliczna folia — 5× złoto, 4× magenta, 3× cyjan
# ------------------------------------------------------------------------------------------------
def _konfetto(ksztalt: str, n: int, seed: int) -> np.ndarray:
    rng = np.random.default_rng(seed)
    c = n / 2

    def rys(d, s):
        if ksztalt == "prostokat":
            kat = rng.uniform(0, math.pi)
            w, h = n * 0.18, n * 0.42
            pts = [(c + px * math.cos(kat) - py * math.sin(kat), c + px * math.sin(kat) + py * math.cos(kat))
                   for px, py in ((-w, -h), (w, -h), (w, h), (-w, h))]
            d.polygon([(x * s, y * s) for x, y in pts], fill=255)
        elif ksztalt == "serpentyna":
            pts = []
            for i in range(60):
                t = i / 59
                pts.append(((0.15 + 0.7 * t) * n * s, (c + math.sin(t * math.pi * 3 + seed) * 0.18 * n) * s))
            d.line(pts, fill=255, width=int(0.1 * n * s), joint="curve")
        elif ksztalt == "gwiazda":
            pts = []
            for i in range(10):
                a = -math.pi / 2 + i * math.pi / 5
                rr = 0.42 * n if i % 2 == 0 else 0.18 * n
                pts.append(((c + rr * math.cos(a)) * s, (c + rr * math.sin(a)) * s))
            d.polygon(pts, fill=255)
        elif ksztalt == "krazek":
            d.ellipse([(c - 0.3 * n) * s, (c - 0.22 * n) * s, (c + 0.3 * n) * s, (c + 0.22 * n) * s], fill=255)
        elif ksztalt == "wstazka":
            for i in range(5):
                x = (0.15 + 0.17 * i) * n
                w = 0.08 * n * (1 if i % 2 == 0 else 0.45)
                d.polygon([((x - w) * s, (c - 0.3 * n + i * 0.12 * n) * s), ((x + 0.17 * n - w) * s, (c - 0.2 * n + i * 0.12 * n) * s),
                           ((x + 0.17 * n + w) * s, (c - 0.1 * n + i * 0.12 * n) * s), ((x + w) * s, (c - 0.2 * n + i * 0.12 * n) * s)],
                          fill=255)
        else:  # romb
            d.polygon([(c * s, 0.08 * n * s), (0.72 * n * s, c * s), (c * s, 0.92 * n * s), (0.28 * n * s, c * s)], fill=255)
    return B.maska_rysunku(n, n, rys)


def g_fx_konfetti():
    W, H = 1536, 1024
    out = B.plotno(W, H)
    cw, ch = W / 4, H / 3
    n = int(min(cw, ch) * 0.8)
    plan = [("prostokat", "zloto"), ("prostokat", "#FF2E88"), ("prostokat", "#21E6FF"), ("prostokat", "zloto"),
            ("serpentyna", "#FF2E88"), ("serpentyna", "zloto"), ("serpentyna", "#21E6FF"), ("gwiazda", "zloto"),
            ("gwiazda", "#FF2E88"), ("krazek", "#21E6FF"), ("wstazka", "#FF2E88"), ("romb", "zloto")]
    for i, (ksz, kol) in enumerate(plan):
        r, c = divmod(i, 4)
        m = _konfetto(ksz, n, 100 + i)
        h = B.wysokosc(m, 0.03 * n, "okragly")
        # folia: pofalowana powierzchnia (ostre odblaski)
        h = h + B.szum(n, n, n * 0.25, 2, i) * 0.03 * n * (m > 0.5)
        nrm = B.normalne(h, 2.0)
        if kol == "zloto":
            rgb = B.material(nrm, "zloto")
        else:
            rgb = B.material(nrm, "emalia", kolor=kol, polysk=1.6)
        el = np.concatenate([rgb, m[..., None]], -1).astype(np.float32)
        B.nakladaj_srodek(out, el, c * cw + cw / 2, r * ch + ch / 2)
    return out


# ------------------------------------------------------------------------------------------------
# Hieroglify S2 (CZARNE SHEET 4×2): świecąca linia złoto-biała z turkusową poświatą
# ------------------------------------------------------------------------------------------------
def _hieroglif(nazwa: str, n: int) -> np.ndarray:
    g = 0.035 * n
    c = n / 2

    def rys(d, s):
        def lin(pts, w=g, zamknij=False):
            p = [(x * n * s, y * n * s) for x, y in pts]
            if zamknij:
                p.append(p[0])
            d.line(p, fill=255, width=int(w * s), joint="curve")

        def elipsa(x0, y0, x1, y1, w=g):
            d.ellipse([x0 * n * s, y0 * n * s, x1 * n * s, y1 * n * s], outline=255, width=int(w * s))
        if nazwa == "ankh":
            elipsa(0.38, 0.12, 0.62, 0.42)
            lin([(0.5, 0.42), (0.5, 0.9)])
            lin([(0.28, 0.48), (0.72, 0.48)])
        elif nazwa == "wadzet":
            elipsa(0.3, 0.36, 0.66, 0.54)
            d.ellipse([0.43 * n * s, 0.39 * n * s, 0.53 * n * s, 0.51 * n * s], fill=255)
            lin([(0.24, 0.3), (0.5, 0.26), (0.74, 0.32)])
            lin([(0.42, 0.54), (0.4, 0.78)])
            lin([(0.58, 0.54), (0.62, 0.7), (0.74, 0.72), (0.78, 0.64), (0.7, 0.6)])
        elif nazwa == "skarabeusz":
            elipsa(0.38, 0.32, 0.62, 0.72)
            elipsa(0.43, 0.18, 0.57, 0.32)
            lin([(0.38, 0.45), (0.18, 0.36), (0.12, 0.5)])
            lin([(0.62, 0.45), (0.82, 0.36), (0.88, 0.5)])
            lin([(0.4, 0.66), (0.26, 0.82)])
            lin([(0.6, 0.66), (0.74, 0.82)])
        elif nazwa == "pioro":
            lin([(0.5, 0.88), (0.5, 0.12)])
            lin([(0.5, 0.12), (0.62, 0.22), (0.64, 0.5), (0.58, 0.8), (0.5, 0.86)])
            for t in (0.3, 0.45, 0.6, 0.72):
                lin([(0.5, t), (0.6, t - 0.05)], g * 0.6)
        elif nazwa == "dzed":
            lin([(0.5, 0.2), (0.5, 0.88)])
            for t in (0.2, 0.28, 0.36, 0.44):
                lin([(0.34, t), (0.66, t)])
            lin([(0.36, 0.88), (0.64, 0.88)])
        elif nazwa == "was":
            lin([(0.5, 0.26), (0.5, 0.86), (0.42, 0.9)])
            lin([(0.5, 0.86), (0.58, 0.9)])
            lin([(0.5, 0.26), (0.42, 0.14), (0.62, 0.18), (0.58, 0.26)])
        elif nazwa == "lotos":
            lin([(0.5, 0.88), (0.5, 0.56)])
            for dx in (-0.2, -0.1, 0.0, 0.1, 0.2):
                lin([(0.5, 0.56), (0.5 + dx * 1.2, 0.22 + abs(dx) * 0.8), (0.5 + dx * 0.4, 0.56)], g * 0.8)
        else:  # szen
            elipsa(0.28, 0.16, 0.72, 0.6)
            lin([(0.26, 0.72), (0.74, 0.72)])
            lin([(0.4, 0.6), (0.4, 0.72)])
            lin([(0.6, 0.6), (0.6, 0.72)])
    rdzen = B.maska_rysunku(n, n, rys)
    blask = B.rozmyj(rdzen, n * 0.025) * 1.8
    jas = rdzen * 1.6
    rgb = 1 - np.exp(-(jas[..., None] * np.array([1.0, 0.92, 0.7]) + blask[..., None] * np.array([0.2, 0.8, 0.75])) * 1.6)
    return np.concatenate([rgb, np.ones((n, n, 1))], -1).astype(np.float32)


def s2_fx_hieroglify():
    W, H = 1536, 1024
    out = B.plotno(W, H, "#000000")
    cw, ch = W / 4, H / 2
    n = int(min(cw, ch) * 0.8)
    for i, nazwa in enumerate(["ankh", "wadzet", "skarabeusz", "pioro", "dzed", "was", "lotos", "szen"]):
        r, c = divmod(i, 4)
        B.nakladaj_srodek(out, _hieroglif(nazwa, n), c * cw + cw / 2, r * ch + ch / 2, tryb="add")
    return out


GENERATORY = {
    "g_fx_promienie": g_fx_promienie, "g_fx_flara": g_fx_flara, "g_fx_iskry": g_fx_iskry,
    "g_fx_blyskawice": g_fx_blyskawice, "g_fx_dym": g_fx_dym, "g_fx_konfetti": g_fx_konfetti,
    "s2_fx_hieroglify": s2_fx_hieroglify,
}
