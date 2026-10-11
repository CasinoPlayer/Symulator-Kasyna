"""
gen_tla.py — tła grafiki zastępczej (typ PELNE): lobby kasyna, Vegas/synthwave (S1), skarbiec grobowca
i noc nad piramidami (S2), kryształowa jaskinia i komnata z zorzą (S3) — każde w wersji poziomej 3:2
i pionowej 2:3.

Zasady z 01 § 6: tło to scenografia, nie aktor. Jasne brzegi i górne rogi, spokojny i najciemniejszy środek
(tam kod kładzie bębny), dół przechodzi w --bg-0 pod panelem sterowania, średnia jasność niska. Tła darmowych
spinów mają te same strefy i linię horyzontu co tła bazowe.

Wszystko jest proceduralne: gradienty, maski kształtów (Pillow), szum fraktalny, rozmycie dla głębi, bokeh,
snopy światła; w kilku miejscach wklejamy rendery z Blendera (kryształy, monety).
"""

from __future__ import annotations

import math

import numpy as np
from PIL import Image

import biblioteka as B


# ------------------------------------------------------------------------------------------------
# Narzędzia scen
# ------------------------------------------------------------------------------------------------
def maska(W, H, rys, ss=2):
    return B.maska_rysunku(W, H, rys, ss)


def maluj(rgb, m, kolor, krycie=1.0):
    k = B.kol(kolor) if isinstance(kolor, str) else np.asarray(kolor, np.float32)
    a = (np.clip(m, 0, 1) * krycie)[..., None]
    return rgb * (1 - a) + k * a


def swiec(rgb, m, kolor, sila=1.0):
    k = B.kol(kolor) if isinstance(kolor, str) else np.asarray(kolor, np.float32)
    return np.clip(rgb + np.clip(m, 0, None)[..., None] * k * sila, 0, 1)


def strefa_bebnow(W, H, pion):
    """Miękka maska strefy bębnów (01 § 6.2–6.3) — tam tło przyciemniamy."""
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    if pion:
        cx, cy, rx, ry = 0.5 * W, 0.43 * H, 0.5 * W, 0.26 * H
    else:
        cx, cy, rx, ry = 0.5 * W, 0.46 * H, 0.34 * W, 0.36 * H
    d = np.sqrt(((xx - cx) / rx) ** 2 + ((yy - cy) / ry) ** 2)
    return B.smoothstep(1.25 - d, 0.0, 0.6)


def wykoncz(rgb, W, H, pion, ciemny_srodek=0.55, panel=True, seed=1):
    """Wspólne wykończenie: ciemniejsza strefa bębnów, gradient pod panel, winieta, ziarno."""
    rgb = rgb * (1 - ciemny_srodek * strefa_bebnow(W, H, pion))[..., None]
    if panel:
        y0 = 0.66 if pion else 0.8
        yy = np.linspace(0, 1, H, dtype=np.float32)[:, None, None]
        t = B.smoothstep(yy, y0 - 0.06, 1.0)
        rgb = rgb * (1 - 0.85 * t) + B.kol("bg0") * 0.85 * t
    rgb = B.winieta(rgb, 0.4, 1.8)
    return B.ziarno(np.clip(rgb, 0, 1), 0.01, seed)


def snopy_swiatla(W, H, x0, y0, kat_st, szer, dl, n=4, kolor="#FFD9A0", sila=0.35, seed=4):
    """Ukośne snopy światła z lewej-góry (z drobnym pyłem) — klasyczny „cinematic” akcent tła."""
    rng = np.random.default_rng(seed)
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    out = np.zeros((H, W), np.float32)
    for i in range(n):
        k = math.radians(kat_st + rng.uniform(-6, 6))
        ux, uy = math.cos(k), math.sin(k)
        px, py = x0 + rng.uniform(-0.08, 0.08) * W, y0
        t = (xx - px) * ux + (yy - py) * uy
        d = np.abs(-(xx - px) * uy + (yy - py) * ux)
        w = szer * rng.uniform(0.6, 1.4) * (1 + t / dl * 0.8)
        out += np.exp(-(d / np.maximum(w, 1)) ** 2) * B.smoothstep(t, 0, dl * 0.1) * np.clip(1 - t / dl, 0, 1) * rng.uniform(0.5, 1)
    pyl = (rng.random((H, W)) > 0.9985).astype(np.float32)
    pyl = B.rozmyj(pyl, 1.2) * 18
    out = out * (1 + pyl * 0.8)
    return out * sila, kolor


def gwiazdy(W, H, n, y_maks, seed, jasnosc=1.0):
    rng = np.random.default_rng(seed)
    m = np.zeros((H, W), np.float32)
    xs = rng.integers(0, W, n)
    ys = (rng.random(n) ** 1.6 * y_maks * H).astype(int)
    m[np.clip(ys, 0, H - 1), xs] = rng.random(n) ** 3 * 3 * jasnosc
    return B.rozmyj(m, 0.7) * 3


def perspektywa_y(t, horyzont, dol):
    """Pozycja linii podłogi w perspektywie: t=0 przy horyzoncie, t=1 na dole kadru."""
    return horyzont + (dol - horyzont) * t ** 2.2


