"""
gen_okladki.py — kompozycje z gotowych elementów: okładki kafli gier (2:3, z logo), banery (3:2, bez tekstu,
motyw w prawych ~60%, lewe ~40% ciemne pod tytuł HTML) i rozszerzony WILD S2 (kolumna na cały bęben).

Okładki i banery składamy jak „key art”: jaśniejsza wersja tła gry + bohater (symbol specjalny / najwyższy)
+ latające symbole i iskry + logo gry; dół okładki przechodzi w --bg-0 pod etykiety HTML (01 § 6.8).
Uruchamiane po wygenerowaniu symboli, logotypów i teł (orkiestrator robi to w drugiej partii).
"""

from __future__ import annotations

import math

import numpy as np

import biblioteka as B
import gen_tla


def _png(pakiet, id_):
    return B.przytnij_alfa(B.wczytaj(B.ZASTEPCZE / pakiet / f"{id_}.png"))


def _kadr(fn, pion, **kw):
    W, H = (1024, 1536) if pion else (1536, 1024)
    rgb = fn(W, H, pion, ciemny=0.12, **kw)
    return np.concatenate([rgb, np.ones((H, W, 1))], -1).astype(np.float32)


def _poloz(out, img, x, y, wys, kat=0.0, krycie=1.0):
    from PIL import Image
    im = B.skaluj(img, max(2, int(img.shape[1] * wys / img.shape[0])), int(wys))
    if kat:
        pil = Image.fromarray((np.clip(im, 0, 1) * 255).astype(np.uint8), "RGBA").rotate(kat, Image.Resampling.BICUBIC, expand=True)
        im = np.asarray(pil, np.float32) / 255
    return B.nakladaj_srodek(out, im, x, y, krycie=krycie)


def _iskry(out, n, obszar, seed, kolor="#FFF3D1"):
    rng = np.random.default_rng(seed)
    x0, y0, x1, y1 = obszar
    for _ in range(n):
        x, y = rng.uniform(x0, x1), rng.uniform(y0, y1)
        out = B.blysk(out, x, y, rng.uniform(10, 36), rng.uniform(0.5, 1.0))
    return out


def _dol_do_tla(out, od=0.85):
    H = out.shape[0]
    t = B.smoothstep(np.linspace(0, 1, H, dtype=np.float32), od, 1.0)[:, None, None]
    out[..., :3] = out[..., :3] * (1 - t) + B.kol("bg0") * t
    return out


def _lewa_ciemna(out, do=0.42):
    W = out.shape[1]
    t = (1 - B.smoothstep(np.linspace(0, 1, W, dtype=np.float32), do * 0.55, do + 0.08))[None, :, None]
    out[..., :3] = out[..., :3] * (1 - 0.75 * t) + B.kol("bg0") * 0.75 * t
    return out


def _logo(out, pakiet, cy_proc=0.19, szer_proc=0.86):
    logo = _png(pakiet, f"{pakiet}_logo")
    W, H = out.shape[1], out.shape[0]
    w = int(W * szer_proc)
    h = int(logo.shape[0] * w / logo.shape[1])
    if h > H * 0.22:
        h = int(H * 0.22)
        w = int(logo.shape[1] * h / logo.shape[0])
    return B.nakladaj_srodek(out, B.skaluj(logo, w, h), W / 2, H * cy_proc)


# ------------------------------------------------------------------------------------------------
def s1_okladka():
    out = _kadr(gen_tla.vegas, True)
    W, H = 1024, 1536
    wild = _png("s1", "s1_sym_wild")
    out = B.nakladaj_srodek(out, B.z_maska(B.radialny(H, W, W / 2, H * 0.56, W * 0.5, 1.5) * 0.6, "#FF2E88"), W / 2, H / 2,
                            tryb="screen")
    for (id_, x, y, wys, kat) in (("s1_sym_siodemka", 0.17, 0.42, 230, 14), ("s1_sym_wisnie", 0.84, 0.4, 220, -12),
                                  ("s1_sym_siodemka", 0.85, 0.74, 200, -18), ("s1_sym_wisnie", 0.14, 0.76, 190, 16),
                                  ("s1_sym_dzwonek", 0.2, 0.6, 150, 10), ("s1_sym_bar", 0.8, 0.58, 120, -8)):
        _poloz(out, _png("s1", id_), W * x, H * y, wys, kat)
    _poloz(out, wild, W / 2, H * 0.57, 640)
    out = _iskry(out, 26, (60, H * 0.32, W - 60, H * 0.85), 3)
    out = _logo(out, "s1")
    return _dol_do_tla(out)


