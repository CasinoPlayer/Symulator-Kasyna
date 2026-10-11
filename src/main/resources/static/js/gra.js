/**
 * gra.js — szkielet strony gry (gra.html?gra=<kod>).
 *
 * Ten etap (fundament): sprawdza sesję (bez sesji → powrót do lobby z prośbą o logowanie), wczytuje gracza
 * i konfigurację automatu (GET /api/slots/{code}), pokazuje ekran ładowania z paskiem postępu (E20), uruchamia
 * scenę PixiJS z podglądem układu bębnów i obsługuje panel sterowania: zakład −/+ (E23), AUTO, TURBO, dźwięk, info.
 * Logiki spinu tu NIE MA — silnik animacji gier (bębny, efekty, dźwięk) dochodzi w kolejnym etapie i podmienia
 * moduł sceny (js/gra/scena-zastepcza.js) oraz obsługę przycisku SPIN.
 */

import { api, messageFor } from './api.js';
import { store } from './store.js';
import { hasSessionHint, sessionLost } from './session.js';
import { assets } from './assets.js';
import { audio } from './audio/audio-engine.js';
import { BalanceCounter } from './ui/balance.js';
import { openModal, isModalOpen } from './ui/modal.js';
import { toast } from './ui/toast.js';
import { formatAmount, formatMultiplier } from './format.js';

const $ = (selector) => document.querySelector(selector);
const CODE_PATTERN = /^[a-z0-9-]{2,40}$/;
const THEMES = { 'cebulowy-777': 's1', 'zloty-faraon': 's2', 'krysztalowa-kaskada': 's3' };
const BACKGROUNDS = { s1: 's1_tlo', s2: 's2_tlo', s3: 's3_tlo' };

const el = {
  name: $('#gra-nazwa'),
  loader: $('#ladowanie'),
  loaderTitle: $('#ladowanie-gra'),
  progress: $('#ladowanie-pasek'),
  step: $('#ladowanie-krok'),
  actions: $('#ladowanie-akcje'),
  retry: $('#btn-ponow'),
  stage: $('#scena'),
  note: $('#scena-opis'),
  pills: [$('#saldo'), $('#saldo-panel')],
  betValue: $('#bet-wartosc'),
  betMinus: $('#bet-minus'),
  betPlus: $('#bet-plus'),
  spin: $('#btn-spin'),
  auto: $('#btn-auto'),
  turbo: $('#btn-turbo'),
  sound: $('#btn-dzwiek'),
  info: $('#btn-info'),
  lobby: $('#btn-lobby'),
  infoModal: $('#modal-info'),
  infoLead: $('#info-opis'),
  infoBody: $('#info-tresc'),
  bg: $('#tlo'),
};

const code = new URLSearchParams(location.search).get('gra') ?? '';
const counters = el.pills.filter(Boolean).map((pill) => new BalanceCounter(pill));
let slot = null;
let betIndex = 0;
let scene = null;

/** Bezpieczny localStorage (tryb prywatny może rzucać wyjątkiem). */
const storage = {
  get(key) { try { return localStorage.getItem(key); } catch { return null; } },
  set(key, value) { try { localStorage.setItem(key, value); } catch { /* bez zapisu */ } },
};

function backToLobby(withLogin = false) {
  location.replace(withLogin ? `./?gra=${encodeURIComponent(code)}` : './');
}

function setProgress(value, label) {
  el.progress.style.setProperty('--value', String(value));
  el.progress.setAttribute('aria-valuenow', String(Math.round(value * 100)));
  if (label) el.step.textContent = label;
}

function showError(message) {
  el.loader.classList.add('is-error');
  el.step.textContent = message;
  el.actions.hidden = false;
}

