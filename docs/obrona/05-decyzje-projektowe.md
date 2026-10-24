# 05. Decyzje projektowe (ADR)

Najważniejsze decyzje Cebulion Casino zapisane w formie **ADR** (*Architecture Decision Record*): kontekst → decyzja →
konsekwencje → odrzucone alternatywy, z odnośnikiem do kodu i testu. Na obronie pytanie „dlaczego tak?” ma odpowiedź
w jednym z tych punktów. Ścieżki skrócone jak w [`02-przewodnik-po-kodzie.md`](02-przewodnik-po-kodzie.md).

| # | Decyzja | Obszar |
|---|---|---|
| [ADR-01](#adr-01-serwer-rozstrzyga-o-wyniku) | serwer rozstrzyga o wyniku, przeglądarka tylko animuje | architektura |
| [ADR-02](#adr-02-jedna-runda--jeden-zakład-z-listą-kroków) | jedna runda = jeden zakład z listą kroków | API, silnik |
| [ADR-03](#adr-03-bigdecimal-dla-kwot-long-w-setnych-w-silniku) | `BigDecimal` dla kwot, `long` w setnych w silniku | dane |
| [ADR-04](#adr-04-blokada-pesymistyczna-portfela) | blokada pesymistyczna portfela (`SELECT … FOR UPDATE`) | współbieżność |
| [ADR-05](#adr-05-idempotencja-spinu) | idempotencja spinu (`Idempotency-Key`) | API, współbieżność |
| [ADR-06](#adr-06-logowanie-samą-nazwą-gracza-świadome-ograniczenie) | logowanie samą nazwą, bez Spring Security | bezpieczeństwo |
| [ADR-07](#adr-07-zdarzenie-playerregistered-i-porty-zamiast-cyklu-modułów) | zdarzenie `PlayerRegistered` i porty zamiast cyklu modułów | moduły |
| [ADR-08](#adr-08-taśmy-linie-i-zakłady-w-kolumnach-tekstowych) | taśmy, linie i zakłady w kolumnach tekstowych | JPA |
| [ADR-09](#adr-09-pamięć-podręczna-rankingów-unieważniana-po-commicie) | pamięć podręczna rankingów + `AFTER_COMMIT` | wydajność, LAB 06 |
| [ADR-10](#adr-10-profile-dev--demo--prod) | profile `dev` / `demo` / `prod` | konfiguracja, LAB 06 |
| [ADR-11](#adr-11-front-bez-bundlera-pixijs-lokalnie-teksty-w-html) | front bez bundlera, PixiJS lokalnie, teksty w HTML | front |
| [ADR-12](#adr-12-grafika-z-chatgpt--automatyczny-pipeline) | grafika z ChatGPT + automatyczny pipeline | oprawa |
| [ADR-13](#adr-13-dźwięk-syntezowany-w-kodzie) | dźwięk syntezowany w kodzie | oprawa |
| [ADR-14](#adr-14-poziomy-jakości-i-strażnik-błysków) | poziomy jakości i strażnik błysków | wydajność, dostępność |

---

## ADR-01. Serwer rozstrzyga o wyniku

**Kontekst.** Gra ma saldo i rankingi. Gdyby przeglądarka losowała albo liczyła wygraną, każdy mógłby w konsoli
(DevTools) podmienić wynik albo wysłać „wygrałem 1 000 000”. Jednocześnie przedmiot ocenia **backend**: logika ma być
w Javie.

**Decyzja.** Cały wynik liczy serwer (`SpinService` + silniki w `slots/application/engine`). Przeglądarka wysyła tylko
`{"bet": 100}` i dostaje gotową rundę jako listę kroków (`steps`), którą **odgrywa**, niczego nie losując i nie licząc
(`js/game/step-player.js`). Saldo po rundzie (`balanceAfter`) też przychodzi z serwera i tylko ono jest księgowane
(`js/game/controller.js:162`).

**Konsekwencje.**
* \+ wyniku nie da się sfałszować; zakład jest weryfikowany z `bet_levels` (`InvalidBetException`), saldo nie spadnie
  pod zero (`Wallet.debitBet`);
* \+ każda runda ma zapisane ziarno i pełną odpowiedź (`spin_round.seed`, `result_json`) — audyt i odtworzenie;
* \+ ta sama logika testowana w Javie (silniki, Monte Carlo), front nie dubluje reguł gry;
* − bębny ruszają, zanim przyjdzie odpowiedź, więc front musi „dopasować” zatrzymanie do planszy z serwera
  (`ReelSet.land`, fizyka z planowaną milisekundą stopu); przy błędzie sieci bębny hamują na planszy sprzed spinu
  (`ReelSet.abort`), bez wymyślania wyniku.

**Alternatywy.** Losowanie w przeglądarce + weryfikacja na serwerze (dwa razy ta sama logika w dwóch językach, ryzyko
rozjazdu); losowanie w przeglądarce bez weryfikacji (oszustwo w 10 sekund).

**Kod / test:** `slots/application/SpinService.java:84`; `SlotEnginesIntegrationTest.spinsFollowContract`.

---

## ADR-02. Jedna runda = jeden zakład z listą kroków

**Kontekst.** S2 i S3 mają darmowe spiny (10–50 spinów) i kaskady. Można je zrobić jako osobne żądania („zagraj
darmowy spin nr 3”) albo policzyć od razu.

**Decyzja.** Serwer liczy **całą** rundę naraz — obrót, wszystkie kaskady i wszystkie darmowe spiny — i zwraca ją jako
uporządkowaną listę kroków (`spin`, `win`, `cascade`, `expandWild`, `applyMultiplier`, `freeSpinsStart`,
`freeSpinsRetrigger`, `freeSpinsEnd`, `feature`). Zakład pobieramy raz, wygraną wypłacamy raz, w **jednej transakcji**.
Format: kontrakt [`../projekt/09-kontrakt-api-i-assetow.md`](../projekt/09-kontrakt-api-i-assetow.md) § 2.4,
typy kroków: `engine/RoundStep.java:30`.

**Konsekwencje.**
* \+ brak stanu „w połowie bonusu”, który trzeba przechowywać, zabezpieczać i dokańczać po zerwaniu połączenia
  albo zamknięciu karty;
* \+ jeden zapis rundy (`SpinRound`), jedna transakcja: zakład, wynik i wypłata razem albo wcale;
* \+ front ma prostą pętlę: `await` kroku po kroku; nowe gry dopisują tylko handlery;
* − odpowiedź bywa długa (do 50 darmowych spinów); ograniczają ją limity `maxTotal = 50` i limit maksymalnej wygranej;
* − gracz „wie” wynik, zanim zobaczy animację (w odpowiedzi HTTP) — w symulatorze bez pieniędzy to bez znaczenia.

**Alternatywy.** Osobne endpointy na każdy darmowy spin (stan bonusu w bazie, wyścigi, porzucone bonusy); WebSocket
ze strumieniem kroków (złożoność bez zysku — i tak liczymy całość od razu).

**Kod / test:** `ClusterEngine.playFreeSpins` (`:71`), `LinesEngine.playFreeSpins` (`:74`); `LinesEngineTest.freeSpinsWithExpandingWild`.

---

## ADR-03. `BigDecimal` dla kwot, `long` w setnych w silniku

**Kontekst.** Kwoty w cebulionach muszą być dokładne (`double`: `0.1 + 0.2 != 0.3`). Wymóg kursu (LAB 02): `BigDecimal`
dla kwot. Z drugiej strony silnik w testach RTP liczy dziesiątki milionów rund — `BigDecimal` byłby tam wolny.

**Decyzja.** W bazie i API kwoty to `BigDecimal` / `DECIMAL(19,2)` (`Money.normalize`, skala 2, `HALF_UP`), porównania
przez `compareTo`. Silnik liczy na `long`: wypłaty w setnych częściach mnożnika (`GameMath.toHundredths`, `1.5 → 150`),
ułamki w dół; wynik zamieniamy na `BigDecimal` na granicy (`ConfiguredSlotEngine.play`, `:38`). Zakłady są całkowite
(`longValueExact` rzuci wyjątek przy ułamku). JSON bez zbędnych zer (`BigDecimalJsonSerializer`: `10000.00 → 10000`).

**Konsekwencje.**
* \+ dokładne saldo i księga (`suma amount = saldo`), szybki silnik bez błędów zaokrągleń;
* \+ wypłaty dobrane tak, że przy minimalnym zakładzie kwoty są całkowite — RTP nie zależy od zakładu
  (`SlotMathDataTest.paysAreWholeAtMinimumBet`);
* − trzeba pilnować `compareTo` zamiast `equals` (`10.0` ≠ `10.00` w `equals`) — robią to `BetLevels.contains`,
  `WinTier.of`;
* − absurdalne liczby z JSON (`1e999999999`) — obsłużone `@Digits(12,2)` w `SpinRequest` i `Money.describe`.

**Alternatywy.** `double` (błędy groszy), `long` w groszach wszędzie (sprzeczne z wymogiem kursu, mniej czytelne
w bazie), `BigDecimal` w silniku (wolne testy Monte Carlo).

**Kod / test:** `shared/domain/Money.java:14`, `engine/GameMath.java:128`; `MoneyTest`, `GameMathTest.rejectsSubCentPays`.

---

## ADR-04. Blokada pesymistyczna portfela

**Kontekst.** Gracz może kliknąć SPIN kilka razy, mieć kilka kart albo autoplay. Dwa równoległe spiny mogłyby oba
odczytać saldo 100 i oba postawić 100 (*lost update*), a saldo zeszłoby poniżej zera.

**Decyzja.** Każda zmiana salda pobiera portfel **z blokadą zapisu**: `@Lock(PESSIMISTIC_WRITE)` →
`SELECT … FOR UPDATE` (`wallet/entity/WalletRepository.java:31–33`). Spin blokuje portfel **na samym początku**
(`WalletFacade.lockWallet`, `Propagation.MANDATORY`), więc wszystkie spiny jednego gracza wykonują się po kolei.
`@Version` (blokada optymistyczna) zostaje drugim bezpiecznikiem. Gdy baza nie doczeka się blokady,
`GlobalExceptionHandler.handleConcurrency` (`:88`) zwraca `409 CONCURRENT_REQUEST` z `Retry-After: 1`, a nie 500.

**Konsekwencje.**
* \+ dokładnie tyle spinów, na ile stać gracza: test 16 równoległych spinów po 1000 przy saldzie 10 000 → dokładnie 10
  udanych, saldo 0 (`KasynoFlowIntegrationTest.concurrentSpinsNeverOverdraw`, `:270`);
* \+ blokada obejmuje tylko wiersz jednego gracza — różni gracze grają równolegle;
* − spiny jednego gracza czekają na siebie (pojedyncze milisekundy — w grze i tak są po kolei);
* − wymaga trwającej transakcji (stąd `MANDATORY`); w testach H2 ma `LOCK_TIMEOUT=10000`.

**Alternatywy.** Tylko `@Version` (optymistyczna): przy konflikcie wyjątek i ponawianie po stronie klienta — przy
podwójnym kliknięciu częste błędy; `synchronized` w Javie (nie działa przy kilku instancjach aplikacji i nie chroni
bazy); `UPDATE wallet SET balance = balance - ? WHERE balance >= ?` (atomowe, ale omija regułę w encji i historię).

**Kod / test:** `WalletService.lockWallet` (`:100`), `SpinService.java:95`; `SlotControllerTest.lockTimeoutIsConflictNotServerError` (`:154`).

---

## ADR-05. Idempotencja spinu

**Kontekst.** Podwójne kliknięcie albo ponowienie żądania po zerwanym połączeniu nie może pobrać zakładu dwa razy.
Klient nie wie, czy pierwsze żądanie doszło.

**Decyzja.** Każde kliknięcie SPIN dostaje nowy `Idempotency-Key` (`crypto.randomUUID()`, `js/api.js:84`). Serwer
**pod blokadą portfela** szuka rundy gracza z tym kluczem (`SpinService.replayIfRepeated`, `:149`):
* jest i dotyczy tej samej gry i zakładu → zwraca **tę samą odpowiedź co do bajtu** (`result_json`) z nagłówkiem
  `Idempotent-Replayed: true`, bez nowego losowania i bez zakładu;
* jest, ale z innym ciałem → `409 IDEMPOTENCY_CONFLICT`;
* nie ma → nowa runda z tym kluczem.

Unikalny indeks `(user_id, idempotency_key)` (`SpinRound.java:43`) to ostatni bezpiecznik. Klucze starsze niż 24 h
zapomina zadanie `@Scheduled` (`IdempotencyKeyCleanup`, jak API płatności).

**Konsekwencje.**
* \+ 8 równoległych żądań z tym samym kluczem → jeden zakład, jedna runda, 7 powtórek, zero błędów 500
  (`KasynoFlowIntegrationTest.concurrentDuplicateSpinsAreReplayed`, `:306`);
* \+ sprawdzanie pod blokadą: drugie żądanie czeka na commit pierwszego i znajduje jego rundę (bez polegania na
  wyjątku z indeksu — `SpinServiceTest.idempotencyIsCheckedUnderWalletLock`, `:226`);
* − `result_json` zajmuje miejsce (w S3 dziesiątki KB) — listy używają lekkiej projekcji `RoundSummary`;
* − po 24 h ten sam klucz to nowa runda (okno idempotencji opisane w kontrakcie).

**Alternatywy.** Blokowanie przycisku w przeglądarce (nie chroni przed ponowieniem po zerwaniu ani przed drugą kartą);
klucz z treści żądania (dwa świadome spiny z tym samym zakładem byłyby „duplikatem”).

---

## ADR-06. Logowanie samą nazwą gracza (świadome ograniczenie)

**Kontekst.** Wymaganie projektu: gracz wpisuje nazwę w prawym górnym rogu i od razu gra. Waluta nie ma wartości
(nie da się jej kupić ani wypłacić). Tabela `user_account` pochodzi z szablonu i nie ma kolumny hasła.

**Decyzja.** Logowanie samą nazwą (`LoginService.login`): nowa nazwa = nowe konto z bonusem, ta sama nazwa (bez względu
na wielkość liter) = to samo konto. Sesja **serwerowa**: ciasteczko `HttpOnly`, `SameSite=Lax`, 7 dni, w `prod`
`Secure`; po zalogowaniu nowa sesja (ochrona przed *session fixation*, `PlayerSession.start`). Nazwy walidowane
(`NickPolicy`: znaki, długość, zakazane słowa). Zamiast Spring Security — filtr z nagłówkami bezpieczeństwa
(`SecurityHeadersFilter`) i resolver `@CurrentPlayer`.

**Konsekwencje.**
* \+ zerowy próg wejścia; brak haseł = brak wycieku haseł;
* \+ mniej konfiguracji: Spring Security byłby tu tylko po to, żeby dodać 3 nagłówki;
* − **każdy, kto wpisze Twoją nazwę, wejdzie na Twoje konto** — opisane jako znane ograniczenie
  ([`../plan-projektu.md`](../plan-projektu.md) § 5.8), propozycja poprawy: PIN albo OAuth;
* − raporty inwestora są publiczne (dane zbiorcze) zamiast osobnego logowania administratora.

**Alternatywy.** Spring Security z hasłem (sprzeczne z wymaganiem „wpisujesz nazwę i grasz”, zmiana tabeli z szablonu);
JWT w `localStorage` (podatny na kradzież przez XSS, trudne unieważnienie); OAuth (zależność od zewnętrznego dostawcy).

**Kod / test:** `account/application/LoginService.java:56`, `shared/web/PlayerSession.java:28`,
`shared/web/SecurityHeadersFilter.java:35`; `AuthControllerTest`, `SlotControllerTest.securityHeaders`.

---

## ADR-07. Zdarzenie `PlayerRegistered` i porty zamiast cyklu modułów

**Kontekst.** Moduły zależą od siebie w jednym kierunku: `account ← wallet ← slots ← report` (portfel wskazuje na konto,
spin pobiera zakład z portfela). Ale konto potrzebuje portfela (bonus przy rejestracji, saldo w obiekcie `player`),
a portfel — najmniejszego zakładu z modułu automatów. Wywołania wprost dałyby cykle.

**Decyzja.**
* **Zdarzenie:** `LoginService` publikuje `PlayerRegistered` (`account/api`), a `WalletService.onPlayerRegistered`
  (`@EventListener`, **synchronicznie, w tej samej transakcji**) zakłada portfel z bonusem. Konto nie wie, że istnieje
  portfel; konto bez portfela nigdy nie zostanie zapisane.
* **Porty (odwrócenie zależności):** `PlayerFundsProvider` leży w `account.api`, implementuje go `WalletService`;
  `MinimumBetProvider` leży w `wallet.api`, implementuje go `SlotCatalogService`. Spring łączy implementacje przy starcie.
* **Identyfikator zamiast relacji:** `WalletTransaction.spinRoundId` i `gameCode` to zwykłe wartości, nie `@ManyToOne`.

**Konsekwencje.**
* \+ brak cykli — sprawdza `ArchitectureTest.modulesAreFreeOfCycles` (`:46`) i reguły kierunków (`:52–96`);
* \+ moduły można testować osobno (port łatwo podmienić w teście);
* − przepływ jest mniej oczywisty przy czytaniu („kto zakłada portfel?”) — dlatego Javadoc `PlayerRegistered` i diagram
  w [`01-architektura.md`](01-architektura.md) § 2;
* − encje `Wallet`, `SpinRound`, `PlayerMachineStats` wciąż mają relację do `UserAccount` z innego modułu (dozwolone, bo
  `account` jest „najniżej”). Roadmapa kursu (LAB 04) mówi o zastąpieniu relacji między modułami identyfikatorami —
  zrobimy to, jeśli wymagają tego reguły LAB 04.

**Alternatywy.** `@TransactionalEventListener(AFTER_COMMIT)` dla bonusu (konto mogłoby istnieć bez portfela przy awarii);
wspólny serwis „rejestracji” wołający oba moduły (rozmyta odpowiedzialność); jeden duży moduł (brak granic).

---

## ADR-08. Taśmy, linie i zakłady w kolumnach tekstowych

**Kontekst.** Automat ma listę zakładów (7 liczb), taśmy bębnów (S1: 3 × 32, S2: 2 × 5 taśm po 35–40 symboli) i linie
(5 albo 20). Koncepcja projektu wymaga 5–6 własnych tabel — mamy 6.

**Decyzja.** Każda z tych list to **jedna kolumna tekstowa** w `slot_machine` (`bet_levels = '10,20,50'`,
`reel_strips = 'a,b,c|d,e,f'`, `paylines = '1,1,1|0,0,0'`) zamieniana na niemodyfikowalny obiekt wartości przez
`AttributeConverter` (`BetLevelsConverter`, `ReelStripsConverter`, `PaylinesConverter`; wypłaty symboli tak samo:
`PayoutsConverter`).

**Konsekwencje.**
* \+ czytamy je zawsze w całości razem z automatem — bez złączeń i bez N+1 na liście gier;
* \+ kolejność symboli jest częścią danych (w kolumnie zachowana wprost, w tabeli trzeba by kolumny `pozycja`
  i `ORDER BY`);
* \+ cała konfiguracja gry w `data.sql` w jednym miejscu, łatwa do porównania z dokumentem 07;
* − nie da się zapytać SQL-em „w których automatach jest symbol X na pozycji 17” (nikt tego nie potrzebuje);
* − spójność (czy kody symboli istnieją) sprawdza kod przy kompilacji `GameMath` i test `SlotMathDataTest`, a nie
  klucz obcy.

**Alternatywy.** `@ElementCollection` / tabela `reel_stop(automat, bęben, pozycja, symbol)` — ok. 550 wierszy bez
własnej logiki, siódma tabela, sortowanie po pozycji (uzasadnienie w Javadoc `ReelStrips`, `slots/entity/ReelStrips.java:17–27`).

---

## ADR-09. Pamięć podręczna rankingów unieważniana po commicie

**Kontekst.** Każda otwarta karta lobby co 45 s pyta o feed dużych wygranych i ranking (`js/lobby.js:171–175`),
a dane zmieniają się tylko po spinie albo zmianie salda. Bez pamięci podręcznej każda karta to zapytania `GROUP BY`.

**Decyzja.** `LobbyBoardsCache` trzyma wynik zapytania w pamięci, a `LobbyBoardsListener` unieważnia go zdarzeniami
`SpinCompleted` / `BalanceChanged` **po zatwierdzeniu transakcji** (`@TransactionalEventListener(AFTER_COMMIT)`).
Każda tablica ma licznik pokoleń: wynik zapytania zapisujemy tylko, gdy w trakcie zapytania nikt nie unieważnił
tablicy. Pas bezpieczeństwa: TTL 30 s (`kasyno.lobby.cache-ttl`). `LeaderboardService` celowo bez `@Transactional`
(trafienie w cache nie bierze połączenia z bazy). Statystyki gracza (`StatsUpdater`) zostają **synchroniczne w
transakcji** (`@EventListener`, `MANDATORY`) — muszą zgadzać się z rundami.

**Konsekwencje.**
* \+ wycofany spin nie trafi do feedu ani do logu `big_win` (słuchacz po rollbacku się nie wykonuje —
  `LobbyBoardsListenerTest.rollbackIsIgnored`, `:77`);
* \+ brak wyścigu z równoległym odczytem: unieważnienie przed commitem pozwoliłoby zapisać stary stan jako aktualny
  (`LobbyBoardsCacheTest.invalidationDuringQueryIsNotCached`, `:75`);
* \+ błąd w słuchaczu nie psuje zapisanego spinu;
* − pamięć jest lokalna dla jednej instancji aplikacji (przy kilku instancjach TTL ogranicza nieaktualność do 30 s);
* − zdarzenie opublikowane poza transakcją `@TransactionalEventListener` pomija (u nas publikują tylko metody
  `@Transactional`).

**Alternatywy.** `@Cacheable` + `@CacheEvict` (unieważnienie w trakcie transakcji — wyścig opisany wyżej);
osobna tabela „ranking” aktualizowana przy spinie (druga prawda w bazie); brak cache (zapytania z każdej karty).

**Kod:** `report/application/LobbyBoardsCache.java:80`, `LobbyBoardsListener.java:59`. Szczegółowo:
[`01-architektura.md`](01-architektura.md) § 7.1.

---

## ADR-10. Profile `dev` / `demo` / `prod`

**Kontekst.** Na zajęciach i przy regułach kursu aplikacja musi zachowywać się **jak szablon** (`create-drop`, `data.sql`
przy każdym starcie). Do nagrywania filmików potrzebne jest narzucanie ziarna rundy. Na serwerze dane graczy mają
przetrwać restart.

**Decyzja.** Trzy profile (LAB 06), wspólne ustawienia w `application.properties` (jak szablon):
* `dev` (domyślny, `spring.profiles.default=dev`) — plik prawie pusty, celowo: instrukcje laboratoriów każą zmieniać
  `application.properties`, a wpis w pliku profilu po cichu by tę zmianę nadpisał;
* `demo` — H2 w pamięci, `kasyno.demo.allow-seed=true` (`X-Demo-Seed`), ratunek co minutę, migawka co minutę;
* `prod` — `ddl-auto=update`, `data.sql` tylko na pustej bazie (`StarterDataLoader`), konsola H2 wyłączona, ciasteczko
  `Secure`, `graceful shutdown`, port z `PORT`; zmienne `SPRING_DATASOURCE_*` przełączają na PostgreSQL bez zmiany kodu.

Liczby biznesowe są w rekordzie `CasinoProperties` (`@ConfigurationProperties` + `@Validated`), nie w kodzie serwisów.

**Konsekwencje.**
* \+ reguły kursu widzą aplikację taką, jaką znają; `X-Demo-Seed` jest niemożliwy poza `demo`
  (`DemoSeedIgnoredTest`, `ProfilesTest.demoSeedOnlyInDemo`);
* \+ w `prod` salda przetrwają restart (`ProdProfilePersistenceTest.survivesRestart`);
* − `ddl-auto=update` nie usuwa ani nie zmienia istniejących kolumn — przy większych zmianach schematu potrzebna byłaby
  migracja (Flyway/Liquibase), świadomie pominięta w projekcie studenckim;
* − na darmowym Render plik H2 znika przy uśpieniu (opis i obejście: [`00-uruchomienie.md`](00-uruchomienie.md) § 5).

**Alternatywy.** Jeden profil + zmienne środowiskowe (łatwo pomylić ustawienia demo z produkcją); osobne gałęzie
na serwer (rozjazd kodu); Flyway od początku (sprzeczne z szablonem `create-drop`).

---

## ADR-11. Front bez bundlera, PixiJS lokalnie, teksty w HTML

**Kontekst.** Front ma być lekki w lobby, a gry mają mieć 60 fps z tysiącami cząsteczek. Projekt jest Javowy;
dodatkowy łańcuch narzędzi (Node, bundler) to kolejna rzecz, która może nie zadziałać na komputerze na obronie.

**Decyzja.**
* **Bez bundlera:** przeglądarka ładuje natywne moduły ES (`<script type="module">`, `import`); Spring Boot serwuje
  pliki z `static/`; gzip włączony w `application.properties`, `modulepreload` dla PixiJS w `gra.html`.
* **PixiJS 8 (WebGL) tylko na stronie gry**, plik w repozytorium (`static/vendor/pixi/pixi.min.mjs`, wersja 8.22.0
  w `VERSION.txt`, licencja obok), kopiowany z npm skryptem `tools/vendor.mjs`. Lobby to HTML/CSS + lekki
  `fx-lite.js` na Canvas 2D (nie wczytuje silnika gry).
* **Brak CDN:** fonty OFL i biblioteki lokalnie.
* **Teksty interfejsu w HTML**, nie na obrazkach (przyciski, panel, okna, wizytówka).

**Konsekwencje.**
* \+ aplikacja działa bez Node.js i bez internetu (obrona offline), wersje zamrożone w repozytorium;
* \+ teksty ostre na każdym ekranie, czytelne dla czytników ekranu (`aria-live`, pułapka fokusu w modalach),
  łatwe do poprawienia (literówka = edycja HTML, nie nowy obraz);
* \+ każdy plik JS da się otworzyć i omówić 1:1 z tym, co wykonuje przeglądarka;
* − brak minifikacji i tree-shakingu (PixiJS i tak jest zminifikowany; reszta po gzip jest mała);
* − Node.js potrzebny tylko do narzędzi: testy e2e (Playwright), atrapa API, wendorowanie.

**Alternatywy.** Vite/webpack + React (dodatkowy build, który trzeba wyjaśnić i utrzymać); Phaser (cięższy, mniej
kontroli nad renderem); czysty Canvas 2D (za wolny na tysiące cząsteczek i filtry); CDN (zależność od sieci i obcych
serwerów).

---

## ADR-12. Grafika z ChatGPT + automatyczny pipeline

**Kontekst.** Projekt potrzebuje 85 assetów (symbole trzech gier, tła, ramki, UI, napisy wygranych, efekty) w spójnym,
„topowym” stylu. W zespole nie ma grafika, a licencje stocków są niejasne. ChatGPT generuje obrazy szybko, ale
niedokładnie: fałszywa przezroczystość (narysowana szachownica), jednolite tła, ucięte krawędzie, okna ramek o złych
proporcjach, kolorowe efekty, literówki w napisach.

**Decyzja.** 93 obrazy (8 makiet + 85 assetów) generujemy w ChatGPT według gotowych promptów
([`../projekt/03-prompty-chatgpt.md`](../projekt/03-prompty-chatgpt.md)) w 6 czatach, z makietami jako kotwicami stylu.
Surowe PNG trafiają do `art/zrodla/`, a **jeden skrypt** `tools/art/przetworz.py` robi z nich to, czego potrzebuje
aplikacja: naprawa alfy (szachownica, jednolite tło, dziury w kolorze tła), normalizacja symboli, okna ramek
z korektą proporcji, marginesy 9-slice, cięcie arkuszy, BitmapFont cyfr, neutralizacja koloru efektów, WebP @1x/@2x,
warianty (rozmycie ruchu, poświaty, cienie), `manifest.json` i raport jakości (kontrole Q00–Q30, budżety wagi).
Front prosi o obraz **zawsze przez ID** z manifestu; brak obrazu = grafika zastępcza (z kodu albo z generatora).

**Konsekwencje.**
* \+ komplet 93/93 dostarczony; 84 assety z ChatGPT w aplikacji, `g_win_epic` czeka na poprawkę (napis „EIG” zamiast
  „EPIC” — złapany w przeglądzie raportu, odłożony do `art/zrodla/_do-poprawy/`, do tego czasu grafika zastępcza);
* \+ podmiana grafiki = nowy PNG + uruchomienie skryptu, bez zmian w kodzie; wynik deterministyczny (te same PNG →
  te same bajty, czysty `git diff`);
* \+ budżety wagi pilnowane automatycznie (lobby 2,58 MB z 3 MB, gry 3,6–4,7 MB z 6 MB);
* − źródła PNG zajmują ok. 156 MB w repozytorium; − część kontroli (np. kolor dominujący, duplikaty) i atlasy to
  plan na później ([`../projekt/02-lista-obrazow.md`](../projekt/02-lista-obrazow.md) § 5.0);
* − ostateczną jakość ocenia człowiek (miniatury w `art/raport/raport.html`).

**Alternatywy.** Ręczna obróbka w programie graficznym (nieodtwarzalna, 85 × każda poprawka); grafika tylko z kodu
(dalej jest jako zapas, ale nie daje poziomu „topowej gry”); płatne paczki assetów (licencje, niespójny styl).

---

## ADR-13. Dźwięk syntezowany w kodzie

**Kontekst.** Gra potrzebuje 67 dźwięków (59 efektów i 8 pętli muzycznych) spójnych tonacyjnie z trzema grami,
z bezszwowymi pętlami i znanymi prawami do użycia.

**Decyzja.** Cały dźwięk powstaje **z kodu**: Python 3 + NumPy syntezuje próbki (oscylatory bez aliasingu, FM,
synteza modalna, Karplus–Strong, filtry przez FFT, pogłos splotowy), ffmpeg koduje do **Opus/WebM** i **AAC/M4A**,
a `sprawdz.py` mierzy wynik (LUFS, dBTP, szwy pętli) — kontrole A01–A14. Ten sam kod daje te same bajty.
W przeglądarce: własny silnik na Web Audio API (`js/audio/audio-engine.js`) z szynami, duckingiem, limitem głosów
i pętlami `loopStart`/`loopEnd`. Muzykę można podmienić na pliki z Suno skryptem `przetworz_zewnetrzne.py`.

**Konsekwencje.**
* \+ czyste prawa (nasz kod), spójna tonacja (efekty w pentatonice C transponowane do tonacji gry), pętle matematycznie
  bez szwu, odtwarzalność; każdą technikę można wyjaśnić (`tools/audio/README.md` § 3);
* \+ dźwięk dokładnie zsynchronizowany z animacją (planowanie na zegarze `AudioContext`, `syncPoint`);
* − brzmienia „orkiestrowe” (chór, smyczki) są skromniejsze niż nagrania; − poziomy wymagają strojenia na słuch.

**Alternatywy.** Biblioteki CC0 (niespójne brzmienie, sprawdzanie licencji każdego pliku); generatory AI (prawa zależne
od regulaminu — opcja, nie podstawa); `<audio>` zamiast Web Audio (brak precyzji czasu i miksowania).

Szczegóły: [`../projekt/05-dzwiek-i-muzyka.md`](../projekt/05-dzwiek-i-muzyka.md).

---

## ADR-14. Poziomy jakości i strażnik błysków

**Kontekst.** Ten sam automat ma działać płynnie na słabym telefonie i na monitorze 4K, a efekty (błyski ekranu przy
BIG WIN) nie mogą zagrażać osobom z padaczką fotogenną (WCAG 2.1, kryterium 2.3.1: najwyżej 3 błyski na sekundę).

**Decyzja.**
* **Trzy poziomy jakości** (`js/game/core/quality.js:16`): High (DPR ≤ 2, 600 cząsteczek, bloom filtrem), Medium
  (DPR ≤ 1,5, 300, poświata z tekstury), Low (DPR 1, 120, bez drżenia i filtrów). Start: komputer High, dotyk Medium,
  mało pamięci Low. **Automat:** p90 czasu klatki > 20 ms przez 2 s → poziom niżej (`:115–120`); w górę tylko między
  rundami, po 20 s z p90 < 12 ms, najwyżej raz na 2 min. Rozdzielczość zmienia się tylko między rundami.
* **Strażnik błysków** (`js/game/fx/flash.js:41`): każdy efekt, który może być błyskiem, pyta `request` (`:68`).
  Amplitudę liczymy jak WCAG (ΔL zależne od jasności podłoża); małe pole lub ΔL < 0,10 to nie błysk; błysk < 120 ms
  po poprzednim jest wchłaniany; najwyżej 3 w oknie 1 s; miejsca dla „błysków-bohaterów” (uderzenie BIG WIN) są
  rezerwowane; nadmiar dostaje wariant łagodny albo jest pomijany. Tryb ograniczonego ruchu (`prefers-reduced-motion`
  albo przełącznik): brak błysków i drżenia.

**Konsekwencje.**
* \+ limit pilnuje **kod**, nie dobra wola animatora; test e2e sprawdza ≤ 3 błyski/s i 0 pominiętych bohaterów
  (`tools/e2e/gra-s1.mjs`);
* \+ automat jakości zadziałał w pomiarach (High → Medium → Low na maszynie bez GPU, [`../projekt/10-runtime-gier.md`](../projekt/10-runtime-gier.md) § 11);
* − na słabym sprzęcie gracz widzi mniej efektów; − 60 fps trzeba jeszcze potwierdzić na prawdziwym telefonie
  (`?fx=debug` pokazuje FPS i p90).

**Alternatywy.** Jeden poziom „dla wszystkich” (albo brzydko na komputerze, albo zacięcia na telefonie); wykrywanie
sprzętu po nazwie przeglądarki (zawodne); limit błysków „na oko” w animacjach (łatwo przekroczyć przy zbiegu efektów).

---

## Powiązane dokumenty

[`01-architektura.md`](01-architektura.md) · [`02-przewodnik-po-kodzie.md`](02-przewodnik-po-kodzie.md) ·
[`03-silnik-gier.md`](03-silnik-gier.md) · [`06-pytania-na-obrone.md`](06-pytania-na-obrone.md) ·
[`../plan-projektu.md`](../plan-projektu.md) · [`../projekt/07-gry-i-matematyka.md`](../projekt/07-gry-i-matematyka.md) § 8