def s1_baner():
    out = _kadr(gen_tla.vegas, False)
    W, H = 1536, 1024
    out = B.nakladaj_srodek(out, B.z_maska(B.radialny(H, W, W * 0.68, H * 0.5, W * 0.35, 1.5) * 0.55, "#FF2E88"),
                            W / 2, H / 2, tryb="screen")
    for (id_, x, y, wys, kat) in (("s1_sym_siodemka", 0.5, 0.25, 210, 16), ("s1_sym_wisnie", 0.9, 0.22, 200, -12),
                                  ("s1_sym_siodemka", 0.93, 0.72, 220, -18), ("s1_sym_wisnie", 0.48, 0.74, 180, 14),
                                  ("s1_sym_dzwonek", 0.56, 0.5, 150, 8)):
        _poloz(out, _png("s1", id_), W * x, H * y, wys, kat)
    _poloz(out, _png("s1", "s1_sym_wild"), W * 0.71, H * 0.5, 700)
    out = _iskry(out, 22, (W * 0.45, 60, W - 40, H - 60), 4)
    return _lewa_ciemna(out)


def s2_okladka():
    out = _kadr(gen_tla.skarbiec, True)
    W, H = 1024, 1536
    s, k = gen_tla.snopy_swiatla(W, H, 0.3 * W, 0.0, 70, 0.07 * W, 1.0 * H, 4, "#FFD9A0", 0.35, 5)
    out[..., :3] = gen_tla.swiec(out[..., :3], s, k)
    _poloz(out, _png("s2", "s2_sym_wild"), W * 0.8, H * 0.78, 300)
    _poloz(out, _png("s2", "s2_sym_ankh"), W * 0.16, H * 0.8, 240, 8)
    _poloz(out, B.poswiata(_png("s2", "s2_sym_faraon"), 30, "gold2", 0.5), W / 2, H * 0.55, 700)
    out = _iskry(out, 18, (60, H * 0.32, W - 60, H * 0.85), 5)
    out = _logo(out, "s2")
    return _dol_do_tla(out)


def s2_baner():
    out = _kadr(gen_tla.skarbiec, False)
    W, H = 1536, 1024
    s, k = gen_tla.snopy_swiatla(W, H, 0.62 * W, -0.05 * H, 80, 0.06 * W, 1.0 * H, 3, "#FFD9A0", 0.35, 6)
    out[..., :3] = gen_tla.swiec(out[..., :3], s, k)
    _poloz(out, _png("s2", "s2_sym_wild"), W * 0.9, H * 0.66, 360, -6)
    _poloz(out, _png("s2", "s2_sym_skarabeusz"), W * 0.5, H * 0.72, 220, 8)
    _poloz(out, B.poswiata(_png("s2", "s2_sym_faraon"), 30, "gold2", 0.5), W * 0.69, H * 0.47, 720)
    out = _iskry(out, 18, (W * 0.45, 60, W - 40, H - 60), 6)
    return _lewa_ciemna(out)


def _kaskada(out, x0, x1, y0, y1, n, seed, wys=(70, 150)):
    rng = np.random.default_rng(seed)
    klejnoty = ["s3_sym_szafir", "s3_sym_szmaragd", "s3_sym_ametyst", "s3_sym_topaz", "s3_sym_rubin", "s3_sym_diament"]
    for i in range(n):
        g = _png("s3", klejnoty[i % len(klejnoty)])
        x, y = rng.uniform(x0, x1), rng.uniform(y0, y1)
        w = rng.uniform(*wys)
        # krótka smuga ruchu nad spadającym klejnotem
        smuga = B.z_maska(B.rozmyj(np.pad(np.ones((int(w * 0.9), int(w * 0.18)), np.float32), 8), 6) * 0.35, "#BFF6FF")
        B.nakladaj_srodek(out, smuga, x, y - w * 0.7, tryb="screen")
        _poloz(out, g, x, y, w, rng.uniform(-20, 20))
    return out


def s3_okladka():
    out = _kadr(gen_tla.jaskinia, True)
    W, H = 1024, 1536
    out = _kaskada(out, 80, W - 80, H * 0.3, H * 0.8, 14, 7)
    _poloz(out, B.poswiata(_png("s3", "s3_sym_cebula"), 30, "#A64DFF", 0.5), W / 2, H * 0.58, 560)
    out = _iskry(out, 26, (60, H * 0.3, W - 60, H * 0.85), 8, "#E8FBFF")
    out = _logo(out, "s3")
    return _dol_do_tla(out)


