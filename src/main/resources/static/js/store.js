/**
 * store.js — stan gracza po stronie przeglądarki + zdarzenia o jego zmianach.
 *
 * Po co: kilka elementów strony pokazuje te same dane (pigułka salda, menu, panel bankructwa, ranking).
 * Zamiast aktualizować je ręcznie w każdym miejscu, zmieniamy stan tutaj, a elementy same reagują na zdarzenia:
 *   store.on('player', ({ player, prev, reason }) => …)   — zalogowanie, wylogowanie, nowe dane gracza
 *   store.on('balance', ({ from, to, delta, reason }) => …) — każda zmiana salda (E08)
 * Źródłem prawdy jest zawsze serwer — tu trzymamy tylko kopię ostatniej odpowiedzi.
 */

class Store extends EventTarget {
  #player = null;

  /** Bieżący gracz (obiekt `player` z API) albo null, gdy nikt nie jest zalogowany. */
  get player() {
    return this.#player;
  }

  get loggedIn() {
    return this.#player !== null;
  }

  /**
   * Ustawia gracza i powiadamia słuchaczy.
   * @param {object|null} player obiekt z API (09 § 2.1)
   * @param {{reason?: string}} options powód zmiany, np. 'restore', 'login', 'rescue', 'logout'
   */
  setPlayer(player, { reason = 'sync' } = {}) {
    const prev = this.#player;
    this.#player = player ? { ...player } : null;
    this.#emit('player', { player: this.#player, prev, reason });
    const from = prev?.balance ?? null;
    const to = this.#player?.balance ?? null;
    if (from !== to) this.#emit('balance', { from, to, delta: (to ?? 0) - (from ?? 0), reason });
  }

  /** Zmienia samo saldo (np. po spinie), zachowując resztę danych gracza. */
  updateBalance(balance, reason = 'sync') {
    if (!this.#player) return;
    this.setPlayer({ ...this.#player, balance }, { reason });
  }

  /** Subskrypcja zdarzenia; zwraca funkcję do wypisania się. */
  on(type, listener) {
    const handler = (event) => listener(event.detail);
    this.addEventListener(type, handler);
    return () => this.removeEventListener(type, handler);
  }

  #emit(type, detail) {
    this.dispatchEvent(new CustomEvent(type, { detail }));
  }
}

/** Gracz jest „bankrutem”, gdy saldo spadło poniżej najmniejszego zakładu (brief §0, kontrakt `minBet`). */
export function isBankrupt(player) {
  return Boolean(player) && player.balance < player.minBet;
}

export const store = new Store();
