/**
 * game/reels/paylines.js — linie wygranych (04 § 2.16).
 *
 * Linia = wstęga `MeshRope` rozpięta na środkach pól (przedłużona o 0,35 pola poza skrajne bębny) z miękką teksturą
 * (przezroczysty → biały → przezroczysty w poprzek). Dlaczego nie `Graphics`: renderujemy bez MSAA, więc linie
 * z Graphics miałyby poszarpane krawędzie; miękka tekstura daje gładki brzeg za darmo.
 * Dwie wstęgi na linię: poświata 22 px (alfa 0,35, linie nieparzyste magenta, parzyste cyjan — S1) i rdzeń 6 px.
 * Rysowanie: koniec wstęgi wędruje od lewej do prawej w 220 ms (easeOutCubic) — punkty „przed głową” leżą na głowie.
 * Kształt linii pochodzi z `paylines` z GET /api/slots/{code} (rząd dla kolejnych bębnów, 0 = górny).
 */

import { easeOutCubic } from '../core/easing.js';

const POINTS = 36;

class Line {
  constructor(PIXI, layer, { core, glow }, coreW, glowW) {
    this.points = Array.from({ length: POINTS }, () => new PIXI.Point());
    this.glowPoints = Array.from({ length: POINTS }, () => new PIXI.Point());
    this.glow = new PIXI.MeshRope({ texture: glow, points: this.glowPoints, textureScale: 0, width: glowW });
    this.core = new PIXI.MeshRope({ texture: core, points: this.points, textureScale: 0, width: coreW });
    // MeshRope w Pixi 8 co klatkę przywraca grubość = wysokość tekstury; geometrię aktualizujemy sami
    for (const [rope, w] of [[this.glow, glowW], [this.core, coreW]]) {
      rope.autoUpdate = false;
      rope.onRender = null;
      rope.geometry._width = w;
    }
    this.glow.blendMode = 'add';
    this.core.blendMode = 'add';
    this.root = new PIXI.Container();
    this.root.addChild(this.glow, this.core);
    layer.addChild(this.root);
    this.path = [];
  }

  setWidths(coreW, glowW) {
    this.core.geometry._width = coreW;
    this.glow.geometry._width = glowW;
  }

  /** Ścieżka: lista punktów łamanej (środki pól + przedłużenia). Próbkujemy ją równomiernie po długości. */
  setPath(path) {
    this.path = path;
    const seg = [];
    let total = 0;
    for (let i = 1; i < path.length; i++) {
      const l = Math.hypot(path[i].x - path[i - 1].x, path[i].y - path[i - 1].y);
      seg.push(l);
      total += l;
    }
    this.samples = [];
    for (let k = 0; k < POINTS; k++) {
      let d = (k / (POINTS - 1)) * total;
      let i = 0;
      while (i < seg.length - 1 && d > seg[i]) d -= seg[i++];
      const t = seg[i] ? d / seg[i] : 0;
      this.samples.push({ x: path[i].x + (path[i + 1].x - path[i].x) * t, y: path[i].y + (path[i + 1].y - path[i].y) * t });
    }
  }

  /** Odsłania linię do ułamka `u` długości (0…1). */
  reveal(u) {
    const head = Math.max(1, Math.round(u * (POINTS - 1)));
    for (let k = 0; k < POINTS; k++) {
      const s = this.samples[Math.min(k, head)];
      this.points[k].set(s.x, s.y);
      this.glowPoints[k].set(s.x, s.y);
    }
    this.core.geometry.update();
    this.glow.geometry.update();
  }
}

export class WinLines {
  #lines = [];
  #active = [];

