/**
 * audio/audio-engine.js — silnik dźwięku na Web Audio API.
 *
 * Dlaczego Web Audio, a nie <audio>: dźwięki startują z dokładnością do milisekund (synchronizacja z animacją
 * bębnów), można grać wiele naraz, zmieniać wysokość (rosnące stopy bębnów) i miksować głośności szynami.
 *
 * Budowa (graf audio):
 *     źródła ─┬─▶ szyna "ui"    ────────────────────────────┐
 *             ├─▶ szyna "sfx"   ────────────────────────────┼─▶ master ─▶ głośniki
 *             └─▶ szyna "music" ─▶ ducking ─▶ filtr muzyki ─┘
 *   ducking (05 § 5.3) ścisza muzykę pod ważnymi efektami (wygrana −3 dB, big win −6 dB; kilka naraz → najgłębszy),
 *   filtr dolnoprzepustowy „przytłumia” muzykę w antycypacji (1200 Hz) — 05 § 4.5.
 *
 * Zasady:
 *   * przeglądarki blokują dźwięk do pierwszego gestu użytkownika — wołamy unlock() przy kliknięciu
 *     „Zaloguj” / „Wejdź do kasyna” / „Graj” (plan § 6) albo unlockOnGesture() (dowolny gest); przed tym play() milczy,
 *   * pliki opisuje static/assets/audio/manifest.json (kontrakt 09 § 3, pola w 05 § 7.5). Gdy go nie ma albo
 *     brakuje ID — cisza bez błędów (dźwięki dochodzą z pipeline'u tools/audio bez zmian w kodzie),
 *   * POZIOM każdego dźwięku ustala manifest (`gainDb`, 05 § 5) — kod nie dokłada własnych „ściszeń” poza
 *     wariantami zdarzeń opisanymi w 05 (np. autoplay −6 dB), dzięki temu miks stroi się w jednym miejscu,
 *   * pętle grają bezszwowo między `loopStart` a `loopEnd` z manifestu i STARTUJĄ od `loopStart` — AAC i Opus
 *     mają dopełnienie (cisza kodera) na początku i końcu pliku; pętla po całym buforze „czkałaby” co obieg
 *     (0,2 s w efektach, 0,5 s w muzyce),
 *   * limity głosów (05 § 2.5): najwyżej 24 efekty naraz (Low: 16) z priorytetami 1–5, a na dźwięk/grupę
 *     `maxVoices` i `cooldownMs` — inaczej np. 24 monety w bonusie dałyby 24 nakładające się „brzdęki” i trzaski,
 *   * wysokość: mikro-zmiana ± `pitchCents`, transpozycja do tonacji gry (`keyTrack`, 05 § 2.6), razem z wariantem
 *     zdarzenia ograniczone do ±400 c (powyżej „efekt wiewiórki”); `syncPoint` = moment pliku, który ma trafić
 *     w zdarzenie (silnik startuje plik odpowiednio wcześniej i uwzględnia zmianę prędkości przy transpozycji),
 *   * głośności i wyciszenie pamiętamy w localStorage (try/catch: tryb prywatny może go blokować),
 *   * przy ukrytej karcie kontekst audio jest wstrzymywany (oszczędność baterii, brak „grającego tła”).
 */

const STORAGE_KEY = 'cebulion.audio';
const DEFAULTS = Object.freeze({ muted: false, master: 0.9, ui: 0.6, sfx: 0.85, music: 0.45 });
const BUSES = ['ui', 'sfx', 'music'];
const MANIFEST_URL = new URL('assets/audio/manifest.json', document.baseURI);
const MAX_VOICES = 24;             // 05 § 2.5; poziom jakości Low: 16 (setQuality)
const DEFAULT_PRIORITY = 3;        // „normalny”, gdy manifest nie podaje priorytetu
const DEFAULT_PACK = 'gry-dalsze'; // wpis bez `packs` i `pack` (05 § 7.5)
const GAME_PACKS = ['s1', 's2', 's3'];
/** Transpozycja kontekstu w centach (05 § 1.2 / § 2.6): w stanie BIG_WIN zawsze 0. */
const KEYS = Object.freeze({ lobby: 0, s1: 0, s2: 200, s3: 400, bigwin: 0 });
const MAX_DETUNE = 400;            // łączny limit przesunięcia (05 § 2.6)
const MAX_VOLUME = 2;              // mnożnik ≤ +6 dB ponad poziom z manifestu (np. fontanna +2 dB na poziom big winu)

