#!/usr/bin/env python3
"""
test_przetworz.py — testy odporności pipeline'u na typowe wady obrazów z ChatGPT (02 § 5.23).

Po co to jest: na obronie pada pytanie „skąd wiecie, że wykrywanie okna / szachownicy działa?”. Odpowiedź:
syntetyczne obrazy o ZNANYM wyniku (wiemy, jaka powinna być alfa, gdzie jest okno, ile ma być elementów)
i automatyczne porównanie. Testy nie potrzebują pytesta — wystarczy:

    python3 tools/art/testy/test_przetworz.py [katalog_na_obrazy_testowe]

(działają też pod ``pytest``). Obrazy wejściowe i wyniki zostają w podanym katalogu, żeby można je obejrzeć.
"""

from __future__ import annotations

import json
import sys
import tempfile
import time
import traceback
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

KAT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(KAT))

from kroki import alfa, arkusze, geometria, skala  # noqa: E402
from kroki.obraz import Skladowe, wczytaj_rgba  # noqa: E402

WYNIKI = Path(sys.argv[1]) if len(sys.argv) > 1 and not sys.argv[1].startswith("-") else \
    Path(tempfile.mkdtemp(prefix="test_art_"))
WYNIKI.mkdir(parents=True, exist_ok=True)


def zapisz(nazwa: str, obraz) -> Path:
    p = WYNIKI / nazwa
    if isinstance(obraz, np.ndarray):
        obraz = Image.fromarray(np.clip(obraz * 255 + 0.5, 0, 255).astype(np.uint8))
    obraz.save(p)
    return p


# ------------------------------------------------------------------------------------------------
# Generatory obrazów testowych
# ------------------------------------------------------------------------------------------------
def obiekt_ze_znana_alfa(n=1024, ss=4):
    """Złote koło z gradientem, białym odblaskiem i „uchem” (dziura w środku uchwytu) — z dokładną alfą
    policzoną przez nadpróbkowanie (ss×ss próbek na piksel)."""
    N = n * ss
    m = Image.new("L", (N, N), 0)
    d = ImageDraw.Draw(m)
    d.ellipse([N * 0.22, N * 0.30, N * 0.78, N * 0.86], fill=255)
    d.ellipse([N * 0.40, N * 0.10, N * 0.60, N * 0.36], fill=255)       # uchwyt
    d.ellipse([N * 0.455, N * 0.165, N * 0.545, N * 0.30], fill=0)      # dziura w uchwycie
    alfa_gt = np.asarray(m.resize((n, n), Image.Resampling.BOX), dtype=np.float32) / 255
    yy, xx = np.mgrid[0:n, 0:n] / n
    r = np.clip(0.95 - 0.5 * yy, 0, 1)
    rgb = np.stack([0.96 * r + 0.04, 0.77 * r, 0.26 * r], -1).astype(np.float32)
    odblask = np.exp(-(((xx - 0.38) / 0.06) ** 2 + ((yy - 0.45) / 0.04) ** 2))
    rgb = rgb + (1 - rgb) * odblask[..., None]
    return rgb, alfa_gt


def szachownica(n, pole, c1=(1.0, 1.0, 1.0), c2=(0.8, 0.8, 0.8), faza=(0, 0)):
    yy, xx = np.mgrid[0:n, 0:n]
    k = ((np.floor((xx + faza[0]) / pole) + np.floor((yy + faza[1]) / pole)) % 2)[..., None]
    return np.where(k == 0, np.array(c1, np.float32), np.array(c2, np.float32)).astype(np.float32)


def blad_alfy(wynik_a, gt_a):
    """Średni błąd alfy na krawędzi (piksele 0 < α_gt < 1) i maks. α tam, gdzie powinno być tło."""
    kraw = (gt_a > 0.02) & (gt_a < 0.98)
    tlo = gt_a == 0
    return float(np.abs(wynik_a[kraw] - gt_a[kraw]).mean()), float(wynik_a[tlo].max())


# ------------------------------------------------------------------------------------------------
# Testy
# ------------------------------------------------------------------------------------------------
def test_szachownica_calkowita():
    rgb, a = obiekt_ze_znana_alfa()
    B = szachownica(1024, 24)
    I = rgb * a[..., None] + B * (1 - a[..., None])
    wej = np.concatenate([I, np.ones_like(a)[..., None]], -1)
    zapisz("wej_szachownica_24.png", wej)
    w = alfa.napraw_alfe(wej, "obiekt")
    zapisz("wyn_szachownica_24.png", w.rgba)
    sr, maks_tla = blad_alfy(w.rgba[..., 3], a)
    print(f"    metoda={w.metoda} pewność={w.pewnosc:.2f} błąd alfy krawędzi={sr * 255:.2f}/255 maks α tła={maks_tla:.3f}")
    assert w.metoda == "szachownica"
    assert sr * 255 < 8, "zbyt duży błąd alfy na krawędzi"
    assert maks_tla < 0.03, "resztki szachownicy w tle"
    assert w.rgba[200:260, 490:510, 3].max() < 0.05, "dziura w uchwycie nie została usunięta"


