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
kolejnego czatu (ChatGPT przyjmuje obrazy w wiadomości). Każdą kotwicę dołączamy od chwili, gdy istnieje:
`m05_s1_desktop` od czatu 1, `g_moneta_przod` od czatu 2, `g_ui_spin` od czatu 3.

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
| 0,88 | 7,14 | 7,44 | 12,06 | poziom `--glass-strong` (nad wideo i efektami); token bazuje na ciemniejszym `--bg-1`, więc jego kontrast jest jeszcze wyższy |

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

Najwyższy symbol każdej gry (`siodemka`, `faraon`, `cebula`) ma najbogatszy detal i najmocniejszy kontrast
wśród symboli zwykłych. Symbole specjalne są najjaśniejsze na planszy i mają najmocniejszą emisję (zwartą aurę);
emisja symboli zwykłych (neon w S1, wewnętrzny blask klejnotów w S3) jest zawsze słabsza.

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
x:   0%         18%                                     82%       100%
y:   +----------+---------------------------------------+----------+
0%   | narożnik |  PAS GÓRNY: logo gry, ciemny,         | narożnik |
     | światło  |  spokojny łuk architektury            | światło  |
12%  +----------+---------------------------------------+----------+
     |          |                                       |          |
     | BOKI:    |  STREFA BĘBNÓW                        | BOKI:    |
     | scena,   |  najciemniejsza (-1 do -1,5 EV),      | scena,   |
     | detal,   |  mało detalu, brak jasnych punktów,   | detal,   |
     | źródła   |  punkt zbiegu na ~45% wysokości       | źródła   |
     | światła  |                                       | światła  |
80%  +----------+---------------------------------------+----------+
     |  PANEL STEROWANIA: gradient do --bg-0, bez detalu           |
100% +-------------------------------------------------------------+
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

---

## 7. Interfejs (UI)

### 7.1. Zasada: materiał z obrazu, tekst z HTML, stan z kodu

Interfejs ma wyglądać jak wykonany ze **złota i przydymionego szkła**, czyli z tych samych materiałów co logotyp
i symbole. Obrazy UI dostarczają wyłącznie materiał (ramy, faktury, połysk). Tekst zawsze jest w HTML: ostry
w każdej skali, przetłumaczalny, czytany przez czytniki ekranu. Stany (najechanie, wciśnięcie, fokus) rysuje kod,
więc nie potrzebujemy osobnych obrazów dla każdego stanu.

**Dlaczego:** jeden przycisk w 5 stanach × 2 gęstości pikseli to 10 plików, a i tak nie byłyby idealnie
dopasowane. Filtry CSS (`brightness`, `drop-shadow`) i transformacje dają spójne stany z jednego obrazu.

### 7.2. Stany interaktywne (kod)

Wartości startowe. Ostateczne czasy i krzywe ustala [06-interfejs-ux.md](06-interfejs-ux.md) (zdarzenie E11).

| Stan | Efekt | Czas |
|---|---|---|
| spoczynek | obraz + cień (`drop-shadow(0 6px 10px rgba(0,0,0,.45))`) | — |
| hover (mysz) | `brightness(1.08)`, przesunięcie w górę o 1 px, złota poświata `0 0 18px rgba(245,197,66,.45)`, jednorazowy błysk przesuwający się ukośnie po przycisku | 120 ms wejście, błysk 450 ms |
| pressed | `scale(0.97)`, `brightness(0.92)`, cień skrócony do `0 2px 4px` | 60 ms |
| focus-visible (klawiatura) | obrys `2px solid var(--focus)` (cyjan) z odsunięciem 3 px | natychmiast |
| disabled | `grayscale(0.6)`, krycie 0,45, kursor `not-allowed` | 150 ms |
| aktywny przełącznik (turbo, auto, dźwięk) | cyjanowy pierścień `0 0 0 2px var(--cyan), 0 0 14px rgba(33,230,255,.6)` + mała kropka-wskaźnik | 160 ms |
| `prefers-reduced-motion` | bez przesunięć i błysku; zostają tylko zmiany jasności i obrysu | — |

Fokus jest cyjanowy, a nie złoty, bo złota poświata oznacza hover. Cyjan na `--bg-0` ma kontrast 13,27:1.

### 7.3. Przycisk SPIN `g_ui_spin` i `g_ui_spin_stop`

Najważniejszy przycisk gry: musi wyglądać „drogo” i zachęcać do dotknięcia.

| Część | Projekt |
|---|---|
| Kształt | idealne koło, ~84% kadru 1:1 |
| Pierścień zewnętrzny | polerowane złoto, grubość ~12% promienia; na obwodzie 24 drobne nacięcia (radełkowanie) jak na pokrętle zegarka |
| Pierścień wewnętrzny | cienka linia satynowego złota oddzielająca szkło |
| Środek | kopuła z ciemnego przydymionego szkła (`--bg-2` → `--bg-1`), ukośny refleks w lewej-górnej ćwiartce, delikatna cyjanowa poświata od dołu wewnątrz kopuły |
| Ikona `g_ui_spin` | dwie okrężne strzałki (zgodnie z ruchem wskazówek zegara) w świecącym złocie `--gold-1`, ~45% średnicy kopuły |
| Ikona `g_ui_spin_stop` | zaokrąglony kwadrat w tym samym złocie, ~32% średnicy kopuły |

Oba obrazy MUSZĄ być identyczne poza ikoną (ten sam pierścień, refleks, kadr), bo kod przenika je w 120 ms przy
starcie i zatrzymaniu spinu. Generujemy `g_ui_spin_stop` w tym samym czacie z poleceniem „exactly the same button,
only the icon changes”.

**Rozmiar na ekranie:** desktop 120–140 px, telefon 88–104 px.
**Czego kod nie robi:** nie obraca całego przycisku, bo razem z nim obróciłby się refleks i światło (sztuczne).
Przy starcie spinu (E24): wciśnięcie `scale(0.94)`, błysk pierścienia sprite'em w trybie `add`, przenikanie do
`g_ui_spin_stop`. W spoczynku (E22): powolny puls poświaty za przyciskiem co 2,4 s.

### 7.4. Przyciski 9-slice `g_ui_przycisk_glowny` i `g_ui_przycisk_drugi`

Pigułka (prostokąt z półokrągłymi końcami) na płótnie 3:2 (1536×1024): szerokość ~85% kadru (~1300 px),
wysokość ~33% (~340 px), wyśrodkowana. Bez tekstu i bez ikon.

| Cecha | `g_ui_przycisk_glowny` (główny) | `g_ui_przycisk_drugi` (drugorzędny) |
|---|---|---|
| Materiał | złoto: polerowana obwódka (~6% wysokości) + satynowa powierzchnia | ciemne przydymione szkło (`--bg-2` → `--bg-1`) + cienka polerowana złota obwódka (~4% wysokości) |
| Światło | pionowy gradient `--gold-1` (góra) → `--gold-2` → `--gold-3` (dół); cienki poziomy pasek połysku przy górnej krawędzi | jaśniejsza górna krawędź (Fresnel), delikatna poświata od środka |
| Tekst (HTML) | `--ink-on-gold` (`#07060F`), Manrope 800, wersaliki, kontrast 12,43:1 | `--gold-1` lub `--text-1`, Manrope 700 |
| Użycie | jedna główna akcja na ekranie: „Wejdź do kasyna”, „Odbierz”, „Graj” | akcje poboczne: „Anuluj”, „Tabela wypłat”, „Wróć” |

**Warunek 9-slice:** środkowa część pigułki MUSI być **jednolita w poziomie**. Pionowy gradient i poziomy pasek
połysku są dozwolone, bo przy rozciąganiu w poziomie się nie zmieniają. Ornament, iskra albo refleks w środku
rozciągnąłby się w smugę. Cięcie (przykład, ostateczne wartości ustala obróbka): lewa i prawa część = połowa
wysokości pigułki; przycisk skaluje się w pionie jako całość.

**Rozmiary:** przycisk główny 56 px wysokości (desktop) / 52 px (telefon); standardowy 48 px; minimalny obszar
dotyku 48×48 px na telefonie (powyżej minimum 24 px z WCAG 2.5.8).

### 7.5. Ikony `g_ui_ikony` (SHEET 4×3)

Każda ikona to **kompletny okrągły przycisk**: dysk z przydymionego szkła, cienki polerowany złoty otok i złoty,
lekko wypukły glif (~50% średnicy dysku). Dzięki temu ikony wyglądają jak rodzina z przyciskiem SPIN.

| Wiersz \ kolumna | 1 | 2 | 3 | 4 |
|---|---|---|---|---|
| 1 | autoplay: okrężna strzałka z trójkątem „play” w środku | turbo: błyskawica | minus | plus |
| 2 | dźwięk wł.: głośnik z dwiema falami | dźwięk wył.: głośnik z małym „×” | info: szeryfowe „i” | menu: trzy poziome kreski |
| 3 | lobby / dom: domek | zamknij: „×” | ustawienia: koło zębate | historia: zegar z okrężną strzałką w lewo |

* Wszystkie dyski identyczne (ten sam rozmiar, otok, refleks), bo przełącznik dźwięku podmienia ikonę w miejscu.
* Glif czytelny w 24 px: grube kreski, bez cienkich detali, bez tekstu (wyjątek: litera „i”).
* Rozmiar na ekranie: 40–48 px (desktop), 44–52 px (telefon) — obszar dotyku zawsze ≥ 48 px.
* Stan aktywny (turbo/auto/dźwięk) rysuje kod cyjanowym pierścieniem (§ 7.2), nie osobnym obrazem.

