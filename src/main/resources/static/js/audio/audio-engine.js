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
 *     „Zaloguj” / „Wejdź do kasyna” (plan § 6); przed tym wszystkie play() są cichymi no-op,
 *   * pliki opisuje static/assets/audio/manifest.json (kontrakt 09 § 3). Gdy go nie ma albo brakuje ID —
 *     cisza bez błędów (dźwięki dojdą z pipeline'u tools/audio bez zmian w kodzie),
 *   * głośności i wyciszenie pamiętamy w localStorage (try/catch: tryb prywatny może go blokować),
 *   * przy ukrytej karcie kontekst audio jest wstrzymywany (oszczędność baterii, brak „grającego tła”).
 */

const STORAGE_KEY = 'cebulion.audio';
const DEFAULTS = Object.freeze({ muted: false, master: 0.9, ui: 0.6, sfx: 0.85, music: 0.45 });
const BUSES = ['ui', 'sfx', 'music'];
const MANIFEST_URL = new URL('assets/audio/manifest.json', document.baseURI);

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
      if (this.#ctx.state === 'suspended') await this.#ctx.resume();
      this.#unlocked = true;
    } catch {
      return;
    }
    await this.#loadManifest();
    if (this.#wantedMusic) this.playMusic(this.#wantedMusic.id, this.#wantedMusic);
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
    const probe = document.createElement('audio');
    const opus = entry.webm && probe.canPlayType('audio/webm; codecs="opus"') !== '';
    const path = opus ? entry.webm : entry.m4a ?? entry.webm;
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
   * Odtwarza dźwięk.
   * @param {string} id identyfikator z briefu §10, np. 'ui_klik', 'sfx_moneta_3'
   * @param {{volume?: number, rate?: number, detune?: number, loop?: boolean, bus?: 'ui'|'sfx'|'music', delay?: number, fadeIn?: number}} o
   * @returns {{stop: (fadeMs?: number) => void, setRate: (r: number) => void, playing: boolean}}
   */
  play(id, { volume = 1, rate = 1, detune = 0, loop, bus, delay = 0, fadeIn = 0 } = {}) {
    if (!this.#unlocked || this.#settings.muted || !this.has(id)) return SILENT;
    const buffer = this.#buffers.get(id);
    if (!buffer) {
      this.#buffer(id); // pierwsze użycie: wczytaj na następny raz (dźwięki UI są krótkie, preload zalecany)
      return SILENT;
    }
    const entry = this.#sounds[id];
    const ctx = this.#ctx;
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = loop ?? Boolean(entry.loop);
    source.playbackRate.value = rate;
    if (detune) source.detune.value = detune;
    const gain = ctx.createGain();
    const start = ctx.currentTime + delay;
    if (fadeIn > 0) {
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(clamp01(volume), start + fadeIn / 1000);
    } else {
      gain.gain.value = clamp01(volume);
    }
    source.connect(gain).connect(this.#buses[bus ?? entry.bus ?? 'sfx'] ?? this.#buses.sfx);
    source.start(start);
    const handle = {
      playing: true,
      stop: (fadeMs = 0) => {
        if (!handle.playing) return;
        handle.playing = false;
        const t = ctx.currentTime;
        gain.gain.cancelScheduledValues(t);
        gain.gain.setValueAtTime(gain.gain.value, t);
        gain.gain.linearRampToValueAtTime(0, t + fadeMs / 1000);
        try { source.stop(t + fadeMs / 1000 + 0.02); } catch { /* już zatrzymany */ }
      },
      setRate: (r) => source.playbackRate.setTargetAtTime(r, ctx.currentTime, 0.05),
    };
    source.onended = () => { handle.playing = false; };
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
