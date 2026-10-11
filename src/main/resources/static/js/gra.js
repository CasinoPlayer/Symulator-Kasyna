/**
 * gra.js — strona gry (gra.html?gra=<kod>): start runtime gier w PixiJS.
 *
 * Kolejność (04 E20 → E21):
 *   1. sesja (bez sesji → lobby z oknem logowania), gracz z GET /api/me, automat z GET /api/slots/{code}
 *      (betLevels, symbole i tabela wypłat, `paylines` dla gier liniowych),
 *   2. ekran ładowania z paskiem postępu: Pixi, obrazy z manifestu (Assets.load), grafika z kodu, tekstury na GPU,
 *      rozgrzewka shaderów,
 *   3. przycisk „Graj” — gest gracza odblokowuje dźwięk (przeglądarki blokują audio bez gestu, 05 § 2.3),
 *   4. intro automatu (E21); SPIN aktywny od 1000 ms intro.
 * Logika rundy i panelu: js/game/controller.js; scena i efekty: js/game/** (runtime + games/s1.js).
 */

import { api, messageFor } from './api.js';
import { store } from './store.js';
import { hasSessionHint, sessionLost } from './session.js';
import { assets } from './assets.js';
import { audio } from './audio/audio-engine.js';
import { openModal } from './ui/modal.js';
import { toast } from './ui/toast.js';
import { formatMultiplier } from './format.js';

const $ = (selector) => document.querySelector(selector);
const CODE_PATTERN = /^[a-z0-9-]{2,40}$/;
const THEMES = { 'cebulowy-777': 's1', 'zloty-faraon': 's2', 'krysztalowa-kaskada': 's3' };
const BACKGROUNDS = { s1: 's1_tlo', s2: 's2_tlo', s3: 's3_tlo' };
/** Linie S1 (09 § 2.2) — zapas, gdyby serwer nie podał `paylines` (np. starsza wersja API). */
const S1_PAYLINES = [[1, 1, 1], [0, 0, 0], [2, 2, 2], [0, 1, 2], [2, 1, 0]];

const el = {
  name: $('#gra-nazwa'),
  loader: $('#ladowanie'),
  loaderTitle: $('#ladowanie-gra'),
  progress: $('#ladowanie-pasek'),
  step: $('#ladowanie-krok'),
  actions: $('#ladowanie-akcje'),
  retry: $('#btn-ponow'),
  play: $('#btn-graj'),
  stage: $('#scena'),
  sound: $('#btn-dzwiek'),
  info: $('#btn-info'),
  infoModal: $('#modal-info'),
  infoLead: $('#info-opis'),
  infoBody: $('#info-tresc'),
  bg: $('#tlo'),
  ctxOverlay: $('#gra-kontekst'),
  reload: $('#btn-przeladuj'),
};

const code = new URLSearchParams(location.search).get('gra') ?? '';
let slot = null;
let shownProgress = 0;

function backToLobby(withLogin = false) {
  location.replace(withLogin ? `./?gra=${encodeURIComponent(code)}` : './');
}

/** Pasek postępu: wartość nigdy się nie cofa (04 E20). */
function setProgress(value, label) {
  shownProgress = Math.max(shownProgress, Math.min(1, value));
  el.progress.style.setProperty('--value', String(shownProgress));
  el.progress.setAttribute('aria-valuenow', String(Math.round(shownProgress * 100)));
  if (label) el.step.textContent = label;
}

function showError(message) {
  el.loader.classList.add('is-error');
  el.step.textContent = message;
  el.actions.hidden = false;
  el.play.hidden = true;
}

