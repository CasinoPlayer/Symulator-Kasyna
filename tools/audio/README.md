# tools/audio — pipeline dźwięku Cebulion Casino

Cały dźwięk gry (59 efektów i 8 pętli muzycznych, ID z briefu § 10) powstaje **z kodu**: Python 3 + NumPy
syntezuje próbki, ffmpeg koduje je do formatów dla przeglądarki, a skrypt kontroli mierzy wynik bez słuchania.
Specyfikacja brzmień, poziomów i zdarzeń: [`docs/projekt/05-dzwiek-i-muzyka.md`](../../docs/projekt/05-dzwiek-i-muzyka.md);
format manifestu: [`docs/projekt/09-kontrakt-api-i-assetow.md`](../../docs/projekt/09-kontrakt-api-i-assetow.md) § 3.

```text
dzwieki.py / muzyka.py (przepisy)        tools/audio/zrodla/<ID>.* albo audio/zrodla/<ID>.*  (Suno, CC0 — pierwszeństwo)
            │                                                  │
            ▼                                                  ▼
  render NumPy float64, 48 kHz  ◀──────────  przetworz_zewnetrzne.py (dekodowanie, wycięcie pętli)
            ▼
  mastering.py → tools/audio/build/wav/<ID>.wav (24 bit, poza repozytorium — .gitignore)
            ▼
  eksport.py (ffmpeg) → src/main/resources/static/assets/audio/<ID>.webm (Opus) + <ID>.m4a (AAC) + manifest.json
            ▼
  sprawdz.py → tools/audio/build/raport.md (+ raport.json, opcjonalnie spektrogramy PNG)
```

## 1. Jak wygenerować

Wymagania: Python ≥ 3.11, NumPy ≥ 2.0 (bez SciPy), ffmpeg ≥ 6 z `libopus`; Pillow tylko do spektrogramów PNG.

```bash
python3 -m pip install -r tools/audio/wymagania.txt
python3 tools/audio/generuj_wszystko.py                          # wszystkie 67 ID (ok. 4–5 min na 4 rdzeniach)
python3 tools/audio/generuj_wszystko.py --tylko sfx_wild mus_s2  # wybrane ID (reszta manifestu zostaje)
python3 tools/audio/generuj_wszystko.py --tylko sfx_moneta       # prefiks = wszystkie warianty monet
python3 tools/audio/generuj_wszystko.py --tylko mus_s2 --bez-kodowania   # tylko WAV do odsłuchu (build/wav/)
python3 tools/audio/sprawdz.py                                   # same kontrole i raport
python3 tools/audio/sprawdz.py --spektrogramy /tmp/spektro --ids sfx_wild,mus_s1   # spektrogramy do obejrzenia
```

Kod wyjścia: 0 — w porządku, 1 — ostrzeżenia, 2 — błędy. Ten sam kod daje te same próbki i te same bajty plików
(ziarno losowania = CRC32 z ID, flagi `-bitexact` ffmpeg) — sprawdzone dwoma przebiegami (identyczne MD5), więc
`git diff` pokazuje tylko dźwięki, które się naprawdę zmieniły. Zastrzeżenie: inna wersja ffmpeg/libopus może dać
inne bajty przy identycznym WAV — pliki do repozytorium buduje jedna maszyna.

## 2. Pliki

| Plik | Rola |
|---|---|
| `generuj_wszystko.py` | punkt wejścia: render (równolegle, `-j`) → mastering → WAV → kodowanie → kontrola szczytu po dekodowaniu → manifest → raport |
| `katalog.py` | wiążąca lista 67 ID (kolejność briefu) i ścieżki katalogów |
| `dsp.py` | prymitywy syntezy i obróbki (opis niżej) |
| `instrumenty.py` | perkusja i instrumenty zbudowane z prymitywów |
| `sekwencer.py` | siatka taktów, skale, rytmy tekstem, LFO okresowe, „pompowanie”, zawijanie ścieżek do pętli |
| `dzwieki.py` | 59 przepisów efektów (dekorator `@dzwiek` z metadanymi manifestu) |
| `muzyka.py` | 8 utworów (dekorator `@utwor`, aranżacje zapisane danymi) |
| `mastering.py` | HP, wejście/wyjście, normalizacja (dBTP / LUFS), limiter, kompresja szyny muzyki |
| `petle.py` | zakładki pętli, pomiar tempa i wycinanie pętli z pliku zewnętrznego |
| `eksport.py` | ffmpeg (Opus/WebM, AAC/M4A), dekodowanie do kontroli, pomiar `ebur128`, manifest |
| `analiza.py` | LUFS (BS.1770-4), dBTP, RMS, DC, szew pętli, korelacja stereo, spektrogram/przebieg PNG |
| `sprawdz.py` | kontrole A01–A14 (doc 05 § 8.6) i raport |
| `przetworz_zewnetrzne.py` | podmiana na plik zewnętrzny (Suno, CC0) |

