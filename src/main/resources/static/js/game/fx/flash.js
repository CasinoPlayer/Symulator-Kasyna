/**
 * game/fx/flash.js — błysk ekranu i StraznikBlyskow (flash governor) — 04 § 1.4, § 2.4.
 *
 * Bezpieczeństwo (WCAG 2.1, kryterium 2.3.1): najwyżej 3 błyski w dowolnym oknie 1 s (brief § 4). Błyski mogą
 * wywołać napad u osób z padaczką fotogenną, więc limit pilnuje KOD, a nie dobra wola animatora:
 *   * każdy efekt, który może być błyskiem, pyta strażnika (`request`) przed startem,
 *   * amplitudę liczymy jak WCAG — jako zmianę jasności względnej ΔL = lin(c + a) − lin(c), gdzie c to jasność
 *     PODŁOŻA (ciemne tło gry ≈ 0,07–0,08, złoty symbol ≈ 0,5): ta sama alfa na ciemnym i jasnym tle to inny błysk,
 *   * pole ≤ 1/36 ekranu albo ΔL < 0,10 → to nie błysk (nie zużywa limitu),
 *   * błysk < 120 ms po poprzednim jest WCHŁANIANY (jedna para zmian jasności) — niczego nie przesuwamy w czasie,
 *     więc dźwięki zaplanowane na zegarze audio dalej trafiają w szczyty,
 *   * REZERWACJA: reżyser zna całą rundę z góry, więc rezerwuje miejsca na błyski-bohaterów (uderzenie BIG WIN,
 *     eskalacje, slam, NEON JACKPOT). Błysk lokalny (WILD, flara, piorun), który zabrałby zarezerwowane miejsce,
 *     od razu dostaje wariant łagodny — inaczej trzy błyski WILD „zjadłyby” limit przed uderzeniem BIG WIN,
 *   * wariant łagodny: alfa obcięta do a_max, przy której ΔL < 0,08 na danym podłożu; pełnoekranowy bez miejsca —
 *     pomijany,
 *   * ograniczony ruch: błysków nie ma wcale; TURBO nie skraca błysków (zagęściłoby je ponad limit).
 * Log decyzji (`log`) czyta test e2e (tools/e2e/gra-s1.mjs).
 */

import { easeOutExpo } from '../core/easing.js';

/** sRGB (0…1) → składowa liniowa (WCAG). */
const lin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
/** Odwrotność: składowa liniowa → sRGB. */
const unlin = (l) => (l <= 0.0031308 ? l * 12.92 : 1.055 * l ** (1 / 2.4) - 0.055);

/** Zmiana jasności względnej po dodaniu białego sprite'a `add` z alfą `a` nad podłożem o jasności sRGB `c`. */
export function deltaL(a, c) {
  return lin(Math.min(1, c + a)) - lin(c);
}

/** Największa alfa, przy której ΔL < 0,08 na podłożu `c` (wariant łagodny). */
export function softAlpha(c) {
  return Math.max(0, unlin(Math.min(1, lin(c) + 0.08)) - c - 0.005);
}

/** Domyślne podłoża (04 § 1.4): ciemne tło gry i jasny symbol / złoto. */
export const BACKGROUND = Object.freeze({ dark: 0.07, symbol: 0.55 });

export class FlashGovernor {
  #registered = [];   // czasy (ms zegara gry) zarejestrowanych błysków
  #reserved = [];     // { t, kind } — miejsca dla błysków-bohaterów
  log = [];
  /** Jasność tła bieżącej gry (stała z konfiguracji gry, np. S1 ≈ 0,08). */
  background = BACKGROUND.dark;

  constructor(tweener, motion) {
    this.tweener = tweener;
    this.motion = motion;
  }

  /** Rezerwuje miejsce na błysk-bohatera za `inMs` ms (np. uderzenie BIG WIN po zatrzymaniu bębnów). */
  reserve(inMs, kind = 'bohater') {
    this.#reserved.push({ t: this.tweener.now + Math.max(0, inMs), kind });
  }

  clearReservations() {
    this.#reserved = [];
  }

  /**
   * @param {string} kind nazwa efektu (do logu)
   * @param {{area?: number, alpha?: number, background?: number, hero?: boolean}} o
   *   area — ułamek powierzchni okna (0…1); alpha — szczytowa alfa białego sprite'a `add`; hero — błysk-bohater
   * @returns {{ok: boolean, alpha: number, decision: string}}
   */
  request(kind, { area = 1, alpha = 1, background = this.background, hero = false } = {}) {
    const now = this.tweener.now;
    this.#registered = this.#registered.filter((t) => now - t < 1000);
    this.#reserved = this.#reserved.filter((r) => r.t > now - 400);
    let decision;
    let out = alpha;
    const dL = deltaL(alpha, background);
    if (this.motion.reduced) {
      decision = 'skip';
      out = 0;
    } else if (area <= 1 / 36 || dL < 0.1) decision = 'free';
    else {
      const last = this.#registered.at(-1);
      if (hero) {
        // bohater zużywa swoją rezerwację (najbliższą w czasie)
        const i = this.#reserved.findIndex((r) => Math.abs(r.t - now) < 700);
        if (i >= 0) this.#reserved.splice(i, 1);
      }
      if (last !== undefined && now - last < 120) decision = 'absorbed';
      else {
        const ahead = hero ? 0 : this.#reserved.filter((r) => r.t >= now && r.t - now < 1000).length;
        if (this.#registered.length + ahead < 3) {
          this.#registered.push(now);
          decision = 'full';
        } else if (area >= 0.5) {
          decision = 'skip';
          out = 0;
        } else {
          decision = 'soft';
          out = Math.min(alpha, softAlpha(background));
        }
      }
    }
    if (this.log.length < 800) this.log.push({ t: Math.round(now), kind, area: Number(area.toFixed(3)), dL: Number(dL.toFixed(3)), hero, decision });
    return { ok: decision !== 'skip', alpha: out, decision };
  }

