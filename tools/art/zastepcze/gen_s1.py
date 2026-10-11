"""
gen_s1.py — S1 „Cebulowy 777”: symbole (owoce i dzwonek z renderów Blendera, BAR i 7 jako napisy 2,5D, WILD =
złota cebula w neonowym pierścieniu + czarna wstęga z neonowym napisem) oraz chromowano-neonowa ramka 3×3.

Styl (01 § 9): retro Las Vegas + synthwave — cukierkowa emalia, chrom, neon (magenta / cyjan), złoto.
"""

from __future__ import annotations

import math

import numpy as np
from PIL import Image

import biblioteka as B
from gen_napisy import _neon

S = 1024
WYP = {"niskie": 0.8, "wysokie": 0.83, "specjalne": 0.85}   # wypełnienie kadru wg hierarchii (01 § 5.1)


def _render_sym(nazwa, poziom):
    return lambda: B.wpasuj(B.render(nazwa), S, S, WYP[poziom])


def s1_sym_bar():
    """Gruba tabliczka z czarnego lakieru w fazowanej chromowanej ramce, wypukły chromowany napis BAR
    z różowym neonowym obrysem."""
    w, h = 860, 470
    plyta = B.maska_rysunku(w, h, lambda d, s: d.rounded_rectangle([0, 0, (w - 1) * s, (h - 1) * s], radius=70 * s, fill=255))
    wnetrze = B.rozmyj(B.erozja(plyta > 0.5, 46).astype(np.float32), 1.2)
    hp = B.wysokosc(plyta, 30, "okragly") + B.wysokosc(wnetrze, 8, "skos") * -1.2
    n = B.normalne(hp, 1.3)
    rgb = B.material(n, "chrom") * (1 - wnetrze[..., None]) + B.material(n, "emalia", "s1", "#0B0612", 1.3) * wnetrze[..., None]
    gora = np.concatenate([rgb, plyta[..., None]], -1).astype(np.float32)
    tabl = B.ekstruzja(gora, 30, "chrom")
    mt = B.wiersze_napisu(["BAR"], "bungee", 250, 0.05, 0)
    obrys_neon = np.clip(B.rozmyj(B.dylatacja(np.pad(mt, 24) > 0.5, 11).astype(np.float32), 1)
                         - B.rozmyj(B.dylatacja(np.pad(mt, 24) > 0.5, 6).astype(np.float32), 1), 0, 1)
    neon = _neon(obrys_neon, "#FF2E88", 2, 12)
    napis = B.zloty_napis(mt, faza=10, glebokosc=10, kontur=0, rodzaj="chrom", gradient=False, wypuklosc=0.25)
    out = B.plotno(tabl.shape[1] + 40, tabl.shape[0] + 40)
    B.nakladaj(out, tabl, 20, 20)
    B.nakladaj_srodek(out, neon, out.shape[1] / 2, out.shape[0] / 2 - 8)
    B.nakladaj_srodek(out, napis, out.shape[1] / 2, out.shape[0] / 2 - 8)
    return B.wpasuj(out, S, S, WYP["wysokie"])


def s1_sym_siodemka():
    """Masywna kursywna 7 z wiśniowej emalii w grubym fazowanym złotym obramowaniu, z białą linią neonu."""
    m = B.wiersze_napisu(["7"], "bungee", 700, 0, 0)
    m = np.pad(m, 60)
    im = Image.fromarray((m * 255).astype(np.uint8))
    im = im.transform((im.width + 160, im.height), Image.Transform.AFFINE, (1, 0.2, -110, 0, 1, 0), Image.Resampling.BICUBIC)
    m = np.asarray(im, np.float32) / 255
    m = B.rozmyj(B.dylatacja(m > 0.5, 26).astype(np.float32), 1.5)          # gruba złota obwódka
    emalia = B.rozmyj(B.erozja(m > 0.5, 34).astype(np.float32), 1.2)
    linia = np.clip(B.rozmyj(B.erozja(m > 0.5, 58).astype(np.float32), 1) - B.rozmyj(B.erozja(m > 0.5, 64).astype(np.float32), 1), 0, 1)
    out = B.zloty_napis(m, faza=22, glebokosc=34, kontur=12, gra="s1",
                        wkladki=[(emalia, "emalia", "#E3122B", "okragly"), (linia, "swiecace", "#FFFFFF", "plaski")])
    out = B.poswiata(out, 20, "#FF2E88", 0.25)
    for (fx, fy, r) in ((0.78, 0.12, 60), (0.2, 0.74, 44)):
        out = B.blysk(out, out.shape[1] * fx, out.shape[0] * fy, r, 1.0)
    return B.wpasuj(out, S, S, WYP["wysokie"])


