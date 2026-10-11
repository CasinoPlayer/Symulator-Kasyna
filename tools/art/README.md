# tools/art — pipeline grafiki i grafika zastępcza

Dwa narzędzia budowania (jak kompilator CSS — nie są częścią aplikacji Spring Boot, która tylko serwuje gotowe pliki):

| Narzędzie | Co robi |
|---|---|
| [`przetworz.py`](przetworz.py) | **pipeline**: PNG (z ChatGPT albo zastępcze) → WebP @1x/@2x + warianty + `manifest.json` (kontrakt [`09 § 3`](../../docs/projekt/09-kontrakt-api-i-assetow.md)) |
| [`zastepcze/generuj_wszystko.py`](zastepcze/generuj_wszystko.py) | **grafika zastępcza** dla wszystkich 85 assetów (Blender + Pillow/NumPy), żeby aplikacja miała komplet obrazów, zanim przyjdzie grafika z ChatGPT |

```
art/zrodla/<pakiet>/<ID>.png        ← grafika z ChatGPT (ma pierwszeństwo; <ID>.v2.png = nowsza wersja)
art/zastepcze/<pakiet>/<ID>.png     ← grafika zastępcza (generowana, w .gitignore)
            │
            ▼  python3 tools/art/przetworz.py
src/main/resources/static/assets/img/<pakiet>/<ID>.webp, <ID>@2x.webp, warianty
src/main/resources/static/assets/img/manifest.json
art/raport/raport.html, raport.json  ← raport jakości (w .gitignore)
```

Front-end **zawsze** odwołuje się do obrazów przez ID z manifestu (`static/js/assets.js`), więc podmiana grafiki
to: wrzucić PNG → uruchomić skrypt → gotowe. Źródło prawdy o 85 assetach (ID, formaty, typy tła, rozmiary
docelowe, nazwy komórek arkuszy) to [`katalog.py`](katalog.py) — z niego korzystają oba narzędzia.

## 1. Instalacja

Wymagany Python ≥ 3.11 oraz:

```bash
pip install pillow numpy           # wystarcza do przetworz.py i do etapu 2D grafiki zastępczej
pip install bpy                    # opcjonalnie: Blender jako moduł Pythona (rendery 3D grafiki zastępczej)
```

`bpy` (Blender 5.2) to duży pakiet (~400 MB) wymagający konkretnej wersji Pythona (dla 5.2: Python 3.13).
Najprościej w osobnym środowisku: `python3.13 -m venv ~/venv-bpy && ~/venv-bpy/bin/pip install bpy pillow numpy`.
SciPy, ffmpeg ani zainstalowany Blender **nie są potrzebne** (etykietowanie składowych, rozmycia i morfologię
pipeline ma własne, w NumPy — [`kroki/obraz.py`](kroki/obraz.py)).

## 2. Grafika zastępcza

```bash
python3 tools/art/zastepcze/generuj_wszystko.py --bpy ~/venv-bpy/bin/python      # komplet: rendery + 2D
python3 tools/art/zastepcze/generuj_wszystko.py --bez-blendera                  # tylko 2D (rendery już są)
python3 tools/art/zastepcze/generuj_wszystko.py --tylko s1 --przetworz          # pakiet s1 i od razu pipeline
python3 tools/art/zastepcze/generuj_wszystko.py --od-nowa --rendery s3_          # przerenderuj modele S3
```

Interpreter z `bpy`: opcja `--bpy`, zmienna `KASYNO_BPY_PYTHON` albo bieżący Python, jeśli ma `bpy`.

**Etap 1 — Blender** ([`zastepcze/blender/`](zastepcze/blender)): obiekty 3D w jednym „studiu” (światło z lewej-góry,
cyjanowy i magentowy rim, otoczenie odbijające się w złocie — 01 § 4.2), Cycles na CPU, 384–640 px, 32–64 próbki
z odszumianiem. Powstaje ok. 45 renderów w `art/zastepcze/_render/` (≈ 8 min na 4 rdzeniach; istniejące są
pomijane). Są tam też **matcapy** — kule z danego materiału (złoto, chrom, emalia, szkło), którymi etap 2 cieniuje
obrazy 2,5D.

