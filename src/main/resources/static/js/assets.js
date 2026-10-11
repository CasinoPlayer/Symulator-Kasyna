/**
 * assets.js — obrazy przez identyfikatory z manifestu (kontrakt 09 § 3).
 *
 * Po co: front NIGDY nie wpisuje ścieżek obrazów na sztywno. Pyta o ID (np. 'g_emblemat', 's1_okladka'),
 * a ten moduł zamienia je na adresy @1x/@2x z pliku static/assets/img/manifest.json, który generuje
 * pipeline grafiki (tools/art/przetworz.py). Podmiana grafiki zastępczej na tę z ChatGPT nie wymaga zmian w kodzie.
 *
 * Gdy manifestu nie ma albo brakuje ID — strona używa eleganckiej grafiki zastępczej (SVG/CSS), bez wyjątków w JS.
 *
 * Użycie w HTML (ulepszanie stopniowe):
 *   <img src="icons/emblemat.svg" data-asset="g_emblemat" alt="">   → po assets.applyTo() dostaje src/srcset z manifestu
 *   <img data-asset="g_logo" data-asset-show hidden alt="…">          → pokazywany TYLKO, gdy obraz jest w manifeście
 */

const MANIFEST_URL = new URL('assets/img/manifest.json', document.baseURI);

let manifest = null;
let loading = null;

/** Adres pliku względem katalogu manifestu + wersja (żeby po podmianie grafiki przeglądarka nie trzymała starej). */
function resolve(path) {
  if (!path) return null;
  const url = new URL(path, MANIFEST_URL);
  if (manifest?.version) url.searchParams.set('v', manifest.version);
  return url.href;
}

export const assets = {
  /** Wczytuje manifest (raz). Nigdy nie odrzuca obietnicy: brak manifestu = pusty zestaw obrazów. */
  load() {
    loading ??= fetch(MANIFEST_URL, { cache: 'no-cache' })
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null)
      .then((data) => {
        manifest = data && typeof data === 'object' ? data : { images: {}, sheets: {} };
        manifest.images ??= {};
        manifest.sheets ??= {};
        return manifest;
      });
    return loading;
  },

  /** Czy obraz o tym ID jest dostępny. */
  has(id) {
    return Boolean(id && manifest?.images?.[id]?.src);
  },

  /**
   * Dane obrazu: { src, src2x, w, h, blend } z pełnymi adresami albo null.
   * @param {string} id identyfikator z briefu §7, np. 's1_okladka'
   */
  get(id) {
    const entry = id ? manifest?.images?.[id] : null;
    if (!entry?.src) return null;
    return { src: resolve(entry.src), src2x: resolve(entry.src2x), w: entry.w ?? null, h: entry.h ?? null, blend: entry.blend ?? 'normal' };
  },

  /** Wartość atrybutu srcset: "a.webp 1x, a@2x.webp 2x" (ekrany Retina dostają ostrzejszą wersję). */
  srcset(id) {
    const img = this.get(id);
    if (!img) return '';
    return img.src2x ? `${img.src} 1x, ${img.src2x} 2x` : img.src;
  },

  /** Wartość CSS dla tła: image-set(url(…) 1x, url(…) 2x). */
  cssImage(id) {
    const img = this.get(id);
    if (!img) return null;
    return img.src2x ? `image-set(url("${img.src}") 1x, url("${img.src2x}") 2x)` : `url("${img.src}")`;
  },

  /**
   * ID obrazu pojedynczej komórki arkusza (SHEET), np. sheetCell('g_awatary', 3) → 'g_awatary__kot' (09 § 3).
   * @returns {string|null}
   */
  sheetCell(sheetId, index) {
    const cells = manifest?.sheets?.[sheetId]?.cells;
    if (!Array.isArray(cells) || !cells.length) return null;
    const cell = cells[((index % cells.length) + cells.length) % cells.length];
    const id = `${sheetId}__${cell}`;
    return this.has(id) ? id : null;
  },

  /** Marginesy 9-slice (ułamki) albo null. */
  nineSlice(id) {
    return manifest?.nineSlice?.[id] ?? null;
  },

  /** Surowy wpis manifestu (z polami `variants`, `widths`, `w`, `h`) — używa go runtime gier (js/game/core/resources.js). */
  entry(id) {
    return (id && manifest?.images?.[id]) || null;
  },

  /** Dowolna sekcja manifestu (`frames`, `fonts`, `sheets`…) albo pusty obiekt. */
  section(name) {
    return manifest?.[name] ?? {};
  },

  /** Pełny adres pliku podanego ścieżką względną z manifestu (z wersją, jak `get`). */
  url(path) {
    return resolve(path);
  },

  /**
   * Tworzy <img> dla ID albo zwraca null (wtedy wywołujący pokazuje grafikę zastępczą).
   * @param {string} id
   * @param {{alt?: string, className?: string, loading?: 'lazy'|'eager', sizes?: string}} options
   */
  createImg(id, { alt = '', className = '', loading: lazy = 'lazy', sizes } = {}) {
    const data = this.get(id);
    if (!data) return null;
    const img = new Image();
    img.decoding = 'async';
    img.loading = lazy;
    img.alt = alt;
    if (className) img.className = className;
    if (data.w && data.h) {
      img.width = data.w;
      img.height = data.h;
    }
    if (data.src2x) img.srcset = this.srcset(id);
    if (sizes) img.sizes = sizes;
    img.src = data.src;
    return img;
  },

  /**
   * Ulepsza elementy z atrybutem data-asset: podmienia src/srcset na obraz z manifestu.
   * Elementy z data-asset-show (domyślnie ukryte) pokazuje tylko wtedy, gdy obraz istnieje.
   */
  applyTo(root = document) {
    for (const el of root.querySelectorAll('img[data-asset]')) {
      const id = el.dataset.asset;
      const data = this.get(id);
      if (!data || el.dataset.assetApplied === id) continue;
      const fallbackSrc = el.getAttribute('src');
      el.dataset.assetApplied = id;
      el.addEventListener('error', () => {
        // plik z manifestu nie dał się wczytać → wracamy do grafiki zastępczej
        el.removeAttribute('srcset');
        if (fallbackSrc) el.src = fallbackSrc;
        else el.hidden = true;
      }, { once: true });
      if (data.src2x) el.srcset = this.srcset(id);
      else el.removeAttribute('srcset');
      el.src = data.src;
      if (el.hasAttribute('data-asset-show')) el.hidden = false;
      el.dispatchEvent(new CustomEvent('asset-applied', { bubbles: true, detail: { id } }));
    }
  },
};
