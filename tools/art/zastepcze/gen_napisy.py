"""
gen_napisy.py — napisy 3D grafiki zastępczej: banery wygranych (BIG / MEGA / EPIC / ULTRA WIN, FREE SPINS),
złote cyfry do fontu bitmapowego i logotypy (marka, S1, S2, S3).

Wszystkie napisy powstają tak samo: maska tekstu z fontu OFL (Cinzel, Bungee, Cinzel Decorative, Marcellus) →
faza i lekko wypukłe lico → matcap złota z renderu Blendera → ekstruzja w dół → ciemny kontur → poświata
(01 § 7.8). Różnice między poziomami wygranej (klejnoty, płomienie, kryształ) to inkrustacje i dodatki.
"""

from __future__ import annotations

import math

import numpy as np
from PIL import Image, ImageDraw

import biblioteka as B

W32, H32 = 1536, 1024


# ------------------------------------------------------------------------------------------------
# Dodatki
# ------------------------------------------------------------------------------------------------
def _punkty_na_literach(m: np.ndarray, krok: int, margines: int, seed=0):
    """Punkty wewnątrz liter (na środkowej linii wiersza) — miejsca na klejnoty MEGA WIN."""
    rdzen = B.erozja(m > 0.5, margines)
    pts = []
    ys = np.nonzero(m.max(1) > 0.5)[0]
    if len(ys) == 0:
        return pts
    # dwa wiersze: środki obu połówek wysokości
    srodki = [ys.min() + (ys.max() - ys.min()) * f for f in (0.24, 0.76)]
    for yc in srodki:
        yc = int(yc)
        x = 0
        while x < m.shape[1]:
            if rdzen[yc, x]:
                pts.append((x, yc))
                x += krok
            else:
                x += 2
    return pts


def _kola(shape, punkty, r):
    def rys(d, s):
        for (x, y) in punkty:
            d.ellipse([(x - r) * s, (y - r) * s, (x + r) * s, (y + r) * s], fill=255)
    return B.maska_rysunku(shape[1], shape[0], rys)


def _plomienie(w: int, h: int, seed: int = 7) -> np.ndarray:
    """Fioletowe płomienie (EPIC WIN): języki = sinusoida zaburzona szumem, wygaszane ku górze; rdzeń magenta."""
    n = B.szum(h, w, 40, 4, seed)
    yy = np.linspace(1, 0, h, dtype=np.float32)[:, None]          # 1 = dół
    xx = np.linspace(0, 1, w, dtype=np.float32)[None, :]
    jezyki = 0.5 + 0.5 * np.sin(xx * 2 * math.pi * 11 + n * 5.0)
    wys_jezyka = 0.45 + 0.55 * jezyki * (0.6 + 0.4 * B.szum(1, w, 30, 2, seed + 3))
    gest = np.clip((yy - (1 - wys_jezyka)) / np.maximum(wys_jezyka, 1e-3), 0, 1)
    gest = B.smoothstep(gest, 0.0, 0.7) * (0.75 + 0.25 * n)
    rdzen = B.smoothstep(gest, 0.55, 1.0)
    rgb = B.kol("violet_epic") * (0.6 + 0.4 * gest[..., None]) + (B.kol("magenta") - B.kol("violet_epic")) * rdzen[..., None]
    rgb = rgb + np.array([1.0, 0.85, 1.0]) * B.smoothstep(gest, 0.85, 1.0)[..., None] * 0.45
    brzeg = B.smoothstep(np.minimum(xx, 1 - xx), 0, 0.1)
    a = np.clip(gest * 1.15, 0, 1) * brzeg
    return np.concatenate([np.clip(rgb, 0, 1), a[..., None]], -1).astype(np.float32)


