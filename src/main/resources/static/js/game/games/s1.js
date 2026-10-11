/**
 * game/games/s1.js — S1 „Cebulowy 777”: 3 bębny × 3 rzędy, 5 linii, retro Vegas + synthwave (brief § 2, 01 § 9).
 *
 * Co jest tutaj (reszta w BaseGame i systemach runtime):
 *   * scena: tło `s1_tlo_desktop` / `_mobile` (albo synthwave z kodu), ramka `s1_ramka` z oknem z `manifest.frames`
 *     (albo chromowano-neonowa z kodu), logo `s1_logo`, świecące rurki neonu, biegnące światła żarówek, słońce,
 *     impuls siatki, pył (04 § 6.1),
 *   * symbole `s1_sym_*` z wariantami (ruch1/ruch2/syl/glow/cien) albo rysowane w kodzie (s1-art.js),
 *   * zdarzenia S1: E21 intro, E22 bezczynność (brzęczenie neonu), E26 lądowanie, E27 antycypacja (2 WILD na linii,
 *     lista z pola `anticipation`), E33 WILD, E50 neonowy mnożnik ×2, E51 NEON JACKPOT, idiomy symboli przy wygranej.
 * Układ: „logo z boku” na szerokich ekranach (komputer, telefon poziomo) albo „logo nad automatem” (telefon pionowo) —
 * wybieramy ten, w którym pole symbolu wychodzi większe.
 */

import { BaseGame, TIER_ORDER } from '../base-game.js';
import { S1_TIMING } from '../reels/reelset.js';
import { canvasTexture, drawNeonText, ringContainer } from '../core/canvas-art.js';
import { easeOutCubic, easeOutBack, easeInOutSine, easeInOutCubic, easeInQuad, punch, spring } from '../core/easing.js';
import { fxRng } from '../core/random.js';
import { Timeline } from '../core/tween.js';
import { BACKGROUND } from '../fx/flash.js';
import { Rays } from '../fx/effects.js';
import { DigitText } from '../fx/digits.js';
import {
  S1_SYMBOL_CODES, drawS1Symbol, motionBlur, silhouette, softShape, drawS1Background, drawS1Frame, drawNeonTube, drawS1Logo, frameGeometry,
} from './s1-art.js';
import { formatSigned } from '../../format.js';

const PINK = 0xff2e88;
const CYAN = 0x21e6ff;
const GAP_RATIO = 0.05;

export const S1_CONFIG = Object.freeze({
  code: 'cebulowy-777',
  reels: 3,
  rows: 3,
  timing: S1_TIMING,
  engine: 'LINES',
  wildCode: 'wild',
  soundKey: 's1',                  // pakiet i tonacja dźwięków (05 § 2.4, § 2.6)
  music: 'mus_s1',
  reelLoop: 'sfx_beben_petla_s1',
  bgLuma: 0.08,                    // średnia jasność tła S1 (ciemne niebo synthwave) — podłoże dla strażnika błysków
  lineColors: [PINK, CYAN],        // linie nieparzyste magenta, parzyste cyjan (04 § 2.16)
  // wizualna taśma: niższe symbole częściej (wygląd prawdziwego automatu; wynik i tak przychodzi z serwera)
  fillerWeights: { wisnie: 7, cytryna: 7, sliwka: 6, arbuz: 5, dzwonek: 4, bar: 3, siodemka: 2, wild: 1 },
});

export class S1Game extends BaseGame {
  constructor(o) {
    super({ ...o, config: S1_CONFIG });
    this.neon = { outer: 0.55, inner: 0.55, logo: 1, base: 0.55, dip: { outer: 1, inner: 1, logo: 1 }, dimBeat: 1 };
    this.bulbSpeed = 0.6;
    this.bulbBoost = [];
    this.wildGlows = [];
    this.anticipating = null;
    this.idleTimer = 4000;
    this.logoShineTimer = 8000;
    this.gridTimer = 1500;
    this.lastNeonDip = -Infinity;
    this.tsec = 0;
    this.jackpotMode = false;
    /** Poziom winiety z kart zdarzeń (0,25 spoczynek, 0,55 antycypacja); część „upieczona” w tle nie jest rysowana drugi raz. */
    this.vigLevel = 0.25;
    this.vignetteBaked = false;
  }

  // =========================================================================================== zasoby

  imageRequests() {
    const r = [];
    for (const code of S1_SYMBOL_CODES) {
      const id = `s1_sym_${code}`;
      r.push({ id });
      for (const v of ['ruch1', 'ruch2', 'syl', 'glow', 'cien']) r.push({ id, variant: v });
    }
    const w = Math.max(screen.width, screen.height) * Math.min(2, window.devicePixelRatio || 1);
    r.push({ id: 's1_tlo_desktop', targetWidth: w }, { id: 's1_tlo_mobile', targetWidth: Math.min(screen.width, screen.height) * (window.devicePixelRatio || 1) });
    r.push({ id: 's1_ramka' }, { id: 's1_logo' }, { id: 's1_logo', variant: 'glow' });
    return r;
  }

