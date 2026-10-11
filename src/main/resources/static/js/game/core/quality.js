/**
 * game/core/quality.js — poziomy jakości High / Medium / Low i tryb ograniczonego ruchu (brief § 5, 04 § 1.5, § 2.2).
 *
 * Dlaczego trzy poziomy i automat: ten sam automat ma działać płynnie na słabym telefonie i na monitorze 4K.
 * Zamiast zgadywać możliwości sprzętu, mierzymy czas klatki: gdy 90. percentyl (p90) przekracza 20 ms przez 2 s
 * (4 pomiary co 500 ms z rzędu), obniżamy poziom o jeden. Gracz może też wybrać poziom ręcznie (wyłącza automat).
 *
 * Co zmienia się od razu (limit cząsteczek, drżenie, filtry), a co dopiero między rundami (rozdzielczość DPR) —
 * zmiana ostrości w trakcie spinu byłaby widocznym „skokiem” obrazu (04 § 2.2).
 */

const STORAGE_KEY = 'cebulion.jakosc';
const MOTION_KEY = 'cebulion.ruch';

/** Parametry poziomów — wartości z briefu § 5 i 04 § 2.2 (tabela „Poziomy jakości”). */
export const LEVELS = Object.freeze({
  high: Object.freeze({
    name: 'high', index: 0, dpr: 2, particles: 600, bloom: 'filter', shake: true, filters: true,
    raysLayers: 2, raysScale: 1.6, raysBAlpha: 0.5, smoke: 12, shine: 'shader', confetti: 220, bgFx: 1, lightning: 3,
  }),
  medium: Object.freeze({
    name: 'medium', index: 1, dpr: 1.5, particles: 300, bloom: 'baked', shake: true, filters: false,
    raysLayers: 2, raysScale: 1.3, raysBAlpha: 0.3, smoke: 6, shine: 'shader', confetti: 110, bgFx: 0.5, lightning: 2,
  }),
  low: Object.freeze({
    name: 'low', index: 2, dpr: 1, particles: 120, bloom: 'none', shake: false, filters: false,
    raysLayers: 1, raysScale: 1.1, raysBAlpha: 0, smoke: 2, shine: 'syl', confetti: 40, bgFx: 0, lightning: 1,
  }),
});
const ORDER = ['high', 'medium', 'low'];

const storage = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* tryb prywatny */ } },
};

/** Poziom startowy (04 § 2.2): komputer High, ekran dotykowy Medium, mało pamięci / oszczędzanie danych Low. */
function initialLevel() {
  const mem = navigator.deviceMemory;
  const saveData = navigator.connection?.saveData;
  if ((mem && mem <= 2) || saveData) return 'low';
  if (matchMedia('(pointer: coarse)').matches) return 'medium';
  return 'high';
}

export class Quality extends EventTarget {
  /** 'auto' albo nazwa poziomu wybranego ręcznie. */
  mode = 'auto';
  level = 'high';
  #samples = new Float32Array(120);
  #scratch = new Float32Array(120);
  #count = 0;
  #head = 0;
  #sinceCheck = 0;
  #badChecks = 0;
  #goodMs = 0;
  #suspendMs = 0;
  #lastChangeAt = -Infinity;
  #downgrades = { high: 0, medium: 0, low: 0 };
  #clockMs = 0;
  /** Ostatnio policzony p90 (ms) — panel debug i raport e2e. */
  p90 = 0;
  fps = 60;
  /** Historia zmian (raport e2e). */
  log = [];

  constructor() {
    super();
    const saved = storage.get(STORAGE_KEY);
    if (saved && (saved === 'auto' || LEVELS[saved])) this.mode = saved;
    this.level = this.mode === 'auto' ? initialLevel() : this.mode;
  }

  get params() {
    return LEVELS[this.level];
  }

  /** Wybiera wartość dla bieżącego poziomu z trójki [High, Medium, Low] (karty zdarzeń w 04 podają takie trójki). */
  pick(triple) {
    return Array.isArray(triple) ? triple[this.params.index] ?? triple.at(-1) : triple;
  }

  /** Ręczny wybór: 'auto' | 'high' | 'medium' | 'low'. */
  setMode(mode) {
    if (mode !== 'auto' && !LEVELS[mode]) return;
    this.mode = mode;
    storage.set(STORAGE_KEY, mode);
    this.#setLevel(mode === 'auto' ? this.level : mode, 'manual');
  }

  /** Wstrzymuje pomiar (ekran ładowania, wgrywanie tekstur, przejścia — zawyżają czasy klatek). */
  suspend(ms) {
    this.#suspendMs = Math.max(this.#suspendMs, ms);
    this.#count = 0;
    this.#badChecks = 0;
  }

