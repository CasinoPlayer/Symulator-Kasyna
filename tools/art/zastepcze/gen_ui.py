"""
gen_ui.py — UI kit grafiki zastępczej: przycisk SPIN / STOP, 12 ikon-przycisków, panel 9-slice, dwa przyciski
-pigułki 9-slice, ornament nagłówka (01 § 7.3–7.7).

Materiał z obrazu, tekst z HTML: przyciski i panele są BEZ tekstu. Elementy 9-slice mają jednolity środek
i krawędzie identyczne na całej długości (inaczej rozciąganie w CSS ``border-image`` zrobi smugi).
"""

from __future__ import annotations

import math

import numpy as np

import biblioteka as B

S = 1024


# ------------------------------------------------------------------------------------------------
# Przycisk SPIN / STOP
# ------------------------------------------------------------------------------------------------
def _pierscien(N, cx, cy, r0, r1, naciecia=0, gl=0.0):
    def rys(d, s):
        d.ellipse([(cx - r1) * s, (cy - r1) * s, (cx + r1) * s, (cy + r1) * s], fill=255)
        d.ellipse([(cx - r0) * s, (cy - r0) * s, (cx + r0) * s, (cy + r0) * s], fill=0)
        for i in range(naciecia):
            a = 2 * math.pi * i / naciecia
            szer = 0.022
            pts = []
            for (rr, da) in ((r1 * (1 - gl), -szer * 0.6), (r1 * 1.05, -szer * 1.2), (r1 * 1.05, szer * 1.2), (r1 * (1 - gl), szer * 0.6)):
                pts.append(((cx + rr * math.cos(a + da)) * s, (cy + rr * math.sin(a + da)) * s))
            d.polygon(pts, fill=0)
    return B.maska_rysunku(N, N, rys)


def _baza_spin():
    """Wspólna baza SPIN i STOP: identyczny pierścień, refleks i kadr (kod przenika je w 120 ms)."""
    N, c = S, S / 2
    R = 0.42 * S
    out = B.plotno(N, N)
    # pierścień zewnętrzny: polerowane złoto z 24 nacięciami (radełkowanie jak na pokrętle zegarka)
    ring = _pierscien(N, c, c, 0.86 * R, R, 24, 0.035)
    B.nakladaj(out, B.relief(ring, "zloto", 0.05 * R, profil="okragly", sila=1.2))
    sat = _pierscien(N, c, c, 0.8 * R, 0.86 * R)
    B.nakladaj(out, B.relief(sat, "zloto_satyna", 0.012 * R, profil="okragly"))
    # kopuła z przydymionego szkła
    dysk = B.maska_rysunku(N, N, lambda d, s: d.ellipse([(c - 0.8 * R) * s, (c - 0.8 * R) * s,
                                                         (c + 0.8 * R) * s, (c + 0.8 * R) * s], fill=255))
    h = B.kopula(dysk, 0.25 * R, 0.8 * R)
    n = B.normalne(h, 1.0)
    szklo = B.material(n, "szklo")
    gr = B.gradient_pionowy(N, N, [(0.0, "#2A1D5C"), (0.5, "#1E1442"), (1.0, "#120B2A")])
    rgb = np.clip(szklo * 0.65 + gr * 0.55, 0, 1)
    # cyjanowa poświata od dołu wewnątrz kopuły
    poswiata = B.radialny(N, N, c, c + 0.75 * R, 0.75 * R, 1.6)[..., None] * B.kol("cyan") * 0.55
    rgb = np.clip(rgb + poswiata * dysk[..., None], 0, 1)
    # ukośny refleks w lewej-górnej ćwiartce
    yy, xx = np.mgrid[0:N, 0:N].astype(np.float32)
    ref = B.smoothstep(-((xx - c) + (yy - c)) / R, 0.25, 0.55) * B.smoothstep(
        ((xx - c + 0.25 * R) ** 2 + (yy - c + 0.25 * R) ** 2) ** 0.5 / R, 0.62, 0.35)
    rgb = rgb + (1 - rgb) * (ref * 0.38)[..., None]
    B.nakladaj(out, np.concatenate([rgb, dysk[..., None]], -1).astype(np.float32))
    return out, R


