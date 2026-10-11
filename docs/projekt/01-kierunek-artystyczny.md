# 01 — Kierunek artystyczny (biblia stylu)

> Ten dokument ustala, jak wygląda Cebulion Casino: logotyp, moneta, maskotka, światło, materiały, każdy symbol
> trzech automatów. Przeczytaj go, zanim wygenerujesz albo przyjmiesz jakikolwiek obraz. Prompty z
> [03-prompty-chatgpt.md](03-prompty-chatgpt.md) są „skompilowane” z tych zasad. Sekcje 1–8 dotyczą całego projektu,
> 9–11 opisują poszczególne gry, a 12–13 służą do kontroli jakości.

| Metryka | |
|---|---|
| Projekt | Cebulion Casino, symulator kasyna z wirtualną walutą (przedmiot „Wprowadzenie do technologii backendowych”, Uniwersytet WSB Merito Wrocław) |
| Zespół | Konrad Paulus (112960, s428425@student.wroclaw.merito.pl) · Dominik Pacanowski (112961, s433776@student.wroclaw.merito.pl) · Dawid Majewski (113154, s156704@student.wroclaw.merito.pl) |
| Wersja dokumentu | 1.0 (2026-10-11) |
| Zakres | 93 obrazy: 8 makiet + 85 assetów (pełna lista: [02-lista-obrazow.md](02-lista-obrazow.md)) |
| Hierarchia źródeł | brief projektu → ten dokument → prompt. Przy rozbieżności poprawiamy prompt, a nie styl. |

## Spis treści