  /**
   * @param {import('../core/app.js').GameApp} gameApp
   * @param {import('pixi.js').Container} layer warstwa L6 (`lines`, mieszanie add)
   * @param {{core: Texture, glow: Texture}} textures
   * @param {import('./reelset.js').ReelSet} reels
   * @param {number[][]} paylines z API (indeks linii + 1 = numer linii w wygranych)
   */
  constructor(gameApp, layer, textures, reels, paylines, { colors = [0xff2e88, 0x21e6ff], coreColor = 0xffffff } = {}) {
    this.gameApp = gameApp;
    this.layer = layer;
    this.textures = textures;
    this.reels = reels;
    this.paylines = paylines ?? [];
    this.colors = colors;
    this.coreColor = coreColor;
  }

  #widths() {
    const S = this.reels.cell;
    return [Math.max(3, S * 0.035), Math.max(10, S * 0.13)];
  }

  #get() {
    const [cw, gw] = this.#widths();
    const line = this.#lines.pop() ?? new Line(this.gameApp.PIXI, this.layer, this.textures, cw, gw);
    line.setWidths(cw, gw);
    line.root.visible = true;
    line.root.alpha = 1;
    this.layer.addChild(line.root);
    return line;
  }

  /** Ścieżka linii o numerze `n` (od 1): środki pól + 0,35 pola przedłużenia na końcach. */
  pathFor(n) {
    const rows = this.paylines[n - 1];
    if (!rows) return null;
    const pts = rows.map((row, reel) => this.reels.cellCenter(reel, row));
    const ext = this.reels.cell * 0.35;
    const a = pts[0];
    const b = pts[1] ?? { x: a.x + 1, y: a.y };
    const z = pts.at(-1);
    const y = pts.at(-2) ?? { x: z.x - 1, y: z.y };
    const dir = (p, q) => {
      const l = Math.hypot(q.x - p.x, q.y - p.y) || 1;
      return { x: (q.x - p.x) / l, y: (q.y - p.y) / l };
    };
    const d0 = dir(b, a);
    const d1 = dir(y, z);
    return [{ x: a.x + d0.x * ext, y: a.y + d0.y * ext }, ...pts, { x: z.x + d1.x * ext, y: z.y + d1.y * ext }];
  }

  /** Środek linii (miejsce na kwotę linii). */
  centerOf(n) {
    const rows = this.paylines[n - 1];
    if (!rows) return null;
    const mid = Math.floor(rows.length / 2);
    return this.reels.cellCenter(mid, rows[mid]);
  }

  /**
   * Rysuje linię `n` (220 ms × tempo). Zwraca obiekt linii.
   * @param {{tempo?: number, glowAlpha?: number}} o
   */
  draw(n, { tempo = 1, glowAlpha = 0.35, drawMs = 220 } = {}) {
    const path = this.pathFor(n);
    if (!path) return null;
    const line = this.#get();
    line.number = n;
    line.setPath(path);
    line.glow.tint = this.colors[(n - 1) % this.colors.length];
    line.core.tint = this.coreColor;
    line.glow.alpha = glowAlpha;
    line.reveal(0);
    this.#active.push(line);
    const reduced = this.gameApp.motion.reduced;
    this.gameApp.tweener.tween(reduced ? 1 : drawMs * tempo, (e) => line.reveal(e), { ease: easeOutCubic });
    return line;
  }

  /** Faza (b) cyklu: jedna linia wyraźnie, pozostałe przygaszone do 0,25 (null = wszystkie wyraźnie). */
  focus(n) {
    for (const l of this.#active) {
      const target = n === null || l.number === n ? 1 : 0.25;
      this.gameApp.tweener.to(l.root, { alpha: target }, { duration: 160 });
    }
  }

  /** Gaszenie wszystkich linii (E24: 120 ms). */
  clear(ms = 120) {
    const lines = this.#active;
    this.#active = [];
    for (const l of lines) {
      this.gameApp.tweener.killTweensOf(l.root);
      this.gameApp.tweener.to(l.root, { alpha: 0 }, {
        duration: ms,
        onComplete: () => {
          l.root.visible = false;
          this.#lines.push(l);
        },
      });
    }
  }

  get count() {
    return this.#active.length;
  }
}
