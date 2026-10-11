/** Złoty Faraon: five reels, Egyptian scene, expanding WILD and server-directed free spins. */
import { BaseGame } from '../base-game.js';
import { canvasTexture, makeCanvas, ringContainer } from '../core/canvas-art.js';
import { easeOutCubic, easeOutBack } from '../core/easing.js';
import { motionBlur, silhouette, softShape } from './s1-art.js';
import { fxRng } from '../core/random.js';
import { Rays } from '../fx/effects.js';
import { formatAmount } from '../../format.js';

const GOLD = 0xffe08a;
const BLUE = 0x9fe8ff;
const TURQUOISE = 0x2ec4b6;
const SYMBOLS = ['10', 'j', 'q', 'k', 'a', 'ankh', 'oko', 'skarabeusz', 'anubis', 'faraon', 'wild', 'scatter'];
const GEM_COLORS = { 10: 0x2ec4b6, j: 0x19d17a, q: 0xe2553a, k: 0x1f4fd8, a: 0x8f3dff, anubis: 0xffb23d };
export const S2_CONFIG = Object.freeze({
  code: 'zloty-faraon', reels: 5, rows: 3, engine: 'LINES', wildCode: 'wild', soundKey: 's2',
  music: 'mus_s2', reelLoop: 'sfx_beben_petla_s2', bgLuma: 0.08, lineColors: [GOLD, TURQUOISE],
  fillerWeights: { 10: 6, j: 6, q: 5, k: 5, a: 5, ankh: 4, oko: 3, skarabeusz: 3, anubis: 2, faraon: 2, wild: 1, scatter: 1 },
  timing: Object.freeze({
    startGap: 60, windupDist: 0.18, windupMs: 120, accelMs: 220, vmax: 26,
    stops: [1400, 1600, 1800, 2000, 2200], brakeMs: 300, overshoot: 0.1, settleMs: 180,
    anticipationMs: 1200, anticipationSlowAfter: 400, anticipationSlowMs: 300, anticipationSpeed: 0.55,
    matchWindowMs: 600, lateLeadMs: 450, slamGap: 40, slamBrake: 0.6,
  }),
});

export class S2Game extends BaseGame {
  constructor(o) {
    super({ ...o, config: S2_CONFIG });
    this.freeMode = false;
    this.freeBlend = 0;
    this.expanded = new Map();
    this.specials = [];
    this.glyphs = [];
    this.scatterCount = 0;
    this.anticipating = null;
    this.elapsed = 0;
    this.glyphClock = 0;
    this.stats.expandedWilds = 0;
    this.stats.freeSpinsStarted = 0;
    this.stats.freeSpinsRetriggered = 0;
    this.stats.freeSpinsEnded = 0;
  }

  imageRequests() {
    const requests = SYMBOLS.flatMap((code) => ['main', 'ruch1', 'ruch2', 'syl', 'glow', 'cien'].map((v) => ({ id: `s2_sym_${code}`, ...(v === 'main' ? {} : { variant: v }) })));
    const width = Math.max(screen.width, screen.height) * Math.min(2, devicePixelRatio || 1);
    for (const suffix of ['desktop', 'mobile', 'fs_desktop', 'fs_mobile']) requests.push({ id: `s2_tlo_${suffix}`, targetWidth: width });
    for (const id of ['s2_ramka', 's2_logo', 's2_wild_rozszerzony', 'g_win_free_spins']) requests.push({ id }, { id, variant: 'glow' });
    for (let i = 0; i < 8; i++) requests.push({ id: `s2_fx_hieroglify__${i}` });
    return requests;
  }

