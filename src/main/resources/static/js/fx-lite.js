/**
 * fx-lite.js — lekki silnik cząsteczek na Canvas 2D dla lobby (bez PixiJS, żeby lobby ładowało się szybko).
 *
 * Co potrafi:
 *   fountain() — fontanna monet, które po łuku lecą do wskazanego punktu (pigułka salda) — E07, E10,
 *   burst()    — wybuch iskier (mieszanie addytywne „lighter”: kolory się sumują i świecą),
 *   ring()     — rozchodzący się złoty pierścień (fala uderzeniowa),
 *   ambient()  — wolno unoszący się pył i bokeh w tle sekcji powitalnej — E02.
 * Parametry (kąty, prędkości, grawitacja, liczby cząsteczek) pochodzą z docs/projekt/04-efekty-wizualne.md § 2.3:
 * monety_fontanna, monety_lot, pyl, bokeh.
 *
 * Jak dba o płynność (60 fps także na telefonie):
 *   * PULA OBIEKTÓW: wszystkie cząsteczki tworzymy raz w konstruktorze; w pętli animacji nic nie alokujemy
 *     (brak pracy dla garbage collectora = brak „zacięć”). Żywe cząsteczki to początek tablicy, martwą
 *     usuwamy przez zamianę z ostatnią żywą (O(1)),
 *   * LIMIT cząsteczek (mniejszy na telefonie) i limit gęstości pikseli (DPR ≤ 2),
 *   * sprite'y (moneta, poświata) rysujemy RAZ do niewidocznego płótna, potem tylko je kopiujemy (drawImage),
 *   * requestAnimationFrame działa tylko wtedy, gdy jest co animować; przy ukrytej karcie — pauza,
 *   * prefers-reduced-motion: brak cząsteczek; fountain() od razu wywołuje „dotarcie” monet, żeby saldo się zgadzało.
 */

const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const smallScreen = matchMedia('(max-width: 900px)');

const KIND_COIN = 1;
const KIND_SPARK = 2;
const KIND_DUST = 3;
const KIND_RING = 4;

const GRAVITY = 2200;   // px/s² — monety spadają „ciężko”, jak prawdziwe (04 § 2.3 monety_fontanna)
const DRAG = 0.4;       // opór powietrza (ułamek prędkości tracony na sekundę)
const DEG = Math.PI / 180;

/** Jedna cząsteczka. Pola są płaskie (bez obiektów zagnieżdżonych), żeby reset był tani. */
class Particle {
  constructor() {
    this.reset();
  }

  reset() {
    this.kind = 0;
    this.x = 0; this.y = 0; this.vx = 0; this.vy = 0;
    this.age = 0; this.life = 1;
    this.size = 10; this.rot = 0; this.vrot = 0; this.phase = 0; this.vphase = 0;
    this.alpha = 1; this.scale = 1; this.sprite = null; this.big = false;
    this.delay = 0;
    // lot do celu (monety): start po homeAt sekundach, trwa homeDur, krzywa Béziera przez punkt kontrolny
    this.homeAt = -1; this.homeDur = 0.6; this.homing = false; this.hx = 0; this.hy = 0; this.cx = 0; this.cy = 0; this.tx = 0; this.ty = 0;
    this.group = null;
    // pył: kołysanie
    this.wobble = 0; this.baseX = 0; this.amax = 1;
  }
}

/** Grupa monet z jednej fontanny — liczy, ile dotarło, i wywołuje callbacki. */
class CoinGroup {
  constructor(total, target, onArrive, onDone) {
    this.total = total;
    this.arrived = 0;
    this.target = target;
    this.onArrive = onArrive;
    this.onDone = onDone;
  }

  arrive() {
    this.arrived++;
    this.onArrive?.(this.arrived, this.total);
    if (this.arrived === this.total) this.onDone?.();
  }
}

/** Sprite poświaty (radialny gradient) w danym kolorze, rysowany raz. */
function glowSprite(color, size = 64) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.18, color);
  grad.addColorStop(0.45, color.replace(/[\d.]+\)$/, '0.35)'));
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  return c;
}

