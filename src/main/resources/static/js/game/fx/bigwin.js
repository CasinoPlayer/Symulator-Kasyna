/**
 * game/fx/bigwin.js — sekwencja BIG / MEGA / EPIC / ULTRA WIN (04 § 4, karty E30, E31, E32).
 *
 * Przebieg: wejście (zasłona, dym, baner z uderzeniem, promienie) → liczenie od 0 przez kolejne progi (30×, 60×,
 * 100× zakładu) z eskalacją poziomu na każdym progu (hit-stop 80 ms, błysk poziomu, nowy baner, basowe uderzenie,
 * więcej monet) → slam kwoty końcowej → przytrzymanie → wyjście (licznik leci do pola „WYGRANA” w panelu).
 *
 * Krzywa liczenia (04 § 4.2): segmenty nieostatnie liniowo (pierwsze 300 ms easeInQuad), ostatni Hermite z s₀ =
 * znormalizowana prędkość wejściowa (≤ 3) — licznik wjeżdża w ostatni segment z dotychczasową prędkością i łagodnie
 * hamuje (zwykły easeOutCubic przyspieszyłby nagle ~3×, co wygląda jak błąd).
 * Przewinięcie (04 § 4.5): ignorowane przez pierwsze 400 ms; w trakcie liczenia — skok do kwoty i JEDNA łączna
 * eskalacja do poziomu końcowego; w trakcie przytrzymania — natychmiastowe wyjście.
 */

import { SkipToken, Timeline } from '../core/tween.js';
import { KIND } from './particles.js';
import { easeOutCubic, easeInOutSine, easeInCubic, easeInQuad, easeOutBack, hermite, punch, clamp } from '../core/easing.js';
import { fxRng } from '../core/random.js';
import { formatAmount } from '../../format.js';

/**
 * Poziomy: próg (× zakładu), baner, skala banera, błysk, trauma, promienie, akcent iskier (04 § 4.3, 01 § 3.5).
 * Przyrosty traumy eskalacji (+0,50 / +0,60 / +0,75) są większe niż wejście BIG (0,45): trauma z E30 zdąży zgasnąć,
 * a każda eskalacja ma trząść mocniej od poprzedniej (R2).
 */
export const LEVELS = [
  { id: 'big', name: 'BIG WIN', at: 15, banner: 'g_win_big', scale: 1.0, flash: 'big', trauma: 0.45, omega: 4, tintA: 0xffd77a, tintB: 0xfff0c8, spark: 0xffe08a, hold: 1500, rain: [36, 18, 9], fountain: [30, 16, 8] },
  { id: 'mega', name: 'MEGA WIN', at: 30, banner: 'g_win_mega', scale: 1.06, flash: 'mega', trauma: 0.5, omega: 5.5, tintA: 0xffe08a, tintB: 0xff2e88, spark: 0xff2e88, hold: 1800, rain: [60, 30, 15], fountain: [40, 20, 10] },
  { id: 'epic', name: 'EPIC WIN', at: 60, banner: 'g_win_epic', scale: 1.12, flash: 'epic', trauma: 0.6, omega: 7, tintA: 0xffe08a, tintB: 0x8f3dff, spark: 0x8f3dff, hold: 2100, rain: [85, 42, 21], fountain: [50, 25, 12] },
  { id: 'ultra', name: 'ULTRA WIN', at: 100, banner: 'g_win_ultra', scale: 1.18, flash: 'ultra', trauma: 0.75, omega: 8, tintA: 0x21e6ff, tintB: 0xffffff, spark: 0x21e6ff, hold: 2600, rain: [110, 55, 27], fountain: [60, 30, 15], rainbow: true },
];
const TIER_INDEX = { big: 0, mega: 1, epic: 2, ultra: 3 };

/**
 * Segmenty liczenia (04 § 4.2) dla mnożnika m i poziomu końcowego.
 * @returns {{from: number, to: number, dur: number, last: boolean, level: number}[]} wartości w × zakładu, czas w ms
 */
