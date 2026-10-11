/**
 * game/core/easing.js — funkcje wygładzania (easing) z docs/projekt/04-efekty-wizualne.md § 2.12.
 *
 * Po co własne: to kilkadziesiąt linii wzorów Roberta Pennera (easings.net). Biblioteka (GSAP, tween.js) dałaby
 * to samo, ale student musi umieć obronić każdą linię, a nam potrzebne są dodatkowo `punch` i `hermite`
 * (krzywa liczenia big win z § 4.2), których ogólne biblioteki nie mają.
 * Każda funkcja przyjmuje t ∈ [0, 1] i zwraca postęp (przy funkcjach z odbiciem może wyjść poza 0…1).
 */

const { PI, cos, sin, sqrt, pow, exp } = Math;

export const linear = (t) => t;
export const easeInQuad = (t) => t * t;
export const easeOutQuad = (t) => 1 - (1 - t) * (1 - t);
export const easeInOutQuad = (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
export const easeInCubic = (t) => t * t * t;
export const easeOutCubic = (t) => 1 - (1 - t) ** 3;
export const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
export const easeOutQuart = (t) => 1 - (1 - t) ** 4;
export const easeOutExpo = (t) => (t >= 1 ? 1 : 1 - pow(2, -10 * t));
export const easeInOutSine = (t) => -(cos(PI * t) - 1) / 2;

/**
 * Wejście z odbiciem. Maksymalne przekroczenie = 4s³ / (27(s + 1)²): s = 1,70158 → 10%, s = 1,2 → 5,3%
 * (wzór z 04 § 2.12 — dobieramy s do zamierzonego odbicia zamiast „na oko”).
 */
export const easeOutBack = (s = 1.70158) => (t) => 1 + (s + 1) * (t - 1) ** 3 + s * (t - 1) ** 2;
export const easeInBack = (s = 1.70158) => (t) => (s + 1) * t * t * t - s * t * t;

export const easeOutElastic = (t) =>
  (t <= 0 || t >= 1 ? t : pow(2, -10 * t) * sin((10 * t - 0.75) * ((2 * PI) / 3)) + 1);

export function easeOutBounce(t) {
  const n = 7.5625;
  const d = 2.75;
  if (t < 1 / d) return n * t * t;
  if (t < 2 / d) return n * (t -= 1.5 / d) * t + 0.75;
  if (t < 2.5 / d) return n * (t -= 2.25 / d) * t + 0.9375;
  return n * (t -= 2.625 / d) * t + 0.984375;
}

/**
 * „Uderzenie” skali: 0 → 1 + a przy 45% czasu (easeOutCubic) → 1 przy 100% (easeInOutSine).
 * Zwraca MNOŻNIK skali (1 na początku i końcu), nie postęp — używane jako `scale = base * punch(a)(t)`.
 */
export const punch = (a) => (t) => {
  if (t < 0.45) return 1 + a * easeOutCubic(t / 0.45);
  return 1 + a * (1 - easeInOutSine((t - 0.45) / 0.55));
};

/**
 * Wielomian Hermite'a dla ostatniego segmentu liczenia big win (04 § 4.2):
 * f(0) = 0, f(1) = 1, f'(0) = s0 (ciągłość prędkości z poprzednim segmentem), f'(1) = 0 (miękkie zatrzymanie).
 * Dla s0 = 3 to dokładnie easeOutCubic; s0 ≤ 3 gwarantuje, że licznik nigdy się nie cofa.
 */
export const hermite = (s0) => {
  const s = Math.min(3, Math.max(0, s0));
  return (u) => s * (u * u * u - 2 * u * u + u) + (3 * u * u - 2 * u * u * u);
};

/**
 * Tłumiona sprężyna: 1 − e^(−ζωt)·(cos(ω_d t) + (ζω/ω_d)·sin(ω_d t)). `tSec` w sekundach, wynik → 1.
 * Do kopnięcia kamery i odbić UI (04 § 2.12).
 */
export function spring(zeta, freqHz, tSec) {
  const w = 2 * PI * freqHz;
  const wd = w * sqrt(1 - zeta * zeta);
  return 1 - exp(-zeta * w * tSec) * (cos(wd * tSec) + ((zeta * w) / wd) * sin(wd * tSec));
}

export const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
export const lerp = (a, b, t) => a + (b - a) * t;

/** Mapa nazw → funkcji (oś czasu może podać easing jako tekst, np. 'easeOutCubic'). */
export const EASINGS = {
  linear, easeInQuad, easeOutQuad, easeInOutQuad, easeInCubic, easeOutCubic, easeInOutCubic, easeOutQuart,
  easeOutExpo, easeInOutSine, easeOutBack: easeOutBack(), easeInBack: easeInBack(), easeOutElastic, easeOutBounce,
};

/** Zwraca funkcję wygładzania z nazwy albo samą funkcję (domyślnie liniowo). */
export function resolveEasing(e) {
  if (typeof e === 'function') return e;
  return EASINGS[e] ?? linear;
}
