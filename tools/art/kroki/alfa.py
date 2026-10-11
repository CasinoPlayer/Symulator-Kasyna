"""
alfa.py — przezroczystość obrazów typu ALFA (02 § 5.2–5.5).

Po co to jest
-------------
ChatGPT nie zawsze oddaje prawdziwą przezroczystość. Typowe wady i to, co z nimi robimy:

1. **Fałszywa szachownica** — generator NARYSOWAŁ szaro-biały wzór „przezroczystości”. Wzór jest okresowy,
   więc znamy kolor tła w KAŻDYM pikselu, także pod krawędzią obiektu, i możemy policzyć alfę dokładnie.
2. **Jednolite tło** (białe, szare, czarne, zielone #00FF00...) — modelujemy kolor tła (stały albo łagodny
   gradient), liczymy odległość koloru ΔE w przestrzeni CIELAB i zamieniamy ją płynnie na alfę.
3. **Obwódki (halo)** — półprzezroczyste piksele krawędzi mają w sobie kolor dawnego tła. Na naszych prawie
   czarnych tłach jasna obwódka bardzo razi, więc „odkażamy” kolor krawędzi.
4. **Pyłki** — drobne, niewidoczne śmieci w alfie powiększają prostokąt przycięcia i wagę pliku.

Wszystkie funkcje przyjmują i zwracają RGBA float32 0–1 (alfa nie premultiplikowana).
"""

from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np

from .obraz import (Skladowe, dylatacja, erozja, jasnosc, nasycenie, otsu, pas_brzegowy, rgb_do_lab,
                    rozlej_kolor, smoothstep)

PROG_ZERO = 6 / 255      # α poniżej → 0 (niewidoczny szum)
PROG_PELNY = 249 / 255   # α powyżej → 1


@dataclass
class WynikAlfy:
    rgba: np.ndarray
    metoda: str = "alfa"           # alfa | szachownica | jednolite | brak
    pewnosc: float = 1.0
    uwagi: list = field(default_factory=list)   # (poziom, kod, tekst)


# ------------------------------------------------------------------------------------------------
# 1. Klasyfikacja
# ------------------------------------------------------------------------------------------------
def ma_prawdziwa_alfe(rgba: np.ndarray) -> bool:
    """Prawdziwa alfa = brzeg obrazu jest w większości przezroczysty (obiekt stoi na niczym)."""
    H, W = rgba.shape[:2]
    pas = pas_brzegowy(H, W, max(4, int(0.03 * min(H, W))))
    return float((rgba[..., 3][pas] < 0.05).mean()) >= 0.6


# ------------------------------------------------------------------------------------------------
# 2. Fałszywa szachownica
# ------------------------------------------------------------------------------------------------
@dataclass
class Szachownica:
    c1: np.ndarray       # kolor jaśniejszych pól (RGB 0–1)
    c2: np.ndarray       # kolor ciemniejszych pól
    px: float            # okres w poziomie (rozmiar pola, może być ułamkowy)
    py: float
    x0: float            # faza (położenie granicy pól)
    y0: float
    parzystosc: int      # 0 albo 1 — które pola są jasne
    pewnosc: float


def _okres_i_faza(pozycje: np.ndarray, p0: float) -> tuple[float, float, float]:
    """Okres i faza siatki z położeń granic pól metodą statystyki kołowej.

    Każdą pozycję x zamieniamy na kąt 2π·x/p. Jeśli p jest prawdziwym okresem, kąty „zgadzają się”
    i średni wektor jednostkowy ma długość bliską 1. Przeszukujemy p wokół wstępnego oszacowania p0
    (dzięki temu działa też okres ułamkowy, np. 23,7 px po przeskalowaniu obrazu przez generator).
    """
    najlepsze = (0.0, p0, 0.0)
    for p in np.arange(max(3.0, p0 - 2.0), p0 + 2.0, 0.02):
        z = np.exp(2j * np.pi * pozycje / p).mean()
        if abs(z) > najlepsze[0]:
            najlepsze = (abs(z), p, (np.angle(z) / (2 * np.pi) * p) % p)
    return najlepsze[1], najlepsze[2], najlepsze[0]


