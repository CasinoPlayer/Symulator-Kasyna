/**
 * game/games/zastepcza.js — gra zastępcza dla S2 „Złoty Faraon” i S3 „Kryształowa Kaskada”.
 *
 * Po co: pełne wersje S2 i S3 powstaną w kolejnym etapie, ale runtime musi już teraz odgrywać ich odpowiedzi
 * (darmowe spiny, rozszerzony WILD, kaskady, kule mnożników) — „bez przeróbek” runtime. Ta gra używa tego samego
 * BaseGame i domyślnych handlerów kroków; ma tylko prostą scenę i symbole rysowane w kodzie (kafelki z ikoną
 * i nazwą w kolorze z 01 § 10.4 / § 11.4). Obrazy `s2_sym_*` / `s3_sym_*` z manifestu mają pierwszeństwo.
 */

import { BaseGame } from '../base-game.js';
import { canvasTexture, makeCanvas, linear, radial } from '../core/canvas-art.js';
import { motionBlur, silhouette, softShape } from './s1-art.js';

const S2_TIMING = Object.freeze({
  startGap: 60, windupDist: 0.18, windupMs: 120, accelMs: 220, vmax: 26,
  stops: [1400, 1600, 1800, 2000, 2200], brakeMs: 300, overshoot: 0.1, settleMs: 180,
  anticipationMs: 1200, anticipationSlowAfter: 400, anticipationSlowMs: 300, anticipationSpeed: 0.55,
  matchWindowMs: 600, lateLeadMs: 450, slamGap: 40, slamBrake: 0.6,
});
// S3 nie ma bębnów (zrzut planszy, 04 § 2.15) — w grze zastępczej szybki „obrót” kolumn kończący się w ~900 ms
const S3_TIMING = Object.freeze({
  startGap: 30, windupDist: 0, windupMs: 0, accelMs: 120, vmax: 30,
  stops: [480, 530, 580, 630, 680, 730], brakeMs: 200, overshoot: 0.08, settleMs: 120,
  anticipationMs: 700, anticipationSlowAfter: 300, anticipationSlowMs: 200, anticipationSpeed: 0.55,
  matchWindowMs: 300, lateLeadMs: 400, slamGap: 30, slamBrake: 0.6,
});

/** Kolory i etykiety symboli (01 § 10.4, § 11.4). */
const STYLE = {
  'zloty-faraon': {
    prefix: 's2', bg: ['#050B24', '#1F2A5A', '#3A2A10'], frame: 0xf5c542, timing: S2_TIMING, engine: 'LINES', music: 'mus_s2', loop: 'sfx_beben_petla_s2',
    symbols: {
      10: ['#2EC4B6', '10'], j: ['#19D17A', 'J'], q: ['#E2553A', 'Q'], k: ['#1F4FD8', 'K'], a: ['#8F3DFF', 'A'], ankh: ['#F5C542', '☥'],
      oko: ['#2EC4B6', '◉'], skarabeusz: ['#19D17A', '✦'], anubis: ['#FFB23D', '▲'], faraon: ['#FFE08A', '♛'], wild: ['#FFE08A', 'WILD'], scatter: ['#9FE8FF', '△'],
    },
    weights: { 10: 6, j: 6, q: 5, k: 5, a: 5, ankh: 4, oko: 3, skarabeusz: 3, anubis: 2, faraon: 2, wild: 1, scatter: 1 },
  },
  'krysztalowa-kaskada': {
    prefix: 's3', bg: ['#070A1F', '#141A44', '#0A2A2A'], frame: 0x8f3dff, timing: S3_TIMING, engine: 'CLUSTER', music: 'mus_s3', loop: null,
    symbols: {
      szafir: ['#2F6BFF', '◆'], szmaragd: ['#19D17A', '◆'], ametyst: ['#A64DFF', '◆'], topaz: ['#FFB23D', '◆'],
      rubin: ['#FF2D55', '♥'], diament: ['#E8FBFF', '◇'], cebula: ['#FFE08A', '●'], scatter: ['#5CFFB0', '✶'], mnoznik: ['#FFFFFF', '×'],
    },
    weights: { szafir: 6, szmaragd: 6, ametyst: 5, topaz: 5, rubin: 3, diament: 2, cebula: 2, scatter: 1, mnoznik: 1 },
  },
};

function drawTile(size, color, label) {
  const c = makeCanvas(size, size);
  const x = c.getContext('2d');
  const r = size * 0.42;
  x.translate(size / 2, size / 2);
  x.fillStyle = radial(x, -r * 0.3, -r * 0.4, r * 0.1, r * 1.3, [[0, '#FFFFFF'], [0.25, color], [1, '#05030F']]);
  x.beginPath();
  x.roundRect(-r, -r, r * 2, r * 2, r * 0.35);
  x.fill();
  x.lineWidth = size * 0.03;
  x.strokeStyle = linear(x, 0, -r, 0, r, [[0, '#FFF6D6'], [0.5, '#F5C542'], [1, '#5C3A00']]);
  x.stroke();
  x.fillStyle = '#FFFFFF';
  x.shadowColor = color;
  x.shadowBlur = size * 0.06;
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  x.font = `800 ${Math.round(size * (label.length > 2 ? 0.2 : 0.42))}px Manrope, system-ui, sans-serif`;
  x.fillText(label, 0, size * 0.02);
  return c;
}

