# 02. Przewodnik po kodzie: pakiet po pakiecie, klasa po klasie

Ten dokument prowadzi po całym kodzie Cebulion Casino tak, żeby każda osoba z zespołu umiała otworzyć dowolną klasę,
powiedzieć **po co jest**, pokazać **najważniejszą metodę**, wyjaśnić, **z kim współpracuje**, i wskazać **test**,
który jej pilnuje. Diagramy (warstwy, moduły, ERD, sekwencje) są w [`01-architektura.md`](01-architektura.md), a tu jest
„mapa terenu” do chodzenia po plikach.

**Jak czytać odnośniki.** Ścieżki są skrócone:

| Zapis w tym dokumencie | Pełna ścieżka w repozytorium |
|---|---|
| `slots/application/SpinService.java:85` | `src/main/java/pl/wsb/kasyno/slots/application/SpinService.java`, linia 85 |
| test `SpinServiceTest` (`slots/application/SpinServiceTest.java:226`) | `src/test/java/pl/wsb/kasyno/slots/application/SpinServiceTest.java` |
| `js/game/controller.js:119` | `src/main/resources/static/js/game/controller.js` |
| `tools/art/przetworz.py` | bez zmian (narzędzia poza aplikacją) |

W IntelliJ: `Ctrl+Shift+N` (macOS `Cmd+Shift+O`) → nazwa pliku → `Ctrl+G` (`Cmd+L`) → numer linii. Numery linii są
według stanu gałęzi z 2026-10-11 (commit `da53c1d`); po zmianach w kodzie mogą przesunąć się o kilka linii — nazwa
metody zostaje.

---

## 0. Mapa „gdzie czego szukać”

| Chcę pokazać / wyjaśnić | Kod | Test, który to sprawdza |
|---|---|---|
| start aplikacji, skanowanie komponentów | `KasynoApplication.java:21` | reguła R1.01/R1.02 (`pl/wsb/rules/lab01`) |
| logowanie nazwą gracza, bonus 10 000 | `account/application/LoginService.java:56` | `LoginServiceTest`, `AuthControllerTest.loginNewPlayer` |
| reguły nazwy (3–16 znaków, zakazane słowa, „Adm1n”) | `account/application/NickPolicy.java:49`, `:69` | `NickPolicyTest` (testy parametryzowane) |
| dwa równoczesne logowania tą samą nową nazwą | `account/web/AuthController.java:56` | `KasynoFlowIntegrationTest.concurrentFirstLoginsCreateOneAccount` (`:340`) |
| sesja serwerowa i ochrona przed *session fixation* | `shared/web/PlayerSession.java:28` | `AuthControllerTest.meWithSession` |
| skąd kontroler wie, kto jest zalogowany (`@CurrentPlayer`) | `shared/web/CurrentPlayerArgumentResolver.java:29` | `AuthControllerTest.meWithoutSession` |
| portfel: saldo nigdy ujemne | `wallet/entity/Wallet.java:91` | `WalletTest.neverNegative` (`:49`), `WalletServiceTest.debitNeverGoesNegative` |
| blokada pesymistyczna `SELECT … FOR UPDATE` | `wallet/entity/WalletRepository.java:31` | `KasynoFlowIntegrationTest.concurrentSpinsNeverOverdraw` (`:270`) |
| historia portfela (księga, suma = saldo) | `wallet/entity/WalletTransaction.java:32` | `WalletServiceTest.ledgerIsConsistent` (`:153`) |
| bonus ratunkowy co 10 minut (zegar w testach) | `wallet/entity/Wallet.java:127`, `wallet/application/WalletService.java:124` | `WalletServiceTest.rescueCooldownUsesClock` (`:183`) |
| **spin — najważniejsza operacja** | `slots/application/SpinService.java:84` | `SpinServiceTest`, `SlotEnginesIntegrationTest.spinsFollowContract` |
| idempotencja (`Idempotency-Key`) | `SpinService.java:95` (blokada) i `:149` (powtórka) | `SpinServiceTest.idempotencyIsCheckedUnderWalletLock` (`:226`), `KasynoFlowIntegrationTest.concurrentDuplicateSpinsAreReplayed` |
| cykl życia rundy `STARTED → RESOLVED → SETTLED` | `slots/entity/SpinStatus.java:31`, `slots/entity/SpinRound.java:158` | `SpinRoundTest.transitionTable` (`:114`), `cannotSettleTwice` (`:59`) |
| ziarno losowania, odtwarzalność | `slots/application/engine/SecureSeedGenerator.java:17`, `SplittableRandomSource.java:20` | `LinesEngineTest.replayFromSeed`, `ClusterEngineTest.replayFromSeed` |
| silnik linii (S1, S2) | `slots/application/engine/LinesEngine.java:40`, ocena linii `:155` | `LinesEngineTest` (16 testów) |
| silnik klastrów i kaskad (S3) | `slots/application/engine/ClusterEngine.java:50`, klastry `:140`, kaskada `:192` | `ClusterEngineTest` (8 testów) |
| limit maksymalnej wygranej | `slots/application/engine/RoundBuilder.java:40` | `LinesEngineTest.maxWinCapsRound`, `ClusterEngineTest.maxWinStopsCascades` |
| reguły gier (×2, ×10, darmowe spiny, kule) | `slots/application/engine/SlotEnginesConfig.java:32–60` | `SlotMathMonteCarloTest` |
| **RTP 95/96% — skąd wiemy** | `SlotMathMonteCarloTest` (`slots/application/engine/SlotMathMonteCarloTest.java:71–134`) | — (to jest test); opis: [`03-silnik-gier.md`](03-silnik-gier.md) |
| format odpowiedzi spinu (kontrakt § 2.4) | `slots/application/SpinDocument.java:43`, kroki `engine/RoundStep.java:30` | `SpinDocumentTest`, `LinesEngineTest.jsonFormat` |
| `X-Demo-Seed` tylko w profilu `demo` | `slots/web/SlotController.java:96`, `:114` | `DemoSeedIgnoredTest`, `DemoSeedAllowedTest`, `ProfilesTest.demoSeedOnlyInDemo` |
| statystyki gracza na automacie (M:N z atrybutami) | `slots/entity/PlayerMachineStats.java:34`, `slots/application/StatsUpdater.java:38` | `LobbyBoardsListenerTest.statsUpdaterRequiresTransaction` |
| 5 pytań inwestora (JPQL, `GROUP BY`, projekcje) | `slots/entity/SpinRoundRepository.java:55–86`, `PlayerMachineStatsRepository.java:28–46`, `wallet/entity/WalletRepository.java:40–52` | `InvestorQuestionsRepositoryTest` (`@DataJpaTest`), w tym `bigWinsFeedWithoutNPlusOne` (`:213`) |
| ranking i feed z pamięci podręcznej | `report/application/LobbyBoardsCache.java:80` | `LobbyBoardsCacheTest.invalidationDuringQueryIsNotCached` (`:75`) |
| zdarzenia po commicie (`AFTER_COMMIT`) | `report/application/LobbyBoardsListener.java:59`, `:75` | `LobbyBoardsListenerTest.rollbackIsIgnored` (`:77`) |
| zadania cykliczne `@Scheduled` | `report/application/EconomySnapshotJob.java:57`, `slots/application/IdempotencyKeyCleanup.java:53` | `EconomySnapshotJobTest`, `IdempotencyKeyCleanupTest`, `ProdProfilePersistenceTest.scheduledTasksRegistered` |
| konfiguracja `kasyno.*` jako rekord | `shared/config/CasinoProperties.java:45` | `ProfilesTest` |
| profile `dev` / `demo` / `prod`, dane startowe | `src/main/resources/application*.properties`, `shared/config/StarterDataLoader.java:62` | `ProfilesTest`, `ProdProfilePersistenceTest.survivesRestart` (`:53`) |
| błędy jako `ProblemDetail` (RFC 9457) | `shared/error/GlobalExceptionHandler.java:61`, `shared/error/ErrorCode.java:17` | `AuthControllerTest.unexpectedErrorDoesNotLeak` (`:159`), `SlotControllerTest.businessErrorCodes` |
| nagłówki bezpieczeństwa (zamiast Spring Security) | `shared/web/SecurityHeadersFilter.java:35` | `SlotControllerTest.securityHeaders` (`:312`) |
| reguły architektury (moduły bez cykli) | `src/test/java/pl/wsb/kasyno/ArchitectureTest.java:46–150` | — (to jest test) |
| front: jedyne miejsce rozmowy z API | `js/api.js:49` (`request`), `:89` (`api`) | `tools/e2e/smoke.mjs`, `backend-flow.mjs` |
| front: lobby (logowanie, kafle, ranking, ratunek) | `js/lobby.js:116` (`init`), `:404` (`submitLogin`), `:518` (`claimRescue`) | `tools/e2e/smoke.mjs` |
| front: przebieg spinu w grze | `js/game/controller.js:119` (`spin`), `:162` (`#book`) | `tools/e2e/gra-s1.mjs` |
| front: odtwarzanie kroków z serwera | `js/game/step-player.js:56`, domyślne handlery `js/game/base-game.js:370–501` | `tools/e2e/gra-s1.mjs` |
| front: bębny (fizyka, stop w zaplanowanej ms) | `js/game/reels/reelset.js:206` (`land`), `:328` (`update`) | `tools/e2e/gra-s1.mjs` |
| front: strażnik błysków (≤ 3/s, WCAG 2.3.1) | `js/game/fx/flash.js:68` (`request`) | `gra-s1.mjs` (≤ 3 błyski/s, 0 pominiętych bohaterów) |
| front: poziomy jakości High/Medium/Low | `js/game/core/quality.js:16`, automat `:115` | `gra-s1.mjs` (pomiar klatek, dławienie CPU ×4) |
| front: dźwięk (Web Audio, szyny, pętle) | `js/audio/audio-engine.js:379` (`play`), `js/game/audio/game-audio.js` | `gra-s1.mjs` (dźwięk odblokowany gestem) |
| grafika: PNG z ChatGPT → WebP + manifest | `tools/art/przetworz.py` | `tools/art/testy/test_przetworz.py` (27 testów) |
| dźwięk: synteza → Opus/AAC + manifest | `tools/audio/generuj_wszystko.py` | `tools/audio/sprawdz.py` (kontrole A01–A14) |
| obraz Dockera, hosting | `Dockerfile`, `render.yaml` | [`00-uruchomienie.md`](00-uruchomienie.md) § 4–5 |

