# 01. Architektura: warstwy, moduły, baza danych, przebiegi, zdarzenia

Opis budowy aplikacji Cebulion Casino zgodny z kodem w `src/main/java/pl/wsb/kasyno` (stan po LAB 06). Każdy diagram
ma pod spodem krótkie „dlaczego tak”, bo o to pytają na obronie. Nazwy klas, tabel i kolumn są dokładnie takie jak
w kodzie, więc z diagramu można od razu przejść do pliku (IntelliJ: `Ctrl+N` / `Cmd+O`, nazwa klasy).

## 1. Warstwy

```mermaid
flowchart TB
  B["Przeglądarka<br/>lobby (index.html, js/lobby.js)<br/>gra (gra.html, js/gra.js, PixiJS)"]
  subgraph APP["Spring Boot (jeden proces, port 8080)"]
    W["web<br/>@RestController, *Request / *Response (rekordy)<br/>GlobalExceptionHandler → ProblemDetail"]
    A["application<br/>serwisy (@Service, @Transactional), słuchacze zdarzeń,<br/>zadania @Scheduled, silniki gier (engine)"]
    D["entity (LAB 02, R2.02)<br/>encje JPA, @Embeddable, enumy, repozytoria Spring Data, wyjątki domenowe<br/>(gotowe konto UserAccount z szablonu: account.domain)"]
    API["api (w każdym module)<br/>fasady, rekordy, zdarzenia: publiczny kontrakt modułu"]
    S["shared<br/>config (CasinoProperties, profile, harmonogram, dane startowe),<br/>error (ErrorCode, CasinoException), web (sesja, nagłówki), domain (Money)"]
  end
  DB[("H2: plik / pamięć<br/>albo PostgreSQL (prod)")]
  B -- "JSON przez HTTP, ciasteczko sesji" --> W
  B -- "pliki statyczne /static" --> APP
  W --> A
  A --> D
  A -. "inne moduły tylko przez" .-> API
  D --> DB
  W & A & D -.-> S
```

| Warstwa | Pakiet | Zasada (pilnuje `ArchitectureTest`, ArchUnit) |
|---|---|---|
| web | `<moduł>.web` | kontrolery nie używają repozytoriów i nie zwracają encji, tylko DTO |
| application | `<moduł>.application` | nie zna HTTP (nie zależy od `web`); tu są transakcje |
| entity | `<moduł>.entity` (konto z szablonu: `account.domain`) | nie zależy od `application` ani `web`; encje pilnują własnych reguł (np. `Wallet`, `SpinRound`) |
| api | `<moduł>.api` | nie odsłania encji (`entity`, `domain`); tylko interfejsy, rekordy i zdarzenia |
| shared | `shared.*` | nie zależy od żadnego modułu |

**Dlaczego serwer rozstrzyga o wyniku.** Przeglądarka nie losuje i nie liczy wygranych: dostaje gotową rundę jako
listę kroków (`steps`) i tylko ją animuje. Wyniku nie da się podmienić w konsoli przeglądarki, a każda runda ma
zapisany `seed`, więc można ją odtworzyć (audyt, testy, nagrania).

## 2. Moduły i zależności

```mermaid
flowchart LR
  subgraph account["account"]
    AC["LoginService, NickPolicy,<br/>PlayerProfileService<br/>UserAccount"]
  end
  subgraph wallet["wallet"]
    WA["WalletService<br/>Wallet, WalletTransaction"]
  end
  subgraph slots["slots"]
    SL["SpinService, StatsUpdater,<br/>SlotCatalogService, SlotStatisticsService,<br/>IdempotencyKeyCleanup, silniki gier<br/>SlotMachine, SlotSymbol, SpinRound,<br/>PlayerMachineStats"]
  end
  subgraph report["report (bez własnych tabel)"]
    RE["InvestorReportService, LeaderboardService,<br/>LobbyBoardsCache, LobbyBoardsListener,<br/>EconomySnapshotJob"]
  end
  SH["shared"]

  wallet -- "relacja Wallet → UserAccount" --> account
  slots -- "WalletFacade (zakład, wygrana, blokada)" --> wallet
  slots -- "relacje do UserAccount" --> account
  report -- "SlotsFacade" --> slots
  report -- "WalletFacade" --> wallet
  account -. "port PlayerFundsProvider<br/>(implementuje WalletService)" .-> wallet
  wallet -. "port MinimumBetProvider<br/>(implementuje SlotCatalogService)" .-> slots
  account -. "zdarzenie PlayerRegistered" .-> wallet
  slots -. "zdarzenie SpinCompleted" .-> report
  wallet -. "zdarzenie BalanceChanged" .-> report
  account & wallet & slots & report --> SH
```

