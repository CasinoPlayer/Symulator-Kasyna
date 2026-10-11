/** Kryształowa Kaskada: server-driven clusters, gravity, free spins and multiplier orbs (09 §2.4). */
import { BaseGame, tierFor } from '../base-game.js';
import { S3Board } from './s3-board.js';
import { S1_TIMING } from '../reels/reelset.js';
import { buildAtlas, canvasTexture, makeCanvas, ringContainer } from '../core/canvas-art.js';
import { ensureFonts } from '../core/resources.js';
import { fxRng } from '../core/random.js';
import { KIND } from '../fx/particles.js';
import { formatAmount } from '../../format.js';

const COLORS = { szafir: 0x2f6bff, szmaragd: 0x19d17a, ametyst: 0xc77dff, topaz: 0xffb23d, rubin: 0xff2d55, diament: 0xe8fbff, cebula: 0xffe08a, scatter: 0x5cffb0, mnoznik: 0xffffff };
const CODES = Object.keys(COLORS);
const cloneGrid = (g) => g.map((c) => [...c]);
const orbTint = (v) => v >= 50 ? 0xffe08a : v >= 10 ? 0xa64dff : 0x21e6ff;
const orbKey = (p) => p.join(':');

export class S3Game extends BaseGame {
  constructor(options) {
    super({ ...options, config: {
      code: 'krysztalowa-kaskada', reels: 6, rows: 5, engine: 'CLUSTER', wildCode: 'wild', soundKey: 's3',
      music: 'mus_s3', reelLoop: null, bgLuma: 0.08, timing: S1_TIMING,
      fillerWeights: { szafir: 6, szmaragd: 6, ametyst: 5, topaz: 5, rubin: 3, diament: 2, cebula: 2 },
    } });
    this.orbs = new Map();
    this.orbViews = new Map();
    this.sequence = 0;
    this.freeMode = false;
    this.time = 0;
    this.s3History = [];
    this.s3Stats = { cascades: 0, orbLandings: 0, orbMoves: 0, collections: 0, retriggers: 0, freeSpins: 0 };
    this.clusterViews = [];
    this.lastCrack = 0;
  }

  imageRequests() {
    const items = CODES.flatMap((code) => ['main', 'ruch1', 'glow', 'syl', 'cien'].map((v) => ({ id: `s3_sym_${code}`, ...(v === 'main' ? {} : { variant: v }) })));
    for (const mode of ['', '_fs']) for (const orient of ['desktop', 'mobile']) items.push({ id: `s3_tlo${mode}_${orient}`, targetWidth: orient === 'mobile' ? 720 : 1280 });
    for (const id of ['s3_ramka', 's3_logo', 'g_win_free_spins']) items.push({ id });
    items.push({ id: 's3_logo', variant: 'glow' });
    for (let i = 0; i < 12; i++) items.push({ id: `s3_fx_odlamki__${i}` });
    return items;
  }

  async buildViews(progress) {
    await ensureFonts(['400 40px "Marcellus"']);
    for (let i = 0; i < CODES.length; i++) {
      const code = CODES[i];
      const id = `s3_sym_${code}`;
      let main = this.resources.texture(id);
      if (!main) {
        const c = makeCanvas(192, 192), x = c.getContext('2d');
        x.fillStyle = `#${COLORS[code].toString(16).padStart(6, '0')}`;
        x.beginPath(); x.moveTo(96, 8); x.lineTo(182, 85); x.lineTo(125, 179); x.lineTo(40, 173); x.lineTo(10, 68); x.closePath(); x.fill();
        x.strokeStyle = '#ffffff'; x.lineWidth = 6; x.stroke();
        x.fillStyle = '#070a1f'; x.font = 'bold 28px sans-serif'; x.textAlign = 'center'; x.fillText(code === 'scatter' ? 'BONUS' : code === 'mnoznik' ? '×' : '◆', 96, 105);
        main = canvasTexture(this.PIXI, c);
      }
      const entry = this.resources.entry(id);
      const ratio = (v) => entry?.variants?.[v]?.w / entry?.w || 1.3;
      this.views.set(code, { main, blur1: this.resources.texture(id, 'ruch1'), glow: this.resources.texture(id, 'glow'), syl: this.resources.texture(id, 'syl'), shadow: this.resources.texture(id, 'cien'), scale: 0.94, glowScale: ratio('glow'), shadowScale: ratio('cien') });
      progress?.((i + 1) / CODES.length);
    }
  }

