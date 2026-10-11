/**
 * game/core/resources.js — tekstury gry po ID z manifestu (kontrakt 09 § 3) z paskiem postępu (04 E20).
 *
 * Zasady:
 *   * kod gry prosi o obraz przez ID (`s1_sym_wild`) i opcjonalnie wariant (`glow`, `ruch1`, `ruch2`, `syl`, `cien`,
 *     `male`) — nigdy przez ścieżkę; podmiana grafiki zastępczej na tę z ChatGPT nie wymaga zmian w kodzie,
 *   * brak manifestu, brak ID albo błąd pobrania pliku = `null`, bez wyjątku — gra rysuje wtedy grafikę z kodu
 *     (js/game/core/canvas-art.js, js/game/games/s1-art.js), a nie szare kwadraty,
 *   * @1x / @2x wybieramy według gęstości ekranu i poziomu jakości (Low = zawsze @1x, 04 § 2.2); tła — według
 *     szerokości z pola `widths` (najmniejszy wariant nie mniejszy niż ekran).
 */

import { assets } from '../../assets.js';

export class Resources {
  #textures = new Map();     // klucz `${id}|${wariant}` → Texture
  #gameApp;

  constructor(gameApp) {
    this.#gameApp = gameApp;
  }

  get PIXI() {
    return this.#gameApp.PIXI;
  }

  /** Wczytuje manifest obrazów (nigdy nie odrzuca — brak = pusty manifest). */
  async loadManifest() {
    await assets.load();
  }

  /** Okno ramki bębnów z manifestu (`frames.<ID>.window`, ułamki) albo null. */
  frameWindow(id) {
    return assets.section('frames')?.[id]?.window ?? null;
  }

  /** Metryki fontu bitmapowego (np. `CebulionCyfry` z obróbki `g_font_cyfry`) albo null. */
  font(name) {
    return assets.section('fonts')?.[name] ?? null;
  }

  /** Wpis manifestu (do proporcji wariantów: glow jest większy od symbolu o margines poświaty). */
  entry(id) {
    return assets.entry(id);
  }

  has(id, variant = null) {
    return this.#textures.has(`${id}|${variant ?? ''}`);
  }

  /** Tekstura albo null. */
  texture(id, variant = null) {
    return this.#textures.get(`${id}|${variant ?? ''}`) ?? null;
  }

  /** Rejestruje teksturę wygenerowaną w kodzie (np. zastępczy symbol), żeby reszta kodu pytała jednym API. */
  register(id, variant, texture) {
    this.#textures.set(`${id}|${variant ?? ''}`, texture);
  }

  /**
   * Adres pliku dla ID (i wariantu) albo null.
   * @param {{targetWidth?: number}} o targetWidth — potrzebna szerokość w pikselach urządzenia (tła)
   */
  urlFor(id, variant = null, { targetWidth } = {}) {
    const e = assets.entry(id);
    if (!e) return null;
    const hiDpi = (window.devicePixelRatio || 1) > 1.2 && this.#gameApp.quality.level !== 'low';
    if (variant) {
      const v = e.variants?.[variant];
      if (!v?.src) return null;
      return assets.url(hiDpi && v.src2x ? v.src2x : v.src);
    }
    if (targetWidth && e.widths) {
      const options = Object.entries(e.widths).map(([w, src]) => [Number(w), src]).sort((a, b) => a[0] - b[0]);
      const pick = options.find(([w]) => w >= targetWidth) ?? options.at(-1);
      if (pick) return assets.url(pick[1]);
    }
    return assets.url(hiDpi && e.src2x ? e.src2x : e.src);
  }

  /**
   * Ładuje listę obrazów z postępem.
   * @param {Array<{id: string, variant?: string, targetWidth?: number}>} requests
   * @param {(p: number) => void} onProgress 0…1
   */
  async load(requests, onProgress) {
    const { Assets } = this.PIXI;
    const jobs = requests
      .map((r) => ({ ...r, url: this.urlFor(r.id, r.variant, r) }))
      .filter((r) => r.url && !this.has(r.id, r.variant));
    if (!jobs.length) {
      onProgress?.(1);
      return;
    }
    let done = 0;
    // pojedynczo (nie jedną paczką): błąd jednego pliku nie może zablokować reszty — brak pliku = grafika z kodu
    await Promise.all(jobs.map(async (job) => {
      try {
        let texture = await Assets.load({ alias: `${job.id}|${job.variant ?? ''}`, src: job.url });
        if (texture?.source) {
          texture = this.#logicalSize(texture, job);
          this.#textures.set(`${job.id}|${job.variant ?? ''}`, texture);
        }
      } catch {
        console.warn(`[zasoby] nie udało się wczytać ${job.id}${job.variant ? '.' + job.variant : ''} — używam grafiki z kodu`);
      } finally {
        done += 1;
        onProgress?.(done / jobs.length);
      }
    }));
  }

  /**
   * Rozmiar logiczny z manifestu (`w`/`h` wpisu albo wariantu): poświaty i cienie bywają zapisane w skali 0,5
   * (`"scale": 0.5` — plik 166 px dla poświaty 332 px), a @2x ma dwa razy więcej pikseli. Ustawiamy rozdzielczość
   * źródła tak, by `texture.width` zawsze znaczyło rozmiar logiczny — kod skaluje sprite'y według niego.
   */
  #logicalSize(texture, job) {
    if (job.targetWidth) return texture;            // tła z `widths`: skalujemy „cover” i tak, rozmiar bez znaczenia
    const e = assets.entry(job.id);
    const meta = job.variant ? e?.variants?.[job.variant] : e;
    const src = texture.source;
    if (!meta?.w || !src?.pixelWidth || Math.abs(src.width - meta.w) <= 1) return texture;
    src.resolution = src.pixelWidth / meta.w;
    return new this.PIXI.Texture({ source: src });
  }

  /** Lista ID komórek arkusza (np. 'g_fx_iskry' → ['g_fx_iskry__0', …]) obecnych w manifeście. */
  sheetCells(sheetId) {
    const cells = assets.section('sheets')?.[sheetId]?.cells;
    if (!Array.isArray(cells)) return [];
    return cells.map((c) => `${sheetId}__${c}`).filter((id) => assets.entry(id));
  }
}

/** Czeka na fonty używane w grafice rysowanej w kodzie (Canvas 2D potrzebuje wczytanego fontu). */
export async function ensureFonts(specs) {
  if (!document.fonts?.load) return;
  await Promise.all(specs.map((s) => document.fonts.load(s).catch(() => null)));
}
