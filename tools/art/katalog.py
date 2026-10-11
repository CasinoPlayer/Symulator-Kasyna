"""
katalog.py — jedna lista wszystkich 85 assetów graficznych Cebulion Casino.

Po co to jest
-------------
Z tej samej listy korzystają dwa narzędzia:

* ``tools/art/przetworz.py`` — pipeline, który z PNG robi gotowe WebP i ``manifest.json``,
* ``tools/art/zastepcze/generuj_wszystko.py`` — generatory grafiki zastępczej.

Dzięki temu identyfikatory, formaty, typy tła i rozmiary docelowe są wpisane w JEDNYM miejscu
(zgodnie z briefem § 7 i dokumentem ``docs/projekt/02-lista-obrazow.md``). Makiety (``m01``–``m08``)
celowo tu nie występują — nie trafiają do aplikacji (kontrakt 09 § 3).

Rozmiary docelowe (@1x = piksele CSS na widoku referencyjnym 1920×1080, @2x = dwa razy więcej pikseli)
pochodzą z tabel w 02 § 3 i są uzasadnione w 02 § 2.6:

* pole symbolu S1 = 256 px, S2 = 192 px, S3 = 144 px (projektowe pola 180–220 / 150–190 / 110–140 px CSS
  z zapasem na puls wygranej ×1,12),
* tła desktop: szerokości 1280 / 1920 (= @1x) / 2560 (= @2x), mobile: 720 / 1080 (= @1x) / 1280 (= @2x),
* efekty miękkie (promienie, flara, iskry, dym, błyskawice) mają jedną rozdzielczość — rozmyty gradient nic nie
  zyskuje na @2x, a oszczędzamy 75% pikseli.
"""

from __future__ import annotations

from dataclasses import dataclass, field

# Formaty z ChatGPT (brief § 6): proporcja → wymiary w pikselach.
FORMATY = {
    "1:1": (1024, 1024),
    "3:2": (1536, 1024),
    "2:3": (1024, 1536),
}

PAKIETY = ("global", "s1", "s2", "s3")

# Nazwy komórek arkuszy (02 § 2.3). Kolejność: wierszami, od lewej-góry. Komórki numerowane liczymy od 0,
# bo tak samo liczy kod (np. avatarIndex 0–7 z API, kontrakt 09 § 2.1).
KOMORKI = {
    "g_awatary": [str(i) for i in range(8)],
    "g_font_cyfry": [str(i) for i in range(10)] + ["przecinek", "plus", "razy"],
    "g_ui_ikony": ["autoplay", "turbo", "minus", "plus", "dzwiek_wl", "dzwiek_wyl",
                   "info", "menu", "lobby", "zamknij", "ustawienia", "historia"],
    "g_fx_iskry": [str(i) for i in range(8)],
    "g_fx_blyskawice": [str(i) for i in range(3)],
    "g_fx_konfetti": [str(i) for i in range(12)],
    "s2_fx_hieroglify": [str(i) for i in range(8)],
    "s3_fx_odlamki": [str(i) for i in range(12)],
}

# Znak, który przedstawia dana komórka arkusza cyfr — potrzebny do BitmapFont (kod Unicode znaku).
ZNAKI_CYFR = {**{str(i): str(i) for i in range(10)}, "przecinek": ",", "plus": "+", "razy": "×"}


@dataclass(frozen=True)
class Asset:
    """Opis jednego obrazu z briefu § 7.

    Pola ``rola`` i ``cel`` mówią pipeline'owi, JAK obrabiać obraz i do jakiego rozmiaru go doprowadzić.
    """

    id: str
    format: str               # '1:1' | '3:2' | '2:3'
    tlo: str                  # 'ALFA' | 'CZARNE' | 'PELNE'
    rola: str                 # symbol, obiekt, tlo, okladka, baner, ramka, panel9, przycisk9, fx, arkusz, napis ...
    prio: str                 # P0 / P1 / P2
    opis: str
    cel: dict = field(default_factory=dict)   # parametry rozmiaru (zależne od roli)
    siatka: tuple | None = None               # (kolumny, wiersze) dla arkuszy
    paczki: tuple = ()                        # gdzie asset jest pobierany (do liczenia budżetów wagi)

    @property
    def pakiet(self) -> str:
        """Pakiet = prefiks ID (g_ → global, s1_ → s1 ...). Wyznacza podkatalog w art/ i assets/img/."""
        return "global" if self.id.startswith("g_") else self.id.split("_", 1)[0]

    @property
    def wymiary_zrodla(self) -> tuple[int, int]:
        return FORMATY[self.format]

    @property
    def komorki(self) -> list[str] | None:
        return KOMORKI.get(self.id)