  buildScene() {
    const { PIXI, gameApp: ga } = this, L = ga.layers;
    const old = this.reels;
    ga.removeSystem(old);
    old.root.removeFromParent();
    this.reels = new S3Board(ga, { reels: 6, rows: 5, views: this.views, filler: old.filler, timing: S1_TIMING });
    old.root.destroy({ children: true });
    L.reels.addChild(this.reels.root);
    ga.addSystem(this.reels, 20);
    this.lines.reels = this.reels;
    this.reels.addEventListener('stop', (e) => this.onReelStop(e.detail));
    this.reels.addEventListener('anticipation', (e) => this.onAnticipation(e.detail));
    this.bg = new PIXI.Sprite(PIXI.Texture.WHITE);
    this.bg.anchor.set(0.5);
    this.bgFs = new PIXI.Sprite(PIXI.Texture.WHITE);
    this.bgFs.anchor.set(0.5); this.bgFs.alpha = 0;
    L.bg.addChild(this.bg, this.bgFs);
    this.under = new PIXI.Graphics(); L.under.addChild(this.under);
    this.caustics = [0, 1].map((i) => {
      const s = new PIXI.Sprite(this.tex.rays); s.anchor.set(0.5); s.blendMode = 'add'; s.tint = i ? 0x8f3dff : 0x19f5d2; s.alpha = 0.035;
      L.under.addChild(s); return s;
    });
    this.frameTexture = this.resources.texture('s3_ramka');
    this.hole = this.resources.frameWindow('s3_ramka') ?? { x: 0.1363, y: 0.247, w: 0.7265, h: 0.5729 };
    this.frame = this.frameTexture ? ringContainer(PIXI, this.frameTexture, { x: this.hole.x * this.frameTexture.width, y: this.hole.y * this.frameTexture.height, w: this.hole.w * this.frameTexture.width, h: this.hole.h * this.frameTexture.height }) : new PIXI.Graphics();
    L.frame.addChild(this.frame);
    const logoTex = this.resources.texture('s3_logo');
    this.logo = logoTex ? new PIXI.Sprite(logoTex) : new PIXI.Text({ text: 'KRYSZTAŁOWA\nKASKADA', style: { fontFamily: 'Marcellus', fontSize: 42, fill: 0xffe08a, align: 'center' } });
    this.logo.anchor.set(0.5); L.logo.addChild(this.logo);
    this.cascadeLabel = this.makeText('', 22, 0x19f5d2); L.logo.addChild(this.cascadeLabel);
    this.modeLabel = this.makeText('5+ POŁĄCZONYCH SYMBOLI', 16, 0xbbeaf4); L.logo.addChild(this.modeLabel);
    this.orbLayer = new PIXI.Container(); L.wins.addChild(this.orbLayer);
    this.clusterLayer = new PIXI.Container(); L.lines.addChild(this.clusterLayer);
    const atlas = buildAtlas(PIXI, Array.from({ length: 12 }, (_, i) => ({ name: `shard${i}`, w: 64, h: 64, draw: (c, x, y, w, h) => {
      const image = this.resources.texture(`s3_fx_odlamki__${i}`)?.source?.resource;
      if (image) c.drawImage(image, x, y, w, h);
      else { c.fillStyle = '#ffffff'; c.beginPath(); c.moveTo(x + w * 0.2, y + h * 0.1); c.lineTo(x + w * 0.8, y + h * 0.3); c.lineTo(x + w * 0.5, y + h * 0.9); c.closePath(); c.fill(); }
    } })), 512);
    this.shardLayer = this.particles.addLayer('s3shards', L.fxNormal, atlas, 'normal');
  }

