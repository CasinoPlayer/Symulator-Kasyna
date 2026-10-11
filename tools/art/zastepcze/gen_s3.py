"""
gen_s3.py — S3 „Kryształowa Kaskada”: klejnoty z renderów Blendera (szkło z refrakcją i tęczową cienką
warstwą), SCATTER = pryzmat „Serce Jaskini” z wachlarzem tęczy i tabliczką, kula mnożnika, kryształowa ramka
6×5 i arkusz odłamków (01 § 11).
"""

from __future__ import annotations

import numpy as np

import biblioteka as B
from gen_s2 import tabliczka

S = 1024
WYP = {"niskie": 0.8, "wysokie": 0.83, "specjalne": 0.85}


def _render_sym(nazwa, poziom):
    return lambda: B.wpasuj(B.render(nazwa), S, S, WYP[poziom])


def _widmo(t: np.ndarray) -> np.ndarray:
    """Barwy tęczy dla t ∈ [0, 1) (koło barw HSV przy pełnym nasyceniu) — korona rozszczepionego światła."""
    k = (t[..., None] * 6 + np.array([0.0, 4.0, 2.0])) % 6
    return np.clip(np.minimum(k, 4 - k), 0, 1).astype(np.float32)


def s3_sym_scatter():
    """SCATTER „Serce Jaskini”: duży pryzmat stojący na tle tęczowej korony, w środku pulsujące turkusowe serce,
    pod spodem szeroka tabliczka. Symbol specjalny musi wybijać się z planszy 6×5 już przy 64 px."""
    pr = B.przytnij_alfa(B.render("s3_pryzmat"))
    pr = B.skaluj(pr, int(pr.shape[1] * 700 / pr.shape[0]), 700)
    out = B.plotno(S, S)
    cx, cy = S / 2, S * 0.43
    yy, xx = np.mgrid[0:S, 0:S].astype(np.float32)
    r = np.sqrt((xx - cx) ** 2 + (yy - cy) ** 2)
    kat = np.arctan2(yy - cy, xx - cx)
    # tęczowa korona z promieniami (alfa ≤ 0,45 — nie liczy się do „masy” symbolu przy normalizacji wielkości)
    promienie = 0.55 + 0.45 * np.cos(kat * 14) ** 2
    # wygaszenie przed 45% kadru: inaczej słaba poświata „rozpycha” prostokąt obiektu i pryzmat by zmalał
    wygas = B.smoothstep(0.45 * S - r, 0, 90)
    pierscien = np.exp(-((r - 290) / 90) ** 2) * promienie * wygas
    korona = np.concatenate([_widmo((kat / (2 * np.pi) + 0.5) % 1.0) * 0.8 + 0.2,
                             (np.clip(pierscien, 0, 1) * 0.45)[..., None]], -1).astype(np.float32)
    B.nakladaj(out, korona, 0, 0)
    poswiata = np.exp(-(r / 250) ** 2) * wygas
    B.nakladaj(out, np.concatenate([np.broadcast_to(B.kol("#19F5D2"), (S, S, 3)), (poswiata * 0.4)[..., None]],
                                   -1).astype(np.float32), 0, 0)
    B.nakladaj_srodek(out, pr, cx, cy)
    # „serce” w środku kryształu: świecący kształt serca, mieszany jak światło (screen)
    def serce(d, s_):
        pts = []
        for i in range(80):
            t = 2 * np.pi * i / 80
            x = 16 * np.sin(t) ** 3
            y = 13 * np.cos(t) - 5 * np.cos(2 * t) - 2 * np.cos(3 * t) - np.cos(4 * t)
            pts.append(((120 + x * 5.2) * s_, (110 - y * 5.2) * s_))
        d.polygon(pts, fill=255)
    m = B.maska_rysunku(240, 220, serce)
    rdzen = np.zeros((220, 240, 4), np.float32)
    rdzen[..., :3] = B.kol("#B8FFF2")
    rdzen[..., 3] = np.clip(B.rozmyj(m, 3) * 0.95 + B.rozmyj(m, 22) * 0.8, 0, 1)
    plotno_r = B.plotno(S, S)
    B.nakladaj_srodek(plotno_r, rdzen, cx, cy + pr.shape[0] * 0.12)
    B.nakladaj(out, plotno_r, 0, 0, tryb="screen")
    for (bx, by, br) in ((cx, cy - pr.shape[0] * 0.47, 60), (cx - pr.shape[1] * 0.42, cy + pr.shape[0] * 0.42, 40),
                         (cx + pr.shape[1] * 0.4, cy + pr.shape[0] * 0.4, 46)):
        out = B.blysk(out, bx, by, br, 0.85)
    B.nakladaj_srodek(out, tabliczka("SCATTER", 860, 210, font="marcellus", kolor_pola="#3A1670", rodzaj_liter="bialezloto",
                                     gra="s3", teczowe=True), S / 2, S * 0.86)
    return B.wpasuj(out, S, S, WYP["specjalne"])