def _ikona_strzalki(N, R):
    c = N / 2
    rr, gr = 0.3 * R, 0.065 * R

    def rys(d, s):
        for start in (200, 20):
            d.arc([(c - rr) * s, (c - rr) * s, (c + rr) * s, (c + rr) * s], start, start + 125, fill=255,
                  width=int(gr * 2 * s))
            a = math.radians(start + 125)
            tx, ty = c + rr * math.cos(a), c + rr * math.sin(a)
            kier = a + math.pi / 2
            d.polygon([((tx + 0.11 * R * math.cos(kier)) * s, (ty + 0.11 * R * math.sin(kier)) * s),
                       ((tx + 0.12 * R * math.cos(a)) * s, (ty + 0.12 * R * math.sin(a)) * s),
                       ((tx - 0.12 * R * math.cos(a)) * s, (ty - 0.12 * R * math.sin(a)) * s)], fill=255)
    return B.maska_rysunku(N, N, rys)


def _zlota_ikona(m, faza, poswiata=True):
    lico = B.zloty_napis(m, faza=faza, glebokosc=0, kontur=0, wypuklosc=0.2, zwroc_lico=True)
    lico[..., :3] = np.clip(lico[..., :3] * 1.12 + np.array([0.05, 0.04, 0.0]), 0, 1)
    if poswiata:
        pad = int(faza * 4)
        lico = B.poswiata(lico, faza * 1.6, "gold1", 0.55, margines=pad)
    return lico


def g_ui_spin():
    out, R = _baza_spin()
    ik = _zlota_ikona(_ikona_strzalki(S, R), 0.03 * R)
    B.nakladaj_srodek(out, ik, S / 2, S / 2)
    return out


def g_ui_spin_stop():
    out, R = _baza_spin()
    c = S / 2
    a = 0.8 * R * 0.32
    m = B.maska_rysunku(S, S, lambda d, s: d.rounded_rectangle([(c - a) * s, (c - a) * s, (c + a) * s, (c + a) * s],
                                                               radius=a * 0.28 * s, fill=255))
    ik = _zlota_ikona(m, 0.03 * R)
    B.nakladaj_srodek(out, ik, S / 2, S / 2)
    return out