  makeText(text, size = 24, fill = 0xffe08a) {
    const t = new this.PIXI.Text({ text, style: { fontFamily: 'Marcellus, Georgia, serif', fontSize: size, fill, align: 'center', stroke: { color: 0x070a1f, width: 3 } } });
    t.anchor.set(0.5); return t;
  }

  layoutScene({ w, h, portrait }) {
    const bgId = portrait ? 'mobile' : 'desktop';
    for (const [s, mode] of [[this.bg, ''], [this.bgFs, '_fs']]) {
      const tex = this.resources.texture(`s3_tlo${mode}_${bgId}`);
      if (tex) { s.texture = tex; s.tint = 0xffffff; } else s.tint = 0x070a1f;
      const scale = Math.max(w / s.texture.width, h / s.texture.height) * 1.04;
      s.scale.set(scale); s.position.set(w / 2, h / 2);
    }
    const fw = this.frameTexture?.width ?? 1188, fh = this.frameTexture?.height ?? 1258;
    const side = w > h * 1.65 && w > 700;
    const maxW = w * (side ? 0.66 : 0.98), maxH = h * 0.98;
    const scale = Math.min(maxW / fw, maxH / fh);
    const frameW = fw * scale, frameH = fh * scale;
    const fx = (side ? w * 0.64 : w / 2) - frameW / 2, fy = (h - frameH) / 2;
    const holeW = frameW * this.hole.w, holeH = frameH * this.hole.h;
    const cell = Math.min(holeW / 6, holeH / 5);
    const x = fx + frameW * this.hole.x + (holeW - cell * 6) / 2;
    const y = fy + frameH * this.hole.y + (holeH - cell * 5) / 2;
    if (this.frameTexture) { this.frame.position.set(fx, fy); this.frame.scale.set(scale); }
    else this.frame.clear().roundRect(x - 8, y - 8, cell * 6 + 16, cell * 5 + 16, 12).stroke({ width: 5, color: 0x8f3dff });
    this.under.clear().rect(x, y, cell * 6, cell * 5).fill({ color: 0x070a1f, alpha: 0.78 });
    for (const c of this.caustics) { c.position.set(x + cell * 3, y + cell * 2.5); c.width = cell * 6; c.height = cell * 5; }
    const logoW = side ? w * 0.3 : frameW * 0.57, logoH = side ? h * 0.48 : frameH * 0.17;
    if (this.logo.texture) this.logo.scale.set(Math.min(logoW / this.logo.texture.width, logoH / this.logo.texture.height));
    else this.logo.style.fontSize = Math.max(18, cell * 0.42);
    this.logo.position.set(side ? w * 0.19 : x + cell * 3, side ? h * 0.36 : fy + frameH * 0.12);
    this.modeLabel.style.fontSize = Math.max(10, Math.min(18, cell * 0.23));
    this.modeLabel.position.set(side ? w * 0.19 : x + cell * 3, side ? h * 0.63 : y - cell * 0.23);
    this.cascadeLabel.style.fontSize = Math.max(12, Math.min(24, cell * 0.28));
    this.cascadeLabel.position.set(x + cell * 3, y + cell * 5 + cell * 0.43);
    return { x, y, cell, gap: 0 };
  }

  afterLayout() { this.syncOrbs(); this.layoutNotice(); }

  async intro() {
    this.audio.intro();
    this.logo.alpha = 0;
    await this.gameApp.tweener.to(this.logo, { alpha: 1 }, { duration: this.gameApp.motion.reduced ? 250 : 700 }).promise;
  }

