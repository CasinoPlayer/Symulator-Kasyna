# 00. Uruchomienie: IntelliJ, Maven, profile, Docker, Render

Jak uruchomić Cebulion Casino na swoim komputerze (na obronę), na serwerze (Docker, Render.com) i jak sprawdzić,
że wszystko działa (testy, reguły kursu, testy e2e w przeglądarce). Czytaj od § 1; § 4–5 są potrzebne tylko do
hostingu. Wszystkie polecenia uruchamiamy w katalogu głównym repozytorium, chyba że napisano inaczej.

## 1. Wymagania

| Narzędzie | Wersja | Po co |
|---|---|---|
| JDK | 21 (Temurin, Oracle, Corretto…) | kompilacja i uruchomienie aplikacji |
| IntelliJ IDEA | Community albo Ultimate | praca na zajęciach i obrona (Maven i Git są wbudowane) |
| Maven | 3.9+ (wbudowany w IntelliJ albo osobno) | budowanie, testy, reguły kursu |
| Docker | dowolna aktualna | tylko obraz na serwer (§ 4); do pracy lokalnej niepotrzebny |
| Node.js | 20+ | tylko testy e2e w przeglądarce (§ 6); aplikacja działa bez Node.js |

Baza danych H2 jest w aplikacji (plik albo pamięć), nic nie trzeba instalować.

## 2. Uruchomienie lokalne

### 2.1. IntelliJ IDEA (na obronę)

1. *File → Open* → katalog repozytorium → *Trust Project*. IntelliJ wczyta `pom.xml` i pobierze zależności.
2. Brak JDK: *File → Project Structure → Project → SDK → Download JDK* → 21.
3. Otwórz `src/main/java/pl/wsb/kasyno/KasynoApplication.java` → zielona strzałka przy `main` → *Run*.
4. W konsoli: `No active profile set, falling back to 1 default profile: "dev"` i `Started KasynoApplication`.
5. Przeglądarka: <http://localhost:8080>.

Inny profil (§ 3) w IntelliJ: *Run → Edit Configurations… → KasynoApplication*:

* Ultimate: pole **Active profiles** → `demo`;
* Community: pole **Program arguments** → `--spring.profiles.active=demo`
  (albo *Environment variables* → `SPRING_PROFILES_ACTIVE=demo`).

### 2.2. Maven z wiersza poleceń

| Polecenie | Co robi |
|---|---|
| `mvn spring-boot:run` | uruchamia aplikację w profilu `dev` |
| `mvn spring-boot:run -Dspring-boot.run.profiles=demo` | to samo w profilu `demo` |
| `mvn -B verify -Dlab=1` | wszystkie testy + reguły kursu dla LAB 01 (jak GitHub Actions) |
| `mvn -B -DskipTests package` | buduje `target/wdtb-2026-backend-kasyno-1.0.0-112960-112961-113154.jar` |
| `java -jar target/wdtb-2026-backend-kasyno-*.jar --spring.profiles.active=prod` | uruchamia zbudowany plik w profilu `prod` |
| `java -jar target/wdtb-2026-backend-kasyno-*.jar --server.port=8088` | inny port, gdy 8080 jest zajęty |

Zatrzymanie: `Ctrl+C` w konsoli (IntelliJ: czerwony kwadrat). W profilu `prod` serwer kończy najpierw rozpoczęte
żądania (`server.shutdown=graceful`).

### 2.3. Adresy

| Adres | Co tam jest |
|---|---|
| <http://localhost:8080> | lobby: logowanie nazwą gracza, kafle gier, ranking, feed dużych wygranych, wizytówka „O projekcie” |
| <http://localhost:8080/gra.html?gra=cebulowy-777> | ekran gry (także `zloty-faraon`, `krysztalowa-kaskada`); bez sesji przekierowuje do lobby |
| <http://localhost:8080/swagger-ui.html> | Swagger UI: wszystkie endpointy `/api/**` z opisami, można je wywołać z przeglądarki |
| <http://localhost:8080/v3/api-docs> | opis OpenAPI (JSON) |
| <http://localhost:8080/h2-console> | konsola bazy H2 (tylko `dev` i `demo`, § 2.5) |
| <http://localhost:8080/api/slots> | najprostszy test „czy backend żyje” (katalog gier z bazy) |
| `src/test/http/kasyno.http` | gotowe żądania REST do IntelliJ HTTP Client (zielona strzałka przy żądaniu) |