# ------------------------------------------------------------------------------------------------
# Ikony (SHEET 4×3)
# ------------------------------------------------------------------------------------------------
def _glif(nazwa: str, n: int) -> np.ndarray:
    """Złoty glif ikony na płótnie n×n (grube kreski — czytelne w 24 px)."""
    c = n / 2
    g = 0.09 * n            # grubość kreski

    def rys(d, s):
        def linia(x0, y0, x1, y1, w=g):
            d.line([(x0 * s, y0 * s), (x1 * s, y1 * s)], fill=255, width=int(w * s))
            for (x, y) in ((x0, y0), (x1, y1)):
                d.ellipse([(x - w / 2) * s, (y - w / 2) * s, (x + w / 2) * s, (y + w / 2) * s], fill=255)

        def luk(r, a0, a1, w=g, strzalka=True, odwrotnie=False):
            d.arc([(c - r) * s, (c - r) * s, (c + r) * s, (c + r) * s], a0, a1, fill=255, width=int(w * s))
            if strzalka:
                a = math.radians(a0 if odwrotnie else a1)
                tx, ty = c + r * math.cos(a), c + r * math.sin(a)
                k = a + (-math.pi / 2 if odwrotnie else math.pi / 2)
                d.polygon([((tx + 0.15 * n * math.cos(k)) * s, (ty + 0.15 * n * math.sin(k)) * s),
                           ((tx + 0.13 * n * math.cos(a)) * s, (ty + 0.13 * n * math.sin(a)) * s),
                           ((tx - 0.13 * n * math.cos(a)) * s, (ty - 0.13 * n * math.sin(a)) * s)], fill=255)

        def glosnik():
            d.rectangle([(c - 0.3 * n) * s, (c - 0.1 * n) * s, (c - 0.16 * n) * s, (c + 0.1 * n) * s], fill=255)
            d.polygon([((c - 0.17 * n) * s, (c - 0.1 * n) * s), ((c + 0.02 * n) * s, (c - 0.27 * n) * s),
                       ((c + 0.02 * n) * s, (c + 0.27 * n) * s), ((c - 0.17 * n) * s, (c + 0.1 * n) * s)], fill=255)

        if nazwa == "autoplay":
            luk(0.32 * n, -60, 230)
            d.polygon([((c - 0.08 * n) * s, (c - 0.13 * n) * s), ((c + 0.14 * n) * s, c * s),
                       ((c - 0.08 * n) * s, (c + 0.13 * n) * s)], fill=255)
        elif nazwa == "turbo":
            d.polygon([(x * n * s, y * n * s) for x, y in ((0.56, 0.12), (0.28, 0.54), (0.47, 0.54), (0.4, 0.88),
                                                          (0.73, 0.42), (0.53, 0.42), (0.64, 0.12))], fill=255)
        elif nazwa == "minus":
            linia(c - 0.26 * n, c, c + 0.26 * n, c, g * 1.2)
        elif nazwa == "plus":
            linia(c - 0.26 * n, c, c + 0.26 * n, c, g * 1.2)
            linia(c, c - 0.26 * n, c, c + 0.26 * n, g * 1.2)
        elif nazwa == "dzwiek_wl":
            glosnik()
            for r in (0.16, 0.29):
                d.arc([(c - 0.02 * n - r * n) * s, (c - r * n) * s, (c - 0.02 * n + r * n) * s, (c + r * n) * s],
                      -50, 50, fill=255, width=int(g * 0.8 * s))
        elif nazwa == "dzwiek_wyl":
            glosnik()
            linia(c + 0.12 * n, c - 0.1 * n, c + 0.3 * n, c + 0.1 * n, g * 0.8)
            linia(c + 0.12 * n, c + 0.1 * n, c + 0.3 * n, c - 0.1 * n, g * 0.8)
        elif nazwa == "info":
            d.ellipse([(c - 0.07 * n) * s, (c - 0.33 * n) * s, (c + 0.07 * n) * s, (c - 0.19 * n) * s], fill=255)
            d.rectangle([(c - 0.06 * n) * s, (c - 0.1 * n) * s, (c + 0.06 * n) * s, (c + 0.27 * n) * s], fill=255)
            d.rectangle([(c - 0.15 * n) * s, (c - 0.12 * n) * s, (c + 0.06 * n) * s, (c - 0.05 * n) * s], fill=255)
            d.rectangle([(c - 0.15 * n) * s, (c + 0.22 * n) * s, (c + 0.15 * n) * s, (c + 0.3 * n) * s], fill=255)
        elif nazwa == "menu":
            for dy in (-0.17, 0, 0.17):
                linia(c - 0.25 * n, c + dy * n, c + 0.25 * n, c + dy * n, g)
        elif nazwa == "lobby":
            d.polygon([((c - 0.32 * n) * s, (c - 0.02 * n) * s), (c * s, (c - 0.32 * n) * s),
                       ((c + 0.32 * n) * s, (c - 0.02 * n) * s)], fill=255)
            d.rectangle([(c - 0.22 * n) * s, (c - 0.06 * n) * s, (c + 0.22 * n) * s, (c + 0.3 * n) * s], fill=255)
            d.rectangle([(c - 0.07 * n) * s, (c + 0.08 * n) * s, (c + 0.07 * n) * s, (c + 0.3 * n) * s], fill=0)
        elif nazwa == "zamknij":
            linia(c - 0.22 * n, c - 0.22 * n, c + 0.22 * n, c + 0.22 * n, g * 1.15)
            linia(c - 0.22 * n, c + 0.22 * n, c + 0.22 * n, c - 0.22 * n, g * 1.15)
        elif nazwa == "ustawienia":
            for i in range(8):
                a = 2 * math.pi * i / 8
                pts = []
                for (rr, da) in ((0.2, -0.22), (0.33, -0.15), (0.33, 0.15), (0.2, 0.22)):
                    pts.append(((c + rr * n * math.cos(a + da)) * s, (c + rr * n * math.sin(a + da)) * s))
                d.polygon(pts, fill=255)
            d.ellipse([(c - 0.25 * n) * s, (c - 0.25 * n) * s, (c + 0.25 * n) * s, (c + 0.25 * n) * s], fill=255)
            d.ellipse([(c - 0.1 * n) * s, (c - 0.1 * n) * s, (c + 0.1 * n) * s, (c + 0.1 * n) * s], fill=0)
        elif nazwa == "historia":
            luk(0.31 * n, 140, 420, g * 0.85, odwrotnie=True)
            linia(c, c, c, c - 0.17 * n, g * 0.85)
            linia(c, c, c + 0.12 * n, c + 0.07 * n, g * 0.85)
    return B.maska_rysunku(n, n, rys)