### 0.1. Pakiety w jednym spojrzeniu

```text
src/main/java/pl/wsb/kasyno/            146 plików Java
├── KasynoApplication                   start (R1.01)
├── account   api(6) application(4) domain(4) web(4)        konto z szablonu, logowanie nazwą, obiekt „player”
├── wallet    api(5) application(1) entity(7) web(3)        saldo, księga operacji, bonusy, blokada
├── slots     api(8) application(11) engine(23) entity(26) web(9)   automaty, spin, silniki gier, statystyki
├── report    application(9) web(9)                         5 pytań inwestora, ranking, feed, migawka gospodarki
└── shared    config(6) domain(1) error(4) web(6)           konfiguracja, błędy, sesja, kwoty
                                                            (w nawiasach: liczba plików w pakiecie)
src/main/resources/
├── application.properties (+ -dev, -demo, -prod)            ustawienia i profile (LAB 06)
├── data.sql                                                konta (R1.03) + 3 automaty z pełną matematyką
└── static/                                                 front: index.html (lobby), gra.html, css/, js/, assets/, vendor/pixi
src/test/java/pl/wsb/kasyno/            36 plików, ok. 260 przypadków testowych (ostatni przebieg: 260/260 zielonych)
src/test/java/pl/wsb/rules/             reguły prowadzącego (nie ruszamy)
```

Zasady warstw (pilnuje `ArchitectureTest`): `web` → `application` → `entity` (konto z szablonu: `account.domain`); inne moduły tylko przez `api`;
`shared` nie zależy od żadnego modułu; kolejność modułów bez cykli: `account ← wallet ← slots ← report`. Szczegóły
i diagram: [`01-architektura.md`](01-architektura.md) § 1–2.

### 0.2. Konwencje, które powtarzają się w całym kodzie

* **Wstrzykiwanie przez konstruktor** (pola `private final`, bez `@Autowired` na polach) — klasę da się utworzyć
  w teście jednostkowym zwykłym `new`, a zależności są jawne.
* **Rekordy** (`record`) dla DTO, zdarzeń i obiektów „tylko do odczytu” — niemodyfikowalne, z gotowym `equals`.
* **Encje „bogate”**: stan zmieniają metody z regułami (`Wallet.debitBet`, `SpinRound.settle`), nie settery.
* **`@Transactional` w warstwie `application`** (serwisy), `readOnly = true` przy odczytach.
* **Wyjątki biznesowe** dziedziczą po `CasinoException` z kodem `ErrorCode` — serwis nie zna HTTP, status dobiera
  `GlobalExceptionHandler`.
* **Czas z beana `Clock`** (`shared/config/TimeConfig.java:17`) — testy „przesuwają czas” (`support/MutableClock`).
* **Javadoc po polsku** na każdej klasie: akapit „Po co” — to gotowa odpowiedź na pytanie „po co ta klasa?”.

---

## 1. Backend: moduł `account` (konto gracza)

Konto użytkownika pochodzi z szablonu kursu (`user_account`); gracz to konto z rolą `USER` i technicznym e-mailem
`<nazwa-małymi-literami>@kasyno.local`. Moduł jest „najniżej”: nie zależy od żadnego innego modułu.

### 1.1. `account.domain`

**`UserAccount`** (`account/domain/UserAccount.java:23`) — encja z szablonu: `id`, `email` (unikalny), `displayName`,
`role` (`EnumType.STRING`), `createdAt` (`LocalDateTime`, jak w szablonie). Nie zmieniamy jej kształtu — reguły kursu
(R1.03) czytają tę tabelę. Na nią wskazują `Wallet`, `SpinRound` i `PlayerMachineStats`.

**`UserAccountRepository`** (`:14`) — `JpaRepository` + zapytanie pochodne `findByEmail` (`:17`). Unikalny `email`
w bazie to gwarancja „Kamil = KAMIL” także przy równoległych żądaniach.

**`AccountRole`** (`:6`) — `USER`, `PARTNER`, `ADMIN` (z szablonu). **`InvalidNickException`** (`:11`) — dwie
fabryki: `invalid(...)` → `NICK_INVALID`, `forbidden()` → `NICK_FORBIDDEN` (oba `400`).

### 1.2. `account.application`

**`LoginService`** (`account/application/LoginService.java:33`) — przypadek użycia „wejdź do kasyna nazwą”.
* `login(String rawNick)` (`:56`, `@Transactional`): `NickPolicy.validate` → `findByEmail(technicalEmail(nick))` →
  istnieje: `LoginResult(id, false, 0)`; nie istnieje: `register(...)` (`:65`) zapisuje `UserAccount` i publikuje
  `PlayerRegistered` z kwotą `kasyno.welcome-bonus`.
* Współpraca: portfel słucha `PlayerRegistered` (`WalletService.onPlayerRegistered`) **w tej samej transakcji** —
  konto i portfel z bonusem zapisują się razem albo wcale.
* Testy: `LoginServiceTest` (nowy gracz, powracający, wielkość liter, polskie litery, zła nazwa niczego nie zapisuje).

**`NickPolicy`** (`:28`) — reguły nazwy z `CasinoProperties.Nick`.
* `validate` (`:49`): obcięcie spacji → długość 3–16 → jawna lista znaków (litery łacińskie i polskie, cyfry, `_`, `-`;
  bez cyrylicy, żeby nie podszyć się literą „а”) → porównanie z listami po uproszczeniu.
* `simplify` (`:69`): małe litery, bez ogonków (NFD), cyfry jak litery (`4→a`, `0→o`, `1→i`…), bez `_`/`-`, bez
  powtórzeń liter — dlatego `Adm1n` i `A_d_m_i_n` są odrzucane. Nazwy zastrzeżone porównujemy w całości, wulgaryzmy
  jako fragment.
