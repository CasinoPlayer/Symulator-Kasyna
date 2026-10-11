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

  /**
   * Przelicza układ. Komórki są kwadratowe, a CAŁA plansza — z ramką (pad), złotym obrysem (6 px) i poświatą
   * (2 × pad) — mieści się w 94% szerokości i 92% wysokości sceny. Wcześniej liczyliśmy tylko same komórki,
   * więc na tablecie pionowo ramka i poświata wychodziły poza płótno.
   * U góry zostawiamy pas na napis „Podgląd układu bębnów” (gdy jest widoczny), żeby nie nachodził na ramkę.
   */
  function layout() {
    const w = app.screen.width;
    const h = app.screen.height;
    lastW = w;
    lastH = h;
    const note = container.querySelector('.stage__note:not([hidden])');
    const top = note ? note.offsetTop + note.offsetHeight + 6 : 0;
    const availW = w * 0.94;
    const availH = (h - top) * 0.92;
    const gap = Math.max(4, Math.min(w, h) * 0.012);
    // pad = 0,12 × komórka (min. 10 px); poświata = 2 × pad z każdej strony → razem 4 × pad + 12 px obrysu
    const fit = (avail, count) => {
      const byRatio = (avail - gap * (count - 1) - 12) / (count + 0.48);
      return byRatio * 0.12 >= 10 ? byRatio : (avail - gap * (count - 1) - 12 - 40) / count;
    };
    cellSize = Math.max(8, Math.floor(Math.min(fit(availW, reels), fit(availH, rows))));
    const gridW = reels * cellSize + (reels - 1) * gap;
    const gridH = rows * cellSize + (rows - 1) * gap;
    const x0 = (w - gridW) / 2;
    const y0 = top + (h - top - gridH) / 2;
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

  /** Przelicza układ i — gdy pętla animacji już stoi — rysuje jedną klatkę (render na żądanie). */
  function relayout() {
    layout();
    if (!app.ticker.started) app.render();
  }

  // Rest = jasność komórek w spoczynku. Po wczytaniu przez planszę przechodzi JEDNA fala światła (od lewej
  // do prawej), a potem pętla animacji staje: podgląd jest statyczny, więc rysowanie 60 razy na sekundę
  // tylko grzałoby telefon (na urządzeniach bez akceleracji WebGL każda klatka to dziesiątki ms pracy CPU).
  // Później klatkę rysujemy tylko przy zmianie rozmiaru sceny. Prawdziwy runtime gry ma własną pętlę.
  const REST = 0.65;
  const SPEED = 2;          // rad/s — szybkość fali
  const STEP = 0.6;         // przesunięcie fazy między bębnami
  const waveEnd = (Math.PI + (reels - 1) * STEP) / SPEED;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let t = 0;
  const wave = (ticker) => {
    if (app.screen.width !== lastW || app.screen.height !== lastH) layout();
    t += ticker.deltaMS / 1000;
    for (let i = 0; i < cellGraphics.length; i++) {
      const phase = t * SPEED - (i % reels) * STEP;
      cellGraphics[i].alpha = REST + 0.35 * (phase > 0 && phase < Math.PI ? Math.sin(phase) : 0);
    }
    if (t >= waveEnd) {
      app.ticker.remove(wave);
      app.ticker.stop();
      app.render();
    }
  };

  layout();
  cellGraphics.forEach((g) => { g.alpha = REST; });
  if (reduced) {
    app.ticker.stop();
    app.render();
  } else {
    app.ticker.add(wave);
  }
  // zmiana rozmiaru okna (Pixi sam dopasowuje płótno — resizeTo) → nowy układ i klatka
  app.renderer.on('resize', relayout);
  // napis nad planszą pokazuje się po zniknięciu ekranu ładowania → przeliczamy układ, gdy zmieni się `hidden`
  const noteWatcher = new MutationObserver(relayout);
  noteWatcher.observe(container, { attributes: true, subtree: true, attributeFilter: ['hidden'] });
  onProgress?.(1);

  return {
    app,
    destroy() {
      noteWatcher.disconnect();
      app.renderer.off('resize', relayout);
      app.destroy(true, { children: true });
    },
  };
}
