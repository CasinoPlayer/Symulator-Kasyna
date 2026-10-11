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
