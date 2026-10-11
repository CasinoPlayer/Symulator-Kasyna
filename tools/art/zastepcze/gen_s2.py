"""
gen_s2.py — S2 „Złoty Faraon”: symbole (litery z piaskowca z licem z kamienia szlachetnego, złote reliefy:
anch, Oko Horusa, skarabeusz, Anubis, maska faraona; WILD = relikwia cebuli z tabliczką; SCATTER = piramida
z wiązką światła) oraz złoto-kamienna ramka 5×3.

Reliefy są 2,5D: każdą część rysujemy jako maskę, a materiał (złoto, lapis, turkus, obsydian) daje matcap
z renderu Blendera przy oświetleniu pochodnią (01 § 10.3: key ~2400 K, turkusowy rim).
"""

from __future__ import annotations

import math

import numpy as np

import biblioteka as B

S = 1024
WYP = {"niskie": 0.8, "wysokie": 0.83, "specjalne": 0.85}
G = "s2"


def _m(rys, w=S, h=S):
    return B.maska_rysunku(w, h, rys)


def _pas(m, a, b):
    """Pas wewnątrz kształtu między erozją o a i o b pikseli (np. złota obwódka wokół lica)."""
    return np.clip(B.rozmyj(B.erozja(m > 0.5, a).astype(np.float32), 1) - B.rozmyj(B.erozja(m > 0.5, b).astype(np.float32), 1), 0, 1)


def _w(m, r=1.0):
    return B.rozmyj((m > 0.5).astype(np.float32), r)


# ------------------------------------------------------------------------------------------------
# Litery z piaskowca z licem z kamienia szlachetnego
# ------------------------------------------------------------------------------------------------
def _litera(tekst, kamien):
    m = B.wiersze_napisu([tekst], "cinzel900", 600, 0.02, 0)
    m = np.pad(m, 40)
    m = _w(B.dylatacja(m > 0.5, 8), 1.2)
    zloto = _pas(m, 10, 20)
    lico = _w(B.erozja(m > 0.5, 20), 1.0)
    out = B.zloty_napis(m, faza=13, glebokosc=26, kontur=8, rodzaj="kamien", gra=G, kolor="#C89B5A",
                        kontur_kolor="#2A1A0A", wkladki=[(zloto, "zloto", None, "okragly"),
                                                        (lico, "emalia", kamien, "okragly")])
    out = B.blysk(out, out.shape[1] * 0.3, out.shape[0] * 0.22, 34, 0.8)
    return B.wpasuj(out, S, S, WYP["niskie"])


# ------------------------------------------------------------------------------------------------
# Złote reliefy
# ------------------------------------------------------------------------------------------------
def s2_sym_ankh():
    def rys(d, s):
        d.ellipse([340 * s, 70 * s, 684 * s, 470 * s], fill=255)
        d.ellipse([430 * s, 160 * s, 594 * s, 380 * s], fill=0)
        d.polygon([(450 * s, 440 * s), (574 * s, 440 * s), (600 * s, 950 * s), (424 * s, 950 * s)], fill=255)
        d.polygon([(200 * s, 470 * s), (512 * s, 500 * s), (824 * s, 470 * s), (824 * s, 590 * s), (512 * s, 560 * s),
                   (200 * s, 590 * s)], fill=255)
    m = _m(rys)
    petla = _w(B.erozja(_m(lambda d, s: (d.ellipse([340 * s, 70 * s, 684 * s, 470 * s], fill=255),
                                         d.ellipse([430 * s, 160 * s, 594 * s, 380 * s], fill=0))) > 0.5, 24))
    pas_trzonu = _m(lambda d, s: d.polygon([(495 * s, 600 * s), (529 * s, 600 * s), (540 * s, 900 * s), (484 * s, 900 * s)], fill=255))
    znaki = _m(lambda d, s: [d.rectangle([(x - 9) * s, 515 * s, (x + 9) * s, 548 * s], fill=255) if i % 2 else
                             d.ellipse([(x - 12) * s, 519 * s, (x + 12) * s, 543 * s], fill=255)
                             for i, x in enumerate(list(range(250, 450, 40)) + list(range(600, 800, 40)))])
    out = B.zloty_napis(m, faza=20, glebokosc=28, kontur=9, gra=G, kontur_kolor="#2A1A0A",
                        wkladki=[(petla, "emalia", "#2EC4B6", "okragly"), (_w(pas_trzonu), "emalia", "#1B3FA0", "okragly"),
                                 (_w(znaki), "emalia", "#1B3FA0", "plaski")])
    return B.wpasuj(out, S, S, WYP["wysokie"])