def wstega(w, h, tekst, kolor_neonu="#FF2E88", font="bungee", wys_tekstu=None, krzywizna=0.12):
    """Czarna lakierowana wstęga z chromowaną krawędzią, lekko wygięta, z neonowym napisem (WILD)."""
    def rys(d, s):
        pts_g, pts_d = [], []
        for i in range(41):
            t = i / 40
            x = w * 0.08 + t * w * 0.84
            y = h * 0.5 - math.sin(t * math.pi) * h * krzywizna
            pts_g.append((x * s, (y - h * 0.3) * s))
            pts_d.append((x * s, (y + h * 0.3) * s))
        d.polygon(pts_g + pts_d[::-1], fill=255)
        for strona in (0, 1):            # końcówki z wcięciem („jaskółczy ogon”)
            x0 = w * 0.08 if strona == 0 else w * 0.92
            dx = -1 if strona == 0 else 1
            d.polygon([(x0 * s, (h * 0.3) * s), ((x0 + dx * w * 0.08) * s, (h * 0.22) * s),
                       ((x0 + dx * w * 0.04) * s, (h * 0.5) * s), ((x0 + dx * w * 0.08) * s, (h * 0.78) * s),
                       (x0 * s, (h * 0.7) * s)], fill=255)
    m = B.maska_rysunku(w, h, rys)
    hw = B.wysokosc(m, 14, "okragly")
    n = B.normalne(hw, 1.2)
    wew = B.rozmyj(B.erozja(m > 0.5, 12).astype(np.float32), 1)
    rgb = B.material(n, "chrom") * (1 - wew[..., None]) + B.material(n, "emalia", "s1", "#0B0612", 1.2) * wew[..., None]
    out = np.concatenate([rgb, m[..., None]], -1).astype(np.float32)
    mt = B.wiersze_napisu([tekst], font, int(wys_tekstu or h * 0.4), 0.06, 0)
    mt = B.luk(np.pad(mt, ((40, 40), (10, 10))), krzywizna * 0.9)
    mt = np.pad(mt, 16)
    neon = _neon(mt, kolor_neonu, 3, 10)
    return B.nakladaj_srodek(out, neon, w / 2, h * 0.5 - h * krzywizna * 0.55)


def s1_sym_wild():
    ceb = B.przytnij_alfa(B.render("s1_cebula"))
    ceb = B.skaluj(ceb, 860)
    out = B.plotno(S, S)
    B.nakladaj_srodek(out, ceb, S / 2, S / 2 - 40)
    w = wstega(940, 300, "WILD")
    B.nakladaj_srodek(out, w, S / 2, S * 0.7)
    return B.wpasuj(out, S, S, WYP["specjalne"])