## 3. Jak to działa — techniki syntezy (do obrony)

**Oscylatory bez aliasingu (`pila`, `kwadrat`, `trojkat`).** Fala cyfrowa „piła” liczona wprost ma nieskończenie
wiele harmonicznych; te powyżej 24 kHz odbijają się w dół jako fałszywe tony (aliasing). Dlatego każdy kształt
budujemy z tablic falowych zawierających tylko harmoniczne poniżej 20 kHz — osobna tablica co pół oktawy, wybierana
według najwyższej częstotliwości nuty. Kwadrat (także z modulacją szerokości impulsu, PWM) to różnica dwóch takich pił.
Fazę liczymy jako całkę częstotliwości, więc glissanda i wibrata nie mają skoków (trzasków).

**Supersaw.** 7 pił odstrojonych symetrycznie o kilka–kilkanaście centów, z losową fazą i rozłożonych w panoramie.
Odstrojone fale „dudnią” względem siebie, co daje szerokie, żywe brzmienie (pady synthwave, fanfary).

**FM (dzwony, piano elektryczne).** Sinus nośny jest modulowany fazowo drugim sinusem o częstotliwości f·r.
Stosunek całkowity (1:1, 1:2) daje widmo harmoniczne — ciepły „złoty” dzwon, piano typu Rhodes; niecałkowity (1:3,5)
— nieharmoniczne parcjały, czyli szkło i kryształ. Indeks modulacji maleje w czasie: jasny atak, łagodne wybrzmienie.

**Synteza modalna / addytywna (`parcjaly`).** Moneta, gong, pęknięcie szkła to przedmioty drgające wieloma
niezależnymi „modami”: sumujemy sinusy o zadanych stosunkach częstotliwości, każdy z własnym zanikiem. Para lekko
odstrojonych sinusów na parcjał daje naturalne dudnienia (gong), a narastanie wysokich parcjałów po uderzeniu — jego
charakterystyczny „rozkwit”.

**Karplus–Strong (ud, kalimba, „pluck”).** Okres szumu krąży w pętli opóźnienia, a uśrednianie sąsiednich próbek
z każdym obiegiem przyciemnia dźwięk — dokładnie jak drgająca struna. Okres ma całkowitą liczbę próbek, więc
dokładny strój uzyskujemy przepróbkowaniem wyniku (błąd < 0,5 c zamiast kilkunastu centów).

**Szumy.** Biały to losowe próbki; różowy (−3 dB/okt.) i brązowy (−6 dB/okt.) kształtujemy w dziedzinie
częstotliwości (FFT). Przefiltrowany szum to świsty, „whoosh”, szelest piasku, oddech fletu, trzaski.

**Filtry bez SciPy.** Filtry bikwadratowe (dolno-, górno-, pasmowoprzepustowe, półkowe, szczytowe; wzory RBJ
„Audio EQ Cookbook”) o stałych współczynnikach liczymy przez FFT: widmo sygnału × odpowiedź filtru — to ten sam
filtr co rekurencja próbka po próbce, tylko setki razy szybciej w NumPy. Filtr przestrajany w czasie to SVF
(filtr zmiennych stanu, rekurencja na listach Pythona — dla krótkich dźwięków) albo filtr w STFT: sygnał dzielimy
na nakładające się ramki, każdą mnożymy w widmie przez charakterystykę dla danej chwili i składamy z powrotem —
tak robimy przemiatania szumu i formanty chóru (samogłoska „a” → „o”).