Linia ciągła = zależność w kodzie (import). Linia przerywana = odwrócona zależność: moduł „niżej” definiuje
interfejs (port) albo publikuje zdarzenie, a moduł „wyżej” je implementuje lub słucha. Dzięki temu nie ma cykli
(`account ← wallet ← slots ← report`), co sprawdza test „brak cykli zależności między modułami”.

| Mechanizm | Przykład | Dlaczego |
|---|---|---|
| fasada w `api` | `WalletFacade`, `SlotsFacade` | moduł widzi tylko kontrakt, nie encje i repozytoria innego modułu |
| port (Dependency Inversion) | `PlayerFundsProvider` w `account`, implementacja w `wallet` | obiekt `player` potrzebuje salda, a `account` nie może zależeć od `wallet` (cykl) |
| zdarzenie | `PlayerRegistered` → portfel z bonusem | konto nie wie, że istnieje portfel; portfel sam reaguje (w tej samej transakcji) |
| identyfikator zamiast relacji | `wallet_transaction.spin_round_id`, `game_code` | portfel nie zna modułu `slots` (brak `@ManyToOne SpinRound`) |

## 3. Baza danych (ERD)

Tabele tworzy Hibernate z encji (`ddl-auto`), dane startowe są w `src/main/resources/data.sql`. Kwoty to
`decimal(19,2)` (`BigDecimal` w Javie), daty to `Instant` (UTC), enumy zapisujemy jako tekst (`EnumType.STRING`).

```mermaid
erDiagram
  USER_ACCOUNT ||--o| WALLET : "ma portfel (1:1)"
  WALLET ||--o{ WALLET_TRANSACTION : "księguje"
  USER_ACCOUNT ||--o{ SPIN_ROUND : "gra"
  SLOT_MACHINE ||--o{ SPIN_ROUND : "rozgrywa"
  SLOT_MACHINE ||--o{ SLOT_SYMBOL : "ma symbole"
  USER_ACCOUNT ||--o{ PLAYER_MACHINE_STATS : "ma statystyki"
  SLOT_MACHINE ||--o{ PLAYER_MACHINE_STATS : "dotyczy"
  SPIN_ROUND |o..o{ WALLET_TRANSACTION : "spin_round_id (bez klucza obcego)"

  USER_ACCOUNT {
    bigint id PK
    varchar email UK "120, gracz: nick@kasyno.local"
    varchar display_name "60, nazwa gracza"
    varchar role "20: USER, PARTNER, ADMIN"
    timestamp created_at "czas lokalny (tabela z szablonu)"
  }
  WALLET {
    bigint id PK
    bigint user_id FK, UK "1:1 z user_account"
    decimal balance "19,2, nigdy ujemne"
    bigint version "blokada optymistyczna @Version"
    timestamp updated_at
    timestamp last_rescue_at "ostatni bonus ratunkowy, null = nigdy"
  }
  WALLET_TRANSACTION {
    bigint id PK
    bigint wallet_id FK
    varchar type "20: WELCOME_BONUS, RESCUE_BONUS, BET, WIN"
    decimal amount "19,2, ujemna dla BET"
    decimal balance_after "19,2, saldo po operacji"
    varchar game_code "40, null dla bonusów"
    bigint spin_round_id "null dla bonusów"
    timestamp created_at "indeks (wallet_id, created_at)"
  }
  SLOT_MACHINE {
    bigint id PK
    varchar code UK "40, np. cebulowy-777"
    varchar name "60"
    varchar engine_type "20: LINES, CLUSTER"
    int reel_count
    int row_count
    int line_count "null dla CLUSTER"
    varchar bet_levels "200, np. 10,20,50"
    decimal min_bet "19,2"
    decimal max_bet "19,2"
    decimal target_rtp "5,2, np. 95.00"
    varchar volatility "20"
    varchar features "1000, punkty rozdzielone |"
    boolean active
    varchar reel_strips "4000, taśmy bębnów (LINES)"
    varchar free_reel_strips "4000, taśmy darmowych spinów"
    varchar paylines "1000, linie wygrywające"
  }
  SLOT_SYMBOL {
    bigint id PK
    bigint slot_machine_id FK "UK razem z code"
    varchar code "30, np. siodemka"
    varchar kind "20: NORMAL, WILD, SCATTER, MULTIPLIER"
    int weight "waga losowania"
    varchar pays "200, np. 3:5,4:20,5:100"
    int sort_order
  }
  SPIN_ROUND {
    bigint id PK
    bigint user_id FK "UK razem z idempotency_key"
    bigint slot_machine_id FK
    decimal bet "19,2"
    decimal total_win "19,2"
    decimal multiplier "19,2, total_win / bet"
    varchar tier "10: NONE … ULTRA"
    varchar status "20: STARTED, RESOLVED, SETTLED, FAILED"
    bigint seed "ziarno losowania"
    clob result_json "cała odpowiedź spinu (kontrakt 2.4)"
    varchar idempotency_key "64, czyszczony po 24 h"
    timestamp created_at "indeksy (user_id, created_at), (created_at)"
    timestamp settled_at
  }
  PLAYER_MACHINE_STATS {
    bigint id PK
    bigint user_id FK "UK razem ze slot_machine_id"
    bigint slot_machine_id FK
    bigint spins
    decimal total_wagered "19,2"
    decimal total_won "19,2"
    decimal biggest_win "19,2, rekord gracza na automacie"
    timestamp biggest_win_at
    timestamp last_played_at
  }
```

