# Stan prac — Cebulion Casino

Aktualizacja lokalna: **11 października 2026**. Projekt znajduje się w `E:\CebulionCasino\gra`,
na podstawie gałęzi `claude/dazzling-bell-be3okd`. Zmiany z bieżącej pracy są lokalne; nie wykonano push.
Ten plik pozostaje dziennikiem przekazania i nie należy go usuwać podczas końcowego pakowania.

## Źródła prawdy

| Plik | Rola |
|---|---|
| `docs/projekt/00-brief.md` | decyzje projektowe, identyfikatory zasobów, paleta, tempo i zakres gry |
| `docs/projekt/09-kontrakt-api-i-assetow.md` | format odpowiedzi spinu, endpointy i manifesty |
| `docs/projekt/07-gry-i-matematyka.md` | reguły trzech automatów; wynik i portfel oblicza serwer |
| `docs/projekt/10-runtime-gier.md` | rzeczywista implementacja przeglądarkowa i wyniki weryfikacji |
| `docs/obrona/00-uruchomienie.md` | uruchomienie aplikacji |

## Zrobione

| Część | Stan | Pliki |
|---|---|---|
| Backend i portfel | działają: logowanie nickiem, sesja, bonus powitalny, ratunek, ranking, raporty, historia i idempotencja rund | `src/main/java/pl/wsb/kasyno/**` |
| Silniki trzech automatów | gotowe; wynik rundy, kroki bonusowe i saldo przychodzą z serwera | `slots/application/engine/**` |
| Lobby i kontroler gry | działają na prawdziwym backendzie; responsywne sterowanie, SPIN/STOP, AUTO, TURBO, zasady i ustawienia | `static/index.html`, `static/gra.html`, `static/js/game/controller.js` |
| Runtime PixiJS | wspólny odtwarzacz kroków, bębny, efekty, strażnik błysków, jakość, ograniczony ruch i dźwięk | `static/js/game/**` |
| S1 — Cebulowy 777 | gotowy; linie, mnożnik WILD i NEON JACKPOT | `static/js/game/games/s1.js` |
| S2 — Złoty Faraon | gotowy; właściwa scena, antycypacja, rozszerzanie WILD, darmowe spiny, retrigger i zmiana muzyki | `static/js/game/games/s2.js` |
| S3 — Kryształowa Kaskada | gotowa dedykowana plansza grawitacyjna, klastry, kule mnożników i bonus; test prezentacji 39/39 | `static/js/game/games/s3.js`, `s3-board.js` |
| Grafika | manifest i przetworzone zasoby gotowe; baner EPIC WIN poprawiony; walidacja: 0 błędów i 0 ostrzeżeń | `tools/art/**`, `static/assets/img/**` |
| Dźwięk | pliki i silnik audio działają; sprawdzono przejścia muzyki, wyciszenie oraz zwalnianie zasobów | `static/assets/audio/**`, `static/js/audio/**` |
| Licznik darmowych spinów | pokazuje pozostałe spiny i sumę wygranych bonusu bez wygranej bazowej; mieści się przy 320 px | `controller.js`, `BaseGame.afterStep()` |
| Saldo w trakcie bonusu | zapis `balanceAfter` odroczony do końca rundy; przyszłe wygrane nie pojawiają się w saldzie przed prezentacją | `BaseGame.book()`, `runtime-contract.mjs` |
| Lokalne środowisko Windows | Java 21 i Maven zainstalowane na E; aplikacja uruchomiona do testów | `E:\CebulionCasino\narzedzia`, `aplikacja`, `dane`, `logi` |
| Podglądy wideo | komplet S1/S2/S3 nagrany i odtwarzany poprawnie: 3/3; każdy 480×720, 12 s, H.264 i VP9, poniżej 2 MiB na plik | `tools/video/**`, `static/assets/video/**` |

## Potwierdzone testy bieżącej integracji

| Test | Wynik |
|---|---|
| Java / Maven | **258/258** |
| Lobby na prawdziwym backendzie | **68/68** |
| `tools/e2e/backend-flow.mjs` | **46/46**, 126 rund |
| `tools/e2e/gra-s1.mjs` | **35/35** |
| `tools/e2e/gra-s2.mjs` | **29/29** |
| `tools/e2e/audio-lifecycle.mjs` | **13/13** |
| `tools/e2e/runtime-contract.mjs` | **2/2** |
| Pipeline obrazów | **0 błędów / 0 ostrzeżeń** |
| `tools/e2e/gra-s3.mjs` | **39/39** na kontrolowanych odpowiedziach |
| Odtwarzanie wideo S1/S2/S3 | **3/3** |

Raporty i zrzuty bieżącej instalacji są w `E:\CebulionCasino\testy`; częściowe raporty narzędzi
mogą być także w podkatalogach `tools/e2e/zrzuty`. Wyniki testów z kontrolowanymi odpowiedziami opisują
prezentację. Poprawność portfela i matematyki jest weryfikowana osobno testami Javy i rzeczywistego API.

S2 sprawdzono wizualnie i automatycznie przy 320×640, 390×844, 844×390 oraz 1366×768.
Kontrola obejmuje rzeczywistą widoczność i klikalność SPIN, dopasowanie ramki do okna z manifestu,
pełny bonus z retriggerem i trzema rozszerzonymi kolumnami, saldo oraz ograniczony ruch.

## Końcowe uruchomienie

