/**
 * game/fx/effects.js — efekty jednorazowe i ciągłe: promienie (04 § 2.8), flara i pierścień (§ 2.9), pioruny
 * (§ 2.10), przelot połysku (§ 2.7), poświata/bloom (§ 2.6), słup światła (E27).
 *
 * Wszystkie sprite'y jednorazowe pochodzą z puli (core/pool.js) — w trakcie Big Win nie ma alokacji.
 * Filtry (połysk shaderem, bloom) działają tylko tam, gdzie pozwala poziom jakości; na Low zastępuje je
 * puls białej sylwetki (`syl`) i poświata „upieczona” w teksturze.
 */

import { Pool } from '../core/pool.js';
import { easeOutCubic, easeInQuad, easeOutQuad, easeInCubic, easeOutBack, easeInOutSine } from '../core/easing.js';
import { fxRng } from '../core/random.js';

// --------------------------------------------------------------------------------------------- shadery

const FILTER_VERTEX = `in vec2 aPosition;
out vec2 vTextureCoord;
uniform highp vec4 uInputSize;
uniform highp vec4 uOutputFrame;
uniform vec4 uOutputTexture;
vec4 filterVertexPosition(void) {
  vec2 position = aPosition * uOutputFrame.zw + uOutputFrame.xy;
  position.x = position.x * (2.0 / uOutputTexture.x) - 1.0;
  position.y = position.y * (2.0 * uOutputTexture.z / uOutputTexture.y) - uOutputTexture.z;
  return vec4(position, 0.0, 1.0);
}
vec2 filterTextureCoord(void) {
  return aPosition * (uOutputFrame.zw * uInputSize.zw);
}
void main(void) {
  gl_Position = filterVertexPosition();
  vTextureCoord = filterTextureCoord();
}`;

/** Przelot połysku (04 § 2.7): jasny ukośny pas, maską jest alfa obiektu (świeci tylko na symbolu). */
const SHINE_FRAGMENT = `in vec2 vTextureCoord;
out vec4 finalColor;
uniform sampler2D uTexture;
uniform highp vec4 uInputSize;
uniform highp vec4 uOutputFrame;
uniform float uPos;
uniform float uWidth;
uniform float uStrength;
uniform vec3 uColor;
void main(void) {
  vec4 c = texture(uTexture, vTextureCoord);
  vec2 uv = vTextureCoord * uInputSize.xy / uOutputFrame.zw;
  float d = dot(uv - 0.5, vec2(0.4226, 0.9063)) + 0.5 - uPos;
  float band = 1.0 - smoothstep(0.0, uWidth, abs(d));
  finalColor = c + vec4(uColor * (band * c.a * uStrength), 0.0);
}`;

/**
 * Tani bloom w jednym przebiegu (plan B z 04 § 2.6, bo pixi-filters nie jest wendorowany): do obrazu warstwy `add`
 * dodajemy jego rozmytą kopię liczoną 24 próbkami na dwóch okręgach. Tylko poziom High i tylko, gdy warstwa
 * ma coś widocznego.
 */
const BLOOM_FRAGMENT = `in vec2 vTextureCoord;
out vec4 finalColor;
uniform sampler2D uTexture;
uniform highp vec4 uInputSize;
uniform float uRadius;
uniform float uStrength;
void main(void) {
  vec4 c = texture(uTexture, vTextureCoord);
  vec2 px = uInputSize.zw * uRadius;
  vec4 sum = vec4(0.0);
  for (int i = 0; i < 12; i++) {
    float a = float(i) * 0.5236 + 0.26;
    vec2 o = vec2(cos(a), sin(a));
    sum += texture(uTexture, vTextureCoord + o * px * 0.45) * 0.65;
    sum += texture(uTexture, vTextureCoord + o * px) * 0.35;
  }
  finalColor = c + (sum / 12.0) * uStrength;
}`;