  /** Wywoływane co klatkę z czasem klatki w ms (04 § 7.3, krok 8). */
  sample(frameMs) {
    this.#clockMs += frameMs;
    if (this.#suspendMs > 0) {
      this.#suspendMs -= frameMs;
      return;
    }
    this.#samples[this.#head] = frameMs;
    this.#head = (this.#head + 1) % this.#samples.length;
    this.#count = Math.min(this.#count + 1, this.#samples.length);
    this.#sinceCheck += frameMs;
    if (this.#sinceCheck < 500) return;
    this.#sinceCheck = 0;
    this.p90 = this.#percentile(0.9);
    const p50 = this.#percentile(0.5);
    this.fps = p50 > 0 ? Math.round(1000 / p50) : 60;
    if (this.mode !== 'auto' || this.#count < 30) return;
    // obniżenie: p90 > 20 ms w 4 kolejnych pomiarach (= 2 s)
    if (this.p90 > 20) {
      this.#goodMs = 0;
      if (++this.#badChecks >= 4) {
        this.#badChecks = 0;
        this.#step(+1, `p90 ${this.p90.toFixed(1)} ms > 20 ms przez 2 s`);
      }
    } else {
      this.#badChecks = 0;
      this.#goodMs = this.p90 < 12 ? this.#goodMs + 500 : 0;
    }
  }

  /**
   * Podwyższenie poziomu — tylko między rundami (woła je kontroler, gdy gra czeka na SPIN):
   * p90 < 12 ms przez 20 s, najwyżej raz na 2 min, bez powrotu na poziom, z którego dwa razy spadliśmy.
   */
  maybeUpgrade() {
    if (this.mode !== 'auto' || this.#goodMs < 20_000) return;
    if (this.#clockMs - this.#lastChangeAt < 120_000) return;
    const target = ORDER[ORDER.indexOf(this.level) - 1];
    if (!target || this.#downgrades[target] >= 2) return;
    this.#goodMs = 0;
    this.#setLevel(target, `p90 ${this.p90.toFixed(1)} ms < 12 ms przez 20 s`);
  }

  #step(dir, reason) {
    const i = ORDER.indexOf(this.level) + dir;
    if (i < 0 || i >= ORDER.length) return;
    if (dir > 0) this.#downgrades[this.level] += 1;
    this.#setLevel(ORDER[i], reason);
  }

  #setLevel(level, reason) {
    if (!LEVELS[level]) return;
    const changed = level !== this.level;
    this.level = level;
    this.#lastChangeAt = this.#clockMs;
    this.#count = 0;
    this.#badChecks = 0;
    if (changed || reason === 'manual') {
      this.log.push({ at: Math.round(this.#clockMs), level, reason });
      this.dispatchEvent(new CustomEvent('change', { detail: { level, reason } }));
    }
  }

  #percentile(p) {
    const n = this.#count;
    if (!n) return 0;
    const a = this.#scratch.subarray(0, n);
    a.set(this.#samples.subarray(0, n));
    a.sort();
    return a[Math.min(n - 1, Math.floor(p * n))];
  }
}

/**
 * Ograniczenie ruchu (04 § 1.5): system (`prefers-reduced-motion`) albo przełącznik gracza.
 * Wyłącza błyski i drżenie, zmniejsza liczbę i prędkość cząsteczek, zastępuje „uderzenia” przenikaniem.
 */
export class Motion extends EventTarget {
  #media = matchMedia('(prefers-reduced-motion: reduce)');
  /** 'auto' (jak system) | 'reduced' | 'full' */
  setting = storage.get(MOTION_KEY) ?? 'auto';

  constructor() {
    super();
    this.#media.addEventListener('change', () => this.#emit());
  }

  get reduced() {
    return this.setting === 'reduced' || (this.setting === 'auto' && this.#media.matches);
  }

  /** Mnożnik liczby cząsteczek (RM: × 0,3). */
  get particleMul() {
    return this.reduced ? 0.3 : 1;
  }

  /** Mnożnik prędkości cząsteczek (RM: × 0,6). */
  get speedMul() {
    return this.reduced ? 0.6 : 1;
  }

  set(value) {
    this.setting = value;
    storage.set(MOTION_KEY, value);
    document.documentElement.classList.toggle('ruch-ograniczony', this.reduced);
    this.#emit();
  }

  #emit() {
    document.documentElement.classList.toggle('ruch-ograniczony', this.reduced);
    this.dispatchEvent(new CustomEvent('change', { detail: { reduced: this.reduced } }));
  }
}
