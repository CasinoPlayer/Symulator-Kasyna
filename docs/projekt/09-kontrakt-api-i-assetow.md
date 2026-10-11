# 09. Kontrakt: REST API, assety i podział katalogów

Ten dokument jest **umową między backendem (Java) a front-endem (przeglądarka)**. Obie strony implementują dokładnie to,
co tu jest, więc mogą powstawać równolegle. Format odpowiedzi na spin (kroki animacji) opisuje
[`07-gry-i-matematyka.md`](07-gry-i-matematyka.md); tutaj są pozostałe endpointy, wspólne zasady i format assetów.

## 1. Zasady ogólne

| Temat | Ustalenie |
|---|---|
| Format | JSON, UTF-8, nazwy pól `camelCase` |
| Kwoty | liczby całkowite w cebulionach (`10000`), w bazie `BigDecimal(19,2)` |
| Daty | ISO-8601 UTC (`2026-10-11T12:00:00Z`) |
| Błędy | `application/problem+json` (RFC 9457, `ProblemDetail`): `type`, `title`, `status`, `detail`, `code` (stały kod do obsługi w kodzie front-endu), opcjonalnie `errors` (lista pól) i `retryAfterSeconds` |
| Sesja | po `POST /api/auth/login` serwer ustawia cookie sesji (`HttpOnly`, `SameSite=Lax`, ważne 7 dni); kolejne żądania wysyłają je automatycznie (`fetch(..., {credentials: 'same-origin'})`) |
| Brak sesji | `401` z `code: "NOT_LOGGED_IN"` dla endpointów wymagających gracza |
| Stronicowanie | parametry `page` (od 0) i `size` (domyślnie 20, maks. 100); odpowiedź `{ "items": [...], "page": 0, "size": 20, "totalItems": 57, "totalPages": 3 }` |
| Ochrona przed CSRF | cookie `SameSite=Lax` + wyłącznie JSON w ciele żądań (`Content-Type: application/json`) |

### Kody błędów (`code`)

| Kod | Status | Kiedy |
|---|---|---|
| `NICK_INVALID` | 400 | nazwa gracza nie spełnia zasad (długość 3–16, znaki: litery z polskimi znakami, cyfry, `_`, `-`) |
| `NICK_FORBIDDEN` | 400 | nazwa na liście zakazanych słów |
| `VALIDATION_FAILED` | 400 | inne błędy walidacji (pole w `errors`) |
| `NOT_LOGGED_IN` | 401 | brak sesji |
| `GAME_NOT_FOUND` | 404 | nieznany kod gry |
| `BET_INVALID` | 400 | zakład spoza listy `betLevels` gry |
| `INSUFFICIENT_FUNDS` | 409 | saldo mniejsze niż zakład |
| `RESCUE_NOT_AVAILABLE` | 409 | bonus ratunkowy niedostępny (saldo ≥ minimalny zakład albo trwa odliczanie; wtedy `retryAfterSeconds`) |
| `IDEMPOTENCY_CONFLICT` | 409 | ten sam `Idempotency-Key` z innym ciałem żądania |
| `INTERNAL_ERROR` | 500 | nieoczekiwany błąd (bez szczegółów technicznych w odpowiedzi) |

## 2. Endpointy

### 2.1. Logowanie i gracz

`POST /api/auth/login` — ciało `{ "nick": "Kamil_77" }`

Znajduje gracza o tej nazwie (bez rozróżniania wielkości liter) albo go tworzy. Nowy gracz dostaje portfel
i **10 000 cebulionów** (transakcja `WELCOME_BONUS`). Odpowiedź `200`:

```json
{
  "player": {
    "id": 7,
    "nick": "Kamil_77",
    "avatarIndex": 3,
    "balance": 10000,
    "minBet": 10,
    "canRescue": false,
    "rescueAvailableInSeconds": 0,
    "createdAt": "2026-10-11T12:00:00Z"
  },
  "newPlayer": true,
  "welcomeBonus": 10000
}
```

