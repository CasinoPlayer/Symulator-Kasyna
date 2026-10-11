/**
 * game/games/s1-art.js — grafika zastępcza S1 „Cebulowy 777” rysowana w kodzie (Canvas 2D).
 *
 * Kiedy: gdy w manifeście (static/assets/img/manifest.json) nie ma obrazów `s1_*`. Pipeline grafiki dostarczy
 * je później (obrazy z ChatGPT albo zastępcze z Blendera) — wtedy ten kod nie jest używany, a gra pyta o ID.
 * Styl według 01 § 9: retro Las Vegas + synthwave — cukierkowa emalia, chrom, złoto, neon magenta/cyjan,
 * światło z lewej-góry, rim cyjan z prawej i magenta z lewej-dołu. Nie szare kwadraty: gracz bez grafiki z ChatGPT
 * dalej widzi „prawdziwy” automat.
 *
 * Warianty symboli liczymy tu tak samo jak pipeline (02 § 5.15–5.16): ruch1/ruch2 (pionowe rozmycie ruchu),
 * syl (biała sylwetka), glow (miękka poświata do tintu), cien (rozmyta czarna sylwetka).
 */

import { makeCanvas, linear, radial, GOLD_STOPS } from '../core/canvas-art.js';

const PINK = '#FF2E88';
const CYAN = '#21E6FF';

// ------------------------------------------------------------------------------------------------ pomocnicze

function gloss(x, cx, cy, rx, ry, a = 0.55, rot = -0.6) {
  x.save();
  x.translate(cx, cy);
  x.rotate(rot);
  x.fillStyle = radial(x, 0, 0, 0, Math.max(rx, ry), [[0, `rgba(255,255,255,${a})`], [1, 'rgba(255,255,255,0)']]);
  x.scale(1, ry / rx);
  x.beginPath();
  x.arc(0, 0, rx, 0, Math.PI * 2);
  x.fill();
  x.restore();
}

/** Rim neonu: cienki obrys z poświatą po wskazanej stronie (przycięty do półpłaszczyzny). */
function rim(x, pathFn, color, s, side = 'right') {
  x.save();
  x.beginPath();
  if (side === 'right') x.rect(s * 0.5, 0, s, s);
  else x.rect(0, s * 0.5, s * 0.5, s);
  x.clip();
  x.shadowColor = color;
  x.shadowBlur = s * 0.04;
  x.strokeStyle = color;
  x.lineWidth = s * 0.012;
  pathFn();
  x.stroke();
  x.restore();
}

function outline(x, pathFn, s, color = 'rgba(20,4,24,0.85)') {
  x.save();
  x.lineJoin = 'round';
  x.strokeStyle = color;
  x.lineWidth = s * 0.018;
  pathFn();
  x.stroke();
  x.restore();
}

function leaf(x, px, py, len, ang, s) {
  x.save();
  x.translate(px, py);
  x.rotate(ang);
  const path = () => {
    x.beginPath();
    x.moveTo(0, 0);
    x.bezierCurveTo(len * 0.3, -len * 0.42, len * 0.8, -len * 0.38, len, 0);
    x.bezierCurveTo(len * 0.75, len * 0.32, len * 0.3, len * 0.34, 0, 0);
  };
  path();
  x.fillStyle = linear(x, 0, -len * 0.4, 0, len * 0.4, [[0, '#7CF29A'], [0.5, '#1FAA4D'], [1, '#0B5A26']]);
  x.fill();
  outline(x, path, s, 'rgba(4,30,10,0.8)');
  x.strokeStyle = 'rgba(200,255,210,0.6)';
  x.lineWidth = s * 0.006;
  x.beginPath();
  x.moveTo(len * 0.05, 0);
  x.quadraticCurveTo(len * 0.5, -len * 0.06, len * 0.95, 0);
  x.stroke();
  x.restore();
}

// ------------------------------------------------------------------------------------------------ symbole