def s2_sym_oko():
    def migdal(d, s, grub=0):
        pts = []
        for i in range(60):
            t = 2 * math.pi * i / 60
            x = 512 + 270 * math.cos(t)
            y = 470 + (120 if math.sin(t) > 0 else 105) * math.sin(t) * (1 - 0.25 * math.cos(t))
            pts.append((x * s, y * s))
        d.polygon(pts, fill=255)
    oko = _m(migdal)
    obwodka = np.clip(oko - _w(B.erozja(oko > 0.5, 34)), 0, 1)
    brew = _m(lambda d, s: d.polygon([(220 * s, 300 * s), (500 * s, 250 * s), (820 * s, 280 * s), (820 * s, 330 * s),
                                      (500 * s, 305 * s), (240 * s, 350 * s)], fill=255))
    lza = _m(lambda d, s: (d.rectangle([410 * s, 560 * s, 452 * s, 800 * s], fill=255),
                           d.ellipse([395 * s, 770 * s, 467 * s, 842 * s], fill=255)))

    def spirala(d, s):
        pts = []
        for i in range(70):
            t = i / 69
            a = math.pi * 0.5 + t * math.pi * 2.6
            r = 120 * (1 - 0.72 * t)
            pts.append(((640 + 40 * t * 2 + r * math.cos(a)) * s, (700 + r * math.sin(a) * 0.9) * s))
        d.line([(600 * s, 570 * s)] + pts, fill=255, width=int(38 * s), joint="curve")
    spir = _m(spirala)
    zloto = np.maximum.reduce([obwodka, brew, lza, spir])
    calosc = np.maximum(zloto, oko)
    wnetrze = _w(B.erozja(oko > 0.5, 36))
    zrenica = _m(lambda d, s: d.ellipse([440 * s, 385 * s, 610 * s, 555 * s], fill=255))
    blik = _m(lambda d, s: d.ellipse([500 * s, 410 * s, 545 * s, 455 * s], fill=255))
    out = B.zloty_napis(calosc, faza=18, glebokosc=26, kontur=9, gra=G, kontur_kolor="#2A1A0A",
                        wkladki=[(wnetrze, "emalia", "#0E2466", "plaski"), (zrenica * wnetrze, "emalia", "#1B3FA0", "kopula"),
                                 (blik, "swiecace", "#7FF2E6", "plaski")])
    return B.wpasuj(out, S, S, WYP["wysokie"])


