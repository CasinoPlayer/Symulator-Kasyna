/**
 * game/step-player.js — odtwarzacz kroków rundy (kontrakt 09 § 2.4).
 *
 * Serwer liczy całą rundę naraz i zwraca listę kroków (`spin`, `win`, `feature`, `cascade`, `expandWild`,
 * `applyMultiplier`, `freeSpinsStart`, `freeSpinsRetrigger`, `freeSpinsEnd`). Front niczego nie losuje i niczego
 * nie liczy — StepPlayer odgrywa kroki PO KOLEI: każdy handler jest funkcją `async`, a następny krok startuje,
 * gdy poprzedni się skończy (`await`). Dzięki temu kolejność animacji = kolejność w odpowiedzi serwera.
 *
 * Rozszerzalność: gra rejestruje handlery dla typów, które rozumie (S1: spin, win, feature). Dla pozostałych
 * typów są handlery DOMYŚLNE (podmiana planszy, komunikat na banerze, licznik darmowych spinów), więc odpowiedź
 * S2/S3 odegra się poprawnie także w grze, która jeszcze nie ma własnych efektów — S2 i S3 dopiszą swoje handlery
 * (`player.register('cascade', …)`) bez zmian w runtime.
 *
 * Kontekst rundy (`ctx`) przekazywany do handlerów:
 *   response, steps, index (bieżący krok), bet, tempo (TURBO), autoplay, skip (SkipToken), state (dowolne dane
 *   gry między krokami), shownWin (suma pokazana na liczniku), next(type) (podgląd kolejnych kroków).
 */

import { SkipToken } from './core/tween.js';
import { fxRng } from './core/random.js';

export const STEP_TYPES = Object.freeze([
  'spin', 'win', 'feature', 'cascade', 'expandWild', 'applyMultiplier', 'freeSpinsStart', 'freeSpinsRetrigger', 'freeSpinsEnd',
]);

export class StepPlayer extends EventTarget {
  #handlers = new Map();
  #hooks = {};
  playing = false;
  ctx = null;

  /**
   * @param {{handlers?: Record<string, Function>, hooks?: {beforeRound?: Function, afterRound?: Function, beforeStep?: Function, afterStep?: Function}}} o
   */
  constructor({ handlers = {}, hooks = {} } = {}) {
    super();
    for (const [type, fn] of Object.entries(handlers)) this.register(type, fn);
    this.#hooks = hooks;
  }

  /** Rejestruje (albo podmienia) handler typu kroku: `async (step, ctx) => {}`. */
  register(type, fn) {
    this.#handlers.set(type, fn);
    return this;
  }

  has(type) {
    return this.#handlers.has(type);
  }

  /**
   * Odgrywa rundę.
   * @param {object} response odpowiedź POST /api/slots/{code}/spins
   * @param {{tempo?: number, autoplay?: boolean, token?: SkipToken}} o
   */
  async play(response, { tempo = 1, autoplay = false, token = new SkipToken() } = {}) {
    const steps = Array.isArray(response?.steps) ? response.steps : [];
    const ctx = {
      response,
      steps,
      index: -1,
      bet: response.bet,
      tempo,
      autoplay,
      skip: token,
      state: {},
      shownWin: 0,
      /** Kroki danego typu po bieżącym (np. win sprawdza, czy w rundzie jest jeszcze feature). */
      next: (type) => steps.slice(ctx.index + 1).filter((s) => !type || s.type === type),
      /** Kroki danego typu w całej rundzie. */
      all: (type) => steps.filter((s) => s.type === type),
    };
    this.ctx = ctx;
    this.playing = true;
    // ziarno efektów z identyfikatora rundy (04 R10: ta sama runda wygląda zawsze tak samo)
    fxRng.reseed(`${response.roundId ?? Date.now()}:${response.seed ?? ''}`);
    this.dispatchEvent(new CustomEvent('round', { detail: { phase: 'start', response } }));
    try {
      await this.#hooks.beforeRound?.(ctx);
      for (let i = 0; i < steps.length; i++) {
        ctx.index = i;
        const step = steps[i];
        await this.#hooks.beforeStep?.(step, ctx);
        const handler = this.#handlers.get(step.type) ?? this.#defaultHandler(step.type);
        this.dispatchEvent(new CustomEvent('step', { detail: { step, index: i } }));
        await handler(step, ctx);
        if (typeof step.totalWin === 'number') ctx.shownWin = Math.max(ctx.shownWin, step.totalWin);
        await this.#hooks.afterStep?.(step, ctx);
      }
      await this.#hooks.afterRound?.(ctx);
    } finally {
      this.playing = false;
      this.dispatchEvent(new CustomEvent('round', { detail: { phase: 'end', response } }));
    }
    return ctx;
  }

  #defaultHandler(type) {
    return async (step) => {
      console.warn(`[StepPlayer] brak handlera dla kroku „${type}” — pomijam`, step);
    };
  }
}