const SYMBOLS = {
  wisnie(x, s) {
    const stem = (sx, sy) => {
      x.beginPath();
      x.moveTo(sx, sy);
      x.quadraticCurveTo(s * 0.5, s * 0.32, s * 0.58, s * 0.17);
    };
    x.lineCap = 'round';
    x.strokeStyle = '#0E5A24';
    x.lineWidth = s * 0.03;
    stem(s * 0.34, s * 0.5);
    x.stroke();
    stem(s * 0.66, s * 0.54);
    x.stroke();
    x.strokeStyle = '#3FD06A';
    x.lineWidth = s * 0.012;
    stem(s * 0.34, s * 0.5);
    x.stroke();
    leaf(x, s * 0.58, s * 0.17, s * 0.26, -0.25, s);
    for (const [cx, cy] of [[0.33, 0.66], [0.66, 0.69]]) {
      const X = cx * s;
      const Y = cy * s;
      const r = s * 0.185;
      const path = () => { x.beginPath(); x.arc(X, Y, r, 0, Math.PI * 2); };
      path();
      x.fillStyle = radial(x, X - r * 0.35, Y - r * 0.4, r * 0.05, r * 1.15, [[0, '#FF8A9A'], [0.25, '#F0233F'], [0.7, '#B00C29'], [1, '#4A0012']]);
      x.fill();
      outline(x, path, s);
      rim(x, path, PINK, s, 'left');
      gloss(x, X - r * 0.38, Y - r * 0.42, r * 0.34, r * 0.2, 0.85);
      x.fillStyle = 'rgba(255,255,255,0.95)';
      x.beginPath();
      x.arc(X - r * 0.42, Y - r * 0.45, r * 0.09, 0, Math.PI * 2);
      x.fill();
    }
  },

  cytryna(x, s) {
    const path = () => {
      x.beginPath();
      x.moveTo(s * 0.12, s * 0.56);
      x.bezierCurveTo(s * 0.18, s * 0.28, s * 0.58, s * 0.2, s * 0.82, s * 0.36);
      x.lineTo(s * 0.9, s * 0.34);
      x.bezierCurveTo(s * 0.92, s * 0.62, s * 0.5, s * 0.84, s * 0.2, s * 0.68);
      x.lineTo(s * 0.1, s * 0.6);
      x.closePath();
    };
    path();
    x.fillStyle = radial(x, s * 0.4, s * 0.38, s * 0.04, s * 0.56, [[0, '#FFFBD0'], [0.3, '#FFE75A'], [0.75, '#F2B705'], [1, '#9A6A00']]);
    x.fill();
    // faktura skórki
    x.save();
    path();
    x.clip();
    x.fillStyle = 'rgba(160,110,0,0.18)';
    for (let i = 0; i < 70; i++) {
      const px = s * (0.15 + ((i * 37) % 70) / 100);
      const py = s * (0.3 + ((i * 53) % 45) / 100);
      x.beginPath();
      x.arc(px, py, s * 0.006, 0, Math.PI * 2);
      x.fill();
    }
    x.restore();
    outline(x, path, s, 'rgba(70,40,0,0.85)');
    rim(x, path, CYAN, s, 'right');
    gloss(x, s * 0.38, s * 0.38, s * 0.16, s * 0.07, 0.75, -0.35);
    leaf(x, s * 0.78, s * 0.33, s * 0.2, -1.1, s);
  },

  sliwka(x, s) {
    const path = () => {
      x.beginPath();
      x.ellipse(s * 0.5, s * 0.57, s * 0.29, s * 0.33, 0.08, 0, Math.PI * 2);
    };
    path();
    x.fillStyle = radial(x, s * 0.4, s * 0.42, s * 0.04, s * 0.42, [[0, '#E0A8FF'], [0.3, '#9B45E0'], [0.75, '#5B1A9A'], [1, '#22063F']]);
    x.fill();
    // bruzda
    x.strokeStyle = 'rgba(30,5,55,0.55)';
    x.lineWidth = s * 0.02;
    x.beginPath();
    x.moveTo(s * 0.5, s * 0.27);
    x.bezierCurveTo(s * 0.62, s * 0.45, s * 0.6, s * 0.7, s * 0.52, s * 0.89);
    x.stroke();
    outline(x, path, s);
    rim(x, path, PINK, s, 'left');
    rim(x, path, CYAN, s, 'right');
    // „nalot” u góry
    x.fillStyle = radial(x, s * 0.45, s * 0.35, 0, s * 0.22, [[0, 'rgba(240,225,255,0.45)'], [1, 'rgba(240,225,255,0)']]);
    x.fillRect(0, 0, s, s);
    gloss(x, s * 0.38, s * 0.42, s * 0.12, s * 0.06, 0.7);
    x.strokeStyle = '#4A2A10';
    x.lineWidth = s * 0.025;
    x.lineCap = 'round';
    x.beginPath();
    x.moveTo(s * 0.5, s * 0.27);
    x.lineTo(s * 0.53, s * 0.16);
    x.stroke();
    leaf(x, s * 0.53, s * 0.2, s * 0.22, -0.4, s);
  },

  arbuz(x, s) {
    const cx = s * 0.5;
    const cy = s * 0.36;
    const R = s * 0.42;
    const half = (r) => { x.beginPath(); x.moveTo(cx - r, cy); x.arc(cx, cy, r, 0, Math.PI); x.closePath(); };
    // skórka w paski
    half(R);
    x.fillStyle = linear(x, 0, cy, 0, cy + R, [[0, '#2EBD5A'], [1, '#0B4D22']]);
    x.fill();
    x.save();
    half(R);
    x.clip();
    x.strokeStyle = 'rgba(8,50,20,0.6)';
    x.lineWidth = s * 0.03;
    for (let a = 0.15; a < Math.PI; a += 0.32) {
      x.beginPath();
      x.moveTo(cx, cy);
      x.lineTo(cx + Math.cos(a) * R * 1.1, cy + Math.sin(a) * R * 1.1);
      x.stroke();
    }
    x.restore();
    half(R * 0.9);
    x.fillStyle = '#E8FFD8';
    x.fill();
    half(R * 0.84);
    x.fillStyle = radial(x, cx - R * 0.2, cy, R * 0.05, R * 0.9, [[0, '#FF7A8C'], [0.5, '#F2263F'], [1, '#B3122A']]);
    x.fill();
    // pestki w łuku
    for (let i = 0; i < 7; i++) {
      const a = 0.35 + (i / 6) * (Math.PI - 0.7);
      const px = cx + Math.cos(a) * R * 0.52;
      const py = cy + Math.sin(a) * R * 0.52;
      x.save();
      x.translate(px, py);
      x.rotate(a + Math.PI / 2);
      x.fillStyle = '#1A0A08';
      x.beginPath();
      x.ellipse(0, 0, s * 0.018, s * 0.032, 0, 0, Math.PI * 2);
      x.fill();
      x.fillStyle = 'rgba(255,255,255,0.7)';
      x.beginPath();
      x.arc(-s * 0.006, -s * 0.012, s * 0.006, 0, Math.PI * 2);
      x.fill();
      x.restore();
    }
    outline(x, () => half(R), s);
    rim(x, () => half(R), CYAN, s, 'right');
    gloss(x, cx - R * 0.45, cy + R * 0.2, R * 0.25, R * 0.07, 0.6, 0.4);
    // jasna krawędź miąższu u góry
    x.strokeStyle = 'rgba(255,200,210,0.85)';
    x.lineWidth = s * 0.012;
    x.beginPath();
    x.moveTo(cx - R * 0.84, cy);
    x.lineTo(cx + R * 0.84, cy);
    x.stroke();
  },

  dzwonek(x, s) {
    const path = () => {
      x.beginPath();
      x.moveTo(s * 0.5, s * 0.17);
      x.bezierCurveTo(s * 0.7, s * 0.17, s * 0.72, s * 0.35, s * 0.73, s * 0.5);
      x.bezierCurveTo(s * 0.74, s * 0.66, s * 0.8, s * 0.72, s * 0.88, s * 0.78);
      x.lineTo(s * 0.12, s * 0.78);
      x.bezierCurveTo(s * 0.2, s * 0.72, s * 0.26, s * 0.66, s * 0.27, s * 0.5);
      x.bezierCurveTo(s * 0.28, s * 0.35, s * 0.3, s * 0.17, s * 0.5, s * 0.17);
      x.closePath();
    };
    // serduszko
    x.fillStyle = radial(x, s * 0.47, s * 0.83, 0, s * 0.08, [[0, '#FFF0B0'], [0.6, '#C99A1E'], [1, '#5C3A00']]);
    x.beginPath();
    x.arc(s * 0.5, s * 0.83, s * 0.065, 0, Math.PI * 2);
    x.fill();
    path();
    x.fillStyle = linear(x, s * 0.2, 0, s * 0.85, 0, [[0, '#8A5E05'], [0.18, '#FFE08A'], [0.38, '#FFF6D6'], [0.6, '#F5C542'], [0.85, '#B8860B'], [1, '#5C3A00']]);
    x.fill();
    // grawerowana opaska
    x.fillStyle = linear(x, 0, s * 0.6, 0, s * 0.68, [[0, '#7A4F00'], [0.5, '#FFE08A'], [1, '#7A4F00']]);
    x.save();
    path();
    x.clip();
    x.fillRect(0, s * 0.6, s, s * 0.07);
    x.fillStyle = 'rgba(255,246,214,0.5)';
    x.fillRect(0, s * 0.74, s, s * 0.02);
    x.restore();
    outline(x, path, s, 'rgba(60,35,0,0.9)');
    rim(x, path, CYAN, s, 'right');
    gloss(x, s * 0.4, s * 0.36, s * 0.07, s * 0.16, 0.8, 0.15);
    // kokarda
    x.fillStyle = linear(x, 0, s * 0.08, 0, s * 0.24, [[0, '#FF5A6E'], [0.6, '#D4142E'], [1, '#7A0016']]);
    for (const d of [-1, 1]) {
      x.beginPath();
      x.moveTo(s * 0.5, s * 0.16);
      x.bezierCurveTo(s * (0.5 + d * 0.1), s * 0.04, s * (0.5 + d * 0.2), s * 0.08, s * (0.5 + d * 0.17), s * 0.17);
      x.bezierCurveTo(s * (0.5 + d * 0.14), s * 0.22, s * (0.5 + d * 0.05), s * 0.2, s * 0.5, s * 0.16);
      x.fill();
    }
    x.beginPath();
    x.arc(s * 0.5, s * 0.16, s * 0.035, 0, Math.PI * 2);
    x.fill();
  },

  bar(x, s) {
    const rr = (px, py, w, h, r) => { x.beginPath(); x.roundRect(px, py, w, h, r); };
    // chromowana fazowana ramka
    rr(s * 0.08, s * 0.28, s * 0.84, s * 0.44, s * 0.07);
    x.fillStyle = linear(x, 0, s * 0.28, 0, s * 0.72, [[0, '#FFFFFF'], [0.2, '#C9D2E3'], [0.5, '#6B7590'], [0.55, '#E6ECF5'], [1, '#3A4058']]);
    x.fill();
    outline(x, () => rr(s * 0.08, s * 0.28, s * 0.84, s * 0.44, s * 0.07), s);
    rr(s * 0.12, s * 0.32, s * 0.76, s * 0.36, s * 0.05);
    x.fillStyle = linear(x, 0, s * 0.32, 0, s * 0.68, [[0, '#2A2438'], [0.45, '#0A0810'], [1, '#000000']]);
    x.fill();
    gloss(x, s * 0.36, s * 0.38, s * 0.22, s * 0.04, 0.35, 0);
    x.font = `400 ${Math.round(s * 0.27)}px "Bungee", "Manrope", sans-serif`;
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    x.shadowColor = PINK;
    x.shadowBlur = s * 0.05;
    x.lineWidth = s * 0.022;
    x.strokeStyle = PINK;
    x.strokeText('BAR', s * 0.5, s * 0.515);
    x.shadowBlur = 0;
    x.fillStyle = linear(x, 0, s * 0.38, 0, s * 0.64, [[0, '#FFFFFF'], [0.45, '#C9D2E3'], [0.55, '#7A84A0'], [1, '#E6ECF5']]);
    x.fillText('BAR', s * 0.5, s * 0.515);
  },

  siodemka(x, s) {
    x.save();
    x.translate(s * 0.53, s * 0.55);
    x.transform(1, 0, -0.18, 1, 0, 0);   // kursywa
    x.font = `400 ${Math.round(s * 0.8)}px "Bungee", "Manrope", sans-serif`;
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    // grube fazowane złote obramowanie
    x.lineJoin = 'round';
    x.lineWidth = s * 0.11;
    x.strokeStyle = '#3D2700';
    x.strokeText('7', 0, s * 0.01);
    x.lineWidth = s * 0.085;
    x.strokeStyle = linear(x, 0, -s * 0.35, 0, s * 0.35, GOLD_STOPS);
    x.strokeText('7', 0, 0);
    x.fillStyle = linear(x, -s * 0.2, -s * 0.35, s * 0.2, s * 0.35, [[0, '#FF7A85'], [0.3, '#F01F38'], [0.75, '#A80A22'], [1, '#55000F']]);
    x.fillText('7', 0, 0);
    // cienka biała linia neonu wewnątrz
    x.lineWidth = s * 0.012;
    x.strokeStyle = 'rgba(255,255,255,0.9)';
    x.shadowColor = '#FFFFFF';
    x.shadowBlur = s * 0.02;
    x.strokeText('7', 0, 0);
    x.restore();
    gloss(x, s * 0.42, s * 0.3, s * 0.16, s * 0.05, 0.6, -0.2);
    // dwie gwiazdki-błyski
    for (const [px, py, r] of [[0.78, 0.2, 0.07], [0.22, 0.8, 0.05]]) {
      x.save();
      x.translate(px * s, py * s);
      x.fillStyle = '#FFFFFF';
      x.shadowColor = '#FFF3D1';
      x.shadowBlur = s * 0.03;
      x.beginPath();
      for (let i = 0; i < 8; i++) {
        const a = (Math.PI * i) / 4;
        const rad = i % 2 ? r * s * 0.22 : r * s;
        x.lineTo(Math.cos(a) * rad, Math.sin(a) * rad);
      }
      x.fill();
      x.restore();
    }
  },

  wild(x, s) {
    // neonowy pierścień za cebulą (magenta → cyjan)
    x.save();
    x.lineWidth = s * 0.035;
    x.strokeStyle = linear(x, s * 0.1, 0, s * 0.9, 0, [[0, PINK], [1, CYAN]]);
    x.shadowColor = PINK;
    x.shadowBlur = s * 0.06;
    x.beginPath();
    x.arc(s * 0.5, s * 0.48, s * 0.39, 0, Math.PI * 2);
    x.stroke();
    x.shadowColor = CYAN;
    x.lineWidth = s * 0.012;
    x.strokeStyle = '#FFFFFF';
    x.stroke();
    x.restore();
    // złota cebula
    const onion = () => {
      x.beginPath();
      x.moveTo(s * 0.5, s * 0.08);
      x.bezierCurveTo(s * 0.47, s * 0.16, s * 0.41, s * 0.22, s * 0.34, s * 0.3);
      x.bezierCurveTo(s * 0.18, s * 0.45, s * 0.19, s * 0.72, s * 0.5, s * 0.8);
      x.bezierCurveTo(s * 0.81, s * 0.72, s * 0.82, s * 0.45, s * 0.66, s * 0.3);
      x.bezierCurveTo(s * 0.59, s * 0.22, s * 0.53, s * 0.16, s * 0.5, s * 0.08);
      x.closePath();
    };
    onion();
    x.fillStyle = radial(x, s * 0.4, s * 0.38, s * 0.03, s * 0.5, [[0, '#FFF6D6'], [0.25, '#FFE08A'], [0.6, '#E0A82A'], [1, '#6B4300']]);
    x.fill();
    x.save();
    onion();
    x.clip();
    x.strokeStyle = 'rgba(110,70,0,0.45)';
    x.lineWidth = s * 0.012;
    for (const d of [-0.2, -0.1, 0, 0.1, 0.2]) {
      x.beginPath();
      x.moveTo(s * 0.5, s * 0.1);
      x.quadraticCurveTo(s * (0.5 + d * 1.6), s * 0.5, s * 0.5, s * 0.8);
      x.stroke();
    }
    x.restore();
    outline(x, onion, s, 'rgba(60,35,0,0.9)');
    gloss(x, s * 0.38, s * 0.4, s * 0.06, s * 0.16, 0.85, 0.3);
    // zakręcony czubek
    x.strokeStyle = '#FFE08A';
    x.lineWidth = s * 0.02;
    x.lineCap = 'round';
    x.beginPath();
    x.moveTo(s * 0.5, s * 0.09);
    x.quadraticCurveTo(s * 0.58, s * 0.02, s * 0.62, s * 0.07);
    x.stroke();
    // czarna wstęga z napisem WILD
    const band = () => {
      x.beginPath();
      x.moveTo(s * 0.08, s * 0.6);
      x.quadraticCurveTo(s * 0.5, s * 0.54, s * 0.92, s * 0.6);
      x.lineTo(s * 0.92, s * 0.78);
      x.quadraticCurveTo(s * 0.5, s * 0.72, s * 0.08, s * 0.78);
      x.closePath();
    };
    band();
    x.fillStyle = linear(x, 0, s * 0.56, 0, s * 0.78, [[0, '#2A2438'], [0.5, '#07060F'], [1, '#000']]);
    x.fill();
    x.lineWidth = s * 0.014;
    x.strokeStyle = linear(x, 0, s * 0.56, 0, s * 0.78, [[0, '#FFFFFF'], [0.5, '#6B7590'], [1, '#E6ECF5']]);
    band();
    x.stroke();
    x.font = `400 ${Math.round(s * 0.15)}px "Bungee", "Manrope", sans-serif`;
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    x.shadowColor = PINK;
    x.shadowBlur = s * 0.04;
    x.fillStyle = '#FFFFFF';
    x.lineWidth = s * 0.016;
    x.strokeStyle = PINK;
    x.strokeText('WILD', s * 0.5, s * 0.68);
    x.fillText('WILD', s * 0.5, s * 0.68);
  },
};

