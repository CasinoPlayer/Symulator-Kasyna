"""
raport.py — raport jakości po każdym uruchomieniu pipeline'u (02 § 8).

Po co to jest: po każdej paczce obrazów chcemy od razu wiedzieć, co pipeline naprawił sam (info), na co trzeba
spojrzeć (ostrzeżenie) i czego nie da się użyć (błąd), oraz ile ważą gry i lobby względem budżetów z briefu § 5.
Raport ma trzy postacie: tabela w konsoli, ``art/raport/raport.json`` (maszynowo) i ``art/raport/raport.html``
(miniatury na trzech tłach — jasna obwódka jest widoczna na ciemnym tle, ciemna na jasnym).
"""

from __future__ import annotations

import html
import json
import os
from dataclasses import asdict, dataclass, field
from pathlib import Path

POZIOMY = {"info": 0, "ostrzezenie": 1, "blad": 2}


@dataclass
class Wiersz:
    id: str
    zrodlo: str                    # chatgpt | zastepcze | brak
    plik_zrodla: str = ""
    rozmiar: str = ""              # np. "256×256 (+@2x)"
    waga: int = 0                  # suma bajtów wszystkich plików wynikowych
    waga_desktop: int = 0          # to, co pobiera desktop (@2x, największe tło)
    waga_telefon: int = 0          # to, co pobiera telefon (@1x, tło mobile)
    pliki: dict = field(default_factory=dict)
    uwagi: list = field(default_factory=list)       # [poziom, kod, tekst]
    metoda_alfy: str = ""

    @property
    def najgorszy(self) -> int:
        return max((POZIOMY[u[0]] for u in self.uwagi), default=-1)


def kb(n: int) -> str:
    return f"{n / 1024:,.0f} KB".replace(",", " ")


def mb(n: int) -> str:
    return f"{n / 1_000_000:.2f} MB".replace(".", ",")


def budzety(wiersze: dict[str, Wiersz], katalog_assetow, limity: dict) -> dict:
    """Waga lobby i każdej gry (gra = jej pakiet + część wspólna), w konfiguracji desktop i telefon."""
    def suma(paczki, pole):
        s = 0
        for a in katalog_assetow:
            w = wiersze.get(a.id)
            if w and any(p in a.paczki for p in paczki):
                s += getattr(w, pole)
        return s

    wynik = {}
    for nazwa, limit in limity.items():
        paczki = ("lobby",) if nazwa == "lobby" else (nazwa, "wspolne")
        wynik[nazwa] = {"desktop": suma(paczki, "waga_desktop"), "telefon": suma(paczki, "waga_telefon"),
                        "limit": limit}
    return wynik


def drukuj(wiersze: dict[str, Wiersz], bud: dict, czas: float) -> None:
    print()
    print(f"{'ID':<24} {'źródło':<10} {'rozmiar @1x':<22} {'waga':>9}  uwagi")
    print("-" * 110)
    for w in wiersze.values():
        uw = "; ".join(f"{u[1]} {u[2]}" for u in w.uwagi if u[0] != "info")
        znacznik = {2: "!!", 1: "! ", 0: "  ", -1: "  "}[w.najgorszy]
        print(f"{znacznik}{w.id:<22} {w.zrodlo:<10} {w.rozmiar:<22} {kb(w.waga):>9}  {uw}")
    print("-" * 110)
    chat = sum(1 for w in wiersze.values() if w.zrodlo == "chatgpt")
    zast = sum(1 for w in wiersze.values() if w.zrodlo == "zastepcze")
    brak = sum(1 for w in wiersze.values() if w.zrodlo == "brak")
    print(f"Źródła: {chat} × chatgpt, {zast} × zastepcze, {brak} × brak źródła · czas {czas:.0f} s")
    print("Budżety wagi (brief § 5; desktop = @2x i tło 2560 px, telefon = @1x i tło mobile):")
    for nazwa, b in bud.items():
        pd = b["desktop"] / b["limit"]
        pt = b["telefon"] / b["limit"]
        stan = "PRZEKROCZONY" if pd > 1 else ("blisko limitu" if pd >= 0.85 else "OK")
        print(f"  {nazwa:<6} desktop {mb(b['desktop'])} ({pd:.0%}) · telefon {mb(b['telefon'])} ({pt:.0%}) "
              f"· limit {mb(b['limit'])} → {stan}")