| Tabela | Encja | Rola |
|---|---|---|
| `user_account` | `account.domain.UserAccount` | konto z szablonu kursu; gracz = konto z rolą `USER` i technicznym e-mailem |
| `wallet` | `wallet.entity.Wallet` | saldo; zmienia się tylko metodami encji (`credit`, `debitBet`, `rescue`) |
| `wallet_transaction` | `wallet.entity.WalletTransaction` | „księga” bez edycji i usuwania: suma `amount` = saldo |
| `slot_machine` | `slots.entity.SlotMachine` | konfiguracja gry (taśmy, linie, zakłady); dane z `data.sql` |
| `slot_symbol` | `slots.entity.SlotSymbol` | symbole i wypłaty (1:N z automatem) |
| `spin_round` | `slots.entity.SpinRound` | runda = jeden zakład; obiekt ze statusem (§ 6) |
| `player_machine_stats` | `slots.entity.PlayerMachineStats` | relacja M:N gracz ↔ automat z atrybutami (spiny, obrót, rekord) |

**Dlaczego `player_machine_stats` to encja, a nie `@ManyToMany`:** `@ManyToMany` umie zapisać tylko „parę”, a nam
potrzebne są liczby przy parze (spiny, obrót, rekord). Unikalna para `(user_id, slot_machine_id)` pilnuje, że dla
gracza i automatu jest jeden wiersz.

**Dlaczego `result_json` w rundzie:** to dokładnie ta odpowiedź, którą dostał gracz. Powtórzone żądanie z tym samym
`Idempotency-Key` zwraca ją bajt w bajt, a w razie sporu widać, co pokazała przeglądarka.

## 4. Logowanie nazwą gracza

