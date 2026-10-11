/**
 * game/core/app.js — aplikacja PixiJS gry: płótno, warstwy renderu, układ (skala sceny), pętla gry.
 *
 * Najważniejsze decyzje (do obrony):
 *   * `resizeTo` = element sceny, `autoDensity` i rozdzielczość = min(DPR, limit poziomu jakości) — na ekranie
 *     Retina obraz jest ostry, ale nie renderujemy 3× więcej pikseli, niż trzeba (brief § 5: DPR ≤ 2 / 1,5 / 1).
 *   * Warstwy L0–L14 jak w 04 § 7.2. Kontener `world` (L0–L11) drży przy uderzeniach; Big Win (L12) dostaje 35%
 *     drżenia, a licznik wygranej 0% (reguła R1 „wynik jest święty”).
 *   * Pętla: jeden ticker, stała kolejność prac w klatce (04 § 7.3). Najpierw cała LOGIKA (zegar, osie czasu,
 *     bębny, tweeny, cząsteczki, kamera), potem Pixi RYSUJE gotowy stan — logika nigdy nie dzieje się w trakcie
 *     rysowania. `deltaMS` przycinamy do 50 ms, żeby po zacięciu przeglądarki animacje nie „przeskakiwały”.
 *   * Ukryta karta → ticker staje (oszczędność baterii; zegar gry stoi, więc oczekiwania też). Utrata kontekstu
 *     WebGL (sterownik, przełączenie karty graficznej) → pauza i komunikat; po odzyskaniu Pixi wgrywa tekstury
 *     ponownie, a my wznawiamy pętlę.
 */

import { Tweener } from './tween.js';

const PIXI_URL = new URL('../../../vendor/pixi/pixi.min.mjs', import.meta.url).href;
const LAYER_NAMES = ['bg', 'bgParticles', 'under', 'reels', 'dim', 'wins', 'lines', 'frame', 'logo', 'fxNormal', 'fxAdd', 'amounts'];

export class GameApp extends EventTarget {
  /** @type {typeof import('pixi.js')} */ PIXI = null;
  app = null;
  tweener = new Tweener();
  layers = {};
  /** Układ sceny w pikselach CSS: szerokość, wysokość, orientacja, skala referencyjna k (widok 1920×1080). */
  layout = { w: 1, h: 1, portrait: false, k: 1, short: 1 };
  #systems = [];
  #lastW = 0;
  #lastH = 0;
  #resizeObserver = null;
  #contextLost = false;
  #slowFrames = 0;
  frameMs = 16.7;
  /** Pomiar (raport wydajności, ?fx=debug): czas logiki i czas renderu Pixi w ostatnich 600 klatkach (ms). */
  perf = { logic: new Float32Array(600), render: new Float32Array(600), frame: new Float32Array(600), i: 0, n: 0 };
  #renderStart = 0;

  constructor({ container, quality, motion }) {
    super();
    this.container = container;
    this.quality = quality;
    this.motion = motion;
  }