export function createShineFilter(PIXI) {
  const { Filter, GlProgram, UniformGroup } = PIXI;
  const uniforms = new UniformGroup({
    uPos: { value: -0.3, type: 'f32' },
    uWidth: { value: 0.18, type: 'f32' },
    uStrength: { value: 0.85, type: 'f32' },
    uColor: { value: new Float32Array([1, 0.965, 0.84]), type: 'vec3<f32>' },
  });
  return new Filter({
    glProgram: GlProgram.from({ vertex: FILTER_VERTEX, fragment: SHINE_FRAGMENT, name: 'cebulion-polysk' }),
    resources: { shineUniforms: uniforms },
    resolution: 'inherit',
    padding: 0,
  });
}

export function createBloomFilter(PIXI, radius = 10) {
  const { Filter, GlProgram, UniformGroup } = PIXI;
  const uniforms = new UniformGroup({
    uRadius: { value: radius, type: 'f32' },
    uStrength: { value: 0.9, type: 'f32' },
  });
  const filter = new Filter({
    glProgram: GlProgram.from({ vertex: FILTER_VERTEX, fragment: BLOOM_FRAGMENT, name: 'cebulion-bloom' }),
    resources: { bloomUniforms: uniforms },
    resolution: 'inherit',
    padding: Math.ceil(radius * 1.2),
  });
  // Wynik filtra nakładamy ADDYTYWNIE — tak jak samą warstwę `add`. Domyślne mieszanie filtra ('normal') zamienia
  // „ciemne tło” tekstur add (np. dym na czarnym) w półprzezroczysty CIEMNY prostokąt, bo przy renderze warstwy do
  // tekstury pośredniej alfa też się sumuje (błąd widoczny jako szary pas mgły na High).
  filter.blendMode = 'add';
  return filter;
}

// --------------------------------------------------------------------------------------------- promienie

/**
 * Promienie `g_fx_promienie` (04 § 2.8): dwie warstwy obracające się przeciwbieżnie (A +ω, B −0,6ω), oddech alfy
 * z okresem 2 s, wejście skalą `easeOutBack(1,4)`. Prędkość ≤ 8°/s — daleko od zakresu 3–30 Hz (bezpieczne, § 1.4).
 */
export class Rays {
  constructor(gameApp, parent, texture) {
    const { PIXI } = gameApp;
    this.gameApp = gameApp;
    this.root = new PIXI.Container({ label: 'promienie' });
    this.a = new PIXI.Sprite(texture);
    this.b = new PIXI.Sprite(texture);
    for (const s of [this.b, this.a]) {
      s.anchor.set(0.5);
      s.blendMode = 'add';
      this.root.addChild(s);
    }
    this.root.visible = false;
    parent.addChild(this.root);
    this.omega = 4;
    this.alpha = 0.85;
    this.size = 1000;
    this.speedMul = 1;
    this.rainbow = false;
    this.t = 0;
    this.tintA = 0xfff3d1;
    this.tintB = 0xfff3d1;
    this.scaleMul = 0;
    this.fade = 0;
    /** Przygaszenie „ciemnego taktu” przed uderzeniem (E31: 0,6). */
    this.dim = 1;
  }

  /** Pokazuje promienie (wejście 500 ms). */
  show({ x, y, size, omega = 4, alpha = 0.85, tintA = 0xfff3d1, tintB = tintA, rainbow = false }) {
    const q = this.gameApp.quality.params;
    this.root.position.set(x, y);
    this.size = size;
    this.omega = omega;
    this.alpha = alpha;
    this.tintA = tintA;
    this.tintB = tintB;
    this.rainbow = rainbow;
    this.b.visible = q.raysLayers > 1;
    this.bAlpha = q.raysBAlpha || 0.5;
    this.root.visible = true;
    const tw = this.gameApp.tweener;
    tw.killTweensOf(this);
    tw.tween(500, (e) => { this.scaleMul = e; }, { ease: easeOutBack(1.4), target: this });
    tw.tween(200, (e) => { this.fade = e; }, { target: this });
  }

  /** Zmiana poziomu (E31): przenikanie tintu w 300 ms i nowa prędkość. */
  level({ omega, tintA, tintB, rainbow = false }) {
    const fromA = this.tintA;
    const fromB = this.tintB;
    this.omega = omega;
    this.rainbow = rainbow;
    this.gameApp.tweener.tween(300, (e) => {
      this.tintA = mixColor(fromA, tintA, e);
      this.tintB = mixColor(fromB, tintB, e);
    }, { target: this });
  }