* Testy: `NickPolicyTest` (cztery `@ParameterizedTest`).

**`PlayerProfileService`** (`:23`, implementuje `PlayerProfiles`) — składa obiekt `player` z API: dane konta +
`PlayerFunds` z portu `PlayerFundsProvider` (implementuje go `WalletService`). `view` (`:35`) ma
`@Transactional(readOnly = true)`; przelicza `createdAt` z czasu lokalnego (szablon) na `Instant` (UTC w API).

**`LoginResult`** (`:12`) — rekord `(playerId, newPlayer, welcomeBonus)`.

### 1.3. `account.api` (publiczny kontrakt modułu)

| Typ | Po co |
|---|---|
| `PlayerRegistered` (`:18`) | zdarzenie „nowy gracz” — zamiast wołać portfel wprost (cykl `wallet → account → wallet`) |
| `PlayerFundsProvider` (`:12`) | **port** (odwrócenie zależności, „D” z SOLID): `account` mówi, czego potrzebuje (saldo), `wallet` to implementuje |
| `PlayerFunds` (`:13`) | saldo, `minBet`, `canRescue`, `rescueAvailableInSeconds` |
| `PlayerProfiles` (`:7`) | fasada: `view(playerId)` — korzysta z niej też `WalletController` po bonusie ratunkowym |
| `PlayerView` (`:21`) | obiekt `player` z kontraktu (nick, awatar, saldo, minBet, ratunek, `createdAt`) |
| `PlayerAvatar` (`:13`) | `indexFor(nick)` (`:21`) = `floorMod(nick.toLowerCase().hashCode(), 8)` — awatar bez kolumny w bazie, stały dla nazwy |

### 1.4. `account.web`

**`AuthController`** (`account/web/AuthController.java:24`) — `POST /api/auth/login` (`:37`) i `POST /api/auth/logout`
(`:45`, zawsze `204`). Po zalogowaniu `PlayerSession.start` (nowa sesja). `loginWithRetry` (`:56`): przy
`DataIntegrityViolationException` (dwa równoczesne pierwsze logowania tej samej nazwy) ponawia raz — za drugim razem
gracz jest już „powracający”.

**`MeController`** (`:19`) — `GET /api/me` z `@CurrentPlayer Long playerId`; bez sesji `401 NOT_LOGGED_IN` (front
pokazuje wtedy „Zaloguj”).

**`LoginRequest`** (`:13`) — `@Size(max = 200)` jako bezpiecznik; właściwe reguły w `NickPolicy`, żeby kod błędu był
`NICK_INVALID`/`NICK_FORBIDDEN`, a nie ogólny `VALIDATION_FAILED`. **`LoginResponse`** (`:11`) — `player`,
`newPlayer`, `welcomeBonus` (front na `newPlayer` odpala sekwencję bonusu E07).

Testy warstwy web: `AuthControllerTest` (`@WebMvcTest`: logowanie, zły JSON, brak sesji, 404/405, brak wycieku
stack trace, zapis `BigDecimal` bez `.00`).

---

## 2. Backend: moduł `wallet` (portfel)

### 2.1. `wallet.entity`

**`Wallet`** (`wallet/entity/Wallet.java:38`) — encja z regułami (tabela `wallet`, `@OneToOne(LAZY)` do `UserAccount`).
* `credit(type, …)` (`:78`) — tylko `WIN` i `WELCOME_BONUS`; `debitBet` (`:91`) — **najpierw** sprawdza saldo
  (`InsufficientFundsException`), dopiero potem odejmuje; zwraca wpis `WalletTransaction` z kwotą ujemną.
* `isBankrupt(minBet)` (`:104`), `rescueCooldownLeft` (`:109`), `canRescue` (`:118`), `rescue` (`:127`) — bonus ratunkowy
  tylko „bankrutowi” i po upływie odliczania (`lastRescueAt` + 10 min, bez zadania cyklicznego).
* `@Version` (`:52`) — blokada optymistyczna jako drugi bezpiecznik obok blokady pesymistycznej.
* Testy: `WalletTest` (czysty JUnit, bez Springa: ujemne saldo niemożliwe, cała kwota naraz, odliczanie, zaokrąglenie
  sekund w górę).

**`WalletTransaction`** (`:32`) — wpis „księgi” bez setterów, tworzony tylko przez `Wallet` (konstruktor pakietowy
`:68`): `type`, `amount` (ze znakiem), `balanceAfter`, `gameCode`, `spinRoundId` (zwykła liczba, nie relacja — portfel
nie zna modułu `slots`). Indeks `(wallet_id, created_at)` (`:31`).

**`WalletRepository`** (`:19`) — trzy rodzaje zapytań: pochodne (`findByPlayerId`), JPQL z projekcją do rekordu
(`findTopBalances`, `:40`, `select new …BalanceLeader` z `join` — bez N+1) i **z blokadą**:
`findByPlayerIdForUpdate` (`:31–33`, `@Lock(PESSIMISTIC_WRITE)` = `SELECT … FOR UPDATE`). Do raportu 4:
`countByBalanceLessThan`, `sumBalances`.

**`WalletTransactionRepository`** (`:15`) — `findPlayerHistory` z `Pageable` i osobnym `countQuery` (`:21`),
`sumAmountByType` (raport 4).

**`TransactionType`** (`:7`) — `WELCOME_BONUS`, `RESCUE_BONUS`, `BET`, `WIN` (`STRING`, nie `ORDINAL`).
**`InsufficientFundsException`** (`:13`, `409`), **`RescueNotAvailableException`** (`:10`, `409`, z
`retryAfterSeconds` przy odliczaniu).

### 2.2. `wallet.application`

**`WalletService`** (`wallet/application/WalletService.java:51`, `@Transactional` na klasie) — implementuje
`WalletFacade` (dla `slots` i `report`) i `PlayerFundsProvider` (dla `account`).
* `onPlayerRegistered` (`:77`, `@EventListener`) → `openWallet` (`:86`): portfel + `WELCOME_BONUS`; drugi raz nic nie robi.
* `lockWallet` (`:100–104`, `Propagation.MANDATORY`) — blokada wiersza; bez trwającej transakcji to błąd w kodzie,
  a nie ciche „nic”.
* `debit` (`:107`), `credit` (`:113`), `rescue` (`:124`) — każde pobiera portfel **z blokadą** i księguje przez
  `book` (`:183`): zapis wpisu + zdarzenie `BalanceChanged`.
* `fundsOf` (`:139`) — dla obiektu `player` (saldo, `minBet` z portu `MinimumBetProvider`, dostępność ratunku).
* `history`, `topBalances`, `economy` — odczyty `readOnly`.
* Testy: `WalletServiceTest` (bonus raz, zakład z blokadą, księga spójna, odliczanie z `MutableClock`, brak portfela).

### 2.3. `wallet.api`

| Typ | Po co |
|---|---|
| `WalletFacade` (`:14`) | kontrakt dla innych modułów: `lockWallet`, `debit`, `credit`, `balance`, `topBalances`, `economy`; Javadoc `lockWallet` (`:17–29`) tłumaczy, dlaczego blokada jest na początku spinu |
| `MinimumBetProvider` (`:11`) | port „jaki jest najmniejszy zakład” — implementuje `slots` (`SlotCatalogService`), bo `slots` zależy od portfela, nie odwrotnie |
| `BalanceChanged` (`:18`) | zdarzenie po każdej zmianie salda (słucha `LobbyBoardsListener` po commicie) |
| `BalanceLeader` (`:14`), `WalletEconomy` (`:14`) | projekcje: ranking sald, pytanie inwestora 4 |

### 2.4. `wallet.web`

**`WalletController`** (`wallet/web/WalletController.java:28`) — `POST /api/me/rescue` (`:40`) i
`GET /api/me/transactions` (`:47`) z walidacją parametrów `@Min`/`@Max` (zła strona → `400 VALIDATION_FAILED` z listą
`errors`). DTO: `RescueResponse` (`:10`), `TransactionResponse` (`:12`, metoda `from` mapuje encję na DTO).
Test: `WalletControllerTest` (`@WebMvcTest`).

