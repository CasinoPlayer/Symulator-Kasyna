/**
 * game/fx/camera.js — drżenie kamery w modelu „trauma” (04 § 2.5; S. Eiserloh, GDC 2016).
 *
 *   trauma T ∈ [0, 1], zdarzenia DODAJĄ traumę; wygaszanie T −= 1,2·dt (0,45 znika w ~0,38 s)
 *   siła w = T² — drobne zdarzenia prawie nie trzęsą, duże wyraźnie (proporcjonalność, reguła R2)
 *   przesunięcie x = Xmax·w·n(t·22 Hz), obrót = Rmax·w·n(…) — n to GŁADKI szum 1D, nie losowanie co klatkę
 *   (losowanie co klatkę dawałoby drgania 60 Hz wyglądające jak błąd i zależne od odświeżania ekranu)
 *
 * Drży kontener `world` (L0–L11); Big Win (L12) dostaje 35% przesunięcia, a licznik wygranej 0% (R1).
 * Low i ograniczony ruch: brak drżenia.
 */

/** Gładki szum wartości 1D w zakresie −1…1 (interpolacja smoothstep między pseudolosowymi węzłami). */
function noise1d(seed, t) {
  const i = Math.floor(t);
  const f = t - i;
  const h = (n) => {
    let x = Math.imul((n + seed * 1013) ^ 0x5bd1e995, 0x27d4eb2d);
    x ^= x >>> 15;
    return ((x >>> 0) / 4294967296) * 2 - 1;
  };
  const s = f * f * (3 - 2 * f);
  return h(i) * (1 - s) + h(i + 1) * s;
}

export class Camera {
  trauma = 0;
  floor = 0;
  /** Zoom kontenera `world` (antycypacja) i punkt, który przy zoomie zostaje w miejscu. */
  zoom = 1;
  focus = null;
  #t = 0;
  #kick = null;

  constructor(gameApp) {
    this.gameApp = gameApp;
  }

  get enabled() {
    return this.gameApp.quality.params.shake && !this.gameApp.motion.reduced;
  }

  /** Dodaje traumę (sufit 1,0). */
  add(amount) {
    if (!this.enabled) return;
    this.trauma = Math.min(1, this.trauma + amount);
  }

  /** Stała podłoga traumy (antycypacja: 0,08 → 0,18). */
  setFloor(v) {
    this.floor = this.enabled ? v : 0;
  }

  /**
   * Kierunkowe kopnięcie w dół: y = A·e^(−t/τ)·cos(2π·9 Hz·t), τ = 70 ms (04 § 2.5) — E26/E33: A = 3 px · k
   * przy stopie ostatniego bębna z WILD (trauma 0,10 dałaby niewidoczne 0,18 px).
   */
  kick(amplitudePx = 3) {
    if (!this.enabled) return;
    this.#kick = { a: amplitudePx * this.gameApp.layout.k, t: 0 };
  }

  update(dt) {
    const dts = dt / 1000;
    this.#t += dts;
    this.trauma = Math.max(this.floor, this.trauma - 1.2 * dts);
    const { world, bigwin } = this.gameApp.layers;
    const { w, h, k, short } = this.gameApp.layout;
    let ox = 0;
    let oy = 0;
    let rot = 0;
    // Xmax = 18 px · k, nie więcej niż 1,6% krótszego boku; drżeń poniżej ~0,4 px nie pokazujemy wcale
    // (ułamek piksela to tylko rozmycie obrazu — do drobnych lądowań służy kopnięcie, 04 § 2.5)
    const max = Math.min(18 * k, short * 0.016);
    const s = this.trauma * this.trauma;
    if (this.enabled && max * s >= 0.4) {
      const f = this.#t * 22;
      ox = max * s * noise1d(1, f);
      oy = max * s * noise1d(2, f);
      rot = (1.2 * Math.PI / 180) * s * noise1d(3, f);
    }
    if (this.#kick) {
      const kk = this.#kick;
      kk.t += dts;
      oy += kk.a * Math.exp(-kk.t / 0.07) * Math.cos(2 * Math.PI * 9 * kk.t);
      if (kk.t > 0.4) this.#kick = null;
    }
    // zoom w stronę punktu (E27: 1,00 → 1,03 w stronę aktywnego bębna): punkt `focus` zostaje w miejscu na ekranie
    const z = this.zoom;
    world.scale.set(z);
    const fx = this.focus ? (this.focus.x - w / 2) * (1 - z) : 0;
    const fy = this.focus ? (this.focus.y - h / 2) * (1 - z) : 0;
    world.position.set(w / 2 + fx + ox, h / 2 + fy + oy);
    world.rotation = rot;
    bigwin.position.set(ox * 0.35, oy * 0.35);
  }

  /** Twardy powrót do spoczynku (przerwana runda, błąd sieci) — bez wygaszania. */
  reset() {
    this.trauma = 0;
    this.floor = 0;
    this.zoom = 1;
    this.focus = null;
    this.#kick = null;
  }
}