export function countSegments(m, finalLevel) {
  const ends = [30, 60, 100];
  const segs = [];
  let from = 0;
  for (let lv = 0; lv <= finalLevel; lv++) {
    const last = lv === finalLevel;
    const to = last ? m : ends[lv];
    let dur;
    if (lv === 0) dur = 2600 * (last ? clamp(m / 30, 0.6, 1) : 1);
    else if (lv === 1) dur = 2400 * (last ? clamp((m - 30) / 30, 0.5, 1) : 1);
    else if (lv === 2) dur = 2400 * (last ? clamp((m - 60) / 40, 0.5, 1) : 1);
    else dur = clamp(2400 + 600 * Math.log2(Math.max(1, m / 100)), 2400, 4200);
    segs.push({ from, to, dur, last, level: lv });
    from = to;
  }
  return segs;
}

/** Wartość segmentu w chwili t (ms od jego startu). */
function segmentValue(seg, t, vIn) {
  const span = seg.to - seg.from;
  if (seg.last) {
    const s0 = seg.level === 0 ? 3 : Math.min(3, (vIn * seg.dur) / (span || 1));
    return seg.from + span * hermite(s0)(clamp(t / seg.dur, 0, 1));
  }
  // liniowo, pierwsze 300 ms rozpędzanie (easeInQuad) z ciągłą prędkością
  const ramp = Math.min(300, seg.dur / 3);
  const v = span / (seg.dur - ramp / 2);
  const p = t < ramp ? (v * t * t) / (2 * ramp) : v * (t - ramp / 2);
  return seg.from + Math.min(span, p);
}

export class BigWin {
  phase = 'idle';
  #countToken = null;
  #holdToken = null;
  #skipRequested = false;
  #startedAt = 0;

  /**
   * @param {object} deps { gameApp, particles, flash, camera, rays, shots, shine, audio, digitFont, banners: Texture[], bannerGlows: (Texture|null)[], radialTexture, smokeAtlas }
   */
  constructor(deps) {
    Object.assign(this, deps);
    const { PIXI, layers } = this.gameApp;
    this.root = new PIXI.Container({ label: 'bigwin-scena' });
    this.curtain = new PIXI.Sprite(PIXI.Texture.WHITE);
    this.curtain.tint = 0x07060f;
    this.curtain.alpha = 0;
    this.raysHost = new PIXI.Container();
    this.backCoins = new PIXI.Container();
    this.bannerHost = new PIXI.Container();
    this.bannerGlow = new PIXI.Sprite();
    this.bannerGlow.anchor.set(0.5);
    this.bannerGlow.blendMode = 'add';
    this.banner = new PIXI.Sprite();
    this.banner.anchor.set(0.5);
    this.oldBanner = new PIXI.Sprite();
    this.oldBanner.anchor.set(0.5);
    this.oldBanner.visible = false;
    this.oldBanner.blendMode = 'add';
    this.bannerHost.addChild(this.bannerGlow, this.oldBanner, this.banner);
    this.addFx = new PIXI.Container();
    this.frontCoins = new PIXI.Container();
    this.root.addChild(this.curtain, this.raysHost, this.backCoins, this.bannerHost, this.addFx, this.frontCoins);
    this.root.visible = false;
    layers.bigwin.addChild(this.root);
    // licznik na warstwie, która nie drży (R1: wynik jest święty)
    this.counterGlow = new PIXI.Sprite(this.radialTexture);
    this.counterGlow.anchor.set(0.5);
    this.counterGlow.blendMode = 'add';
    this.counterGlow.tint = 0xf5c542;
    this.counterGlow.alpha = 0;
    this.counter = this.digits;
    this.counter.root.visible = false;
    layers.bigwinFixed.addChild(this.counterGlow, this.counter.root);
    this.raysFx = this.makeRays(this.raysHost);
  }