def korona_2d(szer: int, gra="global", klejnoty=True) -> np.ndarray:
    """Mała złota korona z klejnotami (nad ULTRA WIN, w ornamencie)."""
    w, h = szer, int(szer * 0.62)

    def rys(d, s):
        b = h * 0.62
        d.rectangle([w * 0.1 * s, b * s, w * 0.9 * s, h * 0.92 * s], fill=255)
        for i, x in enumerate((0.1, 0.3, 0.5, 0.7, 0.9)):
            top = h * (0.12 if i % 2 == 0 else 0.3)
            d.polygon([((x - 0.09) * w * s, b * s), ((x + 0.09) * w * s, b * s), (x * w * s, top * s)], fill=255)
            r = w * 0.045
            d.ellipse([(x * w - r) * s, (top - r) * s, (x * w + r) * s, (top + r) * s], fill=255)
    m = B.maska_rysunku(w, h, rys)
    wk = []
    if klejnoty:
        for x, k in ((0.5, "#FF2E88"), (0.3, "#21E6FF"), (0.7, "#21E6FF")):
            wk.append((_kola(m.shape, [(x * w, h * 0.77)], w * 0.045), "emalia", k, "kopula"))
    return B.zloty_napis(m, faza=max(3, w * 0.03), glebokosc=max(2, int(w * 0.03)), kontur=max(2, w * 0.012),
                         gra=gra, wkladki=wk)


def _odlamki_z_renderu(n: int, seed: int = 3) -> list[np.ndarray]:
    """Kilka odłamków kryształu wyciętych z renderu s3_odlamki (siatka 4×3)."""
    r = B.render("s3_odlamki")
    H, W = r.shape[:2]
    out = []
    rng = np.random.default_rng(seed)
    for i in rng.choice(12, n, replace=False):
        rr, cc = divmod(int(i), 4)
        kaw = r[int(rr * H / 3):int((rr + 1) * H / 3), int(cc * W / 4):int((cc + 1) * W / 4)]
        out.append(B.przytnij_alfa(kaw, 2))
    return out


# ------------------------------------------------------------------------------------------------
# Banery wygranych (3:2, ALFA)
# ------------------------------------------------------------------------------------------------
def _maska_banera(wiersze):
    return B.wiersze_napisu(wiersze, "cinzel900", 300, 0.025, 0.12, luk_proc=0.05)


def g_win_big():
    m = _maska_banera(["BIG", "WIN"])
    out = B.zloty_napis(m, faza=14, glebokosc=26, kontur=11, poswiata_r=16)
    for (fx, fy, r) in ((0.16, 0.12, 46), (0.86, 0.55, 38), (0.4, 0.93, 30)):
        out = B.blysk(out, out.shape[1] * fx, out.shape[0] * fy, r, 1.0)
    return B.wpasuj(out, W32, H32, 0.84)


def g_win_mega():
    m = _maska_banera(["MEGA", "WIN"])
    pts = _punkty_na_literach(m, 64, 20)
    mag = _kola(m.shape, pts[0::2], 15)
    cyj = _kola(m.shape, pts[1::2], 15)
    out = B.zloty_napis(m, faza=14, glebokosc=26, kontur=11, poswiata_r=18, poswiata_kolor="magenta",
                        wkladki=[(mag, "emalia", "#FF2E88", "kopula"), (cyj, "emalia", "#21E6FF", "kopula")])
    # złota laurowa wstęga pod napisem
    lw, lh = int(out.shape[1] * 0.9), int(out.shape[0] * 0.16)

    def laur(d, s):
        for strona in (-1, 1):
            for i in range(9):
                t = i / 8
                x = lw / 2 + strona * (0.06 + 0.42 * t) * lw
                y = lh * (0.25 + 0.5 * t * t)
                a = strona * (0.5 + 0.8 * t)
                L, S = lh * 0.42, lh * 0.16
                pts_ = [(x + L * math.cos(a + 0.5 * math.pi) * c - S * math.sin(a + 0.5 * math.pi) * q,
                         y + L * math.sin(a + 0.5 * math.pi) * c + S * math.cos(a + 0.5 * math.pi) * q)
                        for c, q in ((math.cos(u), math.sin(u)) for u in np.linspace(0, 2 * math.pi, 18))]
                d.polygon([(px * s, py * s) for px, py in pts_], fill=255)
        d.ellipse([(lw / 2 - lh * 0.16) * s, lh * 0.1 * s, (lw / 2 + lh * 0.16) * s, lh * 0.42 * s], fill=255)
    lm = B.maska_rysunku(lw, lh, laur)
    laur_img = B.zloty_napis(lm, faza=5, glebokosc=6, kontur=4, wypuklosc=0.1)
    calosc = B.plotno(out.shape[1], out.shape[0] + int(laur_img.shape[0] * 0.75))
    B.nakladaj_srodek(calosc, laur_img, calosc.shape[1] / 2, calosc.shape[0] - laur_img.shape[0] / 2)
    B.nakladaj(calosc, out, 0, 0)
    return B.wpasuj(calosc, W32, H32, 0.84)


