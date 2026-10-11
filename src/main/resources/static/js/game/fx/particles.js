/**
 * game/fx/particles.js — silnik cząsteczek (04 § 2.3): monety, iskry, konfetti, dym, neonowe iskry.
 *
 * Budowa „struktura tablic” (SoA): stan wszystkich cząsteczek warstwy trzymamy w tablicach typowanych
 * (`Float32Array` x, y, vx, vy, wiek, życie…), a nie w obiekcie na cząsteczkę. Martwa cząsteczka znika przez
 * zamianę z ostatnią żywą (O(1)), więc w trakcie gry nie ma alokacji ani sprzątania pamięci.
 * Rysowanie: `ParticleContainer` z Pixi 8 — jedno wywołanie rysowania na warstwę. Warunek: wszystkie cząsteczki
 * warstwy z jednego atlasu (stąd atlasy z canvas-art.js).
 *
 * Krok symulacji (dt w sekundach, niezależny od 60/120 Hz dzięki exp):
 *   v += (a + g)·dt;   v *= exp(−opór·dt);   p += v·dt;   obrót += vobr·dt;   u = wiek/życie
 *
 * Limit (brief § 5): High 600, Medium 300, Low 120 łącznie. Priorytety: P1 główne (monety, iskry wygranej),
 * P2 wzbogacające (konfetti, dym), P3 tło (pył). Zajętość ≥ 85% → P3 nie rodzi; ≥ 95% → P2 rodzi o połowę mniej.
 * Liczby w kartach zdarzeń to PROŚBY — silnik przycina je do limitu.
 */

import { easeInQuad, easeOutQuad, easeOutCubic, easeOutBack } from '../core/easing.js';
import { fxRng } from '../core/random.js';

export const KIND = Object.freeze({ SPARK: 0, TWINKLE: 1, COIN: 2, CONFETTI: 3, SMOKE: 4, NEON: 5, FLOAT: 6 });
const backOut = easeOutBack(1.7);
const CAPACITY = 640;
/** Pola stanu kopiowane przy zamianie z ostatnią żywą (stała tablica — bez alokacji przy każdej śmierci). */
const FIELDS = ['x', 'y', 'vx', 'vy', 'g', 'drag', 'age', 'life', 'rot', 'vrot', 's0', 's1', 'a0', 'ph', 'om', 'amp', 'floor', 'bgr', 'frame', 'kind', 'flags', 'prio'];

const toBgr = (rgb) => ((rgb & 0xff) << 16) | (rgb & 0xff00) | ((rgb >> 16) & 0xff);

/** Jedna warstwa cząsteczek = jeden ParticleContainer + tablice stanu. */
class ParticleLayer {
  constructor(system, PIXI, parent, atlas, blendMode, { uvs = true } = {}) {
    this.system = system;
    this.frames = atlas.frames;
    this.frameList = Object.values(atlas.frames);
    this.frameIndex = Object.fromEntries(Object.keys(atlas.frames).map((k, i) => [k, i]));
    this.container = new PIXI.ParticleContainer({
      texture: atlas.texture,
      // uvs dynamiczne tylko tam, gdzie ramka zmienia się w locie (obrót monety z trzech ujęć) — 04 § 2.3
      dynamicProperties: { position: true, rotation: true, vertex: true, color: true, uvs },
    });
    this.container.blendMode = blendMode;
    // ParticleContainer nie liczy granic (wydajność) — podajemy obszar ręcznie, żeby nic nie było odcinane
    this.container.boundsArea = new PIXI.Rectangle(-1e5, -1e5, 2e5, 2e5);
    parent.addChild(this.container);
    const f = () => new Float32Array(CAPACITY);
    Object.assign(this, {
      x: f(), y: f(), vx: f(), vy: f(), g: f(), drag: f(), age: f(), life: f(), rot: f(), vrot: f(),
      s0: f(), s1: f(), a0: f(), ph: f(), om: f(), amp: f(), floor: f(),
      bgr: new Uint32Array(CAPACITY), frame: new Uint16Array(CAPACITY), kind: new Uint8Array(CAPACITY),
      flags: new Uint8Array(CAPACITY), prio: new Uint8Array(CAPACITY),
    });
    this.objs = Array.from({ length: CAPACITY }, () => new PIXI.Particle({ texture: this.frameList[0], anchorX: 0.5, anchorY: 0.5 }));
    this.n = 0;
    this.dirty = false;
    // ramki obrotu monety (przód / skos / bok), jeśli warstwa ma je w atlasie
    this.coinFrames = this.frameIndex.coin0 !== undefined ? [this.frameIndex.coin0, this.frameIndex.coin1, this.frameIndex.coin2] : null;
    this.boundsW = 2000;
    this.boundsH = 2000;
  }