# ------------------------------------------------------------------------------------------------
# Lobby kasyna
# ------------------------------------------------------------------------------------------------
def lobby(W, H, pion, ciemny=None):
    """Luksusowe wnętrze kasyna nocą: łuki, kolumny z czarnego marmuru, żyrandole (złoty bokeh), rzędy automatów
    (bokeh magenta/cyjan), błyszcząca posadzka z chodnikiem prowadzącym w głąb, ciemny korytarz w środku."""
    rgb = B.gradient_pionowy(H, W, [(0, "#2A1A58"), (0.3, "#1A1040"), (0.6, "#0E0A26"), (1, "#07060F")])
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    vx, vy = 0.5 * W, (0.42 if pion else 0.47) * H
    sk = W / 1536
    # głębia korytarza: ciemniejsze „wnętrze” w punkcie zbiegu
    rgb = rgb * (1 - 0.5 * B.radialny(H, W, vx, vy, 0.35 * W, 1.2))[..., None]
    # łuki arkad (złote, świecące), coraz mniejsze w głąb
    luki = np.zeros((H, W), np.float32)
    for i in range(6):
        t = i / 5
        k = 1 - 0.8 * t ** 0.8
        rw, rh = 0.48 * W * k, (0.55 if pion else 0.42) * H * k
        ly = vy - 0.02 * H

        def luk(d, s, rw=rw, rh=rh, ly=ly, t=t):
            d.arc([(vx - rw) * s, (ly - rh) * s, (vx + rw) * s, (ly + rh) * s], 180, 360, fill=255,
                  width=max(1, int((9 - 6 * t) * sk * s)))
        luki += maska(W, H, luk) * (1.0 - 0.65 * t)
    rgb = swiec(rgb, luki, "#FFE08A", 0.45)
    rgb = swiec(rgb, B.rozmyj(luki, 10 * sk), "#F5C542", 0.35)
    # rzędy automatów po bokach: obudowy + świecące ekrany (perspektywa)
    rng = np.random.default_rng(3)
    for strona in (-1, 1):
        for i in range(9):
            t = i / 8                                 # 0 = daleko, 1 = blisko
            x = vx + strona * (0.07 + 0.36 * t ** 1.2) * W
            h_ = (0.06 + 0.2 * t) * H
            w_ = (0.025 + 0.07 * t) * W
            y_dol = vy + (0.03 + 0.28 * t) * H
            kol_ek = rng.choice(["#FF2E88", "#21E6FF", "#B66BFF", "#FFB23D"])

            def obud(d, s, x=x, w_=w_, h_=h_, y_dol=y_dol):
                d.rounded_rectangle([(x - w_ / 2) * s, (y_dol - h_) * s, (x + w_ / 2) * s, y_dol * s], radius=w_ * 0.15 * s,
                                    fill=255)
            om = maska(W, H, obud, 1)
            rgb = maluj(rgb, om, "#0B0718", 0.85)

            def ekran(d, s, x=x, w_=w_, h_=h_, y_dol=y_dol):
                d.rectangle([(x - w_ * 0.36) * s, (y_dol - h_ * 0.85) * s, (x + w_ * 0.36) * s, (y_dol - h_ * 0.45) * s],
                            fill=255)
            em = maska(W, H, ekran, 1)
            rozm = 1.5 + 6 * (1 - t)
            rgb = swiec(rgb, B.rozmyj(em, rozm * sk), kol_ek, 0.55 + 0.25 * t)
            rgb = swiec(rgb, B.rozmyj(em, (14 + 20 * t) * sk), kol_ek, 0.25)
    # kolumny z czarnego marmuru ze złotymi żyłkami, kapitele i bazy
    marmur = B.szum(H, W, 26 * sk, 4, 7)
    zylki = np.exp(-((marmur - 0.5) / 0.018) ** 2)
    for strona in (-1, 1):
        for j, (pos, szer) in enumerate(((0.47, 0.085), (0.34, 0.055), (0.25, 0.035)) if not pion else
                                        ((0.47, 0.12), (0.35, 0.075))):
            x = vx + strona * pos * W
            w = szer * W
            gora = (0.0 if j == 0 else 0.08 + 0.07 * j) * H
            dol = vy + (H - vy) * (0.95 - 0.35 * j)
            km = maska(W, H, lambda d, s, x=x, w=w, gora=gora, dol=dol: d.rectangle(
                [(x - w / 2) * s, gora * s, (x + w / 2) * s, dol * s], fill=255), 1)
            cien = np.clip(0.25 + 0.75 * (1 - np.abs(xx - x + strona * w * 0.18) / (w / 2)), 0, 1)
            kol_kol = (B.kol("#120C1E") * cien[..., None] + zylki[..., None] * B.kol("#F5C542") * 0.35 * cien[..., None])
            kol_kol = kol_kol * (1 - 0.3 * j)
            rgb = rgb * (1 - km[..., None]) + kol_kol * km[..., None]
            rim = np.exp(-((xx - (x - strona * w * 0.48)) / (2.5 * sk)) ** 2) * km
            rgb = swiec(rgb, rim, "#FFE08A", 0.35)
            for yk, hk in ((gora + 0.015 * H, 0.03), (dol - 0.02 * H, 0.025)):
                kap = maska(W, H, lambda d, s, yk=yk, x=x, w=w, hk=hk: d.rectangle(
                    [(x - w * 0.62) * s, (yk - hk * H / 2) * s, (x + w * 0.62) * s, (yk + hk * H / 2) * s], fill=255))
                hz = B.wysokosc(kap, 4 * sk)
                zl = B.material(B.normalne(hz), "zloto") * (0.8 - 0.25 * j)
                rgb = rgb * (1 - kap[..., None]) + zl * kap[..., None]
    # żyrandole: złote skupiska bokeh + ciepła poświata u góry
    pkt = []
    for (cx, cy, rozrzut, n_) in ((0.5, 0.06, 0.12, 70), (0.2, 0.1, 0.07, 40), (0.8, 0.1, 0.07, 40)):
        for i in range(n_):
            pkt.append((rng.normal(cx, rozrzut) * W, abs(rng.normal(cy, rozrzut * 0.5)) * H,
                        rng.uniform(4, 20) * sk * (1.3 if pion else 1), rng.choice(["#FFE08A", "#F5C542", "#FFF3D1"]),
                        rng.uniform(0.15, 0.45)))
        rgb = swiec(rgb, B.radialny(H, W, cx * W, cy * H, 0.22 * W, 1.8), "#F5C542", 0.35)
    rgb = B.bokeh(rgb, pkt)
    # błyszcząca posadzka: odbicie górnej części (rozmyte, przyciemnione) + chodnik do punktu zbiegu
    y_pod = int(vy + 0.06 * H)
    odb = rgb[max(0, 2 * y_pod - H):y_pod][::-1]
    odb = B.rozmyj(odb, 5 * sk)
    h = min(odb.shape[0], H - y_pod)
    pod = B.gradient_pionowy(H - y_pod, W, [(0, "#140C2A"), (1, "#07060F")])
    rgb[y_pod:y_pod + h] = pod[:h] + odb[:h] * 0.35 * np.linspace(1, 0.2, h)[:, None, None]
    chodnik = maska(W, H, lambda d, s: d.polygon([((vx - 0.02 * W) * s, y_pod * s), ((vx + 0.02 * W) * s, y_pod * s),
                                                   ((vx + 0.3 * W) * s, H * s), ((vx - 0.3 * W) * s, H * s)], fill=255))
    rgb = maluj(rgb, chodnik, "#3A0E2E", 0.55)
    brzegi = np.clip(B.dylatacja(chodnik > 0.5, 2).astype(np.float32) - B.erozja(chodnik > 0.5, 2), 0, 1)
    rgb = swiec(rgb, brzegi * (yy > y_pod), "#F5C542", 0.4)
    s, k = snopy_swiatla(W, H, 0.15 * W, -0.05 * H, 62, 0.035 * W, 1.0 * H, 3, "#FFE2B0", 0.12, 9)
    rgb = swiec(rgb, s, k)
    return wykoncz(rgb, W, H, pion, 0.45 if ciemny is None else ciemny)