---

## 3. Backend: moduł `slots` (automaty)

Największy moduł: katalog gier, spin, silniki, statystyki gracza, zapytania raportowe.

### 3.1. `slots.entity` — encje

**`SlotMachine`** (`slots/entity/SlotMachine.java:31`) — konfiguracja gry (tabela `slot_machine`): `code` (unikalny,
w adresie API), `engineType` (`LINES`/`CLUSTER`), `reels`/`rows`/`lines` (kolumny `reel_count`, `row_count`,
`line_count`, bo `ROWS` to słowo zastrzeżone w SQL), `betLevels` (konwerter), `minBet`/`maxBet`, `targetRtp`,
`volatility`, `features`, `active`, **`reelStrips`, `freeReelStrips`, `paylines`** (kolumny tekstowe z konwerterami),
`symbols` (`@OneToMany(mappedBy)`, LAZY, `@OrderBy`). Metody: `allowsBet` (`:133`), `getFeatureList` (`:138`),
`defineReels` (`:156`, w testach; w aplikacji robi to `data.sql`).

**`SlotSymbol`** (`:27`) — symbol i wypłaty (`slot_symbol`, N:1 z automatem, unikalna para `(slot_machine_id, code)`):
`kind`, `weight`, `pays` (konwerter `Payouts`), `sortOrder`.

**`SpinRound`** (`:49`) — **runda = jeden zakład**, obiekt ze statusem (wymóg koncepcji). Pola: gracz, automat, `bet`,
`totalWin`, `multiplier`, `tier`, `status`, `seed`, `resultJson` (`@Lob`), `idempotencyKey`, `createdAt`, `settledAt`;
unikalna para `(user_id, idempotency_key)` (`:43`) i dwa indeksy.
* `resolve(win, resultJson)` (`:123`) — `STARTED → RESOLVED`, sama liczy `multiplier` i `tier` (spójne z kwotą);
  `settle` (`:138`) — `RESOLVED → SETTLED`; `fail` (`:144`); `moveTo` (`:158`) sprawdza `SpinStatus.canTransitionTo`
  i rzuca `InvalidSpinTransitionException`. Brak `setStatus()` = brak podwójnej wypłaty.
* `matchesRequest` (`:150`) — czy powtórzone żądanie dotyczy tej samej gry i zakładu (inaczej `409`).
* Testy: `SpinRoundTest` (tabela przejść parametryzowana, `cannotSettleTwice`, `cannotSettleWithoutResult`).

**`PlayerMachineStats`** (`:34`) — encja łącząca gracz ↔ automat **z atrybutami** (spiny, obrót, wygrane, rekord,
ostatnia gra) zamiast `@ManyToMany`; unikalna para `(user_id, slot_machine_id)`. `record(bet, win, at)` (`:81`)
dolicza rundę i ewentualny nowy rekord.

### 3.2. `slots.entity` — obiekty wartości, enumy, wyjątki

| Klasa | Po co / ciekawostka |
|---|---|
| `SpinStatus` (`:23`) | `STARTED`, `RESOLVED`, `SETTLED`, `FAILED`; dozwolone przejścia w jednym miejscu: `allowedTargets` (`:39`) |
| `WinTier` (`:13`) | progi 5× / 15× / 30× / 60× / 100× jako stałe (brief); `of(win, bet)` (`:33`) porównuje `win ≥ bet × próg` od najwyższego |
| `BetLevels` (`:24`) + `BetLevelsConverter` | `"10,20,50"` ↔ obiekt; `contains` (`:61`) przez `compareTo` (`100` = `100.00`); Javadoc: dlaczego nie `@ElementCollection` |
| `ReelStrips` (`:29`) + konwerter | taśmy bębnów `"a,b,c|d,e,f"`; Javadoc (`:17–27`): dlaczego kolumna, a nie tabela ~550 wierszy |
| `Paylines` (`:17`) + konwerter | linie `"1,1,1|0,0,0"`; numer linii = indeks + 1 |
| `Payouts` (`:24`) + konwerter | `"3:5,4:20"`; `forExactCount` (linie) i `forCluster` (`:77`, „najwyższy próg ≤ rozmiar”) |
| `RoundSummary` (`:27`) | lekka projekcja rundy do list (bez `result_json`, który w S3 ma dziesiątki KB) |
| `EngineType`, `SymbolKind`, `Volatility` | `LINES`/`CLUSTER`; `NORMAL`/`WILD`/`SCATTER`/`MULTIPLIER`; zmienność |
| `GameNotFoundException` (`404`), `InvalidBetException` (`400`, kwota przez `Money.describe`), `InvalidSpinTransitionException` (`500`, błąd w kodzie) | wyjątki domenowe z kodami `ErrorCode` |

Testy: `SlotValueObjectsTest`, `ReelStripsAndPaylinesTest`.

### 3.3. `slots.entity` — repozytoria

| Repozytorium | Najważniejsze zapytania |
|---|---|
| `SlotMachineRepository` (`:14`) | `findByActiveTrueOrderByIdAsc` (lobby), `findActiveWithSymbols` (`:26`, `left join fetch` — bez N+1 i bez `LazyInitializationException` przy `open-in-view=false`), `findLowestMinBet` |
| `SlotSymbolRepository` (`:10`) | `findBySlotMachineIdOrderBySortOrderAsc` — źródło matematyki dla `GameMathProvider` |
| `SpinRoundRepository` (`:25`) | `findByPlayerAndIdempotencyKey` (`:35`, `join fetch` automatu), `findPlayerHistory` (`:49`, projekcja + `countQuery`), **pytania inwestora 1, 2, 5**: `findPopularity` (`:63`, `left join … on` — gry bez rund też z zerem), `findRtp` (`:73`), `findHourlyActivity` (`:86`, `extract(hour …)`), feed `findBigWins` (`:101`, porównanie `totalWin >= bet × próg` dokładne), `clearIdempotencyKeysCreatedBefore` (`:114–119`, `@Modifying` UPDATE) |
| `PlayerMachineStatsRepository` (`:15`) | statystyki gracza z `join fetch`, **pytanie 3**: `findTopByNetResult` (`:35`), `findTopByBiggestWin` (`:46`, `having`), ranking `findRecordHolders` (`:59`, podzapytanie z maksimum gracza) |

Testy: `InvestorQuestionsRepositoryTest` (`@DataJpaTest` na prawdziwej H2, licznik zapytań Hibernate do testu „brak N+1”).

### 3.4. `slots.application` — serwisy

**`SpinService`** (`slots/application/SpinService.java:58`) — **najważniejsza klasa projektu**. `spin(SpinCommand)`
(`:84–128`, jedna transakcja):
1. gra aktywna (`:86`, `404`), zakład z `betLevels` (`:88`, `400`), silnik istnieje (`:91`, `503`);
2. `wallet.lockWallet(playerId)` (`:95`) — od tej linii spiny gracza są szeregowane;
3. `replayIfRepeated` (`:149`) — ten sam klucz: ta sama runda (`replayed=true`) albo `409 IDEMPOTENCY_CONFLICT`;
4. `seedFor` (`:136`) — `SecureRandom` albo `X-Demo-Seed` (tylko gdy kontroler go przepuścił);
5. zapis `SpinRound` `STARTED` (`:104`), `wallet.debit` (`:107`, `409 INSUFFICIENT_FUNDS` wycofuje wszystko);
6. `engine.play(new SpinContext(machine, bet, seed))` (`:109`) → `round.resolve` z dokumentem `SpinDocument.compose`
   (`:112`) → `wallet.credit` przy wygranej (`:116`) → kontrola salda (`:118`) → `round.settle` (`:122`);
7. `publishEvent(SpinCompleted)` (`:124`) — statystyki w tej transakcji, ranking/feed po commicie.