1. [Cel i jak czytać](#1-cel-i-jak-czytać)
2. [Marka](#2-marka)
3. [Paleta kolorów](#3-paleta-kolorów)
4. [Wspólny język renderu](#4-wspólny-język-renderu)
5. [Symbole: zasady wspólne](#5-symbole-zasady-wspólne)
6. [Tła](#6-tła)
7. [Interfejs (UI)](#7-interfejs-ui)
8. [Typografia](#8-typografia)
9. [Gra S1: Cebulowy 777](#9-gra-s1-cebulowy-777)
10. [Gra S2: Złoty Faraon](#10-gra-s2-złoty-faraon)
11. [Gra S3: Kryształowa Kaskada](#11-gra-s3-kryształowa-kaskada)
12. [Czego unikać](#12-czego-unikać)
13. [Checklista akceptacji obrazu](#13-checklista-akceptacji-obrazu)
- [Załącznik A: indeks identyfikatorów obrazów](#załącznik-a-indeks-identyfikatorów-obrazów)
- [Powiązane dokumenty](#powiązane-dokumenty)

---

## 1. Cel i jak czytać

### 1.1. Po co ten dokument

Wszystkie obrazy powstaną w ChatGPT: 93 pliki, sześć osobnych czatów, kilka dni pracy. Generator pamięta tylko
bieżący czat i każdy prompt interpretuje odrobinę inaczej. Bez spisanych reguł dostaniemy **dryf stylu**: na jednym
obrazie złoto będzie cytrynowe, na innym miedziane; raz światło padnie z lewej, raz z prawej; jeden symbol wyjdzie
jak kreskówka, drugi jak zdjęcie. Gracz nie wie, co jest nie tak, ale czuje, że całość jest „amatorska”.
Topowe studia slotów (poziom, do którego celujemy) pracują z takim samym przewodnikiem stylu — zestawem stałych
decyzji, które każdy obraz musi spełnić.

Drugi powód: **obrona projektu**. Każda nieoczywista decyzja ma tu uzasadnienie oznaczone „Dlaczego”, więc
student może odpowiedzieć na pytanie w rodzaju „czemu obrazy nie mają cieni?” albo „czemu tekst przycisku nie jest
częścią grafiki?”.

### 1.2. Podział pracy: co jest na obrazie, a co robi kod

| Element | Na obrazie z ChatGPT | W kodzie (CSS / PixiJS 8) |
|---|---|---|
| Kształt, materiał, kolor, statyczne oświetlenie | tak | — |
| Cień rzucany na podłoże | **nie** | sprite cienia wygenerowany z kanału alfa podczas obróbki (§ 4.7) |
| Poświata wokół obiektu | tylko delikatna, mieszcząca się w marginesie | sprite poświaty w trybie `add` albo filtr bloom (poziom High) |
| Teksty interfejsu, saldo, zakład, kwoty w panelu | **nie** | HTML (lobby, panele) i `BitmapText` (scena gry) |
| Tekst na obrazie | wyłącznie: `WILD`, `SCATTER`, `BAR`, `7`, `10`/`J`/`Q`/`K`/`A`, logotypy, banery wygranych, cyfry `g_font_cyfry` | — |
| Stany hover / pressed / focus / disabled | **nie** | CSS i Pixi (§ 7.2) |
| Animacje, cząsteczki, błyski, drżenie ekranu | **nie** | [04-efekty-wizualne.md](04-efekty-wizualne.md) |
| Linie wygrywające, obwódki wygrywających pól, separatory bębnów | **nie** | `Graphics` w Pixi |
| Liczba na kuli mnożnika S3 („×5”) | **nie** (pusty, jasny środek) | kod |
| Rozmycie ruchu podczas obrotu bębnów | **nie** | wariant rozmyty generowany przy obróbce albo filtr |
| Winieta, przyciemnienia pod tekstem | lekka, wbudowana w tła | regulowana w kodzie (gradient / scrim) |

**Dlaczego tak:** obraz jest statyczny i ma jedną rozdzielczość. Wszystko, co się zmienia (liczby, stany, ruch)
albo musi być ostre w każdej skali (tekst), robi kod. Dzięki temu jeden plik PNG obsługuje telefon i monitor 4K,
a tekst jest dostępny dla czytników ekranu.

### 1.3. Jak czytać

| Kto | Co czytać |
|---|---|
| Właściciel generujący obrazy | § 2 i § 9–11 (co ma być na obrazie), § 12 (czego unikać), § 13 (checklista przed wysłaniem pliku) |
| Programista frontu | § 3 (tokeny), § 4.7 (cienie w kodzie), § 5.7 (stany symbolu), § 6.4 (kadrowanie teł), § 7 (UI), § 8 (fonty) |
| Osoba broniąca projektu | akapity „Dlaczego” w każdej sekcji |

Słowa kluczowe: **MUSI** = warunek akceptacji obrazu, **POWINIEN** = domyślnie tak (odstępstwo trzeba uzasadnić),
**NIE WOLNO** = powód odrzucenia. Identyfikatory w `takim zapisie` (np. `s2_sym_anubis`) są wiążące i odpowiadają
nazwom plików z [02-lista-obrazow.md](02-lista-obrazow.md).

### 1.4. Kolejność pracy i kotwice stylu

1. **Czat 0 — makiety** `m01`–`m08`. Pokazują kompozycję i nastrój całych ekranów. Nie trafiają do aplikacji,
   więc literówki na makiecie są dopuszczalne. Zespół i właściciel zatwierdzają na nich kierunek, zanim powstanie
   pierwszy asset.
2. **Czat 1 — GLOBAL A.** Zaczynamy od `g_moneta_przod` i `g_emblemat`, bo ustalają „nasze złoto”.
3. **Czat 2 — GLOBAL B** (UI, banery, efekty), potem **Czat 3 — S1** (P0), **Czat 4 — S2** (P1),
   **Czat 5 — S3** (P2).

**Kotwice stylu** to trzy zaakceptowane obrazy, które dołączamy jako obraz referencyjny na początku każdego
kolejnego czatu (ChatGPT przyjmuje obrazy w wiadomości):

| Kotwica | Co utrwala |
|---|---|
| `g_moneta_przod` | barwę i połysk złota, kierunek światła key |
| `g_ui_spin` | połączenie złota ze szkłem, poziom detalu UI |
| `m05_s1_desktop` | skalę kontrastu, gęstość detalu tła i ogólną „temperaturę” sceny |

Plan B: jeśli obraz referencyjny zaczyna „przeciekać” do wyników (np. każdy symbol S2 dostaje neonowy obrys
z makiety S1), w danym czacie wyłączamy referencję i opieramy się na samym tekście z § 4.10.

### 1.5. Słowniczek

| Termin | Znaczenie w tym dokumencie |
|---|---|
| **Key light** | główne światło sceny; u nas ciepłe, z lewej-góry |
| **Fill light** | słabe światło wypełniające; rozjaśnia cienie, żeby nie były czarne |
| **Rim light** | światło konturowe zza obiektu; rysuje jasną krawędź i odcina obiekt od ciemnego tła |
| **Specular** | odblask, czyli jasna plamka światła na błyszczącej powierzchni |
| **Fresnel** | efekt jaśniejszych krawędzi szkła i lakieru oglądanych pod ostrym kątem |
| **AO (ambient occlusion)** | przyciemnienie w zagłębieniach i szczelinach samego obiektu |
| **SSS** | przenikanie światła pod powierzchnię (skórka cebuli, wosk, owoce); daje ciepłe, „żywe” krawędzie |
| **Dyspersja** | rozszczepienie światła na kolory tęczy w krysztale („ogień” diamentu) |
| **Bloom** | rozmyta poświata wokół bardzo jasnych miejsc, dodawana filtrem w kodzie |
| **Tryb `add`** | mieszanie addytywne: kolor sprite'a dodaje się do tła, czarny staje się niewidoczny |
| **9-slice** | podział obrazu na 9 części: rogi stałe, krawędzie i środek rozciągane (CSS `border-image`) |
| **Winieta** | przyciemnienie rogów i krawędzi kadru, kieruje wzrok do środka |
| **Bokeh** | rozmyte, okrągłe plamy świateł poza ostrością |
| **Sylwetka** | obrys obiektu wypełniony jednym kolorem; test rozpoznawalności kształtu |
| **Jasność (value)** | jak jasny jest kolor po zamianie na skalę szarości |
| **ALFA / CZARNE / PELNE / SHEET** | typy tła obrazu z briefu: przezroczyste / czarne #000000 / pełny obraz / arkusz z siatką elementów |

---

## 2. Marka

### 2.1. Nazwa i zapis

| Element | Zapis | Uwagi |
|---|---|---|
| Nazwa | **Cebulion Casino** | w logotypie wersalikami: `CEBULION CASINO` |
| Waluta | **cebulion** (mała litera) | odmiana: 1 cebulion, 2–4 cebuliony, 5+ cebulionów; „10 000 cebulionów” |
| Symbol waluty w UI | ikona monety (`g_moneta_przod`, 20–28 px) **przed** kwotą | nie wymyślamy skrótu literowego — moneta jest czytelniejsza i bardziej „nasza” |
| Kwoty | grupowanie spacją niełamliwą: `10 000`, `1 250 000` | patrz uwaga niżej |

**Uwaga techniczna o kwotach.** Polski wariant `Intl.NumberFormat('pl-PL')` domyślnie **nie grupuje liczb
czterocyfrowych** (pokaże `1000`, ale `10 000`), bo tak stanowią polskie reguły w danych CLDR. Saldo „skacze” wtedy
wizualnie przy przejściu 9999 → 10 000. Używamy własnej funkcji formatującej (grupowanie co 3 cyfry od 1000 w górę,
separator U+00A0), żeby wszystkie kwoty wyglądały tak samo. Szczegóły: [06-interfejs-ux.md](06-interfejs-ux.md).

### 2.2. Hasło

**„Graj bez ryzyka. Wygrywaj z klasą.”**

* Gdzie: pod logotypem w sekcji powitalnej lobby (E01), na ekranie ładowania gry (E20), w stopce.
* Jak: zawsze tekst HTML, nigdy na obrazie. Cinzel 700, `letter-spacing: 0.08em`, kolor `--text-2`; na ekranie
  ładowania dopuszczalne złoto `--gold-1`.
* Nie skracamy i nie przerabiamy hasła („Graj bez ryzyka!” bez drugiej części osłabia ton „z klasą”).

### 2.3. Logotyp `g_logo`

**Kompozycja (lockup pionowy, 3:2 ALFA, 1536×1024).** Od góry:

1. **Emblemat** (ten sam projekt co `g_emblemat`, § 2.4) wyśrodkowany, około 40% wysokości całego logotypu.
2. **CEBULION** — główny wiersz na całą szerokość logotypu, wysokość wersalików około 22% wysokości logotypu.
3. **CASINO** — wersaliki o wysokości ~45% liter „CEBULION”, szeroki odstęp między literami (+0,35 em),
   po obu stronach cienkie złote linie zakończone małymi rombami.

Całość zajmuje około 84% szerokości kadru (~1290 px), z marginesem co najmniej 6% z każdej strony.

**Styl liter.** Klasyczne rzymskie kapitały inskrypcyjne (rodzina Trajan/Cinzel): ostre szeryfy z łagodnym
przejściem, wyraźny kontrast grubości kresek. Litery są **ekstrudowanym, polerowanym złotem** z fazowaną krawędzią
(głębokość wyciągnięcia ~6% wysokości litery). Faza łapie ciepłe światło key z lewej-góry, przednia ściana ma
pionowy gradient `--gold-1` → `--gold-2` → `--gold-3`. Na prawych krawędziach cienki cyjanowy rim, na dolnych fazach
ślad magentowego odbicia. Litery otacza cienki ciemnogranatowy kontur (~2% wysokości litery), który utrzymuje
czytelność na wideo i jasnych bokeh.

**Użycie:** sekcja powitalna lobby (szerokość 360–720 px), ekran ładowania, intro (E01: błysk przesuwający się
po literach robi kod maską z kanału alfa).
**Minimalna szerokość:** 160 px (desktop) / 120 px (mobile). **Pole ochronne:** wysokość litery „C” z każdej strony.

**Wariant w nagłówku.** W pasku górnym (wysokość 56–64 px) **nie** używamy `g_logo`. Stawiamy `g_emblemat`
(40 px) i obok napis HTML „CEBULION CASINO” w Cinzel 900 ze złotym gradientem (`background-clip: text`).
**Dlaczego:** rastrowy lockup zmniejszony do 50 px wysokości ma nieczytelne litery i rozmyte krawędzie, a tekst HTML
jest ostry w każdej skali. Dlatego litery logotypu MUSZĄ przypominać krój Cinzel — napis w nagłówku i logotyp
muszą wyglądać jak jedna marka.

### 2.4. Emblemat `g_emblemat`

Okrągły medalion, w którego środku **złota cebula nosi koronę**. Emblemat to „pieczęć” marki: favicon, ikona
aplikacji, loader, znak wodny i element nagłówka.

| Część | Opis |
|---|---|
| Medalion | średnica ~78% kadru 1:1; zewnętrzny pierścień z polerowanego złota (grubość ~7% promienia), za nim pierścień drobnego giloszu (grawerowane fale) |
| Pole | głęboka granatowo-fioletowa emalia w tonie `--bg-2` z delikatnym promienistym „sunburstem” |
| Cebula | pękata, polerowane złoto, 5 widocznych pionowych żeber, łagodnie zaokrąglony czubek; od dołu dwie gałązki laurowe obejmują ją łukiem |
| Korona | pięć zębów (naprzemiennie lilie i perły), na obręczy kamienie: magentowy rubin w środku, po bokach cyjanowe szafiry; korona **wychodzi poza obrys medalionu** u góry (do granicy marginesu 6%) |
| Światło | key z lewej-góry; rim cyjan na prawej krawędzi pierścienia; drobne odblaski na kamieniach |

**Czytelność w 32 px:** sylwetka = koło + zęby korony nad nim. W 16 px (favicon) zostaje złoty krążek z ząbkami,
co wystarcza. Favicon tworzymy przez zmniejszenie i lekkie wyostrzenie emblematu, bez osobnego obrazu.
**Czym emblemat różni się od monety:** emblemat ma emalię, kamienie i koronę przekraczającą obrys; moneta jest cała
złota, płaska, ma ząbkowany rant. Nie mogą być mylone ani w lobby, ani w deszczu monet.

### 2.5. Moneta cebulion `g_moneta_przod`, `g_moneta_skos`, `g_moneta_bok`

Jedna moneta pokazana w trzech ujęciach. Występuje jako ikona waluty (20–28 px), w cząsteczkach (24–64 px:
fontanna monet E07, wygrane E29+, lot do salda) i w scenie bonusu (160–256 px).

| Cecha | Projekt |
|---|---|
| Proporcje | grubość ≈ 9% średnicy — „masywna, growa” (prawdziwa moneta ma ~7%; grubsza lepiej czyta się w ruchu) |
| Awers, środek | **płaskorzeźba cebuli w koronie** (ta sama sylwetka co w emblemacie, uproszczona, bez kamieni); cała ze złota |
| Awers, pole | złoto satynowe, szczotkowane promieniście od środka |
| Awers, perełkowanie | pierścień ~60 drobnych wypukłych perełek tuż przy rancie |
| Awers, ozdoby | dwie małe pięcioramienne gwiazdki po bokach cebuli, krótka gałązka laurowa u dołu |
| Napisy | **brak** |
| Obrzeże (otok) | podniesiony, polerowany na lustro, szerokość ~8% promienia |
| Rant | ząbkowany, ~100–120 drobnych pionowych żłobień, wyraźnie widocznych w `g_moneta_bok` |
| Materiał | relief i otok **polerowane** (jasne, kontrastowe odblaski), pole **satynowe** (miękki połysk) |
| Rewers | nie generujemy |

**Dlaczego bez napisów:** w docelowych rozmiarach (16–64 px) napis byłby szumem, a generator obrazów często psuje
litery biegnące po łuku. Kontrast „polerowany relief na satynowym polu” robi większe wrażenie niż tekst.

**Dlaczego bez rewersu:** w locie moneta obraca się kilka razy na sekundę i ma 24–64 px — nikt nie odróżni awersu od
rewersu. Obrót składamy w kodzie z ujęć `przod` → `skos` → `bok` → `skos` (odbite poziomo, `scale.x = -1`) →
`przod`, a przejścia wygładza ściskanie `scale.x`. Plan B dla płynniejszego obrotu: sprite-sheet 24–48 klatek
z Blendera (`bpy`, headless), z materiałem dopasowanym kolorystycznie do `g_moneta_przod`.

**Ujęcia:**

| ID | Kąt | Wymaganie |
|---|---|---|
| `g_moneta_przod` | 0°, frontalnie | idealne koło, relief czytelny, światło z lewej-góry |
| `g_moneta_skos` | ~45° obrotu wokół osi pionowej | elipsa ~0,7:1, widać fragment rantu po prawej |
| `g_moneta_bok` | ~80–85° | wąska elipsa, rant z żłobieniami zajmuje większość widoku |

Wszystkie trzy MUSZĄ przedstawiać tę samą monetę: ten sam relief, ta sama barwa złota, to samo światło.
Generujemy je jedno po drugim w jednym czacie z dopiskiem „the same coin as in the previous image”.

### 2.6. Skrzynia skarbów `g_skrzynia`

Rekwizyt bonusu powitalnego (E07) i ratunkowego (E10). Otwarta skrzynia z głęboko fioletowego, lakierowanego
drewna (ton `--bg-2`), okuta polerowanym złotem: narożniki, dwie obręcze, zamek w kształcie emblematu z cebulą.
Wieko uchylone o ~110°, wnętrze wypełnione kopcem monet cebulion (tych samych co w § 2.5) z kilkoma magentowymi
i cyjanowymi klejnotami. Ze środka bije złota poświata ku górze (wygasająca przed marginesem), 3–5 monet przewiesza
się przez przednią krawędź. Bez podłogi i bez cienia pod skrzynią.

### 2.7. Maskotka Pan Cebulion

**Kim jest.** Gospodarz salonu, elegancki dżentelmen o charyzmie konferansjera. Wita gości, cieszy się z ich wygranych
i z klasą pociesza po przegranej. Jest dowcipny i trochę teatralny, ale **nigdy dziecinny** i nigdy nie namawia do gry
na siłę. Zwracamy się do niego „Pan” — to część żartu: cebula z manierami arystokraty.

**Budowa i proporcje** (jednostka `u` = wysokość bulwy):

| Część | Wymiary / proporcje | Opis |
|---|---|---|
| Bulwa (głowa i tułów w jednym) | 1,0 u wysokości × 0,9 u szerokości | pękata złota cebula, łagodnie zaokrąglony czubek ukryty pod cylindrem |
| Cylinder | 0,48 u wysokości, rondo 0,62 u | przechylony o ~10° w stronę prawego brzegu kadru |
| Nogi | 0,40 u | smukłe, w spodniach |
| Ręce | sięgają do połowy uda | smukłe, w rękawiczkach |
| Cała postać | ≈ 1,9 u z cylindrem | w kadrze 1:1 zajmuje ~82% wysokości |

**Materiały i kolory:**

| Element | Materiał | Kolor |
|---|---|---|
| Skórka bulwy | warstwowa, metalicznie złota łuska z perłowym połyskiem; 7 delikatnych pionowych żeber od czubka do dołu; na krawędziach lekkie przeświecanie (SSS) jak w prawdziwej cebuli | gradient złota z § 3.4 |
| Cylinder | czarno-fioletowy jedwab z miękkim połyskiem | `#120B2A`–`#1E1442`, refleks fioletowy |
| Wstążka cylindra | złota satyna z małą przypinką-monetą cebulion | `--gold-2` |
| Monokl | okrągły, w polerowanej złotej oprawce, na **prawym oku postaci** (po lewej stronie kadru); szkło z ostrym białym odblaskiem | złoto + szkło |
| Łańcuszek monokla | cienki, złoty, opada łukiem do szpilki przy muszce | `--gold-2` |
| Muszka | satynowa, z subtelnym wzorem w romby | `--magenta` #FF2E88, fałdy `#B3135C` |
| Kołnierzyk | biały, sztywny, z wywiniętymi rogami (wing collar), wyłania się spod muszki | `#F4EBD9` |
| Rękawiczki | kremowe, gładkie | `#F4EBD9` |
| Spodnie | wąskie, ciemnogranatowe, z kieszeniami (potrzebne w pozie „bankrut”) | `#1E1442` |
| Buty | czarne lakierki z białymi getrami | czerń z fioletowym odblaskiem |

**Twarz i mimika.**

* Oczy: migdałowe, średniej wielkości (nie duże okrągłe „kawaii”), czarne źrenice z jednym białym odblaskiem,
  osadzone na 35–45% wysokości bulwy.
* Brwi: grube, ciemnobrązowe, bardzo ekspresyjne. To główne narzędzie mimiki — jedna uniesiona = „dowcip”,
  obie w górę pośrodku = „cóż…”.
* **Wąsy:** podkręcone wąsy „z korzonków” w kolorze jasnego złota — stylizacja korzonków cebuli. To znak
  rozpoznawczy postaci.
* Usta: pewny siebie półuśmiech z zamkniętymi ustami; zęby widać tylko w pozie „wygrana”.

**Osobowość w skrócie:** gospodarz, dżentelmen, dowcipniś. Jego humor to puszczenie oka, a nie pajacowanie.

**Trzy pozy (1:1 ALFA, ta sama postać):**

| ID | Poza | Mimika | Rekwizyty |
|---|---|---|---|
| `g_maskotka_powitanie` | lekki ukłon (tułów pochylony ~8°), prawa ręka uchyla cylinder, lewa w otwartym geście zaproszenia na wysokości pasa, skierowana do widza | puszcza oko lewym okiem (prawe za monoklem), półuśmiech, jedna brew w górę | — |
| `g_maskotka_wygrana` | podskok (stopy nad ziemią, kolana ugięte), obie ręce w górę w „V”; cylinder podskakuje ~10% nad głowę, monokl wypadł i kołysze się na łańcuszku | szeroki, radosny uśmiech z zębami, oczy przymrużone ze szczęścia | 6–10 monet cebulion (projekt z § 2.5) w powietrzu, wszystkie w kadrze |
| `g_maskotka_bankrut` | stoi, wzrusza ramionami, oboma rękami wywraca na zewnątrz kieszenie spodni (kremowa podszewka) | autoironiczny półuśmiech, brwi uniesione pośrodku („cóż… bywa”), monokl zwisa na łańcuszku | mały obłoczek kurzu z kieszeni i jedna drobna ćma odlatująca w górę |

**Dlaczego bankrut jest zabawny, a nie smutny:** gra jest symulatorem bez prawdziwych pieniędzy. Smutna albo
płacząca postać budowałaby presję w stylu „odegraj się”. Autoironia i od razu propozycja bonusu ratunkowego (E10)
utrzymują lekki ton i nikogo nie zawstydzają.

**Spójność między pozami.** Najpierw generujemy `g_maskotka_powitanie`. Po akceptacji dołączamy ją jako obraz
referencyjny do dwóch pozostałych póz („same character, same proportions, same outfit, same colors”).
Przy kontroli porównujemy: kąt cylindra, stronę monokla, kolor muszki, kształt wąsów i liczbę żeber.

**Oryginalność.** Cylinder i monokl to ogólne atrybuty dżentelmena, ale nie kopiujemy znanych maskotek reklamowych
(np. postaci orzeszka w cylindrze). Własny charakter dają: cebulowa bulwa ze złotą łuską, wąsy z korzonków,
magentowa muszka i ciemny jedwab z fioletowym refleksem.

**Jak animuje ją kod.** Każda poza to jeden płaski obraz, więc animujemy tylko przekształcenia całości: „oddech”
(`scale.y` 1,000 → 1,015 → 1,000 w 2400 ms), wskoczenie z odbiciem (squash & stretch 0,92 / 1,06), kołysanie
±3°, cień-elipsa pod stopami rysowana w kodzie. **Nie** mrugamy oczami i nie ruszamy kończynami — wymagałoby to
pociętej na części postaci (rig 2D), co wykracza poza zakres projektu. Uczciwie mówimy to na obronie.

### 2.8. Ton marki

Ton: **elegancki, pewny siebie, z przymrużeniem oka.** Mówimy do gracza na „Ty”, krótkimi zdaniami. Humor opiera
się na kontraście „cebula” + „luksus”, nigdy nie kpi z gracza. Zawsze jasno komunikujemy, że to symulator.

| Tak | Nie |
|---|---|
| „Witaj w Cebulion Casino!” | „GRAJ TERAZ I WYGRAJ MILIONY!!!” |
| „Na dobry początek: 10 000 cebulionów.” | „Wpłać, żeby grać dalej” (nie ma wpłat) |
| „Kieszenie puste? Bywa. Proszę — na koszt firmy.” | „Przegrałeś wszystko” |
| „Wejdź do kasyna” | „Odegraj się!” |
| „Symulator. Wirtualna waluta bez wartości.” | słowa „pieniądze”, „gotówka”, „wypłata na konto” |

Na obrazach marki: nie ma banknotów, znaków `$`/`€`, żetonów z nominałami walut ani prawdziwych kart płatniczych.
Jedyną „walutą” na grafikach jest moneta cebulion.

---

## 3. Paleta kolorów

### 3.1. Tokeny globalne (z briefu, niezmienne)

Tokeny żyją w CSS jako zmienne `:root` i są przekazywane do Pixi jako liczby (`0x07060F`). Na obrazach z ChatGPT
podajemy je jako wartości hex w promptach.

| Token | HEX | RGB | Rola | Zastosowanie w UI | Zastosowanie na obrazach |
|---|---|---|---|---|---|
| `--bg-0` | `#07060F` | 7, 6, 15 | najgłębsza czerń z nutą granatu | tło strony, tekst na złotych przyciskach | najciemniejsze partie teł, winieta |
| `--bg-1` | `#120B2A` | 18, 11, 42 | ciemny granat-fiolet | tło paneli, pasek górny, karty | cienie w tłach, „powietrze” wnętrz |
| `--bg-2` | `#1E1442` | 30, 20, 66 | fiolet nocy | szkło paneli, pola formularzy, hover kart | emalia emblematu, szkło przycisków, lakier skrzyni |
| `--gold-1` | `#FFE08A` | 255, 224, 138 | jasne złoto (światła) | liczby wygranych, akcenty, ikony aktywne | odblaski złota, górne fazy liter |
| `--gold-2` | `#F5C542` | 245, 197, 66 | złoto królewskie (bazowe) | przycisk główny, ramki, nagłówki | dominujący ton każdego złotego obiektu |
| `--gold-3` | `#B8860B` | 184, 134, 11 | ciemne złoto (cienie) | obrysy, separatory, dolny stop gradientu | cienie na złocie, dolne fazy |
| `--magenta` | `#FF2E88` | 255, 46, 136 | neonowy akcent ciepły | wyróżnienia, odznaki, poziom MEGA | rim drugorzędny, muszka maskotki, neon S1 |
| `--cyan` | `#21E6FF` | 33, 230, 255 | neonowy akcent chłodny | fokus klawiatury, stany aktywne (turbo/auto) | rim główny, kamienie korony, neon S1 |
| `--win-green` | `#3DFF8F` | 61, 255, 143 | semantyka: zysk | dodatnia zmiana salda, „+” w historii | nie używamy jako koloru dominującego obrazu |
| `--danger` | `#FF4D4D` | 255, 77, 77 | semantyka: błąd | błąd logowania (E05), błąd sieci (E40) | nie używamy na obrazach |
| `--text-1` | `#FFFFFF` | 255, 255, 255 | tekst główny | treść, etykiety na ciemnym tle | tylko odblaski (punktowo) |
| `--text-2` | `#C9C3E6` | 201, 195, 230 | tekst drugorzędny (lawendowa szarość) | opisy, podpisy, hasło | ton światła fill (lawendowy) |

### 3.2. Proporcje użycia

Reguła na każdy ekran i każde tło:

| Grupa | Udział w kadrze | Uwagi |
|---|---|---|
| Ciemne (`--bg-0`…`--bg-2` i ich odcienie) | ~70% | daje „nocny luksus” i kontrast dla złota i efektów |
| Złoto (`--gold-1`…`--gold-3`) | ~20% | ramy, przyciski, litery, symbole wysokie |
| Neon (`--magenta`, `--cyan`) | ≤ 10% | akcent, nie wypełnienie; większe płaszczyzny neonu tylko w S1 |
| Semantyczne (`--win-green`, `--danger`) | punktowo | wyłącznie w znaczeniu „zysk” i „błąd” |

**Dlaczego:** ciemne tło sprawia, że efekty w trybie `add` (błyski, iskry, promienie) naprawdę świecą. Na jasnym tle
addytywne światło „blaknie”, bo nie ma czego rozjaśniać. Złoto potrzebuje ciemności, żeby wyglądać drogo.

### 3.3. Tokeny pochodne (projektowe, nie zmieniają briefu)

| Token | Wartość | Po co |
|---|---|---|
| `--gold-hi` | `#FFF6D6` | najjaśniejszy odblask na złocie (rdzeń speculara) |
| `--gold-deep` | `#5C3A00` | głęboki cień na złocie |
| `--gold-core` | `#2B1A00` | najciemniejsze odbicie w polerowanym złocie |
| `--ink-on-gold` | `var(--bg-0)` | tekst na złotym przycisku |
| `--glass` | `rgba(30, 20, 66, 0.80)` | szkło paneli i modali (z `backdrop-filter: blur(14px)`) |
| `--glass-strong` | `rgba(18, 11, 42, 0.88)` | panel na bardzo jasnym lub ruchliwym tle (wideo, wybuch efektów) |
| `--line-gold` | `rgba(245, 197, 66, 0.35)` | linie dekoracyjne, separatory |
| `--line-gold-ui` | `rgba(245, 197, 66, 0.50)` | obramowania elementów interaktywnych (pola, kafle) |
| `--violet-epic` | `#8F3DFF` | fioletowy płomień poziomu EPIC (§ 3.5) |
| `--focus` | `var(--cyan)` | obrys fokusu klawiatury |
| `--gold-grad` | `linear-gradient(180deg, #FFE08A 0%, #F5C542 55%, #B8860B 100%)` | złote napisy HTML i ramki CSS |

### 3.4. Rampa złota — jedno złoto dla wszystkich obrazów

Najczęstszy błąd generatorów to złoto, które raz jest cytrynowe, a raz miedziane. Każde złoto w projekcie MUSI
mieścić się w tej rampie (od świateł do cieni):

| Stop | HEX | Gdzie na obiekcie |
|---|---|---|
| odblask | `#FFF6D6` (`--gold-hi`) | maleńki rdzeń speculara, ≤ 2% powierzchni |
| światło | `#FFE08A` (`--gold-1`) | powierzchnie zwrócone do key light |
| baza | `#F5C542` (`--gold-2`) | większość powierzchni |
| półcień | `#B8860B` (`--gold-3`) | powierzchnie odwrócone od światła |
| cień | `#5C3A00` (`--gold-deep`) | zagłębienia, dolne fazy |
| odbicie ciemne | `#2B1A00` (`--gold-core`) | ciemne pasy odbić w polerowanym złocie |

Złoto **ciepłe żółte** (ok. 22–24 karaty), nie różowe, nie miedziane, nie zielonkawe. W promptach: *warm yellow
polished gold, not copper, not rose gold, not lemon yellow*.

### 3.5. Kolory poziomów wygranej

Te barwy definiują banery `g_win_*` i domyślny odcień (tint) promieni i cząsteczek danego poziomu. Dokładne użycie
w czasie opisuje [04-efekty-wizualne.md](04-efekty-wizualne.md).

| Poziom (próg) | Dominanta | Akcent | Charakter |
|---|---|---|---|
| `small` (> 0 i < 5×) | `--gold-1` | — | ciepłe podświetlenie |
| `medium` (≥ 5×) | `--gold-2` | `--cyan` (iskry) | złoto + chłodne iskry |
| `big` (≥ 15×) | rampa złota | białe ciepłe promienie `#FFF3D1` | czyste, masywne złoto |
| `mega` (≥ 30×) | rampa złota | `--magenta` + `--cyan` (klejnoty) | złoto wysadzane klejnotami |
| `epic` (≥ 60×) | rampa złota | `--violet-epic` `#8F3DFF`, rdzeń `--magenta` | płonące złoto z fioletowym ogniem |
| `ultra` (≥ 100×) | tęczowy kryształ | widmo `--cyan` → `--violet-epic` → `--magenta` → `--gold-1` + biel | najmocniejszy: kryształ, złoto, tęcza |

### 3.6. Kontrast tekstu (WCAG 2.1 AA)

Wymagania: tekst zwykły **≥ 4,5:1**, tekst duży (≥ 24 px albo ≥ 18,66 px pogrubiony) **≥ 3:1**, elementy
interfejsu i grafiki niosące informację (obramowanie pola, ikona przycisku, fokus) **≥ 3:1** (kryterium 1.4.11).
Wartości policzyliśmy wzorem WCAG na luminancję względną:

| Tekst \ tło | `--bg-0` | `--bg-1` | `--bg-2` | Werdykt |
|---|---|---|---|---|
| `--text-1` #FFFFFF | 20,15 | 18,97 | 17,02 | AA i AAA wszędzie |
| `--text-2` #C9C3E6 | 11,93 | 11,23 | 10,08 | AA i AAA wszędzie |
| `--gold-1` #FFE08A | 15,63 | 14,71 | 13,19 | AA wszędzie |
| `--gold-2` #F5C542 | 12,43 | 11,70 | 10,49 | AA wszędzie |
| `--gold-3` #B8860B | 6,19 | 5,83 | 5,23 | AA (najciemniejszy stop gradientu nadal przechodzi) |
| `--magenta` #FF2E88 | 5,76 | 5,42 | 4,86 | AA, ale na `--bg-2` z małym zapasem — w małych rozmiarach używaj na `--bg-0`/`--bg-1` |
| `--cyan` #21E6FF | 13,27 | 12,49 | 11,21 | AA wszędzie |
| `--win-green` #3DFF8F | 15,26 | 14,36 | 12,88 | AA wszędzie |
| `--danger` #FF4D4D | 6,16 | 5,80 | 5,20 | AA wszędzie |

Tekst **na kolorowych wypełnieniach**:

| Tekst na tle | Kontrast | Werdykt i decyzja |
|---|---|---|
| `--bg-0` na `--gold-2` (złoty przycisk) | 12,43 | **tak robimy** — tekst przycisku głównego jest ciemny |
| `--text-1` na `--gold-2` | 1,62 | **NIE WOLNO** — biały tekst na złocie jest nieczytelny |
| `--bg-0` na `--gold-3` | 6,19 | AA |
| `--text-1` na `--gold-3` | 3,25 | tylko tekst duży |
| `--text-1` na `--magenta` | 3,50 | tylko tekst duży; dla małego tekstu użyj `--bg-0` (5,76) |
| `--text-1` na `--danger` | 3,27 | tylko tekst duży; komunikat błędu piszemy kolorem `--danger` na ciemnym tle (6,16) |
| `--bg-0` na `--cyan` | 13,27 | AA (np. odznaka „TURBO”) |

**Tekst na szkle nad obrazem lub wideo.** Najgorszy przypadek to jasny fragment pod półprzezroczystym panelem.
Policzyliśmy kolor wypadkowy panelu `--bg-2` nad białym tłem:

| Krycie panelu | `--text-2` | `--gold-2` | `--text-1` | Werdykt |
|---|---|---|---|---|
| 0,72 | 4,06 | 4,23 | 6,86 | za mało dla `--text-2` i `--gold-2` |
| **0,80** | **5,40** | **5,62** | 9,12 | **minimum dla `--glass`** |
| 0,88 | 7,14 | 7,44 | 12,06 | `--glass-strong` (nad wideo i efektami) |

Linie dekoracyjne `--line-gold` (35%) mają 2,34:1 względem `--bg-1` — wolno, bo są czysto ozdobne.
Obramowanie pola tekstowego niesie informację, więc używa `--line-gold-ui` (50%, 3,63:1).

### 3.7. Daltonizm i skala szarości

* Kolor nigdy nie jest jedynym nośnikiem informacji: zysk = `--win-green` **i** znak „+”, błąd = `--danger`
  **i** ikona oraz tekst.
* Magenta i cyjan różnią się nie tylko barwą, ale i jasnością (luminancja 0,25 i 0,64, kontrast między nimi 2,31:1),
  więc rozróżnia je również osoba z deuteranopią albo protanopią.
* Symbole w każdej grze muszą przejść test w skali szarości i symulacji daltonizmu (§ 5.2). Narzędzie: Chrome
  DevTools → Rendering → *Emulate vision deficiencies*.

---

## 4. Wspólny język renderu

### 4.1. Styl ogólny: high-end stylized 3D

Każdy obraz wygląda jak **kolekcjonerska figurka z polerowanego metalu, szkła i emalii sfotografowana w studiu**:

* formy uproszczone i lekko przerysowane (~20% bardziej pękate, grubsze, bardziej „soczyste” niż w naturze);
* czyste fazowania krawędzi, które łapią światło;
* połysk i gładkie gradienty zamiast tekstur „z natury” (bez porów, rys, brudu, odcisków palców);
* bogaty, ale kontrolowany detal: maksymalnie 3 poziomy szczegółu (bryła → główne podziały → drobny ornament);
* filmowe światło z wyraźnym rim light i subtelną poświatą.

To **nie** jest fotorealizm (zbyt surowy i „brudny” w małej skali), **nie** płaska grafika wektorowa (wygląda tanio
obok efektów 3D) i **nie** styl dziecięcy (plastikowe zabawki, wielkie oczy, pastelowe kolory).

### 4.2. Oświetlenie — wspólny schemat trzech świateł

Wszystkie obrazy (symbole, UI, postacie, logotypy, ramki) używają tego samego schematu. Tła mają własne źródła
światła w scenie (§ 6), ale ich dominujący kierunek też jest „z lewej-góry”.

| Światło | Kierunek | Barwa | Siła (względem key) | Efekt |
|---|---|---|---|---|
| **Key** | z lewej-góry, ~45° w lewo od kamery i ~45° w górę, lekko z przodu | ciepłe, ~3500 K (≈ `#FFC489`) | 100% | modeluje bryłę; specular w lewej-górnej ćwiartce każdej formy |
| **Fill** | z prawej-przodu, nisko (~15° nad osią) | chłodna lawenda (≈ `#6E64B8`) | 20–30% | cienie są fioletowo-brązowe, nigdy czysto czarne |
| **Rim główny** | zza obiektu, z prawej-góry | `--cyan` `#21E6FF` | 60–80% | cienka jasna krawędź po prawej stronie, szerokość 2–4% szerokości obiektu |
| **Rim akcentowy** | zza obiektu, z lewej-dołu | `--magenta` `#FF2E88` | 30–50% | delikatny refleks na lewej-dolnej krawędzi; na złocie i lakierze |
| **Emisja** | z wnętrza (neon, klejnot, oczy, poświata skrzyni) | barwa materiału | wg obiektu | świeci, ale nie prześwietla; rdzeń biały tylko punktowo |

**Zasady wartości (jasności):**

* najciemniejszy cień na ciemnych materiałach: około `#0A0614` (fioletowa czerń, nie `#000000`);
* najciemniejszy cień na złocie: `#2B1A00`;
* czysta biel (`#FFFFFF`) tylko w rdzeniach odblasków i emisji, łącznie ≤ 2% powierzchni obiektu;
* AO (przyciemnienie w szczelinach) jest pożądane — dodaje „ciężaru” i jakości.

**Modyfikacje per gra** (w ramach schematu):

| Gra | Key | Rim główny | Rim akcentowy |
|---|---|---|---|
| S1 Cebulowy 777 | ciepły biały, nieco chłodniejszy (~4500 K) | `--cyan` | `--magenta`, mocniejszy (do 70%) — neon |
| S2 Złoty Faraon | blask pochodni, ~2400 K (≈ `#FFA45C`) | turkus `#2EC4B6` (cyjan „egipski”) | ciepły bursztyn zamiast magenty |
| S3 Kryształowa Kaskada | ciepły złoty snop (~3500 K) | `--cyan` / bioluminescencyjny teal `#19F5D2` | ametystowy fiolet `#A64DFF` |

**Dlaczego jeden kierunek światła:** symbole z różnych czatów stoją obok siebie na bębnach. Jeden oświetlony z lewej,
a drugi z prawej od razu wygląda jak wklejka. Kod też zakłada światło z lewej-góry: cienie rysuje w prawo-dół,
a błysk na złocie przesuwa od lewej-góry.

### 4.3. Kamera i perspektywa

| Typ obrazu | Kamera |
|---|---|
| Symbole, moneta, emblemat, maskotka, skrzynia | ogniskowa ~85 mm (mała dystorsja), obiekt frontalnie z obrotem 3/4 ≤ 15°, kamera 5–10° powyżej środka obiektu |
| Ramki bębnów | **ściśle frontalnie, bez perspektywy** (rzut prostokątny), żeby okno było prostokątem o poziomych i pionowych krawędziach |
| UI (przyciski, panele, ikony) | frontalnie, bez perspektywy |
| Logotypy i banery wygranych | frontalnie; dozwolony łagodny łuk napisu i głębia ekstruzji widoczna lekko od dołu |
| Tła | ogniskowa 24–35 mm, kamera na wysokości oczu, punkt zbiegu w poziomie na środku i w pionie na ~45% wysokości |

### 4.4. Materiały

| Materiał | Wygląd | Gdzie | Fraza do promptu (EN) |
|---|---|---|---|
| **Złoto polerowane** | lustrzane, wysoki kontrast; ciemne pasy odbić (`--gold-core`) obok jasnych świateł; ostre odblaski | litery, otoki, relief monety, krawędzie ramek, dzwonek S1, maska faraona | *mirror-polished warm yellow gold, crisp highlights, dark reflections* |
| **Złoto szczotkowane (satynowe)** | miękki, rozciągnięty połysk wzdłuż kierunku szczotkowania, niski kontrast | pole monety, duże płaszczyzny ramek, tło paneli | *satin brushed gold, soft anisotropic sheen* |
| **Szkło przydymione** | ciemne (`--bg-1`/`--bg-2`), głębokie; jaśniejsze krawędzie (Fresnel), jeden ukośny refleks, delikatna poświata od środka | środek przycisku SPIN, ikony, panele | *dark smoked glass, glossy, fresnel edges, subtle inner glow* |
| **Emalia (lakier)** | nasycony kolor pod grubą bezbarwną warstwą; jeden duży miękki odblask; czasem w złotych komórkach (cloisonné) | owoce S1, pole emblematu, awatary | *glossy enamel, candy-like clear coat, cloisonné gold borders* |
| **Chrom** | lustrzany, chłodny, odbija neony (róż i błękit) | ramka i tabliczka BAR w S1 | *polished chrome reflecting pink and blue neon* |
| **Szkło neonowe** | rurka z białym rdzeniem i kolorową poświatą tuż przy niej | napisy i obrysy S1 | *glowing neon glass tube, white-hot core, tight colored glow* |
| **Kamień** (piaskowiec, bazalt) | matowy, chropowaty w stylizowany sposób, ostre krawędzie rzeźbień, AO w zagłębieniach | S2: ramka, litery niskich symboli, tła | *carved sandstone, crisp chiseled edges, matte* |
| **Lapis lazuli** | głęboki błękit ze złotymi drobinkami pirytu, polerowany | S2: inkrustacje, nemes faraona, relikwia | *polished lapis lazuli with tiny gold pyrite flecks* |
| **Kryształ / klejnot** | fasetowany, z refrakcją; jasny rdzeń, dyspersja (tęczowe iskry) na krawędziach faset | S3 wszystko, klejnoty S2, banery MEGA/ULTRA | *faceted gemstone, internal refraction, rainbow dispersion, bright core* |
| **Złota łuska cebuli** | warstwowa, metalicznie złota, perłowy połysk, przeświecające krawędzie (SSS) | Pan Cebulion, symbole WILD, `s3_sym_cebula` | *layered golden onion skin, pearlescent metallic sheen, subsurface glow* |
| **Jedwab / satyna** | miękkie, długie odblaski wzdłuż fałd | cylinder, muszka | *silk with soft sheen* |

**Dlaczego polerowane i satynowe złoto razem:** obraz z samym polerowanym złotem jest męczący i „krzykliwy”.
Satynowe płaszczyzny dają oku odpoczynek i podkreślają polerowane detale. Tak wyglądają monety kolekcjonerskie
i biżuteria premium.

### 4.5. Poświata

| Gdzie | Zasada |
|---|---|
| Obrazy `ALFA` | poświata wbudowana tylko **delikatna i zwarta**: zasięg ≤ 4–6% rozmiaru obiektu, wygasa w całości przed marginesem 6%. Żadnej mgły rozlanej po kadrze. |
| Obrazy `CZARNE` | poświata zanika do czystego `#000000` przed krawędzią; zostaw ≥ 8% czarnego marginesu |
| Kod, poziom High | filtr bloom na warstwie efektów |
| Kod, poziom Medium | gotowe sprite'y poświaty (glow pre-baked) w trybie `add` |
| Kod, poziom Low | bez filtrów; poświata tylko tam, gdzie jest wbudowana w obraz |

**Dlaczego poświata głównie w kodzie:** półprzezroczysta mgła w PNG z alfą po przycięciu daje szare lub kolorowe
„brudne” obwódki i nie da się jej zgasić ani zanimować. Poświata jako osobny sprite może pulsować, zmieniać kolor
(tint) i znikać na słabszym sprzęcie.

### 4.6. Głębia

* **Kontrast planów:** pierwszy plan jaśniejszy i ostrzejszy, dalsze plany ciemniejsze, chłodniejsze i mniej nasycone
  (perspektywa powietrzna w stronę `--bg-1`).
* **Bokeh:** dalekie światła w tłach jako okrągłe, miękkie plamy (żyrandole, neony, świecące kryształy).
* **Głębia ostrości:** tylko w tłach (daleki plan rozmyty). **Symbole, UI, logotypy i postacie są ostre w całości** —
  nie wolno rozmywać ich fragmentów.
* **Warstwy w kodzie:** tło to jeden płaski PNG. Paralaksę w lobby (E02) udajemy w kodzie: powolny zoom tła
  (1,00 → 1,04 w 20 s) oraz warstwy cząsteczek (pył, bokeh) poruszające się z różną prędkością.

### 4.7. Cienie — dodaje kod, nie obraz

**Reguła:** obrazy `ALFA` NIE MAJĄ cienia rzucanego na podłoże, podłogi, odbicia lustrzanego pod obiektem ani
„plamy” pod spodem. Cień własny i AO na samym obiekcie są pożądane.

**Dlaczego:**

1. Symbol w ruchu (opadanie w S3, podskok przy wygranej, skalowanie) przesuwa się względem tła. Cień
   „przyklejony” do obrazu poruszałby się razem z nim i zdradzał płaskość.
2. Półprzezroczysty cień w PNG po wycięciu tła daje szarą, brudną otoczkę na kolorowym tle.
3. Kierunek i miękkość cienia muszą być wspólne dla wszystkich obrazów, a tylko kod gwarantuje identyczne parametry.

**Jak robimy cień w kodzie:**

| Gdzie | Technika | Parametry startowe (dla obiektu o rozmiarze S) |
|---|---|---|
| Symbole na bębnach | podczas obróbki generujemy z kanału alfa osobny sprite cienia (rozmyta, czarna sylwetka) i umieszczamy go w atlasie; w Pixi rysujemy go pod symbolem | przesunięcie x +3% S, y +5% S; rozmycie 4% S; krycie 0,45; kolor `#000000` |
| Postacie, skrzynia | elipsa z gradientem radialnym pod stopami/podstawą | szerokość 60% S, wysokość 8% S, krycie 0,35 |
| UI w HTML | `filter: drop-shadow(0 6px 10px rgba(0,0,0,.45))` dla obrazów; `box-shadow` dla paneli | — |
| Banery wygranych | sprite cienia jak przy symbolach, mocniejszy | przesunięcie y +4%, rozmycie 3%, krycie 0,6 |

**Dlaczego sprite cienia, a nie filtr cienia w Pixi:** filtr liczy się na GPU co klatkę dla każdego obiektu osobno.
Przy 30 symbolach S3 to 30 przebiegów filtra na klatkę. Gotowy sprite w atlasie trafia do tej samej paczki
rysowania (batch) co symbole, więc kosztuje prawie nic. Szczegóły: [08-wydajnosc-i-jakosc.md](08-wydajnosc-i-jakosc.md).

### 4.8. Obrazy efektów (tło CZARNE i konfetti)

Efekty świetlne są **neutralne kolorystycznie** (biel z lekko ciepłym odcieniem), bo kod nadaje im kolor przez
`tint`. W trybie `add` tint mnoży kolor sprite'a, więc biały sprite może stać się złoty, magentowy albo cyjanowy.
Jeden plik obsługuje wszystkie poziomy wygranej i wszystkie gry, co oszczędza megabajty.

| ID | Wygląd | Wymagania |
|---|---|---|
| `g_fx_promienie` | 18–24 promieni (god rays) o nierównej szerokości i długości, wychodzących z dokładnego środka | barwa `#FFF3D1` → czerń; promienie wygasają do czystej czerni przed 45% szerokości kadru od środka; miękki rdzeń ≤ 10% średnicy (bez wielkiego białego dysku); układ w miarę równomierny dookoła, bo kod obraca sprite (4–8°/s) |
| `g_fx_flara` | gwiazda błysku: 4 długie ramiona (poziome i pionowe), 4 krótsze ukośne, gorący rdzeń 3–4% kadru, cienki pierścień halo na ~25% promienia, delikatna pozioma smuga anamorficzna | neutralna biel; bez „duchów” soczewki w rogach |
| `g_fx_iskry` (SHEET 4×2) | 8 wariantów: gwiazdka 4-ramienna, gwiazdka 6-ramienna, miękka kula światła, cienki krzyż, romb-błysk, wydłużona smuga iskry, wiązka 5–7 mikroiskier, pierścień błysku | każdy element wyśrodkowany w komórce z ≥ 10% czarnego marginesu; biel z ciepłym rdzeniem |
| `g_fx_blyskawice` (SHEET 3×1) | 3 pioruny ułożone pionowo, każdy na ~85% wysokości komórki, 2–4 rozgałęzienia | biały rdzeń + chłodna niebieskawa poświata; jasność i kształt różne w każdej komórce |
| `g_fx_dym` | miękki, wolumetryczny obłok mgły o nieregularnym brzegu | szaro-biały, maksymalna jasność ~70% (czysta biel w `add` prześwietla ekran); brzegi rozmywają się do czerni |
| `g_fx_konfetti` (ALFA SHEET 4×3) | 12 elementów: 4 prostokąty folii pod różnymi kątami, 3 skręcone serpentyny, 2 gwiazdki, 1 krążek, 1 skręcona wstążka, 1 romb | metaliczna folia z ostrym odblaskiem; kolory: 5× złoto, 4× `--magenta`, 3× `--cyan`; tu tło przezroczyste, bo konfetti rysujemy normalnie (nie `add`) |

**Dlaczego efekty na czarnym, a nie przezroczystym tle:** w trybie `add` czarny (0, 0, 0) nic nie dodaje, więc
znika. Generator dużo lepiej rysuje miękkie światło na czerni niż na przezroczystości, gdzie gradient poświaty
często zamienia się w twardą krawędź.

### 4.9. Krawędzie, alfa i jakość pliku

* Krawędź obiektu `ALFA` gładka, wygładzona (antyaliasing), **bez białej, szarej ani kolorowej obwódki** (halo).
* Tło naprawdę przezroczyste. **Narysowana szachownica** (wzór „przezroczystości” namalowany jako piksele) oznacza
  odrzucenie albo ręczną naprawę — generatory czasem ją rysują.
* Gradienty w tłach płynne, bez pasm (banding). Przy kompresji do WebP używamy jakości ≥ 85 dla teł; w razie
  pasm dodajemy w obróbce 1–2% szumu (dithering).
* Najdrobniejszy detal symbolu ≥ 1/100 jego rozmiaru (w 1024 px: ≥ ~10 px). Mniejszy zniknie albo zamieni się
  w szum przy 64 px.

### 4.10. Rdzeń stylu (Style DNA) — kanoniczny akapit do promptów

Poniższy akapit jest wzorcem, który każdy prompt w [03-prompty-chatgpt.md](03-prompty-chatgpt.md) zawiera
(dosłownie lub w lekko skróconej formie). Język angielski, bo generator rozumie go precyzyjniej.

```text
STYLE DNA (Cebulion Casino): premium dark luxury casino, high-end stylized 3D render in the quality of
top mobile slot games. Warm yellow mirror-polished gold (not copper, not rose gold, not lemon), satin
brushed gold, dark smoked glass, deep navy-violet blacks (#07060F, #120B2A, #1E1442), small accents of
neon magenta (#FF2E88) and cyan (#21E6FF). Cinematic studio lighting: warm key light from the upper
left, soft lavender fill from the right, thin cool cyan rim light on the right edges, subtle magenta
rim on the lower left. Clean bevels, bold readable silhouette, rich but controlled detail, subtle
tight glow. Not photorealistic, not flat vector, not a cartoon for kids, no anime.
```

```text
ALWAYS: no text unless specified, no watermark, no signature, no cast shadow, no floor, no reflection
below the object, no painted checkerboard, nothing cropped by the image edge.
```

---

## 5. Symbole: zasady wspólne

Symbole to najważniejsze obrazy projektu: gracz patrzy na nie przez 90% czasu. Muszą być piękne, ale przede
wszystkim **natychmiast rozpoznawalne** w ruchu, w małym rozmiarze i przy różnych zaburzeniach widzenia barw.

### 5.1. Hierarchia: niskie, wysokie, specjalne

Gracz powinien „czuć” wartość symbolu, zanim zajrzy do tabeli wypłat. Hierarchię budujemy bogactwem detalu,
materiałem, kolorem i światłem:

| Cecha | Niskie | Wysokie | Specjalne (WILD, SCATTER, mnożnik) |
|---|---|---|---|
| Rola | najczęstsze, najniższe wypłaty | rzadsze, wyższe wypłaty | funkcje gry |
| Detal | 2 poziomy: bryła + główne podziały | 3 poziomy: + ornament, grawer, inkrustacja | 3 poziomy + napis + elementy świecące |
| Materiał | emalia, kamień albo pojedynczy klejnot bez oprawy | metal szlachetny, inkrustacje, oprawy | złoto + klejnot + światło |
| Kolor | jeden dominujący kolor, nasycenie średnie | 2–3 kolory, więcej złota | pełna paleta, najjaśniejsze punkty na planszy |
| Poświata na obrazie | brak lub minimalna | rim + wyraźniejsze odblaski | zwarta aura (≤ 6% rozmiaru) |
| Wypełnienie kadru 1024 px | ≈ 80% | ≈ 82–84% | ≈ 85% (zawsze z marginesem ≥ 6%) |
| Animacja wygranej (kod) | puls skali i obwódka pola | puls + przesuwający się błysk (shine) | własna animacja lądowania (E33, E34, E72) + sprite poświaty |

Najwyższy symbol każdej gry (`siodemka`, `faraon`, `cebula`) ma najwięcej złota i najmocniejszy kontrast.
Symbole specjalne są najjaśniejsze i jako jedyne „emitują” światło.

### 5.2. Czytelność: pięć testów

| Test | Jak | Kryterium |
|---|---|---|
| **T1 — 64 px** | zmniejsz do 64×64 px (S3: 56×56 px, bo tyle ma pole na telefonie) | osoba, która nie zna zestawu, nazywa symbol w < 1 s |
| **T2 — skala szarości** | zamień na odcienie szarości | w jednej grze żadne dwa symbole nie mają jednocześnie podobnej sylwetki i średniej jasności różniącej się o mniej niż 10% |
| **T3 — sylwetka** | wypełnij kanał alfa jednolitą czernią | każda sylwetka w grze jest unikalna (wyjątek: litery S2, które różnią się kształtem znaku) |
| **T4 — daltonizm** | symulacja deuteranopii, protanopii i tritanopii (Chrome DevTools) | symbole o podobnej sylwetce różnią się jasnością |
| **T5 — na tle gry** | połóż symbol na docelowym tle z podkładem bębna (§ 6.6) | symbol wyraźnie odcina się od tła dzięki rimowi i jaśniejszej krawędzi |

**Docelowe rozmiary pola symbolu** (na nie projektujemy poziom detalu):

| Gra | Desktop (px CSS) | Telefon pionowo (px CSS) |
|---|---|---|
| S1 (3×3) | 180–220 | 100–120 |
| S2 (5×3) | 150–190 | 64–76 |
| S3 (6×5) | 110–140 | 56–62 |

**Dlaczego:** w S3 na telefonie pole ma około 58 px. Detal mniejszy niż ~1/100 rozmiaru zamienia się tam w szum,
a dwa klejnoty o tej samej sylwetce i podobnej jasności zlewają się w kaskadzie.

### 5.3. Kadrowanie

* Płótno 1024×1024, obiekt wyśrodkowany optycznie (środek ciężkości bryły, nie prostokąta otaczającego).
* Margines ≥ 6% (≥ 62 px) z każdej strony; poświata i odblaski też muszą się w nim zmieścić.
* Obiekty szerokie (`bar`, `arbuz`, `skarabeusz`) wypełniają szerokość, wysokie (`siodemka`, `ankh`, `anubis`)
  wysokość.
* Symbol stoi prosto; obrót ≤ ±10° (wyjątek: kursywa siódemki i ukośny szlif topazu).
* **Normalizacja przy obróbce:** po przycięciu alfy skalujemy symbole tak, żeby w obrębie jednej gry i jednego
  poziomu hierarchii pokrycie alfą (piksele z alfą > 50%) różniło się najwyżej o ±12%. Dzięki temu wąska siódemka
  nie wygląda na „chudszą” od szerokiej tabliczki BAR. Skrypt: [02-lista-obrazow.md](02-lista-obrazow.md).

### 5.4. Perspektywa

Wszystkie symbole jednej gry mają ten sam kąt kamery: frontalnie, obrót 3/4 ≤ 15°, kamera 5–10° nad środkiem.
Widać lekko górną płaszczyznę bryły i grubość obiektu. Nie wolno mieszać symboli „z góry” z symbolami „z boku”.

### 5.5. Spójność zestawu

* To samo światło (§ 4.2 z modyfikacją danej gry), ta sama rampa złota (§ 3.4), ten sam poziom połysku.
* **Bez czarnego konturu jak w kreskówce.** Obiekt odcina się od tła rimem i ciemniejszą krawędzią (AO), nie obrysem.
* Ta sama „gęstość” detalu w obrębie poziomu hierarchii.
* Symbole jednej gry generujemy w jednym czacie. Najpierw powstaje symbol specjalny albo najwyższy (kotwica gry),
  a kolejne dostają dopisek „in exactly the same style, lighting and camera as the previous symbol”.
  Kolejność i dokładne brzmienie: [03-prompty-chatgpt.md](03-prompty-chatgpt.md).

### 5.6. Tekst na symbolach

| Gra | Symbol | Dokładny tekst | Styl liter |
|---|---|---|---|
| S1 | `s1_sym_bar` | `BAR` | grube, retro, w duchu kroju Bungee |
| S1 | `s1_sym_siodemka` | `7` | gruba kursywna cyfra |
| S1 | `s1_sym_wild` | `WILD` | jak wyżej, neon |
| S2 | `s2_sym_10`, `s2_sym_j`, `s2_sym_q`, `s2_sym_k`, `s2_sym_a` | `10`, `J`, `Q`, `K`, `A` | klasyczne kapitały szeryfowe z klinowymi szeryfami |
| S2 | `s2_sym_wild` | `WILD` | ozdobne kapitały w duchu Cinzel Decorative |
| S2 | `s2_sym_scatter` | `SCATTER` | jak wyżej |
| S3 | `s3_sym_scatter` | `SCATTER` | kapitały w duchu Marcellus, kryształowe |

Zasady: tylko wersaliki, jedno słowo, poprawna pisownia (sprawdzamy literę po literze). Wysokość liter na tabliczce
≥ 18% wysokości symbolu, inaczej napis nie przejdzie testu 64 px. Żaden symbol nie ma polskich znaków, więc nie
ryzykujemy błędów generatora w diakrytykach.

### 5.7. Stany symbolu, które robi kod

Obraz jest jeden, ale symbol w grze ma kilka stanów. Projekt obrazu musi je „udźwignąć”:

| Stan | Co robi kod | Wymaganie wobec obrazu |
|---|---|---|
| spoczynek | symbol + sprite cienia | — |
| obrót bębna | wariant z pionowym rozmyciem ruchu (generowany przy obróbce, 24–40 px przy @2x) | wyraźne duże formy, które czytają się nawet rozmyte |
| lądowanie | ściśnięcie 0,92 / rozciągnięcie 1,06, 80–120 ms | brak elementów wystających poza margines |
| wygrana | puls skali 1,00 → 1,12 → 1,00, błysk shine, poświata | jasna górna-lewa część, po której „przejedzie” błysk |
| przyciemnienie (symbole niewygrywające) | jasność 45%, desaturacja 40% | symbol nadal rozpoznawalny po przyciemnieniu (nie projektujemy symboli zbyt ciemnych) |
| antycypacja (E27) | drżenie i poświata scatterów | — |
| pęknięcie S3 (E70) | odłamki `s3_fx_odlamki` z tintem w kolorze symbolu | wyraźny dominujący kolor symbolu (z niego bierzemy tint) |

---

## 6. Tła

### 6.1. Zasady ogólne

Tło to **scenografia, nie aktor**. Ma budować nastrój i nigdy nie konkurować z symbolami.

* **Jasne brzegi, spokojny środek.** Źródła światła, neony i najbogatszy detal leżą na bokach i w górnych rogach.
  Środek, gdzie stoją bębny, jest najciemniejszy i najspokojniejszy.
* **Jasność (cel mierzalny skryptem):** średnia jasność L\* (CIELAB) całego tła 12–22, strefy bębnów 6–14.
  Symbole mają średnią jasność 45–75, więc zawsze są jaśniejsze od tła.
* **Nasycenie** tła niższe niż symboli. Najbardziej nasycone piksele ekranu należą do symboli i efektów.
* Na tłach nie ma tekstu, UI, ludzi, postaci ani prawdziwych logo.
* **Tła gier nie zawierają automatu, bębnów ani ramki.** Ramka to osobny obraz, nakładany przez kod.

### 6.2. Kompozycja desktop 3:2 (1536×1024)

```text
 x:  0%      18%                                   82%     100%
 y:  +--------+-------------------------------------+--------+
 0%  | narożnik|   PAS GÓRNY: logo gry, ciemny,      |narożnik|
     | światło |   spokojny łuk architektury         |światło |
 12% +--------+-------------------------------------+--------+
     |        |                                     |        |
     | BOKI:  |      STREFA BĘBNÓW                  | BOKI:  |
     | scena, |      najciemniejsza (−1…−1,5 EV),   | scena, |
     | detal, |      mało detalu, brak jasnych      | detal, |
     | źródła |      punktów; punkt zbiegu ~45%     | źródła |
     | światła|                                     | światła|
 80% +--------+-------------------------------------+--------+
     |   PANEL STEROWANIA: gradient do --bg-0, bez detalu      |
100% +---------------------------------------------------------+
```

| Strefa | Zakres | Zawartość |
|---|---|---|
| Pas górny | y 0–12% | ciemny, spokojny; tu kod kładzie logo gry (`s1_logo` itd.) |
| Strefa bębnów | x 18–82%, y 12–80% | najciemniejsza, minimum detalu; za nią podkład bębna rysowany w kodzie (§ 6.6) |
| Boki | x 0–18% i 82–100% | scenografia, źródła światła, najwięcej detalu |
| Panel sterowania | y 80–100% | gradient do `--bg-0`, bez detalu |
| Winieta | rogi | przyciemnienie ~20% na obrazie; kod może ją pogłębić gradientem radialnym |

### 6.3. Kompozycja mobile 2:3 (1024×1536)

| Strefa | Zakres | Zawartość |
|---|---|---|
| Pasek górny | y 0–10% | ciemny (saldo, menu w HTML) |
| Scenografia i logo gry | y 10–20% | główny „widok” sceny, źródło światła, łuk; tu stoi logo gry |
| Strefa bębnów | x 4–96%, y 20–66% | najciemniejsza, minimum detalu |
| Panel sterowania | y 66–100% | ciemny gradient do `--bg-0` (przycisk SPIN, zakład, ikony) |
| Boki | wąskie | elementy dekoracyjne, które mogą zostać przycięte (§ 6.4) |

### 6.4. Kadrowanie na różnych ekranach

Tło wypełnia ekran jak `object-fit: cover`: skalujemy je, aż przykryje cały ekran, a nadmiar przycinamy.
Wersję (3:2 albo 2:3) wybiera kod według proporcji okna (szczegóły: [06-interfejs-ux.md](06-interfejs-ux.md)).
Ile obrazu tracimy:

| Obraz | Ekran | Przycięcie |
|---|---|---|
| 3:2 desktop | 16:10 (1,60) | 6,3% wysokości łącznie (~3% góra i dół) |
| 3:2 desktop | 16:9 (1,78) | 15,6% wysokości (~7,8% góra i dół) |
| 3:2 desktop | 4:3 (1,33) | 11,1% szerokości (~5,6% z każdego boku) |
| 3:2 desktop | 21:9 (~2,37) | 36,7% wysokości — **za dużo**; kod ogranicza przycięcie pionowe do 12%, a boki dopełnia gradientem do `--bg-0` |
| 2:3 mobile | 9:19,5 (0,46, typowy telefon) | 30,8% szerokości (~15,4% z każdego boku) |
| 2:3 mobile | 9:16 (0,56) | 15,6% szerokości (~7,8% z każdego boku) |
| 2:3 mobile | 3:4 (0,75, tablet pionowo) | 11,1% wysokości (~5,6% góra i dół) |

**Strefy bezpieczne** (wszystko ważne MUSI się w nich mieścić):
desktop 3:2: **x 6–94%, y 9–91%**; mobile 2:3: **x 16–84%, y 6–94%**.

**4K:** obraz 1536 px rozciągnięty na 3840 px (×2,5) jest miękki. Akceptujemy to świadomie: tło jest ciemne,
częściowo rozmyte (głębia ostrości), przykryte bębnami i ramką, a ostrość dają cząsteczki rysowane przez kod
w natywnej rozdzielczości. Plan B: powiększenie ×2 narzędziem do upscalingu AI offline. Nie zakładamy, że jest
dostępne — to opcja, którą sprawdzimy przed użyciem.

### 6.5. Tła lobby `g_tlo_lobby_desktop`, `g_tlo_lobby_mobile`

Luksusowe wnętrze kasyna nocą, oglądane z wysokości oczu, obiektyw szeroki (24 mm), mocna głębia ostrości:

* sklepienie z kryształowymi żyrandolami → ciepły złoty bokeh w górnej części kadru;
* rzędy rozmytych automatów po bokach → bokeh w magencie i cyjanie;
* kolumny z czarnego marmuru ze złotymi żyłkami, złote łuki, fioletowy aksamitny dywan z subtelnym wzorem;
* **środek kadru** to ciemny, głęboki korytarz w stronę punktu zbiegu — tu stoją kafle gier (HTML);
* bez ludzi (generatory psują twarze i dłonie w tłumie), bez czytelnych napisów i szyldów, bez prawdziwych logo.

Wersja mobile: żyrandol u góry (y 0–20%), korytarz w środku, kolumny przy bokach (mogą zostać przycięte).
Kod dokłada: powolny zoom, pył w świetle, unoszący się bokeh (E02).

### 6.6. Tła gier i podkład bębna

Tło gry pokazuje **otoczenie** automatu (ulicę Vegas, skarbiec, jaskinię), a ramka (`s1_ramka` itd.) jest
„meblem” postawionym na pierwszym planie. Między nimi kod rysuje **podkład bębna** — ciemną płaszczyznę w oknie ramki,
na której leżą symbole:

| Gra | Podkład bębna (kod) |
|---|---|
| S1 | `#0B0624`, krycie 0,88, pionowy gradient z lekkim rozjaśnieniem w środkowym rzędzie |
| S2 | `#0E1530`, krycie 0,88, delikatna tekstura kamienia w 6% krycia |
| S3 | `#070A1F`, krycie 0,82, subtelne kaustyki (falujące refleksy) animowane w kodzie |

**Dlaczego podkład:** symbole muszą być czytelne niezależnie od tego, co jest w tle. Podkład gwarantuje stały
kontrast, a tło może być bogatsze.

### 6.7. Tła darmowych spinów (S2, S3)

`s2_tlo_fs_*` i `s3_tlo_fs_*` MUSZĄ mieć **te same strefy, tę samą linię horyzontu i ten sam punkt zbiegu** co
tła bazowe. Zmienia się nastrój (noc, zorza, więcej nasycenia), a nie układ. Kod podmienia tło przenikaniem
600–900 ms z błyskiem (E35). Gdyby układ się różnił, ramka i bębny wyglądałyby na „przeskoczone”.

### 6.8. Okładki i banery — wspólne zasady

| Obraz | Kompozycja | Zastosowanie |
|---|---|---|
| `s1_okladka`, `s2_okladka`, `s3_okladka` (2:3, z logo) | logo gry w y 8–30%; bohater (symbol specjalny lub najwyższy) w y 30–85%; dolne 15% przechodzi w ciemny gradient pod etykiety HTML; ważne elementy ≥ 5% od krawędzi | kafel gry w lobby: plakat wideo przed startem odtwarzania i wersja zastępcza przy `prefers-reduced-motion` / słabym łączu |
| `s1_baner`, `s2_baner`, `s3_baner` (3:2, bez tekstu) | główny motyw w prawych ~60% kadru; lewe ~40% ciemne i spokojne pod tytuł i przycisk w HTML | szeroki baner / plakat wideo (karuzela, sekcja powitalna) |

**Dlaczego wszystkie trzy banery mają ten sam układ:** w karuzeli lobby tytuł i przycisk stoją zawsze w tym samym
miejscu. Gdyby jeden baner miał bohatera po lewej, przykryłby go tekst.

**Dlaczego ważne elementy ≥ 5% od krawędzi okładki:** przy najechaniu (E03) kafel przechyla się w 3D o kilka stopni
i lekko powiększa (rogi „uciekają”), a CSS zaokrągla mu narożniki.