def s2_sym_skarabeusz():
    out = B.plotno(S, S)
    # skrzydła pektorału: pióra w pasach złota, turkusu i lapisu
    for strona in (-1, 1):
        def skrzydlo(d, s, strona=strona):
            for j in range(4):
                y0 = 470 + j * 52
                dl = 400 - j * 60
                d.polygon([((512 + strona * 90) * s, y0 * s), ((512 + strona * dl) * s, (y0 - 60 + j * 10) * s),
                           ((512 + strona * (dl - 30)) * s, (y0 + 30) * s), ((512 + strona * 90) * s, (y0 + 46) * s)], fill=255)
        m = _m(skrzydlo)
        pasy = []
        for j, kol in enumerate(("#2EC4B6", "#1B3FA0", "#2EC4B6", "#1B3FA0")):
            pm = _m(lambda d, s, j=j, strona=strona: d.polygon(
                [((512 + strona * 140) * s, (482 + j * 52) * s), ((512 + strona * (360 - j * 60)) * s, (432 + j * 62) * s),
                 ((512 + strona * (350 - j * 60)) * s, (452 + j * 62) * s), ((512 + strona * 140) * s, (502 + j * 52) * s)], fill=255))
            pasy.append((_w(pm) * m, "emalia", kol, "okragly"))
        B.nakladaj(out, B.wysrodkuj_rgba(B.zloty_napis(m, faza=10, glebokosc=14, kontur=6, gra=G, kontur_kolor="#2A1A0A",
                                                      wkladki=pasy), m), 0, 0)
    nogi = _m(lambda d, s: [d.line([(512 + st * 80) * s, (y) * s, (512 + st * 190) * s, (y + 80) * s], fill=255, width=int(18 * s))
                            for st in (-1, 1) for y in (600, 680)])
    B.nakladaj(out, B.wysrodkuj_rgba(B.zloty_napis(nogi, faza=5, glebokosc=6, kontur=4, gra=G), nogi), 0, 0)
    cialo = _m(lambda d, s: (d.ellipse([392 * s, 400 * s, 632 * s, 790 * s], fill=255),
                             d.ellipse([430 * s, 330 * s, 594 * s, 440 * s], fill=255)))
    obw = _pas(cialo, 2, 14)
    linia = _m(lambda d, s: d.line([512 * s, 470 * s, 512 * s, 780 * s], fill=255, width=int(10 * s)))
    B.nakladaj(out, B.wysrodkuj_rgba(B.zloty_napis(cialo, faza=16, glebokosc=18, kontur=7, rodzaj="emalia", gra=G,
                                                  kolor="#173426", gradient=False, kontur_kolor="#0A0A06",
                                                  wkladki=[(obw, "zloto", None, "okragly"), (_w(linia), "zloto", None, "okragly")]),
                                    cialo), 0, 0)
    dysk = _m(lambda d, s: d.ellipse([412 * s, 130 * s, 612 * s, 330 * s], fill=255))
    B.nakladaj(out, B.wysrodkuj_rgba(B.zloty_napis(dysk, faza=14, glebokosc=14, kontur=7, gra=G,
                                                  wkladki=[(_w(B.erozja(dysk > 0.5, 16)), "emalia", "#C8321E", "kopula")]),
                                    dysk), 0, 0)
    return B.wpasuj(out, S, S, WYP["wysokie"])


def s2_sym_anubis():
    out = B.plotno(S, S)
    # złoty kołnierz usech w pasy lapisu i turkusu
    def kolnierz(d, s):
        d.chord([200 * s, 520 * s, 880 * s, 1000 * s], 180, 360, fill=255)
    km = _m(kolnierz)
    pasy = []
    for j, kol in enumerate(("#1B3FA0", "#2EC4B6", "#1B3FA0")):
        r0 = 300 - j * 70
        pm = _m(lambda d, s, r0=r0: (d.ellipse([(540 - r0) * s, (760 - r0 * 0.7) * s, (540 + r0) * s, (760 + r0 * 0.7) * s], fill=255),
                                     d.ellipse([(540 - r0 + 30) * s, (760 - r0 * 0.7 + 22) * s, (540 + r0 - 30) * s,
                                                (760 + r0 * 0.7 - 22) * s], fill=0)))
        pasy.append((_w(pm) * km, "emalia", kol, "okragly"))
    B.nakladaj(out, B.wysrodkuj_rgba(B.zloty_napis(km, faza=12, glebokosc=16, kontur=7, gra=G, wkladki=pasy), km), 0, 0)
    # głowa szakala z polerowanego obsydianu (ujęcie 3/4, pysk w lewo)
    glowa_pts = [(560, 70), (650, 300), (700, 420), (690, 640), (470, 640), (400, 520), (235, 505), (200, 470),
                 (218, 440), (300, 410), (420, 330), (470, 300), (430, 100), (520, 280)]
    gm = _m(lambda d, s: d.polygon([(x * s, y * s) for x, y in glowa_pts], fill=255))
    ucho1 = _m(lambda d, s: d.polygon([(560 * s, 120 * s), (630 * s, 300 * s), (540 * s, 290 * s)], fill=255))
    ucho2 = _m(lambda d, s: d.polygon([(445 * s, 140 * s), (495 * s, 290 * s), (450 * s, 300 * s)], fill=255))
    zl_ucha = np.clip(_pas(np.maximum(ucho1, ucho2) * 0 + _w(B.dylatacja(np.maximum(ucho1, ucho2) > 0.5, 10)), 0, 10), 0, 1)
    oko = _m(lambda d, s: d.polygon([(400 * s, 400 * s), (470 * s, 380 * s), (490 * s, 405 * s), (420 * s, 418 * s)], fill=255))
    obw_oka = np.clip(_w(B.dylatacja(oko > 0.5, 8)) - oko, 0, 1)
    szczeka = _m(lambda d, s: d.line([(230 * s, 488 * s), (400 * s, 515 * s), (470 * s, 630 * s)], fill=255, width=int(10 * s)))
    B.nakladaj(out, B.wysrodkuj_rgba(B.zloty_napis(
        gm, faza=16, glebokosc=20, kontur=8, rodzaj="emalia", gra=G, kolor="#15121C", gradient=False,
        kontur_kolor="#05040A",
        wkladki=[(zl_ucha, "zloto", None, "okragly"), (np.maximum(ucho1, ucho2) * _w(B.erozja(np.maximum(ucho1, ucho2) > 0.5, 6)),
                                                       "emalia", "#3A2A10", "plaski"),
                 (obw_oka, "zloto", None, "okragly"), (oko, "swiecace", "#FFB030", "plaski"),
                 (_w(szczeka) * gm, "zloto", None, "okragly")]), gm), 0, 0)
    return B.wpasuj(out, S, S, WYP["wysokie"])