/** Zastępcza moneta narysowana gradientami (gdy obraz monety jeszcze się nie wczytał). */
function proceduralCoin(size = 96) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const r = size / 2;
  const rim = g.createLinearGradient(0, 0, size, size);
  rim.addColorStop(0, '#FFF6D6'); rim.addColorStop(0.35, '#F5C542'); rim.addColorStop(0.7, '#B8860B'); rim.addColorStop(1, '#5C3A00');
  g.fillStyle = rim;
  g.beginPath(); g.arc(r, r, r - 1, 0, Math.PI * 2); g.fill();
  const face = g.createRadialGradient(r * 0.8, r * 0.7, 2, r, r, r * 0.8);
  face.addColorStop(0, '#FFE9A8'); face.addColorStop(0.5, '#F5C542'); face.addColorStop(1, '#B8860B');
  g.fillStyle = face;
  g.beginPath(); g.arc(r, r, r * 0.78, 0, Math.PI * 2); g.fill();
  g.strokeStyle = 'rgba(255,246,214,0.8)';
  g.lineWidth = size * 0.02;
  g.setLineDash([size * 0.01, size * 0.045]);
  g.beginPath(); g.arc(r, r, r * 0.86, 0, Math.PI * 2); g.stroke();
  return c;
}

export class FxLite {
  /**
   * @param {HTMLCanvasElement} canvas płótno (CSS ustala jego rozmiar; silnik dopasowuje rozdzielczość)
   * @param {{maxParticles?: number, maxDpr?: number, coinSrc?: string}} options
   */
  constructor(canvas, { maxParticles = 360, maxDpr = 2, coinSrc } = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: true });
    this.max = smallScreen.matches ? Math.round(maxParticles * 0.5) : maxParticles;
    this.maxDpr = smallScreen.matches ? Math.min(maxDpr, 1.75) : maxDpr;
    this.pool = Array.from({ length: this.max }, () => new Particle());
    this.count = 0;
    this.ambientTarget = 0;
    this.dustTarget = 0;
    this.bokehTarget = 0;
    this.active = true;      // false = sekcja poza ekranem (IntersectionObserver)
    this.raf = 0;
    this.last = 0;
    this.width = 0;
    this.height = 0;
    this.dpr = 1;

    this.sprites = {
      coin: proceduralCoin(),
      gold: glowSprite('rgba(255,214,102,0.95)'),
      magenta: glowSprite('rgba(255,46,136,0.95)'),
      cyan: glowSprite('rgba(33,230,255,0.95)'),
      white: glowSprite('rgba(255,246,214,0.95)'),
    };
    if (coinSrc) this.setCoinImage(coinSrc);

    this.frame = this.frame.bind(this);
    this.resize = this.resize.bind(this);
    this.resize();
    this.resizeObserver = new ResizeObserver(this.resize);
    this.resizeObserver.observe(canvas);
    this.onVisibility = () => (document.hidden ? this.stop() : this.start());
    document.addEventListener('visibilitychange', this.onVisibility);
  }

  /** Czy efekty są w ogóle włączone (użytkownik nie prosił o ograniczenie ruchu). */
  get enabled() {
    return !reducedMotion.matches;
  }

  /** Podmienia sprite monety na obraz (np. g_moneta_przod z manifestu albo icons/moneta.svg). */
  setCoinImage(src) {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => {
      const size = 96;
      const c = document.createElement('canvas');
      c.width = c.height = size;
      c.getContext('2d').drawImage(img, 0, 0, size, size);
      this.sprites.coin = c;
    };
    img.src = src;
  }

  /** Dopasowuje rozdzielczość płótna do rozmiaru w CSS × gęstość pikseli (ostre na Retinie). */
  resize() {
    const rect = this.canvas.getBoundingClientRect();
    this.width = rect.width;
    this.height = rect.height;
    this.dpr = Math.min(window.devicePixelRatio || 1, this.maxDpr);
    this.canvas.width = Math.max(1, Math.round(rect.width * this.dpr));
    this.canvas.height = Math.max(1, Math.round(rect.height * this.dpr));
  }

  /** Pobiera wolną cząsteczkę z puli (albo null, gdy limit osiągnięty). */
  spawn(kind) {
    if (this.count >= this.max) return null;
    const p = this.pool[this.count++];
    p.reset();
    p.kind = kind;
    return p;
  }

  kill(index) {
    const last = --this.count;
    if (index !== last) {
      const tmp = this.pool[index];
      this.pool[index] = this.pool[last];
      this.pool[last] = tmp;
    }
  }

  /**
   * Fontanna monet lecących do celu (04 § 2.3: monety_fontanna → monety_lot).
   * Faza 1: monety tryskają w górę (kąt −90° ± 28°, 900–1500 px/s, grawitacja, opór).
   * Faza 2: każda moneta leci do celu po krzywej Béziera 2. stopnia (punkt kontrolny 30–45% odległości w górę,
   *         ± 20% w bok), postęp easeInCubic przez 600–900 ms, skala 1,0 → 0,45 przy celu.
   * @param {{x: number, y: number, count?: number, target: () => {x: number, y: number},
   *          onArrive?: (arrived: number, total: number) => void, onDone?: () => void, power?: number}} o
   *   x, y — skąd tryskają (piksele okna); target — funkcja zwracająca aktualny środek celu (pigułka salda);
   *   count — liczba monet na poziomie High (24), na telefonie 2/3 tej liczby (poziom Medium: 16).
   */
  fountain({ x, y, count = 24, target, onArrive, onDone, power }) {
    const n = smallScreen.matches ? Math.round((count * 2) / 3) : count;
    if (!this.enabled) {
      // bez animacji: od razu „dotarły” wszystkie monety (saldo musi się zgodzić)
      for (let i = 1; i <= n; i++) onArrive?.(i, n);
      onDone?.();
      return;
    }
    // na niskim ekranie słabszy wyrzut, żeby monety nie wylatywały poza górną krawędź
    const boost = power ?? Math.min(1, Math.max(0.62, this.height / 1000));
    const group = new CoinGroup(n, target, onArrive, onDone);
    let spawned = 0;
    for (let i = 0; i < n; i++) {
      const p = this.spawn(KIND_COIN);
      if (!p) break;
      spawned++;
      const angle = (-90 + (Math.random() * 2 - 1) * 28) * DEG;
      const speed = (900 + Math.random() * 600) * boost;
      p.x = x + (Math.random() - 0.5) * 30;
      p.y = y + (Math.random() - 0.5) * 16;
      p.vx = Math.cos(angle) * speed;
      p.vy = Math.sin(angle) * speed;
      p.size = 28 + Math.random() * 24;
      p.rot = (Math.random() - 0.5) * 0.6;
      p.vrot = (Math.random() - 0.5) * 4;
      p.phase = Math.random() * Math.PI * 2;
      p.vphase = 8 + Math.random() * 10;                          // obrót monety (spłaszczanie w osi X)
      p.delay = i * 0.035;                                        // strumień: odstęp 35 ms
      p.homeAt = 0.42 + Math.random() * 0.25;                     // mniej więcej w szczycie lotu
      p.homeDur = 0.6 + Math.random() * 0.3;
      p.life = p.homeAt + p.homeDur + 0.2;
      p.sprite = this.sprites.coin;
      p.group = group;
    }
    // gdy pula była pełna, „brakujące” monety zaliczamy od razu
    group.total = spawned;
    if (!spawned) {
      onDone?.();
      return;
    }
    this.start();
  }

  /**
   * Wybuch iskier.
   * @param {{x: number, y: number, count?: number, colors?: string[], speed?: number, size?: number}} o
   */
  burst({ x, y, count = 26, colors = ['gold', 'white'], speed = 520, size = 22 }) {
    if (!this.enabled) return;
    for (let i = 0; i < count; i++) {
      const p = this.spawn(KIND_SPARK);
      if (!p) break;
      const angle = Math.random() * Math.PI * 2;
      const v = speed * (0.35 + Math.random() * 0.75);
      p.x = x; p.y = y;
      p.vx = Math.cos(angle) * v;
      p.vy = Math.sin(angle) * v;
      p.size = size * (0.5 + Math.random());
      p.life = 0.45 + Math.random() * 0.5;
      p.sprite = this.sprites[colors[i % colors.length]] ?? this.sprites.gold;
    }
    this.start();
  }

  /** Złoty pierścień rozchodzący się od punktu (np. przy rozbłysku bonusu). */
  ring({ x, y, radius = 180, duration = 0.7 }) {
    if (!this.enabled) return;
    const p = this.spawn(KIND_RING);
    if (!p) return;
    p.x = x; p.y = y; p.size = radius; p.life = duration;
    this.start();
  }

  /**
   * Pył i bokeh w tle (E02). Utrzymuje stałą liczbę cząsteczek, dopóki nie wywołasz ambient(0, 0).
   * Lobby (04 § 2.3): pył 40 / 24 / 12, bokeh 12 / 8 / 0 (High / Medium / Low); telefon = Medium.
   * @param {number} dust liczba drobin pyłu, @param {number} bokeh liczba dużych, miękkich kół bokeh
   */
  ambient(dust = 40, bokeh = 12) {
    const medium = smallScreen.matches;
    this.dustTarget = this.enabled ? (medium ? Math.round(dust * 0.6) : dust) : 0;
    this.bokehTarget = this.enabled ? (medium ? Math.round((bokeh * 2) / 3) : bokeh) : 0;
    this.ambientTarget = this.dustTarget + this.bokehTarget;
    this.start();
  }

  /** Włącza/wyłącza animację (np. sekcja z tłem wyjechała poza ekran). */
  setActive(active) {
    this.active = active;
    if (active) this.start();
    else this.stop();
  }

  /** Natychmiast kończy wszystkie efekty (np. gracz pominął sekwencję) — monety „docierają” od razu. */
  finishAll() {
    for (let i = this.count - 1; i >= 0; i--) {
      const p = this.pool[i];
      if (p.kind === KIND_COIN && p.group) p.group.arrive();
    }
    for (let i = this.count - 1; i >= 0; i--) if (this.pool[i].kind !== KIND_DUST) this.kill(i);
    this.draw();
  }

  start() {
    if (this.raf || !this.active || document.hidden) return;
    if (!this.count && !this.ambientTarget) return;
    this.last = 0;
    this.raf = requestAnimationFrame(this.frame);
  }

  stop() {
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  destroy() {
    this.stop();
    this.resizeObserver.disconnect();
    document.removeEventListener('visibilitychange', this.onVisibility);
  }

  /** Jedna klatka: aktualizacja fizyki + rysowanie. */
  frame(now) {
    this.raf = 0;
    // dt ograniczone do 50 ms: po powrocie do karty cząsteczki nie „teleportują się”
    const dt = this.last ? Math.min(0.05, (now - this.last) / 1000) : 1 / 60;
    this.last = now;
    this.update(dt);
    this.draw();
    if (this.count || this.ambientTarget) this.raf = requestAnimationFrame(this.frame);
  }

  update(dt) {
    // dopełnij pył i bokeh do docelowej liczby (pierwsze wypełnienie: losowo na całej wysokości)
    if (this.ambientTarget) {
      let dust = 0;
      let bokeh = 0;
      for (let i = 0; i < this.count; i++) {
        const p = this.pool[i];
        if (p.kind === KIND_DUST) (p.big ? bokeh++ : dust++);
      }
      for (; bokeh < this.bokehTarget; bokeh++) this.spawnDust(true);
      for (; dust < this.dustTarget; dust++) this.spawnDust(false);
    }

    for (let i = this.count - 1; i >= 0; i--) {
      const p = this.pool[i];
      if (p.delay > 0) {
        p.delay -= dt;
        continue;
      }
      p.age += dt;
      const t = p.age;
      switch (p.kind) {
        case KIND_COIN: {
          p.phase += p.vphase * dt;
          p.rot += p.vrot * dt;
          if (t < p.homeAt) {
            const drag = 1 - DRAG * dt;
            p.vy = (p.vy + GRAVITY * dt) * drag;
            p.vx *= drag;
            p.x += p.vx * dt;
            p.y += p.vy * dt;
          } else {
            if (!p.homing) {
              p.homing = true;
              // początek lotu do celu: start, cel i punkt kontrolny łuku (30–45% odległości w górę, ± 20% w bok)
              const target = p.group.target();
              p.hx = p.x; p.hy = p.y; p.tx = target.x; p.ty = target.y;
              const d = Math.hypot(target.x - p.x, target.y - p.y);
              p.cx = (p.x + target.x) / 2 + (Math.random() * 2 - 1) * 0.2 * d;
              p.cy = (p.y + target.y) / 2 - (0.3 + Math.random() * 0.15) * d;
            }
            const k = Math.min(1, (t - p.homeAt) / p.homeDur);
            const e = k * k * k;                                    // easeInCubic: przyspiesza ku pigułce
            const u = 1 - e;
            p.x = u * u * p.hx + 2 * u * e * p.cx + e * e * p.tx;
            p.y = u * u * p.hy + 2 * u * e * p.cy + e * e * p.ty;
            p.scale = 1 - 0.55 * e;                                 // 1,0 → 0,45 przy celu
            p.alpha = 1 - Math.max(0, k - 0.9) * 6;
            if (k >= 1) {
              p.group.arrive();
              this.kill(i);
              continue;
            }
          }
          break;
        }
        case KIND_SPARK:
          p.vy += 380 * dt;
          p.vx *= 0.97;
          p.vy *= 0.97;
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.alpha = 1 - t / p.life;
          break;
        case KIND_DUST:
          // dryf w górę z błądzeniem sin; po wyjściu górą wraca od dołu (życie nieskończone, 04 § 2.3)
          p.y += p.vy * dt;
          p.wobble += dt * p.vphase;
          p.x = p.baseX + Math.sin(p.wobble + p.phase) * (p.big ? 30 : 14);
          if (p.y < -p.size) {
            p.y = this.height + p.size;
            p.baseX = Math.random() * this.width;
          }
          p.alpha = p.amax * (0.75 + 0.25 * Math.sin(t * 1.3 + p.phase));
          break;
        case KIND_RING:
          p.alpha = 1 - t / p.life;
          break;
        default:
          break;
      }
      if (t >= p.life) {
        if (p.kind === KIND_COIN && p.group) p.group.arrive();
        this.kill(i);
      }
    }
  }

  /** Drobina pyłu (3–9 px, alfa 0,05–0,3) albo koło bokeh (40–140 px, alfa 0,04–0,12, złoto/magenta/cyjan). */
  spawnDust(big) {
    const p = this.spawn(KIND_DUST);
    if (!p) return;
    p.big = big;
    p.baseX = Math.random() * this.width;
    p.x = p.baseX;
    p.y = Math.random() * (this.height + 40) - 20;
    p.vy = big ? -(2 + Math.random() * 6) : -(6 + Math.random() * 14);
    p.size = big ? 40 + Math.random() * 100 : 3 + Math.random() * 6;
    p.life = Infinity;
    p.phase = Math.random() * Math.PI * 2;
    p.vphase = (0.2 + Math.random() * 0.3) * Math.PI * 2;  // błądzenie 0,2–0,5 Hz
    p.amax = big ? 0.04 + Math.random() * 0.08 : 0.08 + Math.random() * 0.22;
    p.sprite = big ? [this.sprites.gold, this.sprites.magenta, this.sprites.cyan][Math.floor(Math.random() * 3)] : this.sprites.white;
  }

  draw() {
    const { ctx, dpr } = this;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    if (!this.count) return;

    // 1. przebieg addytywny (iskry, pył, pierścienie) — świecą „przez” siebie
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < this.count; i++) {
      const p = this.pool[i];
      if (p.delay > 0 || p.kind === KIND_COIN) continue;
      ctx.globalAlpha = Math.max(0, Math.min(1, p.alpha));
      if (p.kind === KIND_RING) {
        const k = p.age / p.life;
        const r = p.size * (0.2 + 0.8 * (1 - (1 - k) ** 3));
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.strokeStyle = 'rgba(255, 224, 138, 0.9)';
        ctx.lineWidth = 6 * (1 - k) + 1;
        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
        ctx.stroke();
        continue;
      }
      const s = p.kind === KIND_SPARK ? p.size * (0.4 + 0.6 * p.alpha) : p.size;
      ctx.setTransform(dpr, 0, 0, dpr, dpr * p.x, dpr * p.y);
      ctx.drawImage(p.sprite, -s / 2, -s / 2, s, s);
    }

    // 2. przebieg zwykły (monety) — obrót wokół osi pionowej udajemy skalowaniem X = cos(faza)
    ctx.globalCompositeOperation = 'source-over';
    for (let i = 0; i < this.count; i++) {
      const p = this.pool[i];
      if (p.delay > 0 || p.kind !== KIND_COIN) continue;
      ctx.globalAlpha = Math.max(0, Math.min(1, p.alpha));
      const flip = Math.cos(p.phase);
      const sx = (Math.abs(flip) < 0.12 ? 0.12 * Math.sign(flip || 1) : flip) * dpr;
      const sy = dpr;
      const cos = Math.cos(p.rot);
      const sin = Math.sin(p.rot);
      ctx.setTransform(sx * cos, sx * sin, -sy * sin, sy * cos, dpr * p.x, dpr * p.y);
      const s = p.size * p.scale;
      ctx.drawImage(p.sprite, -s / 2, -s / 2, s, s);
    }
    ctx.globalAlpha = 1;
  }
}