async function init() {
  if (!CODE_PATTERN.test(code)) return backToLobby();
  // bez śladu sesji nie ma sensu pytać serwera — od razu do lobby, które otworzy okno logowania
  if (!hasSessionHint()) return backToLobby(true);

  const theme = THEMES[code] ?? 's1';
  document.body.classList.add(`theme-${theme}`);
  setProgress(0.08, 'Łączenie z kasynem…');
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
  setProgress(0.3, 'Wczytywanie automatu…');

  // 2. konfiguracja automatu
  try {
    slot = await api.slot(code);
  } catch (err) {
    if (err.code === 'GAME_NOT_FOUND') return backToLobby();
    return showError(messageFor(err));
  }
  document.title = `${slot.name} · Cebulion Casino`;
  el.name.textContent = slot.name;
  el.loaderTitle.textContent = slot.name;
  setupBet();

  // 3. grafika (manifest) i tło gry
  await manifestReady;
  assets.applyTo(document);
  applyBackground(theme);
  setProgress(0.5, 'Przygotowanie grafiki…');

  // 4. scena PixiJS (moduł ładowany dynamicznie — lobby go nie pobiera)
  try {
    const { createScene } = await import('./gra/scena-zastepcza.js');
    scene = await createScene(el.stage, slot, (p) => setProgress(0.5 + p * 0.45));
  } catch (err) {
    console.warn('Scena PixiJS niedostępna:', err);
    toast({ type: 'error', title: 'Grafika ograniczona', message: 'Przeglądarka nie uruchomiła WebGL. Spróbuj odświeżyć stronę.' });
  }
  setProgress(1, 'Gotowe!');
  setTimeout(() => {
    el.loader.classList.add('is-done');                // E21 gra_intro — pełna wersja w kolejnym etapie
    el.note.hidden = !scene;
    el.spin.focus({ preventScroll: true });
  }, 350);
  bindControls();
}

/** Tło gry z manifestu (s1_tlo_desktop / s1_tlo_mobile), dobierane do orientacji ekranu. */
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

// --------------------------------------------------------------------------------------------- saldo

store.on('player', ({ player }) => {
  if (!player) return;
  counters.forEach((c) => c.set(player.balance, { animate: false }));
  updateBetState();
});

// --------------------------------------------------------------------------------------------- zakład

function setupBet() {
  const levels = slot.betLevels?.length ? slot.betLevels : [slot.minBet];
  const saved = Number(storage.get(`cebulion.zaklad.${code}`));
  const savedIndex = levels.indexOf(saved);
  betIndex = savedIndex >= 0 ? savedIndex : 0;
  updateBetState();
}

function updateBetState() {
  if (!slot) return;
  const levels = slot.betLevels?.length ? slot.betLevels : [slot.minBet];
  const bet = levels[betIndex];
  el.betValue.textContent = formatAmount(bet);
  el.betMinus.disabled = betIndex === 0;
  el.betPlus.disabled = betIndex === levels.length - 1;
  const tooHigh = (store.player?.balance ?? 0) < bet;
  el.betValue.classList.toggle('is-too-high', tooHigh);
  el.betValue.title = tooHigh ? 'Za mało cebulionów na ten zakład' : '';
}

function changeBet(step) {
  const levels = slot.betLevels?.length ? slot.betLevels : [slot.minBet];
  const next = Math.min(levels.length - 1, Math.max(0, betIndex + step));
  if (next === betIndex) return;
  betIndex = next;
  storage.set(`cebulion.zaklad.${code}`, String(levels[betIndex]));
  audio.play(step > 0 ? 'ui_zaklad_gora' : 'ui_zaklad_dol');      // E23 zaklad_zmiana
  updateBetState();
}

// --------------------------------------------------------------------------------------------- sterowanie

function bindControls() {
  // Dźwięk odblokowuje pierwszy dowolny gest (pointerup / klawisz / klik — na dotyku samo pointerdown nie wystarcza,
  // 05 § 2.3). Potem wczytujemy dźwięki UI i „krytyczne” dla gry (05 § 2.4), żeby SPIN i zakład grały od razu.
  // Pełne ładowanie pakietów gry (z paskiem postępu i przyciskiem „Graj”) dochodzi razem z runtime gier.
  audio.unlockOnGesture(() => audio.preloadPack('ui', 'gry-krytyczne').then(() => audio.preloadPack('gry-dalsze')));

  el.betMinus.addEventListener('click', () => changeBet(-1));
  el.betPlus.addEventListener('click', () => changeBet(1));

  el.spin.addEventListener('click', () => {
    // Szkielet: animację i żądanie POST /api/slots/{code}/spins dodaje kolejny etap (runtime gier w PixiJS).
    el.spin.classList.remove('is-pressed');
    void el.spin.offsetWidth;
    el.spin.classList.add('is-pressed');
    audio.play('sfx_spin_start');
    toast({ type: 'info', title: 'Automat w przygotowaniu', message: 'Silnik animacji bębnów dochodzi w kolejnym etapie projektu.' });
  });

  for (const [button, key] of [[el.auto, null], [el.turbo, 'cebulion.turbo']]) {
    if (key && storage.get(key) === '1') button.setAttribute('aria-pressed', 'true');
    button.addEventListener('click', () => {
      const on = button.getAttribute('aria-pressed') !== 'true';
      button.setAttribute('aria-pressed', String(on));
      if (key) storage.set(key, on ? '1' : '0');
      audio.play('ui_przelacznik');                                // E38 autoplay / E39 turbo
    });
  }

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

  // Spacja = SPIN (gdy fokus nie jest w polu tekstowym i nie ma otwartego okna)
  document.addEventListener('keydown', (e) => {
    if (e.code !== 'Space' || e.repeat || isModalOpen()) return;
    if (e.target.closest('input, textarea, select, [contenteditable="true"]')) return;
    if (e.target.closest('button, a') && e.target !== el.spin) return; // spacja na innym przycisku = jego kliknięcie
    e.preventDefault();
    el.spin.click();
  });

  // Przejście gra → lobby (E12)
  el.lobby.addEventListener('click', (e) => {
    if (e.metaKey || e.ctrlKey) return;
    e.preventDefault();
    audio.play('sfx_przejscie_whoosh');
    document.body.classList.add('is-leaving');
    setTimeout(() => { location.href = el.lobby.href; }, 220);
  });
}

