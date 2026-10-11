# Dokumentacja projektowa Cebulion Casino

Tu jest szczegółowy opis oprawy i działania gry: jak ma wyglądać, jak brzmieć, jakie obrazy wygenerować w ChatGPT,
jak działają efekty i automaty, jaki jest kontrakt między serwerem a przeglądarką. Ogólny plan projektu i wymagania
przedmiotu są w [`../plan-projektu.md`](../plan-projektu.md), a dokumentacja **do obrony** (uruchomienie, architektura,
przewodnik po kodzie, pytania) w [`../obrona/`](../obrona/README.md).

## Spis dokumentów

| Plik | Zawartość | Stan |
|---|---|---|
| [`00-brief.md`](00-brief.md) | **źródło prawdy**: wiążące ID obrazów (93), zdarzeń (E01–E73) i dźwięków (67), progi wygranych, tempo, budżety wydajności, zespół | wiążący |
| [`01-kierunek-artystyczny.md`](01-kierunek-artystyczny.md) | biblia stylu: paleta, światło, materiały, symbole, tła, ramki, kotwice stylu | po recenzji |
| [`02-lista-obrazow.md`](02-lista-obrazow.md) | pełny manifest 93 obrazów, jak je dostarczyć, pipeline `tools/art/przetworz.py`, budżety wagi, raport jakości | **as-built** (pipeline 1.0.0; 93/93 dostarczone, `g_win_epic` do poprawy) |
| [`03-prompty-chatgpt.md`](03-prompty-chatgpt.md) | gotowe prompty do 6 czatów ChatGPT i prompty poprawkowe | wykorzystane (komplet wygenerowany) |
| [`04-efekty-wizualne.md`](04-efekty-wizualne.md) | biblia efektów: systemy (cząsteczki, błyski, drżenie), karty zdarzeń E01–E73, choreografia Big Win, poziomy jakości | specyfikacja; realizacja w 10 |
| [`05-dzwiek-i-muzyka.md`](05-dzwiek-i-muzyka.md) | biblia dźwięku: 59 efektów + 8 pętli, Web Audio, miks, mapowanie zdarzeń, pipeline syntezy; odstępstwa wykonania § 8.10 | specyfikacja + stan wykonania |
| [`06-interfejs-ux.md`](06-interfejs-ux.md) | ekrany i przepływ, komponenty i stany, breakpointy i układy telefonu, dostępność, wszystkie teksty i komunikaty błędów, walidacja nazwy (front i backend), elementy → ID obrazów → zdarzenia E | **as-built** (lobby, logowanie, strona gry S1; S2/S3 — po scaleniu) |
| [`07-gry-i-matematyka.md`](07-gry-i-matematyka.md) | trzy automaty tak, jak są zaimplementowane: zasady, tabele wypłat, taśmy, wagi, RTP z testów Monte Carlo, format odpowiedzi spinu | **as-built** |
| [`08-wydajnosc-i-jakosc.md`](08-wydajnosc-i-jakosc.md) | budżety i faktyczne wagi, architektura renderu, ładowanie, poziomy jakości i automat (dokładnie z kodu), strażnik błysków, cykl życia, cache, pułapki przeglądarek, pomiary e2e, checklista | **as-built** (pomiary z 2026-10-11 w WebGL programowym; 60 fps do potwierdzenia na urządzeniu) |
| [`09-kontrakt-api-i-assetow.md`](09-kontrakt-api-i-assetow.md) | kontrakt backend ↔ front: endpointy, kody błędów, format spinu (§ 2.4), manifesty obrazów i audio, kto zmienia które katalogi | wiążący |
| [`10-runtime-gier.md`](10-runtime-gier.md) | runtime gier w PixiJS (pętla, zasoby, bębny, kroki, efekty, jakość, dźwięk), gra S1, wyniki e2e i pomiarów | **as-built** (S1; S2/S3 w toku) |
| [`../obrona/`](../obrona/README.md) | dokumentacja do obrony: 00 uruchomienie, 01 architektura, 02 przewodnik po kodzie, 03 silnik gier, 04 front, efekty i dźwięk, 05 decyzje (ADR), 06 pytania, 07 podział i ściągi | gotowa (w 04 sekcje S2/S3 — po scaleniu) |