# ------------------------------------------------------------------------------------------------
# S1: retro Vegas + synthwave
# ------------------------------------------------------------------------------------------------
def _palma(W, H, x, y_dol, wys, strona, s):
    def rys(d, ss):
        pts = []
        for i in range(30):
            t = i / 29
            pts.append(((x + strona * math.sin(t * 1.2) * wys * 0.18) * ss, (y_dol - t * wys) * ss))
        d.line(pts, fill=255, width=int(wys * 0.035 * ss), joint="curve")
        tx, ty = pts[-1][0] / ss, pts[-1][1] / ss
        for k in range(9):
            a = math.radians(-170 + k * 22 + strona * 10)
            dl = wys * (0.32 + 0.08 * math.sin(k * 1.7))
            fr = []
            for j in range(16):
                u = j / 15
                fr.append(((tx + math.cos(a) * dl * u) * ss, (ty + math.sin(a) * dl * u + (u ** 2) * dl * 0.45) * ss))
            d.line(fr, fill=255, width=int(wys * 0.03 * ss * (1.2 if k % 2 else 0.9)), joint="curve")
    del s
    return maska(W, H, rys)


def vegas(W, H, pion, ciemny=None):
    hor = (0.24 if pion else 0.5) * H
    rgb = B.gradient_pionowy(H, W, [(0, "#0B0624"), (hor / H * 0.55, "#1B0A4A"), (hor / H * 0.9, "#3A0CA3"),
                                    (hor / H, "#7A1E8E"), (min(1, hor / H + 0.02), "#0B0624"), (1, "#07060F")])
    rgb = swiec(rgb, gwiazdy(W, H, 900, hor / H * 0.85, 2, 0.8), "#FFFFFF", 0.8)
    # łuna przy horyzoncie
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    luna = np.exp(-((yy - hor) / (0.07 * H)) ** 2) * (yy < hor + 2)
    rgb = swiec(rgb, luna, "#FF2E88", 0.45)
    rgb = swiec(rgb, np.exp(-((yy - hor) / (0.025 * H)) ** 2), "#FF7A3D", 0.4)
    # pasiaste słońce wschodzące z horyzontu — przygaszone tam, gdzie będzie okno bębnów
    R = (0.3 if pion else 0.26) * W
    sl = B.smoothstep(R - np.sqrt((xx - W / 2) ** 2 + (yy - hor) ** 2), 0, 3) * (yy < hor)
    paski = ((yy - (hor - R)) / R)
    przerwy = (np.sin(paski * 34 * (0.4 + paski)) > 0.55 - 0.9 * (1 - paski)) & (paski > 0.45)
    sl = sl * (~przerwy)
    kol_sl = B.gradient_pionowy(H, W, [(0, "#FFD04D"), (max(0.01, (hor - R) / H), "#FFD04D"), (hor / H, "#FF2E88"), (1, "#FF2E88")])
    sl_rgb = kol_sl * sl[..., None]
    przygas = 1 - 0.65 * strefa_bebnow(W, H, pion)
    rgb = rgb * (1 - sl[..., None] * 0.9) + sl_rgb * 0.9 * przygas[..., None]
    rgb = swiec(rgb, B.rozmyj(sl * przygas, 30), "#FF4FA0", 0.5)
    # góry w oddali
    gory = np.zeros((H, W), np.float32)
    prof = B.szum(1, W, 90, 3, 5)[0] * 0.08 * H + 0.02 * H
    gory[(yy < hor) & (yy > hor - prof[None, :])] = 1
    rgb = maluj(rgb, B.rozmyj(gory, 1), "#140636", 0.95)
    rgb = swiec(rgb, B.rozmyj(gory, 1) * np.exp(-((yy - (hor - prof[None, :])) / 3) ** 2) * 2, "#FF2E88", 0.25)
    # siatka podłogi w perspektywie
    siatka = np.zeros((H, W), np.float32)
    start = 0.66 * H if pion else hor
    for i in range(1, 20):
        y = perspektywa_y(i / 19, hor, H * 1.05)
        if y < start:
            continue
        siatka += np.exp(-((yy - y) / (0.6 + 2.5 * (y - hor) / H)) ** 2) * (yy > hor)
    for k in range(-24, 25):
        x_dol = W / 2 + k * W * 0.09
        xl = W / 2 + (x_dol - W / 2) * np.clip((yy - hor) / (H - hor), 0, 1)
        siatka += np.exp(-((xx - xl) / (0.7 + 1.5 * (yy - hor) / H)) ** 2) * (yy > max(hor, start)) * 0.9
    siatka *= B.smoothstep(yy, max(hor, start), max(hor, start) + 0.06 * H)
    rgb = maluj(rgb, (yy > hor).astype(np.float32), "#090320", 0.85)
    rgb = swiec(rgb, siatka, "#2B6BFF", 0.8)
    rgb = swiec(rgb, B.rozmyj(siatka, 4), "#FF2E88", 0.35)
    # boki: palmy, szyldy-strzałki i gwiazdy „atomic age” z żarówkami
    for strona in (-1, 1):
        x = W / 2 + strona * (0.43 if not pion else 0.47) * W
        p = _palma(W, H, x, hor + 0.06 * H, (0.42 if not pion else 0.2) * H, -strona, 2)
        rgb = maluj(rgb, p, "#05020F", 0.95)
        p2 = _palma(W, H, x + strona * 0.06 * W, hor + 0.03 * H, (0.3 if not pion else 0.15) * H, strona, 2)
        rgb = maluj(rgb, p2, "#0A0420", 0.9)
    for strona, kol_ in ((-1, "magenta"), (1, "cyan")):
        cx = W / 2 + strona * (0.36 if not pion else 0.33) * W
        cy = (0.3 if not pion else 0.12) * H
        r = (0.06 if not pion else 0.08) * W

        def gwiazda(d, s, cx=cx, cy=cy, r=r):
            pts = []
            for i in range(16):
                a = -math.pi / 2 + i * math.pi / 8
                rr = r if i % 2 == 0 else r * 0.38
                pts.append(((cx + rr * math.cos(a)) * s, (cy + rr * math.sin(a)) * s))
            d.line(pts + [pts[0]], fill=255, width=int(4 * s))
        gm = maska(W, H, gwiazda)
        rgb = swiec(rgb, gm, "#FFFFFF", 0.7)
        rgb = swiec(rgb, B.rozmyj(gm, 6), kol_, 1.1)
        rgb = swiec(rgb, B.rozmyj(gm, 22), kol_, 0.5)
    # szyld-strzałka z żarówkami (lewy dół)
    ax, ay = (0.1 if not pion else 0.08) * W, (0.62 if not pion else 0.72) * H
    aw, ah = (0.14 if not pion else 0.2) * W, (0.07 if not pion else 0.04) * H

    def strzalka(d, s):
        d.polygon([(ax * s, (ay - ah / 2) * s), ((ax + aw * 0.75) * s, (ay - ah / 2) * s),
                   ((ax + aw * 0.75) * s, (ay - ah) * s), ((ax + aw) * s, ay * s), ((ax + aw * 0.75) * s, (ay + ah) * s),
                   ((ax + aw * 0.75) * s, (ay + ah / 2) * s), (ax * s, (ay + ah / 2) * s)], outline=255, width=int(5 * s))
    sm = maska(W, H, strzalka)
    rgb = swiec(rgb, sm, "#FFE08A", 0.8)
    rgb = swiec(rgb, B.rozmyj(sm, 8), "#FF2E88", 0.9)
    # neonowy szyld w kształcie cebuli (lewy górny róg, sam kształt)
    ox, oy, orr = (0.12 if not pion else 0.15) * W, (0.12 if not pion else 0.06) * H, (0.05 if not pion else 0.07) * W
    from blender.tekstury import sylwetka_cebuli_w_koronie
    ceb, kor = sylwetka_cebuli_w_koronie(int(orr * 4), orr * 2, orr * 2.1, orr * 2.4)
    obrys_c = np.clip(B.dylatacja(np.maximum(ceb, kor) > 0.5, 3).astype(np.float32) - np.maximum(ceb, kor), 0, 1)
    duzy = np.zeros((H, W), np.float32)
    y0, x0 = int(oy - orr * 2), int(ox - orr * 2)
    duzy[max(0, y0):y0 + obrys_c.shape[0], max(0, x0):x0 + obrys_c.shape[1]] = obrys_c[max(0, -y0):, max(0, -x0):][:H - max(0, y0), :W - max(0, x0)]
    rgb = swiec(rgb, duzy, "#FFF3D1", 0.7)
    rgb = swiec(rgb, B.rozmyj(duzy, 7), "#F5C542", 1.0)
    return wykoncz(rgb, W, H, pion, 0.45 if ciemny is None else ciemny)