  /** Największa liczba zarejestrowanych błysków w dowolnym oknie 1 s (dla testu). */
  maxPerSecond() {
    const t = this.log.filter((e) => e.decision === 'full').map((e) => e.t);
    let max = 0;
    for (let i = 0; i < t.length; i++) {
      let n = 0;
      for (let j = i; j < t.length && t[j] - t[i] < 1000; j++) n++;
      max = Math.max(max, n);
    }
    return max;
  }

  /** Ile błysków-bohaterów strażnik pominął (test: musi być 0). */
  heroSkips() {
    return this.log.filter((e) => e.hero && e.decision === 'skip' && !this.motion.reduced).length;
  }
}

/** Rodzaje błysków z 04 § 2.4 (tint ≤ 20% nasycenia — nigdy nasycona czerwień na pełnym ekranie). */
export const FLASH = Object.freeze({
  big: { tint: 0xfff3d1, alpha: 0.4, attack: 40, hold: 0, decay: 360, radial: true, hero: true },
  mega: { tint: 0xffe9f4, alpha: 0.45, attack: 40, hold: 20, decay: 380, radial: true, hero: true },
  epic: { tint: 0xeee4ff, alpha: 0.5, attack: 40, hold: 20, decay: 400, radial: true, hero: true },
  ultra: { tint: 0xffffff, alpha: 0.55, attack: 40, hold: 30, decay: 420, radial: true, hero: true },
  koniec: { tint: 0xfff3d1, alpha: 0.35, attack: 30, hold: 0, decay: 300, radial: true, hero: true },
  fs: { tint: 0xe6fbff, alpha: 0.45, attack: 60, hold: 0, decay: 500, radial: false, hero: true },
  jackpot: { tint: 0xffe9f4, alpha: 0.45, attack: 60, hold: 0, decay: 500, radial: false, hero: true },
});

/** Pełnoekranowy błysk na warstwie L13 (sprite w trybie add; alfa 0 → visible=false, więc w spoczynku nic nie kosztuje). */
export class ScreenFlash {
  constructor(gameApp, governor, radialTexture) {
    const { PIXI } = gameApp;
    this.gameApp = gameApp;
    this.governor = governor;
    this.full = new PIXI.Sprite(PIXI.Texture.WHITE);
    this.radial = new PIXI.Sprite(radialTexture);
    for (const s of [this.full, this.radial]) {
      s.blendMode = 'add';
      s.visible = false;
      s.alpha = 0;
      gameApp.layers.flash.addChild(s);
    }
    this.radial.anchor.set(0.5);
    this.tween = null;
  }

  /**
   * Odpala błysk (przez strażnika). Zwraca true, gdy błysk się odbył.
   * @param {keyof FLASH | object} kind
   */
  fire(kind, { name } = {}) {
    const spec = typeof kind === 'string' ? FLASH[kind] : kind;
    if (!spec) return false;
    const res = this.governor.request(name ?? String(kind), { area: 1, alpha: spec.alpha, hero: spec.hero !== false });
    if (!res.ok) return false;
    const { w, h } = this.gameApp.layout;
    const s = spec.radial ? this.radial : this.full;
    const other = spec.radial ? this.full : this.radial;
    other.visible = false;
    if (spec.radial) {
      s.position.set(w / 2, h / 2);
      s.width = Math.max(w, h) * 1.9;
      s.height = Math.max(w, h) * 1.9;
    } else {
      s.position.set(0, 0);
      s.width = w;
      s.height = h;
    }
    s.tint = spec.tint;
    const peak = res.alpha;
    const attack = res.decision === 'soft' ? Math.max(150, spec.attack) : spec.attack;
    const total = attack + spec.hold + spec.decay;
    const tw = this.gameApp.tweener;
    if (this.tween) tw.kill(this.tween);
    s.visible = true;
    this.tween = tw.tween(total, (_e, u) => {
      const t = u * total;
      if (t < attack) s.alpha = peak * (t / attack);
      else if (t < attack + spec.hold) s.alpha = peak;
      else s.alpha = peak * (1 - easeOutExpo((t - attack - spec.hold) / spec.decay));
    }, {
      onComplete: () => {
        s.alpha = 0;
        s.visible = false;
        this.tween = null;
      },
    });
    return true;
  }
}
