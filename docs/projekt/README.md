# Dokumentacja projektowa Cebulion Casino

Tu jest szczegółowy opis oprawy i działania gry: jak ma wyglądać, jak brzmieć, jakie obrazy wygenerować w ChatGPT,
jak działają efekty i automaty. Ogólny plan projektu i wymagania przedmiotu są w [`../plan-projektu.md`](../plan-projektu.md).

## Od czego zacząć

| Jeśli chcesz… | Czytaj |
|---|---|
| **wygenerować grafikę w ChatGPT** (teraz najważniejsze) | [`03-prompty-chatgpt.md`](03-prompty-chatgpt.md), a listę plików w [`02-lista-obrazow.md`](02-lista-obrazow.md) |
| zrozumieć styl i ocenić, czy wygenerowany obraz pasuje | [`01-kierunek-artystyczny.md`](01-kierunek-artystyczny.md) |
| wiedzieć, co dzieje się na ekranie przy każdym zdarzeniu (błyski, cząsteczki, drżenie) | [`04-efekty-wizualne.md`](04-efekty-wizualne.md) |
| wiedzieć, jaki dźwięk gra w którym momencie i jak powstaje | [`05-dzwiek-i-muzyka.md`](05-dzwiek-i-muzyka.md) |
| zobaczyć wszystkie ekrany, przyciski, teksty i zachowanie na telefonie | [`06-interfejs-ux.md`](06-interfejs-ux.md) |
| zrozumieć zasady i matematykę trzech automatów oraz format odpowiedzi API | [`07-gry-i-matematyka.md`](07-gry-i-matematyka.md) |
| wiedzieć, jak gra osiąga 60 fps i jak to mierzymy | [`08-wydajnosc-i-jakosc.md`](08-wydajnosc-i-jakosc.md) |

## Wspólny język dokumentów

Wszystkie dokumenty używają tych samych identyfikatorów, żeby dało się je łączyć:

| Identyfikator | Przykład | Znaczenie |
|---|---|---|
| ID obrazu | `s2_sym_anubis`, `g_win_mega`, `m01_lobby_desktop` | plik z ChatGPT (`s2_sym_anubis.png`); prefiks: `m` makieta, `g` globalny, `s1`–`s3` gra |
| ID zdarzenia | `E30 wygrana_big` | moment w grze, dla którego opisujemy efekt (04), dźwięk (05) i zachowanie UI (06) |
| ID dźwięku | `sfx_beben_stop_3`, `mus_s2_fs` | plik audio; prefiks: `ui` interfejs, `sfx` efekt, `mus` muzyka |
| Kod gry | `cebulowy-777`, `zloty-faraon`, `krysztalowa-kaskada` | adres w API, np. `POST /api/slots/zloty-faraon/spins` |

## Liczby, które warto znać na pamięć

* **93 obrazy** do wygenerowania: 8 makiet (referencje stylu) + 85 assetów w aplikacji, w 6 czatach ChatGPT.
* **3 automaty:** Cebulowy 777 (3×3, 5 linii, RTP ~95%), Złoty Faraon (5×3, 20 linii, ~96%),
  Kryształowa Kaskada (6×5, klastry, ~96%).
* **Progi wygranych:** small < 5× zakładu, medium ≥ 5×, BIG ≥ 15×, MEGA ≥ 30×, EPIC ≥ 60×, ULTRA ≥ 100×.
* **Start:** 10 000 cebulionów; bonus ratunkowy 10 000 raz na 10 minut, gdy saldo spadnie poniżej minimalnego zakładu.
* **Płynność:** 60 fps, 3 poziomy jakości (High / Medium / Low) przełączane automatycznie; maks. 3 błyski ekranu na sekundę.
