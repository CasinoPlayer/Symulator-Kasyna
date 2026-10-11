/**
 * game/reels/reelset.js — silnik bębnów (S1, S2): fizyka z 04 § 2.14.
 *
 * Model taśmy: bęben to nieskończona pionowa taśma symboli. Przesunięcie `p` (w polach) rośnie, gdy taśma jedzie
 * w dół. Symbol o indeksie `i` stoi na wysokości `(i + p)` pól od górnej krawędzi okna, więc rząd `j` pokazuje
 * indeks `j − p`. Symbol pod indeksem bierzemy z mapy wyniku (ustawionej, gdy przyjdzie odpowiedź serwera) albo —
 * dla pozostałych pozycji — z wizualnej taśmy wybieranej stałym skrótem z indeksu (ta sama pozycja = ten sam
 * symbol, więc nic nie migocze). Na bęben przypada `wiersze + 2` sprite'ów, przypisywanych co klatkę do widocznych
 * indeksów.
 *
 * Fazy (oś czasu od kliknięcia SPIN, czasy × tempo; TURBO = 0,45):
 *   ZAMACH      0,18 pola w górę w 120 ms (easeOutQuad)              — w RM pomijany
 *   ROZPĘDZANIE do v_max w 200 ms, prędkość rośnie jak easeInQuad
 *   OBRÓT       v_max = 22 pola/s (S1)
 *   DOPASOWANIE gdy wynik jest znany: prędkość korygowana współczynnikiem f (|f−1| ≈ kilka %), żeby koniec hamowania
 *               wypadł DOKŁADNIE na pozycji całkowitej N + overshoot w zaplanowanej milisekundzie stopu
 *   HAMOWANIE   p(t) = pb + d·(1 − (1 − t/D)³) — prędkość na starcie 3d/D = v (brak szarpnięcia), koniec z v = 0
 *               ZA celem o overshoot 0,12 pola; ta chwila to „moment stopu” (dźwięk, lądowanie, haptyka)
 *   OSIADANIE   powrót o overshoot w 160 ms, easeOutBack(1,2) (odbicie 5,3% ≈ 1 px)  — w RM bez overshootu
 * Antycypacja: wskazane bębny stają później (+900 ms w S1), po 400 ms zwalniają do 0,55 v_max (300 ms, easeInOutSine).
 * Szybki stop: wszystkie kręcące się bębny hamują od razu w 0,6 D, co 40 ms; antycypacja pominięta.
 * Rozmycie ruchu = podmiana tekstur (ruch2 > 60% v_max, ruch1 20–60%, ostry < 20%) — zero kosztu GPU.
 */

import { easeOutQuad, easeInQuad, easeInOutSine, easeOutBack } from '../core/easing.js';
import { hashInt } from '../core/random.js';

const settleEase = easeOutBack(1.2);

export const S1_TIMING = Object.freeze({
  startGap: 50, windupDist: 0.18, windupMs: 120, accelMs: 200, vmax: 22,
  stops: [1240, 1420, 1600], brakeMs: 260, overshoot: 0.12, settleMs: 160,
  anticipationMs: 900, anticipationSlowAfter: 400, anticipationSlowMs: 300, anticipationSpeed: 0.55,
  matchWindowMs: 600, lateLeadMs: 450, slamGap: 40, slamBrake: 0.6,
});

/**
 * Jeden widoczny symbol (slot):
 *   root  — środek pola (pozycja na taśmie; puls wygranej skaluje wokół środka),
 *   body  — dolna krawędź pola (squash & stretch przy lądowaniu skaluje wokół dna — symbol „siada”, 04 § 2.13),
 *   main  — sprite symbolu wyśrodkowany w polu, shadow — cień rzucany (przesunięty o +3% / +5% pola, alfa 0,45).
 */
class Slot {
  constructor(PIXI) {
    this.root = new PIXI.Container();
    this.body = new PIXI.Container();
    this.shadow = new PIXI.Sprite();
    this.main = new PIXI.Sprite();
    this.shadow.anchor.set(0.5);
    this.main.anchor.set(0.5);
    this.shadow.alpha = 0.45;
    this.body.addChild(this.shadow, this.main);
    this.root.addChild(this.body);
    this.code = null;
    this.index = 0;
    this.texKind = '';
  }
}

class Reel {
  constructor(set, index) {
    const { PIXI } = set.gameApp;
    this.set = set;
    this.index = index;
    this.container = new PIXI.Container({ label: `beben${index}` });
    this.slots = Array.from({ length: set.rows + 2 }, () => new Slot(PIXI));
    for (const s of this.slots) this.container.addChild(s.root);
    this.p = 0;
    this.v = 0;
    this.state = 'idle';
    this.map = new Map();
    this.lifted = new Set();
  }

