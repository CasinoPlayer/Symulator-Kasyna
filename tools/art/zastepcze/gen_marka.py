"""
gen_marka.py — obrazy marki z renderów Blendera: emblemat, moneta (3 ujęcia), maskotka (3 pozy), skrzynia,
arkusz awatarów. Render 3D kładziemy na płótnie w formacie ChatGPT (obiekt ~82–84% kadru, margines ≥ 6%),
tak jak przyjdzie docelowa grafika — dzięki temu pipeline przetwarza oba rodzaje źródeł tak samo.
"""

from __future__ import annotations

import biblioteka as B


def _z_renderu(nazwa, w=1024, h=1024, wyp=0.84, dy=0.0):
    return lambda: B.wpasuj(B.render(nazwa), w, h, wyp, dy)


def g_awatary():
    r = B.render("awatary")
    return B.skaluj(r, 1536, 1024)


GENERATORY = {
    "g_emblemat": _z_renderu("emblemat", wyp=0.84),
    "g_moneta_przod": _z_renderu("moneta_przod", wyp=0.8),
    "g_moneta_skos": _z_renderu("moneta_skos", wyp=0.8),
    "g_moneta_bok": _z_renderu("moneta_bok", wyp=0.8),
    "g_maskotka_powitanie": _z_renderu("maskotka_powitanie", wyp=0.82),
    "g_maskotka_wygrana": _z_renderu("maskotka_wygrana", wyp=0.84),
    "g_maskotka_bankrut": _z_renderu("maskotka_bankrut", wyp=0.82),
    "g_skrzynia": _z_renderu("skrzynia", wyp=0.82),
    "g_awatary": g_awatary,
}