  /** Rodzi cząsteczkę; zwraca indeks albo −1, gdy limit/priorytet nie pozwala. */
  spawn(p) {
    if (this.n >= CAPACITY || !this.system.allow(p.prio ?? 1)) return -1;
    const i = this.n++;
    this.x[i] = p.x; this.y[i] = p.y;
    this.vx[i] = p.vx ?? 0; this.vy[i] = p.vy ?? 0;
    this.g[i] = p.g ?? 0; this.drag[i] = p.drag ?? 0;
    this.age[i] = 0; this.life[i] = p.life ?? 1;
    this.rot[i] = p.rot ?? 0; this.vrot[i] = p.vrot ?? 0;
    this.s0[i] = p.s0 ?? 1; this.s1[i] = p.s1 ?? 0; this.a0[i] = p.alpha ?? 1;
    this.ph[i] = p.ph ?? 0; this.om[i] = p.om ?? 0; this.amp[i] = p.amp ?? 0; this.floor[i] = p.floor ?? 1e9;
    this.bgr[i] = toBgr(p.tint ?? 0xffffff);
    this.frame[i] = this.frameIndex[p.frame] ?? 0;
    this.kind[i] = p.kind ?? KIND.SPARK;
    this.flags[i] = p.align ? 1 : 0;
    this.prio[i] = p.prio ?? 1;
    const obj = this.objs[i];
    obj.texture = this.frameList[this.frame[i]];
    this.container.particleChildren.push(obj);
    this.system.alive += 1;
    this.dirty = true;
    return i;
  }