export const S1_SYMBOL_CODES = Object.keys(SYMBOLS);

/** Symbol na płótnie `size`×`size` (symbol zajmuje ~86% kadru — margines na poświatę i obrys). */
export function drawS1Symbol(code, size) {
  const c = makeCanvas(size, size);
  const x = c.getContext('2d');
  const draw = SYMBOLS[code];
  if (!draw) {
    x.fillStyle = '#fff';
    x.font = `800 ${size * 0.3}px Manrope, sans-serif`;
    x.textAlign = 'center';
    x.fillText(code.slice(0, 3).toUpperCase(), size / 2, size * 0.6);
    return c;
  }
  x.save();
  x.translate(size * 0.04, size * 0.04);
  x.scale(0.92, 0.92);
  draw(x, size);
  x.restore();
  return c;
}

/** Pionowe rozmycie ruchu (ruch1/ruch2): kopie przesunięte w pionie; płótno wyższe o długość smugi. */
export function motionBlur(src, amount, stretch = 1) {
  const L = Math.round(src.height * amount);
  const c = makeCanvas(src.width, src.height + L);
  const x = c.getContext('2d');
  const n = 9;
  x.globalAlpha = 1.6 / n;
  for (let i = 0; i < n; i++) {
    const off = (i / (n - 1)) * L;
    x.drawImage(src, 0, off - (src.height * (stretch - 1)) / 2, src.width, src.height * stretch);
  }
  x.globalAlpha = 1;
  x.globalCompositeOperation = 'source-atop';
  x.fillStyle = 'rgba(10,6,30,0.06)';
  x.fillRect(0, 0, c.width, c.height);
  return c;
}