# ------------------------------------------------------------------------------------------------
# S2: skarbiec grobowca i noc nad piramidami
# ------------------------------------------------------------------------------------------------
def _hieroglify_pas(W, H, x0, x1, y0, y1, seed):
    """Pas „hieroglifów” (dekoracja, nie tekst): drobne znaki z kresek i kółek."""
    rng = np.random.default_rng(seed)

    def rys(d, s):
        x = x0
        while x < x1:
            y = y0
            while y < y1:
                typ = rng.integers(0, 5)
                w = (x1 - x0) * rng.uniform(0.25, 0.4)
                if typ == 0:
                    d.ellipse([x * s, y * s, (x + w * 0.6) * s, (y + w * 0.6) * s], outline=255, width=int(2 * s))
                elif typ == 1:
                    d.line([(x * s, y * s), (x * s, (y + w) * s)], fill=255, width=int(2 * s))
                elif typ == 2:
                    d.line([(x * s, y * s), ((x + w) * s, (y + w * 0.4) * s)], fill=255, width=int(2 * s))
                elif typ == 3:
                    d.polygon([(x * s, (y + w) * s), ((x + w / 2) * s, y * s), ((x + w) * s, (y + w) * s)], outline=255)
                else:
                    d.arc([x * s, y * s, (x + w) * s, (y + w) * s], 0, 180, fill=255, width=int(2 * s))
                y += w * 1.3
            x += (x1 - x0) * 0.5
    return maska(W, H, rys)