export class PlaceholderGame extends BaseGame {
  constructor(o) {
    const st = STYLE[o.slot.code] ?? STYLE['zloty-faraon'];
    super({
      ...o,
      config: {
        code: o.slot.code, reels: o.slot.reels, rows: o.slot.rows, timing: st.timing, engine: st.engine, wildCode: 'wild',
        soundKey: st.prefix, music: st.music, reelLoop: st.loop, bgLuma: 0.08, fillerWeights: st.weights, lineColors: [0xffe08a, 0x2ec4b6],
      },
    });
    this.style = st;
  }

  imageRequests() {
    return Object.keys(this.style.symbols).flatMap((code) => {
      const id = `${this.style.prefix}_sym_${code}`;
      return [{ id }, { id, variant: 'ruch1' }, { id, variant: 'ruch2' }, { id, variant: 'glow' }, { id, variant: 'syl' }];
    });
  }

  async buildViews() {
    const { PIXI } = this;
    for (const [code, [color, label]] of Object.entries(this.style.symbols)) {
      const id = `${this.style.prefix}_sym_${code}`;
      const main = this.resources.texture(id);
      if (main) {
        this.views.set(code, { main, blur1: this.resources.texture(id, 'ruch1'), blur2: this.resources.texture(id, 'ruch2'), glow: this.resources.texture(id, 'glow'), syl: this.resources.texture(id, 'syl'), scale: 1 });
        continue;
      }
      const c = drawTile(192, color, label);
      const glow = softShape(c, { pad: 0.15, blur: 0.07 });
      this.views.set(code, {
        main: canvasTexture(PIXI, c), blur1: canvasTexture(PIXI, motionBlur(c, 0.08)), blur2: canvasTexture(PIXI, motionBlur(c, 0.14, 1.04)),
        syl: canvasTexture(PIXI, silhouette(c)), glow: canvasTexture(PIXI, glow), scale: 0.96, glowScale: glow.width / c.width,
      });
    }
  }

  buildScene() {
    const { PIXI } = this;
    const L = this.gameApp.layers;
    this.bg = new PIXI.Sprite(PIXI.Texture.WHITE);
    this.bg.tint = 0x07060f;
    L.bg.addChild(this.bg);
    this.glowBg = new PIXI.Sprite(this.tex.radial);
    this.glowBg.anchor.set(0.5);
    this.glowBg.tint = this.style.frame;
    this.glowBg.alpha = 0.25;
    L.bg.addChild(this.glowBg);
    this.under = new PIXI.Graphics();
    L.under.addChild(this.under);
    this.frameG = new PIXI.Graphics();
    L.frame.addChild(this.frameG);
    this.title = new PIXI.Text({ text: this.slot.name, style: { fontFamily: 'Cinzel, Georgia, serif', fontWeight: '900', fontSize: 40, fill: '#FFE08A', stroke: { color: '#3D2700', width: 5 } } });
    this.title.anchor.set(0.5, 1);
    L.logo.addChild(this.title);
  }

  layoutScene(lay) {
    const { w, h } = lay;
    const R = this.config.reels;
    const rows = this.config.rows;
    const top = Math.max(40, h * 0.1);
    const S = Math.floor(Math.min((w * 0.92) / (R + 0.4), (h - top - h * 0.06) / (rows + 0.4)));
    const gap = S * 0.04;
    const winW = R * S + (R - 1) * gap;
    const winH = rows * S;
    const x = (w - winW) / 2;
    const y = top + (h - top - winH) / 2;
    this.bg.width = w;
    this.bg.height = h;
    this.glowBg.position.set(w / 2, h / 2);
    this.glowBg.width = w * 1.4;
    this.glowBg.height = h * 1.2;
    this.under.clear().roundRect(x - S * 0.1, y - S * 0.1, winW + S * 0.2, winH + S * 0.2, S * 0.12).fill({ color: 0x0a0820, alpha: 0.92 });
    this.frameG.clear()
      .roundRect(x - S * 0.12, y - S * 0.12, winW + S * 0.24, winH + S * 0.24, S * 0.14)
      .stroke({ width: Math.max(3, S * 0.05), color: this.style.frame, alpha: 0.95 })
      .roundRect(x - S * 0.2, y - S * 0.2, winW + S * 0.4, winH + S * 0.4, S * 0.18)
      .stroke({ width: Math.max(2, S * 0.02), color: 0xf5c542, alpha: 0.5 });
    this.title.position.set(w / 2, y - S * 0.25);
    this.title.style.fontSize = Math.max(20, S * 0.32);
    return { x, y, cell: S, gap };
  }
}