## Od czego zacząć

| Jeśli chcesz… | Czytaj |
|---|---|
| sprawdzić, co jest wiążące (ID, progi, budżety) | [`00-brief.md`](00-brief.md) |
| poprawić albo dogenerować obraz w ChatGPT | [`03-prompty-chatgpt.md`](03-prompty-chatgpt.md), stan dostaw w [`02-lista-obrazow.md`](02-lista-obrazow.md) § 0 |
| zrozumieć styl i ocenić, czy wygenerowany obraz pasuje | [`01-kierunek-artystyczny.md`](01-kierunek-artystyczny.md) |
| wiedzieć, co dzieje się na ekranie przy każdym zdarzeniu (błyski, cząsteczki, drżenie) | [`04-efekty-wizualne.md`](04-efekty-wizualne.md), w kodzie: [`10-runtime-gier.md`](10-runtime-gier.md) |
| wiedzieć, jaki dźwięk gra w którym momencie i jak powstaje | [`05-dzwiek-i-muzyka.md`](05-dzwiek-i-muzyka.md) |
| zrozumieć zasady i matematykę trzech automatów | [`07-gry-i-matematyka.md`](07-gry-i-matematyka.md) |
| pisać front albo backend zgodnie z API | [`09-kontrakt-api-i-assetow.md`](09-kontrakt-api-i-assetow.md) |
| dodać grę S2/S3 na wspólnym runtime | [`10-runtime-gier.md`](10-runtime-gier.md) § 10 |
| przygotować się do obrony | [`../obrona/README.md`](../obrona/README.md) |

## Wspólny język dokumentów

Wszystkie dokumenty używają tych samych identyfikatorów, żeby dało się je łączyć:

| Identyfikator | Przykład | Znaczenie |
|---|---|---|
| ID obrazu | `s2_sym_anubis`, `g_win_mega`, `m01_lobby_desktop` | plik z ChatGPT (`s2_sym_anubis.png`); prefiks: `m` makieta, `g` globalny, `s1`–`s3` gra |
| ID zdarzenia | `E30 wygrana_big` | moment w grze, dla którego opisujemy efekt (04), dźwięk (05) i zachowanie UI (06) |
| ID dźwięku | `sfx_beben_stop_3`, `mus_s2_fs` | plik audio; prefiks: `ui` interfejs, `sfx` efekt, `mus` muzyka |
| Kod gry | `cebulowy-777`, `zloty-faraon`, `krysztalowa-kaskada` | adres w API, np. `POST /api/slots/zloty-faraon/spins` |

## Liczby, które warto znać na pamięć

* **93 obrazy** z ChatGPT: 8 makiet (referencje stylu) + 85 assetów w aplikacji, w 6 czatach — wszystkie dostarczone;
  w aplikacji 84 z ChatGPT + `g_win_epic` zastępczy do czasu poprawki.
* **3 automaty:** Cebulowy 777 (3×3, 5 linii, RTP 94,89% dokładnie), Złoty Faraon (5×3, 20 linii, 96,18% w 10 mln
  rund), Kryształowa Kaskada (6×5, klastry, 96,28% w 14 mln rund) — szczegóły w 07.
* **Progi wygranych:** small < 5× zakładu, medium ≥ 5×, BIG ≥ 15×, MEGA ≥ 30×, EPIC ≥ 60×, ULTRA ≥ 100×.
* **Start:** 10 000 cebulionów; bonus ratunkowy 10 000 raz na 10 minut, gdy saldo spadnie poniżej minimalnego zakładu.
* **Płynność:** 60 fps, 3 poziomy jakości (High / Medium / Low) przełączane automatycznie; maks. 3 błyski ekranu na sekundę.
* **Wagi:** lobby 2,58 MB z 3 MB (86%), gry 3,55–4,67 MB z 6 MB; dźwięk: 67 plików × 2 formaty (Opus + AAC).