**Obwiednie.** ADSR (atak, zanik, podtrzymanie, wybrzmienie), zanik wykładniczy o stałej τ, obwiednie z punktów.
Każdy dźwięk zaczyna i kończy się rampą (2 ms / 5 ms), więc nie ma trzasków na brzegach pliku.

**Pogłos splotowy.** Generujemy odpowiedź impulsową sali: niezależny szum w lewym i prawym kanale (szerokość),
podzielony na 8 pasm, z których każde gaśnie do −60 dB we własnym czasie (góra szybciej — jak w prawdziwej sali),
z opcjonalnymi wczesnymi odbiciami (kamienne ściany skarbca) i opóźnieniem wstępnym (jaskinia). Dźwięk splatamy
z nią przez FFT. Pogłos jest „wypalony” w plikach, bo `ConvolverNode` w przeglądarce jest drogi dla telefonu.

**Echo i chorus.** Echo to suma przesuniętych, coraz cichszych i ciemniejszych kopii (jak echo taśmowe; wariant
ping-pong na zmianę w L i P). Chorus to kopia z opóźnieniem modulowanym wolnym LFO — „aksamit” padów.

**Nasycenie, redukcja bitów.** `tanh(k·x)` miękko obcina szczyty i dodaje harmoniczne; wersja asymetryczna dodaje
też parzyste (120, 240 Hz dla basu 60 Hz) — to dzięki nim bas słychać na głośniku telefonu, który nie gra poniżej
ok. 200–300 Hz. Redukcja bitów i częstotliwości próbkowania daje retro „8-bit” w S1.

**Dynamika.** Kompresor (detektor obwiedni z atakiem i zwolnieniem, miękkie kolano) skleja szynę muzyki.
Limiter z wyprzedzeniem na szczyt prawdziwy: dla każdej próbki liczymy wymagane wzmocnienie (szczyt po interpolacji
×4), bierzemy minimum w oknie 4 ms przed szczytem i wygładzamy — redukcja zaczyna się przed szczytem, bez przesteru.

**Stereo.** Panorama stałej mocy (dźwięk przesuwany w bok nie zmienia głośności), szerokość przez M/S, bas poniżej
150 Hz w mono (mono-zgodność).

**Perkusja syntetyczna.** Stopa = sinus z szybko opadającą wysokością + klik pałki + nasycenie; werbel = dwa mody
membrany + szum sprężyn; hi-hat = sześć nieharmonicznych fal prostokątnych (metal, jak w TR-808) przez filtr HP;
klaśnięcie = 4 impulsy szumu co ~8 ms; tom, taiko, darbuka (dum / tek / ka), shaker, szczotki, czynele (FM 1:2,76),
gong, dzwon, talerz (dziesiątki nieharmonicznych parcjałów + szum).

**Sekwencer muzyki.** Utwór to siatka taktów (tempo, metrum, liczba taktów), akordy i melodie jako tablice danych,
rytmy zapisane tekstem (`"DT.TD.T."` = rytm maqsum). Każda ścieżka ma zadaną głośność względną — kod mierzy LUFS
ścieżki i ustawia ją liczbowo („pompowanie” basu i padu w rytmie stopy jest wpisane w syntezę, bo pozycje stóp
znamy z góry). Ton Sheparda–Risseta (`mus_napiecie`) daje wrażenie nieskończonego wznoszenia bez tempa i tonacji.

## 4. Pętle bez szwu

1. **Długość = całkowita liczba taktów** (np. `mus_s2`: 16 taktów × 2,4 s = 38,4 s = 1 843 200 próbek).
2. **Sygnał dokładnie okresowy:** nuty i ziarna wystające poza koniec zawijamy na początek; filtry i pogłos liczymy
   splotem kołowym (ogon ostatniego taktu „wraca” na początek); kompresor i limiter dostają dwie kopie pętli
   (stan detektora na szwie jest ciągły); każda modulacja (tremolo, PWM, chorus, samogłoski chóru, „taśma”) ma
   całkowitą liczbę cykli na pętlę; ciągłe tony (bordun) mają częstotliwość zaokrągloną do k / L (< 0,5 c).
   To lepsze niż przenikanie końca z początkiem: nic się nie znosi fazowo, a szew jest matematycznie niewidoczny.