`avatarIndex` (0–7) wyznacza serwer z nazwy gracza (stały dla danej nazwy), front wycina awatar z arkusza `g_awatary`.
`minBet` to najmniejszy zakład spośród wszystkich gier — poniżej niego gracz jest „bankrutem”.
Dla powracającego gracza: `newPlayer: false`, `welcomeBonus: 0`.

| Endpoint | Odpowiedź |
|---|---|
| `POST /api/auth/logout` | `204`, sesja unieważniona |
| `GET /api/me` | `200` — obiekt `player` jak wyżej; `401` bez sesji |
| `POST /api/me/rescue` | `200` — `{ "player": {...}, "amount": 10000 }`; `409 RESCUE_NOT_AVAILABLE` |
| `GET /api/me/transactions?page&size` | strona `{ "id", "type", "amount", "balanceAfter", "gameCode", "roundId", "createdAt" }`; `type`: `WELCOME_BONUS`, `RESCUE_BONUS`, `BET`, `WIN`; `amount` ujemne dla `BET` |
| `GET /api/me/history?page&size` | strona `{ "roundId", "gameCode", "gameName", "bet", "win", "multiplier", "tier", "status", "createdAt" }` |
| `GET /api/me/stats` | lista `{ "gameCode", "gameName", "spins", "totalWagered", "totalWon", "biggestWin", "lastPlayedAt" }` |

Bonus ratunkowy: dostępny, gdy `balance < minBet` i od poprzedniego ratunku minęło ≥ 10 minut.

### 2.2. Automaty

`GET /api/slots` — lista gier:

```json
[
  {
    "code": "cebulowy-777",
    "name": "Cebulowy 777",
    "engineType": "LINES",
    "reels": 3,
    "rows": 3,
    "lines": 5,
    "betLevels": [10, 20, 50, 100, 200, 500, 1000],
    "minBet": 10,
    "maxBet": 1000,
    "targetRtp": 95.0,
    "volatility": "LOW_MEDIUM"
  }
]
```

`engineType`: `LINES` (S1, S2) albo `CLUSTER` (S3). `volatility`: `LOW_MEDIUM`, `MEDIUM_HIGH`, `HIGH`.
`lines` = `null` dla `CLUSTER`.

`GET /api/slots/{code}` — to samo plus `symbols` (tabela wypłat do ekranu informacyjnego) i `features` (opis funkcji).
Kształt `symbols`: `[{ "code": "siodemka", "kind": "NORMAL", "pays": { "3": 50 } }]` — `kind`: `NORMAL`, `WILD`,
`SCATTER`, `MULTIPLIER`; `pays` mapuje liczbę symboli (linie) lub rozmiar klastra (S3) na mnożnik zakładu
(szczegółowa semantyka per gra w `07`).

Dla gier `LINES` odpowiedź zawiera też `paylines`: lista linii, każda jako lista indeksów rzędów (0 = górny)
dla kolejnych bębnów, np. S1: `[[1,1,1],[0,0,0],[2,2,2],[0,1,2],[2,1,0]]`. Numer linii w wygranych = indeks w tej liście + 1.

`POST /api/slots/{code}/spins` — ciało `{ "bet": 100 }`, nagłówek `Idempotency-Key: <uuid>`.
Ten sam klucz idempotencji zwraca tę samą rundę zamiast losować nową (podwójne kliknięcie, ponowienie po zerwanym
połączeniu): identyczną treść i nagłówek `Idempotent-Replayed: true`. Format odpowiedzi — § 2.4.

### 2.4. Odpowiedź spinu (kroki animacji) — wspólna dla wszystkich gier

Serwer liczy całą rundę naraz (obrót, wygrane, kaskady, darmowe spiny) i zwraca **listę kroków** w kolejności,
w jakiej front ma je odegrać. Front niczego nie losuje i niczego nie liczy — tylko animuje kroki.

