# Do zrobienia w integracji (zebrane z recenzji)

## Pipeline grafiki (tools/art) — z recenzji 02
- katalog.py TINT_S3: ametyst #A64DFF -> #C77DFF (symbol), #A64DFF tylko obrzeża
- Q23 budżet lobby liczony pesymistycznie (oba tła + k169) -> fałszywy błąd; liczyć realnie ładowane pliki
- Q30 brak pliku z manifestu: tylko konsola, nie zmienia kodu wyjścia -> ustawić kod wyjścia
- Brak Q02: pliki o złej nazwie / w złym folderze pomijane bez komunikatu -> ostrzeżenie z podpowiedzią
- Q04 tylko rozszerzenie -> sprawdzać sygnaturę PNG
- miara_obwodki (Q09) nieużywana -> podpiąć
- parametr pudelko przy s2_wild_rozszerzony nieużywany
- requirements.txt dla tools/art (pillow, numpy; bpy opcjonalnie)
- docstring katalog.py -> generuj_wszystko.py (sprawdzić czy istnieje)
- .gitignore: art/raport/ (ale NIE art/zrodla/ — zrodla zostają w repo)

## Dokumenty
- 04 otwarte kwestie 14-17 (przekazane recenzentowi 05)

## Dźwięk — odstępstwa do naniesienia w docs/projekt/05 (z raportu wykonawcy)
- sub pod C-dur: C2 zamiast 55 Hz (A1) w sfx_free_spins_koniec i sfx_bigwin_koniec
- gong: dodatkowa warstwa „blasku” 0,7–5,5 kHz poza 12 parcjałami
- chór w mus_s3_fs: cykl 3+3 takty (8 nie dzieli 12)
- Opus constrained VBR, AAC koder fast
- muzyka −14 LUFS (szyna 0,45 → ~−22 LUFS w sesji)
- front: audio-engine.js musi używać loopStart/loopEnd z manifestu (przekazane agentowi S1)

## Z recenzji pipeline'u grafiki (po przetworzeniu obrazów z ChatGPT)
- docs/projekt/02: zaktualizować § 7.1 (budżety wg orientacji, banery poza lobby, jakość q80/q78), Q02/Q04/Q07/Q11/Q15/Q16/Q30 (zaimplementowane/zmienione), wycinanie dziur § 5.4, Q09
- front: okna ramek mają proporcję siatki (s1_ramka 1210×1318 @1x) — wszystko z manifestu; g_logo bez src2x; efekty ciepłobiałe → kolor przez tint w kodzie (04 § 2.3)
- budżet lobby 86% (próg ostrzeżenia 85%) — ewentualnie AVIF w <picture>
- g_win_epic: po poprawce → art/zrodla/global/g_win_epic.png, potem `python3 tools/art/przetworz.py --tylko g_win_epic`