def _przycisk_okragly(n: int, glif: np.ndarray | None) -> np.ndarray:
    """Okrągły przycisk z przydymionego szkła z cienkim złotym otokiem (rodzina z przyciskiem SPIN)."""
    c = n / 2
    R = 0.47 * n
    out = B.plotno(n, n)
    ring = _pierscien(n, c, c, 0.9 * R, R)
    B.nakladaj(out, B.relief(ring, "zloto", 0.06 * R, profil="okragly"))
    dysk = B.maska_rysunku(n, n, lambda d, s: d.ellipse([(c - 0.9 * R) * s, (c - 0.9 * R) * s,
                                                         (c + 0.9 * R) * s, (c + 0.9 * R) * s], fill=255))
    h = B.kopula(dysk, 0.2 * R, 0.9 * R)
    rgb = np.clip(B.material(B.normalne(h), "szklo") * 0.6 + B.gradient_pionowy(n, n, [(0, "#2A1D5C"), (1, "#120B2A")]) * 0.55, 0, 1)
    yy, xx = np.mgrid[0:n, 0:n].astype(np.float32)
    ref = B.smoothstep(-((xx - c) + (yy - c)) / R, 0.3, 0.6) * B.smoothstep(
        ((xx - c + 0.2 * R) ** 2 + (yy - c + 0.2 * R) ** 2) ** 0.5 / R, 0.7, 0.4)
    rgb = rgb + (1 - rgb) * (ref * 0.3)[..., None]
    B.nakladaj(out, np.concatenate([rgb, dysk[..., None]], -1).astype(np.float32))
    if glif is not None:
        ik = _zlota_ikona(glif, 0.025 * n)
        B.nakladaj_srodek(out, ik, c, c)
    return out


