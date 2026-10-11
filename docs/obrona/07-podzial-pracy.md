# 07. Podział obrony i ściągi

> **To jest propozycja do zmiany przez zespół.** Podział wynika z budowy kodu (moduły i laboratoria), a nie z tego,
> kto co pisał. Zamieńcie zakresy tak, jak Wam wygodnie — ważne, żeby każdy obszar miał „właściciela”, a każda osoba
> znała minimum wspólne (§ 1). Prowadzący może zapytać każdego o wszystko, więc ściągi innych też warto przeczytać.

| Osoba | Nr indeksu | Proponowany zakres | Laboratoria |
|---|---|---|---|
| **Konrad Paulus** | 112960 | moduły `account` i `wallet`: logowanie nazwą, sesja, portfel, bonusy, blokada; model danych; wymagania kursu | LAB 01, LAB 02 |
| **Dominik Pacanowski** | 112961 | moduł `slots`: spin, silniki gier, matematyka i RTP, idempotencja; repozytoria i 5 pytań inwestora; serwisy i transakcje | LAB 03, LAB 04 |
| **Dawid Majewski** | 113154 | REST (kontrolery, DTO, walidacja, błędy, Swagger), LAB 06 (zdarzenia, konfiguracja, `@Scheduled`, profile), Docker; front: runtime gier, efekty, dźwięk, grafika | LAB 05, LAB 06 |

Ścieżki w ściągach są skrócone jak w [`02-przewodnik-po-kodzie.md`](02-przewodnik-po-kodzie.md). Numery pytań odsyłają
do [`06-pytania-na-obrone.md`](06-pytania-na-obrone.md).

---

## 1. Minimum wspólne (każdy musi umieć)

1. **Serwer rozstrzyga o wyniku**, przeglądarka tylko animuje listę kroków (ADR-01). Dlaczego: saldo i uczciwość.
2. **Jedna runda = jeden zakład**, cała sekwencja (z darmowymi spinami) w jednej transakcji (ADR-02).
3. **Trasa spinu** w 8 krokach: [`02-przewodnik-po-kodzie.md`](02-przewodnik-po-kodzie.md) § 9 (klik → kontroler →
   `SpinService` → blokada → zakład → silnik → wypłata → zdarzenia → animacja).
4. **Moduły i warstwy**: `account ← wallet ← slots ← report`, `web → application → domain`, `api` jako kontrakt;
   pilnuje `ArchitectureTest` (pyt. 6–9).
5. **Uruchomienie**: IntelliJ albo `mvn spring-boot:run`, adresy (lobby, Swagger, H2), `mvn -B verify -Dlab=1`.
6. **Znane ograniczenia** powiedziane wprost: logowanie samą nazwą, publiczne raporty, S2/S3 w toku po stronie frontu,
   brak zadania dodatkowego z `RestClient` (pyt. 44, 47–50).

### 1.1. Proponowany przebieg pokazu (ok. 15 minut)

| Min. | Kto | Co |
|---|---|---|
| 0–2 | Dawid | start aplikacji, lobby: logowanie nazwą → bonus 10 000 (sekwencja E07), kafle, ranking i feed |
| 2–5 | Konrad | co się stało w bazie: konsola H2 (`user_account`, `wallet`, `wallet_transaction`), `LoginService` → `PlayerRegistered` → `WalletService`, reguły R1.01–R1.05 |
| 5–9 | Dominik | spin w grze S1 i przez `kasyno.http` / Swagger: odpowiedź z krokami, `seed`, idempotencja (ten sam klucz), `SpinService` i blokada; test `SlotMath*` z RTP |
| 9–12 | Dawid | błędy jako ProblemDetail (zły zakład, brak sesji), zdarzenia po commicie, migawka gospodarki w logu (profil `demo`), profile, Docker |
| 12–15 | wszyscy | pytania; każdy odpowiada ze swojego zakresu, reszta uzupełnia |

---

## 2. Ściąga: Konrad Paulus — konta, portfel, LAB 01–02, wymagania kursu

**Twój kod:** `account/**`, `wallet/**`, `shared/web/PlayerSession.java`, `shared/web/CurrentPlayer*.java`,
`shared/domain/Money.java`, `src/main/resources/data.sql`, `pom.xml` (wersja), `static/index.html` (wizytówka).
**Twoje testy:** `LoginServiceTest`, `NickPolicyTest`, `AuthControllerTest`, `WalletTest`, `WalletServiceTest`,
`WalletControllerTest`, `MoneyTest`, `KasynoFlowIntegrationTest` (współbieżność), reguły `Lab01ProjectRulesTest`.