def s2_sym_faraon():
    out = B.plotno(S, S)
    # chusta nemes w pasy złota i lapisu: kopuła + opadające pasy po bokach
    def nemes(d, s):
        d.ellipse([290 * s, 100 * s, 734 * s, 560 * s], fill=255)
        d.polygon([(290 * s, 330 * s), (734 * s, 330 * s), (800 * s, 880 * s), (224 * s, 880 * s)], fill=255)
    nm = _m(nemes)
    yy = np.arange(S, dtype=np.float32)[:, None]
    paski = (np.sin(yy / S * 2 * math.pi * 13) > 0.1).astype(np.float32) * np.ones((1, S), np.float32)
    paski = B.rozmyj(paski, 1.5) * _w(B.erozja(nm > 0.5, 18))
    B.nakladaj(out, B.wysrodkuj_rgba(B.zloty_napis(nm, faza=14, glebokosc=18, kontur=8, gra=G, kontur_kolor="#0E2466",
                                                  wkladki=[(paski, "emalia", "#1B3FA0", "okragly")]), nm), 0, 0)
    # twarz — najjaśniejsze złoto w grze
    twarz = _m(lambda d, s: d.ellipse([370 * s, 270 * s, 654 * s, 690 * s], fill=255))
    oczy = _m(lambda d, s: [d.polygon([((512 + st * 70 - 50) * s, 440 * s), ((512 + st * 70) * s, 418 * s),
                                       ((512 + st * 70 + 55) * s, 440 * s), ((512 + st * 70) * s, 458 * s)], fill=255)
                            for st in (-1, 1)])
    linery = np.clip(_w(B.dylatacja(oczy > 0.5, 9)) - oczy, 0, 1)
    brwi = _m(lambda d, s: [d.line([((512 + st * 20) * s, 395 * s), ((512 + st * 125) * s, 395 * s)], fill=255, width=int(14 * s))
                            for st in (-1, 1)])
    zrenice = _m(lambda d, s: [d.ellipse([((512 + st * 70) - 16) * s, 422 * s, ((512 + st * 70) + 16) * s, 454 * s], fill=255)
                               for st in (-1, 1)])
    usta = _m(lambda d, s: d.chord([465 * s, 570 * s, 559 * s, 610 * s], 0, 180, fill=255))
    t_out = B.zloty_napis(twarz, faza=30, glebokosc=10, kontur=6, gra=G, wypuklosc=0.6,
                          wkladki=[(oczy, "emalia", "#F4EBD9", "plaski"), (zrenice * oczy, "emalia", "#0B0612", "plaski"),
                                   (linery, "emalia", "#0E2466", "okragly"), (_w(brwi), "emalia", "#0E2466", "okragly"),
                                   (usta, "emalia", "#7A3A10", "plaski")])
    t_out[..., :3] = np.clip(t_out[..., :3] * 1.1 + 0.03, 0, 1)
    B.nakladaj(out, B.wysrodkuj_rgba(t_out, twarz), 0, 0)
    # kobra ureusz na czole i pleciona broda
    kobra = _m(lambda d, s: (d.ellipse([482 * s, 200 * s, 542 * s, 300 * s], fill=255),
                             d.rectangle([500 * s, 270 * s, 524 * s, 340 * s], fill=255)))
    B.nakladaj(out, B.wysrodkuj_rgba(B.zloty_napis(kobra, faza=8, glebokosc=8, kontur=5, gra=G,
                                                  wkladki=[(_w(B.erozja(kobra > 0.5, 10)), "emalia", "#1B3FA0", "okragly")]),
                                    kobra), 0, 0)
    broda = _m(lambda d, s: d.rounded_rectangle([480 * s, 680 * s, 544 * s, 880 * s], radius=20 * s, fill=255))
    plot = (np.sin(yy / S * 2 * math.pi * 26) > 0.3).astype(np.float32) * np.ones((1, S)) * _w(B.erozja(broda > 0.5, 8))
    B.nakladaj(out, B.wysrodkuj_rgba(B.zloty_napis(broda, faza=10, glebokosc=12, kontur=5, gra=G,
                                                  wkladki=[(B.rozmyj(plot.astype(np.float32), 1), "emalia", "#1B3FA0", "okragly")]),
                                    broda), 0, 0)
    return B.wpasuj(out, S, S, WYP["wysokie"])


