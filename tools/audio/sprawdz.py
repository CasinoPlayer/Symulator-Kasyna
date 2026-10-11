#!/usr/bin/env python3
"""
sprawdz.py — kontrola jakości audio bez słuchania (doc 05 § 8.6): komplet ID, pliki, długości, szczyt
prawdziwy (WAV i po dekodowaniu WebM/M4A), głośność LUFS (własny pomiar BS.1770 + ffmpeg ebur128),
składowa stała, cisza na początku, szwy pętli (na plikach zdekodowanych — tak gra przeglądarka),
korelacja stereo, budżety wagi i pamięci. Wynik: tabela w terminalu i tools/audio/build/raport.md.

    python3 tools/audio/sprawdz.py
    python3 tools/audio/sprawdz.py --spektrogramy /tmp/spektro --ids sfx_wild,mus_s1   # PNG do obejrzenia

Kody wyjścia: 0 — w porządku, 1 — ostrzeżenia, 2 — błędy.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))

import analiza  # noqa: E402
import dsp  # noqa: E402
import eksport  # noqa: E402
import katalog  # noqa: E402
from dsp import SR  # noqa: E402

BUDZET_SIEC = {"lobby": (0.8, 1.1), "s1": (1.8, 2.4), "s2": (1.8, 2.4), "s3": (1.8, 2.4)}   # MB (Opus, AAC)
BUDZET_PAMIEC = {"lobby": 24.0, "s1": 56.0, "s2": 56.0, "s3": 56.0}                          # MB po dekodowaniu
BUDZET_CALOSC_OPUS = 4.0                                                                       # MB, cała gra
LIMIT_EFEKT_KB, LIMIT_STINGER_KB, LIMIT_UTWOR_KB = 40, 60, 600
MB = 1024 * 1024


def strony(wpis: dict) -> list[str]:
    """Na których stronach silnik pobiera dany dźwięk (reguły pakietów, doc 05 § 2.4): lobby — pakiety `ui`
    i `lobby`; strona gry N — `ui`, `gry-krytyczne`, `gry-dalsze` albo `sN`, ale NIE wpisy z pakietem innej gry
    (np. `mus_s2_fs` ma ["s2", "gry-dalsze"] i nie liczy się do strony S3)."""
    p = set(wpis.get("packs") or [wpis.get("pack", "gry-dalsze")])
    wynik = []
    if p & {"ui", "lobby"}:
        wynik.append("lobby")
    for g in ("s1", "s2", "s3"):
        inne = {"s1", "s2", "s3"} - {g}
        if p & {"ui", "gry-krytyczne", "gry-dalsze", g} and not p & inne:
            wynik.append(g)
    return wynik


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--katalog", default=str(katalog.KATALOG_AUDIO))
    ap.add_argument("--wav", default=str(katalog.KATALOG_BUDOWY / "wav"))
    ap.add_argument("--raport", default=str(katalog.KATALOG_BUDOWY / "raport.md"))
    ap.add_argument("--json", default=str(katalog.KATALOG_BUDOWY / "raport.json"))
    ap.add_argument("--spektrogramy", default=None, help="katalog na spektrogramy PNG (z plików WebM)")
    ap.add_argument("--ids", default=None, help="ID do spektrogramów (po przecinku); domyślnie wybrane kluczowe")
    a = ap.parse_args(argv)
    kat = Path(a.katalog)
    manifest = json.loads((kat / "manifest.json").read_text(encoding="utf-8"))
    dzwieki = manifest["sounds"]
    bledy, ostrz = [], []
    przepisy = katalog.wszystkie_przepisy()

    # A01 — komplet ID
    brak = [i for i in katalog.WYMAGANE_ID if i not in dzwieki]
    nadmiar = [i for i in dzwieki if i not in katalog.WYMAGANE_ID]
    if brak:
        bledy.append(f"A01 brak ID w manifeście: {', '.join(brak)}")
    if nadmiar:
        bledy.append(f"A01 ID spoza briefu: {', '.join(nadmiar)}")

    wiersze = []
    for id_, w in dzwieki.items():
        r = {"id": id_, "uwagi": []}
        webm, m4a = kat / w["webm"], kat / w["m4a"]
        # A02 — pliki
        if not webm.exists() or not m4a.exists():
            bledy.append(f"A02 {id_}: brak pliku")
            continue
        k = w.get("channels", 1)
        dw = eksport.dekoduj(webm, k)
        dm = eksport.dekoduj(m4a, k)
        wav_p = Path(a.wav) / f"{id_}.wav"
        x = dsp.wczytaj_wav(wav_p) if wav_p.exists() else dw
        petla = bool(w.get("loop"))
        r.update(czas=x.shape[-1] / SR, kanaly=k, kb_webm=webm.stat().st_size / 1024, kb_m4a=m4a.stat().st_size / 1024)
        # A03 — długość (manifest ↔ WAV ↔ zdekodowane pliki)
        n_wav = x.shape[-1]
        for nazwa, d in (("webm", dw), ("m4a", dm)):
            roz = d.shape[-1] - n_wav
            r[f"roznica_{nazwa}"] = roz
            # AAC: dekoder ffmpeg nie odcina dopełnienia ostatniej ramki (1024 próbki) mimo listy edycji — na końcu
            # zostaje < 1024 próbek ciszy (doc 05 § 7.3). To nie błąd, jeśli dopełnienie jest ciche; pętle i tak
            # grają między loopStart a loopEnd, więc cisza za loopEnd nie trafia do szwu.
            if nazwa == "m4a" and 0 < roz < 1024:
                r["uwagi"].append(f"m4a +{roz} próbek dopełnienia ramki AAC" + (" (za loopEnd)" if petla else ""))
            elif abs(roz) > n_probek_ms(5):
                bledy.append(f"A03 {id_}: {nazwa} ma {roz:+d} próbek względem WAV")
            elif roz != 0:
                r["uwagi"].append(f"{nazwa} {roz:+d} próbek")
        if abs(w["duration"] - n_wav / SR) > 0.005:
            bledy.append(f"A03 {id_}: duration w manifeście {w['duration']} ≠ {n_wav / SR:.4f} s")
        p = przepisy.get(id_)
        dl_wlasciwa = (w["loopEnd"] - w["loopStart"]) if petla else n_wav / SR
        if p and w.get("source") == "synteza" and abs(p["dlugosc"] - dl_wlasciwa) > 0.005:
            bledy.append(f"A03 {id_}: długość {dl_wlasciwa:.3f} s ≠ przepis {p['dlugosc']} s")
        ls, le = (n_probek_s(w.get("loopStart", 0.0)), n_probek_s(w.get("loopEnd", w["duration"]))) if petla \
            else (0, n_wav)
        # A04 — szczyt prawdziwy
        r["tp_wav"], r["tp_webm"], r["tp_m4a"] = analiza.dbtp(x), analiza.dbtp(dw), analiza.dbtp(dm)
        for nazwa in ("tp_wav", "tp_webm", "tp_m4a"):
            if r[nazwa] > -1.0 + 0.005:
                (bledy if nazwa != "tp_m4a" else ostrz).append(f"A04 {id_}: {nazwa} = {r[nazwa]:.2f} dBTP > −1")
        # A05 — LUFS (pętle i muzyka) — własny pomiar + ffmpeg ebur128 na WAV
        r["lufs"] = analiza.lufs(x[..., ls:le], okresowy=petla)          # pętla: sam fragment loopStart…loopEnd,
        r["lufs_webm"] = analiza.lufs(dw[..., ls:le], okresowy=petla)    # powielony do ≥ 4 s
        ff = eksport.ebur128(wav_p if wav_p.exists() else webm)
        r["lufs_ffmpeg"], r["tp_ffmpeg"] = ff["I"], ff["TP"]
        r["chwilowa"] = analiza.glosnosc_chwilowa_max(x)
        if petla:
            cel = -14.0 if w["bus"] == "music" else -18.0
            if abs(r["lufs"] - cel) > 0.5:
                bledy.append(f"A05 {id_}: {r['lufs']:.2f} LUFS (cel {cel} ±0,5)")
        if np.isfinite(r["lufs_ffmpeg"]) and np.isfinite(r["lufs"]) and abs(r["lufs_ffmpeg"] - r["lufs"]) > 0.6 \
                and n_wav / SR > 3:
            ostrz.append(f"A05 {id_}: pomiar własny {r['lufs']:.1f} vs ffmpeg {r['lufs_ffmpeg']:.1f} LUFS")
        # A06 — składowa stała, RMS
        r["dc"] = analiza.dc_db(x[..., ls:le])           # pętla: średnia z pełnego okresu (bez zakładek)
        r["rms"] = analiza.rms_db(x[..., ls:le])
        if r["dc"] > -60:
            ostrz.append(f"A06 {id_}: składowa stała {r['dc']:.1f} dBFS")
        # A07 — cisza na początku (jednorazowe, poza zamierzonym narastaniem przed syncPoint)
        if not petla:
            m = np.abs(dsp.mono(x))
            prog = m.max() * dsp.db(-40)
            start = int(np.argmax(m > prog)) / SR
            r["cisza_ms"] = start * 1000
            if start > 0.005 and not w.get("syncPoint"):
                ostrz.append(f"A07 {id_}: cisza na początku {start * 1000:.1f} ms")
        # A08 — szew pętli: WAV i pliki zdekodowane (fragment loopStart…loopEnd)
        if petla:
            szwy = {}
            for nazwa, d in (("wav", x), ("webm", dw), ("m4a", dm)):
                szwy[nazwa] = analiza.szew_petli(d[..., ls:min(le, d.shape[-1])])
            r["szew"] = szwy
            for nazwa, s in szwy.items():
                if s["wsp_predykcji"] > 2.0:
                    (bledy if nazwa != "m4a" else ostrz).append(
                        f"A08 {id_}: szew ({nazwa}) wsp. predykcji {s['wsp_predykcji']:.2f} > 2 — możliwy trzask")
        # A09 — stereo
        if k == 2:
            r["korelacja"], r["spadek_mono"] = analiza.korelacja_stereo(x)
            if r["korelacja"] < 0.3 or r["spadek_mono"] > 3.0:
                ostrz.append(f"A09 {id_}: korelacja L/P {r['korelacja']:.2f}, spadek mono {r['spadek_mono']:.1f} dB")
        # A12 — limity pojedynczych plików
        limit = LIMIT_UTWOR_KB if w["bus"] == "music" else (LIMIT_STINGER_KB if k == 2 else LIMIT_EFEKT_KB)
        if r["kb_webm"] > limit:
            ostrz.append(f"A12 {id_}: {r['kb_webm']:.0f} KB > {limit} KB (Opus)")
        r["strony"] = strony(w)
        r["pamiec_mb"] = n_wav * k * 4 / MB
        wiersze.append(r)

    # A10, A11, A13 — budżety
    budzety = {}
    for s in ("lobby", "s1", "s2", "s3"):
        sel = [r for r in wiersze if s in r["strony"]]
        opus = sum(r["kb_webm"] for r in sel) / 1024
        aac = sum(r["kb_m4a"] for r in sel) / 1024
        pam = sum(r["pamiec_mb"] for r in sel)
        budzety[s] = (opus, aac, pam, len(sel))
        b_o, b_a = BUDZET_SIEC[s]
        for nazwa, v, lim in (("Opus", opus, b_o), ("AAC", aac, b_a), ("pamięć", pam, BUDZET_PAMIEC[s])):
            if v > lim:
                bledy.append(f"A10/A11 strona {s}: {nazwa} {v:.2f} MB > {lim} MB")
            elif v > 0.85 * lim:
                ostrz.append(f"A13 strona {s}: {nazwa} {v:.2f} MB = {v / lim:.0%} budżetu {lim} MB")
    calosc_opus = sum(r["kb_webm"] for r in wiersze) / 1024
    calosc_aac = sum(r["kb_m4a"] for r in wiersze) / 1024
    if calosc_opus > BUDZET_CALOSC_OPUS:
        bledy.append(f"budżet całości: {calosc_opus:.2f} MB Opus > {BUDZET_CALOSC_OPUS} MB")

    # A14 — licencje plików zewnętrznych
    for id_, w in dzwieki.items():
        if w.get("source") == "zrodla":
            ok = False
            for kz in katalog.KATALOGI_ZRODEL:
                lic = Path(kz) / "LICENCJE.md"
                if lic.exists() and f"| {id_} |" in lic.read_text(encoding="utf-8"):
                    ok = True
            if not ok:
                bledy.append(f"A14 {id_}: plik zewnętrzny bez wpisu w LICENCJE.md")

    raport = budowa_raportu(wiersze, budzety, calosc_opus, calosc_aac, bledy, ostrz, manifest.get("version"))
    Path(a.raport).parent.mkdir(parents=True, exist_ok=True)
    Path(a.raport).write_text(raport, encoding="utf-8")
    Path(a.json).write_text(json.dumps(wiersze, ensure_ascii=False, indent=1, default=float), encoding="utf-8")
    print(raport)

    if a.spektrogramy:
        ids = a.ids.split(",") if a.ids else ["sfx_beben_stop_3", "sfx_wild", "sfx_bigwin_wejscie", "sfx_s2_gong",
                                              "sfx_s3_pekniecie_1", "sfx_monety_fontanna", "mus_lobby", "mus_s1",
                                              "mus_s2_fs", "mus_s3"]
        out = Path(a.spektrogramy)
        for id_ in ids:
            w = dzwieki[id_]
            d = eksport.dekoduj(kat / w["webm"], w.get("channels", 1))
            analiza.spektrogram_png(d, out / f"{id_}_spektrogram.png", f"{id_} (WebM/Opus, liniowo 0–24 kHz)")
            analiza.spektrogram_png(d, out / f"{id_}_spektrogram_log.png", f"{id_} (log 20 Hz–24 kHz)", log_f=True)
            analiza.przebieg_png(d, out / f"{id_}_przebieg.png", f"{id_} — przebieg")
        print(f"Spektrogramy: {out}")
    return 2 if bledy else (1 if ostrz else 0)


def n_probek_ms(ms):
    return int(round(ms / 1000 * SR))


def n_probek_s(s):
    return int(round(s * SR))


def _f(v, fmt="{:.1f}"):
    if v is None or (isinstance(v, float) and not np.isfinite(v)):
        return "—"
    return fmt.format(v)


def budowa_raportu(wiersze, budzety, calosc_opus, calosc_aac, bledy, ostrz, wersja) -> str:
    L = ["# Raport jakości audio — Cebulion Casino", "",
         f"Wersja manifestu: `{wersja}` · plików: {len(wiersze)} ID × 2 formaty", "",
         "Kolumny: LUFS — głośność zintegrowana BS.1770 (pętle: po powieleniu; „—” dla dźwięków < 0,4 s); "
         "chw. — największa głośność chwilowa (400 ms); dBTP — szczyt prawdziwy (×4) w WAV / po dekodowaniu "
         "WebM / M4A; szew — współczynnik predykcji na szwie pętli (WebM; ≤ 1,5 = brak trzasku); "
         "DC — składowa stała.", "",
         "| ID | czas [s] | kan. | LUFS | chw. | dBTP WAV | dBTP WebM | dBTP M4A | RMS | DC | szew | KB WebM | KB M4A |",
         "|---|---|---|---|---|---|---|---|---|---|---|---|---|"]
    for r in wiersze:
        szew = _f(r["szew"]["webm"]["wsp_predykcji"], "{:.2f}") if "szew" in r else ""
        L.append(f"| `{r['id']}` | {r['czas']:.3f} | {r['kanaly']} | {_f(r['lufs'])} | {_f(r['chwilowa'])} | "
                 f"{_f(r['tp_wav'], '{:.2f}')} | {_f(r['tp_webm'], '{:.2f}')} | {_f(r['tp_m4a'], '{:.2f}')} | "
                 f"{_f(r['rms'])} | {_f(r['dc'], '{:.0f}')} | {szew} | {r['kb_webm']:.1f} | {r['kb_m4a']:.1f} |")
    L += ["", "## Pętle — szwy (koniec → początek)", "",
          "| ID | plik | skok [dB wzgl. RMS] | wsp. predykcji | różnica widm na szwie [dB] | ta sama miara w środku [dB] |",
          "|---|---|---|---|---|---|"]
    for r in wiersze:
        if "szew" in r:
            for nazwa, s in r["szew"].items():
                L.append(f"| `{r['id']}` | {nazwa} | {s['skok_db']:.1f} | {s['wsp_predykcji']:.2f} | "
                         f"{s['roznica_widma_db']:.1f} | {s['roznica_widma_srodek_db']:.1f} |")
    L += ["", "## Budżety (pobierane pakiety na stronę, doc 05 § 2.4 i § 7.6)", "",
          "| Strona | ID | Opus [MB] | AAC [MB] | pamięć po dekodowaniu [MB] | budżet Opus / AAC / pamięć |",
          "|---|---|---|---|---|---|"]
    for s, (o, a_, p, n) in budzety.items():
        L.append(f"| {s} | {n} | {o:.2f} | {a_:.2f} | {p:.1f} | {BUDZET_SIEC[s][0]} / {BUDZET_SIEC[s][1]} / "
                 f"{BUDZET_PAMIEC[s]:.0f} |")
    L += ["", f"**Całe audio gry: {calosc_opus:.2f} MB Opus (budżet {BUDZET_CALOSC_OPUS} MB), {calosc_aac:.2f} MB AAC, "
          f"razem w repozytorium {calosc_opus + calosc_aac:.2f} MB.**", ""]
    L += ["## Wynik kontroli", ""]
    L += [f"* BŁĄD: {b}" for b in bledy] or ["* błędów: 0"]
    L += [f"* ostrzeżenie: {o}" for o in ostrz] or ["* ostrzeżeń: 0"]
    return "\n".join(L) + "\n"


if __name__ == "__main__":
    sys.exit(main())
