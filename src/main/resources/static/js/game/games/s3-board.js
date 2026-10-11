/** Gravity board for S3. Reuses static slots/masks from ReelSet, never runs reel rotation. */
import { ReelSet } from '../reels/reelset.js';
import { SkipToken } from '../core/tween.js';

export class S3Board extends ReelSet {
  constructor(gameApp, options) {
    super(gameApp, options);
    this.motions = new Set();
    this.motionToken = new SkipToken();
    this.landing = false;
    this.dropCount = 0;
    this.setGrid(this.grid);
  }

  update(dt) { if (this.spinning) this.time += dt; }

  layout(...args) {
    super.layout(...args);
    for (const motion of this.motions ?? []) this.applyMotion(motion);
  }

  resetSlots() {
    for (const col of this.reels) for (const slot of col.slots) {
      slot.root.alpha = 1;
      slot.root.scale.set(1);
      slot.body.scale.set(1);
    }
  }

  dropAll() {
    super.dropAll();
    this.resetSlots();
  }

  applyMotion(m) {
    const slot = this.slotAt(m.col, m.row);
    if (!slot) return;
    slot.root.y = (m.row + 0.5 + m.offset) * this.cell;
    slot.root.alpha = m.alpha;
    slot.body.scale.set(m.sx ?? 1, m.sy ?? 1);
  }

  startSpin({ tempo = 1 } = {}) {
    this.motionToken.skip();
    this.motionToken = new SkipToken();
    this.dropAll();
    this.previousGrid = this.grid.map((col) => [...col]);
    this.spinning = true;
    this.landing = false;
    this.slammed = false;
    this.tempo = tempo;
    this.time = 0;
    this.exitPromise = Promise.all(this.reels.flatMap((_, col) => Array.from({ length: this.rows }, (_, row) => {
      const m = { col, row, offset: 0, alpha: 1 };
      this.motions.add(m);
      return this.gameApp.tweener.tween(160 * tempo, (_e, u) => {
        m.offset = this.gameApp.motion.reduced ? 0 : u * u * 0.7;
        m.alpha = 1 - u;
        this.applyMotion(m);
      }, { token: this.motionToken }).promise.finally(() => this.motions.delete(m));
    })));
    this.dispatchEvent(new CustomEvent('spinstart'));
  }

  /** Server grid drops in from above. No decorative symbols replace a result. */
  async land(grid, { anticipation = [] } = {}) {
    if (!this.spinning) this.startSpin({ tempo: this.tempo ?? 1 });
    await this.exitPromise;
    this.landing = true;
    this.setGrid(grid);
    this.resetSlots();
    let extra = 0, previousEnd = 0;
    const dropDuration = (Math.sqrt(2 * (this.rows + 1) / 85) * 1000 + (this.gameApp.motion.reduced ? 0 : 120)) * this.tempo;
    const jobs = [];
    for (let col = 0; col < this.reels.length; col++) {
      if (anticipation.includes(col) && !this.slammed) {
        extra += 700 * this.tempo;

      }
      const delay = col * 40 * this.tempo + extra;
      const endAt = delay + dropDuration;
      if (anticipation.includes(col) && !this.slammed) {
        const at = previousEnd, remaining = endAt - at;
        jobs.push(this.gameApp.tweener.wait(at, { token: this.motionToken }).then(() => {
          if (!this.slammed) this.dispatchEvent(new CustomEvent('anticipation', { detail: { reel: col, durationMs: remaining } }));
        }));
      }
      previousEnd = endAt;
      const column = [];
      for (let row = 0; row < this.rows; row++) {
        column.push(this.fall(col, row, -(this.rows + 1), delay, this.motionToken));
      }
      jobs.push(Promise.all(column).then(() => {
        this.dispatchEvent(new CustomEvent('stop', { detail: { reel: col, codes: grid[col], last: col === this.reels.length - 1, quick: this.slammed } }));
      }));
    }
    await Promise.all(jobs);
    this.setGrid(grid);
    this.resetSlots();
    this.spinning = false;
    this.landing = false;
    this.dropCount++;
    this.dispatchEvent(new CustomEvent('settled'));
  }

  /** Move survivors by exactly the number of removed cells below them; only new cells enter above row 0. */
  async cascade(step, token) {
    this.dropAll();
    const old = this.grid.map((col) => [...col]);
    this.setGrid(step.grid);
    this.resetSlots();
    const removed = new Set((step.removed ?? []).map((p) => p.join(':')));
    const jobs = [];
    for (let col = 0; col < this.reels.length; col++) {
      const survivors = old[col].map((code, row) => ({ code, row })).filter((s) => !removed.has(`${col}:${s.row}`));
      const added = this.rows - survivors.length;
      for (let row = 0; row < this.rows; row++) {
        const origin = row < added ? row - added : survivors[row - added].row;
        if (origin !== row) jobs.push(this.fall(col, row, origin - row, col * 40 * this.tempo, token));
      }
    }
    await Promise.all(jobs);
    this.setGrid(step.grid);
    this.resetSlots();
    this.dropCount++;
  }

  fall(col, row, from, delay, token) {
    const reduced = this.gameApp.motion.reduced;
    const flight = Math.sqrt(2 * Math.abs(from) / 85) * 1000;
    const settle = reduced ? 0 : 120;
    const duration = (flight + settle) * this.tempo;
    const m = { col, row, offset: from, alpha: 1, sx: 1, sy: 1 };
    this.motions.add(m);
    this.applyMotion(m);
    return this.gameApp.tweener.tween(duration, (_e, u) => {
      const elapsed = u * (flight + settle);
      if (elapsed < flight) {
        const t = elapsed / flight;
        m.offset = from * (1 - t * t);
        const slot = this.slotAt(col, row);
        const view = this.views.get(slot?.code);
        if (view && slot) slot.main.texture = !reduced && 85 * elapsed / 1000 > 12 && view.blur1 ? view.blur1 : view.main;
      } else {
        const t = settle ? (elapsed - flight) / settle : 1;
        m.offset = reduced ? 0 : 0.08 * Math.sin(Math.PI * t);
        m.sx = 1 + 0.06 * Math.sin(Math.PI * t);
        m.sy = 1 - 0.08 * Math.sin(Math.PI * t);
        const slot = this.slotAt(col, row);
        if (slot) slot.main.texture = this.views.get(slot.code).main;
      }
      this.applyMotion(m);
    }, { delay, token, target: m }).promise.finally(() => {
      m.offset = 0; m.alpha = 1; m.sx = 1; m.sy = 1;
      this.applyMotion(m);
      this.motions.delete(m);
    });
  }

  slam() { this.slammed = true; this.motionToken.skip(); }

  async abort() {
    this.motionToken.skip();
    await this.exitPromise;
    this.setGrid(this.previousGrid ?? this.grid);
    this.resetSlots();
    this.spinning = false;
    this.landing = false;
  }
}