  update(dt) {
    this.time += dt;
    this.syncOrbs();
    const reduced = this.gameApp.motion.reduced, low = this.gameApp.quality.level === 'low';
    this.caustics?.forEach((c, i) => {
      c.rotation = reduced || low ? 0 : Math.sin(this.time / 10000 + i * 3) * 0.06;
      c.alpha = low ? 0.02 : reduced ? 0.035 : 0.04 + 0.015 * Math.sin(this.time / 2500 + i * 2);
    });
  }

  onReelStop({ reel, codes, last }) {
    this.audio.play(`sfx_beben_stop_${reel + 1}`, { pan: (reel / 5 * 2 - 1) * 0.4, volume: 0.75 });
    if (last) this.camera.kick(4);
    const scatters = codes.map((code, row) => code === 'scatter' ? row : -1).filter((row) => row >= 0);
    for (const row of scatters) {
      const c = this.reels.cellCenter(reel, row);
      this.particles.twinkles('fxAdd', c.x, c.y, this.reels.cell * 0.4, this.reels.cell * 0.4, this.particles.count([10, 6, 2]), { tint: COLORS.scatter });
      this.audio.play('sfx_scatter_1');
    }
    for (const orb of this.orbs.values()) if (orb.pos[0] === reel) this.orbLanded(orb);
  }

  onAnticipation({ durationMs }) { this.audio.anticipationStart(durationMs); }
  onAnticipationEnd() { this.audio.anticipationEnd(false); }

  startSpin(options = {}) {
    this.clearClusters();
    this.clearOrbViews();
    super.startSpin(options);
    if (!options.free) { this.s3History = []; this.setFreeMode(false, 0); }
    this.cascadeLabel.text = '';
  }

  async onSpin(step, ctx) {
    ctx.state.unitStart = ctx.shownWin; ctx.state.unitPresented = false; ctx.state.cascadeNo = 0;
    this.sequence = 0;
    if (step.phase === 'free') {
      ctx.state.free = true; this.s3Stats.freeSpins++;
      this.ui.freeSpins?.({ index: step.freeSpinIndex, left: step.freeSpinsLeft });
      this.startSpin({ tempo: ctx.tempo, autoplay: true, free: true });
    }
    this.orbs = new Map((step.orbs ?? []).map((o) => [orbKey(o.pos), { pos: [...o.pos], value: o.value }]));
    this.createOrbViews();
    this.currentGrid = cloneGrid(step.grid);
    this.audio.play('sfx_s3_opad');
    if (step.anticipation?.length) this.stats.anticipations++;
    await this.reels.land(step.grid, { anticipation: step.anticipation ?? [] });
    this.onAnticipationEnd();
    this.syncOrbs();
  }

  clearClusters() {
    for (const object of this.clusterViews ?? []) { this.gameApp.tweener.killTweensOf(object); object.destroy({ children: true }); }
    this.clusterViews = [];
  }