def wykryj_szachownice(rgb: np.ndarray) -> Szachownica | None:
    """Szuka narysowanej szachownicy w pasie brzegowym obrazu (02 § 5.3). None = to nie szachownica."""
    H, W = rgb.shape[:2]
    b = max(8, int(round(0.04 * min(H, W))))
    pas = pas_brzegowy(H, W, b)
    L = jasnosc(rgb)
    S = nasycenie(rgb)
    if float((S[pas] > 18 / 255).mean()) > 0.15:          # szachownica jest szara
        return None
    t = otsu(L[pas])
    jas = pas & (L > t)
    ciem = pas & (L <= t)
    if jas.sum() < 0.2 * pas.sum() or ciem.sum() < 0.2 * pas.sum():
        return None                                         # jedna grupa = tło jednolite, nie wzór
    c1 = np.median(rgb[jas], axis=0)
    c2 = np.median(rgb[ciem], axis=0)
    roznica = float(jasnosc(c1) - jasnosc(c2))
    if not (6 / 255 <= roznica <= 90 / 255):
        return None
    blisko = (np.abs(rgb[pas] - c1).max(-1) <= 14 / 255) | (np.abs(rgb[pas] - c2).max(-1) <= 14 / 255)
    if float(blisko.mean()) < 0.75:
        return None

    # --- okres: długości serii jednego koloru w wierszach górnego pasa i kolumnach lewego pasa ---
    klasa = L > t

    def serie(linie: np.ndarray):
        dl, poz = [], []
        for linia in linie:
            zm = np.flatnonzero(np.diff(linia.astype(np.int8)) != 0) + 1
            if len(zm) >= 3:
                dl.extend(np.diff(zm).tolist())
                poz.extend(zm.tolist())
        return np.array(dl, dtype=np.float64), np.array(poz, dtype=np.float64)

    dl_x, poz_x = serie(klasa[:b, :])
    dl_y, poz_y = serie(klasa[:, :b].T)
    if len(dl_x) < 8 or len(dl_y) < 8:
        return None
    wynik = []
    for dl, poz in ((dl_x, poz_x), (dl_y, poz_y)):
        dl = dl[(dl >= 4) & (dl <= 160)]
        if len(dl) < 8:
            return None
        p0 = float(np.median(dl))
        if float((np.abs(dl - p0) <= max(2.0, 0.12 * p0)).mean()) < 0.6:
            return None
        wynik.append(_okres_i_faza(poz, p0))
    (px, x0, zx), (py, y0, zy) = wynik
    if min(zx, zy) < 0.6:
        return None

    # --- parzystość i pewność: porównanie pasa z syntetycznym wzorem ---
    szach = Szachownica(c1, c2, px, py, x0, y0, 0, 0.0)
    najlepsza = None
    for parz in (0, 1):
        szach.parzystosc = parz
        D, _ = odleglosc_od_wzoru(rgb, szach, maska=pas)
        pewn = float((D <= 12 / 255).mean())
        if najlepsza is None or pewn > najlepsza[1]:
            najlepsza = (parz, pewn)
    szach.parzystosc, szach.pewnosc = najlepsza
    return szach if szach.pewnosc >= 0.5 else None