def s3_baner():
    out = _kadr(gen_tla.jaskinia, False)
    W, H = 1536, 1024
    s, k = gen_tla.snopy_swiatla(W, H, 0.66 * W, -0.05 * H, 88, 0.05 * W, 1.0 * H, 2, "#FFE7B0", 0.3, 9)
    out[..., :3] = gen_tla.swiec(out[..., :3], s, k)
    out = _kaskada(out, W * 0.47, W - 60, 60, H - 120, 14, 9)
    _poloz(out, B.poswiata(_png("s3", "s3_sym_cebula"), 30, "#A64DFF", 0.5), W * 0.7, H * 0.55, 560)
    out = _iskry(out, 22, (W * 0.45, 60, W - 40, H - 60), 10, "#E8FBFF")
    return _lewa_ciemna(out)


# ------------------------------------------------------------------------------------------------
def s2_wild_rozszerzony():
    """Kolumna 1:3 (~45% szerokości płótna 2:3): relikwia w słupie złotego światła, pasy świecących
    hieroglifów po bokach, złote zwieńczenia jak w kartuszu, tabliczka WILD u dołu (01 § 10.5)."""
    from gen_fx import _hieroglif
    from gen_s2 import tabliczka
    W, H = 1024, 1536
    out = B.plotno(W, H)
    kw = 460
    x0, x1 = (W - kw) // 2, (W + kw) // 2
    y0, y1 = int(0.06 * H), int(0.94 * H)
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    # słup złotego światła
    slup = np.exp(-((xx - W / 2) / (kw * 0.32)) ** 2) * B.smoothstep(yy, y0, y0 + 120) * B.smoothstep(y1 - yy, 0, 120)
    tlo_kol = np.clip(np.exp(-((xx - W / 2) / (kw * 0.42)) ** 2) * ((yy > y0) & (yy < y1)), 0, 1) * 0.55
    warstwa = np.zeros((H, W, 4), np.float32)
    warstwa[..., :3] = B.kol("#FFD27A") * (0.6 + 0.4 * slup[..., None])
    okno_kol = B.smoothstep(np.minimum(xx - x0 + 20, x1 + 20 - xx), 0, 40)      # poświata nie wychodzi poza kolumnę
    warstwa[..., 3] = np.clip(slup * 0.9 + tlo_kol, 0, 1) * okno_kol
    B.nakladaj(out, warstwa)
    # pasy hieroglifów (świecących — jasność → alfa, bo tło jest przezroczyste)
    nazwy = ["ankh", "wadzet", "skarabeusz", "pioro", "dzed", "was", "lotos", "szen"]
    for strona in (-1, 1):
        x = W / 2 + strona * (kw / 2 - 45)
        for i, y in enumerate(range(y0 + 150, y1 - 120, 140)):
            hg = _hieroglif(nazwy[(i + (strona > 0) * 3) % 8], 120)
            a = np.clip(hg[..., :3].max(-1) * 1.2, 0, 1)
            el = np.concatenate([np.clip(hg[..., :3] * np.array([1.0, 0.95, 0.75]) + 0.2, 0, 1), a[..., None]], -1)
            B.nakladaj_srodek(out, el.astype(np.float32), x, y)
    # złote zwieńczenia u góry i u dołu
    for y, odwr in ((y0 + 30, False), (y1 - 30, True)):
        zw = B.maska_rysunku(kw + 40, 80, lambda d, s: (d.rounded_rectangle([0, 20 * s, (kw + 39) * s, 60 * s], radius=20 * s, fill=255),
                                                        d.ellipse([((kw + 40) / 2 - 40) * s, 0, ((kw + 40) / 2 + 40) * s, 80 * s], fill=255)))
        img = B.zloty_napis(zw, faza=8, glebokosc=8, kontur=4, gra="s2",
                            wkladki=[(B.rozmyj(B.erozja(zw > 0.5, 12).astype(np.float32), 1) * 0.0 + 0, "emalia", "#1B3FA0", "plaski")])
        B.nakladaj_srodek(out, img[::-1].copy() if odwr else img, W / 2, y)
    rel = B.przytnij_alfa(B.render("s2_relikwia"))
    rel = B.skaluj(rel, int(rel.shape[1] * 700 / rel.shape[0]), 700)
    B.nakladaj_srodek(out, B.poswiata(rel, 14, "gold2", 0.45), W / 2, H * 0.46)
    B.nakladaj_srodek(out, tabliczka("WILD", 400, 150), W / 2, H * 0.8)
    return out


GENERATORY = {
    "s1_okladka": s1_okladka, "s1_baner": s1_baner, "s2_okladka": s2_okladka, "s2_baner": s2_baner,
    "s3_okladka": s3_okladka, "s3_baner": s3_baner, "s2_wild_rozszerzony": s2_wild_rozszerzony,
}
