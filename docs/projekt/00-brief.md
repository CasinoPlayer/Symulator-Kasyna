# 00. Brief projektu (źródło prawdy)

> Wiążące decyzje dla całej dokumentacji i kodu: ID obrazów, zdarzeń i dźwięków, paleta, progi, tempo, wydajność.
> Dokumenty 01–10 i kod muszą być z nim zgodne.


Ten plik jest WIĄŻĄCY. Każdy dokument w `docs/projekt/` musi używać dokładnie tych nazw, identyfikatorów,
liczb i decyzji. Jeśli czegoś tu nie ma — możesz to zaprojektować, ale nie możesz zmienić niczego, co tu jest.

## 0. Kontekst

* Projekt studencki (3 osoby), przedmiot „Wprowadzenie do technologii backendowych”, Uniwersytet WSB Merito Wrocław.
  Backend: Java 21, Spring Boot 3.5, Spring Data JPA, H2. Pakiet `pl.wsb.kasyno`. Front: statyczne pliki w
  `src/main/resources/static` serwowane przez Spring Boot (bez Node.js w produkcji, bez CDN).
* Symulator kasyna z wirtualną walutą **cebulion** (l.mn. cebuliony, dop. cebulionów). Zero prawdziwych pieniędzy.
* Logowanie: wpisujesz nazwę gracza → od razu zalogowany. Pierwsze logowanie = **10 000 cebulionów**.
  Bankructwo (saldo < minimalny zakład) → bonus ratunkowy 10 000 (limit: raz na 10 minut).
* Wynik spinu liczy WYŁĄCZNIE serwer (Java). Przeglądarka dostaje listę kroków i tylko je animuje.
  Jedna runda = jeden zakład; kaskady i darmowe spiny są w tej samej odpowiedzi.