def _ogien(W, H, cx, cy, r, seed):
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    n = B.szum(H, W, r * 0.6, 3, seed)
    dx, dy = (xx - cx) / r, (yy - cy) / r
    plomien = np.clip(1 - np.sqrt((dx * 1.8) ** 2 + ((dy + 0.5) * 0.9) ** 2) + (n - 0.5) * 0.6, 0, 1) * (dy < 0.3)
    return plomien


def skarbiec(W, H, pion, ciemny=None):
    rgb = B.gradient_pionowy(H, W, [(0, "#1A1008"), (0.5, "#120C08"), (1, "#07060F")])
    kam = B.szum(H, W, 40, 4, 31)
    rgb = rgb * (0.75 + 0.5 * kam[..., None])
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    # ciemna nisza-portal za bębnami
    px0, px1 = (0.2 if not pion else 0.04) * W, (0.8 if not pion else 0.96) * W
    py0, py1 = (0.13 if not pion else 0.2) * H, (0.82 if not pion else 0.7) * H
    nisza = maska(W, H, lambda d, s: d.rectangle([px0 * s, py0 * s, px1 * s, py1 * s], fill=255), 1)
    rgb = maluj(rgb, B.rozmyj(nisza, 6), "#06040A", 0.85)
    ramka = maska(W, H, lambda d, s: d.rectangle([(px0 - 14) * s, (py0 - 14) * s, (px1 + 14) * s, (py1 + 14) * s],
                                                 outline=255, width=int(10 * s)), 1)
    rgb = maluj(rgb, ramka, "#3A2814", 0.8)
    # przygaszony skrzydlaty dysk słońca w pasie górnym
    from gen_napisy import skrzydlaty_dysk
    dysk = skrzydlaty_dysk(int((0.36 if not pion else 0.6) * W))
    dysk[..., :3] *= 0.45
    warstwa = np.concatenate([rgb, np.ones((H, W, 1))], -1).astype(np.float32)
    B.nakladaj_srodek(warstwa, dysk, W / 2, (0.065 if not pion else 0.13) * H, krycie=0.75)
    rgb = warstwa[..., :3]
    # kolumny z kapitelami lotosu i fryzami po bokach
    for strona in (-1, 1):
        for j, (pos, szer) in enumerate(((0.44, 0.11), (0.3, 0.07)) if not pion else ((0.47, 0.12),)):
            x = W / 2 + strona * pos * W
            w = szer * W
            km = maska(W, H, lambda d, s, x=x, w=w: d.rectangle([(x - w / 2) * s, 0, (x + w / 2) * s, H * s], fill=255), 1)
            cien = np.clip(0.35 + 0.65 * (1 - np.abs(xx - x + w * 0.2) / (w / 2)), 0, 1)
            piask = B.kol("s2_piaskowiec") * (0.35 - 0.12 * j)
            kol_kol = piask * cien[..., None] * (0.8 + 0.4 * kam[..., None])
            rgb = rgb * (1 - km[..., None]) + kol_kol * km[..., None]
            for k, kol_p in enumerate(("#1B3FA0", "#2EC4B6", "#B8860B")):
                pas_y = (0.2 + 0.07 * k) * H
                pm = maska(W, H, lambda d, s, x=x, w=w, pas_y=pas_y: d.rectangle(
                    [(x - w / 2) * s, pas_y * s, (x + w / 2) * s, (pas_y + 0.02 * H) * s], fill=255), 1)
                rgb = maluj(rgb, pm, kol_p, 0.45 - 0.15 * j)
            kap = maska(W, H, lambda d, s, x=x, w=w: d.polygon(
                [((x - w * 0.8) * s, 0.13 * H * s), ((x + w * 0.8) * s, 0.13 * H * s), ((x + w * 0.5) * s, 0.18 * H * s),
                 ((x - w * 0.5) * s, 0.18 * H * s)], fill=255))
            rgb = maluj(rgb, kap, "#8A6A30", 0.7 - 0.2 * j)
            hier = _hieroglify_pas(W, H, x - w * 0.35, x + w * 0.35, 0.34 * H, 0.75 * H, 40 + j + strona)
            rgb = swiec(rgb, hier, "#B8860B", 0.25 - 0.08 * j)
    # kosze ognia (lewy jaśniejszy — key light)
    for strona, sila in ((-1, 1.0), (1, 0.7)):
        fx, fy = W / 2 + strona * (0.37 if not pion else 0.36) * W, (0.42 if not pion else 0.17) * H
        r = (0.035 if not pion else 0.05) * W
        kosz = maska(W, H, lambda d, s, fx=fx, fy=fy, r=r: d.polygon(
            [((fx - r) * s, fy * s), ((fx + r) * s, fy * s), ((fx + r * 0.6) * s, (fy + r * 0.9) * s),
             ((fx - r * 0.6) * s, (fy + r * 0.9) * s)], fill=255))
        rgb = maluj(rgb, kosz, "#3A2210", 0.95)
        pl = _ogien(W, H, fx, fy, r * 1.4, 50 + strona)
        rgb = swiec(rgb, pl, "#FF7A1A", 1.2 * sila)
        rgb = swiec(rgb, B.smoothstep(pl, 0.5, 1.0), "#FFE08A", 0.8 * sila)
        rgb = swiec(rgb, B.radialny(H, W, fx, fy - r, 0.45 * W, 2.2), "#FFA45C", 0.35 * sila)
    # kopce złota w dolnych rogach (monety z renderu)
    mon = B.render("moneta_skos")
    rng = np.random.default_rng(8)
    warstwa = np.concatenate([rgb, np.ones((H, W, 1))], -1).astype(np.float32)
    for strona in (-1, 1):
        cx = W / 2 + strona * (0.4 if not pion else 0.36) * W
        cy = (0.86 if not pion else 0.9) * H
        for i in range(70):
            r = rng.uniform(0.018, 0.032) * W
            x = cx + rng.normal(0, 0.07 * W)
            y = cy - abs(rng.normal(0, 0.05 * H)) * (1 - abs(x - cx) / (0.2 * W)) + rng.uniform(0, 0.04) * H
            m = B.skaluj(mon, int(r * 2))
            m[..., :3] *= rng.uniform(0.35, 0.6)
            B.nakladaj_srodek(warstwa, m, x, y)
    rgb = warstwa[..., :3]
    s, k = snopy_swiatla(W, H, 0.18 * W, -0.05 * H, 64, 0.035 * W, 1.0 * H, 4, "#FFC889", 0.16, 12)
    rgb = swiec(rgb, s, k)
    return wykoncz(rgb, W, H, pion, 0.55 if ciemny is None else ciemny)