el.retry.addEventListener('click', () => location.reload());

window.addEventListener('pageshow', (e) => {
  if (e.persisted) document.body.classList.remove('is-leaving');
});

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

function openInfo() {
  if (!slot) return;
  el.infoLead.textContent = `${slot.name}: ${slot.reels}×${slot.rows}, ${slot.lines ? `${slot.lines} linii` : 'wygrane klastrowe'}, RTP ${String(slot.targetRtp).replace('.', ',')}%.`;
  el.infoBody.replaceChildren();

  if (Array.isArray(slot.features) && slot.features.length) {
    el.infoBody.append(Object.assign(document.createElement('h3'), { className: 'info-section-title', textContent: 'Funkcje' }));
    const list = document.createElement('ul');
    list.className = 'feature-list';
    for (const f of slot.features) {
      const li = document.createElement('li');
      if (typeof f === 'string') li.append(Object.assign(document.createElement('span'), { textContent: f }));
      else li.append(Object.assign(document.createElement('b'), { textContent: f.name ?? f.code }), Object.assign(document.createElement('span'), { textContent: f.description ?? '' }));
      list.append(li);
    }
    el.infoBody.append(list);
  }

  if (Array.isArray(slot.symbols) && slot.symbols.length) {
    // Kontrakt 09 § 2.4: w grach liniowych mnożnik dotyczy stawki NA LINIĘ (zakład / liczba linii),
    // a scatter i klastry — całego zakładu. Nagłówek mówi to wprost, żeby tabela nie wprowadzała w błąd.
    const unit = slot.engineType === 'LINES'
      ? `mnożnik stawki na linię (zakład ÷ ${slot.lines}); scatter — mnożnik całego zakładu`
      : 'mnożnik całego zakładu';
    el.infoBody.append(Object.assign(document.createElement('h3'), { className: 'info-section-title', textContent: 'Tabela wypłat' }));
    el.infoBody.append(Object.assign(document.createElement('p'), { className: 'info-section-note', textContent: `Wartości: ${unit}.` }));
    const table = document.createElement('div');
    table.className = 'paytable';
    for (const s of [...slot.symbols].reverse()) {
      const row = document.createElement('div');
      row.className = 'paytable__row';
      const name = document.createElement('div');
      name.append(Object.assign(document.createElement('span'), { className: 'paytable__name', textContent: symbolName(s.code) }));
      if (KIND_LABEL[s.kind]) name.append(Object.assign(document.createElement('span'), { className: 'chip chip--gold paytable__kind', textContent: KIND_LABEL[s.kind] }));
      const pays = document.createElement('div');
      pays.className = 'paytable__pays num';
      const entries = Object.entries(s.pays ?? {});
      if (!entries.length) pays.append(Object.assign(document.createElement('span'), { textContent: 'mnoży wygraną' }));
      for (const [count, mult] of entries) pays.append(Object.assign(document.createElement('span'), { textContent: `${count}× → ${formatMultiplier(mult)}` }));
      row.append(name, pays);
      table.append(row);
    }
    el.infoBody.append(table);
  }
  openModal(el.infoModal);
  audio.play('ui_otworz');
}

init().catch((err) => showError(messageFor(err)));
