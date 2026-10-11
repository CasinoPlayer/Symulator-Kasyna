/**
 * game/core/canvas-art.js — grafika efektów rysowana w kodzie (Canvas 2D), gdy w manifeście brak obrazu.
 *
 * Dlaczego Canvas 2D, a nie Pixi Graphics: Canvas ma prawdziwą poświatę (`shadowBlur`), gradienty radialne,
 * tryby mieszania i fonty — rysujemy RAZ na ekranie ładowania, a potem to zwykłe tekstury (zero kosztu w klatce).
 * Tekstury efektów są białe i barwione `tint` (04 § 2.3: jeden zestaw iskier obsługuje złote BIG WIN i cyjanowe S1).
 *
 * Atlasy: ParticleContainer z Pixi 8 wymaga JEDNEGO źródła tekstury na kontener (04 § 2.3). Dlatego składamy
 * iskry/dym w atlas „fx” (mieszanie add), a monety/konfetti w atlas „normal” — także wtedy, gdy obrazy są
 * w manifeście (rysujemy je wtedy do atlasu zamiast kształtów z kodu).
 */

export const GOLD_STOPS = [[0, '#FFF6D6'], [0.22, '#FFE08A'], [0.55, '#F5C542'], [0.82, '#C99A1E'], [1, '#8A5E05']];

export function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
}

/** Tekstura Pixi z płótna (z wygładzaniem liniowym i mipmapami dla dużych pomniejszeń). */
export function canvasTexture(PIXI, canvas, { mipmap = false } = {}) {
  const source = new PIXI.CanvasSource({ resource: canvas, autoGenerateMipmaps: mipmap, scaleMode: 'linear' });
  return new PIXI.Texture({ source });
}

/**
 * „Pierścień” z czterech pasków tekstury z pominięciem środka (dziury) — dla ramki i rurek neonu, które mają
 * przezroczyste okno. Po co: GPU miesza KAŻDY piksel sprite'a, także przezroczysty; duży prostokąt z pustym
 * środkiem to darmowe przerysowanie ~60% powierzchni (telefony są ograniczone wypełnianiem pikseli, 04 § 8.1).
 * @param {{x: number, y: number, w: number, h: number}} hole dziura w pikselach tekstury
 */
export function ringContainer(PIXI, texture, hole) {
  const root = new PIXI.Container();
  const W = texture.width;
  const H = texture.height;
  const x0 = Math.max(0, Math.round(hole.x));
  const y0 = Math.max(0, Math.round(hole.y));
  const x1 = Math.min(W, Math.round(hole.x + hole.w));
  const y1 = Math.min(H, Math.round(hole.y + hole.h));
  const parts = [[0, 0, W, y0], [0, y1, W, H - y1], [0, y0, x0, y1 - y0], [x1, y0, W - x1, y1 - y0]];
  const ox = texture.frame?.x ?? 0;
  const oy = texture.frame?.y ?? 0;
  for (const [x, y, w, h] of parts) {
    if (w <= 0 || h <= 0) continue;
    const t = new PIXI.Texture({ source: texture.source, frame: new PIXI.Rectangle(ox + x, oy + y, w, h) });
    const s = new PIXI.Sprite(t);
    s.position.set(x, y);
    root.addChild(s);
  }
  root.textureWidth = W;
  root.textureHeight = H;
  return root;
}

/** Gradient liniowy z listy [offset, kolor]. */
export function linear(ctx, x0, y0, x1, y1, stops) {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  for (const [o, c] of stops) g.addColorStop(o, c);
  return g;
}

export function radial(ctx, x, y, r0, r1, stops) {
  const g = ctx.createRadialGradient(x, y, r0, x, y, r1);
  for (const [o, c] of stops) g.addColorStop(o, c);
  return g;
}

/** Miękki biały punkt (poświata, bokeh, „żarówka”, błysk radialny). */
function drawDot(ctx, x, y, w, h, hard = 0) {
  const r = Math.min(w, h) / 2;
  ctx.fillStyle = radial(ctx, x + w / 2, y + h / 2, 0, r, [[0, 'rgba(255,255,255,1)'], [hard, 'rgba(255,255,255,0.85)'], [0.45, 'rgba(255,255,255,0.32)'], [1, 'rgba(255,255,255,0)']]);
  ctx.fillRect(x, y, w, h);
}