def odleglosc_od_wzoru(rgb: np.ndarray, s: Szachownica, maska: np.ndarray | None = None):
    """Odległość każdego piksela od wzoru szachownicy i kolor tła B w tym pikselu.

    Na granicach pól generator zwykle wygładza wzór (antyaliasing), więc tam tłem może być dowolna
    mieszanka c1 i c2 — liczymy wtedy odległość od ODCINKA [c2, c1] w przestrzeni RGB, a B = rzut na odcinek.
    """
    H, W = rgb.shape[:2]
    yy, xx = np.mgrid[0:H, 0:W]
    if maska is not None:
        yy, xx, I = yy[maska], xx[maska], rgb[maska]
    else:
        I = rgb
    fx = (xx - s.x0) / s.px
    fy = (yy - s.y0) / s.py
    pole = (np.floor(fx) + np.floor(fy) + s.parzystosc) % 2
    B = np.where((pole == 0)[..., None], s.c1, s.c2).astype(np.float32)
    # odległość (w px) do najbliższej linii siatki
    dgx = np.abs(fx - np.round(fx)) * s.px
    dgy = np.abs(fy - np.round(fy)) * s.py
    granica = np.minimum(dgx, dgy) < 1.6
    D = np.abs(I - B).max(-1)
    # rzut na odcinek c2→c1 dla pikseli przy granicy pól
    v = (s.c1 - s.c2).astype(np.float32)
    t = np.clip(((I - s.c2) @ v) / max(float(v @ v), 1e-6), 0, 1)
    rzut = s.c2 + t[..., None] * v
    Dg = np.abs(I - rzut).max(-1)
    D = np.where(granica, np.minimum(D, Dg), D)
    B = np.where(granica[..., None] & (Dg < np.abs(I - B).max(-1))[..., None], rzut, B)
    return D.astype(np.float32), B.astype(np.float32)


def usun_szachownice(rgba: np.ndarray, s: Szachownica, rola: str) -> np.ndarray:
    """Liczy prawdziwą alfę obrazu z narysowaną szachownicą (02 § 5.3, kroki 4–6)."""
    rgb = rgba[..., :3]
    H, W = rgb.shape[:2]
    D, B = odleglosc_od_wzoru(rgb, s)
    tlo_kand = D <= 10 / 255
    sk = Skladowe(tlo_kand)
    wybor = sk.brzeg.copy()
    # „dziury” w obiekcie (między ogonkami wiśni, okno ramki): duże składowe wewnętrzne, które zawierają
    # pola OBU kolorów — sam biały odblask na obiekcie pasowałby tylko do jasnych pól.
    skala = (H * W) / (1024 * 1024)
    min_pole = max(400 * skala, 2 * s.px * s.py)
    jasne = (np.abs(rgb - s.c1).max(-1) < np.abs(rgb - s.c2).max(-1))
    for k in np.flatnonzero((sk.pole >= min_pole) & ~sk.brzeg):
        if k == 0:
            continue
        m = sk.etykiety[sk.y0[k]:sk.y1[k], sk.x0[k]:sk.x1[k]] == k
        j = jasne[sk.y0[k]:sk.y1[k], sk.x0[k]:sk.x1[k]][m].mean()
        if 0.2 <= j <= 0.8:
            wybor[k] = True
    tlo = sk.maska(wybor)
    return _alfa_z_tla(rgba, tlo, B, D, prog_tla=10 / 255, prog_strefy=60 / 255)


# ------------------------------------------------------------------------------------------------
# 3. Jednolite tło
# ------------------------------------------------------------------------------------------------
def model_tla(rgb: np.ndarray) -> tuple[np.ndarray, float, bool]:
    """Kolor tła w każdym pikselu: stały (mediana pasa) albo powierzchnia kwadratowa dopasowana metodą
    najmniejszych kwadratów do pikseli pasa (radzi sobie z winietą i lekkim gradientem). Zwraca też
    odchylenie pasa i informację, czy dopasowanie jest wiarygodne."""
    H, W = rgb.shape[:2]
    b = max(4, int(round(0.03 * min(H, W))))
    pas = pas_brzegowy(H, W, b)
    piks = rgb[pas]
    odch = float(piks.std(axis=0).max())
    if odch <= 3 / 255:
        return np.broadcast_to(np.median(piks, axis=0), rgb.shape).astype(np.float32), odch, True
    yy, xx = np.mgrid[0:H, 0:W]
    xn, yn = xx / W - 0.5, yy / H - 0.5
    A = np.stack([np.ones_like(xn), xn, yn, xn * xn, xn * yn, yn * yn], -1)
    wsp, *_ = np.linalg.lstsq(A[pas], piks, rcond=None)
    B = (A @ wsp).astype(np.float32)
    reszta = float(np.abs(B[pas] - piks).max(-1).mean())
    return np.clip(B, 0, 1), odch, reszta <= 10 / 255