### 2.4. Konta i logowanie

Do gry **nie ma haseł ani gotowych kont**: w prawym górnym rogu lobby klikasz „Zaloguj” i wpisujesz dowolną nazwę
gracza (3–16 znaków: litery, także polskie, cyfry, `_`, `-`). Nowa nazwa = nowy gracz z bonusem **10 000 cebulionów**;
ta sama nazwa (bez względu na wielkość liter) = powrót na to samo konto. Nazwy zastrzeżone (`admin`, `krupier`…)
i wulgarne są odrzucane (`400 NICK_FORBIDDEN`). Świadome uproszczenie opisane w planie (§ 5.8).

`data.sql` zawiera też konta wymagane przez kurs: 4 konta demo z szablonu (`ola@student.merito.pl` itd.) i 3 konta
zespołu (reguła R1.03). Mają rolę i e-mail, ale **nie mają portfela**, więc nie służą do gry (gracze dostają
techniczny e-mail `<nazwa>@kasyno.local`). Widać je w konsoli H2 w tabeli `user_account`.

### 2.5. Konsola H2

| Profil | JDBC URL | Użytkownik / hasło |
|---|---|---|
| `dev` | `jdbc:h2:file:./data/wdtb` | `sa` / puste |
| `demo` | `jdbc:h2:mem:kasyno-demo` | `sa` / puste |
| `prod` | konsola wyłączona (na serwerze dawałaby dostęp do całej bazy) | — |

Przydatne zapytania na obronę: `select * from spin_round order by id desc`, `select * from wallet_transaction where
wallet_id = 1 order by id`, `select * from player_machine_stats`.

## 3. Profile (LAB 06)

Profil to zestaw ustawień wybierany przy starcie. Wspólne ustawienia są w `application.properties` (dokładnie jak
w szablonie kursu), a każdy profil ma swój plik `application-<profil>.properties`, który nadpisuje tylko różnice.
Bez wyboru działa `dev` (`spring.profiles.default=dev`).

| | `dev` (domyślny) | `demo` | `prod` |
|---|---|---|---|
| Do czego | zajęcia, obrona w IntelliJ, reguły kursu | nagrywanie filmików do lobby, pokaz | serwer: Docker, Render.com |
| Baza | H2 w pliku `./data/wdtb` | H2 w pamięci `kasyno-demo` | H2 w pliku `$KASYNO_DATA_DIR/kasyno-prod` albo PostgreSQL (§ 5) |
| Tabele | od nowa przy każdym starcie (`create-drop`) | od nowa (`create-drop`) | **zostają**, Hibernate tylko dopisuje braki (`update`) |
| `data.sql` | przy każdym starcie | przy każdym starcie | **tylko przy pierwszym starcie** na pustej bazie (`StarterDataLoader`) |
| Salda po restarcie | znikają | znikają | **zostają** |
| Konsola H2 | tak | tak | nie |
| SQL w konsoli | tak (`show-sql`) | nie | nie |
| `X-Demo-Seed` | ignorowany | **przyjmowany** | ignorowany |
| Bonus ratunkowy | co 10 min | co **1 min** (pokaz bez czekania) | co 10 min |
| Migawka gospodarki w logu | co godzinę | co **minutę** | co godzinę |
| Port | 8080 | 8080 | zmienna `PORT` (domyślnie 8080) |

Dlaczego plik `dev` prawie nic nie zawiera: instrukcje laboratoriów każą zmieniać `application.properties`, a wpis
w pliku profilu po cichu by tę zmianę nadpisał. `dev` = szablon, więc reguły (`mvn verify -Dlab=N`) widzą aplikację
taką, jaką znają.

Każdą liczbę biznesową (rekord `CasinoProperties`, prefiks `kasyno.`) można nadpisać bez kompilacji: w pliku profilu,
argumentem (`--kasyno.rescue-cooldown=5m`) albo zmienną środowiskową (kropki → `_`, bez myślników, wielkie litery:
`KASYNO_RESCUECOOLDOWN=5m`). Pełna lista z opisem: `application.properties`, sekcja „Cebulion Casino”.

### 3.1. Profil `demo` i nagłówek `X-Demo-Seed`

