/**
 * audio/audio-engine.js — silnik dźwięku na Web Audio API.
 *
 * Dlaczego Web Audio, a nie <audio>: dźwięki startują z dokładnością do milisekund (synchronizacja z animacją
 * bębnów), można grać wiele naraz, zmieniać wysokość (rosnące stopy bębnów) i miksować głośności szynami.
 *
 * Budowa (graf audio):
 *     źródła ─┬─▶ szyna "ui"    ─┐
 *             ├─▶ szyna "sfx"   ─┼─▶ master ─▶ głośniki
 *             └─▶ szyna "music" ─┘
 *
 * Zasady:
 *   * przeglądarki blokują dźwięk do pierwszego gestu użytkownika — wołamy unlock() przy kliknięciu
 *     „Zaloguj” / „Wejdź do kasyna” (plan § 6) albo unlockOnGesture() (dowolny gest); przed tym play() milczy,
 *   * pliki opisuje static/assets/audio/manifest.json (kontrakt 09 § 3, pola w 05 § 7.5). Gdy go nie ma albo
 *     brakuje ID — cisza bez błędów (dźwięki dochodzą z pipeline'u tools/audio bez zmian w kodzie),
 *   * POZIOM każdego dźwięku ustala manifest (`gainDb`, 05 § 5) — kod nie dokłada własnych „ściszeń”,
 *     dzięki temu miks stroi się w jednym miejscu (pipeline dźwięku), a nie w kilkunastu wywołaniach play(),
 *   * limity głosów (05 § 2.5): najwyżej 24 efekty naraz z priorytetami 1–5, a na dźwięk/grupę `maxVoices`
 *     i `cooldownMs` — inaczej np. 24 monety w bonusie dałyby 24 nakładające się „brzdęki” i trzaski,
 *   * głośności i wyciszenie pamiętamy w localStorage (try/catch: tryb prywatny może go blokować),
 *   * przy ukrytej karcie kontekst audio jest wstrzymywany (oszczędność baterii, brak „grającego tła”).
 */

const STORAGE_KEY = 'cebulion.audio';
const DEFAULTS = Object.freeze({ muted: false, master: 0.9, ui: 0.6, sfx: 0.85, music: 0.45 });
const BUSES = ['ui', 'sfx', 'music'];
const MANIFEST_URL = new URL('assets/audio/manifest.json', document.baseURI);
const MAX_VOICES = 24;           // 05 § 2.5 (poziom jakości Low: 16 — dojdzie z przełączaniem jakości w grze)
const DEFAULT_PRIORITY = 3;      // „normalny”, gdy manifest nie podaje priorytetu
const DEFAULT_PACK = 'gry-dalsze'; // wpis bez `packs` i `pack` (05 § 7.5)

/** Decybele → mnożnik amplitudy: −6 dB ≈ 0,5; 0 dB = 1; +4 dB ≈ 1,58. */
const dbToGain = (db) => 10 ** (db / 20);
/** Losowa wartość z przedziału [−a, +a] (mikro-zmiany wysokości i głośności — ucho nie słyszy „kopiuj-wklej”). */
const jitter = (a) => (a ? (Math.random() * 2 - 1) * a : 0);

/** Uchwyt grającego dźwięku; dla dźwięków, których nie ma, zwracamy ten „pusty”. */
const SILENT = Object.freeze({ stop() {}, setRate() {}, playing: false });

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

class AudioEngine extends EventTarget {
  #ctx = null;
  #master = null;
  #buses = {};
  #settings = loadSettings();
  #sounds = null;            // mapa ID → wpis z manifestu (null = jeszcze nie wczytano)
  #manifestPromise = null;
  #buffers = new Map();      // ID → AudioBuffer
  #pending = new Map();      // ID → Promise<AudioBuffer|null>
  #music = null;             // { id, source, gain }
  #wantedMusic = null;       // muzyka zamówiona przed wczytaniem pliku
  #unlocked = false;
  #voices = new Set();       // grające efekty (muzyka ma własne „gniazdo” i nie wlicza się do limitu)
  #lastStart = new Map();    // grupa dźwięku → performance.now() ostatniego startu (cooldownMs)
  #opus = null;              // czy przeglądarka gra WebM/Opus (sprawdzane raz na stronę)

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