def s1_ramka():
    """Chromowana obudowa automatu: grzebień z żarówkami i gwiazdką, różowa rurka neonowa po zewnętrznej
    krawędzi, cyjanowa po wewnętrznej, złota listwa przy oknie, półka z nitami. Okno 3×3 w pełni przezroczyste."""
    N = S
    # cała ramka (z grzebieniem i poświatą neonu) w 88% kadru, okno 640×640 od ~22% wysokości (01 § 9.6)
    okno = (192, 225, 832, 865)

    def obudowa(d, s):
        d.rounded_rectangle([86 * s, 168 * s, 938 * s, 905 * s], radius=86 * s, fill=255)
        d.ellipse([272 * s, 84 * s, 752 * s, 330 * s], fill=255)
        d.rounded_rectangle([78 * s, 872 * s, 946 * s, 942 * s], radius=26 * s, fill=255)
    m = B.maska_rysunku(N, N, obudowa)
    mo = B.maska_rysunku(N, N, lambda d, s: d.rectangle([okno[0] * s, okno[1] * s, okno[2] * s, okno[3] * s], fill=255))
    korpus = np.clip(m - mo, 0, 1)
    h = B.wysokosc(korpus, 34, "okragly") + B.wysokosc(m, 60, "poduszka") * 0.3
    n = B.normalne(h, 1.0)
    rgb = B.material(n, "chrom") * 0.9
    out = np.concatenate([rgb, korpus[..., None]], -1).astype(np.float32)
    # złota listwa przy oknie
    lis = np.clip(B.dylatacja(mo > 0.5, 16).astype(np.float32) - mo, 0, 1)
    B.nakladaj(out, B.relief(lis, "zloto", 7, "s1"))
    # neony: różowy po zewnętrznej krawędzi, cyjanowy przy oknie
    zew = np.clip(B.erozja(m > 0.5, 16).astype(np.float32) - B.erozja(m > 0.5, 26).astype(np.float32), 0, 1)
    zew = B.rozmyj(zew, 1.2)
    B.nakladaj(out, _neon(zew, "#FF2E88", 2, 10), -20, -20)
    wew = np.clip(B.dylatacja(mo > 0.5, 36).astype(np.float32) - B.dylatacja(mo > 0.5, 27).astype(np.float32), 0, 1)
    wew = B.rozmyj(wew, 1.2)
    B.nakladaj(out, _neon(wew, "#21E6FF", 2, 8), -16, -16)
    # żarówki na grzebieniu i gwiazdka „atomic age”
    for i in range(15):
        a = math.pi * (1.08 + 0.84 * i / 14)
        x, y = 512 + 205 * math.cos(a), 207 + 100 * math.sin(a)
        zar = B.z_maska(B.radialny(30, 30, 15, 15, 13, 0.5), "#FFF3D1")
        B.nakladaj_srodek(out, B.poswiata(zar, 8, "#FFC86B", 0.9), x, y)
    gw = B.maska_rysunku(160, 160, lambda d, s: d.polygon(
        [((80 + (70 if i % 2 == 0 else 22) * math.cos(-math.pi / 2 + i * math.pi / 4)) * s,
          (80 + (70 if i % 2 == 0 else 22) * math.sin(-math.pi / 2 + i * math.pi / 4)) * s) for i in range(8)], fill=255))
    B.nakladaj_srodek(out, B.zloty_napis(gw, faza=6, glebokosc=5, kontur=3, gra="s1", poswiata_r=10), 512, 200)
    for x in (300, 724):
        nit = B.maska_rysunku(60, 60, lambda d, s: d.polygon(
            [((30 + (26 if i % 2 == 0 else 10) * math.cos(-math.pi / 2 + i * math.pi / 4)) * s,
              (30 + (26 if i % 2 == 0 else 10) * math.sin(-math.pi / 2 + i * math.pi / 4)) * s) for i in range(8)], fill=255))
        B.nakladaj_srodek(out, B.relief(nit, "zloto", 4, "s1"), x, 907)
    out[okno[1]:okno[3], okno[0]:okno[2], 3] = 0.0           # okno MUSI być w 100% przezroczyste
    return out


GENERATORY = {
    "s1_sym_wisnie": _render_sym("s1_wisnie", "niskie"),
    "s1_sym_cytryna": _render_sym("s1_cytryna", "niskie"),
    "s1_sym_sliwka": _render_sym("s1_sliwka", "niskie"),
    "s1_sym_arbuz": _render_sym("s1_arbuz", "niskie"),
    "s1_sym_dzwonek": _render_sym("s1_dzwonek", "wysokie"),
    "s1_sym_bar": s1_sym_bar,
    "s1_sym_siodemka": s1_sym_siodemka,
    "s1_sym_wild": s1_sym_wild,
    "s1_ramka": s1_ramka,
}