  async onClusterWin(step, ctx) {
    this.clearClusters();
    const tw = this.gameApp.tweener;
    this.audio.line(ctx.state.cascadeNo + 1);
    tw.to(this.dimRect, { alpha: 0.42 }, { duration: 150 });
    for (const win of step.wins ?? []) {
      const tint = COLORS[win.symbol] ?? 0xffe08a;
      const outline = new this.PIXI.Graphics();
      const selected = new Set((win.positions ?? []).map(orbKey));
      let xSum = 0, ySum = 0;
      for (const [col, row] of win.positions ?? []) {
        const c = this.reels.cellCenter(col, row), r = this.reels.cell * 0.48;
        xSum += c.x; ySum += c.y;
        for (const [dc, dr, ax, ay, bx, by] of [[-1,0,-1,-1,-1,1],[1,0,1,-1,1,1],[0,-1,-1,-1,1,-1],[0,1,-1,1,1,1]]) {
          if (!selected.has(`${col + dc}:${row + dr}`)) outline.moveTo(c.x + ax*r, c.y + ay*r).lineTo(c.x + bx*r, c.y + by*r);
        }
        const slot = this.reels.lift(col, row, this.gameApp.layers.wins);
        if (slot) tw.tween(280 * ctx.tempo, (_e, u) => slot.root.scale.set(this.gameApp.motion.reduced ? 1 : 1 + 0.12 * Math.sin(Math.PI * u)), { token: ctx.skip, target: slot.root });
      }
      outline.stroke({ color: tint, width: Math.max(2, this.reels.cell * 0.035), alpha: 0.9 });
      this.clusterLayer.addChild(outline); this.clusterViews.push(outline);
      const n = win.positions?.length || 1;
      const amount = this.makeText(`+${formatAmount(win.amount)}`, Math.max(18, this.reels.cell * 0.38));
      amount.position.set(xSum / n, ySum / n - this.reels.cell * 0.25);
      this.gameApp.layers.amounts.addChild(amount); this.clusterViews.push(amount);
    }
    this.ui.winField?.(step.totalWin);
    await tw.wait(280 * ctx.tempo, { token: ctx.skip });
  }

  async onCascade(step, ctx) {
    const tw = this.gameApp.tweener, reduced = this.gameApp.motion.reduced;
    this.sequence++; ctx.state.cascadeNo = this.sequence; this.s3Stats.cascades++;
    this.cascadeLabel.text = `KASKADA ${this.sequence}`;
    this.cascadeLabel.style.fill = this.sequence >= 5 ? 0xffe08a : this.sequence >= 3 ? 0xc77dff : 0x19f5d2;
    const crack = step.removed.length >= 10 ? 4 : ((this.lastCrack + fxRng.int(1, 3) - 1) % 4) + 1;
    this.lastCrack = crack; this.audio.play(`sfx_s3_pekniecie_${crack}`);
    for (const [col, row] of step.removed) {
      const slot = this.reels.slotAt(col, row), c = this.reels.cellCenter(col, row);
      this.shards(c, COLORS[this.currentGrid[col][row]] ?? 0xffffff, reduced);
      if (slot) {
        tw.to(slot.root, { alpha: 0 }, { duration: 170 * ctx.tempo, token: ctx.skip });
        if (!reduced) tw.to(slot.root, { scale: 0.65 }, { duration: 170 * ctx.tempo, token: ctx.skip });
      }
    }
    if (!reduced) this.camera.add(0.2);
    await tw.wait(180 * ctx.tempo, { token: ctx.skip });
    this.clearClusters();
    tw.to(this.dimRect, { alpha: 0 }, { duration: 120 });
    const removed = new Set(step.removed.map(orbKey));
    const nextOrbs = new Map();
    for (const orb of this.orbs.values()) {
      const [col, row] = orb.pos;
      if (removed.has(orbKey(orb.pos))) continue;
      const below = step.removed.filter(([c, r]) => c === col && r > row).length;
      const moved = { pos: [col, row + below], value: orb.value };
      if (below) this.s3Stats.orbMoves++;
      nextOrbs.set(orbKey(moved.pos), moved);
    }
    for (const orb of step.orbs ?? []) nextOrbs.set(orbKey(orb.pos), { pos: [...orb.pos], value: orb.value });
    this.orbs = nextOrbs; this.createOrbViews();
    this.audio.play('sfx_s3_opad');
    await this.reels.cascade(step, ctx.skip);
    this.currentGrid = cloneGrid(step.grid);
    for (const orb of step.orbs ?? []) this.orbLanded(orb);
    this.camera.kick(3);
    await tw.wait(120 * ctx.tempo, { token: ctx.skip });
  }