| Plik | Zawartość |
|---|---|
| `scena.py` | studio: scena, światła per gra, kamera z automatycznym kadrowaniem, materiały, bryły obrotowe, klejnoty z obrysu |
| `modele.py` | matcapy, owoce i dzwonek S1, złota cebula, moneta (relief z mapy wysokości), emblemat, relikwia, piramida, klejnoty S3, kryształy, odłamki |
| `modele_postacie.py` | Pan Cebulion (3 pozy), skrzynia skarbów, 8 awatarów |
| `tekstury.py` | mapy wysokości rysowane w 2D (relief monety, „sunburst” emblematu) |
| `render.py` | punkt wejścia etapu 1 (`--tylko`, `--od-nowa`) |

**Etap 2 — Pillow/NumPy** (moduły `gen_*.py`): tła (proceduralne sceny), efekty na czarnym tle, UI, napisy 3D
(maska z fontu OFL → faza → matcap złota → ekstruzja → kontur → poświata), kompozycje symboli, ramki, okładki.
Wspólne narzędzia: [`zastepcze/biblioteka.py`](zastepcze/biblioteka.py). Każdy obraz ma format i typ tła taki jak
z ChatGPT (1024×1024 / 1536×1024 / 1024×1536; ALFA / CZARNE / PELNE), więc pipeline przetwarza oba źródła tak samo.

| Moduł | Assety |
|---|---|
| `gen_marka.py` | emblemat, monety, maskotka, skrzynia, awatary (z renderów) |
| `gen_napisy.py` | BIG/MEGA/EPIC/ULTRA WIN, FREE SPINS, złote cyfry, logotypy marki i gier |
| `gen_ui.py` | SPIN / STOP, 12 ikon, panel 9-slice, przyciski-pigułki, ornament |
| `gen_fx.py` | promienie, flara, iskry, pioruny, dym, konfetti, hieroglify |
| `gen_tla.py` | 12 teł: lobby, Vegas/synthwave, skarbiec, noc nad piramidami, jaskinia, zorza |
| `gen_s1.py`, `gen_s2.py`, `gen_s3.py` | symbole i ramki gier |
| `gen_okladki.py` | okładki kafli, banery, rozszerzony WILD S2 (uruchamiane po symbolach i logotypach) |

Fonty (Cinzel, Cinzel Decorative, Bungee, Marcellus, Manrope — licencja SIL OFL) czytamy z
`src/main/resources/static/fonts/*.woff2` (FreeType w Pillow czyta WOFF2; znak `Ł` jest w podzbiorze `latin-ext`).

## 3. Pipeline: `przetworz.py`

```bash
python3 tools/art/przetworz.py                              # wszystkie 85 assetów (~2 min na 4 rdzeniach)
python3 tools/art/przetworz.py --tylko s1                   # pakiet (global | s1 | s2 | s3)
python3 tools/art/przetworz.py --tylko s1_sym_wild,g_ui_ikony
python3 tools/art/przetworz.py --strict                     # ostrzeżenia = błędy (przed commitem)
python3 tools/art/przetworz.py --zrodla ../kasyno-grafika/art/zrodla   # źródła z innej kopii roboczej
```

| Opcja | Działanie |
|---|---|
| `--tylko` | ID albo pakiety; dla symboli, monet i SPIN/STOP liczona jest cała grupa (wspólna normalizacja), zapisywane tylko wskazane |
| `--zrodla`, `--zastepcze`, `--wyjscie`, `--raport` | inne katalogi (używają ich testy) |
| `--watki N` | liczba procesów (domyślnie 4) |
| `--dokladnie` | WebP `method=6` (mniejsze pliki, wielokrotnie wolniej) |
| `--strict` | kod wyjścia 2 także przy ostrzeżeniach |
| `--sprzataj` | usuwa z `assets/img` pliki, do których nie prowadzi manifest |