  /** Kod symbolu pod indeksem taśmy (wynik z mapy albo wizualna taśma). */
  codeAt(i) {
    const c = this.map.get(i);
    if (c !== undefined) return c;
    return this.set.filler(hashInt(i, this.index * 7919 + 17));
  }
}

export class ReelSet extends EventTarget {
  /**
   * @param {import('../core/app.js').GameApp} gameApp
   * @param {{reels: number, rows: number, views: {get(code: string): object}, filler: (r: number) => string, timing?: object}} o
   */
  constructor(gameApp, { reels, rows, views, filler, timing = S1_TIMING }) {
    super();
    const { PIXI } = gameApp;
    this.gameApp = gameApp;
    this.rows = rows;
    this.views = views;
    this.filler = filler;
    this.timing = timing;
    this.root = new PIXI.Container({ label: 'bebny' });
    this.mask = new PIXI.Graphics();
    this.root.addChild(this.mask);
    this.root.mask = this.mask;
    this.reels = Array.from({ length: reels }, (_, i) => new Reel(this, i));
    for (const r of this.reels) this.root.addChild(r.container);
    this.time = 0;
    this.cell = 100;
    this.gap = 0;
    this.origin = { x: 0, y: 0 };
    this.spinning = false;
    this.grid = Array.from({ length: reels }, () => Array.from({ length: rows }, () => filler(Math.random())));
    this.#resolveLand = null;
    this.handlers = {};
  }

  #resolveLand;

  /** Ustawia geometrię: lewy górny róg okna, rozmiar pola, odstęp między bębnami. */
  layout(x, y, cell, gap = 0) {
    this.origin = { x, y };
    this.cell = cell;
    this.gap = gap;
    const w = this.reels.length * cell + (this.reels.length - 1) * gap;
    const h = this.rows * cell;
    this.mask.clear().rect(x - gap / 2, y, w + gap, h).fill(0xffffff);
    this.reels.forEach((r, i) => {
      r.container.position.set(x + i * (cell + gap), y);
      for (const s of r.slots) this.#styleSlot(s);
      // symbole przeniesione na warstwę wygranych idą za nowym układem (obrót telefonu w trakcie prezentacji)
      for (const s of r.lifted) {
        const c = this.cellCenter(i, s.liftRow ?? 0);
        s.root.position.set(c.x, c.y);
      }
    });
    this.#render(true);
  }

  get windowRect() {
    const w = this.reels.length * this.cell + (this.reels.length - 1) * this.gap;
    return { x: this.origin.x, y: this.origin.y, w, h: this.rows * this.cell };
  }

  /** Środek pola (bęben, rząd) we współrzędnych warstwy. */
  cellCenter(reel, row) {
    return {
      x: this.origin.x + reel * (this.cell + this.gap) + this.cell / 2,
      y: this.origin.y + row * this.cell + this.cell / 2,
    };
  }

  /** Natychmiastowe ustawienie planszy (plansza startowa, wynik po błędzie, kaskady zastępcze). */
  setGrid(grid) {
    this.grid = grid.map((col) => [...col]);
    for (const r of this.reels) {
      const N = Math.round(r.p);
      r.p = N;
      r.map.clear();
      for (let j = 0; j < this.rows; j++) r.map.set(j - N, grid[r.index][j]);
    }
    this.#render(true);
  }

  /** Slot pokazujący pole (bęben, rząd), gdy bębny stoją. */
  slotAt(reel, row) {
    const r = this.reels[reel];
    const idx = row - Math.round(r.p);
    return r.slots.find((s) => s.index === idx) ?? null;
  }

  // ------------------------------------------------------------------------------------------- start i lądowanie

  /** E24: start obrotu w tej samej klatce co kliknięcie — nie czekamy na serwer. */
  startSpin({ tempo = 1 } = {}) {
    const T = this.timing;
    const reduced = this.gameApp.motion.reduced;
    this.dropAll();
    this.spinning = true;
    this.tempo = tempo;
    this.time = 0;
    this.result = null;
    this.slammed = false;
    this.aborted = false;
    this.reels.forEach((r, i) => {
      const t0 = i * T.startGap * tempo;
      r.plan = {
        t0,
        windEnd: t0 + (reduced ? 0 : T.windupMs * tempo),
        accelEnd: t0 + (reduced ? 0 : T.windupMs * tempo) + T.accelMs * tempo,
        stopAt: T.stops[Math.min(i, T.stops.length - 1)] * tempo + Math.max(0, i - T.stops.length + 1) * (T.stops.at(-1) - T.stops.at(-2)) * tempo,
        brakeMs: T.brakeMs * tempo,
        settleMs: reduced ? 0 : T.settleMs * tempo,
        overshoot: reduced ? 0 : T.overshoot,
        antStart: null,
      };
      r.p0 = Math.round(r.p);
      r.state = 'windup';
      r.v = 0;
      r.matched = false;
      r.approachSent = false;
      r.stopSent = false;
    });
    this.dispatchEvent(new CustomEvent('spinstart'));
  }