/** Decybele → mnożnik amplitudy: −6 dB ≈ 0,5; 0 dB = 1; +4 dB ≈ 1,58. */
const dbToGain = (db) => 10 ** (db / 20);
/** Losowa wartość z przedziału [−a, +a] (mikro-zmiany wysokości i głośności — ucho nie słyszy „kopiuj-wklej”). */
const jitter = (a) => (a ? (Math.random() * 2 - 1) * a : 0);
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/** Uchwyt grającego dźwięku; dla dźwięków, których nie ma, zwracamy ten „pusty”. */
const SILENT = Object.freeze({ stop() {}, setRate() {}, setVolume() {}, playing: false });

function loadSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null');
    return { ...DEFAULTS, ...(saved && typeof saved === 'object' ? saved : {}) };
  } catch {
    return { ...DEFAULTS };
  }
}

function clamp01(v) {
  return Math.min(1, Math.max(0, Number(v) || 0));
}

function volumeOf(v) {
  return clamp(Number(v) || 0, 0, MAX_VOLUME);
}

/** Lista pakietów wpisu (05 § 2.4): `packs`, dla zgodności `pack`, domyślnie „gry-dalsze”. */
function packsOf(entry) {
  return entry.packs ?? [entry.pack ?? DEFAULT_PACK];
}

class AudioEngine extends EventTarget {
  #ctx = null;
  #master = null;
  #buses = {};
  #settings = loadSettings();
  #sounds = null;            // mapa ID → wpis z manifestu (null = jeszcze nie wczytano)
  #manifestPromise = null;
  #buffers = new Map();      // ID → AudioBuffer
  #pending = new Map();      // ID → Promise<AudioBuffer|null>
  #bytes = new Map();        // ID → Promise<ArrayBuffer|null> pobrane przed odblokowaniem (ekran ładowania)
  #music = null;             // { id, handle, ctxStart, fileOffset, entry, duration }
  #wantedMusic = null;       // muzyka zamówiona przed wczytaniem pliku
  #layer = null;             // warstwa napięcia (mus_napiecie) — osobne gniazdo muzyki (05 § 2.5)
  #unlocked = false;
  #duckNode = null;
  #filterNode = null;
  #ducks = new Map();        // nazwa duckingu → głębokość w dB
  #voices = new Set();       // grające efekty (muzyka ma własne „gniazdo” i nie wlicza się do limitu)
  #maxVoices = MAX_VOICES;
  #lastStart = new Map();    // grupa dźwięku → performance.now() ostatniego startu (cooldownMs)
  #lastVariant = new Map();
  #opus = null;              // czy przeglądarka gra WebM/Opus (sprawdzane raz na stronę)
  #keyContext = 'lobby';
  #warned = new Set();       // jedno ostrzeżenie na ID (05 § 2.4 „Odporność”)