/** Gwiazdka n-ramienna z poświatą (iskry „atomic age”, 01 § 9.3). */
function drawStar(ctx, x, y, w, h, points = 4, inner = 0.12) {
  const cx = x + w / 2;
  const cy = y + h / 2;
  const R = Math.min(w, h) / 2;
  drawDot(ctx, x + w * 0.2, y + h * 0.2, w * 0.6, h * 0.6);
  ctx.save();
  ctx.shadowColor = 'rgba(255,255,255,0.9)';
  ctx.shadowBlur = R * 0.25;
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const a = (Math.PI * i) / points - Math.PI / 2;
    const rr = i % 2 === 0 ? R * 0.96 : R * inner;
    ctx.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawStreak(ctx, x, y, w, h) {
  const cy = y + h / 2;
  ctx.fillStyle = linear(ctx, x, 0, x + w, 0, [[0, 'rgba(255,255,255,0)'], [0.7, 'rgba(255,255,255,0.75)'], [0.92, 'rgba(255,255,255,1)'], [1, 'rgba(255,255,255,0)']]);
  ctx.beginPath();
  ctx.ellipse(x + w / 2, cy, w / 2, h * 0.16, 0, 0, Math.PI * 2);
  ctx.fill();
  drawDot(ctx, x + w * 0.72, y + h * 0.3, w * 0.24, h * 0.4, 0.2);
}

function drawRing(ctx, x, y, w, h) {
  const cx = x + w / 2;
  const cy = y + h / 2;
  const R = Math.min(w, h) / 2;
  ctx.fillStyle = radial(ctx, cx, cy, R * 0.5, R, [[0, 'rgba(255,255,255,0)'], [0.55, 'rgba(255,255,255,0.95)'], [0.7, 'rgba(255,255,255,0.4)'], [1, 'rgba(255,255,255,0)']]);
  ctx.fillRect(x, y, w, h);
}

/** Miękki kłąb dymu: kilka nakładających się kół z szumem (jasność ≤ 70% — 04 § 2.11). */
function drawSmoke(ctx, x, y, w, h) {
  const cx = x + w / 2;
  const cy = y + h / 2;
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 14; i++) {
    const a = rnd() * Math.PI * 2;
    const d = rnd() * w * 0.2;
    const r = w * (0.18 + rnd() * 0.16);
    ctx.fillStyle = radial(ctx, cx + Math.cos(a) * d, cy + Math.sin(a) * d, 0, r, [[0, 'rgba(178,178,178,0.38)'], [1, 'rgba(178,178,178,0)']]);
    ctx.fillRect(x, y, w, h);
  }
}