  hide(ms = 400) {
    if (!this.root.visible) return;
    const tw = this.gameApp.tweener;
    tw.killTweensOf(this);
    const s0 = this.scaleMul;
    const f0 = this.fade;
    tw.tween(ms, (e) => {
      this.scaleMul = s0 * (1 - 0.4 * e);
      this.fade = f0 * (1 - e);
    }, { ease: easeInCubic, target: this, onComplete: () => { this.root.visible = false; } });
  }

  update(dt) {
    if (!this.root.visible) return;
    const reduced = this.gameApp.motion.reduced;
    this.t += dt;
    const sec = dt / 1000;
    const rad = (this.omega * this.speedMul * Math.PI) / 180;
    if (!reduced) {
      this.a.rotation += rad * sec;
      this.b.rotation -= rad * 0.6 * sec;
    }
    // oddech alfy: okres 2 s (RM: 4 s, 0,6 ↔ 0,8)
    const breath = reduced ? 0.7 + 0.1 * Math.sin((2 * Math.PI * this.t) / 4000) : 0.85 + 0.15 * Math.sin((2 * Math.PI * this.t) / 2000);
    const s = (this.size / this.a.texture.width) * this.scaleMul;
    this.a.scale.set(s);
    this.b.scale.set(s * 1.15);
    this.a.alpha = this.alpha * breath * this.fade * this.dim;
    this.b.alpha = this.alpha * this.bAlpha * breath * this.fade * this.dim;
    if (this.rainbow) {
      // ULTRA: cykl barw cyjan → fiolet → magenta → złoto w 4 s
      const cyc = [0x21e6ff, 0x8f3dff, 0xff2e88, 0xffe08a];
      const p = ((this.t / 4000) % 1) * cyc.length;
      const i = Math.floor(p);
      this.a.tint = mixColor(cyc[i], cyc[(i + 1) % cyc.length], p - i);
      this.b.tint = 0xffffff;
    } else {
      this.a.tint = this.tintA;
      this.b.tint = this.tintB;
    }
  }
}

/** Liniowe mieszanie dwóch kolorów 0xRRGGBB. */
export function mixColor(a, b, t) {
  const ar = (a >> 16) & 255;
  const ag = (a >> 8) & 255;
  const ab = a & 255;
  const r = ar + (((b >> 16) & 255) - ar) * t;
  const g = ag + (((b >> 8) & 255) - ag) * t;
  const bl = ab + ((b & 255) - ab) * t;
  return ((r & 255) << 16) | ((g & 255) << 8) | (bl & 255);
}

// --------------------------------------------------------------------------------------------- efekty jednorazowe

export class OneShots {
  constructor(gameApp, { flare, ring, lightning, column, governor }) {
    const { PIXI } = gameApp;
    this.gameApp = gameApp;
    this.governor = governor;
    this.textures = { flare, ring, lightning, column };
    const mk = (tex) => () => {
      const s = new PIXI.Sprite(tex);
      s.anchor.set(0.5);
      s.blendMode = 'add';
      return s;
    };
    const reset = (s) => {
      s.removeFromParent();
      s.alpha = 1;
      s.rotation = 0;
      s.scale.set(1);
      s.tint = 0xffffff;
      s.visible = true;
    };
    this.flares = new Pool(mk(flare), reset, 6);
    this.rings = new Pool(mk(ring), reset, 4);
    this.bolts = new Pool(() => {
      const s = new PIXI.Sprite(lightning[0]);
      s.anchor.set(0.5, 0);
      s.blendMode = 'add';
      return s;
    }, reset, 6);
  }