  async buildViews(onProgress) {
    const R = this.resources;
    for (const [i, code] of SYMBOLS.entries()) {
      const id = `s2_sym_${code}`;
      const main = R.texture(id);
      if (main) {
        const entry = R.entry(id);
        const ratio = (v) => (entry?.variants?.[v]?.w ?? entry?.w ?? 1) / (entry?.w ?? 1);
        this.views.set(code, { main, blur1: R.texture(id, 'ruch1'), blur2: R.texture(id, 'ruch2'), syl: R.texture(id, 'syl'), glow: R.texture(id, 'glow'), shadow: R.texture(id, 'cien'), glowScale: ratio('glow'), shadowScale: ratio('cien'), scale: 1 });
      } else {
        // A readable fallback is kept for offline/partial asset downloads; the delivered art always wins.
        const c = makeCanvas(256, 256);
        const x = c.getContext('2d');
        x.fillStyle = '#07182a'; x.beginPath(); x.roundRect(15, 15, 226, 226, 32); x.fill();
        x.strokeStyle = '#f5c542'; x.lineWidth = 7; x.stroke();
        x.fillStyle = '#ffe08a'; x.font = `900 ${code.length > 3 ? 31 : 90}px Cinzel, serif`;
        x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(({ ankh: '☥', oko: '◉', faraon: '♛', scatter: '△' })[code] ?? code.toUpperCase(), 128, 130);
        const glow = softShape(c, { pad: 0.15, blur: 0.07 });
        this.views.set(code, { main: canvasTexture(this.PIXI, c), blur1: canvasTexture(this.PIXI, motionBlur(c, 0.06)), blur2: canvasTexture(this.PIXI, motionBlur(c, 0.12)), syl: canvasTexture(this.PIXI, silhouette(c)), glow: canvasTexture(this.PIXI, glow), glowScale: glow.width / c.width, scale: 0.95 });
      }
      onProgress?.((i + 1) / SYMBOLS.length);
    }
  }

  buildScene() {
    const { PIXI } = this;
    const L = this.gameApp.layers;
    const sprite = (texture, host, tint, additive = false) => {
      const s = new PIXI.Sprite(texture ?? PIXI.Texture.WHITE); s.anchor.set(0.5);
      if (tint !== undefined) s.tint = tint;
      if (additive) s.blendMode = 'add';
      host.addChild(s); return s;
    };
    this.bg = sprite(this.resources.texture('s2_tlo_desktop'), L.bg);
    this.bgFree = sprite(this.resources.texture('s2_tlo_fs_desktop'), L.bg);
    this.bgFree.alpha = 0;
    this.torches = [0, 1].map(() => sprite(this.tex.radial, L.bgParticles, 0xffa45c, true));
    this.nightBeam = sprite(this.tex.column, L.bgParticles, BLUE, true);
    this.nightBeam.alpha = 0;
    this.under = new PIXI.Graphics(); L.under.addChild(this.under);
    this.specialLayer = new PIXI.Container(); L.under.addChild(this.specialLayer);
    this.relicLayer = new PIXI.Container(); L.wins.addChild(this.relicLayer);
    this.frameTexture = this.resources.texture('s2_ramka');
    this.frameWindow = this.resources.frameWindow('s2_ramka') ?? { x: 0.142, y: 0.166, w: 0.7167, h: 0.6559 };
    if (this.frameTexture) {
      const t = this.frameTexture, f = this.frameWindow;
      this.frame = ringContainer(PIXI, t, { x: f.x * t.width, y: f.y * t.height, w: f.w * t.width, h: f.h * t.height });
    } else this.frame = new PIXI.Graphics();
    L.frame.addChild(this.frame);
    this.logoGlow = sprite(this.resources.texture('s2_logo', 'glow') ?? this.tex.radial, L.logo, GOLD, true);
    this.logo = sprite(this.resources.texture('s2_logo'), L.logo);
    this.fallbackTitle = new PIXI.Text({ text: 'ZŁOTY FARAON', style: { fontFamily: 'Cinzel, Georgia, serif', fontWeight: '900', fontSize: 40, fill: '#ffe08a', stroke: { color: '#1b162a', width: 5 } } });
    this.fallbackTitle.anchor.set(0.5); this.fallbackTitle.visible = !this.resources.texture('s2_logo'); L.logo.addChild(this.fallbackTitle);
    this.logo.visible = !this.fallbackTitle.visible;
    this.column = sprite(this.tex.column, L.fxAdd, BLUE, true); this.column.alpha = 0;
    this.spot = [0, 1].map(() => { const s = new PIXI.Sprite(PIXI.Texture.WHITE); s.tint = 0x050b24; s.alpha = 0; L.amounts.addChildAt(s, 0); return s; });
    this.x2 = new PIXI.Text({ text: 'WYGRANE LINIOWE ×2', style: { fontFamily: 'Manrope, sans-serif', fontWeight: '800', fontSize: 18, fill: '#fff3cc', stroke: { color: '#061c2e', width: 5 } } });
    this.x2.anchor.set(0.5); this.x2.visible = false; L.logo.addChild(this.x2);
    this.bonusRays = new Rays(this.gameApp, L.bigwinFixed, this.tex.rays);
    this.#ambient();
    this.gameApp.quality.addEventListener('change', () => this.#ambient());
    this.gameApp.motion.addEventListener('change', () => this.#ambient());
  }

  #ambient() {
    if (!this.particles) return;
    this.particles.layers.bg.clear();
    if (!this.gameApp.motion.reduced) this.particles.dust('bg', this.gameApp.quality.pick([40, 20, 0]), { w: this.gameApp.layout.w, h: this.gameApp.layout.h });
  }

  #geometry({ w, h, portrait }) {
    const f = this.frameWindow;
    const margin = Math.max(7, Math.min(w, h) * 0.025);
    const gap = 0.035;
    const fw = (5 + gap * 4) / f.w, fh = 3 / f.h;
    const topRoom = portrait ? 0.8 : 0.65;
    const S = Math.max(12, Math.floor(Math.min((w - margin * 2) / fw, (h - margin * 2) / (fh + topRoom))));
    const frameW = fw * S, frameH = fh * S;
    const frameX = (w - frameW) / 2, frameY = (h - frameH + topRoom * S) / 2;
    return { cell: S, gap: S * gap, frameX, frameY, frameW, frameH, winX: frameX + frameW * f.x, winY: frameY + frameH * f.y, winW: (5 + gap * 4) * S, winH: 3 * S, logoX: w / 2, logoY: frameY + S * 0.02, logoW: Math.min(w * 0.72, S * 3.1) };
  }