* Właściciel chce efektu „kozackiego”: poziom topowych slotów mobilnych (Pragmatic Play, NetEnt, Play'n GO),
  dźwięki, błyski, efekty, animacje — przy płynnych 60 fps i pełnej responsywności (telefon pionowo → 4K).
* **Grafikę generuje właściciel w ChatGPT** na podstawie naszych promptów i przekazuje nam pliki PNG.
  My je obrabiamy (przycinanie, poprawa alfy, @1x/@2x, WebP/AVIF, atlasy tekstur) i łączymy w aplikację.
  Animacje, cząsteczki, błyski, shadery i dźwięk robimy w kodzie. Blender (pakiet `bpy`, działa headless) jest
  opcjonalnym narzędziem pomocniczym, np. do sprite-sheetów obrotu monety.
* Dźwięk: domyślnie syntezowany naszym kodem (Python + NumPy → WAV → ffmpeg → Opus/AAC). Opcjonalnie: muzyka
  z generatora AI (np. Suno) wygenerowana przez właściciela według naszych promptów.
* Wszystkie dokumenty po polsku. Prompty dla ChatGPT po angielsku (lepsza precyzja), z polskim komentarzem dla
  użytkownika. Tekst, który ma się pojawić NA obrazie, podajemy dokładnie i literuj polskie znaki
  (np. „Ł = L with stroke”).

## 1. Marka

* Nazwa: **Cebulion Casino**. Waluta: **cebulion** (ikona: złota moneta z wytłoczoną cebulą i koroną).
* Maskotka: **Pan Cebulion** — elegancka złota cebula z cylindrem, monoklem i muszką; charyzmatyczny, nie dziecinny.
* Hasło: „Graj bez ryzyka. Wygrywaj z klasą.”
* Kierunek globalny: **premium dark luxury casino** — głęboka granatowo-fioletowa czerń, królewskie złoto,
  akcenty neonowej magenty i cyjanu. Render: **high-end stylized 3D** (glossy, cinematic lighting, rim light,
  subtelna poświata), jak topowe sloty mobilne. Nie fotorealizm, nie płaska grafika, nie styl dziecięcy.
* Paleta globalna (tokeny CSS):
  `--bg-0 #07060F`, `--bg-1 #120B2A`, `--bg-2 #1E1442`, `--gold-1 #FFE08A`, `--gold-2 #F5C542`,
  `--gold-3 #B8860B`, `--magenta #FF2E88`, `--cyan #21E6FF`, `--win-green #3DFF8F`, `--danger #FF4D4D`,
  `--text-1 #FFFFFF`, `--text-2 #C9C3E6`.
* Fonty (OFL, hostowane lokalnie z pakietów npm @fontsource): nagłówki **Cinzel** (700/900), UI **Manrope**
  (400–800), liczby salda/wygranych **Manrope tabular** + złote cyfry bitmapowe z obrazu `g_font_cyfry`.
  Fonty gier: S1 **Bungee** (neon retro), S2 **Cinzel Decorative**, S3 **Marcellus**.

## 2. Trzy automaty (ID gier: `s1`, `s2`, `s3`)

### S1 — „Cebulowy 777” (kod `cebulowy-777`)
* Klasyk retro: **3 bębny × 3 rzędy, 5 linii** (3 poziome + 2 skośne). Szybki, prosty, RTP docelowy ~95%,
  zmienność niska-średnia. Zakład: 10–1000 (poziomy: 10, 20, 50, 100, 200, 500, 1000).
* Styl: **retro Las Vegas neon + chrom + synthwave**: gorący róż, elektryczny błękit, chrom, czerwone siódemki,
  złota cebula. Glossy enamel, neonowe obrysy.
* Symbole (od najniższego): `wisnie`, `cytryna`, `sliwka`, `arbuz`, `dzwonek`, `bar`, `siodemka`, `wild`
  (WILD = Złota Cebula z napisem WILD; zastępuje wszystko). Brak scattera i free spinów.
* Cecha: „Neonowy mnożnik” — wygrana z WILD na linii ×2; pełny ekran tego samego symbolu ×10 („NEON JACKPOT”).

### S2 — „Złoty Faraon” (kod `zloty-faraon`)
* Wideo-slot: **5 bębnów × 3 rzędy, 20 linii**. RTP docelowy ~96%, zmienność średnia-wysoka. Zakład całkowity 20–2000.
* Styl: **skarbiec grobowca starożytnego Egiptu**: złoto, lapis lazuli, piaskowiec, ciepłe światło pochodni.
  Free spins: noc nad piramidami, rozgwieżdżone niebo, wiązka światła z piramidy.
* Symbole niskie: `10`, `j`, `q`, `k`, `a` (rzeźbione w kamieniu/złocie z ornamentem hieroglificznym, każdy w innym
  kolorze klejnotu). Wysokie: `ankh`, `oko` (Oko Horusa), `skarabeusz`, `anubis`, `faraon` (złota maska — najwyższy).
  Specjalne: `wild` (Złota Relikwia Cebuli — złoty relikwiarz w kształcie cebuli z grawerem i inkrustacją lapis),
  `scatter` (piramida ze świecącym okiem/wiązką).
* Cechy: 3+ scattery → **10 darmowych spinów**, w darmowych spinach WILD **rozszerza się na cały bęben**
  (grafika `s2_wild_rozszerzony`) i wygrane ×2; 3 scattery w free spinach = +10 spinów.

### S3 — „Kryształowa Kaskada” (kod `krysztalowa-kaskada`)
* **6 kolumn × 5 rzędów, wygrane klastrowe** (5+ takich samych symboli połączonych poziomo/pionowo), **kaskady**
  (wygrane symbole pękają, nowe spadają). RTP docelowy ~96%, zmienność wysoka. Zakład 20–2000.
* Styl: **magiczna kryształowa jaskinia**: bioluminescencja, świecące klejnoty, ametyst, szafir, szmaragd,
  opalizujące refleksy. Free spins: głębsza komnata z zorzą i lewitującymi kryształami.
* Symbole niskie: `szafir`, `szmaragd`, `ametyst`, `topaz`. Wysokie: `rubin` (serce), `diament`,
  `cebula` (kryształowa złota cebula — najwyższy). Specjalne: `scatter` (tęczowy pryzmat „Serce Jaskini”),
  `mnoznik` (kryształowa kula z pustym środkiem — liczbę „×5” rysuje kod).
* Cechy: 4+ scattery → **10 darmowych spinów**; w free spinach spadają kule mnożników ×2…×100, sumowane i
  mnożone przez wygraną całej sekwencji kaskad.

## 3. Progi wygranych (wspólne dla wszystkich gier, liczone jako wielokrotność zakładu)

| Poziom | Próg | Prezentacja |
|---|---|---|
| brak | 0 | — |
| `small` | > 0 i < 5× | podświetlenie, liczenie, krótki dźwięk |
| `medium` | ≥ 5× | + cząsteczki, mocniejszy dźwięk, delikatne drżenie |
| `big` | ≥ 15× | pełnoekranowa sekwencja „BIG WIN” |
| `mega` | ≥ 30× | eskalacja do „MEGA WIN” |
| `epic` | ≥ 60× | eskalacja do „EPIC WIN” |
| `ultra` | ≥ 100× | eskalacja do „ULTRA WIN” (najmocniejsza) |

Sekwencję big+ można przewinąć dotknięciem (skip → od razu kwota końcowa).

## 4. Tempo (wartości bazowe, tryb TURBO = ×0,45 czasu)

* S1: start spinu → stop ostatniego bębna 1600 ms, odstęp stopów 180 ms.
* S2: 2200 ms, odstęp stopów 200 ms. Antycypacja (2 scattery na planszy): każdy kolejny bęben +1200 ms.
* S3: zrzut nowej planszy 900 ms; jedna kaskada (pęknięcie + opad) ~1100 ms.
* Błyski ekranu: maks. 3 na sekundę (WCAG 2.3.1), `prefers-reduced-motion` wyłącza błyski i drżenie.

## 5. Wydajność

* PixiJS 8 (WebGL, fallback WebGPU niewymagany), wendorowany lokalnie. Lobby bez Pixi (HTML/CSS + wideo).
* Trzy poziomy jakości z automatycznym przełączaniem po pomiarze czasu klatki:
  **High** (DPR ≤ 2, ≤ 600 cząsteczek, filtr bloom), **Medium** (DPR ≤ 1,5, ≤ 300, glow pre-baked),
  **Low** (DPR 1, ≤ 120, bez drżenia, bez filtrów). Obniżenie: p90 klatki > 20 ms przez 2 s.
* Efekty świetlne = sprite'y z czarnym tłem w trybie mieszania `add` (czarny staje się przezroczysty).
* Budżety: LCP lobby < 2,5 s (mobile 4G), brak long tasks > 50 ms w trakcie spinu, p95 klatki ≤ 16,7 ms (desktop),
  łączna waga assetów jednej gry ≤ 6 MB (WebP), lobby ≤ 3 MB bez wideo.

## 6. Obrazy z ChatGPT — konwencje

* Formaty ChatGPT: **1:1 → 1024×1024**, **3:2 → 1536×1024**, **2:3 → 1024×1536**. Zawsze PNG.
* Typy tła:
  * `ALFA` — prawdziwie przezroczyste tło (bez narysowanej szachownicy), obiekt wyśrodkowany, ~80–85% kadru,
    min. 6% marginesu, nic nie przycięte, bez cienia na podłożu, bez tekstu (chyba że wskazano), światło z lewej-góry.
  * `CZARNE` — jednolite czarne tło #000000 (efekty świetlne, mieszanie `add`), poświata zanika do czerni przed krawędzią.
  * `PELNE` — pełny obraz (tła, makiety, okładki), bez tekstu i UI, chyba że wskazano.
* Arkusze (`SHEET`): dokładna siatka, równe komórki, każdy element w całości w swojej komórce z marginesem,
  bez nachodzenia; cięcie robimy automatycznie (analiza alfy), więc siatka nie musi być idealna co do piksela.
* Elementy UI 9-slice (panele, przyciski): środek jednolity, bez ornamentów, żeby dało się go rozciągnąć (CSS
  `border-image`). Teksty UI są w HTML (ostre, dostępne) — przyciski i panele generujemy BEZ tekstu.
* Ramki bębnów: w środku **w pełni przezroczyste prostokątne okno**; jego granice wykrywamy automatycznie.
* Nazwy plików = identyfikator + `.png` (np. `s2_sym_anubis.png`). Foldery: `global/`, `s1/`, `s2/`, `s3/`, `makiety/`.

## 7. PEŁNA LISTA OBRAZÓW (ID, format, tło, priorytet)

Priorytet: **P0** = potrzebne do pierwszej grywalnej wersji (lobby + logowanie + S1), **P1** = S2 i pełne efekty,
**P2** = S3 i dopieszczenie.

### Czat 0 — Makiety (referencje stylu, nie trafiają do aplikacji) — 8 obrazów
| ID | Format | Tło | Opis |
|---|---|---|---|
| `m01_lobby_desktop` | 3:2 | PELNE | lobby niezalogowane: logo, 3 kafle gier, „Zaloguj” w prawym górnym rogu |
| `m02_logowanie` | 3:2 | PELNE | modal logowania (jedno pole „Nazwa gracza”, przycisk „Wejdź do kasyna”) na rozmytym lobby |
| `m03_bonus_powitalny` | 3:2 | PELNE | moment +10 000 cebulionów: skrzynia, deszcz monet, saldo w rogu |
| `m04_lobby_mobile` | 2:3 | PELNE | lobby zalogowane na telefonie pionowo |
| `m05_s1_desktop` | 3:2 | PELNE | ekran gry Cebulowy 777 z panelem sterowania |
| `m06_s2_desktop` | 3:2 | PELNE | ekran gry Złoty Faraon (5×3) |
| `m07_s3_mobile` | 2:3 | PELNE | ekran gry Kryształowa Kaskada na telefonie pionowo |
| `m08_big_win` | 3:2 | PELNE | pełnoekranowa sekwencja MEGA WIN nad grą |

### Czat 1 — GLOBAL A: marka, waluta, maskotka, tła lobby — 13 obrazów
| ID | Format | Tło | Prio | Opis |
|---|---|---|---|---|
| `g_logo` | 3:2 | ALFA | P0 | logotyp „CEBULION CASINO” z emblematem |
| `g_emblemat` | 1:1 | ALFA | P0 | sam emblemat (złota cebula w koronie na medalionie) — favicon, ikona, loader |
| `g_moneta_przod` | 1:1 | ALFA | P0 | moneta cebulion, widok z przodu |
| `g_moneta_skos` | 1:1 | ALFA | P0 | ta sama moneta pochylona ~45° |
| `g_moneta_bok` | 1:1 | ALFA | P0 | ta sama moneta prawie z boku (krawędź) |
| `g_tlo_lobby_desktop` | 3:2 | PELNE | P0 | luksusowe wnętrze kasyna nocą, bokeh, ciemniejszy środek pod UI |
| `g_tlo_lobby_mobile` | 2:3 | PELNE | P0 | to samo w kompozycji pionowej |
| `g_maskotka_powitanie` | 1:1 | ALFA | P0 | Pan Cebulion macha, zaprasza |
| `g_maskotka_wygrana` | 1:1 | ALFA | P1 | Pan Cebulion świętuje, monety w powietrzu |
| `g_maskotka_bankrut` | 1:1 | ALFA | P1 | Pan Cebulion z pustymi kieszeniami (zabawnie, z klasą) |
| `g_skrzynia` | 1:1 | ALFA | P0 | otwarta skrzynia pełna monet cebulion, złota poświata |
| `g_awatary` | 3:2 | ALFA SHEET 4×2 | P1 | 8 okrągłych awatarów graczy (różne postacie w stylu marki) |
| `g_font_cyfry` | 3:2 | ALFA SHEET | P0 | złote cyfry 3D: 0 1 2 3 4 5 6 7 8 9 , + × (siatka 5×3, ostatnie 2 pola puste) |

### Czat 2 — GLOBAL B: UI kit, banery wygranych, efekty — 18 obrazów
| ID | Format | Tło | Prio | Opis |
|---|---|---|---|---|
| `g_ui_spin` | 1:1 | ALFA | P0 | duży okrągły przycisk SPIN (złoty pierścień, szklany środek, ikona okrężnych strzałek) |
| `g_ui_spin_stop` | 1:1 | ALFA | P0 | identyczny przycisk z ikoną kwadratu STOP |
| `g_ui_ikony` | 3:2 | ALFA SHEET 4×3 | P0 | 12 ikon: autoplay, turbo, minus, plus, dźwięk wł., dźwięk wył., info, menu, lobby/dom, zamknij, ustawienia, historia |
| `g_ui_panel` | 1:1 | ALFA | P0 | panel modala 9-slice: ciemne szkło, ozdobna złota rama, jednolity środek |
| `g_ui_przycisk_glowny` | 3:2 | ALFA | P0 | złoty błyszczący przycisk-pigułka 9-slice, bez tekstu |
| `g_ui_przycisk_drugi` | 3:2 | ALFA | P0 | ciemny szklany przycisk-pigułka ze złotym brzegiem 9-slice, bez tekstu |
| `g_ui_ornament` | 3:2 | ALFA | P1 | złoty filigranowy separator / ozdobnik nagłówka |
| `g_win_big` | 3:2 | ALFA | P0 | napis „BIG WIN” — złote litery 3D |
| `g_win_mega` | 3:2 | ALFA | P1 | „MEGA WIN” — mocniejszy, z klejnotami |
| `g_win_epic` | 3:2 | ALFA | P1 | „EPIC WIN” — płonące złoto/fiolet |
| `g_win_ultra` | 3:2 | ALFA | P1 | „ULTRA WIN” — najbardziej spektakularny (tęczowe kryształy + złoto) |
| `g_win_free_spins` | 3:2 | ALFA | P1 | „FREE SPINS” |
| `g_fx_promienie` | 1:1 | CZARNE | P0 | promieniste snopy światła (god rays) z centrum |
| `g_fx_flara` | 1:1 | CZARNE | P0 | błysk soczewki / gwiazda z promieniami |
| `g_fx_iskry` | 3:2 | CZARNE SHEET 4×2 | P0 | 8 wariantów iskier / gwiazdek / błysków |
| `g_fx_blyskawice` | 3:2 | CZARNE SHEET 3×1 | P1 | 3 pioruny / wyładowania energii |
| `g_fx_dym` | 1:1 | CZARNE | P1 | miękki obłok dymu/mgły (do wejścia big win i przejść) |
| `g_fx_konfetti` | 3:2 | ALFA SHEET 4×3 | P1 | 12 elementów konfetti i serpentyn (złoto, magenta, cyjan) |

### Czat 3 — S1 „Cebulowy 777” — 14 obrazów (P0)
| ID | Format | Tło | Opis |
|---|---|---|---|
| `s1_sym_wisnie` | 1:1 | ALFA | para wiśni |
| `s1_sym_cytryna` | 1:1 | ALFA | cytryna |
| `s1_sym_sliwka` | 1:1 | ALFA | śliwka |
| `s1_sym_arbuz` | 1:1 | ALFA | plaster arbuza |
| `s1_sym_dzwonek` | 1:1 | ALFA | złoty dzwonek |
| `s1_sym_bar` | 1:1 | ALFA | tabliczka „BAR” |
| `s1_sym_siodemka` | 1:1 | ALFA | czerwona szczęśliwa siódemka „7” |
| `s1_sym_wild` | 1:1 | ALFA | Złota Cebula z napisem „WILD” |
| `s1_tlo_desktop` | 3:2 | PELNE | neonowy retro-Vegas / synthwave, nocą |
| `s1_tlo_mobile` | 2:3 | PELNE | to samo pionowo |
| `s1_ramka` | 1:1 | ALFA | chromowano-neonowa ramka automatu z przezroczystym oknem 3×3 |
| `s1_logo` | 3:2 | ALFA | logo „CEBULOWY 777” w neonie |
| `s1_okladka` | 2:3 | PELNE | okładka kafla w lobby (key art, z logo) |
| `s1_baner` | 3:2 | PELNE | szeroki baner / plakat wideo (key art, bez tekstu) |

### Czat 4 — S2 „Złoty Faraon” — 22 obrazy (P1)
| ID | Format | Tło | Opis |
|---|---|---|---|
| `s2_sym_10`, `s2_sym_j`, `s2_sym_q`, `s2_sym_k`, `s2_sym_a` | 1:1 | ALFA | 5 niskich symboli (litery/cyfra w kamieniu i złocie, różne kolory klejnotów) |
| `s2_sym_ankh`, `s2_sym_oko`, `s2_sym_skarabeusz`, `s2_sym_anubis`, `s2_sym_faraon` | 1:1 | ALFA | 5 wysokich symboli |
| `s2_sym_wild` | 1:1 | ALFA | Złota Relikwia Cebuli z napisem „WILD” |
| `s2_sym_scatter` | 1:1 | ALFA | piramida z wiązką światła, napis „SCATTER” |
| `s2_wild_rozszerzony` | 2:3 | ALFA | rozszerzony WILD na cały bęben (pionowa kolumna, relikwia w słupie światła) |
| `s2_tlo_desktop`, `s2_tlo_mobile` | 3:2 / 2:3 | PELNE | wnętrze skarbca grobowca |
| `s2_tlo_fs_desktop`, `s2_tlo_fs_mobile` | 3:2 / 2:3 | PELNE | free spins: noc, piramidy, gwiazdy, wiązka światła |
| `s2_ramka` | 3:2 | ALFA | złoto-kamienna ramka z przezroczystym oknem 5×3 |
| `s2_logo` | 3:2 | ALFA | logo „ZŁOTY FARAON” |
| `s2_okladka` | 2:3 | PELNE | okładka kafla |
| `s2_baner` | 3:2 | PELNE | baner bez tekstu |
| `s2_fx_hieroglify` | 3:2 | CZARNE SHEET 4×2 | 8 świecących hieroglifów/run (efekty przejść i rozszerzania WILD) |

### Czat 5 — S3 „Kryształowa Kaskada” — 18 obrazów (P2)
| ID | Format | Tło | Opis |
|---|---|---|---|
| `s3_sym_szafir`, `s3_sym_szmaragd`, `s3_sym_ametyst`, `s3_sym_topaz` | 1:1 | ALFA | 4 niskie klejnoty (różne szlify) |
| `s3_sym_rubin`, `s3_sym_diament`, `s3_sym_cebula` | 1:1 | ALFA | 3 wysokie (rubinowe serce, diament, kryształowa złota cebula) |
| `s3_sym_scatter` | 1:1 | ALFA | tęczowy pryzmat „Serce Jaskini”, napis „SCATTER” |
| `s3_sym_mnoznik` | 1:1 | ALFA | kryształowa kula z pustym, jasnym środkiem (na liczbę) |
| `s3_tlo_desktop`, `s3_tlo_mobile` | 3:2 / 2:3 | PELNE | kryształowa jaskinia |
| `s3_tlo_fs_desktop`, `s3_tlo_fs_mobile` | 3:2 / 2:3 | PELNE | free spins: komnata z zorzą |
| `s3_ramka` | 1:1 | ALFA | kryształowa ramka z przezroczystym oknem 6×5 |
| `s3_logo` | 3:2 | ALFA | logo „KRYSZTAŁOWA KASKADA” |
| `s3_okladka` | 2:3 | PELNE | okładka kafla |
| `s3_baner` | 3:2 | PELNE | baner bez tekstu |
| `s3_fx_odlamki` | 3:2 | ALFA SHEET 4×3 | 12 odłamków kryształu (do pękania symboli) |

**Razem: 8 makiet + 85 assetów = 93 obrazy.**

## 8. Docelowe pliki dokumentacji (`docs/projekt/`)

| Plik | Zawartość |
|---|---|
| `README.md` | spis treści dokumentacji projektu + jak z niej korzystać (dla 3 studentów) |
| `01-kierunek-artystyczny.md` | biblia stylu: marka, paleta, światło, materiały, typografia, styl każdej gry, czego unikać |
| `02-lista-obrazow.md` | pełny manifest 93 obrazów + jak je dostarczyć + jak je obrabiamy (pipeline) |
| `03-prompty-chatgpt.md` | GOTOWE do wklejenia prompty dla ChatGPT (czaty 0–5) + procedura + poprawki + kontrola jakości |
| `04-efekty-wizualne.md` | biblia efektów: każde zdarzenie z osią czasu (ms), warstwami, błyskami, cząsteczkami, wersją low/reduced-motion |
| `05-dzwiek-i-muzyka.md` | biblia dźwięku: pełna lista dźwięków z ID, stany muzyki, miks, formaty, synteza + opcjonalne prompty Suno |
| `06-interfejs-ux.md` | ekrany, komponenty, stany, responsywność (breakpointy), dostępność, mikrointerakcje |
| `07-gry-i-matematyka.md` | specyfikacja 3 automatów: siatki, linie, tabele wypłat (wstępne), funkcje, RTP, format kroków z API |
| `08-wydajnosc-i-jakosc.md` | jak osiągamy 60 fps: architektura renderu, poziomy jakości, budżety, pomiary, testy |

## 9. Katalog zdarzeń (wiążący — dokumenty 04 efekty, 05 dźwięk i 06 UI używają tych ID)

| ID | Nazwa | Kiedy |
|---|---|---|
| E01 | `lobby_intro` | pierwsze wejście na stronę (odsłonięcie logo, wejście kafli) |
| E02 | `lobby_idle` | tło lobby w spoczynku (pył, bokeh, paralaksa) |
| E03 | `kafel_hover` | najechanie / fokus / dotknięcie kafla gry (tilt 3D, poświata, start wideo) |
| E04 | `login_open` | otwarcie modala logowania |
| E05 | `login_blad` | niepoprawna nazwa gracza |
| E06 | `login_sukces` | zalogowanie powracającego gracza (bez bonusu) |
| E07 | `bonus_powitalny` | pierwsze logowanie: +10 000 (skrzynia, fontanna monet, monety lecą do salda) |
| E08 | `saldo_zmiana` | każda zmiana salda (licznik, puls) |
| E09 | `bankrut` | saldo < minimalny zakład |
| E10 | `bonus_ratunkowy` | odebranie bonusu ratunkowego 10 000 |
| E11 | `ui_mikro` | hover / klik / fokus / przełączniki — mikrointerakcje |
| E12 | `przejscie_do_gry` | przejście lobby → gra i gra → lobby |
| E20 | `gra_ladowanie` | ekran ładowania gry (pasek postępu) |
| E21 | `gra_intro` | pierwsze pokazanie automatu po załadowaniu |
| E22 | `gra_idle` | bezczynność na automacie |
| E23 | `zaklad_zmiana` | zmiana zakładu |
| E24 | `spin_start` | wciśnięcie SPIN |
| E25 | `bebny_obrot` | obrót bębnów (S1, S2) / zrzut planszy (S3) |
| E26 | `beben_stop` | zatrzymanie bębna (każdego osobno) |
| E27 | `antycypacja` | „prawie bonus” — 2 scattery na planszy (S2), 3 scattery (S3), 2 WILD na linii (S1) |
| E28 | `wygrana_small` | wygrana < 5× |
| E29 | `wygrana_medium` | wygrana ≥ 5× |
| E30 | `wygrana_big` | wygrana ≥ 15× — start pełnoekranowej sekwencji |
| E31 | `eskalacja_poziomu` | przejście BIG → MEGA → EPIC → ULTRA w trakcie liczenia |
| E32 | `wygrana_koniec` | koniec / przewinięcie sekwencji wygranej |
| E33 | `wild_ladowanie` | WILD ląduje na planszy |
| E34 | `scatter_ladowanie` | scatter ląduje (1., 2., 3.+ — eskalacja) |
| E35 | `free_spins_start` | aktywacja darmowych spinów (przejście, zmiana tła i muzyki) |
| E36 | `free_spins_spin` | kolejny darmowy spin (licznik) |
| E37 | `free_spins_podsumowanie` | podsumowanie darmowych spinów |
| E38 | `autoplay` | włączenie / wyłączenie / zatrzymanie autoplay |
| E39 | `turbo` | włączenie / wyłączenie trybu turbo |
| E40 | `blad_sieci` | błąd połączenia / serwera |
| E50 | `s1_neon_mnoznik` | S1: WILD na wygrywającej linii (×2) |
| E51 | `s1_neon_jackpot` | S1: cały ekran tego samego symbolu (×10) |
| E60 | `s2_wild_rozszerzenie` | S2: WILD rozszerza się na cały bęben (free spins) |
| E61 | `s2_retrigger` | S2: +10 darmowych spinów |
| E70 | `s3_kaskada_pekniecie` | S3: wygrywające symbole pękają |
| E71 | `s3_kaskada_opad` | S3: nowe symbole spadają |
| E72 | `s3_mnoznik_ladowanie` | S3: kula mnożnika ląduje |
| E73 | `s3_mnoznik_zbior` | S3: kule mnożników lecą do licznika i mnożą wygraną |

## 10. Identyfikatory dźwięków (wiążące)

UI: `ui_hover`, `ui_klik`, `ui_otworz`, `ui_zamknij`, `ui_blad`, `ui_przelacznik`, `ui_zaklad_gora`, `ui_zaklad_dol`.
Globalne: `sfx_logowanie`, `sfx_skrzynia_otwarcie`, `sfx_monety_fontanna` (pętla), `sfx_moneta_1` … `sfx_moneta_5`
(warianty losowe), `sfx_licznik_tik` (pętla), `sfx_licznik_koniec`, `sfx_saldo_puls`, `sfx_bankrut`,
`sfx_przejscie_whoosh`.
Wspólne dla gier: `sfx_spin_start`, `sfx_beben_petla_s1`, `sfx_beben_petla_s2` (pętle obrotu),
`sfx_beben_stop_1` … `sfx_beben_stop_6` (rosnąca wysokość), `sfx_antycypacja_narastanie`, `sfx_bicie_serca` (pętla),
`sfx_scatter_1`, `sfx_scatter_2`, `sfx_scatter_3`, `sfx_wild`, `sfx_wygrana_small_1` … `sfx_wygrana_small_3`,
`sfx_wygrana_medium`, `sfx_linia`, `sfx_bigwin_wejscie`, `sfx_poziom_w_gore`, `sfx_bigwin_koniec`, `sfx_blysk`,
`sfx_uderzenie_basu`, `sfx_free_spins_start`, `sfx_free_spins_koniec`.
S1: `sfx_s1_neon_bzyk`, `sfx_s1_jackpot`. S2: `sfx_s2_wild_rozszerzenie`, `sfx_s2_gong`.
S3: `sfx_s3_pekniecie_1` … `sfx_s3_pekniecie_4`, `sfx_s3_opad`, `sfx_s3_mnoznik`, `sfx_s3_mnoznik_zbior`.
Muzyka (pętle): `mus_lobby`, `mus_s1`, `mus_s2`, `mus_s2_fs`, `mus_s3`, `mus_s3_fs`, `mus_bigwin`,
`mus_napiecie` (warstwa napięcia nakładana na muzykę gry podczas antycypacji).

## 11. Zasady pisania dokumentów

* Polski, Markdown renderowany przez GitHub (tabele, Mermaid dozwolone), numerowane sekcje, bez nadmiaru emoji.
* Każdy dokument zaczyna się od 2–3 zdań: po co jest i jak go czytać; na końcu „Powiązane dokumenty” (linki względne).
* Konkret zamiast ogólników: liczby (ms, px, dB, liczba cząsteczek), nazwy plików i ID z tego briefu.
* Dokument musi być zrozumiały dla studenta, który będzie go bronił — przy nieoczywistych decyzjach dopisz „dlaczego”.
* Nie wymyślaj możliwości narzędzi, których nie jesteś pewien; jeśli coś jest niepewne — napisz to i podaj plan B.

## 12. Zespół

| Osoba | Nr indeksu | E-mail |
|---|---|---|
| Konrad Paulus | 112960 | s428425@student.wroclaw.merito.pl |
| Dominik Pacanowski | 112961 | s433776@student.wroclaw.merito.pl |
| Dawid Majewski | 113154 | s156704@student.wroclaw.merito.pl |

Wersja w `pom.xml`: `1.0.0-112960-112961-113154`. Repozytorium: `CasinoPlayer/Symulator-Kasyna`.
