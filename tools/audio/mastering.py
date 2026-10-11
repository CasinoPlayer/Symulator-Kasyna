"""
mastering.py — ostatni etap obróbki przed zapisem WAV (doc 05 § 7.4).

| Krok                       | Jednorazowe efekty        | Pętle efektów            | Muzyka                       |
|----------------------------|---------------------------|--------------------------|------------------------------|
| 1. składowa stała          | HP 20 Hz                  | HP 20 Hz (kołowo)        | HP 30 Hz (kołowo)            |
| 2. wejście / wyjście       | 2 ms / 5 ms               | brak (pętla)             | brak (pętla)                 |
| 3. korekcja                | —                         | —                        | −3 dB przy 3 kHz (Q 1), bas < 150 Hz w mono, kompresja szyny |
| 4. normalizacja            | szczyt prawdziwy −1 dBTP  | −18 LUFS                 | −14 LUFS                     |
| 5. ograniczenie szczytów   | —                         | limiter do sufitu        | limiter do sufitu            |

Wzmocnienie liczymy z pomiaru i stosujemy liniowo (bez dynamicznej normalizacji, która spłaszcza dynamikę).
Sufit limitera jest parametrem: pipeline obniża go, jeśli po zakodowaniu (Opus/AAC) szczyt przekroczy −1 dBTP.
"""

from __future__ import annotations

import numpy as np

import analiza
import dsp

CEL_LUFS_MUZYKA = -14.0        # doc 05 § 4.1 pkt 5 i § 5.7 (szyna music 0,45 → muzyka ≈ −22 LUFS w sesji)
CEL_LUFS_PETLA_SFX = -18.0     # doc 05 § 5.7
CEL_DBTP = -1.0                # szczyt prawdziwy wszystkich plików


def _normalizuj_lufs_z_limiterem(x, cel_lufs, sufit_db, okresowy=True, iteracje=4):
    """Wzmocnienie do celu LUFS + limiter; powtarzamy, bo limiter odrobinę obniża głośność."""
    y = x
    for _ in range(iteracje):
        g = analiza.lufs(y, okresowy=okresowy)
        y = y * dsp.db(cel_lufs - g)
        if analiza.dbtp(y) > sufit_db:
            y = dsp.limiter(y, sufit_db - 0.05, wyprzedzenie=0.004, zwolnienie=0.08, okresowy=okresowy)
        if abs(analiza.lufs(y, okresowy=okresowy) - cel_lufs) < 0.05:
            break
    # ostateczne zabezpieczenie: szczyt nigdy ponad sufit (statyczna korekta, jeśli trzeba)
    tp = analiza.dbtp(y)
    if tp > sufit_db:
        y = y * dsp.db(sufit_db - tp - 0.01)
    return y


def master_jednorazowy(x, sufit_db=CEL_DBTP, wejscie_ms=2.0, wyjscie_ms=5.0, syncpoint=0.0):
    """Efekt jednorazowy: HP 20 Hz, krótkie wejście/wyjście, szczyt prawdziwy = sufit."""
    y = dsp.hp(np.asarray(x, dtype=float), 20.0, rzad=1)
    y = dsp.wycisz(y, wejscie_ms / 1000.0, wyjscie_ms / 1000.0)
    tp = analiza.dbtp(y)
    return y * dsp.db(sufit_db - tp)


def master_petla_sfx(x, sufit_db=CEL_DBTP):
    """Pętla efektu: HP 20 Hz kołowo, −18 LUFS, limiter (kołowy) do sufitu."""
    y = dsp.hp(np.asarray(x, dtype=float), 20.0, rzad=1, okresowy=True)
    return _normalizuj_lufs_z_limiterem(y, CEL_LUFS_PETLA_SFX, sufit_db)


def master_muzyka(x, sufit_db=CEL_DBTP, cel_lufs=CEL_LUFS_MUZYKA):
    """Muzyka: HP 30 Hz, wycięcie −3 dB przy 3 kHz (miejsce dla efektów, doc 05 § 4.1 pkt 6), bas w mono,
    delikatna kompresja szyny („klej”), −14 LUFS, limiter z wyprzedzeniem na szczyt prawdziwy. Wszystko kołowo."""
    y = dsp.eq(dsp.stereo(x), [("hp", 30.0, 0.7071, 0.0), ("peak", 3000.0, 1.0, -3.0)], okresowy=True)
    y = dsp.bas_mono(y, 150.0, okresowy=True)
    y = y * dsp.db(-16.0 - analiza.lufs(y, okresowy=True))
    y = dsp.kompresor(y, prog_db=-14.0, stosunek=2.0, atak=0.02, zwolnienie=0.25, kolano_db=8.0, okresowy=True)
    return _normalizuj_lufs_z_limiterem(y, cel_lufs, sufit_db)


def master_napiecie(x, sufit_db=CEL_DBTP):
    """Warstwa napięcia (muzyka bez pulsu): jak muzyka, ale bez kompresji szyny i bez wycięcia 3 kHz."""
    y = dsp.eq(dsp.stereo(x), [("hp", 30.0, 0.7071, 0.0)], okresowy=True)
    y = dsp.bas_mono(y, 150.0, okresowy=True)
    return _normalizuj_lufs_z_limiterem(y, CEL_LUFS_MUZYKA, sufit_db)