  layoutScene(lay) {
    const g = this.geo = this.#geometry(lay);
    const suffix = lay.portrait ? 'mobile' : 'desktop';
    for (const [sprite, id] of [[this.bg, `s2_tlo_${suffix}`], [this.bgFree, `s2_tlo_fs_${suffix}`]]) {
      sprite.texture = this.resources.texture(id) ?? sprite.texture;
      sprite.position.set(lay.w / 2, lay.h / 2);
      sprite.scale.set(Math.max(lay.w / sprite.texture.width, lay.h / sprite.texture.height) * 1.04);
    }
    this.under.clear().rect(g.winX - g.gap, g.winY, g.winW + 2 * g.gap, g.winH).fill({ color: 0x061723, alpha: 0.97 });
    for (let i = 1; i < 5; i++) this.under.rect(g.winX + i * g.cell + (i - 0.5) * g.gap, g.winY, Math.max(1, g.gap * 0.28), g.winH).fill({ color: TURQUOISE, alpha: 0.24 });
    if (this.frameTexture) {
      this.frame.position.set(g.frameX, g.frameY);
      this.frame.scale.set(g.frameW / this.frameTexture.width, g.frameH / this.frameTexture.height);
    } else {
      this.frame.clear().roundRect(g.winX - 8, g.winY - 8, g.winW + 16, g.winH + 16, 10).stroke({ width: 7, color: GOLD });
    }
    this.logo.position.set(g.logoX, g.logoY); this.logo.scale.set(g.logoW / this.logo.texture.width);
    const ratio = (this.resources.entry('s2_logo')?.variants?.glow?.w ?? 1) / (this.resources.entry('s2_logo')?.w ?? 1);
    this.logoGlow.position.copyFrom(this.logo.position); this.logoGlow.width = g.logoW * ratio; this.logoGlow.height = this.logoGlow.width * this.logoGlow.texture.height / this.logoGlow.texture.width;
    this.fallbackTitle.position.copyFrom(this.logo.position); this.fallbackTitle.style.fontSize = Math.max(20, g.cell * 0.4);
    this.x2.position.set(lay.w / 2, g.frameY + g.frameH - g.cell * 0.19); this.x2.style.fontSize = Math.max(10, Math.min(20, g.cell * 0.18));
    this.torches.forEach((s, i) => { s.position.set(lay.w * (i ? 0.87 : 0.13), lay.h * 0.42); s.width = s.height = g.cell * 2.1; });
    this.nightBeam.position.set(lay.w * 0.5, lay.h * 0.3); this.nightBeam.width = g.cell * 0.85; this.nightBeam.height = lay.h * 0.7;
    for (const e of this.expanded.values()) this.#layoutRelic(e);
    if (this.bonusPanel) this.#layoutBonus();
    return { x: g.winX, y: g.winY, cell: g.cell, gap: g.gap };
  }

