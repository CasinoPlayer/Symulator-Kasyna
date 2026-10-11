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
    print(f"    kod wyjścia {kod}; okno ramki {okno}")
    # okno 300×200 w ramce 420×330 (40..460, 50..380) po przycięciu
    assert abs(okno["w"] - 300 / 422) < 0.01 and abs(okno["h"] - 200 / 332) < 0.01
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