  /**
   * Wynik z serwera: bębny dopasowują się i stają na `grid`. Zwraca obietnicę końca osiadania ostatniego bębna.
   * @param {string[][]} grid grid[bęben][rząd]
   * @param {{anticipation?: number[]}} o lista bębnów do spowolnienia (krok `spin` z 09 § 2.4)
   */
  land(grid, { anticipation = [] } = {}) {
    if (!this.spinning) this.startSpin({ tempo: this.tempo ?? 1 });
    const T = this.timing;
    const tempo = this.tempo;
    this.result = grid.map((c) => [...c]);
    // antycypacja: każdy wskazany bęben i wszystkie po nim stają później (+900 ms × tempo w S1)
    const ant = this.slammed ? [] : [...anticipation].sort((a, b) => a - b);
    this.anticipation = new Set(ant);
    for (const a of ant) {
      for (const r of this.reels) if (r.index >= a) r.plan.stopAt += T.anticipationMs * tempo;
    }
    for (const a of ant) {
      const r = this.reels[a];
      const prev = this.reels[a - 1];
      r.plan.antStart = prev ? prev.plan.stopAt : 0;
    }
    // spóźniona odpowiedź (04 § 2.14): pierwszy stop = max(plan, teraz + 450 ms), kolejne przesuwamy o tyle samo
    const first = this.reels[0].plan;
    const minFirst = this.time + T.lateLeadMs * tempo;
    if (!this.slammed && first.stopAt < minFirst) {
      const shift = minFirst - first.stopAt;
      for (const r of this.reels) {
        r.plan.stopAt += shift;
        if (r.plan.antStart !== null) r.plan.antStart += shift;
      }
    }
    if (this.slammed) this.#applySlam();
    return new Promise((resolve) => { this.#resolveLand = resolve; });
  }

  /** Szybki stop (przycisk STOP / Spacja / dotknięcie bębnów). Bez wyniku — wykona się po jego nadejściu. */
  slam() {
    if (!this.spinning || this.slammed) return;
    this.slammed = true;
    if (this.result) this.#applySlam();
  }

  #applySlam() {
    const T = this.timing;
    let k = 0;
    for (const r of this.reels) {
      if (r.state === 'brake' || r.state === 'settle' || r.state === 'idle') continue;
      const brakeMs = T.brakeMs * T.slamBrake * this.tempo;
      const start = Math.max(this.time, r.plan.accelEnd) + k * T.slamGap;
      r.plan.stopAt = start + brakeMs;
      r.plan.brakeMs = brakeMs;
      r.plan.antStart = null;
      r.matched = false;            // ponowne dopasowanie do nowej chwili stopu
      r.slamFast = true;
      k++;
    }
    this.anticipation = new Set();
  }

  /** E40: łagodne hamowanie (1,5 D, bez overshootu) na planszy sprzed spinu — wyniku nie znamy, nie wymyślamy go. */
  abort() {
    if (!this.spinning) return Promise.resolve();
    this.aborted = true;
    const prev = this.grid;
    const p = this.land(prev, {});
    const T = this.timing;
    let k = 0;
    for (const r of this.reels) {
      if (r.state === 'brake' || r.state === 'settle' || r.state === 'idle') continue;
      const brakeMs = T.brakeMs * 1.5;
      r.plan.stopAt = Math.max(this.time, r.plan.accelEnd) + k * 60 + brakeMs;
      r.plan.brakeMs = brakeMs;
      r.plan.overshoot = 0;
      r.plan.settleMs = 0;
      r.plan.antStart = null;
      r.matched = false;
      k++;
    }
    return p;
  }

  // ------------------------------------------------------------------------------------------- symulacja

  /** Prędkość nominalna (bez korekty dopasowania) w chwili t — do całkowania drogi przy dopasowaniu. */
  #vNominal(r, t) {
    const T = this.timing;
    const { plan } = r;
    if (t < plan.windEnd) return 0;
    if (t < plan.accelEnd) return T.vmax * easeInQuad((t - plan.windEnd) / (plan.accelEnd - plan.windEnd || 1));
    if (plan.antStart !== null) {
      const a0 = plan.antStart + T.anticipationSlowAfter * this.tempo;
      const a1 = a0 + T.anticipationSlowMs * this.tempo;
      if (t >= a1) return T.vmax * T.anticipationSpeed;
      if (t >= a0) return T.vmax * (1 - (1 - T.anticipationSpeed) * easeInOutSine((t - a0) / (a1 - a0)));
    }
    return T.vmax;
  }