async function init() {
  if (!CODE_PATTERN.test(code)) return backToLobby();
  // bez śladu sesji nie ma sensu pytać serwera — od razu do lobby, które otworzy okno logowania
  if (!hasSessionHint()) return backToLobby(true);

  const theme = THEMES[code] ?? 's1';
  document.body.classList.add(`theme-${theme}`);
  setProgress(0.04, 'Łączenie z kasynem…');
  const manifestReady = assets.load();

  // 1. gracz (sesja)
  try {
    const player = await api.me();
    store.setPlayer(player, { reason: 'restore' });
  } catch (err) {
    if (err.code === 'NOT_LOGGED_IN') {
      sessionLost();
      return backToLobby(true);
    }
    return showError(messageFor(err));
  }
  setProgress(0.08, 'Wczytywanie automatu…');

  // 2. konfiguracja automatu
  try {
    slot = await api.slot(code);
  } catch (err) {
    if (err.code === 'GAME_NOT_FOUND') return backToLobby();
    return showError(messageFor(err));
  }
  if (slot.engineType !== 'CLUSTER' && !Array.isArray(slot.paylines) && code === 'cebulowy-777') slot.paylines = S1_PAYLINES;
  document.title = `${slot.name} · Cebulion Casino`;
  el.name.textContent = slot.name;
  el.loaderTitle.textContent = slot.name;

  // 3. manifest grafiki i tło strony
  await manifestReady;
  assets.applyTo(document);
  applyBackground(theme);
  setProgress(0.12, 'Przygotowanie automatu…');

  // 4. runtime gier (moduły ładowane dynamicznie — lobby ich nie pobiera)
  let runtime;
  try {
    runtime = await startRuntime(theme);
  } catch (err) {
    console.error('Runtime gry nie wystartował:', err);
    return showError('Przeglądarka nie uruchomiła grafiki automatu (WebGL). Odśwież stronę albo spróbuj w innej przeglądarce.');
  }
  setProgress(1, 'Gotowe!');
  bindChrome(runtime);
  el.play.hidden = false;
  el.play.focus({ preventScroll: true });
  const start = () => {
    audio.unlock();                       // w obsłudze gestu — wymóg przeglądarek (05 § 2.3)
    audio.play('ui_klik');
    el.play.hidden = true;
    el.loader.classList.add('is-done');
    runtime.game.audio.preloadCritical();
    runtime.gameApp.quality.suspend(1200);
    Promise.resolve(runtime.game.intro()).then(() => {
      runtime.controller.ready();
      // dalsze dźwięki w tle, po intro (05 § 2.4); limit czasu, bo przy ciągłej animacji „bezczynność” może nie nadejść
      const later = () => runtime.game.audio.preloadLater();
      if (window.requestIdleCallback) requestIdleCallback(later, { timeout: 2500 });
      else setTimeout(later, 500);
    });
  };
  el.play.addEventListener('click', start, { once: true });
}

/** Tworzy aplikację Pixi, grę i kontroler; postęp ładowania 0,12 → 1. */
async function startRuntime(theme) {
  const [{ GameApp }, { Quality, Motion }, { GameController }] = await Promise.all([
    import('./game/core/app.js'), import('./game/core/quality.js'), import('./game/controller.js'),
  ]);
  const quality = new Quality();
  const motion = new Motion();
  const gameApp = new GameApp({ container: el.stage, quality, motion });
  await gameApp.init();
  setProgress(0.2, 'Wczytywanie grafiki…');
  const GameClass = theme === 's1'
    ? (await import('./game/games/s1.js')).S1Game
    : (await import('./game/games/zastepcza.js')).PlaceholderGame;
  const holder = {};
  const game = new GameClass({ gameApp, slot, ui: new Proxy({}, { get: (_t, k) => holder.ui?.[k] }) });
  await game.load((p) => setProgress(0.2 + p * 0.8, p < 0.6 ? 'Wczytywanie grafiki…' : p < 0.9 ? 'Przygotowanie efektów…' : 'Rozgrzewanie efektów…'));
  const controller = new GameController({ code, slot, gameApp, game });
  holder.ui = controller.uiCallbacks();
  audio.setQuality?.(quality.level);
  if (new URLSearchParams(location.search).get('fx') === 'debug') startDebugPanel(game);
  return { gameApp, game, controller };
}