  afterLayout() {
    for (const s of this.specials) {
      const c = this.reels.cellCenter(s.reel, s.row); s.sprite.position.set(c.x, c.y);
      s.sprite.width = s.sprite.height = this.geo.cell * 1.35;
    }
  }

  async intro() {
    this.currentGrid = [['10', 'j', 'q'], ['k', 'a', 'ankh'], ['oko', 'skarabeusz', '10'], ['j', 'q', 'k'], ['a', 'ankh', 'oko']];
    this.reels.setGrid(this.currentGrid);
    this.audio.play('sfx_s2_gong');
    this.audio.intro();
    if (!this.gameApp.motion.reduced) {
      for (const r of this.reels.reels) {
        const y = r.container.y; r.container.y -= this.geo.cell;
        this.gameApp.tweener.to(r.container, { y }, { duration: 420, delay: 70 * r.index, ease: easeOutBack(1.1) });
      }
      this.#sand(this.geo.winX + this.geo.winW / 2, this.geo.winW, 30);
    }
    await this.gameApp.tweener.wait(800);
  }

  update(dt) {
    if (!this.geo) return;
    this.elapsed += dt;
    const t = this.elapsed / 1000, reduced = this.gameApp.motion.reduced, low = this.gameApp.quality.params.index === 2;
    this.bgFree.alpha = this.freeBlend;
    this.torches.forEach((s, i) => { s.alpha = (1 - this.freeBlend) * (reduced || low ? 0.35 : 0.35 + Math.sin(t * 5 + i * 2) * 0.055 + Math.sin(t * 7.3 + i) * 0.035); });
    this.nightBeam.alpha = this.freeBlend * (reduced ? 0.27 : 0.27 + 0.06 * Math.sin(t * 2));
    this.logoGlow.alpha = this.freeBlend * (reduced ? 0.45 : 0.45 + 0.18 * Math.sin(t * Math.PI * 1.25));
    this.bonusRays.update(dt);
    for (const s of this.specials) s.sprite.alpha = reduced ? 0.45 : 0.48 + 0.14 * Math.sin(t * 5.2 + s.reel);
    for (const e of this.expanded.values()) e.glow.alpha = e.open * (reduced ? 0.5 : 0.58 + 0.18 * Math.sin(t * 5.2));
    for (let i = this.glyphs.length - 1; i >= 0; i--) {
      const g = this.glyphs[i]; g.age += dt;
      if (g.age >= g.life) { g.sprite.destroy(); this.glyphs.splice(i, 1); continue; }
      const u = g.age / g.life; g.sprite.alpha = Math.sin(Math.PI * u) * 0.7;
      if (!reduced) { g.sprite.y = g.y - u * g.rise; g.sprite.x = g.x + Math.sin(u * Math.PI * 2 + g.phase) * g.drift; }
    }
    this.glyphClock += dt;
    if (this.glyphClock > 900 && !reduced && !low) {
      this.glyphClock = 0;
      for (const s of this.specials.filter((s) => s.code === 'wild')) {
        const c = this.reels.cellCenter(s.reel, s.row); this.#glyphs(c.x, c.y, 1);
      }
    }
    if (this.anticipating) {
      const a = this.anticipating, u = Math.min(1, (this.gameApp.tweener.now - a.start) / a.duration);
      this.camera.setFloor(0.15 + 0.15 * u);
      if (!reduced) this.camera.zoom = 1 + 0.025 * u;
      for (const s of this.specials.filter((s) => s.code === 'scatter')) {
        const slot = this.reels.slotAt(s.reel, s.row);
        if (slot && !reduced) slot.root.scale.set(1 + 0.055 * Math.max(0, Math.sin((this.elapsed - a.start) * Math.PI / 300)));
      }
    }
  }

  onSpinStart() {
    this.#clearRelics();
    for (const s of this.specials) s.sprite.destroy(); this.specials = [];
    this.scatterCount = 0;
    this.onAnticipationEnd();
    for (const r of this.reels.reels) for (const s of r.slots) { s.body.visible = true; s.root.scale.set(1); }
    if (!this.gameApp.motion.reduced) this.#sand(this.geo.winX + this.geo.winW / 2, this.geo.winW, 10);
  }

