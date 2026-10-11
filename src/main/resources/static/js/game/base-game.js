/**
 * game/base-game.js — wspólna podstawa automatów: zasoby, systemy efektów, bębny, linie, Big Win, prezentacja
 * wygranych i DOMYŚLNE handlery wszystkich typów kroków (09 § 2.4).
 *
 * Gra konkretna (S1: games/s1.js) dziedziczy po BaseGame i dopisuje tylko to, co ma własne: scenę (tło, ramkę,
 * logo), symbole, efekty specjalne (E50, E51) i idiomy symboli. S2 rozwija WILD i darmowe spiny,
 * a S3 odgrywa klastry, kaskady i kule mnożnika. Wspólne handlery poniżej pozostają wersjami domyślnymi.
 *
 * Prezentacja wygranej w „jednostkach” (04 § 2.19): (1) spin bazowy z jego krokami, (2) każdy darmowy spin,
 * (3) podsumowanie darmowych spinów. Mnożnik jednostki m = (totalWin po − totalWin przed) / bet wybiera oprawę
 * small … ultra według progów z briefu § 3 (jedyna arytmetyka frontu — tylko wybór oprawy, nie kwoty). W rundzie
 * bez darmowych spinów wyliczony poziom MUSI równać się polu `tier` — rozjazd liczymy w `stats.tierMismatch`.
 */

import { Resources, ensureFonts } from './core/resources.js';
import {
  buildFxAtlas, buildNormalAtlas, buildHelperTextures, drawRays, drawFlare, drawLightning, drawBanner, buildGoldDigits,
} from './core/canvas-art.js';
import { SkipToken } from './core/tween.js';
import { easeOutBack, easeOutQuad, easeInOutSine, easeOutQuart, punch, clamp } from './core/easing.js';
import { Pool } from './core/pool.js';
import { ParticleSystem } from './fx/particles.js';
import { FlashGovernor, ScreenFlash, BACKGROUND } from './fx/flash.js';
import { Camera } from './fx/camera.js';
import { Rays, OneShots, Shine, Bloom, warmUpShaders } from './fx/effects.js';
import { DigitFont, DigitText } from './fx/digits.js';
import { BigWin, LEVELS as BIG_LEVELS } from './fx/bigwin.js';
import { ReelSet } from './reels/reelset.js';
import { WinLines } from './reels/paylines.js';
import { StepPlayer } from './step-player.js';
import { GameAudio } from './audio/game-audio.js';
import { formatAmount, formatSigned } from '../format.js';

/** Kolejność poziomów prezentacji (brief § 3). */
export const TIER_ORDER = { none: 0, small: 1, medium: 2, big: 3, mega: 4, epic: 5, ultra: 6 };

/** Poziom prezentacji dla mnożnika m — progi z briefu § 3 (te same co pole `tier` w 09 § 2.4). */
export function tierFor(m) {
  if (!(m > 0)) return 'none';
  if (m >= 100) return 'ultra';
  if (m >= 60) return 'epic';
  if (m >= 30) return 'mega';
  if (m >= 15) return 'big';
  if (m >= 5) return 'medium';
  return 'small';
}

const yieldFrame = () => new Promise((r) => requestAnimationFrame(() => r()));

export class BaseGame extends EventTarget {
  /**
   * @param {{gameApp: import('./core/app.js').GameApp, slot: object, config: object, ui: object}} o
   *   config: { reels, rows, timing, fillerWeights, music, reelLoop, bgLuma, lineColors, wildCode, engine }
   *   ui: callbacki kontrolera panelu — winField(v), book(), dim(on), panelTarget(), announce(t), haptic(id), freeSpins(info)
   */
  constructor({ gameApp, slot, config, ui }) {
    super();
    this.gameApp = gameApp;
    this.slot = slot;
    this.config = config;
    this.ui = ui;
    this.resources = new Resources(gameApp);
    this.audio = new GameAudio({ key: config.soundKey ?? 's1', music: config.music, reelLoop: config.reelLoop, reels: config.reels });
    this.views = new Map();
    this.stats = { rounds: 0, tierMismatch: 0, bigWins: 0, jackpots: 0, wildMultipliers: 0, anticipations: 0 };
    this.idle = true;
    this.presentToken = null;
    this.cycleToken = null;
    this.player = new StepPlayer({
      hooks: {
        afterStep: (step, ctx) => this.afterStep(step, ctx),
      },
    });
    for (const type of ['spin', 'win', 'feature', 'cascade', 'expandWild', 'applyMultiplier', 'freeSpinsStart', 'freeSpinsRetrigger', 'freeSpinsEnd']) {
      const method = `on${type[0].toUpperCase()}${type.slice(1)}`;
      this.player.register(type, (step, ctx) => this[method](step, ctx));
    }
  }

  get PIXI() {
    return this.gameApp.PIXI;
  }

  // =========================================================================================== ładowanie (E20)