### 7.6. Panel modala `g_ui_panel` (1:1, 9-slice)

* **Rogi:** ozdobne złote narożniki filigranowe, mieszczące się w ~20% boku kadru każdy (wycinek rogu).
* **Krawędzie:** prosta, równa złota listwa (polerowana z cienkim satynowym pasem) — identyczna na całej długości,
  bo będzie rozciągana.
* **Środek:** jednolite ciemne szkło, bez ornamentów i refleksów.
* W CSS używamy samej ramy (`border-image` bez słowa `fill`), a środek wypełniamy `--glass` z
  `backdrop-filter: blur(14px)`. **Dlaczego:** krycie i rozmycie środka regulujemy w kodzie (np. `--glass-strong`
  nad wideo), a kontrast tekstu pozostaje zgodny z § 3.6.
* Szerokość modali: 360–560 px; narożnik renderowany jako 48–64 px.

### 7.7. Ornament `g_ui_ornament`

Poziomy, symetryczny złoty filigran: w środku miniaturowa cebula w koronie (sylwetka z emblematu) albo romb, od
niego w obie strony zwężające się spirale i liście akantu, zakończone kropkami. Proporcja ~6:1, wyśrodkowany na
płótnie 3:2. Użycie: pod nagłówkami modali, sekcji lobby i w podsumowaniu darmowych spinów; szerokość 240–480 px.

### 7.8. Banery wygranych `g_win_*`

Wspólne zasady:

* Napis w **dwóch wierszach**, wyśrodkowany: górne słowo nad dolnym (`BIG` / `WIN`, `FREE` / `SPINS`), litery
  obu wierszy tej samej wysokości. **Dlaczego dwa wiersze:** na telefonie pionowo baner ma do dyspozycji szerokość
  ~360 px, a dwa krótkie wiersze dają większe litery niż jeden długi.
* Blok napisu ≤ 84% szerokości i ≤ 80% wysokości kadru 3:2; reszta to margines na poświatę i dekoracje.
* Litery: grube, masywne wersaliki o klasycznych szeryfach (bliskie Cinzel 900, ale cięższe), ekstrudowane na
  głębokość 8–10% wysokości litery, fazowane, z ciemnofioletowym konturem `#1A0B33` (3–4% wysokości litery), który
  oddziela je od jasnych wybuchów za napisem.
* Lekki łuk „uśmiechu”: środek wiersza 4–6% wyżej niż końce.
* Bez tła i bez promieni (promienie to `g_fx_promienie` pod spodem, obracane przez kod).

| ID | Dokładny tekst | Wygląd (eskalacja) |
|---|---|---|
| `g_win_big` | `BIG WIN` | czyste, masywne polerowane złoto; kilka drobnych odblasków-gwiazdek na krawędziach |
| `g_win_mega` | `MEGA WIN` | złoto wysadzane rzędami magentowych rubinów i cyjanowych szafirów wzdłuż liter; złota laurowa wstęga pod napisem |
| `g_win_epic` | `EPIC WIN` | złoto z ciemnofioletowymi wstawkami metalu, liżą je od dołu fioletowe płomienie (`--violet-epic`, rdzeń magenta); płomienie mieszczą się w marginesie |
| `g_win_ultra` | `ULTRA WIN` | litery z tęczowego, fasetowanego kryształu w złotych obramowaniach; nad napisem mała złota korona z klejnotami; wokół kilka odłamków kryształu; dyspersja na krawędziach |
| `g_win_free_spins` | `FREE SPINS` | złoto z cyjanowo-turkusową poświatą od środka liter i małymi gwiazdkami; spokojniejszy od MEGA, bo pojawia się częściej |

Kod dokłada: wejście z „uderzeniem” (skala 0 → 1,15 → 1,00), błysk przesuwający się po literach, obracające się
promienie w kolorze poziomu (§ 3.5), cząsteczki, drżenie ekranu (bez drżenia przy `prefers-reduced-motion`).
Przy eskalacji (E31) baner poprzedniego poziomu znika w błysku, a nowy wchodzi z mocniejszym uderzeniem.

### 7.9. Złote cyfry `g_font_cyfry` (SHEET 5×3)

| Wiersz | Komórki |
|---|---|
| 1 | `0` `1` `2` `3` `4` |
| 2 | `5` `6` `7` `8` `9` |
| 3 | `,` `+` `×` (puste) (puste) |

* Styl identyczny z literami `g_win_big` (to samo złoto, faza, ciemnofioletowy kontur), bo kwota stoi pod banerem.
* Wszystkie cyfry tej samej wysokości i na tej samej linii bazowej w swoich komórkach; `,` przy linii bazowej.
* Przy obróbce każdą cyfrę umieszczamy w komórce o stałej szerokości (szerokość najszerszej cyfry), czyli
  **cyfry tabelaryczne**. **Dlaczego:** podczas liczenia wygranej (E30, E31) zmieniają się ostatnie cyfry. Przy
  różnych szerokościach cała liczba „pływałaby” w poziomie co klatkę.
* Odstęp tysięcy (spację) wstawia kod (0,25 szerokości cyfry), bo spacji nie ma w arkuszu.
* Cyfry bitmapowe dla kwot o wysokości ≥ 32 px; mniejsze kwoty: Manrope 800 `tabular-nums`.

### 7.10. Awatary `g_awatary` (ALFA SHEET 4×2)

Osiem okrągłych medalionów: polerowany złoty otok, tło z emalii w innym kolorze dla każdej postaci, w środku
popiersie postaci (głowa i ramiona). Postacie to **„warzywna arystokracja”** z kręgu Pana Cebuliona — w tym samym
renderze, eleganckie, z humorem, nie dziecinne. Żadna postać nie nosi cylindra ani monokla (zarezerwowane dla
maskotki).

| Komórka | Postać | Wygląd | Tło emalii |
|---|---|---|---|
| 1 | Pani Cebulina | czerwona cebula (fioletowo-różowa łuska), perłowe kolczyki, mały fascynator z piórkiem | turkus `#1BB5C9` |
| 2 | Hrabia Czosnek | kość słoniowa, wysoki postawiony kołnierz peleryny, cienki wąsik | głęboki fiolet `#3B1E8C` |
| 3 | Baron Ziemniak | złotobrązowy, melonik, jedwabna poszetka w kieszonce marynarki | szafir `#1F4FD1` |
| 4 | Lady Papryka | czerwona papryka, okulary „kocie oko”, złote kolczyki | szmaragd `#12A86B` |
| 5 | Kapitan Por | zielono-biały, biała czapka kapitańska ze złotą kotwicą | ciemna magenta `#B3135C` |
| 6 | Diuk Bakłażan | fioletowy, aksamitny beret z piórem | złoto `#F5C542` |
| 7 | Madame Rzodkiewka | magentowo-biała, boa z piór | ciemny teal `#0E6E73` |
| 8 | Pan Pieczarka | kremowy kapelusz grzyba, okulary przeciwsłoneczne, muszka w kropki | rubin `#A3122E` |

Rozmiar na ekranie: 32–64 px, więc każda postać różni się sylwetką głowy i kolorem tła (test T1 z § 5.2 przy 32 px).

---

## 8. Typografia

### 8.1. Fonty

Wszystkie fonty mają licencję SIL Open Font License (OFL) i są **hostowane lokalnie** (pliki `woff2` z pakietów npm
`@fontsource/*` skopiowane do `static/`, bez Google Fonts CDN — zgodnie z zasadą „bez CDN”).

| Font | Pakiet | Wagi | Rola | Uwagi |
|---|---|---|---|---|
| **Cinzel** | `@fontsource/cinzel` | 700, 900 | nagłówki, napis marki w nagłówku | krój **tylko z wersalikami**: małe litery są rysowane jako kapitaliki. Nie nadaje się do dłuższego tekstu. |
| **Manrope** | `@fontsource/manrope` | 400–800 | cały interfejs, teksty, przyciski | liczby z `font-variant-numeric: tabular-nums` |
| **Bungee** | `@fontsource/bungee` | 400 | S1: etykiety w grze, tabela wypłat | krój wyłącznie wersalikowy, retro-szyldowy |
| **Cinzel Decorative** | `@fontsource/cinzel-decorative` | 700, 900 | S2: nagłówki tabeli wypłat, licznik darmowych spinów | ozdobne kapitały; tylko krótkie napisy |
| **Marcellus** | `@fontsource/marcellus` | 400 | S3: etykiety w grze, liczby na kulach mnożnika | szeryf z rozszerzonymi końcami kresek, elegancki |

**Polskie znaki:** ładujemy podzbiory `latin` i `latin-ext`. Przy instalacji sprawdzamy w każdym foncie glify
Ą Ć Ę Ł Ń Ó Ś Ź Ż (i małe). Nie zakładamy z góry, że wszystkie fonty dekoracyjne je mają. Plan B, jeśli któregoś
brakuje: Cinzel Decorative → Cinzel, Marcellus → Cinzel, Bungee → Manrope 800 wersalikami.

### 8.2. Skala typograficzna