def test_szachownica_ulamkowa_i_rozmyta():
    """Generator przeskalował wzór (pole 23,6 px) i lekko go rozmył — wykrycie okresu statystyką kołową."""
    rgb, a = obiekt_ze_znana_alfa()
    B = szachownica(2048, 47.2, (0.93, 0.93, 0.93), (0.70, 0.70, 0.70), faza=(11, 5))
    B = np.asarray(Image.fromarray((B * 255).astype(np.uint8)).resize((1024, 1024), Image.Resampling.BILINEAR)
                   .filter(ImageFilter.GaussianBlur(0.6)), dtype=np.float32) / 255
    I = rgb * a[..., None] + B * (1 - a[..., None])
    I = np.clip(I + np.random.default_rng(1).normal(0, 1.2 / 255, I.shape), 0, 1)     # szum jak po JPEG
    wej = np.concatenate([I, np.ones_like(a)[..., None]], -1).astype(np.float32)
    zapisz("wej_szachownica_ulamkowa.png", wej)
    w = alfa.napraw_alfe(wej, "obiekt")
    zapisz("wyn_szachownica_ulamkowa.png", w.rgba)
    sr, maks_tla = blad_alfy(w.rgba[..., 3], a)
    print(f"    metoda={w.metoda} pewność={w.pewnosc:.2f} błąd alfy krawędzi={sr * 255:.2f}/255 maks α tła={maks_tla:.3f}")
    assert w.metoda == "szachownica"
    assert sr * 255 < 14
    assert maks_tla < 0.08


def test_zielone_tlo_z_dziura():
    rgb, a = obiekt_ze_znana_alfa()
    B = np.broadcast_to(np.array([0, 1, 0], np.float32), rgb.shape)
    I = rgb * a[..., None] + B * (1 - a[..., None])
    wej = np.concatenate([I, np.ones_like(a)[..., None]], -1).astype(np.float32)
    zapisz("wej_zielone.png", wej)
    w = alfa.napraw_alfe(wej, "obiekt")
    zapisz("wyn_zielone.png", w.rgba)
    sr, maks_tla = blad_alfy(w.rgba[..., 3], a)
    kraw = (w.rgba[..., 3] > 0.05) & (w.rgba[..., 3] < 0.95)
    przebarwienie = float(np.maximum(0, w.rgba[..., 1] - w.rgba[..., [0, 2]].max(-1))[kraw].mean())
    print(f"    metoda={w.metoda} błąd alfy={sr * 255:.2f}/255 maks α tła={maks_tla:.3f} zieleń na krawędzi={przebarwienie:.3f}")
    assert w.metoda == "jednolite"
    assert maks_tla < 0.03
    assert sr * 255 < 25
    assert przebarwienie < 0.08, "zielona obwódka"
    assert w.rgba[200:260, 490:510, 3].max() < 0.05, "zielona dziura w uchwycie została"


def test_biale_tlo_odblask_nietkniety():
    rgb, a = obiekt_ze_znana_alfa()
    I = rgb * a[..., None] + 1.0 * (1 - a[..., None])
    wej = np.concatenate([I, np.ones_like(a)[..., None]], -1).astype(np.float32)
    zapisz("wej_biale.png", wej)
    w = alfa.napraw_alfe(wej, "obiekt")
    zapisz("wyn_biale.png", w.rgba)
    odblask = w.rgba[455:467, 380:400, 3]
    print(f"    metoda={w.metoda} min α odblasku={odblask.min():.3f}")
    assert w.metoda == "jednolite"
    assert odblask.min() > 0.97, "biały odblask na złocie stał się przezroczysty"