/** Biała sylwetka (błysk `syl`). */
export function silhouette(src, color = '#FFFFFF') {
  const c = makeCanvas(src.width, src.height);
  const x = c.getContext('2d');
  x.drawImage(src, 0, 0);
  x.globalCompositeOperation = 'source-in';
  x.fillStyle = color;
  x.fillRect(0, 0, c.width, c.height);
  return c;
}

/** Miękka poświata / cień: sylwetka rozmyta przez shadowBlur na płótnie większym o `pad` (ułamek boku). */
export function softShape(src, { color = '#FFFFFF', pad = 0.15, blur = 0.06, passes = 2 } = {}) {
  const P = Math.round(src.width * pad);
  const c = makeCanvas(src.width + 2 * P, src.height + 2 * P);
  const x = c.getContext('2d');
  const sil = silhouette(src, color);
  // rysujemy sylwetkę daleko poza płótnem, a na płótno trafia tylko jej rozmyty cień — czysta poświata bez krawędzi
  x.shadowColor = color;
  x.shadowBlur = src.width * blur;
  x.shadowOffsetX = 10000;
  for (let i = 0; i < passes; i++) x.drawImage(sil, P - 10000, P);
  return c;
}

// ------------------------------------------------------------------------------------------------ tło

/**
 * Tło synthwave (01 § 9.5): niebo #0B0624 → #3A0CA3 → łuna, pasiaste słońce za automatem, gwiazdy, siatka
 * perspektywiczna podłogi, sylwetki palm przy krawędziach; strefa panelu przyciemniona.
 * @param {{w: number, h: number, horizon: number, sunY: number}} o
 */