| Rola | Font i waga | Desktop | Telefon | Interlinia | Odstęp liter | Przykład |
|---|---|---|---|---|---|---|
| Display | Cinzel 900 | 56 px | 34 px | 1,10 | 0,04 em | sekcja powitalna lobby |
| H1 | Cinzel 700 | 40 px | 28 px | 1,15 | 0,03 em | „Wybierz grę” |
| H2 | Cinzel 700 | 28 px | 22 px | 1,20 | 0,03 em | tytuł modala „Witaj w Cebulion Casino” |
| H3 | Cinzel 700 | 22 px | 18 px | 1,25 | 0,02 em | nazwa gry na kaflu |
| Etykieta | Manrope 700, wersaliki | 12 px | 11 px | 1,30 | 0,14 em | „SALDO”, „ZAKŁAD”, „WYGRANA” |
| Tekst | Manrope 500 | 16 px | 16 px | 1,50 | 0 | opisy, zasady gry |
| Tekst mały | Manrope 500 | 14 px | 13 px | 1,45 | 0,01 em | podpisy, stopka |
| Mikro (minimum) | Manrope 600 | 12 px | 12 px | 1,40 | 0,02 em | dopisek „Symulator. Wirtualna waluta bez wartości.” |
| Przycisk | Manrope 800, wersaliki | 16 px | 16 px | 1,00 | 0,06 em | „WEJDŹ DO KASYNA” |
| Pole tekstowe | Manrope 600 | 18 px | 16 px | 1,20 | 0 | pole „Nazwa gracza” |
| Saldo w pasku | Manrope 800, tabular | 22 px | 18 px | 1,00 | 0,01 em | „10 000” |
| Zakład / wygrana w panelu | Manrope 800, tabular | 24 px | 18 px | 1,00 | 0 | „200” |
| Kwota big win | `g_font_cyfry` | cyfry 120 px | cyfry 72 px | — | 0,04 szer. cyfry | „12 400” |
| Licznik darmowych spinów, mnożnik | font gry | 28 px | 22 px | 1,00 | 0,02 em | „7 / 10”, „×25” |

* Rozmiary płynne przez `clamp()`, np. `--fs-display: clamp(34px, 1.9vw + 26px, 56px)`,
  `--fs-h1: clamp(28px, 1vw + 24px, 40px)`.
* Pole tekstowe na telefonie ma co najmniej 16 px — przy mniejszym foncie Safari na iOS automatycznie powiększa
  stronę po dotknięciu pola, co psuje układ modala logowania.
* Najmniejszy tekst w projekcie: 12 px.
* Na ekranach ≥ 2560 px szerokości całe UI skalujemy proporcjonalnie (szczegóły w
  [06-interfejs-ux.md](06-interfejs-ux.md)), żeby na 4K nie było „mrówczych” napisów.

### 8.3. Kolory tekstu

| Element | Kolor |
|---|---|
| Nagłówki H1–H2 | `--gold-grad` przez `background-clip: text` (najciemniejszy stop `--gold-3` ma ≥ 5,23:1 na każdym tle `--bg-*`) |
| H3, etykiety | `--gold-2` (H3) / `--text-2` (etykiety) |
| Tekst | `--text-1` (główny), `--text-2` (pomocniczy) |
| Kwoty | `--gold-1`; dodatnia zmiana salda `--win-green` ze znakiem „+” |
| Błędy | `--danger` + ikona |

### 8.4. Liczby w scenie gry (Pixi)

* Liczniki zmieniające się co klatkę (wygrana, saldo w grze, licznik darmowych spinów) to `BitmapText`, a nie
  zwykły `Text`. **Dlaczego:** każda zmiana zwykłego `Text` w Pixi oznacza ponowne narysowanie napisu i wysłanie
  nowej tekstury do GPU, a `BitmapText` składa liczbę z gotowych glifów w atlasie.
* Przed utworzeniem fontów bitmapowych czekamy na załadowanie pliku fontu (`document.fonts.load('800 32px Manrope')`),
  inaczej Pixi wygeneruje glify fontem zastępczym.
* Liczba na kuli mnożnika S3: Marcellus, kolor `--bg-0` z cienkim konturem `--gold-1` (jasny środek kuli, § 11.4).

### 8.5. Ładowanie fontów

* `font-display: swap` dla UI (tekst widać od razu, font podmienia się po załadowaniu).
* `<link rel="preload" as="font" type="font/woff2" crossorigin>` tylko dla dwóch plików krytycznych:
  Manrope 800 i Cinzel 700. Fonty gier ładujemy razem z assetami danej gry (E20).

### 8.6. Zasady polskiej typografii

* Cudzysłowy „…”, półpauza „–” w zakresach (10–1000), myślnik „—” w zdaniach.
* Spacja niełamliwa po jednoliterowych słowach (w, z, i, o, a, u) i w kwotach (`10 000`).
* Wersaliki zawsze z dodatnim odstępem liter (≥ 0,04 em), bo ściśnięte kapitały są mniej czytelne.
* Akapity: 45–75 znaków w wierszu.

### 8.7. Litery na obrazach a fonty

Generator nie używa naszych plików fontów — rysuje litery sam. Dlatego w promptach opisujemy **charakter liter**
(„classical Roman capitals like Cinzel”), a nie nazwę pliku. Logotypy gier mają styl zgodny z fontem gry (S1 —
Bungee, S2 — Cinzel Decorative, S3 — Marcellus), żeby napisy HTML i grafika w grze tworzyły jedną całość.

---

## 9. Gra S1: Cebulowy 777

Kod gry: `s1` / `cebulowy-777`. Klasyk 3×3, 5 linii, szybkie tempo (stop ostatniego bębna po 1600 ms).
Obrazy: czat 3, priorytet P0 — to pierwsza grywalna gra, więc wyznacza poziom jakości dla pozostałych.

### 9.1. Nastrój

**Noc w retro Las Vegas: brzęczy neon, błyszczy chrom, za automatem zachodzi synthwave'owe słońce.**
Szybko, radośnie, świetliście, z nutą nostalgii. Połączenie szyldów Vegas z lat 50.–60. (żarówki, gwiazdy
„atomic age”, chrom) z estetyką synthwave lat 80. (siatka perspektywiczna, pasiaste słońce, róż i błękit).
To jedyna gra, w której neon wolno stosować na większych płaszczyznach.

### 9.2. Paleta S1

| Nazwa | HEX | Rola |
|---|---|---|
| Noc S1 | `#0B0624` | niebo przy górnej krawędzi, podkład bębna |
| Fiolet synthwave | `#3A0CA3` | środek nieba, linie siatki w oddali |
| Gorący róż | `#FF2E88` (`--magenta`) | neon główny, napisy, obrys ramki |
| Elektryczny błękit | `#21E6FF` (`--cyan`) | neon drugi, wewnętrzny obrys, rim |
| Ultramaryna neonowa | `#2B6BFF` | siatka podłogi, dalekie neony |
| Zachód słońca | `#FF7A3D` → `#FFD04D` | pasiaste słońce, łuna przy horyzoncie |
| Chrom (światło / cień) | `#E6ECF5` / `#6B7590` | ramka, tabliczka BAR |
| Czerwień siódemki | `#E3122B` | siódemka, wiśnie, kokarda dzwonka |
| Złoto | `--gold-1` … `--gold-3` | dzwonek, WILD, obramowanie siódemki |

Motyw CSS gry: `--accent-1: #FF2E88; --accent-2: #21E6FF; --game-bg: #0B0624`.

### 9.3. Motywy, materiały, światło

* **Motywy:** rurki neonowe biegnące wzdłuż krawędzi, chromowane listwy, żarówki szyldów (marquee), gwiazdki
  4- i 8-ramienne w stylu „atomic age”, perspektywiczna siatka podłogi, pasiaste słońce, sylwetki palm, kształty
  szyldów-strzałek (bez napisów), klasyczna ikonografia automatów owocowych.
* **Materiały:** cukierkowa emalia (owoce), chrom, szkło neonowe, polerowane złoto (dzwonek, WILD), czarny lakier
  (tabliczka BAR).
* **Światło:** key ciepły biały (~4500 K) z lewej-góry; rim cyjan z prawej i wyraźny rim magenta z lewej-dołu
  (do 70% siły key). Chrom odbija róż i błękit neonów.

### 9.4. Symbole S1

| ID | Poziom | Wygląd | Kolor / sylwetka |
|---|---|---|---|
| `s1_sym_wisnie` | niski 1 | Para soczystych, ciemnoczerwonych wiśni z lakierowanej emalii na jednej rozwidlonej zielonej szypułce z listkiem. Na każdej wiśni okrągły biały odblask i cienki różowy rim neonu. | czerwień `#C8102E`; dwa koła + „V” szypułki |
| `s1_sym_cytryna` | niski 2 | Pękata cytryna z zaostrzonymi końcami, jaskrawożółta emalia z delikatnie zaznaczoną fakturą skórki i małym listkiem; cyjanowy rim po prawej. | żółć `#FFD23F` (najjaśniejszy owoc); poziomy owal z czubkami |
| `s1_sym_sliwka` | niski 3 | Duża śliwka z wyraźną pionową bruzdą, krótką szypułką i listkiem, z mlecznym „nalotem” u góry i różowo-fioletowymi refleksami. | fiolet `#7B2CBF` (najciemniejszy owoc); jeden owal z bruzdą |
| `s1_sym_arbuz` | niski 4 | Gruby plaster arbuza w kształcie półkola: ciemnozielona skórka w paski, jasny pas, soczysty czerwony miąższ z błyszczącymi czarnymi pestkami ułożonymi w łuk. | czerwień + zieleń; półkole, najszersza sylwetka wśród owoców |
| `s1_sym_dzwonek` | wysoki 1 | Dzwonek z polerowanego złota z grawerowaną opaską i widocznym serduszkiem; na szczycie czerwona satynowa kokarda. | złoto; klasyczna sylwetka dzwonu |
| `s1_sym_bar` | wysoki 2 | Gruba prostokątna tabliczka z czarnego lakieru w fazowanej chromowanej ramce, z wypukłym napisem `BAR` z chromu z różowym neonowym obrysem. | czerń + chrom + róż; poziomy prostokąt |
| `s1_sym_siodemka` | wysoki 3 (najwyższy) | Masywna kursywna cyfra `7` z lśniącej wiśniowej emalii w grubym fazowanym złotym obramowaniu, z cienką białą linią neonu wewnątrz i dwiema małymi gwiazdkami-błyskami. | czerwień + złoto; ukośna „7” |
| `s1_sym_wild` | specjalny | **Złota Cebula**: pękata cebula z polerowanej złotej łuski z zakręconym czubkiem, za nią cienki pierścień neonu (magenta przechodząca w cyjan). Przez dolną trzecią część biegnie czarna lakierowana wstęga z chromowaną krawędzią i napisem `WILD` w różowym neonie. | złoto + neon; cebula + pozioma wstęga |

