# art/zrodla — grafika z ChatGPT (źródła PNG)

Tu trafiają **oryginalne pliki PNG z ChatGPT** wygenerowane według promptów z
[`docs/projekt/03-prompty-chatgpt.md`](../../docs/projekt/03-prompty-chatgpt.md). Mają pierwszeństwo przed grafiką
zastępczą: wrzucasz plik → uruchamiasz pipeline → aplikacja od razu pokazuje Twoją grafikę.

## Jak wrzucić pliki

1. W ChatGPT pobierz **oryginalny PNG** (przycisk pobierania w przeglądarce na komputerze — nie zrzut ekranu,
   nie „kopiuj obraz”, nie zdjęcie z komunikatora).
2. Nazwij plik **dokładnie** identyfikatorem obrazu: `<ID>.png`, np. `s1_sym_wild.png`, `g_logo.png`
   (pełna lista 85 ID: [`docs/projekt/02-lista-obrazow.md`](../../docs/projekt/02-lista-obrazow.md) § 3,
   w kodzie: [`tools/art/katalog.py`](../../tools/art/katalog.py)).
3. Włóż go do folderu wynikającego z prefiksu ID:

   | Prefiks ID | Folder |
   |---|---|
   | `g_…` | `art/zrodla/global/` |
   | `s1_…` | `art/zrodla/s1/` |
   | `s2_…` | `art/zrodla/s2/` |
   | `s3_…` | `art/zrodla/s3/` |
   | `m01`–`m08` (makiety) | `art/zrodla/makiety/` — tylko referencje stylu, pipeline je pomija |

4. Poprawiona wersja tego samego obrazu: `<ID>.v2.png`, `<ID>.v3.png` — pipeline bierze **najwyższy numer**
   (`<ID>.png` liczy się jak wersja 0). Plik `.webp` / `.jpg` też zadziała, ale z ostrzeżeniem.
5. Uruchom pipeline (szczegóły: [`tools/art/README.md`](../../tools/art/README.md)):

   ```bash
   python3 tools/art/przetworz.py --tylko s1      # albo konkretne ID: --tylko s1_sym_wild,s1_logo
   ```

   Wynik trafia do `src/main/resources/static/assets/img/` i `manifest.json`; raport z ewentualnymi poprawkami
   do zrobienia w ChatGPT: `art/raport/raport.html`.

## Czego pipeline się nie boi (naprawia sam)

* **narysowana szachownica** zamiast prawdziwej przezroczystości (także przeskalowana i lekko rozmyta),
* **jednolite tło** (białe, czarne, zielone `#00FF00`…) zamiast przezroczystości — także „dziury” w obiekcie
  i zamalowane okno ramki,
* jasne obwódki (halo) na krawędziach, drobne „pyłki” w alfie,
* nierówna siatka arkuszy (ikony, awatary, cyfry) — elementy są wyszukiwane automatycznie,
* inny rozmiar niż 1024×1024 / 1536×1024 / 1024×1536 (ostrzeżenie, ale obraz jest przetwarzany).

Zamieniona orientacja (np. 1024×1536 zamiast 1536×1024) albo tło, którego nie da się rozpoznać, to **błąd** —
taki obraz trzeba wygenerować ponownie (raport podpowie, co poprawić).

## Gdzie trzymać duże paczki

Surowe PNG ważą 1–3,5 MB każdy (≈ 200 MB za komplet). Zalecana jest osobna gałąź `grafika-zrodla` — opis i
polecenia w [`02-lista-obrazow.md` § 4.4](../../docs/projekt/02-lista-obrazow.md). Puste foldery utrzymują w repo
pliki `.gitkeep`.