# ------------------------------------------------------------------------------------------------
# Specjalne: WILD (relikwia + tabliczka) i SCATTER (piramida + wiązka)
# ------------------------------------------------------------------------------------------------
def tabliczka(tekst, szer, wys, font="cinzeldeco900", kolor_pola="#1B3FA0", rodzaj_liter="zloto", gra=G,
              teczowe=False):
    """Tabliczka z lapisu (albo ametystu) w złotej ramce z napisem — WILD / SCATTER na symbolach specjalnych."""
    pm = B.maska_rysunku(szer, wys, lambda d, s: d.rounded_rectangle([0, 0, (szer - 1) * s, (wys - 1) * s],
                                                                       radius=wys * 0.22 * s, fill=255))
    pole = B.rozmyj(B.erozja(pm > 0.5, int(wys * 0.11)).astype(np.float32), 1)
    hp = B.wysokosc(pm, wys * 0.1, "okragly")
    n = B.normalne(hp, 1.2)
    rgb = B.material(n, "zloto", gra) * (1 - pole[..., None]) + B.material(n, "emalia", gra, kolor_pola) * pole[..., None]
    pl = np.concatenate([rgb, pm[..., None]], -1).astype(np.float32)
    pl = B.ekstruzja(pl, int(wys * 0.08), "zloto", gra)
    mt = B.wiersze_napisu([tekst], font, int(wys * 0.5), 0.06, 0)
    if mt.shape[1] > szer * 0.82:
        k = szer * 0.82 / mt.shape[1]
        mt = B.skaluj(B.z_maska(mt, "#FFFFFF"), int(mt.shape[1] * k))[..., 3]
    if teczowe:
        # kryształowe litery: tęczowa inkrustacja na całym licu (S3)
        tecz = B.tecza(mt.shape[0] + 2 * 9, mt.shape[1] + 2 * 9, ("#9C6BFF", "#21E6FF", "#FF8AD8", "#5CFFB0"), 0.5)
        napis = B.zloty_napis(mt, faza=5, glebokosc=5, kontur=3, rodzaj=rodzaj_liter, gra=gra, poswiata_r=6,
                              poswiata_kolor="#A64DFF", wkladki=[(mt, "emalia", tecz[9:-9, 9:-9], "skos")])
    else:
        napis = B.zloty_napis(mt, faza=5, glebokosc=6, kontur=3, rodzaj=rodzaj_liter, gra=gra, wypuklosc=0.2)
    return B.nakladaj_srodek(np.pad(pl, ((10, 10), (10, 10), (0, 0))), napis, pl.shape[1] / 2 + 10, pl.shape[0] / 2 + 6)


def s2_sym_wild():
    rel = B.przytnij_alfa(B.render("s2_relikwia"))
    rel = B.skaluj(rel, int(rel.shape[1] * 860 / rel.shape[0]), 860)
    out = B.plotno(S, S)
    B.nakladaj_srodek(out, B.poswiata(rel, 22, "gold2", 0.35), S / 2, S / 2 - 40)
    B.nakladaj_srodek(out, tabliczka("WILD", 640, 210), S / 2, S * 0.74)
    return B.wpasuj(out, S, S, WYP["specjalne"])