/** Tło strony z manifestu (s1_tlo_desktop / s1_tlo_mobile), dobierane do orientacji ekranu. */
function applyBackground(theme) {
  const portrait = matchMedia('(orientation: portrait)');
  const set = () => {
    const base = BACKGROUNDS[theme];
    const id = portrait.matches && assets.has(`${base}_mobile`) ? `${base}_mobile` : `${base}_desktop`;
    const css = assets.cssImage(id);
    if (css) el.bg.style.setProperty('--page-bg-image', css);
  };
  set();
  portrait.addEventListener('change', set);
}

// --------------------------------------------------------------------------------------------- pasek górny, okna

function bindChrome({ gameApp }) {
  const syncSound = () => {
    const muted = audio.isMuted();
    el.sound.setAttribute('aria-pressed', String(muted));
    el.sound.setAttribute('aria-label', muted ? 'Włącz dźwięk' : 'Wycisz dźwięk');
    el.sound.querySelector('use').setAttribute('href', `icons/ikony.svg#${muted ? 'dzwiek_wyl' : 'dzwiek_wl'}`);
  };
  el.sound.addEventListener('click', () => {
    audio.unlock();
    audio.toggleMuted();
  });
  audio.onChange(syncSound);
  syncSound();
  el.info.addEventListener('click', openInfo);
  // gest odblokowuje dźwięk także poza „Graj” (05 § 2.3: pointerup / keydown / click, słuchacze do skutku)
  const unlock = () => audio.unlock();
  for (const type of ['pointerup', 'keydown', 'click']) document.addEventListener(type, unlock, { passive: true });

  // utrata kontekstu WebGL: pauza i komunikat; po 3 s bez odzyskania — przycisk przeładowania
  let lostTimer = 0;
  gameApp.addEventListener('contextlost', () => {
    el.ctxOverlay.hidden = false;
    el.reload.hidden = true;
    lostTimer = setTimeout(() => { el.reload.hidden = false; }, 3000);
  });
  gameApp.addEventListener('contextrestored', () => {
    clearTimeout(lostTimer);
    el.ctxOverlay.hidden = true;
  });
  el.reload.addEventListener('click', () => location.reload());
}

el.retry.addEventListener('click', () => location.reload());

window.addEventListener('pageshow', (e) => {
  if (e.persisted) document.body.classList.remove('is-leaving');
});

/** Panel ?fx=debug (04 § 9): FPS, p90 klatki, poziom jakości, cząsteczki, trauma, błyski / s. */
function startDebugPanel(game) {
  const box = document.createElement('pre');
  box.className = 'fx-debug';
  document.body.append(box);
  setInterval(() => {
    const d = game.debugInfo();
    box.textContent = `fps ${d.fps}  p90 ${d.p90.toFixed(1)} ms  jakość ${d.quality}\ncząsteczki ${d.particles}  trauma ${d.trauma}\nbłyski/s maks. ${d.flashMaxPerSecond}  pominięte-bohater ${d.heroSkips}`;
  }, 500);
}

// --------------------------------------------------------------------------------------------- okno zasad

const KIND_LABEL = { WILD: 'WILD', SCATTER: 'SCATTER', MULTIPLIER: 'MNOŻNIK' };