def g_win_epic():
    m = _maska_banera(["EPIC", "WIN"])
    rdzen = B.erozja(m > 0.5, 22).astype(np.float32)
    rdzen = B.rozmyj(rdzen, 1.2)
    out = B.zloty_napis(m, faza=14, glebokosc=26, kontur=11, poswiata_r=20, poswiata_kolor="violet_epic",
                        wkladki=[(rdzen, "emalia", "#3A0E6E", "plaski")])
    # płomienie liżą litery od dołu i mieszczą się w marginesie (01 § 7.8)
    pl = _plomienie(int(out.shape[1] * 0.96), int(out.shape[0] * 0.42))
    pl[..., 3] *= 0.9
    calosc = B.plotno(out.shape[1], int(out.shape[0] * 1.1))
    B.nakladaj(calosc, pl, int(out.shape[1] * 0.02), calosc.shape[0] - pl.shape[0])
    B.nakladaj(calosc, out, 0, 0)
    pl2 = _plomienie(int(out.shape[1] * 0.9), int(out.shape[0] * 0.2), 11)
    pl2[..., 3] *= 0.55
    B.nakladaj(calosc, pl2, int(out.shape[1] * 0.05), calosc.shape[0] - pl2.shape[0], tryb="screen")
    return B.wpasuj(calosc, W32, H32, 0.84)


def g_win_ultra():
    m = _maska_banera(["ULTRA", "WIN"])
    rdzen = B.rozmyj(B.erozja(m > 0.5, 12).astype(np.float32), 1.0)
    teczowy = B.tecza(m.shape[0], m.shape[1])
    out = B.zloty_napis(m, faza=12, glebokosc=24, kontur=11, poswiata_r=22, poswiata_kolor="cyan",
                        wkladki=[(rdzen, "emalia", teczowy, "skos")])
    kor = korona_2d(int(out.shape[1] * 0.2))
    calosc = B.plotno(int(out.shape[1] * 1.08), out.shape[0] + int(kor.shape[0] * 0.8))
    B.nakladaj(calosc, out, int(out.shape[1] * 0.04), calosc.shape[0] - out.shape[0])
    B.nakladaj_srodek(calosc, kor, calosc.shape[1] / 2, kor.shape[0] / 2)
    for i, (od, (fx, fy, sk)) in enumerate(zip(_odlamki_z_renderu(5),
                                                [(0.04, 0.35, 0.5), (0.96, 0.42, 0.45), (0.1, 0.92, 0.35),
                                                 (0.92, 0.9, 0.4), (0.22, 0.12, 0.3)])):
        o = B.skaluj(od, max(4, int(od.shape[1] * sk)))
        B.nakladaj_srodek(calosc, o, calosc.shape[1] * fx, calosc.shape[0] * fy)
    for (fx, fy, r) in ((0.3, 0.3, 40), (0.75, 0.6, 46), (0.55, 0.93, 30)):
        calosc = B.blysk(calosc, calosc.shape[1] * fx, calosc.shape[0] * fy, r, 1.0)
    return B.wpasuj(calosc, W32, H32, 0.84)


def g_win_free_spins():
    m = _maska_banera(["FREE", "SPINS"])
    rdzen = B.rozmyj(B.erozja(m > 0.5, 20).astype(np.float32), 6.0) * 0.6
    out = B.zloty_napis(m, faza=14, glebokosc=24, kontur=11, poswiata_r=20, poswiata_kolor="#2EC4B6",
                        wkladki=[(rdzen, "swiecace", "#7FF2F0", "plaski")])
    for (fx, fy, r) in ((0.08, 0.2, 34), (0.93, 0.15, 30), (0.5, 0.5, 26), (0.85, 0.88, 36), (0.12, 0.85, 28)):
        out = B.blysk(out, out.shape[1] * fx, out.shape[0] * fy, r, 1.0)
    return B.wpasuj(out, W32, H32, 0.84)