def s2_sym_scatter():
    pir = B.przytnij_alfa(B.render("s2_piramida"))
    pir = B.skaluj(pir, 900)
    out = B.plotno(S, S)
    py = S * 0.62
    B.nakladaj_srodek(out, pir, S / 2, py)
    # pionowa wiązka cyjanowo-białego światła z piramidionu, wygasa przed górnym marginesem
    apex_y = py - pir.shape[0] / 2 + 4
    yy, xx = np.mgrid[0:S, 0:S].astype(np.float32)
    t = np.clip((apex_y - yy) / apex_y, 0, 1)
    wiazka = (np.exp(-((xx - S / 2) / (8 + 26 * t)) ** 2) * (yy < apex_y) * B.smoothstep(1 - t, 0.12, 0.5))
    halo = np.exp(-((xx - S / 2) / (60 + 50 * t)) ** 2) * (yy < apex_y + 10) * B.smoothstep(1 - t, 0.1, 0.6) * 0.45
    swiatlo = np.clip(wiazka + halo, 0, 1)
    warstwa = np.zeros((S, S, 4), np.float32)
    warstwa[..., :3] = np.array([0.75, 0.97, 1.0]) * (0.6 + 0.4 * wiazka[..., None])
    warstwa[..., 3] = swiatlo
    B.nakladaj(out, warstwa, 0, 0, tryb="screen")
    # turkusowe oko na ścianie piramidy
    oko = B.maska_rysunku(160, 80, lambda d, s: d.ellipse([4 * s, 14 * s, 156 * s, 66 * s], fill=255))
    zren = B.maska_rysunku(160, 80, lambda d, s: d.ellipse([58 * s, 18 * s, 102 * s, 62 * s], fill=255))
    o = B.z_maska(np.maximum(oko - zren * 0.6, 0), "#7FF7EE")
    B.nakladaj_srodek(out, B.poswiata(o, 10, "#2EC4B6", 1.0), S / 2, py + pir.shape[0] * 0.08)
    B.nakladaj_srodek(out, tabliczka("SCATTER", 760, 170), S / 2, S * 0.86)
    return B.wpasuj(out, S, S, WYP["specjalne"])