```mermaid
sequenceDiagram
  autonumber
  participant B as Przeglądarka (lobby.js)
  participant C as AuthController
  participant L as LoginService
  participant N as NickPolicy
  participant R as UserAccountRepository
  participant W as WalletService
  participant P as PlayerProfileService
  participant LB as LobbyBoardsListener

  B->>C: POST /api/auth/login {"nick":"Kamil_77"}
  C->>L: login("Kamil_77")
  Note over L,W: jedna transakcja (@Transactional)
  L->>N: validate(nick)
  N-->>L: nazwa po obcięciu spacji albo 400 NICK_INVALID / NICK_FORBIDDEN
  L->>R: findByEmail("kamil_77@kasyno.local")
  alt gracz już istnieje
    R-->>L: UserAccount
    L-->>C: LoginResult(newPlayer=false, welcomeBonus=0)
  else nowy gracz
    L->>R: save(new UserAccount(..., USER))
    L->>W: publishEvent(PlayerRegistered) → @EventListener, ta sama transakcja
    W->>W: new Wallet + credit(WELCOME_BONUS, 10 000)
    W->>W: publishEvent(BalanceChanged)
    L-->>C: LoginResult(newPlayer=true, welcomeBonus=10 000)
  end
  Note over L,W: commit: konto, portfel i bonus zapisują się razem albo wcale
  W-->>LB: po commicie BalanceChanged (AFTER_COMMIT) → ranking sald nieaktualny
  C->>C: PlayerSession.start: nowa sesja (ochrona przed session fixation)
  C->>P: view(playerId) → saldo, minBet, canRescue (port PlayerFundsProvider)
  C-->>B: 200 {player, newPlayer, welcomeBonus} + Set-Cookie JSESSIONID (HttpOnly, SameSite=Lax)
```

Dwa równoczesne logowania tą samą nową nazwą (podwójne kliknięcie): unikalny `email` w bazie odrzuca drugi zapis,
a `AuthController` ponawia logowanie raz, już jako powracający gracz (test `concurrentFirstLoginsCreateOneAccount`).

## 5. Spin (jedna runda = jeden zakład)

```mermaid
sequenceDiagram
  autonumber
  participant B as Przeglądarka (gra.js)
  participant C as SlotController
  participant S as SpinService
  participant W as WalletFacade (WalletService)
  participant E as SlotEngine (Lines/ClusterEngine)
  participant DB as SpinRoundRepository
  participant ST as StatsUpdater
  participant LB as LobbyBoardsListener

  B->>C: POST /api/slots/{code}/spins {"bet":100}, Idempotency-Key, (X-Demo-Seed)
  C->>C: X-Demo-Seed brany pod uwagę tylko gdy kasyno.demo.allow-seed=true
  C->>S: spin(SpinCommand)
  Note over S,ST: jedna transakcja: wszystko albo nic
  S->>S: gra aktywna (404), zakład z betLevels (400), silnik istnieje (503)
  S->>W: lockWallet(playerId) → SELECT ... FOR UPDATE
  S->>DB: findByPlayerAndIdempotencyKey
  alt ten sam klucz już był
    DB-->>S: istniejąca runda (inny zakład lub gra → 409 IDEMPOTENCY_CONFLICT)
    S-->>C: SpinResult(replayed=true)
    C-->>B: 200, ta sama treść, Idempotent-Replayed: true
  else nowe żądanie
    S->>S: seed = X-Demo-Seed albo SecureRandom
    S->>DB: save(SpinRound STARTED)
    S->>W: debit(bet) → 409 INSUFFICIENT_FUNDS wycofuje wszystko
    S->>E: play(SpinContext(machine, bet, seed))
    E-->>S: SpinOutcome(totalWin, kroki animacji)
    S->>S: round.resolve(...) → RESOLVED, resultJson = SpinDocument (kontrakt 2.4)
    S->>W: credit(totalWin), gdy wygrana > 0
    S->>S: round.settle() → SETTLED
    S->>ST: publishEvent(SpinCompleted) → @EventListener w tej transakcji
    ST->>ST: player_machine_stats: spiny, obrót, wygrana, rekord
    Note over S,ST: commit
    S-->>LB: po commicie SpinCompleted i BalanceChanged (AFTER_COMMIT)
    LB->>LB: unieważnij feed / ranking, log big_win (≥ 15×)
    S-->>C: SpinResult(resultJson)
    C-->>B: 200 {roundId, bet, totalWin, multiplier, tier, balanceBefore, balanceAfter, seed, steps}
  end
```