  #kill(i) {
    const last = --this.n;
    if (i !== last) {
      // zamiana z ostatnią żywą (O(1)) — kopiujemy stan, obiekty Particle zostają na swoich miejscach
      for (let f = 0; f < FIELDS.length; f++) {
        const arr = this[FIELDS[f]];
        arr[i] = arr[last];
      }
      this.objs[i].texture = this.frameList[this.frame[i]];
    }
    this.container.particleChildren.pop();
    this.system.alive -= 1;
    this.dirty = true;
  }

  clear() {
    this.system.alive -= this.n;
    this.n = 0;
    this.container.particleChildren.length = 0;
    this.container.update();
  }

  update(dt) {
    const { x, y, vx, vy, g, drag, age, life, rot, vrot, s0, s1, a0, ph, om, amp, floor, bgr, kind, flags, objs } = this;
    const coinFrames = this.coinFrames;
    let i = 0;
    while (i < this.n) {
      age[i] += dt;
      const lifeI = life[i];
      if (age[i] >= lifeI) {
        this.#kill(i);
        continue;
      }
      const u = age[i] / lifeI;
      vy[i] += g[i] * dt;
      if (drag[i] > 0) {
        const d = Math.exp(-drag[i] * dt);
        vx[i] *= d;
        vy[i] *= d;
      }
      x[i] += vx[i] * dt;
      y[i] += vy[i] * dt;
      rot[i] += vrot[i] * dt;
      const o = objs[i];
      let alpha = a0[i];
      let sx;
      let sy;
      switch (kind[i]) {
        case KIND.SPARK:
        case KIND.NEON: {
          if (kind[i] === KIND.NEON && y[i] > floor[i] && vy[i] > 0 && !(flags[i] & 2)) {
            y[i] = floor[i];
            vy[i] = -vy[i] * 0.35;        // jedno odbicie od dołu ramki (04 § 2.3, neon_iskry)
            flags[i] |= 2;
          }
          const s = s0[i] + (s1[i] - s0[i]) * easeInQuad(u);
          sx = sy = s;
          alpha *= 1 - easeOutQuad(u);
          if (flags[i] & 1) {
            o.rotation = Math.atan2(vy[i], vx[i]);
            sx = s * 1.6;            // smuga wydłużona w kierunku lotu
          } else o.rotation = rot[i];
          break;
        }
        case KIND.TWINKLE: {
          const s = s0[i] * (u < 0.4 ? backOut(u / 0.4) : 1 - easeInQuad((u - 0.4) / 0.6));
          sx = sy = Math.max(0, s);
          o.rotation = rot[i];
          break;
        }
        case KIND.COIN: {
          // obrót monety z trzech ujęć + ściskanie |cos φ| (04 § 2.3)
          ph[i] += om[i] * dt;
          const c = Math.cos(ph[i]);
          const ac = Math.abs(c);
          if (coinFrames) {
            const f = ac > 0.8 ? coinFrames[0] : ac > 0.35 ? coinFrames[1] : coinFrames[2];
            if (f !== this.frame[i]) {
              this.frame[i] = f;
              o.texture = this.frameList[f];
            }
          }
          sx = s0[i] * Math.max(0.3, ac) * (c < 0 ? -1 : 1);
          sy = s0[i];
          const left = lifeI - age[i];
          if (left < 0.2) alpha *= left / 0.2;
          o.rotation = rot[i];
          break;
        }
        case KIND.CONFETTI: {
          ph[i] += om[i] * dt;
          x[i] += Math.cos(ph[i] * 0.37) * amp[i] * dt;   // trzepotanie x += A·sin(ωt) (pochodna)
          sx = s0[i];
          sy = s0[i] * Math.abs(Math.cos(ph[i]));         // udawany obrót 3D
          const left = lifeI - age[i];
          if (left < 0.3) alpha *= left / 0.3;
          o.rotation = rot[i];
          break;
        }
        case KIND.SMOKE: {
          const s = s0[i] + (s1[i] - s0[i]) * easeOutCubic(u);
          sx = sy = s;
          alpha *= u < 0.15 ? u / 0.15 : 1 - easeInQuad((u - 0.15) / 0.85);
          o.rotation = rot[i];
          break;
        }
        default: { // FLOAT — pył/bokeh tła: życie nieskończone, zawijanie przy krawędzi
          ph[i] += om[i] * dt;
          x[i] += Math.sin(ph[i]) * amp[i] * dt;
          if (y[i] < -20) y[i] += this.boundsH + 40;
          if (x[i] < -20) x[i] += this.boundsW + 40;
          else if (x[i] > this.boundsW + 20) x[i] -= this.boundsW + 40;
          alpha *= 0.6 + 0.4 * Math.sin(ph[i] * 0.7);
          sx = sy = s0[i];
          age[i] = 0;
        }
      }
      o.x = x[i];
      o.y = y[i];
      o.scaleX = sx;
      o.scaleY = sy;
      o.color = bgr[i] + (((alpha < 0 ? 0 : alpha > 1 ? 1 : alpha) * 255 | 0) << 24);
      i++;
    }
    if (this.dirty) {
      this.container.update();
      this.dirty = false;
    }
  }
}

/** Strumień (emiter ciągły): `rate` cząsteczek na sekundę przez `duration` ms albo do stop(). */
class Stream {
  constructor(rate, duration, spawn) {
    this.rate = rate;
    this.left = duration ?? Infinity;
    this.spawn = spawn;
    this.acc = 0;
    this.alive = true;
  }

  stop() {
    this.alive = false;
  }
}

export class ParticleSystem {
  alive = 0;
  layers = {};
  #layerList = [];
  #streams = [];

  constructor(gameApp) {
    this.gameApp = gameApp;
    this.quality = gameApp.quality;
    this.motion = gameApp.motion;
  }