**Kontrola rozróżnialności S1 (skala szarości):** najjaśniejsze są cytryna i dzwonek (różne sylwetki), średnie —
arbuz, wiśnie i siódemka (siódemka ma złotą obwódkę i inną sylwetkę), najciemniejsze — śliwka i BAR (owal kontra
prostokąt). WILD jest najjaśniejszy dzięki złotu i neonowi.

**Napisy rysowane przez kod w S1** (brak osobnych obrazów):

* „×2” przy neonowym mnożniku (E50) i „NEON JACKPOT” (E51): Bungee, biały rdzeń `#FFFFFF`, kontur `--magenta`
  4 px, poświata magenta (promień 24 px) + cyjan (promień 48 px). Na poziomie Low tylko kontur bez poświaty.
  Efekt „brzęczenia” neonu: krótkie przygaszenia jasności do 60% na 40–80 ms, najwyżej 3 na sekundę (limit błysków
  z WCAG 2.3.1). Dźwięk: `sfx_s1_neon_bzyk`, `sfx_s1_jackpot` ([05-dzwiek-i-muzyka.md](05-dzwiek-i-muzyka.md)).

### 9.5. Tło `s1_tlo_desktop` i `s1_tlo_mobile`

**Desktop (3:2):** retro-Vegas nocą w estetyce synthwave.

* Niebo: gradient od `#0B0624` (góra) przez `#3A0CA3` do różowo-pomarańczowej łuny przy horyzoncie; rzadkie gwiazdy.
* Horyzont na ~50% wysokości (punkt zbiegu z § 4.3, dopuszczalnie 45–55%). Pasiaste retro słońce wschodzi
  z horyzontu na środku **za automatem** — kod przykryje je ramką, a widoczne zostaną tylko świecące łuki nad ramką
  i po jej bokach (podświetlenie od tyłu, tzw. halo). Bezpośrednio za oknem bębnów słońce jest przygaszone,
  a niebo ciemne.
* Podłoga: perspektywiczna siatka neonowa (`#2B6BFF` z różowymi liniami poziomymi), zbiegająca się do środka;
  w strefie panelu (y 80–100%) ściemniona do `--bg-0`.
* Boki (x 0–18% i 82–100%): sylwetki palm i szyldów w kształcie strzałek i gwiazd z żarówkami, chromowane słupy,
  neony w różu i błękicie. Szyldy bez liter.
* Opcjonalny akcent: w lewym-górnym rogu neonowy szyld w kształcie cebuli (sam kształt, bez napisu).

**Mobile (2:3):** słońce i jego łuna w pasie y 10–20% (nad bębnami), palmy i szyldy przy bocznych krawędziach
(mogą zostać przycięte), siatka podłogi od ~66% w dół, ciemna pod panelem.

### 9.6. Ramka `s1_ramka` (1:1, ALFA)

* **Okno:** w pełni przezroczysty kwadrat (3×3 pola kwadratowe), ~62% szerokości kadru (~640×640 px),
  wyśrodkowany w poziomie; w pionie dozwolone przesunięcie w dół do 4% pod szerszy grzebień u góry.
* **Rama:** gruba obudowa automatu z polerowanego chromu z zaokrąglonymi narożnikami; tuż przy oknie cienka złota
  listwa; wzdłuż zewnętrznej krawędzi różowa rurka neonowa, wzdłuż wewnętrznej — cyjanowa.
* **Grzebień u góry:** łuk z rzędem żarówek (świecą równo, ciepłą bielą) i gwiazdką „atomic age” w środku.
  Nie ma tabliczki na logo — `s1_logo` kod kładzie nad ramką z lekkim nachodzeniem.
* **Dół:** chromowana półka z dwiema małymi gwiazdkami-nitami.
* W oknie: bez szyby, bez refleksów, bez przegródek między bębnami (separatory rysuje kod, żeby zgadzały się z siatką).
* „Biegnące światła” żarówek robi kod: przesuwaną maską gradientu wzdłuż obrysu ramki (E22, E28–E30).

### 9.7. Logo `s1_logo` (3:2, ALFA)

Tekst dokładnie: `CEBULOWY 777` (bez polskich znaków).

* Wiersz 1: `CEBULOWY` — grube, zaokrąglone retro litery szyldowe (charakter kroju Bungee) zrobione z różowych
  rurek neonowych z białym gorącym rdzeniem, oprawione w cienką cyjanową rurkę konturu; za literami ciemna,
  chromowana tablica o kształcie szyldu z żarówkami na obwodzie.
* Wiersz 2: `777` — większe, wiśniowo-chromowe cyfry 3D w złotej obwódce, lekko pochylone, z 2–3 gwiazdkami-błyskami.
* Poświata neonu zwarta (≤ 6% wysokości liter), mieści się w marginesie.

### 9.8. Okładka i baner

* **`s1_okladka` (2:3):** logo w y 8–30%. W centrum Złota Cebula WILD przebija się przez neonowy pierścień, wokół
  niej lecą wiśnie, siódemki i iskry; tło: pasiaste słońce i siatka synthwave. Dolne 15% przechodzi w `--bg-0`.
* **`s1_baner` (3:2, bez tekstu):** po prawej (~60% kadru) Złota Cebula w neonowym pierścieniu i fontanna
  siódemek, wiśni i gwiazdek; po lewej ciemne niebo synthwave ze słońcem przy horyzoncie — miejsce na tytuł HTML.

---

## 10. Gra S2: Złoty Faraon

Kod gry: `s2` / `zloty-faraon`. Wideo-slot 5×3, 20 linii, darmowe spiny z rozszerzającym się WILD.
Obrazy: czat 4, priorytet P1.

### 10.1. Nastrój

**Gra główna:** odkrywca wchodzi do zapieczętowanego skarbca. Złoto lśni w świetle pochodni, w snopach światła
tańczy kurz, z ciemności patrzą bogowie. Tajemniczo, dostojnie, bogato i ciepło.
**Darmowe spiny:** noc nad piramidami. Cisza, gwiazdy, magia; z wierzchołka piramidy w niebo bije wiązka światła.
Zmiana z ciepłego złota na chłodny błękit nocy daje graczowi wyraźny sygnał „jesteś w bonusie”.

### 10.2. Paleta S2

| Nazwa | HEX | Rola |
|---|---|---|
| Złoto | `--gold-1` … `--gold-3` | dominanta: relikwia, maska, obramowania |
| Lapis lazuli | `#1B3FA0`, ciemny `#0E2466` | inkrustacje, pasy nemes, tabliczki napisów |
| Turkus (fajans) | `#2EC4B6` | inkrustacje, rim, akcent UI gry |
| Piaskowiec | `#C89B5A`, cień `#6B4A26` | ramka, litery niskich symboli, ściany |
| Karneol | `#C8321E` | „Q”, dysk słońca skarabeusza |
| Malachit | `#1FA35B` | „J” |
| Ametyst | `#8E4BD8` | „A” |
| Obsydian / bazalt | `#15121C` | Anubis, ciemne płaszczyzny |
| Pochodnia | światło `#FFA45C`, płomień `#FF7A1A` | key light, ogień w tle |
| Noc (darmowe spiny) | `#0A1030`, gwiazdy `#E8F0FF`, wiązka `#9FE8FF` | tło darmowych spinów |

Motyw CSS gry: `--accent-1: #2EC4B6; --accent-2: #1B3FA0; --game-bg: #0E1530`.

### 10.3. Motywy, materiały, światło

* **Motywy:** fryzy z ornamentem hieroglificznym (dekoracja, nie czytelny tekst), skrzydlaty dysk słońca, kolumny
  z kapitelami lotosu i papirusu, puste kartusze, wzory kołnierza usech, pasy zygzaków i schodków, skarabeusze,
  pióro Maat, filar dżed.
* **Materiały:** polerowane złoto, płatki złota na kamieniu, rzeźbiony piaskowiec, lapis lazuli ze złotymi
  drobinkami pirytu, turkusowy fajans, karneol, obsydian; inkrustacje w złotych komórkach (cloisonné).
* **Światło:** key = pochodnia na lewej ścianie (~2400 K) z lewej-góry; rim turkusowy z prawej; bursztynowy rim
  akcentowy zamiast magenty. Głębokie cienie w odcieniu lapisu, nie czerni.