Testy: `SpinServiceTest` (fałszywy silnik `FakeSlotEngine`: wygrana, brak wygranej, zły zakład, brak gry, brak silnika,
brak środków, powtórka, konflikt klucza, idempotencja sprawdzana pod blokadą), `KasynoFlowIntegrationTest`
(16 równoległych spinów, 8 równoległych duplikatów), `SlotEnginesIntegrationTest`.

**`SpinDocument`** (`:29`) — składa odpowiedź z kontraktu § 2.4 (`compose`, `:43`): nagłówek rundy (`roundId`, `bet`,
`totalWin`, `multiplier`, `tier`, `balanceBefore`, `balanceAfter`, `seed`) + `steps` z silnika. Ten sam tekst trafia
do `spin_round.result_json` i do przeglądarki, więc powtórka jest identyczna co do bajtu. `seedHex` (`:72`) — 16 cyfr
szesnastkowych (64 bity nie mieszczą się w `number` JS). Test: `SpinDocumentTest`.

**`StatsUpdater`** (`:25`) — `onSpinCompleted` (`:38–47`): `@EventListener` + `@Transactional(MANDATORY)` — dolicza
`PlayerMachineStats` w transakcji spinu (błąd wycofuje spin; statystyki nigdy nie rozjadą się z rundami).

**`SlotCatalogService`** (`:21`) — lista gier, `machineWithSymbols` (`:38`), `minimumBet` (`:43`) — implementacja portu
`MinimumBetProvider` portfela.

**`SlotStatisticsService`** (`:31`) — implementacja fasady `SlotsFacade` (raporty, feed, ranking); encje zamienia na
rekordy `api` jeszcze w transakcji; `biggestWinLeaders` (`:82`) usuwa duplikaty gracza z równym rekordem na dwóch grach.

**`PlayerSlotsService`** (`:23`) — historia rund i statystyki zalogowanego gracza (`readOnly`).

**`IdempotencyKeyCleanup`** (`:33`) — `@Scheduled` (`:53`, cron z `kasyno.schedule.idempotency-cleanup-cron`, UTC):
jedno `UPDATE … SET idempotency_key = NULL` dla rund starszych niż 24 h (jak API płatności). Test:
`IdempotencyKeyCleanupTest` (zegar przesunięty o 25 h).

Pozostałe: `SpinCommand` (`:16`, kto/gra/zakład/klucz/`demoSeed`), `SpinResult` (`:24`), `GameNotReadyException`
(`503`), `IdempotencyConflictException` (`409`).

### 3.5. `slots.application.engine` — silniki gier

Szczegółowe wyjaśnienie matematyki: [`03-silnik-gier.md`](03-silnik-gier.md). Tu tylko klasy.

| Klasa | Rola | Najważniejsze |
|---|---|---|
| `SlotEngine` (`:18`) | interfejs silnika: `gameCode()`, `play(SpinContext)` | kontrakt: wynik zależy **tylko** od kontekstu (seed), silnik nic nie zapisuje |
| `ConfiguredSlotEngine` (`:13`) | klasa bazowa (metoda szablonowa) | `play` (`:33–39`): `GameMath` z cache → `playRound(math, bet, RandomSource.fromSeed(seed))` → `SpinOutcome` |
| `LinesEngine` (`:27`) | S1 i S2 | `playRound` (`:40`), `playFreeSpins` (`:74`), `spinReels` (`:110`), `evaluate` (`:129`), `evaluateLine` (`:155`, najwyższa kombinacja, WILD), `isFullScreen` (`:225`, NEON JACKPOT), `expandWilds` (`:242`) |
| `ClusterEngine` (`:26`) | S3 | `playRound` (`:50`), `playFreeSpins` (`:71`, kule mnożników), `cascadeSequence` (`:119`), `findClusters` (`:140`, BFS po sąsiadach bokami), `cascade` (`:192`, pęknięcie + opad + dolosowanie) |
| `LinesRules` (`:20`), `ClusterRules` (`:17`), `FreeSpinsRules` (`:16`) | reguły funkcji (nie dane) | walidacja w konstruktorach rekordów |
| `SlotEnginesConfig` (`:22`) | 3 beany silników + stałe reguł | S1 `:32`, S2 `:39`, S3 `:46` (rozkład kul `:49–59`) |
| `SlotEngineRegistry` (`:21`) | kod gry → silnik | `ObjectProvider<SlotEngine>`; dwa silniki z tym samym kodem zatrzymują start (zasada otwarte–zamknięte) |
| `GameMath` (`:30`) | konfiguracja z bazy skompilowana do tablic | wypłaty w **setnych** na `long` (`toHundredths`, `:128`), walidacja danych, `drawSymbol` (`:192`, sumy narastające wag) |
| `GameMathProvider` (`:22`) | cache `ConcurrentHashMap.computeIfAbsent` (`:32`) | konfiguracja czytana raz na grę |
| `RandomSource` (`:17`), `SplittableRandomSource` (`:16`) | losowość rundy przez interfejs | `SplittableRandom(seed)` — szybki, deterministyczny |
| `SeedGenerator` (`:10`), `SecureSeedGenerator` (`:12`) | ziarno rundy | `SecureRandom.nextLong()` — nieprzewidywalne |
| `RoundBuilder` (`:15`) | suma wygranej + limit max win | `addWin` (`:40`), `stopAtMaxWin` (`:55`) |
| `RoundStep` (`:30`), `WinItem` (`:22`) | kroki animacji i wygrane (sealed interface + rekordy) | Jackson dopisuje `"type"` / `"kind"` |
| `RoundJson` (`:18`) | kroki → `{"steps":[…]}` | własny `ObjectMapper` (silnik działa tak samo w teście bez Springa) |
| `RoundResult` (`:19`) | wynik rundy + liczniki dla testów Monte Carlo | `baseWin()` |
| `SpinContext` (`:14`), `SpinOutcome` (`:11`) | wejście/wyjście silnika | walidacja: wygrana ≥ 0, JSON niepusty |
| `Grids` (`:10`) | operacje na siatce | `scatterAnticipation` (`:47`) |

Testy: `LinesEngineTest`, `ClusterEngineTest`, `GameMathTest`, `SlotEngineRegistryTest`, `SlotMathDataTest`
(spójność `data.sql`), `SlotMathMonteCarloTest` (RTP). Pomocnicze: `EngineFixtures`, `FakeSlotEngine`.

### 3.6. `slots.api`

`SlotsFacade` (`:11`) — kontrakt dla `report`: `minimumBet`, `popularGames`, `rtpByGame`, `topPlayersBy…`,
`peakHours`, `recentBigWins`, `biggestWinLeaders`. Rekordy-projekcje: `GamePopularity`, `GameRtp` (z `actualRtp()`,
`:30`), `PlayerResult`, `HourlyActivity`, `BigWin`, `BiggestWinLeader`. Zdarzenie **`SpinCompleted`** (`:23`).

### 3.7. `slots.web`

**`SlotController`** (`slots/web/SlotController.java:44`) — `GET /api/slots` (`:66`), `GET /api/slots/{code}` (`:72`),
`POST /api/slots/{code}/spins` (`:84–106`): klucz `Idempotency-Key` (`@Size(max=64)`), `X-Demo-Seed` brany pod uwagę
**tylko** przy `kasyno.demo.allow-seed=true` (`:96`; w innych profilach nawet nie sprawdzamy formatu),
odpowiedź = `result.resultJson()` + nagłówek `Idempotent-Replayed: true` przy powtórce. `parseDemoSeed` (`:114`).

**`PlayerSlotsController`** (`:24`) — `GET /api/me/history` (stronicowanie z limitami) i `GET /api/me/stats`.

DTO: `SpinRequest` (`:22`, `@NotNull @Positive @Digits(12,2)` — `@Digits` odrzuca `1e999999999`, który przy budowie
komunikatu zjadłby pamięć), `SpinResponse` (`:29`, tylko do opisu w Swagger UI), `SlotSummaryResponse`,
`SlotDetailsResponse` (`paylines` pomijane w S3), `SymbolResponse`, `HistoryItemResponse`, `MachineStatsResponse`.
Testy: `SlotControllerTest` (16 testów: walidacja, kody błędów, `409 CONCURRENT_REQUEST` zamiast 500, nagłówki).

