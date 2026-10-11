# Stan prac i jak kontynuować

Ten plik pozwala dokończyć projekt w nowej sesji Claude Code, nawet jeśli bieżąca sesja się zatrzyma.
Wystarczy otworzyć repozytorium na gałęzi `claude/dazzling-bell-be3okd` i napisać: „kontynuuj według wip/STAN-PRAC.md”.

## Źródła prawdy

| Plik | Rola |
|---|---|
| `docs/projekt/00-brief.md` | wiążące decyzje: ID obrazów (93), zdarzeń (E01–E73), dźwięków, paleta, progi wygranych, tempo, wydajność, zespół |
| `docs/projekt/09-kontrakt-api-i-assetow.md` | kontrakt backend ↔ front: endpointy, kody błędów, **format odpowiedzi spinu (§ 2.4)**, manifest obrazów i audio, podział katalogów |
| `docs/plan-projektu.md` | plan całości, zgodność z wymaganiami kursu, etapy |
| `docs/projekt/01`–`05` | po recenzji: styl, lista obrazów, prompty ChatGPT, efekty, dźwięk |

## Co jest zrobione

| Część | Stan | Gdzie |
|---|---|---|
| LAB 01 (R1.01–R1.05) | gotowe, `mvn verify -Dlab=1` zielone | `pom.xml`, `pl.wsb.kasyno`, `data.sql`, `static/index.html` |
| Dokumenty 01–05 + prompty ChatGPT | po recenzji | `docs/projekt/` |
| Backend core (konta, logowanie nickiem, portfel, bonus 10 000, ratunek, ranking, raporty, ProblemDetail, sesja) | napisany, był w recenzji | `src/main/java/pl/wsb/kasyno/**` |
| Lobby (Zaloguj w prawym górnym rogu, modal, bonus powitalny, kafle, ranking, wizytówka R1.04), szkielet `gra.html`, atrapa API, smoke e2e | napisane, czekało na recenzję | `src/main/resources/static/**`, `tools/dev`, `tools/e2e` |
| Pipeline grafiki `tools/art/przetworz.py` + generatory grafiki zastępczej (Blender `bpy` + Pillow) | w budowie | `tools/art/**`, wynik w `static/assets/img/` |
| Dźwięki i muzyka (67 ID, Opus + AAC) | pierwsza wersja; do naniesienia poprawki z 05 § 8.4 | `tools/audio/**`, `static/assets/audio/` |
| Silniki 3 automatów w Javie + endpoint spinu + testy Monte Carlo + doc 07 | w budowie, zapisane jako łata | `wip/silniki-gier-java.patch` |
| Runtime gier w PixiJS + Cebulowy 777 + doc 10 | w budowie, zapisane jako łata | `wip/gra-s1-przegladarka.patch` |

## Co zostało (kolejność)

1. **Scalić łaty** z `wip/` (`git apply --3way`, baza `7f66301`), rozwiązać konflikty, `mvn -B verify -Dlab=1` zielone.
2. **Dokończyć recenzję backendu i lobby**: test curl (login → me → spin → saldo), smoke e2e na prawdziwym backendzie.
3. **Pipeline grafiki**: dokończyć generatory, uruchomić `przetworz.py`, poprawki z `wip/todo-integracja.md`.
4. **Dźwięk**: naniesienie zmian z 05 § 8.4 i przegenerowanie.
5. **Gry S2 „Złoty Faraon” i S3 „Kryształowa Kaskada”** na runtime z S1 (expandWild, free spins, cascade, applyMultiplier) wg 04 i kontraktu § 2.4.
6. **Integracja i weryfikacja**: e2e na backendzie, pomiary klatek z dławieniem CPU ×4, nagrania rozgrywki (Playwright + ffmpeg) do `static/assets/video/`, LAB 06 (zdarzenia, `@ConfigurationProperties`, `@Scheduled`, profile), `Dockerfile`.
7. **Dokumenty as-built**: 06 (interfejs), 07 (matematyka — z łaty silników), 08 (wydajność), 10 (runtime — z łaty S1), `docs/obrona/*` (uruchomienie, architektura, przewodnik po kodzie, pytania na obronę, podział pracy).
8. **Usunąć katalog `wip/`** po scaleniu.

## Środowisko (dla nowej sesji)

* Java 21, Maven, Node 22, Python 3 + NumPy + Pillow, ffmpeg, Chromium dla Playwright (`/opt/pw-browsers`, `playwright-core@1.56.1` z `executablePath`).
* Blender jako moduł: `pip install bpy` (Python 3.13, ok. 400 MB) — tylko do grafiki zastępczej.
* Commity kończyć liniami atrybucji jak w historii; push tylko na `claude/dazzling-bell-be3okd`.
