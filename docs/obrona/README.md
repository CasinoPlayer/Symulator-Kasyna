# Dokumentacja do obrony — Cebulion Casino

Komplet materiałów, z którymi każda osoba z zespołu (Konrad Paulus 112960, Dominik Pacanowski 112961,
Dawid Majewski 113154) może uruchomić projekt, oprowadzić po kodzie i odpowiedzieć na pytania prowadzącego.
Wszystko opisuje **rzeczywisty kod** z odnośnikami `plik:linia` (stan z 2026-10-11).

| Plik | Co tam jest | Kiedy czytać |
|---|---|---|
| [`00-uruchomienie.md`](00-uruchomienie.md) | IntelliJ, Maven, profile `dev`/`demo`/`prod`, Docker, Render, testy, problemy | przed pierwszym uruchomieniem i przed obroną |
| [`01-architektura.md`](01-architektura.md) | diagramy: warstwy, moduły, ERD, logowanie, spin, cykl życia rundy, zdarzenia LAB 06 | żeby zobaczyć całość |
| [`02-przewodnik-po-kodzie.md`](02-przewodnik-po-kodzie.md) | mapa „gdzie czego szukać”, pakiet po pakiecie, klasa po klasie, trasa spinu przez kod | do chodzenia po plikach na obronie |
| [`03-silnik-gier.md`](03-silnik-gier.md) | losowanie (seed, `SplittableRandom`), taśmy, linie, klastry, kaskady, darmowe spiny, mnożniki, limit, RTP i Monte Carlo | pytania o matematykę i uczciwość gry |
| [`04-front-efekty-dzwiek.md`](04-front-efekty-dzwiek.md) | lobby i logowanie w przeglądarce, SPIN → `StepPlayer` → saldo, fizyka bębnów, cząsteczki, błyski, drżenie, Big Win, poziomy jakości, dźwięk (Web Audio, pętle, `keyTrack`, `syncPoint`), skąd grafika i dźwięk, 10 pytań o front (S2/S3 — po scaleniu) | pytania o front, efekty i dźwięk |
| [`05-decyzje-projektowe.md`](05-decyzje-projektowe.md) | 14 decyzji (ADR): kontekst → decyzja → konsekwencje → alternatywy | pytania „dlaczego tak?” |
| [`06-pytania-na-obrone.md`](06-pytania-na-obrone.md) | 58 pytań z odpowiedziami i „pokaż w kodzie” | do ćwiczenia |
| [`07-podzial-pracy.md`](07-podzial-pracy.md) | propozycja podziału obrony, przebieg pokazu, ściąga dla każdej osoby (10 punktów + komendy) | na koniec, przed obroną |

**Najkrótsza ścieżka przygotowania:** 00 (uruchom) → 07 (swoja ściąga) → 02 § 0 i § 9 (mapa i trasa spinu) →
06 (pytania ze swojego zakresu) → 05 (ADR-y ze swojego zakresu).

Powiązane: [`../plan-projektu.md`](../plan-projektu.md) (plan i zgodność z wymaganiami kursu) ·
[`../projekt/README.md`](../projekt/README.md) (dokumentacja projektowa: brief, grafika, efekty, dźwięk, matematyka,
kontrakt API, runtime gier).