Kody wyjścia: `0` — w porządku, `1` — ostrzeżenia, `2` — błędy (także plik z manifestu, którego nie ma na dysku,
Q30). **Brak źródła** dla ID (ani w `zrodla`, ani w `zastepcze`) nie psuje aplikacji: poprzedni wynik i wpis
w manifeście zostają, raport ostrzega (Q01). Pliki w `art/zrodla`, których pipeline nie użyje (literówka w nazwie,
zły folder, dopisek „ (1)” przy pobieraniu), są zgłaszane z podpowiedzią poprawnej nazwy (Q02); foldery `makiety/`,
`nieposortowane/` i zaczynające się od `_` (np. `_do-poprawy/`) są pomijane. JPEG jako obraz `ALFA` → ostrzeżenie
Q04 (brak przezroczystości, artefakty krawędzi).

**Budżety wagi** (Q23) liczą to, co pobiera przeglądarka w najcięższej konfiguracji (02 § 7.1): desktop — @2x
i tła `*_desktop` w 2560 px, telefon — @1x i tła `*_mobile`; tło jednej orientacji nie jest doliczane drugiej
(front wybiera je po proporcji okna). Banery nie wchodzą do budżetu lobby — plakatem filmiku w kaflu jest
okładka (`js/lobby.js`). Kodowanie: tła q80, okładki i banery q78, sprite'y q82 + bezstratna alfa.

**Kroki** (moduły w [`kroki/`](kroki), opis i uzasadnienia w [02 § 5](../../docs/projekt/02-lista-obrazow.md)):

| Typ / rola | Co się dzieje |
|---|---|
| `ALFA` | prawdziwa alfa (przezroczysty brzeg albo ≥ 3% pikseli całkiem przezroczystych — np. ramka „od brzegu do brzegu”) → usuwanie obwódek; **narysowana szachownica** → wykrycie okresu i fazy (statystyka kołowa, działa też dla ułamkowego okresu) i dokładna alfa z rzutu na kierunek tło→obiekt; **jednolite tło** (biel, czerń, `#00FF00`…) → model tła, ΔE w CIELAB, strefa przejścia, odkażenie koloru krawędzi, despill, **dziury w kolorze tła** wewnątrz obiektu (pętla anchu, przestrzeń między ogonkami wiśni) wycinane, gdy mają ostry brzeg (ostrzeżenie do sprawdzenia w raporcie); usuwanie „pyłków”; przycięcie do alfy; Q07 stopniowane: czubek na krawędzi ≤ 1,5% boku = ostrzeżenie, ucięty obiekt = błąd |
| symbole | wspólna normalizacja w grupie (gra + poziom: dłuższy bok 0,86 / 0,89 / 0,92 pola, wyrównanie pokrycia ±12%, środek optyczny) → pole 256/192/144 px @1x + `ruch1`, `ruch2`, `syl`, `glow`, `cien`, `mini`; S3: `tint`, kula mnożnika: `pole` |
| `CZARNE` | czerń zostaje (bez alfy), zerowanie poziomu czerni, winieta krawędzi, wyśrodkowanie promieni/flary, limit jasności dymu, **kolorowy efekt → ciepła biel** z zachowaniem jasności (kod barwi efekty tintem, 04 § 2.3), `blend: "add"` |
| `PELNE` | kadr pod proporcję z punktem ogniskowym, warianty szerokości (tła 1280/1920/2560, mobile 720/1080/1280, okładki 400/600/800, banery 960/1536 + kadr 16:9), ziarno przy powiększaniu, LQIP, wersja `rozmyte` |
| arkusze | cięcie przez spójne składowe (alfa albo jasność na czerni), sklejanie rozbitych elementów (z mniejszym promieniem, gdy elementy prawie się stykają), pomijanie podpisów dopisanych przez ChatGPT pod ikonami, przypisanie do komórek wierszami (odporne na nierówną siatkę), plany awaryjne; pliki `<ID>__<komórka>.webp` |
| cyfry | 13 glifów na wspólnej linii bazowej, cyfry tabelaryczne → pliki glifów + BitmapFont `global/fonty/cebulion-cyfry@{1,2}x.fnt` + metryki w `manifest.fonts` |
| ramki | wykrycie przezroczystego okna (także zamalowanego kolorem albo szachownicą); okno o innej proporcji niż siatka bębnów → **rozciągnięcie najbardziej jednolitego pasa boków ramki** (z ominięciem ornamentów, np. wajchy S1), żeby okno miało dokładnie proporcję siatki → `frames.<ID>.window` (ułamki) + `frames.<ID>.nineSlice` (px @1x) |
| panel, przyciski | marginesy 9-slice z porównania całych kolumn/wierszy z tolerancją adaptacyjną (faktura szkła, winieta i odblaski na listwach nie blokują wykrycia, ornament w rogu tak) → `nineSlice` (ułamki) |
| emblemat | dodatkowo `favicon.ico` (16/32/48), `favicon-32.png`, `icon-192/512.png`, `icon-maskable-512.png`, `apple-touch-icon.png`, `site.webmanifest` → `global/`, opis w `manifest.icons` |