  /** Wybiera format obsługiwany przez przeglądarkę: WebM/Opus (mniejszy) albo M4A/AAC (Safari). */
  #fileFor(entry) {
    this.#opus ??= document.createElement('audio').canPlayType('audio/webm; codecs="opus"') !== '';
    const path = this.#opus && entry.webm ? entry.webm : entry.m4a ?? entry.webm;
    return path ? new URL(path, MANIFEST_URL).href : null;
  }

  /** Pobiera i dekoduje plik dźwięku (raz, wynik w pamięci podręcznej). */
  #buffer(id) {
    if (this.#buffers.has(id)) return Promise.resolve(this.#buffers.get(id));
    if (this.#pending.has(id)) return this.#pending.get(id);
    const entry = this.#sounds?.[id];
    const url = entry && this.#fileFor(entry);
    if (!url || !this.#ctx) return Promise.resolve(null);
    const promise = fetch(url)
      .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(String(r.status)))))
      .then((data) => this.#ctx.decodeAudioData(data))
      .then((buffer) => {
        this.#buffers.set(id, buffer);
        return buffer;
      })
      .catch(() => null)
      .finally(() => this.#pending.delete(id));
    this.#pending.set(id, promise);
    return promise;
  }

  /** Wczytuje z wyprzedzeniem (np. przed sekwencją bonusu), żeby pierwszy dźwięk nie był opóźniony. */
  async preload(ids) {
    if (!this.#unlocked) return;
    await this.#loadManifest();
    await Promise.all(ids.map((id) => this.#buffer(id)));
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
      .filter(([, e]) => (e.packs ?? [e.pack ?? DEFAULT_PACK]).some((p) => names.includes(p)))
      .map(([id]) => id);
    await Promise.all(ids.map((id) => this.#buffer(id)));
  }

  /**
   * Czy nowy efekt o priorytecie `prio` dostanie głos — w razie potrzeby kosztem innego (05 § 2.5).
   * Krytycznych (5) nie kradniemy nigdy; pętle tła oddajemy tylko ważnym (≥ 4); poza tym kradniemy najniższy,
   * a przy równym priorytecie — najstarszy. Krytyczny dźwięk może wyjątkowo przekroczyć limit.
   */
  #acquireVoice(prio) {
    if (this.#voices.size < MAX_VOICES) return true;
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

  /**
   * Odtwarza dźwięk. Poziom = `gainDb` z manifestu (± `gainJitterDb`) × `volume`; wysokość ± `pitchCents`;
   * pętle grają między `loopStart` a `loopEnd` (bezszwowo). Efekty podlegają limitom głosów (05 § 2.5).
   * @param {string} id identyfikator z briefu §10, np. 'ui_klik', 'sfx_moneta_3'
   * @param {{volume?: number, rate?: number, detune?: number, loop?: boolean, bus?: 'ui'|'sfx'|'music', delay?: number, fadeIn?: number}} o
   *   volume — dodatkowy mnożnik 0–1 TYLKO do płynnych zmian (np. przenikanie muzyki); poziomu nie stroimy w kodzie
   * @returns {{stop: (fadeMs?: number) => void, setRate: (r: number) => void, playing: boolean}}
   */
  play(id, { volume = 1, rate = 1, detune = 0, loop, bus, delay = 0, fadeIn = 0 } = {}) {
    if (!this.#unlocked || this.#settings.muted || !this.has(id)) return SILENT;
    const buffer = this.#buffers.get(id);
    if (!buffer) {
      this.#buffer(id); // pierwsze użycie bez preloadPack(): wczytaj na następny raz
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
      // maxVoices: za dużo kopii tej samej grupy → wyciszamy najstarszą; druga kopia pętli to zawsze błąd logiki
      const limit = entry.maxVoices ?? (looping ? 1 : Infinity);
      let copies = 0;
      let oldest = null;
      for (const v of this.#voices) {
        if (v.group !== group) continue;
        copies++;
        if (!oldest || v.startedAt < oldest.startedAt) oldest = v;
      }
      if (copies >= limit) oldest.stop(12);
      if (!this.#acquireVoice(priority)) return SILENT;
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = looping;
    if (looping && entry.loopEnd > (entry.loopStart ?? 0)) {
      source.loopStart = entry.loopStart ?? 0;
      source.loopEnd = entry.loopEnd;
    }
    source.playbackRate.value = rate;
    const cents = detune + jitter(entry.pitchCents);
    if (cents) source.detune.value = cents;
    const level = clamp01(volume) * dbToGain((entry.gainDb ?? 0) + jitter(entry.gainJitterDb));
    const gain = ctx.createGain();
    const start = ctx.currentTime + delay;
    if (fadeIn > 0) {
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(level, start + fadeIn / 1000);
    } else {
      gain.gain.value = level;
    }
    source.connect(gain).connect(this.#buses[busName] ?? this.#buses.sfx);
    source.start(start);

    const voice = { group, priority, loop: looping, startedAt: now, stop: null };
    const handle = {
      playing: true,
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

  /** Losowy wariant: playVariant('sfx_moneta_', 5) gra jeden z sfx_moneta_1 … sfx_moneta_5. */
  playVariant(prefix, count, options) {
    return this.play(`${prefix}${1 + Math.floor(Math.random() * count)}`, options);
  }

  /** Muzyka w pętli z przenikaniem (crossfade) — gra zawsze jeden utwór naraz. */
  async playMusic(id, { fadeMs = 1200, volume = 1 } = {}) {
    this.#wantedMusic = { id, fadeMs, volume };
    if (!this.#unlocked || this.#settings.muted) return;
    if (this.#music?.id === id && this.#music.handle.playing) return;
    await this.#loadManifest();
    if (!this.has(id)) return;
    const buffer = await this.#buffer(id);
    if (!buffer || this.#wantedMusic?.id !== id) return; // w międzyczasie zamówiono inny utwór
    this.#music?.handle.stop(fadeMs);
    const handle = this.play(id, { loop: true, bus: 'music', volume, fadeIn: fadeMs });
    this.#music = handle === SILENT ? null : { id, handle };
  }

  stopMusic(fadeMs = 800) {
    this.#wantedMusic = null;
    this.#music?.handle.stop(fadeMs);
    this.#music = null;
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
    if (muted) this.#music?.handle.stop(200);
    else if (this.#wantedMusic && !this.#music?.handle.playing) {
      this.#music = null;
      this.playMusic(this.#wantedMusic.id, this.#wantedMusic);
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