### 10 rzeczy, które musisz umieć pokazać i wyjaśnić

1. **R1.01–R1.05** — gdzie każda reguła jest spełniona (`KasynoApplication.java:21`, `pom.xml` linie 15–17,
   `data.sql` linie 10–14, `index.html`) i jak to sprawdzić (`mvn -B verify -Dlab=1`). Pyt. 2.
2. **Model danych** (ERD w [`01-architektura.md`](01-architektura.md) § 3): 6 własnych tabel, 1:1, 1:N, M:N z atrybutami
   (`PlayerMachineStats`), obiekt ze statusem (`SpinRound`) — warunki koncepcji z `pomysl.html`. Pyt. 3–4.
3. **Mapowanie JPA** na przykładzie `Wallet`: `@Entity`, `@OneToOne(fetch = LAZY)` do `UserAccount`,
   `@Column(precision = 19, scale = 2)`, `@Version`, `@Enumerated(STRING)` w `WalletTransaction`. Pyt. 14–15.
4. **`BigDecimal`** dla kwot: `Money.normalize` (skala 2), porównanie `compareTo`, `BigDecimalJsonSerializer`
   (`10000.00` → `10000`). Pyt. 16.
5. **Logowanie nazwą**: `LoginService.login` (`:56`) → `NickPolicy.validate` (`:49`) i `simplify` (`:69`,
   „Adm1n” odrzucony) → techniczny e-mail → nowy gracz: `PlayerRegistered`. Pyt. 25 (równoczesna rejestracja).
6. **Bonus powitalny przez zdarzenie** w tej samej transakcji: `WalletService.onPlayerRegistered` (`:77`) — dlaczego nie
   wywołanie wprost (cykl modułów) i dlaczego nie `AFTER_COMMIT` (konto bez portfela). Porty `PlayerFundsProvider`,
   `MinimumBetProvider`. Pyt. 9, ADR-07.
7. **Portfel jako bogata encja**: `debitBet` (`:91`) najpierw sprawdza saldo, potem odejmuje; brak `setBalance`;
   każda zmiana = wpis `WalletTransaction` z `balanceAfter` (suma `amount` = saldo — `WalletServiceTest.ledgerIsConsistent`).
8. **Blokada pesymistyczna**: `WalletRepository.findByPlayerIdForUpdate` (`:31–33`), `lockWallet` z `MANDATORY`;
   test 16 równoległych spinów → dokładnie 10 udanych (`KasynoFlowIntegrationTest.java:270`). Pyt. 21, 24.
9. **Bonus ratunkowy**: `Wallet.rescue` (`:127`) — bankrut (saldo < najmniejszy zakład) i 10 min od poprzedniego;
   czas z `Clock`, test z `MutableClock` (`WalletServiceTest.java:183`); dlaczego bez `@Scheduled` (pyt. 33).
10. **Sesja i bezpieczeństwo logowania**: `PlayerSession.start` (nowa sesja — *session fixation*), ciasteczko
    `HttpOnly`/`SameSite=Lax`, `@CurrentPlayer` → `401`; świadome ograniczenie „logowanie samą nazwą”. Pyt. 43–44.

### Komendy do pokazu

```bash
mvn -B verify -Dlab=1                                             # reguły R1.01–R1.05 + wszystkie testy
mvn -B test -Dtest='WalletTest,WalletServiceTest,LoginServiceTest,NickPolicyTest'
mvn -B test -Dtest=KasynoFlowIntegrationTest                      # współbieżność: spiny, duplikaty, rejestracje
mvn spring-boot:run -Dspring-boot.run.profiles=demo               # ratunek co minutę zamiast co 10 minut
```

* IntelliJ HTTP Client: `src/test/http/kasyno.http`, żądania 1–6 (401 bez sesji, logowanie, ten sam gracz inną
  wielkością liter, `NICK_INVALID`, `NICK_FORBIDDEN` dla „Adm1n”).
* Konsola H2 (<http://localhost:8080/h2-console>, `dev`: `jdbc:h2:file:./data/wdtb`, `demo`: `jdbc:h2:mem:kasyno-demo`,
  użytkownik `sa`, hasło puste):
  `select * from user_account;` · `select * from wallet;` ·
  `select type, amount, balance_after, game_code, spin_round_id from wallet_transaction where wallet_id = 1 order by id;`

**Przećwicz pytania:** 1–4, 12, 14–16, 20–25, 41, 43–45, 47.