  /** Rozdzielczość grafiki z kodu: pole w pikselach urządzenia (między 160 a 384 px). */
  #artSize() {
    const res = this.gameApp.renderer?.resolution ?? 1;
    const S = this.#estimateCell(this.gameApp.layout);
    return Math.max(160, Math.min(384, Math.round((S * res) / 16) * 16));
  }

  async buildViews(onProgress) {
    const R = this.resources;
    const { PIXI } = this;
    const size = this.#artSize();
    this.artSize = size;
    let i = 0;
    for (const code of S1_SYMBOL_CODES) {
      const id = `s1_sym_${code}`;
      const main = R.texture(id);
      if (main) {
        // grafika z manifestu: proporcje wariantów z wpisu (poświata i cień są większe od symbolu o margines)
        const e = R.entry(id) ?? {};
        const ratio = (v) => (e.variants?.[v]?.w && e.w ? e.variants[v].w / e.w : 1);
        this.views.set(code, {
          main, blur1: R.texture(id, 'ruch1'), blur2: R.texture(id, 'ruch2'), syl: R.texture(id, 'syl'),
          glow: R.texture(id, 'glow'), shadow: R.texture(id, 'cien'), scale: 1, glowScale: ratio('glow'), shadowScale: ratio('cien'),
        });
      } else {
        const c = drawS1Symbol(code, size);
        const glow = softShape(c, { pad: 0.15, blur: 0.07, passes: 2 });
        const shadow = softShape(c, { color: '#000000', pad: 0.1, blur: 0.04, passes: 1 });
        this.views.set(code, {
          main: canvasTexture(PIXI, c, { mipmap: true }),
          blur1: canvasTexture(PIXI, motionBlur(c, 0.06)),
          blur2: canvasTexture(PIXI, motionBlur(c, 0.12, 1.04)),
          syl: canvasTexture(PIXI, silhouette(c)),
          glow: canvasTexture(PIXI, glow),
          shadow: canvasTexture(PIXI, shadow),
          scale: 1, glowScale: glow.width / c.width, shadowScale: shadow.width / c.width, shadowTint: 0xffffff,
        });
        await new Promise((r) => requestAnimationFrame(r));
      }
      onProgress?.(++i / S1_SYMBOL_CODES.length);
    }
  }

  // =========================================================================================== scena

  buildScene() {
    const { PIXI } = this;
    const L = this.gameApp.layers;
    const R = this.resources;
    const tex = this.tex;
    // L0 tło + słońce + impuls siatki
    this.bg = new PIXI.Sprite();
    this.bg.anchor.set(0.5);
    L.bg.addChild(this.bg);
    this.sun = new PIXI.Sprite(tex.radial);
    this.sun.anchor.set(0.5);
    this.sun.blendMode = 'add';
    this.sun.tint = 0xff7a3d;
    this.gridPulse = new PIXI.Sprite(tex.band);
    this.gridPulse.anchor.set(0.5);
    this.gridPulse.blendMode = 'add';
    this.gridPulse.alpha = 0;
    L.bg.addChild(this.sun, this.gridPulse);
    // L2 podkład bębnów (01 § 6.6) i separatory
    this.under = new PIXI.Container();
    this.underFill = new PIXI.Sprite(PIXI.Texture.WHITE);
    this.underFill.tint = 0x0b0624;
    this.underGlow = new PIXI.Sprite(tex.radial);
    this.underGlow.anchor.set(0.5);
    this.underGlow.tint = 0x3a0ca3;
    this.underGlow.alpha = 0.55;
    this.separators = [0, 1].map(() => {
      const s = new PIXI.Sprite(tex.column);
      s.anchor.set(0.5, 0);
      s.tint = CYAN;
      s.alpha = 0.3;
      s.blendMode = 'add';
      return s;
    });
    this.under.addChild(this.underFill, this.underGlow, ...this.separators);
    L.under.addChild(this.under);
    this.wildGlowLayer = new PIXI.Container();
    L.under.addChild(this.wildGlowLayer);
    // L4 cieniowanie walca + smugi prędkości
    this.shadeTop = new PIXI.Sprite(tex.fade);
    this.shadeBottom = new PIXI.Sprite(tex.fade);
    this.shadeBottom.scale.y = -1;
    this.shadeTop.alpha = this.shadeBottom.alpha = 0.5;
    this.streaks = [];
    for (let i = 0; i < 6; i++) {
      const s = new PIXI.Sprite(tex.column);
      s.anchor.set(0.5, 0);
      s.blendMode = 'add';
      s.alpha = 0;
      this.streaks.push(s);
    }
    L.dim.addChild(this.shadeTop, this.shadeBottom, ...this.streaks);
    // L7 ramka, rurki neonu, żarówki
    this.frameTexture = R.texture('s1_ramka');
    this.frameWindow = this.frameTexture ? R.frameWindow('s1_ramka') ?? { x: 0.12, y: 0.14, w: 0.76, h: 0.72 } : null;
    // ramka i rurki jako „pierścienie” z 4 pasków (bez przezroczystego środka — mniej przerysowania)
    this.frameHost = new PIXI.Container();
    this.tubeOuter = new PIXI.Container();
    this.tubeInner = new PIXI.Container();
    this.tubeOuter.blendMode = 'add';
    this.tubeInner.blendMode = 'add';
    L.frame.addChild(this.frameHost, this.tubeOuter, this.tubeInner);
    this.bulbs = [];
    this.bulbLayer = new PIXI.Container();
    L.frame.addChild(this.bulbLayer);
    // L8 logo
    this.logo = new PIXI.Container();
    this.logoBase = new PIXI.Sprite();
    this.logoGlow = new PIXI.Sprite();
    this.logoBase.anchor.set(0.5);
    this.logoGlow.anchor.set(0.5);
    this.logoGlow.blendMode = 'add';
    this.logoRays = new Rays(this.gameApp, this.logo, tex.rays);
    this.logo.addChild(this.logoBase, this.logoGlow);
    L.logo.addChild(this.logo);
    // L10 / L11: słup światła antycypacji, reflektor, napisy z kodu
    this.column = new PIXI.Sprite(tex.column);
    this.column.anchor.set(0.5, 0);
    this.column.blendMode = 'add';
    this.column.tint = PINK;
    this.column.alpha = 0;
    L.fxAdd.addChild(this.column);
    this.spot = [0, 1].map(() => {
      const s = new PIXI.Sprite(PIXI.Texture.WHITE);
      s.tint = 0x07060f;
      s.alpha = 0;
      L.amounts.addChildAt(s, 0);
      return s;
    });
    this.landBands = Array.from({ length: 3 }, () => {
      const s = new PIXI.Sprite(tex.band);
      s.anchor.set(0.5);
      s.blendMode = 'add';
      s.alpha = 0;
      L.fxAdd.addChild(s);
      return s;
    });
    this.x2 = { sprite: new PIXI.Sprite(drawNeonText(PIXI, '×2', { size: 110 })), digits: new DigitText(this.digitFont, { height: 40, shade: this.tex.radial }) };
    this.x2.sprite.anchor.set(0.5);
    this.x2.sprite.visible = false;
    this.x2.digits.root.visible = false;
    L.amounts.addChild(this.x2.sprite, this.x2.digits.root);
    this.jackpotText = this.#buildJackpotText();
    L.bigwinFixed.addChildAt(this.jackpotText.root, 0);
    this.jpRays = new Rays(this.gameApp, L.fxAdd, tex.rays);
    this.#buildArt();
    // pył tła (P3): 60 / 30 / 0
    this.#spawnDust();
    this.gameApp.quality.addEventListener('change', () => this.#spawnDust());
    this.gameApp.motion.addEventListener('change', () => this.#applyMotion());
  }

  #spawnDust() {
    const layer = this.particles.layers.bg;
    layer.clear();
    const { w, h } = this.gameApp.layout;
    const n = this.gameApp.quality.pick([60, 30, 0]);
    if (n && !this.gameApp.motion.reduced) this.particles.dust('bg', n, { w, h });
  }

  #applyMotion() {
    this.#spawnDust();
    if (this.gameApp.motion.reduced) this.neon.dip = { outer: 1, inner: 1, logo: 1 };
  }

  /** Tekstury rysowane w kodzie dla bieżącego rozmiaru (ramka, rurki, logo, tło); obrazy z manifestu mają pierwszeństwo. */
  #buildArt() {
    const { PIXI } = this;
    const size = this.artSize;
    const gap = size * GAP_RATIO;
    this.frameHost.removeChildren().forEach((c) => c.destroy({ children: true }));
    if (this.frameTexture) {
      const t = this.frameTexture;
      const fw = this.frameWindow;
      this.frame = ringContainer(PIXI, t, { x: fw.x * t.width, y: fw.y * t.height, w: fw.w * t.width, h: fw.h * t.height });
    } else {
      const f = drawS1Frame(size, gap);
      this.procFrame = f;
      const g = f.geometry.win;
      this.frame = ringContainer(PIXI, canvasTexture(PIXI, f.canvas, { mipmap: true }), { x: g.x, y: g.y, w: g.w, h: g.h });
    }
    this.frameHost.addChild(this.frame);
    // świecące rurki (nad ramką z manifestu albo z kodu): dziura = okno (rurka wewnętrzna świeci 0,1 S w głąb okna)
    const geo = frameGeometry(size, gap);
    const tube = (inset, color, widthMul, host, holeInset) => {
      const t = drawNeonTube(size, gap, inset, color, widthMul);
      host.removeChildren().forEach((c) => c.destroy({ children: true }));
      const tex = canvasTexture(PIXI, t.canvas);
      host.addChild(ringContainer(PIXI, tex, { x: t.pad + geo.win.x + holeInset, y: t.pad + geo.win.y + holeInset, w: geo.win.w - 2 * holeInset, h: geo.win.h - 2 * holeInset }));
      return t.pad;
    };
    this.tubePad = tube(size * 0.2, '#FF2E88', 1, this.tubeOuter, -size * 0.04) / size;
    tube(size * 0.085, '#21E6FF', 0.85, this.tubeInner, size * 0.1);
    // logo
    const logoTex = this.resources.texture('s1_logo');
    if (logoTex) {
      this.logoBase.texture = logoTex;
      const g = this.resources.texture('s1_logo', 'glow');
      this.logoGlow.texture = g ?? PIXI.Texture.EMPTY;
      // wariant `glow` z manifestu ma logiczny rozmiar `w` (plik bywa zapisany w skali 0,5) — poświata POD logo
      this.logoGlowRatio = g ? (this.resources.entry('s1_logo')?.variants?.glow?.w ?? 1) / (this.resources.entry('s1_logo')?.w ?? 1) : 1;
      this.logo.setChildIndex(this.logoGlow, 0);
    } else {
      const lg = drawS1Logo(size * 3.2);
      this.logoBase.texture = canvasTexture(PIXI, lg.base, { mipmap: true });
      // płótno z kodu to „zapalone rurki” w tym samym kadrze co tablica — świeci NAD nią (migotanie, E21/E22)
      this.logoGlow.texture = canvasTexture(PIXI, lg.glow);
      this.logoGlowRatio = 1;
      this.logo.setChildIndex(this.logoGlow, this.logo.children.length - 1);
    }
    this.logoGlow.tint = 0xffffff;
    // żarówki grzebienia
    this.bulbs.forEach((b) => b.destroy());
    this.bulbs = [];
    const N = this.procFrame?.bulbs.length ?? 19;
    for (let i = 0; i < N; i++) {
      const b = new PIXI.Sprite(this.tex.bulb);
      b.anchor.set(0.5);
      b.blendMode = 'add';
      b.tint = 0xfff3d1;
      this.bulbLayer.addChild(b);
      this.bulbs.push(b);
      this.bulbBoost[i] = 0;
    }
  }

  /** Tło: obraz z manifestu (pion/poziom) albo synthwave z kodu narysowane dla bieżącego rozmiaru ekranu. */
  #buildBackground(lay, geo) {
    const R = this.resources;
    const id = lay.portrait && R.has('s1_tlo_mobile') ? 's1_tlo_mobile' : 's1_tlo_desktop';
    const t = R.texture(id) ?? R.texture('s1_tlo_desktop');
    if (t) {
      this.bg.texture = t;
      this.vignetteBaked = false;
      return;
    }
    this.vignetteBaked = true;      // winieta 0,25 jest narysowana w tle z kodu — sprite tylko, gdy potrzeba więcej
    const res = Math.min(1.5, this.gameApp.renderer.resolution);
    const scale = Math.min(res, 2560 / Math.max(lay.w, lay.h));
    const w = Math.round(lay.w * 1.04 * scale);
    const h = Math.round(lay.h * 1.04 * scale);
    const key = `${w}x${h}`;
    if (this.bgKey === key) return;
    this.bgKey = key;
    const horizon = lay.portrait ? 0.6 : 0.52;
    const sunR = geo.frameW * 0.62 * scale;
    const c = drawS1Background(w, h, { horizon, sunX: (geo.frameCX / lay.w) * 0.96 + 0.02, sunY: geo.frameY * scale + sunR * 0.55, sunR });
    this.bg.texture?.destroy(true);
    this.bg.texture = canvasTexture(this.PIXI, c);
  }

  // =========================================================================================== układ

  /** Szacunek pola przed zbudowaniem sceny (do rozdzielczości grafiki z kodu). */
  #estimateCell(lay) {
    return this.#computeLayout(lay).cell;
  }

  /** Geometria ramki dla pola S (ramka z manifestu: okno z frames.window; z kodu: frameGeometry). */
  #frameModel(S) {
    const gap = S * GAP_RATIO;
    const winW = 3 * S + 2 * gap;
    const winH = 3 * S;
    if (this.frameWindow) {
      const fw = winW / this.frameWindow.w;
      const fh = winH / this.frameWindow.h;
      return { W: fw, H: fh, winX: fw * this.frameWindow.x, winY: fh * this.frameWindow.y, gap };
    }
    const g = frameGeometry(S, gap);
    return { W: g.W, H: g.H, winX: g.win.x, winY: g.win.y, gap };
  }

  /**
   * Dwa układy: logo z boku (szeroki ekran) albo nad automatem (pion). Wybieramy ten z większym polem symbolu.
   * Margines 3% — tło jest skalowane z zapasem na drżenie (04 § 2.5).
   */
  #computeLayout(lay) {
    const { w, h, portrait } = lay;
    const m = Math.max(8, Math.min(w, h) * 0.03);
    const W = w - 2 * m;
    const H = h - 2 * m;
    const unit = this.#frameModel(100);
    const fw = unit.W / 100;
    const fh = unit.H / 100;
    const logoAspect = 0.42;
    // A: logo z boku — szerokość logo 2,3 S w lewym marginesie; ramka na środku
    const sideW = 2.3;
    const sA = Math.min(H / fh, W / (fw + 2 * (sideW + 0.2)));
    // B: logo nad ramką — szerokość 2,7 S, nachodzi 0,28 S na grzebień
    const topW = 2.7;
    const sB = Math.min(W / Math.max(fw, topW), H / (fh + topW * logoAspect - 0.28));
    const side = !portrait && sA >= sB * 1.04;
    const S = Math.floor(side ? sA : sB);
    const fm = this.#frameModel(S);
    const cx = w / 2;
    let frameY;
    let logo;
    if (side) {
      frameY = (h - fm.H) / 2;
      const free = (w - fm.W) / 2;
      const lw = Math.min(free * 0.86, S * sideW * 1.1);
      logo = { x: free / 2, y: h * 0.45, w: lw };
    } else {
      const lw = S * topW;
      const lh = lw * logoAspect;
      const total = fm.H + lh - 0.28 * S;
      const top = (h - total) / 2;
      frameY = top + lh - 0.28 * S;
      logo = { x: cx, y: top + lh / 2, w: lw };
    }
    const frameX = cx - fm.W / 2;
    return {
      cell: S, gap: fm.gap, side, logo, frameX, frameY, frameW: fm.W, frameH: fm.H, frameCX: cx,
      winX: frameX + fm.winX, winY: frameY + fm.winY, winW: 3 * S + 2 * fm.gap, winH: 3 * S,
    };
  }

  layoutScene(lay) {
    const g = this.#computeLayout(lay);
    this.geo = g;
    const S = g.cell;
    // tło: „cover” z zapasem 4% (drżenie nie odsłania krawędzi)
    this.#buildBackground(lay, g);
    const bt = this.bg.texture;
    if (bt && bt.width > 1) {
      const s = Math.max(lay.w / bt.width, lay.h / bt.height) * 1.04;
      this.bg.scale.set(s);
    }
    this.bg.position.set(lay.w / 2, lay.h / 2);
    this.bgBaseScale = this.bg.scale.x;
    // słońce i siatka
    this.sun.position.set(g.frameCX, g.frameY + g.frameH * 0.08);
    this.sun.width = this.sun.height = g.frameW * 1.7;
    this.horizonY = lay.h * (lay.portrait ? 0.6 : 0.52);
    // podkład
    this.underFill.position.set(g.winX - g.gap, g.winY);
    this.underFill.width = g.winW + 2 * g.gap;
    this.underFill.height = g.winH;
    this.underGlow.position.set(g.winX + g.winW / 2, g.winY + g.winH / 2);
    this.underGlow.width = g.winW * 1.3;
    this.underGlow.height = g.winH * 1.1;
    this.separators.forEach((s, i) => {
      s.position.set(g.winX + (i + 1) * S + (i + 0.5) * g.gap, g.winY);
      s.width = Math.max(2, g.gap * 0.5);
      s.height = g.winH;
    });
    this.shadeTop.position.set(g.winX - g.gap, g.winY);
    this.shadeTop.width = g.winW + 2 * g.gap;
    this.shadeTop.height = S * 0.35;
    this.shadeBottom.position.set(g.winX - g.gap, g.winY + g.winH);
    this.shadeBottom.width = g.winW + 2 * g.gap;
    this.shadeBottom.height = S * 0.35;
    this.streaks.forEach((s, i) => {
      const reel = Math.floor(i / 2);
      s.position.set(g.winX + reel * (S + g.gap) + (i % 2 ? S * 0.96 : S * 0.04), g.winY);
      s.width = S * 0.06;
      s.height = g.winH;
    });
    // ramka (pierścień z 4 pasków — skala według szerokości tekstury)
    this.frame.position.set(g.frameX, g.frameY);
    this.frame.scale.set(g.frameW / this.frame.textureWidth, g.frameH / this.frame.textureHeight);
    const k = S / this.artSize;
    for (const t of [this.tubeOuter, this.tubeInner]) {
      t.scale.set(k);
      t.position.set(g.winX - (this.procFrame?.geometry.win.x ?? this.artSize * 0.3) * k - this.tubePad * S, g.winY - (this.procFrame?.geometry.win.y ?? this.artSize * 0.62) * k - this.tubePad * S);
    }
    // żarówki: pozycje z ramki z kodu albo łuk nad oknem (ramka z manifestu)
    this.bulbs.forEach((b, i) => {
      const n = this.bulbs.length;
      if (this.procFrame && !this.frameTexture) {
        const p = this.procFrame.bulbs[i];
        b.position.set(g.frameX + p.x * g.frameW, g.frameY + p.y * g.frameH);
      } else {
        const t = (i + 0.5) / n;
        b.position.set(g.winX + t * g.winW, g.winY - S * 0.32 - Math.sin(Math.PI * t) * S * 0.12);
      }
      b.width = b.height = S * 0.16;
    });
    // logo
    this.logo.position.set(g.logo.x, g.logo.y);
    const lt = this.logoBase.texture;
    const ls = g.logo.w / Math.max(1, lt.width);
    this.logoBase.scale.set(ls);
    // rozmiar poświaty liczony od rozmiaru logo na ekranie, nie od pikseli pliku poświaty
    this.logoGlow.scale.set((lt.width * ls * (this.logoGlowRatio ?? 1)) / Math.max(1, this.logoGlow.texture.width));
    this.logoScale = ls;
    // antycypacja / napisy
    this.column.height = g.winH;
    this.column.width = S * 1.1;
    this.jackpotText.layout(lay, g);
    // dynamiczna rozdzielczość grafiki z kodu: przerysowanie, gdy pole urosło o > 35% (tylko między rundami)
    const need = Math.round((S * (this.gameApp.renderer?.resolution ?? 1)) / 16) * 16;
    if (need > this.artSize * 1.35 && this.artSize < 384) this.pendingArt = true;
    return { x: g.winX, y: g.winY, cell: S, gap: g.gap };
  }

  // =========================================================================================== pętla (E22 i otoczenie)

  update(dt) {
    const ga = this.gameApp;
    const reduced = ga.motion.reduced;
    const q = ga.quality.params;
    const sec = dt / 1000;
    this.tsec += sec;
    const t = this.tsec;
    // winieta: pełnoekranowy sprite tylko ponad poziom narysowany w tle (alfa 0 = Pixi go pomija)
    this.vignette.alpha = this.vignetteBaked ? Math.max(0, this.vigLevel - 0.25) * 1.3 : this.vigLevel;
    // słońce „oddycha” (okres 8 s)
    this.sun.alpha = q.bgFx === 0 ? 0 : reduced ? 0.2 : 0.2 + 0.05 * Math.sin((2 * Math.PI * t) / 8);
    // impuls siatki co 4 s (High/Medium)
    if (q.bgFx > 0 && !reduced) this.#gridPulse(dt);
    // biegnące światła żarówek: b_i = 0,55 + 0,45·max(0, cos(2π(i/N − v·t)))⁴ (04 § 6.1); RM: stała 0,8
    const N = this.bulbs.length;
    this.bulbPhase = (this.bulbPhase ?? 0) + this.bulbSpeed * sec;
    for (let i = 0; i < N; i++) {
      let b;
      if (reduced) b = 0.8;
      else if (this.jackpotMode) b = ((i + Math.floor(t * 2)) % 2 === 0 ? 1 : 0.35);
      else b = 0.55 + 0.45 * Math.max(0, Math.cos(2 * Math.PI * (i / N - this.bulbPhase))) ** 4;
      this.bulbBoost[i] = Math.max(0, (this.bulbBoost[i] ?? 0) - sec / 0.2);
      this.bulbs[i].alpha = Math.min(1, b * this.neon.dimBeat + this.bulbBoost[i] * 0.45) * 0.95;
    }
    // neony: jasność bazowa × przygaszenia „brzęczenia” × ciemny takt
    this.#neonFlicker(dt);
    this.tubeOuter.alpha = this.neon.outer * this.neon.dip.outer * this.neon.dimBeat;
    this.tubeInner.alpha = this.neon.inner * this.neon.dip.inner * this.neon.dimBeat;
    this.logoGlow.alpha = this.neon.logo * this.neon.dip.logo;
    this.logoRays.update(dt);
    this.jpRays.update(dt);
    // poświata WILD na planszy (od lądowania do następnego spinu): magenta ↔ cyjan, okres 2400 ms
    for (const g of this.wildGlows) {
      const ph = (2 * Math.PI * t) / 1.2;
      g.sprite.alpha = reduced ? 0.5 * g.fade : (0.35 + 0.35 * (0.5 + 0.5 * Math.sin(ph))) * g.fade;
      g.sprite.scale.set(g.base * (reduced ? 1 : 1 + 0.03 * (0.5 + 0.5 * Math.sin(ph))));
      const mix = 0.5 + 0.5 * Math.sin((2 * Math.PI * t) / 2.4);
      g.sprite.tint = mixColor(PINK, CYAN, mix);
      if (q.index === 0 && !reduced && fxRng.next() < 3 * sec) {
        this.particles.twinkles('fxAdd', g.sprite.x, g.sprite.y, this.geo.cell * 0.5, this.geo.cell * 0.5, 1, { tint: mix > 0.5 ? CYAN : PINK });
      }
    }
    // antycypacja: bicie serca WILD-ów (100 BPM, „lub-dub”), drżenie ± 2 px, rosnąca podłoga traumy
    if (this.anticipating) this.#anticipationTick(dt);
    // smugi prędkości tylko w trakcie obrotu (Low: brak)
    const spinning = this.reels.spinning;
    for (const s of this.streaks) s.alpha = spinning && q.index < 2 && !reduced ? 0.08 : 0;
    // E22 bezczynność: co 3–5 s połysk losowego symbolu, co 8 s połysk logo
    if (this.idle && !this.reels.spinning && !this.bigwin.active) this.#idleTick(dt);
  }

  #gridPulse(dt) {
    this.gridTimer -= dt;
    const gp = this.gridPulse;
    if (this.gridTimer <= 0 && !gp.active) {
      gp.active = true;
      gp.t = 0;
      this.gridTimer = 4000;
    }
    if (!gp.active) return;
    gp.t += dt;
    const u = Math.min(1, gp.t / 2200);
    const { w, h } = this.gameApp.layout;
    const e = easeInQuad(u);
    const y0 = this.horizonY;
    gp.position.set(w / 2, y0 + (h * 0.8 - y0) * e);
    gp.width = w * (0.4 + 1.0 * e);
    gp.height = Math.max(6, 18 * this.gameApp.layout.k * (0.5 + e));
    gp.tint = mixColor(0x2b6bff, PINK, e);
    gp.alpha = 0.35 * Math.sin(Math.PI * u);
    if (u >= 1) {
      gp.active = false;
      gp.alpha = 0;
    }
  }

  /**
   * „Brzęczenie” neonu (04 § 6.1): losowe przygaszenia do 60% na 40–80 ms, proces Poissona λ = 0,12/s na element,
   * łącznie najwyżej 1 na sekundę. Logo jest duże — jego przygaszenie idzie przez strażnika błysków. RM: brak.
   */
  #neonFlicker(dt) {
    const ga = this.gameApp;
    if (ga.motion.reduced || this.neonIntro) return;
    const now = ga.tweener.now;
    for (const key of ['outer', 'inner', 'logo']) {
      if (now - this.lastNeonDip < 1000) break;
      if (fxRng.next() >= 0.12 * (dt / 1000)) continue;
      if (key === 'logo') {
        const b = this.logo.getBounds();
        const area = (b.width * b.height * 0.5) / (ga.layout.w * ga.layout.h);
        const res = this.governor.request('neon', { area, alpha: 0.3 });
        if (res.decision !== 'full' && res.decision !== 'free' && res.decision !== 'absorbed') continue;
      }
      this.lastNeonDip = now;
      const ms = fxRng.range(40, 80);
      this.neon.dip[key] = 0.6;
      ga.tweener.wait(ms).then(() => { this.neon.dip[key] = 1; });
      this.audio.play('sfx_s1_neon_bzyk', { volume: 0.25, detune: fxRng.range(-80, 80) });
    }
  }

  #idleTick(dt) {
    const reduced = this.gameApp.motion.reduced;
    if (reduced) return;
    this.logoShineTimer -= dt;
    if (this.logoShineTimer <= 0) {
      this.logoShineTimer = 8000;
      this.shine.run(this.logoBase, { duration: 700, strength: 0.7 });
    }
    if (this.cycleToken && !this.cycleToken.skipped) return;   // po wygranej trwa pętla linii zamiast połysków
    this.idleTimer -= dt;
    if (this.idleTimer > 0) return;
    this.idleTimer = 3000 + fxRng.next() * 2000;
    const reel = fxRng.int(0, 2);
    const row = fxRng.int(0, 2);
    if (reel === this.lastIdle?.[0] && row === this.lastIdle?.[1]) return;
    this.lastIdle = [reel, row];
    const s = this.reels.slotAt(reel, row);
    if (!s) return;
    this.shine.run(s.main, { duration: 550, silhouette: null, strength: 0.6 });
    const c = this.reels.cellCenter(reel, row);
    this.particles.twinkles('fxAdd', c.x, c.y, this.geo.cell * 0.4, this.geo.cell * 0.4, 4, { tint: 0xfff3d1 });
  }

  // =========================================================================================== E21 intro

  /** E21: automat wjeżdża na scenę; obietnica kończy się w 1000 ms (SPIN aktywny — R7), reszta osi gra dalej. */
  async intro() {
    const ga = this.gameApp;
    const tw = ga.tweener;
    const reduced = ga.motion.reduced;
    const L = ga.layers;
    const k = ga.layout.k;
    this.audio.intro();
    if (reduced) {
      for (const layer of [L.bg, L.under, L.reels, L.frame, L.logo]) {
        layer.alpha = 0;
        tw.to(layer, { alpha: 1 }, { duration: 500 });
      }
      this.neon.outer = this.neon.inner = this.neon.base;
      this.audio.play('sfx_s1_neon_bzyk', { volume: 0.5 });
      return tw.wait(500);
    }
    this.neonIntro = true;
    this.neon.outer = this.neon.inner = 0;
    this.neon.logo = 0;
    const bgS = this.bgBaseScale;
    tw.tween(900, (e) => this.bg.scale.set(bgS * (1.06 - 0.06 * e)), { ease: easeOutCubic });
    const tl = new Timeline(tw);
    L.frame.alpha = 0;
    L.logo.alpha = 0;
    L.reels.alpha = 0;
    L.under.alpha = 0;
    tl.at(150, () => {
      const y0 = L.frame.y;
      tw.tween(500, (e) => { L.frame.alpha = Math.min(1, e * 1.6); L.under.alpha = L.frame.alpha; L.frame.y = y0 + 40 * k * (1 - e); }, { ease: easeOutBack(1.2) });
    });
    tl.at(250, () => {
      L.reels.alpha = 1;
      this.reels.reels.forEach((r, i) => {
        const y = r.container.y;
        r.container.y = y - this.geo.cell;
        tw.to(r.container, { y }, { duration: 240, ease: easeOutBack(1.7), delay: i * 70 });
      });
    });
    tl.at(450, () => {
      L.logo.alpha = 1;
      const s = this.logo.scale.x || 1;
      tw.tween(500, (e) => this.logo.scale.set(s * (e < 0.6 ? 0.6 + 0.48 * easeOutCubic(e / 0.6) : 1.08 - 0.08 * easeInOutSine((e - 0.6) / 0.4))));
      this.logoRays.show({ x: 0, y: 0, size: (this.logoBase.texture.width * this.logoScale) * 1.8, omega: 4, alpha: 0.4, tintA: PINK, tintB: CYAN });
      tw.wait(1200).then(() => this.logoRays.hide(500));
      this.shots.flare(L.fxAdd, this.logo.x, this.logo.y, 500 * k, 0xffe9f4);
      this.audio.play('sfx_s1_neon_bzyk');
      this.#ignite((v) => { this.neon.logo = v; }, 1, 'neon-logo');
    });
    tl.at(500, () => {
      this.#ignite((v) => { this.neon.outer = v; this.neon.inner = v; }, this.neon.base, 'neon-rurki');
      // mgła przyziemna: 3 kłęby przy dolnej krawędzi ramki (High 3, Medium 2, Low 0)
      const n = ga.quality.pick([3, 2, 0]);
      for (let i = 0; i < n; i++) {
        const x = this.geo.frameX + this.geo.frameW * (0.2 + 0.3 * i);
        this.particles.layers.fxAdd.spawn({
          x, y: this.geo.frameY + this.geo.frameH * 0.95, vx: fxRng.range(-20, 20) * k, life: 3, s0: (500 * k) / 128, s1: (700 * k) / 128,
          alpha: 0.18, tint: 0xc9c3e6, frame: 'smoke', kind: 4, prio: 2,
        });
      }
    });
    tl.at(700, () => this.shine.run(this.logoBase, { duration: 700 }));
    tl.at(1600, () => { this.neonIntro = false; });
    tl.play();
    return tw.wait(1000);
  }

  /** Sekwencja zapalania neonu (04 § 6.1): 30 ms wł. → 80 ms wył. → 40 ms wł. → 120 ms wył. → stałe świecenie. */
  #ignite(set, level, name) {
    const tw = this.gameApp.tweener;
    const res = this.governor.request(name, { area: 0.05, alpha: 0.35 });
    if (res.decision === 'soft' || !res.ok) {
      tw.tween(300, (e) => set(level * e));
      return;
    }
    const seq = [[0, 1], [30, 0.1], [110, 1], [150, 0.1], [270, 1]];
    for (const [t, v] of seq) tw.wait(t).then(() => set(level * v));
  }

  // =========================================================================================== E24–E27, E33

  onSpinStart() {
    // E24: biegnące światła × 3 przez 600 ms, potem prędkość obrotu 1,5 okrążenia/s
    this.#removeWildGlows();
    this.bulbSpeed = 4.5;
    this.gameApp.tweener.wait(600).then(() => { if (this.reels.spinning) this.bulbSpeed = 1.5; });
    this.neon.outer = this.neon.inner = this.neon.base;
    this.jackpotText.hide();
    this.jpRays.hide(200);
    this.jackpotMode = false;
  }

  onReelStop(detail) {
    super.onReelStop(detail);
    const { reel, last, codes } = detail;
    const ga = this.gameApp;
    const tw = ga.tweener;
    const reduced = ga.motion.reduced;
    const S = this.geo.cell;
    if (last) this.bulbSpeed = 0.6;
    // E26: żarówki nad bębnem rozbłyskują, pas połysku w dół kolumny (90 ms), podbicie okna bębna 2 px
    const cx = this.geo.winX + reel * (S + this.geo.gap) + S / 2;
    this.bulbs.forEach((b, i) => { if (Math.abs(b.x - cx) < S * 0.6) this.bulbBoost[i] = 1; });
    if (!reduced) {
      const band = this.landBands[reel];
      band.width = S * 1.05;
      band.height = S * 0.15;
      band.alpha = 0.35;
      tw.tween(90, (e) => { band.position.set(cx, this.geo.winY + e * this.geo.winH); band.alpha = 0.35 * (1 - e * 0.6); }, { onComplete: () => { band.alpha = 0; } });
      if (ga.quality.params.index < 2) {
        const c = this.reels.reels[reel].container;
        const y0 = this.geo.winY;
        tw.tween(120, (_e, u) => { c.y = y0 + 2 * ga.layout.k * 1.5 * Math.sin(Math.PI * u) * (1 - u * 0.3); }, { onComplete: () => { c.y = y0; } });
      }
    }
    // E33: WILD ląduje
    const wildRows = (codes ?? []).map((c, row) => (c === 'wild' ? row : -1)).filter((r) => r >= 0);
    for (const row of wildRows) this.#wildLanding(reel, row, last);
    // koniec antycypacji tego bębna
    if (this.anticipating?.reel === reel) this.#endAnticipation(wildRows.length > 0);
    if (last) this.ui.haptic?.('H_lekki');
  }

  #wildLanding(reel, row, last) {
    const ga = this.gameApp;
    const reduced = ga.motion.reduced;
    const S = this.geo.cell;
    const c = this.reels.cellCenter(reel, row);
    const slot = this.reels.slotAt(reel, row);
    this.ui.haptic?.('H_sredni');
    if (!reduced && slot) {
      // błysk lokalny `syl` (alfa 0,8, 40 + 80 ms) przez strażnika — podłoże: złoty symbol
      const { w, h } = ga.layout;
      const res = this.governor.request('wild', { area: (S * S) / (w * h), alpha: 0.8, background: BACKGROUND.symbol });
      const view = this.views.get('wild');
      if (res.ok && view?.syl) {
        const syl = new this.PIXI.Sprite(view.syl);
        syl.anchor.set(0.5);
        syl.blendMode = 'add';
        syl.scale.copyFrom(slot.main.scale);
        syl.position.copyFrom(slot.main.position);
        slot.body.addChild(syl);
        const attack = res.decision === 'soft' ? 150 : 40;
        ga.tweener.tween(attack + 80, (_e, u) => {
          const t = u * (attack + 80);
          syl.alpha = res.alpha * (t < attack ? t / attack : 1 - (t - attack) / 80);
        }, { onComplete: () => syl.destroy() });
      }
      this.shots.flare(ga.layers.fxAdd, c.x, c.y, S * 1.6, PINK);
      if (ga.quality.params.index < 2) this.shots.ring(ga.layers.fxAdd, c.x, c.y, 200 * ga.layout.k, CYAN);
      this.particles.sparks('fxAdd', c.x, c.y, this.particles.count([16, 10, 4]), { tints: [PINK, CYAN], speed: [300, 900] });
      if (last) this.camera.kick(3);      // kopnięcie w dół 3 px · k (04 § 2.5) — ostatni stop „siada” cięższy
    }
    // poświata WILD od 120 ms do następnego spinu (RM: narasta w 300 ms)
    ga.tweener.wait(reduced ? 0 : 120).then(() => this.#addWildGlow(reel, row, reduced ? 300 : 150));
  }

  #addWildGlow(reel, row, fadeMs) {
    const view = this.views.get('wild');
    if (!view?.glow || !this.reels) return;
    const s = new this.PIXI.Sprite(view.glow);
    s.anchor.set(0.5);
    s.blendMode = 'add';
    this.wildGlowLayer.addChild(s);
    const g = { sprite: s, base: 1, fade: 0, reel, row };
    this.#placeWildGlow(g);
    this.wildGlows.push(g);
    this.gameApp.tweener.tween(fadeMs, (e) => { g.fade = e; });
  }

  /** Pozycja i skala poświaty WILD z bieżącej geometrii (także po obrocie telefonu). */
  #placeWildGlow(g) {
    const view = this.views.get('wild');
    const c = this.reels.cellCenter(g.reel, g.row);
    g.sprite.position.set(c.x, c.y);
    g.base = (this.reels.cell * (view.glowScale ?? 1.3)) / view.glow.width;
    g.sprite.scale.set(g.base);
  }

  afterLayout() {
    for (const g of this.wildGlows) this.#placeWildGlow(g);
  }

  #removeWildGlows() {
    for (const g of this.wildGlows) g.sprite.destroy();
    this.wildGlows = [];
  }

  /**
   * E27 antycypacja: bęben z listy `anticipation` (S1: 3. bęben przy 2 WILD na linii) — winieta, reflektor, słup
   * światła, bicie serca WILD-ów, pioruny wzdłuż bębna, rosnąca podłoga traumy, zoom w stronę bębna, dźwięki napięcia.
   */
  onAnticipation({ reel, until }) {
    const ga = this.gameApp;
    const tw = ga.tweener;
    const duration = Math.max(300, until - this.reels.time);
    const S = this.geo.cell;
    const cx = this.geo.winX + reel * (S + this.geo.gap) + S / 2;
    this.anticipating = { reel, start: tw.now, duration, nextBolt: 300, cx };
    this.audio.anticipationStart(duration);
    tw.to(this, { vigLevel: 0.55 }, { duration: 400 });
    // reflektor: ciemne prostokąty po bokach aktywnego bębna (04 § 2.18)
    const g = this.geo;
    const left = this.spot[0];
    const right = this.spot[1];
    left.position.set(g.winX - g.gap, g.winY);
    left.width = Math.max(0, cx - S / 2 - (g.winX - g.gap));
    left.height = g.winH;
    right.position.set(cx + S / 2, g.winY);
    right.width = Math.max(0, g.winX + g.winW + g.gap - (cx + S / 2));
    right.height = g.winH;
    for (const s of this.spot) tw.to(s, { alpha: 0.35 }, { duration: 250 });
    this.column.position.set(cx, g.winY);
    tw.to(this.column, { alpha: 0.45 }, { duration: 300 });
    this.antStream = this.particles.stream(this.particles.count([20, 12, 4]), duration, () => {
      this.particles.layers.fxAdd.spawn({
        x: cx + fxRng.range(-0.4, 0.4) * S, y: g.winY + g.winH * fxRng.range(0.3, 1), vy: -fxRng.range(60, 160) * ga.layout.k,
        life: fxRng.range(0.4, 0.8), s0: (fxRng.range(12, 24) * ga.layout.k) / 64, tint: PINK, frame: 'iskra0', kind: 1, prio: 2,
      });
    });
    this.camera.focus = { x: cx, y: g.winY + g.winH / 2 };
  }

  #anticipationTick(dt) {
    const a = this.anticipating;
    const ga = this.gameApp;
    const reduced = ga.motion.reduced;
    const el = ga.tweener.now - a.start;
    const u = Math.min(1, el / a.duration);
    // podłoga traumy 0,15 → 0,30 (04 § 2.5) i zoom 1,00 → 1,03
    this.camera.setFloor(0.15 + 0.15 * u);
    if (!reduced) this.camera.zoom = 1 + 0.03 * easeInOutSine(u);
    // bicie serca 100 BPM (okres 600 ms): 1,0 → 1,08 (90 ms) → 1,0 (220 ms) + słabsze 1,04 po 180 ms
    const ph = (el % 600) / 600 * 600;
    let beat = 1;
    if (!reduced) {
      if (ph < 90) beat = 1 + 0.08 * (ph / 90);
      else if (ph < 310) beat = 1.08 - 0.08 * ((ph - 90) / 220);
      if (ph >= 180 && ph < 300) beat += 0.04 * Math.sin(Math.PI * ((ph - 180) / 120));
    }
    for (const r of this.reels.reels) {
      if (r.state !== 'idle' && r.state !== 'settle') continue;
      for (const s of this.reels.visibleSlots(r.index)) {
        if (s.code !== 'wild') continue;
        s.root.scale.set(beat);
        if (!reduced && ga.quality.params.shake) s.root.x = this.geo.cell / 2 + Math.sin(el * 0.113) * 2 * ga.layout.k;
      }
    }
    for (const g of this.wildGlows) g.fade = 0.6 + 0.4 * (beat - 1) / 0.08;
    // pioruny wzdłuż krawędzi bębna co 450–700 ms (Low: 1, co ≥ 700 ms; RM: brak)
    a.nextBolt -= dt;
    if (a.nextBolt <= 0 && !reduced) {
      a.nextBolt = ga.quality.params.index === 2 ? 700 + fxRng.next() * 300 : 450 + fxRng.next() * 250;
      const side = fxRng.sign() * this.geo.cell * 0.5;
      this.shots.bolt(ga.layers.fxAdd, a.cx + side, this.geo.winY, a.cx + side * 0.9, this.geo.winY + this.geo.winH, { tint: 0x9fd8ff, width: 0.7 });
    }
  }

  #endAnticipation(success) {
    const a = this.anticipating;
    if (!a) return;
    this.anticipating = null;
    const tw = this.gameApp.tweener;
    this.audio.anticipationEnd(success);
    this.antStream?.stop();
    this.camera.setFloor(0);
    tw.tween(success ? 300 : 400, (e) => { this.camera.zoom = 1 + (this.camera.zoom - 1) * (1 - e); }, { onComplete: () => { this.camera.zoom = 1; this.camera.focus = null; } });
    tw.to(this, { vigLevel: 0.25 }, { duration: 400 });
    tw.to(this.column, { alpha: 0 }, { duration: 300 });
    for (const s of this.spot) tw.to(s, { alpha: 0 }, { duration: 300 });
    for (const r of this.reels.reels) for (const s of r.slots) { s.root.scale.set(1); s.root.x = this.geo.cell / 2; }
    if (!success) {
      // „fizzle”: iskry opadają w dół z grawitacją
      this.particles.sparks('fxAdd', a.cx, this.geo.winY + this.geo.winH * 0.3, this.particles.count([10, 6, 2]), { tint: PINK, angle: Math.PI / 2, spread: 1.2, speed: [80, 220], gravity: 900 });
    }
  }

  onAnticipationEnd() {
    if (this.anticipating) this.#endAnticipation(false);
  }

  // =========================================================================================== wygrane: idiomy, E50

  /** Idiomy symboli przy wygranej (04 § 6.1), nakładane na wspólny puls. */
  symbolIdiom(slot, code) {
    const tw = this.gameApp.tweener;
    const b = slot.body;
    const S = this.geo.cell;
    switch (code) {
      case 'wisnie': // wahadło ± 6° z punktem obrotu u szczytu szypułki, 2 wahnięcia w 600 ms
        tw.tween(600, (_e, u) => { b.rotation = (6 * Math.PI / 180) * Math.sin(u * 4 * Math.PI) * (1 - u); }, { onComplete: () => { b.rotation = 0; } });
        break;
      case 'cytryna': // podwójny squash 0,90 / 1,10
        tw.tween(400, (_e, u) => { const s = Math.sin(u * 2 * Math.PI); b.scale.set(1 + 0.1 * s * (1 - u * 0.5), 1 - 0.1 * s * (1 - u * 0.5)); }, { onComplete: () => b.scale.set(1) });
        break;
      case 'arbuz': // podskok o 8 px z lądowaniem squash
        tw.tween(420, (_e, u) => {
          b.y = S / 2 - 8 * this.gameApp.layout.k * 1.6 * Math.sin(Math.PI * Math.min(1, u / 0.7));
          if (u > 0.7) { const q = (u - 0.7) / 0.3; b.scale.set(1 + 0.06 * Math.sin(Math.PI * q), 1 - 0.08 * Math.sin(Math.PI * q)); }
        }, { onComplete: () => { b.y = S / 2; b.scale.set(1); } });
        break;
      case 'dzwonek': // kołysanie ± 12°, sprężyna (ζ 0,25; 3 Hz)
        tw.tween(900, (_e, u) => { b.rotation = (12 * Math.PI / 180) * (1 - spring(0.25, 3, u * 0.9)) * -1; }, { onComplete: () => { b.rotation = 0; } });
        break;
      case 'bar': // szybki chromowy połysk (300 ms)
        this.shine.run(slot.main, { duration: 300 });
        break;
      case 'siodemka': { // dwie gwiazdki w rogach
        const c = slot.root.position;
        for (const [dx, dy] of [[-0.32, -0.32], [0.32, 0.3]]) this.particles.twinkles('fxAdd', c.x + dx * S, c.y + dy * S, 2, 2, 1, { tint: 0xffffff, size: [28, 40], life: [500, 700], prio: 1 });
        break;
      }
      default:
    }
  }

  /**
   * E50 „Neonowy mnożnik” — linia z `wildMultiplier: 2`: WILD pulsuje, nad nim zapala się „×2”, piorun do kwoty linii,
   * kwota „+200” → „+400” (dzielimy przez 2 tylko do animacji; wartość końcowa pochodzi z serwera).
   */
  async onLinePresented(win, line, ctx) {
    if (win.wildMultiplier !== 2) return;
    this.stats.wildMultipliers += 1;
    const ga = this.gameApp;
    const tw = ga.tweener;
    const reduced = ga.motion.reduced;
    const S = this.geo.cell;
    const wildPos = (win.positions ?? []).find(([r, row]) => this.currentGrid?.[r]?.[row] === 'wild') ?? win.positions?.[1];
    if (!wildPos) return;
    const wc = this.reels.cellCenter(wildPos[0], wildPos[1]);
    const slot = this.presentation?.lifted.find((l) => l.r === wildPos[0] && l.row === wildPos[1])?.slot;
    this.audio.play('sfx_s1_neon_bzyk');
    if (slot && !reduced) tw.tween(420, (_e, u) => slot.root.scale.set(1 + 0.18 * Math.sin(Math.PI * u)));
    // „×2” — zapalanie neonu: 0 → 1 (40 ms), przygaszenie do 60% po 200 ms (60 ms, w klatce pioruna — strażnik
    // scala je w jeden błysk), płytkie do 92% po 450 ms (< 10% — nie zużywa limitu), potem stałe świecenie
    const x2 = this.x2.sprite;
    x2.visible = true;
    x2.position.set(wc.x + S * 0.28, wc.y - S * 0.42);
    x2.scale.set((S * 0.55) / x2.texture.width * 1.6);
    if (reduced) {
      x2.alpha = 0;
      tw.to(x2, { alpha: 1 }, { duration: 200 });
    } else {
      tw.tween(700, (_e, u) => {
        const t = u * 700;
        x2.alpha = t < 40 ? t / 40 : t >= 200 && t < 260 ? 0.6 : t >= 450 && t < 500 ? 0.92 : 1;
      });
    }
    // przy Big Win kwotę pokazuje licznik Big Win — tu zostaje sam neon „×2” (druga liczba obok licznika
    // rozpraszałaby i podważała zasadę „jeden wynik na ekranie”, 04 R1)
    if (this.presentation?.big) return;
    const amountDigits = this.x2.digits;
    // jedyna wygrana rundy → ta animacja JEST kwotą rundy (środek okna, rozmiar kwoty); przy kilku liniach
    // kwota linii stoi pod WILD-em (nie pod środkiem linii — linie przekątne i środkowa przechodzą przez środek
    // okna, gdzie stoi suma rundy, i liczby by się nałożyły)
    const owns = Boolean(this.presentation?.amountByLine);
    const target = owns ? this.presentation.amountPoint : { x: wc.x, y: wc.y + S * 0.4 };
    const tl = new Timeline(tw, { tempo: Math.max(0.6, ctx.tempo) });
    tl.at(0, () => {
      amountDigits.setHeight(Math.max(owns ? 30 : 24, S * (owns ? 0.32 : 0.26)));
      amountDigits.text = formatSigned(Math.floor(win.amount / 2));
      amountDigits.root.position.set(target.x, target.y);
      amountDigits.root.visible = true;
      amountDigits.root.alpha = 1;
      amountDigits.root.scale.set(1);
    });
    tl.at(200, () => {
      if (reduced) return;
      if (ga.quality.params.index < 2) this.shots.bolt(ga.layers.fxAdd, wc.x, wc.y, target.x, target.y, { tint: CYAN, width: 0.8 });
      this.particles.neonSparks('fxAdd', target.x, target.y, this.particles.count([18, 10, 4]), this.geo.winY + this.geo.winH);
    });
    tl.at(400, () => {
      const from = Math.floor(win.amount / 2);
      tw.tween(300, (e) => { amountDigits.text = formatSigned(Math.round(from + (win.amount - from) * e)); }, { ease: easeOutCubic });
      if (!reduced) tw.tween(380, (e) => amountDigits.root.scale.set(punch(0.25)(e)), { delay: 300 });
      amountDigits.tint = 0xffd0e6;
      this.audio.play('sfx_licznik_koniec');
      this.ui.haptic?.('H_podwojny');
    });
    tl.at(1500, () => {
      tw.to(x2, { alpha: 0 }, { duration: 200, onComplete: () => { x2.visible = false; } });
      tw.to(amountDigits.root, { alpha: 0 }, { duration: 200, onComplete: () => { amountDigits.root.visible = false; } });
    }, { raw: true });
    await tl.play({ token: ctx.skip, extra: 0 }).then(() => null);
    if (ctx.skip?.skipped && amountDigits.root.visible) {
      // przewinięte w trakcie: na ekranie zostaje WYNIK (kwota z serwera), nie połowa z animacji
      tw.killTweensOf(amountDigits.root);
      amountDigits.text = formatSigned(win.amount);
      amountDigits.root.scale.set(1);
      x2.alpha = 1;
    }
  }

  /** E50 sam animuje kwotę „+½ → +całość” — gdy to jedyna wygrana, BaseGame nie stawia drugiej kwoty na środku. */
  lineOwnsAmount(win) {
    return win.wildMultiplier === 2;
  }

  clearPresentation(o) {
    super.clearPresentation(o);
    if (!this.x2) return;
    this.x2.sprite.visible = false;
    this.x2.digits.root.visible = false;
  }

  // =========================================================================================== E51 NEON JACKPOT

  #buildJackpotText() {
    const { PIXI } = this;
    const root = new PIXI.Container();
    root.visible = false;
    const lines = ['NEON', 'JACKPOT'];
    const cache = new Map();
    const letters = [];
    const glyph = (ch) => {
      if (!cache.has(ch)) cache.set(ch, drawNeonText(PIXI, ch, { size: 120 }));
      return cache.get(ch);
    };
    const rows = lines.map((word, li) => {
      const row = new PIXI.Container();
      let x = 0;
      for (const ch of word) {
        const s = new PIXI.Sprite(glyph(ch));
        s.anchor.set(0.5);
        const adv = 120 * (ch === 'J' ? 0.7 : 0.86);
        s.x = x + adv / 2;
        x += adv;
        s.alpha = 0;
        row.addChild(s);
        letters.push(s);
      }
      row.pivot.x = x / 2;
      row.y = li * 140;
      root.addChild(row);
      return row;
    });
    const x10 = new PIXI.Sprite(drawNeonText(PIXI, '×10', { size: 120, outline: '#21E6FF', halo: '#FF2E88' }));
    x10.anchor.set(0, 0.5);
    x10.position.set(rows[1].width / 2 + 30, 140);
    x10.alpha = 0;
    root.addChild(x10);
    root.pivot.y = 70;
    return {
      root,
      letters,
      x10,
      layout: (lay) => {
        const target = lay.portrait ? 56 : 96;
        root.baseScale = (target * Math.max(0.55, Math.min(1.4, lay.k * 1.3))) / 120;
        root.scale.set(root.baseScale);
        root.position.set(lay.w / 2, lay.h * 0.42);
      },
      hide: () => { root.visible = false; },
    };
  }

  /** E51: krok `feature` z `name: "neonJackpot"` — 2000 ms pokazu, potem liczenie sekwencji z kroku `win`. */
  async onFeature(step, ctx) {
    if (step.name !== 'neonJackpot') return super.onFeature(step, ctx);
    this.stats.jackpots += 1;
    const ga = this.gameApp;
    const tw = ga.tweener;
    const reduced = ga.motion.reduced;
    const L = ga.layers;
    const S = this.geo.cell;
    const { w, h } = ga.layout;
    const token = ctx.skip;
    // poziom jednostki (feature + win) — czy po pokazie będzie Big Win, czy E29/E28
    const winStep = ctx.next('win')[0];
    const unitM = winStep ? (winStep.totalWin - (ctx.state.unitStart ?? 0)) / ctx.bet : 0;
    const bigAfter = unitM >= 15;
    ctx.state.jackpot = bigAfter;
    // wszystkie 9 symboli na L5 (bez przyciemnienia), 3 synchroniczne pulsy co 400 ms
    const lifted = [];
    for (let r = 0; r < 3; r++) for (let row = 0; row < 3; row++) {
      const s = this.reels.lift(r, row, L.wins);
      if (s) lifted.push({ r, row, slot: s });
    }
    this.presentation = { lifted, lineWins: [] };
    for (let i = 0; i < 3; i++) {
      tw.wait(i * 400).then(() => lifted.forEach((l) => tw.tween(300, (_e, u) => l.slot.root.scale.set(1 + (reduced ? 0.04 : 0.12) * Math.sin(Math.PI * u)))));
    }
    this.audio.play('sfx_s1_jackpot');
    this.audio.engine.duck('stinger', -6, { attack: 0.08 });
    this.ui.haptic?.('H_eskalacja');
    // ramka: rurki na pełną jasność, biegnące światła 3 okr./s, „co druga” co 500 ms (RM: równo)
    this.neon.outer = this.neon.inner = 1;
    this.jackpotMode = !reduced;
    this.bulbSpeed = 3;
    const tl = new Timeline(tw);
    tl.at(200, () => {
      // „ciemny takt” (R5): rurki i żarówki przygasają do 30%, winieta 0,25 → 0,45; w 300 ms wracają z błyskiem
      if (reduced) return;
      tw.tween(100, (e) => { this.neon.dimBeat = 1 - 0.7 * easeInQuad(e); this.vigLevel = 0.25 + 0.2 * e; });
    }, { raw: true });
    tl.at(300, () => {
      this.neon.dimBeat = 1;
      this.vigLevel = 0.25;
      this.flash.fire('jackpot', { name: 'neon-jackpot' });
      this.jpRays.show({ x: this.geo.winX + this.geo.winW / 2, y: this.geo.winY + this.geo.winH / 2, size: Math.min(w, h) * 1.6 * (ga.quality.params.raysScale / 1.6), omega: 8, alpha: 0.85, tintA: PINK, tintB: CYAN });
      this.camera.add(0.7);
      for (let i = 0; i < 3; i++) {
        tw.wait(i * 400).then(() => {
          for (let j = 0; j < 3; j++) this.particles.neonSparks('fxAdd', this.geo.winX + this.geo.winW * (0.2 + 0.3 * j), this.geo.winY - S * 0.2, this.particles.count([6, 4, 1]), this.geo.winY + this.geo.winH);
        });
      }
    }, { raw: true });
    tl.at(400, () => {
      // „NEON JACKPOT” zapala się literami co 40 ms (każda litera mała — poniżej progu błysku)
      const jt = this.jackpotText;
      jt.layout(ga.layout);
      jt.root.visible = true;
      jt.root.alpha = 1;
      jt.letters.forEach((s, i) => {
        s.alpha = 0;
        if (reduced) tw.to(s, { alpha: 1 }, { duration: 300 });
        else tw.wait(i * 40).then(() => { s.alpha = 1; });
      });
      jt.x10.alpha = 0;
      tw.wait(jt.letters.length * 40).then(() => tw.to(jt.x10, { alpha: 1 }, { duration: reduced ? 300 : 80 }));
    }, { raw: true });
    tl.at(600, () => this.particles.confetti('fxNormal', this.particles.count([ga.quality.params.confetti, 110, 40]) / (ga.quality.params.index === 0 ? 1 : 1)), { raw: true });
    tl.at(900, () => {
      // 2 pioruny między rurkami ramki w tej samej klatce (strażnik liczy jako jeden błysk)
      const n = Math.min(2, ga.quality.params.lightning);
      for (let i = 0; i < n; i++) {
        const y = this.geo.winY + this.geo.winH * (0.3 + 0.4 * i);
        this.shots.bolt(L.fxAdd, this.geo.winX - S * 0.2, y, this.geo.winX + this.geo.winW + S * 0.2, y + S * 0.3 * (i ? -1 : 1), { tint: CYAN });
      }
    }, { raw: true });
    tl.at(1400, () => {
      // napis maleje do 0,6 i przesuwa się na górę ekranu (y 18%) — zostaje nagłówkiem sekwencji
      const root = this.jackpotText.root;
      const s0 = root.scale.x;
      const y0 = root.y;
      if (bigAfter) tw.tween(400, (e) => { root.scale.set(s0 * (1 - 0.4 * e)); root.y = y0 + (h * 0.12 - y0) * e; }, { ease: easeInOutCubic });
    }, { raw: true });
    tl.at(1500, () => {
      if (reduced) return;
      const root = this.jackpotText.root;
      const res = this.governor.request('neon', { area: 0.08, alpha: 0.3 });
      if (res.decision === 'full' || res.decision === 'free' || res.decision === 'absorbed') {
        root.alpha = 0.6;
        tw.wait(60).then(() => { root.alpha = 1; });
      }
      this.audio.play('sfx_s1_neon_bzyk');
    }, { raw: true });
    tl.at(1600, () => {
      if (!bigAfter) tw.to(this.jackpotText.root, { alpha: 0 }, { duration: 300, onComplete: () => this.jackpotText.hide() });
    }, { raw: true });
    await tl.play({ token, extra: bigAfter ? 0 : 400 });
    this.audio.engine.unduck('stinger', { release: 0.4 });
    // powrót symboli do bębnów — kolejny krok `win` sam podniesie wygrywające
    this.reels.dropAll();
    this.presentation = null;
  }

  async runBigWin(o) {
    const res = await super.runBigWin(o);
    this.jackpotText.hide();
    this.jpRays.hide(400);
    this.jackpotMode = false;
    this.neon.outer = this.neon.inner = this.neon.base;
    this.bulbSpeed = 0.6;
    return res;
  }

  async presentWins(step, ctx, info) {
    // przy wygranej medium neony jaśnieją (0,8) i żarówki biegną 2 okr./s (04 § 6.1, E29)
    if (info.tier === 'medium') {
      this.neon.outer = this.neon.inner = 0.8;
      this.bulbSpeed = 2;
    }
    await super.presentWins(step, ctx, info);
    if (TIER_ORDER[info.tier] < TIER_ORDER.big) {
      this.neon.outer = this.neon.inner = this.neon.base;
      this.bulbSpeed = 0.6;
    }
  }
}

function mixColor(a, b, t) {
  const r = ((a >> 16) & 255) + ((((b >> 16) & 255) - ((a >> 16) & 255)) * t);
  const g = ((a >> 8) & 255) + ((((b >> 8) & 255) - ((a >> 8) & 255)) * t);
  const bl = (a & 255) + (((b & 255) - (a & 255)) * t);
  return ((r & 255) << 16) | ((g & 255) << 8) | (bl & 255);
}