  get limit() {
    return this.quality.params.particles;
  }

  /** Czy cząsteczka o priorytecie `prio` może się urodzić (limit poziomu + klasy P1–P3). */
  allow(prio) {
    const occ = this.alive / this.limit;
    if (occ >= 1) return false;
    if (prio >= 3 && occ >= 0.85) return false;
    if (prio === 2 && occ >= 0.95) return fxRng.next() < 0.5;
    return true;
  }

  addLayer(name, parent, atlas, blendMode = 'normal', options = {}) {
    const layer = new ParticleLayer(this, this.gameApp.PIXI, parent, atlas, blendMode, options);
    this.layers[name] = layer;
    this.#layerList.push(layer);
    return layer;
  }

  /** Strumień: spawn(i) woła się `rate` razy na sekundę (czas efektów — staje w hit-stop). */
  stream(rate, duration, spawn) {
    const s = new Stream(rate, duration, spawn);
    this.#streams.push(s);
    return s;
  }

  clearAll() {
    for (const s of this.#streams) s.stop();
    for (const l of Object.values(this.layers)) l.clear();
  }

  update(_dt, fxDt) {
    const dt = fxDt / 1000;
    if (this.#streams.length) {
      for (const s of this.#streams) {
        if (!s.alive) continue;
        s.left -= fxDt;
        if (s.left <= 0) {
          s.alive = false;
          continue;
        }
        s.acc += s.rate * dt;
        while (s.acc >= 1) {
          s.acc -= 1;
          s.spawn();
        }
      }
      this.#streams = this.#streams.filter((s) => s.alive);
    }
    for (const l of this.#layerList) l.update(dt);
  }

  // ------------------------------------------------------------------------------------- presety emiterów (04 § 2.3)

  #k() {
    return this.gameApp.layout.k;
  }

  /** Ile cząsteczek naprawdę: prośba H/M/L × ograniczenie ruchu. */
  count(triple) {
    return Math.round(this.quality.pick(triple) * this.motion.particleMul);
  }

  /** iskry_wybuch: promieniście 400–1100 px/s, opór 3, grawitacja 300, 350–700 ms, 10–36 px (tint). */
  sparks(layerName, x, y, n, { tint = 0xffe08a, speed = [400, 1100], size = [10, 36], life = [350, 700], spread = Math.PI * 2, angle = 0, gravity = 300, frames = ['iskra0', 'iskra1', 'iskra3', 'iskra4', 'iskra6'], tints = null, prio = 1, area = null } = {}) {
    const layer = this.layers[layerName];
    if (!layer) return;
    const k = this.#k() * this.motion.speedMul;
    const kk = this.#k();
    for (let j = 0; j < n; j++) {
      const a = angle + (fxRng.next() - 0.5) * spread;
      const v = fxRng.range(speed[0], speed[1]) * k;
      const streak = fxRng.next() < 0.25;
      const px = area ? x + (fxRng.next() - 0.5) * area.w : x;
      const py = area ? y + (fxRng.next() - 0.5) * area.h : y;
      layer.spawn({
        x: px, y: py, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: gravity * k, drag: 3,
        life: fxRng.range(life[0], life[1]) / 1000, s0: (fxRng.range(size[0], size[1]) * kk) / 64, s1: 0,
        rot: fxRng.next() * 6.28, vrot: fxRng.range(-6, 6), tint: tints ? fxRng.pick(tints) : tint,
        frame: streak ? 'iskra5' : fxRng.pick(frames), align: streak, kind: KIND.SPARK, prio,
      });
    }
  }

  /** iskry_migot: gwiazdki w elipsie wokół obiektu, skala 0 → 1 → 0, 300–600 ms. */
  twinkles(layerName, cx, cy, rx, ry, n, { tint = 0xffffff, size = [16, 34], life = [300, 600], prio = 2 } = {}) {
    const layer = this.layers[layerName];
    if (!layer) return;
    const kk = this.#k();
    for (let j = 0; j < n; j++) {
      const a = fxRng.next() * Math.PI * 2;
      const r = Math.sqrt(fxRng.next());
      layer.spawn({
        x: cx + Math.cos(a) * rx * r, y: cy + Math.sin(a) * ry * r, vy: -10 * kk,
        life: fxRng.range(life[0], life[1]) / 1000, s0: (fxRng.range(size[0], size[1]) * kk) / 64,
        rot: fxRng.next() * 1.57, tint, frame: fxRng.pick(['iskra0', 'iskra1', 'iskra6']), kind: KIND.TWINKLE, prio,
      });
    }
  }

  /** monety_wybuch: promieniście 700–1600 px/s, grawitacja 2000, opór 1,2, 900–1400 ms, 24–56 px. */
  coinsBurst(layerName, x, y, n, { speed = [700, 1600], size = [24, 56], up = false } = {}) {
    const layer = this.layers[layerName];
    if (!layer) return;
    const k = this.#k() * this.motion.speedMul;
    const kk = this.#k();
    for (let j = 0; j < n; j++) {
      const a = up ? -Math.PI / 2 + (fxRng.next() - 0.5) * 1.1 : fxRng.next() * Math.PI * 2;
      const v = fxRng.range(speed[0], speed[1]) * k;
      layer.spawn(this.#coin(x, y, Math.cos(a) * v, Math.sin(a) * v - 200 * k, 2000 * k, 1.2, fxRng.range(0.9, 1.4), fxRng.range(size[0], size[1]) * kk));
    }
  }

  #coin(x, y, vx, vy, g, drag, life, sizePx) {
    return {
      x, y, vx, vy, g, drag, life, s0: sizePx / 64, ph: fxRng.next() * 6.28, om: fxRng.range(1.6, 3.2) * Math.PI * 2,
      rot: fxRng.range(-0.3, 0.3), vrot: fxRng.range(-1.5, 1.5), frame: 'coin0', kind: KIND.COIN, prio: 1,
    };
  }

  /** monety_deszcz: z górnej krawędzi; vy 250–650 px/s, grawitacja 1400, 28–72 px; strumień `rate`/s. */
  coinRain(layerName, rate, duration, { width, front = false } = {}) {
    const layer = this.layers[layerName];
    if (!layer) return null;
    return this.stream(rate * this.motion.particleMul, duration, () => {
      const k = this.#k() * this.motion.speedMul;
      const kk = this.#k();
      const w = width ?? this.gameApp.layout.w;
      const big = front ? 1.3 : 1;
      layer.spawn(this.#coin(fxRng.range(-0.1, 1.1) * w, -40 * kk, fxRng.range(-60, 60) * k, fxRng.range(250, 650) * k * (front ? 1.25 : 1), 1400 * k, 0.6, 2.5, fxRng.range(28, 72) * kk * big));
    });
  }

  /** monety_fontanna: z punktu w górę, kąt −90° ± 28°, 900–1500 px/s, grawitacja 2200. */
  coinFountain(layerName, x, y, rate, duration) {
    const layer = this.layers[layerName];
    if (!layer) return null;
    return this.stream(rate * this.motion.particleMul, duration, () => {
      const k = this.#k() * this.motion.speedMul;
      const a = -Math.PI / 2 + (fxRng.next() - 0.5) * 0.98;
      const v = fxRng.range(900, 1500) * k;
      layer.spawn(this.#coin(x, y, Math.cos(a) * v, Math.sin(a) * v, 2200 * k, 0.4, fxRng.range(1.4, 2.0), fxRng.range(24, 64) * this.#k()));
    });
  }

  /** konfetti: dwa działka w dolnych rogach, kąty −62° i −118° ± 14°, 1400–2200 px/s (brak w RM). */
  confetti(layerName, n, { w, h, tints = [0xffe08a, 0xff2e88, 0x21e6ff, 0xffffff] } = {}) {
    const layer = this.layers[layerName];
    if (!layer || this.motion.reduced) return;
    const W = w ?? this.gameApp.layout.w;
    const H = h ?? this.gameApp.layout.h;
    const k = this.#k();
    for (let j = 0; j < n; j++) {
      const left = j % 2 === 0;
      const a = ((left ? -62 : -118) + fxRng.range(-14, 14)) * (Math.PI / 180);
      const v = fxRng.range(1400, 2200) * k * Math.min(1.4, H / (1080 * k));
      layer.spawn({
        x: left ? -10 : W + 10, y: H * 0.98, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: 900 * k, drag: 1.8,
        life: fxRng.range(2.5, 4), s0: (fxRng.range(14, 34) * k) / 32, ph: fxRng.next() * 6, om: fxRng.range(4, 10),
        amp: fxRng.range(20, 60) * k, rot: fxRng.next() * 6, vrot: fxRng.range(-6.28, 6.28), tint: fxRng.pick(tints),
        frame: `confetti${fxRng.int(0, 11)}`, kind: KIND.CONFETTI, prio: 2,
      });
    }
  }

  /** dym_klab — pierścień kłębów (04 § 2.11): skala 0,6 → 1,8, alfa 0 → 0,35 → 0. */
  smokeRing(layerName, x, y, n, { tint = 0xc9c3e6, size = 600, alpha = 0.35 } = {}) {
    const layer = this.layers[layerName];
    if (!layer || this.motion.reduced) return;
    const k = this.#k();
    const count = Math.min(n, this.quality.params.smoke);
    for (let j = 0; j < count; j++) {
      const a = (j / count) * Math.PI * 2;
      const v = fxRng.range(120, 260) * k;
      layer.spawn({
        x: x + Math.cos(a) * 80 * k, y: y + Math.sin(a) * 80 * k, vx: Math.cos(a) * v, vy: Math.sin(a) * v, drag: 1.5,
        life: 1.6, s0: (size * 0.6 * k) / 128, s1: (size * 1.8 * k) / 128, alpha, rot: fxRng.next() * 6, vrot: fxRng.range(-0.17, 0.17),
        tint, frame: 'smoke', kind: KIND.SMOKE, prio: 2,
      });
    }
  }

  /** neon_iskry (S1): w dół ± 50°, 300–800 px/s, grawitacja 1800, jedno odbicie od `floor`. */
  neonSparks(layerName, x, y, n, floor, { tints = [0x21e6ff, 0xff2e88] } = {}) {
    const layer = this.layers[layerName];
    if (!layer) return;
    const k = this.#k() * this.motion.speedMul;
    for (let j = 0; j < n; j++) {
      const a = Math.PI / 2 + fxRng.range(-0.87, 0.87);
      const v = fxRng.range(300, 800) * k;
      layer.spawn({
        x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: 1800 * k, drag: 0.5, life: fxRng.range(0.4, 0.9),
        s0: (fxRng.range(6, 14) * this.#k() * 2.2) / 64, s1: 0.02, tint: fxRng.pick(tints), frame: fxRng.next() < 0.5 ? 'iskra5' : 'iskra3',
        align: true, floor, kind: KIND.NEON, prio: 1,
      });
    }
  }

  /** pył tła (P3): stała populacja dryfująca w górę z zawijaniem. */
  dust(layerName, n, { w, h, tints = [0xffe08a, 0xff2e88, 0x21e6ff] } = {}) {
    const layer = this.layers[layerName];
    if (!layer) return;
    layer.boundsW = w;
    layer.boundsH = h;
    const k = this.#k();
    for (let j = 0; j < n; j++) {
      layer.spawn({
        x: fxRng.next() * w, y: fxRng.next() * h, vy: -fxRng.range(6, 20) * k, life: 1e9,
        s0: (fxRng.range(3, 9) * k * 2) / 64, alpha: fxRng.range(0.05, 0.25), ph: fxRng.next() * 6, om: fxRng.range(1.2, 3),
        amp: fxRng.range(4, 12) * k, tint: fxRng.pick(tints), frame: 'iskra2', kind: KIND.FLOAT, prio: 3,
      });
    }
  }
}