---

## 3. Ściąga: Dominik Pacanowski — silniki gier, matematyka, LAB 03–04

**Twój kod:** `slots/**` (zwłaszcza `slots/application/SpinService.java`, `slots/application/engine/**`,
`slots/domain/*Repository.java`, `SpinRound`, `SpinStatus`), `report/application/InvestorReportService.java`,
matematyka w `data.sql`. **Twoje testy:** `SpinServiceTest`, `SpinRoundTest`, `SlotValueObjectsTest`,
`LinesEngineTest`, `ClusterEngineTest`, `GameMathTest`, `SlotMathDataTest`, `SlotMathMonteCarloTest`,
`SlotEnginesIntegrationTest`, `InvestorQuestionsRepositoryTest`, `IdempotencyKeyCleanupTest`, `ArchitectureTest`.
**Dokumenty:** [`03-silnik-gier.md`](03-silnik-gier.md), [`../projekt/07-gry-i-matematyka.md`](../projekt/07-gry-i-matematyka.md).

### 10 rzeczy, które musisz umieć pokazać i wyjaśnić

1. **`SpinService.spin`** (`:84–128`) krok po kroku: walidacje → `lockWallet` → powtórka? → `SpinRound STARTED` →
   `debit` → silnik → `resolve` → `credit` → `settle` → `SpinCompleted`; wszystko w jednej transakcji (pyt. 20, 23).
2. **Cykl życia rundy**: `SpinStatus.allowedTargets` (`:39`), `SpinRound.moveTo` (`:158`), brak `setStatus`; dlaczego
   `FAILED` nie trafia do bazy (rollback). Test `SpinRoundTest.transitionTable` (`:114`). Pyt. 23.
3. **Idempotencja**: `replayIfRepeated` (`:149`) pod blokadą portfela, `matchesRequest`, `409 IDEMPOTENCY_CONFLICT`,
   `result_json` bajt w bajt, unikalny indeks, czyszczenie kluczy po 24 h. Pyt. 18, 22, ADR-05.
4. **Losowanie**: `SecureRandom` → ziarno → `SplittableRandom`; interfejs `RandomSource` (testy podają ustawione liczby);
   `X-Demo-Seed` tylko w `demo`; odtworzenie rundy z ziarna. Pyt. 35, 39.
5. **Silnik linii**: `LinesEngine.evaluateLine` (`:155`) — od lewej, WILD, najwyższa kombinacja, wzór kwoty; NEON JACKPOT;
   darmowe spiny S2 z rozszerzającym się WILD. Przykład: cytryna–WILD–WILD przy zakładzie 50 = 50.
6. **Silnik klastrów**: `findClusters` (`:140`, BFS po sąsiadach bokami), `cascade` (`:192`), kule mnożników
   (`applyMultiplier` dodaje `baseWin × (sumaKul − 1)`). Pyt. 38.
7. **RTP i Monte Carlo**: odpowiedź z [`03-silnik-gier.md`](03-silnik-gier.md) § 11 (σ/√n, 10 i 14 mln rund, S1 dokładnie
   94,892%); taśmy vs wagi; limit max win (`RoundBuilder.addWin`). Pyt. 36–37.
8. **5 pytań inwestora**: zapytania JPQL z `GROUP BY` i projekcjami (`SpinRoundRepository.java:55–86`,
   `PlayerMachineStatsRepository.java:28–46`), `left join … on` (gry bez rund z zerem), `Pageable`. Pyt. 5, 17.
9. **Problem N+1**: `join fetch` (`SlotMachineRepository.java:26`), projekcje `RoundSummary`, test z licznikiem zapytań
   (`InvestorQuestionsRepositoryTest.java:213`); `LAZY` + `open-in-view=false`. Pyt. 13–14.
10. **Serwisy i DI (LAB 04)**: wstrzykiwanie przez konstruktor, `@Configuration` + `@Bean` (`SlotEnginesConfig`),
    `SlotEngineRegistry` (nowa gra bez zmian w `SpinService`), `@Transactional(readOnly)`, `Propagation.MANDATORY`,
    pakiet `api` jako kontrakt modułu, testy z Mockito i parametryzowane. Pyt. 10–11, 20.

### Komendy do pokazu