* **Blokada portfela na początku** (`lockWallet`): spiny jednego gracza wykonują się po kolei. Dwa równoległe spiny
  nie wydadzą tych samych pieniędzy dwa razy (test: 16 równoległych spinów po 1000 przy saldzie 10 000 → dokładnie 10
  przechodzi), a podwójne kliknięcie z tym samym kluczem czeka na pierwsze i dostaje jego rundę.
* **Wszystko w jednej transakcji:** błąd po pobraniu zakładu wycofuje także zakład, więc gracz nie traci cebulionów
  na nieudanym spinie, a w bazie nie zostaje runda „w połowie”.
* **Kaskady i darmowe spiny są w tej samej rundzie:** silnik liczy całą sekwencję od razu, saldo rozliczamy raz.

## 6. Cykl życia rundy (`SpinRound`, `SpinStatus`)

```mermaid
stateDiagram-v2
  [*] --> STARTED: new SpinRound(...) — zakład przyjęty, zaraz debit
  STARTED --> RESOLVED: resolve(win, resultJson) — silnik wylosował wynik
  RESOLVED --> SETTLED: settle(at) — wygrana zaksięgowana
  STARTED --> FAILED: fail(at)
  RESOLVED --> FAILED: fail(at)
  SETTLED --> [*]
  FAILED --> [*]
  note right of SETTLED
    stan końcowy: jedyny, który
    zostaje w bazie w obecnym przebiegu
  end note
  note left of FAILED
    część modelu; błąd w trakcie spinu
    wycofuje całą transakcję, więc
    runda FAILED nie jest zapisywana
  end note
```

Przejścia są zapisane w jednym miejscu (`SpinStatus.canTransitionTo`), a encja nie ma `setStatus()`: niedozwolone
przejście (np. drugie `settle`, czyli podwójna wypłata) kończy się `InvalidSpinTransitionException`
(test `SpinRoundTest`).

## 7. Zdarzenia, konfiguracja i zadania cykliczne (LAB 06)

### 7.1. Zdarzenia

```mermaid
flowchart LR
  LS["LoginService"] -- publishEvent --> PR(["PlayerRegistered"])
  WS["WalletService.book()"] -- publishEvent --> BC(["BalanceChanged"])
  SS["SpinService"] -- publishEvent --> SC(["SpinCompleted"])

  PR -- "@EventListener<br/>w transakcji" --> W1["WalletService.onPlayerRegistered<br/>portfel + WELCOME_BONUS"]
  SC -- "@EventListener<br/>w transakcji (MANDATORY)" --> ST["StatsUpdater<br/>player_machine_stats"]
  SC -- "@TransactionalEventListener<br/>AFTER_COMMIT" --> LL["LobbyBoardsListener<br/>feed + ranking wygranych,<br/>log big_win"]
  BC -- "@TransactionalEventListener<br/>AFTER_COMMIT" --> LL2["LobbyBoardsListener<br/>ranking sald"]
  LL & LL2 --> CA[("LobbyBoardsCache<br/>(pamięć)")]
  CA -- "odczyt" --> LBS["LeaderboardService<br/>GET /api/feed/big-wins,<br/>GET /api/leaderboard"]
```

| Zdarzenie (`api`) | Publikuje | Słuchacz | Kiedy działa | Dlaczego tak |
|---|---|---|---|---|
| `PlayerRegistered` | `LoginService` | `WalletService.onPlayerRegistered` | synchronicznie, w transakcji logowania | konto bez portfela nie może zostać zapisane |
| `SpinCompleted` | `SpinService` | `StatsUpdater.onSpinCompleted` | synchronicznie, w transakcji spinu (`Propagation.MANDATORY`) | statystyki muszą zgadzać się z rundami: błąd wycofuje spin |
| `SpinCompleted` | `SpinService` | `LobbyBoardsListener.onSpinCompleted` | **po zatwierdzeniu** (`AFTER_COMMIT`) | feed i ranking to widok danych: tylko zatwierdzona runda, wycofany spin się nie pojawi |
| `BalanceChanged` | `WalletService` (każda zmiana salda) | `LobbyBoardsListener.onBalanceChanged` | **po zatwierdzeniu** (`AFTER_COMMIT`) | ranking sald odświeżany dopiero, gdy saldo jest trwałe |

