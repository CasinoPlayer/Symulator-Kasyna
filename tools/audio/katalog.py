"""
katalog.py — wiążąca lista 67 ID dźwięków z briefu (§ 10), w kolejności briefu, i ścieżki pipeline'u.
Kontrola A01 (sprawdz.py) porównuje manifest z tą listą: wszystkie ID muszą być i żadne inne.
"""

from __future__ import annotations

from pathlib import Path

KATALOG_NARZEDZI = Path(__file__).resolve().parent
REPO = KATALOG_NARZEDZI.parents[1]
KATALOG_AUDIO = REPO / "src" / "main" / "resources" / "static" / "assets" / "audio"
KATALOG_BUDOWY = KATALOG_NARZEDZI / "build"          # pliki pośrednie (WAV, raport) — w .gitignore
KATALOGI_ZRODEL = [REPO / "audio" / "zrodla", KATALOG_NARZEDZI / "zrodla"]   # pliki zewnętrzne (Suno, CC0)

WYMAGANE_ID = [
    # UI (8)
    "ui_hover", "ui_klik", "ui_otworz", "ui_zamknij", "ui_blad", "ui_przelacznik", "ui_zaklad_gora", "ui_zaklad_dol",
    # globalne (13)
    "sfx_logowanie", "sfx_skrzynia_otwarcie", "sfx_monety_fontanna",
    "sfx_moneta_1", "sfx_moneta_2", "sfx_moneta_3", "sfx_moneta_4", "sfx_moneta_5",
    "sfx_licznik_tik", "sfx_licznik_koniec", "sfx_saldo_puls", "sfx_bankrut", "sfx_przejscie_whoosh",
    # wspólne dla gier (27)
    "sfx_spin_start", "sfx_beben_petla_s1", "sfx_beben_petla_s2",
    "sfx_beben_stop_1", "sfx_beben_stop_2", "sfx_beben_stop_3", "sfx_beben_stop_4", "sfx_beben_stop_5",
    "sfx_beben_stop_6", "sfx_antycypacja_narastanie", "sfx_bicie_serca",
    "sfx_scatter_1", "sfx_scatter_2", "sfx_scatter_3", "sfx_wild",
    "sfx_wygrana_small_1", "sfx_wygrana_small_2", "sfx_wygrana_small_3", "sfx_wygrana_medium", "sfx_linia",
    "sfx_bigwin_wejscie", "sfx_poziom_w_gore", "sfx_bigwin_koniec", "sfx_blysk", "sfx_uderzenie_basu",
    "sfx_free_spins_start", "sfx_free_spins_koniec",
    # S1 (2), S2 (2), S3 (7)
    "sfx_s1_neon_bzyk", "sfx_s1_jackpot",
    "sfx_s2_wild_rozszerzenie", "sfx_s2_gong",
    "sfx_s3_pekniecie_1", "sfx_s3_pekniecie_2", "sfx_s3_pekniecie_3", "sfx_s3_pekniecie_4",
    "sfx_s3_opad", "sfx_s3_mnoznik", "sfx_s3_mnoznik_zbior",
    # muzyka (8 pętli)
    "mus_lobby", "mus_s1", "mus_s2", "mus_s2_fs", "mus_s3", "mus_s3_fs", "mus_bigwin", "mus_napiecie",
]

assert len(WYMAGANE_ID) == 67 and len(set(WYMAGANE_ID)) == 67


def wszystkie_przepisy() -> dict[str, dict]:
    """Rejestr przepisów: 59 efektów (dzwieki.py) + 8 utworów (muzyka.py), w kolejności briefu."""
    import dzwieki
    import muzyka
    razem = {**dzwieki.PRZEPISY, **muzyka.PRZEPISY_MUZYKI}
    return {i: razem[i] for i in WYMAGANE_ID if i in razem} | {i: p for i, p in razem.items() if i not in WYMAGANE_ID}