  onReelStop(detail) {
    super.onReelStop(detail);
    const { reel, codes = [] } = detail, S = this.geo.cell;
    this.#sand(this.reels.cellCenter(reel, 0).x, S * 0.8, 6);
    codes.forEach((code, row) => {
      if (code !== 'wild' && code !== 'scatter') return;
      const c = this.reels.cellCenter(reel, row), tint = code === 'scatter' ? BLUE : GOLD;
      const glow = new this.PIXI.Sprite(this.views.get(code)?.glow ?? this.tex.radial);
      glow.anchor.set(0.5); glow.blendMode = 'add'; glow.tint = tint; glow.position.set(c.x, c.y); glow.width = glow.height = S * 1.35;
      this.specialLayer.addChild(glow); this.specials.push({ sprite: glow, reel, row, code });
      this.shots.flare(this.gameApp.layers.fxAdd, c.x, c.y, S * (code === 'scatter' ? 1.4 : 1.2), tint);
      this.particles.twinkles('fxAdd', c.x, c.y, S * 0.5, S * 0.5, this.particles.count([8, 5, 2]), { tint });
      if (code === 'scatter') {
        this.scatterCount++;
        this.audio.play(`sfx_scatter_${Math.min(3, this.scatterCount)}`);
        if (this.scatterCount >= 3) { this.camera.add(0.3); this.#glyphs(c.x, c.y, this.particles.count([8, 4, 2])); }
      } else this.#glyphs(c.x, c.y, 2);
    });
    if (this.anticipating?.reel === reel) this.onAnticipationEnd();
  }

  onAnticipation({ reel, until }) {
    const tw = this.gameApp.tweener, g = this.geo, c = this.reels.cellCenter(reel, 1);
    const duration = Math.max(300, until - this.reels.time);
    this.anticipating = { reel, start: tw.now, duration };
    this.audio.anticipationStart(duration);
    this.column.position.set(c.x, c.y); this.column.width = g.cell; this.column.height = g.winH;
    tw.to(this.column, { alpha: 0.42 }, { duration: 300 });
    this.spot[0].position.set(g.winX, g.winY); this.spot[0].width = Math.max(0, c.x - g.cell / 2 - g.winX); this.spot[0].height = g.winH;
    this.spot[1].position.set(c.x + g.cell / 2, g.winY); this.spot[1].width = Math.max(0, g.winX + g.winW - c.x - g.cell / 2); this.spot[1].height = g.winH;
    for (const s of this.spot) tw.to(s, { alpha: 0.35 }, { duration: 250 });
    tw.to(this.vignette, { alpha: 0.5 }, { duration: 350 });
    this.camera.focus = c;
  }

  onAnticipationEnd() {
    if (!this.anticipating) return;
    this.anticipating = null;
    this.audio.anticipationEnd(this.scatterCount >= 3);
    this.camera.setFloor(0); this.camera.zoom = 1; this.camera.focus = null;
    const tw = this.gameApp.tweener;
    tw.to(this.column, { alpha: 0 }, { duration: 250 });
    for (const s of this.spot) tw.to(s, { alpha: 0 }, { duration: 250 });
    tw.to(this.vignette, { alpha: 0.25 }, { duration: 350 });
    for (const r of this.reels.reels) for (const s of r.slots) s.root.scale.set(1);
  }

  #sand(x, width, count) {
    if (this.gameApp.motion.reduced || this.gameApp.quality.params.index === 2) return;
    for (let i = 0; i < count; i++) this.particles.layers.fxAdd.spawn({ x: x + fxRng.range(-0.5, 0.5) * width, y: this.geo.winY - 3, vx: fxRng.range(-10, 10), vy: fxRng.range(100, 200), g: 600, life: fxRng.range(0.4, 0.9), s0: fxRng.range(0.025, 0.065), tint: 0x8a6a3a, alpha: 0.45, frame: 'iskra2', prio: 3 });
  }