**Feed i ranking dalej liczymy zapytaniami** (jedno źródło prawdy: baza). Zdarzenie po commicie tylko mówi pamięci
podręcznej `LobbyBoardsCache`, że wynik jest nieaktualny. Lobby odpytuje feed i ranking co 45 s w każdej karcie, więc
przy braku gry odpowiedź idzie z pamięci, bez połączenia z bazą (`LeaderboardService` celowo nie ma `@Transactional`).

Dlaczego `AFTER_COMMIT`, a nie zwykły `@EventListener` (trzy argumenty na obronę):

1. **Wycofanie:** przy rollbacku słuchacz w ogóle się nie wykonuje, więc wycofany spin nie trafi do feedu ani do logu
   (test `LobbyBoardsListenerTest.rollbackIsIgnored`).
2. **Wyścig z równoległym odczytem:** gdyby unieważnić pamięć przed commitem, równoległe żądanie lobby mogłoby jeszcze
   przeczytać stary stan bazy i zapisać go jako aktualny. `LobbyBoardsCache` ma licznik pokoleń: wynik zapytania
   zapisuje tylko, gdy w trakcie zapytania nikt nie unieważnił tablicy; to jest poprawne tylko przy unieważnieniu
   po commicie (test `invalidationDuringQueryIsNotCached`).
3. **Izolacja błędów:** wyjątek w słuchaczu po commicie nie psuje spinu, który już się zapisał.

Zdarzenie opublikowane poza transakcją `@TransactionalEventListener` pomija (u nas to się nie zdarza: publikują
wyłącznie metody z `@Transactional`). Pas bezpieczeństwa: wpis w pamięci żyje najwyżej `kasyno.lobby.cache-ttl`
(30 s), na wypadek zmiany danych z pominięciem aplikacji (np. konsola H2).

### 7.2. Konfiguracja: `CasinoProperties` (rekord `@ConfigurationProperties(prefix = "kasyno")`)

| Klucz | Domyślnie | Gdzie używane |
|---|---|---|
| `kasyno.welcome-bonus` | `10000` | `LoginService` → `PlayerRegistered` |
| `kasyno.rescue-amount` | `10000` | `WalletService.rescue` |
| `kasyno.rescue-cooldown` | `10m` (`demo`: `1m`) | `Wallet.rescue`, `fundsOf` (odliczanie w `/api/me`) |
| `kasyno.big-win-multiplier` | `15` | feed dużych wygranych, log `big_win` |
| `kasyno.nick.*` | 3–16 znaków, listy słów | `NickPolicy` |
| `kasyno.lobby.cache-ttl` | `30s` | `LobbyBoardsCache` |
| `kasyno.schedule.enabled` | `true` (testy: `false`) | `SchedulingConfig` (`@EnableScheduling`) |
| `kasyno.schedule.economy-snapshot-cron` | `0 0 * * * *` (`demo`: co minutę) | `EconomySnapshotJob` |
| `kasyno.schedule.idempotency-cleanup-cron` | `0 30 * * * *` | `IdempotencyKeyCleanup` |
| `kasyno.schedule.idempotency-key-ttl` | `24h` | `IdempotencyKeyCleanup` |
| `kasyno.demo.allow-seed` | `false` (`demo`: `true`) | `SlotController` (`X-Demo-Seed`) |
| `kasyno.starter-data.load-when-empty` | `false` (`prod`: `true`) | `StarterDataLoader` |

Rekord jest niemodyfikowalny i ma `@Validated`: błędna wartość (np. ujemny bonus) zatrzymuje start z czytelnym
komunikatem. Progi poziomów wygranych (5×/15×/30×/60×/100×) są stałymi w `WinTier`, bo ustala je brief i zależy od
nich oprawa w przeglądarce. Profile `dev` / `demo` / `prod`: [`00-uruchomienie.md`](00-uruchomienie.md) § 3.

### 7.3. Zadania cykliczne (`@Scheduled`)

