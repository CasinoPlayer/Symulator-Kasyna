# 06. Pytania na obronę (z odpowiedziami)

Około 50 pytań, które mogą paść na obronie, ze zwięzłymi odpowiedziami i wskazaniem, **co otworzyć w IntelliJ**.
Ścieżki skrócone jak w [`02-przewodnik-po-kodzie.md`](02-przewodnik-po-kodzie.md) (Java względem
`src/main/java/pl/wsb/kasyno/`, testy względem `src/test/java/pl/wsb/kasyno/`, front względem
`src/main/resources/static/`). Dłuższe uzasadnienia: [`05-decyzje-projektowe.md`](05-decyzje-projektowe.md) (ADR),
matematyka: [`03-silnik-gier.md`](03-silnik-gier.md).

**Jak odpowiadać:** jedno zdanie „co”, jedno „dlaczego”, potem pokazać kod albo test. Jeśli czegoś nie ma — powiedzieć
wprost, że to świadome ograniczenie albo plan (pytania 47–50).

## Spis

* [A. Projekt i wymagania kursu](#a-projekt-i-wymagania-kursu) (1–5)
* [B. Spring i architektura](#b-spring-i-architektura) (6–11)
* [C. JPA i baza danych](#c-jpa-i-baza-danych) (12–19)
* [D. Transakcje i współbieżność](#d-transakcje-i-współbieżność) (20–25)
* [E. REST, walidacja, błędy](#e-rest-walidacja-błędy) (26–30)
* [F. LAB 06: zdarzenia, konfiguracja, harmonogram, profile](#f-lab-06-zdarzenia-konfiguracja-harmonogram-profile) (31–34)
* [G. Matematyka gier](#g-matematyka-gier) (35–39)
* [H. Testy](#h-testy) (40–42)
* [I. Bezpieczeństwo](#i-bezpieczeństwo) (43–46)
* [J. Czego nie ma i dlaczego](#j-czego-nie-ma-i-dlaczego) (47–50)
* [K. Front, wydajność, oprawa](#k-front-wydajność-oprawa) (51–56)
* [L. Uruchomienie i hosting](#l-uruchomienie-i-hosting) (57–58)

---

## A. Projekt i wymagania kursu

**1. Co to za projekt i dla kogo?**
Symulator kasyna z wirtualną walutą „cebulion” (bez wartości, nie da się jej kupić ani wypłacić). Persona: Kamil,
student, który chce sprawdzać strategie i emocje slotów bez ryzyka prawdziwych pieniędzy. Backend w Javie (Spring Boot,
JPA, H2) liczy wynik, saldo i historię; przeglądarka tylko animuje trzy automaty.
*Pokaż w kodzie:* `static/index.html` (wizytówka), [`../plan-projektu.md`](../plan-projektu.md) § 2–3.

**2. Jak spełniacie reguły LAB 01 (R1.01–R1.05)?**
R1.01: pakiet `pl.wsb.kasyno`, jedna klasa `@SpringBootApplication`, `artifactId` `wdtb-2026-backend-kasyno`.
R1.02: aplikacja startuje na H2. R1.03: trzy konta zespołu w `data.sql` (poza kontami demo). R1.04: wizytówka w
`static/index.html` bez „[uzupełnij”. R1.05: wersja `1.0.0-112960-112961-113154`. Sprawdza to `mvn -B verify -Dlab=1`
(5/5 zielonych).
*Pokaż w kodzie:* `KasynoApplication.java:21`, `pom.xml` (linie 15–17), `src/main/resources/data.sql` (linie 10–14),
`src/test/java/pl/wsb/rules/lab01/Lab01ProjectRulesTest.java`.

**3. Jakie są Wasze tabele i jak spełniają warunki koncepcji (`pomysl.html`)?**
Sześć własnych tabel: `wallet`, `wallet_transaction`, `slot_machine`, `slot_symbol`, `spin_round`,
`player_machine_stats` (+ `user_account` z szablonu). Relacje: 1:1 (portfel–konto), 1:N (automat–symbole,
portfel–operacje), M:N z atrybutami (gracz–automat), obiekt ze statusem (`spin_round`), wielkości mierzalne (kwoty,
RTP, liczba spinów), 5 pytań inwestora, cztery moduły.
*Pokaż w kodzie:* ERD w [`01-architektura.md`](01-architektura.md) § 3; encje w `*/domain/`.

**4. Gdzie jest relacja wiele-do-wielu z atrybutami i dlaczego nie `@ManyToMany`?**
`PlayerMachineStats`: dwie relacje `@ManyToOne` (gracz, automat) + unikalna para `(user_id, slot_machine_id)` + liczby
przy parze (spiny, obrót, wygrane, rekord, ostatnia gra). `@ManyToMany` umie zapisać tylko „samą parę”, bez atrybutów.
Tabelę aktualizuje `StatsUpdater` po każdym spinie w tej samej transakcji.
*Pokaż w kodzie:* `slots/domain/PlayerMachineStats.java:31–34`, `:81`; `slots/application/StatsUpdater.java:38`.

**5. Jakie jest 5 pytań inwestora i gdzie są zapytania?**
(1) najpopularniejsze automaty w N dni, (2) rzeczywisty vs docelowy RTP, (3) liderzy: bilans i największa wygrana,
(4) gracze „na zero” i cebuliony w obiegu, (5) godziny aktywności i średni zakład. Zapytania JPQL z `GROUP BY`
i projekcjami `select new …` są w repozytoriach modułów-właścicieli danych, a `InvestorReportService` zbiera je przez
fasady. Endpointy: `GET /api/reports/{popular-games, rtp, top-players, economy, peak-hours}`.
*Pokaż w kodzie:* `slots/domain/SpinRoundRepository.java:55–86`, `slots/domain/PlayerMachineStatsRepository.java:28–46`,
`wallet/domain/WalletRepository.java:47–52`, `report/application/InvestorReportService.java:34`; test
`report/InvestorQuestionsRepositoryTest.java`.

## B. Spring i architektura

**6. Jak zbudowana jest aplikacja?**
Jeden proces Spring Boot. Cztery moduły (`account`, `wallet`, `slots`, `report`) + `shared`; w każdym warstwy `web`
(kontrolery, DTO), `application` (serwisy, transakcje), `domain` (encje, repozytoria), `api` (publiczny kontrakt
modułu). Front to pliki statyczne z tego samego serwera.
*Pokaż w kodzie:* [`01-architektura.md`](01-architektura.md) § 1–2, mapa w [`02-przewodnik-po-kodzie.md`](02-przewodnik-po-kodzie.md) § 0.1.

**7. Kto pilnuje, że warstwy i moduły nie są przemieszane?**
Testy ArchUnit: brak cykli między modułami, `account` nie zależy od innych, `slots` używa portfela tylko przez `api`,
`report` tylko przez `api`, `domain` nie zna `application`/`web`, kontrolery nie używają repozytoriów i nie zwracają
encji (także w `List<…>` i `PageResponse<…>`), `api` nie odsłania encji.
*Pokaż w kodzie:* `ArchitectureTest.java:46–150`.

**8. Po co pakiet `api` w module?**
To publiczny kontrakt: fasady (`WalletFacade`, `SlotsFacade`), rekordy, zdarzenia, porty. Inne moduły nie widzą encji
ani repozytoriów, więc zmiana sposobu przechowywania danych w module nie psuje innych.
*Pokaż w kodzie:* `wallet/api/WalletFacade.java:14`, `slots/api/SlotsFacade.java:11`.

**9. Jak unikacie cykli, skoro konto potrzebuje salda, a portfel najmniejszego zakładu?**
Odwrócenie zależności: port `PlayerFundsProvider` leży w `account.api`, implementuje go `WalletService`; port
`MinimumBetProvider` leży w `wallet.api`, implementuje go `SlotCatalogService`. Bonus powitalny: zdarzenie
`PlayerRegistered` z `LoginService`, słuchacz w portfelu (ta sama transakcja).
*Pokaż w kodzie:* `account/api/PlayerFundsProvider.java:12`, `wallet/api/MinimumBetProvider.java:11`,
`wallet/application/WalletService.java:77`; ADR-07.

**10. Jak działa wstrzykiwanie zależności i dlaczego przez konstruktor?**
Spring tworzy beany (`@Service`, `@Component`, `@Configuration` + `@Bean`) i przekazuje je w konstruktorze. Pola są
`final`, zależności jawne, a klasę da się utworzyć w teście zwykłym `new` z atrapami (Mockito). Przykład `@Bean`: trzy
silniki gier tworzone w `SlotEnginesConfig` z różnymi regułami.
*Pokaż w kodzie:* `slots/application/SpinService.java:71`, `slots/application/engine/SlotEnginesConfig.java:62–75`.

**11. Jak dodać czwartą grę?**
Dane (symbole, wypłaty, taśmy) do `data.sql`, nowy `@Bean SlotEngine` (np. `new LinesEngine(kod, reguły, …)`).
`SlotEngineRegistry` zbiera wszystkie silniki sam, po kodzie gry — `SpinService` się nie zmienia (zasada
otwarte–zamknięte). Dwa silniki z tym samym kodem zatrzymują start. Po stronie frontu: klasa dziedzicząca po `BaseGame`.
*Pokaż w kodzie:* `slots/application/engine/SlotEngineRegistry.java:25`; `SlotEngineRegistryTest`;
[`../projekt/10-runtime-gier.md`](../projekt/10-runtime-gier.md) § 10.

## C. JPA i baza danych

**12. Skąd biorą się tabele i dane?**
Tabele tworzy Hibernate z encji (`ddl-auto`: `create-drop` w `dev`/`demo` jak w szablonie, `update` w `prod`), a dane
startowe wczytuje `data.sql` (`spring.sql.init.mode=always`, `defer-datasource-initialization=true` — po utworzeniu
tabel). W `prod` skrypt wczytuje `StarterDataLoader` tylko na pustej bazie.
*Pokaż w kodzie:* `src/main/resources/application.properties` (linie 29–31), `shared/config/StarterDataLoader.java:62`.

**13. Co to jest problem N+1 i jak go unikacie?**
To jedno zapytanie o listę + po jednym zapytaniu o relację każdego elementu. Unikamy go przez `join fetch`
(`findActiveWithSymbols`, statystyki gracza) i projekcje `select new …Rekord(…)` z `join` (feed, historia, ranking sald).
Test liczy zapytania licznikiem statystyk Hibernate: feed dużych wygranych to jedno zapytanie niezależnie od liczby
wierszy.
*Pokaż w kodzie:* `slots/domain/SlotMachineRepository.java:26`, `SpinRoundRepository.java:94–101`;
test `report/InvestorQuestionsRepositoryTest.java:213` (`bigWinsFeedWithoutNPlusOne`).

**14. Dlaczego relacje są `LAZY` i co to `open-in-view=false`?**
`LAZY`: powiązana encja ładuje się dopiero, gdy jest potrzebna (lista gier nie ciągnie symboli). `open-in-view=false`:
sesja Hibernate nie trwa do końca żądania HTTP, więc leniwe ładowanie poza transakcją kończy się błędem — dlatego
serwisy pobierają potrzebne dane `join fetch` i zamieniają encje na DTO jeszcze w transakcji.
*Pokaż w kodzie:* `wallet/domain/Wallet.java:45`, `application.properties` (linia 33), `slots/application/PlayerSlotsService.java:23`.

**15. Dlaczego enumy jako `EnumType.STRING`?**
W bazie zapisujemy nazwę (`SETTLED`), a nie numer. Dopisanie nowej wartości w środku enuma przy `ORDINAL` zmieniłoby
znaczenie starych wierszy.
*Pokaż w kodzie:* `wallet/domain/TransactionType.java:3–6` (Javadoc), `slots/domain/SpinRound.java:77`.

**16. Dlaczego kwoty to `BigDecimal` i jak je porównujecie?**
`double` gubi grosze (`0.1 + 0.2 != 0.3`). W bazie `DECIMAL(19,2)`, w Javie skala 2 (`Money.normalize`), porównania
przez `compareTo` (`equals` uwzględnia skalę: `10.0` ≠ `10.00`). Silnik gier liczy na `long` w setnych (szybkość), na
granicy zamienia na `BigDecimal`.
*Pokaż w kodzie:* `shared/domain/Money.java:23`, `slots/domain/BetLevels.java:61`, ADR-03.

**17. Jakie rodzaje zapytań Spring Data pokazujecie?**
Pochodne z nazwy (`findByEmail`, `findByActiveTrueOrderByIdAsc`), JPQL `@Query` z `GROUP BY` i projekcjami do rekordów,
`Pageable` z osobnym `countQuery`, zapytanie z blokadą `@Lock(PESSIMISTIC_WRITE)` i modyfikujące `@Modifying` (UPDATE).
*Pokaż w kodzie:* `wallet/domain/WalletRepository.java` (cały plik, Javadoc wymienia trzy rodzaje),
`slots/domain/SpinRoundRepository.java:114` (`@Modifying`).

**18. Po co kolumna `result_json` w `spin_round`?**
To dokładnie odpowiedź, którą dostał gracz (dokument rundy). Powtórzone żądanie z tym samym `Idempotency-Key` zwraca ją
bajt w bajt, a w razie sporu widać, co pokazała przeglądarka; razem z `seed` rundę można odtworzyć. Listy jej nie
czytają (lekka projekcja `RoundSummary`).
*Pokaż w kodzie:* `slots/domain/SpinRound.java:84–86`, `slots/application/SpinDocument.java:43`, `slots/domain/RoundSummary.java:27`.

**19. Dlaczego taśmy bębnów i linie są w kolumnach tekstowych, a nie w osobnej tabeli?**
Czytamy je zawsze w całości razem z automatem, kolejność jest częścią danych, a osobna tabela to ok. 550 wierszy bez
własnej logiki. Kolumna tekstowa + `AttributeConverter` → niemodyfikowalny obiekt wartości (`ReelStrips`, `Paylines`,
`BetLevels`, `Payouts`).
*Pokaż w kodzie:* `slots/domain/ReelStrips.java:17–27` (Javadoc), `ReelStripsConverter.java`; ADR-08.

## D. Transakcje i współbieżność

**20. Co robi `@Transactional` i gdzie go używacie?**
Otwiera transakcję przed metodą i zatwierdza po niej; wyjątek niekontrolowany (`RuntimeException`, np. `CasinoException`)
ją wycofuje. Stoi w warstwie `application`: `readOnly = true` przy odczytach (Hibernate nie sprawdza zmian),
`Propagation.MANDATORY` tam, gdzie metoda **musi** działać w cudzej transakcji (blokada portfela, statystyki).
*Pokaż w kodzie:* `slots/application/SpinService.java:84`, `wallet/application/WalletService.java:50`, `:101`,
`slots/application/StatsUpdater.java:39`.

**21. Co się stanie, gdy przyjdą dwa spiny tego samego gracza naraz?**
Pierwszy wykonuje `lockWallet` → `SELECT … FOR UPDATE` i trzyma blokadę wiersza portfela do commitu; drugi czeka
i po commicie widzi już nowe saldo. Nie da się wydać tych samych pieniędzy dwa razy. Test: 16 równoległych spinów po
1000 przy saldzie 10 000 → dokładnie 10 udanych, saldo 0. Gdy baza nie doczeka się blokady — `409 CONCURRENT_REQUEST`
z `Retry-After`, nie 500.
*Pokaż w kodzie:* `SpinService.java:95`, `wallet/domain/WalletRepository.java:31–33`;
test `KasynoFlowIntegrationTest.java:270`, `SlotControllerTest.java:154`.

**22. A gdy gracz kliknie SPIN dwa razy i przeglądarka wyśle to samo żądanie (ten sam klucz)?**
Serwer pod blokadą portfela znajduje rundę z tym kluczem i zwraca tę samą odpowiedź (z `result_json`) z nagłówkiem
`Idempotent-Replayed: true` — bez drugiego zakładu. Ten sam klucz z innym zakładem → `409 IDEMPOTENCY_CONFLICT`.
Test: 8 równoległych żądań z tym samym kluczem → jeden zakład, jedna runda, 7 powtórek.
*Pokaż w kodzie:* `SpinService.java:149–160`, `slots/web/SlotController.java:102–104`;
test `KasynoFlowIntegrationTest.java:306`, `SpinServiceTest.java:226`.

**23. Co się stanie, jeśli coś się wysypie po pobraniu zakładu?**
Cały spin jest jedną transakcją, więc wyjątek wycofuje też zakład i zapis rundy — gracz nie traci cebulionów, w bazie
nie zostaje runda „w połowie”. Dlatego status `FAILED` istnieje w modelu, ale w obecnym przebiegu nie jest zapisywany.
Dodatkowo `SpinService` sprawdza, że saldo po rundzie zgadza się z wyliczonym, a jeśli nie — wycofuje transakcję.
*Pokaż w kodzie:* `SpinService.java:118–121`; diagram stanów w [`01-architektura.md`](01-architektura.md) § 6.

**24. Dlaczego blokada pesymistyczna, a nie tylko `@Version`?**
Przy samej optymistycznej drugi spin dostałby wyjątek i klient musiałby ponawiać — przy podwójnym kliknięciu to częsty
przypadek. Pesymistyczna ustawia spiny jednego gracza w kolejce, a `@Version` zostaje drugim bezpiecznikiem.
*Pokaż w kodzie:* `wallet/domain/Wallet.java:32–34` (Javadoc), `:52`; ADR-04.

**25. Co jeśli dwie osoby w tej samej chwili zarejestrują tę samą nową nazwę?**
Obie mogą nie znaleźć konta i oba zapisy spróbują wstawić ten sam techniczny e-mail. Unikalny indeks w bazie odrzuci
drugi (`DataIntegrityViolationException`), a `AuthController` ponowi logowanie raz — teraz konto już istnieje, więc to
zwykłe logowanie bez drugiego bonusu.
*Pokaż w kodzie:* `account/web/AuthController.java:56–62`; test `KasynoFlowIntegrationTest.java:340`.

## E. REST, walidacja, błędy

**26. Jakie są endpointy?**
`POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/me`, `POST /api/me/rescue`, `GET /api/me/transactions`,
`GET /api/me/history`, `GET /api/me/stats`, `GET /api/slots`, `GET /api/slots/{code}`, `POST /api/slots/{code}/spins`,
`GET /api/leaderboard`, `GET /api/feed/big-wins`, `GET /api/reports/*` (5). Kontrakt:
[`../projekt/09-kontrakt-api-i-assetow.md`](../projekt/09-kontrakt-api-i-assetow.md); dokumentacja na żywo:
`/swagger-ui.html`; gotowe żądania: `src/test/http/kasyno.http`.
*Pokaż w kodzie:* kontrolery w `*/web/*Controller.java`, `shared/config/OpenApiConfig.java:19`.

**27. Jak wyglądają błędy i kto je tworzy?**
Zawsze `application/problem+json` (RFC 9457, `ProblemDetail`) z polem `code` (`NICK_INVALID`, `INSUFFICIENT_FUNDS`…),
czasem `errors[]` (błędne pola) i `retryAfterSeconds`. Serwisy rzucają wyjątki z `ErrorCode` (status przypisany w enumie),
a jeden `@RestControllerAdvice` zamienia je na odpowiedź. Przy 5xx klient dostaje ogólny komunikat, szczegóły idą do logu.
*Pokaż w kodzie:* `shared/error/GlobalExceptionHandler.java:61`, `:100`; `shared/error/ErrorCode.java:17`;
test `AuthControllerTest.java:159` (`unexpectedErrorDoesNotLeak`).

**28. Jak działa walidacja?**
Dwa poziomy. **Kształt** żądania: Bean Validation na rekordach DTO i parametrach (`@NotNull`, `@Positive`, `@Digits`,
`@Min`/`@Max`, `@Size`) → `400 VALIDATION_FAILED` z listą pól. **Reguły biznesowe** w serwisach i encjach: zakład spoza
`betLevels` → `BET_INVALID`, nazwa → `NICK_INVALID`/`NICK_FORBIDDEN`, brak środków → `INSUFFICIENT_FUNDS`. Walidacja w
przeglądarce (`js/validation.js`) to tylko wygoda.
*Pokaż w kodzie:* `slots/web/SpinRequest.java:22`, `wallet/web/WalletController.java:48–55`,
`slots/application/SpinService.java:88`; test `SlotControllerTest.absurdBetIsRejectedByValidation` (`:141`).

**29. Dlaczego kontrolery zwracają DTO, a nie encje?**
Encja w odpowiedzi to wyciek pól technicznych (np. `version`) i próba czytania relacji `LAZY` poza transakcją. DTO to
rekordy z metodą `from(encja)`; regułę pilnuje ArchUnit.
*Pokaż w kodzie:* `wallet/web/TransactionResponse.java:22`, `ArchitectureTest.java:143` (`controllersDoNotReturnEntities`).

**30. Dlaczego spin zwraca tekst JSON z bazy, a nie obiekt?**
`SlotController` wysyła dokładnie dokument rundy zapisany w `result_json` — dzięki temu powtórka z tym samym kluczem
jest identyczna co do bajtu. Rekord `SpinResponse` istnieje tylko po to, żeby Swagger pokazał pola.
*Pokaż w kodzie:* `slots/web/SlotController.java:99–105`, `slots/web/SpinResponse.java:9–15` (Javadoc).

## F. LAB 06: zdarzenia, konfiguracja, harmonogram, profile

**31. Jakie zdarzenia publikujecie i dlaczego różne rodzaje słuchaczy?**
`PlayerRegistered` → portfel z bonusem (`@EventListener`, w transakcji logowania). `SpinCompleted` → statystyki gracza
(`@EventListener` + `MANDATORY`, w transakcji spinu — muszą zgadzać się z rundami) oraz feed/ranking
(`@TransactionalEventListener(AFTER_COMMIT)`). `BalanceChanged` → ranking sald (`AFTER_COMMIT`). Po commicie, bo
wycofany spin nie może trafić do feedu, a unieważnienie pamięci przed commitem dawałoby wyścig z odczytem.
*Pokaż w kodzie:* `report/application/LobbyBoardsListener.java:59`, `:75`; test `LobbyBoardsListenerTest.java:77`
(`rollbackIsIgnored`); tabela w [`01-architektura.md`](01-architektura.md) § 7.1.

**32. Jak działa konfiguracja przez `@ConfigurationProperties`?**
Rekord `CasinoProperties` z prefiksem `kasyno` wiąże wpisy `application.properties` (bonus, odliczanie ratunku, próg
feedu, nazwa gracza, cache, harmonogram, demo). `@Validated` — błędna wartość zatrzymuje start; rekord jest
niemodyfikowalny. Każdą wartość można nadpisać w profilu, argumentem albo zmienną środowiskową (`KASYNO_RESCUECOOLDOWN=5m`).
*Pokaż w kodzie:* `shared/config/CasinoProperties.java:43–54`, `application.properties` (linie 41–78).

**33. Jakie zadania `@Scheduled` macie i czego świadomie nie ma?**
`EconomySnapshotJob` — co godzinę (w `demo` co minutę) linia logu z gospodarką kasyna; `IdempotencyKeyCleanup` — co
godzinę zapomina klucze idempotencji starsze niż 24 h. Nie ma „resetu limitu ratunku” (limit wynika z
`last_rescue_at` + 10 min, liczonego przy żądaniu — dokładny co do sekundy) ani „sprzątania sesji” (robi to Tomcat).
Testy wołają metody wprost z zegarem `MutableClock`.
*Pokaż w kodzie:* `report/application/EconomySnapshotJob.java:57`, `slots/application/IdempotencyKeyCleanup.java:53`,
`shared/config/SchedulingConfig.java:24–31`; testy `EconomySnapshotJobTest`, `IdempotencyKeyCleanupTest.java:61`.

**34. Jakie macie profile i czym się różnią?**
`dev` (domyślny, jak szablon kursu: H2 w pliku, `create-drop`), `demo` (H2 w pamięci, `X-Demo-Seed`, ratunek co minutę),
`prod` (trwała baza `update`, dane startowe tylko raz, konsola H2 wyłączona, ciasteczko `Secure`). Plik `dev` jest prawie
pusty celowo — żeby nie nadpisywać zmian, które instrukcje laboratoriów każą robić w `application.properties`.
*Pokaż w kodzie:* `src/main/resources/application-*.properties`; tabela w [`00-uruchomienie.md`](00-uruchomienie.md) § 3;
test `ProfilesTest`.

## G. Matematyka gier

**35. Jak losujecie wynik i czy to jest uczciwe?**
Ziarno rundy (64 bity) losuje `SecureRandom` — nieprzewidywalne. Liczby w rundzie daje `SplittableRandom(ziarno)` —
szybki i deterministyczny. Ziarno zapisujemy, więc każdą rundę da się odtworzyć i sprawdzić.
*Pokaż w kodzie:* `slots/application/engine/SecureSeedGenerator.java:17`, `SplittableRandomSource.java:20`; [`03-silnik-gier.md`](03-silnik-gier.md) § 2.

**36. Skąd wiecie, że RTP jest 96%?**
Test Monte Carlo gra 10 mln rund S2 i 14 mln rund S3 tym samym silnikiem co aplikacja, na danych z `data.sql`, ze stałym
ziarnem: 96,18% i 96,28%. Liczba rund dobrana ze wzoru σ/√n, żeby tolerancja ±0,8 p.p. była ≥ 3 błędami standardowymi.
S1 liczymy dokładnie ze wszystkich 32 768 układów: 94,892%.
*Pokaż w kodzie:* `slots/application/engine/SlotMathMonteCarloTest.java:71`, `:110`, `:123`; uruchom
`mvn -B test -Dtest='SlotMath*'`. Pełna odpowiedź z pytaniami dodatkowymi: [`03-silnik-gier.md`](03-silnik-gier.md) § 11.

**37. Czym różni się taśma od wagi?**
Taśma (S1, S2) to pętla symboli w ustalonej kolejności — losujemy pozycję zatrzymania, a sąsiedztwo symboli jest częścią
matematyki (np. bloki trzech wiśni umożliwiają NEON JACKPOT). Waga (S3) to szansa symbolu w każdym polu, losowanym
niezależnie (zrzut planszy).
*Pokaż w kodzie:* `slots/application/engine/LinesEngine.java:110–121`, `GameMath.java:192`.

**38. Jak działa kaskada w Kryształowej Kaskadzie?**
Klaster = 5+ takich samych symboli połączonych bokami (BFS). Wygrane pękają, reszta opada, od góry dochodzą nowe symbole;
ocena powtarza się, dopóki są klastry. W darmowych spinach na końcu sekwencji suma kul mnożników mnoży jej wygraną.
*Pokaż w kodzie:* `slots/application/engine/ClusterEngine.java:119`, `:140`, `:192`; test `ClusterEngineTest.java:125`.

**39. Jak odtworzyć konkretną rundę gracza (np. reklamacja)?**
Z `spin_round` bierzemy grę, zakład i `seed`, liczymy `engine.playRound(math, bet, RandomSource.fromSeed(seed))`
i porównujemy z zapisanym `result_json`. Robi to automatycznie test integracyjny dla każdej rundy zagranej przez HTTP.
W profilu `demo` to samo ziarno można podać nagłówkiem `X-Demo-Seed`.
*Pokaż w kodzie:* `slots/SlotEnginesIntegrationTest.java:81`, `slots/DemoSeedAllowedTest.java:61`.

## H. Testy

**40. Jakie macie testy i jak je uruchomić?**
Ok. 260 przypadków (ostatni przebieg 260/260): jednostkowe encji i obiektów wartości (bez Springa), serwisów (Mockito),
silników i matematyki, `@DataJpaTest` zapytań, `@WebMvcTest` kontrolerów, `@SpringBootTest` integracyjne (współbieżność,
profile, zdarzenia), ArchUnit. Wszystko: `mvn -B verify -Dlab=1` (z regułami kursu). Do tego e2e w Chromium
(`tools/e2e`) i testy pipeline'u grafiki.
*Pokaż w kodzie:* tabela w [`02-przewodnik-po-kodzie.md`](02-przewodnik-po-kodzie.md) § 5.4.

**41. Jak testujecie kod zależny od czasu (ratunek co 10 minut, klucze po 24 h)?**
Serwisy nie wołają `Instant.now()`, tylko biorą czas z beana `Clock`. W testach podstawiamy `MutableClock` i „przesuwamy
czas” o 10 minut albo 25 godzin — bez czekania i bez losowych wyników.
*Pokaż w kodzie:* `shared/config/TimeConfig.java:17`, `src/test/java/pl/wsb/kasyno/support/MutableClock.java`;
test `WalletServiceTest.java:183`.

**42. Jak testujecie poprawność matematyki bez grania milionów razy ręcznie?**
`LinesEngineTest`/`ClusterEngineTest` podają silnikowi „ustawione” liczby przez interfejs `RandomSource` i sprawdzają
konkretne układy (WILD ×2, klaster 5 płaci, 4 nie, kaskada, limit). `SlotMathDataTest` sprawdza spójność `data.sql`,
a `SlotMathMonteCarloTest` — RTP.
*Pokaż w kodzie:* `slots/application/engine/LinesEngineTest.java:46`, `ClusterEngineTest.java:84`, `SlotMathDataTest.java:95`.

## I. Bezpieczeństwo

**43. Dlaczego nie używacie Spring Security?**
Aplikacja nie ma haseł ani ról (logowanie samą nazwą — wymaganie projektu), więc Spring Security byłby tylko po to, żeby
dodać trzy nagłówki. Zamiast tego: sesja serwerowa (`HttpOnly`, `SameSite=Lax`, nowa sesja po logowaniu), resolver
`@CurrentPlayer` (brak sesji → `401` przed wejściem do metody) i filtr `SecurityHeadersFilter`. Gdybyśmy dodawali hasła
albo role administratora — wtedy Spring Security.
*Pokaż w kodzie:* `shared/web/SecurityHeadersFilter.java:25–30` (Javadoc), `shared/web/PlayerSession.java:28`,
`shared/web/CurrentPlayerArgumentResolver.java:29`; ADR-06.

**44. Jakie są znane ograniczenia bezpieczeństwa?**
(1) Każdy, kto wpisze Twoją nazwę, wejdzie na Twoje konto — świadome, waluta bez wartości; poprawa: PIN/OAuth.
(2) Raporty inwestora są publiczne (dane zbiorcze, bez danych osobowych). (3) Brak `Content-Security-Policy` (ma powstać
razem z frontem). (4) Brak limitu liczby żądań. Wszystko opisane, nic nie jest „ukryte”.
*Pokaż w kodzie:* [`../plan-projektu.md`](../plan-projektu.md) § 5.8, `report/web/ReportController.java:17–22`.

**45. Jak chronicie się przed XSS, CSRF i clickjackingiem?**
XSS: front wstawia teksty z serwera (nazwy graczy) wyłącznie przez `textContent`, nigdy `innerHTML`; ciasteczko sesji
`HttpOnly` jest niewidoczne dla skryptu. CSRF: `SameSite=Lax` + API przyjmuje JSON. Clickjacking:
`X-Frame-Options: SAMEORIGIN`. Do tego `X-Content-Type-Options: nosniff` i `Referrer-Policy`.
*Pokaż w kodzie:* `js/ui/toast.js` (nagłówek), `js/lobby.js` (nagłówek), `application.properties` (linie 85–89),
`SecurityHeadersFilter.java:35`; test `SlotControllerTest.java:312`.

**46. Czy da się oszukać grę z konsoli przeglądarki?**
Nie: wynik, saldo i walidacja zakładu są na serwerze; przeglądarka wysyła tylko `{"bet": 100}`. Zmiana JS-a zmienia
co najwyżej animację. Zakład spoza listy → `BET_INVALID`, za mało środków → `INSUFFICIENT_FUNDS`, cudzy `X-Demo-Seed`
poza profilem `demo` jest ignorowany.
*Pokaż w kodzie:* `slots/application/SpinService.java:85–107`, `slots/web/SlotController.java:96`; ADR-01.

## J. Czego nie ma i dlaczego

**47. Roadmapa LAB 04 mówi o zastąpieniu relacji między modułami identyfikatorami — a `Wallet` ma relację do `UserAccount`.**
Tam, gdzie relacja tworzyłaby cykl, już używamy identyfikatorów (`WalletTransaction.spinRoundId`, `gameCode`). Relacje do
`UserAccount` zostały, bo `account` jest modułem bazowym, z którego korzystają wszyscy, i ArchUnit to dopuszcza
(`accountIsTheBase`). Jeśli reguły LAB 04 będą tego wymagać, zamienimy je na `Long playerId` — serwisy i tak operują
identyfikatorami gracza.
*Pokaż w kodzie:* `wallet/domain/WalletTransaction.java:25–27` (Javadoc), `ArchitectureTest.java:52`.

**48. Czy jest integracja z API innego zespołu (`RestClient`, zadanie dodatkowe LAB 06)?**
Jeszcze nie — to zadanie dodatkowe, zależne od uzgodnienia z innym zespołem. Miejsce jest przewidziane konwencją
(`<moduł>.infrastructure`), a test zrobilibyśmy z `MockRestServiceServer`.
*Pokaż w kodzie:* [`../plan-projektu.md`](../plan-projektu.md) § 5.7.

**49. Dlaczego nie ma migracji bazy (Flyway/Liquibase)?**
Szablon kursu tworzy schemat z encji (`create-drop`), reguły na tym bazują. W `prod` `ddl-auto=update` dopisuje brakujące
tabele i kolumny; przy poważnych zmianach schematu na produkcji dodalibyśmy Flyway.
*Pokaż w kodzie:* `application-prod.properties`; ADR-10.

**50. Dlaczego w lobby nie ma jeszcze filmików z gry i pełnych S2/S3?**
Filmiki nagrywamy z prawdziwej gry (profil `demo` + `X-Demo-Seed`, Playwright + ffmpeg), więc powstaną po scaleniu S2 i S3;
katalog `assets/video/` czeka. S2 i S3 są w toku — backend i silniki są gotowe i przetestowane, a do czasu scalenia
front gra w nie na wspólnym runtime z prostą sceną (`PlaceholderGame`).
*Pokaż w kodzie:* `js/game/games/zastepcza.js`, `js/gra.js:155–156`.

## K. Front, wydajność, oprawa

**51. Skąd przeglądarka wie, co pokazać po spinie?**
Z listy kroków w odpowiedzi. `StepPlayer` odgrywa je po kolei (`await` każdego handlera), `BaseGame` ma domyślne
handlery wszystkich typów, a gra (S1) dopisuje swoje efekty. Bębny ruszają od razu po kliknięciu, a zatrzymują się na
planszy z odpowiedzi; saldo z `balanceAfter` księgujemy raz, w chwili końca liczenia wygranej.
*Pokaż w kodzie:* `js/game/controller.js:119`, `:162`; `js/game/step-player.js:56`; `js/game/base-game.js:370`.

**52. Jak osiągacie płynność (60 fps)?**
Logika i render rozdzielone w jednej pętli; pule obiektów i cząsteczki w tablicach `Float32Array` (brak alokacji w trakcie
gry); `ParticleContainer` (jedno wywołanie rysowania na warstwę); poświaty i rozmycia „upieczone” w teksturach przez
pipeline; shadery kompilowane na ekranie ładowania; trzy poziomy jakości z automatem. Zmierzone: logika gry p95 0,5–0,7 ms
na klatkę (2,2–3,3 ms przy dławieniu CPU ×4).
*Pokaż w kodzie:* `js/game/core/app.js:122`, `js/game/fx/particles.js` (nagłówek), `js/game/core/quality.js:115`;
[`../projekt/10-runtime-gier.md`](../projekt/10-runtime-gier.md) § 11.

**53. Jak dbacie o dostępność i bezpieczeństwo efektów?**
Strażnik błysków: najwyżej 3 błyski na sekundę (WCAG 2.3.1), amplituda liczona jak w WCAG; tryb ograniczonego ruchu (bez
błysków i drżenia); teksty w HTML; okna modalne z pułapką fokusu i `inert`; powiadomienia `aria-live`.
*Pokaż w kodzie:* `js/game/fx/flash.js:68`, `js/ui/modal.js:50`; ADR-14.

**54. Dlaczego bez Reacta i bez bundlera?**
Przeglądarki obsługują moduły ES natywnie; Spring Boot serwuje pliki bez kroku budowania. PixiJS (WebGL) tylko na stronie
gry, w repozytorium (bez CDN — działa offline na obronie). Każdy plik JS można otworzyć i omówić 1:1.
*Pokaż w kodzie:* `static/gra.html` (linie 13, 20), `static/vendor/pixi/VERSION.txt`; ADR-11.

**55. Skąd grafika i jak ją przetwarzacie?**
93 obrazy wygenerowane w ChatGPT według gotowych promptów; skrypt `tools/art/przetworz.py` robi z surowych PNG pliki WebP
@1x/@2x z wariantami i `manifest.json` (naprawa przezroczystości, okna ramek, cięcie arkuszy, budżety wagi, raport
jakości). Front prosi o obraz przez ID z manifestu.
*Pokaż w kodzie:* `tools/art/przetworz.py`, `static/assets/img/manifest.json`, `js/game/core/resources.js:28`;
[`../projekt/02-lista-obrazow.md`](../projekt/02-lista-obrazow.md).

**56. Skąd dźwięk?**
Syntezowany w Pythonie (NumPy): 59 efektów i 8 pętli, kodowanie Opus + AAC, kontrole głośności i szwów pętli. W
przeglądarce własny silnik Web Audio (szyny, ducking, limit głosów, pętle bez szwu, planowanie co do milisekundy).
*Pokaż w kodzie:* `tools/audio/generuj_wszystko.py`, `js/audio/audio-engine.js:379`; ADR-13.

## L. Uruchomienie i hosting

**57. Jak uruchomić projekt na obronie?**
IntelliJ → `KasynoApplication` → *Run* (albo `mvn spring-boot:run`) → <http://localhost:8080>. Swagger:
`/swagger-ui.html`, konsola H2: `/h2-console` (`jdbc:h2:file:./data/wdtb`, `sa`, puste hasło). Pokaz `@Scheduled`
i ratunku bez czekania: profil `demo`.
*Pokaż w kodzie:* [`00-uruchomienie.md`](00-uruchomienie.md) § 2–3.

**58. Jak wdrażacie na serwer?**
`Dockerfile` (dwa etapy: Maven buduje, do obrazu trafia tylko `.jar`, użytkownik bez uprawnień roota, `HEALTHCHECK`
`/api/slots`), profil `prod`. Render.com czyta `render.yaml`. Na darmowym planie dysk jest ulotny — trwałe dane przez
zewnętrzny PostgreSQL (zmienne `SPRING_DATASOURCE_*`, bez zmiany kodu).
*Pokaż w kodzie:* `Dockerfile`, `render.yaml`; [`00-uruchomienie.md`](00-uruchomienie.md) § 4–5.

---

## Powiązane dokumenty

[`02-przewodnik-po-kodzie.md`](02-przewodnik-po-kodzie.md) · [`03-silnik-gier.md`](03-silnik-gier.md) ·
[`05-decyzje-projektowe.md`](05-decyzje-projektowe.md) · [`07-podzial-pracy.md`](07-podzial-pracy.md) ·
[`../projekt/07-gry-i-matematyka.md`](../projekt/07-gry-i-matematyka.md) § 8 ·
[`../projekt/05-dzwiek-i-muzyka.md`](../projekt/05-dzwiek-i-muzyka.md) (Załącznik A: pytania o dźwięk)
