/**
 * gra/scena-zastepcza.js — tymczasowa scena PixiJS: podgląd układu bębnów automatu.
 *
 * Po co na tym etapie:
 *   * sprawdza, że wendorowany PixiJS 8 (static/vendor/pixi/pixi.min.mjs) ładuje się i rysuje przez WebGL,
 *   * pokazuje responsywny układ: siatka reels × rows dopasowuje się do sceny przy każdej zmianie rozmiaru okna.
 * W kolejnym etapie ten moduł zastąpi prawdziwy runtime gry (bębny, symbole, efekty). Interfejs zostaje ten sam:
 *   createScene(kontener, konfiguracjaAutomatu, onProgress) → { app, destroy() }.
 */

/** Kolory podkładu bębnów (01 §6.6) i akcentów poszczególnych gier. */
const PALETTE = {
  'cebulowy-777': { under: 0x0b0624, frame: 0xff2e88, glow: 0x21e6ff },
  'zloty-faraon': { under: 0x0e1530, frame: 0xf5c542, glow: 0x4f7bff },
  'krysztalowa-kaskada': { under: 0x070a1f, frame: 0x8f3dff, glow: 0x21e6ff },
};

/**
 * @param {HTMLElement} container element sceny
 * @param {{code: string, reels: number, rows: number}} slot konfiguracja z GET /api/slots/{code}
 * @param {(progress: number) => void} [onProgress] postęp 0…1 (do paska ładowania)
 */
export async function createScene(container, slot, onProgress) {
  const PIXI = await import('../../vendor/pixi/pixi.min.mjs');
  onProgress?.(0.4);

  const app = new PIXI.Application();
  await app.init({
    resizeTo: container,
    backgroundAlpha: 0,
    antialias: true,
    autoDensity: true,
    resolution: Math.min(window.devicePixelRatio || 1, 2),   // poziom jakości High: DPR ≤ 2 (brief §5)
    preference: 'webgl',
  });
  container.prepend(app.canvas);
  app.canvas.setAttribute('aria-hidden', 'true');
  onProgress?.(0.8);

  const colors = PALETTE[slot.code] ?? PALETTE['zloty-faraon'];
  const reels = Math.max(1, slot.reels | 0);
  const rows = Math.max(1, slot.rows | 0);

  const glow = new PIXI.Graphics();
  const board = new PIXI.Graphics();
  const cells = new PIXI.Container();
  app.stage.addChild(glow, board, cells);

  const cellGraphics = Array.from({ length: reels * rows }, () => {
    const g = new PIXI.Graphics();
    cells.addChild(g);
    return g;
  });

  let lastW = 0;
  let lastH = 0;
  let cellSize = 0;

  /** Przelicza układ: siatka mieści się w ~88% szerokości i ~82% wysokości sceny, komórki są kwadratowe. */
  function layout() {
    const w = app.screen.width;
    const h = app.screen.height;
    lastW = w;
    lastH = h;
    const gap = Math.max(4, Math.min(w, h) * 0.012);
    cellSize = Math.floor(Math.min((w * 0.88 - gap * (reels - 1)) / reels, (h * 0.8 - gap * (rows - 1)) / rows));
    const gridW = reels * cellSize + (reels - 1) * gap;
    const gridH = rows * cellSize + (rows - 1) * gap;
    const x0 = (w - gridW) / 2;
    const y0 = (h - gridH) / 2;
    const pad = Math.max(10, cellSize * 0.12);

    glow.clear()
      .roundRect(x0 - pad * 2, y0 - pad * 2, gridW + pad * 4, gridH + pad * 4, pad * 2)
      .fill({ color: colors.glow, alpha: 0.06 });
    board.clear()
      .roundRect(x0 - pad, y0 - pad, gridW + pad * 2, gridH + pad * 2, pad)
      .fill({ color: colors.under, alpha: 0.88 })
      .stroke({ width: 3, color: colors.frame, alpha: 0.9 })
      .roundRect(x0 - pad - 6, y0 - pad - 6, gridW + pad * 2 + 12, gridH + pad * 2 + 12, pad + 4)
      .stroke({ width: 2, color: 0xf5c542, alpha: 0.55 });

    cellGraphics.forEach((g, i) => {
      const col = i % reels;
      const row = Math.floor(i / reels);
      g.clear()
        .roundRect(0, 0, cellSize, cellSize, cellSize * 0.14)
        .fill({ color: 0xffffff, alpha: 0.05 })
        .stroke({ width: 1, color: 0xffffff, alpha: 0.12 });
      g.position.set(x0 + col * (cellSize + gap), y0 + row * (cellSize + gap));
    });
  }

  layout();
  let t = 0;
  // Lekka „fala” jasności po komórkach — żeby było widać, że scena żyje i renderuje się płynnie.
  app.ticker.add((ticker) => {
    if (app.screen.width !== lastW || app.screen.height !== lastH) layout();
    t += ticker.deltaMS / 1000;
    cellGraphics.forEach((g, i) => {
      const col = i % reels;
      g.alpha = 0.65 + 0.35 * Math.max(0, Math.sin(t * 2 - col * 0.6));
    });
  });
  onProgress?.(1);

  return {
    app,
    destroy() {
      app.destroy(true, { children: true });
    },
  };
}