W `demo` (`kasyno.demo.allow-seed=true`) żądanie spinu może podać ziarno rundy w nagłówku, szesnastkowo, tak jak
pole `seed` w odpowiedzi:

```http
POST /api/slots/zloty-faraon/spins
Content-Type: application/json
Idempotency-Key: 6c1d…
X-Demo-Seed: 5f3a9c0e7b21d4a8

{ "bet": 20 }
```

Ta sama gra, zakład i ziarno = dokładnie ta sama runda (kroki, wygrana), więc skrypt nagrywający filmik może pokazać
wybraną rundę z darmowymi spinami. W profilach `dev` i `prod` nagłówek jest **ignorowany** (nawet nie sprawdzamy jego
formatu), a ziarno losuje `SecureRandom`; inaczej gracz mógłby powtarzać znaną sobie wygrywającą rundę. Pilnują tego
testy `DemoSeedIgnoredTest`, `DemoSeedAllowedTest`, `ProfilesTest` i `SlotControllerTest`.

## 4. Docker

`Dockerfile` buduje obraz w dwóch etapach: `maven:3.9-eclipse-temurin-21` kompiluje i pakuje aplikację, a do obrazu
końcowego `eclipse-temurin:21-jre` trafia tylko plik `.jar` (mniejszy obraz, bez Mavena i JDK). Aplikacja działa jako
użytkownik `kasyno` (nie root), na porcie 8080, w profilu `prod` (`SPRING_PROFILES_ACTIVE=prod`), a Docker co 30 s
sprawdza `GET /api/slots` (`HEALTHCHECK`).

```bash
docker build -t cebulion-casino .
docker run --rm -p 8080:8080 -v kasyno-dane:/app/data cebulion-casino
# → http://localhost:8080 ; stan kontenera: docker ps (kolumna STATUS: healthy)
```

Wolumen `kasyno-dane` trzyma plik bazy H2 (`/app/data/kasyno-prod.mv.db`), więc dane przetrwają usunięcie
kontenera. Bez `-v` baza żyje tyle, co kontener. `.dockerignore` wysyła do budowania tylko `pom.xml` i `src/`.

## 5. Hosting na Render.com (plan darmowy)

GitHub Pages hostuje tylko pliki statyczne, więc aplikacji w Javie tam nie uruchomimy. Render.com uruchamia ją z
naszego `Dockerfile`; konfiguracja jest w pliku `render.yaml` (Blueprint).

1. <https://render.com> → konto (np. przez GitHub).
2. *New → Blueprint* → wybierz repozytorium → Render czyta `render.yaml` → *Apply*.
3. Pierwsze budowanie trwa kilka minut. Adres usługi: `https://cebulion-casino-….onrender.com`.
4. Każdy push na gałąź domyślną (`main`) wdraża nową wersję (`autoDeploy`). Render uznaje wdrożenie za udane, gdy
   `GET /api/slots` odpowiada 200 (`healthCheckPath`).

Ograniczenia planu darmowego (sprawdźcie aktualny cennik Render, bo się zmienia):

* usługa **zasypia** po ok. 15 minutach bez ruchu; pierwsze wejście po przerwie ją budzi (ok. minuty),
* dysk kontenera jest **ulotny**: przy uśpieniu, restarcie i wdrożeniu plik bazy H2 znika, a przy kolejnym starcie
  `data.sql` wczytuje automaty od nowa (gracze i salda giną). Trwałe dyski są tylko w planach płatnych.

**Trwałe dane na darmowym planie: zewnętrzny PostgreSQL**, bez zmiany kodu. W panelu usługi *Environment* dodajcie:

| Zmienna | Przykład |
|---|---|
| `SPRING_DATASOURCE_URL` | `jdbc:postgresql://HOST:5432/BAZA` (z panelu bazy: Render PostgreSQL, Neon, Supabase…) |
| `SPRING_DATASOURCE_USERNAME` | użytkownik bazy |
| `SPRING_DATASOURCE_PASSWORD` | hasło bazy |