Skalowanie odbywa się w świetle liniowym z alfą premultiplikowaną (jasne odblaski złota nie ciemnieją, brak
obwódek), @2x ma zawsze **dokładnie** dwa razy większe wymiary i powstaje tylko, gdy nie wymaga powiększenia
źródła ponad ×1,25 (tła ×1,67). Wynik jest deterministyczny: te same wejścia dają te same bajty, a niezmieniony
manifest zachowuje swoje pole `version`.

### Rozmiary docelowe @1x (z 02 § 2.6 i § 3)

| Rola | @1x | Uzasadnienie |
|---|---|---|
| symbole S1 / S2 / S3 | pole 256 / 192 / 144 px | pola 180–220 / 150–190 / 110–140 px CSS na widoku 1920×1080 + zapas na puls wygranej ×1,12 |
| tła | szer. 1920 (desktop) / 1080 (mobile), @2x = 2560 / 1280 | ekran referencyjny; ChatGPT daje maks. 1536 px, więcej nie ma sensu (ciemne, rozmyte, przykryte bębnami) |
| napisy wygranych | w polu 960×640 | pełnoekranowa sekwencja; @2x zwykle brak (wymagałoby powiększenia) |
| logotypy | szer. 720 (marka) / 640 (gry) | sekcja powitalna 360–720 px CSS, pas nad ramką |
| ramki | okno 768×768 / 960×576 / 864×720 | okno = siatka bębnów z polami powyżej |
| efekty | jedna rozdzielczość: promienie 1024, flara/dym 512, iskry 128, pioruny 384×768 | rozmyty gradient nic nie zyskuje na @2x |

### `manifest.json`

Format z kontraktu 09 (`version`, `images{src, src2x, w, h, source, blend}`, `sheets{cells}`, `frames{window}`,
`nineSlice`) plus pola dodatkowe — klient znający tylko kontrakt może je pominąć:

| Pole | Gdzie | Znaczenie |
|---|---|---|
| `hash` | każdy obraz | 8 znaków SHA-256 pliku @1x (do unieważniania pamięci podręcznej) |
| `variants` | symbole, napisy, logo, monety, emblemat, tła, banery | `ruch1`, `ruch2`, `syl`, `glow` (`scale: 0.5`), `cien`, `mini`, `male`, `ikona`, `naglowek`, `glowzl`, `rozmyte`, `k169` |
| `widths`, `focus`, `lqip` | tła, okładki, banery | warianty szerokości do `srcset`, punkt ogniskowy kadrowania, miniatura data URI |
| `tint`, `pole` | symbole S3 | kolor do barwienia odłamków; jasny środek kuli mnożnika `{x, y, r}` (ułamki) |
| `frames.<ID>.nineSlice` | ramki | marginesy 9-slice ramki w px @1x |
| `fonts.CebulionCyfry` | cyfry | `lineHeight`, `base`, `space`, `chars` (xadvance, offsety, ID pliku glifu), ścieżki `.fnt` |
| `icons` | — | favicony i ikony aplikacji |

