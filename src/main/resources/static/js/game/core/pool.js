/**
 * game/core/pool.js — prosta pula obiektów (object pool).
 *
 * Po co: tworzenie i niszczenie sprite'ów w trakcie animacji (flary, pierścienie, pioruny przy każdej wygranej)
 * zmusza przeglądarkę do sprzątania pamięci (garbage collection), a sprzątanie w trakcie Big Win to zacięcie
 * klatki. Pula tworzy obiekty raz i potem je pożycza / przyjmuje z powrotem.
 */
export class Pool {
  #free = [];
  #create;
  #reset;
  created = 0;

  /**
   * @param {() => T} create fabryka nowego obiektu
   * @param {(obj: T) => void} [reset] przywrócenie stanu domyślnego przy oddaniu
   * @param {number} [prefill] ile obiektów utworzyć od razu (np. na ekranie ładowania)
   * @template T
   */
  constructor(create, reset, prefill = 0) {
    this.#create = create;
    this.#reset = reset;
    for (let i = 0; i < prefill; i++) this.#free.push(this.#make());
  }

  #make() {
    this.created++;
    return this.#create();
  }

  get() {
    return this.#free.pop() ?? this.#make();
  }

  release(obj) {
    if (!obj) return;
    this.#reset?.(obj);
    this.#free.push(obj);
  }

  get available() {
    return this.#free.length;
  }
}
