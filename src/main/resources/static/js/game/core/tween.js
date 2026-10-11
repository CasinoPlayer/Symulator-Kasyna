/**
 * game/core/tween.js — zegar gry, animacje właściwości (tweeny), oczekiwanie i oś czasu (04 § 2.1, § 7.3).
 *
 * Trzy pojęcia, które student powinien umieć wyjaśnić:
 *   * Zegar gry płynie tylko wtedy, gdy działa ticker Pixi. Karta ukryta → ticker stoi → stoją też animacje
 *     i oczekiwania (`wait`). Dzięki temu po powrocie do karty nic nie „przeskakuje”.
 *   * Dwa czasy: `dt` (zwykły) i `fxDt` (zamrażany przez *hit-stop* — 80 ms „stopklatki” przy eskalacji big win,
 *     04 E31). Tween z opcją `freeze: true` stoi w czasie stopklatki, reszta (kamera, muzyka) biegnie dalej.
 *   * Przewinięcie (skip): `SkipToken` przekazany do `wait`/`tween` kończy je natychmiast. Sekwencje wygranych
 *     same decydują, jak wygląda ich stan końcowy — token tylko „budzi” czekające obietnice.
 *
 * Wydajność: obiekty tweenów pochodzą z puli i wracają do niej po zakończeniu (zero alokacji w pętli gry
 * poza obietnicami, które tworzymy tylko na żądanie przez `.promise`).
 */

import { resolveEasing } from './easing.js';

/** Token przewinięcia: `skip()` budzi wszystkie oczekiwania, które go dostały. */
export class SkipToken {
  #listeners = new Set();
  skipped = false;