  constructor() {
    super();
    document.addEventListener('visibilitychange', () => {
      if (!this.#ctx || !this.#unlocked) return;
      if (document.hidden) this.#ctx.suspend().catch(() => {});
      else this.#ctx.resume().catch(() => {});
    });
  }

  /** Czy dźwięk został odblokowany gestem użytkownika. */
  get unlocked() {
    return this.#unlocked;
  }

  /**
   * Odblokowuje dźwięk — wywołaj W OBSŁUDZE KLIKNIĘCIA (gest użytkownika).
   * Tworzy AudioContext (dopiero teraz, żeby przeglądarka nie zgłaszała ostrzeżeń) i wczytuje manifest.
   */
  async unlock() {
    if (this.#unlocked) return;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    try {
      if (!this.#ctx) {
        this.#ctx = new Ctx({ latencyHint: 'interactive' });
        this.#master = this.#ctx.createGain();
        this.#master.connect(this.#ctx.destination);
        for (const bus of BUSES) {
          this.#buses[bus] = this.#ctx.createGain();
          this.#buses[bus].connect(this.#master);
        }
        // muzyka idzie przez ducking i filtr (05 § 2.2)
        this.#duckNode = this.#ctx.createGain();
        this.#filterNode = this.#ctx.createBiquadFilter();
        this.#filterNode.type = 'lowpass';
        this.#filterNode.frequency.value = 20000;
        this.#filterNode.Q.value = 0.707;
        this.#buses.music.disconnect();
        this.#buses.music.connect(this.#duckNode).connect(this.#filterNode).connect(this.#master);
        this.#applyVolumes(0);
      }
      // resume() wołamy synchronicznie w obsłudze gestu (przed pierwszym await) — inaczej przeglądarka odmówi
      if (this.#ctx.state !== 'running') await this.#ctx.resume();
      // 05 § 2.3: jeśli mimo to kontekst nie ruszył (zdarzenie nie było „gestem”), czekamy na kolejny — bez błędów
      this.#unlocked = this.#ctx.state === 'running';
    } catch {
      return;
    }
    if (!this.#unlocked) return;
    await this.#loadManifest();
    if (this.#wantedMusic) this.playMusic(this.#wantedMusic.id, this.#wantedMusic);
  }

  /**
   * Odblokowanie pierwszym DOWOLNYM gestem na stronie (05 § 2.3): nasłuch pointerup, keydown i click — na ekranie
   * dotykowym aktywacja przychodzi dopiero przy pointerup, więc samo pointerdown nie wystarcza. Słuchacze znikają,
   * gdy kontekst naprawdę gra; wtedy wywołujemy `onUnlocked` (np. start muzyki, wczytanie pakietu dźwięków).
   * @param {() => void} [onUnlocked]
   */
  unlockOnGesture(onUnlocked) {
    const events = ['pointerup', 'keydown', 'click'];
    let done = false;
    const handler = (event) => {
      if (done || (event.type === 'keydown' && (event.key === 'Escape' || event.metaKey || event.ctrlKey || event.altKey))) return;
      this.unlock().then(() => {
        if (done || !this.#unlocked) return;
        done = true;
        events.forEach((type) => document.removeEventListener(type, handler, true));
        onUnlocked?.();
      });
    };
    events.forEach((type) => document.addEventListener(type, handler, { capture: true, passive: true }));
  }

  /** Wczytuje manifest dźwięków (raz). Brak pliku = pusty zestaw, bez wyjątku. */
  #loadManifest() {
    this.#manifestPromise ??= fetch(MANIFEST_URL, { cache: 'no-cache' })
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null)
      .then((data) => {
        this.#sounds = data?.sounds && typeof data.sounds === 'object' ? data.sounds : {};
      });
    return this.#manifestPromise;
  }

  /** Czy dany dźwięk jest w manifeście. */
  has(id) {
    return Boolean(this.#sounds?.[id]);
  }

  /** Wpis manifestu (tylko do odczytu) — np. `syncPoint` albo `duration` do planowania osi czasu. */
  entry(id) {
    return this.#sounds?.[id] ?? null;
  }

  /**
   * Wybiera format obsługiwany przez przeglądarkę przez `canPlayType`: WebM/Opus (mniejszy) albo M4A/AAC (Safari).
   * Sprawdzamy raz na stronę; gdy dekodowanie .webm mimo to się nie uda, przełączamy się na .m4a (05 § 7.1).
   */
  #fileFor(entry) {
    this.#opus ??= document.createElement('audio').canPlayType('audio/webm; codecs="opus"') !== '';
    const path = this.#opus && entry.webm ? entry.webm : entry.m4a ?? entry.webm;
    return path ? new URL(path, MANIFEST_URL).href : null;
  }

  #fetchBytes(id) {
    const entry = this.#sounds?.[id];
    const url = entry && this.#fileFor(entry);
    if (!url) return Promise.resolve(null);
    return fetch(url)
      .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(String(r.status)))))
      .catch(() => null);
  }

  /** Pobiera i dekoduje plik dźwięku (raz, wynik w pamięci podręcznej). */
  #buffer(id) {
    if (this.#buffers.has(id)) return Promise.resolve(this.#buffers.get(id));
    if (this.#pending.has(id)) return this.#pending.get(id);
    const entry = this.#sounds?.[id];
    if (!entry || !this.#ctx) return Promise.resolve(null);
    const usedOpus = this.#opus !== false && Boolean(entry.webm);
    const bytes = this.#bytes.get(id) ?? this.#fetchBytes(id);
    this.#bytes.delete(id);
    const promise = bytes
      .then((data) => (data ? this.#ctx.decodeAudioData(data) : null))
      .catch(async () => {
        // przeglądarka zadeklarowała Opus, ale go nie zdekodowała → do końca wizyty .m4a
        if (usedOpus && entry.m4a && this.#opus !== false) {
          this.#opus = false;
          const retry = await this.#fetchBytes(id);
          return retry ? this.#ctx.decodeAudioData(retry).catch(() => null) : null;
        }
        return null;
      })
      .then((buffer) => {
        if (buffer) this.#buffers.set(id, buffer);
        else this.#warn(id, 'nie udało się wczytać pliku');
        return buffer ?? null;
      })
      .finally(() => this.#pending.delete(id));
    this.#pending.set(id, promise);
    return promise;
  }

  #warn(id, why) {
    if (this.#warned.has(id)) return;
    this.#warned.add(id);
    console.warn(`[audio] ${id}: ${why} — gramy ciszę`);
  }

  /** Wczytuje z wyprzedzeniem (np. przed sekwencją bonusu), żeby pierwszy dźwięk nie był opóźniony. */
  async preload(ids) {
    if (!this.#unlocked) return;
    await this.#loadManifest();
    await Promise.all(ids.filter((id) => this.has(id)).map((id) => this.#buffer(id)));
  }

  /**
   * Wczytuje całe pakiety z manifestu (pole `packs`, 05 § 2.4), np. preloadPack('ui', 'lobby') po odblokowaniu
   * w lobby. Bez tego pierwszy play() danego dźwięku jest cichy (plik dopiero się pobiera) — a bonus powitalny
   * zdarza się raz, więc grałby zawsze bez dźwięku.
   * @param {...string} names nazwy pakietów: 'ui', 'lobby', 'gry-krytyczne', 'gry-dalsze', 's1', 's2', 's3'
   */
  async preloadPack(...names) {
    if (!this.#unlocked) return;
    await this.#loadManifest();
    const ids = Object.entries(this.#sounds)
      .filter(([, e]) => packsOf(e).some((p) => names.includes(p)))
      .map(([id]) => id);
    await Promise.all(ids.map((id) => this.#buffer(id)));
  }

  /**
   * ID dźwięków strony gry wg reguł 05 § 2.4: wpisy z `ui`, `gry-krytyczne`, `gry-dalsze` albo `sN` i BEZ pakietu
   * innej gry; faza 'critical' = bez `gry-dalsze` (ekran ładowania), 'later' = z `gry-dalsze` (po intro, w tle).
   * @param {'s1'|'s2'|'s3'} game
   * @param {'critical'|'later'} phase
   */
  async gameSounds(game, phase) {
    await this.#loadManifest();
    const own = ['ui', 'gry-krytyczne', 'gry-dalsze', game];
    return Object.entries(this.#sounds)
      .filter(([, e]) => {
        const packs = packsOf(e);
        if (packs.some((p) => GAME_PACKS.includes(p) && p !== game)) return false;
        if (!packs.some((p) => own.includes(p))) return false;
        return (phase === 'later') === packs.includes('gry-dalsze');
      })
      .map(([id]) => id);
  }

  /**
   * Pobiera bajty plików jeszcze PRZED odblokowaniem (ekran ładowania gry, 05 § 2.4) — dekodowanie wymaga
   * kontekstu audio, który powstaje dopiero po geście, ale samo pobieranie nie. Po „Graj” dekodowanie trwa ms.
   */
  async prefetch(ids) {
    await this.#loadManifest();
    const jobs = [];
    for (const id of ids) {
      if (!this.has(id) || this.#buffers.has(id) || this.#bytes.has(id)) continue;
      const p = this.#fetchBytes(id);
      this.#bytes.set(id, p);
      jobs.push(p);
    }
    await Promise.all(jobs);
  }

  /** Kontekst tonacji (05 § 2.6): 'lobby' | 's1' | 's2' | 's3' | 'bigwin' — wpływa na dźwięki z `keyTrack`. */
  setKeyContext(context) {
    if (context in KEYS) this.#keyContext = context;
  }

  get keyContext() {
    return this.#keyContext;
  }

  /** Transpozycja `keyTrack` w centach: `true` = tonacja kontekstu, obiekt = wyjątki per kontekst ({ s2: 100 }). */
  #keyDetune(entry) {
    if (!entry.keyTrack) return 0;
    const exception = typeof entry.keyTrack === 'object' ? entry.keyTrack[this.#keyContext] : undefined;
    return exception ?? KEYS[this.#keyContext] ?? 0;
  }

  /**
   * Ile sekund przed zdarzeniem trzeba wystartować plik, żeby jego `syncPoint` trafił w zdarzenie — z uwzględnieniem
   * transpozycji (prędkość = 2^(c/1200); +400 c → ×1,26, więc 1 000 ms pliku trwa 794 ms).
   */
  leadTime(id, { detune = 0, rate = 1 } = {}) {
    const entry = this.#sounds?.[id];
    if (!entry?.syncPoint) return 0;
    const cents = clamp(detune + this.#keyDetune(entry), -MAX_DETUNE, MAX_DETUNE);
    return entry.syncPoint / (rate * 2 ** (cents / 1200));
  }

  /**
   * Czy nowy efekt o priorytecie `prio` dostanie głos — w razie potrzeby kosztem innego (05 § 2.5).
   * Krytycznych (5) nie kradniemy nigdy; pętle tła oddajemy tylko ważnym (≥ 4); poza tym kradniemy najniższy,
   * a przy równym priorytecie — najstarszy. Krytyczny dźwięk może wyjątkowo przekroczyć limit.
   */
  #acquireVoice(prio) {
    if (this.#voices.size < this.#maxVoices) return true;
    let victim = null;
    for (const v of this.#voices) {
      if (v.priority === 5) continue;
      if (v.loop && prio < 4) continue;
      if (!victim || v.priority < victim.priority || (v.priority === victim.priority && v.startedAt < victim.startedAt)) victim = v;
    }
    if (!victim) return prio === 5;
    if (victim.priority > prio) return false;
    victim.stop(12); // 12 ms wyciszenia zamiast trzasku
    return true;
  }

  /** Limit głosów według poziomu jakości: 'high' | 'medium' → 24, 'low' → 16 (bez panoramy, monety 6 → 3). */
  setQuality(level) {
    this.#maxVoices = level === 'low' ? 16 : MAX_VOICES;
  }

  /**
   * Odtwarza dźwięk. Poziom = `gainDb` z manifestu (± `gainJitterDb`) × `volume`; wysokość ± `pitchCents`
   * + transpozycja `keyTrack`; pętle grają między `loopStart` a `loopEnd` i startują od `loopStart`.
   * Efekty podlegają limitom głosów (05 § 2.5); muzyka ma własne gniazda.
   * @param {string} id identyfikator z briefu §10, np. 'ui_klik', 'sfx_moneta_3'
   * @param {object} o
   * @param {number} [o.volume=1] mnożnik 0–2 dla wariantów zdarzeń (np. autoplay −6 dB) i płynnych zmian
   * @param {number} [o.rate=1] prędkość (przyspieszanie tików licznika — poza limitem ±400 c, 05 § 2.6)
   * @param {number} [o.detune=0] wariant zdarzenia w centach (np. +100 c × poziom zakładu)
   * @param {number} [o.detuneLimit=400] łączny limit przesunięcia (wyjątek: `sfx_linia` do +700 c)
   * @param {number} [o.delay=0] start za `delay` s (planowanie na zegarze audio, 05 § 2.7)
   * @param {number} [o.hitIn] zdarzenie nastąpi za `hitIn` s — plik startuje tak, by `syncPoint` trafił w nie
   * @param {number} [o.offset] start od pozycji pliku (s); domyślnie 0, a dla pętli `loopStart`
   * @param {number} [o.fadeIn=0] wejście w ms
   * @param {number} [o.pan=0] panorama −1…1 (pozycja bębna, 05 § 5.5; Low: bez panoramy)
   * @param {boolean} [o.loop] wymuszenie pętli (domyślnie z manifestu)
   * @param {'ui'|'sfx'|'music'} [o.bus] szyna (domyślnie z manifestu)
   * @returns {{stop: (fadeMs?: number) => void, setRate: (r: number) => void, setVolume: (v: number, ms?: number) => void, playing: boolean}}
   */
  play(id, { volume = 1, rate = 1, detune = 0, detuneLimit = MAX_DETUNE, loop, bus, delay = 0, hitIn, fadeIn = 0, pan = 0, offset } = {}) {
    if (!this.#unlocked || this.#settings.muted || !this.has(id)) return SILENT;
    const buffer = this.#buffers.get(id);
    if (!buffer) {
      this.#buffer(id); // pierwsze użycie bez wczytania pakietu: wczytaj na następny raz
      return SILENT;
    }
    const entry = this.#sounds[id];
    const ctx = this.#ctx;
    const busName = bus ?? entry.bus ?? 'sfx';
    const isMusic = busName === 'music';
    const looping = loop ?? Boolean(entry.loop);
    const group = entry.group ?? id;              // np. sfx_moneta_1 … _5 dzielą jeden limit („moneta”)
    const priority = entry.priority ?? DEFAULT_PRIORITY;
    const now = performance.now();

    if (!isMusic) {
      // cooldownMs: start zbyt szybko po poprzednim z tej samej grupy jest pomijany (np. ui_hover co ≥ 80 ms)
      if (entry.cooldownMs && now - (this.#lastStart.get(group) ?? -Infinity) < entry.cooldownMs) return SILENT;
      // maxVoices: za dużo kopii tej samej grupy → wyciszamy najstarszą; druga kopia pętli to zawsze błąd logiki.
      // Low: grupy z dużym limitem (monety 6) dostają połowę (05 § 2.5).
      let limit = entry.maxVoices ?? (looping ? 1 : Infinity);
      if (this.#maxVoices < MAX_VOICES && limit >= 6) limit = Math.ceil(limit / 2);
      let copies = 0;
      let oldest = null;
      for (const v of this.#voices) {
        if (v.group !== group) continue;
        copies++;
        if (!oldest || v.startedAt < oldest.startedAt) oldest = v;
      }
      if (copies >= limit) oldest.stop(id === 'sfx_poziom_w_gore' ? 80 : 12);
      if (!this.#acquireVoice(priority)) return SILENT;
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = looping;
    const loopStart = entry.loopStart ?? 0;
    const hasLoopPoints = looping && entry.loopEnd > loopStart;
    if (hasLoopPoints) {
      source.loopStart = loopStart;
      source.loopEnd = Math.min(entry.loopEnd, buffer.duration);
    }
    // wysokość: wariant zdarzenia + mikro-zmiana + tonacja gry, razem w granicach limitu (05 § 2.6)
    const cents = clamp(detune + jitter(entry.pitchCents) + this.#keyDetune(entry), -detuneLimit, detuneLimit);
    source.playbackRate.value = rate;
    if (cents) source.detune.value = cents;
    const speed = rate * 2 ** (cents / 1200);

    // start: pętla od loopStart (pomija dopełnienie kodera); syncPoint → wcześniejszy start albo wejście w środek
    let fileOffset = offset ?? (hasLoopPoints ? loopStart : 0);
    let wait = Math.max(0, delay);
    if (hitIn !== undefined && entry.syncPoint) {
      wait = Math.max(0, delay) + hitIn - entry.syncPoint / speed;
      if (wait < 0) {
        fileOffset += -wait * speed;   // spóźnieni: wchodzimy w plik tak, by uderzenie i tak trafiło w zdarzenie
        wait = 0;
      }
    }
    if (hasLoopPoints && fileOffset >= source.loopEnd) {
      fileOffset = loopStart + ((fileOffset - loopStart) % (source.loopEnd - loopStart));
    }
    fileOffset = clamp(fileOffset, 0, Math.max(0, buffer.duration - 0.01));

    const trim = dbToGain((entry.gainDb ?? 0) + jitter(entry.gainJitterDb));
    const level = volumeOf(volume) * trim;
    const gain = ctx.createGain();
    const start = ctx.currentTime + wait;
    if (fadeIn > 0) {
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(level, start + fadeIn / 1000);
    } else {
      gain.gain.value = level;
    }
    let tail = gain;
    if (pan && ctx.createStereoPanner && this.#maxVoices >= MAX_VOICES) {
      const panner = ctx.createStereoPanner();
      panner.pan.value = clamp(pan, -1, 1);
      gain.connect(panner);
      tail = panner;
    }
    source.connect(gain);
    tail.connect(this.#buses[busName] ?? this.#buses.sfx);
    source.start(start, fileOffset);

    const voice = { group, priority, loop: looping, startedAt: now, stop: null };
    const handle = {
      playing: true,
      /** Czas zegara audio startu i pozycja pliku w tej chwili — do wyliczania bieżącej pozycji muzyki. */
      ctxStart: start,
      fileOffset,
      speed,
      stop: (fadeMs = 0) => {
        if (!handle.playing) return;
        handle.playing = false;
        this.#voices.delete(voice);              // gniazdo wolne od razu (nie czekamy na koniec wyciszenia)
        const t = ctx.currentTime;
        gain.gain.cancelScheduledValues(t);
        gain.gain.setValueAtTime(gain.gain.value, t);
        gain.gain.linearRampToValueAtTime(0, t + fadeMs / 1000);
        try { source.stop(t + fadeMs / 1000 + 0.02); } catch { /* już zatrzymany */ }
      },
      setRate: (r) => source.playbackRate.setTargetAtTime(r, ctx.currentTime, 0.05),
      setVolume: (v, ms = 120) => {
        const t = ctx.currentTime;
        gain.gain.cancelScheduledValues(t);
        gain.gain.setValueAtTime(gain.gain.value, t);
        gain.gain.linearRampToValueAtTime(volumeOf(v) * trim, t + ms / 1000);
      },
    };
    voice.stop = handle.stop;
    source.onended = () => {
      handle.playing = false;
      this.#voices.delete(voice);
    };
    if (!isMusic) {
      this.#voices.add(voice);
      this.#lastStart.set(group, now);
    }
    return handle;
  }

  /** Stan silnika do testów e2e i panelu ?fx=debug (bez dostępu do węzłów audio). */
  stats() {
    return {
      unlocked: this.#unlocked,
      state: this.#ctx?.state ?? 'none',
      sounds: this.#sounds ? Object.keys(this.#sounds).length : 0,
      decoded: this.#buffers.size,
      voices: this.#voices.size,
      maxVoices: this.#maxVoices,
      music: this.#music ? { id: this.#music.id, ...this.musicState() } : null,
      layer: this.#layer?.id ?? null,
      keyContext: this.#keyContext,
      format: this.#opus === null ? '?' : this.#opus ? 'webm' : 'm4a',
      ducks: Object.fromEntries(this.#ducks),
    };
  }

  /** Zatrzymuje wszystkie efekty (pominięcie sekwencji, błąd) — muzyka gra dalej. */
  stopAll(fadeMs = 80) {
    for (const v of [...this.#voices]) v.stop(fadeMs);
  }

  /** Czas zegara audio (s) — do planowania dźwięków razem z animacją. */
  get currentTime() {
    return this.#ctx?.currentTime ?? 0;
  }

  /**
   * Losowy wariant bez powtórzeń (05 § 2.6): playVariant('sfx_moneta_', 5) gra jeden z sfx_moneta_1 … _5,
   * nigdy ten sam dwa razy z rzędu („brak ostatniego” to undefined, nie 0 — inaczej wariant 1 nie zagrałby pierwszy).
   */
  playVariant(prefix, count, options) {
    const last = this.#lastVariant.get(prefix);
    let n;
    if (last === undefined || count < 2) {
      n = 1 + Math.floor(Math.random() * count);
    } else {
      n = 1 + Math.floor(Math.random() * (count - 1));
      if (n >= last) n += 1;
    }
    this.#lastVariant.set(prefix, n);
    return this.play(`${prefix}${n}`, options);
  }

  /**
   * Muzyka w pętli z przenikaniem (crossfade) — gra zawsze jeden utwór naraz.
   * @param {{fadeMs?: number, volume?: number, offset?: number, delay?: number}} o offset — start od pozycji (s),
   *   np. wznowienie muzyki gry „od zapamiętanego taktu” po big winie (05 § 4.5, przejście 9); domyślnie `loopStart`;
   *   delay — start na zegarze audio (np. `mus_bigwin` w chwili uderzenia stingera)
   */
  async playMusic(id, { fadeMs = 1200, volume = 1, offset, delay = 0 } = {}) {
    const requestedAt = this.currentTime;
    this.#wantedMusic = { id, fadeMs, volume, offset, delay };
    if (!this.#unlocked || this.#settings.muted) return;
    if (this.#music?.id === id && this.#music.handle.playing) return;
    await this.#loadManifest();
    if (!this.has(id)) {
      // brak pliku (pipeline dźwięku jeszcze go nie dostarczył) — wyciszamy poprzedni utwór, bez błędu
      this.#music?.handle.stop(fadeMs);
      this.#music = null;
      return;
    }
    const buffer = await this.#buffer(id);
    if (!buffer || this.#wantedMusic?.id !== id) return; // w międzyczasie zamówiono inny utwór
    // czas oczekiwania na dekodowanie wliczamy w opóźnienie (uderzenie stingera nie czeka na plik)
    const wait = Math.max(0, delay - (this.currentTime - requestedAt));
    this.#music?.handle.stop(fadeMs);
    const handle = this.play(id, { loop: true, bus: 'music', volume, fadeIn: fadeMs, offset, delay: wait });
    this.#music = handle === SILENT ? null : { id, handle, entry: this.#sounds[id], duration: buffer.duration };
  }

  stopMusic(fadeMs = 800) {
    this.#wantedMusic = null;
    this.#music?.handle.stop(fadeMs);
    this.#music = null;
  }

  /** Pozycja w pliku utworu z uwzględnieniem pętli loopStart–loopEnd. */
  #position(m) {
    const { handle, entry, duration } = m;
    let pos = handle.fileOffset + Math.max(0, this.#ctx.currentTime - handle.ctxStart) * handle.speed;
    const ls = entry.loopStart ?? 0;
    const le = entry.loopEnd > ls ? Math.min(entry.loopEnd, duration) : duration;
    if (pos >= le) pos = ls + ((pos - ls) % (le - ls));
    return pos;
  }

  /** Bieżący utwór i pozycja (s, początek taktu) — do wznowienia po przerwie (big win „od zapamiętanego taktu”). */
  musicState() {
    if (!this.#music || !this.#ctx) return this.#wantedMusic ? { id: this.#wantedMusic.id } : null;
    const m = this.#music;
    let pos = this.#position(m);
    const { entry } = m;
    if (entry.bpm) {
      // początek taktu, w którym przerwano (takt = beatsPerBar × 60 / bpm), liczony od loopStart
      const bar = ((entry.beatsPerBar ?? 4) * 60) / entry.bpm;
      const ls = entry.loopStart ?? 0;
      pos = ls + Math.floor(Math.max(0, pos - ls) / bar) * bar;
    }
    return { id: m.id, position: Math.max(0, pos) };
  }

  /** Warstwa napięcia (mus_napiecie) nakładana na muzykę gry w antycypacji — osobne gniazdo, poza limitem głosów. */
  async setLayer(id, on, { fadeMs = 400, volume = 1 } = {}) {
    if (!on) {
      this.#layer?.handle.stop(fadeMs);
      this.#layer = null;
      return;
    }
    if (!this.#unlocked || this.#settings.muted || this.#layer?.id === id) return;
    await this.#loadManifest();
    if (!this.has(id)) return;
    const buffer = await this.#buffer(id);
    if (!buffer) return;
    const handle = this.play(id, { loop: true, bus: 'music', volume, fadeIn: fadeMs });
    this.#layer = handle === SILENT ? null : { id, handle };
  }

  /**
   * Ducking nazwany (05 § 5.3): kilka naraz → bierzemy NAJGŁĘBSZY, nie sumę (big win + wygrana = −6 dB, nie −9).
   * @param {string} name np. 'wygrana', 'bigwin', 'napiecie', 'stinger'
   */
  duck(name, db, { attack = 0.05 } = {}) {
    this.#ducks.set(name, db);
    this.#applyDuck(attack);
  }

  unduck(name, { release = 0.4 } = {}) {
    if (!this.#ducks.delete(name)) return;
    this.#applyDuck(release);
  }

  #applyDuck(seconds) {
    if (!this.#duckNode) return;
    const db = Math.min(0, ...this.#ducks.values());
    const g = this.#duckNode.gain;
    const t = this.#ctx.currentTime;
    g.cancelScheduledValues(t);
    g.setValueAtTime(g.value, t);
    g.setTargetAtTime(dbToGain(db), t, Math.max(0.005, seconds / 3));  // ~95% celu po 3 stałych czasowych
  }

  /** Filtr muzyki: 1200 Hz w antycypacji, 20 000 Hz = przezroczysty (05 § 4.5). */
  setMusicFilter(hz, ms = 400) {
    if (!this.#filterNode) return;
    const f = this.#filterNode.frequency;
    const t = this.#ctx.currentTime;
    f.cancelScheduledValues(t);
    f.setValueAtTime(f.value, t);
    f.exponentialRampToValueAtTime(clamp(hz, 40, 20000), t + Math.max(0.01, ms / 1000));
  }

  /** Głośność szyny (0–1): 'master' | 'ui' | 'sfx' | 'music'. */
  getVolume(bus) {
    return this.#settings[bus] ?? 1;
  }

  setVolume(bus, value) {
    if (!(bus in DEFAULTS) || bus === 'muted') return;
    this.#settings[bus] = clamp01(value);
    this.#save();
    this.#applyVolumes();
  }

  isMuted() {
    return this.#settings.muted;
  }

  setMuted(muted) {
    this.#settings.muted = Boolean(muted);
    this.#save();
    this.#applyVolumes();
    if (muted) {
      this.#music?.handle.stop(200);
      this.#layer?.handle.stop(200);
      this.#layer = null;
    } else if (this.#wantedMusic && !this.#music?.handle.playing) {
      this.#music = null;
      this.playMusic(this.#wantedMusic.id, { ...this.#wantedMusic, delay: 0 });
    }
    this.dispatchEvent(new CustomEvent('change', { detail: { muted: this.#settings.muted } }));
  }

  toggleMuted() {
    this.setMuted(!this.#settings.muted);
    return this.#settings.muted;
  }

  /** Subskrypcja zmian ustawień (np. żeby przełącznik w menu i ikona w grze były zgodne). */
  onChange(listener) {
    const handler = (e) => listener(e.detail);
    this.addEventListener('change', handler);
    return () => this.removeEventListener('change', handler);
  }

  #applyVolumes(rampMs = 120) {
    if (!this.#ctx) return;
    const t = this.#ctx.currentTime;
    const ramp = (param, value) => {
      param.cancelScheduledValues(t);
      param.setValueAtTime(param.value, t);
      param.linearRampToValueAtTime(value, t + rampMs / 1000);
    };
    ramp(this.#master.gain, this.#settings.muted ? 0 : this.#settings.master);
    for (const bus of BUSES) ramp(this.#buses[bus].gain, this.#settings[bus]);
  }

  #save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.#settings));
    } catch {
      /* tryb prywatny / zablokowane dane witryny — ustawienia działają do końca wizyty */
    }
  }
}

/** Jedna instancja na stronę (wszystkie moduły importują tę samą). */
export const audio = new AudioEngine();