# ------------------------------------------------------------------------------------------------
# Złote cyfry (3:2, ALFA SHEET 5×3; 2 ostatnie pola puste)
# ------------------------------------------------------------------------------------------------
def g_font_cyfry():
    znaki = list("0123456789") + [",", "+", "×"]
    out = B.plotno(W32, H32)
    cw, ch = W32 / 5, H32 / 3
    wys = 200
    # wspólna linia bazowa: maski z jednego fontu w stałym oknie wysokości (cyfry nautyczne Cinzel 3/5/9 schodzą)
    font = B.font_dla("cinzel900", 300, "0")
    asc, desc = font.getmetrics()
    for i, z in enumerate(znaki):
        r, c = divmod(i, 5)
        im = Image.new("L", (400, asc + desc + 20), 0)
        d = ImageDraw.Draw(im)
        d.text((40, 10), z, font=B.font_dla("cinzel900", 300, z), fill=255)
        m = np.asarray(im, np.float32) / 255
        # skala: wysokość cyfry „0” = wys
        bb0 = font.getbbox("0")
        k = wys / (bb0[3] - bb0[1])
        m = np.asarray(Image.fromarray((m * 255).astype(np.uint8)).resize(
            (int(m.shape[1] * k), int(m.shape[0] * k)), Image.Resampling.LANCZOS), np.float32) / 255
        top0 = int((10 + bb0[1]) * k)
        g = B.zloty_napis(m, faza=9, glebokosc=14, kontur=7, poswiata_r=0, wypuklosc=0.3, zwroc_lico=False)
        # wyrównanie: lico glifu ma tę samą górną linię cyfr w każdej komórce
        ys = np.nonzero(m.max(1) > 0.5)[0]
        przes = (ys.min() - top0) if len(ys) else 0
        x0 = int(c * cw + (cw - g.shape[1]) / 2)
        y0 = int(r * ch + ch * 0.2 + przes)
        B.nakladaj(out, g, x0, y0)
    return out


# ------------------------------------------------------------------------------------------------
# Logotypy
# ------------------------------------------------------------------------------------------------
def g_logo():
    emb = B.przytnij_alfa(B.render("emblemat"))
    m1 = B.wiersze_napisu(["CEBULION"], "cinzel900", 240, 0.03, 0)
    napis = B.zloty_napis(m1, faza=11, glebokosc=18, kontur=9, poswiata_r=0)
    m2 = B.wiersze_napisu(["CASINO"], "cinzel700", 108, 0.35, 0)
    casino = B.zloty_napis(m2, faza=5, glebokosc=7, kontur=5, poswiata_r=0, wypuklosc=0.15)
    szer = napis.shape[1]
    # cienkie złote linie zakończone rombami po obu stronach CASINO
    lin_w = int((szer - casino.shape[1]) / 2 - 40)
    lh = 30

    def linia(d, s):
        d.rectangle([0, (lh / 2 - 2.5) * s, (lin_w - 26) * s, (lh / 2 + 2.5) * s], fill=255)
        d.polygon([((lin_w - 30) * s, lh / 2 * s), ((lin_w - 15) * s, 0), (lin_w * s, lh / 2 * s),
                   ((lin_w - 15) * s, lh * s)], fill=255)
    lm = B.maska_rysunku(lin_w, lh, linia)
    lewa = B.zloty_napis(lm, faza=3, glebokosc=3, kontur=3, wypuklosc=0)
    prawa = lewa[:, ::-1].copy()
    k = 1.25 * napis.shape[0] / emb.shape[0]          # emblemat ≈ 40% wysokości całego logotypu
    emb = B.skaluj(emb, int(emb.shape[1] * k))
    H = emb.shape[0] + napis.shape[0] + casino.shape[0] + 40
    W = max(szer, emb.shape[1]) + 20
    out = B.plotno(W, H)
    B.nakladaj_srodek(out, emb, W / 2, emb.shape[0] / 2)
    B.nakladaj_srodek(out, napis, W / 2, emb.shape[0] + napis.shape[0] / 2 - 10)
    yc = emb.shape[0] + napis.shape[0] + casino.shape[0] / 2 + 10
    B.nakladaj_srodek(out, casino, W / 2, yc)
    B.nakladaj_srodek(out, prawa, W / 2 - casino.shape[1] / 2 - 20 - lin_w / 2, yc)
    B.nakladaj_srodek(out, lewa, W / 2 + casino.shape[1] / 2 + 20 + lin_w / 2, yc)
    return B.wpasuj(out, W32, H32, 0.84)