  skip() {
    if (this.skipped) return;
    this.skipped = true;
    for (const fn of [...this.#listeners]) fn();
    this.#listeners.clear();
  }

  /** Rejestruje funkcję wywoływaną przy przewinięciu; zwraca funkcję wypisania. */
  onSkip(fn) {
    if (this.skipped) {
      fn();
      return () => {};
    }
    this.#listeners.add(fn);
    return () => this.#listeners.delete(fn);
  }
}

/** Jeden aktywny tween (obiekt z puli). */
class Tween {
  reset() {
    this.elapsed = 0;
    this.delay = 0;
    this.duration = 0;
    this.ease = null;
    this.onUpdate = null;
    this.onComplete = null;
    this.freeze = false;
    this.target = null;
    this.alive = false;
    this.resolve = null;
    this.promiseObj = null;
    this.unSkip = null;
    this.tag = null;
  }

  /** Obietnica zakończenia (tworzona leniwie — większość tweenów nikt nie „await”-uje). */
  get promise() {
    if (!this.alive) return Promise.resolve();
    this.promiseObj ??= new Promise((r) => { this.resolve = r; });
    return this.promiseObj;
  }
}

export class Tweener {
  #active = [];
  #pool = [];
  /** Czas gry w ms od startu (płynie tylko, gdy ticker działa). */
  now = 0;
  /** Czas efektów (stoi w czasie hit-stop). */
  fxNow = 0;
  #hitStop = 0;

  /** Pozostały czas stopklatki (ms). */
  get hitStopping() {
    return this.#hitStop > 0;
  }

  /** Stopklatka: przez `ms` tweeny z `freeze: true` (licznik, cząsteczki) stoją. */
  hitStop(ms) {
    this.#hitStop = Math.max(this.#hitStop, ms);
  }

  /**
   * Ogólny tween: co klatkę woła `onUpdate(eased, u)` przez `duration` ms.
   * @param {number} duration ms
   * @param {(e: number, u: number) => void} onUpdate
   * @param {{ease?: string|Function, delay?: number, freeze?: boolean, onComplete?: Function, token?: SkipToken, target?: object, tag?: string}} o
   * @returns {Tween}
   */
  tween(duration, onUpdate, o = {}) {
    const tw = this.#pool.pop() ?? new Tween();
    tw.reset();
    tw.duration = Math.max(0, duration);
    tw.delay = Math.max(0, o.delay ?? 0);
    tw.ease = resolveEasing(o.ease);
    tw.onUpdate = onUpdate;
    tw.onComplete = o.onComplete ?? null;
    tw.freeze = Boolean(o.freeze);
    tw.target = o.target ?? null;
    tw.tag = o.tag ?? null;
    tw.alive = true;
    if (o.token) tw.unSkip = o.token.onSkip(() => this.finish(tw));
    this.#active.push(tw);
    return tw;
  }

  /**
   * Animacja właściwości obiektu Pixi: x, y, alpha, rotation, scale (liczba → scale.set), scaleX, scaleY, tint nie.
   * @example tweener.to(sprite, { alpha: 0, scale: 1.2 }, { duration: 300, ease: 'easeOutCubic' })
   */
  to(target, props, o = {}) {
    const keys = Object.keys(props);
    const from = new Array(keys.length);
    const to = new Array(keys.length);
    let started = false;
    const read = (k) => (k === 'scale' ? target.scale.x : k === 'scaleX' ? target.scale.x : k === 'scaleY' ? target.scale.y : target[k]);
    const write = (k, v) => {
      if (k === 'scale') target.scale.set(v);
      else if (k === 'scaleX') target.scale.x = v;
      else if (k === 'scaleY') target.scale.y = v;
      else target[k] = v;
    };
    return this.tween(o.duration ?? 300, (e) => {
      if (!started) {
        // wartości startowe czytamy przy PIERWSZEJ klatce (po opóźnieniu), a nie w chwili wywołania —
        // tak działa łańcuch kilku tweenów tego samego obiektu
        started = true;
        for (let i = 0; i < keys.length; i++) {
          from[i] = read(keys[i]);
          to[i] = props[keys[i]];
        }
      }
      if (target.destroyed) return;
      for (let i = 0; i < keys.length; i++) write(keys[i], from[i] + (to[i] - from[i]) * e);
    }, { ...o, target });
  }

  /** Czeka `ms` czasu gry (albo do przewinięcia tokenem). */
  wait(ms, o = {}) {
    if (ms <= 0 || o.token?.skipped) return Promise.resolve();
    return this.tween(ms, null, o).promise;
  }

  /** Kończy tween natychmiast (stan końcowy + onComplete). */
  finish(tw) {
    if (!tw?.alive) return;
    tw.elapsed = tw.delay + tw.duration;
    this.#step(tw, 0, true);
  }

  /** Zatrzymuje tween bez ustawiania stanu końcowego. */
  kill(tw) {
    if (!tw?.alive) return;
    this.#release(tw);
  }

  /** Zatrzymuje tweeny danego obiektu (np. przed nową animacją tej samej właściwości). */
  killTweensOf(target, { complete = false } = {}) {
    for (const tw of this.#active) {
      if (tw.alive && tw.target === target) complete ? this.finish(tw) : this.kill(tw);
    }
  }

  killTag(tag, { complete = false } = {}) {
    for (const tw of this.#active) {
      if (tw.alive && tw.tag === tag) complete ? this.finish(tw) : this.kill(tw);
    }
  }

  /** Wywoływane raz na klatkę przez pętlę gry (04 § 7.3, krok 4). */
  update(dtMs) {
    this.now += dtMs;
    let fxDt = dtMs;
    if (this.#hitStop > 0) {
      const frozen = Math.min(this.#hitStop, dtMs);
      this.#hitStop -= frozen;
      fxDt = dtMs - frozen;
    }
    this.fxNow += fxDt;
    this.lastFxDt = fxDt;
    const list = this.#active;
    // iteracja po kopii długości: tweeny dodane w trakcie klatki ruszą w następnej
    const n = list.length;
    for (let i = 0; i < n; i++) {
      const tw = list[i];
      if (tw.alive) this.#step(tw, tw.freeze ? fxDt : dtMs, false);
    }
    // kompaktowanie tablicy (usunięcie martwych) bez tworzenia nowej
    let w = 0;
    for (let i = 0; i < list.length; i++) {
      const tw = list[i];
      if (tw.alive) list[w++] = tw;
      // Dopiero usunięcie starej referencji pozwala bezpiecznie użyć obiektu ponownie.
      // Natychmiastowy skip/kill przed tickiem nie może dać dwóch wpisów tego samego tweena.
      else this.#pool.push(tw);
    }
    list.length = w;
  }

  #step(tw, dt, force) {
    tw.elapsed += dt;
    const t = tw.elapsed - tw.delay;
    if (t < 0 && !force) return;
    const u = tw.duration > 0 ? Math.min(1, Math.max(0, t / tw.duration)) : 1;
    if (tw.onUpdate) tw.onUpdate(tw.ease(u), u);
    if (u >= 1) {
      const done = tw.onComplete;
      this.#release(tw);
      done?.();
    }
  }

  #release(tw) {
    tw.alive = false;
    tw.unSkip?.();
    const resolve = tw.resolve;
    tw.resolve = null;
    tw.onUpdate = null;
    tw.target = null;
    resolve?.();
    // Recykling następuje w update(), po usunięciu wpisu z #active.
  }

  /** Liczba aktywnych tweenów (do panelu ?fx=debug). */
  get count() {
    return this.#active.length;
  }
}

/**
 * Oś czasu zdarzenia (OsCzasu z 04 § 2.1): lista `{ t, fn }` wykonywanych, gdy zegar osi minie `t`.
 * `tempo` skaluje czasy (TURBO × 0,45), ale wpisy z `raw: true` (błyski — 04 § 1.4) zostają w czasie rzeczywistym.
 */
export class Timeline {
  #events = [];
  #tweener;
  #tempo;

  constructor(tweener, { tempo = 1 } = {}) {
    this.#tweener = tweener;
    this.#tempo = tempo;
  }

  /** Dodaje wpis; zwraca oś (łańcuch wywołań). */
  at(t, fn, { raw = false } = {}) {
    this.#events.push({ t: raw ? t : t * this.#tempo, fn });
    return this;
  }

  /** Uruchamia oś; obietnica kończy się po ostatnim wpisie (albo przy przewinięciu). */
  play({ token, extra = 0 } = {}) {
    const events = this.#events.sort((a, b) => a.t - b.t);
    const end = (events.at(-1)?.t ?? 0) + extra;
    let i = 0;
    let elapsed = 0;
    const tw = this.#tweener.tween(end, (_e, u) => {
      // po przewinięciu NIE odpalamy zaległych wpisów naraz (10 błysków w jednej klatce) — sekwencja
      // sama ustawia swój stan końcowy
      if (token?.skipped) return;
      elapsed = u * end;
      while (i < events.length && events[i].t <= elapsed + 0.001) events[i++].fn();
    }, { token });
    return tw.promise;
  }
}