  /** Ładuje Pixi (dynamicznie — lobby go nie pobiera) i tworzy płótno. */
  async init() {
    this.PIXI = await import(PIXI_URL);
    const { Application, Container } = this.PIXI;
    const app = new Application();
    await app.init({
      resizeTo: this.container,
      // nieprzezroczyste płótno: scena i tak przykrywa całą powierzchnię tłem, a przeglądarka nie musi
      // mieszać płótna ze stroną pod spodem (tańsze komponowanie)
      background: '#07060F',
      backgroundAlpha: 1,
      antialias: false,            // bez MSAA: krawędzie wygładzają miękkie tekstury (04 § 2.16), a GPU ma mniej pracy
      autoDensity: true,
      resolution: this.#resolution(),
      preference: 'webgl',
      powerPreference: 'high-performance',
      hello: false,
    });
    this.app = app;
    this.renderer = app.renderer;
    app.canvas.setAttribute('aria-hidden', 'true');
    app.canvas.classList.add('stage__canvas');
    this.container.prepend(app.canvas);

    // --- warstwy (04 § 7.2) ---
    const world = new Container({ label: 'world' });
    for (const name of LAYER_NAMES) {
      const layer = new Container({ label: name });
      world.addChild(layer);
      this.layers[name] = layer;
    }
    const bigwin = new Container({ label: 'bigwin' });
    const bigwinFixed = new Container({ label: 'bigwinFixed' });
    const flash = new Container({ label: 'flash' });
    const overlay = new Container({ label: 'overlay' });
    app.stage.addChild(world, bigwin, bigwinFixed, flash, overlay);
    Object.assign(this.layers, { world, bigwin, bigwinFixed, flash, overlay });
    this.layers.fxAdd.blendMode = 'add';
    this.layers.lines.blendMode = 'add';

    // --- pętla gry: logika (NORMAL) → render Pixi (LOW); dwa lekkie znaczniki czasu wokół renderu ---
    const { UPDATE_PRIORITY } = this.PIXI;
    app.ticker.add(this.#tick, this);
    app.ticker.add(() => { this.#renderStart = performance.now(); }, this, UPDATE_PRIORITY.LOW + 1);
    app.ticker.add(() => {
      const p = this.perf;
      p.render[p.i] = performance.now() - this.#renderStart;
      p.i = (p.i + 1) % p.frame.length;
      p.n = Math.min(p.n + 1, p.frame.length);
    }, this, UPDATE_PRIORITY.LOW - 1);
    this.#watchSize();
    this.#watchVisibility();
    this.#watchContext();
    this.#relayout(true);
    return this;
  }

  #resolution() {
    return Math.min(window.devicePixelRatio || 1, this.quality.params.dpr);
  }

  /**
   * Rejestruje system aktualizowany co klatkę. Kolejność = `order` rosnąco (04 § 7.3):
   * 10 osie czasu, 20 bębny, 30 tweeny, 40 cząsteczki, 50 kamera, 60 strażnik błysków.
   */
  addSystem(system, order = 35) {
    this.#systems.push({ system, order });
    this.#systems.sort((a, b) => a.order - b.order);
    return system;
  }

  removeSystem(system) {
    this.#systems = this.#systems.filter((s) => s.system !== system);
  }

  #tick(ticker) {
    const t0 = performance.now();
    const raw = ticker.deltaMS;
    // Pojedyncze zacięcie przycinamy do 50 ms (bez „przeskoku” animacji). Gdy jednak urządzenie STALE nie wyrabia
    // (8+ długich klatek z rzędu), dopuszczamy do 100 ms — inaczej przy 10 fps cała gra szłaby w zwolnionym
    // tempie ×0,5 i runda trwałaby dwa razy dłużej, niż przewiduje brief § 4.
    this.#slowFrames = raw > 45 ? this.#slowFrames + 1 : 0;
    const dt = Math.min(raw, this.#slowFrames > 8 ? 100 : 50);
    this.frameMs = raw;
    if (this.app.screen.width !== this.#lastW || this.app.screen.height !== this.#lastH) this.#relayout();
    // tweener przed resztą — osie czasu i wait() są na nim oparte
    this.tweener.update(dt);
    const fxDt = this.tweener.lastFxDt;
    for (const { system } of this.#systems) system.update(dt, fxDt);
    this.quality.sample(raw);
    this.perf.logic[this.perf.i] = performance.now() - t0;
    this.perf.frame[this.perf.i] = raw;
  }

  /** Percentyle z bufora pomiarów (raport e2e). */
  perfStats() {
    const { n } = this.perf;
    const pick = (arr) => {
      const a = Array.from(arr.subarray(0, n)).sort((x, y) => x - y);
      const q = (p) => (a.length ? a[Math.min(a.length - 1, Math.floor(p * a.length))] : 0);
      return { p50: q(0.5), p95: q(0.95), max: a.at(-1) ?? 0 };
    };
    return { frames: n, logic: pick(this.perf.logic), render: pick(this.perf.render), frame: pick(this.perf.frame) };
  }

  perfReset() {
    this.perf.i = 0;
    this.perf.n = 0;
  }

  /** Przelicza układ po zmianie rozmiaru (obrót telefonu, zmiana okna). */
  #relayout(force = false) {
    const w = this.app.screen.width;
    const h = this.app.screen.height;
    if (!force && w === this.#lastW && h === this.#lastH) return;
    this.#lastW = w;
    this.#lastH = h;
    const portrait = h > w * 1.08;
    // k — skala względem widoku referencyjnego 1920×1080 (04 § 1.7), liczona z krótszego boku
    const k = portrait ? Math.min(w / 1080, h / 1920) : Math.min(w / 1920, h / 1080);
    this.layout = { w, h, portrait, k: Math.max(0.2, k), short: Math.min(w, h) };
    const { world } = this.layers;
    world.pivot.set(w / 2, h / 2);
    world.position.set(w / 2, h / 2);
    this.dispatchEvent(new CustomEvent('resize', { detail: this.layout }));
  }

  #watchSize() {
    // ResizePlugin Pixi słucha zdarzenia window.resize; element sceny zmienia rozmiar także bez niego
    // (np. panel sterowania zmienia wysokość po zmianie orientacji) — dlatego dodatkowo ResizeObserver.
    if ('ResizeObserver' in window) {
      this.#resizeObserver = new ResizeObserver(() => {
        if (typeof this.app.queueResize === 'function') this.app.queueResize();
        else this.app.resize();
      });
      this.#resizeObserver.observe(this.container);
    }
  }

  #watchVisibility() {
    document.addEventListener('visibilitychange', () => {
      if (!this.app) return;
      if (document.hidden) this.app.ticker.stop();
      else if (!this.#contextLost) {
        this.quality.suspend(1000);   // pierwsze klatki po powrocie są długie — nie liczą się do automatu
        this.app.ticker.start();
      }
      this.dispatchEvent(new CustomEvent('visibility', { detail: { hidden: document.hidden } }));
    });
  }

  #watchContext() {
    const canvas = this.app.canvas;
    canvas.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();                 // bez tego przeglądarka nie spróbuje odzyskać kontekstu
      this.#contextLost = true;
      this.app.ticker.stop();
      this.dispatchEvent(new CustomEvent('contextlost'));
    });
    canvas.addEventListener('webglcontextrestored', () => {
      this.#contextLost = false;
      this.quality.suspend(1500);
      if (!document.hidden) this.app.ticker.start();
      this.dispatchEvent(new CustomEvent('contextrestored'));
    });
  }

  get contextLost() {
    return this.#contextLost;
  }

  /** Zmiana rozdzielczości renderowania (wołana między rundami po zmianie poziomu jakości). */
  applyResolution() {
    const r = this.#resolution();
    if (Math.abs(r - this.renderer.resolution) < 0.01) return false;
    this.renderer.resize(this.app.screen.width, this.app.screen.height, r);
    this.quality.suspend(800);
    return true;
  }

  /**
   * Wgrywa tekstury na GPU i kompiluje shadery na ekranie ładowania (04 E20) — pierwsze użycie tekstury w trakcie
   * spinu dałoby zacięcie 50–200 ms.
   */
  async prepare(target) {
    try {
      await this.renderer.prepare?.upload(target ?? this.app.stage);
    } catch {
      /* brak systemu prepare — tekstury wgrają się przy pierwszym rysowaniu */
    }
  }

  destroy() {
    this.#resizeObserver?.disconnect();
    this.app?.destroy(true, { children: true });
  }
}
