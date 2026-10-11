# 03 — Prompty dla ChatGPT (93 obrazy: makiety, UI, symbole, tła, efekty)

> Ten dokument to **gotowa instrukcja i gotowe prompty**, którymi właściciel projektu wygeneruje w ChatGPT wszystkie
> 93 obrazy Cebulion Casino: 8 makiet i 85 assetów (cały interfejs, symbole, tła, ramki, napisy wygranych i efekty).
> Najpierw przeczytaj § 1 (po polsku: jak prowadzić czaty, jak pobierać i nazywać pliki), potem otwieraj kolejne
> czaty z § 3–8 i wklejaj **jeden blok na czat**. Gdy obraz wyjdzie źle, skorzystaj z gotowych poprawek z § 9.

| Metryka | |
|---|---|
| Projekt | Cebulion Casino, symulator kasyna z wirtualną walutą (przedmiot „Wprowadzenie do technologii backendowych”, Uniwersytet WSB Merito Wrocław) |
| Zespół | Konrad Paulus (112960, s428425@student.wroclaw.merito.pl) · Dominik Pacanowski (112961, s433776@student.wroclaw.merito.pl) · Dawid Majewski (113154, s156704@student.wroclaw.merito.pl) |
| Wersja dokumentu | 1.0 (2026-10-11) |
| Zakres | 6 czatów ChatGPT: 8 + 13 + 18 + 14 + 22 + 18 = **93 obrazy** (manifest: [02-lista-obrazow.md](02-lista-obrazow.md)) |
| Hierarchia źródeł | brief projektu → [01-kierunek-artystyczny.md](01-kierunek-artystyczny.md) (styl) → ten dokument (prompty). Prompty są „skompilowane” z 01; przy rozbieżności poprawiamy prompt, nie styl. |
| Język | instrukcje po polsku, prompty po angielsku (generator rozumie je precyzyjniej), teksty na obrazach podane dokładnie, polskie znaki literowane |

## Spis treści