  shards(center, tint, reduced) {
    const size = this.reels.cell, n = reduced ? 3 : this.particles.count([12, 7, 3]);
    for (let i = 0; i < n; i++) {
      const angle = fxRng.range(0, Math.PI * 2), speed = fxRng.range(2, 5) * size;
      this.shardLayer.spawn({ x: center.x, y: center.y, vx: Math.cos(angle) * speed * (reduced ? 0.25 : 1), vy: Math.sin(angle) * speed,
        g: size * 9, drag: 1.5, life: fxRng.range(0.35, 0.7), s0: size / 64 * fxRng.range(0.12, 0.28), s1: 0,
        rot: angle, vrot: reduced ? 0 : fxRng.range(-8, 8), tint, frame: `shard${fxRng.int(0, 11)}`, kind: KIND.SPARK, prio: 1 });
    }
  }

  clearOrbViews() { for (const v of this.orbViews.values()) { this.gameApp.tweener.killTweensOf(v.root); v.root.destroy({ children: true }); } this.orbViews.clear(); }

  createOrbViews() {
    this.clearOrbViews();
    this.collecting = false;
    for (const [key, orb] of this.orbs) {
      const root = new this.PIXI.Container();
      const glow = new this.PIXI.Sprite(this.tex.radial); glow.anchor.set(0.5); glow.tint = orbTint(orb.value); glow.blendMode = 'add'; glow.alpha = 0.45;
      const label = this.makeText(`×${orb.value}`, 24, 0x070a1f); label.style.stroke = { color: 0xffe08a, width: 2 };
      root.addChild(glow, label); this.orbLayer.addChild(root);
      this.orbViews.set(key, { root, glow, label, orb });
    }
    this.syncOrbs();
  }

  syncOrbs() {
    if (this.collecting || !this.reels) return;
    const win = this.reels.windowRect;
    for (const view of this.orbViews.values()) {
      const [col, row] = view.orb.pos, slot = this.reels.slotAt(col, row);
      if (!slot) continue;
      const lifted = this.reels.reels[col].lifted.has(slot);
      const x = slot.root.x + (lifted ? 0 : this.reels.reels[col].container.x);
      const y = slot.root.y + (lifted ? 0 : this.reels.reels[col].container.y);
      view.root.position.set(x, y);
      view.root.visible = (!this.reels.spinning || this.reels.landing) && y >= win.y && y <= win.y + win.h;
      view.root.scale.set(slot.root.scale.x);
      view.label.style.fontSize = Math.max(12, this.reels.cell * (view.orb.value >= 100 ? 0.27 : 0.34));
      view.glow.width = view.glow.height = this.reels.cell * 0.95;
      view.glow.alpha = this.gameApp.motion.reduced ? 0.35 : 0.35 + 0.15 * Math.sin(this.time / 300);
    }
  }

  orbLanded(orb) {
    this.s3Stats.orbLandings++;
    const c = this.reels.cellCenter(...orb.pos);
    this.audio.play('sfx_s3_mnoznik', { detune: orb.value >= 50 ? 200 : orb.value >= 10 ? 100 : 0 });
    this.particles.twinkles('fxAdd', c.x, c.y, this.reels.cell * 0.45, this.reels.cell * 0.45, this.particles.count([8, 5, 2]), { tint: orbTint(orb.value) });
  }