def test_arkusz_nierowna_siatka():
    """12 kolorowych plam w siatce 4×3 z przesunięciami do ±70 px; jedna plama rozbita na dwie części."""
    rng = np.random.default_rng(7)
    im = Image.new("RGBA", (1536, 1024), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    kolory = []
    for r in range(3):
        for c in range(4):
            cx = 192 + c * 384 + rng.integers(-70, 70)
            cy = 170 + r * 341 + rng.integers(-50, 50)
            kol = (40 + 18 * (r * 4 + c), 200 - 12 * (r * 4 + c), 120, 255)
            kolory.append(kol[:3])
            rr = 90 + rng.integers(-20, 30)
            if r == 1 and c == 2:          # rozbity element: dwie połówki z przerwą 8 px
                d.pieslice([cx - rr, cy - rr, cx + rr, cy + rr], 90, 270, fill=kol)
                d.pieslice([cx - rr + 8, cy - rr, cx + rr + 8, cy + rr], 270, 90, fill=kol)
            else:
                d.rounded_rectangle([cx - rr, cy - rr * 0.8, cx + rr, cy + rr * 0.8], radius=30, fill=kol)
    zapisz("wej_arkusz.png", im)
    rgba = np.asarray(im, dtype=np.float32) / 255
    uw = []
    el = arkusze.tnij(rgba, (4, 3), 12, False, uw)
    assert all(e is not None for e in el), uw
    for i, e in enumerate(el):
        sr = rgba[e.y0:e.y1, e.x0:e.x1][e.maska][:, :3].mean(0) * 255
        assert np.abs(sr - np.array(kolory[i])).max() < 3, f"zła kolejność komórek (komórka {i})"
    print(f"    12/12 elementów w dobrej kolejności, uwagi: {[u[2] for u in uw]}")


def test_arkusz_cyfr_puste_pola():
    im = Image.new("RGBA", (1536, 1024), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    for i in range(13):
        r, c = divmod(i, 5)
        x, y = 150 + c * 307, 90 + r * 341
        if i == 10:
            d.rectangle([x + 40, y + 160, x + 70, y + 230], fill=(250, 200, 60, 255))        # przecinek
        else:
            d.rectangle([x, y, x + 110 + (i % 3) * 10, y + 200], fill=(250, 200, 60, 255))
    rgba = np.asarray(im, dtype=np.float32) / 255
    uw = []
    el = arkusze.tnij(rgba, (5, 3), 13, False, uw)
    assert el[13] is None and el[14] is None and el[10] is not None, "puste pola cyfr"
    met = arkusze.metryki_cyfr(el[:13], [str(i) for i in range(10)] + ["przecinek", "plus", "razy"], uw)
    assert abs(met["H"] - 201) <= 2
    print(f"    13 glifów + 2 puste pola, wysokość cyfr {met['H']:.0f} px")


def ramka_testowa(tlo="alfa"):
    """Ramka 1024² z oknem 300×200 w (100, 120) — dokładnie znane okno (test z 02 § 5.23)."""
    im = Image.new("RGBA", (1024, 1024), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle([40, 50, 460, 380], radius=24, fill=(190, 195, 210, 255))
    d.rounded_rectangle([60, 70, 440, 360], radius=12, fill=(245, 197, 66, 255))
    d.rectangle([100, 120, 399, 319], fill=(0, 0, 0, 0))
    d.ellipse([225, 95, 275, 140], fill=(255, 46, 136, 255))       # ornament wchodzący w okno
    rgba = np.asarray(im, dtype=np.float32) / 255
    if tlo == "szachownica":
        B = szachownica(1024, 24)
        a = rgba[..., 3:4]
        rgba = np.concatenate([rgba[..., :3] * a + B * (1 - a), np.ones_like(a)], -1)
    return rgba


def test_okno_ramki():
    for tlo in ("alfa", "szachownica"):
        rgba = ramka_testowa(tlo)
        zapisz(f"wej_ramka_{tlo}.png", rgba)
        uw = []
        if tlo != "alfa":
            rgba = alfa.napraw_alfe(rgba, "ramka").rgba
            zapisz(f"wyn_ramka_{tlo}.png", rgba)
        okno = geometria.wykryj_okno(rgba, uw)
        print(f"    tło={tlo}: okno={okno} uwagi={[u[2] for u in uw]}")
        assert okno is not None
        x0, y0, x1, y1 = okno
        assert abs(x0 - 100) <= 1 and abs(y0 - 120) <= 1 and abs(x1 - 400) <= 1 and abs(y1 - 320) <= 1


def test_okno_zamalowane():
    rgba = ramka_testowa()
    rgba[120:320, 100:400] = [0.07, 0.04, 0.16, 1.0]     # generator narysował ciemne szkło
    uw = []
    okno = geometria.wykryj_okno(rgba, uw)
    print(f"    okno={okno} uwagi={[u[2] for u in uw]}")
    assert okno is not None and abs(okno[0] - 100) <= 2 and abs(okno[3] - 320) <= 2


def test_9slice():
    """Panel 600×400 z ornamentem w rogach 80 px i jednolitym środkiem → wycinki 82 ± 2 px."""
    im = Image.new("RGBA", (600, 400), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.rectangle([0, 0, 599, 399], fill=(245, 197, 66, 255))
    d.rectangle([12, 12, 587, 387], fill=(30, 20, 66, 230))
    for (x, y) in ((0, 0), (520, 0), (0, 320), (520, 320)):
        d.ellipse([x + 4, y + 4, x + 76, y + 76], fill=(255, 224, 138, 255))
        d.ellipse([x + 24, y + 24, x + 56, y + 56], fill=(184, 134, 11, 255))
    zapisz("wej_9slice.png", im)
    rgba = np.asarray(im, dtype=np.float32) / 255
    uw = []
    m = geometria.marginesy_9slice(rgba, False, uw)
    px = {k: v * (600 if k in ("left", "right") else 400) for k, v in m.items()}
    print(f"    wycinki px: {px}")
    for v in px.values():
        assert abs(v - 82) <= 2


def test_9slice_pigulka():
    im = Image.new("RGBA", (1300, 340), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    for i in range(170):
        t = i / 170
        kol = (int(255 - 70 * t), int(224 - 90 * t), int(138 - 127 * t), 255)
        d.rounded_rectangle([i * 0.0, i, 1299, 339 - i], radius=170 - i, outline=kol) if False else None
    d.rounded_rectangle([0, 0, 1299, 339], radius=170, fill=(245, 197, 66, 255))
    for y in range(20, 320):
        d.line([170, y, 1130, y], fill=(int(255 - 0.25 * y), int(224 - 0.3 * y), 80, 255))
    rgba = np.asarray(im, dtype=np.float32) / 255
    uw = []
    m = geometria.marginesy_9slice(rgba, True, uw)
    print(f"    pigułka: {m}")
    assert m["left"] * 1300 >= 168 and m["top"] * 340 >= 160 and not [u for u in uw if u[0] == "blad"]


def test_skalowanie_liniowe():
    """Biała linia 1 px na czerni, zmniejszenie ×0,5: w świetle liniowym jasność ≥ 70% (w gamma ok. 50%)."""
    img = np.zeros((64, 64, 4), np.float32)
    img[..., 3] = 1
    img[:, 31, :3] = 1
    out = skala.skaluj(img, 32, 32, wyostrz=False)
    jas = float(out[:, 15:17, 0].max())
    naiwnie = np.asarray(Image.fromarray((img[..., :3] * 255).astype(np.uint8)).resize((32, 32), Image.Resampling.LANCZOS))
    jas_gamma = float(naiwnie[:, 15:17, 0].max()) / 255
    print(f"    jasność linii po zmniejszeniu: liniowo {jas:.2f}, w gamma {jas_gamma:.2f}")
    assert jas >= 0.68 and jas > jas_gamma + 0.1


def test_skladowe():
    m = np.zeros((50, 60), bool)
    m[5:10, 5:10] = True
    m[10, 10] = True          # styk po skosie → ta sama składowa (8-spójność)
    m[11:15, 11:15] = True
    m[30:40, 0:5] = True      # dotyka brzegu
    sk = Skladowe(m)
    assert sk.n == 2 and sorted(sk.pole[1:].tolist()) == [42, 50] and sk.brzeg.sum() == 1


# ------------------------------------------------------------------------------------------------
# Dalsze typowe wady obrazów z ChatGPT (dopisane po recenzji pipeline'u)
# ------------------------------------------------------------------------------------------------
def test_ramka_alfa_do_krawedzi():
    """Ramka z PRAWDZIWĄ alfą narysowana od brzegu do brzegu płótna: pas brzegowy jest kryjący, ale obraz ma
    przezroczyste okno — to nadal prawdziwa alfa (wcześniej złota rama była wycinana jako „jednolite tło”)."""
    im = Image.new("RGBA", (1024, 1024), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.rectangle([0, 0, 1023, 1023], fill=(200, 160, 60, 255))
    d.rectangle([150, 150, 873, 873], fill=(0, 0, 0, 0))
    w = alfa.napraw_alfe(np.asarray(im, np.float32) / 255, "ramka")
    uw = []
    okno = geometria.wykryj_okno(w.rgba, uw)
    print(f"    metoda={w.metoda} okno={okno}")
    assert w.metoda == "alfa" and okno == (150, 150, 874, 874)


def test_dziura_na_bialym_i_czarnym_tle():
    """Dziura w uchwycie (≈ 1% kadru) na białym i prawie czarnym, zaszumionym tle musi stać się przezroczysta
    (pętla anchu, przestrzeń między ogonkami wiśni) — wcześniej zostawała kryjącą plamą koloru tła."""
    rgb, a = obiekt_ze_znana_alfa()
    szum = np.random.default_rng(3).normal(0, 1.5 / 255, rgb.shape)
    for nazwa, kolor, n in (("biale", 1.0, 0.0), ("czarne", 6 / 255, 1.0)):
        I = np.clip(rgb * a[..., None] + kolor * (1 - a[..., None]) + szum * n, 0, 1)
        w = alfa.napraw_alfe(np.concatenate([I, np.ones_like(a)[..., None]], -1).astype(np.float32), "obiekt")
        sr, maks_tla = blad_alfy(w.rgba[..., 3], a)
        print(f"    {nazwa}: błąd krawędzi {sr * 255:.1f}/255, maks α tła {maks_tla:.3f}")
        assert maks_tla < 0.05 and sr * 255 < 8
        assert any(u[1] == "Q06" and "dziury" in u[2] for u in w.uwagi), "brak informacji o wyciętej dziurze"


def test_okno_ramki_z_szachownica():
    """Prawdziwa alfa na zewnątrz ramki, ale w oknie generator narysował szachownicę."""
    rgba = ramka_testowa()
    rgba[120:320, 100:400, :3] = szachownica(1024, 20)[120:320, 100:400]
    rgba[120:320, 100:400, 3] = 1
    w = alfa.napraw_alfe(rgba, "ramka")
    uw = []
    okno = geometria.wykryj_okno(w.rgba, uw)
    print(f"    okno={okno} uwagi={[u[2] for u in uw]}")
    assert okno is not None and abs(okno[0] - 100) <= 2 and abs(okno[2] - 400) <= 2 and abs(okno[3] - 320) <= 2


def test_arkusz_z_podpisami():
    """ChatGPT dopisał nazwy pod ikonami — podpisy są pomijane, a ikony mają swój własny rozmiar."""
    from PIL import ImageFont
    im = Image.new("RGBA", (1536, 1024), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    f = ImageFont.load_default(size=28)
    for r in range(3):
        for c in range(4):
            cx, cy = 192 + c * 384, 150 + r * 341
            d.ellipse([cx - 110, cy - 110, cx + 110, cy + 110], fill=(245, 197, 66, 255))
            d.text((cx - 50, cy + 130), "ikona", fill=(255, 255, 255, 255), font=f)
    uw = []
    el = arkusze.tnij(np.asarray(im, np.float32) / 255, (4, 3), 12, False, uw)
    rozm = {(e.x1 - e.x0, e.y1 - e.y0) for e in el}
    print(f"    rozmiary elementów: {rozm}, uwagi: {[u[2][:50] for u in uw]}")
    assert rozm == {(221, 221)} and any(u[0] == "ostrzezenie" and u[1] == "Q13" for u in uw)


def test_nieznane_nazwy_plikow():
    """Q02: literówki i „przeróbki” nazw przy pobieraniu dostają podpowiedź zamiast cichego pominięcia."""
    import przetworz
    kat = WYNIKI / "zrodla_q02"
    for f in ("s1/s1_sym_wisnia.png", "s1/S1-SYM-WILD (1).png", "global/s1_sym_bar.png", "s1/s1_sym_bar.v2.png",
              "s2/s2_sym_a.png.png", "makiety/m01_lobby_desktop.png", "s3/README.md"):
        p = kat / f
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_bytes(b"x")
    kom = przetworz.nieznane_pliki(kat)
    for k in kom:
        print(f"    {k}")
    tekst = "\n".join(kom)
    assert len(kom) == 4, "poprawne pliki, makiety i README nie mogą być zgłaszane"
    assert "s1_sym_wisnie.png" in tekst and "czy chodzi o: s1_sym_wild.png" in tekst
    assert "przenieś do art/zrodla/s1/s1_sym_bar.png" in tekst and "czy chodzi o: s2_sym_a.png" in tekst


def test_typ_pliku_i_tryby_obrazu():
    """Q04: JPEG jako obraz ALFA → ostrzeżenie; wczytywanie trybów P (paleta), LA i 16-bit szarości."""
    import przetworz
    import katalog
    p = WYNIKI / "s1_sym_wild.png"
    Image.new("RGB", (64, 64), (255, 255, 255)).save(p, "JPEG")      # JPEG z rozszerzeniem .png
    uw = []
    przetworz.sprawdz_typ_pliku(katalog.PO_ID["s1_sym_wild"], p, uw)
    assert uw and uw[0][1] == "Q04" and uw[0][0] == "ostrzezenie"
    kolo = Image.new("RGBA", (64, 64), (0, 0, 0, 0))
    ImageDraw.Draw(kolo).ellipse([16, 16, 48, 48], fill=(250, 200, 50, 255))
    kolo.convert("P", palette=Image.Palette.ADAPTIVE).save(WYNIKI / "paleta.png", transparency=0)
    kolo.convert("LA").save(WYNIKI / "la.png")
    Image.fromarray((np.linspace(0, 65535, 64 * 64).reshape(64, 64)).astype(np.uint16)).save(WYNIKI / "szary16.png")
    for nazwa in ("paleta.png", "la.png"):
        r = wczytaj_rgba(WYNIKI / nazwa)
        assert r[0, 0, 3] == 0 and r[32, 32, 3] == 1, nazwa
    s16 = wczytaj_rgba(WYNIKI / "szary16.png")
    assert s16[0, 0, 0] < 0.01 and s16[-1, -1, 0] > 0.98 and 0.4 < s16[32, 0, 0] < 0.6, "16-bit: zła skala jasności"
    print("    JPEG → Q04, tryby P / LA / 16-bit wczytane poprawnie")


def test_fx_szum_i_przezroczystosc():
    """Efekt CZARNE: tło z szumem (~4/255) staje się czystą czernią z zerową krawędzią; efekt oddany z kanałem
    alfa (zamiast czerni) jest spłaszczany na czerń z ostrzeżeniem Q11."""
    from kroki import fx
    yy, xx = np.mgrid[0:512, 0:512] / 512
    g = np.exp(-(((xx - .5) ** 2 + (yy - .5) ** 2) / 0.01))[..., None] * np.ones(3)
    I = np.clip(g + 4 / 255 + np.random.default_rng(5).normal(0, 2 / 255, g.shape), 0, 1)
    uw = []
    out = fx.przygotuj_fx(np.concatenate([I, np.ones_like(I[..., :1])], -1).astype(np.float32), uw, srodek=True)
    brzeg = max(out[0, :, :3].max(), out[-1, :, :3].max(), out[:, 0, :3].max(), out[:, -1, :3].max())
    assert brzeg * 255 < 0.5 and np.median(out[..., :3]) * 255 < 3 and not any(u[0] == "blad" for u in uw)
    uw = []
    out = fx.przygotuj_fx(np.concatenate([np.ones_like(g), g[..., :1]], -1).astype(np.float32), uw)
    assert out[256, 256, :3].min() > 0.95 and out[5, 5, :3].max() < 0.01 and any(u[1] == "Q11" for u in uw)
    print(f"    krawędź efektu {brzeg * 255:.2f}/255; alfa → czerń z ostrzeżeniem Q11")


def test_korekta_proporcji_okna():
    """Okno 300×200 dla siatki 3×3: pipeline rozciąga NAJBARDZIEJ jednolity pas boków ramki, omijając „wajchę”
    przy prawej krawędzi (S1 z ChatGPT ma wajchę automatu na boku) — ornament nie może się rozciągnąć."""
    rgba = ramka_testowa()
    im = Image.fromarray((rgba * 255).astype(np.uint8))
    d = ImageDraw.Draw(im)
    d.ellipse([468, 130, 498, 160], fill=(255, 220, 90, 255))          # gałka wajchy (koło 30 px) za prawym bokiem
    d.rectangle([462, 140, 486, 230], fill=(220, 180, 60, 255))         # ramię wajchy (styka się z ramą)
    rgba = np.asarray(im, dtype=np.float32) / 255
    img, prost, _ = alfa.przytnij(rgba, margines_proc=0, min_px=2)
    uw = []
    okno = geometria.wykryj_okno(img, uw)
    nowa, okno2 = geometria.dopasuj_proporcje_okna(img, okno, (3, 3), uw)
    x0, y0, x1, y1 = okno2
    gal = nowa[..., 3] > 0.5
    kol = gal[:, 494 - (prost[0] - 2)]                                 # pionowa linia przez gałkę (obok ramienia)
    ys = np.flatnonzero(kol)
    print(f"    okno {okno} → {okno2}, ramka {img.shape[:2]} → {nowa.shape[:2]}; {[u[2][:60] for u in uw]}")
    assert abs((x1 - x0) - (y1 - y0)) <= 1 and nowa.shape[0] - img.shape[0] == 100
    assert any(u[1] == "Q15" for u in uw)
    # gałka nierozciągnięta: cięciwa koła r = 15 px w odległości 11 px od środka ma 2·√(15² − 11²) ≈ 20 px
    biegi = np.split(ys, np.flatnonzero(np.diff(ys) > 1) + 1)
    assert len(biegi) == 1 and 18 <= len(biegi[0]) <= 24, [len(b) for b in biegi]


def test_9slice_z_faktura_i_odblaskami():
    """Panel jak z ChatGPT: środek z szumem i winietą, listwy z miękkimi odblaskami, ornamenty w rogach 200 px.
    Wcześniej każdy taki panel kończył się błędem Q16 (wymóg identycznych kolumn)."""
    n = 1000
    im = Image.new("RGBA", (n, n), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.rectangle([0, 0, n - 1, n - 1], fill=(245, 197, 66, 255))
    d.rectangle([40, 40, n - 41, n - 41], fill=(30, 20, 66, 255))
    for (x, y) in ((0, 0), (n - 200, 0), (0, n - 200), (n - 200, n - 200)):
        d.ellipse([x + 10, y + 10, x + 190, y + 190], fill=(255, 224, 138, 255))
        d.ellipse([x + 60, y + 60, x + 140, y + 140], fill=(184, 134, 11, 255))
    p = np.asarray(im, dtype=np.float32) / 255
    yy, xx = np.mgrid[0:n, 0:n] / n
    p[..., :3] *= (1 - 0.08 * ((xx - .5) ** 2 + (yy - .5) ** 2) * 4)[..., None]          # winieta
    p[..., :3] += np.random.default_rng(2).normal(0, 3 / 255, p[..., :3].shape)          # faktura
    for cx in (330, 640):                                                                 # odblaski na listwach
        g = np.exp(-((xx * n - cx) / 40) ** 2)
        for y0 in (0, n - 40):
            p[y0:y0 + 40, :, :3] += 0.4 * g[y0:y0 + 40, :, None]
    p = np.clip(p, 0, 1).astype(np.float32)
    uw = []
    m = geometria.marginesy_9slice(p, False, uw)
    px = {k: round(v * n) for k, v in m.items()}
    print(f"    wycinki px: {px}, uwagi: {uw}")
    assert not uw and all(190 <= v <= 240 for v in px.values())


def test_arkusz_stykajace_sie_elementy():
    """Elementy ustawione bliżej niż promień domknięcia (awatary ChatGPT w wierszu prawie się stykają):
    pipeline zmniejsza promień zamiast sklejać cały wiersz w jedną plamę i iść w plan awaryjny."""
    im = Image.new("RGBA", (1536, 1024), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    for r in range(2):
        for c in range(4):
            cx, cy = 192 + c * 384, 256 + r * 512
            d.ellipse([cx - 186, cy - 186, cx + 186, cy + 186], fill=(120 + 15 * c, 80, 200 - 20 * r, 255))  # odstęp 12 px
    uw = []
    el = arkusze.tnij(np.asarray(im, np.float32) / 255, (4, 2), 8, False, uw)
    print(f"    {sum(e is not None for e in el)} elementów, uwagi: {[u[2] for u in uw]}")
    assert all(e is not None for e in el) and not [u for u in uw if "awaryjny" in u[2]]
    assert all(abs((e.x1 - e.x0) - 373) <= 3 for e in el)


def test_neutralizacja_koloru_efektow():
    """Złota iskra (ChatGPT zamiast „warm white”) → ciepła biel z zachowaną jasnością; biała zostaje bez zmian."""
    from kroki import fx
    yy, xx = np.mgrid[0:256, 0:256] / 256
    g = np.exp(-(((xx - .5) ** 2 + (yy - .5) ** 2) / 0.004))[..., None]
    zlota = np.concatenate([g * np.array([1.0, 0.7, 0.2]), np.ones_like(g)], -1).astype(np.float32)
    uw = []
    out = fx.neutralizuj_barwe(zlota, uw)
    rgb = out[128, 128, :3]
    assert rgb.min() / rgb.max() > 0.85 and rgb.max() > 0.75 and any(u[1] == "Q11" for u in uw)
    biala = np.concatenate([np.repeat(g, 3, -1), np.ones_like(g)], -1).astype(np.float32)
    uw = []
    assert np.array_equal(fx.neutralizuj_barwe(biala, uw), biala) and not uw
    print(f"    złota iskra → {np.round(rgb, 2)}")


def test_stopniowanie_q07():
    """Czubek iskry na krawędzi = ostrzeżenie; obiekt ucięty krawędzią na 30% boku = błąd."""
    import przetworz
    a = np.zeros((1024, 1024, 4), np.float32)
    a[0:3, 500:504, 3] = 1                                    # 4 px czubka
    uw = []
    przetworz.zglos_styk(a, uw)
    assert uw and uw[0][0] == "ostrzezenie"
    a[0:3, 300:620, 3] = 1                                    # 320 px = 31% boku
    uw = []
    przetworz.zglos_styk(a, uw)
    assert uw and uw[0][0] == "blad"
    print("    czubek → ostrzeżenie, ucięty obiekt → błąd")


def test_calosc_pipeline():
    """Pełne uruchomienie przetworz.py na obrazach z wadami podłożonych jako „grafika z ChatGPT”."""
    import przetworz
    zr = WYNIKI / "zrodla"
    for pk in ("s1", "global"):
        (zr / pk).mkdir(parents=True, exist_ok=True)
    # symbol na szachownicy
    rgb, a = obiekt_ze_znana_alfa()
    I = rgb * a[..., None] + szachownica(1024, 32) * (1 - a[..., None])
    Image.fromarray((I * 255).astype(np.uint8)).save(zr / "s1" / "s1_sym_dzwonek.png")
    # ramka na zielonym tle
    r = ramka_testowa()
    big = np.asarray(Image.fromarray((r * 255).astype(np.uint8)).resize((1024, 1024)), np.float32) / 255
    al = big[..., 3:4]
    zielone = big[..., :3] * al + np.array([0, 1, 0]) * (1 - al)
    Image.fromarray((zielone * 255).astype(np.uint8)).save(zr / "s1" / "s1_ramka.png")
    wy = WYNIKI / "img"
    kod = przetworz.main(["--tylko", "s1_sym_dzwonek,s1_ramka", "--zrodla", str(zr),
                          "--zastepcze", str(WYNIKI / "brak"), "--wyjscie", str(wy),
                          "--raport", str(WYNIKI / "raport"), "--watki", "1"])
    m = json.loads((wy / "manifest.json").read_text())
    d = m["images"]["s1_sym_dzwonek"]
    assert d["w"] == 256 and d["source"] == "chatgpt" and (wy / d["src"]).exists()
    okno = m["frames"]["s1_ramka"]["window"]
    ramka = m["images"]["s1_ramka"]
    print(f"    kod wyjścia {kod}; okno ramki {okno}")
    # okno 300×200 w ramce ~422×332 po przycięciu; siatka S1 to 3×3, więc pipeline rozciąga jednolity pas boków
    # ramki o +100 px: okno staje się kwadratowe (300×300), a ramka ma ~432 px wysokości
    assert abs(okno["w"] - 300 / 422) < 0.01 and abs(okno["h"] - 300 / 432) < 0.01
    assert abs(okno["w"] * ramka["w"] - okno["h"] * ramka["h"]) <= 2, "okno nie jest kwadratowe"
    wynik = wczytaj_rgba(wy / d["src"])
    assert wynik[..., 3][0, :].max() == 0, "tło symbolu nie jest przezroczyste"


def test_brak_zrodla_zostawia_wynik():
    """Gdy dla ID nie ma żadnego źródła, poprzedni wynik i wpis w manifeście zostają, a raport ostrzega."""
    import przetworz
    wy = WYNIKI / "img"
    przed = json.loads((wy / "manifest.json").read_text())["images"]["s1_sym_dzwonek"]
    kod = przetworz.main(["--tylko", "s1_sym_dzwonek", "--zrodla", str(WYNIKI / "pusto"),
                          "--zastepcze", str(WYNIKI / "pusto"), "--wyjscie", str(wy),
                          "--raport", str(WYNIKI / "raport"), "--watki", "1"])
    po = json.loads((wy / "manifest.json").read_text())["images"]["s1_sym_dzwonek"]
    raport = json.loads((WYNIKI / "raport" / "raport.json").read_text())["obrazy"]["s1_sym_dzwonek"]
    print(f"    kod {kod}, uwagi: {[u[2] for u in raport['uwagi']]}")
    assert po == przed and (wy / po["src"]).exists()
    assert any(u[1] == "Q01" for u in raport["uwagi"])


def test_determinizm():
    """Te same wejścia = te same bajty (git pokazuje tylko prawdziwe zmiany)."""
    import hashlib
    import przetworz
    wy = WYNIKI / "img"
    def skroty():
        return {p.name: hashlib.sha256(p.read_bytes()).hexdigest() for p in (wy / "s1").glob("s1_sym_dzwonek*")}
    a = skroty()
    przetworz.main(["--tylko", "s1_sym_dzwonek", "--zrodla", str(WYNIKI / "zrodla"), "--zastepcze", str(WYNIKI / "brak"),
                    "--wyjscie", str(wy), "--raport", str(WYNIKI / "raport"), "--watki", "1"])
    b = skroty()
    print(f"    {len(a)} plików, identyczne: {a == b}")
    assert a == b and len(a) >= 8


def main():
    testy = [(n, f) for n, f in globals().items() if n.startswith("test_") and callable(f)]
    ok = 0
    print(f"Obrazy testowe: {WYNIKI}")
    for nazwa, f in testy:
        t = time.time()
        try:
            f()
            ok += 1
            print(f"OK   {nazwa} ({time.time() - t:.1f} s)")
        except Exception:
            print(f"FAIL {nazwa}")
            traceback.print_exc()
    print(f"\n{ok}/{len(testy)} testów zaliczonych")
    return 0 if ok == len(testy) else 1


if __name__ == "__main__":
    sys.exit(main())