### 10.4. Symbole S2

Niskie symbole to litery i cyfra z piaskowca, których przednia ściana jest inkrustowana kamieniem szlachetnym
w złotym obrysie. Każdy ma inny kolor kamienia. Wszystkie litery mają tę samą wysokość i klasyczny szeryfowy krój
z klinowymi szeryfami.

| ID | Poziom | Wygląd | Kolor / sylwetka |
|---|---|---|---|
| `s2_sym_10` | niski 1 | Cyfry `10` z piaskowca z licem z turkusowego fajansu w złotym obrysie; wewnątrz „0” wygrawerowany mały kwiat lotosu. | turkus `#2EC4B6`; dwa znaki, najszerszy niski |
| `s2_sym_j` | niski 2 | Litera `J` z licem z zielonego malachitu w złotym obrysie, z piórem Maat wygrawerowanym wzdłuż trzonu i owalnym kaboszonem na końcu łuku. | malachit `#1FA35B` |
| `s2_sym_q` | niski 3 | Litera `Q` z licem z czerwonego karneolu w złotym obrysie; ogonek zakończony złotą główką kobry, w okręgu grawer tarczy słońca. | karneol `#C8321E` |
| `s2_sym_k` | niski 4 | Litera `K` z licem z lapis lazuli ze złotymi drobinkami, w złotym obrysie; na trzonie pionowy pas zygzaków. | lapis `#2649C9` |
| `s2_sym_a` | niski 5 | Litera `A` z licem z fioletowego ametystu w złotym obrysie; poprzeczka jako złota opaska z grawerem, na szczycie mały złoty kaboszon. | ametyst `#8E4BD8` |
| `s2_sym_ankh` | wysoki 1 | Krzyż anch z polerowanego złota z inkrustacją turkusu i lapisu w pętli oraz pasem drobnych hieroglifów na ramionach. | złoto + turkus; pętla nad „T” |
| `s2_sym_oko` | wysoki 2 | Oko Horusa jako masywny złoty amulet w reliefie: lapisowa źrenica z turkusowym odblaskiem, charakterystyczna „łza” i spiralny ogon pod okiem, wypełnienia z ciemnego lapisu. | złoto + lapis; poziome oko ze spiralą |
| `s2_sym_skarabeusz` | wysoki 3 | Skarabeusz z polerowanego zielono-czarnego kamienia z rozpostartymi skrzydłami z piór ze złota, turkusu i lapisu (styl pektorału); nad głową trzyma czerwony dysk słońca z karneolu. | wielobarwny; najszersza pozioma sylwetka |
| `s2_sym_anubis` | wysoki 4 | Popiersie Anubisa w ujęciu 3/4: głowa szakala z czarnego polerowanego obsydianu, uszy i oczy obrysowane złotem, bursztynowe świecące oczy, złoty kołnierz usech w pasy lapisu i turkusu. | najciemniejszy symbol; wysokie spiczaste uszy |
| `s2_sym_faraon` | wysoki 5 (najwyższy) | Złota maska faraona en face: chusta nemes w pasy złota i lapisu, kobra ureusz na czole, pleciona broda, oczy podkreślone lapisem. Najbogatszy detal i najjaśniejsze złoto w grze. Inspiracja ogólna, nie wierna kopia konkretnego zabytku. | najjaśniejszy; trapez nemes z opadającymi pasami |
| `s2_sym_wild` | specjalny | **Złota Relikwia Cebuli**: relikwiarz z polerowanego złota w kształcie cebuli (cebulasta kopuła z czubkiem), z pionowymi pasami lapisu wzdłuż żeber, grawerowanymi hieroglifami i małym kartuszem, na niskiej złotej podstawie, w ciepłej złotej aurze. Przez dolną część biegnie tabliczka z lapisu w złotej ramce z napisem `WILD` złotymi literami. | złoto + lapis; cebula + tabliczka |
| `s2_sym_scatter` | specjalny | Piramida z piaskowca w chłodnym nocnym świetle, ze złotym piramidionem, z którego w górę bije pionowa wiązka cyjanowo-białego światła; na ścianie świeci turkusowe oko. U podstawy tabliczka lapis-złoto z napisem `SCATTER`. Wiązka wygasa przed górnym marginesem. | trójkąt + pionowa wiązka; jedyny chłodny symbol |

**Dlaczego scatter jest chłodny:** wszystko w grze głównej jest ciepłe, więc chłodna piramida z wiązką wyróżnia się
na planszy od razu. Zapowiada też chłodny nastrój darmowych spinów.

### 10.5. Rozszerzony WILD `s2_wild_rozszerzony` (2:3, ALFA)

Grafika przykrywa cały bęben (3 pola jeden nad drugim) w darmowych spinach (E60).

* **Proporcja treści:** pionowa kolumna o proporcji 1:3, około 45% szerokości płótna (~460 px), na całą wysokość
  minus marginesy 6% (~1350 px). Po bokach kolumny tło przezroczyste, z wygasającą poświatą (do 6%).
* **Treść:** relikwia z `s2_sym_wild` (ten sam projekt, większa) w środku kolumny, w pionowym słupie złotego
  światła; po bokach pionowe pasy świecących turkusowo-złotych hieroglifów; u góry i u dołu złote zwieńczenia jak
  w pionowym kartuszu; w dolnej części tabliczka lapis-złoto z napisem `WILD`.
* **Dlaczego proporcja 1:3 w płótnie 2:3:** ChatGPT nie generuje formatu 1:3, więc rysujemy kolumnę w środku
  formatu 2:3 i przycinamy przezroczyste boki przy obróbce.
* Kod: kolumna „rozwija się” od pola, na którym wylądował WILD, w górę i w dół (maska, ~500 ms), po bokach wybuchają
  hieroglify z `s2_fx_hieroglify`. Dźwięk: `sfx_s2_wild_rozszerzenie`.

### 10.6. Tło `s2_tlo_desktop` i `s2_tlo_mobile`

**Desktop (3:2):** wnętrze skarbca w grobowcu.

* Środek tylnej ściany: duża, ciemna nisza-portal za bębnami (najciemniejsza strefa). Nad nią, w pasie górnym,
  przygaszony relief skrzydlatego dysku słońca (tło dla logo gry).
* Boki: masywne kolumny z kapitelami lotosu, ściany z malowanymi fryzami hieroglificznymi w złocie, turkusie
  i ochrze; na wysokości ~40% dwa kosze ognia (lewy jaśniejszy — key light), kopce złota w dolnych rogach
  (monety cebulion, wazy, skrzynia, posążki).
* Z góry wpadają ukośne snopy światła z kurzem (od lewej).
* Podłoga z kamiennych płyt ciemnieje do `--bg-0` w strefie panelu.

**Mobile (2:3):** nisza-portal przez całą strefę bębnów, kosze ognia w górnych bokach (y 10–20%), skarby
w dolnych rogach pod panelem (przyciemnione), relief słońca nad bębnami.

### 10.7. Tło darmowych spinów `s2_tlo_fs_desktop` i `s2_tlo_fs_mobile`

* Ta sama linia horyzontu i strefy co tło bazowe (§ 6.7).
* Noc nad pustynią: głęboki granat `#0A1030`, Droga Mleczna ukośnie od lewego-górnego rogu, tysiące gwiazd.
* Główna piramida stoi na środku **za bębnami**: jej wierzchołek leży na ~10–14% wysokości, tak żeby wyglądał
  zza górnej krawędzi ramki, i z niego bije w niebo pionowa wiązka `#9FE8FF` aż do górnej krawędzi kadru. Logo gry stoi na tle wiązki — dostaje naturalne halo.
  Ściany piramidy w strefie bębnów są ciemne (chłodne światło księżyca).
* Po bokach dwie mniejsze piramidy i wydmy w niebieskiej poświacie, w dolnych rogach przygaszone obeliski.
* Wersja mobile: wierzchołek i wiązka w pasie y 10–20%, mniejsze piramidy przy bokach (mogą zostać przycięte).

### 10.8. Ramka `s2_ramka` (3:2, ALFA)

* **Okno:** w pełni przezroczysty prostokąt 5:3 (15 pól kwadratowych), ~80% szerokości i ~72% wysokości kadru
  (~1230×738 px), wyśrodkowany. Boczne części ramy ~10% szerokości, górna i dolna ~14% wysokości.
* **Boki:** kolumny z piaskowca z kapitelami lotosu, z inkrustowanymi pasami lapisu i turkusu.
* **Góra:** nadproże ze złotą listwą; w środku płaski złoty pas (kod kładzie tu logo gry), po bokach nadproża
  skrzydła skrzydlatego dysku.
* **Dół:** kamienny cokół z pasem hieroglificznym i złotą listwą.
* **Krawędź okna:** cienka polerowana złota listwa perełkowa z inkrustacją lapisu — ostra, prosta.
* **Narożniki:** małe złote kartusze.

### 10.9. Logo `s2_logo` (3:2, ALFA)

Tekst dokładnie: `ZŁOTY FARAON`. W promptach literujemy: **Ł = L with stroke** (Z, L-with-stroke, O, T, Y).

* `ZŁOTY` mniejszy (~60% wysokości) nad większym `FARAON`.
* Ozdobne rzymskie kapitały w duchu Cinzel Decorative, z polerowanego złota z inkrustowanym konturem z lapisu
  i głębokim rzeźbieniem; klinowe szeryfy z lekkim egipskim akcentem.