  async onApplyMultiplier(step, ctx) {
    const tw = this.gameApp.tweener, reduced = this.gameApp.motion.reduced;
    this.s3Stats.collections++;
    this.clearClusters(); this.syncOrbs(); this.collecting = true;
    const views = [...this.orbViews.values()].sort((a,b) => a.orb.pos[0] - b.orb.pos[0] || a.orb.pos[1] - b.orb.pos[1]);
    const total = this.makeText(`${formatAmount(step.baseWin)}  ×0`, Math.max(22, this.reels.cell * 0.45));
    const target = () => ({ x: this.gameApp.layout.w / 2, y: this.gameApp.layout.h * 0.3 });
    total.position.copyFrom(target()); this.gameApp.layers.amounts.addChild(total);
    this.audio.play('sfx_s3_mnoznik_zbior');
    const collectionStart = tw.now;
    for (const view of views) {
      const symbol = new this.PIXI.Sprite(this.views.get('mnoznik').main);
      symbol.anchor.set(0.5); symbol.width = symbol.height = this.reels.cell * 0.94;
      view.root.addChildAt(symbol, 0);
      const slot = this.reels.slotAt(...view.orb.pos);
      if (slot) slot.root.alpha = 0;
    }
    let arrived = 0;
    const flights = views.map((v, i) => {
      const start = { x: v.root.x, y: v.root.y }, delay = (120 + i * Math.min(220, 280 / Math.max(1, views.length - 1))) * ctx.tempo;
      return tw.tween(450 * ctx.tempo, (_e, u) => {
        const end = target();
        if (reduced) v.root.alpha = 1 - u;
        else {
          const k = u * u * u;
          v.root.position.set(start.x + (end.x - start.x) * k, start.y + (end.y - start.y) * k - Math.sin(Math.PI * k) * this.reels.cell * 1.2);
          v.root.scale.set(1 - k * 0.5);
        }
      }, { delay, token: ctx.skip, target: v.root }).promise.then(() => { arrived += v.orb.value; total.text = `${formatAmount(step.baseWin)}  ×${arrived}`; v.root.visible = false; });
    });
    await Promise.all(flights);
    total.text = `${formatAmount(step.baseWin)}  ×${step.orbsSum}`;
    await tw.wait(Math.max(0, collectionStart + 900 * ctx.tempo - tw.now), { token: ctx.skip });
    if (!reduced && !ctx.skip.skipped) this.flash.fire({ tint: 0xc77dff, alpha: 0.35, attack: 60, decay: 420, radial: true, hero: true }, { name: 's3-mnoznik' });
    this.camera.add(0.4);
    const final = step.baseWin + step.win;
    await tw.tween(600 * ctx.tempo, (e) => { total.text = formatAmount(step.baseWin + (final - step.baseWin) * e); total.position.copyFrom(target()); }, { ease: 'easeOutCubic', token: ctx.skip, target: total }).promise;
    total.text = formatAmount(final); this.ui.winField?.(step.totalWin);
    this.audio.play('sfx_licznik_koniec');
    await tw.wait(400 * ctx.tempo, { token: ctx.skip });
    total.destroy(); this.collecting = false; this.clearOrbViews();
  }

  setFreeMode(free, duration = 800) {
    this.freeMode = free;
    if (!this.bgFs) return;
    this.gameApp.tweener.killTweensOf(this.bgFs);
    this.gameApp.tweener.to(this.bgFs, { alpha: free ? 1 : 0 }, { duration: this.gameApp.motion.reduced ? Math.min(300, duration) : duration });
    this.modeLabel.text = free ? 'DARMOWE SPINY · KULE MNOŻNIKÓW' : '5+ POŁĄCZONYCH SYMBOLI';
  }

  async onFreeSpinsStart(step, ctx) {
    this.clearClusters(); this.reels.dropAll();
    this.ui.freeSpins?.({ left: step.count, total: step.count });
    this.audio.play('sfx_free_spins_start'); this.setFreeMode(true);
    this.audio.engine.playMusic('mus_s3_fs', { fadeMs: 800 });
    if (!this.gameApp.motion.reduced && !ctx.skip.skipped) this.flash.fire('fs');
    await this.showNotice('DARMOWE SPINY', `${step.count} SPINÓW · ZBIERAJ MNOŻNIKI`, ctx, true);
  }

  async onFreeSpinsRetrigger(step, ctx) {
    this.s3Stats.retriggers++;
    this.audio.play('sfx_scatter_3'); this.audio.play('sfx_poziom_w_gore');
    this.ui.freeSpins?.({ left: step.freeSpinsLeft });
    await this.showNotice(`+${step.added} SPINÓW`, `POZOSTAŁO: ${step.freeSpinsLeft}`, ctx);
  }