def g_ui_ikony():
    from katalog import KOMORKI
    out = B.plotno(1536, 1024)
    cw, ch = 1536 / 4, 1024 / 3
    n = int(min(cw, ch) * 0.8)
    for i, nazwa in enumerate(KOMORKI["g_ui_ikony"]):
        r, c = divmod(i, 4)
        g = _glif(nazwa, int(n * 0.92))
        g = np.pad(g, ((n - g.shape[0]) // 2, n - g.shape[0] - (n - g.shape[0]) // 2))
        B.nakladaj_srodek(out, _przycisk_okragly(n, g), c * cw + cw / 2, r * ch + ch / 2)
    return out


# ------------------------------------------------------------------------------------------------
# Panel modala 9-slice (1:1)
# ------------------------------------------------------------------------------------------------
def _filigran_rog(n: int) -> np.ndarray:
    """Złoty filigranowy narożnik (spirale, liść, perełka) w kwadracie n×n, z narożnikiem w lewym-górnym rogu."""
    def rys(d, s):
        w = 0.07 * n
        # spirale wzdłuż obu krawędzi
        for (cx, cy, r0) in ((0.42 * n, 0.2 * n, 0.15 * n), (0.2 * n, 0.42 * n, 0.15 * n)):
            pts = []
            for i in range(60):
                t = i / 59
                a = math.pi * (0.2 + 2.2 * t)
                r = r0 * (1 - 0.7 * t)
                pts.append(((cx + r * math.cos(a)) * s, (cy + r * math.sin(a)) * s))
            d.line(pts, fill=255, width=int(w * s), joint="curve")
        d.polygon([(0, 0), (0.46 * n * s, 0), (0.2 * n * s, 0.2 * n * s), (0, 0.46 * n * s)], fill=255)
        for (x, y) in ((0.62 * n, 0.12 * n), (0.12 * n, 0.62 * n)):
            r = 0.05 * n
            d.ellipse([(x - r) * s, (y - r) * s, (x + r) * s, (y + r) * s], fill=255)
        d.ellipse([0.2 * n * s, 0.2 * n * s, 0.34 * n * s, 0.34 * n * s], fill=255)
    return B.maska_rysunku(n, n, rys)


def g_ui_panel():
    N = S
    m0, m1 = int(0.06 * N), int(0.94 * N)
    pas = int(0.035 * N)                        # grubość złotej listwy
    out = B.plotno(N, N)
    # środek: jednolite ciemne szkło (CSS i tak wypełnia środek --glass, ale obraz ma być kompletny)
    srodek = B.maska_rysunku(N, N, lambda d, s: d.rectangle([(m0 + pas * 0.5) * s, (m0 + pas * 0.5) * s,
                                                             (m1 - pas * 0.5) * s, (m1 - pas * 0.5) * s], fill=255))
    tlo = B.z_maska(srodek * 0.9, "#1E1442")
    B.nakladaj(out, tlo)
    # prosta listwa: polerowane złoto + cienki satynowy pas — identyczna na całej długości
    rama = B.maska_rysunku(N, N, lambda d, s: (d.rectangle([m0 * s, m0 * s, m1 * s, m1 * s], fill=255),
                                               d.rectangle([(m0 + pas) * s, (m0 + pas) * s, (m1 - pas) * s,
                                                            (m1 - pas) * s], fill=0)))
    B.nakladaj(out, B.relief(rama, "zloto", pas * 0.45, profil="okragly", sila=1.2))
    wew = B.maska_rysunku(N, N, lambda d, s: (d.rectangle([(m0 + pas + 6) * s, (m0 + pas + 6) * s, (m1 - pas - 6) * s,
                                                           (m1 - pas - 6) * s], fill=255),
                                              d.rectangle([(m0 + pas + 12) * s, (m0 + pas + 12) * s,
                                                           (m1 - pas - 12) * s, (m1 - pas - 12) * s], fill=0)))
    B.nakladaj(out, B.relief(wew, "zloto_satyna", 3, profil="okragly"))
    # narożniki filigranowe (mieszczą się w ~20% boku)
    n = int(0.19 * N)
    rog = _filigran_rog(n)
    lico = B.zloty_napis(rog, faza=7, glebokosc=5, kontur=4, wypuklosc=0.15)
    for fx, fy in ((False, False), (True, False), (False, True), (True, True)):
        r = lico[:, ::-1] if fx else lico
        r = r[::-1] if fy else r
        x = m0 - 10 if not fx else m1 + 10 - r.shape[1]
        y = m0 - 10 if not fy else m1 + 10 - r.shape[0]
        B.nakladaj(out, r.copy(), x, y)
    return out


# ------------------------------------------------------------------------------------------------
# Przyciski-pigułki 9-slice (3:2)
# ------------------------------------------------------------------------------------------------
def _pigulka(rodzaj: str) -> np.ndarray:
    W, H = 1536, 1024
    w, h = int(0.85 * W), int(0.33 * H)
    x0, y0 = (W - w) // 2, (H - h) // 2
    m = B.maska_rysunku(W, H, lambda d, s: d.rounded_rectangle([x0 * s, y0 * s, (x0 + w) * s, (y0 + h) * s],
                                                               radius=h / 2 * s, fill=255))
    out = B.plotno(W, H)
    if rodzaj == "glowny":
        obw = 0.06 * h
        hgt = B.wysokosc(m, obw, "okragly")
        n = B.normalne(hgt, 1.3)
        rgb = B.material(n, "zloto")
        # satynowa powierzchnia z pionowym gradientem złota (zależnym tylko od y → jednolita w poziomie)
        gr = B.gradient_pionowy(H, W, [(y0 / H, "#FFE08A"), ((y0 + 0.55 * h) / H, "#F5C542"), ((y0 + h) / H, "#B8860B")])
        wew = B.erozja(m > 0.5, int(obw)).astype(np.float32)
        wew = B.rozmyj(wew, 2)
        rgb = rgb * (1 - wew[..., None]) + gr * wew[..., None]
        # cienki pasek połysku przy górnej krawędzi
        yy = np.arange(H, dtype=np.float32)[:, None]
        polysk = np.exp(-((yy - (y0 + 0.2 * h)) / (0.045 * h)) ** 2) * wew * 0.55
        rgb = rgb + (1 - rgb) * polysk[..., None]
    else:
        obw = 0.04 * h
        hgt = B.wysokosc(m, obw, "okragly")
        n = B.normalne(hgt, 1.3)
        zl = B.material(n, "zloto")
        wew = B.rozmyj(B.erozja(m > 0.5, int(obw)).astype(np.float32), 1.5)
        gr = B.gradient_pionowy(H, W, [(y0 / H, "#2E2163"), ((y0 + 0.3 * h) / H, "#1E1442"), ((y0 + h) / H, "#120B2A")])
        yy = np.arange(H, dtype=np.float32)[:, None]
        fresnel = np.exp(-((yy - (y0 + obw + 0.04 * h)) / (0.05 * h)) ** 2) * 0.35
        srodek = np.exp(-((yy - (y0 + 0.62 * h)) / (0.22 * h)) ** 2) * 0.12
        szklo = np.clip(gr + fresnel[..., None] * np.array([0.8, 0.75, 1.0]) + srodek[..., None] * B.kol("#6A4FD8"), 0, 1)
        rgb = zl * (1 - wew[..., None]) + szklo * wew[..., None]
    B.nakladaj(out, np.concatenate([np.clip(rgb, 0, 1), m[..., None]], -1).astype(np.float32))
    return out


def g_ui_ornament():
    from blender.tekstury import sylwetka_cebuli_w_koronie
    W, H = 1536, 1024
    w, h = int(0.84 * W), int(0.84 * W / 6)
    srodek_m = np.zeros((h, w), np.float32)
    ceb, kor = sylwetka_cebuli_w_koronie(h, h / 2, h * 0.56, h * 0.8)
    srodek_m[:, (w - h) // 2:(w - h) // 2 + h] = np.maximum(ceb, kor)

    def rys(d, s):
        cy = h / 2
        for strona in (-1, 1):
            # łodyga zwężająca się ku końcom
            pts = []
            for i in range(80):
                t = i / 79
                x = w / 2 + strona * (0.09 * w + t * 0.38 * w)
                y = cy + math.sin(t * math.pi * 3) * h * 0.12 * (1 - t * 0.6)
                pts.append((x, y, (1 - t) * 0.07 * h + 0.025 * h))
            for (x, y, r) in pts:
                d.ellipse([(x - r) * s, (y - r) * s, (x + r) * s, (y + r) * s], fill=255)
            # spirale i liście akantu
            for k in range(3):
                t = 0.2 + 0.3 * k
                cx = w / 2 + strona * (0.09 * w + t * 0.38 * w)
                cyy = cy + (h * 0.18 if k % 2 == 0 else -h * 0.18)
                sp = []
                for i in range(40):
                    u = i / 39
                    a = (math.pi * 2.2 * u) * strona + (0 if k % 2 == 0 else math.pi)
                    r = h * 0.17 * (1 - 0.75 * u)
                    sp.append(((cx + r * math.cos(a)) * s, (cyy + r * math.sin(a)) * s))
                d.line(sp, fill=255, width=int(0.035 * h * s), joint="curve")
            x_end = w / 2 + strona * 0.49 * w
            r = 0.06 * h
            d.ellipse([(x_end - r) * s, (cy - r) * s, (x_end + r) * s, (cy + r) * s], fill=255)
    m = np.maximum(B.maska_rysunku(w, h, rys), srodek_m)
    orn = B.zloty_napis(m, faza=6, glebokosc=6, kontur=4, wypuklosc=0.2)
    out = B.plotno(W, H)
    return B.nakladaj_srodek(out, orn, W / 2, H / 2)


GENERATORY = {
    "g_ui_spin": g_ui_spin, "g_ui_spin_stop": g_ui_spin_stop, "g_ui_ikony": g_ui_ikony, "g_ui_panel": g_ui_panel,
    "g_ui_przycisk_glowny": lambda: _pigulka("glowny"), "g_ui_przycisk_drugi": lambda: _pigulka("drugi"),
    "g_ui_ornament": g_ui_ornament,
}