def _neon(m: np.ndarray, kolor: str, rdzen_px: float, poswiata_px: float, gra="s1") -> np.ndarray:
    """Rurka neonowa w kształcie maski: kolorowe szkło, biały gorący rdzeń, ciasna kolorowa poświata."""
    h = B.wysokosc(m, max(2.0, rdzen_px * 2), "poduszka")
    n = B.normalne(h, 1.5)
    rgb = B.material(n, "emalia", gra, kolor, polysk=0.8)
    rdzen = B.rozmyj(B.erozja(m > 0.5, max(1, int(rdzen_px))).astype(np.float32), rdzen_px * 0.6)
    rgb = rgb * (1 - rdzen[..., None]) + np.array([1, 0.97, 0.98]) * rdzen[..., None]
    rgb = np.clip(rgb + B.kol(kolor) * 0.35, 0, 1)
    rur = np.concatenate([rgb, m[..., None]], -1).astype(np.float32)
    return B.poswiata(rur, poswiata_px, kolor, 0.9)


def s1_logo():
    m1 = B.wiersze_napisu(["CEBULOWY"], "bungee", 190, 0.04, 0)
    m1 = np.pad(m1, 30)
    kontur = (B.rozmyj(B.dylatacja(m1 > 0.5, 16).astype(np.float32), 1.0)
              - B.rozmyj(B.dylatacja(m1 > 0.5, 10).astype(np.float32), 1.0)).clip(0, 1)
    rozowy = _neon(m1, "#FF2E88", 5, 14)
    cyjan = _neon(kontur, "#21E6FF", 2, 10)
    neon = B.plotno(max(rozowy.shape[1], cyjan.shape[1]), max(rozowy.shape[0], cyjan.shape[0]))
    B.nakladaj_srodek(neon, cyjan, neon.shape[1] / 2, neon.shape[0] / 2)
    B.nakladaj_srodek(neon, rozowy, neon.shape[1] / 2, neon.shape[0] / 2)
    # chromowana tablica szyldu z żarówkami
    tw, th = int(neon.shape[1] * 1.04), int(neon.shape[0] * 1.15)

    def tablica(d, s):
        d.rounded_rectangle([0, th * 0.08 * s, tw * s, th * s], radius=th * 0.28 * s, fill=255)
        d.ellipse([tw * 0.3 * s, 0, tw * 0.7 * s, th * 0.4 * s], fill=255)
    tm = B.maska_rysunku(tw, th, tablica)
    h = B.wysokosc(tm, 26, "okragly")
    n = B.normalne(h, 1.2)
    plyta = B.material(n, "chrom") * 0.42 + B.kol("#0B0624") * 0.5
    rama = B.wysokosc(tm, 26, "okragly") < 25
    plyta = np.where(rama[..., None] & (tm[..., None] > 0.5), B.material(n, "chrom"), plyta)
    tab = np.concatenate([np.clip(plyta, 0, 1), tm[..., None]], -1).astype(np.float32)
    # żarówki na obwodzie
    zar = B.plotno(tw, th)
    obw = (B.dylatacja(tm > 0.5, 0) & ~B.erozja(tm > 0.5, 14))
    ys, xs = np.nonzero(obw & B.erozja(tm > 0.5, 6))
    rng = np.random.default_rng(1)
    if len(xs):
        kolej = np.argsort(np.arctan2(ys - th / 2, xs - tw / 2))
        for idx in kolej[::max(1, len(kolej) // 46)]:
            zar = B.nakladaj_srodek(zar, B.poswiata(B.z_maska(B.radialny(14, 14, 7, 7, 7, 0.6), "#FFF3D1"), 6, "#FFC86B", 0.9),
                                    xs[idx], ys[idx])
    del rng
    B.nakladaj(tab, zar, 0, 0, tryb="screen")
    szyld = B.plotno(tw + 60, th + 60)
    B.nakladaj(szyld, B.obrys(tab, 6), 20, 20)
    B.nakladaj_srodek(szyld, neon, szyld.shape[1] / 2, szyld.shape[0] / 2 + th * 0.04)
    # 777: wiśniowa emalia w złotej obwódce, pochylone
    m7 = B.wiersze_napisu(["777"], "bungee", 300, 0.06, 0)
    m7 = np.pad(m7, 40)
    pochyl = Image.fromarray((m7 * 255).astype(np.uint8)).transform(
        (m7.shape[1] + 80, m7.shape[0]), Image.Transform.AFFINE, (1, 0.22, -60, 0, 1, 0), Image.Resampling.BICUBIC)
    m7 = np.asarray(pochyl, np.float32) / 255
    rdzen7 = B.rozmyj(B.erozja(m7 > 0.5, 14).astype(np.float32), 1.0)
    siedem = B.zloty_napis(m7, faza=10, glebokosc=22, kontur=9, gra="s1",
                           wkladki=[(rdzen7, "emalia", "#E3122B", "okragly")])
    calosc = B.plotno(max(szyld.shape[1], siedem.shape[1]), int(szyld.shape[0] * 0.85 + siedem.shape[0]))
    B.nakladaj_srodek(calosc, siedem, calosc.shape[1] / 2, calosc.shape[0] - siedem.shape[0] / 2)
    B.nakladaj_srodek(calosc, szyld, calosc.shape[1] / 2, szyld.shape[0] / 2)
    for (fx, fy, r) in ((0.18, 0.72, 30), (0.82, 0.8, 36)):
        calosc = B.blysk(calosc, calosc.shape[1] * fx, calosc.shape[0] * fy, r, 1.0)
    return B.wpasuj(calosc, W32, H32, 0.84)


def skrzydlaty_dysk(szer: int, gra="s2") -> np.ndarray:
    """Skrzydlaty dysk słońca z dwiema kobrami (egipski motyw nad logo i w ramce S2)."""
    w, h = szer, int(szer * 0.3)

    def skrzydla(d, s):
        for strona in (-1, 1):
            for j in range(4):
                y0 = h * (0.3 + j * 0.14)
                dl = w * (0.47 - j * 0.06)
                pts = [(w / 2 + strona * w * 0.09, y0), (w / 2 + strona * dl, y0 - h * 0.12 + j * h * 0.02),
                       (w / 2 + strona * (dl - w * 0.03), y0 + h * 0.1), (w / 2 + strona * w * 0.09, y0 + h * 0.13)]
                d.polygon([(x * s, y * s) for x, y in pts], fill=255)
    ms = B.maska_rysunku(w, h, skrzydla)
    dysk = B.maska_rysunku(w, h, lambda d, s: d.ellipse([(w / 2 - h * 0.3) * s, h * 0.18 * s,
                                                         (w / 2 + h * 0.3) * s, h * 0.78 * s], fill=255))
    pioro = B.zloty_napis(np.maximum(ms, dysk), faza=4, glebokosc=4, kontur=3, gra=gra, wypuklosc=0.1,
                          wkladki=[(B.rozmyj(B.erozja(dysk > 0.5, int(h * 0.06)).astype(np.float32), 1), "emalia",
                                    "#C8321E", "kopula")])
    return pioro


def s2_logo():
    m1 = B.wiersze_napisu(["ZŁOTY"], "cinzeldeco900", 150, 0.05, 0)
    m2 = B.wiersze_napisu(["FARAON"], "cinzeldeco900", 250, 0.03, 0)

    def napis(m, faza):
        pas = (B.erozja(m > 0.5, int(faza * 0.9)) & ~B.erozja(m > 0.5, int(faza * 1.4))).astype(np.float32)
        return B.zloty_napis(m, faza=faza, glebokosc=int(faza * 1.6), kontur=faza * 0.8, gra="s2",
                             kontur_kolor="#0E2466", wkladki=[(B.rozmyj(pas, 0.8), "emalia", "#1B3FA0", "plaski")])
    z = napis(m1, 8)
    f = napis(m2, 12)
    dysk = skrzydlaty_dysk(int(f.shape[1] * 0.62))
    H = dysk.shape[0] + z.shape[0] + f.shape[0]
    W = max(f.shape[1], dysk.shape[1])
    out = B.plotno(W, H)
    B.nakladaj_srodek(out, dysk, W / 2, dysk.shape[0] / 2)
    B.nakladaj_srodek(out, z, W / 2, dysk.shape[0] + z.shape[0] / 2 - 8)
    B.nakladaj_srodek(out, f, W / 2, dysk.shape[0] + z.shape[0] + f.shape[0] / 2 - 16)
    out = B.poswiata(out, 14, "gold2", 0.3)
    return B.wpasuj(out, W32, H32, 0.84)


def s3_logo():
    m1 = B.wiersze_napisu(["KRYSZTAŁOWA"], "marcellus", 140, 0.07, 0)
    m2 = B.wiersze_napisu(["KASKADA"], "marcellus", 240, 0.06, 0)
    # Marcellus ma cienkie kreski — pogrubiamy maskę, żeby kryształ miał „ciało”
    m1 = B.rozmyj(B.dylatacja(np.pad(m1, 8) > 0.5, 3).astype(np.float32), 1.0)
    m2 = B.rozmyj(B.dylatacja(np.pad(m2, 10) > 0.5, 5).astype(np.float32), 1.2)

    def krysztal(m, faza):
        rdzen = B.rozmyj(B.erozja(m > 0.5, max(2, int(faza * 0.5))).astype(np.float32), 0.8)
        tecz = B.tecza(m.shape[0], m.shape[1], ("#8A4DFF", "#21E6FF", "#B04DFF", "#2EE6B0"), 0.6)
        return B.zloty_napis(m, faza=faza, glebokosc=int(faza * 1.2), kontur=faza * 0.6, gra="s3",
                             poswiata_r=faza * 1.4, poswiata_kolor="#A64DFF", kontur_kolor="#120B2A",
                             wkladki=[(rdzen, "emalia", tecz, "skos")])
    g = krysztal(m1, 7)
    d = krysztal(m2, 11)
    # trzy świetliste krople spod KASKADA
    krople = B.plotno(d.shape[1], 120)
    for fx in (0.3, 0.52, 0.71):
        km = B.maska_rysunku(40, 80, lambda dr, s: (dr.ellipse([6 * s, 36 * s, 34 * s, 74 * s], fill=255),
                                                   dr.polygon([(8 * s, 50 * s), (20 * s, 2 * s), (32 * s, 50 * s)], fill=255)))
        kr = B.relief(km, "emalia", 8, "s3", "#7FE8FF", "poduszka")
        kr = B.poswiata(kr, 8, "#21E6FF", 0.8)
        B.nakladaj_srodek(krople, kr, d.shape[1] * fx, 60)
    H = g.shape[0] + d.shape[0] + 90
    W = max(g.shape[1], d.shape[1])
    out = B.plotno(W, H)
    B.nakladaj_srodek(out, g, W / 2, g.shape[0] / 2)
    B.nakladaj_srodek(out, d, W / 2, g.shape[0] + d.shape[0] / 2 - 6)
    B.nakladaj_srodek(out, krople, W / 2, g.shape[0] + d.shape[0] + 30)
    for (fx, fy, r) in ((0.08, 0.3, 28), (0.93, 0.25, 32), (0.6, 0.12, 22)):
        out = B.blysk(out, W * fx, H * fy, r, 1.0)
    return B.wpasuj(out, W32, H32, 0.84)


GENERATORY = {
    "g_win_big": g_win_big, "g_win_mega": g_win_mega, "g_win_epic": g_win_epic, "g_win_ultra": g_win_ultra,
    "g_win_free_spins": g_win_free_spins, "g_font_cyfry": g_font_cyfry, "g_logo": g_logo,
    "s1_logo": s1_logo, "s2_logo": s2_logo, "s3_logo": s3_logo,
}