  #glyphs(x, y, count) {
    const S = this.geo.cell;
    for (let i = 0; i < count && this.glyphs.length < 32; i++) {
      const texture = this.resources.texture(`s2_fx_hieroglify__${Math.floor(fxRng.range(0, 8))}`);
      if (!texture) continue;
      const s = new this.PIXI.Sprite(texture); s.anchor.set(0.5); s.blendMode = 'add'; s.tint = i % 2 ? TURQUOISE : GOLD;
      s.width = s.height = S * fxRng.range(0.13, 0.25); s.position.set(x + fxRng.range(-0.6, 0.6) * S, y + fxRng.range(-0.6, 0.6) * S); s.alpha = 0;
      this.gameApp.layers.fxAdd.addChild(s);
      this.glyphs.push({ sprite: s, x: s.x, y: s.y, age: 0, life: fxRng.range(800, 1400), rise: S * 1.2, drift: S * 0.15, phase: fxRng.range(0, 6.28) });
    }
  }

  #layoutRelic(e) {
    const g = this.geo, x = g.winX + e.reel * (g.cell + g.gap) + g.cell / 2;
    e.root.position.set(x, g.winY + g.winH / 2);
    const t = e.sprite.texture;
    e.sprite.height = g.winH; e.sprite.width = g.winH * t.width / t.height;
    e.glow.width = e.sprite.width * 1.35; e.glow.height = g.winH * 1.15;
    e.beam.width = g.cell * 1.3; e.beam.height = g.winH;
    const origin = -g.winH / 2 + (e.originRow + 0.5) * g.cell;
    const top = origin + (-g.winH / 2 - origin) * e.open;
    const bottom = origin + (g.winH / 2 - origin) * e.open;
    e.mask.clear().rect(-g.cell * 0.7, top, g.cell * 1.4, Math.max(1, bottom - top)).fill(0xffffff);
  }

  #clearRelics() {
    for (const e of this.expanded.values()) { this.gameApp.tweener.killTweensOf(e); e.root.destroy({ children: true }); }
    this.expanded.clear();
    if (this.reels) for (const r of this.reels.reels) for (const s of r.slots) s.body.visible = true;
  }

  async onExpandWild(step, ctx) {
    const ga = this.gameApp, tw = ga.tweener, reduced = ga.motion.reduced;
    const reels = [...(step.reels ?? [])].sort((a, b) => a - b);
    const tempo = Math.max(0.65, ctx.tempo);
    const entries = [];
    for (const [i, reel] of reels.entries()) {
      const root = new this.PIXI.Container();
      const glow = new this.PIXI.Sprite(this.resources.texture('s2_wild_rozszerzony', 'glow') ?? this.tex.radial);
      const beam = new this.PIXI.Sprite(this.tex.column); beam.tint = GOLD; beam.blendMode = 'add'; beam.alpha = 0.25;
      const sprite = new this.PIXI.Sprite(this.resources.texture('s2_wild_rozszerzony') ?? this.views.get('wild').main);
      for (const s of [beam, glow, sprite]) s.anchor.set(0.5);
      glow.blendMode = 'add'; glow.tint = GOLD; glow.alpha = 0;
      const mask = new this.PIXI.Graphics(); root.addChild(beam, glow, sprite, mask); sprite.mask = mask;
      this.relicLayer.addChild(root);
      const e = { reel, root, glow, beam, sprite, mask, open: 0, originRow: Math.max(0, this.currentGrid?.[reel]?.indexOf('wild') ?? 1) };
      this.expanded.set(reel, e); this.#layoutRelic(e); root.visible = false; entries.push(e);
      this.stats.expandedWilds++;
      await tw.wait(i ? 250 * tempo : 0, { token: ctx.skip });
      root.visible = true;
      if (!ctx.skip.skipped) this.audio.play('sfx_s2_wild_rozszerzenie', { hitIn: 0.6 * tempo, pan: (reel - 2) * 0.18 });
      const start = tw.tween(reduced ? 300 : 600 * tempo, (u) => { e.open = u; this.#layoutRelic(e); }, { ease: easeOutCubic, token: ctx.skip, target: e });
      e.done = start.promise.then(() => {
        e.open = 1; this.#layoutRelic(e);
        for (const s of this.reels.visibleSlots(reel)) s.body.visible = false;
        if (ctx.skip.skipped) return;
        const c = this.reels.cellCenter(reel, 1);
        this.audio.play('sfx_uderzenie_basu', { volume: 0.5 }); this.camera.add(0.3); this.ui.haptic?.('H_mocny');
        this.shots.flare(ga.layers.fxAdd, c.x, c.y, this.geo.cell * 1.6, GOLD);
        this.particles.sparks('fxAdd', c.x, this.geo.winY, this.particles.count([15, 9, 4]), { tint: GOLD, angle: Math.PI / 2, spread: 1, speed: [80, 200] });
      });
      this.#glyphs(this.reels.cellCenter(reel, 1).x, this.reels.cellCenter(reel, 1).y, this.particles.count([12, 8, 3]));
      this.#sand(this.reels.cellCenter(reel, 0).x, this.geo.cell, 16);
    }
    await Promise.all(entries.map((e) => e.done));
    this.reels.setGrid(step.grid); this.currentGrid = step.grid;
    for (const reel of reels) for (const s of this.reels.visibleSlots(reel)) s.body.visible = false;
    await tw.wait(200 * tempo, { token: ctx.skip });
  }

  async presentWins(step, ctx, info) {
    const done = super.presentWins(step, ctx, info);
    for (const l of this.presentation?.lifted ?? []) {
      if (l.glow) l.glow.tint = GEM_COLORS[l.slot.code] ?? GOLD;
      if (this.expanded.has(l.r)) l.slot.body.visible = false;
    }
    await done;
  }

  symbolIdiom(slot, code) {
    const tw = this.gameApp.tweener;
    if (code === 'skarabeusz') tw.tween(300, (_e, u) => { slot.body.scale.x = 1 + 0.08 * Math.sin(Math.PI * u); }, { target: slot.body });
    if (code === 'ankh' || code === 'oko') this.shine.run(slot.main, { duration: 400 });
    if (code === 'faraon') {
      const p = slot.root.position;
      this.particles.twinkles('fxAdd', p.x, p.y, this.geo.cell * 0.55, this.geo.cell * 0.55, this.particles.count([8, 5, 2]), { tint: GOLD });
    }
  }

  async onLinePresented(win) {
    if (win.freeSpinMultiplier === 2) { this.x2.visible = true; this.stats.wildMultipliers++; }
  }

  async #setFree(on, token) {
    this.freeMode = on; this.x2.visible = on;
    await this.gameApp.tweener.to(this, { freeBlend: on ? 1 : 0 }, { duration: this.gameApp.motion.reduced ? 900 : 800, token }).promise;
  }

  #layoutBonus() {
    const p = this.bonusPanel, { w, h } = this.gameApp.layout;
    if (!p) return;
    p.shade.width = w; p.shade.height = h;
    const width = Math.min(w * 0.86, 700), height = Math.min(h * 0.72, 480);
    p.card.clear().roundRect((w - width) / 2, (h - height) / 2, width, height, 24).fill({ color: 0x06182d, alpha: 0.96 }).stroke({ width: 2, color: GOLD, alpha: 0.8 });
    p.heading.position.set(w / 2, h / 2 - height * 0.25);
    p.heading.style.fontSize = Math.max(17, Math.min(35, width * 0.065));
    p.value.position.set(w / 2, h / 2 + height * 0.015);
    p.value.style.fontSize = Math.max(29, Math.min(82, width * (String(p.value.text).length > 8 ? 0.085 : 0.14)));
    p.detail.position.set(w / 2, h / 2 + height * 0.28);
    p.detail.style.fontSize = Math.max(11, Math.min(19, width * 0.037));
    p.detail.style.wordWrapWidth = width * 0.9;
  }

  async #bonusMessage(heading, value, detail, ms, ctx) {
    const { PIXI } = this, ga = this.gameApp, tw = ga.tweener;
    const root = new PIXI.Container(); ga.layers.bigwinFixed.addChild(root);
    const shade = new PIXI.Sprite(PIXI.Texture.WHITE); shade.tint = 0x030715; shade.alpha = 0.57;
    const card = new PIXI.Graphics(); root.addChild(shade, card);
    const text = (s, size, color) => { const t = new PIXI.Text({ text: s, style: { fontFamily: 'Cinzel, Georgia, serif', fontWeight: '900', fontSize: size, align: 'center', fill: color, stroke: { color: '#071a31', width: 3 }, wordWrap: true, wordWrapWidth: ga.layout.w * 0.8 } }); t.anchor.set(0.5); root.addChild(t); return t; };
    this.bonusPanel = { root, shade, card, heading: text(heading, 35, '#9fe8ff'), value: text(value, 80, '#ffe08a'), detail: text(detail, 20, '#f0f6ff') };
    this.#layoutBonus(); root.alpha = 0;
    tw.to(root, { alpha: 1 }, { duration: 250, token: ctx.skip });
    this.ui.announce?.(`${heading}. ${value}. ${detail}`);
    await tw.wait(ms, { token: ctx.skip });
    await tw.to(root, { alpha: 0 }, { duration: 250 }).promise;
    this.bonusPanel = null; root.destroy({ children: true });
  }

  #triggerBeams(trigger) {
    for (const [reel, row] of trigger ?? []) {
      const c = this.reels.cellCenter(reel, row);
      this.#glyphs(c.x, c.y, this.particles.count([8, 4, 2]));
      const s = new this.PIXI.Sprite(this.tex.column); s.anchor.set(0.5, 1); s.blendMode = 'add'; s.tint = BLUE; s.position.set(c.x, c.y); s.width = this.geo.cell * 0.55; s.height = c.y; s.alpha = 0;
      this.gameApp.layers.fxAdd.addChild(s);
      this.gameApp.tweener.to(s, { alpha: 0.5 }, { duration: 600 });
      this.gameApp.tweener.to(s, { alpha: 0 }, { duration: 500, delay: 900, onComplete: () => s.destroy() });
    }
  }

  async onFreeSpinsStart(step, ctx) {
    this.stats.freeSpinsStarted++;
    this.clearPresentation({ keepRound: true });
    this.audio.play('sfx_free_spins_start'); this.audio.engine.stopMusic(800);
    this.ui.freeSpins?.({ left: step.count, total: step.count }); this.ui.haptic?.('H_fanfara');
    this.#triggerBeams(step.trigger);
    this.governor.reserve(891, 'free-spins');
    await this.gameApp.tweener.wait(791, { token: ctx.skip });
    const transition = this.#setFree(true, ctx.skip);
    await this.gameApp.tweener.wait(100, { token: ctx.skip });
    if (!ctx.skip.skipped) {
      this.flash.fire('fs', { name: 'faraon-free-spins' }); this.audio.play('sfx_s2_gong'); this.audio.blysk(); this.camera.add(0.4);
    }
    this.audio.engine.playMusic('mus_s2_fs', { fadeMs: 800 });
    const { w, h } = this.gameApp.layout;
    this.bonusRays.show({ x: w / 2, y: h / 2, size: Math.min(w, h) * 1.4, omega: 5, alpha: 0.5, tintA: BLUE, tintB: TURQUOISE });
    await this.#bonusMessage('DARMOWE SPINY', String(step.count), 'Rozszerzające WILDY • wygrane liniowe ×2', ctx.autoplay ? 1800 : 2800, ctx);
    await transition;
    this.bonusRays.hide(300);
  }

  async onFreeSpinsRetrigger(step, ctx) {
    this.stats.freeSpinsRetriggered++;
    this.audio.play('sfx_s2_gong'); this.audio.play('sfx_scatter_3'); this.ui.haptic?.('H_eskalacja');
    this.#triggerBeams(step.trigger);
    this.ui.freeSpins?.({ left: step.freeSpinsLeft });
    await this.#bonusMessage('DODATKOWE DARMOWE SPINY', `+${step.added}`, `Pozostało: ${step.freeSpinsLeft}`, 1700 * Math.max(0.65, ctx.tempo), ctx);
  }

  async onFreeSpinsEnd(step, ctx) {
    this.stats.freeSpinsEnded++;
    await super.onFreeSpinsEnd(step, ctx);
    if (step.freeSpinsWin >= 15 * ctx.bet) await this.#bonusMessage('KONIEC DARMOWYCH SPINÓW', `+${formatAmount(step.freeSpinsWin)}`, 'Powrót do skarbca faraona', 1400 * Math.max(0.65, ctx.tempo), ctx);
    this.#clearRelics();
    this.audio.engine.playMusic('mus_s2', { fadeMs: 1200 });
    await this.#setFree(false, ctx.skip);
    this.ui.freeSpins?.(null);
  }

  async abort() {
    await super.abort();
    this.onAnticipationEnd(); this.#clearRelics();
    this.freeMode = false; this.freeBlend = 0; this.x2.visible = false; this.ui.freeSpins?.(null);
    this.audio.engine.playMusic('mus_s2', { fadeMs: 800 });
  }

  debugInfo() {
    return { ...super.debugInfo(), game: 's2', freeMode: this.freeMode, expandedReels: [...this.expanded.keys()], sceneAssets: Boolean(this.frameTexture && this.resources.texture('s2_logo') && this.resources.texture('s2_tlo_desktop')) };
  }
}