* Nad napisem mały skrzydlaty dysk słońca z kobrą ureusz; turkusowy rim na prawych krawędziach liter.

### 10.10. Okładka i baner

* **`s2_okladka` (2:3):** logo w y 8–30%. W centrum złota maska faraona w świetle pochodni, za nią ciemny portal
  i snopy światła z kurzem; u dołu kopce złota i relikwia cebuli. Dolne 15% przechodzi w `--bg-0`.
* **`s2_baner` (3:2, bez tekstu):** po prawej (~60%) maska faraona i relikwia na stosie skarbów, snop światła
  z góry; po lewej ciemne wnętrze skarbca z kolumną — miejsce na tytuł HTML.

### 10.11. Efekty `s2_fx_hieroglify` (CZARNE SHEET 4×2)

Osiem świecących znaków: anch, oko wadżet, skarabeusz, pióro Maat, filar dżed, berło was, kwiat lotosu,
pierścień szen. Każdy narysowany świecącą linią (grubość ~3% komórki) w złoto-białym kolorze z turkusową poświatą,
na czystej czerni, wyśrodkowany z ≥ 10% marginesu. Kod nadaje tint (złoto lub turkus) i używa znaków przy
rozszerzaniu WILD (E60), dodatkowych spinach (E61) i przejściu do darmowych spinów (E35).

---

## 11. Gra S3: Kryształowa Kaskada

Kod gry: `s3` / `krysztalowa-kaskada`. Siatka 6×5, wygrane klastrowe (5+ połączonych symboli), kaskady, kule
mnożników w darmowych spinach. Obrazy: czat 5, priorytet P2.

### 11.1. Nastrój

**Gra główna:** ukryta jaskinia, w której kryształy „oddychają” światłem. Magicznie, chłodno, świetliście,
hipnotycznie. Ruch kaskad ma przypominać spadające krople światła.
**Darmowe spiny:** najgłębsza komnata. Pod sklepieniem faluje podziemna zorza, kryształy lewitują, wszystko świeci
mocniej i bardziej nasyconymi kolorami.

### 11.2. Paleta S3

| Nazwa | HEX | Rola |
|---|---|---|
| Jaskinia | `#070A1F`, `#0D1638` | tło, podkład bębna |
| Bioluminescencja | `#19F5D2` | mech, rim, akcent UI gry |
| Szafir | `#2F6BFF` | symbol, kryształy w tle |
| Szmaragd | `#19D17A` | symbol |
| Ametyst | `#A64DFF` | symbol, rim akcentowy, kryształy w tle |
| Topaz | `#FFB23D` | symbol |
| Rubin | `#FF2D55` | symbol |
| Diament | `#E8FBFF` | symbol (lodowa biel) |
| Opal (refleksy) | `#FF8AD8` | tęczowe refleksy na kryształach |
| Zorza (darmowe spiny) | `#5CFFB0` → `#B66BFF` | wstęgi zorzy |
| Złoto | `--gold-1` … `--gold-3` | cebula, oprawy symboli wysokich |

Motyw CSS gry: `--accent-1: #19F5D2; --accent-2: #A64DFF; --game-bg: #070A1F`.

### 11.3. Motywy, materiały, światło

* **Motywy:** skupiska sześciokątnych kryształów, stalaktyty, świecący mech i małe bioluminescencyjne grzyby,
  unoszące się drobiny światła, nieruchoma tafla wody z odbiciami, świetlisty wodospad (tytułowa kaskada),
  kaustyki na ścianach, opalizujące refleksy. Złoty filigran wyłącznie na symbolach wysokich.
* **Materiały:** fasetowane klejnoty z dyspersją, przezroczysty kryształ ze świecącym rdzeniem, mokra ciemna
  skała, świecący mech, złote oprawy filigranowe.
* **Światło:** key = ciepły złoty snop z otworu w sklepieniu, z lewej-góry (zgodnie z regułą globalną); rim
  bioluminescencyjny teal z prawej; ametystowy rim akcentowy z lewej-dołu; klejnoty mają własny wewnętrzny blask.

### 11.4. Symbole S3

Niskie symbole to luźne klejnoty bez oprawy, każdy w innym szlifie, więc różnią się sylwetką, nie tylko kolorem.
Wysokie mają złote oprawy. To czytelny sygnał wartości.

| ID | Poziom | Wygląd | Kolor / sylwetka |
|---|---|---|---|
| `s3_sym_szafir` | niski 1 | Szafir w szlifie gruszki (kropla czubkiem do góry), głęboki chabrowy błękit z jasnym rdzeniem i chłodnymi iskrami na fasetach. | `#2F6BFF`; kropla |
| `s3_sym_szmaragd` | niski 2 | Szmaragd w szlifie szmaragdowym (prostokąt ze ściętymi rogami i stopniowanymi fasetami), ustawiony pionowo, soczysta zieleń z głębią jak woda. | `#19D17A`; pionowy ośmiokąt |
| `s3_sym_ametyst` | niski 3 | Ametyst w płaskim szlifie sześciokątnym, nasycony fiolet z różowymi refleksami na krawędziach faset. | `#A64DFF`; sześciokąt |
| `s3_sym_topaz` | niski 4 | Topaz w szlifie markiza (wydłużona „łódka”) ułożony ukośnie pod 45°, złocisto-pomarańczowy z ciepłym rdzeniem. | `#FFB23D`; ukośne wrzeciono |
| `s3_sym_rubin` | wysoki 1 | Rubin w szlifie serca, intensywnie czerwono-różowy, w delikatnej złotej filigranowej oprawie z czterema łapkami; jasny pulsujący rdzeń. | `#FF2D55` + złoto; serce |
| `s3_sym_diament` | wysoki 2 | Diament w szlifie brylantowym w ujęciu 3/4 (szeroka korona, ostry spód), lodowobiały z silną tęczową dyspersją, w oprawie z białego złota z cienką złotą obwódką. | `#E8FBFF`; klasyczna sylwetka brylantu |
| `s3_sym_cebula` | wysoki 3 (najwyższy) | **Kryształowa złota cebula**: bryła cebuli z przezroczystego kryształu, w której środku widać złote warstwy jak słoje cebuli; złoty zakręcony czubek i złoty filigranowy pierścień u jego podstawy, tęczowe refleksy na krawędziach. Najbogatszy detal wśród symboli zwykłych. | złoto + kryształ; cebula |
| `s3_sym_scatter` | specjalny | **„Serce Jaskini”**: tęczowy trójgraniasty pryzmat z kryształu unoszący się w pierścieniu drobnych kryształków, rozszczepiający światło w wachlarz barw tęczy (w obrębie marginesu). U dołu tabliczka z ciemnego ametystu w srebrno-złotej ramce z napisem `SCATTER` kryształowymi literami. | tęcza; trójkąt + wachlarz |
| `s3_sym_mnoznik` | specjalny | Kryształowa kula w delikatnej złotej klatce z dwóch pierścieni. Środek kuli to gładki, mlecznobiały, równomiernie świecący obszar (~55% średnicy kuli) bez żadnego detalu. Sama kula w neutralnych, chłodnobiałych tonach. | neutralna biel + złoto; koło w pierścieniach |

**Kula mnożnika a kod (E72, E73):** liczbę („×2” … „×100”) wpisuje kod fontem Marcellus w kolorze `--bg-0`
z konturem `--gold-1`. Kolor poziomu mnożnika daje kolorowa poświata `add` nałożona na środek kuli: ×2–×5 cyjan,
×10–×25 fiolet `#A64DFF`, ×50–×100 złoto z magentą. **Dlaczego kula jest neutralna:** kolorowa kula z obrazu
pasowałaby tylko do jednego poziomu. Neutralna przyjmuje każdy kolor od kodu, a jasny środek gwarantuje kontrast
ciemnej liczby.

**Rozróżnialność S3:** diament (najjaśniejszy) i topaz (jasny) mają zupełnie różne sylwetki; szafir i ametyst
(oba ciemniejsze) różnią się kroplą i sześciokątem; szmaragd i rubin mają podobną jasność, ale prostokąt
kontra serce w złotej oprawie. Cebula jako jedyna łączy kryształ ze złotem.

### 11.5. Odłamki `s3_fx_odlamki` (ALFA SHEET 4×3)

Dwanaście odłamków kryształu: 4 cienkie drzazgi, 4 masywne bryłki, 4 płaskie łuski, o różnej wielkości (40–90%
komórki). Przezroczysty, neutralny kryształ z lekko chłodnym odcieniem, ostre fasety, jasne krawędzie. Kod nadaje
im tint w kolorze pękającego symbolu (kolory z tabeli § 11.4) i rozrzuca je przy pęknięciu (E70). Neutralny kolor
pozwala obsłużyć wszystkie symbole jednym arkuszem.

### 11.6. Tło `s3_tlo_desktop` i `s3_tlo_mobile`

**Desktop (3:2):** wnętrze kryształowej jaskini.

* Boki: ogromne skupiska kryształów ametystu i szafiru wyrastające ze ścian (x 0–18% i 82–100%), u ich podstawy
  świecący mech i małe bioluminescencyjne grzyby.
* Pas górny: wąski świetlisty wodospad spływa ze szczeliny w sklepieniu na środku i znika **za ramką**. Z lewej-góry
  wpada ciepły złoty snop światła (key) z pyłem.
* Strefa bębnów: głęboka, ciemna perspektywa jaskini z rzadkim, miękkim bokeh drobin światła.
* Dół: nieruchoma tafla wody z odbiciami kryształów, ściemniona do `--bg-0` pod panelem.