def _sym(id_, poziom, pole, opis, prio, paczka):
    """Symbol bębna: kwadratowe pole ``pole`` px @1x, normalizacja wielkości w grupie (gra + poziom)."""
    return Asset(id_, "1:1", "ALFA", "symbol", prio, opis,
                 cel={"pole": pole, "poziom": poziom, "grupa": f"{id_[:2]}:{poziom}"}, paczki=(paczka,))


def _tlo(id_, opis, prio, paczka):
    """Tło PELNE: warianty szerokości (desktop 3:2 albo mobile 2:3), 02 § 5.17."""
    mobile = id_.endswith("_mobile")
    szer = (720, 1080, 1280) if mobile else (1280, 1920, 2560)
    return Asset(id_, "2:3" if mobile else "3:2", "PELNE", "tlo", prio, opis,
                 cel={"szerokosci": szer, "x1": szer[1], "x2": szer[2],
                      "focus": (0.5, 0.5) if mobile else (0.5, 0.45), "rozmyte": 480 if mobile else 640},
                 paczki=(paczka,))


# --------------------------------------------------------------------------------------------------------
# PEŁNA LISTA (brief § 7, kolejność czatów 1–5). Paczki: lobby, wspolne (część wspólna gier), s1, s2, s3.
# --------------------------------------------------------------------------------------------------------
ASSETY: list[Asset] = [
    # ---- Czat 1 — GLOBAL A -------------------------------------------------------------------------
    Asset("g_logo", "3:2", "ALFA", "obiekt", "P0", "logotyp CEBULION CASINO z emblematem",
          cel={"szer": 720, "warianty": ["glowzl"]}, paczki=("lobby",)),
    Asset("g_emblemat", "1:1", "ALFA", "emblemat", "P0", "emblemat: złota cebula w koronie na medalionie",
          cel={"bok": 192, "warianty": ["naglowek"]}, paczki=("lobby", "wspolne")),
    Asset("g_moneta_przod", "1:1", "ALFA", "moneta", "P0", "moneta cebulion z przodu",
          cel={"pole": 256, "grupa": "monety", "warianty": ["male", "ikona"]}, paczki=("lobby", "wspolne")),
    Asset("g_moneta_skos", "1:1", "ALFA", "moneta", "P0", "moneta pochylona ~45°",
          cel={"pole": 256, "grupa": "monety", "warianty": ["male"]}, paczki=("lobby", "wspolne")),
    Asset("g_moneta_bok", "1:1", "ALFA", "moneta", "P0", "moneta prawie z boku",
          cel={"pole": 256, "grupa": "monety", "warianty": ["male"]}, paczki=("lobby", "wspolne")),
    _tlo("g_tlo_lobby_desktop", "luksusowe wnętrze kasyna nocą (poziomo)", "P0", "lobby"),
    _tlo("g_tlo_lobby_mobile", "luksusowe wnętrze kasyna nocą (pionowo)", "P0", "lobby"),
    Asset("g_maskotka_powitanie", "1:1", "ALFA", "obiekt", "P0", "Pan Cebulion wita",
          cel={"wys": 480}, paczki=("lobby",)),
    Asset("g_maskotka_wygrana", "1:1", "ALFA", "obiekt", "P1", "Pan Cebulion świętuje",
          cel={"wys": 420}, paczki=("lobby", "wspolne")),
    Asset("g_maskotka_bankrut", "1:1", "ALFA", "obiekt", "P1", "Pan Cebulion z pustymi kieszeniami",
          cel={"wys": 420}, paczki=("lobby", "wspolne")),
    Asset("g_skrzynia", "1:1", "ALFA", "obiekt", "P0", "otwarta skrzynia pełna monet",
          cel={"bok": 480, "warianty": ["glowzl"]}, paczki=("lobby",)),
    Asset("g_awatary", "3:2", "ALFA", "arkusz", "P1", "8 okrągłych awatarów (4×2)",
          cel={"komorka": 64, "dopasuj": "kolo"}, siatka=(4, 2), paczki=("lobby",)),
    Asset("g_font_cyfry", "3:2", "ALFA", "cyfry", "P0", "złote cyfry 0–9 , + × (5×3)",
          cel={"wys_cyfry": 96}, siatka=(5, 3), paczki=("lobby", "wspolne")),

    # ---- Czat 2 — GLOBAL B -------------------------------------------------------------------------
    Asset("g_ui_spin", "1:1", "ALFA", "obiekt", "P0", "przycisk SPIN",
          cel={"pole": 144, "grupa": "spin", "warianty": ["glowzl"]}, paczki=("wspolne",)),
    Asset("g_ui_spin_stop", "1:1", "ALFA", "obiekt", "P0", "przycisk STOP",
          cel={"pole": 144, "grupa": "spin"}, paczki=("wspolne",)),
    Asset("g_ui_ikony", "3:2", "ALFA", "arkusz", "P0", "12 ikon-przycisków (4×3)",
          cel={"komorka": 56, "dopasuj": "kolo", "ui": True}, siatka=(4, 3), paczki=("lobby", "wspolne")),
    Asset("g_ui_panel", "1:1", "ALFA", "panel9", "P0", "panel modala 9-slice",
          cel={"szer": 460, "ui": True}, paczki=("lobby", "wspolne")),
    Asset("g_ui_przycisk_glowny", "3:2", "ALFA", "przycisk9", "P0", "złoty przycisk-pigułka 9-slice",
          cel={"wys": 80, "ui": True}, paczki=("lobby", "wspolne")),
    Asset("g_ui_przycisk_drugi", "3:2", "ALFA", "przycisk9", "P0", "szklany przycisk-pigułka 9-slice",
          cel={"wys": 80, "ui": True}, paczki=("lobby", "wspolne")),
    Asset("g_ui_ornament", "3:2", "ALFA", "obiekt", "P1", "złoty ornament nagłówka",
          cel={"szer": 480}, paczki=("lobby", "wspolne")),
    Asset("g_win_big", "3:2", "ALFA", "napis", "P0", "BIG WIN",
          cel={"pudelko": (960, 640), "warianty": ["glow", "cien"]}, paczki=("wspolne",)),
    Asset("g_win_mega", "3:2", "ALFA", "napis", "P1", "MEGA WIN",
          cel={"pudelko": (960, 640), "warianty": ["glow", "cien"]}, paczki=("wspolne",)),
    Asset("g_win_epic", "3:2", "ALFA", "napis", "P1", "EPIC WIN",
          cel={"pudelko": (960, 640), "warianty": ["glow", "cien"]}, paczki=("wspolne",)),
    Asset("g_win_ultra", "3:2", "ALFA", "napis", "P1", "ULTRA WIN",
          cel={"pudelko": (960, 640), "warianty": ["glow", "cien"]}, paczki=("wspolne",)),
    Asset("g_win_free_spins", "3:2", "ALFA", "napis", "P1", "FREE SPINS",
          cel={"pudelko": (960, 640), "warianty": ["glow", "cien"]}, paczki=("wspolne",)),
    Asset("g_fx_promienie", "1:1", "CZARNE", "fx", "P0", "promienie (god rays)",
          cel={"bok": 1024, "srodek": True}, paczki=("lobby", "wspolne")),
    Asset("g_fx_flara", "1:1", "CZARNE", "fx", "P0", "flara / gwiazda błysku",
          cel={"bok": 512, "srodek": True}, paczki=("lobby", "wspolne")),
    Asset("g_fx_iskry", "3:2", "CZARNE", "arkusz", "P0", "8 iskier (4×2)",
          cel={"komorka": 128, "jedna": True}, siatka=(4, 2), paczki=("lobby", "wspolne")),
    Asset("g_fx_blyskawice", "3:2", "CZARNE", "arkusz", "P1", "3 pioruny (3×1)",
          cel={"komorka_wh": (384, 768), "jedna": True}, siatka=(3, 1), paczki=("wspolne",)),
    Asset("g_fx_dym", "1:1", "CZARNE", "fx", "P1", "obłok dymu",
          cel={"bok": 512, "dym": True}, paczki=("wspolne",)),
    Asset("g_fx_konfetti", "3:2", "ALFA", "arkusz", "P1", "12 konfetti (4×3)",
          cel={"komorka": 48}, siatka=(4, 3), paczki=("lobby", "wspolne")),

    # ---- Czat 3 — S1 „Cebulowy 777” ----------------------------------------------------------------
    _sym("s1_sym_wisnie", "niskie", 256, "para wiśni", "P0", "s1"),
    _sym("s1_sym_cytryna", "niskie", 256, "cytryna", "P0", "s1"),
    _sym("s1_sym_sliwka", "niskie", 256, "śliwka", "P0", "s1"),
    _sym("s1_sym_arbuz", "niskie", 256, "plaster arbuza", "P0", "s1"),
    _sym("s1_sym_dzwonek", "wysokie", 256, "złoty dzwonek", "P0", "s1"),
    _sym("s1_sym_bar", "wysokie", 256, "tabliczka BAR", "P0", "s1"),
    _sym("s1_sym_siodemka", "wysokie", 256, "czerwona siódemka", "P0", "s1"),
    _sym("s1_sym_wild", "specjalne", 256, "Złota Cebula WILD", "P0", "s1"),
    _tlo("s1_tlo_desktop", "neonowe retro Vegas / synthwave (poziomo)", "P0", "s1"),
    _tlo("s1_tlo_mobile", "neonowe retro Vegas / synthwave (pionowo)", "P0", "s1"),
    Asset("s1_ramka", "1:1", "ALFA", "ramka", "P0", "chromowano-neonowa ramka 3×3",
          cel={"okno": (768, 768), "siatka": (3, 3)}, paczki=("s1",)),
    Asset("s1_logo", "3:2", "ALFA", "obiekt", "P0", "logo CEBULOWY 777",
          cel={"szer": 640, "warianty": ["glow"]}, paczki=("s1",)),
    Asset("s1_okladka", "2:3", "PELNE", "okladka", "P0", "okładka kafla S1",
          cel={"szerokosci": (400, 600, 800), "x1": 400, "x2": 800}, paczki=("lobby",)),
    Asset("s1_baner", "3:2", "PELNE", "baner", "P0", "baner S1 bez tekstu",
          cel={"szerokosci": (960, 1536), "x1": 960, "x2": 1536, "rozmyte": 480, "focus": (0.5, 0.5)},
          paczki=("lobby",)),

    # ---- Czat 4 — S2 „Złoty Faraon” ----------------------------------------------------------------
    _sym("s2_sym_10", "niskie", 192, "10 w kamieniu i turkusie", "P1", "s2"),
    _sym("s2_sym_j", "niskie", 192, "J w kamieniu i malachicie", "P1", "s2"),
    _sym("s2_sym_q", "niskie", 192, "Q w kamieniu i karneolu", "P1", "s2"),
    _sym("s2_sym_k", "niskie", 192, "K w kamieniu i lapisie", "P1", "s2"),
    _sym("s2_sym_a", "niskie", 192, "A w kamieniu i ametyście", "P1", "s2"),
    _sym("s2_sym_ankh", "wysokie", 192, "anch", "P1", "s2"),
    _sym("s2_sym_oko", "wysokie", 192, "Oko Horusa", "P1", "s2"),
    _sym("s2_sym_skarabeusz", "wysokie", 192, "skarabeusz", "P1", "s2"),
    _sym("s2_sym_anubis", "wysokie", 192, "Anubis", "P1", "s2"),
    _sym("s2_sym_faraon", "wysokie", 192, "złota maska faraona", "P1", "s2"),
    _sym("s2_sym_wild", "specjalne", 192, "Złota Relikwia Cebuli WILD", "P1", "s2"),
    _sym("s2_sym_scatter", "specjalne", 192, "piramida SCATTER", "P1", "s2"),
    Asset("s2_wild_rozszerzony", "2:3", "ALFA", "obiekt", "P1", "rozszerzony WILD na cały bęben",
          cel={"pudelko": (192 * 2, 576), "wys_dokladna": 576, "warianty": ["glow"]}, paczki=("s2",)),
    _tlo("s2_tlo_desktop", "skarbiec grobowca (poziomo)", "P1", "s2"),
    _tlo("s2_tlo_mobile", "skarbiec grobowca (pionowo)", "P1", "s2"),
    _tlo("s2_tlo_fs_desktop", "noc nad piramidami (poziomo)", "P1", "s2"),
    _tlo("s2_tlo_fs_mobile", "noc nad piramidami (pionowo)", "P1", "s2"),
    Asset("s2_ramka", "3:2", "ALFA", "ramka", "P1", "złoto-kamienna ramka 5×3",
          cel={"okno": (960, 576), "siatka": (5, 3)}, paczki=("s2",)),
    Asset("s2_logo", "3:2", "ALFA", "obiekt", "P1", "logo ZŁOTY FARAON",
          cel={"szer": 640, "warianty": ["glow"]}, paczki=("s2",)),
    Asset("s2_okladka", "2:3", "PELNE", "okladka", "P1", "okładka kafla S2",
          cel={"szerokosci": (400, 600, 800), "x1": 400, "x2": 800}, paczki=("lobby",)),
    Asset("s2_baner", "3:2", "PELNE", "baner", "P1", "baner S2 bez tekstu",
          cel={"szerokosci": (960, 1536), "x1": 960, "x2": 1536, "rozmyte": 480, "focus": (0.5, 0.5)},
          paczki=("lobby",)),
    Asset("s2_fx_hieroglify", "3:2", "CZARNE", "arkusz", "P1", "8 świecących hieroglifów (4×2)",
          cel={"komorka": 128}, siatka=(4, 2), paczki=("s2",)),

    # ---- Czat 5 — S3 „Kryształowa Kaskada” ---------------------------------------------------------
    _sym("s3_sym_szafir", "niskie", 144, "szafir (kropla)", "P2", "s3"),
    _sym("s3_sym_szmaragd", "niskie", 144, "szmaragd (szlif szmaragdowy)", "P2", "s3"),
    _sym("s3_sym_ametyst", "niskie", 144, "ametyst (sześciokąt)", "P2", "s3"),
    _sym("s3_sym_topaz", "niskie", 144, "topaz (markiza)", "P2", "s3"),
    _sym("s3_sym_rubin", "wysokie", 144, "rubinowe serce", "P2", "s3"),
    _sym("s3_sym_diament", "wysokie", 144, "diament", "P2", "s3"),
    _sym("s3_sym_cebula", "wysokie", 144, "kryształowa złota cebula", "P2", "s3"),
    _sym("s3_sym_scatter", "specjalne", 144, "tęczowy pryzmat SCATTER", "P2", "s3"),
    _sym("s3_sym_mnoznik", "specjalne", 144, "kryształowa kula mnożnika", "P2", "s3"),
    _tlo("s3_tlo_desktop", "kryształowa jaskinia (poziomo)", "P2", "s3"),
    _tlo("s3_tlo_mobile", "kryształowa jaskinia (pionowo)", "P2", "s3"),
    _tlo("s3_tlo_fs_desktop", "komnata z zorzą (poziomo)", "P2", "s3"),
    _tlo("s3_tlo_fs_mobile", "komnata z zorzą (pionowo)", "P2", "s3"),
    Asset("s3_ramka", "1:1", "ALFA", "ramka", "P2", "kryształowa ramka 6×5",
          cel={"okno": (864, 720), "siatka": (6, 5)}, paczki=("s3",)),
    Asset("s3_logo", "3:2", "ALFA", "obiekt", "P2", "logo KRYSZTAŁOWA KASKADA",
          cel={"szer": 640, "warianty": ["glow"]}, paczki=("s3",)),
    Asset("s3_okladka", "2:3", "PELNE", "okladka", "P2", "okładka kafla S3",
          cel={"szerokosci": (400, 600, 800), "x1": 400, "x2": 800}, paczki=("lobby",)),
    Asset("s3_baner", "3:2", "PELNE", "baner", "P2", "baner S3 bez tekstu",
          cel={"szerokosci": (960, 1536), "x1": 960, "x2": 1536, "rozmyte": 480, "focus": (0.5, 0.5)},
          paczki=("lobby",)),
    Asset("s3_fx_odlamki", "3:2", "ALFA", "arkusz", "P2", "12 odłamków kryształu (4×3)",
          cel={"komorka": 64}, siatka=(4, 3), paczki=("s3",)),
]