export function drawS1Background(w, h, { horizon = 0.5, sunX = 0.5, sunY = null, sunR = null } = {}) {
  const c = makeCanvas(w, h);
  const x = c.getContext('2d');
  const hy = h * horizon;
  x.fillStyle = linear(x, 0, 0, 0, hy, [[0, '#07031A'], [0.35, '#0B0624'], [0.7, '#3A0CA3'], [0.92, '#B02A8C'], [1, '#FF7A3D']]);
  x.fillRect(0, 0, w, hy + 1);
  // gwiazdy
  let seed = 11;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < Math.round((w * hy) / 5000); i++) {
    const px = rnd() * w;
    const py = rnd() * hy * 0.75;
    const r = rnd() * 1.4 + 0.3;
    x.fillStyle = `rgba(255,255,255,${0.25 + rnd() * 0.6})`;
    x.beginPath();
    x.arc(px, py, r, 0, Math.PI * 2);
    x.fill();
  }
  // słońce z pasami (za automatem)
  const R = sunR ?? Math.min(w, h) * 0.3;
  const sy = sunY ?? hy - R * 0.25;
  const sx = w * sunX;
  x.save();
  x.beginPath();
  x.rect(0, 0, w, hy);
  x.clip();
  x.fillStyle = radial(x, sx, sy, R * 0.8, R * 2.2, [[0, 'rgba(255,122,61,0.45)'], [1, 'rgba(255,46,136,0)']]);
  x.fillRect(0, 0, w, hy);
  // tarcza słońca na osobnym płótnie: pasy wycinamy tylko z tarczy, nie z nieba wokół
  const sun = makeCanvas(R * 2 + 4, R * 2 + 4);
  const sx2 = sun.getContext('2d');
  sx2.beginPath();
  sx2.arc(R + 2, R + 2, R, 0, Math.PI * 2);
  sx2.fillStyle = linear(sx2, 0, 2, 0, R * 2 + 2, [[0, '#FFE45C'], [0.45, '#FF9A3D'], [1, '#FF2E88']]);
  sx2.fill();
  sx2.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 7; i++) {
    const t = i / 7;
    const by = R + 2 + R * (0.05 + t * 0.95);
    sx2.fillRect(0, by, R * 2 + 4, R * (0.025 + t * 0.07));
  }
  x.drawImage(sun, sx - R - 2, sy - R - 2);
  x.restore();
  // podłoga
  x.fillStyle = linear(x, 0, hy, 0, h, [[0, '#1A0640'], [0.5, '#0B0624'], [1, '#05030F']]);
  x.fillRect(0, hy, w, h - hy);
  // siatka perspektywiczna: linie zbiegające się w punkcie zbiegu + poziome z rosnącym odstępem
  x.save();
  x.beginPath();
  x.rect(0, hy, w, h - hy);
  x.clip();
  x.strokeStyle = 'rgba(43,107,255,0.75)';
  x.shadowColor = '#2B6BFF';
  x.shadowBlur = 6;
  x.lineWidth = Math.max(1, w / 900);
  for (let i = -24; i <= 24; i++) {
    x.beginPath();
    x.moveTo(sx + i * w * 0.006, hy);
    x.lineTo(sx + i * w * 0.11, h * 1.05);
    x.stroke();
  }
  x.strokeStyle = 'rgba(255,46,136,0.7)';
  x.shadowColor = PINK;
  for (let i = 1; i < 16; i++) {
    const y = hy + (h - hy) * (i / 16) ** 2.1;
    x.globalAlpha = 0.35 + 0.65 * (i / 16);
    x.beginPath();
    x.moveTo(0, y);
    x.lineTo(w, y);
    x.stroke();
  }
  x.restore();
  x.fillStyle = linear(x, 0, hy - 2, 0, hy + h * 0.04, [[0, 'rgba(255,170,90,0.9)'], [1, 'rgba(255,46,136,0)']]);
  x.fillRect(0, hy - 2, w, h * 0.04);
  // palmy (sylwetki) przy krawędziach
  const palm = (bx, scale, flip) => {
    x.save();
    x.translate(bx, hy + h * 0.02);
    x.scale(flip ? -scale : scale, scale);
    x.fillStyle = '#07031A';
    x.beginPath();
    x.moveTo(-6, 0);
    x.quadraticCurveTo(10, -120, 30, -260);
    x.lineTo(38, -258);
    x.quadraticCurveTo(22, -120, 8, 0);
    x.fill();
    for (let i = 0; i < 7; i++) {
      const a = -Math.PI / 2 + (i - 3) * 0.45;
      x.beginPath();
      x.moveTo(34, -258);
      x.quadraticCurveTo(34 + Math.cos(a - 0.4) * 70, -258 + Math.sin(a - 0.4) * 70, 34 + Math.cos(a) * 120, -258 + Math.sin(a) * 60 + 40);
      x.quadraticCurveTo(34 + Math.cos(a + 0.3) * 60, -258 + Math.sin(a + 0.3) * 50, 34, -250);
      x.fill();
    }
    x.restore();
  };
  const ps = h / 900;
  palm(w * 0.04, ps * 1.1, false);
  palm(w * 0.13, ps * 0.75, false);
  palm(w * 0.96, ps * 1.15, true);
  palm(w * 0.87, ps * 0.8, true);
  // winieta i ciemny dół (strefa panelu)
  x.fillStyle = radial(x, w / 2, h * 0.45, Math.min(w, h) * 0.3, Math.max(w, h) * 0.85, [[0, 'rgba(0,0,0,0)'], [1, 'rgba(0,0,0,0.6)']]);
  x.fillRect(0, 0, w, h);
  x.fillStyle = linear(x, 0, h * 0.82, 0, h, [[0, 'rgba(7,6,15,0)'], [1, 'rgba(7,6,15,0.85)']]);
  x.fillRect(0, h * 0.82, w, h * 0.18);
  return c;
}