**Mobile (2:3):** wodospad i snop światła w pasie y 10–20%, kryształy przy bokach (mogą zostać przycięte),
tafla wody pod panelem.

### 11.7. Tło darmowych spinów `s3_tlo_fs_desktop` i `s3_tlo_fs_mobile`

* Ta sama linia horyzontu, ten sam punkt zbiegu i te same strefy co tło bazowe (§ 6.7).
* Głębsza, wyższa komnata: pod sklepieniem falują wstęgi podziemnej zorzy (`#5CFFB0` → `#B66BFF`), w powietrzu
  lewitują kryształy różnej wielkości, ściany jaśniej świecą bioluminescencją.
* Zorza i najjaśniejsze kryształy leżą w pasie górnym i po bokach; strefa bębnów pozostaje ciemna.
* Całość jaśniejsza i bardziej nasycona niż tło bazowe (średnie L\* bliżej górnej granicy 22), ale w normach § 6.1.

### 11.8. Ramka `s3_ramka` (1:1, ALFA)

* **Okno:** w pełni przezroczysty prostokąt 6:5 (30 pól kwadratowych), ~80% szerokości i ~67% wysokości kadru
  (~820×683 px), wyśrodkowany. Boki ramy ~10% szerokości, góra i dół ~17% wysokości.
* **Rama:** ciemna, srebrzysto-kamienna obudowa porośnięta kryształami; największe skupiska w narożnikach i na
  środku góry („korona” z kryształów ametystu, szafiru i jednego złotego kryształu-cebuli); dół: rząd mniejszych
  kryształów i świecący mech.
* **Krawędź okna:** czysta, prosta, cienka listwa z białego złota — kryształy nie wchodzą w okno.
* Zewnętrzne kryształy mogą być półprzezroczyste, ale okno MUSI być w 100% przezroczyste, a jego krawędź ostra
  (automatyczne wykrywanie okna).

### 11.9. Logo `s3_logo` (3:2, ALFA)

Tekst dokładnie: `KRYSZTAŁOWA KASKADA`. W promptach literujemy: **Ł = L with stroke**
(K, R, Y, S, Z, T, A, L-with-stroke, O, W, A).

* `KRYSZTAŁOWA` mniejsza (~60% wysokości) nad większą `KASKADA`.
* Kapitały w duchu kroju Marcellus (szeryf z rozszerzonymi końcami kresek), wykonane z fasetowanego,
  przezroczystego kryształu z fioletowo-cyjanową refrakcją i cienkimi złotymi krawędziami.
* Wokół liter kilka drobnych odłamków i błysków; z dolnej krawędzi `KASKADA` „skapują” trzy świetliste krople.

### 11.10. Okładka i baner

* **`s3_okladka` (2:3):** logo w y 8–30%. W centrum kryształowa złota cebula wyłania się z kaskady spadających
  klejnotów, za nią świetlisty wodospad i skupiska kryształów. Dolne 15% przechodzi w `--bg-0`.
* **`s3_baner` (3:2, bez tekstu):** po prawej (~60%) kaskada klejnotów spadająca z góry i kryształowa cebula
  w snopie światła; po lewej ciemna głębia jaskini z bioluminescencją — miejsce na tytuł HTML.

---

## 12. Czego unikać

| Kategoria | Unikamy | Dlaczego |
|---|---|---|
| Styl | fotorealizmu (pory, brud, rysy, „zdjęciowe” owoce) | w małej skali to szum; kłóci się ze stylizowanym 3D |
| Styl | płaskiej grafiki wektorowej, clip-artu, ikon „flat” | wygląda tanio obok efektów 3D i cząsteczek |
| Styl | stylu dziecięcego: kawaii, chibi, wielkie okrągłe oczy, pastele, plastikowe zabawki | sprzeczny z „premium”, a w grze z motywem hazardu niewłaściwy (kojarzy się z grami dla dzieci) |
| Styl | anime, pixel artu, akwareli, szkicu | inny język wizualny niż marka |
| Styl | mieszania stylów w obrębie jednej gry | gracz od razu widzi „wklejkę” |
| Światło | głównego światła (key) z prawej lub od dołu; różnych kierunków key w jednym zestawie | symbole obok siebie wyglądają na niespójne (§ 4.2) |
| Kolor | złota miedzianego, różowego, cytrynowego, zielonkawego | złoto musi być jedno (§ 3.4) |
| Kolor | czystej czerni w cieniach i dużych przepalonych białych plam | spłaszcza bryłę; biel zostawiamy dla efektów |
| Kolor | dominującej zieleni w UI | zieleń `--win-green` oznacza zysk |
| Kolor | neonowego różu i błękitu w S2 | psuje klimat egipskiego skarbca (turkus i lapis zamiast neonu) |
| Kompozycja | cienia na podłożu, podłogi, odbicia pod obiektem | cień dodaje kod (§ 4.7) |
| Kompozycja | przyciętych obiektów i poświaty uciętej krawędzią | nie da się tego naprawić obróbką |
| Kompozycja | tła lub scenki za symbolem w obrazie ALFA | symbol musi działać na każdym podkładzie |
| Kompozycja | automatu, bębnów, ramki, symboli i ludzi w tłach gier | ramkę i symbole nakłada kod; ludzi generator często zniekształca |
| Kompozycja | jasnego, szczegółowego środka tła | konkuruje z bębnami (§ 6.1) |
| Kompozycja | perspektywy, szyby i przegródek w oknie ramki | okno musi być prostokątem do automatycznego wykrycia |
| Kompozycja | ornamentu, iskier i refleksów w środku elementu 9-slice | rozciągną się w smugę |
| Alfa | narysowanej szachownicy, półprzezroczystej mgły, kolorowych obwódek | brudne krawędzie na każdym tle (§ 4.9) |
| Tekst | jakiegokolwiek niezamówionego tekstu: napisów na szyldach, „pseudo-liter”, podpisów, znaków wodnych | wygląda amatorsko, a generator robi w nim błędy |
| Tekst | tekstu na przyciskach i panelach | teksty UI są w HTML (§ 7.1) |
| Tekst | błędów pisowni (`WIID`, `SCATER`, `ZLOTY` bez Ł) | jedna literówka przekreśla profesjonalny wygląd |
| Treść | prawdziwych marek kasyn i producentów gier, logotypów, znanych maskotek, prawdziwych osób | prawa autorskie i znaki towarowe; projekt musi być w 100% własny |
| Treść | pieniędzy: banknotów, `$`, `€`, kart płatniczych, żetonów z nominałami | to symulator z wirtualną walutą — jedyna „waluta” na grafikach to cebulion |
| Treść | oka w trójkącie („oko opatrzności”) w S2 | niepotrzebne konotacje; w S2 używamy egipskiego oka Horusa |
| Treść | alkoholu, papierosów, przemocy i seksualizacji postaci | ton marki: elegancko i dla każdego dorosłego gracza |
| Technika | detalu drobniejszego niż 1/100 rozmiaru obrazu | znika w 64 px (§ 4.9) |
| Technika | gęstych pasków, drobnej szachownicy i wzorów moiré w tłach | migoczą przy skalowaniu i męczą wzrok osób wrażliwych na wzory |
| Technika | pasm w gradientach (banding) | widoczne na ciemnych tłach, zwłaszcza po kompresji |

---

## 13. Checklista akceptacji obrazu

### 13.1. Procedura (około 5 minut na obraz)

1. Otwórz plik w przeglądarce kolejno na tle `#07060F`, na jaskrawej magencie `#FF00FF` i na bieli. Magenta
   bezlitośnie ujawnia obwódki i półprzezroczyste śmieci w kanale alfa.
2. Zmniejsz do 64 px (symbole S3: 56 px) i do 25% rozmiaru.
3. Włącz skalę szarości (`filter: grayscale(1)` w DevTools) i symulację daltonizmu (Rendering →
   *Emulate vision deficiencies*).
4. Porównaj z kotwicą stylu (§ 1.4) i z zaakceptowanymi obrazami tej samej grupy, ułożonymi obok siebie.
5. Przejdź listę z § 13.2 i podejmij decyzję z § 13.3.

Pipeline obróbki ([02-lista-obrazow.md](02-lista-obrazow.md)) dodatkowo automatycznie sprawdza kanał alfa,
margines i okno ramki, ale nie zastępuje oceny wzrokiem.

### 13.2. Lista kontrolna

**A. Plik**

- [ ] Nazwa pliku = ID + `.png`, właściwy folder: `global/`, `s1/`, `s2/`, `s3/`, `makiety/`.
- [ ] Format zgodny z listą: 1:1 = 1024×1024, 3:2 = 1536×1024, 2:3 = 1024×1536.
- [ ] Typ tła zgodny z listą: `ALFA` / `CZARNE` / `PELNE` (`SHEET` — właściwa siatka).

**B. Alfa i krawędzie (obrazy ALFA)**

- [ ] Tło naprawdę przezroczyste: brak narysowanej szachownicy i białego tła.
- [ ] Na magencie brak obwódek i półprzezroczystej mgły.
- [ ] Brak cienia na podłożu, podłogi i odbicia pod obiektem.

**C. Kompozycja**