| Zadanie | Harmonogram (UTC) | Co robi | Test bez czekania |
|---|---|---|---|
| `report.application.EconomySnapshotJob.logSnapshot` | co godzinę (`0 0 * * * *`) | linia logu `economy_snapshot players=… bankrupt=… coins_in_circulation=… spins_last_hour=…` (bez nowej tabeli) | `EconomySnapshotJobTest`: zegar `MutableClock`, metoda wołana wprost |
| `slots.application.IdempotencyKeyCleanup.forgetExpiredKeys` | co godzinę, w 30. minucie | `UPDATE spin_round SET idempotency_key = NULL` dla rund starszych niż 24 h (jak w API płatności) | `IdempotencyKeyCleanupTest`: zegar przesunięty o 25 h |

`@EnableScheduling` jest w `shared.config.SchedulingConfig` (wyłączane `kasyno.schedule.enabled=false`), a rejestrację
obu zadań z cronami z konfiguracji sprawdza `ProdProfilePersistenceTest.scheduledTasksRegistered`. Czego świadomie
nie ma: zadania „reset limitu bonusu ratunkowego” (limit wynika z `wallet.last_rescue_at` + 10 min, liczonego przy
każdym żądaniu: dokładny co do sekundy, bez opóźnienia harmonogramu) i „sprzątania sesji” (sesje wygasza Tomcat po
7 dniach, `server.servlet.session.timeout`).

## 8. Błędy, sesja, bezpieczeństwo

| Temat | Rozwiązanie | Klasa |
|---|---|---|
| format błędów | `application/problem+json` (RFC 9457) z polem `code` (`NICK_INVALID`, `INSUFFICIENT_FUNDS`…) | `GlobalExceptionHandler`, `ErrorCode` |
| wyjątki biznesowe | dziedziczą po `CasinoException` (status i kod w `ErrorCode`), serwisy nie znają HTTP | np. `RescueNotAvailableException` |
| 5xx | ogólny komunikat, szczegóły tylko w logu serwera | `GlobalExceptionHandler.handleUnexpected` |
| sesja | serwerowa, ciasteczko `HttpOnly`, `SameSite=Lax`, 7 dni; w `prod` także `Secure` | `PlayerSession`, `@CurrentPlayer` |
| nagłówki | `X-Content-Type-Options`, `X-Frame-Options: SAMEORIGIN`, `Referrer-Policy` | `SecurityHeadersFilter` |
| podwójne kliknięcie | `Idempotency-Key` + blokada portfela + unikalny indeks `(user_id, idempotency_key)` | `SpinService` |
| losowość | `SecureRandom` (nieprzewidywalne ziarna); `X-Demo-Seed` tylko w profilu `demo` | `SecureSeedGenerator`, `SlotController` |
| znane ograniczenie | logowanie samą nazwą (bez hasła), świadomie, waluta nie ma wartości | plan § 5.8 |

## 9. Front-end w skrócie

Pliki statyczne w `src/main/resources/static` serwuje ten sam Spring Boot (bez Node.js w produkcji, bez CDN):
lobby (`index.html`, `js/lobby.js`: logowanie, kafle, ranking, feed, bonusy), ekran gry (`gra.html`, `js/gra.js`,
PixiJS 8 z `vendor/`), wspólne moduły (`js/api.js`: jedyne miejsce rozmowy z API, `ProblemDetail` → `ApiError`).
Assety (`assets/img`, `assets/audio`) mają manifesty i nagłówki cache ustawiane w `WebConfig`. Kontrakt między
przeglądarką a serwerem: [`../projekt/09-kontrakt-api-i-assetow.md`](../projekt/09-kontrakt-api-i-assetow.md).

## Powiązane dokumenty

[`00-uruchomienie.md`](00-uruchomienie.md) · [`02-przewodnik-po-kodzie.md`](02-przewodnik-po-kodzie.md) (klasa po
klasie) · [`05-decyzje-projektowe.md`](05-decyzje-projektowe.md) (ADR) · [`../plan-projektu.md`](../plan-projektu.md) ·
[`../projekt/07-gry-i-matematyka.md`](../projekt/07-gry-i-matematyka.md) ·
[`../projekt/09-kontrakt-api-i-assetow.md`](../projekt/09-kontrakt-api-i-assetow.md)