def zapisz_json(sciezka: Path, wiersze: dict[str, Wiersz], bud: dict, podsumowanie: dict) -> None:
    sciezka.parent.mkdir(parents=True, exist_ok=True)
    dane = {"podsumowanie": podsumowanie, "budzety": bud,
            "obrazy": {k: asdict(v) for k, v in wiersze.items()}}
    sciezka.write_text(json.dumps(dane, ensure_ascii=False, indent=1), encoding="utf-8")


def zapisz_html(sciezka: Path, wiersze: dict[str, Wiersz], katalog_img: Path, bud: dict, podsumowanie: dict) -> None:
    """Strona z miniaturami każdego pliku wynikowego na szachownicy, #07060F i bieli."""
    sciezka.parent.mkdir(parents=True, exist_ok=True)
    wzgl = os.path.relpath(katalog_img, sciezka.parent).replace(os.sep, "/")
    karty = []
    for w in wiersze.values():
        obrazki = []
        for nazwa in w.pliki:
            if not nazwa.endswith(".webp") or "@2x" in nazwa:
                continue
            src = f"{wzgl}/{nazwa}"
            obrazki.append(
                f'<figure><div class="t3"><img src="{src}" loading="lazy"><img src="{src}" loading="lazy">'
                f'<img src="{src}" loading="lazy"></div><figcaption>{html.escape(nazwa.split("/")[-1])} · '
                f'{kb(w.pliki[nazwa])}</figcaption></figure>')
        uwagi = "".join(f'<li class="{u[0]}">{html.escape(u[1])} {html.escape(u[2])}</li>' for u in w.uwagi)
        karty.append(f'<section class="karta p{w.najgorszy}"><h2>{w.id} <small>{w.zrodlo} · {w.rozmiar} · '
                     f'{kb(w.waga)}</small></h2><ul>{uwagi}</ul><div class="obrazy">{"".join(obrazki)}</div></section>')
    bud_html = "".join(
        f"<li>{n}: desktop {mb(b['desktop'])} / telefon {mb(b['telefon'])} (limit {mb(b['limit'])})</li>"
        for n, b in bud.items())
    strona = f"""<!doctype html><html lang="pl"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>Raport grafiki</title>
<style>
body{{background:#07060F;color:#C9C3E6;font:14px/1.4 system-ui,sans-serif;margin:16px}}
h1{{color:#FFE08A}} h2{{color:#FFE08A;font-size:16px;margin:0 0 6px}} small{{color:#C9C3E6;font-weight:400}}
.karta{{border:1px solid #1E1442;border-radius:10px;padding:12px;margin:12px 0;background:#120B2A}}
.p1{{border-color:#F5C542}} .p2{{border-color:#FF4D4D}}
.obrazy{{display:flex;flex-wrap:wrap;gap:10px}} figure{{margin:0}} figcaption{{font-size:11px}}
.t3{{display:flex}} .t3 img{{width:110px;height:110px;object-fit:contain;padding:4px}}
.t3 img:nth-child(1){{background:repeating-conic-gradient(#888 0 25%,#ccc 0 50%) 0 0/16px 16px}}
.t3 img:nth-child(2){{background:#07060F}} .t3 img:nth-child(3){{background:#fff}}
li.blad{{color:#FF4D4D}} li.ostrzezenie{{color:#F5C542}} li.info{{color:#8f8aa8}}
</style></head><body><h1>Raport pipeline'u grafiki</h1>
<p>{html.escape(json.dumps(podsumowanie, ensure_ascii=False))}</p><ul>{bud_html}</ul>{''.join(karty)}</body></html>"""
    sciezka.write_text(strona, encoding="utf-8")