---

## 4. Backend: moduł `report` (raporty, ranking, feed)

Moduł bez własnych tabel: czyta tylko przez fasady `SlotsFacade` i `WalletFacade` (reguła `reportUsesApisOnly`).

| Klasa | Po co | Najważniejsze |
|---|---|---|
| `InvestorReportService` (`report/application/InvestorReportService.java:34`) | 5 pytań inwestora | `@Transactional(readOnly=true)` na klasie: kilka zapytań w jednej transakcji |
| `LeaderboardService` (`:28`) | ranking i feed do lobby | **celowo bez `@Transactional`** — przy trafieniu w cache nie bierze połączenia z bazy; `leaderboard` (`:44`), `recentBigWins` (`:56`) |
| `LobbyBoardsCache` (`:41`) | pamięć podręczna 3 tablic | `get` (`:80–97`) z licznikiem pokoleń, `invalidate` (`:100`), TTL `kasyno.lobby.cache-ttl` (30 s, pas bezpieczeństwa) |
| `LobbyBoardsListener` (`:43`) | reakcja na zdarzenia **po commicie** | `onSpinCompleted` (`:59`, unieważnia ranking, feed i loguje `big_win` przy ≥ 15×), `onBalanceChanged` (`:75`) |
| `EconomySnapshotJob` (`:35`) | `@Scheduled` co godzinę (demo: co minutę) | `logSnapshot` (`:57`), `takeSnapshot` (`:67`); Javadoc wyjaśnia, czemu `@Transactional` na obu metodach (wywołanie wewnętrzne omija proxy) |
| `EconomySnapshot` (`:18`) | wynik migawki | `toLogLine()` — format `klucz=wartość` (logfmt) |
| `LeaderboardType`, `LeaderboardRow`, `TopPlayersReport` | typ rankingu z `?type=`, wiersz, raport 3 | — |
| `ReportController` (`report/web/ReportController.java:26`) | `GET /api/reports/{popular-games, rtp, top-players, economy, peak-hours}` | publiczne (dane zbiorcze, świadome uproszczenie) |
| `LeaderboardController` (`:27`) | `GET /api/leaderboard`, `GET /api/feed/big-wins` | `rank` = kolejność wierszy; `avatarIndex` z `PlayerAvatar` |
| DTO `*Response` | `RtpResponse`, `EconomyResponse`, `PeakHourResponse`, `PopularGameResponse`, `TopPlayersResponse`, `BigWinResponse`, `LeaderboardEntryResponse` | mapowanie rekordów `api` na kształt kontraktu |

Testy: `LobbyBoardsCacheTest`, `LobbyBoardsListenerTest`, `EconomySnapshotJobTest`, `InvestorQuestionsRepositoryTest`.

---

## 5. Backend: moduł `shared`

### 5.1. `shared.config`

| Klasa | Po co |
|---|---|
| `CasinoProperties` (`:45`) | rekord `@ConfigurationProperties("kasyno")` + `@Validated`: bonusy, odliczanie, próg feedu, nazwa gracza, cache, harmonogram, demo, dane startowe; wartości domyślne `@DefaultValue`; błędna wartość zatrzymuje start |
| `SchedulingConfig` (`:39`) | `@EnableScheduling` warunkowo (`kasyno.schedule.enabled`); w testach wyłączone; Javadoc: czego świadomie nie ma (reset ratunku, sprzątanie sesji) |
| `StarterDataLoader` (`:37`) | `ApplicationRunner`: w `prod` wczytuje `data.sql` tylko na pustej bazie (`loadIfEmpty`, `:62`) — bez duplikatów po restarcie |
| `TimeConfig` (`:17`) | bean `Clock.systemUTC()` |
| `WebConfig` (`:23`) | rejestracja `@CurrentPlayer`; cache `/assets/**` na dobę, `manifest.json` zawsze `no-cache` (`:39–47`) |
| `OpenApiConfig` (`:19`) | opis API w Swagger UI; ukrywa parametry `@CurrentPlayer` (przychodzą z sesji) |

### 5.2. `shared.error`, `shared.domain`, `shared.web`

| Klasa | Po co |
|---|---|
| `ErrorCode` (`:17`) | stałe kody błędów: 10 z kontraktu 09 § 1 + `GAME_NOT_READY`, `NOT_FOUND`, `METHOD_NOT_ALLOWED`, `CONCURRENT_REQUEST`; status HTTP przypisany w jednym miejscu |
| `CasinoException` (`:12`) | baza wyjątków biznesowych (`RuntimeException` → `@Transactional` wycofuje) |
| `GlobalExceptionHandler` (`:47`) | `@RestControllerAdvice` → `ProblemDetail`: `handleCasino` (`:61`), `handleConcurrency` (`:88`, blokada/`@Version` → `409` + `Retry-After`), `handleUnexpected` (`:100`, 500 bez szczegółów), walidacja → `errors[]`, polskie opisy błędów Spring MVC |
| `NotLoggedInException` (`:8`) | `401 NOT_LOGGED_IN` |
| `Money` (`:14`) | `normalize` (skala 2, `HALF_UP`), `describe` (bezpieczny opis absurdalnych kwot) |
| `PlayerSession` (`:16`) | `start` (nowa sesja), `playerId`, `end` |
| `CurrentPlayer` (`:21`) + `CurrentPlayerArgumentResolver` (`:20`) | adnotacja parametru + resolver z sesji (brak → `401` przed wejściem do metody) |
| `PageResponse` (`:17`) | stabilny kształt strony wyników (`items`, `page`, `size`, `totalItems`, `totalPages`), limity `MAX_SIZE=100`, `MAX_PAGE=100 000` |
| `BigDecimalJsonSerializer` (`:21`) | `10000.00` → `10000` w JSON (kontrakt: kwoty całkowite) |
| `SecurityHeadersFilter` (`:32`) | `nosniff`, `X-Frame-Options: SAMEORIGIN`, `Referrer-Policy` — filtr zamiast Spring Security |

### 5.3. Zasoby

* `application.properties` — wspólne (jak szablon) + sekcja `kasyno.*`, sesja (`HttpOnly`, `SameSite=Lax`, 7 dni),
  gzip, `server.error.include-stacktrace=never`, springdoc. `application-dev` (prawie pusty, celowo),
  `-demo` (H2 w pamięci, `X-Demo-Seed`, ratunek co minutę), `-prod` (`ddl-auto=update`, `StarterDataLoader`, `Secure`
  cookie, `graceful`). Tabela profili: [`00-uruchomienie.md`](00-uruchomienie.md) § 3.
* `data.sql` — 4 konta z szablonu + 3 konta zespołu (R1.03), 3 automaty, symbole z wagami i wypłatami, taśmy bębnów
  i linie (`update slot_machine set reel_strips = …`).

### 5.4. Testy — kto czego pilnuje

| Rodzaj | Klasy |
|---|---|
| architektura (ArchUnit) | `ArchitectureTest` (12 reguł) |
| encje i obiekty wartości (czysty JUnit) | `WalletTest`, `SpinRoundTest`, `SlotValueObjectsTest`, `ReelStripsAndPaylinesTest`, `MoneyTest` |
| serwisy (Mockito / kontekst) | `LoginServiceTest`, `NickPolicyTest`, `WalletServiceTest`, `SpinServiceTest`, `SpinDocumentTest` |
| silniki i matematyka | `LinesEngineTest`, `ClusterEngineTest`, `GameMathTest`, `SlotEngineRegistryTest`, `SlotMathDataTest`, `SlotMathMonteCarloTest` |
| zapytania (`@DataJpaTest`) | `InvestorQuestionsRepositoryTest` |
| web (`@WebMvcTest` + MockMvc) | `AuthControllerTest`, `WalletControllerTest`, `SlotControllerTest`, `WebConfigTest` |
| integracja (`@SpringBootTest`) | `KasynoFlowIntegrationTest`, `SlotEnginesIntegrationTest`, `DemoSeedAllowedTest`, `DemoSeedIgnoredTest`, `LobbyBoardsListenerTest`, `IdempotencyKeyCleanupTest`, `ProfilesTest`, `ProdProfilePersistenceTest` |
| LAB 06 bez czekania | `EconomySnapshotJobTest`, `LobbyBoardsCacheTest` (`MutableClock`) |
| pomocnicze | `support/TestData`, `support/MutableClock`, `engine/EngineFixtures`, `engine/FakeSlotEngine`; ustawienia `src/test/resources/application-test.properties` (osobna H2 na kontekst, `LOCK_TIMEOUT=10000`, harmonogram wyłączony, statystyki Hibernate) |
| żądania ręczne | `src/test/http/kasyno.http` (IntelliJ HTTP Client) |