```json
{
  "roundId": 1042,
  "gameCode": "zloty-faraon",
  "bet": 100,
  "totalWin": 2350,
  "multiplier": 23.5,
  "tier": "big",
  "balanceBefore": 10000,
  "balanceAfter": 12250,
  "seed": "5f3a9c0e7b21d4a8",
  "steps": [ ... ]
}
```

| Pole | Znaczenie |
|---|---|
| `bet` | zakład całkowity rundy (pobrany raz, także gdy runda zawiera darmowe spiny) |
| `totalWin` | suma wszystkich wygranych rundy (liczba całkowita; ułamki zaokrąglamy w dół w silniku) |
| `multiplier` | `totalWin / bet`, do wyboru poziomu prezentacji |
| `tier` | `none`, `small` (< 5×), `medium` (≥ 5×), `big` (≥ 15×), `mega` (≥ 30×), `epic` (≥ 60×), `ultra` (≥ 100×) |
| `balanceBefore` / `balanceAfter` | saldo przed pobraniem zakładu i po zaksięgowaniu wygranej |
| `seed` | ziarno losowania rundy jako tekst szesnastkowy (64 bity nie mieszczą się bezpiecznie w liczbie JS) |

**Siatka** zawsze jako `grid[bęben][rząd]`, rząd 0 = górny; wartości to kody symboli z `GET /api/slots/{code}`
(np. `"siodemka"`). **Pozycja** to para `[bęben, rząd]`.

Typy kroków (`type`) i ich pola. Każdy krok, który dodaje wygraną, ma `win` (ile dodał) i `totalWin` (suma narastająca
rundy po tym kroku), żeby licznik na ekranie rósł razem z animacją.

| `type` | Pola | Kiedy |
|---|---|---|
| `spin` | `phase` (`base` / `free`), `grid`, `anticipation` (lista bębnów do spowolnienia, może być pusta), `freeSpinIndex` i `freeSpinsLeft` (tylko `free`), `orbs` (S3: `[{ "pos": [b, r], "value": 5 }]`) | obrót bębnów / zrzut planszy |
| `expandWild` | `reels` (lista bębnów), `grid` (siatka po rozszerzeniu) | S2: WILD rozszerza się na cały bęben (darmowe spiny), przed oceną wygranych |
| `feature` | `name` (`neonJackpot`, `maxWin`), `multiplier` (+ `win`, `totalWin` dla `neonJackpot`) | S1: cały ekran tego samego symbolu (×10); `maxWin`: osiągnięty limit wygranej rundy, runda się kończy (szczegóły w `07`) |
| `win` | `wins` (lista), `win`, `totalWin` | ocena wygranych po obrocie lub po kaskadzie |
| `cascade` | `removed` (pozycje usuwane), `newSymbols` (dla każdego bębna lista nowych symboli od góry), `grid` (siatka po opadzie), `orbs` (nowe kule) | S3: pęknięcie wygranych i opad |
| `applyMultiplier` | `orbsSum`, `baseWin`, `win`, `totalWin` | S3: koniec sekwencji kaskad w darmowych spinach, suma kul mnoży wygraną sekwencji |
| `freeSpinsStart` | `count`, `trigger` (pozycje scatterów) | aktywacja darmowych spinów |
| `freeSpinsRetrigger` | `added`, `trigger`, `freeSpinsLeft` | dodatkowe darmowe spiny |
| `freeSpinsEnd` | `freeSpinsWin` (suma wygranych z darmowych spinów) | koniec darmowych spinów |

Element listy `wins`:

| `kind` | Pola |
|---|---|
| `line` | `line` (numer od 1), `symbol`, `count`, `positions`, `amount`, `wildMultiplier` (1 albo 2 — S1 „neonowy mnożnik”), `freeSpinMultiplier` (1 albo 2 — S2) |
| `scatter` | `symbol`, `count`, `positions`, `amount` |
| `cluster` | `symbol`, `size`, `positions`, `amount` |

**Jak liczymy kwoty:** wygrana liniowa = mnożnik z tabeli × (zakład / liczba linii) × `wildMultiplier` × `freeSpinMultiplier`;
scatter i klastry = mnożnik z tabeli × zakład całkowity. Szczegóły i tabele: [`07-gry-i-matematyka.md`](07-gry-i-matematyka.md).