  async onFreeSpinsEnd(step, ctx) {
    this.audio.play('sfx_free_spins_koniec');
    const tier = tierFor(step.freeSpinsWin / ctx.bet);
    if (step.freeSpinsWin / ctx.bet >= 15) await this.runBigWin({ amount: step.freeSpinsWin, base: ctx.shownWin - step.freeSpinsWin, tier, ctx });
    else await this.showNotice('KONIEC DARMOWYCH SPINÓW', `WYGRANA: ${formatAmount(step.freeSpinsWin)}`, ctx);
    this.ui.freeSpins?.(null);
    this.setFreeMode(false); this.clearOrbViews(); this.orbs.clear();
    this.audio.engine.playMusic('mus_s3', { fadeMs: 900 });
  }

  layoutNotice() {
    if (!this.notice) return;
    const { root, shade, title, subtitle, art } = this.notice, { w, h } = this.gameApp.layout;
    shade.width = w; shade.height = h;
    title.position.set(w / 2, h * (art ? 0.63 : 0.43)); title.style.fontSize = Math.max(22, Math.min(54, w * 0.055));
    subtitle.position.set(w / 2, h * (art ? 0.73 : 0.56)); subtitle.style.fontSize = Math.max(13, Math.min(24, w * 0.029));
    if (art) { art.position.set(w / 2, h * 0.37); art.scale.set(Math.min(w * 0.62 / art.texture.width, h * 0.39 / art.texture.height)); }
    void root;
  }

  async showNotice(titleText, subtitleText, ctx, banner = false) {
    const P = this.PIXI, tw = this.gameApp.tweener;
    const root = new P.Container(), shade = new P.Sprite(P.Texture.WHITE); shade.tint = 0x070a1f; shade.alpha = 0.82;
    const title = this.makeText(titleText, 40), subtitle = this.makeText(subtitleText, 22, 0xbdfbe7);
    const tex = banner ? this.resources.texture('g_win_free_spins') : null;
    const art = tex ? new P.Sprite(tex) : null;
    if (art) art.anchor.set(0.5);
    root.addChild(shade); if (art) root.addChild(art); root.addChild(title, subtitle);
    this.gameApp.layers.bigwin.addChild(root); this.notice = { root, shade, title, subtitle, art }; this.layoutNotice();
    root.alpha = 0;
    await tw.to(root, { alpha: 1 }, { duration: 240, token: ctx.skip }).promise;
    await tw.wait(1400 * Math.max(0.6, ctx.tempo), { token: ctx.skip });
    await tw.to(root, { alpha: 0 }, { duration: 240, token: ctx.skip }).promise;
    this.notice = null; root.destroy({ children: true });
  }

  async afterStep(step, ctx) {
    await super.afterStep(step, ctx);
    this.s3History.push({ type: step.type, grid: cloneGrid(this.reels.grid), orbs: [...this.orbs.values()].map((o) => ({ pos: [...o.pos], value: o.value })), shownWin: ctx.shownWin, freeMode: this.freeMode });
    if (this.s3History.length > 200) this.s3History.shift();
    const next = ctx.steps[ctx.index + 1];
    if ((!next || next.type === 'spin' || next.type.startsWith('freeSpins')) && ctx.shownWin === ctx.state.unitStart) {
      for (const v of this.orbViews.values()) this.gameApp.tweener.to(v.root, { alpha: 0 }, { duration: 250, token: ctx.skip });
    }
  }

  debugInfo() { return { ...super.debugInfo(), s3: { grid: cloneGrid(this.reels.grid), orbs: [...this.orbs.values()], freeMode: this.freeMode, sequence: this.sequence, stats: { ...this.s3Stats }, history: this.s3History } }; }
}