  /** Rozmiar i położenie banera: pole 960×640, ≤ 92% szerokości i ≤ 45% wysokości ekranu (04 § 4.3). */
  #bannerScale(levelScale = 1) {
    const { w, h, portrait } = this.gameApp.layout;
    const tex = this.banner.texture;
    const tw = tex?.width || 960;
    const th = tex?.height || 640;
    // niski ekran (telefon poziomo): mniejszy baner, żeby licznik zmieścił się pod nim
    const fit = Math.min((w * 0.92) / tw, (h * (portrait ? 0.34 : h < 500 ? 0.36 : 0.42)) / th);
    return fit * levelScale;
  }

  #setBanner(level) {
    const tex = this.banners[level];
    this.banner.texture = tex;
    const glow = this.bannerGlows?.[level];
    this.bannerGlow.visible = Boolean(glow) && this.gameApp.quality.params.bloom !== 'none';
    if (glow) this.bannerGlow.texture = glow;
    this.bannerGlow.tint = LEVELS[level].tintA;
  }

  #layout() {
    const { w, h, portrait, k } = this.gameApp.layout;
    this.curtain.width = w;
    this.curtain.height = h;
    const cx = w / 2;
    const by = h * (portrait ? 0.36 : h < 500 ? 0.38 : 0.4);
    this.bannerHost.position.set(cx, by);
    const ch = Math.max(52, Math.min(portrait ? 72 : 120, 120 * k * (portrait ? 0.9 : 1.1)));
    // licznik pod dolną krawędzią NAJWIĘKSZEGO banera (ULTRA × 1,18) — przy eskalacjach baner rośnie
    // i nie może najechać na cyfry (R1: wynik czytelny przez cały czas)
    const counterY = by + (this.banner.texture?.height || 640) * this.#bannerScale(LEVELS.at(-1).scale) * 0.47 + ch * 0.5;
    this.counter.setHeight(ch);
    this.counter.root.position.set(cx, Math.min(h - ch * 0.8, counterY));
    this.counterGlow.position.copyFrom(this.counter.root.position);
    this.counterGlow.width = ch * 6;
    this.counterGlow.height = ch * 2.2;
    this.center = { x: cx, y: by };
  }

  /** Przewinięcie (dotknięcie / Spacja / SPIN). */
  skip() {
    if (this.phase === 'idle' || this.phase === 'exit') return;
    if (this.gameApp.tweener.now - this.#startedAt < 400) return;   // chroni przed przewinięciem tym samym kliknięciem
    if (this.phase === 'intro') this.#skipRequested = true;
    else if (this.phase === 'count') this.#countToken?.skip();
    else if (this.phase === 'hold') this.#holdToken?.skip();
  }

  get active() {
    return this.phase !== 'idle';
  }

  /**
   * Odgrywa sekwencję.
   * @param {{amount: number, bet: number, tier: string, tempo?: number, autoplay?: boolean, entry?: 'normal'|'jackpot', onCount?: (v: number) => void, onDim?: (on: boolean) => void, panelTarget?: () => {x: number, y: number}|null, onLanded?: () => void}} o
   */
  async play(o) {
    const { gameApp } = this;
    const tw = gameApp.tweener;
    const q = gameApp.quality;
    const reduced = gameApp.motion.reduced;
    const tempo = o.tempo ?? 1;
    const m = o.amount / o.bet;
    const finalLevel = Math.max(TIER_INDEX[o.tier] ?? 0, m >= 100 ? 3 : m >= 60 ? 2 : m >= 30 ? 1 : 0);
    const countMul = tempo * (reduced ? 0.6 : 1);
    this.phase = 'intro';
    this.#skipRequested = false;
    this.#startedAt = tw.now;
    this.level = 0;
    this.root.visible = true;
    this.#setBanner(0);
    this.#layout();
    this.banner.alpha = 0;
    this.bannerGlow.alpha = 0;
    this.counter.text = '0';
    this.counter.root.visible = false;
    this.counter.root.alpha = 1;
    this.counter.root.scale.set(1);
    const jackpot = o.entry === 'jackpot';
    const fx = this.particles;
    const { x: cx, y: cy } = this.center;
    const k = gameApp.layout.k;
    o.onDim?.(true);

    // ---------------------------------------------------------------- E30 wejście (0–600 ms; jackpot: skrócone)
    tw.to(this.curtain, { alpha: 0.62 }, { duration: 300, ease: 'easeOutQuad' });
    if (!jackpot) this.audio.bigwinEnter();
    const impactAt = jackpot ? 220 : 300;
    const intro = new Timeline(tw);
    intro.at(50, () => !jackpot && fx.smokeRing('bwAdd', cx, cy, 8, { size: 600 }));
    intro.at(impactAt - 220, () => {
      this.banner.alpha = 1;
      const s1 = this.#bannerScale(1);
      if (reduced) {
        this.banner.alpha = 0;
        this.banner.scale.set(s1 * 0.96);
        tw.to(this.banner, { alpha: 1, scale: s1 }, { duration: 300 });
      } else {
        tw.tween(220, (e) => this.banner.scale.set(s1 * (0.2 + 0.95 * e)), { ease: easeOutCubic, target: this.banner });
        tw.tween(180, (e) => this.banner.scale.set(s1 * (1.15 - 0.15 * e)), { ease: easeInOutSine, delay: 220, target: this.banner });
      }
      this.bannerGlow.scale.set(this.#bannerScale(1));
      // poświata banera: krótki rozbłysk 0,7 → stałe 0,32 (mocniej „pierze” planszę za kurtyną i gasi kontrast cyfr)
      tw.tween(400, (e) => { this.bannerGlow.alpha = 0.7 - 0.38 * e; });
    });
    intro.at(impactAt - 200, () => this.#showRays(0));
    // „ciemny takt” (R5, 04 E30 180–300 ms): zasłona dociemnia się 0,62 → 0,74 i iskry zasysane do środka —
    // „implozja” przed wybuchem; zmiana jasności sceny ΔL < 0,01, więc to nie osobny błysk
    intro.at(impactAt - 120, () => {
      if (reduced) return;
      tw.tween(120, (e) => { this.curtain.alpha = 0.62 + 0.12 * e; }, { ease: easeInQuad });
      this.#implode(fx.count([12, 8, 0]));
    });
    intro.at(impactAt, () => {
      if (!reduced) tw.tween(150, (e) => { this.curtain.alpha = 0.74 - 0.12 * e; });
      // uderzenie: błysk (bez błysku w NEON JACKPOT — budżet 3/s, 04 E51), trauma, iskry, flara, pierścień
      if (!jackpot) this.flash.fire('big', { name: 'bigwin-big' });
      else this.audio.bigwinEnter({ jackpot: true });
      this.camera.add(0.45);
      fx.sparks('bwAdd', cx, cy, fx.count([60, 36, 16]), { tint: 0xffe08a, speed: [500, 1300] });
      if (!jackpot) this.shots.flare(this.addFx, cx, cy, 900 * k, 0xfff3d1);
      this.shots.ring(this.addFx, cx, cy, 600 * k, 0xffe08a);
    });
    intro.at(impactAt + 150, () => {
      this.counter.root.visible = true;
      this.counter.root.scale.set(0.8);
      tw.to(this.counter.root, { scale: 1 }, { duration: 150, ease: 'easeOutCubic' });
      tw.to(this.counterGlow, { alpha: 0.35 }, { duration: 300 });
    });
    await intro.play({ extra: (jackpot ? 400 : 600) - impactAt - 150 });

    // ---------------------------------------------------------------- liczenie (segmenty + eskalacje E31)
    this.phase = 'count';
    this.#countToken = new SkipToken();
    if (this.#skipRequested) this.#countToken.skip();
    this.audio.bigwinCount();
    this.#startStreams(0);
    const segs = countSegments(m, finalLevel).map((s) => ({ ...s, dur: s.dur * countMul }));
    const total = segs.reduce((a, s) => a + s.dur, 0);
    // rezerwacje w strażniku błysków (04 § 1.4): eskalacje i slam — błyski lokalne nie zajmą ich miejsc
    {
      let acc = 0;
      segs.forEach((sg, i) => {
        acc += sg.dur;
        this.flash.governor.reserve(acc + i * 80, sg.last ? 'bigwin-koniec' : `bigwin-${LEVELS[i + 1].id}`);
      });
    }
    const shineEvery = 2400;
    let lastShine = -shineEvery + 150;
    let skipped = false;
    let segIndex = 0;
    let segStart = 0;
    let vIn = 0;
    const pre = new Set();
    const counted = new Promise((resolve) => {
      let ct = 0;
      const t = tw.tween(Infinity, () => {
        // czas liczenia płynie zegarem efektów (staje w hit-stop)
        ct += tw.lastFxDt;
        let seg = segs[segIndex];
        while (seg && ct - segStart >= seg.dur && !seg.last) {
          // granica poziomu: eskalacja (zapowiedzi −400/−250/−150 ms wyżej)
          vIn = (seg.to - seg.from) / (seg.dur - Math.min(300, seg.dur / 3) / 2);
          segStart += seg.dur;
          segIndex++;
          this.#escalate(segIndex, o);
          seg = segs[segIndex];
        }
        if (!seg) return;
        const local = ct - segStart;
        // zapowiedzi eskalacji (E31: −400 promienie szybciej, −250 dźwięk, −150 „ładowanie” banera)
        if (!seg.last) {
          const left = seg.dur - local;
          if (left <= 400 && !pre.has(`${segIndex}a`)) { pre.add(`${segIndex}a`); this.raysFx.speedMul = 1.5; tw.to(this.counterGlow, { alpha: 0.6 }, { duration: 300 }); this.camera.setFloor(0.1); }
          // dźwięk eskalacji startuje tak, by jego `syncPoint` (uderzenie, 250 ms pliku) trafił dokładnie w próg
          if (left <= this.audio.levelLeadMs(segIndex + 1) && !pre.has(`${segIndex}b`)) { pre.add(`${segIndex}b`); this.audio.bigwinLevelSoon(segIndex + 1, left); }
          if (left <= 150 && !pre.has(`${segIndex}c`)) {
            pre.add(`${segIndex}c`);
            const s = this.banner.scale.x;
            tw.tween(150, (e) => this.banner.scale.set(s * (1 + 0.06 * e)));
            // „ciemny takt” (E31 −150 ms): zasłona 0,62 → 0,72, promienie przygasają do 0,6 a — w 0 ms wracają z błyskiem
            if (!reduced) {
              tw.tween(120, (e) => { this.curtain.alpha = 0.62 + 0.1 * e; this.raysFx.dim = 1 - 0.4 * e; }, { ease: easeInQuad });
            }
          }
        }
        const value = segmentValue(seg, local, vIn) * o.bet;
        const shown = Math.min(o.amount, Math.floor(value));
        this.counter.text = formatAmount(shown);
        o.onCount?.(shown);
        this.audio.counterProgress(clamp(ct / total, 0, 1), this.level * 0.15);
        if (ct - lastShine >= shineEvery) {
          lastShine = ct;
          this.shine.run(this.banner, { duration: 700 });
        }
        if (seg.last && local >= seg.dur) {
          tw.kill(t);
          resolve();
        }
      }, { freeze: true });
      this.#countToken.onSkip(() => {
        skipped = true;
        tw.kill(t);
        resolve();
      });
    });
    await counted;
    this.camera.setFloor(0);
    this.raysFx.speedMul = 1;
    if (skipped && this.level < finalLevel) {
      // jedna łączna eskalacja od razu do poziomu końcowego (04 § 4.5)
      this.#escalate(finalLevel, o, { combined: true });
      this.#startStreams(finalLevel, 600);
    }
    this.counter.text = formatAmount(o.amount);
    o.onCount?.(o.amount);

    // ---------------------------------------------------------------- E32 slam, przytrzymanie, wyjście
    this.phase = 'slam';
    this.#stopStreams();
    this.audio.bigwinEnd();
    const cr = this.counter.root;
    if (reduced) cr.scale.set(1);
    else {
      tw.tween(120, (e) => cr.scale.set(1 + 0.3 * e), { ease: easeOutCubic });
      tw.tween(260, (e) => cr.scale.set(1.3 - 0.3 * e), { ease: easeOutBack(1.7), delay: 120 });
    }
    this.flash.fire({ tint: LEVELS[this.level].tintA, alpha: 0.35, attack: 30, hold: 0, decay: 300, radial: true }, { name: 'bigwin-koniec' });
    this.camera.add(0.3);
    fx.coinsBurst('bwFront', cr.x, cr.y, fx.count([60, 34, 14]));
    fx.sparks('bwAdd', cr.x, cr.y, fx.count([40, 24, 10]), { tint: LEVELS[this.level].spark });
    tw.wait(400).then(() => this.phase !== 'idle' && this.shine.run(this.banner, { duration: 700 }));

    this.phase = 'hold';
    this.#holdToken = new SkipToken();
    const holdBase = LEVELS[this.level].hold;
    const hold = skipped ? (this.level === 3 ? 1500 : 1200) : Math.max(900, holdBase * (tempo < 1 ? tempo : 1));
    const twinkle = fx.stream(fx.count([20, 12, 4]), hold, () => {
      const r = this.#bannerScale() * 480;
      fx.twinkles('bwAdd', cx, cy, r, r * 0.55, 1, { tint: 0xfff3d1 });
    });
    const holdStart = tw.now;
    await tw.wait(hold, { token: this.#holdToken });
    twinkle.stop();
    const quickExit = tw.now - holdStart < hold - 1;

    this.phase = 'exit';
    const exitMs = quickExit ? 400 : 600;
    this.audio.whoosh();
    tw.to(this.banner, { alpha: 0, scale: this.banner.scale.x * 0.85 }, { duration: 300, ease: 'easeInCubic' });
    tw.to(this.bannerGlow, { alpha: 0 }, { duration: 300 });
    this.raysFx.hide(400);
    tw.to(this.counterGlow, { alpha: 0 }, { duration: 300 });
    // licznik leci do pola „WYGRANA” (krzywa Béziera 2. stopnia, easeInCubic, skala → 0,3)
    const target = o.panelTarget?.() ?? { x: cr.x, y: gameApp.layout.h + 40 };
    const p0 = { x: cr.x, y: cr.y };
    const ctrl = { x: (p0.x + target.x) / 2 + (target.x - p0.x) * 0.2, y: Math.min(p0.y, target.y) - 120 * k };
    tw.tween(500 * (exitMs / 600), (e) => {
      const u = 1 - e;
      cr.position.set(u * u * p0.x + 2 * u * e * ctrl.x + e * e * target.x, u * u * p0.y + 2 * u * e * ctrl.y + e * e * target.y);
      cr.scale.set(1 - 0.7 * e);
      if (fxRng.next() < 0.5 && q.level !== 'low') fx.sparks('bwAdd', cr.x, cr.y, 1, { tint: 0xffe08a, speed: [40, 120], size: [8, 18], life: [200, 350] });
    }, { ease: easeInCubic });
    await tw.wait(exitMs * (400 / 600));
    tw.to(this.curtain, { alpha: 0 }, { duration: 400 });
    o.onDim?.(false);
    await tw.wait(exitMs * (100 / 600));
    o.onLanded?.();
    cr.visible = false;
    await tw.wait(exitMs * (100 / 600));
    this.root.visible = false;
    this.phase = 'idle';
    return { level: this.level, skipped };
  }

  /** Iskry na okręgu (średnica 1,2 × szerokości banera) lecące do środka z prędkością −500 px/s, gasnące przed nim. */
  #implode(n) {
    const layer = this.particles.layers.bwAdd;
    if (!layer || !n) return;
    const k = this.gameApp.layout.k;
    const r = (this.banner.texture?.width || 960) * this.#bannerScale() * 0.6;
    const v = 500 * k;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + fxRng.range(-0.2, 0.2);
      layer.spawn({
        x: this.center.x + Math.cos(a) * r, y: this.center.y + Math.sin(a) * r, vx: -Math.cos(a) * v, vy: -Math.sin(a) * v,
        life: (r / v) * 0.8, s0: (fxRng.range(20, 34) * k) / 64, rot: fxRng.next() * 1.5, tint: 0xfff3d1,
        frame: 'iskra0', kind: KIND.TWINKLE, prio: 1,
      });
    }
  }

  #showRays(level) {
    const L = LEVELS[level];
    const q = this.gameApp.quality.params;
    const { short } = this.gameApp.layout;
    this.raysFx.show({ x: this.center.x, y: this.center.y, size: short * q.raysScale, omega: L.omega, alpha: 0.85, tintA: L.tintA, tintB: L.tintB, rainbow: Boolean(L.rainbow) });
  }

  /** Eskalacja poziomu (E31). `combined` — łączna przy przewinięciu (bez banerów pośrednich). */
  #escalate(level, o, { combined = false } = {}) {
    const tw = this.gameApp.tweener;
    const L = LEVELS[level];
    const fx = this.particles;
    const k = this.gameApp.layout.k;
    const { x: cx, y: cy } = this.center;
    const reduced = this.gameApp.motion.reduced;
    this.level = level;
    if (!reduced) tw.tween(150, (e) => { this.curtain.alpha = 0.72 - 0.1 * e; this.raysFx.dim = 0.6 + 0.4 * e; });
    tw.hitStop(80);                                   // stopklatka: licznik i cząsteczki stoją, kamera i muzyka nie
    this.flash.fire(L.flash, { name: `bigwin-${L.id}` });
    this.audio.bigwinLevelHit(level);
    if (combined) this.audio.bigwinLevelSoon(level, 0);   // bez zapowiedzi: silnik wchodzi w plik od uderzenia
    this.camera.add(L.trauma);
    // stary baner „rozdyma się” i znika; nowy wchodzi 0,3 → 1,22 → skala poziomu
    this.oldBanner.texture = this.banner.texture;
    this.oldBanner.scale.copyFrom(this.banner.scale);
    this.oldBanner.visible = !reduced;
    this.oldBanner.alpha = 1;
    const os = this.oldBanner.scale.x;
    tw.tween(200, (e) => { this.oldBanner.scale.set(os * (1 + 0.4 * e)); this.oldBanner.alpha = 1 - e; }, { onComplete: () => { this.oldBanner.visible = false; } });
    this.#setBanner(level);
    const s = this.#bannerScale(L.scale);
    if (reduced) {
      this.banner.scale.set(s * 0.96);
      this.banner.alpha = 0;
      tw.to(this.banner, { alpha: 1, scale: s }, { duration: 300 });
    } else {
      this.banner.alpha = 1;
      tw.tween(200, (e) => this.banner.scale.set(s * (0.3 + 0.92 * e)), { ease: easeOutCubic });
      tw.tween(220, (e) => this.banner.scale.set(s * (1.22 - 0.22 * e)), { ease: easeOutBack(1.7), delay: 200 });
    }
    this.bannerGlow.scale.set(s);
    this.bannerGlow.alpha = 0.6;
    tw.tween(500, (e) => { this.bannerGlow.alpha = 0.6 - 0.28 * e; }, { delay: 120 });
    const after = new Timeline(tw);
    after.at(80, () => {
      this.shots.ring(this.addFx, cx, cy, 600 * k, L.spark);
      fx.sparks('bwAdd', cx, cy, fx.count([80, 48, 20]), { tint: L.spark, tints: L.rainbow ? [0x21e6ff, 0x8f3dff, 0xff2e88, 0xffe08a] : null, speed: [500, 1400] });
      this.shots.flare(this.addFx, cx - 220 * k, cy - 60 * k, 500 * k, L.tintA);
      this.shots.flare(this.addFx, cx + 220 * k, cy + 40 * k, 500 * k, L.tintB);
    }, { raw: true });
    after.at(120, () => this.raysFx.level({ omega: L.omega, tintA: L.tintA, tintB: L.tintB, rainbow: Boolean(L.rainbow) }), { raw: true });
    after.at(150, () => {
      if (level >= 1) fx.confetti('bwFront', fx.count([this.gameApp.quality.params.confetti, 110, 40]) / (this.gameApp.quality.params.index === 0 ? 1 : 1));
      if (level === 3) tw.wait(500).then(() => fx.confetti('bwFront', fx.count([110, 60, 20])));
      if (level >= 2) {
        const r = this.#bannerScale() * 420;
        const n = Math.min(3, this.gameApp.quality.params.lightning);
        for (let i = 0; i < n; i++) {
          const a = -Math.PI / 2 + (i - (n - 1) / 2) * 1.1 + fxRng.range(-0.2, 0.2);
          this.shots.bolt(this.addFx, cx + Math.cos(a) * r * 0.5, cy + Math.sin(a) * r * 0.3, cx + Math.cos(a) * r * 1.6, cy + Math.sin(a) * r * 1.1, { tint: 0x8f3dff });
        }
        fx.smokeRing('bwAdd', cx, cy, 2, { tint: 0x8f3dff, size: 700, alpha: 0.25 });
      }
    }, { raw: true });
    after.at(300, () => {
      this.#startStreams(level);
      const cr = this.counter.root;
      if (!reduced) tw.tween(300, (e) => cr.scale.set(punch(0.1)(e)));
    }, { raw: true });
    after.at(500, () => this.shine.run(this.banner, { duration: 700 }), { raw: true });
    after.play();
  }

  #startStreams(level, duration = Infinity) {
    this.#stopStreams();
    const L = LEVELS[level];
    const fx = this.particles;
    const q = this.gameApp.quality;
    const { w, h } = this.gameApp.layout;
    const rain = q.pick(L.rain);
    this.streams = [
      fx.coinRain('bwBack', rain * 0.8, duration, { width: w }),
      fx.coinRain('bwFront', rain * 0.2, duration, { width: w, front: true }),
    ];
    if (!this.gameApp.motion.reduced) this.streams.push(fx.coinFountain('bwBack', w / 2, h + 20, q.pick(L.fountain), duration));
    if (level >= 1 && !this.gameApp.motion.reduced) {
      // opad konfetti z góry po salwie (MEGA+: 30 / 15 / 6 na s)
      this.streams.push(fx.stream(q.pick([30, 15, 6]), duration, () => {
        const layer = fx.layers.bwFront;
        layer.spawn({
          x: fxRng.next() * w, y: -20, vx: fxRng.range(-40, 40), vy: fxRng.range(120, 260) * this.gameApp.layout.k, g: 60, drag: 0.4,
          life: fxRng.range(3, 4.5), s0: (fxRng.range(14, 30) * this.gameApp.layout.k) / 32, ph: fxRng.next() * 6, om: fxRng.range(4, 9),
          amp: fxRng.range(20, 50), rot: fxRng.next() * 6, vrot: fxRng.range(-4, 4), tint: fxRng.pick([0xffe08a, 0xff2e88, 0x21e6ff]),
          frame: `confetti${fxRng.int(0, 11)}`, kind: 3, prio: 2,
        });
      }));
    }
  }

  #stopStreams() {
    for (const s of this.streams ?? []) s?.stop();
    this.streams = [];
  }

  update(dt) {
    this.raysFx.update(dt);
    if (this.phase === 'idle' || this.gameApp.motion.reduced) return;
    // baner unosi się ± 4 px z okresem 2,4 s
    const t = this.gameApp.tweener.now;
    this.bannerHost.y = this.center.y + Math.sin((2 * Math.PI * t) / 2400) * 4 * this.gameApp.layout.k;
  }

  /** Po zmianie rozmiaru okna w trakcie sekwencji. */
  relayout() {
    if (this.phase === 'idle') return;
    this.#layout();
    this.curtain.width = this.gameApp.layout.w;
    this.curtain.height = this.gameApp.layout.h;
  }
}