Komórki arkuszy (kolejność wierszami, numeracja od 0 jak `avatarIndex` z API): `g_awatary` 0–7,
`g_font_cyfry` 0–9 + `przecinek`, `plus`, `razy`, `g_ui_ikony` autoplay … historia, `g_fx_iskry` 0–7,
`g_fx_blyskawice` 0–2, `g_fx_konfetti` 0–11, `s2_fx_hieroglify` 0–7, `s3_fx_odlamki` 0–11.

## 4. Podmiana na grafikę z ChatGPT

1. Pobierz oryginalny PNG z ChatGPT i nazwij go ID obrazu (`s1_sym_wild.png`) — instrukcja:
   [`art/zrodla/README.md`](../../art/zrodla/README.md).
2. Wrzuć do `art/zrodla/<pakiet>/` (`global`, `s1`, `s2`, `s3`).
3. `python3 tools/art/przetworz.py --tylko <pakiet albo ID>`.
4. Obejrzyj `art/raport/raport.html` (miniatury na szachownicy, ciemnym tle i bieli + uwagi). Błędy (np. zamieniona
   orientacja, nierozpoznane tło, obiekt przycięty krawędzią) = obraz do ponownego wygenerowania.
5. Commit `src/main/resources/static/assets/img/` (manifest i pliki WebP). W `manifest.json` pole `source` zmieni się
   z `zastepcze` na `chatgpt`.

## 5. Testy

```bash
python3 tools/art/testy/test_przetworz.py /tmp/test-art       # obrazy wejściowe i wyniki zostają w katalogu
```

27 testów na syntetycznych obrazach o znanym wyniku: obiekt na narysowanej szachownicy (całkowitej oraz
przeskalowanej do pola 23,6 px, rozmytej, z szumem), na `#00FF00` z dziurą w obiekcie, na bieli z białym
odblaskiem, dziura w obiekcie na bieli i na zaszumionej czerni, arkusz z nierówną siatką i rozbitym elementem,
arkusz z podpisami pod ikonami, arkusz z prawie stykającymi się elementami, puste pola arkusza cyfr, okno ramki
(na alfie, na szachownicy, zamalowane, z szachownicą w samym oknie), ramka z prawdziwą alfą od brzegu do brzegu,
korekta proporcji okna z ominięciem „wajchy”, panel 9-slice z ornamentem w rogach (także z fakturą, winietą
i odblaskami), pigułka, nieznane nazwy plików (Q02), JPEG i tryby P / LA / 16-bit, efekt na zaszumionej czerni
i z kanałem alfa, neutralizacja koloru efektów, stopniowanie Q07, skalowanie w świetle liniowym, etykietowanie
składowych, pełne uruchomienie pipeline'u, zachowanie wyniku przy braku źródła, determinizm. Działają bez
pytesta (i z nim). Pipeline był też sprawdzony na komplecie 92 prawdziwych obrazów z ChatGPT (0 błędów).

## 6. Czego jeszcze nie ma (plan)

Atlasy tekstur Pixi (MaxRects), AVIF dla HTML, cache przyrostowy, obraz Open Graph, generowany CSS 9-slice
i klas cyfr, obniżone @2x sprite'ów, część kontroli raportu (PSNR, jasność teł, kolor dominujący). Aplikacja
działa bez nich (pliki pojedyncze WebP + manifest); opis docelowy: [02 § 5](../../docs/projekt/02-lista-obrazow.md).
