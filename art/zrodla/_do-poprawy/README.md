# Obrazy do poprawy

Pliki odłożone tutaj nie trafiają do gry (skrypt `tools/art/przetworz.py` czyta tylko foldery
`makiety/`, `global/`, `s1/`, `s2/`, `s3/`). Dopóki nie ma poprawionej wersji, gra używa grafiki zastępczej.

| Plik | Problem | Co zrobić |
|---|---|---|
| `g_win_epic_EIG-zamiast-EPIC.png` | górne słowo to „EIG”, a ma być „EPIC” | wygenerować ponownie i zapisać jako `art/zrodla/global/g_win_epic.png` |

Prompt poprawkowy (załącz ten plik jako obraz do edycji):

```text
Edit the attached image. The top word is misspelled "EIG". Change it to exactly "EPIC" - four letters:
E, P, I, C. Keep everything else identical: the same gold 3D beveled letters with violet fill, the same
violet flames, the same letter height, layout and position; the bottom word "WIN" unchanged.
Transparent background (true alpha, no checkerboard), 3:2 landscape 1536x1024, no other changes.
```