// ------------------------------------------------------------------------------------------------ ramka i logo

/**
 * Ramka automatu (01 § 9.6): chrom z zaokrąglonymi narożnikami, złota listwa przy oknie, rurki neonu (zgaszone
 * szkło — świecenie dokłada kod osobnymi sprite'ami), grzebień z żarówkami i gwiazdką „atomic age”, półka u dołu.
 * Geometria w jednostkach pola S: okno 3S × 3S + odstępy, ramka: boki 0,3S, góra 0,62S, dół 0,42S
 * (smukła ramka — okno bębnów ma być jak największe także na telefonie poziomo).
 * @returns {{canvas, window: {x, y, w, h}, bulbs: {x, y}[], tubes: {outer: object, inner: object}}} współrzędne jako ułamki płótna
 */
export function frameGeometry(S, gap) {
  const winW = 3 * S + 2 * gap;
  const winH = 3 * S;
  const side = 0.3 * S;
  const top = 0.62 * S;
  const bottom = 0.42 * S;
  const W = winW + 2 * side;
  const H = winH + top + bottom;
  return { W, H, win: { x: side, y: top, w: winW, h: winH }, side, top, bottom };
}

export function drawS1Frame(S, gap) {
  const g = frameGeometry(S, gap);
  const { W, H, win } = g;
  const c = makeCanvas(W, H);
  const x = c.getContext('2d');
  const r = S * 0.22;
  const outer = { x: S * 0.04, y: g.top * 0.42, w: W - S * 0.08, h: H - g.top * 0.42 - S * 0.04 };
  // korpus z chromu
  x.beginPath();
  x.roundRect(outer.x, outer.y, outer.w, outer.h, r);
  x.fillStyle = linear(x, 0, outer.y, 0, outer.y + outer.h, [[0, '#F4F7FC'], [0.08, '#9AA3BC'], [0.2, '#E6ECF5'], [0.5, '#4E566E'], [0.62, '#C9D2E3'], [0.85, '#3A4058'], [1, '#1A1E2C']]);
  x.fill();
  x.lineWidth = S * 0.02;
  x.strokeStyle = 'rgba(10,10,20,0.9)';
  x.stroke();
  // pionowe refleksy chromu
  x.save();
  x.beginPath();
  x.roundRect(outer.x, outer.y, outer.w, outer.h, r);
  x.clip();
  x.fillStyle = linear(x, outer.x, 0, outer.x + outer.w, 0, [[0, 'rgba(255,46,136,0.25)'], [0.12, 'rgba(255,255,255,0.15)'], [0.5, 'rgba(0,0,0,0)'], [0.88, 'rgba(255,255,255,0.12)'], [1, 'rgba(33,230,255,0.28)']]);
  x.fillRect(outer.x, outer.y, outer.w, outer.h);
  x.restore();
  // grzebień (łuk) u góry
  const crestH = g.top * 0.62;
  x.beginPath();
  x.moveTo(outer.x + S * 0.5, outer.y + S * 0.05);
  x.quadraticCurveTo(W / 2, outer.y - crestH * 1.25, outer.x + outer.w - S * 0.5, outer.y + S * 0.05);
  x.closePath();
  x.fillStyle = linear(x, 0, outer.y - crestH, 0, outer.y, [[0, '#FFFFFF'], [0.3, '#C9D2E3'], [0.7, '#5B6380'], [1, '#2B3045']]);
  x.fill();
  x.strokeStyle = 'rgba(10,10,20,0.85)';
  x.lineWidth = S * 0.015;
  x.stroke();
  // gwiazdka „atomic age” na szczycie grzebienia
  x.save();
  x.translate(W / 2, outer.y - crestH * 0.28);
  x.fillStyle = linear(x, 0, -S * 0.2, 0, S * 0.2, GOLD_STOPS);
  x.strokeStyle = '#3D2700';
  x.lineWidth = S * 0.01;
  x.beginPath();
  for (let i = 0; i < 16; i++) {
    const a = (Math.PI * i) / 8 - Math.PI / 2;
    const rad = i % 2 ? S * 0.03 : (i % 4 === 0 ? S * 0.11 : S * 0.06);
    x.lineTo(Math.cos(a) * rad, Math.sin(a) * rad);
  }
  x.closePath();
  x.fill();
  x.stroke();
  x.restore();
  // zgaszone szkło rurek neonu (świecenie dokłada kod)
  const tube = (inset, color) => {
    x.beginPath();
    x.roundRect(win.x - inset, win.y - inset, win.w + 2 * inset, win.h + 2 * inset, S * 0.08 + inset * 0.6);
    x.strokeStyle = color;
    x.lineWidth = S * 0.035;
    x.stroke();
  };
  tube(S * 0.2, 'rgba(120,20,70,0.85)');
  tube(S * 0.085, 'rgba(10,70,90,0.85)');
  // złota listwa przy oknie
  x.beginPath();
  x.roundRect(win.x - S * 0.035, win.y - S * 0.035, win.w + S * 0.07, win.h + S * 0.07, S * 0.06);
  x.lineWidth = S * 0.035;
  x.strokeStyle = linear(x, 0, win.y, 0, win.y + win.h, GOLD_STOPS);
  x.stroke();
  // okno: przezroczyste (bębny rysuje kod pod ramką)
  x.globalCompositeOperation = 'destination-out';
  x.beginPath();
  x.roundRect(win.x, win.y, win.w, win.h, S * 0.05);
  x.fill();
  x.globalCompositeOperation = 'source-over';
  // półka u dołu z nitami
  const shelfY = win.y + win.h + S * 0.16;
  x.fillStyle = linear(x, 0, shelfY, 0, shelfY + S * 0.18, [[0, '#FFFFFF'], [0.4, '#8A93AC'], [1, '#262A3C']]);
  x.beginPath();
  x.roundRect(win.x - S * 0.1, shelfY, win.w + S * 0.2, S * 0.17, S * 0.06);
  x.fill();
  for (const px of [win.x + S * 0.25, win.x + win.w - S * 0.25]) {
    x.fillStyle = radial(x, px - S * 0.01, shelfY + S * 0.075, 0, S * 0.05, [[0, '#FFF6D6'], [0.6, '#F5C542'], [1, '#5C3A00']]);
    x.beginPath();
    x.arc(px, shelfY + S * 0.085, S * 0.04, 0, Math.PI * 2);
    x.fill();
  }
  // żarówki grzebienia (pozycje dla kodu — biegnące światła)
  const bulbs = [];
  const N = 19;
  for (let i = 0; i < N; i++) {
    const t = (i + 0.5) / N;
    const bx = outer.x + S * 0.5 + (outer.w - S) * t;
    // punkt na krzywej grzebienia (kwadratowa Béziera) obniżony o 28% wysokości łuku
    const y0 = outer.y + S * 0.05;
    const yc = outer.y - crestH * 1.25;
    const by = (1 - t) * (1 - t) * y0 + 2 * (1 - t) * t * yc + t * t * y0 + crestH * 0.34;
    bulbs.push({ x: bx / W, y: by / H });
    x.fillStyle = radial(x, bx, by, 0, S * 0.045, [[0, '#FFF6D6'], [0.6, '#C9A45A'], [1, '#4A3410']]);
    x.beginPath();
    x.arc(bx, by, S * 0.035, 0, Math.PI * 2);
    x.fill();
  }
  return {
    canvas: c,
    geometry: g,
    window: { x: win.x / W, y: win.y / H, w: win.w / W, h: win.h / H },
    bulbs,
    tubes: { outer: S * 0.2, inner: S * 0.085, width: S * 0.035, radius: S * 0.08 },
  };
}

