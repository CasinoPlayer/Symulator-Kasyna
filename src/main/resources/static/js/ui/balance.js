/**
 * ui/balance.js — licznik salda w pigułce z animacją odliczania (zdarzenie E08 saldo_zmiana).
 *
 * Po co animacja: kwota „przelicza się” od starej do nowej wartości, więc gracz WIDZI, ile dostał lub postawił.
 * Technika: requestAnimationFrame + łagodne hamowanie (easeOutCubic); cyfry o stałej szerokości (tabular-nums),
 * dzięki czemu tekst nie drga. Przy prefers-reduced-motion wartość zmienia się od razu.
 * Dla czytnika ekranu pigułka zawiera ukryte teksty „Saldo:” i jednostkę w poprawnej odmianie („cebulionów”).
 */

import { formatAmount, formatSigned, pluralCebulion } from '../format.js';

const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const easeOutCubic = (t) => 1 - (1 - t) ** 3;

export class BalanceCounter {
  /**
   * @param {HTMLElement} pill element .balance-pill z dzieckiem .balance-pill__value
   * @param {{onCountStart?: () => void, onCountEnd?: () => void}} options
   *   onCountStart / onCountEnd — początek i koniec odliczania (np. start i stop PĘTLI sfx_licznik_tik).
   *   Kolejne set() w trakcie liczenia (monety w bonusie dolatują jedna po drugiej) nie przerywają pętli:
   *   onCountEnd przychodzi dopiero, gdy licznik naprawdę stanie.
   */
  constructor(pill, { onCountStart, onCountEnd } = {}) {
    this.pill = pill;
    this.valueEl = pill.querySelector('.balance-pill__value');
    this.unitEl = pill.querySelector('.balance-pill__unit');
    this.onCountStart = onCountStart;
    this.onCountEnd = onCountEnd;
    this.counting = false;
    this.target = 0;
    this.shown = 0;
    this.frame = 0;
    this.resolve = null;
  }

  /**
   * Ustawia saldo.
   * @param {number} value nowa wartość
   * @param {{animate?: boolean, duration?: number}} options
   * @returns {Promise<void>} kończy się, gdy licznik dojdzie do wartości
   */
  set(value, { animate = true, duration } = {}) {
    this.#stop();
    this.target = Math.round(value);
    this.#label();
    const from = this.shown;
    const delta = this.target - from;
    if (!animate || reducedMotion.matches || delta === 0 || document.hidden) {
      this.#render(this.target);
      this.#setCounting(false);
      return Promise.resolve();
    }
    // dłuższe odliczanie dla większych kwot, ale w rozsądnych granicach (0,5–1,8 s)
    const ms = duration ?? Math.min(1800, Math.max(500, 380 + Math.log10(Math.abs(delta) + 1) * 300));
    const start = performance.now();
    this.#setCounting(true);
    return new Promise((resolve) => {
      this.resolve = resolve;
      const step = (now) => {
        const t = Math.min(1, (now - start) / ms);
        this.#render(Math.round(from + delta * easeOutCubic(t)));
        if (t < 1) this.frame = requestAnimationFrame(step);
        else this.#finish();
      };
      this.frame = requestAnimationFrame(step);
    });
  }

  /** Zgłasza początek/koniec odliczania tylko przy zmianie stanu (pętla dźwięku startuje raz, nie przy każdym set()). */
  #setCounting(on) {
    if (on === this.counting) return;
    this.counting = on;
    (on ? this.onCountStart : this.onCountEnd)?.();
  }

  /** Puls pigułki (błysk złota) — restart animacji CSS przez ponowne dodanie klasy. */
  pulse() {
    this.pill.classList.remove('is-pulse');
    void this.pill.offsetWidth; // wymusza przeliczenie stylu, żeby animacja zaczęła się od nowa
    this.pill.classList.add('is-pulse');
  }

  /** Wyskakujące „+10 000” pod pigułką. */
  showDelta(delta) {
    if (!delta) return;
    const el = document.createElement('span');
    el.className = 'balance-delta num' + (delta < 0 ? ' is-negative' : '');
    el.textContent = formatSigned(delta);
    el.setAttribute('aria-hidden', 'true');
    this.pill.append(el);
    el.addEventListener('animationend', () => el.remove(), { once: true });
    setTimeout(() => el.remove(), 2000);
  }

  #render(n) {
    this.shown = n;
    this.valueEl.textContent = formatAmount(n);
  }

  #label() {
    if (this.unitEl) this.unitEl.textContent = pluralCebulion(this.target);
  }

  #finish() {
    this.frame = 0;
    this.#render(this.target);
    this.#setCounting(false);
    const resolve = this.resolve;
    this.resolve = null;
    resolve?.();
  }

  #stop() {
    if (this.frame) cancelAnimationFrame(this.frame);
    this.frame = 0;
    if (this.resolve) {
      const resolve = this.resolve;
      this.resolve = null;
      resolve();
    }
  }
}