  /** Obrazy do pobrania: wspólne efekty + obrazy gry (podklasa: `imageRequests()`). */
  #globalRequests() {
    const r = [{ id: 'g_fx_promienie' }, { id: 'g_fx_flara' }, { id: 'g_fx_dym' }, { id: 'g_win_free_spins' }];
    for (let i = 0; i < 8; i++) r.push({ id: `g_fx_iskry__${i}` });
    for (let i = 0; i < 12; i++) r.push({ id: `g_fx_konfetti__${i}` });
    for (let i = 0; i < 3; i++) r.push({ id: `g_fx_blyskawice__${i}` });
    for (const id of ['g_moneta_przod', 'g_moneta_skos', 'g_moneta_bok']) r.push({ id, variant: 'male' }, { id });
    for (const L of BIG_LEVELS) r.push({ id: L.banner }, { id: L.banner, variant: 'glow' });
    const font = this.resources.font('CebulionCyfry');
    for (const c of Object.values(font?.chars ?? {})) r.push({ id: c.image });
    return r;
  }

  /**
   * Wczytuje i przygotowuje wszystko przed pokazaniem gry. Wagi postępu (04 E20): obrazy 60%, grafika z kodu
   * i przygotowanie 25%, wgranie na GPU i shadery 15%.
   */
  async load(onProgress = () => {}) {
    // bajty dźwięków krytycznych pobieramy równolegle z grafiką (E20); dekodowanie — po geście „Graj”
    const soundBytes = this.audio.prefetchCritical();
    await this.resources.loadManifest();
    const requests = [...this.#globalRequests(), ...this.imageRequests()];
    await this.resources.load(requests, (p) => onProgress(p * 0.6));
    await ensureFonts(['400 64px "Bungee"', '800 64px "Manrope"', '900 64px "Cinzel"', '700 64px "Cinzel"']);
    onProgress(0.62);
    const { PIXI } = this;
    const R = this.resources;
    this.tex = buildHelperTextures(PIXI);
    this.fxAtlas = buildFxAtlas(PIXI, R);
    this.normalAtlas = buildNormalAtlas(PIXI, R);
    this.tex.rays = R.texture('g_fx_promienie') ?? drawRays(PIXI);
    this.tex.flare = R.texture('g_fx_flara') ?? drawFlare(PIXI);
    this.tex.lightning = [0, 1, 2].map((i) => R.texture(`g_fx_blyskawice__${i}`) ?? drawLightning(PIXI, i));
    await yieldFrame();
    onProgress(0.7);
    this.digitFont = DigitFont.fromManifest(PIXI, R) ?? new DigitFont(PIXI, buildGoldDigits(PIXI, 96));
    const bannerSpec = [
      { lines: ['BIG', 'WIN'], accent: '#FFF3D1' },
      { lines: ['MEGA', 'WIN'], accent: '#FF2E88', accent2: '#21E6FF' },
      { lines: ['EPIC', 'WIN'], accent: '#8F3DFF', accent2: '#FF2E88' },
      { lines: ['ULTRA', 'WIN'], accent: '#21E6FF', accent2: '#FF2E88', rainbow: true },
    ];
    this.banners = [];
    this.bannerGlows = [];
    for (let i = 0; i < BIG_LEVELS.length; i++) {
      this.banners.push(R.texture(BIG_LEVELS[i].banner) ?? drawBanner(PIXI, bannerSpec[i]));
      this.bannerGlows.push(R.texture(BIG_LEVELS[i].banner, 'glow'));
      await yieldFrame();
    }
    onProgress(0.76);
    await this.buildViews((p) => onProgress(0.76 + p * 0.1));
    this.#buildSystems();
    this.buildScene();
    this.#relayout();
    this.gameApp.addEventListener('resize', () => this.#relayout());
    onProgress(0.9);
    // shadery (bloom, połysk) rozgrzewamy renderem do pozaekranowej RenderTexture (04 § 2.6), tekstury — na GPU
    this.bloom.warmUp();
    warmUpShaders(this.gameApp, this.fxAtlas.frames.iskra2, [this.bloom.filter, this.shine.makeFilter()]);
    await this.gameApp.prepare(this.gameApp.app.stage);
    // dźwięki czekają najwyżej 4 s — wolna sieć nie może zablokować gry (dograją się po „Graj”)
    await Promise.race([soundBytes, new Promise((r) => setTimeout(r, 4000))]);
    this.gameApp.quality.suspend(1500);
    onProgress(1);
  }

  #buildSystems() {
    const ga = this.gameApp;
    const L = ga.layers;
    this.governor = new FlashGovernor(ga.tweener, ga.motion);
    this.governor.background = this.config.bgLuma ?? BACKGROUND.dark;
    this.flash = new ScreenFlash(ga, this.governor, this.tex.radial);
    this.camera = ga.addSystem(new Camera(ga), 50);
    this.particles = ga.addSystem(new ParticleSystem(ga), 40);
    this.shots = new OneShots(ga, { flare: this.tex.flare, ring: this.fxAtlas.frames.iskra7, lightning: this.tex.lightning, governor: this.governor });
    this.shine = new Shine(ga);
    // cząsteczki: tło (P3), świat (monety normalnie, iskry add), big win (monety z tyłu i z przodu, iskry)
    this.particles.addLayer('bg', L.bgParticles, this.fxAtlas, 'add', { uvs: false });
    this.particles.addLayer('fxNormal', L.fxNormal, this.normalAtlas, 'normal');
    this.particles.addLayer('fxAdd', L.fxAdd, this.fxAtlas, 'add', { uvs: false });
    // bębny
    this.reels = new ReelSet(ga, {
      reels: this.config.reels,
      rows: this.config.rows,
      views: this.views,
      filler: this.#fillerPicker(),
      timing: this.config.timing,
    });
    L.reels.addChild(this.reels.root);
    this.reels.addEventListener('approach', (e) => this.onReelApproach(e.detail));
    this.reels.addEventListener('stop', (e) => this.onReelStop(e.detail));
    this.reels.addEventListener('anticipation', (e) => this.onAnticipation(e.detail));
    ga.addSystem(this.reels, 20);
    // przyciemnienie niewygrywających (L4) — jeden prostokąt nad oknem (04 § 2.13)
    this.dimRect = new this.PIXI.Sprite(this.PIXI.Texture.WHITE);
    this.dimRect.tint = 0x07060f;
    this.dimRect.alpha = 0;
    L.dim.addChild(this.dimRect);
    this.winGlows = new Pool(() => {
      const s = new this.PIXI.Sprite();
      s.anchor.set(0.5);
      s.blendMode = 'add';
      return s;
    }, (s) => { s.removeFromParent(); s.alpha = 0; s.visible = true; });
    this.lines = new WinLines(ga, L.lines, { core: this.tex.lineCore, glow: this.tex.lineGlow }, this.reels, this.slot.paylines ?? [], { colors: this.config.lineColors ?? [0xff2e88, 0x21e6ff] });
    // kwota na scenie (L11) i winieta
    this.vignette = new this.PIXI.Sprite(this.tex.vignette);
    this.vignette.alpha = 0.25;
    L.amounts.addChild(this.vignette);
    this.amountRoot = new this.PIXI.Container();
    this.amountRays = new Rays(ga, this.amountRoot, this.tex.rays);
    this.amountDigits = new DigitText(this.digitFont, { height: 48, shade: this.tex.radial });
    this.amountText = new this.PIXI.Text({ text: '', style: { fontFamily: 'Manrope, system-ui, sans-serif', fontWeight: '800', fontSize: 28, fill: '#FFFFFF', stroke: { color: '#07060F', width: 5 } } });
    this.amountText.anchor.set(0.5);
    this.amountRoot.addChild(this.amountDigits.root, this.amountText);
    this.amountRoot.visible = false;
    L.amounts.addChild(this.amountRoot);
    this.lineAmount = new DigitText(this.digitFont, { height: 40, shade: this.tex.radial });
    this.lineAmount.root.visible = false;
    L.amounts.addChild(this.lineAmount.root);
    // big win
    this.bigwin = new BigWin({
      gameApp: ga, particles: this.particles, flash: this.flash, camera: this.camera, shots: this.shots, shine: this.shine, audio: this.audio,
      digits: new DigitText(this.digitFont, { height: 110 }), banners: this.banners, bannerGlows: this.bannerGlows, radialTexture: this.tex.radial,
      makeRays: (host) => new Rays(ga, host, this.tex.rays),
    });
    this.particles.addLayer('bwBack', this.bigwin.backCoins, this.normalAtlas, 'normal');
    this.particles.addLayer('bwAdd', this.bigwin.addFx, this.fxAtlas, 'add', { uvs: false });
    this.particles.addLayer('bwFront', this.bigwin.frontCoins, this.normalAtlas, 'normal');
    this.bigwin.addFx.blendMode = 'add';
    this.bloom = new Bloom(ga, [L.fxAdd, this.bigwin.addFx]);
    ga.addSystem({ update: (dt) => this.bigwin.update(dt) }, 45);
    ga.addSystem({ update: (dt) => { this.amountRays.update(dt); this.update(dt); } }, 35);
    ga.addSystem(this.bloom, 60);
    ga.quality.addEventListener('change', () => this.onQualityChange());
  }

  /** Wizualna taśma: wagi symboli (niższe częściej — tak wygląda prawdziwa taśma automatu). */
  #fillerPicker() {
    const entries = Object.entries(this.config.fillerWeights);
    const total = entries.reduce((a, [, w]) => a + w, 0);
    return (r) => {
      let x = r * total;
      for (const [code, w] of entries) {
        if ((x -= w) < 0) return code;
      }
      return entries[0][0];
    };
  }

  #relayout() {
    const lay = this.gameApp.layout;
    // zmiana układu po rundzie (obrót telefonu w fazie cyklu linii): gasimy prezentację — linie, poświaty i kwoty
    // policzone dla starej geometrii nie mogą zostać w złych miejscach; w trakcie rundy sloty same idą za układem
    if (this.idle && this.presentation) this.clearPresentation();
    const geo = this.layoutScene(lay);
    if (geo) this.reels.layout(geo.x, geo.y, geo.cell, geo.gap ?? 0);
    const win = this.reels.windowRect;
    this.dimRect.position.set(win.x - (geo?.gap ?? 0), win.y);
    this.dimRect.width = win.w + 2 * (geo?.gap ?? 0);
    this.dimRect.height = win.h;
    this.vignette.width = lay.w;
    this.vignette.height = lay.h;
    this.bigwin.relayout();
    this.bloom.resize(lay.w, lay.h);
    this.amountDigits.setHeight(Math.max(30, this.reels.cell * 0.3));
    this.lineAmount.setHeight(Math.max(24, this.reels.cell * 0.22));
    this.afterLayout();
  }

  /** Po przeliczeniu układu i bębnów — gra przestawia własne obiekty zależne od pól (np. poświaty WILD w S1). */
  afterLayout() {}

  onQualityChange() {
    // limit cząsteczek, drżenie i filtry działają od razu; rozdzielczość — dopiero między rundami (kontroler)
    this.audio.engine.setQuality(this.gameApp.quality.level);
    this.reels.restyle();
  }

  // =========================================================================================== do nadpisania

  imageRequests() { return []; }
  async buildViews() {}
  buildScene() {}
  /** @returns {{x: number, y: number, cell: number, gap: number}} geometria okna bębnów */
  layoutScene() { return null; }
  update() {}
  async intro() { this.audio.intro(); }
  onSpinStart() {}
  onReelApproach({ reel, inMs, quick, codes }) {
    this.audio.reelApproach(reel, inMs, { quick, codes, wildCode: this.config.wildCode });
  }
  onReelStop({ reel, last }) {
    this.audio.reelStop(reel, { last, turbo: this.tempo < 1 });
    this.landSlots(reel);
  }
  onAnticipation() {}
  onAnticipationEnd() {}
  symbolIdiom() {}
  /** Prezentacja jednej linii (faza a) — S1 dokłada E50 dla `wildMultiplier: 2`. */
  async onLinePresented() {}
  /**
   * Czy prezentacja linii sama pokaże kwotę rundy (jedyna wygrana z własną animacją kwoty, np. E50 „+200 → +400”)?
   * Wtedy nie stawiamy drugiej, gotowej kwoty na środku okna — zdradziłaby wynik animacji i dublowała liczbę.
   */
  lineOwnsAmount() { return false; }

  /** Squash & stretch symboli bębna, który właśnie stanął (04 § 2.13): × 1,5 dla symboli specjalnych. */
  landSlots(reel) {
    if (this.gameApp.motion.reduced) return;
    const tw = this.gameApp.tweener;
    for (const s of this.reels.visibleSlots(reel)) {
      const special = s.code === this.config.wildCode || s.code === 'scatter';
      const a = special ? 1.5 : 1;
      const d = special ? 160 / 120 : 1;
      tw.killTweensOf(s.body);
      tw.tween(120 * d, (_e, u) => {
        const t = u * 120;
        let sx;
        let sy;
        if (t < 40) { const k = easeOutQuad(t / 40); sx = 1 + 0.06 * a * k; sy = 1 - 0.08 * a * k; }
        else if (t < 80) { const k = easeInOutSine((t - 40) / 40); sx = 1 + 0.06 * a - 0.1 * a * k; sy = 1 - 0.08 * a + 0.14 * a * k; }
        else { const k = easeOutBack(1.2)((t - 80) / 40); sx = 1 - 0.04 * a + 0.04 * a * k; sy = 1 + 0.06 * a - 0.06 * a * k; }
        s.body.scale.set(sx, sy);
      }, { target: s.body });
    }
  }

  // =========================================================================================== sterowanie rundą

  /** E24: start obrotu w klatce kliknięcia (przed odpowiedzią serwera). */
  startSpin({ tempo = 1, autoplay = false, free = false } = {}) {
    this.tempo = tempo;
    this.idle = false;
    // darmowy spin startuje WEWNĄTRZ rundy — nie przewijamy wtedy jej tokenu (reszta rundy musi się odegrać)
    this.clearPresentation({ keepRound: free });
    this.governor.clearReservations();
    this.reels.startSpin({ tempo });
    this.audio.spinStart({ autoplay, free });
    this.onSpinStart({ tempo });
  }

  /** Odgrywa odpowiedź spinu. Zwraca kontekst rundy. */
  async play(response, { tempo = 1, autoplay = false } = {}) {
    this.tempo = tempo;
    this.autoplay = autoplay;
    this.presentToken = new SkipToken();
    this.stats.rounds += 1;
    this.booked = false;
    const ctx = await this.player.play(response, { tempo, autoplay, token: this.presentToken });
    this.idle = true;
    return ctx;
  }

  /** Szybki stop (bębny) albo przewinięcie prezentacji — zależnie od fazy. */
  skip() {
    if (this.reels.spinning) {
      this.reels.slam();
      return 'slam';
    }
    if (this.bigwin.active) {
      this.bigwin.skip();
      return 'bigwin';
    }
    this.presentToken?.skip();
    return 'present';
  }

  /** E40: łagodne zatrzymanie na planszy sprzed spinu. */
  async abort() {
    this.audio.networkError();
    await this.reels.abort();
    this.camera.reset();
    this.idle = true;
  }

  get bigWinActive() {
    return this.bigwin.active;
  }

  // =========================================================================================== handlery kroków

  /** Krok `spin` (base / free): E25 → E26 (+ E33/E34), antycypacja z pola `anticipation` (04 § 2.19). */
  async onSpin(step, ctx) {
    ctx.state.unitStart = ctx.shownWin;
    ctx.state.unitPresented = false;
    ctx.state.cascadeNo = 0;
    if (step.phase === 'free') {
      ctx.state.free = true;
      this.ui.freeSpins?.({ index: step.freeSpinIndex, left: step.freeSpinsLeft });
      if (!this.reels.spinning) this.startSpin({ tempo: ctx.tempo, autoplay: true, free: true });
    }
    this.currentGrid = step.grid;
    const land = this.reels.land(step.grid, { anticipation: step.anticipation ?? [] });
    // rezerwacja błysku-bohatera (04 § 1.4): reżyser zna jednostkę z góry — jeśli skończy się big win,
    // błyski WILD na ostatnich bębnach nie mogą zabrać miejsca uderzeniu banera
    const unitTier = this.#unitTier(ctx);
    if (TIER_ORDER[unitTier] >= TIER_ORDER.big) {
      const lastStop = Math.max(...this.reels.reels.map((r) => r.plan.stopAt)) - this.reels.time;
      const jackpot = ctx.next('feature').some((s) => s.name === 'neonJackpot');
      this.governor.reserve(lastStop + (jackpot ? 300 : 300), 'uderzenie');
    }
    if ((step.anticipation ?? []).length) this.stats.anticipations += 1;
    await land;
    this.onAnticipationEnd();
  }

  /** Poziom jednostki prezentacji, do której należy bieżący krok `spin` (podgląd do następnego `spin`). */
  #unitTier(ctx) {
    const start = ctx.state.unitStart ?? 0;
    let end = start;
    for (const s of ctx.steps.slice(ctx.index + 1)) {
      if (s.type === 'spin' || s.type === 'freeSpinsStart' || s.type === 'freeSpinsEnd') break;
      if (typeof s.totalWin === 'number') end = s.totalWin;
    }
    return tierFor((end - start) / ctx.bet);
  }

  /** Krok `win` (S1, S2): prezentacja jednostki — E28 / E29 albo E30 → E31 … → E32 (+ E50 w S1). */
  async onWin(step, ctx) {
    if (this.config.engine === 'CLUSTER') return this.onClusterWin(step, ctx);
    const start = ctx.state.unitStart ?? 0;
    const unitWin = step.totalWin - start;
    const m = unitWin / ctx.bet;
    const tier = tierFor(m);
    // kontrola zgodności z polem `tier` (runda bez darmowych spinów = jedna jednostka)
    if (!ctx.all('freeSpinsStart').length && ctx.next('win').length === 0 && ctx.response.tier && ctx.response.tier !== tier) {
      this.stats.tierMismatch += 1;
      console.warn(`[prezentacja] poziom z frontu „${tier}” ≠ tier z serwera „${ctx.response.tier}” (m = ${m})`);
    }
    ctx.state.unitPresented = true;
    await this.presentWins(step, ctx, { m, tier, amount: unitWin, base: start });
  }

  /** Domyślny `feature` — komunikat z nazwą i mnożnikiem (S1 nadpisuje: E51 NEON JACKPOT). */
  async onFeature(step, ctx) {
    await this.showMessage(`${step.name ?? 'BONUS'}${step.multiplier ? `  ×${step.multiplier}` : ''}`, { ms: 1200 * ctx.tempo, token: ctx.skip });
  }

  /** Domyślna kaskada (S3): pęknięcie usuwanych symboli, potem nowa plansza z opadem (pełna wersja — gra S3). */
  async onCascade(step, ctx) {
    const tw = this.gameApp.tweener;
    const tempo = ctx.tempo;
    for (const [r, row] of step.removed ?? []) {
      const s = this.reels.slotAt(r, row);
      if (!s) continue;
      const c = this.reels.cellCenter(r, row);
      this.particles.sparks('fxAdd', c.x, c.y, this.particles.count([8, 5, 2]), { tint: 0xa64dff, speed: [200, 600] });
      tw.to(s.root, { alpha: 0 }, { duration: 200 * tempo });
      tw.to(s.root, { scale: 0.6 }, { duration: 200 * tempo });
    }
    await tw.wait(280 * tempo, { token: ctx.skip });
    this.reels.dropAll();
    const changed = new Set((step.removed ?? []).map(([r]) => r));
    this.reels.setGrid(step.grid);
    this.currentGrid = step.grid;
    // opad: zmienione kolumny wjeżdżają z góry (uproszczona fizyka — pełna w S3: 04 § 2.15)
    for (const r of changed) {
      for (let row = 0; row < this.config.rows; row++) {
        const s = this.reels.slotAt(r, row);
        if (!s) continue;
        const y = s.root.y;
        s.root.y = y - this.reels.cell * (this.config.rows - row + 1);
        tw.to(s.root, { y }, { duration: 360 * tempo, ease: 'easeOutBounce', delay: r * 40 * tempo });
      }
    }
    await tw.wait(520 * tempo, { token: ctx.skip });
  }

  /** Domyślne rozszerzenie WILD (S2): słup światła na bębnie i podmiana planszy. */
  async onExpandWild(step, ctx) {
    const tw = this.gameApp.tweener;
    for (const r of step.reels ?? []) {
      const c = this.reels.cellCenter(r, Math.floor(this.config.rows / 2));
      this.shots.flare(this.gameApp.layers.fxAdd, c.x, c.y, this.reels.cell * 2, 0xffe08a);
      this.particles.sparks('fxAdd', c.x, c.y, this.particles.count([24, 14, 6]), { tint: 0xffe08a, area: { w: this.reels.cell, h: this.reels.cell * this.config.rows } });
      await tw.wait(250 * ctx.tempo, { token: ctx.skip });
    }
    this.reels.setGrid(step.grid);
    this.currentGrid = step.grid;
    await tw.wait(300 * ctx.tempo, { token: ctx.skip });
  }

  /** Domyślne `applyMultiplier` (S3, FS): „×N” i doliczenie w polu wygranej. */
  async onApplyMultiplier(step, ctx) {
    this.audio.play('sfx_s3_mnoznik_zbior');
    await this.showMessage(`×${step.orbsSum}`, { ms: 900 * ctx.tempo, token: ctx.skip });
    this.ui.winField?.(step.totalWin);
  }

  async onFreeSpinsStart(step, ctx) {
    this.audio.play('sfx_free_spins_start');
    this.ui.freeSpins?.({ left: step.count, total: step.count });
    await this.showMessage(`DARMOWE SPINY  ×${step.count}`, { ms: 1800 * Math.max(0.6, ctx.tempo), token: ctx.skip, texture: this.resources.texture('g_win_free_spins') });
  }

  async onFreeSpinsRetrigger(step, ctx) {
    this.ui.freeSpins?.({ left: step.freeSpinsLeft });
    await this.showMessage(`+${step.added} SPINÓW`, { ms: 1200 * ctx.tempo, token: ctx.skip });
  }

  /** Koniec darmowych spinów: jednostka (3) — Big Win, gdy freeSpinsWin ≥ 15 × bet (E37), inaczej podsumowanie. */
  async onFreeSpinsEnd(step, ctx) {
    this.audio.play('sfx_free_spins_koniec');
    const m = step.freeSpinsWin / ctx.bet;
    const tier = tierFor(m);
    if (TIER_ORDER[tier] >= TIER_ORDER.big) {
      await this.runBigWin({ amount: step.freeSpinsWin, base: ctx.shownWin - step.freeSpinsWin, tier, ctx });
    } else {
      await this.showMessage(`DARMOWE SPINY: +${formatAmount(step.freeSpinsWin)}`, { ms: 1800 * ctx.tempo, token: ctx.skip });
    }
    this.ui.freeSpins?.(null);
  }

  /** S3: wpis klastra — wyróżnienie i kwota; prezentacja sumy jednostki po ostatniej kaskadzie (afterStep). */
  async onClusterWin(step, ctx) {
    const tw = this.gameApp.tweener;
    this.audio.line(ctx.state.cascadeNo = (ctx.state.cascadeNo ?? 0) + 1);
    for (const w of step.wins ?? []) {
      for (const [r, row] of w.positions ?? []) {
        const s = this.reels.lift(r, row, this.gameApp.layers.wins);
        if (s) tw.tween(420 * ctx.tempo, (_e, u) => s.root.scale.set(1 + 0.12 * Math.sin(Math.PI * u)));
      }
    }
    this.ui.winField?.(step.totalWin);
    await tw.wait(450 * ctx.tempo, { token: ctx.skip });
  }

  /** Po każdym kroku: czy jednostka prezentacji (S3) właśnie się skończyła → prezentacja sumy. */
  async afterStep(step, ctx) {
    if (step.type === 'freeSpinsStart') {
      ctx.state.bonusBase = ctx.shownWin;
      ctx.state.bonusActive = true;
    } else if (step.type === 'freeSpinsEnd') {
      ctx.state.bonusActive = false;
    }
    if (ctx.state.bonusActive) {
      this.ui.freeSpins?.({ win: Math.max(0, ctx.shownWin - ctx.state.bonusBase) });
    }
    if (this.config.engine !== 'CLUSTER' || ctx.state.unitPresented) return;
    const next = ctx.steps[ctx.index + 1];
    const ends = !next || next.type === 'spin' || next.type.startsWith('freeSpins');
    if (!ends) return;
    const start = ctx.state.unitStart ?? 0;
    const unitWin = ctx.shownWin - start;
    if (unitWin <= 0) return;
    ctx.state.unitPresented = true;
    const m = unitWin / ctx.bet;
    await this.presentWins({ wins: [], totalWin: ctx.shownWin, win: unitWin }, ctx, { m, tier: tierFor(m), amount: unitWin, base: start });
  }

  // =========================================================================================== prezentacja wygranych

  /**
   * Prezentacja jednostki (E28 / E29 / E30–E32, 04 § 2.16–2.17).
   * @param {{m: number, tier: string, amount: number, base: number}} info
   */
  async presentWins(step, ctx, { m, tier, amount, base }) {
    const ga = this.gameApp;
    const tw = ga.tweener;
    const q = ga.quality;
    const reduced = ga.motion.reduced;
    const tempo = ctx.tempo;
    const token = ctx.skip;
    const big = TIER_ORDER[tier] >= TIER_ORDER.big;
    const medium = tier === 'medium';
    const lineWins = (step.wins ?? []).filter((w) => w.kind === 'line').sort((a, b) => b.amount - a.amount);
    const positions = this.#uniquePositions(step.wins ?? []);
    this.idle = false;

    // przyciemnienie niewygrywających + wygrywające symbole na L5 z poświatą (04 § 2.13)
    if (positions.length) tw.to(this.dimRect, { alpha: 0.55 }, { duration: 200 });
    const lifted = positions.map(([r, row]) => ({ r, row, slot: this.reels.lift(r, row, ga.layers.wins) })).filter((x) => x.slot);
    const glowTint = big ? 0xffe08a : medium ? 0xf5c542 : 0xffe08a;
    for (const l of lifted) {
      const view = this.views.get(l.slot.code);
      if (view?.glow && q.params.bloom !== 'none') {
        const g = this.winGlows.get();
        g.texture = view.glow;
        const size = this.reels.cell * (view.scale ?? 0.9) * (view.glowScale ?? 1.3);
        g.scale.set(size / view.glow.width);
        g.position.copyFrom(l.slot.root.position);
        g.tint = l.slot.code === this.config.wildCode ? 0xff2e88 : glowTint;
        ga.layers.wins.addChildAt(g, 0);
        l.glow = g;
        tw.tween(420, (_e, u) => { g.alpha = u < 0.4 ? (u / 0.4) * 0.9 : 0.9 - 0.4 * ((u - 0.4) / 0.6); });
      }
      this.#pulse(l.slot, reduced ? 1.05 : 1.12);
      if (!reduced) this.symbolIdiom(l.slot, l.slot.code, { tier });
      this.shine.run(l.slot.main, { duration: 550, silhouette: this.#silhouette(l.slot) });
    }
    const amountByLine = !big && lineWins.length === 1 && (step.wins ?? []).length === 1 && this.lineOwnsAmount(lineWins[0]);
    this.presentation = { lifted, lineWins, amountByLine, big, amountPoint: this.#amountPoint() };
    const presentation = this.presentation;

    // dźwięk i efekty według poziomu
    if (!big) {
      if (medium) this.audio.winMedium();
      else this.audio.winSmall(m);
      this.ui.haptic?.(medium ? 'H_sredni' : m >= 1 ? 'H_lekki' : null);
    }
    const center = this.#amountPoint();
    if (medium) {
      this.#localFlash(lifted, 0.6);
      for (const l of lifted) {
        const c = this.reels.cellCenter(l.r, l.row);
        this.particles.sparks('fxAdd', c.x, c.y, this.particles.count([24, 14, 6]), { tint: 0x21e6ff });
      }
      this.camera.add(0.35);
      const coins = this.particles.count([16, 10, 4]);
      for (let i = 0; i < 6; i++) tw.wait((50 + i * 60) * tempo).then(() => this.particles.coinsBurst('fxNormal', center.x, center.y, Math.ceil(coins / 6), { up: true, speed: [600, 1300] }));
      this.audio.coins(6, 350 * tempo);
    } else if (!big && m >= 1) {
      for (const l of lifted) {
        const c = this.reels.cellCenter(l.r, l.row);
        this.particles.twinkles('fxAdd', c.x, c.y, this.reels.cell * 0.45, this.reels.cell * 0.45, this.particles.count([9, 6, 0]), { tint: 0xffe08a });
      }
    }

    // linie kolejno co 350 ms (najwyżej 5 osobno; TURBO × 0,45), każda z „ziiing” (bez dla m < 1 — R3)
    const linesDone = this.#drawLines(lineWins, ctx, { quiet: m < 1, medium });

    if (big) {
      await this.runBigWin({ amount, base, tier, ctx });
      await linesDone;
    } else {
      // kwota na środku okna: m ≥ 1 złote cyfry, m < 1 skromny biały tekst (R3 — nie świętujemy straty)
      const T = clamp(400 + 350 * Math.log2(1 + m), 500, 2000) * tempo * (reduced ? 0.6 : 1);
      await tw.wait((medium ? 60 : 100) * tempo, { token });
      if (!amountByLine) this.#showAmount(amount, { gold: m >= 1, medium, center });
      const ticking = T > 400 && m >= 1;
      if (ticking) this.audio.counterStart();
      await this.#countPanel(base, base + amount, T, token, ticking);
      if (medium) {
        this.audio.counterEnd();
        if (!reduced) tw.tween(380, (e) => this.amountRoot.scale.set(punch(0.3)(e)), { target: this.amountRoot });
        this.particles.sparks('fxAdd', center.x, center.y, this.particles.count([24, 14, 6]), { tint: 0xffe08a });
        this.amountRays.hide(400);
      } else {
        this.audio.counterStop(60);
        if (m >= 1) this.audio.balancePulse();
      }
      this.book();
      this.audio.releaseWinDuck();
      this.ui.announce?.(`Wygrana: ${formatAmount(amount)} cebulionów`);
      // kwota odpływa po 400 ms
      tw.wait(400).then(() => {
        if (this.presentation !== presentation || !this.amountRoot.visible) return;
        const y0 = this.amountRoot.y;
        tw.tween(300, (e) => { this.amountRoot.y = y0 - 20 * ga.layout.k * e; this.amountRoot.alpha = 1 - e; }, {
          target: this.amountRoot,
          onComplete: () => { if (this.presentation === presentation) this.amountRoot.visible = false; },
        });
      });
      await linesDone;
    }
    // faza (b): cykl po liniach co 900 ms do następnego spinu — nie w autoplay / TURBO (04 § 2.16)
    if (lineWins.length > 1 && !ctx.autoplay && tempo >= 1 && !token.skipped) this.#cycleLines(lineWins);
  }

  /** Big Win dla jednostki (E30–E32). `base` — suma rundy przed jednostką (pole WYGRANA liczy od niej). */
  async runBigWin({ amount, base, tier, ctx }) {
    this.stats.bigWins += 1;
    const res = await this.bigwin.play({
      amount, bet: ctx.bet, tier, tempo: ctx.tempo, autoplay: ctx.autoplay, entry: ctx.state.jackpot ? 'jackpot' : 'normal',
      onCount: (v) => this.ui.winField?.(base + v),
      onDim: (on) => this.ui.dim?.(on),
      panelTarget: () => this.ui.panelTarget?.(),
      onLanded: () => {
        this.book();
        this.ui.haptic?.('H_lekki');
      },
    });
    this.ui.announce?.(`Wygrana: ${formatAmount(amount)} cebulionów`);
    return res;
  }

  /** Zaksięgowanie wygranej (saldo → balanceAfter) — dokładnie raz na rundę; kontroler wie, kiedy (E08). */
  book() {
    if (this.booked) return;
    // balanceAfter zawiera wynik CAŁEJ rundy, także wszystkich darmowych spinów.
    // Pokazujemy go dopiero po ostatniej jednostce, żeby nie ujawnić przyszłych wygranych.
    if (this.player.playing && this.player.ctx?.next().length) return;
    this.booked = true;
    this.ui.book?.();
  }

  #uniquePositions(wins) {
    const seen = new Set();
    const out = [];
    for (const w of wins) {
      for (const [r, row] of w.positions ?? []) {
        const k = `${r}:${row}`;
        if (!seen.has(k)) {
          seen.add(k);
          out.push([r, row]);
        }
      }
    }
    return out;
  }

  /** Puls wygranej: 1,00 → 1,12 (160 ms, easeOutQuad) → 1,00 (260 ms, easeInOutSine) = 420 ms. */
  #pulse(slot, peak = 1.12) {
    const tw = this.gameApp.tweener;
    tw.killTweensOf(slot.root);
    tw.tween(420, (_e, u) => {
      const t = u * 420;
      const s = t < 160 ? 1 + (peak - 1) * easeOutQuad(t / 160) : peak - (peak - 1) * easeInOutSine((t - 160) / 260);
      slot.root.scale.set(s);
    }, { target: slot.root });
  }

  #silhouette(slot) {
    const view = this.views.get(slot.code);
    if (!view?.syl) return null;
    if (!slot.syl) {
      slot.syl = new this.PIXI.Sprite(view.syl);
      slot.syl.anchor.set(0.5);
      slot.syl.blendMode = 'add';
      slot.body.addChild(slot.syl);
    }
    slot.syl.texture = view.syl;
    slot.syl.scale.copyFrom(slot.main.scale);
    slot.syl.position.copyFrom(slot.main.position);
    slot.syl.alpha = 0;
    slot.syl.visible = false;
    return slot.syl;
  }

  /** Błysk lokalny `syl` na symbolach (jeden błysk przez strażnika — podłoże: jasny symbol, 04 § 1.4). */
  #localFlash(lifted, alpha) {
    if (!lifted.length) return;
    const { w, h } = this.gameApp.layout;
    const S = this.reels.cell;
    const area = (lifted.length * S * S) / (w * h);
    const res = this.governor.request('syl', { area, alpha, background: BACKGROUND.symbol });
    if (!res.ok) return;
    const tw = this.gameApp.tweener;
    const attack = res.decision === 'soft' ? 150 : 40;
    for (const l of lifted) {
      const syl = this.#silhouette(l.slot);
      if (!syl) continue;
      syl.visible = true;
      tw.tween(attack + 80, (_e, u) => {
        const t = u * (attack + 80);
        syl.alpha = res.alpha * (t < attack ? t / attack : 1 - (t - attack) / 80);
      }, { onComplete: () => { syl.alpha = 0; syl.visible = false; } });
    }
  }

  /** Punkt kwoty: środek okna bębnów. */
  #amountPoint() {
    const r = this.reels.windowRect;
    return { x: r.x + r.w / 2, y: r.y + r.h / 2 };
  }

  #showAmount(amount, { gold, medium, center }) {
    const tw = this.gameApp.tweener;
    const root = this.amountRoot;
    root.visible = true;
    root.alpha = 1;
    root.position.set(center.x, center.y);
    this.amountDigits.root.visible = gold;
    this.amountText.visible = !gold;
    if (gold) {
      this.amountDigits.setHeight(Math.max(30, this.reels.cell * (medium ? 0.36 : 0.3)));
      this.amountDigits.text = formatSigned(amount);
    } else {
      this.amountText.text = formatSigned(amount);
      this.amountText.style.fontSize = Math.max(18, this.reels.cell * 0.17);
    }
    if (medium) {
      this.amountRays.show({ x: 0, y: 0, size: 360 * this.gameApp.layout.k * 1.4, omega: 6, alpha: 0.5, tintA: 0xf5c542, tintB: 0xf5c542 });
      this.amountRays.root.position.set(0, 0);
      root.addChildAt(this.amountRays.root, 0);
    }
    if (this.gameApp.motion.reduced) {
      root.scale.set(1);
      return;
    }
    if (medium) tw.tween(300, (e) => root.scale.set(punch(0.2)(e)), { target: root });
    else tw.tween(250, (e) => root.scale.set(0.6 + 0.4 * e), { ease: easeOutBack(1.7), target: root });
  }

  /** Pole „WYGRANA” liczy synchronicznie (04 § 2.17): wartość(t) = round(W · easeOutQuart(t / T)). */
  #countPanel(from, to, T, token, ticking) {
    const tw = this.gameApp.tweener;
    let last = -1;
    return tw.tween(T, (e, u) => {
      const v = Math.round(from + (to - from) * e);
      if (v !== last) {
        last = v;
        this.ui.winField?.(v);
      }
      if (ticking) this.audio.counterProgress(u);
    }, { ease: easeOutQuart, token, onComplete: () => this.ui.winField?.(to) }).promise;
  }

  async #drawLines(lineWins, ctx, { quiet, medium }) {
    const tw = this.gameApp.tweener;
    const gap = 350 * ctx.tempo;
    for (let i = 0; i < lineWins.length; i++) {
      const w = lineWins[i];
      const line = this.lines.draw(w.line, { tempo: ctx.tempo, glowAlpha: medium ? 0.5 : 0.35 });
      if (!quiet && (ctx.tempo >= 1 || i === 0)) this.audio.line(i + 1);
      await this.onLinePresented(w, line, ctx);
      if (i < lineWins.length - 1 && i < 4) await tw.wait(gap, { token: ctx.skip });
    }
  }

  /** Faza (b): każda linia osobno po 900 ms z kwotą przy środku, pozostałe przygaszone do 0,25 — do następnego spinu. */
  async #cycleLines(lineWins) {
    const token = new SkipToken();
    this.cycleToken = token;
    const tw = this.gameApp.tweener;
    await tw.wait(600, { token });
    while (!token.skipped) {
      for (const w of lineWins) {
        if (token.skipped) break;
        this.lines.focus(w.line);
        const c = this.lines.centerOf(w.line);
        if (c) {
          this.lineAmount.text = formatSigned(w.amount);
          this.lineAmount.root.position.set(c.x, c.y - this.reels.cell * 0.32);
          this.lineAmount.root.visible = true;
          this.lineAmount.root.alpha = 0;
          tw.to(this.lineAmount.root, { alpha: 1 }, { duration: 160 });
        }
        for (const [r, row] of w.positions ?? []) {
          const s = this.presentation?.lifted.find((l) => l.r === r && l.row === row)?.slot;
          if (s) this.#pulse(s, this.gameApp.motion.reduced ? 1.04 : 1.08);
        }
        await tw.wait(900, { token });
      }
    }
    this.lineAmount.root.visible = false;
  }

  /** Gaszenie prezentacji przed kolejnym spinem (E24: linie, obrysy i przyciemnienie gasną w 120 ms). */
  clearPresentation({ keepRound = false } = {}) {
    this.cycleToken?.skip();
    this.cycleToken = null;
    if (!keepRound) this.presentToken?.skip();
    this.lines.clear(120);
    this.gameApp.tweener.killTweensOf(this.dimRect);
    this.gameApp.tweener.to(this.dimRect, { alpha: 0 }, { duration: 120 });
    for (const l of this.presentation?.lifted ?? []) {
      if (l.glow) this.winGlows.release(l.glow);
      this.gameApp.tweener.killTweensOf(l.slot.root);
    }
    this.presentation = null;
    this.reels.dropAll();
    this.gameApp.tweener.killTweensOf(this.amountRoot);
    this.amountRoot.visible = false;
    this.amountRays.hide(120);
    this.lineAmount.root.visible = false;
  }

  /**
   * Komunikat na środku sceny (domyślne handlery S2/S3: darmowe spiny, mnożnik, funkcja specjalna).
   * Obraz z manifestu (np. `g_win_free_spins`) albo złoty napis z kodu.
   */
  async showMessage(text, { ms = 1500, token, texture = null } = {}) {
    const { PIXI } = this;
    const ga = this.gameApp;
    const tw = ga.tweener;
    const { w, h } = ga.layout;
    const root = new PIXI.Container();
    const shade = new PIXI.Sprite(PIXI.Texture.WHITE);
    shade.tint = 0x07060f;
    shade.width = w;
    shade.height = h;
    shade.alpha = 0;
    root.addChild(shade);
    let label;
    if (texture) {
      label = new PIXI.Sprite(texture);
      label.anchor.set(0.5);
      label.scale.set(Math.min((w * 0.8) / texture.width, (h * 0.4) / texture.height));
    } else {
      label = new PIXI.Text({
        text,
        style: {
          fontFamily: 'Cinzel, Georgia, serif', fontWeight: '900', fontSize: Math.max(28, Math.min(w, h) * 0.09), align: 'center',
          fill: new PIXI.FillGradient({ type: 'linear', start: { x: 0, y: 0 }, end: { x: 0, y: 1 }, colorStops: [{ offset: 0, color: '#FFF6D6' }, { offset: 0.5, color: '#F5C542' }, { offset: 1, color: '#B8860B' }], textureSpace: 'local' }),
          stroke: { color: '#3D2700', width: 6 }, dropShadow: { color: '#F5C542', blur: 18, distance: 0, alpha: 0.7 },
          wordWrap: true, wordWrapWidth: w * 0.86,
        },
      });
      label.anchor.set(0.5);
    }
    label.position.set(w / 2, h * 0.45);
    root.addChild(label);
    ga.layers.bigwin.addChild(root);
    const s0 = label.scale.x;
    tw.to(shade, { alpha: 0.55 }, { duration: 200 });
    tw.tween(320, (e) => label.scale.set(s0 * (0.3 + 0.7 * e)), { ease: easeOutBack(1.5), target: label, token });
    this.particles.sparks('fxAdd', w / 2, h * 0.45, this.particles.count([40, 24, 10]), { tint: 0xffe08a });
    await tw.wait(ms, { token });
    await tw.to(root, { alpha: 0 }, { duration: 250 }).promise;
    // Przewinięty komunikat może zniknąć przed końcem animacji wejścia.
    tw.killTweensOf(label);
    tw.killTweensOf(shade);
    root.destroy({ children: true });
  }

  /** Dane do testów e2e i panelu ?fx=debug. */
  debugInfo() {
    return {
      quality: this.gameApp.quality.level,
      p90: this.gameApp.quality.p90,
      fps: this.gameApp.quality.fps,
      particles: this.particles.alive,
      trauma: Number(this.camera.trauma.toFixed(2)),
      flashMaxPerSecond: this.governor.maxPerSecond(),
      heroSkips: this.governor.heroSkips(),
      stats: { ...this.stats },
    };
  }
}