def usun_jednolite_tlo(rgba: np.ndarray, rola: str) -> tuple[np.ndarray, list]:
    """Usuwa tło jednolite (02 § 5.4).

    1. Model tła B (stały kolor albo łagodna powierzchnia) i odległość koloru ΔE76 każdego piksela od B.
    2. Pewne tło = obszary z ΔE < 6 POŁĄCZONE z brzegiem obrazu (dzięki temu biały odblask na złocie przy białym
       tle zostaje nietknięty) + duże „dziury” w obiekcie o kolorze tła (okno ramki, przestrzeń między wiśniami).
    3. Strefa przejścia (krawędź, poświata) → alfa z rzutu na kierunek „tło → kolor obiektu” (patrz
       ``_alfa_z_tla``), ograniczona z góry płynną funkcją ΔE.
    """
    uwagi = []
    rgb = rgba[..., :3]
    H, W = rgb.shape[:2]
    B, odch, ok = model_tla(rgb)
    if not ok:
        uwagi.append(("blad", "Q06", "tło nie jest ani przezroczyste, ani jednolite — obraz do ponownego wygenerowania"))
        return rgba, uwagi
    dE = np.linalg.norm(rgb_do_lab(rgb) - rgb_do_lab(B), axis=-1).astype(np.float32)
    kolor_tla = B[H // 2, 0]
    chroma = float(nasycenie(np.asarray(kolor_tla))) > 0.35       # np. #00FF00 — kolor, którego nie ma w obiekcie
    sk = Skladowe(dE < 6)
    wybor = sk.brzeg.copy()
    skala = (H * W) / (1024 * 1024)
    for k in np.flatnonzero(~sk.brzeg):
        if k == 0:
            continue
        m = sk.etykiety[sk.y0[k]:sk.y1[k], sk.x0[k]:sk.x1[k]] == k
        sredni = float(dE[sk.y0[k]:sk.y1[k], sk.x0[k]:sk.x1[k]][m].mean())
        if chroma and sk.pole[k] >= 100 * skala and sredni < 4:
            wybor[k] = True                                   # dziura w obiekcie na zielonym tle
        elif rola == "ramka" and sk.pole[k] >= 0.04 * H * W and sredni < 4:
            wybor[k] = True                                   # okno ramki na białym/czarnym tle
        elif sk.pole[k] >= 0.01 * H * W and sredni < 2:
            wybor[k] = True                                   # duża, idealnie zgodna z tłem dziura
    tlo = sk.maska(wybor)
    wynik = _alfa_z_tla(rgba, tlo, B, dE, prog_tla=6.0, prog_strefy=30.0)
    if chroma:
        wynik = _usun_przebarwienie(wynik, kolor_tla)
    # ryzyko: obrys obiektu podobny do tła (ciemny obiekt na czerni, krem na bieli)
    obrys = dylatacja(tlo, 1) & ~tlo
    if obrys.any() and float((dE[obrys] < 10).mean()) > 0.3:
        uwagi.append(("ostrzezenie", "Q06", "niski kontrast obiektu z tłem — sprawdź krawędzie, rozważ ponowne wygenerowanie"))
    return wynik, uwagi


def _usun_przebarwienie(rgba: np.ndarray, kolor_tla: np.ndarray) -> np.ndarray:
    """Despill: kolorowe tło (np. zielone) odbija się na krawędziach obiektu. Przy krawędzi ograniczamy
    kanał dominujący tła do poziomu pozostałych kanałów (im bliżej przezroczystości, tym mocniej)."""
    k = int(np.argmax(kolor_tla))
    inne = [i for i in range(3) if i != k]
    a = rgba[..., 3]
    przy_krawedzi = dylatacja(a < 0.98, 2) & (a > 0)
    rgb = rgba[..., :3].copy()
    nadmiar = np.maximum(0, rgb[..., k] - rgb[..., inne].max(-1))
    w = np.where(przy_krawedzi, 0.85, 0.0) * (1 - 0.5 * a)
    rgb[..., k] -= nadmiar * w
    out = rgba.copy()
    out[..., :3] = rgb
    return out


# ------------------------------------------------------------------------------------------------
# Wspólne: alfa z pewnego tła + pas krawędzi
# ------------------------------------------------------------------------------------------------
def _alfa_z_tla(rgba, tlo, B, D, prog_tla, prog_strefy):
    """Alfa w strefie przejścia między pewnym tłem a obiektem.

    Strefa = piksele „podobne do tła” (D < prog_strefy) połączone z pewnym tłem + pas 4 px wokół tła — to
    krawędź z antyaliasingiem i ewentualna poświata. Model mieszania: ``I = B·(1 − α) + F·α``, gdzie F to kolor
    obiektu. F bierzemy z najbliższych pikseli obiektu (``rozlej_kolor``), a alfę z rzutu
    ``α = ((I − B)·(F − B)) / |F − B|²``. Gdy F jest prawie równe B (np. biel na bieli), rzut jest niepewny —
    wtedy alfa = smoothstep(D). Dzięki strefie (a nie tylko wąskiemu pasowi) półprzezroczysta poświata nie
    zamienia się w kryjącą obwódkę.
    """
    rgb = rgba[..., :3]
    sk = Skladowe(D < prog_strefy)
    zawiera_tlo = np.zeros(sk.n + 1, dtype=bool)
    zawiera_tlo[np.unique(sk.etykiety[tlo])] = True
    strefa = (sk.maska(zawiera_tlo) | dylatacja(tlo, 4)) & ~tlo
    obiekt = ~tlo & ~strefa
    F, znane = rozlej_kolor(rgb, obiekt, kroki=10)
    FB = F - B
    IB = rgb - B
    mianownik = (FB * FB).sum(-1)
    alfa_rzut = np.clip((IB * FB).sum(-1) / np.maximum(mianownik, 1e-6), 0, 1)
    alfa_D = smoothstep(D, prog_tla, prog_strefy)
    pewny_rzut = (mianownik > 0.02) & znane
    alfa_s = np.where(pewny_rzut, alfa_rzut, alfa_D)
    alfa = np.ones(tlo.shape, dtype=np.float32)
    alfa[tlo] = 0.0
    alfa[strefa] = alfa_s[strefa]
    return _odkaz(rgba, alfa, B)


def _odkaz(rgba, alfa, B):
    """Odkażenie koloru: z I = B·(1−α) + F·α wyliczamy czysty kolor obiektu F = (I − (1−α)·B) / α."""
    rgb = rgba[..., :3]
    a = alfa[..., None]
    czysty = np.where(a >= 0.05, (rgb - (1 - a) * B) / np.maximum(a, 0.05), rgb)
    out = np.empty_like(rgba)
    out[..., :3] = np.clip(czysty, 0, 1)
    out[..., 3] = np.minimum(alfa, rgba[..., 3])
    return out


# ------------------------------------------------------------------------------------------------
# 4. Obwódki, pyłki, progi
# ------------------------------------------------------------------------------------------------
def defringe(rgba: np.ndarray) -> np.ndarray:
    """Usuwanie jasnych obwódek przy prawdziwej alfie (02 § 5.5 pkt 3). Kolor odniesienia = kolor
    najbliższego w pełni kryjącego piksela; jaśniejszy i mniej nasycony piksel krawędzi przyciągamy do niego
    tym mocniej, im bardziej jest przezroczysty: ``RGB' = RGB + w·(ref − RGB)``, ``w = (1 − α)^0,8``."""
    a = rgba[..., 3]
    pelne = a >= PROG_PELNY
    if not pelne.any():
        return rgba
    ref, znane = rozlej_kolor(rgba[..., :3], pelne, kroki=6)
    rgb = rgba[..., :3]
    krawedz = (a > 0) & (a < PROG_PELNY) & znane
    jas_p, jas_r = jasnosc(rgb), jasnosc(ref)
    halo = krawedz & (jas_p > jas_r * 1.12 + 0.01) & (nasycenie(rgb) <= nasycenie(ref) + 0.02)
    w = np.where(halo, (1 - a) ** 0.8, 0.0)[..., None]
    out = rgba.copy()
    out[..., :3] = rgb + w * (ref - rgb)
    # pod pikselami całkiem przezroczystymi zostawiamy kolor sąsiada — lepiej się kompresuje i skaluje
    out[..., :3] = np.where((a == 0)[..., None] & znane[..., None], ref, out[..., :3])
    return out


def progi_alfy(rgba: np.ndarray) -> np.ndarray:
    out = rgba.copy()
    a = out[..., 3]
    a[a < PROG_ZERO] = 0.0
    a[a > PROG_PELNY] = 1.0
    return out


def usun_pylki(rgba: np.ndarray) -> tuple[np.ndarray, int]:
    """Usuwa składowe alfy < 0,01% płótna położone dalej niż 2% od głównego obiektu (02 § 5.5 pkt 2)."""
    H, W = rgba.shape[:2]
    sk = Skladowe(rgba[..., 3] > 0.02)
    if sk.n <= 1:
        return rgba, 0
    glowna = int(np.argmax(sk.pole[1:])) + 1
    m = int(0.02 * max(H, W))
    gx0, gy0, gx1, gy1 = sk.x0[glowna] - m, sk.y0[glowna] - m, sk.x1[glowna] + m, sk.y1[glowna] + m
    male = sk.pole < 0.0001 * H * W
    daleko = (sk.x1 < gx0) | (sk.x0 > gx1) | (sk.y1 < gy0) | (sk.y0 > gy1)
    usun = male & daleko
    usun[0] = False
    if not usun.any():
        return rgba, 0
    out = rgba.copy()
    out[..., 3][sk.maska(usun)] = 0.0
    return out, int(usun.sum())


def miara_obwodki(rgba: np.ndarray) -> float:
    """Q09: o ile jaśniejszy (L*) jest pierścień krawędzi złożony na #07060F od „idealnej” krawędzi, czyli koloru
    wnętrza obiektu zmieszanego z tłem w tej samej proporcji alfy. > +8 = jasna obwódka, < −12 = ciemna."""
    a = rgba[..., 3]
    pierscien = (a > 0.1) & (a < 0.9)
    pelne = a > 0.98
    wnetrze = erozja(pelne, 3) & ~erozja(pelne, 6)
    if pierscien.sum() < 50 or wnetrze.sum() < 50:
        return 0.0
    tlo = np.array([7, 6, 15], dtype=np.float32) / 255
    zlozone = rgba[..., :3] * a[..., None] + tlo * (1 - a[..., None])
    L = rgb_do_lab(zlozone)[..., 0]
    sr_a = float(a[pierscien].mean())
    oczekiwany_kolor = rgba[..., :3][wnetrze].mean(0) * sr_a + tlo * (1 - sr_a)
    oczekiwane = float(rgb_do_lab(oczekiwany_kolor[None, None, :])[0, 0, 0])
    return float(L[pierscien].mean() - oczekiwane)


# ------------------------------------------------------------------------------------------------
# Główne wejście
# ------------------------------------------------------------------------------------------------
def napraw_alfe(rgba: np.ndarray, rola: str = "obiekt", pylki: bool = True) -> WynikAlfy:
    """Pełna ścieżka ALFA: wykrycie rodzaju tła → naprawa → obwódki → progi → pyłki."""
    wynik = WynikAlfy(rgba)
    if ma_prawdziwa_alfe(rgba):
        wynik.metoda = "alfa"
        out = defringe(rgba)
    else:
        kryjace = float((rgba[..., 3] > 0.98).mean())
        if kryjace < 0.97:
            wynik.uwagi.append(("ostrzezenie", "Q06", "częściowa przezroczystość bez przezroczystego brzegu — sprawdź obraz"))
        rgb = rgba[..., :3]
        szach = wykryj_szachownice(rgb)
        if szach is not None and szach.pewnosc >= 0.8:
            out = usun_szachownice(rgba, szach, rola)
            out = defringe(out)
            wynik.metoda, wynik.pewnosc = "szachownica", szach.pewnosc
            poziom = "ostrzezenie" if szach.pewnosc < 0.9 else "info"
            wynik.uwagi.append((poziom, "Q06", f"naprawiono fałszywą szachownicę (pole {szach.px:.1f} px, "
                                               f"pewność {szach.pewnosc:.2f})"))
        else:
            out, uw = usun_jednolite_tlo(rgba, rola)
            wynik.uwagi.extend(uw)
            if any(p == "blad" for p, *_ in uw):
                wynik.metoda = "brak"
            else:
                out = defringe(out)
                wynik.metoda = "jednolite"
                wynik.uwagi.append(("info", "Q06", "usunięto jednolite tło (brak prawdziwej przezroczystości)"))
    out = progi_alfy(out)
    # Q09 tylko tam, gdzie krawędź alfy wyliczył pipeline (usunięta szachownica / jednolite tło) — wtedy obwódka
    # jest artefaktem wycinania. Przy prawdziwej alfie krawędź jest decyzją autora (np. celowy ciemny kontur
    # napisu), a miara nie odróżnia konturu od halo — taką krawędź oceniamy na miniaturach w raporcie.
    if wynik.metoda in ("szachownica", "jednolite"):
        obw = miara_obwodki(out)
        if obw > 8:
            wynik.uwagi.append(("ostrzezenie", "Q09", f"jasna obwódka na krawędzi (+{obw:.0f} L*) — sprawdź na ciemnym tle"))
        elif obw < -12:
            wynik.uwagi.append(("ostrzezenie", "Q09", f"ciemna obwódka na krawędzi ({obw:.0f} L*)"))
    if pylki:
        out, n = usun_pylki(out)
        if n:
            wynik.uwagi.append(("info", "Q10", f"usunięto pyłki: {n}"))
    wynik.rgba = out
    return wynik


def przytnij(rgba: np.ndarray, margines_proc: float = 0.02, min_px: int = 4, prog: float = 8 / 255):
    """Przycięcie do prostokąta pikseli z α ≥ 8/255 + margines (02 § 5.6). Zwraca (obraz, prostokąt, dotyka)."""
    a = rgba[..., 3]
    ys, xs = np.nonzero(a >= prog)
    H, W = a.shape
    if len(xs) == 0:
        return rgba, (0, 0, W, H), False
    x0, x1, y0, y1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
    dotyka = bool((a[:2, :] > 32 / 255).any() or (a[-2:, :] > 32 / 255).any()
                  or (a[:, :2] > 32 / 255).any() or (a[:, -2:] > 32 / 255).any())
    m = max(min_px, int(round(margines_proc * max(x1 - x0, y1 - y0))))
    pad = ((max(0, m - y0), max(0, y1 + m - H)), (max(0, m - x0), max(0, x1 + m - W)), (0, 0))
    wyc = rgba[max(0, y0 - m):min(H, y1 + m), max(0, x0 - m):min(W, x1 + m)]
    if any(p for pp in pad[:2] for p in pp):
        wyc = np.pad(wyc, pad)
    return wyc, (int(x0), int(y0), int(x1), int(y1)), dotyka