1. [Instrukcja dla właściciela (przeczytaj najpierw)](#1-instrukcja-dla-właściciela-przeczytaj-najpierw)
2. [Anatomia bloku promptu](#2-anatomia-bloku-promptu)
3. [Czat 0: makiety (8 obrazów)](#3-czat-0-makiety-8-obrazów)
4. [Czat 1: GLOBAL A — marka, moneta, maskotka, tła lobby (13 obrazów)](#4-czat-1-global-a--marka-moneta-maskotka-tła-lobby-13-obrazów)
5. [Czat 2: GLOBAL B — UI kit, napisy wygranych, efekty (18 obrazów)](#5-czat-2-global-b--ui-kit-napisy-wygranych-efekty-18-obrazów)
6. [Czat 3: S1 „Cebulowy 777” (14 obrazów)](#6-czat-3-s1-cebulowy-777-14-obrazów)
7. [Czat 4: S2 „Złoty Faraon” (22 obrazy)](#7-czat-4-s2-złoty-faraon-22-obrazy)
8. [Czat 5: S3 „Kryształowa Kaskada” (18 obrazów)](#8-czat-5-s3-kryształowa-kaskada-18-obrazów)
9. [Biblioteka promptów poprawkowych](#9-biblioteka-promptów-poprawkowych)
10. [Plan B: gdy przezroczystość nie działa](#10-plan-b-gdy-przezroczystość-nie-działa)
11. [Kontrola jakości przed wysłaniem i wysyłka](#11-kontrola-jakości-przed-wysłaniem-i-wysyłka)
12. [Otwarte kwestie i ryzyka](#12-otwarte-kwestie-i-ryzyka)
- [Powiązane dokumenty](#powiązane-dokumenty)

---

## 1. Instrukcja dla właściciela (przeczytaj najpierw)

### 1.1. Co przygotować

| Co | Po co |
|---|---|
| Konto ChatGPT z generowaniem obrazów, **przeglądarka na komputerze** | na komputerze pobierzesz oryginalny PNG z przezroczystością (aplikacja na telefonie potrafi zamienić PNG na JPEG — [02 § 4.3](02-lista-obrazow.md#43-jak-pobrać-oryginał-z-chatgpt)) |
| Folder roboczy z podfolderami `makiety/`, `global/`, `s1/`, `s2/`, `s3/` | tu od razu zapisujesz pliki pod właściwymi nazwami (struktura jak w [02 § 4.2](02-lista-obrazow.md#42-foldery-i-nazwy)) |
| Ten dokument otwarty na GitHubie | każdy blok promptu ma w prawym górnym rogu **ikonę kopiowania** — jedno kliknięcie kopiuje cały blok |
| Około 1–2 godziny na czat (czat 4: 2–3 godziny) | nie musisz robić czatu za jednym posiedzeniem — do czatu można wrócić (§ 1.7) |

**Nie używaj czatu tymczasowego** (trybu bez historii). Do każdego czatu będziesz wracać, a czat tymczasowy znika.
Dobrze jest od razu nazwać czat na liście po lewej, np. „Cebulion — czat 3 S1”.

### 1.2. Sześć czatów w kolejności

Każdy czat to **osobna rozmowa** w ChatGPT. Czaty robimy po kolei, bo późniejsze korzystają z obrazów
zaakceptowanych we wcześniejszych (kotwice stylu, [01 § 1.4](01-kierunek-artystyczny.md#14-kolejność-pracy-i-kotwice-stylu)).

| Czat | Zakres | Obrazów | Priorytet | Załącz na początku (referencje) | Sekcja |
|---|---|---:|---|---|---|
| 0 | Makiety ekranów `m01`–`m08` (nie trafiają do aplikacji) | 8 | — | nic | [§ 3](#3-czat-0-makiety-8-obrazów) |
| 1 | GLOBAL A: moneta, emblemat, logo, skrzynia, maskotka, cyfry, awatary, tła lobby | 13 | 10 × P0, 3 × P1 | `m05_s1_desktop` + 1–2 inne najlepsze makiety (polecamy `m01_lobby_desktop`, `m03_bonus_powitalny`) | [§ 4](#4-czat-1-global-a--marka-moneta-maskotka-tła-lobby-13-obrazów) |
| 2 | GLOBAL B: przycisk SPIN, ikony, panel, przyciski, ornament, napisy wygranych, efekty | 18 | 10 × P0, 8 × P1 | `m05_s1_desktop`, `m08_big_win`, `g_moneta_przod`, `g_font_cyfry` | [§ 5](#5-czat-2-global-b--ui-kit-napisy-wygranych-efekty-18-obrazów) |
| 3 | S1 „Cebulowy 777” | 14 | P0 | `m05_s1_desktop`, `g_moneta_przod`, `g_ui_spin` | [§ 6](#6-czat-3-s1-cebulowy-777-14-obrazów) |
| 4 | S2 „Złoty Faraon” | 22 | P1 | `m05_s1_desktop`, `m06_s2_desktop`, `g_moneta_przod`, `g_ui_spin` | [§ 7](#7-czat-4-s2-złoty-faraon-22-obrazy) |
| 5 | S3 „Kryształowa Kaskada” | 18 | P2 | `m05_s1_desktop`, `m07_s3_mobile`, `g_moneta_przod`, `g_ui_spin` | [§ 8](#8-czat-5-s3-kryształowa-kaskada-18-obrazów) |
| | **Razem** | **93** | 34 × P0, 33 × P1, 18 × P2 | | |

**Szybka ścieżka do pierwszej grywalnej wersji (34 obrazy P0).** Jeśli liczy się czas, po czacie 0 zrób w czatach
1 i 2 tylko obrazy P0 (pomijaj P1 komendą `IDŹ DO:`), potem cały czat 3. Obrazy P1 dorobisz później w tych samych
czatach. Kolejność dostaw: [02 § 4.7](02-lista-obrazow.md#47-kolejność-dostaw).

### 1.3. Jak prowadzić czat — krok po kroku

1. **Otwórz nowy czat** w ChatGPT (zwykły, nie tymczasowy).
2. **Czaty 1–5: załącz referencje** z tabeli w § 1.2 — przeciągnij pliki PNG do pola wiadomości (ChatGPT przyjmuje
   kilka obrazów w jednej wiadomości). Czat 0 bez załączników.
3. **Skopiuj cały blok** danego czatu (ikona kopiowania w prawym górnym rogu bloku) i wklej go do tej samej
   wiadomości, pod załącznikami. Wyślij.
4. ChatGPT od razu generuje **obraz nr 01** i nad nim pisze jedną linię: `ID: … | proporcja | typ tła`.
5. **Sprawdź obraz** z checklistą pod blokiem danego czatu (1–3 minuty).
6. **Dobry?** Pobierz oryginał (§ 1.8), nazwij `ID.png`, napisz `DALEJ`. **Zły?** Napisz `POPRAW: …`
   (gotowe teksty poprawek w § 9; możesz też opisać problem własnymi słowami, nawet po polsku).
7. Powtarzaj do końca listy. Po ostatnim obrazie ChatGPT napisze `KONIEC CZATU`.

Zasada: **jeden obraz na odpowiedź**. Jeśli ChatGPT narysuje kilka obiektów naraz, kolaż albo zacznie zadawać
pytania zamiast rysować — użyj poprawki P22 z § 9.

### 1.4. Komendy

Komendy są zdefiniowane w każdym bloku, więc ChatGPT je rozumie. Pisz je wielkimi literami, jako całą wiadomość.

| Komenda | Co robi | Kiedy |
|---|---|---|
| `DALEJ` | obraz zaakceptowany → ChatGPT generuje następne ID z listy | po pobraniu dobrego obrazu |
| `POPRAW: <uwagi>` | ten sam ID jeszcze raz; zostaje to, co dobre, poprawiane jest tylko to, co opiszesz | literówka, przycięcie, zła poświata, za ciemne… (§ 9) |
| `NOWA WERSJA` | ten sam ID od zera, świeże ujęcie tego samego opisu | gdy dwie–trzy poprawki nie pomagają albo kierunek jest zły |
| `IDŹ DO: <ID>` | przeskok do wskazanego ID | powrót po przerwie, pominięcie obrazów P1, powtórka starszego ID |
| `ZASADY` | ChatGPT ponownie czyta całą pierwszą wiadomość (wszystkie zasady) | gdy zaczyna „zapominać” reguły: pojawia się tekst, cień, szachownica, zły format |
| `STATUS` | tylko tekst: które ID są zrobione, które zostały | gdy nie pamiętasz, gdzie skończyłeś |

### 1.5. Referencje stylu: makiety i kotwice

**Po czacie 0** obejrzyj z zespołem 8 makiet i wybierz najlepsze. Makiety nie trafiają do aplikacji (literówki
na nich są dopuszczalne), ale ustalają nastrój, kontrast i „temperaturę” całości. Od czatu 1 **załączasz je jako
referencję stylu** na początku każdego czatu, razem z kotwicami powstałymi w kolejnych czatach:

| Referencja | Od czatu | Co utrwala |
|---|---|---|
| `m05_s1_desktop` (albo najlepsza makieta ekranu gry, jeśli ta wyszła słabo) | 1 | skalę kontrastu, gęstość detalu, ogólną jakość renderu |
| makieta pasująca do czatu: `m01`/`m03` (czat 1), `m08` (czat 2), `m06` (czat 4), `m07` (czat 5) | 1 | nastrój danego zakresu |
| `g_moneta_przod` (z czatu 1) | 2 | barwę i połysk „naszego złota”, kierunek światła |
| `g_font_cyfry` (z czatu 1) | 2 | krój, faza i kontur złotych liter — napisy `g_win_*` muszą do nich pasować |
| `g_ui_spin` (z czatu 2) | 3 | połączenie złota ze szkłem, poziom detalu UI |

**Dlaczego załączamy obrazy, a nie tylko tekst:** ChatGPT pamięta wyłącznie bieżący czat. Obraz referencyjny
przenosi „nasze złoto” i nasze światło między czatami dokładniej niż jakikolwiek opis.

**Plan B (przeciek referencji):** jeśli cechy referencji zaczynają przeciekać do wyników (np. symbole Egiptu dostają
neonowy róż z makiety S1), napisz `POPRAW:` z poprawką P6 z § 9, a jeśli to nie pomoże — zacznij czat od nowa
bez makiety S1, z samymi kotwicami (`g_moneta_przod`, `g_ui_spin`) i makietą danej gry.

### 1.6. Warianty przez edycję poprzedniego obrazu

Część obrazów to **warianty** obrazu już zaakceptowanego. W bloku takie pozycje są oznaczone słowem `EDIT` i nazwą
obrazu źródłowego — ChatGPT bierze go z tego samego czatu jako podstawę i zmienia tylko wskazane rzeczy. Dzięki
temu moneta z trzech ujęć jest tą samą monetą, a przycisk STOP — tym samym przyciskiem.

| Wariant | Powstaje z | Co się zmienia | Co MUSI zostać identyczne |
|---|---|---|---|
| `g_moneta_skos`, `g_moneta_bok` | `g_moneta_przod` | obrót o ~45° / ~80–85° | relief, barwa złota, światło, wysokość monety, środek kadru |
| `g_maskotka_wygrana`, `g_maskotka_bankrut` | `g_maskotka_powitanie` | poza, mimika, rekwizyty | postać, proporcje, strój, kolory, monokl na prawym oku postaci, wąsy, 7 żeber |
| `g_tlo_lobby_mobile` | `g_tlo_lobby_desktop` | kompozycja pionowa 2:3 (przekomponowanie, nie rozciąganie) | wnętrze, materiały, światło, kolory |
| `g_ui_spin_stop` | `g_ui_spin` | **tylko ikona** (kwadrat zamiast strzałek) | pierścień, kopuła, refleks, rozmiar i położenie w kadrze |
| `g_ui_przycisk_drugi` | `g_ui_przycisk_glowny` | materiał: szkło zamiast złota | kształt, rozmiar, położenie |
| `g_win_mega`, `g_win_epic`, `g_win_ultra`, `g_win_free_spins` | `g_win_big` | tekst i dekoracja poziomu | krój liter, ekstruzja, kontur, łuk, wielkość bloku w kadrze |
| `s1_tlo_mobile`, `s2_tlo_mobile`, `s3_tlo_mobile` | tło desktop tej samej gry | kompozycja pionowa 2:3 | scena, światło, kolory |
| `s2_tlo_fs_desktop`, `s3_tlo_fs_desktop` | tło bazowe desktop tej samej gry | scena i nastrój darmowych spinów | **linia horyzontu, punkt zbiegu, ciemna strefa bębnów** ([01 § 6.7](01-kierunek-artystyczny.md#67-tła-darmowych-spinów-s2-s3)) |
| `s2_tlo_fs_mobile`, `s3_tlo_fs_mobile` | układ z tła mobile + scena z tła FS desktop | — | jak wyżej |
| `s2_wild_rozszerzony` | `s2_sym_wild` | pionowa kolumna 1:3 | projekt relikwii i napisu `WILD` |
| okładki i banery gier | logo i WILD z tego samego czatu | scena plakatowa | litery logo, wygląd bohatera |

**Jeśli ChatGPT „nie widzi” obrazu źródłowego** (np. wróciłeś po kilku dniach, czat był bardzo długi albo zacząłeś
nowy czat): załącz plik źródłowy PNG do wiadomości i napisz `IDŹ DO: <ID>` — w bloku jest instrukcja, że załączony
obraz jest bazą dla pozycji `EDIT`. Edycja czasem zmienia rozdzielczość albo proporcję — po każdej edycji sprawdź
wymiary (§ 1.8).

### 1.7. Limity generowania i przerwy

ChatGPT ogranicza liczbę obrazów w określonym czasie. Limity zależą od planu i zmieniają się, więc **nie zakładamy
konkretnych liczb**. Gdy pojawi się komunikat o limicie:

1. **Nie zakładaj nowego czatu.** Zapamiętaj ID, na którym skończyłeś (albo napisz później `STATUS`).
2. Odczekaj czas podany w komunikacie.
3. Wróć do **tego samego czatu** i napisz `DALEJ` (albo `IDŹ DO: <ID>`, jeśli nie masz pewności).
4. Jeśli po długiej przerwie ChatGPT przestaje trzymać się reguł, napisz `ZASADY`.

**Kiedy jednak nowy czat:** gdy czat zrobił się bardzo długi (np. ponad 40 generacji) i mimo `ZASADY` styl się
rozjeżdża. Wtedy otwórz nowy czat, załącz te same referencje **plus** 2–3 zaakceptowane obrazy z tego czatu,
wklej ten sam blok i **na samym końcu tej samej wiadomości**, pod blokiem, dopisz linię `IDŹ DO: <ID>` — ChatGPT
zacznie od wskazanego obrazu zamiast od nr 01. Pozycje `EDIT` w nowym czacie potrzebują obrazu źródłowego
w załączniku (§ 1.6).

### 1.8. Pobieranie i nazywanie plików

Szczegóły (z uzasadnieniem, czego nie robić) są w [02 § 4.3](02-lista-obrazow.md#43-jak-pobrać-oryginał-z-chatgpt).
W skrócie:

1. **Pobierz oryginał** w przeglądarce na komputerze: kliknij obraz → ikona pobierania (strzałka w dół).
   Nie zrzut ekranu, nie „Kopiuj obraz”, nie zapis miniatury.
2. **Sprawdź**: rozszerzenie `.png`, rozmiar zwykle 1–3,5 MB, wymiary **dokładnie** 1024×1024 (1:1),
   1536×1024 (3:2) albo 1024×1536 (2:3) — Windows: *Właściwości → Szczegóły*, macOS: *Podgląd → Narzędzia →
   Pokaż inspektora*.
3. **Nazwij** plik dokładnie jak ID + `.png`: małe litery, podkreślniki, bez spacji i polskich znaków, np.
   `s2_sym_anubis.png`, `g_ui_spin_stop.png`.
4. **Włóż** do folderu: `makiety/` (m01–m08), `global/` (wszystkie `g_*`), `s1/`, `s2/`, `s3/`.
5. Nowa wersja obrazu, który już wysłałeś: `<ID>.v2.png` ([02 § 2.7](02-lista-obrazow.md#27-nazwy-plików)).
6. Nie zdążyłeś nazwać? Trudno — wrzuć do `nieposortowane/`, rozpoznamy pliki ([02 § 4.6](02-lista-obrazow.md#46-co-gdy-nazwy-się-pomieszają)).
   Kolejność generowania w czacie odpowiada numeracji w bloku, co ułatwia dopasowanie.

### 1.9. Ile to potrwa — szacunek generacji

Szacunek uwzględnia poprawki. Mnożnik to średnia liczba generacji na jeden zaakceptowany obraz; największy tam,
gdzie jest tekst na obrazie, postać, ramka z oknem albo arkusz.

| Czat | Obrazów | Najtrudniejsze | Mnożnik | Generacji (szacunek) | Czas (generacja ~1–2 min + ocena ~2–3 min) |
|---|---:|---|---:|---:|---|
| 0 | 8 | dużo tekstu UI (literówki dopuszczalne), wybór kierunku | 2,0 | ~16 (12–24) | ~1,5 h |
| 1 | 13 | logo z napisem, spójność 3 ujęć monety i 3 póz maskotki, arkusz cyfr | 2,2 | ~29 (22–38) | ~2,5 h |
| 2 | 18 | napisy WIN, 9-slice, arkusze ikon i iskier | 1,8 | ~32 (25–42) | ~2,5 h |
| 3 | 14 | ramka z oknem 3×3, logo, napisy `WILD`/`BAR` | 1,8 | ~25 (20–34) | ~2 h |
| 4 | 22 | litera Ł w logo, ramka 5×3, spójność 5 liter, tła FS | 1,7 | ~37 (30–48) | ~3 h |
| 5 | 18 | litera Ł w logo, ramka 6×5, czytelność klejnotów w 56 px | 1,8 | ~32 (26–42) | ~2,5 h |
| **Razem** | **93** | | ~1,8 | **~171 (135–228)** | **~14 h** w kilku posiedzeniach |

Jeśli po **trzech** poprawkach obraz dalej nie spełnia checklisty, uprość opis (jeden motyw zamiast trzech) —
poprawka P5 z § 9. Generator lepiej radzi sobie z prostszym zadaniem, a bogactwo i tak dokłada kod (efekty,
poświaty, cząsteczki: [04-efekty-wizualne.md](04-efekty-wizualne.md)).

### 1.10. Dlaczego tak — argumenty na obronę

| Decyzja | Dlaczego |
|---|---|
| 6 osobnych czatów | generator pamięta tylko bieżący czat; krótszy czat o jednym temacie (np. tylko Egipt) mniej „dryfuje”, a kolejność makiety → marka → UI → gry sprawia, że kotwice stylu istnieją, zanim będą potrzebne |
| jeden blok = cały czat | wszystkie zasady i lista obrazów trafiają do kontekstu raz, na początku; dalej wystarczą krótkie komendy, więc nie ma ryzyka, że w kolejnej wiadomości zapomnisz o jakiejś regule |
| prompty po angielsku | modele generujące obrazy precyzyjniej rozumieją angielskie terminy renderu i materiałów (*rim light*, *satin brushed gold*); tekst do umieszczenia na obrazie podajemy dosłownie |
| polskie znaki literowane („Ł = L with stroke”) | generatory najczęściej psują właśnie diakrytyki; jawny opis kształtu litery zmniejsza ryzyko `ZLOTY` zamiast `ZŁOTY` |
| jeden obraz na odpowiedź, ID nad obrazem | pełna kontrola jakości każdego pliku i bezbłędne nazwy; kolaż kilku obiektów trzeba by ciąć ręcznie, a każdy wyszedłby w niższej rozdzielczości |
| rygorystyczne zasady tła (ALFA, CZARNE, SHEET, 9-slice, okno ramki) | pliki obrabia automatyczny pipeline ([02 § 5](02-lista-obrazow.md#5-pipeline-obróbki-toolsartprzetworzpy)); powtarzalne zasady = przewidywalne cięcie, przezroczystość i dopasowanie ramek bez ręcznej pracy |
| efekty świetlne na czystej czerni | rysujemy je w trybie mieszania `add`, w którym czerń znika, a miękka poświata zostaje ([01 § 4.8](01-kierunek-artystyczny.md#48-obrazy-efektów-tło-czarne-i-konfetti)) |
| przyciski i panele bez tekstu | teksty UI są w HTML: ostre w każdej skali i dostępne dla czytników ekranu ([01 § 7.1](01-kierunek-artystyczny.md#71-zasada-materiał-z-obrazu-tekst-z-html-stan-z-kodu)) |
| w promptach **nie** wymieniamy żadnych studiów, gier, marek ani postaci | projekt musi być w 100% własny (prawa autorskie i znaki towarowe); poziom jakości opisujemy ogólnie („top mobile slot games”), a nie przez nazwę konkretnej firmy |
| w promptach nie ma danych osobowych zespołu | generatorowi nie są potrzebne; minimalizujemy dane wysyłane do zewnętrznej usługi (zasada minimalizacji z RODO) |

---

## 2. Anatomia bloku promptu

Każdy blok czatu ma ten sam szkielet. Warto go znać, żeby świadomie poprawiać obrazy i bronić projektu.

| Część bloku | Zawartość | Źródło w 01 |
|---|---|---|
| `ROLE` | ChatGPT działa jako art director studia AAA tworzącego sloty mobilne: precyzyjny, spójny, bez improwizacji | — |
| `PROJECT` | czym jest Cebulion Casino, maskotka, trzy gry; że obrazy to osobne assety, a ruch, cienie i tekst UI dodaje kod | § 1.2 |
| `THIS CHAT` | numer czatu, zakres, liczba obrazów | Załącznik A |
| `STYLE DNA` | kanoniczny akapit stylu, zawsze ten sam | § 4.10 |
| `PALETTE` | tokeny hex + rampa złota + proporcje (70% ciemne, 20% złoto, ≤ 10% neon) | § 3 |
| `LIGHTING` / `CAMERA` | key z lewej-góry, fill lawendowy, rim cyjan z prawej, rim magenta z lewej-dołu; modyfikacje gry | § 4.2–4.3, § 9–11 |
| `MATERIALS` | frazy materiałów (złoto polerowane i satynowe, szkło, emalia…) | § 4.4 |
| `TECHNICAL RULES` | zasady dla typów tła użytych w czacie: `ALFA`, `CZARNE`, `PELNE`, `SHEET`, `9-SLICE`, `FRAME` | § 4.5–4.9, § 7 |
| `TEXT ON IMAGES` | tekst wyłącznie tam, gdzie pozycja podaje `EXACT TEXT`; polskie znaki literowane | § 5.6, § 8.7 |
| `ORIGINALITY / FORBIDDEN` | zakaz naśladowania firm, marek, postaci; zakaz pieniędzy, alkoholu, stylu dziecięcego, znaków wodnych | § 12 |
| `REFERENCE IMAGES` | jak traktować załączone makiety i kotwice | § 1.4 |
| `WORKFLOW PROTOCOL` | kolejność, jeden obraz na odpowiedź, linia ID nad obrazem, komendy | — |
| `IMAGE LIST` | ponumerowane pozycje: ID, proporcja, typ tła, dokładny tekst, a potem temat, kompozycja, materiały, światło, kolory, nastrój | § 2, § 5–11 |

Słowniczek typów tła używanych w blokach (z briefu):

| Typ | Co dostajemy | Gdzie |
|---|---|---|
| `ALFA` | prawdziwie przezroczyste tło, obiekt wyśrodkowany, 80–85% kadru, margines ≥ 6%, bez cienia | symbole, logo, UI, maskotka, ramki |
| `CZARNE` | jednolite `#000000`, poświata gaśnie do czerni przed krawędzią | efekty świetlne (tryb `add`) |
| `PELNE` | obraz od krawędzi do krawędzi, bez tekstu i UI (wyjątki: makiety, okładki z logo) | tła, okładki, banery, makiety |
| `SHEET` | arkusz: dokładna siatka, równe komórki, bez nachodzenia | ikony, cyfry, awatary, iskry, konfetti, odłamki, hieroglify |
| `9-SLICE` | element rozciągany: ozdoby tylko w rogach, środek jednolity | panel, przyciski-pigułki |
| `FRAME` | ramka bębnów: w środku w pełni przezroczyste prostokątne okno | `s1_ramka`, `s2_ramka`, `s3_ramka` |

---

## 3. Czat 0: makiety (8 obrazów)

**Cel:** zobaczyć całe ekrany (lobby, logowanie, bonus, trzy gry, big win), zanim powstanie pierwszy asset.
Makiety **nie trafiają do aplikacji** — służą do zatwierdzenia kierunku przez zespół i jako referencja stylu
w czatach 1–5. Literówki na makietach są dopuszczalne; liczą się nastrój, kontrast, układ i jakość renderu.

**Załączniki:** brak. **Po czacie:** wybierz z zespołem najlepsze makiety (§ 1.5). Jeśli żadna makieta ekranu gry nie
jest dobra, popraw `m05_s1_desktop` (`IDŹ DO: m05_s1_desktop`, potem `POPRAW: …`) — to kotwica stylu dla wszystkich
kolejnych czatów.

| # | ID | Format | Tło | Najważniejsze teksty na obrazie |
|---|---|---|---|---|
| 01 | `m01_lobby_desktop` | 3:2 | PELNE | „CEBULION CASINO”, „Zaloguj”, „Wybierz grę”, nazwy 3 gier |
| 02 | `m02_logowanie` | 3:2 | PELNE | „Witaj w Cebulion Casino”, „Nazwa gracza”, „Wejdź do kasyna” |
| 03 | `m03_bonus_powitalny` | 3:2 | PELNE | „+10 000”, „Bonus powitalny”, „Saldo”, „Odbierz” |
| 04 | `m04_lobby_mobile` | 2:3 | PELNE | „Saldo”, „Graj”, „Wybierz grę”, nazwy 3 gier |
| 05 | `m05_s1_desktop` | 3:2 | PELNE | „CEBULOWY 777”, „Saldo”, „Zakład”, „Wygrana”, „SPIN” |
| 06 | `m06_s2_desktop` | 3:2 | PELNE | „ZŁOTY FARAON”, „Saldo”, „Zakład”, „Wygrana”, „SPIN” |
| 07 | `m07_s3_mobile` | 2:3 | PELNE | „KRYSZTAŁOWA KASKADA”, „Saldo”, „Zakład”, „Wygrana”, „SPIN” |
| 08 | `m08_big_win` | 3:2 | PELNE | „MEGA WIN”, „12 400” |

### 3.1. Blok do wklejenia — czat 0

```text
ROLE
You are the lead art director and a senior UI/3D artist of a AAA mobile slot game studio. You create
polished, high-fidelity screen mockups with your image generation tool. You follow specifications
exactly, keep one consistent style across the whole set and never improvise extra elements.

PROJECT
"Cebulion Casino" is a casino SIMULATOR built by three university students as a course project: a web
game (desktop browser and phone) with a fictional currency only - the golden "cebulion" coin. No real
money, no prizes, no deposits. Brand idea: a premium, dark luxury casino with a wink - the humble onion
("cebula" in Polish) treated as royal luxury. Brand mark: a golden onion wearing a crown on a round navy
enamel medallion. Mascot: "Pan Cebulion" - an elegant plump golden onion gentleman with a black-violet
silk top hat, a gold monocle, a magenta bow tie, a white wing collar, cream gloves and a curled golden
moustache made of onion roots; charismatic host, never childish. Login: the player types a name in the
top-right corner and is logged in at once; first login gives 10 000 cebulions. Three slot games:
"Cebulowy 777" (3x3 retro Las Vegas neon, chrome and synthwave), "Złoty Faraon" (5x3 ancient Egyptian
treasure vault), "Kryształowa Kaskada" (6x5 cluster game in a magical crystal cave). The user interface
is in Polish.

THIS CHAT: Chat 0 of 6 - SCREEN MOCKUPS - 8 images. They are style and layout references for the whole
project (they will not be used inside the game), so overall quality, mood and layout matter most.

STYLE DNA (Cebulion Casino): premium dark luxury casino, high-end stylized 3D render in the quality of
top mobile slot games. Warm yellow mirror-polished gold (not copper, not rose gold, not lemon), satin
brushed gold, dark smoked glass, deep navy-violet blacks (#07060F, #120B2A, #1E1442), small accents of
neon magenta (#FF2E88) and cyan (#21E6FF). Cinematic studio lighting: warm key light from the upper
left, soft lavender fill from the right, thin cool cyan rim light on the right edges, subtle magenta
rim on the lower left. Clean bevels, bold readable silhouette, rich but controlled detail, subtle
tight glow. Not photorealistic, not flat vector, not a cartoon for kids, no anime.

PALETTE (hex)
- Darks about 70% of every screen: #07060F (deepest), #120B2A (panels), #1E1442 (glass).
- Gold about 20%, always this ramp: #FFF6D6 (tiny highlight core), #FFE08A (light), #F5C542 (base),
  #B8860B (half shadow), #5C3A00 (shadow), #2B1A00 (darkest reflection). Warm yellow gold only.
- Neon accents max 10%: magenta #FF2E88, cyan #21E6FF (bigger neon areas allowed only in Cebulowy 777).
- UI text colours: white #FFFFFF, lavender grey #C9C3E6, gold #FFE08A; dark text #07060F on gold buttons.
- Green #3DFF8F only for a positive balance change, red #FF4D4D only for errors - never as big areas.

UI DESIGN LANGUAGE
- Materials: panels and bars of dark smoked glass (#1E1442 to #120B2A) with thin polished gold borders;
  modal windows with ornate gold filigree corners and straight gold edges.
- Main action button: glossy gold pill (gradient #FFE08A top to #B8860B bottom) with DARK text #07060F.
  Secondary button: dark glass pill with a thin gold border and light text.
- Round icon buttons: dark glass disc, thin gold rim, simple bold gold glyph.
- SPIN button: large circle, polished gold knurled ring, dark smoked glass dome, glowing gold
  circular-arrow icon.
- Typography: headings in classical Roman capitals like the Cinzel typeface, in gold; interface text in
  a clean modern geometric sans-serif like Manrope, in white or lavender; numbers bold, gold, with a
  space as the thousands separator ("10 000"). Game logos: Cebulowy 777 = bold rounded retro sign
  letters like Bungee; Złoty Faraon = ornate Roman capitals like Cinzel Decorative; Kryształowa Kaskada
  = elegant flared serif capitals like Marcellus.
- Generous spacing, clear hierarchy, nothing cramped. Minimum touch targets look finger-friendly.

TECHNICAL RULES FOR THIS CHAT
[PELNE / MOCKUP] = complete full-bleed screen design
- Each image is ONE finished screen of the game, flat, front-facing and full-bleed (edge to edge).
- No device frame, no phone body, no browser tabs or address bar, no hands, no desk, no perspective tilt,
  no rounded outer corners, no borders around the picture.
- 3:2 images are desktop web pages (landscape). 2:3 images are ONLY the portrait screen content of a phone.
- Backgrounds have a darker, calmer centre where the main content sits; light sources and the richest
  detail are at the sides and top corners. Vignette in the corners.
- No people other than the mascot. No real logos, no readable signs.

TEXT ON IMAGES
- Render ONLY the strings listed under EXACT TEXT for each image, letter by letter, with the exact
  upper/lower case shown. Everything else that would normally be text (small labels, paragraphs, menu
  items) must NOT be rendered as letters - use simple blank shapes or icons instead. No lorem ipsum, no
  fake letters, no extra slogans.
- Polish letters are spelled out for you; draw them exactly:
  Ł / ł = L with stroke (a short diagonal bar through the vertical stem of the L);
  ą = a with ogonek (a small hook under the right side of the a); ę = e with ogonek;
  ó = o with an acute accent; ź = z with an acute accent (a small slanted stroke above the z).
  Never replace them with plain letters.

ORIGINALITY / FORBIDDEN
- Do not imitate or reference any real casino, slot game, game studio, brand, logo, trademark, mascot,
  cartoon character, celebrity or copyrighted character. Everything must be 100% original.
- No real money: no banknotes, no $ EUR or other currency signs, no credit cards, no chips with values.
  The only currency anywhere is the golden cebulion coin (gold coin with an embossed crowned onion, no
  numbers or letters on it).
- No alcohol, no cigarettes, no violence, no sexualised characters, no kawaii/chibi/children's style, no
  anime, no flat vector clip-art, no photorealism, no pixel art, no watercolour.
- No watermark, no signature, no artist name, no UI of real apps or operating systems.

WORKFLOW PROTOCOL (very important)
1. Generate the images strictly in the numbered order of the IMAGE LIST, exactly ONE image per reply.
   Never put two IDs in one image, never make a collage, a contact sheet, variations or options.
2. In every reply write one short line ABOVE the image:  ID: <id> | <aspect> | <background>
   and nothing else - no explanations, no questions.
3. Use exactly the aspect ratio given for the item: 1:1 = 1024x1024, 3:2 = 1536x1024 landscape,
   2:3 = 1024x1536 portrait. Never change it.
4. After each image STOP and wait for my command (commands are in Polish):
   DALEJ            = accepted; generate the next ID from the list.
   POPRAW: <notes>  = regenerate the SAME ID; keep everything that was right, fix only what I describe.
   NOWA WERSJA      = regenerate the SAME ID from scratch with a fresh take on the same brief.
   IDŹ DO: <id>     = jump to that ID (I use it when I come back later or want to redo an item).
   ZASADY           = re-read this whole first message (all rules) and apply it to the next image.
   STATUS           = reply with text only: which IDs are done and which remain. No image.
5. After the last item write only: KONIEC CZATU.

IMAGE LIST

--------------------------------------------------------------------
01/08  ID: m01_lobby_desktop
ASPECT: 3:2 landscape (1536x1024) | BACKGROUND: PELNE (full-bleed screen mockup)
EXACT TEXT (render exactly these, nothing else readable):
  - top bar, left: "CEBULION CASINO"
  - top bar, far right, on a gold pill button: "Zaloguj"
  - big hero logo in the upper half: "CEBULION" (large) above "CASINO" (smaller, wide letter spacing)
  - tagline under the hero logo: "Graj bez ryzyka. Wygrywaj z klasą."
    (last word k-l-a-s-ą, where ą = a with ogonek)
  - heading above the tiles: "Wybierz grę"   (g-r-ę, where ę = e with ogonek)
  - captions under the three tiles: "Cebulowy 777", "Złoty Faraon", "Kryształowa Kaskada"
    (Ł and ł = L with stroke)
SUBJECT: the home page (lobby) on a desktop browser, visitor NOT logged in yet.
COMPOSITION: Full-bleed background: luxurious casino interior at night - vaulted ceiling with crystal
chandeliers (warm gold bokeh at the top), rows of blurred slot machines at the sides (magenta and cyan
bokeh, no readable screens), black marble columns with gold veins, violet velvet carpet; the centre is a
darker corridor. Top bar about 7% of the height: dark smoked glass strip with a thin gold line under it;
on the left a small round emblem (golden onion wearing a crown on a navy enamel medallion) next to
"CEBULION CASINO" in gold Roman capitals; in the TOP RIGHT corner a glossy gold pill button "Zaloguj"
with dark text and a soft gold glow. Upper half, centred: the hero logo - the emblem above the words in
extruded mirror-polished gold Roman capitals with bevels, the tagline under it in lavender-white
capitals. Right of the logo: the mascot Pan Cebulion, bowing slightly, one hand raising his top hat,
the other hand gesturing toward the "Zaloguj" button. Lower half: the heading flanked by thin gold
ornament lines, then three large portrait game tiles (each about 2:3, rounded corners, thin gold
border) side by side, each showing a frame from the game's gameplay video: (1) retro Las Vegas neon and
synthwave - golden onion in a pink-cyan neon ring, red 7s, cherries; (2) Egyptian treasure vault -
golden pharaoh mask in torchlight, lapis and gold; (3) magical crystal cave - glowing gems, amethyst and
sapphire crystals, teal bioluminescence. A small round play icon on each tile; the middle tile is
slightly enlarged and tilted in 3D with a stronger gold glow (hover state). Gold caption under each tile.
LIGHT: warm chandelier light from the upper left, gold rim on the tiles, cyan focus glow nowhere yet.
MOOD: premium, inviting, cinematic night luxury - a VIP lounge, not a flashy arcade.

--------------------------------------------------------------------
02/08  ID: m02_logowanie
ASPECT: 3:2 landscape (1536x1024) | BACKGROUND: PELNE (full-bleed screen mockup)
EXACT TEXT:
  - modal title: "Witaj w Cebulion Casino"
  - label above the input field: "Nazwa gracza"
  - gold button: "Wejdź do kasyna"   (W-e-j-d-ź, where ź = z with acute accent)
  - small line under the button: "Na start: 10 000 cebulionów"   (ó = o with acute accent;
    "10 000" with a space between 10 and 000)
SUBJECT: the login window opened over the lobby (same lobby as image 01).
COMPOSITION: The lobby behind is strongly blurred and darkened (frosted glass effect). Centred modal
window about 36% of the width: dark smoked glass panel with ornate gold filigree corners and straight
gold edges; a small gold emblem at the top centre, the title in gold Roman capitals, a thin gold ornament
line; ONE text input field (dark glass, thin gold border, cyan focus glow, empty with a blinking cursor);
under it the gold pill button as wide as the field; the small lavender line under the button; a small
round "x" close icon in the modal's top-right corner. Left of the modal, slightly overlapping its edge,
Pan Cebulion tips his top hat in a welcoming pose. Fine gold dust floating in the air.
LIGHT: soft warm light on the modal from the upper left, cyan glow only around the active input field.
MOOD: calm, focused, one simple action - a luxury hotel reception.

--------------------------------------------------------------------
03/08  ID: m03_bonus_powitalny
ASPECT: 3:2 landscape (1536x1024) | BACKGROUND: PELNE (full-bleed screen mockup)
EXACT TEXT:
  - huge gold 3D digits in the centre: "+10 000"   (plus sign, then 10, a space, 000)
  - heading above the digits: "Bonus powitalny"
  - balance chip in the top-right corner: label "Saldo" and number "10 000"
  - gold button at the bottom: "Odbierz"
SUBJECT: the welcome bonus moment right after the first login, over the blurred lobby.
COMPOSITION: Centre-bottom: an open treasure chest of deep violet lacquered wood with polished gold
corners, bands and an onion-shaped gold lock, overflowing with golden cebulion coins and a few magenta
and cyan gems; bright golden light beams upward from inside. A fountain of coins bursts upward and rains
down across the screen (some coins motion-blurred, all identical gold coins with a crowned onion
relief), soft god rays behind the chest, gold sparkles. Above the chest: the heading in gold Roman
capitals and the huge glowing "+10 000" digits (extruded polished gold, bevelled, dark violet outline).
Top-right corner: the balance chip (dark glass pill, small coin icon, label "Saldo", number "10 000" in
bold gold) with a stream of small coins flying toward it along a curved path. Bottom centre: the gold
pill button "Odbierz". On the right, smaller, Pan Cebulion celebrates with both arms up.
LIGHT: brightest point is the chest interior; the screen edges stay dark.
MOOD: jackpot joy, generous, spectacular but classy.

--------------------------------------------------------------------
04/08  ID: m04_lobby_mobile
ASPECT: 2:3 portrait (1024x1536) | BACKGROUND: PELNE (phone screen content only, full-bleed)
EXACT TEXT:
  - top bar: small label "Saldo" and number "10 000"
  - title on the top banner: "Cebulowy 777"
  - gold button on the banner: "Graj"
  - section heading: "Wybierz grę"   (ę = e with ogonek)
  - captions on the three tiles: "Cebulowy 777", "Złoty Faraon", "Kryształowa Kaskada"
    (Ł and ł = L with stroke)
SUBJECT: the logged-in lobby on a phone held vertically.
COMPOSITION: Top bar about 7%: small gold emblem on the left, balance pill centre-right (coin icon,
"Saldo" label, "10 000" in bold gold), a round avatar medallion on the right (elegant vegetable character
portrait in a gold ring). Below: a wide banner card about 28% of the height with key art of Cebulowy 777
(golden onion in a pink-cyan neon ring, striped synthwave sun) - the title and the gold "Graj" pill on its
left side, three small pagination dots under the card. Then the heading and a vertical list of three
large landscape game cards (about 16:9 each, rounded corners, thin gold borders) with key art: neon
Vegas, Egyptian vault, crystal cave; caption at the bottom-left of each card, small gold play icon at the
bottom-right. Background: the casino interior, blurred and dark. Side margins about 5%, generous spacing.
MOOD: premium mobile app, rich but uncluttered, thumb-friendly.

--------------------------------------------------------------------
05/08  ID: m05_s1_desktop
ASPECT: 3:2 landscape (1536x1024) | BACKGROUND: PELNE (full-bleed screen mockup)
EXACT TEXT:
  - game logo above the reels: "CEBULOWY" (first row) and "777" (second row)
  - bottom panel labels: "Saldo", "Zakład", "Wygrana"   (Zakład = Z-a-k-ł-a-d, ł = l with stroke)
  - numbers under the labels: "10 000" under Saldo, "100" under Zakład, "250" under Wygrana
  - word on the big round button: "SPIN"
  - texts on the symbols: "BAR", "WILD", "7"
SUBJECT: the game screen of the slot "Cebulowy 777" on desktop.
COMPOSITION: Background: retro Las Vegas at night in synthwave style - sky gradient from deep violet to a
pink-orange glow at the horizon, a striped retro sun rising behind the machine, neon perspective grid
floor, palm silhouettes and blank neon arrow and star signs with light bulbs at the sides (no letters on
signs). Centre: a chunky polished chrome slot machine frame with rounded corners, pink neon tube along
its outer edge, cyan neon tube along the inner edge, thin gold trim at the window, arched top crest with
a row of warm light bulbs and an atomic-age star. Inside the window: 3 reels x 3 rows of square symbols
on a dark violet backing: glossy enamel cherries, lemon, plum, watermelon slice, polished gold bell with
a red bow, black lacquer "BAR" plaque with chrome letters, a red italic "7" in a thick gold frame, and the
WILD symbol - a polished golden onion in a neon ring with a black ribbon reading "WILD". The middle row
shows three red 7s with a glowing pink win line and sparkles (winning moment). Logo above the frame:
"CEBULOWY" in pink neon tube letters (bold rounded retro sign letters like Bungee) and "777" in cherry
red and chrome digits with a gold outline. Bottom control panel about 18% of the height: dark smoked
glass bar with a thin gold top edge - left "Saldo" with a coin icon and the number; then "Zakład" with
round minus and plus buttons around the number; centre a large round SPIN button (polished gold knurled
ring, dark glass dome, glowing gold circular arrows, the word "SPIN" under the arrows); right "Wygrana"
with the number in bright gold; a row of small round icon buttons (autoplay, turbo lightning, sound,
menu) at the far right. Top-left corner: a small round home icon button.
LIGHT: cool white key from the upper left, strong pink and cyan neon rims, chrome reflecting neon.
MOOD: fast, joyful, glowing, nostalgic - neon is allowed on bigger areas in this game.

--------------------------------------------------------------------
06/08  ID: m06_s2_desktop
ASPECT: 3:2 landscape (1536x1024) | BACKGROUND: PELNE (full-bleed screen mockup)
EXACT TEXT:
  - game logo above the reels: "ZŁOTY" (smaller, first row) and "FARAON" (larger, second row)
    letters: Z, Ł, O, T, Y - where Ł = L with stroke - and F, A, R, A, O, N
  - bottom panel labels: "Saldo", "Zakład", "Wygrana"   (ł = l with stroke)
  - numbers: "10 000" under Saldo, "200" under Zakład, "0" under Wygrana
  - word on the big round button: "SPIN"
  - texts on the symbols: "10", "J", "Q", "K", "A", "WILD", "SCATTER"
SUBJECT: the game screen of the slot "Złoty Faraon" on desktop.
COMPOSITION: Background: inside an ancient Egyptian treasure vault - massive columns with lotus capitals,
walls with painted hieroglyphic friezes in gold, turquoise and ochre (decorative, not readable), two
fire baskets at the sides (the left one brighter), piles of gold treasure in the lower corners, diagonal
shafts of light with dust from the upper left, a dark portal niche in the centre behind the reels.
Centre: a frame of carved sandstone columns with lotus capitals and lapis lazuli and turquoise inlays,
a gold lintel with a winged sun disc, a thin gold beaded trim around the window. Inside: 5 reels x 3 rows
of square symbols on a dark blue backing: sandstone card symbols 10 J Q K A inlaid with turquoise,
malachite, carnelian, lapis and amethyst; a gold ankh, an Eye of Horus amulet, a winged scarab, a black
obsidian Anubis bust, a golden pharaoh mask; WILD = a golden onion-shaped reliquary with lapis stripes
above a "WILD" plaque; SCATTER = a sandstone pyramid with a cyan light beam above a "SCATTER" plaque. Two
scatters glow cool blue (bonus anticipation). Logo above the frame in ornate polished gold Roman capitals
with a lapis outline (like Cinzel Decorative), a small winged sun disc above it. Bottom panel: same
layout as the Cebulowy 777 mockup but themed - dark lapis-tinted glass with gold edges and turquoise
accents: "Saldo", "Zakład" with minus and plus, the round gold SPIN button in the centre, "Wygrana",
small round icon buttons.
LIGHT: warm torchlight key from the upper left, turquoise rim on the right, deep lapis-blue shadows.
NO neon pink or electric blue in this game.
MOOD: mysterious, regal, warm, treasure-filled.

--------------------------------------------------------------------
07/08  ID: m07_s3_mobile
ASPECT: 2:3 portrait (1024x1536) | BACKGROUND: PELNE (phone screen content only, full-bleed)
EXACT TEXT:
  - game logo near the top: "KRYSZTAŁOWA" (smaller, first row) and "KASKADA" (larger, second row)
    letters: K, R, Y, S, Z, T, A, Ł, O, W, A - where Ł = L with stroke - and K, A, S, K, A, D, A
  - bottom panel labels: "Saldo", "Zakład", "Wygrana"   (ł = l with stroke)
  - numbers: "10 000" under Saldo, "100" under Zakład, "1 250" under Wygrana
  - word on the big round button: "SPIN"
  - text on one symbol: "SCATTER"
SUBJECT: the game "Kryształowa Kaskada" on a phone held vertically.
COMPOSITION: Top 8%: thin bar with a round home icon and a menu icon. Logo zone (8-18% of height):
faceted crystal capitals with violet-cyan refraction and thin gold edges, three glowing drops falling
from the word KASKADA, a thin luminous waterfall behind it. Middle (20-66%): a grid of 6 columns x 5 rows
of square gem symbols inside a frame of dark silvery rock overgrown with crystals: pear-cut blue
sapphire, emerald-cut green emerald, hexagonal amethyst, marquise orange topaz, heart-cut ruby in a gold
setting, brilliant-cut diamond, a crystal onion with golden layers inside, a rainbow prism scatter with a
"SCATTER" plaque. A cluster of six connected emeralds glows (cluster win) with sparkling cracks and small
crystal shards flying. Background: crystal cave with bioluminescent teal moss and tiny glowing
mushrooms, amethyst and sapphire crystal clusters at the sides, a warm golden light shaft from the upper
left. Bottom panel (66-100%): dark glass panel - "Saldo" in a slim row at the top of the panel, the large
round gold SPIN button in the centre, "Zakład" with minus and plus on the left, "Wygrana" on the right,
a row of small round icon buttons (autoplay, turbo, sound, menu) at the bottom.
LIGHT: warm gold key from the upper left, teal bioluminescent rim on the right, amethyst accents.
MOOD: magical, cool, hypnotic, glowing.

--------------------------------------------------------------------
08/08  ID: m08_big_win
ASPECT: 3:2 landscape (1536x1024) | BACKGROUND: PELNE (full-bleed screen mockup)
EXACT TEXT:
  - giant win title in two rows: "MEGA" (first row) and "WIN" (second row)
  - counting amount under it, in gold 3D digits: "12 400"   (12, a space, 400)
SUBJECT: the full-screen MEGA WIN celebration over the "Złoty Faraon" game.
COMPOSITION: The game screen (vault, sandstone frame, symbols) is visible behind, darkened by about 60%
and slightly blurred. Centre: the two-row title - massive extruded mirror-polished gold heavy serif
capitals with bevels and a dark violet outline (#1A0B33), studded with rows of magenta rubies and cyan
sapphires along the letters, a gold laurel ribbon under the title, a slight upward smile-shaped arc.
Under it the big amount in the same gold 3D digits. Behind the title: god rays from the centre (warm
white tinted gold with a touch of magenta), a bright star flare, a ring shockwave; golden cebulion coins
burst from the centre and rain in arcs (motion blur), gold, magenta and cyan foil confetti, sparkles.
The screen edges stay darker (vignette) so the centre pops.
LIGHT: the title is the brightest object; additive glow behind it, never washing out the letters.
MOOD: explosive, triumphant, top-tier slot celebration - but clean and readable.

Start now with image 01.
```

### 3.2. Checklista czatu 0

- [ ] 8 plików `m01_lobby_desktop.png` … `m08_big_win.png` w folderze `makiety/`; 3:2 = 1536×1024, 2:3 = 1024×1536.
- [ ] Makiety mobilne (`m04`, `m07`) to sama zawartość ekranu w pionie — bez obudowy telefonu, dłoni, biurka.
- [ ] `m01`: przycisk „Zaloguj” jest w **prawym górnym rogu**, widać 3 kafle gier z kadrami „z filmików”.
- [ ] `m02`: modal ma **jedno** pole („Nazwa gracza”) i jeden złoty przycisk („Wejdź do kasyna”).
- [ ] `m03`: skrzynia, deszcz monet, duże „+10 000”, saldo w prawym górnym rogu.
- [ ] `m05`–`m07`: siatki bębnów **3×3**, **5×3**, **6×5** — policz pola. Panel: „Saldo”, „Zakład”, „Wygrana”, SPIN.
- [ ] `m06`: brak neonowego różu i elektrycznego błękitu (Egipt = złoto, lapis, turkus, piaskowiec).
- [ ] `m08`: napis w dwóch wierszach (`MEGA` / `WIN`), środek najjaśniejszy, brzegi ciemne.
- [ ] Ogólnie: ~70% ciemnych tonów, złoto ciepłe żółte (nie miedziane), światło z lewej-góry, render „stylizowane 3D”
      (nie zdjęcie, nie płaska grafika, nie styl dziecięcy).
- [ ] Brak prawdziwych marek, logo, znaków walut (`$`, `€`), banknotów, żetonów z nominałami.
- [ ] Literówki w polskich napisach są **dopuszczalne** (makiety nie trafiają do aplikacji), ale jeśli psują odbiór
      całości przy zatwierdzaniu — poprawka P3 z § 9.
- [ ] Zespół wybrał makiety-referencje do czatów 1–5 (co najmniej `m05_s1_desktop` albo jej zamiennik).

---

## 4. Czat 1: GLOBAL A — marka, moneta, maskotka, tła lobby (13 obrazów)

**Cel:** „nasze złoto” (moneta), znak marki (emblemat, logo), maskotka w trzech pozach, skrzynia bonusu, złote cyfry
do liczników wygranych, awatary graczy i tło lobby. Moneta jest pierwsza, bo ustala barwę złota dla całego projektu
([01 § 1.4](01-kierunek-artystyczny.md#14-kolejność-pracy-i-kotwice-stylu)).

**Załącz na początku:** `m05_s1_desktop` (albo jej zamiennik) + 1–2 inne najlepsze makiety, np. `m01_lobby_desktop`,
`m03_bonus_powitalny`. **Po czacie** odłóż na bok `g_moneta_przod` i `g_font_cyfry` — będą referencjami w czacie 2.

| # | ID | Format | Tło | Prio | Edycja z | Tekst na obrazie |
|---|---|---|---|---|---|---|
| 01 | `g_moneta_przod` | 1:1 | ALFA | P0 | — | brak |
| 02 | `g_moneta_skos` | 1:1 | ALFA | P0 | 01 | brak |
| 03 | `g_moneta_bok` | 1:1 | ALFA | P0 | 01 | brak |
| 04 | `g_emblemat` | 1:1 | ALFA | P0 | — | brak |
| 05 | `g_logo` | 3:2 | ALFA | P0 | emblemat z 04 | `CEBULION` / `CASINO` |
| 06 | `g_skrzynia` | 1:1 | ALFA | P0 | monety z 01 | brak |
| 07 | `g_maskotka_powitanie` | 1:1 | ALFA | P0 | — | brak |
| 08 | `g_maskotka_wygrana` | 1:1 | ALFA | P1 | postać z 07 | brak |
| 09 | `g_maskotka_bankrut` | 1:1 | ALFA | P1 | postać z 07 | brak |
| 10 | `g_font_cyfry` | 3:2 | ALFA SHEET 5×3 | P0 | — | `0`–`9`, `,`, `+`, `×` |
| 11 | `g_awatary` | 3:2 | ALFA SHEET 4×2 | P1 | — | brak |
| 12 | `g_tlo_lobby_desktop` | 3:2 | PELNE | P0 | — | brak |
| 13 | `g_tlo_lobby_mobile` | 2:3 | PELNE | P0 | 12 | brak |

### 4.1. Blok do wklejenia — czat 1

```text
ROLE
You are the lead art director and a senior 3D artist of a AAA mobile slot game studio. You create final,
production-ready game assets with your image generation tool. You follow technical specifications
exactly, keep one consistent style across the whole set and never improvise extra elements.

PROJECT
"Cebulion Casino" is a casino SIMULATOR built by three university students as a course project: a web
game with a fictional currency only - the golden "cebulion" coin. No real money, no prizes. Brand idea:
a premium, dark luxury casino with a wink - the humble onion ("cebula" in Polish) treated as royal
luxury. Mascot: "Pan Cebulion", an elegant golden onion gentleman with a top hat, a monocle and a bow
tie - charismatic, never childish. Three slot games: "Cebulowy 777" (retro Las Vegas neon, chrome and
synthwave), "Złoty Faraon" (ancient Egyptian treasure vault), "Kryształowa Kaskada" (magical crystal
cave). Every image you make is ONE separate asset. Programmers will cut it, animate it and combine it in
a web game (HTML + PixiJS). Animations, particles, light flashes, cast shadows and all interface text are
added later in code, so the images must be clean, isolated and exactly to spec.

THIS CHAT: Chat 1 of 6 - GLOBAL A: brand, coin, mascot, lobby backgrounds - 13 images.

STYLE DNA (Cebulion Casino): premium dark luxury casino, high-end stylized 3D render in the quality of
top mobile slot games. Warm yellow mirror-polished gold (not copper, not rose gold, not lemon), satin
brushed gold, dark smoked glass, deep navy-violet blacks (#07060F, #120B2A, #1E1442), small accents of
neon magenta (#FF2E88) and cyan (#21E6FF). Cinematic studio lighting: warm key light from the upper
left, soft lavender fill from the right, thin cool cyan rim light on the right edges, subtle magenta
rim on the lower left. Clean bevels, bold readable silhouette, rich but controlled detail, subtle
tight glow. Not photorealistic, not flat vector, not a cartoon for kids, no anime.
ALWAYS: no text unless specified, no watermark, no signature, no cast shadow, no floor, no reflection
below the object, no painted checkerboard, nothing cropped by the image edge.

PALETTE (hex)
- Darks: #07060F (deepest), #120B2A, #1E1442 - about 70% of every scene.
- Gold - the ONLY gold allowed, from light to dark: #FFF6D6 (tiny specular core, max 2% of the surface),
  #FFE08A (lit faces), #F5C542 (base, most of the surface), #B8860B (faces turned away), #5C3A00
  (crevices), #2B1A00 (dark reflections in polished gold). Warm yellow 22-24 karat gold: not copper,
  not rose gold, not lemon yellow, not greenish.
- Neon accents, max about 10% of an image: magenta #FF2E88, cyan #21E6FF.
- Never as dominant colours: green #3DFF8F and red #FF4D4D (reserved for interface meaning).
- Pure white #FFFFFF only in tiny highlight cores.

LIGHTING AND CAMERA (identical for every object so assets match side by side)
- Key: warm ~3500 K (#FFC489) from the UPPER LEFT (45 deg left, 45 deg up, slightly frontal);
  speculars sit in the upper-left quarter of each form.
- Fill: soft cool lavender (#6E64B8) from the front right, low, 20-30% - shadows are violet-brown, never
  black (darkest shadow on dark materials about #0A0614, on gold #2B1A00).
- Main rim: thin cyan (#21E6FF) from behind upper right - a bright edge 2-4% of the object width on the
  RIGHT edges.
- Accent rim: subtle magenta (#FF2E88) from behind lower left, 30-50%.
- Emission (gems, glows) shines but never blows out.
- Objects: about 85 mm lens, frontal, three-quarter turn at most 15 deg, camera 5-10 deg above the object
  centre. Lettering: frontal. Backgrounds: 24 mm lens at eye level, vanishing point centred horizontally
  at about 45% of the height.

MATERIALS (use these exact looks)
- Mirror-polished warm yellow gold: crisp highlights, dark reflections next to bright light.
- Satin brushed gold: soft anisotropic sheen, low contrast - large flat areas, coin field.
- Glossy enamel: saturated colour under a thick clear coat, one large soft highlight.
- Layered golden onion skin: metallic gold layers with a pearlescent sheen, subsurface glow on thin edges.
- Faceted gemstones: internal refraction, bright core, small rainbow sparks on facet edges.
- Silk / satin: long soft highlights along folds. Lacquered wood: deep colour under a glossy coat.
Combine polished and satin gold on one object (all-polished looks noisy). Max 3 levels of detail (main
form, main divisions, fine ornament); the smallest detail at least 1/100 of the object size so it still
reads at 64 px. Forms about 20% chunkier and juicier than real life. No pores, scratches, dirt.

TECHNICAL RULES BY BACKGROUND TYPE (each item says which one applies)

[ALFA] = TRUE TRANSPARENT BACKGROUND
- Output a PNG with a real alpha channel: every background pixel is fully transparent.
- Do NOT paint a grey-and-white checkerboard to imitate transparency. No white, grey, black or coloured
  backdrop, no gradient, no scenery behind the object.
- One object, centred on its optical centre, filling 80-85% of the canvas (the item gives the value).
  Keep at least 6% empty margin on all four sides (about 62 px on a 1024 px side). Nothing may touch or
  be cut by the canvas edge - including glow, sparkles, hat brims and flying coins.
- No cast shadow, no contact shadow, no floor or ground plane, no reflection or puddle under the object.
  Self-shadowing and ambient occlusion ON the object are welcome.
- Only a subtle, tight glow (reach at most 4-6% of the object size) that fades out completely inside
  the margin. No fog, haze or light spill over the canvas.
- Clean anti-aliased edges, no white, grey or coloured halo around the silhouette.
- No text unless the item gives EXACT TEXT.

[PELNE] = FULL-BLEED IMAGE
- Painted edge to edge: no border, no frame around the picture, no rounded corners, no letterbox bars.
- No text, letters, numbers, logos, UI or people. Signs and screens in the scene stay blank or blurred.
- Follow the composition zones in the item: the area where the interface will sit is the darkest and
  calmest part; light sources and rich detail stay at the sides and top; corners get a ~20% vignette.
  Keep everything important inside the safe area given in the item (screens crop the edges).
- Smooth gradients without banding; no fine repetitive patterns (thin stripes, small checkers, moire).
- Scenery, not the hero: lower saturation and brightness than foreground objects.

[SHEET] = SPRITE SHEET (one image containing a grid of separate elements)
- Exactly the grid given (columns x rows) of equal, invisible cells filling the whole canvas.
- One element per cell in the order given: row by row, left to right, top to bottom.
- Every element is complete inside its own cell with at least 10% empty margin to the cell borders;
  elements never touch, overlap or cross into a neighbouring cell. Cells marked EMPTY stay empty.
- No grid lines, no cell borders, no numbers or captions (unless the element itself is a digit), no
  backdrop behind the elements - the sheet keeps its background type (ALFA = transparent).
- All elements share the same style, lighting, camera and scale logic.

[EDIT] items
- Use the named earlier image from this chat as the base. Keep everything identical (design, colours,
  materials, light, size and position on the canvas) except the changes listed in the item.
- If I attach an image together with "IDŹ DO: <id>", that attached image is the base for the EDIT.
- The result keeps the item's exact aspect ratio and background type.

TEXT ON IMAGES
- Render text ONLY where an item gives EXACT TEXT. Copy it letter by letter, in capitals exactly as
  given, with nothing added (no slogans, no taglines, no fake letters anywhere else).

ORIGINALITY / FORBIDDEN
- Do not imitate or reference any real casino, slot game, game studio, brand, logo, trademark, mascot,
  cartoon character, celebrity or copyrighted character. The mascot must not resemble any existing
  advertising mascot. Everything must be 100% original.
- No real money: no banknotes, no $ EUR or other currency signs, no credit cards, no chips with values.
  The only currency is the golden cebulion coin.
- No alcohol, no cigarettes, no violence, no sexualised characters, no kawaii/chibi/children's toy
  style, no big round cute eyes, no anime, no flat vector clip-art, no photorealism, no pixel art.
- No watermark, no signature, no artist name, no random letters.

REFERENCE IMAGES
I attached approved mockups of this project. Use them ONLY as a reference for render quality, gold
colour, lighting, contrast and level of detail. Do not copy their layout or their text. Each new image
is a single isolated asset made exactly to its own specification below.

WORKFLOW PROTOCOL (very important)
1. Generate the images strictly in the numbered order of the IMAGE LIST, exactly ONE image per reply.
   Never put two IDs in one image, never make a collage, a contact sheet, variations or options.
   (SHEET items are one image that contains a grid - that is by design.)
2. In every reply write one short line ABOVE the image:  ID: <id> | <aspect> | <background>
   and nothing else - no explanations, no questions.
3. Use exactly the aspect ratio given for the item: 1:1 = 1024x1024, 3:2 = 1536x1024 landscape,
   2:3 = 1024x1536 portrait. Never change it.
4. Items marked EDIT follow the [EDIT] rules.
5. After each image STOP and wait for my command (commands are in Polish):
   DALEJ            = accepted; generate the next ID from the list.
   POPRAW: <notes>  = regenerate the SAME ID; keep everything that was right, fix only what I describe.
   NOWA WERSJA      = regenerate the SAME ID from scratch with a fresh take on the same brief.
   IDŹ DO: <id>     = jump to that ID (I use it when I come back later or skip an item).
   ZASADY           = re-read this whole first message (all rules) and apply it to the next image.
   STATUS           = reply with text only: which IDs are done and which remain. No image.
6. After the last item write only: KONIEC CZATU.

IMAGE LIST

--------------------------------------------------------------------
01/13  ID: g_moneta_przod
ASPECT: 1:1 square (1024x1024) | BACKGROUND: ALFA | EXACT TEXT: none (no letters, no numbers)
SUBJECT: the "cebulion" - the game's gold coin - seen perfectly from the front (0 deg).
COMPOSITION: a perfect circle, coin diameter about 82% of the canvas, centred. Thick, chunky coin
(thickness about 9% of the diameter; only a hint of the edge is visible).
DESIGN: in the centre a raised relief of a plump onion wearing a five-point crown (a simplified,
all-gold version of the brand emblem, no gems); two small five-pointed stars left and right of the
onion; a short laurel branch below it. The field is satin brushed gold with fine radial brushing from
the centre. Just inside the rim, a ring of about 60 small raised beads. A raised, mirror-polished rim
about 8% of the radius. No inscription of any kind.
MATERIALS: relief, beads and rim mirror-polished (crisp highlights, dark #2B1A00 reflections); field
satin (soft sheen) - the contrast between them makes the coin look expensive.
LIGHT: key from the upper left (bright specular on the upper-left of the rim and relief), thin cyan rim
on the right edge, faint magenta on the lower left.
MOOD: a precious collector's coin; bold and readable even when shrunk to 24 px.

--------------------------------------------------------------------
02/13  ID: g_moneta_skos
ASPECT: 1:1 square (1024x1024) | BACKGROUND: ALFA | EXACT TEXT: none
EDIT of image 01 (g_moneta_przod).
CHANGE ONLY: rotate the very same coin about 45 deg around its vertical axis (its right side turning away
from the viewer). The face becomes a vertical ellipse with width:height about 0.7:1, and a strip of the
reeded edge (fine vertical grooves) becomes visible on the right side.
KEEP IDENTICAL: the relief design, gold colour, polish/satin contrast, lighting direction, the coin
height (about 82% of the canvas) and its centre point. Transparent background, no shadow.

--------------------------------------------------------------------
03/13  ID: g_moneta_bok
ASPECT: 1:1 square (1024x1024) | BACKGROUND: ALFA | EXACT TEXT: none
EDIT of image 01 (g_moneta_przod).
CHANGE ONLY: rotate the very same coin about 80-85 deg - almost edge-on. A narrow vertical ellipse:
the reeded edge with 100-120 fine vertical grooves fills most of the view, only a thin sliver of the
face is visible on the left.
KEEP IDENTICAL: gold colour, lighting, coin height (about 82% of the canvas) and its centre point.
Transparent background, no shadow.

--------------------------------------------------------------------
04/13  ID: g_emblemat
ASPECT: 1:1 square (1024x1024) | BACKGROUND: ALFA | EXACT TEXT: none
SUBJECT: the brand emblem of Cebulion Casino - a royal seal: a golden onion wearing a crown on a round
medallion. Used as app icon, favicon, loader and header mark.
COMPOSITION: round medallion about 78% of the canvas width, placed slightly below centre so that the
crown, which rises ABOVE the medallion outline, still keeps the 6% top margin.
DESIGN: outer ring of mirror-polished gold (thickness about 7% of the radius), behind it a thin ring of
fine guilloche engraving (wavy lines). Inner field: deep navy-violet enamel (#1E1442) with a subtle
radial sunburst. In the centre a plump polished-gold onion with 5 visible vertical ribs and a gently
rounded tip; two gold laurel branches curve up around it from below. On the onion sits a crown with
five points alternating fleur-de-lis and pearls; on its band a magenta ruby in the middle and cyan
sapphires on the sides.
LIGHT: key from the upper left, cyan rim on the right of the outer ring, small sharp sparkles on gems.
READABILITY: at 32 px the silhouette must read as "a gold disc with a crown on top".
MUST DIFFER FROM THE COIN: the emblem has enamel, gems and a crown breaking the outline; the coin is all
gold and flat.

--------------------------------------------------------------------
05/13  ID: g_logo
ASPECT: 3:2 landscape (1536x1024) | BACKGROUND: ALFA
EXACT TEXT: "CEBULION" (first line, large) and "CASINO" (second line, smaller)
  letters: C-E-B-U-L-I-O-N and C-A-S-I-N-O - nothing else.
SUBJECT: the main logotype of Cebulion Casino, vertical lockup.
COMPOSITION (top to bottom): (1) the emblem from image 04 (same design), centred, about 40% of the
logo's height; (2) the word CEBULION across the full logo width, cap height about 22% of the logo
height; (3) the word CASINO with caps about 45% of CEBULION's height, wide letter spacing, and on both
sides of it thin gold lines ending in small diamonds. The whole lockup about 84% of the canvas width,
at least 6% margin on every side, centred.
LETTERING: classical Roman inscription capitals like the Cinzel typeface - sharp, finely bracketed
serifs, clear thick-thin contrast. Letters are extruded mirror-polished gold with a bevelled edge
(extrusion depth about 6% of the letter height). The bevel catches warm light from the upper left; the
front faces have a vertical gradient #FFE08A to #F5C542 to #B8860B. A thin cyan rim on the right edges
of letters, a hint of magenta reflection on the lower bevels. A thin dark navy outline (about 2% of the
letter height) around every letter keeps it readable over video and bright bokeh.
MOOD: regal, confident, expensive.

--------------------------------------------------------------------
06/13  ID: g_skrzynia
ASPECT: 1:1 square (1024x1024) | BACKGROUND: ALFA | EXACT TEXT: none
SUBJECT: an open treasure chest full of cebulion coins - the prop of the welcome bonus.
COMPOSITION: about 84% of the canvas, centred, seen from slightly above (camera 8-10 deg higher), turned
about 10 deg. Lid opened to about 110 deg.
DESIGN: chest of deep violet lacquered wood (#1E1442 with a glossy coat), clad in polished gold: corner
caps, two gold bands, and a gold lock shaped like the brand emblem (an onion with a crown). Inside: a
heap of gold coins - the same coin as image 01 (crowned onion relief, no numbers) - with a few magenta
and cyan cut gems; 3-5 coins hang over the front edge.
LIGHT: key from the upper left; a warm golden glow comes from the coin heap and lights the inside of the
lid - compact, it fades out within the margin (the big light rays are added later in code).
STRICTLY: no floor, no shadow under the chest, no coins lying around it.
MOOD: generous, rich, inviting.

--------------------------------------------------------------------
07/13  ID: g_maskotka_powitanie
ASPECT: 1:1 square (1024x1024) | BACKGROUND: ALFA | EXACT TEXT: none
SUBJECT: the mascot "Pan Cebulion" welcoming the player. This image defines the character for all
later poses, so follow the description precisely.
CHARACTER: an elegant gentleman whose head and body are one plump golden onion bulb (height 1.0 unit,
width 0.9 unit; the gently rounded tip hidden under the hat). Skin: layered, metallic golden onion
skin with a pearlescent sheen and 7 subtle vertical ribs from top to bottom; thin edges glow slightly
(subsurface light, like a real onion). Black-violet silk top hat (#120B2A to #1E1442 with a violet
sheen), 0.48 unit tall, brim 0.62 unit, tilted about 10 deg toward the right edge of the image; gold
satin hat band with a small cebulion-coin pin. A round gold monocle on the character's RIGHT eye (that is
on the LEFT side of the image), glass with a sharp white highlight, a thin gold chain arcing down to a pin
by the bow tie. Magenta satin bow tie (#FF2E88, folds #B3135C) with a subtle diamond pattern. A stiff
white wing collar (#F4EBD9) under the bow tie. Slim arms in cream gloves (#F4EBD9) reaching mid-thigh.
Slim legs (0.40 unit) in narrow dark navy trousers (#1E1442) with pockets; black patent shoes with white
spats. Face: almond-shaped, medium-size eyes (NOT big round cute eyes) with black pupils and one white
highlight, placed at 35-45% of the bulb height; thick, very expressive dark brown eyebrows; a curled
light-gold moustache made of onion roots - his signature feature; a confident closed-mouth half-smile.
POSE: a slight bow (torso tilted about 8 deg); his right hand (left side of the image) lifts the top hat
a little off his head; his left hand makes an open inviting gesture at waist height toward the viewer.
He winks with his left eye (the right eye stays behind the monocle); one eyebrow raised.
COMPOSITION: full figure, about 82% of the canvas height, centred, feet fully visible, at least 6%
margin; stands on nothing - no floor, no shadow.
LIGHT: global scheme; cyan rim along his right-side contour, magenta rim lower left.
MOOD: charismatic host of a luxury salon, witty, theatrical but never childish.

--------------------------------------------------------------------
08/13  ID: g_maskotka_wygrana
ASPECT: 1:1 square (1024x1024) | BACKGROUND: ALFA | EXACT TEXT: none
EDIT / same character as image 07: exactly the same Pan Cebulion - same proportions, same 7 ribs, same
outfit and colours, same moustache, monocle on the character's right eye, hat tilted toward the right
edge of the image. Only the pose, expression and props change.
POSE: a joyful jump - feet off the ground, knees bent, both arms up in a "V"; the top hat pops about 10%
of the figure height above his head; the monocle has fallen out and swings on its chain.
EXPRESSION: wide happy smile showing teeth, eyes squinted with joy, eyebrows up.
PROPS: 6-10 gold cebulion coins (the coin from image 01) flying around him, every coin fully inside the
canvas and inside the 6% margin.
COMPOSITION: whole figure including hat and coins about 84% of the canvas, centred; no floor, no shadow.
MOOD: pure celebration with style.

--------------------------------------------------------------------
09/13  ID: g_maskotka_bankrut
ASPECT: 1:1 square (1024x1024) | BACKGROUND: ALFA | EXACT TEXT: none
EDIT / same character as image 07: exactly the same Pan Cebulion - same proportions, ribs, outfit,
colours, moustache, hat tilt. Only the pose, expression and props change.
POSE: standing, shrugging, both gloved hands pulling his trouser pockets inside out (cream lining
visible).
EXPRESSION: self-ironic half-smile, eyebrows raised in the middle ("oh well, it happens"); the monocle
hangs on its chain against his chest.
PROPS: a small puff of dust from the pockets and one tiny moth flying up - nothing else.
COMPOSITION: full figure about 82% of the canvas height, centred, feet visible; no floor, no shadow.
MOOD: funny and classy, never sad - no tears, no despair (this is a simulator; a rescue bonus follows).

--------------------------------------------------------------------
10/13  ID: g_font_cyfry
ASPECT: 3:2 landscape (1536x1024) | BACKGROUND: ALFA SHEET 5 columns x 3 rows
EXACT TEXT (one glyph per cell, in this order):
  row 1: 0  1  2  3  4
  row 2: 5  6  7  8  9
  row 3: ,  +  ×  EMPTY  EMPTY
  ("," = comma, "+" = plus sign, "×" = multiplication sign - a diagonal cross, NOT the letter X;
  the last two cells of row 3 stay completely empty)
SUBJECT: a bitmap font of golden 3D numerals for win counters ("12 400", "x10", "+10").
LETTERING: heavy, massive lining numerals with classical serifs (like a heavier Cinzel Black), extruded
mirror-polished gold with a depth of 8-10% of the glyph height, bevelled front edges, front faces with a
vertical gradient #FFE08A to #F5C542 to #B8860B, a dark violet outline (#1A0B33, 3-4% of the glyph
height) around each glyph, a thin cyan rim on the right edges.
LAYOUT: every digit exactly the same height (about 62% of the cell height) and sitting on the same
baseline in its row; the comma small and resting on the baseline; plus and multiplication sign centred
at mid-height and about 60% of a digit's height. Every glyph centred in its cell with at least 10%
empty margin. All glyphs perfectly upright and frontal.
MOOD: jackpot gold, crisp and readable at 32 px.

--------------------------------------------------------------------
11/13  ID: g_awatary
ASPECT: 3:2 landscape (1536x1024) | BACKGROUND: ALFA SHEET 4 columns x 2 rows | EXACT TEXT: none
SUBJECT: 8 round player avatars - the "vegetable aristocracy", friends of Pan Cebulion.
EACH CELL: one round medallion about 76% of the cell width, centred: a polished gold ring, a glossy
enamel background in the colour given, and inside a head-and-shoulders portrait of the character,
frontal or slight three-quarter, same render and light as the mascot. Elegant, witty, not childish.
Nobody wears a top hat or a monocle (reserved for the mascot).
ORDER (row 1, left to right):
  1) Lady Red Onion: red onion with violet-pink skin, pearl earrings, small feather fascinator;
     enamel turquoise #1BB5C9.
  2) Count Garlic: ivory garlic bulb, tall upturned cape collar, thin moustache; enamel deep violet #3B1E8C.
  3) Baron Potato: golden-brown potato, bowler hat, silk pocket square; enamel sapphire #1F4FD1.
  4) Lady Pepper: glossy red bell pepper, cat-eye glasses, gold earrings; enamel emerald #12A86B.
ORDER (row 2, left to right):
  5) Captain Leek: green-and-white leek, white captain's cap with a gold anchor; enamel dark magenta #B3135C.
  6) Duke Eggplant: violet eggplant, velvet beret with a feather; enamel gold #F5C542.
  7) Madame Radish: magenta-and-white radish, feather boa; enamel dark teal #0E6E73.
  8) Mister Mushroom: cream mushroom cap, sunglasses, polka-dot bow tie; enamel ruby #A3122E.
READABILITY: each avatar must be recognisable at 32 px by head silhouette and background colour.
No text, no names.

--------------------------------------------------------------------
12/13  ID: g_tlo_lobby_desktop
ASPECT: 3:2 landscape (1536x1024) | BACKGROUND: PELNE | EXACT TEXT: none
SUBJECT: background of the lobby - a luxurious casino interior at night, empty of people.
COMPOSITION: eye-level view, 24 mm lens, strong depth of field. A long, deep, dark corridor leads to a
vanishing point in the horizontal centre at about 45% of the height. ZONES: top 0-20% - a vaulted
ceiling with crystal chandeliers rendered as warm gold bokeh; sides (outer 18% left and right) - black
marble columns with gold veins, gold arches and rows of softly blurred slot machines glowing as magenta
and cyan bokeh (no readable screens); CENTRE (x 25-75%, y 25-85%) - the darkest, calmest area with very
little detail (interface tiles will sit here); bottom 20% - violet velvet carpet with a subtle large
pattern, darkening to #07060F. Keep important elements inside x 6-94%, y 9-91%.
LIGHT: warm chandelier light from the upper left dominates; cool neon bokeh at the sides; ~20% corner
vignette. Average brightness low (night).
STRICTLY: no people, no text, no signs, no logos, no slot machine screens with content.
MOOD: VIP lounge at midnight - expensive, quiet, inviting.

--------------------------------------------------------------------
13/13  ID: g_tlo_lobby_mobile
ASPECT: 2:3 portrait (1024x1536) | BACKGROUND: PELNE | EXACT TEXT: none
EDIT of image 12 (g_tlo_lobby_desktop): recompose (do not stretch) the same interior into a vertical
2:3 composition for phones.
ZONES: a crystal chandelier with warm gold bokeh at the top (y 0-20%); the dark corridor and vanishing
point in the middle (calm, little detail, this is where the game tiles sit); black marble columns with
gold veins and blurred magenta/cyan slot machine bokeh close to the left and right edges (phones may crop
up to 15% on each side); bottom third darker, carpet fading to #07060F. Keep important elements inside
x 16-84%, y 6-94%.
KEEP IDENTICAL: materials, colours, light direction, mood, night darkness. No people, no text.

Start now with image 01.
```

### 4.2. Checklista czatu 1

**Pliki:** 13 plików w `global/`; 1:1 = 1024×1024, 3:2 = 1536×1024, 2:3 = 1024×1536.

- [ ] Wszystkie `ALFA`: prawdziwa przezroczystość (test z [02 § 4.3](02-lista-obrazow.md#43-jak-pobrać-oryginał-z-chatgpt)),
      bez szachownicy, bez cienia i podłogi, margines ≥ 6%, nic nie dotyka krawędzi.
- [ ] Złoto ciepłe żółte w każdym obrazie (porównaj z `g_moneta_przod` obok siebie) — nie miedziane, nie cytrynowe.
- [ ] Światło z lewej-góry, cyjanowy rim po prawej stronie obiektów.
- [ ] **Monety:** trzy ujęcia to ta sama moneta (ten sam relief, złoto, światło), ta sama wysokość i środek;
      `skos` = elipsa ~0,7:1 z rantem po prawej; `bok` = wąska elipsa z żłobkowanym rantem; **brak napisów i cyfr**.
- [ ] **Emblemat:** emalia granatowo-fioletowa, rubin i szafiry w koronie, korona wychodzi ponad medalion i mieści się
      w marginesie; w 32 px czytelny jako „złoty krążek z koroną”; nie myli się z monetą.
- [ ] **Logo:** dokładnie `CEBULION` i `CASINO` (litera po literze), litery jak Cinzel, złote z fazą i ciemnym konturem,
      emblemat nad napisem jest tym samym projektem co `g_emblemat`.
- [ ] **Skrzynia:** fioletowe lakierowane drewno + złote okucia, zamek z cebulą, wieko ~110°, poświata zwarta,
      brak podłogi i monet leżących obok.
- [ ] **Maskotka (3 pozy):** ta sama postać — monokl na prawym oku postaci (po **lewej** stronie obrazu), magentowa
      muszka, wąsy z korzonków, 7 żeber, cylinder przechylony w prawo; oczy migdałowe (nie „kawaii”); cała postać
      w kadrze, stopy widoczne; monety w pozie „wygrana” w całości w kadrze; „bankrut” zabawny, nie smutny.
- [ ] **Cyfry:** siatka 5×3, kolejność `0 1 2 3 4 / 5 6 7 8 9 / , + ×` + 2 puste komórki; znak `×` to krzyżyk, nie
      litera X; wszystkie cyfry tej samej wysokości i na tej samej linii bazowej; nic nie wchodzi do sąsiedniej komórki.
- [ ] **Awatary:** siatka 4×2, 8 różnych postaci w kolejności z listy, każda z innym kolorem emalii, nikt nie ma
      cylindra ani monokla, rozpoznawalne po zmniejszeniu do 32 px.
- [ ] **Tła lobby:** ciemny, spokojny środek (tu staną kafle gier), bokeh żyrandoli u góry, automaty po bokach
      rozmyte, brak ludzi i napisów; wersja mobile przekomponowana (nie rozciągnięta), ważne elementy w x 16–84%.

---

## 5. Czat 2: GLOBAL B — UI kit, napisy wygranych, efekty (18 obrazów)

**Cel:** cały interfejs gry (przycisk SPIN, ikony, panel modala, przyciski 9-slice, ornament), pięć napisów
wygranych do eskalacji BIG → MEGA → EPIC → ULTRA i FREE SPINS oraz tekstury efektów świetlnych (promienie, flara,
iskry, błyskawice, dym, konfetti). Teksty przycisków i paneli są w HTML, więc te obrazy są **bez tekstu**.

**Załącz na początku:** `m05_s1_desktop`, `m08_big_win`, `g_moneta_przod` (wzorzec złota) i `g_font_cyfry`
(wzorzec liter napisów wygranych). **Po czacie** odłóż `g_ui_spin` — referencja dla czatów 3–5.

| # | ID | Format | Tło | Prio | Edycja z | Tekst na obrazie |
|---|---|---|---|---|---|---|
| 01 | `g_ui_spin` | 1:1 | ALFA | P0 | — | brak (ikona strzałek) |
| 02 | `g_ui_spin_stop` | 1:1 | ALFA | P0 | 01 | brak (ikona kwadratu) |
| 03 | `g_ui_ikony` | 3:2 | ALFA SHEET 4×3 | P0 | dyski jak w 01 | tylko litera `i` na ikonie info |
| 04 | `g_ui_panel` | 1:1 | ALFA, 9-slice | P0 | — | brak |
| 05 | `g_ui_przycisk_glowny` | 3:2 | ALFA, 9-slice | P0 | — | brak |
| 06 | `g_ui_przycisk_drugi` | 3:2 | ALFA, 9-slice | P0 | 05 | brak |
| 07 | `g_ui_ornament` | 3:2 | ALFA | P1 | — | brak |
| 08 | `g_win_big` | 3:2 | ALFA | P0 | litery jak `g_font_cyfry` | `BIG` / `WIN` |
| 09 | `g_win_mega` | 3:2 | ALFA | P1 | 08 | `MEGA` / `WIN` |
| 10 | `g_win_epic` | 3:2 | ALFA | P1 | 08 | `EPIC` / `WIN` |
| 11 | `g_win_ultra` | 3:2 | ALFA | P1 | 08 | `ULTRA` / `WIN` |
| 12 | `g_win_free_spins` | 3:2 | ALFA | P1 | 08 | `FREE` / `SPINS` |
| 13 | `g_fx_promienie` | 1:1 | CZARNE | P0 | — | brak |
| 14 | `g_fx_flara` | 1:1 | CZARNE | P0 | — | brak |
| 15 | `g_fx_iskry` | 3:2 | CZARNE SHEET 4×2 | P0 | — | brak |
| 16 | `g_fx_blyskawice` | 3:2 | CZARNE SHEET 3×1 | P1 | — | brak |
| 17 | `g_fx_dym` | 1:1 | CZARNE | P1 | — | brak |
| 18 | `g_fx_konfetti` | 3:2 | ALFA SHEET 4×3 | P1 | — | brak |

### 5.1. Blok do wklejenia — czat 2

```text
ROLE
You are the lead art director and a senior 3D/UI artist of a AAA mobile slot game studio. You create
final, production-ready game assets with your image generation tool. You follow technical specifications
exactly, keep one consistent style across the whole set and never improvise extra elements.

PROJECT
"Cebulion Casino" is a casino SIMULATOR built by three university students as a course project: a web
game with a fictional currency only - the golden "cebulion" coin. No real money, no prizes. Brand idea:
a premium, dark luxury casino with a wink - the humble onion ("cebula" in Polish) treated as royal
luxury. Three slot games share one interface kit. Every image you make is ONE separate asset.
Programmers will cut it, animate it and combine it in a web game (HTML + PixiJS). All interface text is
HTML (so buttons and panels have NO text), hover/press states, animations, particles, flashes and cast
shadows are added later in code, so the images must be clean, isolated and exactly to spec.

THIS CHAT: Chat 2 of 6 - GLOBAL B: user interface kit, win titles and light effects - 18 images.

STYLE DNA (Cebulion Casino): premium dark luxury casino, high-end stylized 3D render in the quality of
top mobile slot games. Warm yellow mirror-polished gold (not copper, not rose gold, not lemon), satin
brushed gold, dark smoked glass, deep navy-violet blacks (#07060F, #120B2A, #1E1442), small accents of
neon magenta (#FF2E88) and cyan (#21E6FF). Cinematic studio lighting: warm key light from the upper
left, soft lavender fill from the right, thin cool cyan rim light on the right edges, subtle magenta
rim on the lower left. Clean bevels, bold readable silhouette, rich but controlled detail, subtle
tight glow. Not photorealistic, not flat vector, not a cartoon for kids, no anime.
ALWAYS: no text unless specified, no watermark, no signature, no cast shadow, no floor, no reflection
below the object, no painted checkerboard, nothing cropped by the image edge.

PALETTE (hex)
- Darks: #07060F (deepest), #120B2A, #1E1442.
- Gold - the ONLY gold allowed, from light to dark: #FFF6D6 (tiny specular core), #FFE08A (lit faces),
  #F5C542 (base), #B8860B (faces turned away), #5C3A00 (crevices), #2B1A00 (dark reflections).
  Warm yellow 22-24 karat gold: not copper, not rose gold, not lemon yellow, not greenish. It must match
  the attached coin image exactly.
- Neon accents: magenta #FF2E88, cyan #21E6FF. Epic violet: #8F3DFF. Win-title outline: #1A0B33.
- Never as dominant colours: green #3DFF8F, red #FF4D4D.

LIGHTING AND CAMERA
- Key: warm ~3500 K (#FFC489) from the UPPER LEFT; speculars in the upper-left quarter of each form.
- Fill: soft lavender (#6E64B8) from the front right, 20-30%; shadows violet-brown, never black.
- Main rim: thin cyan (#21E6FF) on the RIGHT edges (2-4% of the object width).
- Accent rim: subtle magenta (#FF2E88) on the lower left, 30-50%.
- UI pieces (buttons, icons, panels, ornament): STRICTLY FRONTAL, no perspective, perfectly symmetrical.
- Win titles: frontal; the extrusion depth may be seen slightly from below.

MATERIALS (use these exact looks)
- Mirror-polished warm yellow gold: crisp highlights, dark reflections next to bright light.
- Satin brushed gold: soft anisotropic sheen, low contrast.
- Dark smoked glass: deep #120B2A-#1E1442, glossy, brighter fresnel edges, one diagonal reflection in the
  upper-left area, subtle inner glow.
- Faceted gemstones and crystal: internal refraction, bright core, rainbow dispersion on facet edges.
- Metallic foil (confetti): thin, slightly crumpled, one sharp highlight.
Combine polished and satin gold. The smallest detail at least 1/100 of the object size (it must read
at 24-48 px for icons). No pores, scratches or dirt.

TECHNICAL RULES BY BACKGROUND TYPE (each item says which one applies)

[ALFA] = TRUE TRANSPARENT BACKGROUND
- Output a PNG with a real alpha channel: every background pixel is fully transparent.
- Do NOT paint a grey-and-white checkerboard to imitate transparency. No white, grey, black or coloured
  backdrop, no gradient, no scenery behind the object.
- One object, centred, filling 80-85% of the canvas unless the item gives another value. Keep at least
  6% empty margin on all four sides. Nothing may touch or be cut by the canvas edge.
- No cast shadow, no contact shadow, no floor, no reflection under the object.
- Only a subtle, tight glow (reach at most 4-6% of the object size) that fades out completely inside
  the margin. No fog or haze over the canvas.
- Clean anti-aliased edges, no white, grey or coloured halo around the silhouette.
- No text unless the item gives EXACT TEXT.

[CZARNE] = PURE BLACK BACKGROUND FOR ADDITIVE BLENDING
- The background is solid pure black #000000 (RGB 0,0,0) everywhere: no gradient, no vignette, no noise,
  no stars, no dust, no smoke unless the item is smoke.
- The effect is neutral warm white (#FFF3D1 family) unless the item says otherwise - the game tints it
  with colour in code, so do not colour it yourself.
- Every glow fades smoothly to pure black BEFORE the edges: keep at least 8% pure black margin on every
  side (in sheets: at least 10% of each cell). Nothing is cut by an edge.
- Soft gradients only, no hard edge where a glow ends, no lens ghosts in the corners, no text, no objects.

[SHEET] = SPRITE SHEET (one image containing a grid of separate elements)
- Exactly the grid given (columns x rows) of equal, invisible cells filling the whole canvas.
- One element per cell in the order given: row by row, left to right, top to bottom.
- Every element is complete inside its own cell with at least 10% empty margin to the cell borders;
  elements never touch, overlap or cross into a neighbouring cell.
- No grid lines, no cell borders, no numbers or captions, no backdrop behind the elements - the sheet
  keeps its background type (ALFA = transparent, CZARNE = pure black).
- All elements share the same style, lighting and scale logic.

[9-SLICE] = STRETCHABLE UI PIECE (the code stretches the middle and keeps the corners)
- Strictly frontal, no perspective, perfectly symmetrical left-right (and top-bottom for the panel).
- Decoration ONLY in the corners or rounded ends. The straight edges are identical along their whole
  length. The middle area is plain and uniform along the stretch direction: no ornament, no sparkle, no
  highlight spot, no texture change there. A smooth vertical gradient and a straight horizontal gloss
  stripe running the full length are allowed on buttons.
- No text, no icons.

[EDIT] items
- Use the named earlier image from this chat as the base. Keep everything identical (design, colours,
  materials, light, size and position on the canvas) except the changes listed in the item.
- If I attach an image together with "IDŹ DO: <id>", that attached image is the base for the EDIT.
- The result keeps the item's exact aspect ratio and background type.

TEXT ON IMAGES
- Render text ONLY where an item gives EXACT TEXT. Copy it letter by letter, in capitals exactly as
  given, with nothing added (no slogans, no extra words, no fake letters anywhere else).

ORIGINALITY / FORBIDDEN
- Do not imitate or reference any real casino, slot game, game studio, brand, logo, trademark, mascot,
  cartoon character, celebrity or copyrighted character, and no icons copied from real apps or operating
  systems. Everything must be 100% original.
- No real money: no banknotes, no $ EUR or other currency signs, no credit cards, no chips with values.
- No alcohol, no cigarettes, no violence, no kawaii/children's style, no anime, no flat vector clip-art,
  no photorealism, no pixel art.
- No watermark, no signature, no artist name, no random letters.

REFERENCE IMAGES
I attached approved images of this project: mockups (render quality, mood), the coin g_moneta_przod
(THE reference for gold colour, polish and light direction) and the digit sheet g_font_cyfry (THE
reference for the win-title lettering: same gold, bevel, extrusion and dark violet outline). Do not copy
their layout or text unless an item says so.

WORKFLOW PROTOCOL (very important)
1. Generate the images strictly in the numbered order of the IMAGE LIST, exactly ONE image per reply.
   Never put two IDs in one image, never make a collage, a contact sheet, variations or options.
   (SHEET items are one image that contains a grid - that is by design.)
2. In every reply write one short line ABOVE the image:  ID: <id> | <aspect> | <background>
   and nothing else - no explanations, no questions.
3. Use exactly the aspect ratio given for the item: 1:1 = 1024x1024, 3:2 = 1536x1024 landscape,
   2:3 = 1024x1536 portrait. Never change it.
4. Items marked EDIT follow the [EDIT] rules.
5. After each image STOP and wait for my command (commands are in Polish):
   DALEJ            = accepted; generate the next ID from the list.
   POPRAW: <notes>  = regenerate the SAME ID; keep everything that was right, fix only what I describe.
   NOWA WERSJA      = regenerate the SAME ID from scratch with a fresh take on the same brief.
   IDŹ DO: <id>     = jump to that ID (I use it when I come back later or skip an item).
   ZASADY           = re-read this whole first message (all rules) and apply it to the next image.
   STATUS           = reply with text only: which IDs are done and which remain. No image.
6. After the last item write only: KONIEC CZATU.

IMAGE LIST

--------------------------------------------------------------------
01/18  ID: g_ui_spin
ASPECT: 1:1 square (1024x1024) | BACKGROUND: ALFA | EXACT TEXT: none (icon only)
SUBJECT: the big round SPIN button of the slot games - the most important button; it must look
expensive and invite a touch.
COMPOSITION: a perfect circle about 84% of the canvas, centred, strictly frontal.
DESIGN: outer ring of mirror-polished gold, thickness about 12% of the radius, with 24 small notches
around its circumference (knurling like a luxury watch crown). Inside it a thin line of satin gold
separating the glass. Centre: a dome of dark smoked glass (#1E1442 at the top to #120B2A at the bottom)
with one diagonal glossy reflection in the upper-left quarter and a soft cyan inner glow rising from the
bottom inside the dome. Icon: two curved arrows chasing each other clockwise in a circle, glowing warm
gold (#FFE08A), about 45% of the dome diameter, slightly embossed.
LIGHT: key from the upper left on the ring; cyan rim on the ring's right edge.
MOOD: precious, tactile, premium.

--------------------------------------------------------------------
02/18  ID: g_ui_spin_stop
ASPECT: 1:1 square (1024x1024) | BACKGROUND: ALFA | EXACT TEXT: none (icon only)
EDIT of image 01 (g_ui_spin).
CHANGE ONLY THE ICON: replace the two circular arrows with a single rounded square ("stop" symbol) in
the same glowing warm gold, about 32% of the dome diameter, centred in the dome.
KEEP PIXEL-IDENTICAL: the ring, the 24 notches, the glass dome, its reflection, the cyan inner glow, the
size and position of the button on the canvas (the game cross-fades the two images in 120 ms).

--------------------------------------------------------------------
03/18  ID: g_ui_ikony
ASPECT: 3:2 landscape (1536x1024) | BACKGROUND: ALFA SHEET 4 columns x 3 rows
EXACT TEXT: none, except the single letter "i" on the info icon.
SUBJECT: 12 round icon buttons of the game interface - one family with the SPIN button.
EACH CELL: a complete round button, disc diameter about 70% of the cell height, centred: dark smoked
glass disc with the same diagonal reflection, a thin polished gold rim, and a bold, slightly embossed
gold glyph about 50% of the disc diameter. All 12 discs IDENTICAL (same size, rim and reflection) -
only the glyph changes. Glyphs: thick strokes, simple, readable at 24 px, no thin details.
ORDER:
  row 1: (1) autoplay - a circular arrow with a small "play" triangle inside; (2) turbo - a lightning
         bolt; (3) minus sign; (4) plus sign.
  row 2: (5) sound on - a speaker with two sound waves; (6) sound off - a speaker with a small "x";
         (7) info - a serif lowercase "i"; (8) menu - three horizontal bars.
  row 3: (9) lobby - a simple house; (10) close - an "x" cross; (11) settings - a gear wheel;
         (12) history - a clock face with a circular arrow turning left.
Strictly frontal, no perspective; transparent between the discs.

--------------------------------------------------------------------
04/18  ID: g_ui_panel
ASPECT: 1:1 square (1024x1024) | BACKGROUND: ALFA | TYPE: 9-SLICE | EXACT TEXT: none
SUBJECT: the frame of the modal windows (login, settings, paytable, bankruptcy, free-spins summary).
COMPOSITION: a square panel with slightly rounded corners, about 86% of the canvas, centred, strictly
frontal, symmetrical in both directions.
DESIGN: CORNERS - ornate gold filigree corner pieces (scrolls, a small diamond), each fitting inside
about 20% of the panel side. EDGES - between the corners a straight, plain, polished gold moulding with
a thin satin stripe, about 3% of the panel side thick, identical along its whole length. MIDDLE - plain,
uniform dark smoked glass (#1E1442), with no ornament, no reflection, no gradient, no texture.
LIGHT: the gold catches warm light from the upper left; thin cyan rim on the right edges.
MOOD: luxury hotel stationery in gold and glass.

--------------------------------------------------------------------
05/18  ID: g_ui_przycisk_glowny
ASPECT: 3:2 landscape (1536x1024) | BACKGROUND: ALFA | TYPE: 9-SLICE | EXACT TEXT: none
SUBJECT: the main action button (labels such as "Enter the casino" are added in HTML later).
COMPOSITION: a pill shape (rectangle with perfectly semicircular ends), about 85% of the canvas width
(about 1300 px) and about 33% of its height (about 340 px), centred, strictly frontal.
DESIGN: polished gold rim about 6% of the button height around the whole pill; the face is satin gold
with a smooth vertical gradient #FFE08A (top) to #F5C542 to #B8860B (bottom); a thin straight horizontal
gloss stripe near the top edge running the full length. The middle section must be identical along the
horizontal axis (it will be stretched). No text, no icon, no sparkle, no ornament.
LIGHT: warm key from the upper left (the left cap slightly brighter); thin cyan rim on the right cap.
MOOD: the most tempting button on the screen.

--------------------------------------------------------------------
06/18  ID: g_ui_przycisk_drugi
ASPECT: 3:2 landscape (1536x1024) | BACKGROUND: ALFA | TYPE: 9-SLICE | EXACT TEXT: none
EDIT of image 05 (g_ui_przycisk_glowny): exactly the same pill shape, size and position.
CHANGE ONLY THE MATERIAL: the face becomes dark smoked glass (#1E1442 at the top to #120B2A at the
bottom) with a brighter top edge (fresnel) and a soft inner glow uniform along the whole length; a thin
polished gold rim about 4% of the button height. Uniform along the horizontal axis. No text, no icon.

--------------------------------------------------------------------
07/18  ID: g_ui_ornament
ASPECT: 3:2 landscape (1536x1024) | BACKGROUND: ALFA | EXACT TEXT: none
SUBJECT: a horizontal gold filigree divider placed under headings.
COMPOSITION: a symmetrical horizontal ornament with a proportion of about 6:1, about 84% of the canvas
width, centred vertically and horizontally, frontal.
DESIGN: in the centre a tiny onion wearing a crown (the silhouette of the brand emblem) on a small
diamond; from it, to both sides, tapering spirals and acanthus leaves ending in small round dots.
Polished and satin gold, cyan rim on the right edges, a hint of magenta on lower edges.

--------------------------------------------------------------------
08/18  ID: g_win_big
ASPECT: 3:2 landscape (1536x1024) | BACKGROUND: ALFA
EXACT TEXT: two lines - "BIG" (first line) and "WIN" (second line). Letters: B-I-G and W-I-N.
SUBJECT: the BIG WIN title of the full-screen win celebration (level 1 of 4).
COMPOSITION: the two words stacked and centred, both lines with the same letter height; the text block
at most 84% of the canvas width and at most 80% of its height; a slight "smile" arc (the middle of each
line 4-6% higher than its ends).
LETTERING: heavy, massive capitals with classical serifs (close to Cinzel Black but heavier), extruded
mirror-polished gold, extrusion depth 8-10% of the letter height, bevelled front edges, front faces with
a vertical gradient #FFE08A to #F5C542 to #B8860B, a dark violet outline #1A0B33 (3-4% of the letter
height) around every letter. Exactly the same gold, bevel and outline as the attached digit sheet
g_font_cyfry - the win amount will stand right under this title.
DECORATION: only a few tiny star-shaped glints on the letter edges. No background, no light rays, no
coins (rays and particles are added in code).
MOOD: pure, heavy, triumphant gold.

--------------------------------------------------------------------
09/18  ID: g_win_mega
ASPECT: 3:2 landscape (1536x1024) | BACKGROUND: ALFA
EXACT TEXT: two lines - "MEGA" and "WIN". Letters: M-E-G-A and W-I-N.
EDIT of image 08 (g_win_big): same lettering style, extrusion, outline, arc and size of the text block.
CHANGE: the text, and the letters are now studded with rows of cut magenta rubies (#FF2E88) and cyan
sapphires (#21E6FF) set along the strokes; a gold laurel ribbon curves under the second line (inside the
margin). Richer and stronger than BIG WIN.

--------------------------------------------------------------------
10/18  ID: g_win_epic
ASPECT: 3:2 landscape (1536x1024) | BACKGROUND: ALFA
EXACT TEXT: two lines - "EPIC" and "WIN". Letters: E-P-I-C and W-I-N.
EDIT of image 08 (g_win_big): same lettering style, extrusion, outline, arc and size of the text block.
CHANGE: the text; the gold letters get dark violet metal inlays; stylised violet flames (#8F3DFF with
magenta #FF2E88 cores) lick the letters from below. The flames are compact, opaque in their cores and
end well inside the 6% margin (no smoke, no haze).

--------------------------------------------------------------------
11/18  ID: g_win_ultra
ASPECT: 3:2 landscape (1536x1024) | BACKGROUND: ALFA
EXACT TEXT: two lines - "ULTRA" and "WIN". Letters: U-L-T-R-A and W-I-N.
EDIT of image 08 (g_win_big): same letter shapes, outline, arc and size of the text block.
CHANGE: the text; the letter faces are made of rainbow faceted crystal (spectrum cyan #21E6FF to violet #8F3DFF
to magenta #FF2E88 to gold #FFE08A, with white sparkles) held in polished gold frames; a small gold
crown with gems floats above the first line; a few crystal shards float around the words; rainbow
dispersion on facet edges. The most spectacular of all titles, still clean and readable.

--------------------------------------------------------------------
12/18  ID: g_win_free_spins
ASPECT: 3:2 landscape (1536x1024) | BACKGROUND: ALFA
EXACT TEXT: two lines - "FREE" and "SPINS". Letters: F-R-E-E and S-P-I-N-S.
EDIT of image 08 (g_win_big): same lettering style, extrusion, outline, arc and size of the text block.
CHANGE: the text; a cyan-turquoise glow shines from inside the letters (as if lit from within) and a few
small four-point stars sparkle around them. Calmer than MEGA WIN (it appears more often).

--------------------------------------------------------------------
13/18  ID: g_fx_promienie
ASPECT: 1:1 square (1024x1024) | BACKGROUND: CZARNE (pure black #000000) | EXACT TEXT: none
SUBJECT: god rays - a radial burst of light beams for behind win titles (the game rotates it slowly).
DESIGN: 18-24 soft light beams of uneven width and length radiating from the EXACT centre of the canvas,
spread evenly around the full 360 deg. Colour warm white #FFF3D1 fading smoothly to black. A small soft
core no larger than 10% of the canvas diameter (no big white disc). Every beam fades to pure black before
a radius of 42% of the canvas width, so the outer 8% is pure black.
NOTHING ELSE: no sparkles, no stars, no smoke.

--------------------------------------------------------------------
14/18  ID: g_fx_flara
ASPECT: 1:1 square (1024x1024) | BACKGROUND: CZARNE (pure black #000000) | EXACT TEXT: none
SUBJECT: a lens flare star for flashes (symbol landings, win hits).
DESIGN: centred: a hot white core about 3-4% of the canvas; four long thin arms (horizontal and
vertical) and four shorter diagonal arms; a thin faint halo ring at about 25% of the flare radius; a
delicate horizontal anamorphic streak. Neutral white. All arms fade to pure black before the 8% margin.
No lens ghosts, no coloured circles in the corners.

--------------------------------------------------------------------
15/18  ID: g_fx_iskry
ASPECT: 3:2 landscape (1536x1024) | BACKGROUND: CZARNE SHEET 4 columns x 2 rows | EXACT TEXT: none
SUBJECT: 8 particle textures (sparks and glints) - white with a slightly warm core.
ORDER: row 1: (1) four-point star glint; (2) six-point star glint; (3) soft round light orb;
(4) thin cross glint. Row 2: (5) diamond-shaped flash; (6) elongated spark streak (diagonal);
(7) a cluster of 5-7 micro sparks; (8) thin flash ring.
Each element centred in its cell, about 60-70% of the cell's shorter side, with at least 10% pure black
around it; glows fade to black inside the cell. Pure black everywhere else.

--------------------------------------------------------------------
16/18  ID: g_fx_blyskawice
ASPECT: 3:2 landscape (1536x1024) | BACKGROUND: CZARNE SHEET 3 columns x 1 row | EXACT TEXT: none
SUBJECT: 3 lightning bolts / energy discharges.
DESIGN: each cell holds one vertical lightning bolt about 80% of the cell height, with 2-4 side branches;
bright white core with a cool bluish-white glow. Each of the three has a different shape and
brightness. At least 10% pure black at the top and bottom of every cell; glows fade to black inside the
cell; bolts never cross into another cell.

--------------------------------------------------------------------
17/18  ID: g_fx_dym
ASPECT: 1:1 square (1024x1024) | BACKGROUND: CZARNE (pure black #000000) | EXACT TEXT: none
SUBJECT: a soft cloud of smoke/mist for transitions and the big-win entrance.
DESIGN: one soft volumetric cloud with an irregular, billowing outline, about 75% of the canvas,
centred. Grey-white, maximum brightness about 70% (around #B3B3B3 - never pure white), denser in the
middle, edges dissolving softly into pure black before the 8% margin. No hard edges, no sparks.

--------------------------------------------------------------------
18/18  ID: g_fx_konfetti
ASPECT: 3:2 landscape (1536x1024) | BACKGROUND: ALFA SHEET 4 columns x 3 rows | EXACT TEXT: none
SUBJECT: 12 confetti pieces of metallic foil, each with one sharp highlight.
ORDER AND COLOURS (gold = the gold ramp, magenta #FF2E88, cyan #21E6FF):
  row 1: (1) gold foil rectangle, tilted; (2) magenta foil rectangle, other angle; (3) cyan foil
         rectangle, slightly curled; (4) gold foil rectangle, seen almost edge-on.
  row 2: (5) gold twisted streamer; (6) magenta twisted streamer; (7) cyan twisted streamer;
         (8) gold five-point star.
  row 3: (9) magenta five-point star; (10) gold round disc; (11) magenta twisted ribbon;
         (12) cyan diamond.
Each piece centred in its cell, about 40-70% of the cell, at least 10% margin; transparent background
(these are drawn with normal blending, not on black).

Start now with image 01.
```

### 5.2. Checklista czatu 2

**Pliki:** 18 plików w `global/`; 1:1 = 1024×1024, 3:2 = 1536×1024.

- [ ] **SPIN i STOP:** idealne koło ~84% kadru, frontalnie; 24 nacięcia na pierścieniu; kopuła z ciemnego szkła;
      w `g_ui_spin_stop` zmieniła się **tylko ikona** (zaokrąglony kwadrat) — położ oba pliki jeden na drugim
      i przełączaj: pierścień i refleks nie mogą „skakać”.
- [ ] **Ikony:** siatka 4×3, kolejność `autoplay turbo minus plus / dźwięk wł. dźwięk wył. info menu /
      lobby zamknij ustawienia historia`; wszystkie dyski identyczne; jedyny tekst to „i”; czytelne w 24 px.
- [ ] **Panel:** ornamenty tylko w rogach (każdy w ~20% boku), proste krawędzie jednakowe na całej długości,
      **środek jednolity** (zakryj rogi palcami — środek ma wyglądać jak gładka szyba).
- [ ] **Przyciski:** pigułka ~85% × ~33% kadru, frontalnie, bez tekstu; przesuń wzrokiem wzdłuż środka — żadnych
      plamek, iskier, zmian faktury; `przycisk_drugi` ma ten sam kształt i rozmiar co `przycisk_glowny`.
- [ ] **Ornament:** symetryczny, proporcja ~6:1, w środku sylwetka cebuli w koronie.
- [ ] **Napisy wygranych:** dokładnie `BIG/WIN`, `MEGA/WIN`, `EPIC/WIN`, `ULTRA/WIN`, `FREE/SPINS` (dwa wiersze,
      litera po literze); ten sam krój, kontur i wielkość bloku we wszystkich pięciu (połóż je obok siebie);
      litery pasują do `g_font_cyfry`; bez promieni i tła; płomienie EPIC i kryształy ULTRA w marginesie;
      eskalacja widoczna: BIG < MEGA < EPIC < ULTRA.
- [ ] **Efekty `CZARNE`:** tło czysto czarne (bez winiety i szumu), efekt neutralnie biały (nie złoty, nie kolorowy),
      wygasa przed krawędzią (≥ 8% czerni); promienie wychodzą z dokładnego środka, rdzeń mały; flara bez „duchów”
      w rogach; dym nie jest białą plamą (max ~70% jasności).
- [ ] **Arkusze efektów:** iskry 4×2 (8 różnych kształtów w kolejności), błyskawice 3×1 (3 różne), konfetti 4×3
      (kolory: 5 × złoto, 4 × magenta, 3 × cyjan, tło przezroczyste); nic nie wchodzi do sąsiedniej komórki.

---

## 6. Czat 3: S1 „Cebulowy 777” (14 obrazów)

**Cel:** komplet grafiki pierwszej grywalnej gry (P0): 8 symboli, ramka automatu 3×3, logo, tła desktop i mobile,
okładka kafla i baner do lobby. Ta gra wyznacza poziom jakości dla S2 i S3 ([01 § 9](01-kierunek-artystyczny.md#9-gra-s1-cebulowy-777)).

**Załącz na początku:** `m05_s1_desktop`, `g_moneta_przod`, `g_ui_spin`.
**Kolejność:** najpierw symbol najwyższy (`siodemka`) jako kotwica zestawu, potem WILD i reszta symboli, potem logo
(potrzebne na okładce), ramka i tła.

| # | ID | Format | Tło | Edycja z | Tekst na obrazie |
|---|---|---|---|---|---|
| 01 | `s1_sym_siodemka` | 1:1 | ALFA | — | `7` |
| 02 | `s1_sym_wild` | 1:1 | ALFA | styl z 01 | `WILD` |
| 03 | `s1_sym_bar` | 1:1 | ALFA | styl z 01 | `BAR` |
| 04 | `s1_sym_dzwonek` | 1:1 | ALFA | styl z 01 | brak |
| 05 | `s1_sym_wisnie` | 1:1 | ALFA | styl z 01 | brak |
| 06 | `s1_sym_cytryna` | 1:1 | ALFA | styl z 01 | brak |
| 07 | `s1_sym_sliwka` | 1:1 | ALFA | styl z 01 | brak |
| 08 | `s1_sym_arbuz` | 1:1 | ALFA | styl z 01 | brak |
| 09 | `s1_logo` | 3:2 | ALFA | — | `CEBULOWY` / `777` |
| 10 | `s1_ramka` | 1:1 | ALFA (okno) | — | brak |
| 11 | `s1_tlo_desktop` | 3:2 | PELNE | — | brak |
| 12 | `s1_tlo_mobile` | 2:3 | PELNE | 11 | brak |
| 13 | `s1_okladka` | 2:3 | PELNE | logo z 09, WILD z 02 | `CEBULOWY 777` (tylko jako logo) |
| 14 | `s1_baner` | 3:2 | PELNE | WILD z 02 | brak |

Wszystkie obrazy czatu 3 mają priorytet **P0**.

### 6.1. Blok do wklejenia — czat 3

```text
ROLE
You are the lead art director and a senior 3D artist of a AAA mobile slot game studio. You create final,
production-ready game assets with your image generation tool. You follow technical specifications
exactly, keep one consistent style across the whole set and never improvise extra elements.

PROJECT
"Cebulion Casino" is a casino SIMULATOR built by three university students as a course project: a web
game with a fictional currency only - the golden "cebulion" coin. No real money, no prizes. Brand idea:
a premium, dark luxury casino with a wink - the humble onion ("cebula" in Polish) treated as royal
luxury. Every image you make is ONE separate asset. Programmers will cut it, animate it and combine it
in a web game (HTML + PixiJS). Reel spinning, win animations, particles, flashes, cast shadows, win lines
and all interface text are added later in code, so the images must be clean, isolated and exactly to
spec.

THIS CHAT: Chat 3 of 6 - slot game "Cebulowy 777" - 14 images.
THE GAME: a classic 3 reels x 3 rows slot with 5 paylines, fast and joyful. Theme: a night in retro Las
Vegas - buzzing neon, gleaming chrome, a synthwave sun setting behind the machine. A blend of 1950s-60s
Vegas signs (light bulbs, atomic-age stars, chrome) with 1980s synthwave (perspective grid, striped
sun, hot pink and electric blue). This is the only game where neon may cover bigger areas.
Symbols (low to high): cherries, lemon, plum, watermelon, bell, BAR, seven; WILD = the Golden Onion.

STYLE DNA (Cebulion Casino): premium dark luxury casino, high-end stylized 3D render in the quality of
top mobile slot games. Warm yellow mirror-polished gold (not copper, not rose gold, not lemon), satin
brushed gold, dark smoked glass, deep navy-violet blacks (#07060F, #120B2A, #1E1442), small accents of
neon magenta (#FF2E88) and cyan (#21E6FF). Cinematic studio lighting: warm key light from the upper
left, soft lavender fill from the right, thin cool cyan rim light on the right edges, subtle magenta
rim on the lower left. Clean bevels, bold readable silhouette, rich but controlled detail, subtle
tight glow. Not photorealistic, not flat vector, not a cartoon for kids, no anime.
ALWAYS: no text unless specified, no watermark, no signature, no cast shadow, no floor, no reflection
below the object, no painted checkerboard, nothing cropped by the image edge.

GAME PALETTE (hex)
- S1 night #0B0624 (top of the sky, reel backing), synthwave violet #3A0CA3, hot pink neon #FF2E88,
  electric cyan neon #21E6FF, neon ultramarine #2B6BFF (grid, far neons), sunset #FF7A3D to #FFD04D,
  chrome light #E6ECF5 / chrome shadow #6B7590, seven red #E3122B.
- Gold ramp (the only gold): #FFF6D6, #FFE08A, #F5C542, #B8860B, #5C3A00, #2B1A00 - warm yellow,
  matching the attached coin.
- Never as dominant colours: green #3DFF8F, red #FF4D4D (UI meaning). Fruit greens are leaf greens.

LIGHTING AND CAMERA (this game's variant of the global scheme)
- Key: warm-neutral white ~4500 K from the UPPER LEFT; speculars in the upper-left quarter of forms.
- Fill: soft lavender (#6E64B8) from the front right, 20-30%; shadows violet, never black.
- Main rim: cyan #21E6FF on the RIGHT edges (2-4% of the object width).
- Accent rim: hot pink #FF2E88 from the lower left, stronger than usual (up to 70% of the key) - neon.
- Chrome always reflects pink and blue neon.
- Symbols: about 85 mm lens, frontal, three-quarter turn at most 15 deg, camera 5-10 deg above centre;
  ALL symbols with the same camera angle (a hint of the top surface and thickness visible).
- Frame: strictly frontal orthographic, no perspective. Logo: frontal.
- Backgrounds: 24-35 mm lens at eye level, vanishing point centred horizontally.

MATERIALS
- Candy enamel (fruits, seven): saturated colour under a thick clear coat, one large soft white
  highlight, no realistic peel pores.
- Polished chrome: mirror, cool, reflecting pink and blue neon.
- Neon glass tube: white-hot core with a tight coloured glow right around the tube.
- Mirror-polished warm gold (bell, WILD, frame of the seven); black lacquer (BAR plaque).
- Layered golden onion skin (WILD): metallic gold layers, pearlescent sheen, subsurface glow on edges.
Forms about 20% chunkier and juicier than real life; max 3 levels of detail; the smallest detail at
least 1/100 of the symbol size (symbols are shown at 100-220 px). No pores, scratches or dirt. NO black
cartoon outlines - objects separate from the background by rim light and edge darkening.

SYMBOL RULES
- Hierarchy must be felt at a glance: LOW (fruits) = enamel, 2 levels of detail, one dominant colour,
  about 80% of the canvas; HIGH (bell, BAR, seven) = metal, inlays, 3 levels of detail, about 82-84%;
  SPECIAL (WILD) = gold + neon + text, the brightest symbol, about 85%, a compact aura (max 6%).
- Every symbol must read in 1 second when shrunk to 64 px and must have a unique silhouette.
- Symbols stand upright (tilt at most +-10 deg; the italic seven is the exception).
- Each symbol has a clear dominant colour; the upper-left part is bright (the code runs a shine there).

TECHNICAL RULES BY BACKGROUND TYPE (each item says which one applies)

[ALFA] = TRUE TRANSPARENT BACKGROUND
- Output a PNG with a real alpha channel: every background pixel is fully transparent.
- Do NOT paint a grey-and-white checkerboard to imitate transparency. No white, grey, black or coloured
  backdrop, no gradient, no scenery behind the object.
- One object, centred on its optical centre, filling 80-85% of the canvas (the item gives the value).
  Keep at least 6% empty margin on all four sides. Nothing may touch or be cut by the canvas edge.
- No cast shadow, no contact shadow, no floor, no reflection under the object.
- Only a subtle, tight glow (reach at most 4-6% of the object size) fading out completely inside the
  margin. Neon glow stays tight around the tubes. No fog or haze over the canvas.
- Clean anti-aliased edges, no white, grey or coloured halo around the silhouette.
- No text unless the item gives EXACT TEXT.

[FRAME] = REEL FRAME WITH A WINDOW (ALFA)
- Strictly frontal orthographic view, no perspective, perfectly symmetrical left-right.
- In the frame's centre a FULLY TRANSPARENT RECTANGULAR WINDOW (alpha = 0) with perfectly straight
  horizontal and vertical edges, in the exact proportion given. Inside the window: NOTHING - no glass,
  no reflections, no reels, no symbols, no dividers between reels, no backdrop.
- Everything outside the frame is transparent too. The frame keeps the 6% margin to the canvas edges.
- The inner edge of the window is a crisp, straight, thin trim; nothing protrudes into the window.

[PELNE] = FULL-BLEED IMAGE (backgrounds, cover, banner)
- Painted edge to edge: no border, no frame around the picture, no rounded corners, no letterbox bars.
- No text, letters, numbers, logos or UI unless the item gives EXACT TEXT. Signs stay blank (shapes and
  bulbs only). No people. Game backgrounds contain NO slot machine, NO reels, NO frame, NO symbols.
- Follow the composition zones in the item: where the reels or the interface will sit is the darkest,
  calmest part; light sources and rich detail stay at the sides and top. Keep everything important
  inside the safe area given in the item (screens crop the edges).
- Smooth gradients without banding; avoid fine repetitive patterns (moire). Background saturation and
  brightness stay below the symbols'.

[EDIT] items
- Use the named earlier image from this chat as the base (or as the exact design reference). Keep
  everything identical except the changes listed in the item.
- If I attach an image together with "IDŹ DO: <id>", that attached image is the base for the EDIT.
- The result keeps the item's exact aspect ratio and background type.

TEXT ON IMAGES
- Render text ONLY where an item gives EXACT TEXT. Copy it letter by letter, in capitals exactly as
  given, with nothing added. Letters on symbols at least 18% of the symbol height. All text in this game
  uses bold, rounded retro sign letters (the character of the Bungee typeface).

ORIGINALITY / FORBIDDEN
- Do not imitate or reference any real casino, slot game, game studio, Las Vegas landmark sign, brand,
  logo, trademark, mascot, cartoon character, celebrity or copyrighted character. 100% original.
- No real money: no banknotes, no $ EUR or other currency signs, no credit cards, no chips with values.
- No alcohol, no cigarettes, no violence, no kawaii/children's style, no anime, no flat vector clip-art,
  no photorealism, no pixel art.
- No watermark, no signature, no artist name, no random letters.

REFERENCE IMAGES
I attached approved images of this project: the screen mockup of this game (mood, neon, contrast,
quality), the coin g_moneta_przod (THE reference for gold and light direction) and the SPIN button
g_ui_spin (gold + glass, UI detail level). Match their gold, light and render quality. Do not copy their
layout or text unless an item says so.

WORKFLOW PROTOCOL (very important)
1. Generate the images strictly in the numbered order of the IMAGE LIST, exactly ONE image per reply.
   Never put two IDs in one image, never make a collage, a contact sheet, variations or options.
2. In every reply write one short line ABOVE the image:  ID: <id> | <aspect> | <background>
   and nothing else - no explanations, no questions.
3. Use exactly the aspect ratio given for the item: 1:1 = 1024x1024, 3:2 = 1536x1024 landscape,
   2:3 = 1024x1536 portrait. Never change it.
4. Symbols 02-08: in exactly the same style, lighting, camera and level of finish as image 01.
   Items marked EDIT follow the [EDIT] rules.
5. After each image STOP and wait for my command (commands are in Polish):
   DALEJ            = accepted; generate the next ID from the list.
   POPRAW: <notes>  = regenerate the SAME ID; keep everything that was right, fix only what I describe.
   NOWA WERSJA      = regenerate the SAME ID from scratch with a fresh take on the same brief.
   IDŹ DO: <id>     = jump to that ID (I use it when I come back later or skip an item).
   ZASADY           = re-read this whole first message (all rules) and apply it to the next image.
   STATUS           = reply with text only: which IDs are done and which remain. No image.
6. After the last item write only: KONIEC CZATU.

IMAGE LIST

--------------------------------------------------------------------
01/14  ID: s1_sym_siodemka
ASPECT: 1:1 square (1024x1024) | BACKGROUND: ALFA | EXACT TEXT: "7" (one digit)
SUBJECT: the highest symbol - the lucky seven. This image sets the style for the whole symbol set.
DESIGN: a massive, chunky italic digit 7 of glossy cherry-red candy enamel (#E3122B) inside a thick,
bevelled, mirror-polished gold frame that follows the digit's outline; a thin white-hot neon line runs
inside the enamel along the strokes; two small four-point sparkle stars at the upper-right corner and
the lower-left foot of the digit.
COMPOSITION: about 84% of the canvas height, centred on its optical centre, italic slant allowed.
LIGHT: key from the upper left (big soft highlight on the enamel upper-left), cyan rim on the right edges
of the gold frame, strong pink rim on the lower left.
MOOD: the jackpot symbol - rich, glossy, iconic.

--------------------------------------------------------------------
02/14  ID: s1_sym_wild
ASPECT: 1:1 square (1024x1024) | BACKGROUND: ALFA | EXACT TEXT: "WILD" (letters W-I-L-D)
SUBJECT: the special WILD symbol - the Golden Onion.
DESIGN: a plump onion made of layered, mirror-polished golden onion skin with a pearlescent sheen and a
playfully curled tip; behind it a thin circular neon ring that shifts from hot pink #FF2E88 (left) to
cyan #21E6FF (right). Across the lower third runs a black lacquer ribbon with chrome edges, carrying the
word WILD in pink neon tube letters with white-hot cores (bold rounded retro sign letters), letters at
least 20% of the symbol height.
COMPOSITION: about 85% of the canvas, centred; compact neon aura no wider than 6% of the symbol.
LIGHT: same as image 01; the brightest symbol of the game.
MOOD: magical, golden, electric.

--------------------------------------------------------------------
03/14  ID: s1_sym_bar
ASPECT: 1:1 square (1024x1024) | BACKGROUND: ALFA | EXACT TEXT: "BAR" (letters B-A-R)
SUBJECT: the classic BAR symbol (high).
DESIGN: a thick rectangular plaque of glossy black lacquer in a bevelled polished chrome frame; on it the
raised word BAR in chunky chrome letters (bold rounded retro sign letters) outlined with a thin hot-pink
neon tube; the chrome reflects pink and blue neon. Letters about 30% of the canvas height.
COMPOSITION: wide object - about 84% of the canvas width, centred vertically.
LIGHT: same as image 01.

--------------------------------------------------------------------
04/14  ID: s1_sym_dzwonek
ASPECT: 1:1 square (1024x1024) | BACKGROUND: ALFA | EXACT TEXT: none
SUBJECT: the golden bell (high).
DESIGN: a classic bell silhouette of mirror-polished gold with an engraved decorative band around its
waist and the clapper visible underneath; on top a red satin bow (#E3122B) with soft long highlights.
COMPOSITION: about 82% of the canvas, centred.
LIGHT: same as image 01; dark reflections in the polished gold, cyan rim on the right.

--------------------------------------------------------------------
05/14  ID: s1_sym_wisnie
ASPECT: 1:1 square (1024x1024) | BACKGROUND: ALFA | EXACT TEXT: none
SUBJECT: a pair of cherries (low 1).
DESIGN: two plump, juicy dark-red cherries (#C8102E) of glossy candy enamel hanging from one forked
green stem with a single leaf; a round white highlight on each cherry and a thin hot-pink neon rim on
their lower-left edges.
COMPOSITION: about 80% of the canvas, centred; silhouette = two circles plus a "V" stem.
LIGHT: same as image 01.

--------------------------------------------------------------------
06/14  ID: s1_sym_cytryna
ASPECT: 1:1 square (1024x1024) | BACKGROUND: ALFA | EXACT TEXT: none
SUBJECT: a lemon (low 2) - the brightest fruit.
DESIGN: a plump lemon with pointed ends lying horizontally, bright yellow candy enamel (#FFD23F) with a
subtle stylised peel texture, a small green leaf at one end; cyan rim light on its right edge.
COMPOSITION: about 80% of the canvas width, centred; silhouette = horizontal oval with tips.
LIGHT: same as image 01. Do not confuse its yellow with the gold of the bell.

--------------------------------------------------------------------
07/14  ID: s1_sym_sliwka
ASPECT: 1:1 square (1024x1024) | BACKGROUND: ALFA | EXACT TEXT: none
SUBJECT: a plum (low 3) - the darkest fruit.
DESIGN: a big plum (#7B2CBF) with a clear vertical groove, a short stem and one leaf, a soft milky bloom
on its top half and pink-violet reflections on its edges.
COMPOSITION: about 80% of the canvas, centred; silhouette = one upright oval with a groove.
LIGHT: same as image 01; keep it readable (not too dark) - violet, not black.

--------------------------------------------------------------------
08/14  ID: s1_sym_arbuz
ASPECT: 1:1 square (1024x1024) | BACKGROUND: ALFA | EXACT TEXT: none
SUBJECT: a watermelon slice (low 4) - the widest fruit.
DESIGN: a thick half-circle slice standing on its rind: dark green striped rind, a pale green band,
juicy red flesh with glossy black seeds arranged in an arc; candy-enamel gloss on the flesh.
COMPOSITION: about 84% of the canvas width, centred vertically.
LIGHT: same as image 01.

--------------------------------------------------------------------
09/14  ID: s1_logo
ASPECT: 3:2 landscape (1536x1024) | BACKGROUND: ALFA
EXACT TEXT: two lines - "CEBULOWY" (first line) and "777" (second line, larger).
  Letters: C-E-B-U-L-O-W-Y and the digits 7-7-7. No other text.
SUBJECT: the game logo, placed above the reel frame.
DESIGN: line 1 - CEBULOWY in bold, rounded retro sign letters made of hot-pink neon tubes with
white-hot cores, outlined by a thin cyan neon tube; behind the letters a dark chrome sign board shaped
like a classic sign, with small warm light bulbs around its edge. Line 2 - 777, larger, chunky 3D
digits of cherry-red enamel and chrome with a gold outline, slightly italic, with 2-3 sparkle stars.
COMPOSITION: whole logo about 84% of the canvas width, centred, at least 6% margin; neon glow tight (at
most 6% of the letter height) and inside the margin.
MOOD: a glowing roadside sign of a legendary casino night.

--------------------------------------------------------------------
10/14  ID: s1_ramka
ASPECT: 1:1 square (1024x1024) | BACKGROUND: ALFA | TYPE: FRAME | EXACT TEXT: none
WINDOW: a fully transparent SQUARE window (proportion exactly 1:1 - it will hold 3x3 square symbols),
about 62% of the canvas width (about 640x640 px), centred horizontally; it may sit up to 4% lower than
the vertical centre to leave room for the crest.
SUBJECT: the slot machine cabinet frame around the reels.
DESIGN: a thick cabinet frame of polished chrome with rounded outer corners; a thin gold trim right at
the window edge; a hot-pink neon tube along the outer edge and a cyan neon tube along the inner edge;
on top a crest arch with a row of evenly glowing warm-white light bulbs and an atomic-age star in the
middle (no plaque, no sign, no text - the logo is added separately); at the bottom a chrome shelf with
two small star-shaped rivets.
STRICTLY: strictly frontal, symmetrical, the window 100% empty and transparent (no glass, no
reflections, no reel dividers), the whole frame inside the 6% margin, nothing outside the frame.

--------------------------------------------------------------------
11/14  ID: s1_tlo_desktop
ASPECT: 3:2 landscape (1536x1024) | BACKGROUND: PELNE | EXACT TEXT: none
SUBJECT: the game background - retro Las Vegas at night in synthwave style. The slot frame will be
placed in front of it by the code, so there is NO machine in this image.
COMPOSITION ZONES:
- Top band (y 0-12%): dark and calm (the logo goes here).
- Reel zone (x 18-82%, y 12-80%): the darkest, calmest area with minimal detail. The horizon lies at
  about 50% of the height. A striped retro sun rises from the horizon in the centre BEHIND where the
  machine will stand: only its glowing arcs show above and around the reel zone; directly behind the
  centre the sun is dimmed and the sky dark.
- Sky: gradient from #0B0624 at the top through #3A0CA3 to a pink-orange glow at the horizon, a few
  sparse stars.
- Sides (x 0-18% and 82-100%): palm silhouettes, blank neon arrow and star signs with light bulbs (no
  letters), chrome poles, pink and blue neon - the most detail and light sources are here. Optionally in
  the top-left corner a neon sign shaped like an onion (shape only).
- Floor: a perspective neon grid (#2B6BFF lines with pink horizontal lines) converging to the centre;
  in the control panel zone (y 80-100%) it fades to #07060F.
Keep important elements inside x 6-94%, y 9-91%. Corner vignette about 20%.
MOOD: neon nostalgia, warm night air, electric.

--------------------------------------------------------------------
12/14  ID: s1_tlo_mobile
ASPECT: 2:3 portrait (1024x1536) | BACKGROUND: PELNE | EXACT TEXT: none
EDIT of image 11 (s1_tlo_desktop): recompose (do not stretch) the same scene vertically for phones.
ZONES: top bar (y 0-10%) dark; the sun and its glow in the band y 10-20% (above the reels, behind the
logo); reel zone (x 4-96%, y 20-66%) the darkest and calmest; palms and signs close to the left and right
edges (phones may crop up to 15% on each side); the neon grid floor from about 66% downward, dark under
the control panel (to #07060F at the bottom). Keep important elements inside x 16-84%, y 6-94%.
KEEP IDENTICAL: colours, light, style, mood. No machine, no text.

--------------------------------------------------------------------
13/14  ID: s1_okladka
ASPECT: 2:3 portrait (1024x1536) | BACKGROUND: PELNE
EXACT TEXT: only the game logo - "CEBULOWY" and "777" - exactly as in image 09 (same lettering).
SUBJECT: the key art cover for the game tile in the lobby.
COMPOSITION: the logo from image 09 in the band y 8-30%; in the centre (y 30-85%) the Golden Onion WILD
from image 02 (same design, without its WILD ribbon text) bursting through a pink-cyan neon ring, with
cherries, red sevens and sparks flying around it; behind: the striped synthwave sun and the neon grid;
the bottom 15% fades to #07060F (HTML labels go there). Everything important at least 5% from the edges.
MOOD: a poster that makes you want to tap and play.

--------------------------------------------------------------------
14/14  ID: s1_baner
ASPECT: 3:2 landscape (1536x1024) | BACKGROUND: PELNE | EXACT TEXT: none (no logo, no letters)
SUBJECT: a wide banner / video poster for the lobby carousel.
COMPOSITION: in the RIGHT ~60% the Golden Onion (as in image 02, without any text) inside a glowing
pink-cyan neon ring, with a fountain of red sevens, cherries and four-point stars; in the LEFT ~40% a dark,
calm synthwave sky with the sun low at the horizon - empty space for an HTML title and button.
Important elements inside x 6-94%, y 9-91%.
MOOD: energetic, glowing, inviting.

Start now with image 01.
```

### 6.2. Checklista czatu 3

**Pliki:** 14 plików w `s1/`; 1:1 = 1024×1024, 3:2 = 1536×1024, 2:3 = 1024×1536.

- [ ] Symbole: prawdziwa przezroczystość, brak cienia i podłogi, margines ≥ 6%, poświata neonu zwarta i w marginesie.
- [ ] Teksty: dokładnie `7`, `WILD`, `BAR` — litera po literze (np. nie `WIID`, nie `BARR`); litery ≥ 18% wysokości symbolu.
- [ ] Wszystkie symbole z tym samym kątem kamery i światłem z lewej-góry; brak czarnych konturów jak w kreskówce.
- [ ] Hierarchia: owoce (emalia, prostsze) < dzwonek/BAR/siódemka (metal, więcej detalu) < WILD (najjaśniejszy).
- [ ] Test 64 px: zmniejsz każdy symbol — rozpoznajesz go w sekundę; sylwetki się nie powtarzają
      (dwa koła + „V”, owal z czubkami, owal z bruzdą, półkole, dzwon, prostokąt, ukośna „7”, cebula ze wstęgą).
- [ ] Test skali szarości: śliwka i BAR (najciemniejsze) różnią się kształtem; cytryna i dzwonek (najjaśniejsze)
      różnią się kształtem; cytryna nie wygląda jak złoto.
- [ ] Logo: `CEBULOWY` + `777` (bez polskich znaków), różowy neon z cyjanowym obrysem, zwarta poświata.
- [ ] Ramka: okno **kwadratowe** (sprawdź: szerokość = wysokość ±3%), w 100% przezroczyste, bez szyby i przegródek,
      frontalnie bez perspektywy; grzebień z żarówkami **bez** tabliczki i napisu; cała ramka w marginesie.
- [ ] Tła: **brak automatu, bębnów i ramki**; środek (strefa bębnów) najciemniejszy; słońce za środkiem przygaszone;
      szyldy bez liter; wersja mobile przekomponowana (słońce w pasie y 10–20%).
- [ ] Okładka: logo w górnej części (y 8–30%) takie samo jak `s1_logo`, Złota Cebula w centrum, dół przechodzi w czerń.
- [ ] Baner: bohater po **prawej**, lewe ~40% ciemne i puste, bez żadnego tekstu.

---

## 7. Czat 4: S2 „Złoty Faraon” (22 obrazy)

**Cel:** komplet grafiki wideo-slotu 5×3: 12 symboli, rozszerzony WILD, logo, ramka 5×3, cztery tła (gra bazowa
i darmowe spiny, desktop i mobile), okładka, baner i świecące hieroglify. Styl: skarbiec grobowca w świetle pochodni,
a w darmowych spinach chłodna noc nad piramidami ([01 § 10](01-kierunek-artystyczny.md#10-gra-s2-złoty-faraon)).

**Załącz na początku:** `m05_s1_desktop`, `m06_s2_desktop`, `g_moneta_przod`, `g_ui_spin`. Jeśli neonowy róż
z makiety S1 przecieka do symboli Egiptu — poprawka P6 z § 9, a w razie potrzeby nowy czat bez `m05` (§ 1.5).

**Kolejność:** najwyższy symbol (`faraon`) jako kotwica zestawu, potem symbole specjalne i wysokie, potem litery
(pierwsza — `a` — ustala krój pozostałych), rozszerzony WILD, logo, ramka, tła, okładka, baner, efekty.

| # | ID | Format | Tło | Edycja z | Tekst na obrazie |
|---|---|---|---|---|---|
| 01 | `s2_sym_faraon` | 1:1 | ALFA | — | brak |
| 02 | `s2_sym_wild` | 1:1 | ALFA | styl z 01 | `WILD` |
| 03 | `s2_sym_scatter` | 1:1 | ALFA | styl z 01 | `SCATTER` |
| 04 | `s2_sym_anubis` | 1:1 | ALFA | styl z 01 | brak |
| 05 | `s2_sym_skarabeusz` | 1:1 | ALFA | styl z 01 | brak |
| 06 | `s2_sym_oko` | 1:1 | ALFA | styl z 01 | brak |
| 07 | `s2_sym_ankh` | 1:1 | ALFA | styl z 01 | brak |
| 08 | `s2_sym_a` | 1:1 | ALFA | styl z 01 | `A` |
| 09 | `s2_sym_k` | 1:1 | ALFA | krój z 08 | `K` |
| 10 | `s2_sym_q` | 1:1 | ALFA | krój z 08 | `Q` |
| 11 | `s2_sym_j` | 1:1 | ALFA | krój z 08 | `J` |
| 12 | `s2_sym_10` | 1:1 | ALFA | krój z 08 | `10` |
| 13 | `s2_wild_rozszerzony` | 2:3 | ALFA | relikwia z 02 | `WILD` |
| 14 | `s2_logo` | 3:2 | ALFA | — | `ZŁOTY` / `FARAON` |
| 15 | `s2_ramka` | 3:2 | ALFA (okno 5:3) | — | brak |
| 16 | `s2_tlo_desktop` | 3:2 | PELNE | — | brak |
| 17 | `s2_tlo_mobile` | 2:3 | PELNE | 16 | brak |
| 18 | `s2_tlo_fs_desktop` | 3:2 | PELNE | układ z 16 | brak |
| 19 | `s2_tlo_fs_mobile` | 2:3 | PELNE | układ z 17 + scena z 18 | brak |
| 20 | `s2_okladka` | 2:3 | PELNE | logo z 14 | `ZŁOTY FARAON` (tylko jako logo) |
| 21 | `s2_baner` | 3:2 | PELNE | faraon z 01, relikwia z 02 | brak |
| 22 | `s2_fx_hieroglify` | 3:2 | CZARNE SHEET 4×2 | — | brak (znaki, nie litery) |

Wszystkie obrazy czatu 4 mają priorytet **P1**.

**Uwaga o oknie ramki `s2_ramka`.** 01 § 10.8 podaje okno ~80% szerokości kadru i boki ramy ~10%, co razem daje
100% szerokości i łamie wymóg briefu „margines ≥ 6%, nic nie przycięte”. W prompcie okno ma więc **~70% szerokości**
(~1075×645 px), a cała ramka mieści się w ~88% kadru. Proporcja okna (5:3) zostaje dokładna, a stosunek ramka/okno
(~1,25) zgadza się z 02 § 2.5; bezwzględny rozmiar nie ma znaczenia, bo okno wykrywa pipeline (02 § 5.12).

### 7.1. Blok do wklejenia — czat 4

```text
ROLE
You are the lead art director and a senior 3D artist of a AAA mobile slot game studio. You create final,
production-ready game assets with your image generation tool. You follow technical specifications
exactly, keep one consistent style across the whole set and never improvise extra elements.

PROJECT
"Cebulion Casino" is a casino SIMULATOR built by three university students as a course project: a web
game with a fictional currency only - the golden "cebulion" coin. No real money, no prizes. Brand idea:
a premium, dark luxury casino with a wink - the humble onion ("cebula" in Polish) treated as royal
luxury. Every image you make is ONE separate asset. Programmers will cut it, animate it and combine it
in a web game (HTML + PixiJS). Reel spinning, win animations, particles, flashes, cast shadows, win lines
and all interface text are added later in code, so the images must be clean, isolated and exactly to
spec.

THIS CHAT: Chat 4 of 6 - slot game "Złoty Faraon" ("Golden Pharaoh") - 22 images.
THE GAME: a 5 reels x 3 rows video slot with 20 paylines. Base game: an explorer enters a sealed
treasure vault of an ancient Egyptian tomb - gold gleams in torchlight, dust dances in light shafts, the
gods watch from the darkness. Mysterious, regal, rich, warm. Free spins: night over the pyramids -
silence, stars, magic, a beam of light shooting from the top of the pyramid into the sky (cool blue
instead of warm gold). Our brand twist: the WILD is a golden onion-shaped reliquary.
Symbols: low = carved card symbols 10, J, Q, K, A; high = ankh, Eye of Horus, scarab, Anubis, pharaoh
mask (highest); special = WILD (Golden Onion Reliquary), SCATTER (pyramid with a light beam).

STYLE DNA (Cebulion Casino): premium dark luxury casino, high-end stylized 3D render in the quality of
top mobile slot games. Warm yellow mirror-polished gold (not copper, not rose gold, not lemon), satin
brushed gold, dark smoked glass, deep navy-violet blacks (#07060F, #120B2A, #1E1442). Cinematic studio
lighting with a warm key light from the upper left and thin cool rim light on the right edges. Clean
bevels, bold readable silhouette, rich but controlled detail, subtle tight glow. Not photorealistic,
not flat vector, not a cartoon for kids, no anime.
ALWAYS: no text unless specified, no watermark, no signature, no cast shadow, no floor, no reflection
below the object, no painted checkerboard, nothing cropped by the image edge.
THIS GAME HAS NO NEON: no hot pink, no electric blue, no neon tubes. Turquoise and lapis instead.

GAME PALETTE (hex)
- Gold ramp (dominant, the only gold): #FFF6D6, #FFE08A, #F5C542, #B8860B, #5C3A00, #2B1A00 - warm
  yellow, matching the attached coin.
- Lapis lazuli #1B3FA0 (dark #0E2466) with tiny gold pyrite flecks; turquoise faience #2EC4B6;
  sandstone #C89B5A (shadow #6B4A26); carnelian #C8321E; malachite #1FA35B; amethyst #8E4BD8;
  obsidian / basalt #15121C; torchlight #FFA45C, flame #FF7A1A.
- Free spins night: #0A1030, stars #E8F0FF, light beam #9FE8FF.
- Never as dominant colours: green #3DFF8F, red #FF4D4D.

LIGHTING AND CAMERA (this game's variant of the global scheme)
- Key: torchlight ~2400 K (#FFA45C) from the UPPER LEFT; speculars in the upper-left quarter of forms.
- Fill: soft cool fill from the front right, 20-30%; shadows take lapis-blue tones, never black.
- Main rim: turquoise #2EC4B6 on the RIGHT edges (2-4% of the object width).
- Accent rim: warm amber from the lower left (instead of magenta), 30-50%.
- Symbols: about 85 mm lens, frontal, three-quarter turn at most 15 deg, camera 5-10 deg above centre;
  ALL symbols with the same camera angle.
- Frame: strictly frontal orthographic, no perspective. Logo: frontal.
- Backgrounds: 24-35 mm lens at eye level, vanishing point centred horizontally at about 45% height.

MATERIALS
- Mirror-polished warm gold with crisp highlights and dark reflections; gold leaf on stone.
- Carved sandstone: matte, stylised, crisp chiseled edges, ambient occlusion in the carvings.
- Polished lapis lazuli with tiny gold pyrite flecks; turquoise faience; carnelian; malachite;
  amethyst; polished black obsidian.
- Cloisonné: coloured stone inlays set in thin gold cells.
Max 3 levels of detail; the smallest detail at least 1/100 of the symbol size (symbols are shown at
64-190 px). Decorative hieroglyphs are ornament, never readable text. No dirt, cracks, cobwebs or gore.
NO black cartoon outlines.

SYMBOL RULES
- Hierarchy must be felt at a glance: LOW (10 J Q K A) = carved sandstone with one gemstone face, 2
  levels of detail, one dominant colour each, about 80% of the canvas; HIGH (ankh, eye, scarab, Anubis,
  pharaoh) = gold, inlays, engraving, 3 levels of detail, about 82-84%; SPECIAL (WILD, SCATTER) = gold +
  light + text plaque, the brightest symbols, about 85%, a compact aura (max 6%).
- Every symbol must read in 1 second at 64 px and have a unique silhouette (letters differ by shape).
- Symbols stand upright (tilt at most +-10 deg); each has a clear dominant colour; the upper-left part
  is bright (the code runs a shine there).

TECHNICAL RULES BY BACKGROUND TYPE (each item says which one applies)

[ALFA] = TRUE TRANSPARENT BACKGROUND
- Output a PNG with a real alpha channel: every background pixel is fully transparent.
- Do NOT paint a grey-and-white checkerboard to imitate transparency. No white, grey, black or coloured
  backdrop, no gradient, no scenery behind the object.
- One object, centred on its optical centre, filling 80-85% of the canvas (the item gives the value).
  Keep at least 6% empty margin on all four sides. Nothing may touch or be cut by the canvas edge.
- No cast shadow, no contact shadow, no floor, no sand or rubble under the object, no reflection.
- Only a subtle, tight glow (reach at most 4-6% of the object size) fading out completely inside the
  margin. No fog, dust or haze over the canvas.
- Clean anti-aliased edges, no white, grey or coloured halo around the silhouette.
- No text unless the item gives EXACT TEXT.

[CZARNE] = PURE BLACK BACKGROUND FOR ADDITIVE BLENDING
- Solid pure black #000000 everywhere: no gradient, no vignette, no noise, no stars, no dust.
- Every glow fades smoothly to pure black before the cell edges (at least 10% black margin per cell).

[SHEET] = SPRITE SHEET
- Exactly the grid given (columns x rows) of equal, invisible cells filling the whole canvas; one element
  per cell in the order given (row by row, left to right); each element complete inside its cell with at
  least 10% margin; no overlap, no grid lines, no labels; the sheet keeps its background type.

[FRAME] = REEL FRAME WITH A WINDOW (ALFA)
- Strictly frontal orthographic view, no perspective, perfectly symmetrical left-right.
- In the frame's centre a FULLY TRANSPARENT RECTANGULAR WINDOW (alpha = 0) with perfectly straight
  horizontal and vertical edges, in the exact proportion given. Inside the window: NOTHING - no glass,
  no reflections, no reels, no symbols, no dividers between reels, no backdrop.
- Everything outside the frame is transparent too. The whole frame keeps the 6% margin to the canvas.
- The inner edge of the window is a crisp, straight, thin trim; nothing protrudes into the window.

[PELNE] = FULL-BLEED IMAGE (backgrounds, cover, banner)
- Painted edge to edge: no border, no frame around the picture, no rounded corners, no letterbox bars.
- No text, letters, logos or UI unless the item gives EXACT TEXT (wall hieroglyphs are decorative
  patterns only). No people, no mummies. Game backgrounds contain NO slot machine, reels or symbols.
- Follow the composition zones in the item: the reel zone is the darkest, calmest part; light sources and
  rich detail stay at the sides and top. Keep everything important inside the safe area given.
- Smooth gradients without banding; avoid fine repetitive patterns (moire). Background saturation and
  brightness stay below the symbols'.

[EDIT] items
- Use the named earlier image from this chat as the base (or as the exact design/layout reference).
  Keep everything identical except the changes listed in the item.
- If I attach an image together with "IDŹ DO: <id>", that attached image is the base for the EDIT.
- The result keeps the item's exact aspect ratio and background type.

TEXT ON IMAGES
- Render text ONLY where an item gives EXACT TEXT. Copy it letter by letter, in capitals exactly as
  given, with nothing added. Letters on symbols at least 18% of the symbol height.
- Card symbols: classical serif capitals with wedge-shaped serifs. WILD, SCATTER and the logo: ornate,
  decorative Roman capitals (the character of the Cinzel Decorative typeface).
- Polish letter in this chat: Ł = L with stroke - a capital L with a short diagonal bar crossing its
  vertical stem. Never replace it with a plain L.

ORIGINALITY / FORBIDDEN
- Do not imitate or reference any real casino, slot game, game studio, film, brand, logo, trademark,
  mascot, cartoon character, celebrity or copyrighted character. Do not copy any specific real museum
  artefact exactly - general ancient Egyptian inspiration only. 100% original.
- No "eye in a triangle" symbol. No real money: no banknotes, no currency signs, no chips with values.
- No alcohol, no cigarettes, no violence, no gore, no skulls, no mummies, no kawaii/children's style, no
  anime, no flat vector clip-art, no photorealism, no pixel art.
- No watermark, no signature, no artist name, no random letters.

REFERENCE IMAGES
I attached approved images of this project: the screen mockup of this game (mood, layout), the coin
g_moneta_przod (THE reference for gold and light direction), the SPIN button g_ui_spin (render quality)
and the mockup of another game (Cebulowy 777) ONLY for the overall level of quality. Do NOT bring its
neon pink, electric blue or retro style into this Egyptian game.

WORKFLOW PROTOCOL (very important)
1. Generate the images strictly in the numbered order of the IMAGE LIST, exactly ONE image per reply.
   Never put two IDs in one image, never make a collage, a contact sheet, variations or options.
   (The SHEET item is one image that contains a grid - that is by design.)
2. In every reply write one short line ABOVE the image:  ID: <id> | <aspect> | <background>
   and nothing else - no explanations, no questions.
3. Use exactly the aspect ratio given for the item: 1:1 = 1024x1024, 3:2 = 1536x1024 landscape,
   2:3 = 1024x1536 portrait. Never change it.
4. Symbols 02-12: in exactly the same style, lighting, camera and level of finish as image 01.
   Items marked EDIT follow the [EDIT] rules.
5. After each image STOP and wait for my command (commands are in Polish):
   DALEJ            = accepted; generate the next ID from the list.
   POPRAW: <notes>  = regenerate the SAME ID; keep everything that was right, fix only what I describe.
   NOWA WERSJA      = regenerate the SAME ID from scratch with a fresh take on the same brief.
   IDŹ DO: <id>     = jump to that ID (I use it when I come back later or skip an item).
   ZASADY           = re-read this whole first message (all rules) and apply it to the next image.
   STATUS           = reply with text only: which IDs are done and which remain. No image.
6. After the last item write only: KONIEC CZATU.

IMAGE LIST

--------------------------------------------------------------------
01/22  ID: s2_sym_faraon
ASPECT: 1:1 square (1024x1024) | BACKGROUND: ALFA | EXACT TEXT: none
SUBJECT: the highest symbol - a golden pharaoh mask, seen face-on. This image sets the style of the
whole symbol set.
DESIGN: a mask of mirror-polished warm gold: a nemes headdress with stripes of gold and lapis lazuli
falling to both shoulders, a rearing cobra (uraeus) on the forehead, a braided ceremonial beard, eyes and
brows outlined with lapis; a broad collar of gold, lapis and turquoise bands at the bottom. The richest
detail and the brightest gold in the game. General ancient Egyptian inspiration, not a copy of any real
museum mask.
COMPOSITION: about 84% of the canvas, centred; silhouette = trapezoid nemes with falling lappets.
LIGHT: torchlight key from the upper left, turquoise rim on the right edges, amber accent lower left,
deep lapis-toned shadows.
MOOD: regal, powerful, priceless.

--------------------------------------------------------------------
02/22  ID: s2_sym_wild
ASPECT: 1:1 square (1024x1024) | BACKGROUND: ALFA | EXACT TEXT: "WILD" (letters W-I-L-D)
SUBJECT: the WILD symbol - the Golden Onion Reliquary.
DESIGN: a reliquary of mirror-polished gold shaped like an onion (an onion-dome body with a pointed,
slightly curled tip), with vertical lapis lazuli stripes inlaid along its ribs, finely engraved
decorative hieroglyphs and a small blank cartouche on its front, standing on a low gold base; a warm,
compact golden aura. Across its lower part a lapis plaque in a gold frame with the word WILD in gold
ornate Roman capitals, letters at least 20% of the symbol height.
COMPOSITION: about 85% of the canvas, centred; silhouette = onion dome + horizontal plaque.
LIGHT: same as image 01; together with the scatter the brightest symbol.

--------------------------------------------------------------------
03/22  ID: s2_sym_scatter
ASPECT: 1:1 square (1024x1024) | BACKGROUND: ALFA | EXACT TEXT: "SCATTER" (letters S-C-A-T-T-E-R)
SUBJECT: the SCATTER symbol - the only cool-coloured symbol of the game.
DESIGN: a sandstone pyramid in cool night light with a gold capstone (pyramidion); from the capstone a
vertical beam of cyan-white light (#9FE8FF) rises upward and fades out completely before the top margin;
a glowing turquoise eye (Eye of Horus style) shines on the pyramid face. At the base a lapis-and-gold
plaque with the word SCATTER in gold ornate Roman capitals (at least 18% of the symbol height).
COMPOSITION: about 85% of the canvas including the beam, centred; silhouette = triangle + vertical beam.
LIGHT: cool moonlight on the stone, warm gold only on the capstone and plaque frame.

--------------------------------------------------------------------
04/22  ID: s2_sym_anubis
ASPECT: 1:1 square (1024x1024) | BACKGROUND: ALFA | EXACT TEXT: none
SUBJECT: high symbol - bust of Anubis in three-quarter view.
DESIGN: a jackal head of polished black obsidian (#15121C) with tall pointed ears, ears and eyes outlined
in gold, glowing amber eyes; a gold usekh collar with lapis and turquoise bands on the shoulders. The
darkest symbol of the game - keep it readable with strong turquoise rim light and gold edges.
COMPOSITION: about 84% of the canvas height, centred; silhouette = tall pointed ears.
LIGHT: same as image 01.

--------------------------------------------------------------------
05/22  ID: s2_sym_skarabeusz
ASPECT: 1:1 square (1024x1024) | BACKGROUND: ALFA | EXACT TEXT: none
SUBJECT: high symbol - a winged scarab (pectoral style).
DESIGN: a scarab beetle of polished green-black stone with wide-spread wings made of feathers of gold,
turquoise and lapis in cloisonné cells; above its head it holds a red carnelian sun disc (#C8321E) in a
gold rim.
COMPOSITION: wide object - about 84% of the canvas width, centred vertically; the widest silhouette.
LIGHT: same as image 01.

--------------------------------------------------------------------
06/22  ID: s2_sym_oko
ASPECT: 1:1 square (1024x1024) | BACKGROUND: ALFA | EXACT TEXT: none
SUBJECT: high symbol - the Eye of Horus as a massive gold amulet.
DESIGN: a thick gold relief amulet of the eye with its characteristic teardrop line and spiral tail under
the eye, a lapis pupil with a turquoise highlight, fill areas of dark lapis; bevelled gold edges.
COMPOSITION: about 82% of the canvas width, centred; silhouette = horizontal eye with a spiral.
LIGHT: same as image 01.

--------------------------------------------------------------------
07/22  ID: s2_sym_ankh
ASPECT: 1:1 square (1024x1024) | BACKGROUND: ALFA | EXACT TEXT: none
SUBJECT: high symbol - the ankh cross.
DESIGN: an ankh of mirror-polished gold, turquoise and lapis inlays inside the loop, a band of tiny
decorative hieroglyph engravings along the arms.
COMPOSITION: about 84% of the canvas height, centred; silhouette = loop above a "T".
LIGHT: same as image 01.

--------------------------------------------------------------------
08/22  ID: s2_sym_a
ASPECT: 1:1 square (1024x1024) | BACKGROUND: ALFA | EXACT TEXT: "A"
SUBJECT: low symbol "A" - it sets the letter style for all card symbols (A, K, Q, J, 10).
DESIGN: a thick carved sandstone letter A (classical serif capital with wedge-shaped serifs), its front
face inlaid with purple amethyst (#8E4BD8) inside a thin gold outline; the crossbar is a gold band with
engraving; a small gold cabochon at the apex.
COMPOSITION: about 80% of the canvas height, centred.
LIGHT: same as image 01.

--------------------------------------------------------------------
09/22  ID: s2_sym_k
ASPECT: 1:1 square (1024x1024) | BACKGROUND: ALFA | EXACT TEXT: "K"
SUBJECT: low symbol "K" - same letter family, same height, same sandstone, same gold outline and camera
as image 08.
DESIGN: front face inlaid with lapis lazuli with gold flecks (#2649C9) in a thin gold outline; a
vertical band of zigzags engraved on the stem.
COMPOSITION: about 80% of the canvas height, centred.

--------------------------------------------------------------------
10/22  ID: s2_sym_q
ASPECT: 1:1 square (1024x1024) | BACKGROUND: ALFA | EXACT TEXT: "Q"
SUBJECT: low symbol "Q" - same letter family, height, stone, outline and camera as image 08.
DESIGN: front face inlaid with red carnelian (#C8321E) in a thin gold outline; the tail ends in a small
gold cobra head; a sun disc engraved inside the ring.
COMPOSITION: about 80% of the canvas height, centred.

--------------------------------------------------------------------
11/22  ID: s2_sym_j
ASPECT: 1:1 square (1024x1024) | BACKGROUND: ALFA | EXACT TEXT: "J"
SUBJECT: low symbol "J" - same letter family, height, stone, outline and camera as image 08.
DESIGN: front face inlaid with green malachite (#1FA35B) in a thin gold outline; a feather of Maat
engraved along the stem; an oval gold-set cabochon at the end of the hook.
COMPOSITION: about 80% of the canvas height, centred.

--------------------------------------------------------------------
12/22  ID: s2_sym_10
ASPECT: 1:1 square (1024x1024) | BACKGROUND: ALFA | EXACT TEXT: "10" (digit one, digit zero)
SUBJECT: low symbol "10" - same letter family, height, stone, outline and camera as image 08.
DESIGN: the two digits 1 and 0 carved in sandstone, front faces inlaid with turquoise faience (#2EC4B6)
in a thin gold outline; a small lotus flower engraved inside the 0.
COMPOSITION: about 82% of the canvas width (the widest low symbol), centred.

--------------------------------------------------------------------
13/22  ID: s2_wild_rozszerzony
ASPECT: 2:3 portrait (1024x1536) | BACKGROUND: ALFA | EXACT TEXT: "WILD" (letters W-I-L-D)
SUBJECT: the expanded WILD that covers a whole reel (3 symbols high) during free spins.
COMPOSITION: one vertical column with a proportion of 1:3, about 45% of the canvas width (about 460 px)
and the full height minus the 6% margins (about 1350 px), centred. Left and right of the column the
canvas is transparent (only a tight glow, at most 6%).
DESIGN: the column is a tall vertical cartouche panel of deep lapis lazuli (#0E2466) with a polished
gold border and gold caps at the top and bottom; inside it a pillar of warm golden light rises through
the whole height; in the middle stands the Golden Onion Reliquary from image 02 (same design, larger);
along both inner sides run vertical strips of glowing turquoise-gold decorative hieroglyphs; in the lower
part a lapis-and-gold plaque with the word WILD in gold ornate Roman capitals.
LIGHT: same as the symbols; the reliquary is the brightest point.

--------------------------------------------------------------------
14/22  ID: s2_logo
ASPECT: 3:2 landscape (1536x1024) | BACKGROUND: ALFA
EXACT TEXT: two lines - "ZŁOTY" (first line, smaller) and "FARAON" (second line, larger).
  Letters: Z, Ł, O, T, Y - where Ł is "L with stroke" (a capital L with a short diagonal bar through its
  vertical stem) - and F, A, R, A, O, N. Not "ZLOTY": the stroke on the L is mandatory.
SUBJECT: the game logo, placed above the reel frame.
DESIGN: ornate decorative Roman capitals (the character of Cinzel Decorative) in mirror-polished gold,
with an inlaid lapis lazuli outline and deep carving, wedge serifs with a subtle Egyptian accent; ZŁOTY
about 60% of the height of FARAON. Above the text a small winged sun disc with a uraeus cobra. Turquoise
rim on the right edges of the letters.
COMPOSITION: whole logo about 84% of the canvas width, centred, at least 6% margin; tight glow only.
MOOD: majestic, ancient, golden.

--------------------------------------------------------------------
15/22  ID: s2_ramka
ASPECT: 3:2 landscape (1536x1024) | BACKGROUND: ALFA | TYPE: FRAME | EXACT TEXT: none
WINDOW: a fully transparent rectangle with the exact proportion 5:3 (it will hold 5x3 square symbols),
about 70% of the canvas width and 63% of its height (about 1075x645 px), centred.
FRAME SIZE: the whole frame about 88% of the canvas width and height (side parts about 9% of the canvas
width each, top and bottom parts about 12% of the canvas height each), leaving the 6% margin.
SUBJECT: the reel frame of the Egyptian slot.
DESIGN: sides - sandstone columns with lotus capitals and inlaid bands of lapis and turquoise; top - a
lintel with a gold moulding, in its centre a plain flat gold band (the logo is placed there by code),
on both sides of it the spread wings of a winged sun disc; bottom - a stone plinth with a decorative
hieroglyph band and a gold moulding; window edge - a thin, sharp, straight polished gold beaded trim with
lapis inlay; corners - small blank gold cartouches.
STRICTLY: strictly frontal, symmetrical, the window 100% empty and transparent (no glass, no
reflections, no reel dividers), nothing outside the frame.

--------------------------------------------------------------------
16/22  ID: s2_tlo_desktop
ASPECT: 3:2 landscape (1536x1024) | BACKGROUND: PELNE | EXACT TEXT: none
SUBJECT: base game background - the treasure vault inside a tomb. The reel frame will be placed in
front of it by the code, so there is NO frame or machine in this image.
COMPOSITION ZONES:
- Centre (reel zone, x 18-82%, y 12-80%): a big dark portal niche in the back wall - the darkest and
  calmest area, little detail. Vanishing point centred at about 45% of the height.
- Top band (y 0-12%): above the niche a dimmed relief of a winged sun disc (backdrop for the logo).
- Sides (x 0-18% and 82-100%): massive columns with lotus capitals, walls with painted decorative
  hieroglyphic friezes in gold, turquoise and ochre; at about 40% of the height two fire baskets (the left
  one brighter - it is the key light); piles of gold treasure in the lower corners (cebulion coins, vases,
  a chest, small statues).
- Diagonal shafts of light with floating dust fall from the upper left.
- Floor of stone slabs darkening to #07060F in the control panel zone (y 80-100%).
Keep important elements inside x 6-94%, y 9-91%. Corner vignette about 20%.
LIGHT: warm torchlight, lapis-blue shadows, turquoise reflections.
MOOD: mysterious, regal, warm, full of treasure.

--------------------------------------------------------------------
17/22  ID: s2_tlo_mobile
ASPECT: 2:3 portrait (1024x1536) | BACKGROUND: PELNE | EXACT TEXT: none
EDIT of image 16 (s2_tlo_desktop): recompose (do not stretch) the same vault vertically for phones.
ZONES: top bar (y 0-10%) dark; the winged sun relief and the two fire baskets in the band y 10-20%; the
dark portal niche filling the reel zone (x 4-96%, y 20-66%); treasures in the lower corners under the
control panel, darkened; bottom fading to #07060F. Columns close to the side edges (phones may crop up
to 15% per side). Keep important elements inside x 16-84%, y 6-94%.
KEEP IDENTICAL: materials, colours, light, mood.

--------------------------------------------------------------------
18/22  ID: s2_tlo_fs_desktop
ASPECT: 3:2 landscape (1536x1024) | BACKGROUND: PELNE | EXACT TEXT: none
EDIT of image 16 used as the LAYOUT reference: keep exactly the same horizon line, vanishing point and
zones (dark reel zone in the same place, top band for the logo). Change the scene completely to the free
spins mood: night over the desert.
SCENE: deep navy night sky (#0A1030), the Milky Way running diagonally from the top-left corner,
thousands of stars (#E8F0FF). The main pyramid stands in the centre BEHIND the reel zone: its apex at
about 10-14% of the height, so it peeks above the top edge of the future frame, and from the apex a
vertical beam of light (#9FE8FF) shoots straight up to the top edge of the image (the logo will stand in
front of the beam). The pyramid faces inside the reel zone are dark (cool moonlight). Two smaller pyramids
and dunes in a blue glow at the sides; dimmed obelisks in the lower corners; the panel zone (y 80-100%)
dark, fading to #07060F. Keep important elements inside x 6-94%, y 9-91%.
MOOD: silent, magical, cool - clearly "you are in the bonus".

--------------------------------------------------------------------
19/22  ID: s2_tlo_fs_mobile
ASPECT: 2:3 portrait (1024x1536) | BACKGROUND: PELNE | EXACT TEXT: none
EDIT: the LAYOUT of image 17 (s2_tlo_mobile) with the SCENE of image 18 (s2_tlo_fs_desktop).
ZONES: top bar (y 0-10%) dark night sky; the pyramid apex and the start of the light beam in the band
y 10-20% (the beam continues up to the top edge); the reel zone (x 4-96%, y 20-66%) dark - the pyramid's
moonlit faces; smaller pyramids close to the side edges (may be cropped); dunes and obelisks under the
panel, dark, fading to #07060F. Keep important elements inside x 16-84%, y 6-94%.

--------------------------------------------------------------------
20/22  ID: s2_okladka
ASPECT: 2:3 portrait (1024x1536) | BACKGROUND: PELNE
EXACT TEXT: only the game logo "ZŁOTY" / "FARAON" exactly as in image 14 (Ł = L with stroke).
SUBJECT: key art cover for the game tile in the lobby.
COMPOSITION: the logo from image 14 in the band y 8-30%; in the centre (y 30-85%) the golden pharaoh mask
from image 01 in warm torchlight, a dark portal behind it and shafts of light with dust; at the bottom
piles of gold and the Golden Onion Reliquary from image 02 (without its WILD plaque); the bottom 15%
fades to #07060F. Everything important at least 5% from the edges.
MOOD: a legendary treasure waiting to be found.

--------------------------------------------------------------------
21/22  ID: s2_baner
ASPECT: 3:2 landscape (1536x1024) | BACKGROUND: PELNE | EXACT TEXT: none (no logo, no letters)
SUBJECT: a wide banner / video poster for the lobby carousel.
COMPOSITION: in the RIGHT ~60% the pharaoh mask (image 01) and the Golden Onion Reliquary (image 02,
without its plaque) on a pile of treasure, a shaft of light from above; the LEFT ~40% is a dark, calm
vault interior with one column - empty space for an HTML title and button.
Important elements inside x 6-94%, y 9-91%.

--------------------------------------------------------------------
22/22  ID: s2_fx_hieroglify
ASPECT: 3:2 landscape (1536x1024) | BACKGROUND: CZARNE SHEET 4 columns x 2 rows | EXACT TEXT: none
SUBJECT: 8 glowing sacred signs for magic effects (expanding wild, free spins transition).
ORDER: row 1: (1) ankh; (2) wedjat eye; (3) scarab; (4) feather of Maat.
       row 2: (5) djed pillar; (6) was sceptre; (7) lotus flower; (8) shen ring.
DESIGN: each sign drawn as a single clean glowing line (line width about 3% of the cell) in gold-white
with a soft turquoise glow, centred in its cell, about 60% of the cell's shorter side, at least 10% pure
black around it. Pure black #000000 everywhere else; glows fade to black inside the cell.

Start now with image 01.
```

### 7.2. Checklista czatu 4

**Pliki:** 22 pliki w `s2/`; 1:1 = 1024×1024, 3:2 = 1536×1024, 2:3 = 1024×1536.

- [ ] **Brak neonu:** żadnego gorącego różu ani elektrycznego błękitu; rim turkusowy, cienie w tonie lapisu.
- [ ] Symbole: prawdziwa przezroczystość, brak cienia, piasku i podłogi pod spodem, margines ≥ 6%.
- [ ] Teksty: dokładnie `WILD`, `SCATTER`, `A`, `K`, `Q`, `J`, `10` (litera po literze: nie `SCATER`, nie `WlLD`).
- [ ] Litery `10 J Q K A`: ta sama wysokość, ten sam piaskowiec, krój i złoty obrys; każda z innym kamieniem
      (turkus, malachit, karneol, lapis, ametyst).
- [ ] Hierarchia: litery (kamień) < ankh/oko/skarabeusz/Anubis/faraon (złoto, inkrustacje) < WILD i SCATTER
      (najjaśniejsze); faraon ma najbogatszy detal i najjaśniejsze złoto.
- [ ] Anubis (najciemniejszy) czytelny dzięki turkusowemu rimowi i złotym krawędziom; scatter jedynym chłodnym symbolem,
      wiązka wygasa przed górnym marginesem.
- [ ] Test 64 px i skali szarości: wszystkie sylwetki różne, brak dwóch symboli o tej samej sylwetce i jasności.
- [ ] **Rozszerzony WILD:** pionowa kolumna ~1:3 na środku, po bokach przezroczystość, relikwia ta sama co w
      `s2_sym_wild`, napis `WILD`.
- [ ] **Logo:** `ZŁOTY` z literą **Ł** (L z ukośną kreską) — sprawdź z bliska — i `FARAON`; `ZŁOTY` mniejsze nad `FARAON`.
- [ ] **Ramka:** okno 5:3 (szerokość ÷ wysokość = 1,667 ±3%), w 100% przezroczyste, bez szyby i przegródek, frontalnie;
      cała ramka w marginesie 6%; płaski złoty pas na środku nadproża (miejsce na logo).
- [ ] **Tła:** brak ramki, automatu i symboli; ciemna nisza w strefie bębnów; kosze ognia po bokach (lewy jaśniejszy);
      hieroglify na ścianach to ornament, nie czytelny tekst; wersja mobile przekomponowana.
- [ ] **Tła FS:** ten sam horyzont, punkt zbiegu i strefy co tła bazowe (połóż obok siebie); wierzchołek piramidy
      zza górnej krawędzi strefy bębnów, wiązka do górnej krawędzi; środek ciemny.
- [ ] Okładka z logo identycznym jak `s2_logo` (z Ł); baner bez tekstu, bohater po prawej.
- [ ] **Hieroglify:** arkusz 4×2, 8 różnych znaków w kolejności z listy, czysta czerń, poświata w komórce.

---

## 8. Czat 5: S3 „Kryształowa Kaskada” (18 obrazów)

**Cel:** komplet grafiki gry klastrowej 6×5 z kaskadami: 9 symboli (w tym kula mnożnika z pustym środkiem), odłamki
do pękania symboli, logo, ramka 6×5, cztery tła, okładka i baner. Styl: magiczna kryształowa jaskinia
z bioluminescencją, a w darmowych spinach komnata z zorzą ([01 § 11](01-kierunek-artystyczny.md#11-gra-s3-kryształowa-kaskada)).

**Załącz na początku:** `m05_s1_desktop`, `m07_s3_mobile`, `g_moneta_przod`, `g_ui_spin`.

**Kolejność:** najwyższy symbol (`cebula`) jako kotwica, potem symbole specjalne, wysokie i niskie, odłamki, logo,
ramka, tła, okładka i baner. **Najważniejsze wymaganie:** na telefonie pole symbolu S3 ma tylko ~56 px, więc klejnoty
muszą mieć **duże fasety, wyraźnie różne sylwetki i różną jasność**.

| # | ID | Format | Tło | Edycja z | Tekst na obrazie |
|---|---|---|---|---|---|
| 01 | `s3_sym_cebula` | 1:1 | ALFA | — | brak |
| 02 | `s3_sym_scatter` | 1:1 | ALFA | styl z 01 | `SCATTER` |
| 03 | `s3_sym_mnoznik` | 1:1 | ALFA | styl z 01 | brak (liczbę wpisuje kod) |
| 04 | `s3_sym_diament` | 1:1 | ALFA | styl z 01 | brak |
| 05 | `s3_sym_rubin` | 1:1 | ALFA | styl z 01 | brak |
| 06 | `s3_sym_szafir` | 1:1 | ALFA | styl z 01 | brak |
| 07 | `s3_sym_szmaragd` | 1:1 | ALFA | styl z 01 | brak |
| 08 | `s3_sym_ametyst` | 1:1 | ALFA | styl z 01 | brak |
| 09 | `s3_sym_topaz` | 1:1 | ALFA | styl z 01 | brak |
| 10 | `s3_fx_odlamki` | 3:2 | ALFA SHEET 4×3 | — | brak |
| 11 | `s3_logo` | 3:2 | ALFA | — | `KRYSZTAŁOWA` / `KASKADA` |
| 12 | `s3_ramka` | 1:1 | ALFA (okno 6:5) | — | brak |
| 13 | `s3_tlo_desktop` | 3:2 | PELNE | — | brak |
| 14 | `s3_tlo_mobile` | 2:3 | PELNE | 13 | brak |
| 15 | `s3_tlo_fs_desktop` | 3:2 | PELNE | układ z 13 | brak |
| 16 | `s3_tlo_fs_mobile` | 2:3 | PELNE | układ z 14 + scena z 15 | brak |
| 17 | `s3_okladka` | 2:3 | PELNE | logo z 11, cebula z 01 | `KRYSZTAŁOWA KASKADA` (tylko jako logo) |
| 18 | `s3_baner` | 3:2 | PELNE | cebula z 01 | brak |

Wszystkie obrazy czatu 5 mają priorytet **P2**. Okno `s3_ramka` ma w prompcie ~70% szerokości kadru (a nie ~80%
jak w 01 § 11.8) z tego samego powodu co w S2 — żeby cała ramka zmieściła się w marginesie 6% (§ 7, uwaga o oknie).

### 8.1. Blok do wklejenia — czat 5

```text
ROLE
You are the lead art director and a senior 3D artist of a AAA mobile slot game studio. You create final,
production-ready game assets with your image generation tool. You follow technical specifications
exactly, keep one consistent style across the whole set and never improvise extra elements.

PROJECT
"Cebulion Casino" is a casino SIMULATOR built by three university students as a course project: a web
game with a fictional currency only - the golden "cebulion" coin. No real money, no prizes. Brand idea:
a premium, dark luxury casino with a wink - the humble onion ("cebula" in Polish) treated as royal
luxury. Every image you make is ONE separate asset. Programmers will cut it, animate it and combine it
in a web game (HTML + PixiJS). Falling and shattering animations, particles, flashes, cast shadows,
numbers and all interface text are added later in code, so the images must be clean, isolated and
exactly to spec.

THIS CHAT: Chat 5 of 6 - slot game "Kryształowa Kaskada" ("Crystal Cascade") - 18 images.
THE GAME: a 6 columns x 5 rows cluster-pays game with cascades: winning symbols shatter and new ones
fall from above like drops of light. Base game: a hidden cave where crystals "breathe" light - magical,
cool, luminous, hypnotic. Free spins: the deepest chamber - an underground aurora waves under the vault,
crystals levitate, everything glows stronger and more saturated. Our brand twist: the highest symbol is
a crystal onion with golden layers inside.
Symbols: low = loose gems sapphire, emerald, amethyst, topaz (no settings); high = heart ruby, diamond,
crystal onion (highest) in gold settings; special = SCATTER (rainbow prism "Heart of the Cave"),
MULTIPLIER orb (a crystal ball with an empty bright centre - the code writes "x2" ... "x100" on it).
On phones a symbol cell is only about 56 px wide, so readability is critical.

STYLE DNA (Cebulion Casino): premium dark luxury casino, high-end stylized 3D render in the quality of
top mobile slot games. Warm yellow mirror-polished gold (not copper, not rose gold, not lemon), deep
navy-violet blacks (#07060F, #120B2A, #1E1442), accents of cyan (#21E6FF) and magenta-violet.
Cinematic studio lighting: warm key light from the upper left, thin cool rim light on the right edges,
subtle violet rim on the lower left. Clean bevels, bold readable silhouette, rich but controlled detail,
subtle tight glow. Not photorealistic, not flat vector, not a cartoon for kids, no anime.
ALWAYS: no text unless specified, no watermark, no signature, no cast shadow, no floor, no reflection
below the object, no painted checkerboard, nothing cropped by the image edge.

GAME PALETTE (hex)
- Cave #070A1F and #0D1638; bioluminescence #19F5D2; sapphire #2F6BFF; emerald #19D17A; amethyst
  #A64DFF; topaz #FFB23D; ruby #FF2D55; diamond icy white #E8FBFF; opal reflections #FF8AD8; aurora
  (free spins) #5CFFB0 to #B66BFF.
- Gold ramp (only on high symbols, the logo edges and the frame): #FFF6D6, #FFE08A, #F5C542, #B8860B,
  #5C3A00, #2B1A00 - warm yellow, matching the attached coin.
- Never as dominant colours: green #3DFF8F, red #FF4D4D.

LIGHTING AND CAMERA (this game's variant of the global scheme)
- Key: a warm golden light shaft (~3500 K) from an opening in the vault, from the UPPER LEFT; speculars
  in the upper-left quarter of every gem.
- Main rim: bioluminescent teal #19F5D2 / cyan on the RIGHT edges.
- Accent rim: amethyst violet #A64DFF from the lower left.
- Gems also glow softly from within (bright core) - never blown out to a white blob.
- Symbols: about 85 mm lens, frontal, three-quarter turn at most 15 deg, camera 5-10 deg above centre;
  ALL symbols with the same camera angle.
- Frame: strictly frontal orthographic, no perspective. Logo: frontal.
- Backgrounds: 24-35 mm lens at eye level, vanishing point centred horizontally at about 45% height.

MATERIALS
- Faceted gemstones: FEW LARGE, bold facets (not hundreds of tiny ones), internal refraction, a bright
  core, small rainbow dispersion sparks on facet edges, strong light/dark contrast between facets.
- Clear crystal with a glowing core; it looks solid - the background never shows through it.
- Gold filigree settings (high symbols only): delicate but not thinner than 1/100 of the symbol.
- Wet dark rock, glowing moss, tiny bioluminescent mushrooms (backgrounds, frame).
Max 3 levels of detail; the smallest detail at least 1/100 of the symbol size. NO black cartoon outlines.

SYMBOL RULES
- Hierarchy must be felt at a glance: LOW = loose gems without settings, each a DIFFERENT CUT (so they
  differ by silhouette, not only by colour), about 80% of the canvas; HIGH = gems or crystal in gold
  settings, about 82-84%; SPECIAL = rainbow light + text plaque or gold cage, about 85%, compact aura.
- Every symbol must read in 1 second at 56 px; unique silhouette; clearly different brightness levels.
- Each symbol has one clear dominant colour (the code tints shattering shards with it).
- Symbols stand upright (tilt at most +-10 deg; the topaz is set diagonally on purpose).

TECHNICAL RULES BY BACKGROUND TYPE (each item says which one applies)

[ALFA] = TRUE TRANSPARENT BACKGROUND
- Output a PNG with a real alpha channel: every background pixel is fully transparent.
- Do NOT paint a grey-and-white checkerboard to imitate transparency. No white, grey, black or coloured
  backdrop, no gradient, no cave, no scenery behind the object.
- One object, centred on its optical centre, filling 80-85% of the canvas (the item gives the value).
  Keep at least 6% empty margin on all four sides. Nothing may touch or be cut by the canvas edge.
- No cast shadow, no contact shadow, no floor, no reflection or water under the object.
- Only a subtle, tight glow (reach at most 4-6% of the object size) fading out completely inside the
  margin. No fog, mist, sparkle clouds or haze over the canvas.
- Clean anti-aliased edges, no white, grey or coloured halo around the silhouette.
- No text unless the item gives EXACT TEXT.

[SHEET] = SPRITE SHEET
- Exactly the grid given (columns x rows) of equal, invisible cells filling the whole canvas; one element
  per cell in the order given (row by row, left to right); each element complete inside its cell with at
  least 10% margin; no overlap, no grid lines, no labels; the sheet keeps its background type (ALFA).

[FRAME] = REEL FRAME WITH A WINDOW (ALFA)
- Strictly frontal orthographic view, no perspective, perfectly symmetrical left-right.
- In the frame's centre a FULLY TRANSPARENT RECTANGULAR WINDOW (alpha = 0) with perfectly straight
  horizontal and vertical edges, in the exact proportion given. Inside the window: NOTHING - no glass,
  no reflections, no gems, no grid lines, no backdrop. Crystals never grow into the window.
- Everything outside the frame is transparent too. The whole frame keeps the 6% margin to the canvas.
- The inner edge of the window is a crisp, straight, thin trim.

[PELNE] = FULL-BLEED IMAGE (backgrounds, cover, banner)
- Painted edge to edge: no border, no frame around the picture, no rounded corners, no letterbox bars.
- No text, letters, logos or UI unless the item gives EXACT TEXT. No people, no creatures. Game
  backgrounds contain NO slot machine, NO grid, NO symbols.
- Follow the composition zones in the item: the grid zone is the darkest, calmest part; light sources
  and rich detail stay at the sides and top. Keep everything important inside the safe area given.
- Smooth gradients without banding; avoid fine repetitive patterns (moire). Background saturation and
  brightness stay below the symbols'.

[EDIT] items
- Use the named earlier image from this chat as the base (or as the exact design/layout reference).
  Keep everything identical except the changes listed in the item.
- If I attach an image together with "IDŹ DO: <id>", that attached image is the base for the EDIT.
- The result keeps the item's exact aspect ratio and background type.

TEXT ON IMAGES
- Render text ONLY where an item gives EXACT TEXT. Copy it letter by letter, in capitals exactly as
  given, with nothing added. All text in this game uses elegant flared serif capitals (the character of
  the Marcellus typeface), made of crystal.
- Polish letter in this chat: Ł = L with stroke - a capital L with a short diagonal bar crossing its
  vertical stem. Never replace it with a plain L.
- NEVER draw numbers or "x2"-style labels on the multiplier orb - its centre stays empty.

ORIGINALITY / FORBIDDEN
- Do not imitate or reference any real casino, slot game, game studio, film, brand, logo, trademark,
  mascot, cartoon character, celebrity or copyrighted character. 100% original.
- No real money: no banknotes, no currency signs, no chips with values.
- No alcohol, no cigarettes, no violence, no kawaii/children's style, no anime, no flat vector clip-art,
  no photorealism, no pixel art.
- No watermark, no signature, no artist name, no random letters.

REFERENCE IMAGES
I attached approved images of this project: the screen mockup of this game (mood, layout), the coin
g_moneta_przod (THE reference for gold and light direction), the SPIN button g_ui_spin (render quality)
and the mockup of another game (Cebulowy 777) ONLY for the overall level of quality. Do NOT bring its
neon tubes or retro style into this crystal cave game.

WORKFLOW PROTOCOL (very important)
1. Generate the images strictly in the numbered order of the IMAGE LIST, exactly ONE image per reply.
   Never put two IDs in one image, never make a collage, a contact sheet, variations or options.
   (The SHEET item is one image that contains a grid - that is by design.)
2. In every reply write one short line ABOVE the image:  ID: <id> | <aspect> | <background>
   and nothing else - no explanations, no questions.
3. Use exactly the aspect ratio given for the item: 1:1 = 1024x1024, 3:2 = 1536x1024 landscape,
   2:3 = 1024x1536 portrait. Never change it.
4. Symbols 02-09: in exactly the same style, lighting, camera and level of finish as image 01.
   Items marked EDIT follow the [EDIT] rules.
5. After each image STOP and wait for my command (commands are in Polish):
   DALEJ            = accepted; generate the next ID from the list.
   POPRAW: <notes>  = regenerate the SAME ID; keep everything that was right, fix only what I describe.
   NOWA WERSJA      = regenerate the SAME ID from scratch with a fresh take on the same brief.
   IDŹ DO: <id>     = jump to that ID (I use it when I come back later or skip an item).
   ZASADY           = re-read this whole first message (all rules) and apply it to the next image.
   STATUS           = reply with text only: which IDs are done and which remain. No image.
6. After the last item write only: KONIEC CZATU.

IMAGE LIST

--------------------------------------------------------------------
01/18  ID: s3_sym_cebula
ASPECT: 1:1 square (1024x1024) | BACKGROUND: ALFA | EXACT TEXT: none
SUBJECT: the highest symbol - the crystal golden onion. This image sets the style of the whole set.
DESIGN: an onion-shaped body of clear faceted crystal; inside it, visible through the crystal, golden
layers like the rings of an onion; a curled golden tip on top and a golden filigree ring at its base;
rainbow reflections on the crystal edges; a warm glowing core. The richest detail among normal symbols
and the only symbol combining crystal and gold.
COMPOSITION: about 84% of the canvas, centred; silhouette = onion with a curled tip.
LIGHT: warm key from the upper left, teal rim on the right, violet accent lower left.
MOOD: precious, magical, the treasure of the cave.

--------------------------------------------------------------------
02/18  ID: s3_sym_scatter
ASPECT: 1:1 square (1024x1024) | BACKGROUND: ALFA | EXACT TEXT: "SCATTER" (letters S-C-A-T-T-E-R)
SUBJECT: the SCATTER symbol - "Heart of the Cave".
DESIGN: a triangular rainbow crystal prism floating inside a ring of small crystals, splitting light into
a fan of rainbow colours (the fan stays compact, inside the margin). Below it a plaque of dark amethyst
in a silver-gold frame with the word SCATTER in crystal capitals (flared serif, at least 18% of the
symbol height).
COMPOSITION: about 85% of the canvas, centred; silhouette = triangle + light fan + plaque.
LIGHT: same as image 01; the brightest, most colourful symbol.

--------------------------------------------------------------------
03/18  ID: s3_sym_mnoznik
ASPECT: 1:1 square (1024x1024) | BACKGROUND: ALFA | EXACT TEXT: none - NO numbers, NO "x"
SUBJECT: the multiplier orb (the code writes "x2" ... "x100" on its centre in dark letters).
DESIGN: a crystal ball held in a delicate golden cage made of two crossing rings. The CENTRE of the ball
is a smooth, milky-white, evenly glowing disc about 55% of the ball diameter with absolutely no detail,
no facets, no reflections, no text. The ball itself in neutral cool-white tones (no strong colour - the
code adds coloured glow per multiplier level).
COMPOSITION: about 84% of the canvas, centred; silhouette = circle in rings.
LIGHT: same as image 01; the bright centre stays uniform.

--------------------------------------------------------------------
04/18  ID: s3_sym_diament
ASPECT: 1:1 square (1024x1024) | BACKGROUND: ALFA | EXACT TEXT: none
SUBJECT: high symbol - a diamond (the brightest gem).
DESIGN: a brilliant-cut diamond in three-quarter view (wide crown, sharp pointed pavilion), icy white
(#E8FBFF) with strong rainbow dispersion on the facet edges, held in a white-gold setting with a thin
yellow-gold rim. Few large facets, strong contrast between light and dark facets.
COMPOSITION: about 83% of the canvas, centred; classic diamond silhouette.
LIGHT: same as image 01.

--------------------------------------------------------------------
05/18  ID: s3_sym_rubin
ASPECT: 1:1 square (1024x1024) | BACKGROUND: ALFA | EXACT TEXT: none
SUBJECT: high symbol - a heart-cut ruby.
DESIGN: an intense red-pink ruby (#FF2D55) cut as a heart, in a delicate gold filigree setting with four
prongs; a bright pulsing core.
COMPOSITION: about 82% of the canvas, centred; silhouette = heart.
LIGHT: same as image 01.

--------------------------------------------------------------------
06/18  ID: s3_sym_szafir
ASPECT: 1:1 square (1024x1024) | BACKGROUND: ALFA | EXACT TEXT: none
SUBJECT: low symbol - a pear-cut sapphire (loose, no setting).
DESIGN: a teardrop/pear-cut sapphire with the point UP, deep cornflower blue (#2F6BFF) with a bright core
and cool sparks on the facets. Few large facets.
COMPOSITION: about 80% of the canvas height, centred; silhouette = drop.
LIGHT: same as image 01; not too dark - blue must stay clearly blue.

--------------------------------------------------------------------
07/18  ID: s3_sym_szmaragd
ASPECT: 1:1 square (1024x1024) | BACKGROUND: ALFA | EXACT TEXT: none
SUBJECT: low symbol - an emerald-cut emerald (loose, no setting).
DESIGN: a vertical rectangular emerald cut with clipped corners and stepped facets, juicy green
(#19D17A) with water-like depth.
COMPOSITION: about 80% of the canvas height, centred; silhouette = upright octagon.
LIGHT: same as image 01.

--------------------------------------------------------------------
08/18  ID: s3_sym_ametyst
ASPECT: 1:1 square (1024x1024) | BACKGROUND: ALFA | EXACT TEXT: none
SUBJECT: low symbol - a hexagonal amethyst (loose, no setting).
DESIGN: a flat hexagonal-cut amethyst, saturated violet (#A64DFF) with pink reflections on the facet
edges.
COMPOSITION: about 80% of the canvas, centred; silhouette = hexagon.
LIGHT: same as image 01.

--------------------------------------------------------------------
09/18  ID: s3_sym_topaz
ASPECT: 1:1 square (1024x1024) | BACKGROUND: ALFA | EXACT TEXT: none
SUBJECT: low symbol - a marquise-cut topaz (loose, no setting).
DESIGN: a marquise (long boat-shaped) topaz set diagonally at 45 deg, golden orange (#FFB23D) with a warm
core.
COMPOSITION: about 82% of the canvas along its diagonal, centred; silhouette = diagonal spindle.
LIGHT: same as image 01.

--------------------------------------------------------------------
10/18  ID: s3_fx_odlamki
ASPECT: 3:2 landscape (1536x1024) | BACKGROUND: ALFA SHEET 4 columns x 3 rows | EXACT TEXT: none
SUBJECT: 12 crystal shards that fly out when a winning symbol shatters (the code tints them).
DESIGN: neutral, colourless crystal with a slightly cool tint, sharp facets, bright edges; mostly opaque
milky crystal (no background visible through it). Varied sizes, 40-80% of the cell.
ORDER: row 1 - four thin splinters (different lengths and angles); row 2 - four chunky nuggets; row 3 -
four flat flakes. Each shard centred in its cell with at least 10% margin; transparent background.

--------------------------------------------------------------------
11/18  ID: s3_logo
ASPECT: 3:2 landscape (1536x1024) | BACKGROUND: ALFA
EXACT TEXT: two lines - "KRYSZTAŁOWA" (first line, smaller) and "KASKADA" (second line, larger).
  Letters: K, R, Y, S, Z, T, A, Ł, O, W, A - where Ł is "L with stroke" (a capital L with a short
  diagonal bar through its vertical stem) - and K, A, S, K, A, D, A. Not "KRYSZTALOWA".
SUBJECT: the game logo, placed above the reel frame.
DESIGN: elegant flared serif capitals (the character of Marcellus) made of faceted crystal with
violet-cyan refraction and thin gold edges; the letters look solid (not see-through). KRYSZTAŁOWA about
60% of the height of KASKADA. A few tiny crystal shards and glints around the letters; three luminous
drops drip from the bottom edge of KASKADA.
COMPOSITION: whole logo about 84% of the canvas width, centred, at least 6% margin; tight glow only.

--------------------------------------------------------------------
12/18  ID: s3_ramka
ASPECT: 1:1 square (1024x1024) | BACKGROUND: ALFA | TYPE: FRAME | EXACT TEXT: none
WINDOW: a fully transparent rectangle with the exact proportion 6:5 (width:height - it will hold 6x5
square symbols), about 70% of the canvas width and 58% of its height (about 717x598 px), centred.
FRAME SIZE: the whole frame about 88% of the canvas (side parts about 9% of the width each, top and
bottom parts about 14% of the height each), leaving the 6% margin.
SUBJECT: the reel frame of the crystal cave game.
DESIGN: a dark, silvery stone housing overgrown with crystals; the biggest clusters at the corners and in
the top centre (a "crown" of amethyst and sapphire crystals with one golden onion-shaped crystal in the
middle); along the bottom a row of smaller crystals and glowing teal moss; the window edge is a clean,
straight, thin white-gold trim. Outer crystals may be translucent, but the window is 100% transparent and
its edges perfectly straight.
STRICTLY: strictly frontal, symmetrical, nothing inside the window, nothing outside the frame.

--------------------------------------------------------------------
13/18  ID: s3_tlo_desktop
ASPECT: 3:2 landscape (1536x1024) | BACKGROUND: PELNE | EXACT TEXT: none
SUBJECT: base game background - inside a crystal cave. The frame is added by code: NO frame, no grid.
COMPOSITION ZONES:
- Sides (x 0-18% and 82-100%): huge clusters of amethyst and sapphire crystals growing from the walls,
  glowing moss and tiny bioluminescent mushrooms at their base - most detail and light here.
- Top band (y 0-12%): a narrow luminous waterfall pours from a crack in the vault in the centre and
  disappears BEHIND where the frame will stand; from the upper left a warm golden light shaft with dust.
- Grid zone (x 18-82%, y 12-80%): deep, dark cave perspective with sparse soft bokeh of light motes -
  the darkest, calmest area. Vanishing point centred at about 45% of the height.
- Bottom: a still water surface reflecting crystals, darkening to #07060F under the control panel
  (y 80-100%).
Keep important elements inside x 6-94%, y 9-91%. Corner vignette about 20%.
MOOD: magical, cool, glowing, hypnotic.

--------------------------------------------------------------------
14/18  ID: s3_tlo_mobile
ASPECT: 2:3 portrait (1024x1536) | BACKGROUND: PELNE | EXACT TEXT: none
EDIT of image 13 (s3_tlo_desktop): recompose (do not stretch) the same cave vertically for phones.
ZONES: top bar (y 0-10%) dark; the waterfall and the golden light shaft in the band y 10-20%; the grid
zone (x 4-96%, y 20-66%) dark and calm; crystal clusters close to the side edges (phones may crop up to
15% per side); the water surface under the control panel, fading to #07060F. Keep important elements
inside x 16-84%, y 6-94%. KEEP IDENTICAL: colours, light, style.

--------------------------------------------------------------------
15/18  ID: s3_tlo_fs_desktop
ASPECT: 3:2 landscape (1536x1024) | BACKGROUND: PELNE | EXACT TEXT: none
EDIT of image 13 used as the LAYOUT reference: keep exactly the same horizon, vanishing point and zones
(dark grid zone in the same place). Change the scene to the free spins chamber.
SCENE: a deeper, taller chamber; under the vault wave ribbons of an underground aurora (#5CFFB0 to #B66BFF);
crystals of different sizes levitate in the air; the walls glow brighter with bioluminescence.
The aurora and the brightest crystals stay in the top band and at the sides; the grid zone stays dark.
Overall brighter and more saturated than the base background, but still a dark night scene.
Keep important elements inside x 6-94%, y 9-91%.
MOOD: the magic is awake - clearly "you are in the bonus".

--------------------------------------------------------------------
16/18  ID: s3_tlo_fs_mobile
ASPECT: 2:3 portrait (1024x1536) | BACKGROUND: PELNE | EXACT TEXT: none
EDIT: the LAYOUT of image 14 (s3_tlo_mobile) with the SCENE of image 15 (s3_tlo_fs_desktop).
ZONES: aurora ribbons and levitating crystals in the band y 0-20%; the grid zone (x 4-96%, y 20-66%) dark;
glowing crystal walls close to the side edges (may be cropped); dark water under the panel, fading to #07060F
. Keep important elements inside x 16-84%, y 6-94%.

--------------------------------------------------------------------
17/18  ID: s3_okladka
ASPECT: 2:3 portrait (1024x1536) | BACKGROUND: PELNE
EXACT TEXT: only the game logo "KRYSZTAŁOWA" / "KASKADA" exactly as in image 11 (Ł = L with stroke).
SUBJECT: key art cover for the game tile in the lobby.
COMPOSITION: the logo from image 11 in the band y 8-30%; in the centre (y 30-85%) the crystal golden
onion from image 01 emerging from a cascade of falling gems (sapphires, emeralds, amethysts, topazes,
rubies), behind it the luminous waterfall and crystal clusters; the bottom 15% fades to #07060F.
Everything important at least 5% from the edges.
MOOD: a waterfall of treasure and light.

--------------------------------------------------------------------
18/18  ID: s3_baner
ASPECT: 3:2 landscape (1536x1024) | BACKGROUND: PELNE | EXACT TEXT: none (no logo, no letters)
SUBJECT: a wide banner / video poster for the lobby carousel.
COMPOSITION: in the RIGHT ~60% a cascade of gems falling from above and the crystal golden onion (image
01) in a shaft of light; the LEFT ~40% is the dark depth of the cave with soft bioluminescence - empty
space for an HTML title and button. Important elements inside x 6-94%, y 9-91%.

Start now with image 01.
```

### 8.2. Checklista czatu 5

**Pliki:** 18 plików w `s3/`; 1:1 = 1024×1024, 3:2 = 1536×1024, 2:3 = 1024×1536.

- [ ] Symbole: prawdziwa przezroczystość (kryształ nie „przepuszcza” tła), brak cienia, wody i podłogi, margines ≥ 6%.
- [ ] **Test 56 px** (tyle ma pole na telefonie): każdy klejnot rozpoznawalny w sekundę; sylwetki: kropla (szafir),
      pionowy ośmiokąt (szmaragd), sześciokąt (ametyst), ukośne wrzeciono (topaz), serce (rubin), brylant (diament),
      cebula (cebula), trójkąt z wachlarzem (scatter), koło w pierścieniach (mnożnik).
- [ ] Test skali szarości: diament najjaśniejszy; szafir i ametyst różnią się kształtem; szmaragd i rubin różnią się
      kształtem i oprawą.
- [ ] Hierarchia: niskie bez opraw < wysokie w złotych oprawach < scatter i mnożnik; cebula łączy kryształ ze złotem.
- [ ] Fasety duże i wyraźne (nie „szum” setek drobnych faset); każdy symbol ma jeden wyraźny kolor dominujący.
- [ ] `SCATTER` napisany dokładnie (litera po literze).
- [ ] **Mnożnik:** środek kuli pusty, mlecznobiały, jednolity (~55% średnicy), **bez cyfr i „×”**; kula neutralna,
      chłodnobiała.
- [ ] **Odłamki:** arkusz 4×3 (drzazgi / bryłki / łuski w wierszach), bezbarwne, z przezroczystym tłem.
- [ ] **Logo:** `KRYSZTAŁOWA` z literą **Ł** (L z ukośną kreską) i `KASKADA`; trzy świetliste krople pod `KASKADA`.
- [ ] **Ramka:** okno 6:5 (szerokość ÷ wysokość = 1,200 ±3%), w 100% przezroczyste, kryształy nie wchodzą do okna,
      krawędź okna prosta i ostra; cała ramka w marginesie 6%.
- [ ] **Tła:** brak ramki i siatki; ciemna strefa siatki; wodospad znika za miejscem ramki; tła FS z tym samym
      układem co bazowe, jaśniejsze i z zorzą, ale strefa siatki dalej ciemna.
- [ ] Okładka z logo identycznym jak `s3_logo` (z Ł); baner bez tekstu, bohater po prawej.

---

## 9. Biblioteka promptów poprawkowych

**Jak używać:** skopiuj blok, uzupełnij miejsca w `<nawiasach>` i wyślij jako jedną wiadomość w tym samym czacie.
Każda poprawka zaczyna się od `POPRAW:`, więc ChatGPT generuje **ten sam ID** jeszcze raz. Możesz połączyć dwie
poprawki w jednej wiadomości (np. P4 + P13). Możesz też pisać własnymi słowami, nawet po polsku — gotowe bloki są
po prostu precyzyjniejsze. Po **trzech** nieudanych poprawkach: `NOWA WERSJA` albo uproszczenie opisu (P5).

| Kod | Problem | Kod | Problem |
|---|---|---|---|
| P1 | fałszywa szachownica | P12 | tekst tam, gdzie nie powinno go być |
| P2 | tło nieprzezroczyste | P13 | cień, podłoga, odbicie pod obiektem |
| P3 | literówki w napisach (Ł, Ż, Ę…) | P14 | światło z niewłaściwej strony |
| P4 | przycięcie obiektu | P15 | złe złoto (miedziane, cytrynowe…) |
| P5 | za dużo detalu, chaos | P16 | tło gry: jasny lub zajęty środek, automat na tle |
| P6 | dryf stylu, przeciek referencji | P17 | tło darmowych spinów ma inny układ niż bazowe |
| P7 | zły format (proporcja, rozmiar) | P18 | seria niespójna (moneta, maskotka, SPIN/STOP) |
| P8 | poświata ucięta na krawędzi / za duża | P19 | ramka: perspektywa albo zła proporcja okna |
| P9 | arkusz nierówny, nachodzący, zła kolejność | P20 | obiekt za mały albo za duży w kadrze |
| P10 | środek 9-slice niejednolity | P21 | zły styl (dziecięcy, zdjęcie, płaska grafika) |
| P11 | okno ramki nieprzezroczyste | P22 | kilka obrazów naraz, kolaż, pytania zamiast obrazu |

### P1. Fałszywa szachownica

Objaw: po przeciągnięciu pliku do karty przeglądarki wokół obiektu widać szaro-białą kratkę (narysowaną), a nie
ciemne tło karty. Pipeline potrafi ją czasem usunąć ([02 § 5.3](02-lista-obrazow.md#53-wykrycie-i-usunięcie-fałszywej-szachownicy)),
ale lepiej poprawić od razu. Dwa razy bez skutku → Plan B (§ 10).

```text
POPRAW: the background is a PAINTED checkerboard (grey and white squares drawn as pixels), not real
transparency. Regenerate the same ID with a truly transparent background: a PNG with a real alpha
channel where every background pixel has alpha = 0. Do not draw any checkerboard, grid or pattern behind
the object. Keep the object exactly as it is.
```

### P2. Tło nieprzezroczyste

Objaw: obiekt `ALFA` stoi na białym, szarym, czarnym, kolorowym tle, na gradiencie albo w scenerii.

```text
POPRAW: the background is not transparent - there is a solid, gradient or scenic backdrop behind the
object. This item is ALFA: regenerate it on a fully transparent background (real alpha channel, alpha = 0
everywhere around the object), with no backdrop, no vignette, no floor and no shadow. Keep the object
exactly as it is.
```

### P3. Literówki w napisach (Ł, Ż, Ę i inne)

Objaw: brak kreski w `Ł`, zła litera, litera za dużo lub za mało, dodatkowe słowa. Wpisz poprawny tekst
i rozpisz litery. Na makietach (czat 0) literówki są dopuszczalne; na logo i symbolach — nigdy.

```text
POPRAW: the text is misspelled. It must read exactly "<TEKST>" - letter by letter: <L-I-T-E-R-Y>.
Polish letters: Ł = L with stroke (a capital L with a short diagonal bar through its vertical stem);
Ż = Z with a dot above; Ę = E with ogonek (a small hook under the bottom right of the E); Ą = A with
ogonek; Ó = O with an acute accent; Ź = Z with an acute accent; Ś = S with an acute accent; Ć = C with an
acute accent; Ń = N with an acute accent. No extra or missing letters, no other words. Keep the design,
lettering style, size and position exactly as they are.
```

Gotowe wypełnienia najczęstszych przypadków:

```text
POPRAW: the text is misspelled. The logo must read exactly "ZŁOTY" (first line) and "FARAON" (second
line): Z - Ł - O - T - Y and F - A - R - A - O - N. The second letter of ZŁOTY is Ł = L with stroke: a
capital L whose vertical stem is crossed by a short diagonal bar (like a slash through the stem). It is
NOT a plain L and NOT a T. Keep the design, lettering style, size and position exactly as they are.
```

```text
POPRAW: the text is misspelled. The logo must read exactly "KRYSZTAŁOWA" (first line) and "KASKADA"
(second line): K - R - Y - S - Z - T - A - Ł - O - W - A and K - A - S - K - A - D - A. The eighth letter
of KRYSZTAŁOWA is Ł = L with stroke: a capital L whose vertical stem is crossed by a short diagonal bar.
Eleven letters in the first line, seven in the second. Keep the design and lettering style exactly.
```

```text
POPRAW: the text on the symbol is misspelled. It must read exactly "<WILD | SCATTER | BAR>":
<W-I-L-D | S-C-A-T-T-E-R (two T) | B-A-R>, capitals only, nothing else. Keep the symbol identical.
```

### P4. Przycięcie obiektu

Objaw: obiekt, jego poświata, iskra, rondo cylindra albo moneta dotyka krawędzi kadru lub jest ucięta.

```text
POPRAW: part of the object is cut off by the canvas edge (or touches it). Regenerate the same ID with the
whole object - including glow, sparkles and thin parts - fully inside the canvas, scaled down so that
there is at least 6% empty margin on every side (about 62 px on a 1024 px side). Keep the design
identical.
```

### P5. Za dużo detalu, chaos

Objaw: obraz „pstry”, drobne ornamenty, wiele obiektów; po zmniejszeniu do 64 px (S3: 56 px) zamienia się w szum.

```text
POPRAW: too much detail - it looks busy and will turn into noise when shrunk to 64 px. Simplify: one main
form and at most two levels of detail, remove small ornaments, extra sparkles and secondary objects, make
the silhouette bolder and the shapes bigger, and increase the contrast between light and dark areas.
Same colours, materials, lighting and concept.
```

### P6. Dryf stylu, przeciek referencji

Objaw: obraz nie pasuje do wcześniejszych w tym czacie — inne złoto, inny render, inny kąt kamery; albo cechy
makiety S1 (neon) pojawiają się w S2 lub S3. Jeśli to kolejny raz z rzędu, napisz najpierw `ZASADY`.

```text
POPRAW: the style drifted away from the set. Match the earlier accepted images of this chat and the
attached reference images exactly: the same warm yellow polished gold (base #F5C542, not copper, not
lemon), the same lighting (warm key light from the upper left, cool rim light on the right edges), the
same camera angle, the same level of gloss and detail, the same high-end stylized 3D render. Regenerate
this ID.
```

Dopisek dla S2 i S3, gdy przecieka neon z makiety S1:

```text
POPRAW: neon pink, electric blue or retro neon tubes leaked into this image from the reference mockup of
another game. Remove them completely. This game uses only its own palette (<Złoty Faraon: gold, lapis
lazuli, turquoise, sandstone | Kryształowa Kaskada: gems, teal bioluminescence, amethyst, gold>).
Keep everything else.
```

### P7. Zły format

Objaw: inny rozmiar niż 1024×1024 / 1536×1024 / 1024×1536 albo zamieniona orientacja (poziomy zamiast pionowego).
Zamieniona orientacja to zawsze błąd ([02 § 2.1](02-lista-obrazow.md#21-formaty-z-chatgpt)).

```text
POPRAW: wrong size or aspect ratio. This ID must be <1:1 square 1024x1024 | 3:2 landscape 1536x1024 |
2:3 portrait 1024x1536>. Regenerate it in exactly that format, recomposing (not stretching and not
cropping) the same content.
```

### P8. Poświata ucięta na krawędzi albo za duża

Objaw (`CZARNE`): poświata, promień albo dym sięga krawędzi, tło nie jest czysto czarne. Objaw (`ALFA`): wokół obiektu
rozlana mgła albo poświata dochodzi do marginesu.

```text
POPRAW: the glow reaches or is cut by the image edge. Regenerate the same effect smaller: every glow must
fade smoothly to pure black #000000 well before the edges, with at least 8% pure black margin on every
side (10% of each cell in a sheet). The background is pure black everywhere: no gradient, no vignette,
no noise, no stars.
```

```text
POPRAW: the glow around the object is too big (a haze spread over the canvas). This is an ALFA asset: keep
only a subtle, tight glow (reach at most 4-6% of the object size) that fades out completely inside the
6% margin, or no glow at all - the game adds glow in code. Keep the object identical, background
transparent.
```

### P9. Arkusz nierówny, nachodzący, zła kolejność

Objaw: elementy dotykają się lub wchodzą do sąsiedniej komórki, inna liczba elementów, zła kolejność, widoczne linie
siatki albo podpisy.

```text
POPRAW: the sprite sheet is wrong (elements overlap, touch, cross cell borders, or the count or order is
wrong). Regenerate it as an exact grid of <KOLUMNY> columns x <WIERSZE> rows of equal invisible cells,
exactly one element per cell in the listed order (row by row, left to right, top to bottom), every
element fully inside its cell with at least 10% margin, nothing touching, no grid lines, no labels,
same background type as before.
```

### P10. Środek 9-slice niejednolity

Objaw: w środku panelu albo przycisku jest ornament, iskra, plama refleksu, zmiana faktury; krawędź nie jest taka
sama na całej długości.

```text
POPRAW: this is a 9-slice piece and its middle is not uniform (there is an ornament, sparkle, highlight
spot or texture change). Keep all decoration only in the corners (or in the rounded ends of the button).
The straight edges must be identical along their whole length and the middle area perfectly plain and
uniform along the stretch direction (a smooth vertical gradient and a straight full-length gloss stripe
are allowed). Strictly frontal, symmetrical, no text, no icon.
```

### P11. Okno ramki nieprzezroczyste

Objaw: w oknie ramki jest szyba, refleks, ciemne tło, bębny, symbole albo przegródki.

```text
POPRAW: the window of the frame is not empty. It must be a FULLY TRANSPARENT rectangle (alpha = 0) with
perfectly straight horizontal and vertical edges and the exact proportion <1:1 | 5:3 | 6:5>: no glass,
no reflections, no dark backing, no reels, no symbols, no dividers. Strictly frontal orthographic frame,
no perspective. Everything outside the frame transparent as well.
```

### P12. Tekst tam, gdzie nie powinno go być

Objaw: napisy na szyldach, „pseudo-litery”, podpis, znak wodny, tekst na przycisku lub panelu.

```text
POPRAW: remove all text. This item must contain no letters, words, numbers, logos, labels, signatures or
watermarks (signs, plaques and buttons stay blank). Keep everything else exactly the same.
```

Wariant dla obrazów z zamówionym tekstem:

```text
POPRAW: the only text allowed in this image is "<TEKST>". Remove every other letter, word, number,
signature or watermark. Keep everything else exactly the same.
```

### P13. Cień, podłoga, odbicie pod obiektem

```text
POPRAW: remove the cast shadow, the floor or ground and any reflection under the object. The object floats
on a fully transparent background; only its own shading and ambient occlusion remain. Keep everything
else identical.
```

### P14. Światło z niewłaściwej strony

```text
POPRAW: the main light comes from the wrong side. The key light must come from the UPPER LEFT (highlights
in the upper-left part of every form), with a thin cool rim light on the RIGHT edges (<cyan | in Złoty
Faraon: turquoise | in Kryształowa Kaskada: teal>) and a subtle accent rim on the lower left (<magenta |
in Złoty Faraon: amber | in Kryształowa Kaskada: violet>). Keep the design identical.
```

### P15. Złe złoto

```text
POPRAW: the gold has the wrong colour (too <copper | rose | orange | lemon | greenish | grey>). Use warm
yellow 22-24 karat gold exactly like the attached coin: lit faces #FFE08A, base #F5C542, half-shadows #B8860B,
dark reflections #2B1A00, tiny specular cores #FFF6D6. Keep everything else identical.
```

### P16. Tło gry: jasny lub zajęty środek, automat na tle

Strefa bębnów: desktop `x 18-82%, y 12-80%`, mobile `x 4-96%, y 20-66%`; lobby desktop `x 25-75%, y 25-85%`.

```text
POPRAW: the centre of this background is too bright or too busy (or it contains a slot machine, reels, a
frame, symbols or text). The reel/interface zone (<x 18-82%, y 12-80% | x 4-96%, y 20-66%>) must be the
darkest and calmest part: deep shadow, minimal detail, no bright points, nothing standing in it. Move the
light sources and the detail to the sides and the top corners. No machine, no reels, no symbols, no text.
Same scene, colours and mood.
```

### P17. Tło darmowych spinów ma inny układ niż bazowe

```text
POPRAW: this free spins background does not match the layout of the base background <s2_tlo_desktop |
s2_tlo_mobile | s3_tlo_desktop | s3_tlo_mobile>. Keep exactly the same horizon line, vanishing point and
composition zones as that image (the dark reel zone in the same place and size, the logo band at the
top); change only the scene and the mood as described in the item.
```

### P18. Seria niespójna

Objaw: druga moneta jest inną monetą, maskotka ma inne proporcje albo monokl po złej stronie, przycisk STOP ma inny
pierścień, dyski ikon są różne, napis MEGA ma inny krój niż BIG.

```text
POPRAW: this must be EXACTLY the same <coin | character | button | lettering> as in image <NN> (<ID>):
identical design, proportions, colours, materials, lighting, size and position on the canvas. Change
only: <CO MA SIĘ ZMIENIĆ, np. "the rotation angle" / "the pose and expression" / "the icon">.
```

Gotowe wypełnienie dla maskotki:

```text
POPRAW: the character changed. It must be exactly the same Pan Cebulion as in image 07
(g_maskotka_powitanie): the same bulb proportions with 7 vertical ribs, the same black-violet top hat tilted
toward the right edge of the image, the monocle on the character's RIGHT eye (LEFT side of the image), the
same magenta bow tie, white wing collar, cream gloves, curled golden root moustache and almond-shaped
eyes. Change only the pose, expression and props of this item.
```

### P19. Ramka: perspektywa albo zła proporcja okna

```text
POPRAW: the window has the wrong shape (perspective, not a rectangle, or the wrong proportion). Draw the
frame strictly frontal (orthographic, no perspective, symmetrical) with a window of exactly <1:1 | 5:3 |
6:5> (width : height), with straight horizontal and vertical edges, fully transparent, and the whole frame
inside a 6% margin from the canvas edges.
```

### P20. Obiekt za mały albo za duży w kadrze

```text
POPRAW: the object is too <small | large> on the canvas. Scale it so that it fills about <80 | 82 | 85>%
of the canvas, centred, keeping at least 6% empty margin on every side. Keep the design identical.
```

### P21. Zły styl (dziecięcy, zdjęcie, płaska grafika)

```text
POPRAW: wrong rendering style (<too childish, toy-like or cartoonish | too photographic | flat vector
clip-art>). Render it as a high-end stylized 3D asset of a premium mobile slot game: polished gold and
glossy materials, clean bevels, cinematic studio light, rich but controlled detail. Not a children's
cartoon, not a photograph, not flat clip-art. Same subject and composition.
```

### P22. Kilka obrazów naraz, kolaż, pytania zamiast obrazu

Objaw: ChatGPT rysuje kilka obiektów w jednym obrazie, proponuje warianty, pyta o szczegóły albo odpowiada tekstem.

```text
Generate now ONLY the image for the next ID in the list - one image, one asset, no collage, no
variations, no questions. Write the line "ID: <id> | <aspect> | <background>" above it and then wait for
my command, exactly as described in the workflow protocol.
```

---

## 10. Plan B: gdy przezroczystość nie działa

ChatGPT zwykle potrafi zapisać PNG z prawdziwą przezroczystością, ale **nie mamy gwarancji**, że zawsze tak będzie
(model i interfejs się zmieniają, a generator czasem rysuje szachownicę). Jeśli dwie poprawki P1/P2 z rzędu nie
pomogą, przełącz czat na **Plan B: jednolite tło kluczowe**, które pipeline usunie automatycznie
([02 § 5.4](02-lista-obrazow.md#54-awaryjne-usuwanie-jednolitego-tła)).

### 10.1. Zasady Planu B

| Typ obrazu | Plan B | Dlaczego |
|---|---|---|
| `ALFA` bez poświaty (symbole, UI, maskotka, logo, ramki, arkusze ALFA) | płaskie tło w **kolorze klucza** (tabela 10.2), obiekt **bez poświaty i bez aury**, ostre krawędzie | pipeline usuwa jednolite tło przez odległość koloru ΔE; poświata na zielonym tle zamieniłaby się w zieloną mgłę, której nie da się odfiltrować |
| poświaty, aury, wiązki światła na obiektach `ALFA` | **pomijamy** — dorobi je kod (warianty `glow`, [02 § 2.7](02-lista-obrazow.md#27-nazwy-plików)) | w grze i tak rysujemy poświatę osobnym sprite'em w trybie `add` |
| `CZARNE` (efekty) | bez zmian: czyste `#000000` | czerń to dla nich docelowe tło (tryb `add`) |
| `PELNE` (tła, makiety, okładki, banery) | bez zmian | nie mają przezroczystości |

Elementy świetlne będące częścią projektu (wachlarz tęczy `s3_sym_scatter`, wiązka `s2_sym_scatter`, płomienie
`g_win_epic`) w Planie B rysujemy jako **nieprzezroczyste, stylizowane kształty** bez mgły wokół — albo pomijamy,
jeśli i tak wyglądają źle.

### 10.2. Który kolor klucza

Kolor klucza musi być jak najdalej od kolorów **na krawędzi obiektu**, bo tam pipeline liczy przezroczystość. Jeśli
ponad 3% obrysu ma kolor zbliżony do tła, raport zgłosi „niski kontrast tła” (02 § 5.4, pkt 6).

| Kolor klucza | Dla których obrazów | Dlaczego ten |
|---|---|---|
| `#00FF00` (zielony, **domyślnie**) | wszystkie obrazy `ALFA` z czatów 1–2 (także `g_awatary` i `g_ui_ikony` — ich krawędź to złoty otok), oprócz `g_win_free_spins`; z czatu 3: `s1_sym_siodemka`, `s1_sym_wild`, `s1_sym_bar`, `s1_sym_dzwonek`, `s1_logo`, `s1_ramka`; z czatu 5: wszystkie oprócz `s3_sym_szmaragd` i `s3_ramka` | złoto, magenta, cyjan, czerwień i fiolet są daleko od czystej zieleni |
| `#FF00FF` (magenta) | `g_win_free_spins` (turkusowa poświata liter); **wszystkie obrazy `ALFA` z czatu 4** (S2: turkus i malachit na krawędziach, brak różu w palecie); `s3_sym_szmaragd`; `s3_ramka` (zielony mech) | obiekty z zielenią i turkusem, bez różu |
| `#0000FF` (niebieski) | owoce S1: `s1_sym_wisnie`, `s1_sym_cytryna`, `s1_sym_sliwka`, `s1_sym_arbuz` | mają jednocześnie zielone listki/skórkę i różowy neon — zieleń i magenta odpadają; czystego niebieskiego w owocach nie ma |

### 10.3. Blok włączający Plan B dla całego czatu

Wyślij jako osobną wiadomość, potem `POPRAW:` dla bieżącego ID albo `DALEJ`. Kolor klucza dobierz z tabeli 10.2;
jeśli w czacie są obrazy wymagające różnych kolorów, podaj kolor w każdym `POPRAW:` (blok 10.4).

```text
PLAN B ON - from now on, for every item of type ALFA (including FRAME and ALFA SHEET items) do NOT use
transparency. Instead:
- Put the object on a perfectly flat, uniform chroma background of exactly <#00FF00 | #FF00FF | #0000FF>
  (one single colour everywhere) - no gradient, no vignette, no texture, no shadow, no light or
  reflections on the background.
- The object has NO glow, NO aura, NO light haze and NO semi-transparent parts around its silhouette:
  crisp, clean, fully opaque edges. The background colour must not reflect on the object or tint its edges
  (no colour spill). Light effects that belong to the design (beams, flames, light fans) are drawn as
  opaque stylised shapes or left out.
- Keep the 6% margin, the centring and everything else from the item description.
- FRAME items: the window and everything outside the frame are filled with the same flat chroma colour.
- SHEET items: the whole sheet background is the same flat chroma colour.
- CZARNE items stay on pure black #000000 as before. PELNE items do not change.
Keep using PLAN B until I write PLAN B OFF.
```

### 10.4. Plan B tylko dla jednego obrazu

```text
POPRAW: transparency does not work for this image. For this ID only use PLAN B: place the object on a
perfectly flat, uniform background of exactly <#00FF00 | #FF00FF | #0000FF> (no gradient, no shadow, no
texture), with NO glow or aura around the object, crisp fully opaque edges and no colour spill from the
background onto the object. Keep the design, size, centring and the 6% margin.
```

```text
PLAN B OFF - return to true transparent backgrounds (real alpha channel) for ALFA items, as in the
original rules.
```

**Odłamki `s3_fx_odlamki` w Planie B:** zielone tło prześwitywałoby przez półprzezroczysty kryształ, dlatego w prompcie
odłamki są „mostly opaque milky crystal”. Jeśli mimo to widać przez nie tło — `POPRAW: the shards must be fully
opaque milky-white crystal, the background colour must not show through them.`

**W wiadomości przy wysyłce** zaznacz, które pliki są z Planu B i z jakim kolorem klucza (§ 11.3) — pipeline i tak
wykryje jednolite tło sam, ale ułatwi to kontrolę.

---

## 11. Kontrola jakości przed wysłaniem i wysyłka

### 11.1. Szybka kontrola każdego obrazu (1–3 minuty)

Pełna procedura i checklista stylu: [01 § 13](01-kierunek-artystyczny.md#13-checklista-akceptacji-obrazu). W praktyce
wystarczy sześć kroków:

1. **Plik:** nazwa = ID + `.png`, wymiary zgodne z tabelą czatu, rozmiar zwykle 1–3,5 MB.
2. **Tło:** `ALFA` — przeciągnij plik do karty Chrome/Edge; przez tło ma prześwitywać ciemne tło karty, bez kratki
   ([02 § 4.3](02-lista-obrazow.md#43-jak-pobrać-oryginał-z-chatgpt)). `CZARNE` — tło jednolicie czarne. Ramki — okno
   puste.
3. **Kadr:** nic nie dotyka krawędzi, margines ~6% (ok. 60 px przy 1024 px); `CZARNE` — poświata gaśnie przed krawędzią.
4. **Mały rozmiar:** ustaw w eksploratorze plików widok „Średnie ikony” (miniatury ~48–96 px) — symbole i ikony
   mają być rozpoznawalne od razu.
5. **Tekst:** litera po literze z kolumną „Tekst na obrazie” w tabeli czatu; szczególnie `Ł` w `ZŁOTY FARAON`
   i `KRYSZTAŁOWA KASKADA`.
6. **Spójność:** połóż obraz obok zaakceptowanych z tej samej grupy (np. wszystkie symbole gry w jednym folderze
   w widoku miniatur) — to samo złoto, to samo światło, ten sam kąt kamery.

| Decyzja | Kiedy | Co dalej |
|---|---|---|
| **Akceptuj** | wszystko się zgadza | pobierz, nazwij, `DALEJ` |
| **Akceptuj — poprawimy w obróbce** | drobiazgi: lekko za mały margines, minimalna obwódka, jasność ±10% | pobierz, `DALEJ`, dopisz uwagę przy wysyłce |
| **Popraw** | literówka, przycięcie, cień, zły kierunek światła, szachownica, zła proporcja okna ramki | `POPRAW:` z § 9 |
| **Od nowa** | zły styl (zdjęcie, płaska grafika, styl dziecięcy), wyraźna niespójność z kotwicą | `NOWA WERSJA` |

### 11.2. Przed wysłaniem paczki

Lista kontrolna z [02 § 4.8](02-lista-obrazow.md#48-lista-kontrolna-przed-wysłaniem) plus:

- [ ] W folderze są **wszystkie** ID danego czatu (porównaj z tabelą na początku sekcji czatu) albo wiesz, których brakuje.
- [ ] Brak duplikatów i plików roboczych (`ChatGPT Image …png` przemianowane albo w `nieposortowane/`).
- [ ] Kolejne wersje mają nazwy `<ID>.v2.png`, a nie `<ID> (1).png`.
- [ ] Pliki z Planu B (tło kluczowe) zanotowane razem z kolorem klucza.
- [ ] Odhaczona checklista czatu (§ 3.2, 4.2, 5.2, 6.2, 7.2, 8.2).

### 11.3. Jak wysłać

| Sposób | Kiedy | Opis |
|---|---|---|
| **A: commit do repozytorium** (zalecany) | masz dostęp do GitHuba | gałąź `grafika-zrodla`, *Add file → Upload files*, przeciągnij folder `art` z podfolderami — krok po kroku w [02 § 4.4](02-lista-obrazow.md#44-sposób-a-commit-do-repozytorium-zalecany) |
| **B: ZIP w czacie** | szybciej, bez GitHuba | spakuj folder czatu (np. `czat3.zip` z `s1/`) i wyślij **jako plik**, nie jako zdjęcia — [02 § 4.5](02-lista-obrazow.md#45-sposób-b-załącznik-w-czacie) |

Nie wysyłaj obrazów przez komunikatory jako zdjęć (kompresja do JPEG niszczy przezroczystość) i nie otwieraj ich
przed wysłaniem w edytorach, które zapisują plik ponownie (szczegóły: 02 § 4.3).

**Wzór wiadomości do zespołu** (skopiuj i uzupełnij):

```text
Paczka: czat <N> (<zakres>) - <liczba>/<wszystkich> obrazów
Sposób: <commit na gałąź grafika-zrodla | ZIP w załączniku>
Folder: art/zrodla/<makiety | global | s1 | s2 | s3>/
Brakuje: <ID albo "nic">
Nowe wersje: <np. s1_sym_bar.v2.png zastępuje s1_sym_bar.png>
Plan B (tło kluczowe): <brak | ID + kolor, np. s1_sym_wisnie #0000FF>
Uwagi: <np. s1_ramka - okno wydaje mi się lekko prostokątne>
```

**Kolejność paczek** (żeby jak najszybciej powstała grywalna wersja): makiety → kotwice (`g_moneta_przod`,
`g_emblemat`, `g_ui_spin`) → reszta P0 z czatów 1–2 → czat 3 (S1) → P1 z czatów 1–2 i czat 4 (S2) → czat 5 (S3).
Szczegóły: [02 § 4.7](02-lista-obrazow.md#47-kolejność-dostaw). Po każdej paczce zespół uruchamia pipeline i odsyła
raport z ewentualnymi poprawkami w formacie „ID — kod kontroli — gotowa poprawka P1–P22 z § 9”.

---

## 12. Otwarte kwestie i ryzyka

| # | Kwestia | Ryzyko | Plan / decyzja |
|---|---|---|---|
| 1 | Przezroczystość PNG w ChatGPT | generator może narysować szachownicę albo oddać tło | P1/P2, potem Plan B (§ 10); pipeline naprawia szachownicę i usuwa jednolite tło (02 § 5.3–5.4) |
| 2 | Okna ramek `s2_ramka` i `s3_ramka` mniejsze niż w 01 § 10.8 / § 11.8 (~70% zamiast ~80% szerokości kadru) | 01 i 03 podają inne liczby | świadoma zmiana: 80% okna + boki ramy ~10% dawało 100% szerokości i łamało margines 6% z briefu; proporcje okien (5:3, 6:5) bez zmian; **do naniesienia w 01**. Dla `s3_ramka` okno ~717 px → @1x 864 px to powiększenie ×1,2 (limit 02 § 2.6: ×1,25) |
| 3 | `s2_wild_rozszerzony` ma nieprzezroczysty pionowy kartusz z lapisu jako tło kolumny | 01 § 10.5 mówi tylko o „słupie złotego światła” | doprecyzowanie: półprzezroczysty słup światła w PNG z alfą dawałby brudne krawędzie (01 § 4.5); kolumna jest nieprzezroczysta, poświatę wokół dokłada kod (wariant `glow`) — do potwierdzenia z 04 (E60) |
| 4 | Litera Ł w logo S2 i S3 | generator może uparcie rysować `L` | P3 z rozpisanymi literami; po 3 próbach — ręczny retusz kreski w edytorze grafiki (litery są duże, ~10 minut pracy), plik zapisany jako `<ID>.v2.png` |
| 5 | Spójność serii (3 ujęcia monety, 3 pozy maskotki, SPIN/STOP, 5 napisów WIN) | edycja może zmienić szczegóły | pozycje `EDIT` + P18; plan B dla monety: obrót składany w kodzie albo sprite-sheet z Blendera (01 § 2.5) |
| 6 | Limity generowania i zmiany modelu | przerwy, inny wygląd po aktualizacji modelu | kontynuacja w tym samym czacie (§ 1.7); przy wyraźnej zmianie stylu — kotwice jako referencje w nowym czacie |
| 7 | Długość bloku (najdłuższy, czat 4, ma ok. 28 tys. znaków) | interfejs mógłby odrzucić zbyt długą wiadomość | nie spodziewamy się tego; gdyby się zdarzyło — wyślij blok w dwóch częściach: do linii `IMAGE LIST` z dopiskiem `Do not generate yet - the image list follows in my next message.`, a potem resztę |
| 8 | Liczba załączników w jednej wiadomości | nieznany dokładny limit | używamy maks. 4 obrazów; w razie odmowy — załącz 2 najważniejsze (makieta gry + `g_moneta_przod`) |
| 9 | Promienie `g_fx_promienie` kończą się na 42% szerokości (01: „przed 45%”), błyskawice mają ~80% wysokości komórki (01: ~85%) | drobna różnica liczb | zaostrzenie, żeby zachować margines czerni 8% / 10% komórki z briefu; zgodne z intencją 01 |

---

## Powiązane dokumenty

* [README.md](README.md) — spis treści dokumentacji projektu i sposób korzystania z niej.
* [01-kierunek-artystyczny.md](01-kierunek-artystyczny.md) — biblia stylu, z której „skompilowane” są prompty
  (paleta, światło, materiały, opis każdego obrazu, checklista akceptacji w § 13).
* [02-lista-obrazow.md](02-lista-obrazow.md) — manifest 93 obrazów, jak pobrać i dostarczyć pliki (§ 4), pipeline
  obróbki (§ 5) i raport jakości.
* [04-efekty-wizualne.md](04-efekty-wizualne.md) — jak kod animuje obrazy z tego dokumentu (promienie, flary, iskry,
  napisy wygranych, zdarzenia E01–E73).
* [05-dzwiek-i-muzyka.md](05-dzwiek-i-muzyka.md) — dźwięki i muzyka (opcjonalne prompty dla generatora muzyki).
* [06-interfejs-ux.md](06-interfejs-ux.md) — gdzie w interfejsie trafiają przyciski, panele, ikony i teksty HTML.
* [07-gry-i-matematyka.md](07-gry-i-matematyka.md) — zasady trzech automatów, dla których powstają symbole.
* [08-wydajnosc-i-jakosc.md](08-wydajnosc-i-jakosc.md) — dlaczego efekty są na czarnym tle, atlasy i budżety wagi.
* [09-kontrakt-api-i-assetow.md](09-kontrakt-api-i-assetow.md) — kontrakt plików wynikowych (`assets/img/…`, `manifest.json`).
* [../plan-projektu.md](../plan-projektu.md) — wcześniejszy plan całego projektu. Tam, gdzie się różni (np. grafika
  z Blendera zamiast z ChatGPT), obowiązuje obecna dokumentacja w `docs/projekt/`.