# Kolory symboli S3 z 01 § 11.4 — kod barwi nimi neutralne odłamki przy pękaniu (pole ``tint`` w manifeście).
TINT_S3 = {
    "s3_sym_szafir": "#2F6BFF", "s3_sym_szmaragd": "#19D17A", "s3_sym_ametyst": "#A64DFF",
    "s3_sym_topaz": "#FFB23D", "s3_sym_rubin": "#FF2D55", "s3_sym_diament": "#E8FBFF",
    "s3_sym_cebula": "#F5C542", "s3_sym_scatter": "#19F5D2", "s3_sym_mnoznik": "#E8FBFF",
}

# Budżety wagi z briefu § 5 (łączna waga assetów jednej gry ≤ 6 MB, lobby ≤ 3 MB bez wideo).
BUDZETY = {"lobby": 3_000_000, "s1": 6_000_000, "s2": 6_000_000, "s3": 6_000_000}

PO_ID: dict[str, Asset] = {a.id: a for a in ASSETY}

assert len(ASSETY) == 85, f"brief § 7 wymaga 85 assetów, jest {len(ASSETY)}"
assert len(PO_ID) == 85, "zdublowane ID w katalogu"


def wybierz(wzorce: list[str] | None) -> list[Asset]:
    """Zwraca assety pasujące do listy ID albo nazw pakietów (opcja ``--tylko``). Pusta lista = wszystkie."""
    if not wzorce:
        return list(ASSETY)
    wynik = []
    for a in ASSETY:
        if a.id in wzorce or a.pakiet in wzorce:
            wynik.append(a)
    nieznane = [w for w in wzorce if w not in PO_ID and w not in PAKIETY]
    if nieznane:
        raise SystemExit(f"Nieznane ID/pakiet w --tylko: {', '.join(nieznane)}")
    return wynik