---

## 6. Front-end: lobby i moduły wspólne

Front to zwykłe pliki w `src/main/resources/static`, serwowane przez ten sam Spring Boot. Bez bundlera: przeglądarka
ładuje moduły ES (`<script type="module">`). Teksty interfejsu są w HTML (nie w obrazkach).

| Plik | Po co | Najważniejsze |
|---|---|---|
| `index.html` | lobby + wizytówka projektu (R1.04) | `<script type="module" src="js/lobby.js">` (`:25`), zapas `.is-ready` po 2,5 s |
| `js/api.js` | **jedyne** miejsce rozmowy z REST API | `ApiError` (`:16`) z polem `code`; `request` (`:49`: JSON, ciasteczko sesji, limit czasu, ProblemDetail → `ApiError`); `newIdempotencyKey` (`:84`, `crypto.randomUUID()`); obiekt `api` (`:89`); `messageFor` (`:131`, polskie komunikaty do kodów) |
| `js/session.js` | logowanie, wylogowanie, przywrócenie sesji | `restoreSession` (`:38`, `GET /api/me`); w `localStorage` tylko **wskazówka** „logowałem się” (ciasteczko `HttpOnly` jest niewidoczne dla JS) |
| `js/store.js` | stan gracza + zdarzenia `player`/`balance` | `Store extends EventTarget` (`:11`), `isBankrupt` (`:56`) |
| `js/assets.js` | obrazy po ID z `assets/img/manifest.json` | `data-asset="g_logo"` w HTML → `src`/`srcset`; brak ID = grafika zastępcza SVG/CSS |
| `js/format.js` | kwoty, odmiana „cebulion”, czas | własne grupowanie (CLDR nie grupuje 4 cyfr: „1000”, ale „10 000”) |
| `js/validation.js` | walidacja nazwy w przeglądarce (wygoda) | `validateNick` (`:20`); prawdziwa walidacja zawsze w `NickPolicy` |
| `js/fx-lite.js` | cząsteczki Canvas 2D dla lobby (bez PixiJS) | `FxLite` (`:108`): fontanna monet, iskry, pierścień, pył; pula obiektów |
| `js/ui/modal.js` | okna modalne z pułapką fokusu (WCAG) | `openModal` (`:50`), `inert`, Esc, powrót fokusu |
| `js/ui/reward.js` | sekwencja bonusu E07/E10 | `playReward` (`:40`): skrzynia, monety lecą do pigułki salda, „Pomiń” |
| `js/ui/balance.js` | licznik salda z odliczaniem | `BalanceCounter` (`:15`), `prefers-reduced-motion` |
| `js/ui/toast.js`, `avatar.js`, `icons.js` | powiadomienia (`aria-live`), awatar z arkusza albo inicjały, ikony SVG | treść zawsze przez `textContent` (XSS) |
| `js/audio/audio-engine.js` | silnik dźwięku Web Audio (wspólny dla lobby i gry) | szyny `ui`/`sfx`/`music`, ducking, filtr muzyki, `unlock` (`:120`), `play` (`:379`), `playMusic` (`:551`), limit 24 głosów |
| `js/lobby.js` | logika lobby | `init` (`:116`), odpytywanie feedu i rankingu co 45 s tylko w widocznej karcie (`:171–175`), `submitLogin` (`:404`), bankructwo i ratunek (`:468–553`), kafle gier (`:562–706`), `goToGame` (`:789`), feed (`:829`), ranking (`:908`) |
| `css/tokens.css` … `lobby.css`, `gra.css`, `game.css` | wygląd (zmienne kolorów, komponenty, strona gry) | — |
| `fonts/`, `icons/`, `vendor/pixi/` | fonty OFL lokalnie, ikony SVG, PixiJS 8.22.0 lokalnie (`VERSION.txt`, `LICENSE.txt`) | brak CDN |

---

## 7. Front-end: runtime gier (`js/game/**`)

Pełny opis architektury z diagramem: [`../projekt/10-runtime-gier.md`](../projekt/10-runtime-gier.md). Najważniejsza
zasada: **przeglądarka niczego nie losuje i nie liczy wyniku** — dostaje listę kroków i je odgrywa.

| Plik | Po co | Najważniejsze |
|---|---|---|
| `gra.html` + `js/gra.js` | strona gry: sesja, `GET /api/me`, `GET /api/slots/{code}`, ekran ładowania (E20), przycisk „Graj” (gest odblokowuje dźwięk), zasady z tabelą wypłat | `init` (`:73`), `startRuntime` (`:145`), wybór klasy gry (`:155–156`: S1 → `S1Game`, inne → `PlaceholderGame`), panel `?fx=debug` (`:221`) |
| `js/game/controller.js` | panel HTML nad płótnem i stany rundy `ready → spinning → presenting` | `spin` (`:119`): bębny ruszają od razu, równolegle `api.spin` z nowym kluczem (`:128`, `:140`); `#book` (`:162`): saldo z `balanceAfter` księgowane **raz** na rundę; autoplay, turbo, błędy API |
| `js/game/base-game.js` | wspólna podstawa automatu | `load` (`:104`), `startSpin` (`:318`), `play` (`:330`), domyślne handlery kroków `onSpin` (`:370`) … `onFreeSpinsEnd` (`:488`), `presentWins` (`:534`) — prezentacja w „jednostkach” wg progów `tier` |
| `js/game/step-player.js` | odtwarzacz kroków odpowiedzi | `register` (`:42`), `play` (`:56`) — każdy handler `async`, następny krok po `await` |
| `js/game/core/app.js` | aplikacja PixiJS: warstwy L0–L14, pętla, rozdzielczość, utrata kontekstu WebGL | `init` (`:48`), `#tick` (`:122`: najpierw logika, potem render; `deltaMS` przycinane), `applyResolution` (`:219`) |
| `js/game/core/tween.js` | zegar gry, tweeny z puli, `wait`, `SkipToken`, `Timeline` | dwa czasy: zwykły i efektów (hit-stop 80 ms) |
| `js/game/core/quality.js` | poziomy High/Medium/Low + tryb ograniczonego ruchu | `LEVELS` (`:16`), automat: p90 > 20 ms przez 2 s → poziom niżej (`:115–120`), w górę tylko między rundami (`:130–138`) |
| `js/game/core/resources.js` | tekstury po ID i wariancie z manifestu | `loadManifest` (`:28`), `load` (`:87`); brak obrazu = `null` → grafika z kodu |
| `js/game/core/canvas-art.js` | grafika efektów rysowana w Canvas 2D, atlasy cząsteczek, banery BIG/MEGA…, złote cyfry | rysowane raz na ekranie ładowania |
| `js/game/core/random.js`, `pool.js`, `easing.js` | generator **tylko dla wyglądu** (ziarno z `roundId`), pula obiektów, easingi z 04 § 2.12 (+ `hermite`, `punch`) | — |
| `js/game/reels/reelset.js` | silnik bębnów (S1, S2) | `startSpin` (`:169`), `land` (`:206`: dopasowanie prędkości tak, by stop wypadł w zaplanowanej ms), `slam` (`:237`, szybki stop), `abort` (`:261`, błąd sieci — bez wymyślania wyniku), `update` (`:328`) |
| `js/game/reels/paylines.js` | linie wygranych jako `MeshRope` | kształt z `paylines` z `GET /api/slots/{code}` |
| `js/game/fx/flash.js` | błysk ekranu + **strażnik błysków** | `FlashGovernor.request` (`:68`): ≤ 3 błyski w oknie 1 s, ΔL wg WCAG, wchłanianie < 120 ms, rezerwacje dla „błysków-bohaterów”, ograniczony ruch = brak błysków |
| `js/game/fx/particles.js` | cząsteczki (SoA, `Float32Array`, `ParticleContainer`) | limit 600/300/120 wg poziomu |
| `js/game/fx/camera.js` | drżenie „trauma” (siła = T², gładki szum) | `kick` (`:58`) |
| `js/game/fx/effects.js` | promienie, flary, pioruny, połysk (shader), bloom (High) | `warmUpShaders` (`:453`) — kompilacja na ekranie ładowania |
| `js/game/fx/bigwin.js` | sekwencja BIG/MEGA/EPIC/ULTRA (E30–E32) | `play` (`:173`), `skip` (`:157`) |
| `js/game/fx/digits.js` | licznik złotymi cyframi (podmiana tekstur, nie `Text`) | `DigitFont`, `DigitText` |
| `js/game/audio/game-audio.js` | zdarzenia gry → dźwięki (tabela 05 § 6.1 w kodzie) | warstwa napięcia (`mus_napiecie`, filtr 1200 Hz, ducking −4 dB) |