/** Moneta cebulion z trzech ujęć (przód / skos / bok) — 04 § 2.3 „obrót z trzech ujęć”. */
function drawCoin(ctx, x, y, w, h, squash) {
  const cx = x + w / 2;
  const cy = y + h / 2;
  const R = Math.min(w, h) * 0.44;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(squash, 1);
  // krawędź (grubość) widoczna przy pochyleniu
  if (squash < 0.95) {
    ctx.fillStyle = '#8A5E05';
    ctx.beginPath();
    ctx.ellipse(R * 0.12 / squash, 0, R, R, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = radial(ctx, -R * 0.3, -R * 0.35, R * 0.1, R * 1.2, [[0, '#FFF6D6'], [0.35, '#FFD75A'], [0.75, '#D9A21C'], [1, '#8A5E05']]);
  ctx.beginPath();
  ctx.arc(0, 0, R, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(92,58,0,0.85)';
  ctx.lineWidth = R * 0.08;
  ctx.beginPath();
  ctx.arc(0, 0, R * 0.8, 0, Math.PI * 2);
  ctx.stroke();
  // wytłoczona cebula (uproszczona sylwetka)
  ctx.fillStyle = 'rgba(120,78,0,0.55)';
  ctx.beginPath();
  ctx.moveTo(0, -R * 0.5);
  ctx.bezierCurveTo(R * 0.12, -R * 0.3, R * 0.45, -R * 0.15, R * 0.4, R * 0.15);
  ctx.bezierCurveTo(R * 0.36, R * 0.42, -R * 0.36, R * 0.42, -R * 0.4, R * 0.15);
  ctx.bezierCurveTo(-R * 0.45, -R * 0.15, -R * 0.12, -R * 0.3, 0, -R * 0.5);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.beginPath();
  ctx.ellipse(-R * 0.35, -R * 0.4, R * 0.28, R * 0.12, -0.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** Białe kształty konfetti (barwione tintem: złoto, magenta, cyjan). */
function drawConfetti(ctx, x, y, w, h, kind) {
  ctx.save();
  ctx.translate(x + w / 2, y + h / 2);
  ctx.fillStyle = '#fff';
  const s = Math.min(w, h);
  switch (kind % 6) {
    case 0: ctx.fillRect(-s * 0.4, -s * 0.22, s * 0.8, s * 0.44); break;
    case 1: ctx.beginPath(); ctx.arc(0, 0, s * 0.3, 0, Math.PI * 2); ctx.fill(); break;
    case 2: ctx.fillRect(-s * 0.45, -s * 0.1, s * 0.9, s * 0.2); break;
    case 3: ctx.beginPath(); ctx.moveTo(0, -s * 0.4); ctx.lineTo(s * 0.38, s * 0.3); ctx.lineTo(-s * 0.38, s * 0.3); ctx.closePath(); ctx.fill(); break;
    case 4: // serpentyna
      ctx.strokeStyle = '#fff'; ctx.lineWidth = s * 0.14; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(-s * 0.4, -s * 0.2);
      ctx.bezierCurveTo(-s * 0.1, -s * 0.5, s * 0.1, s * 0.5, s * 0.4, s * 0.2); ctx.stroke(); break;
    default: // gwiazdka
      ctx.beginPath();
      for (let i = 0; i < 10; i++) {
        const a = (Math.PI * i) / 5 - Math.PI / 2;
        const r = i % 2 ? s * 0.16 : s * 0.4;
        ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      ctx.fill();
  }
  // lekki połysk (konfetti z folii)
  ctx.globalCompositeOperation = 'source-atop';
  ctx.fillStyle = linear(ctx, -s / 2, -s / 2, s / 2, s / 2, [[0, 'rgba(255,255,255,0)'], [0.5, 'rgba(255,255,255,0.0)'], [0.55, 'rgba(0,0,0,0.18)'], [1, 'rgba(0,0,0,0.25)']]);
  ctx.fillRect(-s / 2, -s / 2, s, s);
  ctx.restore();
}

/** Rysuje obraz (np. teksturę z manifestu) do komórki atlasu, zachowując proporcje. */
function drawImageFit(ctx, img, x, y, w, h) {
  const iw = img.width || img.naturalWidth || w;
  const ih = img.height || img.naturalHeight || h;
  const s = Math.min(w / iw, h / ih);
  ctx.drawImage(img, x + (w - iw * s) / 2, y + (h - ih * s) / 2, iw * s, ih * s);
}

/** Źródło obrazu tekstury Pixi (ImageBitmap / HTMLImageElement / canvas) do rysowania w atlasie. */
function textureImage(texture) {
  const r = texture?.source?.resource;
  return r && (r instanceof ImageBitmap || r instanceof HTMLImageElement || r instanceof HTMLCanvasElement) ? r : null;
}

/**
 * Prosty atlas półkowy: wpisy { name, w, h, draw(ctx, x, y, w, h) } → jedno płótno + ramki Texture.
 * @returns {{texture: Texture, frames: Record<string, Texture>}}
 */
export function buildAtlas(PIXI, entries, width = 1024) {
  const pad = 2;
  let x = pad;
  let y = pad;
  let rowH = 0;
  const placed = [];
  for (const e of entries) {
    if (x + e.w + pad > width) {
      x = pad;
      y += rowH + pad;
      rowH = 0;
    }
    placed.push({ ...e, x, y });
    x += e.w + pad;
    rowH = Math.max(rowH, e.h);
  }
  const height = 1 << Math.ceil(Math.log2(y + rowH + pad));
  const canvas = makeCanvas(width, height);
  const ctx = canvas.getContext('2d');
  for (const p of placed) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(p.x, p.y, p.w, p.h);
    ctx.clip();
    p.draw(ctx, p.x, p.y, p.w, p.h);
    ctx.restore();
  }
  const base = canvasTexture(PIXI, canvas);
  const frames = {};
  for (const p of placed) {
    frames[p.name] = new PIXI.Texture({ source: base.source, frame: new PIXI.Rectangle(p.x, p.y, p.w, p.h) });
  }
  return { texture: base, frames, canvas };
}

/**
 * Atlas efektów `add` (białe, barwione tintem). Nazwy ramek odpowiadają komórkom `g_fx_iskry__0…7` z 04 § 2.3:
 * 0,1,3,4,6 — iskry, 2 — miękki punkt (pył, bokeh, żarówki), 5 — smuga, 7 — pierścień; plus `smoke` (g_fx_dym).
 */
export function buildFxAtlas(PIXI, resources) {
  const cell = 64;
  const shapes = [
    (c, x, y, w, h) => drawStar(c, x, y, w, h, 4, 0.1),
    (c, x, y, w, h) => drawStar(c, x, y, w, h, 8, 0.25),
    (c, x, y, w, h) => drawDot(c, x, y, w, h),
    (c, x, y, w, h) => drawStar(c, x, y, w, h, 4, 0.22),
    (c, x, y, w, h) => drawDot(c, x, y, w, h, 0.25),
    (c, x, y, w, h) => drawStreak(c, x, y, w, h),
    (c, x, y, w, h) => drawStar(c, x, y, w, h, 6, 0.18),
    (c, x, y, w, h) => drawRing(c, x, y, w, h),
  ];
  const entries = shapes.map((draw, i) => {
    const tex = resources?.texture(`g_fx_iskry__${i}`);
    const img = textureImage(tex);
    return { name: `iskra${i}`, w: cell, h: cell, draw: img ? (c, x, y, w, h) => drawImageFit(c, img, x, y, w, h) : draw };
  });
  const smokeImg = textureImage(resources?.texture('g_fx_dym'));
  entries.push({ name: 'smoke', w: 128, h: 128, draw: smokeImg ? (c, x, y, w, h) => drawImageFit(c, smokeImg, x, y, w, h) : drawSmoke });
  entries.push({ name: 'dotHard', w: 32, h: 32, draw: (c, x, y, w, h) => drawDot(c, x, y, w, h, 0.45) });
  return buildAtlas(PIXI, entries, 512);
}

/** Atlas mieszania normalnego: monety (3 ujęcia) i 12 kształtów konfetti. */
export function buildNormalAtlas(PIXI, resources) {
  const coinIds = ['g_moneta_przod', 'g_moneta_skos', 'g_moneta_bok'];
  const squash = [1, 0.62, 0.18];
  const entries = coinIds.map((id, i) => {
    const img = textureImage(resources?.texture(id, 'male') ?? resources?.texture(id));
    return { name: `coin${i}`, w: 64, h: 64, draw: img ? (c, x, y, w, h) => drawImageFit(c, img, x, y, w, h) : (c, x, y, w, h) => drawCoin(c, x, y, w, h, squash[i]) };
  });
  for (let i = 0; i < 12; i++) {
    const img = textureImage(resources?.texture(`g_fx_konfetti__${i}`));
    entries.push({ name: `confetti${i}`, w: 32, h: 32, draw: img ? (c, x, y, w, h) => drawImageFit(c, img, x, y, w, h) : (c, x, y, w, h) => drawConfetti(c, x, y, w, h, i) });
  }
  return buildAtlas(PIXI, entries, 256);
}

/** Pojedyncze tekstury pomocnicze (generowane raz). */
export function buildHelperTextures(PIXI) {
  const tex = {};
  // gradient radialny 256×256: błysk radialny, podkład pod licznikiem, słońce (04 § 2.4)
  {
    const c = makeCanvas(256, 256);
    drawDot(c.getContext('2d'), 0, 0, 256, 256);
    tex.radial = canvasTexture(PIXI, c);
  }
  // twardszy radialny (żarówki, punkty światła)
  {
    const c = makeCanvas(64, 64);
    const x = c.getContext('2d');
    x.fillStyle = radial(x, 32, 32, 0, 32, [[0, '#fff'], [0.3, 'rgba(255,255,255,0.95)'], [0.55, 'rgba(255,255,255,0.35)'], [1, 'rgba(255,255,255,0)']]);
    x.fillRect(0, 0, 64, 64);
    tex.bulb = canvasTexture(PIXI, c);
  }
  // winieta: przezroczysty środek → czarne brzegi (04 § 2.18)
  {
    const c = makeCanvas(512, 512);
    const x = c.getContext('2d');
    x.fillStyle = radial(x, 256, 256, 120, 362, [[0, 'rgba(0,0,0,0)'], [0.6, 'rgba(0,0,0,0.35)'], [1, 'rgba(0,0,0,1)']]);
    x.fillRect(0, 0, 512, 512);
    tex.vignette = canvasTexture(PIXI, c);
  }
  // miękka linia wygranej: przezroczysty → biały → przezroczysty w poprzek (04 § 2.16)
  for (const [name, h, core] of [['lineCore', 32, 0.35], ['lineGlow', 64, 0.05]]) {
    const c = makeCanvas(16, h);
    const x = c.getContext('2d');
    x.fillStyle = linear(x, 0, 0, 0, h, [[0, 'rgba(255,255,255,0)'], [0.5 - core / 2, 'rgba(255,255,255,0.9)'], [0.5, '#fff'], [0.5 + core / 2, 'rgba(255,255,255,0.9)'], [1, 'rgba(255,255,255,0)']]);
    x.fillRect(0, 0, 16, h);
    tex[name] = canvasTexture(PIXI, c);
  }
  // pionowy gradient (słup światła, smugi prędkości, połysk lądowania): biały na środku, zanik na końcach
  {
    const c = makeCanvas(64, 256);
    const x = c.getContext('2d');
    x.fillStyle = linear(x, 0, 0, 64, 0, [[0, 'rgba(255,255,255,0)'], [0.5, 'rgba(255,255,255,1)'], [1, 'rgba(255,255,255,0)']]);
    x.fillRect(0, 0, 64, 256);
    x.globalCompositeOperation = 'destination-in';
    x.fillStyle = linear(x, 0, 0, 0, 256, [[0, 'rgba(0,0,0,0)'], [0.2, 'rgba(0,0,0,1)'], [0.8, 'rgba(0,0,0,1)'], [1, 'rgba(0,0,0,0)']]);
    x.fillRect(0, 0, 64, 256);
    tex.column = canvasTexture(PIXI, c);
  }
  // gradient „walca” (04 § 2.14): czarny u góry → przezroczysty
  {
    const c = makeCanvas(4, 128);
    const x = c.getContext('2d');
    x.fillStyle = linear(x, 0, 0, 0, 128, [[0, 'rgba(0,0,0,1)'], [1, 'rgba(0,0,0,0)']]);
    x.fillRect(0, 0, 4, 128);
    tex.fade = canvasTexture(PIXI, c);
  }
  // pozioma smuga (pas połysku lądowania, impuls siatki S1)
  {
    const c = makeCanvas(256, 32);
    const x = c.getContext('2d');
    x.fillStyle = linear(x, 0, 0, 0, 32, [[0, 'rgba(255,255,255,0)'], [0.5, 'rgba(255,255,255,1)'], [1, 'rgba(255,255,255,0)']]);
    x.fillRect(0, 0, 256, 32);
    x.globalCompositeOperation = 'destination-in';
    x.fillStyle = linear(x, 0, 0, 256, 0, [[0, 'rgba(0,0,0,0)'], [0.25, 'rgba(0,0,0,1)'], [0.75, 'rgba(0,0,0,1)'], [1, 'rgba(0,0,0,0)']]);
    x.fillRect(0, 0, 256, 32);
    tex.band = canvasTexture(PIXI, c);
  }
  return tex;
}

/** Promienie (god rays) — 22 miękkie snopy z centrum, zanik do czerni przed krawędzią (brief: g_fx_promienie). */
export function drawRays(PIXI, size = 1024, count = 22) {
  const c = makeCanvas(size, size);
  const x = c.getContext('2d');
  const r = size / 2;
  x.translate(r, r);
  // Promień = 3 nałożone kliny o malejącej szerokości → miękkie boczne krawędzie (twarda krawędź klina wygląda
  // jak „wycięty papier”). Jasność spada szybko z odległością: środek świeci, a brzegi ekranu NIE są zalane
  // szarością (przy dodawaniu na ciemnej kurtynie płaski gradient „wyprał” całą scenę).
  const ramp = (a0) => radial(x, 0, 0, 0, r, [[0, `rgba(255,255,255,${a0})`], [0.16, `rgba(255,255,255,${a0 * 0.6})`], [0.45, `rgba(255,255,255,${a0 * 0.16})`], [1, 'rgba(255,255,255,0)']]);
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2 + (i % 3) * 0.03;
    const spread = (i % 2 ? 0.05 : 0.085) * Math.PI;
    for (const [mul, alpha] of [[1, 0.3], [0.62, 0.35], [0.3, 0.35]]) {
      x.fillStyle = ramp(alpha);
      x.beginPath();
      x.moveTo(0, 0);
      x.arc(0, 0, r, a - (spread * mul) / 2, a + (spread * mul) / 2);
      x.closePath();
      x.fill();
    }
  }
  x.globalCompositeOperation = 'lighter';
  x.fillStyle = radial(x, 0, 0, 0, r * 0.35, [[0, 'rgba(255,255,255,0.7)'], [1, 'rgba(255,255,255,0)']]);
  x.fillRect(-r, -r, size, size);
  return canvasTexture(PIXI, c);
}

/** Flara: gwiazda z anamorficzną smugą (04 § 2.9, g_fx_flara). */
export function drawFlare(PIXI, size = 512) {
  const c = makeCanvas(size, size);
  const x = c.getContext('2d');
  const r = size / 2;
  x.globalCompositeOperation = 'lighter';
  x.fillStyle = radial(x, r, r, 0, r * 0.5, [[0, 'rgba(255,255,255,1)'], [0.2, 'rgba(255,255,255,0.6)'], [1, 'rgba(255,255,255,0)']]);
  x.fillRect(0, 0, size, size);
  for (const [w, h, a] of [[r, r * 0.035, 0], [r * 0.7, r * 0.025, Math.PI / 2], [r * 0.45, r * 0.02, Math.PI / 4], [r * 0.45, r * 0.02, -Math.PI / 4]]) {
    x.save();
    x.translate(r, r);
    x.rotate(a);
    x.fillStyle = radial(x, 0, 0, 0, w, [[0, 'rgba(255,255,255,0.95)'], [1, 'rgba(255,255,255,0)']]);
    x.beginPath();
    x.ellipse(0, 0, w, h, 0, 0, Math.PI * 2);
    x.fill();
    x.restore();
  }
  return canvasTexture(PIXI, c);
}

/** Piorun: łamana z jasnym rdzeniem i poświatą (04 § 2.10; tekstura pionowa, kotwica u góry). */
export function drawLightning(PIXI, variant = 0, w = 96, h = 512) {
  const c = makeCanvas(w, h);
  const x = c.getContext('2d');
  let seed = 31 + variant * 97;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const pts = [[w / 2, 0]];
  const n = 14;
  for (let i = 1; i < n; i++) pts.push([w / 2 + (rnd() - 0.5) * w * 0.55, (i / n) * h]);
  pts.push([w / 2, h]);
  const path = () => {
    x.beginPath();
    pts.forEach(([px, py], i) => (i ? x.lineTo(px, py) : x.moveTo(px, py)));
  };
  x.lineJoin = 'round';
  x.lineCap = 'round';
  x.strokeStyle = 'rgba(255,255,255,0.35)';
  x.shadowColor = '#fff';
  x.shadowBlur = 18;
  x.lineWidth = 9;
  path();
  x.stroke();
  x.shadowBlur = 6;
  x.strokeStyle = '#fff';
  x.lineWidth = 3;
  path();
  x.stroke();
  // odgałęzienie
  x.lineWidth = 1.6;
  x.beginPath();
  const [bx, by] = pts[5];
  x.moveTo(bx, by);
  x.lineTo(bx + w * 0.3, by + h * 0.08);
  x.lineTo(bx + w * 0.22, by + h * 0.16);
  x.stroke();
  return canvasTexture(PIXI, c);
}

/**
 * Złoty napis 3D (banery BIG/MEGA/EPIC/ULTRA WIN, gdy brak `g_win_*` — 01 § 7.8, § 3.5).
 * @param {{lines: string[], accent: string, accent2?: string, rainbow?: boolean}} o
 */
export function drawBanner(PIXI, { lines, accent = '#FFF3D1', accent2 = null, rainbow = false, font = 'Cinzel' }) {
  const W = 960;
  const H = 640;
  const c = makeCanvas(W, H);
  const x = c.getContext('2d');
  x.textAlign = 'center';
  x.textBaseline = 'alphabetic';
  const sizes = lines.length === 1 ? [210] : [190, 230];
  const ys = lines.length === 1 ? [H * 0.62] : [H * 0.44, H * 0.83];
  lines.forEach((text, i) => {
    const size = sizes[i];
    x.font = `900 ${size}px "${font}", "Cinzel", Georgia, serif`;
    // dopasowanie szerokości
    const mw = x.measureText(text).width;
    const scale = Math.min(1, (W * 0.9) / mw);
    x.save();
    x.translate(W / 2, ys[i]);
    x.scale(scale, 1);
    // poświata akcentu (kolor poziomu)
    x.shadowColor = accent;
    x.shadowBlur = 48;
    x.fillStyle = accent;
    x.globalAlpha = 0.55;
    x.fillText(text, 0, 0);
    if (accent2) {
      x.shadowColor = accent2;
      x.shadowBlur = 80;
      x.fillText(text, 0, 0);
    }
    x.globalAlpha = 1;
    x.shadowBlur = 0;
    // wyciągnięcie 3D (ciemne złoto przesunięte w dół)
    for (let d = 14; d > 0; d -= 2) {
      x.fillStyle = d > 8 ? '#2B1A00' : '#5C3A00';
      x.fillText(text, d * 0.25, d);
    }
    // lico: gradient złota albo tęcza (ULTRA)
    x.fillStyle = rainbow
      ? linear(x, -mw / 2, 0, mw / 2, 0, [[0, '#21E6FF'], [0.33, '#8F3DFF'], [0.66, '#FF2E88'], [1, '#FFE08A']])
      : linear(x, 0, -size * 0.85, 0, size * 0.1, GOLD_STOPS);
    x.fillText(text, 0, 0);
    if (rainbow) {
      x.globalCompositeOperation = 'source-atop';
      x.fillStyle = linear(x, 0, -size * 0.85, 0, size * 0.1, [[0, 'rgba(255,255,255,0.75)'], [0.5, 'rgba(255,255,255,0.1)'], [1, 'rgba(0,0,0,0.25)']]);
      x.fillText(text, 0, 0);
      x.globalCompositeOperation = 'source-over';
    }
    x.lineWidth = 5;
    x.strokeStyle = '#3D2700';
    x.strokeText(text, 0, 0);
    // połysk górnej połowy liter
    x.save();
    x.beginPath();
    x.rect(-W, -size, W * 2, size * 0.45);
    x.clip();
    x.fillStyle = 'rgba(255,255,255,0.28)';
    x.fillText(text, 0, 0);
    x.restore();
    x.lineWidth = 1.5;
    x.strokeStyle = 'rgba(255,246,214,0.9)';
    x.strokeText(text, 0, -2);
    x.restore();
  });
  return canvasTexture(PIXI, c, { mipmap: true });
}

/**
 * Złote cyfry (zastępstwo `g_font_cyfry`): atlas glifów 0–9 , + × i spacji o stałej szerokości cyfr
 * (cyfry tabelaryczne — liczba nie „pływa” w poziomie, 04 § 2.17).
 * @returns {{frames: Record<string, Texture>, advance: Record<string, number>, lineHeight: number, size: number}}
 */
export function buildGoldDigits(PIXI, size = 96) {
  const chars = '0123456789,+×';
  const font = `800 ${size}px "Manrope", "Segoe UI", system-ui, sans-serif`;
  const probe = makeCanvas(8, 8).getContext('2d');
  probe.font = font;
  const digitW = Math.ceil(Math.max(...'0123456789'.split('').map((d) => probe.measureText(d).width)));
  const cellW = digitW + 28;
  const cellH = Math.ceil(size * 1.35);
  const entries = chars.split('').map((ch) => ({
    name: ch,
    w: ch === ',' ? Math.ceil(size * 0.42) + 20 : ch === '+' || ch === '×' ? Math.ceil(size * 0.7) + 24 : cellW,
    h: cellH,
    draw(ctx, x, y, w, h) {
      ctx.font = font;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';
      const bx = x + w / 2;
      const by = y + size * 1.08;
      ctx.shadowColor = 'rgba(245,197,66,0.75)';
      ctx.shadowBlur = size * 0.16;
      ctx.fillStyle = '#5C3A00';
      ctx.fillText(ch, bx + 1, by + size * 0.05);
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#2B1A00';
      ctx.fillText(ch, bx + 1, by + size * 0.04);
      ctx.fillStyle = linear(ctx, 0, by - size * 0.78, 0, by + size * 0.02, GOLD_STOPS);
      ctx.fillText(ch, bx, by);
      ctx.lineWidth = Math.max(2, size * 0.035);
      ctx.strokeStyle = '#4A2F00';
      ctx.strokeText(ch, bx, by);
      ctx.save();
      ctx.beginPath();
      ctx.rect(x, y, w, by - size * 0.42 - y);
      ctx.clip();
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.fillText(ch, bx, by);
      ctx.restore();
    },
  }));
  const atlas = buildAtlas(PIXI, entries, 1024);
  const advance = {};
  for (const e of entries) advance[e.name] = e.w - 16;
  advance[' '] = Math.round(digitW * 0.35);
  advance[' '] = advance[' '];   // spacja niełamliwa — separator tysięcy z format.js
  return { frames: atlas.frames, advance, lineHeight: cellH, size };
}

/** Neonowy napis (Bungee): biały rdzeń, kontur magenta, poświata magenta + cyjan (01 § 9.4 — „×2”, „NEON JACKPOT”). */
export function drawNeonText(PIXI, text, { size = 120, glow = true, core = '#FFFFFF', outline = '#FF2E88', halo = '#21E6FF' } = {}) {
  const probe = makeCanvas(8, 8).getContext('2d');
  const font = `400 ${size}px "Bungee", "Manrope", system-ui, sans-serif`;
  probe.font = font;
  const tw = probe.measureText(text).width;
  const pad = size * 0.7;
  const c = makeCanvas(tw + pad * 2, size * 1.25 + pad * 2);
  const x = c.getContext('2d');
  x.font = font;
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  const cx = c.width / 2;
  const cy = c.height / 2 + size * 0.05;
  if (glow) {
    x.shadowColor = halo;
    x.shadowBlur = size * 0.4;
    x.fillStyle = halo;
    x.globalAlpha = 0.6;
    x.fillText(text, cx, cy);
    x.shadowColor = outline;
    x.shadowBlur = size * 0.2;
    x.fillStyle = outline;
    x.globalAlpha = 0.9;
    x.fillText(text, cx, cy);
    x.globalAlpha = 1;
  }
  x.shadowBlur = 0;
  x.lineJoin = 'round';
  x.lineWidth = Math.max(3, size * 0.07);
  x.strokeStyle = outline;
  x.strokeText(text, cx, cy);
  x.fillStyle = core;
  x.fillText(text, cx, cy);
  return canvasTexture(PIXI, c, { mipmap: true });
}