```bash
mvn -B test -Dtest='SlotMath*'                          # RTP: linie [MATEMATYKA] w wyjściu (ok. 20 s)
mvn -B test -Dtest='LinesEngineTest,ClusterEngineTest'  # konkretne układy, kaskady, limit, odtwarzalność
mvn -B test -Dtest='SpinServiceTest,SpinRoundTest,InvestorQuestionsRepositoryTest'
mvn spring-boot:run -Dspring-boot.run.profiles=demo     # pozwala narzucić ziarno nagłówkiem X-Demo-Seed
```

Ta sama runda dwa razy (profil `demo`; w Windows PowerShell pisz `curl.exe`; to samo da się zrobić w `kasyno.http`):

```bash
curl -s -c sesja.txt -H "Content-Type: application/json" -d "{\"nick\":\"Obrona_D\"}" http://localhost:8080/api/auth/login
curl -s -b sesja.txt -H "Content-Type: application/json" -H "Idempotency-Key: pokaz-1" -H "X-Demo-Seed: 154606077657d092" \
     -d "{\"bet\":20}" http://localhost:8080/api/slots/zloty-faraon/spins
curl -s -b sesja.txt -H "Content-Type: application/json" -H "Idempotency-Key: pokaz-2" -H "X-Demo-Seed: 154606077657d092" \
     -d "{\"bet\":20}" http://localhost:8080/api/slots/zloty-faraon/spins     # inna runda, te same kroki i totalWin
curl -s -i -b sesja.txt -H "Content-Type: application/json" -H "Idempotency-Key: pokaz-1" \
     -d "{\"bet\":20}" http://localhost:8080/api/slots/zloty-faraon/spins     # powtórka: Idempotent-Replayed: true
```

(Ziarno `154606077657d092` to runda z darmowymi spinami z przykładu w 07 § 3.6.) Potem: `GET /api/reports/rtp`
(rzeczywisty RTP przy małej liczbie rund jest „dziwny” — wyjaśnij dlaczego) i w H2
`select id, bet, total_win, tier, status, seed from spin_round order by id desc;`.

**Przećwicz pytania:** 5, 10–11, 13–14, 17–23, 35–40, 42, 46.

---

## 4. Ściąga: Dawid Majewski — REST, LAB 05–06, front, efekty, dźwięk

**Twój kod:** `*/web/**` (kontrolery i DTO), `shared/error/**`, `shared/config/**`, `report/**` (ranking, feed, cache,
słuchacze, migawka), `application*.properties`, `Dockerfile`, `render.yaml`; front `static/js/**`, `static/*.html`;
narzędzia `tools/art`, `tools/audio`, `tools/e2e`. **Twoje testy:** `SlotControllerTest`, `AuthControllerTest`,
`WalletControllerTest`, `WebConfigTest`, `LobbyBoardsCacheTest`, `LobbyBoardsListenerTest`, `EconomySnapshotJobTest`,
`ProfilesTest`, `ProdProfilePersistenceTest`, `DemoSeedAllowedTest`, `DemoSeedIgnoredTest`; e2e `smoke.mjs`,
`backend-flow.mjs`, `gra-s1.mjs`. **Dokumenty:** [`00-uruchomienie.md`](00-uruchomienie.md),
[`../projekt/09-kontrakt-api-i-assetow.md`](../projekt/09-kontrakt-api-i-assetow.md), [`../projekt/10-runtime-gier.md`](../projekt/10-runtime-gier.md).

### 10 rzeczy, które musisz umieć pokazać i wyjaśnić

1. **Kontrolery REST**: `@RestController`, mapowania, `ResponseEntity` (spin z nagłówkiem `Idempotent-Replayed`),
   `@CurrentPlayer`, lista endpointów (pyt. 26); dlaczego spin zwraca tekst z `result_json` (pyt. 30).
2. **DTO jako rekordy** i mapowanie `from(...)`; ArchUnit `controllersDoNotReturnEntities` (pyt. 29).
3. **Walidacja**: Bean Validation (`SpinRequest` z `@Digits` przeciw `1e999999999`, `@Min`/`@Max` stronicowania) vs reguły
   biznesowe (`BET_INVALID`, `NICK_*`) (pyt. 28).
4. **ProblemDetail**: `GlobalExceptionHandler` (`:61`, `:88`, `:100`), `ErrorCode`, brak stack trace dla klienta,
   `409 CONCURRENT_REQUEST` zamiast 500 (pyt. 27). Pokaż: zły zakład i brak sesji w Swagger UI.
5. **OpenAPI i testy web**: `/swagger-ui.html`, `OpenApiConfig` (ukryte `@CurrentPlayer`), `kasyno.http`,
   `@WebMvcTest` + MockMvc (`SlotControllerTest`, 16 testów).