# ------------------------------------------------------------------------------------------------
# Ramka 5×3 (3:2)
# ------------------------------------------------------------------------------------------------
def s2_ramka():
    W, H = 1536, 1024
    ox0, oy0, ox1, oy1 = 153, 143, 1383, 881            # okno 1230×738 (5:3)
    rama = B.maska_rysunku(W, H, lambda d, s: (d.rectangle([24 * s, 30 * s, (W - 24) * s, (H - 30) * s], fill=255),
                                               d.rectangle([ox0 * s, oy0 * s, ox1 * s, oy1 * s], fill=0)))
    hr = B.wysokosc(rama, 26, "okragly")
    kam = B.szum(H, W, 18, 4, 5)
    n = B.normalne(hr + kam * 3, 1.0)
    rgb = B.material(n, "kamien", G, "#A88A68") * (0.7 + 0.35 * kam[..., None])
    rgb = rgb * B.gradient_pionowy(H, W, [(0, "#FFFFFF"), (1, "#8A7A70")])        # ciemniej ku dołowi
    out = np.concatenate([rgb, rama[..., None]], -1).astype(np.float32)
    # kolumny: pasy lapisu i turkusu + kapitele lotosu
    for x0, x1 in ((40, 137), (W - 137, W - 40)):
        for j, (y, kol) in enumerate(((300, "#1B3FA0"), (340, "#2EC4B6"), (620, "#1B3FA0"), (660, "#2EC4B6"))):
            pm = B.maska_rysunku(W, H, lambda d, s, y=y, x0=x0, x1=x1: d.rectangle([x0 * s, y * s, x1 * s, (y + 26) * s], fill=255))
            B.nakladaj(out, B.relief(pm, "emalia", 5, G, kol))
        kap = B.maska_rysunku(W, H, lambda d, s, x0=x0, x1=x1: d.polygon(
            [((x0 - 12) * s, 150 * s), ((x1 + 12) * s, 150 * s), ((x1 - 8) * s, 215 * s), ((x0 + 8) * s, 215 * s)], fill=255))
        B.nakladaj(out, B.relief(kap, "zloto", 10, G))
    # nadproże: złoty płaski pas na logo + skrzydła po bokach
    pas = B.maska_rysunku(W, H, lambda d, s: d.rectangle([420 * s, 48 * s, 1116 * s, 125 * s], fill=255))
    B.nakladaj(out, B.relief(pas, "zloto_satyna", 10, G))
    from gen_napisy import skrzydlaty_dysk
    sk = skrzydlaty_dysk(620)
    for strona in (-1, 1):
        polowa = sk[:, :sk.shape[1] // 2] if strona < 0 else sk[:, sk.shape[1] // 2:]
        B.nakladaj_srodek(out, polowa, W / 2 + strona * 470, 88)
    # cokół: pas hieroglificzny i złota listwa
    znaki = B.maska_rysunku(W, H, lambda d, s: [
        d.ellipse([(x - 10) * s, 930 * s, (x + 10) * s, 950 * s], fill=255) if (x // 40) % 3 == 0 else
        d.rectangle([(x - 5) * s, 922 * s, (x + 5) * s, 958 * s], fill=255) if (x // 40) % 3 == 1 else
        d.polygon([((x - 12) * s, 958 * s), (x * s, 922 * s), ((x + 12) * s, 958 * s)], fill=255)
        for x in range(220, 1320, 40)])
    B.nakladaj(out, B.relief(znaki, "zloto", 3, G))
    listwa = B.maska_rysunku(W, H, lambda d, s: d.rectangle([140 * s, 975 * s, (W - 140) * s, 985 * s], fill=255))
    B.nakladaj(out, B.relief(listwa, "zloto", 4, G))
    # krawędź okna: złota listwa perełkowa z inkrustacją lapisu
    kr = np.clip(B.maska_rysunku(W, H, lambda d, s: d.rectangle([(ox0 - 22) * s, (oy0 - 22) * s, (ox1 + 22) * s,
                                                                   (oy1 + 22) * s], fill=255))
                 - B.maska_rysunku(W, H, lambda d, s: d.rectangle([ox0 * s, oy0 * s, ox1 * s, oy1 * s], fill=255)), 0, 1)
    lapis = np.clip(B.maska_rysunku(W, H, lambda d, s: d.rectangle([(ox0 - 13) * s, (oy0 - 13) * s, (ox1 + 13) * s,
                                                                      (oy1 + 13) * s], fill=255))
                    - B.maska_rysunku(W, H, lambda d, s: d.rectangle([(ox0 - 7) * s, (oy0 - 7) * s, (ox1 + 7) * s,
                                                                        (oy1 + 7) * s], fill=255)), 0, 1)
    hk = B.wysokosc(kr, 8, "okragly")
    nk = B.normalne(hk, 1.2)
    rgbk = B.material(nk, "zloto", G) * (1 - lapis[..., None]) + B.material(nk, "emalia", G, "#1B3FA0") * lapis[..., None]
    B.nakladaj(out, np.concatenate([rgbk, kr[..., None]], -1).astype(np.float32))
    # narożne kartusze
    for (cx, cy) in ((88, 88), (W - 88, 88), (88, H - 88), (W - 88, H - 88)):
        km = B.maska_rysunku(110, 70, lambda d, s: d.rounded_rectangle([4 * s, 4 * s, 106 * s, 66 * s], radius=30 * s, fill=255))
        B.nakladaj_srodek(out, B.zloty_napis(km, faza=6, glebokosc=5, kontur=3, gra=G,
                                             wkladki=[(B.rozmyj(B.erozja(km > 0.5, 12).astype(np.float32), 1), "emalia",
                                                       "#2EC4B6", "okragly")]), cx, cy)
    out[oy0:oy1, ox0:ox1, 3] = 0.0
    return out


GENERATORY = {
    "s2_sym_10": lambda: _litera("10", "#2EC4B6"),
    "s2_sym_j": lambda: _litera("J", "#1FA35B"),
    "s2_sym_q": lambda: _litera("Q", "#C8321E"),
    "s2_sym_k": lambda: _litera("K", "#2649C9"),
    "s2_sym_a": lambda: _litera("A", "#8E4BD8"),
    "s2_sym_ankh": s2_sym_ankh, "s2_sym_oko": s2_sym_oko, "s2_sym_skarabeusz": s2_sym_skarabeusz,
    "s2_sym_anubis": s2_sym_anubis, "s2_sym_faraon": s2_sym_faraon,
    "s2_sym_wild": s2_sym_wild, "s2_sym_scatter": s2_sym_scatter, "s2_ramka": s2_ramka,
}