/** Świecące rurki neonu (osobno zewnętrzna magenta i wewnętrzna cyjan) — sprite'y `add` nad ramką. */
export function drawNeonTube(S, gap, inset, color, widthMul = 1) {
  const g = frameGeometry(S, gap);
  const pad = S * 0.25;
  const c = makeCanvas(g.W + pad * 2, g.H + pad * 2);
  const x = c.getContext('2d');
  const w = g.win;
  const path = () => {
    x.beginPath();
    x.roundRect(pad + w.x - inset, pad + w.y - inset, w.w + 2 * inset, w.h + 2 * inset, S * 0.08 + inset * 0.6);
  };
  x.shadowColor = color;
  x.shadowBlur = S * 0.12;
  x.strokeStyle = color;
  x.lineWidth = S * 0.035 * widthMul;
  path();
  x.stroke();
  x.shadowBlur = S * 0.05;
  path();
  x.stroke();
  x.shadowBlur = S * 0.015;
  x.strokeStyle = 'rgba(255,255,255,0.95)';
  x.lineWidth = S * 0.012 * widthMul;
  path();
  x.stroke();
  return { canvas: c, pad };
}

/**
 * Logo „CEBULOWY 777” (01 § 9.7): ciemna chromowana tablica-szyld z żarówkami na obwodzie, „CEBULOWY” z różowych
 * rurek neonu z białym rdzeniem i cyjanowym konturem, „777” wiśniowo-chromowe w złotej obwódce.
 * Zwraca płótno bazowe i osobne płótno świecenia neonu (do migotania i zapalania — E21, E22).
 */