6. **Zdarzenia (LAB 06)**: trzy zdarzenia, `@EventListener` w transakcji vs `@TransactionalEventListener(AFTER_COMMIT)`;
   cache rankingu z licznikiem pokoleń i dlaczego unieważnienie po commicie (pyt. 31, ADR-09).
7. **`@ConfigurationProperties`, `@Scheduled`, profile**: `CasinoProperties` (`@Validated`), dwa zadania z cronem
   z konfiguracji, czego świadomie nie ma; `dev`/`demo`/`prod` i dlaczego `dev` jest prawie pusty (pyt. 32–34, ADR-10).
8. **Docker i hosting**: dwuetapowy `Dockerfile`, użytkownik bez roota, `HEALTHCHECK`, `render.yaml`, PostgreSQL przez
   zmienne środowiskowe (pyt. 58).
9. **Front gry**: `controller.js` (`spin` `:119`, `#book` `:162`), `StepPlayer`, `BaseGame`, `ReelSet.land`
   (stop w zaplanowanej ms), „front niczego nie liczy” (pyt. 51); bez bundlera, PixiJS lokalnie (pyt. 54).
10. **Wydajność i dostępność, oprawa**: poziomy jakości z automatem (p90 > 20 ms przez 2 s), pule i cząsteczki SoA,
    strażnik błysków ≤ 3/s (WCAG 2.3.1), tryb ograniczonego ruchu; grafika ChatGPT → `przetworz.py` → manifest;
    dźwięk syntezowany → Web Audio (pyt. 52–53, 55–56, ADR-11–14).

### Komendy do pokazu

```bash
mvn spring-boot:run -Dspring-boot.run.profiles=demo
#   w logu co minutę: "economy_snapshot at=… players=… bankrupt=… coins_in_circulation=… spins_last_hour=…"
#   po wygranej ≥ 15×: "big_win round=… game=… multiplier=…"
mvn -B test -Dtest='SlotControllerTest,AuthControllerTest,WalletControllerTest,LobbyBoardsListenerTest,LobbyBoardsCacheTest,ProfilesTest'

docker build -t cebulion-casino .
docker run --rm -p 8080:8080 -v kasyno-dane:/app/data cebulion-casino     # profil prod, dane w wolumenie

mvn -B -DskipTests package && java -jar target/wdtb-2026-backend-kasyno-*.jar --server.port=8088
cd tools && npm install && node e2e/smoke.mjs http://localhost:8088 && node e2e/backend-flow.mjs http://localhost:8088
node dev/mock-api.mjs                     # atrapa API na :8090 (w drugim terminalu, z katalogu tools)
node e2e/gra-s1.mjs                        # test gry S1 z wymuszonymi wynikami i pomiarem klatek
```

W przeglądarce: <http://localhost:8080/swagger-ui.html> (zły zakład `{"bet": 7}` → `400 BET_INVALID`; spin bez
logowania → `401 NOT_LOGGED_IN`), gra z panelem diagnostycznym <http://localhost:8080/gra.html?gra=cebulowy-777&fx=debug>
(FPS, p90, poziom jakości, błyski/s), w ustawieniach gry — ręczna zmiana jakości i tryb ograniczonego ruchu.

**Przećwicz pytania:** 6–8, 26–34, 43, 45, 48–58.

---

## 5. Gdy pytanie wychodzi poza Twój zakres

* Zacznij od minimum wspólnego (§ 1): „serwer liczy, jedna transakcja, moduły bez cykli” — to odpowiada na większość
  pytań „dlaczego”.
* Pokaż mapę [`02-przewodnik-po-kodzie.md`](02-przewodnik-po-kodzie.md) § 0 — znajdziesz klasę i test w kilka sekund.
* Jeśli czegoś nie ma, powiedz to wprost i dodaj „dlaczego” albo „co byśmy zrobili” (pyt. 47–50) — to lepsze niż
  zgadywanie.

## Powiązane dokumenty

[`00-uruchomienie.md`](00-uruchomienie.md) · [`01-architektura.md`](01-architektura.md) ·
[`02-przewodnik-po-kodzie.md`](02-przewodnik-po-kodzie.md) · [`03-silnik-gier.md`](03-silnik-gier.md) ·
[`05-decyzje-projektowe.md`](05-decyzje-projektowe.md) · [`06-pytania-na-obrone.md`](06-pytania-na-obrone.md) ·
[`../plan-projektu.md`](../plan-projektu.md)