3. **Zakładki (domyślnie włączone):** plik = 0,1 s (efekty) / 0,25 s (muzyka) końca pętli + pętla + tyle samo
   początku; manifest podaje `loopStart` / `loopEnd`. Powód: AAC po dekodowaniu ma na końcu dopełnienie ostatniej
   ramki (do 1023 próbek, typowo ok. 10,7 ms), a Safari dostaje `.m4a` — zapętlenie całego bufora dałoby przerwę.
   `--bez-zakladek` wyłącza je (pętla = cały plik).
4. **Kontrola:** `sprawdz.py` (A08) liczy na szwie błąd predykcji liniowej (czy próbka po szwie „pasuje” do
   przebiegu fali) na WAV i na plikach zdekodowanych, tak jak gra przeglądarka; trzask daje wartości kilka–kilkadziesiąt
   razy większe niż zwykły przebieg.

**Jak to odtwarza silnik (`static/js/audio/audio-engine.js`):** dla pętli ustawia `source.loop = true`,
`source.loopStart` / `source.loopEnd` z manifestu i startuje od `loopStart` (`source.start(when, loopStart)`), więc
dopełnienie na końcu pliku nigdy nie trafia do pętli. Bez zakładek co obieg zabrzmiałoby 0,2 s / 0,5 s „czkawki”.

## 5. Głośność, formaty, manifest

| Rodzaj | Normalizacja | Uzasadnienie |
|---|---|---|
| efekty jednorazowe | szczyt prawdziwy −1 dBTP | krótki dźwięk „waży” tyle, ile jego szczyt; LUFS wymaga bloków 400 ms; poziom względny daje `gainDb` |
| pętle efektów | −18 LUFS (pętla powielona do ≥ 4 s) | doc 05 § 5.7 |
| muzyka | −14 LUFS, ≤ −1 dBTP | szyna `music` ma 0,45 (−6,9 dB), więc muzyka gra w sesji ok. −22 LUFS, a cała sesja ok. −18 LUFS (doc 05 § 5.1) |

Szczyt sprawdzamy **po zakodowaniu i zdekodowaniu**: jeśli Opus przekroczy −1 dBTP (albo AAC pełną skalę),
sufit limitera/normalizacji spada o nadmiar i plik jest kodowany ponownie (log pokazuje kolejne próby).
Pomiar LUFS (`analiza.lufs`) jest zaimplementowany w NumPy i sprawdzany niezależnie przez `ffmpeg ebur128`.

Kodowanie: **Opus w WebM** 64 kb/s mono / 96 kb/s stereo (VBR „constrained” — średnia trzyma budżet) i **AAC-LC w
M4A** 96 / 128 kb/s (koder `fast`: przewidywalne szczyty, sprawdzone na wszystkich plikach). 48 kHz w całym
pipeline (Opus pracuje natywnie w 48 kHz).

`assets/audio/manifest.json`: `{"version": "<skrót SHA-256 plików>", "sounds": {"<ID>": {...}}}` — pola kontraktu
`webm`, `m4a`, `loop`, `duration`, `bus` oraz rozszerzenia z doc 05 § 7.5: `channels`, `gainDb`, `priority`,
`group`, `maxVoices`, `cooldownMs`, `pitchCents`, `gainJitterDb`, `keyTrack` (`true` albo `{"s2": 100}` dla plików
na nutach D i A — w S2 przesuwane o +100 c zamiast +200 c, żeby zostały w skali hidżaz), `syncPoint`, `loopStart`,
`loopEnd`, `bpm`, `beatsPerBar`, `pack` / `packs`, `source`.

## 6. Jak dodać nowy dźwięk

1. Uzgodnij ID (brief § 10 jest wiążący) i dopisz je do `katalog.WYMAGANE_ID`.
2. W `dzwieki.py` napisz funkcję z dekoratorem, np.:
   ```python
   @dzwiek("sfx_nowy", gain_db=-8, priority=3, dlugosc=0.5, packs=["gry-krytyczne"], pitchCents=5, keyTrack=True)
   def sfx_nowy(rng):
       d = 0.5
       return dsp.dzwon_fm(hz("E5"), d, r=2.0, i0=2.0, tau=0.3)   # mono (n,) albo stereo (2, n)
   ```
   Pętla: `loop=True, okres=…` i sygnał dokładnie okresowy (`wstaw(..., zawijaj=True)`, filtry `okresowy=True`).
   Muzyka: funkcja z `@utwor(...)` w `muzyka.py` na sekwencerze (`Utwor`, `dodaj`, `zawin`, `wyrownaj`).
