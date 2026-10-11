#!/usr/bin/env python3
"""
przetworz.py — pipeline grafiki Cebulion Casino: PNG → WebP @1x/@2x + manifest.json (kontrakt 09 § 3).

Po co to jest
-------------
Wszystkie obrazy trafiają do aplikacji przez ten JEDEN skrypt, niezależnie od tego, czy źródłem jest grafika
z ChatGPT, czy grafika zastępcza:

    art/zrodla/<pakiet>/<ID>.png      ← grafika z ChatGPT (ma pierwszeństwo; także <ID>.v2.png, .v3.png …)
    art/zastepcze/<pakiet>/<ID>.png   ← grafika zastępcza (tools/art/zastepcze/generuj_wszystko.py)
                │
                ▼  python3 tools/art/przetworz.py
    src/main/resources/static/assets/img/<pakiet>/<ID>.webp      (@1x)
    src/main/resources/static/assets/img/<pakiet>/<ID>@2x.webp   (@2x, gdy źródło na to pozwala)
    src/main/resources/static/assets/img/manifest.json

To narzędzie budowania (jak kompilator CSS), a nie część aplikacji: Spring Boot tylko serwuje gotowe pliki.
Te same PNG dają te same bajty, więc ``git diff`` pokazuje wyłącznie prawdziwe zmiany.

Przykłady:
    python3 tools/art/przetworz.py                     # wszystkie 85 assetów
    python3 tools/art/przetworz.py --tylko s1          # tylko pakiet s1 (global | s1 | s2 | s3)
    python3 tools/art/przetworz.py --tylko s1_sym_wild,g_ui_ikony
    python3 tools/art/przetworz.py --strict            # ostrzeżenia = błędy (przed commitem)

Kody wyjścia: 0 — w porządku, 1 — są ostrzeżenia, 2 — są błędy (albo ostrzeżenia z --strict).
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
import os
import re
import sys
import time
from concurrent.futures import ProcessPoolExecutor
from pathlib import Path

import numpy as np

KATALOG_NARZEDZI = Path(__file__).resolve().parent
sys.path.insert(0, str(KATALOG_NARZEDZI))

import katalog  # noqa: E402
from kroki import alfa, arkusze, fx, geometria, ikony, raport, skala, tla, warianty  # noqa: E402
from kroki.obraz import Skladowe, jasnosc, nasycenie, wczytaj_rgba  # noqa: E402

REPO = KATALOG_NARZEDZI.parents[1]
WERSJA_PIPELINE = "1.0.0"
LIMIT_POWIEKSZENIA = 1.25      # sprite'y: nigdy nie powiększamy źródła bardziej (02 § 2.6)


# ================================================================================================
# Wybór źródła
# ================================================================================================
def znajdz_zrodlo(a: katalog.Asset, ust: dict) -> tuple[Path | None, str, list]:
    """art/zrodla/<pakiet>/<ID>.png → najnowsze <ID>.vN.png → inne rozszerzenia → art/zastepcze/…"""
    uwagi = []
    kat = Path(ust["zrodla"]) / a.pakiet
    if kat.is_dir():
        wersje = []
        for p in kat.iterdir():
            m = re.fullmatch(re.escape(a.id) + r"(?:\.v(\d+))?\.(png|webp|jpe?g)", p.name, re.IGNORECASE)
            if m:
                wersje.append((int(m.group(1) or 0), m.group(2).lower() == "png", p))
        if wersje:
            wersje.sort(key=lambda t: (t[0], t[1]))
            _, png, p = wersje[-1]
            if not png:
                uwagi.append(["ostrzezenie", "Q04", f"plik nie jest PNG ({p.suffix})"])
            return p, "chatgpt", uwagi
    z = Path(ust["zastepcze"]) / a.pakiet / f"{a.id}.png"
    if z.exists():
        return z, "zastepcze", uwagi
    return None, "brak", uwagi


ROZSZERZENIA = (".png", ".webp", ".jpg", ".jpeg")
POMIJANE_FOLDERY = {"makiety", "nieposortowane"}       # makiety nie trafiają do aplikacji; nieposortowane — 02 § 4.6


def _znormalizuj_nazwe(nazwa: str) -> str:
    """Typowe „przeróbki” nazwy przy pobieraniu: wielkie litery, myślniki/spacje zamiast podkreśleń, dopisek
    „ (1)” albo „ copy”, podwójne rozszerzenie ``.png.png``. Zwraca rdzeń nazwy bez rozszerzenia."""
    n = nazwa.lower()
    while Path(n).suffix in ROZSZERZENIA:
        n = n[: -len(Path(n).suffix)]
    n = re.sub(r"\s*\(\d+\)$", "", n)
    n = re.sub(r"[\s_-]*(copy|kopia)(\s*\d+)?$", "", n)
    n = re.sub(r"\.v\d+$", "", n)
    return re.sub(r"[\s-]+", "_", n.strip())


def nieznane_pliki(zrodla: Path) -> list[str]:
    """Q02: pliki w ``art/zrodla``, których pipeline NIE użyje (zła nazwa albo zły folder), z podpowiedzią.

    Bez tej kontroli literówka w nazwie (``s1_sym_wisnia.png``) kończy się cichym użyciem grafiki zastępczej
    i trudnym do zauważenia „dlaczego mój obraz się nie pojawił?”."""
    import difflib
    komunikaty = []
    if not zrodla.is_dir():
        return komunikaty
    wszystkie_id = list(katalog.PO_ID)
    for p in sorted(zrodla.rglob("*")):
        if not p.is_file() or p.name.startswith(".") or p.suffix.lower() not in ROZSZERZENIA:
            continue
        rel = p.relative_to(zrodla)
        folder = rel.parts[0] if len(rel.parts) > 1 else ""
        if folder in POMIJANE_FOLDERY:
            continue
        m = re.fullmatch(r"(.+?)(?:\.v\d+)?\.(png|webp|jpe?g)", p.name, re.IGNORECASE)
        rdzen = m.group(1).lower() if m else ""
        a = katalog.PO_ID.get(rdzen)
        if a and a.pakiet == folder and len(rel.parts) == 2:
            continue                                         # poprawny plik — znajdz_zrodlo go użyje
        if a:
            komunikaty.append(f"{rel}: zły folder — przenieś do art/zrodla/{a.pakiet}/{p.name}")
            continue
        kand = _znormalizuj_nazwe(p.name)
        if kand in katalog.PO_ID:
            podp = [kand]
        else:
            podp = difflib.get_close_matches(kand, wszystkie_id, n=3, cutoff=0.6)
        rada = f"czy chodzi o: {', '.join(i + '.png' for i in podp)}?" if podp else "nieznane ID (lista: tools/art/katalog.py)"
        komunikaty.append(f"{rel}: plik zostanie pominięty — {rada}")
    return komunikaty


def sprawdz_typ_pliku(a: katalog.Asset, sciezka: Path, uwagi: list) -> None:
    """Q04: prawdziwy format pliku (po sygnaturze, nie po rozszerzeniu). JPEG nie ma kanału alfa, a jego artefakty
    kompresji przy krawędziach zostają w wyciętej alfie — dla obrazów ALFA prosimy o PNG."""
    from PIL import Image
    with Image.open(sciezka) as im:
        fmt = (im.format or "").upper()
    if fmt == "JPEG" and a.tlo == "ALFA":
        uwagi.append(["ostrzezenie", "Q04", "plik to JPEG (bez przezroczystości, artefakty na krawędziach) — "
                                            "pobierz z ChatGPT oryginalny PNG"])
    elif fmt and fmt != "PNG" and sciezka.suffix.lower() == ".png":
        uwagi.append(["info", "Q04", f"plik .png jest naprawdę w formacie {fmt}"])


def sprawdz_wymiary(a: katalog.Asset, rgba: np.ndarray, uwagi: list) -> None:
    H, W = rgba.shape[:2]
    ew, eh = a.wymiary_zrodla
    if (W, H) == (ew, eh):
        return
    if (W > H) != (ew > eh) and ew != eh:
        uwagi.append(["blad", "Q03", f"zamieniona orientacja: {W}×{H} zamiast {ew}×{eh}"])
    elif abs(W / H - ew / eh) > 0.02:
        uwagi.append(["ostrzezenie", "Q03", f"inna proporcja: {W}×{H} zamiast {ew}×{eh}"])
    else:
        uwagi.append(["ostrzezenie", "Q03", f"inny rozmiar: {W}×{H} zamiast {ew}×{eh}"])


# ================================================================================================
# Zapis plików jednego assetu
# ================================================================================================
class Wyjscie:
    """Zapisuje pliki jednego assetu do assets/img/<pakiet>/ i księguje ich wagę w wierszu raportu."""

    def __init__(self, a: katalog.Asset, ust: dict, wiersz: raport.Wiersz):
        self.a = a
        self.kat = Path(ust["wyjscie"]) / a.pakiet
        self.w = wiersz

    def usun_stare(self) -> None:
        """Usuwa poprzednie wyniki tego ID (np. @2x, którego teraz nie da się zrobić). Wzorzec jest dokładny:
        ``g_ui_spin`` nie łapie plików ``g_ui_spin_stop``."""
        if not self.kat.is_dir():
            return
        wzor = re.compile(re.escape(self.a.id) + r"(@2x)?(\.|__)")
        for p in self.kat.iterdir():
            if p.is_file() and wzor.match(p.name):
                p.unlink()

    def zapisz(self, nazwa: str, rgba: np.ndarray, rodzaj: str, desktop=True, telefon=True) -> tuple[str, str]:
        dane = skala.zakoduj_webp(rgba, rodzaj)
        h = skala.zapisz(self.kat / nazwa, dane)
        rel = f"{self.a.pakiet}/{nazwa}"
        self.w.pliki[rel] = len(dane)
        self.w.waga += len(dane)
        if desktop:
            self.w.waga_desktop += len(dane)
        if telefon:
            self.w.waga_telefon += len(dane)
        return rel, h

    def zapisz_surowe(self, nazwa: str, dane: bytes, desktop=True, telefon=True) -> str:
        skala.zapisz(self.kat / nazwa, dane)
        rel = f"{self.a.pakiet}/{nazwa}"
        self.w.pliki[rel] = len(dane)
        self.w.waga += len(dane)
        if desktop:
            self.w.waga_desktop += len(dane)
        if telefon:
            self.w.waga_telefon += len(dane)
        return rel


def para_1x_2x(wy: Wyjscie, nazwa: str, render, s: float, rodzaj: str, wpis: dict, uwagi: list,
               limit: float = LIMIT_POWIEKSZENIA) -> tuple[np.ndarray, np.ndarray | None]:
    """Zapisuje @1x i — jeśli źródło pozwala (powiększenie ≤ limit) — @2x. ``render(k)`` rysuje obraz w skali k
    (1 = @1x, 2 = @2x). @2x ma zawsze DOKŁADNIE dwa razy większe wymiary niż @1x."""
    ma_2x = 2 * s <= limit + 1e-6
    if s > limit + 1e-6:
        uwagi.append(["info", "Q20", f"@1x wymaga powiększenia ×{s:.2f}"])
    x1 = render(1)
    rel1, h1 = wy.zapisz(f"{nazwa}.webp", x1, rodzaj, desktop=not ma_2x, telefon=True)
    wpis.update({"src": rel1, "w": int(x1.shape[1]), "h": int(x1.shape[0]), "hash": h1})
    x2 = None
    if ma_2x:
        x2 = render(2)
        rel2, _ = wy.zapisz(f"{nazwa}@2x.webp", x2, rodzaj, desktop=True, telefon=False)
        wpis["src2x"] = rel2
    elif s <= limit + 1e-6:
        uwagi.append(["info", "Q20", f"bez @2x (wymagałoby powiększenia ×{2 * s:.2f})"])
    return x1, x2


def wpis_wariantu(wy: Wyjscie, nazwa: str, rgba: np.ndarray, rodzaj: str, skala_pliku: float = 1.0,
                  logiczne: tuple | None = None) -> dict:
    rel, _ = wy.zapisz(nazwa, rgba, rodzaj)
    w, h = logiczne if logiczne else (rgba.shape[1], rgba.shape[0])
    wpis = {"src": rel, "w": int(w), "h": int(h)}
    if skala_pliku != 1.0:
        wpis["scale"] = skala_pliku
    return wpis


def render_w_polu(img: np.ndarray, s: float, pole: int, srodek=None):
    """Funkcja rysująca obraz przeskalowany o s·k na kwadratowym płótnie pole·k (symbole, monety, przyciski)."""
    h, w = img.shape[:2]
    cx, cy = srodek if srodek else (w / 2, h / 2)

    def render(k):
        nw, nh = max(1, round(w * s * k)), max(1, round(h * s * k))
        sc = skala.skaluj(img, nw, nh)
        return skala.wklej_na_plotno(sc, pole * k, pole * k, cx * nw / w, cy * nh / h)
    return render


def render_skalowany(img: np.ndarray, w1: int, h1: int):
    def render(k):
        return skala.skaluj(img, w1 * k, h1 * k)
    return render


# ================================================================================================
# Przygotowanie źródła (wspólne dla ról)
# ================================================================================================
class Przygotowany:
    def __init__(self, a, sciezka, zrodlo, rgba, uwagi, metoda=""):
        self.a, self.sciezka, self.zrodlo, self.rgba, self.uwagi, self.metoda = a, sciezka, zrodlo, rgba, uwagi, metoda


def przygotuj(a: katalog.Asset, ust: dict) -> Przygotowany | None:
    sciezka, zrodlo, uwagi = znajdz_zrodlo(a, ust)
    if sciezka is None:
        return Przygotowany(a, None, "brak", None, uwagi)
    rgba = wczytaj_rgba(sciezka)
    if zrodlo == "chatgpt":
        sprawdz_typ_pliku(a, sciezka, uwagi)
    sprawdz_wymiary(a, rgba, uwagi)
    metoda = ""
    if a.tlo == "ALFA":
        wynik = alfa.napraw_alfe(rgba, a.rola, pylki=a.rola not in ("arkusz", "cyfry"))
        rgba, metoda = wynik.rgba, wynik.metoda
        uwagi.extend([list(u) for u in wynik.uwagi])
    return Przygotowany(a, sciezka, zrodlo, rgba, uwagi, metoda)


# ================================================================================================
# Obsługa ról
# ================================================================================================
def obsluz_symbole(przyg: list[Przygotowany], zapisz_ids: set, ust: dict, wynik: dict) -> None:
    """Symbole jednej grupy (gra + poziom): wspólna normalizacja wielkości (02 § 5.6) + warianty (§ 5.15–5.16)."""
    dostepne = [p for p in przyg if p.rgba is not None]
    if not dostepne:
        return
    a0 = dostepne[0].a
    pole, poziom = a0.cel["pole"], a0.cel["poziom"]
    ciasne = {}
    for p in dostepne:
        img, _, dotyka = alfa.przytnij(p.rgba, margines_proc=0, min_px=0)
        if dotyka:
            p.uwagi.append(["blad", "Q07", "obiekt przycięty krawędzią obrazu"])
        ciasne[p.a.id] = img
    skale = geometria.skale_symboli(ciasne, pole, poziom)
    for p in dostepne:
        if p.a.id not in zapisz_ids:
            continue
        a, img, s = p.a, ciasne[p.a.id], skale[p.a.id]
        w = nowy_wiersz(p, wynik)
        wy = Wyjscie(a, ust, w)
        wy.usun_stare()
        wpis = {"source": p.zrodlo, "blend": "normal"}
        render = render_w_polu(img, s, pole, geometria.srodek_optyczny(img))
        x1, _ = para_1x_2x(wy, a.id, render, s, "alfa", wpis, p.uwagi)
        # --- warianty: gra podmienia tekstury zamiast liczyć filtry w każdej klatce ---
        war = {}
        L1 = 8 if a.pakiet == "s3" else 12
        war["ruch1"] = wpis_wariantu(wy, f"{a.id}.ruch1.webp", warianty.ruch(x1, L1, False), "miekkie")
        if a.pakiet != "s3":
            war["ruch2"] = wpis_wariantu(wy, f"{a.id}.ruch2.webp", warianty.ruch(x1, 20, True), "miekkie")
        war["syl"] = wpis_wariantu(wy, f"{a.id}.syl.webp", warianty.sylwetka(x1), "miekkie")
        g = warianty.poswiata(x1, pole)
        war["glow"] = wpis_wariantu(wy, f"{a.id}.glow.webp", warianty.polowa(g), "miekkie", 0.5, (g.shape[1], g.shape[0]))
        c = warianty.cien(x1, pole)
        war["cien"] = wpis_wariantu(wy, f"{a.id}.cien.webp", warianty.polowa(c), "miekkie", 0.5, (c.shape[1], c.shape[0]))
        mini = render_w_polu(img, s * 96 / pole, 96, geometria.srodek_optyczny(img))
        rm, _ = wy.zapisz(f"{a.id}.mini.webp", mini(1), "alfa", desktop=False)
        rm2, _ = wy.zapisz(f"{a.id}.mini@2x.webp", mini(2), "alfa", telefon=False)
        war["mini"] = {"src": rm, "src2x": rm2, "w": 96, "h": 96}
        wpis["variants"] = war
        if a.id in katalog.TINT_S3:
            wpis["tint"] = katalog.TINT_S3[a.id]
        if a.id == "s3_sym_mnoznik":
            wpis["pole"] = pole_mnoznika(x1)
        kontrola_symbolu(x1, p.uwagi)
        w.rozmiar = f"{pole}×{pole}" + (" +@2x" if "src2x" in wpis else "")
        wynik["images"][a.id] = wpis


def pole_mnoznika(x1: np.ndarray) -> dict:
    """Jasny, mało nasycony środek kuli (tu kod wpisuje liczbę „×5”): środek ciężkości i promień równoważny."""
    H, W = x1.shape[:2]
    jas = (jasnosc(x1[..., :3]) > 0.75) & (nasycenie(x1[..., :3]) < 0.2) & (x1[..., 3] > 0.9)
    ramka = np.zeros_like(jas)
    ramka[int(0.2 * H):int(0.8 * H), int(0.2 * W):int(0.8 * W)] = True
    sk = Skladowe(jas & ramka)
    if sk.n == 0:
        return {"x": 0.5, "y": 0.5, "r": 0.25}
    k = int(np.argmax(sk.pole[1:])) + 1
    ys, xs = np.nonzero(sk.etykiety == k)
    return {"x": round(float(xs.mean()) / W, 3), "y": round(float(ys.mean()) / H, 3),
            "r": round(float(np.sqrt(sk.pole[k] / np.pi)) / W, 3)}


def kontrola_symbolu(x1: np.ndarray, uwagi: list) -> None:
    """Q18: światło z lewej-góry — środek ciężkości jasności powinien leżeć na lewo-w górę od środka alfy."""
    a = x1[..., 3]
    if a.sum() <= 0:
        return
    yy, xx = np.mgrid[0:a.shape[0], 0:a.shape[1]]
    L = jasnosc(x1[..., :3]) * a
    cxa, cya = (xx * a).sum() / a.sum(), (yy * a).sum() / a.sum()
    cxl, cyl = (xx * L).sum() / max(L.sum(), 1e-6), (yy * L).sum() / max(L.sum(), 1e-6)
    if cxl > cxa + 0.02 * a.shape[1] and cyl > cya + 0.02 * a.shape[0]:
        uwagi.append(["ostrzezenie", "Q18", "światło wygląda na padające z prawej-dołu (brief: z lewej-góry)"])


def obsluz_pole_grupowe(przyg: list[Przygotowany], zapisz_ids: set, ust: dict, wynik: dict) -> None:
    """Monety (3 ujęcia) i przyciski SPIN/STOP: wspólna skala i środek, żeby podmiana klatek nie „skakała”."""
    dostepne = [p for p in przyg if p.rgba is not None]
    if not dostepne:
        return
    ciasne = {p.a.id: alfa.przytnij(p.rgba, margines_proc=0, min_px=0)[0] for p in dostepne}
    pole = dostepne[0].a.cel["pole"]
    grupa = dostepne[0].a.cel["grupa"]
    if grupa == "monety":
        # wspólna skala z WYSOKOŚCI przodu: pionowa średnica nie zmienia się przy obrocie wokół osi pionowej
        wzor = ciasne.get("g_moneta_przod", next(iter(ciasne.values())))
        s = 0.94 * pole / wzor.shape[0]
    else:
        wzor = ciasne.get("g_ui_spin", next(iter(ciasne.values())))
        s = 0.98 * pole / max(wzor.shape[:2])
    for p in dostepne:
        if p.a.id not in zapisz_ids:
            continue
        a, img = p.a, ciasne[p.a.id]
        w = nowy_wiersz(p, wynik)
        wy = Wyjscie(a, ust, w)
        wy.usun_stare()
        wpis = {"source": p.zrodlo, "blend": "normal"}
        x1, _ = para_1x_2x(wy, a.id, render_w_polu(img, s, pole), s, "alfa", wpis, p.uwagi)
        war = {}
        for nazwa in a.cel.get("warianty", []):
            if nazwa == "male":
                r = render_w_polu(img, s * 64 / pole, 64)
                rm, _ = wy.zapisz(f"{a.id}.male.webp", r(1), "alfa", desktop=False)
                rm2, _ = wy.zapisz(f"{a.id}.male@2x.webp", r(2), "alfa", telefon=False)
                war["male"] = {"src": rm, "src2x": rm2, "w": 64, "h": 64}
            elif nazwa == "ikona":
                r = render_w_polu(img, 28 / max(img.shape[:2]), 28)
                ri, _ = wy.zapisz(f"{a.id}.ikona.webp", r(1), "ui", desktop=False)
                ri2, _ = wy.zapisz(f"{a.id}.ikona@2x.webp", r(2), "ui", telefon=False)
                war["ikona"] = {"src": ri, "src2x": ri2, "w": 28, "h": 28}
            elif nazwa == "glowzl":
                g = warianty.poswiata(x1, pole, "#F5C542")
                war["glowzl"] = wpis_wariantu(wy, f"{a.id}.glowzl.webp", g, "miekkie")
        if war:
            wpis["variants"] = war
        w.rozmiar = f"{pole}×{pole}" + (" +@2x" if "src2x" in wpis else "")
        wynik["images"][a.id] = wpis


def obsluz_obiekt(p: Przygotowany, ust: dict, wynik: dict) -> None:
    """Pojedynczy obraz ALFA (logo, maskotka, skrzynia, ornament, napisy wygranych, rozszerzony WILD)."""
    a = p.a
    img, _, dotyka = alfa.przytnij(p.rgba)
    if dotyka:
        p.uwagi.append(["blad", "Q07", "obiekt przycięty krawędzią obrazu"])
    h, w = img.shape[:2]
    cel = a.cel
    if "wys_dokladna" in cel:
        ciasny = alfa.przytnij(p.rgba, margines_proc=0, min_px=0)[0]
        img, (h, w) = ciasny, ciasny.shape[:2]
        s = cel["wys_dokladna"] / h
    elif "szer" in cel:
        s = cel["szer"] / w
    elif "wys" in cel:
        s = cel["wys"] / h
    elif "bok" in cel:
        s = cel["bok"] / max(h, w)
    else:
        bw, bh = cel["pudelko"]
        s = min(bw / w, bh / h)
    w1, h1 = skala.parzyste(w * s), skala.parzyste(h * s)
    if "szer" in cel:
        w1 = cel["szer"]
    wiersz = nowy_wiersz(p, wynik)
    wy = Wyjscie(a, ust, wiersz)
    wy.usun_stare()
    wpis = {"source": p.zrodlo, "blend": "normal"}
    x1, _ = para_1x_2x(wy, a.id, render_skalowany(img, w1, h1), s, "alfa", wpis, p.uwagi)
    war = {}
    S = max(w1, h1)
    for nazwa in cel.get("warianty", []):
        if nazwa == "glow":
            g = warianty.poswiata(x1, S * 0.5)
            war["glow"] = wpis_wariantu(wy, f"{a.id}.glow.webp", warianty.polowa(g), "miekkie", 0.5, (g.shape[1], g.shape[0]))
        elif nazwa == "cien":
            c = warianty.cien(x1, S * 0.5, 0.03)
            war["cien"] = wpis_wariantu(wy, f"{a.id}.cien.webp", warianty.polowa(c), "miekkie", 0.5, (c.shape[1], c.shape[0]))
        elif nazwa == "glowzl":
            g = warianty.poswiata(x1, S * 0.5, "#F5C542")
            war["glowzl"] = wpis_wariantu(wy, f"{a.id}.glowzl.webp", g, "miekkie")
    if war:
        wpis["variants"] = war
    wiersz.rozmiar = f"{x1.shape[1]}×{x1.shape[0]}" + (" +@2x" if "src2x" in wpis else "")
    wynik["images"][a.id] = wpis


def obsluz_emblemat(p: Przygotowany, ust: dict, wynik: dict) -> None:
    """Emblemat: loader 192/384, wariant ``naglowek`` 40/80 do paska górnego i favicony (02 § 5.19)."""
    a = p.a
    img, _, _ = alfa.przytnij(p.rgba)
    h, w = img.shape[:2]
    b = max(h, w)
    kw = np.zeros((b, b, 4), dtype=np.float32)
    kw[(b - h) // 2:(b - h) // 2 + h, (b - w) // 2:(b - w) // 2 + w] = img
    s = a.cel["bok"] / b
    wiersz = nowy_wiersz(p, wynik)
    wy = Wyjscie(a, ust, wiersz)
    wy.usun_stare()
    wpis = {"source": p.zrodlo, "blend": "normal"}
    bok = a.cel["bok"]
    para_1x_2x(wy, a.id, render_skalowany(kw, bok, bok), s, "alfa", wpis, p.uwagi)
    r = render_skalowany(kw, 40, 40)
    rn, _ = wy.zapisz(f"{a.id}.naglowek.webp", r(1), "ui", desktop=False)
    rn2, _ = wy.zapisz(f"{a.id}.naglowek@2x.webp", r(2), "ui", telefon=False)
    wpis["variants"] = {"naglowek": {"src": rn, "src2x": rn2, "w": 40, "h": 40}}
    wynik["icons"] = ikony.generuj_ikony(kw, Path(ust["wyjscie"]) / "global")
    for rel in wynik["icons"].values():
        wiersz.pliki[rel] = (Path(ust["wyjscie"]) / rel).stat().st_size
    wiersz.rozmiar = f"{bok}×{bok}" + (" +@2x" if "src2x" in wpis else "") + " + ikony"
    wynik["images"][a.id] = wpis


def obsluz_ramke(p: Przygotowany, ust: dict, wynik: dict) -> None:
    """Ramka bębnów: wykrycie okna → ``frames.<ID>.window`` (ułamki) + marginesy 9-slice ramki w px @1x."""
    a = p.a
    img, _, dotyka = alfa.przytnij(p.rgba, margines_proc=0, min_px=2)
    if dotyka:
        p.uwagi.append(["ostrzezenie", "Q07", "ramka dotyka krawędzi obrazu"])
    okno = geometria.wykryj_okno(img, p.uwagi)
    wiersz = nowy_wiersz(p, wynik)
    if okno is None:
        return
    geometria.sprawdz_proporcje_okna(okno, a.cel["siatka"], p.uwagi)
    h, w = img.shape[:2]
    x0, y0, x1o, y1o = okno
    tw, th = a.cel["okno"]
    s = float(np.sqrt((tw / (x1o - x0)) * (th / (y1o - y0))))
    W1, H1 = skala.parzyste(w * s), skala.parzyste(h * s)
    wy = Wyjscie(a, ust, wiersz)
    wy.usun_stare()
    wpis = {"source": p.zrodlo, "blend": "normal"}
    para_1x_2x(wy, a.id, render_skalowany(img, W1, H1), s, "alfa", wpis, p.uwagi)
    wynik["images"][a.id] = wpis
    kx, ky = W1 / w, H1 / h
    wynik["frames"][a.id] = {
        "window": {"x": round(x0 / w, 4), "y": round(y0 / h, 4),
                   "w": round((x1o - x0) / w, 4), "h": round((y1o - y0) / h, 4)},
        "nineSlice": {"left": int(round(x0 * kx)), "top": int(round(y0 * ky)),
                      "right": int(round((w - x1o) * kx)), "bottom": int(round((h - y1o) * ky))},
    }
    wiersz.rozmiar = f"{W1}×{H1}" + (" +@2x" if "src2x" in wpis else "") + f" okno {round((x1o - x0) * kx)}×{round((y1o - y0) * ky)}"


def obsluz_9slice(p: Przygotowany, ust: dict, wynik: dict) -> None:
    """Panel i przyciski-pigułki: przycięcie ciasne (krawędź obrazu = krawędź ramy) + marginesy ``nineSlice``."""
    a = p.a
    img, _, _ = alfa.przytnij(p.rgba, margines_proc=0, min_px=0)
    pigulka = a.rola == "przycisk9"
    marg = geometria.marginesy_9slice(img, pigulka, p.uwagi)
    h, w = img.shape[:2]
    if "szer" in a.cel:
        s = a.cel["szer"] / w
    else:
        s = a.cel["wys"] / h
    W1, H1 = skala.parzyste(w * s), skala.parzyste(h * s)
    wiersz = nowy_wiersz(p, wynik)
    wy = Wyjscie(a, ust, wiersz)
    wy.usun_stare()
    wpis = {"source": p.zrodlo, "blend": "normal"}
    para_1x_2x(wy, a.id, render_skalowany(img, W1, H1), s, "ui", wpis, p.uwagi)
    wynik["images"][a.id] = wpis
    wynik["nineSlice"][a.id] = marg
    wiersz.rozmiar = f"{W1}×{H1}" + (" +@2x" if "src2x" in wpis else "")


def obsluz_fx(p: Przygotowany, ust: dict, wynik: dict) -> None:
    """Efekt CZARNE: czerń zostaje, ``blend: "add"``, jedna rozdzielczość."""
    a = p.a
    rgb = fx.przygotuj_fx(p.rgba, p.uwagi, srodek=a.cel.get("srodek", False), dym=a.cel.get("dym", False))
    bok = a.cel["bok"]
    h, w = rgb.shape[:2]
    out = skala.skaluj(rgb, bok, int(round(h * bok / w)))
    wiersz = nowy_wiersz(p, wynik)
    wy = Wyjscie(a, ust, wiersz)
    wy.usun_stare()
    rel, hs = wy.zapisz(f"{a.id}.webp", out, "czarne")
    wynik["images"][a.id] = {"src": rel, "w": int(out.shape[1]), "h": int(out.shape[0]),
                             "source": p.zrodlo, "blend": "add", "hash": hs}
    wiersz.rozmiar = f"{out.shape[1]}×{out.shape[0]} (jedna)"


def obsluz_arkusz(p: Przygotowany, ust: dict, wynik: dict) -> None:
    """Arkusz → osobne pliki ``<ID>__<komórka>.webp`` + ``sheets.<ID>.cells`` (kontrakt 09 § 3)."""
    a = p.a
    czarne = a.tlo == "CZARNE"
    rgba = p.rgba
    if czarne:
        rgba = fx.zeruj_czern(fx.splaszcz_na_czarne(rgba, p.uwagi), p.uwagi)
    nazwy = a.komorki
    elementy = arkusze.tnij(rgba, a.siatka, len(nazwy), czarne, p.uwagi)
    wiersz = nowy_wiersz(p, wynik)
    wy = Wyjscie(a, ust, wiersz)
    wy.usun_stare()
    cel = a.cel
    rozm = ""
    for nazwa, e in zip(nazwy, elementy):
        if e is None:
            p.uwagi.append(["blad", "Q13", f"brak elementu „{nazwa}”"])
            continue
        idk = f"{a.id}__{nazwa}"
        if czarne:
            m = int(0.08 * max(e.x1 - e.x0, e.y1 - e.y0))
            el = arkusze.wytnij(rgba, e, m, True)
            if "komorka_wh" in cel:
                cw, ch = cel["komorka_wh"]
            else:
                cw = ch = cel["komorka"]
            h, w = el.shape[:2]
            s = min(0.92 * cw / w, 0.92 * ch / h)
            nw, nh = max(1, round(w * s)), max(1, round(h * s))

            def render(k, el=el, nw=nw, nh=nh, cw=cw, ch=ch):
                sc = skala.skaluj(el, nw * k, nh * k)
                pl = np.zeros((ch * k, cw * k, 4), np.float32)
                pl[..., 3] = 1
                y, x = (ch * k - nh * k) // 2, (cw * k - nw * k) // 2
                pl[y:y + nh * k, x:x + nw * k] = sc
                return fx.winieta_krawedzi(pl, None, 0.08)
            wpis = {"source": p.zrodlo, "blend": "add"}
            if cel.get("jedna"):
                x1 = render(1)
                rel, hs = wy.zapisz(f"{idk}.webp", x1, "czarne")
                wpis.update({"src": rel, "w": cw, "h": ch, "hash": hs})
            else:
                rel1, hs = wy.zapisz(f"{idk}.webp", render(1), "czarne", desktop=not (2 * s <= LIMIT_POWIEKSZENIA))
                wpis.update({"src": rel1, "w": cw, "h": ch, "hash": hs})
                if 2 * s <= LIMIT_POWIEKSZENIA:
                    rel2, _ = wy.zapisz(f"{idk}@2x.webp", render(2), "czarne", telefon=False)
                    wpis["src2x"] = rel2
            rozm = f"{cw}×{ch}" + (" +@2x" if "src2x" in wpis else "") + f" × {len(nazwy)}"
        else:
            el = arkusze.wytnij(rgba, e, 4, False)
            el = alfa.defringe(el)
            img, _, _ = alfa.przytnij(el, margines_proc=0, min_px=0)
            h, w = img.shape[:2]
            C = cel["komorka"]
            wpis = {"source": p.zrodlo, "blend": "normal"}
            rodzaj = "ui" if cel.get("ui") else "alfa"
            if cel.get("dopasuj") == "kolo":
                s = 0.96 * C / max(h, w)
                para_1x_2x(wy, idk, render_w_polu(img, s, C), s, rodzaj, wpis, p.uwagi)
                rozm = f"{C}×{C}" + (" +@2x" if "src2x" in wpis else "") + f" × {len(nazwy)}"
            else:
                s = C / max(h, w)
                w1, h1 = skala.parzyste(w * s), skala.parzyste(h * s)
                para_1x_2x(wy, idk, render_skalowany(img, w1, h1), s, rodzaj, wpis, p.uwagi)
                rozm = f"bok {C}" + (" +@2x" if "src2x" in wpis else "") + f" × {len(nazwy)}"
        wynik["images"][idk] = wpis
    wynik["sheets"][a.id] = {"cells": list(nazwy)}
    wiersz.rozmiar = rozm


def obsluz_cyfry(p: Przygotowany, ust: dict, wynik: dict) -> None:
    """Złote cyfry: 13 glifów → pliki ``g_font_cyfry__<znak>.webp`` (wspólna wysokość linii) + BitmapFont
    (``.fnt`` + strona glifów) + metryki w ``manifest.json → fonts.CebulionCyfry`` (02 § 5.14)."""
    a = p.a
    nazwy = a.komorki
    elementy = arkusze.tnij(p.rgba, a.siatka, len(nazwy), False, p.uwagi)
    if any(e is not None for e in elementy[len(nazwy):]):
        p.uwagi.append(["ostrzezenie", "Q14", "dwa ostatnie pola arkusza cyfr nie są puste"])
    elementy = elementy[:len(nazwy)]
    met = arkusze.metryki_cyfr(elementy, nazwy, p.uwagi)
    H = met["H"]
    wiersz = nowy_wiersz(p, wynik)
    wy = Wyjscie(a, ust, wiersz)
    wy.usun_stare()
    BASE, LINE = a.cel["wys_cyfry"], int(round(a.cel["wys_cyfry"] * 1.25))
    s1 = BASE / H
    glify = {}
    for nazwa, e in zip(nazwy, elementy):
        if e is None:
            continue
        el = alfa.defringe(arkusze.wytnij(p.rgba, e, 0, False))
        glify[nazwa] = (el, e, met["bazy"][nazwa])
    szer_cyfr = max((g[0].shape[1] for n, g in glify.items() if n.isdigit()), default=1) * s1
    pad = 2
    fnt_znaki = {1: [], 2: []}
    chars = {}
    for nazwa, (el, e, baza) in glify.items():
        h, w = el.shape[:2]
        gw, gh = max(1, round(w * s1)), max(1, round(h * s1))
        top = (e.y0 - (baza - H)) * s1                # odległość od górnej linii cyfr
        if nazwa.isdigit():
            adv = szer_cyfr + 0.04 * BASE
        elif nazwa == "przecinek":
            adv = gw + 0.04 * BASE
        else:
            adv = gw + 0.08 * BASE
        adv = int(round(adv))
        yoff = int(round(top + (LINE - BASE) * 0.4))   # część zapasu linii nad cyframi
        xoff = int(round((adv - gw) / 2))
        szer_pliku = max(adv, gw + 2 * pad)

        def render(k, el=el, gw=gw, gh=gh, yoff=yoff, xoff=xoff, szer_pliku=szer_pliku):
            sc = skala.skaluj(el, gw * k, gh * k)
            pl = np.zeros((LINE * k, szer_pliku * k, 4), np.float32)
            x = max(0, (szer_pliku - gw) // 2) * k
            y = max(0, min(LINE - gh, yoff)) * k
            pl[y:y + gh * k, x:x + gw * k] = sc
            return pl
        idk = f"{a.id}__{nazwa}"
        wpis = {"source": p.zrodlo, "blend": "normal"}
        x1, x2 = para_1x_2x(wy, idk, render, s1, "ui", wpis, p.uwagi)
        wynik["images"][idk] = wpis
        znak = katalog.ZNAKI_CYFR[nazwa]
        chars[znak] = {"cell": nazwa, "image": idk, "w": gw, "h": gh, "xoffset": xoff, "yoffset": yoff,
                       "xadvance": adv}
        for k, obraz in ((1, x1), (2, x2)):
            if obraz is not None:
                fnt_znaki[k].append((ord(znak), skala.skaluj(el, gw * k, gh * k), xoff * k, max(0, min(LINE - gh, yoff)) * k, adv * k))
    spacja = int(round(0.25 * szer_cyfr))
    wynik["sheets"][a.id] = {"cells": list(nazwy)}
    font = {"size": BASE, "lineHeight": LINE, "base": int(round(BASE + (LINE - BASE) * 0.4)),
            "chars": chars, "space": spacja, "tabular": True}
    # --- strona glifów + plik .fnt dla PixiJS (osobno @1x i @2x) ---
    kat_fontu = Path(ust["wyjscie"]) / "global" / "fonty"
    pliki_fontu = {}
    for k, znaki in fnt_znaki.items():
        if not znaki:
            continue
        strona, wpisy = _pakuj_glify(znaki, 4 * k)
        nazwa_strony = f"cebulion-cyfry@{k}x.webp"
        dane = skala.zakoduj_webp(strona, "ui")
        skala.zapisz(kat_fontu / nazwa_strony, dane)
        wpisy += [{"id": 32, "x": 0, "y": 0, "w": 0, "h": 0, "xoffset": 0, "yoffset": 0, "xadvance": spacja * k},
                  {"id": 160, "x": 0, "y": 0, "w": 0, "h": 0, "xoffset": 0, "yoffset": 0, "xadvance": spacja * k}]
        tekst = arkusze.plik_fnt("CebulionCyfry", BASE * k, LINE * k, font["base"] * k, nazwa_strony,
                                 strona.shape[1], strona.shape[0], wpisy)
        skala.zapisz(kat_fontu / f"cebulion-cyfry@{k}x.fnt", tekst.encode("utf-8"))
        pliki_fontu[str(k)] = f"global/fonty/cebulion-cyfry@{k}x.fnt"
        wiersz.pliki[f"global/fonty/{nazwa_strony}"] = len(dane)
        wiersz.waga += len(dane)
    font["fnt"] = pliki_fontu
    wynik["fonts"]["CebulionCyfry"] = font
    wiersz.rozmiar = f"wys. cyfry {BASE}" + (" +@2x" if "2" in pliki_fontu else "") + " + .fnt"


def _pakuj_glify(znaki, odstep):
    """Proste pakowanie półkowe: glify w jednym rzędzie (13 znaków — atlas MaxRects byłby przesadą)."""
    wys = max(g.shape[0] for _, g, *_ in znaki) + 2 * odstep
    szer = sum(g.shape[1] + odstep for _, g, *_ in znaki) + odstep
    sw = 1 << int(np.ceil(np.log2(max(szer, 2))))
    sh = 1 << int(np.ceil(np.log2(max(wys, 2))))
    strona = np.zeros((sh, sw, 4), np.float32)
    x = odstep
    wpisy = []
    for kod, g, xoff, yoff, adv in znaki:
        gh, gw = g.shape[:2]
        strona[odstep:odstep + gh, x:x + gw] = g
        wpisy.append({"id": kod, "x": x, "y": odstep, "w": gw, "h": gh, "xoffset": xoff, "yoffset": yoff, "xadvance": adv})
        x += gw + odstep
    return strona, wpisy


def obsluz_pelne(p: Przygotowany, ust: dict, wynik: dict) -> None:
    """Tła, okładki i banery: warianty szerokości, ziarno przy powiększaniu, LQIP, wersja rozmyta, kadr 16:9."""
    a = p.a
    rgb = tla.splaszcz(p.rgba, p.uwagi)
    fw, fh = a.wymiary_zrodla
    focus = a.cel.get("focus", (0.5, 0.5))
    rgb = tla.kadruj(rgb, fw / fh, focus)
    wiersz = nowy_wiersz(p, wynik)
    wy = Wyjscie(a, ust, wiersz)
    wy.usun_stare()
    cel = a.cel
    x1w, x2w = cel["x1"], cel["x2"]
    limit = tla.LIMIT_POWIEKSZENIA_TLA
    szerokosci = {}
    wpis = {"source": p.zrodlo, "blend": "normal"}
    for szer in cel["szerokosci"]:
        obraz = tla.wariant_szerokosci(rgb, szer, a.id, p.uwagi, limit)
        if obraz is None:
            continue
        if szer == x1w:
            nazwa = f"{a.id}.webp"
        elif szer == x2w:
            nazwa = f"{a.id}@2x.webp"
        else:
            nazwa = f"{a.id}.w{szer}.webp"
        # desktop pobiera największy wariant, telefon — @1x (tło mobile) — tak liczymy budżet
        rel, hs = wy.zapisz(nazwa, obraz, "pelne", desktop=(szer == x2w), telefon=(szer == x1w))
        szerokosci[str(szer)] = rel
        if szer == x1w:
            wpis.update({"src": rel, "w": int(obraz.shape[1]), "h": int(obraz.shape[0]), "hash": hs})
        elif szer == x2w:
            wpis["src2x"] = rel
    wpis["widths"] = szerokosci
    if a.rola in ("tlo", "baner"):
        wpis["focus"] = list(focus)
    lw, lh = (24, 16) if fw > fh else (16, 24)
    wpis["lqip"] = tla.lqip(rgb, lw, lh)
    war = {}
    if "rozmyte" in cel:
        r = tla.rozmyte(rgb, cel["rozmyte"])
        war["rozmyte"] = wpis_wariantu(wy, f"{a.id}.rozmyte.webp", r, "miekkie")
    if a.rola == "baner":
        k169 = tla.kadruj(rgb, 16 / 9, focus)
        o1 = tla.wariant_szerokosci(k169, 960, a.id + "k", None, limit)
        o2 = tla.wariant_szerokosci(k169, 1536, a.id + "k", None, limit)
        r1, _ = wy.zapisz(f"{a.id}.k169.webp", o1, "pelne", desktop=False)
        r2, _ = wy.zapisz(f"{a.id}.k169@2x.webp", o2, "pelne", telefon=False)
        war["k169"] = {"src": r1, "src2x": r2, "w": 960, "h": 540}
    if war:
        wpis["variants"] = war
    if "src" not in wpis:
        p.uwagi.append(["blad", "Q20", "nie powstał wariant @1x (źródło za małe)"])
        return
    wynik["images"][a.id] = wpis
    wiersz.rozmiar = f"{wpis['w']}×{wpis['h']}" + (" +@2x" if "src2x" in wpis else "") + f" ({len(szerokosci)} szer.)"


# ================================================================================================
# Zadania (grupy assetów przetwarzane razem — mogą iść równolegle w osobnych procesach)
# ================================================================================================
def nowy_wiersz(p: Przygotowany, wynik: dict) -> raport.Wiersz:
    w = raport.Wiersz(p.a.id, p.zrodlo, str(p.sciezka.relative_to(REPO)) if p.sciezka and p.sciezka.is_relative_to(REPO)
                      else str(p.sciezka or ""), uwagi=p.uwagi, metoda_alfy=p.metoda)
    wynik["wiersze"][p.a.id] = w
    return w


def zadania(wybrane: list[katalog.Asset]) -> list[tuple[list[str], list[str]]]:
    """Dzieli pracę na zadania: (ID do zapisania, ID potrzebne do obliczeń grupowych)."""
    ids = {a.id for a in wybrane}
    grupy: dict[str, list[str]] = {}
    for a in katalog.ASSETY:
        g = a.cel.get("grupa")
        if g:
            grupy.setdefault(g, []).append(a.id)
    wynik, zrobione = [], set()
    for a in wybrane:
        if a.id in zrobione:
            continue
        g = a.cel.get("grupa")
        if g:
            czlonki = grupy[g]
            wynik.append(([i for i in czlonki if i in ids], czlonki))
            zrobione.update(czlonki)
        else:
            wynik.append(([a.id], [a.id]))
            zrobione.add(a.id)
    return wynik


def wykonaj_zadanie(zapisz_ids: list[str], grupa_ids: list[str], ust: dict) -> dict:
    """Przetwarza jedno zadanie i zwraca fragment manifestu + wiersze raportu (małe dane — łatwe między procesami)."""
    skala.ustaw_metode(ust.get("metoda_webp", 4))
    wynik = {"images": {}, "sheets": {}, "frames": {}, "nineSlice": {}, "fonts": {}, "icons": None,
             "wiersze": {}, "brak": []}
    przyg = [przygotuj(katalog.PO_ID[i], ust) for i in grupa_ids]
    for p in przyg:
        if p.rgba is None and p.a.id in zapisz_ids:
            wynik["brak"].append(p.a.id)
            wynik["wiersze"][p.a.id] = raport.Wiersz(p.a.id, "brak", uwagi=[
                ["ostrzezenie" if p.a.prio != "P0" else "blad", "Q01",
                 "brak źródła (art/zrodla ani art/zastepcze) — zostawiam poprzedni wynik"]])
    zapisz = set(zapisz_ids) - set(wynik["brak"])
    a0 = katalog.PO_ID[grupa_ids[0]]
    try:
        if a0.rola == "symbol":
            obsluz_symbole(przyg, zapisz, ust, wynik)
        elif a0.rola == "moneta" or a0.cel.get("grupa") == "spin":
            obsluz_pole_grupowe(przyg, zapisz, ust, wynik)
        else:
            p = przyg[0]
            if p.rgba is not None:
                obsluga = {"obiekt": obsluz_obiekt, "napis": obsluz_obiekt, "emblemat": obsluz_emblemat,
                           "ramka": obsluz_ramke, "panel9": obsluz_9slice, "przycisk9": obsluz_9slice,
                           "fx": obsluz_fx, "arkusz": obsluz_arkusz, "cyfry": obsluz_cyfry,
                           "tlo": obsluz_pelne, "okladka": obsluz_pelne, "baner": obsluz_pelne}[a0.rola]
                obsluga(p, ust, wynik)
    except Exception as e:  # jeden zepsuty obraz nie może zatrzymać całego pipeline'u
        import traceback
        traceback.print_exc()
        for i in zapisz:
            w = wynik["wiersze"].get(i) or raport.Wiersz(i, "?")
            w.uwagi.append(["blad", "Q00", f"wyjątek w obróbce: {e!r}"])
            wynik["wiersze"][i] = w
    return wynik


# ================================================================================================
# Manifest
# ================================================================================================
def wczytaj_manifest(sciezka: Path) -> dict:
    if sciezka.exists():
        try:
            return json.loads(sciezka.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            print("UWAGA: manifest.json uszkodzony — buduję od nowa")
    return {}


def usun_wpisy(manifest: dict, a: katalog.Asset) -> None:
    for k in [k for k in manifest.get("images", {}) if k == a.id or k.startswith(a.id + "__")]:
        del manifest["images"][k]
    for sekcja in ("sheets", "frames", "nineSlice"):
        manifest.get(sekcja, {}).pop(a.id, None)
    if a.rola == "cyfry":
        manifest.get("fonts", {}).pop("CebulionCyfry", None)


def posortuj(manifest: dict) -> dict:
    """Stała kolejność kluczy (kolejność katalogu) — diff w git pokazuje tylko prawdziwe zmiany."""
    kolej = {a.id: i for i, a in enumerate(katalog.ASSETY)}

    def klucz(k):
        baza, _, komorka = k.partition("__")
        komorki = katalog.KOMORKI.get(baza, [])
        return (kolej.get(baza, 999), komorki.index(komorka) if komorka in komorki else -1, k)
    out = {"version": manifest.get("version"), "pipeline": WERSJA_PIPELINE}
    for sekcja in ("images", "sheets", "frames", "nineSlice", "fonts", "icons"):
        dane = manifest.get(sekcja) or {}
        out[sekcja] = {k: dane[k] for k in sorted(dane, key=klucz)} if sekcja != "icons" else dane
    return out


def sieroty(katalog_img: Path, manifest: dict) -> list[Path]:
    """Pliki w assets/img, do których nie prowadzi żaden wpis manifestu (Q30)."""
    uzywane = {"manifest.json"}

    def zbierz(o):
        if isinstance(o, dict):
            for v in o.values():
                zbierz(v)
        elif isinstance(o, list):
            for v in o:
                zbierz(v)
        elif isinstance(o, str) and "/" in o and not o.startswith("data:"):
            uzywane.add(o)
    zbierz(manifest)
    for f in manifest.get("fonts", {}).values():
        for rel in f.get("fnt", {}).values():
            uzywane.add(rel.replace(".fnt", ".webp"))
    wynik = []
    for p in katalog_img.rglob("*"):
        if p.is_file():
            rel = p.relative_to(katalog_img).as_posix()
            if rel not in uzywane:
                wynik.append(p)
    return wynik


# ================================================================================================
# CLI
# ================================================================================================
def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description="Pipeline grafiki Cebulion Casino (kontrakt 09 § 3).")
    ap.add_argument("--tylko", help="lista ID albo pakietów (global, s1, s2, s3) rozdzielona przecinkami")
    ap.add_argument("--zrodla", default=str(REPO / "art/zrodla"), help="katalog z grafiką z ChatGPT")
    ap.add_argument("--zastepcze", default=str(REPO / "art/zastepcze"), help="katalog z grafiką zastępczą")
    ap.add_argument("--wyjscie", default=str(REPO / "src/main/resources/static/assets/img"))
    ap.add_argument("--raport", default=str(REPO / "art/raport"), help="katalog raportu (JSON + HTML)")
    ap.add_argument("--watki", type=int, default=min(4, os.cpu_count() or 1), help="liczba procesów")
    ap.add_argument("--dokladnie", action="store_true", help="WebP method=6 (mniejsze pliki, dużo wolniej)")
    ap.add_argument("--strict", action="store_true", help="ostrzeżenia traktuj jak błędy (kod wyjścia 2)")
    ap.add_argument("--sprzataj", action="store_true", help="usuń pliki-sieroty z assets/img")
    arg = ap.parse_args(argv)

    t0 = time.time()
    wzorce = [w.strip() for w in arg.tylko.split(",")] if arg.tylko else None
    wybrane = katalog.wybierz(wzorce)
    ust = {"zrodla": arg.zrodla, "zastepcze": arg.zastepcze, "wyjscie": arg.wyjscie,
           "metoda_webp": 6 if arg.dokladnie else 4}
    kat_img = Path(arg.wyjscie)
    kat_img.mkdir(parents=True, exist_ok=True)
    print(f"Cebulion Casino — pipeline grafiki {WERSJA_PIPELINE}: {len(wybrane)} assetów, {arg.watki} proc.")

    lista = zadania(wybrane)
    lista.sort(key=lambda z: -len(z[1]))          # duże grupy najpierw — lepsze rozłożenie pracy
    wyniki = []
    if arg.watki > 1 and len(lista) > 1:
        with ProcessPoolExecutor(max_workers=arg.watki) as pula:
            futury = [pula.submit(wykonaj_zadanie, z, g, ust) for z, g in lista]
            for f in futury:
                wyniki.append(f.result())
    else:
        wyniki = [wykonaj_zadanie(z, g, ust) for z, g in lista]

    # --- scalanie z istniejącym manifestem (assety bez źródła zachowują poprzedni wynik) ---
    sciezka_m = kat_img / "manifest.json"
    stary = wczytaj_manifest(sciezka_m)
    nowy = json.loads(json.dumps(stary)) if stary else {}
    for sekcja in ("images", "sheets", "frames", "nineSlice", "fonts"):
        nowy.setdefault(sekcja, {})
    wiersze = {}
    brak = set()
    for w in wyniki:
        brak.update(w["brak"])
        wiersze.update(w["wiersze"])
    nowe_klucze = {k for w in wyniki for k in w["images"]}
    for a in wybrane:
        if a.id in brak:
            if a.id not in stary.get("images", {}) and f"{a.id}__0" not in stary.get("images", {}):
                wiersze[a.id].uwagi.append(["ostrzezenie", "Q01", "brak też poprzedniego wyniku"])
            continue
        if not any(k == a.id or k.startswith(a.id + "__") for k in nowe_klucze):
            # obróbka się nie udała (np. nie znaleziono okna ramki) — lepiej zostawić poprzedni, działający wynik
            if a.id in wiersze:
                wiersze[a.id].uwagi.append(["blad", "Q00", "nie powstał nowy wynik — w manifeście zostaje poprzedni"])
            continue
        usun_wpisy(nowy, a)
    for w in wyniki:
        for sekcja in ("images", "sheets", "frames", "nineSlice", "fonts"):
            nowy[sekcja].update(w[sekcja])
        if w["icons"]:
            nowy["icons"] = w["icons"]
    nowy = posortuj(nowy)
    bez_wersji = {k: v for k, v in nowy.items() if k != "version"}
    stary_bez = {k: v for k, v in posortuj(stary).items() if k != "version"} if stary else None
    if stary and stary_bez == bez_wersji and stary.get("version"):
        nowy["version"] = stary["version"]           # nic się nie zmieniło → bez fałszywej zmiany w git
    else:
        nowy["version"] = dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")
    tekst = json.dumps(nowy, ensure_ascii=False, indent=1) + "\n"
    skala.zapisz(sciezka_m, tekst.encode("utf-8"))

    # --- kontrola spójności (Q30) ---
    if not wzorce:
        osierocone = sieroty(kat_img, nowy)
        if osierocone:
            if arg.sprzataj:
                for p in osierocone:
                    p.unlink()
                print(f"Usunięto pliki-sieroty: {len(osierocone)}")
            else:
                print(f"UWAGA Q30: {len(osierocone)} plików w assets/img bez wpisu w manifeście "
                      f"(np. {osierocone[0].relative_to(kat_img)}) — uruchom z --sprzataj")
    # brakujący plik z manifestu = zepsuty obrazek na froncie, więc to błąd wpływający na kod wyjścia
    brakujace_pliki = 0
    for img in nowy["images"].values():
        sciezki = [img.get("src"), img.get("src2x")] + [v.get(k) for v in img.get("variants", {}).values()
                                                        for k in ("src", "src2x")]
        for rel in filter(None, sciezki):
            if not (kat_img / rel).exists():
                print(f"BŁĄD Q30: w manifeście jest {rel}, ale pliku nie ma")
                brakujace_pliki += 1

    # --- raport ---
    kolej = {a.id: i for i, a in enumerate(katalog.ASSETY)}
    wiersze = dict(sorted(wiersze.items(), key=lambda kv: kolej.get(kv[0], 999)))
    wszystkie = {}
    if not wzorce:
        wszystkie = wiersze
    else:
        # do budżetów potrzebne są wagi wszystkich assetów — dla nieprzetwarzanych bierzemy poprzedni raport
        poprz = Path(arg.raport) / "raport.json"
        if poprz.exists():
            try:
                dane = json.loads(poprz.read_text(encoding="utf-8"))["obrazy"]
                wszystkie = {k: raport.Wiersz(**v) for k, v in dane.items()}
            except Exception:
                wszystkie = {}
        wszystkie.update(wiersze)
    bud = raport.budzety(wszystkie, katalog.ASSETY, katalog.BUDZETY)
    czas = time.time() - t0
    raport.drukuj(wiersze, bud, czas)
    bledy = sum(1 for w in wiersze.values() for u in w.uwagi if u[0] == "blad") + brakujace_pliki
    ostrz = sum(1 for w in wiersze.values() for u in w.uwagi if u[0] == "ostrzezenie")
    # --- Q02: pliki w art/zrodla, których pipeline nie użyje (literówka w nazwie, zły folder) ---
    nieznane = nieznane_pliki(Path(arg.zrodla))
    for k in nieznane:
        print(f"UWAGA Q02: {k}")
    ostrz += len(nieznane)
    for nazwa, b in bud.items():
        if b["desktop"] > b["limit"]:
            bledy += 1
            print(f"BŁĄD Q23: budżet {nazwa} przekroczony")
        elif b["desktop"] >= 0.85 * b["limit"]:
            ostrz += 1
    podsumowanie = {"pipeline": WERSJA_PIPELINE, "uruchomienie": nowy["version"], "bledy": bledy,
                    "ostrzezenia": ostrz, "nieznane_pliki": nieznane,
                    "chatgpt": sum(1 for w in wszystkie.values() if w.zrodlo == "chatgpt"),
                    "zastepcze": sum(1 for w in wszystkie.values() if w.zrodlo == "zastepcze")}
    kat_r = Path(arg.raport)
    raport.zapisz_json(kat_r / "raport.json", wszystkie, bud, podsumowanie)
    raport.zapisz_html(kat_r / "raport.html", wszystkie, kat_img, bud, podsumowanie)
    print(f"Błędy: {bledy}, ostrzeżenia: {ostrz}. Raport: {kat_r / 'raport.html'}")
    if bledy or (arg.strict and ostrz):
        return 2
    return 1 if ostrz else 0


if __name__ == "__main__":
    sys.exit(main())