### 7.1. S1 „Cebulowy 777” (`js/game/games/s1.js`, `s1-art.js`)

**`S1Game`** (`s1.js:49`, dziedziczy po `BaseGame`), konfiguracja `S1_CONFIG` (`:33`: 3×3, `LINES`, `wildCode`,
muzyka `mus_s1`, `bgLuma` dla strażnika błysków, `fillerWeights` — wizualna taśma; wynik i tak przychodzi z serwera).
Własne: scena (tło, ramka z oknem z `manifest.frames`, logo, neony, żarówki), układ „logo z boku” / „logo nad
automatem”, `onReelStop` (`:704`, E26/E33), `onAnticipation` (`:804`, E27), `onLinePresented` (`:932`, E50 — linia
z `wildMultiplier: 2`), `onFeature` (`:1069`, E51 NEON JACKPOT). `s1-art.js` rysuje w Canvas 2D symbole, tło, ramkę
i logo, gdy w manifeście brak obrazów `s1_*` (dziś obrazy z ChatGPT są, więc to zapas).
Test: `tools/e2e/gra-s1.mjs` (35/35 na atrapie API, opis: [`../projekt/10-runtime-gier.md`](../projekt/10-runtime-gier.md) § 11).

### 7.2. S2 „Złoty Faraon” — w przygotowaniu (uzupełnimy po scaleniu)

Gra powstaje w osobnej kopii roboczej (`js/game/games/s2*`). Do czasu scalenia S2 działa na `PlaceholderGame`
(`js/game/games/zastepcza.js`): ten sam runtime i domyślne handlery `BaseGame` (`expandWild`, `freeSpins*`), prosta
scena. Po scaleniu dopiszemy tu: klasę gry, konfigurację, handlery E35/E60 i test e2e.

### 7.3. S3 „Kryształowa Kaskada” — w przygotowaniu (uzupełnimy po scaleniu)

Jak S2: dziś `PlaceholderGame` (krótki „obrót” kolumn, domyślne `cascade` i `applyMultiplier`), docelowo
`js/game/games/s3*` z kaskadami (E70–E71) i kulami mnożników (E73).

---

## 8. Narzędzia poza aplikacją (`tools/`)

| Katalog | Co | Dokument |
|---|---|---|
| `tools/art/` | pipeline grafiki `przetworz.py` (PNG → WebP @1x/@2x + `manifest.json`), lista assetów `katalog.py`, grafika zastępcza (Blender + Pillow), 27 testów | [`../projekt/02-lista-obrazow.md`](../projekt/02-lista-obrazow.md), `tools/art/README.md` |
| `tools/audio/` | synteza dźwięku NumPy → WAV → Opus/AAC + manifest, kontrole `sprawdz.py` | [`../projekt/05-dzwiek-i-muzyka.md`](../projekt/05-dzwiek-i-muzyka.md), `tools/audio/README.md` |
| `tools/dev/` | atrapa API (`mock-api.mjs`, `mock-spins.mjs` z wymuszaniem wyników) | `10-runtime-gier.md` § 9 |
| `tools/e2e/` | testy w Chromium: `smoke.mjs`, `backend-flow.mjs`, `gra-s1.mjs` | [`00-uruchomienie.md`](00-uruchomienie.md) § 6.2 |
| `tools/vendor.mjs` | kopiuje PixiJS i fonty z npm do `static/` | — |

Narzędzia to „kompilatory” zasobów: aplikacja Spring Boot ich nie uruchamia, tylko serwuje gotowe pliki.

---

## 9. Trasa jednego spinu przez kod (do opowiedzenia na obronie)

1. Gracz klika SPIN → `js/game/controller.js:119` `spin()`: sprawdza saldo, generuje `Idempotency-Key`
   (`:128`), od razu rusza bębny (`game.startSpin`, `:136`) i wysyła `api.spin` (`:140` → `js/api.js:99`).
2. Spring MVC: `SecurityHeadersFilter` dopisuje nagłówki, `CurrentPlayerArgumentResolver.resolveArgument`
   (`shared/web/CurrentPlayerArgumentResolver.java:29`) bierze `playerId` z sesji (brak → `401`).
3. `SlotController.spin` (`slots/web/SlotController.java:85`): walidacja `SpinRequest`, klucz, `X-Demo-Seed` tylko w `demo`.
4. `SpinService.spin` (`slots/application/SpinService.java:85`), jedna transakcja: walidacje → `lockWallet` (`:95`,
   `SELECT … FOR UPDATE` w `WalletRepository.java:31`) → powtórka? (`:96`) → `SpinRound STARTED` (`:104`) →
   `debit` (`:107` → `Wallet.debitBet`, `Wallet.java:91`).
5. Silnik: `ConfiguredSlotEngine.play` (`engine/ConfiguredSlotEngine.java:34`) → `GameMathProvider.mathFor` (cache)
   → `LinesEngine.playRound` (`:40`) albo `ClusterEngine.playRound` (`:50`) z `SplittableRandomSource(seed)` →
   kroki → `RoundJson.stepsDocument`.
6. `SpinDocument.compose` (`SpinService.java:112`) → `round.resolve` → `credit` (`:116`) → kontrola salda (`:118`)
   → `round.settle` (`:122`) → `SpinCompleted` (`:124`): `StatsUpdater` w tej transakcji; commit.
7. Po commicie: `LobbyBoardsListener.onSpinCompleted`/`onBalanceChanged` unieważniają cache rankingu i feedu.
8. Odpowiedź (`resultJson`, ewentualnie `Idempotent-Replayed: true`) → `controller.js` → `BaseGame.play`
   (`base-game.js:330`) → `StepPlayer.play` (`step-player.js:56`) → `onSpin`: `ReelSet.land(grid)` (`reelset.js:206`)
   → `onWin` / Big Win → `#book` (`controller.js:162`): saldo = `balanceAfter`.

## Powiązane dokumenty

[`00-uruchomienie.md`](00-uruchomienie.md) · [`01-architektura.md`](01-architektura.md) ·
[`03-silnik-gier.md`](03-silnik-gier.md) · [`05-decyzje-projektowe.md`](05-decyzje-projektowe.md) ·
[`06-pytania-na-obrone.md`](06-pytania-na-obrone.md) · [`07-podzial-pracy.md`](07-podzial-pracy.md) ·
[`../projekt/07-gry-i-matematyka.md`](../projekt/07-gry-i-matematyka.md) ·
[`../projekt/09-kontrakt-api-i-assetow.md`](../projekt/09-kontrakt-api-i-assetow.md) ·
[`../projekt/10-runtime-gier.md`](../projekt/10-runtime-gier.md)
