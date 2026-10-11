/**
 * game/core/random.js — deterministyczny generator liczb losowych efektów (04 § 1.2, reguła R10).
 *
 * Po co: kierunki iskier, rozrzut monet i kolejność migotań pochodzą z generatora z ziarnem wyliczonym
 * z `roundId`. Ta sama runda wygląda zawsze tak samo — powtarzalne nagrania do lobby i porównywanie zrzutów.
 * UWAGA: to losowość WYŁĄCZNIE dla wyglądu. Wynik gry losuje serwer (front niczego nie losuje — kontrakt 09 § 2.4).
 */

/** FNV-1a (32 bity) — szybki skrót tekstu do ziarna. */
export function fnv1a(text) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Generator mulberry32: 32-bitowy stan, okres 2³², jakość wystarczająca do efektów. */
export class Rng {
  constructor(seed = Date.now()) {
    this.state = seed >>> 0;
  }

  /** Nowe ziarno z tekstu (np. `${roundId}:${numerZdarzenia}`). */
  reseed(text) {
    this.state = fnv1a(String(text));
    return this;
  }

  /** Liczba z [0, 1). */
  next() {
    let t = (this.state = (this.state + 0x6d2b79f5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  range(a, b) {
    return a + (b - a) * this.next();
  }

  int(a, b) {
    return Math.floor(this.range(a, b + 1));
  }

  pick(list) {
    return list[Math.floor(this.next() * list.length)];
  }

  sign() {
    return this.next() < 0.5 ? -1 : 1;
  }
}

/** Wspólny generator efektów (ziarno ustawia odtwarzacz kroków na początku każdej rundy). */
export const fxRng = new Rng(0xceb0777);

/**
 * Skrót całkowity z indeksu (stabilny „losowy” symbol taśmy bębna dla danej pozycji — taśma nie migocze,
 * bo ta sama pozycja zawsze daje ten sam symbol).
 */
export function hashInt(a, b = 0) {
  let h = Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b + 0x27d4eb2f, 0xc2b2ae35);
  h ^= h >>> 15;
  h = Math.imul(h, 0x2c1b3c6d);
  h ^= h >>> 12;
  return (h >>> 0) / 4294967296;
}