def s3_ramka():
    N = S
    ox0, oy0, ox1, oy1 = 153, 213, 870, 811                  # okno 717×598 (6:5), rama w 88% kadru (01 § 11.8)
    rama = B.maska_rysunku(N, N, lambda d, s: (d.rounded_rectangle([66 * s, 76 * s, (N - 66) * s, (N - 66) * s],
                                                                   radius=40 * s, fill=255),
                                               d.rectangle([ox0 * s, oy0 * s, ox1 * s, oy1 * s], fill=0)))
    skala = B.szum(N, N, 16, 4, 9)
    h = B.wysokosc(rama, 22, "okragly") + skala * 6
    n = B.normalne(h, 1.0)
    rgb = B.material(n, "chrom") * (0.32 + 0.25 * skala[..., None]) + B.kol("#1A1F3A") * 0.25
    out = np.concatenate([np.clip(rgb, 0, 1), rama[..., None]], -1).astype(np.float32)
    # świecący mech wzdłuż dołu
    mech = B.plotno(N, N)
    rng = np.random.default_rng(4)
    for i in range(140):
        x, y = rng.uniform(110, N - 110), rng.uniform(N - 190, N - 100)
        r = rng.uniform(3, 9)
        B.nakladaj_srodek(mech, B.z_maska(B.radialny(int(r * 4), int(r * 4), r * 2, r * 2, r * 2, 0.8), "#19F5D2"), x, y)
    B.nakladaj(out, B.poswiata(mech, 6, "#19F5D2", 0.6), -12, -12)
    # skupiska kryształów: narożniki i „korona” na środku góry
    for nazwa, (cx, cy), wys, odbicie in (("s3_krysztaly_ametyst", (512, 172), 210, False),
                                          ("s3_krysztaly_szafir", (150, 175), 190, True),
                                          ("s3_krysztaly_szafir", (874, 175), 190, False),
                                          ("s3_krysztaly_ametyst", (150, 880), 150, True),
                                          ("s3_krysztaly_ametyst", (874, 880), 150, False)):
        kr = B.przytnij_alfa(B.render(nazwa))
        kr = B.skaluj(kr, int(kr.shape[1] * wys / kr.shape[0]), wys)
        if odbicie:
            kr = kr[:, ::-1].copy()
        B.nakladaj_srodek(out, kr, cx, cy)
    zl = B.przytnij_alfa(B.render("s3_cebula"))
    zl = B.skaluj(zl, int(zl.shape[1] * 120 / zl.shape[0]), 120)
    B.nakladaj_srodek(out, B.poswiata(zl, 10, "gold2", 0.4), 512, 140)
    # drobne kryształy wzdłuż dołu
    for i, x in enumerate(range(230, 820, 85)):
        kr = B.przytnij_alfa(B.render("s3_krysztaly_szafir" if i % 2 else "s3_krysztaly_ametyst"))
        kr = B.skaluj(kr, int(kr.shape[1] * 90 / kr.shape[0]), 90)
        B.nakladaj_srodek(out, kr, x, 885)
    # czysta, prosta listwa z białego złota przy oknie
    kraw = np.clip(B.maska_rysunku(N, N, lambda d, s: d.rectangle([(ox0 - 14) * s, (oy0 - 14) * s, (ox1 + 14) * s,
                                                                     (oy1 + 14) * s], fill=255))
                   - B.maska_rysunku(N, N, lambda d, s: d.rectangle([ox0 * s, oy0 * s, ox1 * s, oy1 * s], fill=255)), 0, 1)
    B.nakladaj(out, B.relief(kraw, "bialezloto", 6, "s3"))
    out[oy0:oy1, ox0:ox1, 3] = 0.0                          # kryształy nie wchodzą w okno
    return out


def s3_fx_odlamki():
    return B.skaluj(B.render("s3_odlamki"), 1536, 1024)


GENERATORY = {
    "s3_sym_szafir": _render_sym("s3_szafir", "niskie"),
    "s3_sym_szmaragd": _render_sym("s3_szmaragd", "niskie"),
    "s3_sym_ametyst": _render_sym("s3_ametyst", "niskie"),
    "s3_sym_topaz": _render_sym("s3_topaz", "niskie"),
    "s3_sym_rubin": _render_sym("s3_rubin", "wysokie"),
    "s3_sym_diament": _render_sym("s3_diament", "wysokie"),
    "s3_sym_cebula": _render_sym("s3_cebula", "wysokie"),
    "s3_sym_scatter": s3_sym_scatter,
    "s3_sym_mnoznik": _render_sym("s3_kula", "specjalne"),
    "s3_ramka": s3_ramka,
    "s3_fx_odlamki": s3_fx_odlamki,
}
