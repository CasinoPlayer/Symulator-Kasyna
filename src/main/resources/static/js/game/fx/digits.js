/**
 * game/fx/digits.js — złote cyfry licznika wygranej (04 § 2.17, brief: `g_font_cyfry`).
 *
 * Źródła glifów (w tej kolejności):
 *   1. manifest → `fonts.CebulionCyfry` (pipeline grafiki tnie arkusz `g_font_cyfry` na pliki `g_font_cyfry__<znak>`
 *      i podaje metryki: xadvance, xoffset, yoffset),
 *   2. atlas złotych cyfr narysowany w kodzie (canvas-art.js → buildGoldDigits).
 * Dlaczego sprite'y glifów, a nie Text: zmiana Text przerysowuje płótno i wgrywa teksturę na GPU (co klatkę przy
 * liczeniu — zacięcia); tutaj zmiana liczby to tylko podmiana tekstur i pozycji kilkunastu sprite'ów.
 * Cyfry są tabelaryczne (stała szerokość), więc liczba nie „pływa” w poziomie podczas liczenia.
 */

export class DigitFont {
  /**
   * @param {object} PIXI
   * @param {{frames: Record<string, Texture>, advance: Record<string, number>, lineHeight: number, size: number, offsets?: Record<string, {x:number,y:number}>}} glyphs
   */
  constructor(PIXI, glyphs) {
    this.PIXI = PIXI;
    Object.assign(this, glyphs);
    this.offsets ??= {};
  }

  /** Font z manifestu (fonts.CebulionCyfry) — null, gdy brak któregokolwiek glifu cyfry. */
  static fromManifest(PIXI, resources) {
    const meta = resources.font('CebulionCyfry');
    if (!meta?.chars) return null;
    const frames = {};
    const advance = {};
    const offsets = {};
    for (const [ch, c] of Object.entries(meta.chars)) {
      const tex = resources.texture(c.image);
      if (!tex) continue;
      frames[ch] = tex;
      advance[ch] = c.xadvance;
      offsets[ch] = { x: 0, y: 0 };
    }
    if (!'0123456789'.split('').every((d) => frames[d])) return null;
    advance[' '] = meta.space ?? Math.round(meta.size * 0.25);
    advance[' '] = advance[' '];
    return new DigitFont(PIXI, { frames, advance, offsets, lineHeight: meta.lineHeight, size: meta.size });
  }
}

/** Napis z glifów: `text` ustawia treść, `height` — wysokość cyfr w pikselach sceny. Kotwica w środku. */
export class DigitText {
  #text = '';
  #sprites = [];

  /**
   * @param {{height?: number, tint?: number, shade?: Texture|null}} o shade — miękka ciemna plama (tekstura radialna)
   *   pod cyframi: kwota na planszy leży na kolorowych symbolach i bez podkładu traci kontrast (04 § 2.17, R1)
   */
  constructor(font, { height = 72, tint = 0xffffff, shade = null } = {}) {
    this.font = font;
    this.root = new font.PIXI.Container({ label: 'cyfry' });
    this.inner = new font.PIXI.Container();
    if (shade) {
      this.shade = new font.PIXI.Sprite(shade);
      this.shade.anchor.set(0.5);
      this.shade.tint = 0x000000;
      this.shade.alpha = 0.85;
      this.root.addChild(this.shade);
    }
    this.root.addChild(this.inner);
    this.heightPx = height;
    this.tint = tint;
  }

  get text() {
    return this.#text;
  }

  set text(value) {
    const t = String(value);
    if (t === this.#text) return;
    this.#text = t;
    this.#layout();
  }

  setHeight(px) {
    this.heightPx = px;
    this.#layout();
  }

  /** Szerokość napisu w pikselach sceny (przed skalą root). */
  get widthPx() {
    return this.width * this.inner.scale.x;
  }

  #layout() {
    const { frames, advance, lineHeight, size } = this.font;
    const chars = this.#text.split('');
    while (this.#sprites.length < chars.length) {
      const s = new this.font.PIXI.Sprite();
      this.inner.addChild(s);
      this.#sprites.push(s);
    }
    let x = 0;
    let used = 0;
    for (const ch of chars) {
      const tex = frames[ch];
      if (!tex) {
        x += advance[ch] ?? advance[' '] ?? size * 0.3;
        continue;
      }
      const s = this.#sprites[used++];
      s.visible = true;
      s.texture = tex;
      s.tint = this.tint;
      // glif środkowany w swojej komórce zaliczki (cyfry tabelaryczne)
      const adv = advance[ch] ?? tex.width;
      s.position.set(x + (adv - tex.width) / 2, (this.font.offsets[ch]?.y ?? 0));
      x += adv;
    }
    for (let i = used; i < this.#sprites.length; i++) this.#sprites[i].visible = false;
    this.width = x;
    const k = this.heightPx / size;
    this.inner.scale.set(k);
    this.inner.position.set((-x * k) / 2, (-lineHeight * k) / 2);
    if (this.shade) {
      this.shade.width = x * k + this.heightPx * 2;
      this.shade.height = this.heightPx * 2.8;
    }
  }
}