Zmienne środowiskowe mają w Spring Boot pierwszeństwo przed `application-prod.properties`, sterownik `org.postgresql`
jest w `pom.xml`, a dialekt Hibernate dobiera się sam. Przy pierwszym starcie Hibernate tworzy tabele, a
`StarterDataLoader` wczytuje `data.sql`; przy kolejnych dane zostają. Sprawdzone lokalnie na PostgreSQL 16:
start na pustej bazie, pełny scenariusz `backend-flow.mjs` (46/46), restart bez duplikatów i z zachowanymi saldami.
Kolumna `spin_round.result_json` (`@Lob`) ma w PostgreSQL typ `oid` (duży obiekt), co działa, bo czytamy ją zawsze
w transakcji. Darmowe bazy mają własne limity (np. darmowy Render PostgreSQL był w chwili pisania ograniczony czasowo),
więc przed wyborem sprawdźcie aktualne warunki dostawcy.

## 6. Testy

### 6.1. Testy Javy i reguły kursu

```bash
mvn -B verify -Dlab=1
```

Uruchamia testy zespołu (`src/test/java/pl/wsb/kasyno`, ok. 260) i reguły prowadzącego (`src/test/java/pl/wsb/rules`,
dla LAB 01: R1.01–R1.05). Reguły startują aplikację w profilu domyślnym (`dev`) z bazą H2 w pamięci, więc profile
`demo` i `prod` ich nie dotyczą. Testy zespołu działają w profilu `test` (`src/test/resources/application-test.properties`:
osobna baza w pamięci dla każdego kontekstu, wyłączony harmonogram `@Scheduled`).

### 6.2. Testy e2e w przeglądarce (lokalnie)

Wymagają Node.js i Chromium z `/opt/pw-browsers` (albo zmiennej `PW_CHROMIUM=/ścieżka/do/chrome`; skrypty używają
`playwright-core` bez `playwright install`). Najpierw uruchomcie aplikację, np. `java -jar target/*.jar --server.port=8088`.

```bash
cd tools
npm install                                       # tylko za pierwszym razem (gdy nie ma node_modules)
node e2e/smoke.mjs http://localhost:8088          # lobby: wygląd, logowanie, bonus, ekran gry (68 sprawdzeń)
node e2e/backend-flow.mjs http://localhost:8088   # gra na prawdziwym backendzie: salda, idempotencja,
                                                  # bankructwo i ratunek, ranking, feed, raporty (46 sprawdzeń)
```

Test gry S1 (runtime w PixiJS) działa na atrapie API, bo wymusza konkretne wyniki (BIG, MEGA, NEON JACKPOT…)
nagłówkiem `X-Mock-Force`, którego prawdziwy backend nie zna:

```bash
cd tools
node dev/mock-api.mjs                             # atrapa API i pliki statyczne na http://localhost:8090
node e2e/gra-s1.mjs                               # w drugim terminalu: 20+ rund, saldo, strażnik błysków,
                                                  # responsywność, pomiar klatek (opis: docs/projekt/10 § 9, § 11)
```

Zrzuty ekranu i `wyniki.json` trafiają do `tools/e2e/zrzuty/` (poza repozytorium). Kod wyjścia 0 = wszystko zielone.
Testów e2e nie ma w GitHub Actions, bo katalog `.github/workflows` jest objęty zakazem modyfikacji.

## 7. Problemy

| Objaw | Rozwiązanie |
|---|---|
| `Port 8080 was already in use` | aplikacja już działa (zatrzymajcie ją) albo `--server.port=8088` |
| po restarcie w `dev` nie ma graczy | tak ma być (`create-drop`, jak w szablonie); trwałe dane: profil `prod` |
| `401 NOT_LOGGED_IN` po restarcie serwera | sesje są w pamięci serwera; zalogujcie się ponownie tą samą nazwą |
| `X-Demo-Seed` nie działa | działa tylko w profilu `demo` (w logu: `The following 1 profile is active: "demo"`) |
| czerwone importy po zmianie `pom.xml` | panel *Maven* → *Reload All Maven Projects* |
| Render: wdrożenie wisi na „health check” | sprawdźcie log usługi; pierwszy start na darmowym planie trwa do ok. 2 minut |

## Powiązane dokumenty

[`01-architektura.md`](01-architektura.md) · [`02-przewodnik-po-kodzie.md`](02-przewodnik-po-kodzie.md) ·
[`07-podzial-pracy.md`](07-podzial-pracy.md) (komendy do pokazu) · [`../plan-projektu.md`](../plan-projektu.md) ·
[`../projekt/09-kontrakt-api-i-assetow.md`](../projekt/09-kontrakt-api-i-assetow.md)