  /**
   * Dopasowanie: wybiera pozycję docelową N (całkowitą) i współczynnik prędkości f tak, by
   * p(teraz) + f·(droga nominalna do hamowania) + f·v_hamowania·D/3 = N + overshoot.
   */
  #match(r) {
    const { plan } = r;
    const t0 = this.time;
    const tb = plan.stopAt - plan.brakeMs;
    const steps = 48;
    let dist = 0;
    if (tb > t0) {
      const h = (tb - t0) / steps;
      for (let s = 0; s < steps; s++) dist += this.#vNominal(r, t0 + (s + 0.5) * h) * (h / 1000);
    }
    const vb = this.#vNominal(r, Math.max(t0, tb));
    const brakeDist = (vb * plan.brakeMs) / 1000 / 3;
    const natural = r.p + dist + brakeDist - plan.overshoot;
    // wynik musi wjechać z góry, gdy nie jest jeszcze widoczny: N > p + wiersze + 1 (przy szybkim stopie — podmiana
    // w rozmyciu ruchu, niezauważalna)
    const N = Math.max(Math.round(natural), r.slamFast || this.aborted ? Math.ceil(natural) : Math.ceil(r.p + this.rows + 1));
    const denom = dist + brakeDist;
    r.f = denom > 0.01 ? (N + plan.overshoot - r.p) / denom : 1;
    r.N = N;
    r.map.clear();
    const col = this.result[r.index];
    for (let j = 0; j < this.rows; j++) r.map.set(j - N, col[j]);
    r.matched = true;
  }

  update(dt) {
    if (!this.spinning) return;
    this.time += dt;
    const T = this.timing;
    const t = this.time;
    let allIdle = true;
    for (const r of this.reels) {
      const { plan } = r;
      if (r.state === 'idle') continue;
      allIdle = false;
      if (r.state === 'windup') {
        if (t < plan.t0) continue;
        if (t < plan.windEnd) {
          r.p = r.p0 - T.windupDist * easeOutQuad((t - plan.t0) / (plan.windEnd - plan.t0));
          r.v = 0;
          continue;
        }
        r.state = 'spin';
      }
      if (r.state === 'spin') {
        const tb = plan.stopAt - plan.brakeMs;
        if (this.result && !r.matched && t >= plan.accelEnd - 1) this.#match(r);
        if (!(this.result && r.matched && t >= tb)) {
          // całkowanie prędkości (metoda punktu środkowego — dokładna dla stałej prędkości)
          const v = this.#vNominal(r, t - dt / 2) * (r.matched ? r.f : 1);
          r.v = v;
          r.p += (v * dt) / 1000;
          if (r.plan.antStart !== null && !r.antSent && t >= r.plan.antStart) {
            r.antSent = true;
            this.#emit('anticipation', { reel: r.index, until: plan.stopAt });
          }
          continue;
        }
        // start hamowania: droga d liczona z RZECZYWISTEJ pozycji — wyrównanie zawsze dokładne
        r.state = 'brake';
        r.pb = r.p;
        r.d = r.N + plan.overshoot - r.p;
        r.tb = tb;
      }
      if (r.state === 'brake') {
        const D = plan.brakeMs;
        const u = Math.min(1, (t - r.tb) / D);
        r.p = r.pb + r.d * (1 - (1 - u) ** 3);
        r.v = ((3 * r.d) / (D / 1000)) * (1 - u) ** 2;
        const left = plan.stopAt - t;
        if (!r.approachSent && left <= 170) {
          r.approachSent = true;
          // zapowiedź stopu z dokładnym czasem — dźwięk planujemy na zegarze audio (R6), WILD startuje 150 ms wcześniej
          this.#emit('approach', { reel: r.index, inMs: Math.max(0, left), quick: Boolean(r.slamFast), codes: this.result[r.index] });
        }
        if (u >= 1) {
          r.state = plan.settleMs > 0 ? 'settle' : 'idle';
          r.ts = t;
          r.v = 0;
          if (r.state === 'idle') r.p = r.N;
          this.#emit('stop', { reel: r.index, quick: Boolean(r.slamFast), codes: this.result[r.index], last: r.index === this.reels.length - 1 });
        }
      } else if (r.state === 'settle') {
        const u = Math.min(1, (t - r.ts) / plan.settleMs);
        r.p = r.N + plan.overshoot * (1 - settleEase(u));
        if (u >= 1) {
          r.p = r.N;
          r.state = 'idle';
        }
      }
    }
    this.#render(false);
    if (allIdle && this.result) this.#finish();
  }

  #finish() {
    this.spinning = false;
    this.grid = this.result.map((c) => [...c]);
    for (const r of this.reels) {
      r.slamFast = false;
      r.antSent = false;
      r.f = 1;
    }
    const resolve = this.#resolveLand;
    this.#resolveLand = null;
    this.dispatchEvent(new CustomEvent('settled'));
    resolve?.();
  }

  #emit(type, detail) {
    this.dispatchEvent(new CustomEvent(type, { detail }));
  }

  /** Przypisuje sprite'y do widocznych indeksów taśmy i dobiera tekstury według prędkości. */
  #render(force) {
    const S = this.cell;
    const vmax = this.timing.vmax;
    for (const r of this.reels) {
      const i0 = Math.floor(-r.p) - 1;
      const speed = Math.abs(r.v) / vmax;
      const kind = speed > 0.6 ? 'blur2' : speed > 0.2 ? 'blur1' : 'main';
      for (let k = 0; k < r.slots.length; k++) {
        const s = r.slots[k];
        if (r.lifted.has(s)) continue;
        const idx = i0 + k;
        const code = r.codeAt(idx);
        s.index = idx;
        s.root.y = (idx + r.p) * S + S / 2;
        s.root.x = S / 2;
        if (force || s.code !== code || s.texKind !== kind) {
          s.code = code;
          s.texKind = kind;
          this.#styleSlot(s);
        }
      }
    }
  }

  #styleSlot(s) {
    if (!s.code) return;
    const view = this.views.get(s.code);
    if (!view) return;
    const S = this.cell;
    const size = S * (view.scale ?? 0.9);
    const tex = (s.texKind === 'blur2' && view.blur2) || (s.texKind !== 'main' && view.blur1) || view.main;
    s.main.texture = tex;
    // jedna skala według SZEROKOŚCI: tekstury rozmycia są wyższe (smuga w pionie), ale tak samo szerokie
    s.main.scale.set(size / tex.width);
    s.body.y = S / 2;
    s.main.y = -S / 2;
    // cień rzucany tylko na High/Medium — na Low oszczędzamy przerysowanie (15 dodatkowych sprite'ów)
    const showShadow = Boolean(view.shadow) && s.texKind === 'main' && this.gameApp.quality.params.index < 2;
    s.shadow.visible = showShadow;
    if (showShadow) {
      s.shadow.texture = view.shadow;
      s.shadow.scale.set((size * (view.shadowScale ?? 1)) / view.shadow.width);
      s.shadow.position.set(S * 0.03, -S / 2 + S * 0.05);
      s.shadow.tint = view.shadowTint ?? 0xffffff;
    }
  }

  /** Ponowne dobranie tekstur i cieni (po zmianie poziomu jakości). */
  restyle() {
    this.#render(true);
  }

  // ------------------------------------------------------------------------------------------- warstwa wygranych

  /** Przenosi slot pola na inną warstwę (np. L5 nad przyciemnieniem), zachowując położenie na ekranie. */
  lift(reel, row, layer) {
    const r = this.reels[reel];
    const slot = this.slotAt(reel, row);
    if (!slot || r.lifted.has(slot)) return slot;
    r.lifted.add(slot);
    const gx = r.container.x + slot.root.x;
    const gy = r.container.y + slot.root.y;
    layer.addChild(slot.root);
    slot.root.position.set(gx, gy);
    slot.reel = r;
    slot.liftRow = row;
    return slot;
  }

  /** Oddaje wszystkie przeniesione sloty z powrotem do bębnów (przed kolejnym spinem). */
  dropAll() {
    for (const r of this.reels) {
      for (const s of r.lifted) {
        r.container.addChild(s.root);
        s.root.scale.set(1);
        s.root.rotation = 0;
        s.root.alpha = 1;
        s.body.scale.set(1);
        s.body.rotation = 0;
      }
      r.lifted.clear();
    }
    this.#render(true);
  }

  /** Wszystkie sloty bębna (np. do animacji lądowania po stopie). */
  visibleSlots(reel) {
    const r = this.reels[reel];
    return r.slots.filter((s) => {
      const row = s.index + Math.round(r.p);
      return row >= 0 && row < this.rows;
    });
  }
}