/** Nazwy symboli do wyświetlenia (kody w API są bez polskich znaków — brief §2). Klucz: `<kod gry>:<kod symbolu>`. */
const SYMBOL_NAMES = {
  wisnie: 'Wiśnie', cytryna: 'Cytryna', sliwka: 'Śliwka', arbuz: 'Arbuz', dzwonek: 'Dzwonek', bar: 'BAR',
  siodemka: 'Siódemka', wild: 'Złota Cebula', 10: '10', j: 'J', q: 'Q', k: 'K', a: 'A', ankh: 'Ankh',
  oko: 'Oko Horusa', skarabeusz: 'Skarabeusz', anubis: 'Anubis', faraon: 'Faraon', szafir: 'Szafir',
  szmaragd: 'Szmaragd', ametyst: 'Ametyst', topaz: 'Topaz', rubin: 'Rubinowe serce', diament: 'Diament',
  cebula: 'Kryształowa cebula', mnoznik: 'Kula mnożnika',
  'zloty-faraon:wild': 'Złota Relikwia Cebuli', 'zloty-faraon:scatter': 'Piramida',
  'krysztalowa-kaskada:scatter': 'Serce Jaskini',
};
const symbolName = (symbol) => SYMBOL_NAMES[`${code}:${symbol}`] ?? SYMBOL_NAMES[symbol] ?? symbol.replace(/_/g, ' ');
const make = (tag, props = {}) => Object.assign(document.createElement(tag), props);

function openInfo() {
  if (!slot) return;
  el.infoLead.textContent = `${slot.name}: ${slot.reels}×${slot.rows}, ${slot.lines ? `${slot.lines} linii` : 'wygrane klastrowe'}, RTP ${String(slot.targetRtp).replace('.', ',')}%.`;
  el.infoBody.replaceChildren();

  if (Array.isArray(slot.features) && slot.features.length) {
    el.infoBody.append(make('h3', { className: 'info-section-title', textContent: 'Funkcje' }));
    const list = make('ul', { className: 'feature-list' });
    for (const f of slot.features) {
      const li = make('li');
      if (typeof f === 'string') li.append(make('span', { textContent: f }));
      else li.append(make('b', { textContent: f.name ?? f.code }), make('span', { textContent: f.description ?? '' }));
      list.append(li);
    }
    el.infoBody.append(list);
  }

  if (Array.isArray(slot.symbols) && slot.symbols.length) {
    el.infoBody.append(make('h3', { className: 'info-section-title', textContent: 'Tabela wypłat (mnożnik zakładu)' }));
    const table = make('div', { className: 'paytable' });
    for (const s of [...slot.symbols].reverse()) {
      const row = make('div', { className: 'paytable__row' });
      const name = make('div');
      name.append(make('span', { className: 'paytable__name', textContent: symbolName(s.code) }));
      if (KIND_LABEL[s.kind]) name.append(make('span', { className: 'chip chip--gold paytable__kind', textContent: KIND_LABEL[s.kind] }));
      const pays = make('div', { className: 'paytable__pays num' });
      const entries = Object.entries(s.pays ?? {});
      if (!entries.length) pays.append(make('span', { textContent: 'mnoży wygraną' }));
      for (const [count, mult] of entries) pays.append(make('span', { textContent: `${count}× → ${formatMultiplier(mult)}` }));
      row.append(name, pays);
      table.append(row);
    }
    el.infoBody.append(table);
  }

  // linie wygrywające (paylines z API): mini-plansze z podświetlonymi polami
  if (Array.isArray(slot.paylines) && slot.paylines.length) {
    el.infoBody.append(make('h3', { className: 'info-section-title', textContent: `Linie (${slot.paylines.length})` }));
    const grid = make('div', { className: 'paylines' });
    slot.paylines.forEach((rows, i) => {
      const card = make('figure', { className: 'payline' });
      const cells = make('div', { className: 'payline__grid' });
      cells.style.setProperty('--cols', String(rows.length));
      for (let r = 0; r < slot.rows; r++) {
        for (let c = 0; c < rows.length; c++) cells.append(make('span', { className: rows[c] === r ? 'is-on' : '' }));
      }
      card.append(cells, make('figcaption', { textContent: `Linia ${i + 1}` }));
      grid.append(card);
    });
    el.infoBody.append(grid);
  }
  openModal(el.infoModal);
  audio.play('ui_otworz');
}

init().catch((err) => {
  console.error(err);
  showError(messageFor(err));
  toast({ type: 'error', title: 'Błąd strony gry', message: messageFor(err) });
});