3. `python3 tools/audio/generuj_wszystko.py --tylko sfx_nowy` → odsłuch `tools/audio/build/wav/sfx_nowy.wav`.
4. Dostrój `gain_db` w grze, na tle muzyki; wepnij przez ID (`audio.play('sfx_nowy')`).
5. `python3 tools/audio/sprawdz.py` — błędy muszą zniknąć; zatwierdź `tools/audio/` i `assets/audio/`.

## 7. Podmiana na muzykę z Suno (albo efekt z biblioteki CC0)

```bash
python3 tools/audio/przetworz_zewnetrzne.py mus_s2 ~/Pobrane/skarbiec.mp3 \
        --serwis "Suno (plan Pro), 2026-10-11" --licencja "prawa komercyjne wg regulaminu" --autor "właściciel"
python3 tools/audio/przetworz_zewnetrzne.py mus_s2 ~/Pobrane/skarbiec.mp3 --start 12.0   # ręczny początek pętli
python3 tools/audio/przetworz_zewnetrzne.py --usun mus_s2                                # powrót do syntezy
```

Skrypt kopiuje plik do `tools/audio/zrodla/<ID>.<rozszerzenie>` (sprawdzany jest też `audio/zrodla/`), dopisuje
wiersz do `LICENCJE.md` (kontrola A14) i uruchamia pipeline dla tego ID. Plik zewnętrzny ma pierwszeństwo nad
syntezą przy każdym kolejnym przebiegu. Dla muzyki: dekodowanie do 48 kHz → pomiar tempa (autokorelacja obwiedni
uderzeń, doprecyzowana na opóźnieniach do 32 miar; jeśli różni się od zamówionego o > 0,4%, manifest dostaje
tempo zmierzone) → faza taktu (miary z uderzeń w paśmie < 250 Hz, „raz” z największej zmiany chromagramu —
akordy zmieniają się na początku taktu) → wybór N taktów od kreski taktowej w części o najbardziej stałej
głośności → dopasowanie szwu (korelacja ±20 ms) → przenikanie o stałej
mocy 50 ms wypalone w pliku → ten sam mastering, zakładki, kodowanie i kontrole co przy syntezie. Efekt
jednorazowy: przycięcie ciszy i normalizacja szczytu. Prompty do Suno: doc 05 § 11 (`mus_napiecie` zostaje syntezą).

Sprawdzone na 7 syntetycznych „nagraniach” (nasze pętle z wstępem 0,7–5,1 s, tempem zmienionym o −0,5…+0,8%
i kodowaniem MP3): tempo z błędem ≤ 0,01%, start pętli ≤ 3 ms od kreski taktowej, szew bez trzasku. Prawdziwe
nagrania z generatora mogą mieć pływające tempo — skrypt ostrzega przy niepewnym pomiarze; wtedy odsłuch i `--start`.

## 8. Znane ograniczenia

* Brzmienia „orkiestrowe” (chór, smyczki, ud, ney) są syntezowane z prostych modeli — wiarygodne w miksie,
  skromniejsze niż nagrania; to najlepsi kandydaci do podmiany na Suno.
* Kontrola jakości jest pomiarowa (głośność, szczyty, szwy, widmo) — nie zastąpi odsłuchu na telefonie,
  laptopie i słuchawkach (doc 05 § 5.7); poziomy `gainDb` to wartości startowe do strojenia w grze.
* Dekoder AAC w ffmpeg nie odcina dopełnienia ostatniej ramki — raport notuje je jako uwagę; zakładki pętli
  sprawiają, że nie trafia ono do szwu.
* Pliki AAC mają szczyt do ok. −0,5 dBTP (ostrzeżenie A04 — dopuszczalne dla formatu zapasowego, bez przesteru).
* Testy `pytest` z doc 05 § 8.9 nie powstały — te same własności sprawdza `sprawdz.py` na wyniku pipeline'u.