Dedykowana scena S3 na rzeczywistym backendzie: **8/8**, profil demo, seed 9.
Finalny pakiet zbudowano, a 779 plików statycznych w JAR porównano ze źródłami — identyczne.
Zaktualizowana aplikacja działa na `http://localhost:8080`, z zachowaną bazą graczy i sald.
Kopia początkowej wersji pozostaje w `E:\CebulionCasino\aplikacja\wersja-poczatkowa.jar`.

Końcowy test pakietu na porcie 8080: **3/3 prawdziwe rundy przez UI**, **3/3 podglądy wideo**,
zero błędów JavaScript, console error i 404. Widoczne saldo zgadza się z API w każdej grze.
Raport: `E:\CebulionCasino\testy\final-check\results.json`.
Pomocnicze serwery testowe 8081 i 8090 zamknięto; działa gotowa aplikacja 8080.

Katalog `wip/` pozostaje dokumentacją przekazania.

## Dalsze, opcjonalne sprawdzenia

* Pomiar płynności na rzeczywistym telefonie; rozmiary okien w Chromium nie zastępują wydajności urządzenia.
* Publiczny hosting wymaga osobnego wdrożenia. Lokalny serwer nie oznacza opublikowanej gry w internecie.
* Dodatkowe ręczne strojenie poziomów muzyki i efektów na słuchawkach oraz głośnikach.

## Środowisko i uruchomienie

* Wszystkie nowe instalacje, projekt, dane, raporty i katalogi tymczasowe tej pracy są na dysku **E**.
* Główny katalog: `E:\CebulionCasino`. JDK 21 i Maven: `narzedzia`; źródła: `gra`; dane: `dane`;
  logi: `logi`; pliki pobrane: `pobrane`; cache: `cache`; pliki tymczasowe: `tmp`.
* Przygotowany lokalny start: `E:\CebulionCasino\Uruchom-gre.cmd` / `Uruchom-gre.ps1`.
* Podczas integracji: aplikacja użytkownika na porcie 8080, backend deweloperski na 8081 i atrapa API na 8090.
  Nie zatrzymywać aplikacji użytkownika bez potrzeby; nowy pakiet podmienić dopiero po zakończeniu testów.
* Testy frontu używają `tools/node_modules` i istniejącego Chrome. `PW_CHROMIUM` wskazuje plik wykonywalny;
  zmienne `TEMP` i `TMP` dla nowych procesów powinny wskazywać `E:\CebulionCasino\tmp`.
* Zakres publikacji na gałęzi `claude/dazzling-bell-be3okd`: komplet scen S2/S3, media, poprawki prezentacji wygranych i responsywności, panel debugowania oraz testy i dokumentacja.

## Poprawki po zgłoszeniu użytkownika

- Serwer rozlicza wygraną w transakcji przed HTTP; dodatkowe opóźnienie było po stronie liczników.
- Końcowe saldo jest wyświetlane od razu po prezentacji wygranej, zanim SPIN wróci do gotowości.
- Pole WYGRANA nie cofa się podczas powtórnego podsumowania kaskad/FS, resetuje się przy następnym spinie.
- Opóźniony fade starszej kwoty nie ukrywa kolejnej prezentacji.
- Tweener oddaje zakończone obiekty do puli dopiero po usunięciu ich z aktywnej listy;
  szybki skip nie uruchamia już kolejnej animacji dwukrotnie w jednej klatce.
- Okno braku środków nie obcina tekstu bonusu i nie nakłada tytułu na zamknięcie.

Weryfikacja: funds-modal 26/26; pomiar wygranych 16 rund; po zmianie zegara 12 rund / 6 kryteriów;
regresja dwóch kwot 1/1; regresje Tweener 6/6. Raporty przed i po: `E:\CebulionCasino\testy\audit-*`.
Poprzedni pakiet zachowany jako `E:\CebulionCasino\aplikacja\przed-poprawka-wygranych.jar`.

## Panel debugowania i audyt zasad

- Nad planszą działa zwijany panel DEBUG z przyciskami SCATTER i BONUS (S2/S3),
  KASKADA (S3) oraz WILD + WYGRANA (S1).
- Serwer udostępnia katalog przez GET /api/slots/{code}/debug tylko przy jawnie włączonej
  fladze kasyno.demo.allow-seed; domyślnie false. Lokalny launcher włącza ją na 127.0.0.1.
- Scenariusz używa normalnego spinu, zakładu i portfela; seed dotyczy jednego żądania.
- Przyciski są blokowane podczas rundy i autoplay; klawiatura panelu nie uruchamia przypadkowego spinu.
- S3 zachowuje zasady 5+ jednakowych symboli połączonych bokami. Dodano pięć regresji
  dla rozdzielonych grup, skosów, kształtów i łączenia nowych symboli po kaskadzie.
- Bieżący pakiet: 268 testów Maven PASS (wyłączono ponowny kosztowny SlotMathMonteCarloTest;
  mechanika losowania nie była zmieniana), 443 kontrole UI PASS i 20 prawdziwych rund.
- Sprawdzono 6 scenariuszy na wszystkich stawkach; BONUS daje 10 darmowych spinów.
- UI sprawdzone na 1366x768 i 320x640: poprawne saldo, wygrana i plansza w pierwszej klatce ready,
  jedno kliknięcie = jeden POST, zwykłe spiny bez wymuszonego seeda, zero błędów JS i HTTP.
- Raport lokalny: E:\CebulionCasino\testy\debug-scenarios\results.json.