  /** Ułamek powierzchni okna zajmowany przez kwadrat o boku `px` (dla strażnika błysków). */
  #area(px) {
    const { w, h } = this.gameApp.layout;
    return (px * px) / (w * h);
  }

  /** Flara (04 § 2.9): skala 0 → 1,2 (80 ms) → 0,9 (120 ms), potem alfa → 0 (300 ms); rozciągnięcie anamorficzne × 1,4. */
  flare(parent, x, y, sizePx, tint = 0xffffff) {
    if (this.gameApp.motion.reduced) return;
    // jasny rdzeń flary zajmuje ~połowę rozmiaru sprite'a; podłoże — ciemne tło gry (04 § 1.4)
    const res = this.governor.request('flara', { area: this.#area(sizePx * 0.5), alpha: 0.9 });
    if (!res.ok) return;
    const s = this.flares.get();
    parent.addChild(s);
    s.position.set(x, y);
    s.tint = tint;
    const base = sizePx / s.texture.width;
    const peak = res.alpha;
    s.rotation = fxRng.range(-0.2, 0.2);
    this.gameApp.tweener.tween(500, (_e, u) => {
      const t = u * 500;
      const sc = t < 80 ? 1.2 * easeOutCubic(t / 80) : t < 200 ? 1.2 - 0.3 * easeOutQuad((t - 80) / 120) : 0.9;
      s.scale.set(base * sc * 1.4, base * sc);
      s.alpha = peak * (t < 200 ? 1 : 1 - (t - 200) / 300);
      s.rotation += 0.004;
    }, { onComplete: () => this.flares.release(s) });
  }

  /** Pierścień fali (04 § 2.9): skala 0,2 → 3,0 × rozmiar w 450 ms, alfa 0,9 → 0. */
  ring(parent, x, y, basePx, tint = 0xffffff) {
    if (this.gameApp.motion.reduced) return;
    const s = this.rings.get();
    parent.addChild(s);
    s.position.set(x, y);
    s.tint = tint;
    const base = basePx / s.texture.width;
    this.gameApp.tweener.tween(450, (e, u) => {
      s.scale.set(base * (0.2 + 2.8 * e));
      s.alpha = 0.9 * (1 - easeInQuad(u));
    }, { ease: easeOutCubic, onComplete: () => this.rings.release(s) });
  }

  /**
   * Piorun A → B (04 § 2.10): atak 30 ms, przytrzymanie 40 ms, wygaszanie 130 ms = jeden błysk (bez migotania).
   * Kilka piorunów w tej samej klatce strażnik liczy jako jeden błysk (scalanie < 120 ms).
   */
  bolt(parent, ax, ay, bx, by, { tint = 0x9fd8ff, width = 1 } = {}) {
    if (this.gameApp.motion.reduced) return false;
    const len = Math.hypot(bx - ax, by - ay);
    const res = this.governor.request('piorun', { area: this.#area(Math.sqrt(len * 60 * this.gameApp.layout.k)), alpha: 0.9 });
    if (!res.ok) return false;
    const s = this.bolts.get();
    s.texture = fxRng.pick(this.textures.lightning);
    parent.addChild(s);
    s.position.set(ax, ay);
    s.rotation = Math.atan2(by - ay, bx - ax) - Math.PI / 2;
    const sy = len / s.texture.height;
    s.scale.set(fxRng.range(0.6, 1.0) * width * this.gameApp.layout.k * 1.8 * fxRng.sign(), sy);
    s.tint = tint;
    const peak = res.alpha;
    this.gameApp.tweener.tween(200, (_e, u) => {
      const t = u * 200;
      s.alpha = peak * (t < 30 ? t / 30 : t < 70 ? 1 : 1 - easeOutQuad((t - 70) / 130));
    }, { onComplete: () => this.bolts.release(s) });
    return true;
  }
}

// --------------------------------------------------------------------------------------------- połysk symboli

/**
 * Przelot połysku po obiekcie (04 § 2.7): filtr z puli na czas przelotu (450–700 ms, easeInOutSine).
 * Na Low — puls białej sylwetki (`syl`): alfa 0 → 0,25 → 0 w 300 ms.
 */
export class Shine {
  constructor(gameApp) {
    this.gameApp = gameApp;
    this.pool = [];
    this.active = 0;
    this.failed = false;
  }

  #filter() {
    if (this.failed) return null;
    try {
      return this.pool.pop() ?? createShineFilter(this.gameApp.PIXI);
    } catch (err) {
      this.failed = true;
      console.warn('Filtr połysku niedostępny:', err);
      return null;
    }
  }

  /** Filtr do rozgrzewki shadera na ekranie ładowania (wraca do puli). */
  makeFilter() {
    const f = this.#filter();
    if (f) this.pool.push(f);
    return f;
  }

  /**
   * @param {import('pixi.js').Container} target obiekt (sprite symbolu, baner)
   * @param {{duration?: number, silhouette?: import('pixi.js').Sprite, strength?: number}} o
   */
  run(target, { duration = 550, silhouette = null, strength = 0.85 } = {}) {
    if (!target || target.destroyed) return;
    const q = this.gameApp.quality.params;
    const tw = this.gameApp.tweener;
    if (q.shine !== 'shader' || this.active >= 6) {
      if (!silhouette) return;
      silhouette.visible = true;
      tw.tween(300, (_e, u) => { silhouette.alpha = 0.25 * Math.sin(Math.PI * u); }, { onComplete: () => { silhouette.alpha = 0; silhouette.visible = false; } });
      return;
    }
    const f = this.#filter();
    if (!f) return;
    this.active++;
    const u = f.resources.shineUniforms.uniforms;
    u.uStrength = strength;
    const prev = target.filters;
    target.filters = prev?.length ? [...prev, f] : [f];
    tw.tween(duration, (e) => { u.uPos = -0.35 + 1.7 * e; }, {
      ease: easeInOutSine,
      onComplete: () => {
        if (!target.destroyed) target.filters = (target.filters ?? []).filter((x) => x !== f);
        this.pool.push(f);
        this.active--;
      },
    });
  }
}

// --------------------------------------------------------------------------------------------- bloom

/**
 * Bloom na warstwach `add` (High): filtr włączany tylko, gdy warstwa ma widoczne elementy (histereza 300 ms),
 * więc w spoczynku nie kosztuje nic (04 § 2.6).
 */
export class Bloom {
  constructor(gameApp, layers) {
    this.gameApp = gameApp;
    this.layers = layers;
    this.filter = null;
    this.idle = 0;
    this.on = false;
  }

  /** Tworzy filtr (kompilację shadera wymusza osobno `warmUpShaders`). */
  warmUp() {
    try {
      this.filter = createBloomFilter(this.gameApp.PIXI, 9);
    } catch (err) {
      console.warn('Bloom niedostępny:', err);
      this.filter = null;
    }
  }

  /** Stały obszar filtra = ekran (04 § 2.3): bez liczenia granic warstwy co klatkę i bez przycinania poświaty. */
  resize(w, h) {
    for (const l of this.layers) l.filterArea = new this.gameApp.PIXI.Rectangle(0, 0, w, h);
  }

  #busy(layer) {
    for (const c of layer.children) {
      if (!c.visible || c.alpha <= 0.01) continue;
      if (c.particleChildren) {
        if (c.particleChildren.length) return true;
      } else return true;
    }
    return false;
  }

  update(dt) {
    const want = this.filter && this.gameApp.quality.params.bloom === 'filter';
    let busy = false;
    if (want) for (const l of this.layers) busy ||= this.#busy(l);
    this.idle = busy ? 0 : this.idle + dt;
    const enable = want && (busy || this.idle < 300);
    if (enable === this.on) return;
    this.on = enable;
    for (const l of this.layers) l.filters = enable ? [this.filter] : null;
  }
}


/**
 * Rozgrzewka shaderów na ekranie ładowania (04 § 2.6, E20): mały kontener (sprite iskry z każdym filtrem)
 * renderujemy do POZAEKRANOWEJ RenderTexture 64×64. Obiekt z `visible = false` nie wystarczy — Pixi by go nie
 * narysował, więc shader skompilowałby się dopiero przy pierwszym Big Win (zacięcie 50–200 ms).
 */
export function warmUpShaders(gameApp, texture, filters) {
  const { PIXI, renderer } = gameApp;
  const usable = filters.filter(Boolean);
  if (!usable.length) return;
  const target = PIXI.RenderTexture.create({ width: 64, height: 64 });
  const box = new PIXI.Container();
  for (const f of usable) {
    const s = new PIXI.Sprite(texture);
    s.width = 32;
    s.height = 32;
    s.filters = [f];
    box.addChild(s);
  }
  try {
    renderer.render({ container: box, target, clear: true });
  } catch (err) {
    console.warn('Rozgrzewka shaderów nieudana:', err);
  }
  for (const c of box.children) c.filters = null;
  box.destroy({ children: true });
  target.destroy(true);
}