def piramidy_noc(W, H, pion, ciemny=None):
    hor = (0.62 if not pion else 0.58) * H
    rgb = B.gradient_pionowy(H, W, [(0, "#050A22"), (hor / H * 0.7, "#0A1030"), (hor / H, "#16244E"), (1, "#05070F")])
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    # Droga Mleczna po skosie od lewego-górnego rogu + tysiące gwiazd
    t = ((xx / W) * 0.8 - (yy / H) * 1.0)
    pas = np.exp(-((t - 0.05) / 0.12) ** 2) * (yy < hor)
    mgla = B.szum(H, W, 80, 5, 61) * pas
    rgb = swiec(rgb, mgla, "#7FA0FF", 0.22)
    rgb = swiec(rgb, mgla ** 3, "#E8F0FF", 0.25)
    rgb = swiec(rgb, gwiazdy(W, H, 4000, hor / H, 62, 0.7) * (0.6 + pas * 1.5), "#E8F0FF", 0.9)
    # wydmy w niebieskiej poświacie
    prof = hor - B.szum(1, W, 220, 3, 63)[0] * 0.05 * H
    wydmy = (yy > prof[None, :]).astype(np.float32)
    rgb = maluj(rgb, wydmy, "#0B1430", 0.95)
    rgb = swiec(rgb, wydmy * np.exp(-((yy - prof[None, :]) / 4) ** 2), "#9FE8FF", 0.25)
    # główna piramida za bębnami, wierzchołek na ~12% wysokości, wiązka światła w niebo
    apex_y = (0.12 if not pion else 0.13) * H
    baza = (0.47 if not pion else 0.62) * W

    def piramida(d, s, cx, ay, b, hy):
        d.polygon([(cx * s, ay * s), ((cx + b) * s, hy * s), ((cx - b) * s, hy * s)], fill=255)
    for (cx, b, ay, jas) in ((W * (0.12 if not pion else 0.05), 0.2 * W, hor - 0.2 * H, 0.6),
                              (W * (0.88 if not pion else 0.95), 0.22 * W, hor - 0.24 * H, 0.6)):
        pm = maska(W, H, lambda d, s, cx=cx, b=b, ay=ay: piramida(d, s, cx, ay, b, hor + 0.02 * H))
        lewa = (xx < cx) & (pm > 0.5)
        rgb = maluj(rgb, pm, "#101A3A", 0.95)
        rgb = maluj(rgb, lewa.astype(np.float32), "#1E3060", 0.5 * jas)
    pm = maska(W, H, lambda d, s: piramida(d, s, W / 2, apex_y, baza, hor + 0.04 * H))
    rgb = maluj(rgb, pm, "#0C1430", 1.0)
    lewa = ((xx < W / 2) & (pm > 0.5)).astype(np.float32)
    rgb = maluj(rgb, lewa * (1 - strefa_bebnow(W, H, pion) * 0.5), "#2B4A8C", 0.7)
    # krawędzie ścian w świetle księżyca
    for strona in (-1, 1):
        t = np.clip((yy - apex_y) / (hor - apex_y), 0, 1)
        xk = W / 2 + strona * baza * t
        k = np.exp(-((xx - xk) / 2.0) ** 2) * (yy > apex_y) * (yy < hor + 0.04 * H)
        rgb = swiec(rgb, k, "#9FE8FF", 0.5 if strona < 0 else 0.25)
    krawedz = np.exp(-((xx - W / 2) / 2.5) ** 2) * (yy > apex_y) * (yy < hor) * (1 - strefa_bebnow(W, H, pion))
    rgb = swiec(rgb, krawedz, "#9FE8FF", 0.35)
    wiazka = np.exp(-((xx - W / 2) / (0.012 * W)) ** 2) * (yy < apex_y) * B.smoothstep(yy, 0, apex_y)
    rgb = swiec(rgb, wiazka, "#E8FCFF", 1.0)
    rgb = swiec(rgb, np.exp(-((xx - W / 2) / (0.05 * W)) ** 2) * B.smoothstep(apex_y + 0.02 * H - yy, 0, 0.08 * H),
                "#9FE8FF", 0.45)
    rgb = swiec(rgb, B.radialny(H, W, W / 2, apex_y, 0.12 * W, 1.5), "#9FE8FF", 0.6)
    # obeliski w dolnych rogach
    for strona in (-1, 1):
        ox = W / 2 + strona * (0.43 if not pion else 0.42) * W
        ow = (0.03 if not pion else 0.05) * W
        om = maska(W, H, lambda d, s, ox=ox, ow=ow: d.polygon(
            [((ox - ow) * s, H * s), ((ox - ow * 0.7) * s, (hor - 0.14 * H) * s), (ox * s, (hor - 0.19 * H) * s),
             ((ox + ow * 0.7) * s, (hor - 0.14 * H) * s), ((ox + ow) * s, H * s)], fill=255))
        rgb = maluj(rgb, om, "#070B1C", 0.95)
        rgb = swiec(rgb, om * (xx < ox) * 0.6, "#2A4A8A", 0.3)
    return wykoncz(rgb, W, H, pion, 0.45 if ciemny is None else ciemny)