export function drawS1Logo(width) {
  const W = Math.round(width);
  const H = Math.round(width * 0.42);
  const base = makeCanvas(W, H);
  const glow = makeCanvas(W, H);
  const x = base.getContext('2d');
  // tablica
  const px = W * 0.08;
  const py = H * 0.06;
  const pw = W * 0.84;
  const ph = H * 0.58;
  x.beginPath();
  x.roundRect(px, py, pw, ph, ph * 0.3);
  x.fillStyle = linear(x, 0, py, 0, py + ph, [[0, '#2A2448'], [0.5, '#0E0A22'], [1, '#05030F']]);
  x.fill();
  x.lineWidth = H * 0.025;
  x.strokeStyle = linear(x, 0, py, 0, py + ph, [[0, '#FFFFFF'], [0.5, '#6B7590'], [1, '#C9D2E3']]);
  x.stroke();
  for (let i = 0; i < 26; i++) {
    const t = i / 26;
    const per = 2 * (pw + ph);
    let d = t * per;
    let bx;
    let by;
    if (d < pw) { bx = px + d; by = py; } else if ((d -= pw) < ph) { bx = px + pw; by = py + d; } else if ((d -= ph) < pw) { bx = px + pw - d; by = py + ph; } else { d -= pw; bx = px; by = py + ph - d; }
    bx = Math.min(px + pw - ph * 0.15, Math.max(px + ph * 0.15, bx));
    by = Math.min(py + ph - ph * 0.08, Math.max(py + ph * 0.08, by));
    x.fillStyle = radial(x, bx, by, 0, H * 0.02, [[0, '#FFF6D6'], [1, 'rgba(255,200,120,0)']]);
    x.beginPath();
    x.arc(bx, by, H * 0.02, 0, Math.PI * 2);
    x.fill();
  }
  // CEBULOWY — neon
  const fs1 = Math.round(H * 0.3);
  const font1 = `400 ${fs1}px "Bungee", "Manrope", sans-serif`;
  const drawNeonWord = (ctx, lit) => {
    ctx.font = font1;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const tx = W / 2;
    const ty = py + ph * 0.52;
    if (lit) {
      ctx.shadowColor = PINK;
      ctx.shadowBlur = H * 0.08;
      ctx.fillStyle = 'rgba(255,46,136,0.9)';
      ctx.fillText('CEBULOWY', tx, ty);
      ctx.shadowColor = CYAN;
      ctx.shadowBlur = H * 0.12;
      ctx.fillStyle = 'rgba(33,230,255,0.35)';
      ctx.fillText('CEBULOWY', tx, ty);
      ctx.shadowBlur = 0;
    } else {
      ctx.lineJoin = 'round';
      ctx.lineWidth = H * 0.03;
      ctx.strokeStyle = CYAN;
      ctx.strokeText('CEBULOWY', tx, ty);
      ctx.lineWidth = H * 0.014;
      ctx.strokeStyle = PINK;
      ctx.strokeText('CEBULOWY', tx, ty);
      ctx.fillStyle = '#FFE3F1';
      ctx.fillText('CEBULOWY', tx, ty);
    }
  };
  drawNeonWord(x, false);
  drawNeonWord(glow.getContext('2d'), true);
  // 777 — wiśniowy chrom w złotej obwódce, lekko pochylone
  const fs2 = Math.round(H * 0.42);
  x.save();
  x.translate(W / 2, H * 0.8);
  x.transform(1, 0, -0.14, 1, 0, 0);
  x.font = `400 ${fs2}px "Bungee", "Manrope", sans-serif`;
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  x.lineJoin = 'round';
  x.shadowColor = 'rgba(0,0,0,0.6)';
  x.shadowBlur = H * 0.04;
  x.lineWidth = H * 0.075;
  x.strokeStyle = '#3D2700';
  x.strokeText('777', 0, H * 0.01);
  x.shadowBlur = 0;
  x.lineWidth = H * 0.055;
  x.strokeStyle = linear(x, 0, -fs2 * 0.45, 0, fs2 * 0.45, GOLD_STOPS);
  x.strokeText('777', 0, 0);
  x.fillStyle = linear(x, 0, -fs2 * 0.45, 0, fs2 * 0.45, [[0, '#FFC2C8'], [0.3, '#F01F38'], [0.52, '#7A0A1C'], [0.56, '#FF8A96'], [1, '#A80A22']]);
  x.fillText('777', 0, 0);
  x.restore();
  for (const [sx, sy, r] of [[0.2, 0.74, 0.05], [0.82, 0.88, 0.04], [0.74, 0.7, 0.03]]) {
    x.save();
    x.translate(W * sx, H * sy);
    x.fillStyle = '#fff';
    x.shadowColor = '#FFF3D1';
    x.shadowBlur = H * 0.03;
    x.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = (Math.PI * i) / 4;
      const rad = i % 2 ? r * H * 0.25 : r * H;
      x.lineTo(Math.cos(a) * rad, Math.sin(a) * rad);
    }
    x.fill();
    x.restore();
  }
  return { base, glow };
}