Przykład S1 (wygrana na linii 1 z WILD):

```json
{
  "roundId": 17, "gameCode": "cebulowy-777", "bet": 50, "totalWin": 200, "multiplier": 4.0, "tier": "small",
  "balanceBefore": 9950, "balanceAfter": 10100, "seed": "0c1f22a9e3b4d5f6",
  "steps": [
    { "type": "spin", "phase": "base", "anticipation": [],
      "grid": [["cytryna","dzwonek","sliwka"], ["arbuz","wild","cytryna"], ["bar","dzwonek","wisnie"]] },
    { "type": "win", "win": 200, "totalWin": 200, "wins": [
      { "kind": "line", "line": 1, "symbol": "dzwonek", "count": 3, "positions": [[0,1],[1,1],[2,1]],
        "amount": 200, "wildMultiplier": 2, "freeSpinMultiplier": 1 } ] }
  ]
}
```

Przykład S3 (klaster → kaskada → brak dalszych wygranych):

```json
{
  "steps": [
    { "type": "spin", "phase": "base", "anticipation": [], "orbs": [], "grid": [["szafir", "..."], "..."] },
    { "type": "win", "win": 40, "totalWin": 40, "wins": [
      { "kind": "cluster", "symbol": "szafir", "size": 6, "positions": [[0,0],[0,1],[1,1],[1,2],[2,2],[2,3]], "amount": 40 } ] },
    { "type": "cascade", "removed": [[0,0],[0,1],[1,1],[1,2],[2,2],[2,3]],
      "newSymbols": [["topaz","rubin"], ["ametyst","szmaragd"], ["diament","szafir"], [], [], []],
      "grid": [["topaz", "..."], "..."], "orbs": [] }
  ]
}
```

### 2.3. Ranking, feed, raporty

| Endpoint | Odpowiedź |
|---|---|
| `GET /api/leaderboard?type=biggest-win&limit=10` | `[{ "rank", "nick", "avatarIndex", "value", "gameCode", "at" }]`; `type`: `biggest-win` (największa pojedyncza wygrana) albo `balance` (najwyższe saldo) |
| `GET /api/feed/big-wins?limit=10` | ostatnie wygrane ≥ 15× zakładu: `[{ "nick", "avatarIndex", "gameCode", "gameName", "win", "multiplier", "tier", "at" }]` |
| `GET /api/reports/popular-games?days=7` | pytanie inwestora 1 |
| `GET /api/reports/rtp` | pytanie 2: `[{ "gameCode", "targetRtp", "actualRtp", "spins", "totalWagered", "totalWon" }]` |
| `GET /api/reports/top-players` | pytanie 3 |
| `GET /api/reports/economy` | pytanie 4: `{ "players", "bankruptPlayers", "coinsInCirculation", "totalWelcomeBonus", "totalRescueBonus" }` |
| `GET /api/reports/peak-hours` | pytanie 5: `[{ "hour", "spins", "averageBet" }]` |

Raporty są publiczne (tylko dane zbiorcze, bez danych osobowych) — świadome uproszczenie zamiast osobnego logowania administratora.

## 3. Assety w aplikacji

Wszystkie obrazy trafiają do aplikacji przez **jeden skrypt** (`tools/art/przetworz.py`), niezależnie od tego, czy źródłem jest
grafika z ChatGPT, czy grafika zastępcza:

```
art/zrodla/<pakiet>/<ID>.png        ← grafika od Was z ChatGPT (ma pierwszeństwo)
art/zastepcze/<pakiet>/<ID>.png     ← grafika zastępcza (Blender/Pillow), generowana skryptem
            │
            ▼  tools/art/przetworz.py
src/main/resources/static/assets/img/<pakiet>/<ID>.webp     (@1x)
src/main/resources/static/assets/img/<pakiet>/<ID>@2x.webp  (@2x, gdy źródło na to pozwala)
src/main/resources/static/assets/img/manifest.json
```