- [ ] Obiekt w całości, margines ≥ 6%, poświata mieści się w marginesie.
- [ ] Wypełnienie kadru zgodne z poziomem symbolu (§ 5.1).
- [ ] `CZARNE`: czysta czerń przy krawędziach (≥ 8%), efekt wygasa przed krawędzią, kolory neutralne (do tintu).
- [ ] Tła: strefy z § 6.2 / § 6.3, ciemny środek, ważne elementy w strefie bezpiecznej (§ 6.4).
- [ ] Tła darmowych spinów: ten sam horyzont, punkt zbiegu i strefy co tło bazowe.
- [ ] `SHEET`: właściwa liczba komórek i kolejność elementów, nic na siebie nie nachodzi.

**D. Styl**

- [ ] Key light z lewej-góry, rim cyjan z prawej (albo wariant danej gry z § 4.2).
- [ ] Złoto mieści się w rampie z § 3.4.
- [ ] High-end stylized 3D: nie fotografia, nie flat, nie styl dziecięcy.
- [ ] Spójność z kotwicą stylu i z wcześniej zaakceptowanymi obrazami tej grupy.

**E. Czytelność (symbole, ikony, awatary)**

- [ ] Testy T1–T5 z § 5.2 zaliczone.
- [ ] Wartość symbolu „czuć” zgodnie z hierarchią (§ 5.1).

**F. Tekst**

- [ ] Na obrazie jest tylko zamówiony tekst, sprawdzony litera po literze.
- [ ] `Ł` poprawne w `ZŁOTY FARAON` i `KRYSZTAŁOWA KASKADA`.
- [ ] Brak znaków wodnych, podpisów i przypadkowych liter.

**G. Wymagania szczególne**

- [ ] Ramka: okno w 100% przezroczyste, prostokątne, o proporcji S1 1:1, S2 5:3, S3 6:5 (tolerancja ±3%);
      bez szyby, przegródek i perspektywy.
- [ ] 9-slice: środek jednolity w poziomie, ornamenty rogów mieszczą się w wycinku rogu.
- [ ] Serie: `g_ui_spin` i `g_ui_spin_stop` identyczne poza ikoną; trzy ujęcia monety to ta sama moneta; trzy
      pozy maskotki to ta sama postać; dyski ikon identyczne.
- [ ] `s3_sym_mnoznik`: środek kuli pusty, jasny i jednolity.
- [ ] `s2_wild_rozszerzony`: kolumna o proporcji ~1:3, boki przezroczyste.

### 13.3. Decyzja

| Wynik | Kiedy | Co dalej |
|---|---|---|
| **Akceptuj** | wszystkie punkty spełnione | plik do folderu, wpis w manifeście ([02](02-lista-obrazow.md)) |
| **Akceptuj z obróbką** | drobiazgi: lekkie przycięcie, czyszczenie alfy, korekta jasności lub barwy ≤ 10%, dodanie marginesu, nieproporcjonalne dopasowanie ramki ≤ 3% | obróbka w pipeline |
| **Popraw** | błąd tekstu, przycięty obiekt, cień lub podłoga, zły kierunek światła, proporcja okna odbiega o > 3%, szachownica | prompt poprawkowy z [03](03-prompty-chatgpt.md) w tym samym czacie |
| **Odrzuć kierunek** | zły styl (fotografia, flat, styl dziecięcy) albo wyraźna niespójność z kotwicą | nowa generacja od zera, w razie potrzeby nowy czat z kotwicą stylu |

Jeśli po trzech poprawkach obraz nadal nie spełnia listy, upraszczamy opis (mniej elementów, jeden motyw
zamiast trzech). Generator lepiej radzi sobie z prostszym zadaniem, a bogactwo i tak dokłada kod.

---

## Załącznik A: indeks identyfikatorów obrazów

Każdy z 93 obrazów i sekcja, która opisuje jego wygląd.

| Czat | ID | Sekcja |
|---|---|---|
| 0 | `m01_lobby_desktop`, `m02_logowanie`, `m03_bonus_powitalny`, `m04_lobby_mobile` | § 1.4 (rola makiet), § 2.3, § 2.6, § 6.5, § 6.8, § 7.4, § 7.6 |
| 0 | `m05_s1_desktop`, `m06_s2_desktop`, `m07_s3_mobile`, `m08_big_win` | § 1.4, § 9, § 10, § 11, § 7.8 |
| 1 | `g_logo` | § 2.3 |
| 1 | `g_emblemat` | § 2.4 |
| 1 | `g_moneta_przod`, `g_moneta_skos`, `g_moneta_bok` | § 2.5 |
| 1 | `g_tlo_lobby_desktop`, `g_tlo_lobby_mobile` | § 6.5 |
| 1 | `g_maskotka_powitanie`, `g_maskotka_wygrana`, `g_maskotka_bankrut` | § 2.7 |
| 1 | `g_skrzynia` | § 2.6 |
| 1 | `g_awatary` | § 7.10 |
| 1 | `g_font_cyfry` | § 7.9 |
| 2 | `g_ui_spin`, `g_ui_spin_stop` | § 7.3 |
| 2 | `g_ui_ikony` | § 7.5 |
| 2 | `g_ui_panel` | § 7.6 |
| 2 | `g_ui_przycisk_glowny`, `g_ui_przycisk_drugi` | § 7.4 |
| 2 | `g_ui_ornament` | § 7.7 |
| 2 | `g_win_big`, `g_win_mega`, `g_win_epic`, `g_win_ultra`, `g_win_free_spins` | § 7.8, § 3.5 |
| 2 | `g_fx_promienie`, `g_fx_flara`, `g_fx_iskry`, `g_fx_blyskawice`, `g_fx_dym`, `g_fx_konfetti` | § 4.8 |
| 3 | `s1_sym_wisnie`, `s1_sym_cytryna`, `s1_sym_sliwka`, `s1_sym_arbuz`, `s1_sym_dzwonek`, `s1_sym_bar`, `s1_sym_siodemka`, `s1_sym_wild` | § 9.4 |
| 3 | `s1_tlo_desktop`, `s1_tlo_mobile` | § 9.5 |
| 3 | `s1_ramka` | § 9.6 |
| 3 | `s1_logo` | § 9.7 |
| 3 | `s1_okladka`, `s1_baner` | § 9.8, § 6.8 |
| 4 | `s2_sym_10`, `s2_sym_j`, `s2_sym_q`, `s2_sym_k`, `s2_sym_a`, `s2_sym_ankh`, `s2_sym_oko`, `s2_sym_skarabeusz`, `s2_sym_anubis`, `s2_sym_faraon`, `s2_sym_wild`, `s2_sym_scatter` | § 10.4 |
| 4 | `s2_wild_rozszerzony` | § 10.5 |
| 4 | `s2_tlo_desktop`, `s2_tlo_mobile` | § 10.6 |
| 4 | `s2_tlo_fs_desktop`, `s2_tlo_fs_mobile` | § 10.7 |
| 4 | `s2_ramka` | § 10.8 |
| 4 | `s2_logo` | § 10.9 |
| 4 | `s2_okladka`, `s2_baner` | § 10.10, § 6.8 |
| 4 | `s2_fx_hieroglify` | § 10.11 |
| 5 | `s3_sym_szafir`, `s3_sym_szmaragd`, `s3_sym_ametyst`, `s3_sym_topaz`, `s3_sym_rubin`, `s3_sym_diament`, `s3_sym_cebula`, `s3_sym_scatter`, `s3_sym_mnoznik` | § 11.4 |
| 5 | `s3_fx_odlamki` | § 11.5 |
| 5 | `s3_tlo_desktop`, `s3_tlo_mobile` | § 11.6 |
| 5 | `s3_tlo_fs_desktop`, `s3_tlo_fs_mobile` | § 11.7 |
| 5 | `s3_ramka` | § 11.8 |
| 5 | `s3_logo` | § 11.9 |
| 5 | `s3_okladka`, `s3_baner` | § 11.10, § 6.8 |

Razem: 8 makiet + 13 (czat 1) + 18 (czat 2) + 14 (S1) + 22 (S2) + 18 (S3) = **93 obrazy**.

---

## Powiązane dokumenty

* [README.md](README.md) — spis treści dokumentacji projektu i sposób korzystania z niej.
* [02-lista-obrazow.md](02-lista-obrazow.md) — manifest 93 obrazów, sposób dostarczenia, pipeline obróbki
  (przycinanie, alfa, @1x/@2x, WebP/AVIF, atlasy).
* [03-prompty-chatgpt.md](03-prompty-chatgpt.md) — gotowe prompty dla czatów 0–5 zbudowane na zasadach z tego dokumentu.
* [04-efekty-wizualne.md](04-efekty-wizualne.md) — osie czasu efektów dla zdarzeń E01–E73 (błyski, cząsteczki, promienie).
* [05-dzwiek-i-muzyka.md](05-dzwiek-i-muzyka.md) — dźwięki i muzyka zsynchronizowane z obrazem.
* [06-interfejs-ux.md](06-interfejs-ux.md) — ekrany, komponenty, stany, breakpointy, dostępność.
* [07-gry-i-matematyka.md](07-gry-i-matematyka.md) — siatki, linie, tabele wypłat i funkcje trzech automatów.
* [08-wydajnosc-i-jakosc.md](08-wydajnosc-i-jakosc.md) — architektura renderu, poziomy jakości, budżety.
* [../plan-projektu.md](../plan-projektu.md) — wcześniejszy plan całego projektu. Tam, gdzie się różni (np. grafika
  z Blendera zamiast z ChatGPT), obowiązuje obecna dokumentacja w `docs/projekt/`.