# ------------------------------------------------------------------------------------------------
# S3: kryształowa jaskinia i komnata z zorzą
# ------------------------------------------------------------------------------------------------
def jaskinia(W, H, pion, fs=False, ciemny=None):
    rgb = B.gradient_pionowy(H, W, [(0, "#0D1638"), (0.5, "#070A1F"), (1, "#05060F")])
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    skala = B.szum(H, W, 70, 5, 71)
    rgb = rgb * (0.6 + 0.8 * skala[..., None])
    # ściany jaskini po bokach (ciemniejsza skała, nieregularny brzeg)
    for strona in (-1, 1):
        prof = (0.2 if not pion else 0.1) * W + B.szum(H, 1, 90, 3, 72 + strona)[:, 0] * 0.08 * W
        sciana = ((xx < prof[:, None]) if strona < 0 else (xx > W - prof[:, None])).astype(np.float32)
        rgb = maluj(rgb, B.rozmyj(sciana, 4), "#04050E", 0.7)
    if fs:
        # zorza pod sklepieniem: zasłony zwisające z falującej górnej krawędzi, z pionowymi prążkami
        for k, (kol_dol, kol_gora, y0, amp, sila) in enumerate((("s3_zorza1", "s3_zorza2", 0.06, 0.05, 0.6),
                                                               ("s3_zorza2", "s3_zorza1", 0.16, 0.035, 0.4))):
            fala = (y0 + amp * np.sin(xx[0] / W * 5.5 + k * 1.7) + 0.02 * np.sin(xx[0] / W * 17 + k)) * H
            d = yy - fala[None, :]
            dl = (0.1 + 0.05 * k) * H
            zaslona = np.where(d > 0, np.exp(-np.maximum(d, 0) / dl), np.exp(np.minimum(d, 0) / (0.006 * H))) * (d > -0.02 * H)
            prazki = 0.55 + 0.45 * np.sin(xx / W * 140 + B.szum(H, W, 60, 2, 80 + k) * 4) ** 2
            zorza = zaslona * prazki * sila
            t = np.clip(d / dl, 0, 1)[..., None]
            kol_z = B.kol(kol_dol) * (1 - t) + B.kol(kol_gora) * t
            rgb = np.clip(rgb + zorza[..., None] * kol_z, 0, 1)
    # wąski świetlisty wodospad ze sklepienia, znika za ramką
    szum_w = B.szum(H, W, 6, 2, 73)
    wod = np.exp(-((xx - W / 2) / (0.018 * W)) ** 2) * (0.5 + 0.5 * szum_w) * B.smoothstep((0.36 if not pion else 0.22) * H - yy, 0, 0.12 * H)
    rgb = swiec(rgb, wod, "#BFF6FF", 0.75)
    rgb = swiec(rgb, B.rozmyj(wod, 18), "#19F5D2", 0.6)
    # złoty snop światła z lewej-góry z pyłem
    s, k = snopy_swiatla(W, H, 0.2 * W, -0.05 * H, 63, 0.03 * W, 1.0 * H, 3, "#FFD38A", 0.14, 14)
    rgb = swiec(rgb, s, k)
    # kryształy w tle (rysowane) i na pierwszym planie (rendery Blendera)
    rng = np.random.default_rng(77)
    tlo_k = np.zeros((H, W), np.float32)
    for i in range(26):
        strona = rng.choice([-1, 1])
        x = W / 2 + strona * rng.uniform(0.3, 0.5) * W
        y = rng.uniform(0.25, 0.85) * H
        dl, sz = rng.uniform(0.05, 0.14) * H, rng.uniform(0.008, 0.02) * W
        a = math.radians(rng.uniform(-35, 35) - 90)

        def kr(d, s, x=x, y=y, dl=dl, sz=sz, a=a):
            ux, uy = math.cos(a), math.sin(a)
            px, py = -uy, ux
            d.polygon([((x + px * sz) * s, (y + py * sz) * s), ((x + px * sz + ux * dl) * s, (y + py * sz + uy * dl) * s),
                       ((x + ux * dl * 1.25) * s, (y + uy * dl * 1.25) * s),
                       ((x - px * sz + ux * dl) * s, (y - py * sz + uy * dl) * s), ((x - px * sz) * s, (y - py * sz) * s)],
                      fill=255)
        tlo_k += maska(W, H, kr) * rng.uniform(0.3, 0.8)
    kol_k = "#A64DFF" if not fs else "#B66BFF"
    rgb = swiec(rgb, B.rozmyj(tlo_k, 2) * 0.5, kol_k, 0.6 + 0.3 * fs)
    rgb = swiec(rgb, B.rozmyj(tlo_k, 16), "#2F6BFF", 0.4 + 0.2 * fs)
    warstwa = np.concatenate([rgb, np.ones((H, W, 1))], -1).astype(np.float32)
    for nazwa, strona, sk in (("s3_krysztaly_ametyst", -1, 1.0), ("s3_krysztaly_szafir", 1, 0.95)):
        kr = B.przytnij_alfa(B.render(nazwa))
        docel = int((0.5 if not pion else 0.32) * H * sk)
        kr = B.skaluj(kr, int(kr.shape[1] * docel / kr.shape[0]), docel)
        kr[..., :3] *= 0.75 + 0.35 * fs
        x = W / 2 + strona * (0.4 if not pion else 0.4) * W
        y = (0.62 if not pion else 0.78) * H
        B.nakladaj_srodek(warstwa, kr, x, y)
        B.nakladaj_srodek(warstwa, B.poswiata(B.z_maska(kr[..., 3] * 0, "#000000"), 1, "#000000", 0), x, y)
    rgb = warstwa[..., :3]
    # lewitujące kryształy (komnata FS): świecące, rozmyte głębią drzazgi
    if fs:
        lew = np.zeros((H, W), np.float32)
        for i in range(14):
            x = W / 2 + rng.choice([-1, 1]) * rng.uniform(0.22, 0.48) * W
            y = rng.uniform(0.1, 0.5) * H
            dl, sz = rng.uniform(0.03, 0.07) * H, rng.uniform(0.006, 0.012) * W
            a = math.radians(rng.uniform(0, 180))

            def lk(d, s, x=x, y=y, dl=dl, sz=sz, a=a):
                ux, uy = math.cos(a), math.sin(a)
                px, py = -uy, ux
                d.polygon([((x - ux * dl) * s, (y - uy * dl) * s), ((x + px * sz) * s, (y + py * sz) * s),
                           ((x + ux * dl) * s, (y + uy * dl) * s), ((x - px * sz) * s, (y - py * sz) * s)], fill=255)
            lew += maska(W, H, lk) * rng.uniform(0.5, 1.0)
        rgb = swiec(rgb, lew, "#E2C6FF", 0.7)
        rgb = swiec(rgb, B.rozmyj(lew, 10), "#A64DFF", 0.8)
    # świecący mech i grzybki u podstawy ścian + bokeh drobin światła
    pkt = []
    for i in range(120):
        strona = rng.choice([-1, 1])
        x = W / 2 + strona * rng.uniform(0.26, 0.5) * W
        y = rng.uniform(0.7, 0.86) * H if not pion else rng.uniform(0.82, 0.92) * H
        pkt.append((x, y, rng.uniform(2, 7) * W / 1536, "s3_teal", rng.uniform(0.3, 0.8)))
    for i in range(50):
        pkt.append((rng.uniform(0.2, 0.8) * W, rng.uniform(0.15, 0.75) * H, rng.uniform(3, 12) * W / 1536,
                    rng.choice(["s3_teal", "#A64DFF", "#8FD6FF"]), rng.uniform(0.05, 0.2)))
    rgb = B.bokeh(rgb, pkt)
    # nieruchoma tafla wody: odbicie dolnej części, przyciemnione i pofalowane
    tafla_y = int((0.84 if not pion else 0.9) * H)
    if tafla_y < H:
        odb = rgb[max(0, 2 * tafla_y - H):tafla_y][::-1]
        fala = (np.sin(np.arange(odb.shape[0])[:, None] * 0.9 + np.arange(W)[None, :] * 0.02) * 2).astype(int)
        odb = np.take_along_axis(odb, np.clip(np.arange(W)[None, :] + fala, 0, W - 1)[..., None].repeat(3, -1), axis=1)
        h = min(odb.shape[0], H - tafla_y)
        w_ = np.linspace(0.55, 0.15, h)[:, None, None]
        przejscie = B.smoothstep(np.arange(h, dtype=np.float32), 0, 6)[:, None, None]
        rgb[tafla_y:tafla_y + h] = rgb[tafla_y:tafla_y + h] * (1 - 0.45 * przejscie) + odb[:h] * w_ * przejscie
    return wykoncz(rgb, W, H, pion, (0.5 if not fs else 0.42) if ciemny is None else ciemny)


# ------------------------------------------------------------------------------------------------
def _gen(fn, pion, **kw):
    W, H = (1024, 1536) if pion else (1536, 1024)
    rgb = fn(W, H, pion, **kw)
    return np.concatenate([rgb, np.ones((H, W, 1))], -1).astype(np.float32)


GENERATORY = {
    "g_tlo_lobby_desktop": lambda: _gen(lobby, False), "g_tlo_lobby_mobile": lambda: _gen(lobby, True),
    "s1_tlo_desktop": lambda: _gen(vegas, False), "s1_tlo_mobile": lambda: _gen(vegas, True),
    "s2_tlo_desktop": lambda: _gen(skarbiec, False), "s2_tlo_mobile": lambda: _gen(skarbiec, True),
    "s2_tlo_fs_desktop": lambda: _gen(piramidy_noc, False), "s2_tlo_fs_mobile": lambda: _gen(piramidy_noc, True),
    "s3_tlo_desktop": lambda: _gen(jaskinia, False), "s3_tlo_mobile": lambda: _gen(jaskinia, True),
    "s3_tlo_fs_desktop": lambda: _gen(jaskinia, False, fs=True), "s3_tlo_fs_mobile": lambda: _gen(jaskinia, True, fs=True),
}