`<pakiet>`: `global`, `s1`, `s2`, `s3`. Makiety (`m*`) nie trafiają do aplikacji.

`manifest.json`:

```json
{
  "version": "2026-10-11T12:00:00Z",
  "images": {
    "s1_sym_siodemka": {
      "src": "s1/s1_sym_siodemka.webp",
      "src2x": "s1/s1_sym_siodemka@2x.webp",
      "w": 256, "h": 256,
      "source": "zastepcze",
      "blend": "normal"
    },
    "g_fx_flara": { "src": "global/g_fx_flara.webp", "w": 512, "h": 512, "source": "zastepcze", "blend": "add" }
  },
  "sheets": {
    "g_ui_ikony": { "cells": ["autoplay", "turbo", "minus", "plus", "dzwiek_wl", "dzwiek_wyl", "info", "menu", "lobby", "zamknij", "ustawienia", "historia"] }
  },
  "frames": {
    "s1_ramka": { "window": { "x": 0.19, "y": 0.19, "w": 0.625, "h": 0.625 } }
  },
  "nineSlice": {
    "g_ui_panel": { "top": 0.18, "right": 0.18, "bottom": 0.18, "left": 0.18 }
  }
}
```

* Arkusze (`SHEET`) są cięte na osobne pliki `<ID>__<nazwa_komórki>.webp` i opisane w `images`
  (np. `g_ui_ikony__turbo`); `sheets` podaje kolejność komórek.
* `frames.<ID>.window` — wykryte przezroczyste okno ramki bębnów (ułamki szerokości/wysokości obrazu).
* `nineSlice` — marginesy do `border-image` / `NineSliceSprite` (ułamki).
* `blend: "add"` — obraz z czarnym tłem do mieszania addytywnego (efekty świetlne).
* Front-end **zawsze** odwołuje się do obrazów przez ID z manifestu, nigdy przez ścieżkę wpisaną na sztywno.
  Dzięki temu podmiana grafiki zastępczej na Waszą to: wrzucić PNG do `art/zrodla/` → uruchomić skrypt → gotowe.

Audio analogicznie: `src/main/resources/static/assets/audio/<ID>.{webm,m4a}` + `assets/audio/manifest.json`
(`{ "sounds": { "<ID>": { "webm": "...", "m4a": "...", "loop": true, "duration": 1.84, "bus": "sfx" } } }`).

## 4. Podział katalogów (kto co zmienia)

| Katalog / plik | Właściciel |
|---|---|
| `src/main/java/**`, `src/test/java/pl/wsb/kasyno/**`, `src/test/resources/**` | backend |
| `src/main/resources/data.sql`, `application*.properties`, `pom.xml` | backend |
| `src/main/resources/static/**` (poza `assets/img`, `assets/audio`) | front-end |
| `src/main/resources/static/assets/img/**`, `art/**`, `tools/art/**` | pipeline grafiki |
| `src/main/resources/static/assets/audio/**`, `tools/audio/**` | pipeline dźwięku |
| `tools/e2e/**`, `tools/dev/**`, `tools/package.json`, `tools/vendor.mjs` | front-end |
| `docs/projekt/01–08` | dokumentacja projektowa |
| `src/test/java/pl/wsb/rules/**`, `.github/workflows/**`, `README.md`, `docs/*.html` | **prowadzący — nie zmieniamy** |

Strona startowa `static/index.html` musi zawsze zawierać wizytówkę projektu (autorzy, pomysł, persona, funkcje,
zmiany per LAB) i nie może zawierać tekstu `[uzupełnij` (reguła R1.04).

## Powiązane dokumenty

[`06-interfejs-ux.md`](06-interfejs-ux.md) · [`07-gry-i-matematyka.md`](07-gry-i-matematyka.md) ·
[`08-wydajnosc-i-jakosc.md`](08-wydajnosc-i-jakosc.md) · [`../plan-projektu.md`](../plan-projektu.md)
