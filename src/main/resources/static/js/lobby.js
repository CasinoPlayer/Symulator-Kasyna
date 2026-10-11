/**
 * lobby.js — logika strony głównej (lobby) Cebulion Casino.
 *
 * Odpowiada za:
 *   * przywrócenie sesji (GET /api/me) i stan paska górnego: „Zaloguj” albo awatar + saldo + menu,
 *   * okno logowania (walidacja nazwy, błędy z serwera, Enter = wejdź) i sekwencję bonusu powitalnego (E07),
 *   * kafle gier z GET /api/slots (okładka z manifestu albo grafika zastępcza, wideo, pochylenie 3D — E03),
 *   * feed dużych wygranych i ranking (z łagodnym stanem pustym), historię gry,
 *   * bankructwo i bonus ratunkowy z odliczaniem (E09, E10), przejście do gry (E12),
 *   * pył w tle sekcji powitalnej (E02) i wejście elementów przy przewijaniu.
 * Wszystkie teksty z serwera (nazwy graczy!) wstawiamy przez textContent — nigdy przez innerHTML (ochrona przed XSS).
 */

import { api, messageFor } from './api.js';
import { store, isBankrupt } from './store.js';
import { restoreSession, login, logout, sessionLost } from './session.js';
import { assets } from './assets.js';
import { audio } from './audio/audio-engine.js';
import { FxLite } from './fx-lite.js';
import { openModal, closeModal } from './ui/modal.js';
import { toast } from './ui/toast.js';
import { BalanceCounter } from './ui/balance.js';
import { createAvatar, updateAvatar } from './ui/avatar.js';
import { icon, coinImg, COIN_FALLBACK, EMBLEM_FALLBACK } from './ui/icons.js';
import { playReward } from './ui/reward.js';
import { validateNick, NICK_MAX } from './validation.js';
import { formatAmount, formatCebuliony, formatCountdown, formatDateTime, formatMultiplier, formatRelative, formatSigned } from './format.js';

// --------------------------------------------------------------------------------------------- stałe i elementy

const $ = (selector, root = document) => root.querySelector(selector);
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const finePointer = matchMedia('(hover: hover) and (pointer: fine)');

/** Katalog zapasowy (te same dane co w kontrakcie) — lobby wygląda dobrze nawet przy chwilowym braku serwera. */
const FALLBACK_SLOTS = [
  { code: 'cebulowy-777', name: 'Cebulowy 777', engineType: 'LINES', reels: 3, rows: 3, lines: 5, minBet: 10, maxBet: 1000, targetRtp: 95.0, volatility: 'LOW_MEDIUM' },
  { code: 'zloty-faraon', name: 'Złoty Faraon', engineType: 'LINES', reels: 5, rows: 3, lines: 20, minBet: 20, maxBet: 2000, targetRtp: 96.0, volatility: 'MEDIUM_HIGH' },
  { code: 'krysztalowa-kaskada', name: 'Kryształowa Kaskada', engineType: 'CLUSTER', reels: 6, rows: 5, lines: null, minBet: 20, maxBet: 2000, targetRtp: 96.0, volatility: 'HIGH' },
];

/** Dane „marketingowe” kafli (wygląd) — dane techniczne przychodzą z API. Klucz = kod gry. */
const GAME_META = {
  'cebulowy-777': { theme: 's1', cover: 's1_okladka', badge: 'Klasyk retro' },
  'zloty-faraon': { theme: 's2', cover: 's2_okladka', badge: 'Darmowe spiny' },
  'krysztalowa-kaskada': { theme: 's3', cover: 's3_okladka', badge: 'Kaskady' },
};

const VOLATILITY = { LOW_MEDIUM: [1, 'niska–średnia'], MEDIUM_HIGH: [2, 'średnia–wysoka'], HIGH: [3, 'wysoka'] };
const TIER_LABEL = { small: 'Wygrana', medium: 'Dobra', big: 'Big win', mega: 'Mega win', epic: 'Epic win', ultra: 'Ultra win' };

/** Grafika zastępcza kafla: same elementy dekoracyjne (bez danych z serwera), stylowane w lobby.css. */
const ART_HTML = {
  s1: '<div class="art__glow"></div><div class="art__sun"></div><div class="art__floor"><div class="art__grid"></div></div><div class="art__horizon"></div><div class="art__title">CEBULOWY</div><div class="art__hero">777</div>',
  s2: '<div class="art__stars"></div><div class="art__beam"></div><div class="art__pyramid"></div><div class="art__eye"></div><div class="art__dunes"></div><div class="art__title">ZŁOTY<br>FARAON</div>',
  s3: '<div class="art__crystals"><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div><div class="art__sparkles"><i></i><i></i><i></i><i></i></div><div class="art__title">KRYSZTAŁOWA<br>KASKADA</div>',
};

const el = {
  topbar: $('#topbar'),
  loginBtn: $('#btn-zaloguj'),
  userBox: $('#topbar-gracz'),
  pill: $('#saldo'),
  pillState: $('#saldo-stan'),
  hero: $('#start'),
  avatar: $('#awatar'),
  nick: $('#nick-gracza'),
  menuBtn: $('#btn-menu'),
  menu: $('#menu-gracza'),
  menuAvatar: $('#menu-awatar'),
  menuNick: $('#menu-nick'),
  menuBalance: $('#menu-saldo'),
  menuHistory: $('#menu-historia'),
  menuSound: $('#menu-dzwiek'),
  menuLogout: $('#menu-wyloguj'),
  ctaMain: $('#cta-glowne'),
  ctaSecond: $('#cta-drugie'),
  rescue: $('#ratunek'),
  rescueText: $('#ratunek-opis'),
  rescueBtn: $('#btn-ratunek'),
  heroTitle: $('#hero-tytul'),
  heroFx: $('#hero-fx'),
  medal: $('#medal'),
  tiles: $('#kafle'),
  dots: $('#kafle-kropki'),
  feed: $('#feed'),
  board: $('#ranking-lista'),
  tabs: [...document.querySelectorAll('[role="tab"][data-type]')],
  status: $('#status-serwera'),
  loginModal: $('#modal-logowanie'),
  loginLead: $('#logowanie-opis'),
  loginForm: $('#form-logowanie'),
  nickField: $('#pole-nick'),
  nickInput: $('#nick'),
  nickCounter: $('#nick-licznik'),
  nickError: $('#nick-blad'),
  loginSubmit: $('#btn-wejdz'),
  historyModal: $('#modal-historia'),
  historyList: $('#historia-lista'),
  fxCanvas: $('#fx'),
  pageBg: $('#tlo'),
};

let fx = null;          // cząsteczki na całym ekranie (monety, iskry)
let heroFx = null;      // pył w tle sekcji powitalnej
let counter = null;     // licznik salda w pigułce
let pendingGame = null; // gra, do której przejdziemy po zalogowaniu (kliknięty kafel)
let slots = [];
let videos = {};        // katalog filmików z assets/video/manifest.json
let rescueTimer = 0;
let loginTried = false; // walidacja „na żywo” dopiero po pierwszej próbie (nie krzyczymy przy pierwszej literze)
let currentBoard = 'biggest-win';

// --------------------------------------------------------------------------------------------- start strony

async function init() {
  fx = new FxLite(el.fxCanvas, { coinSrc: COIN_FALLBACK });
  // sfx_licznik_tik to PĘTLA (manifest: loop) — startuje raz na początku liczenia i gaśnie, gdy licznik stanie
  let tickLoop = null;
  counter = new BalanceCounter(el.pill, {
    onCountStart: () => { tickLoop = audio.play('sfx_licznik_tik'); },
    onCountEnd: () => { tickLoop?.stop(60); tickLoop = null; },
  });

  // Dźwięk: pierwszy dowolny gest odblokowuje kontekst audio i wczytuje pakiety „ui” i „lobby” (05 § 2.3–2.4),
  // żeby dźwięki okna logowania i bonusu powitalnego były gotowe, zanim będą potrzebne. Zalogowany gracz
  // (np. po powrocie z gry) słyszy wtedy muzykę lobby z wejściem 1,5 s.
  audio.unlockOnGesture(() => {
    audio.preloadPack('ui', 'lobby');
    if (store.loggedIn) audio.playMusic('mus_lobby', { fadeMs: 1500 });
  });

  bindTopbar();
  bindRewardTopbar();
  bindLogin();
  bindRescue();
  bindBoardTabs();
  store.on('player', renderPlayer);

  const manifestReady = assets.load().then(() => {
    assets.applyTo(document);
    applyAssetExtras();
    const coin = assets.get('g_moneta_przod');
    if (coin) fx.setCoinImage(coin.src2x ?? coin.src);
  });
  const videosReady = fetch(new URL('assets/video/manifest.json', document.baseURI), { cache: 'no-cache' })
    .then((r) => (r.ok ? r.json() : null))
    .then((data) => { videos = data?.videos ?? {}; })
    .catch(() => { videos = {}; });

  const sessionReady = restoreSession().catch((err) => {
    store.setPlayer(null, { reason: 'restore' });
    if (err.code === 'NETWORK_ERROR' || err.code === 'TIMEOUT') toast({ type: 'error', title: 'Brak połączenia', message: messageFor(err) });
  });

  const slotsReady = api.slots()
    .then((list) => { setServerStatus(true); return Array.isArray(list) && list.length ? list : FALLBACK_SLOTS; })
    .catch(() => { setServerStatus(false); return FALLBACK_SLOTS; });

  await manifestReady;
  setupHeroFx();
  requestAnimationFrame(() => document.body.classList.add('is-ready'));
  setupReveal();

  const [list] = await Promise.all([slotsReady, videosReady]);
  slots = list;
  renderTiles(slots);

  loadFeed();
  loadBoard(currentBoard);
  setInterval(() => {
    if (document.hidden) return;
    loadFeed(true);
    loadBoard(currentBoard, true);
  }, 45_000);

  await sessionReady;
  handleUrlIntent();
}

/** Dodatki zależne od manifestu: logo w sekcji powitalnej, maskotka, tło lobby. */
function applyAssetExtras() {
  if (assets.has('g_logo')) el.heroTitle.classList.add('has-logo');
  if (assets.has('g_maskotka_powitanie')) el.medal.classList.add('has-mascot');
  const portrait = matchMedia('(orientation: portrait)');
  const setBg = () => {
    const id = portrait.matches && assets.has('g_tlo_lobby_mobile') ? 'g_tlo_lobby_mobile' : 'g_tlo_lobby_desktop';
    const css = assets.cssImage(id);
    if (css) el.pageBg.style.setProperty('--page-bg-image', css);
  };
  setBg();
  portrait.addEventListener('change', setBg);
}

/** ?gra=<kod> w adresie: gracz chciał zagrać (np. wrócił ze strony gry bez sesji) → logowanie albo od razu gra. */
function handleUrlIntent() {
  const params = new URLSearchParams(location.search);
  const code = params.get('gra');
  if (!code || !slots.some((s) => s.code === code)) return;
  history.replaceState(null, '', location.pathname + location.hash);
  if (store.loggedIn) goToGame(code);
  else openLogin({ game: code });
}

// --------------------------------------------------------------------------------------------- pasek górny

function bindTopbar() {
  const onScroll = () => el.topbar.classList.toggle('is-scrolled', window.scrollY > 8);
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  el.loginBtn.addEventListener('click', () => openLogin());

  // menu gracza: otwieranie, zamykanie kliknięciem obok i klawiszem Esc, strzałki między pozycjami
  el.menuBtn.addEventListener('click', () => toggleMenu());
  document.addEventListener('click', (e) => {
    if (!el.menu.hidden && !e.target.closest('.user-menu')) toggleMenu(false);
  });
  // klawiatura w menu (wzorzec WAI-ARIA „menu button”): strzałki, Home/End, Esc wraca na przycisk,
  // Tab zamyka menu i przepuszcza fokus dalej (menu nie może zostać otwarte „za plecami” użytkownika)
  el.menu.addEventListener('keydown', (e) => {
    const items = [...el.menu.querySelectorAll('[role^="menuitem"]')];
    const i = items.indexOf(document.activeElement);
    if (e.key === 'Escape') {
      toggleMenu(false);
      el.menuBtn.focus();
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const next = (i + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
      items[next].focus();
    } else if (e.key === 'Home' || e.key === 'End') {
      e.preventDefault();
      items[e.key === 'Home' ? 0 : items.length - 1].focus();
    } else if (e.key === 'Tab') {
      toggleMenu(false);
    }
  });
  el.menuHistory.addEventListener('click', () => { toggleMenu(false); openHistory(); });
  el.menuLogout.addEventListener('click', async () => {
    toggleMenu(false);
    const nick = store.player?.nick;
    await logout().catch(() => {});
    audio.stopMusic();
    // przycisk „Wyloguj” właśnie zniknął razem z menu — fokus przenosimy na „Zaloguj” (nie gubimy go na <body>)
    el.loginBtn.focus({ preventScroll: true });
    toast({ type: 'info', title: 'Do zobaczenia!', message: nick ? `Wylogowano gracza ${nick}.` : 'Wylogowano.' });
  });

  const syncSound = () => {
    const on = !audio.isMuted();
    el.menuSound.setAttribute('aria-checked', String(on));
    el.menuSound.querySelector('use').setAttribute('href', `icons/ikony.svg#${on ? 'dzwiek_wl' : 'dzwiek_wyl'}`);
  };
  el.menuSound.addEventListener('click', () => {
    audio.unlock();
    audio.toggleMuted();
    audio.play('ui_przelacznik');
  });
  audio.onChange(syncSound);
  syncSound();
}

function toggleMenu(open = el.menu.hidden) {
  el.menu.hidden = !open;
  el.menuBtn.setAttribute('aria-expanded', String(open));
  if (open) {
    audio.play('ui_otworz');
    el.menu.querySelector('[role^="menuitem"]')?.focus();
  }
}

/** Reakcja na zmianę gracza (zalogowanie, wylogowanie, odświeżenie danych). */
function renderPlayer({ player, prev, reason }) {
  // klasa na pasku (a nie na <body>): zmiana przelicza style tylko paska, nie całej strony
  el.topbar.classList.toggle('is-logged-in', Boolean(player));
  el.loginBtn.hidden = Boolean(player);
  el.userBox.hidden = !player;

  if (!player) {
    toggleMenu(false);
    el.rescue.hidden = true;
    el.hero.classList.remove('is-bankrupt');
    stopRescueCountdown();
    setHeroCta(false);
    markMeInBoard();
    return;
  }

  if (!prev || prev.nick !== player.nick) {
    updateAvatar(el.avatar, player);
    updateAvatar(el.menuAvatar, player);
    el.nick.textContent = player.nick;
    el.menuNick.textContent = player.nick;
  }
  el.menuBalance.textContent = `Saldo: ${formatCebuliony(player.balance)}`;
  const bankrupt = isBankrupt(player);
  el.pill.classList.toggle('is-bankrupt', bankrupt);
  el.pillState.textContent = bankrupt ? ' — za mało na najmniejszy zakład' : '';

  // przy logowaniu z bonusem i przy ratunku saldo „dolicza” sekwencja nagrody — startujemy od stanu sprzed bonusu
  if (reason === 'login' || reason === 'rescue') counter.set(player.balance - (pendingBonus ?? 0), { animate: false });
  else if (reason === 'restore' || !prev) counter.set(player.balance, { animate: false });
  else counter.set(player.balance);

  setHeroCta(true);
  renderRescue(player);
  markMeInBoard();
}

/** Przyciski w sekcji powitalnej zależą od tego, czy ktoś jest zalogowany. */
function setHeroCta(loggedIn) {
  const label = el.ctaMain.querySelector('span');
  el.ctaMain.querySelector('use').setAttribute('href', `icons/ikony.svg#${loggedIn ? 'graj' : 'prezent'}`);
  label.textContent = loggedIn ? 'Graj teraz' : 'Odbierz 10 000 na start';
  el.ctaSecond.textContent = loggedIn ? 'Historia gry' : 'Zobacz automaty';
  el.ctaSecond.setAttribute('href', loggedIn ? '#historia' : '#automaty');
}

// --------------------------------------------------------------------------------------------- logowanie

let pendingBonus = null; // kwota bonusu, którą doliczy animacja (żeby renderPlayer nie pokazał jej od razu)

function bindLogin() {
  el.ctaMain.addEventListener('click', () => {
    if (store.loggedIn) document.getElementById('automaty').scrollIntoView({ behavior: reducedMotion.matches ? 'auto' : 'smooth' });
    else openLogin();
  });
  el.ctaSecond.addEventListener('click', (e) => {
    if (!store.loggedIn) return;
    e.preventDefault();
    openHistory();
  });

  el.nickInput.addEventListener('input', () => {
    el.nickCounter.textContent = `${[...el.nickInput.value].length}/${NICK_MAX}`;
    if (loginTried) {
      const result = validateNick(el.nickInput.value);
      showLoginError(result.ok ? '' : result.message, false);
    }
  });
  el.loginForm.addEventListener('submit', submitLogin);
}

/**
 * Otwiera okno logowania (E04).
 * @param {{game?: string}} options kod gry, jeśli logowanie wywołał kafel — po sukcesie przejdziemy do gry
 */
function openLogin({ game } = {}) {
  audio.unlock();                 // pierwszy gest użytkownika odblokowuje dźwięk (polityka autoplay przeglądarek)
  pendingGame = game ?? null;
  const slot = slots.find((s) => s.code === game);
  el.loginLead.replaceChildren();
  if (slot) {
    el.loginLead.append('Zaloguj się, aby zagrać w ', Object.assign(document.createElement('b'), { textContent: slot.name }), '. Pierwsze wejście to 10 000 cebulionów na start.');
  } else {
    el.loginLead.append('Wpisz nazwę gracza. Pierwsze wejście to ', Object.assign(document.createElement('b'), { textContent: '10 000 cebulionów' }), ' na start.');
  }
  loginTried = false;
  showLoginError('', false);
  el.nickCounter.textContent = `${[...el.nickInput.value].length}/${NICK_MAX}`;
  openModal(el.loginModal, {
    initialFocus: el.nickInput,
    onClose: (reason) => {
      if (reason !== 'success') pendingGame = null;
      audio.play('ui_zamknij');
    },
  });
  audio.play('ui_otworz');
}

function showLoginError(message, shake = true) {
  el.nickError.textContent = message;
  el.nickField.classList.toggle('is-invalid', Boolean(message));
  el.nickInput.setAttribute('aria-invalid', String(Boolean(message)));
  if (message && shake && !reducedMotion.matches) {
    el.nickField.classList.remove('shake');
    void el.nickField.offsetWidth;
    el.nickField.classList.add('shake');
  }
}

/**
 * Po zamknięciu okna / sekwencji nagrody element, który miał fokus, często już nie istnieje albo jest ukryty
 * („Zaloguj” znika po zalogowaniu, przycisk bonusu ratunkowego — po jego odebraniu). Wtedy fokus spada na <body>
 * i użytkownik klawiatury zaczyna od początku strony. Ta funkcja przenosi go na sensowny następny element.
 */
function ensureFocus(target) {
  const active = document.activeElement;
  const lost = !active || active === document.body || active.closest('[hidden]') || !active.getClientRects().length;
  if (lost && target && !target.closest('[hidden]')) target.focus({ preventScroll: true });
}

function setLoading(button, loading) {
  button.classList.toggle('is-loading', loading);
  button.setAttribute('aria-busy', String(loading));
  if (loading && !button.querySelector('.spinner')) {
    const spinner = document.createElement('span');
    spinner.className = 'spinner';
    spinner.setAttribute('aria-hidden', 'true');
    button.append(spinner);
  }
}

async function submitLogin(event) {
  event.preventDefault();
  audio.unlock();
  loginTried = true;
  const result = validateNick(el.nickInput.value);
  if (!result.ok) {
    showLoginError(result.message);             // E05 login_blad
    audio.play('ui_blad');
    el.nickInput.focus();
    return;
  }
  if (el.loginSubmit.classList.contains('is-loading')) return;
  setLoading(el.loginSubmit, true);
  el.loginModal.dataset.locked = 'true';        // w trakcie żądania okna nie zamykamy (Esc, tło)
  try {
    const res = await login(result.nick);
    const game = pendingGame;
    el.loginModal.dataset.locked = 'false';
    closeModal(el.loginModal, 'success');
    el.nickInput.value = '';
    audio.play('sfx_logowanie');
    audio.playMusic('mus_lobby');

    // zamknięcie okna zdejmuje `inert` z całej strony (przeliczenie stylów) — niech to zajmie osobną klatkę,
    // zanim wystartuje animacja bonusu; inaczej koszty się sumują i początek sekwencji by się zaciął
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

    const bonus = res.newPlayer ? Number(res.welcomeBonus) || 0 : 0;
    pendingBonus = bonus;
    store.setPlayer(res.player, { reason: 'login' });
    pendingBonus = null;

    if (bonus > 0) {
      // E07 bonus_powitalny
      await playReward({
        amount: bonus,
        from: res.player.balance - bonus,
        to: res.player.balance,
        eyebrow: 'Na dobry początek',
        sub: 'cebulionów na start od Pana Cebuliona. Graj bez ryzyka!',
        fx, counter, target: el.pill,
      });
      toast({ type: 'bonus', title: `Witaj, ${res.player.nick}!`, message: `Na dobry początek: ${formatCebuliony(bonus)}.` });
    } else {
      // E06 login_sukces (powracający gracz)
      const c = el.pill.getBoundingClientRect();
      fx.burst({ x: c.left + c.width / 2, y: c.top + c.height / 2, count: 18, speed: 300, size: 16 });
      counter.pulse();
      toast({ type: 'success', title: `Witaj ponownie, ${res.player.nick}!`, message: `Twoje saldo: ${formatCebuliony(res.player.balance)}.` });
    }
    ensureFocus(el.menuBtn); // „Zaloguj” zniknął — fokus na menu gracza w tym samym miejscu paska
    if (game) setTimeout(() => goToGame(game), bonus > 0 ? 700 : 900);
  } catch (err) {
    el.loginModal.dataset.locked = 'false';
    showLoginError(messageFor(err));
    audio.play('ui_blad');
    el.nickInput.focus();
  } finally {
    setLoading(el.loginSubmit, false);
  }
}

// --------------------------------------------------------------------------------------------- bankructwo i bonus ratunkowy

function bindRescue() {
  el.rescueBtn.addEventListener('click', claimRescue);
}

/** Panel bankructwa (E09): widoczny, gdy saldo < minimalny zakład. */
function renderRescue(player) {
  const bankrupt = isBankrupt(player);
  el.rescue.hidden = !bankrupt;
  el.hero.classList.toggle('is-bankrupt', bankrupt); // CSS chowa wtedy „Graj teraz / Historia gry”
  if (!bankrupt) {
    stopRescueCountdown();
    return;
  }
  if (player.canRescue) {
    stopRescueCountdown();
    setRescueReady(true);
  } else {
    startRescueCountdown(player.rescueAvailableInSeconds || 0);
  }
}

function setRescueReady(ready, secondsLeft = 0) {
  el.rescueBtn.disabled = !ready;
  el.rescue.classList.toggle('is-ready', ready);   // pulsująca poświata wokół przycisku (lobby.css)
  el.rescueBtn.querySelector('span').textContent = ready ? 'Odbierz 10 000 cebulionów' : `Dostępny za ${formatCountdown(secondsLeft)}`;
  el.rescueText.textContent = ready
    ? 'Pan Cebulion stawia: 10 000 cebulionów na koszt firmy.'
    : 'Bonus ratunkowy przysługuje raz na 10 minut. Pan Cebulion już szuka drobnych.';
}

function startRescueCountdown(seconds) {
  stopRescueCountdown();
  const deadline = Date.now() + seconds * 1000;
  const tick = () => {
    const left = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
    setRescueReady(false, left);
    if (left <= 0) {
      stopRescueCountdown();
      api.me().then((p) => store.setPlayer(p, { reason: 'sync' })).catch(() => setRescueReady(true));
    }
  };
  tick();
  rescueTimer = setInterval(tick, 1000);
}

function stopRescueCountdown() {
  clearInterval(rescueTimer);
  rescueTimer = 0;
}

async function claimRescue() {
  audio.unlock();
  setLoading(el.rescueBtn, true);
  try {
    const res = await api.rescue();
    const amount = Number(res.amount) || 0;
    pendingBonus = amount;
    store.setPlayer(res.player, { reason: 'rescue' });
    pendingBonus = null;
    await playReward({
      amount,
      from: res.player.balance - amount,
      to: res.player.balance,
      eyebrow: 'Na koszt firmy',
      sub: 'cebulionów od Pana Cebuliona. Kieszenie znów pełne!',
      fx, counter, target: el.pill,
      artId: assets.has('g_maskotka_wygrana') ? 'g_maskotka_wygrana' : 'g_skrzynia',
    });
    toast({ type: 'bonus', title: 'Proszę bardzo!', message: `${formatCebuliony(amount)} na koszt firmy.` });
    ensureFocus(el.ctaMain); // panel bonusu zniknął, wracają przyciski „Graj teraz / Historia gry”
  } catch (err) {
    if (err.code === 'NOT_LOGGED_IN') {
      sessionLost();
      openLogin();
    } else if (err.code === 'RESCUE_NOT_AVAILABLE' && err.retryAfterSeconds) {
      startRescueCountdown(err.retryAfterSeconds);
      toast({ type: 'info', title: 'Jeszcze chwila', message: messageFor(err) });
    } else {
      toast({ type: 'error', title: 'Nie udało się odebrać bonusu', message: messageFor(err) });
    }
  } finally {
    setLoading(el.rescueBtn, false);
  }
}

// --------------------------------------------------------------------------------------------- kafle gier

function plural(n, one, few, many) {
  if (n === 1) return one;
  const last = n % 10;
  const lastTwo = n % 100;
  return last >= 2 && last <= 4 && (lastTwo < 12 || lastTwo > 14) ? few : many;
}

function renderTiles(list) {
  el.tiles.replaceChildren(...list.map(buildTile));
  el.tiles.setAttribute('aria-busy', 'false');
  const tiles = [...el.tiles.querySelectorAll('.tile')];
  el.dots.replaceChildren(...tiles.map((tile) => {
    // kropka = skrót dla myszy/dotyku: przewija karuzelę tak, żeby kafel stanął na środku
    const dot = document.createElement('i');
    dot.addEventListener('click', () => {
      const box = el.tiles.getBoundingClientRect();
      const r = tile.getBoundingClientRect();
      el.tiles.scrollTo({
        left: el.tiles.scrollLeft + (r.left - box.left) - (box.width - r.width) / 2,
        behavior: reducedMotion.matches ? 'auto' : 'smooth',
      });
    });
    return dot;
  }));
  tiles.forEach((tile, i) => {
    tile.style.setProperty('--i', String(i));
    if (revealObserver) revealObserver.observe(tile);
    else tile.classList.add('is-visible');
  });
  setupTileVisibility(tiles);
}

/** Buduje kafel gry: link do gra.html?gra=<kod> z okładką albo grafiką zastępczą. */
function buildTile(slot, index) {
  const meta = GAME_META[slot.code] ?? { theme: ['s1', 's2', 's3'][index % 3], badge: '' };
  const tile = document.createElement('a');
  tile.className = `tile tile--${meta.theme}`;
  tile.href = `gra.html?gra=${encodeURIComponent(slot.code)}`;
  tile.dataset.code = slot.code;
  tile.setAttribute('data-reveal', '');

  const media = document.createElement('div');
  media.className = 'tile__media';
  const fallbackArt = () => {
    const art = document.createElement('div');
    art.className = `art art--${meta.theme}`;
    art.setAttribute('aria-hidden', 'true');
    art.innerHTML = ART_HTML[meta.theme]; // stała grafika z kodu, bez danych z zewnątrz
    return art;
  };
  const cover = assets.createImg(meta.cover, { alt: '', className: 'tile__cover', sizes: '(max-width: 900px) 78vw, 33vw' });
  if (cover) {
    // okładka jest w manifeście, ale plik się nie wczytał (404, uszkodzony WebP) → grafika zastępcza z CSS
    cover.addEventListener('error', () => cover.replaceWith(fallbackArt()), { once: true });
    media.append(cover);
  } else {
    media.append(fallbackArt());
  }
  attachVideo(tile, media, slot.code, cover);
  media.append(Object.assign(document.createElement('div'), { className: 'tile__shade' }));
  media.append(Object.assign(document.createElement('div'), { className: 'tile__shine' }));

  const top = document.createElement('div');
  top.className = 'tile__top';
  if (meta.badge) top.append(Object.assign(document.createElement('span'), { className: 'chip chip--gold', textContent: meta.badge }));
  top.append(Object.assign(document.createElement('span'), { className: 'chip num', textContent: `RTP ${String(slot.targetRtp).replace('.', ',')}%` }));

  const body = document.createElement('div');
  body.className = 'tile__body';
  const title = Object.assign(document.createElement('h3'), { className: 'tile__title', textContent: slot.name });
  const specs = document.createElement('p');
  specs.className = 'tile__meta';
  const parts = [
    `${slot.reels}×${slot.rows}`,
    slot.lines ? `${slot.lines} ${plural(slot.lines, 'linia', 'linie', 'linii')}` : 'wygrane klastrowe',
    `zakład od ${formatAmount(slot.minBet)}`,
  ];
  parts.forEach((p) => specs.append(Object.assign(document.createElement('span'), { textContent: p })));

  const foot = document.createElement('div');
  foot.className = 'tile__foot';
  const [bars, volLabel] = VOLATILITY[slot.volatility] ?? [2, 'średnia'];
  const vol = document.createElement('span');
  vol.className = 'tile__vol';
  const barsEl = document.createElement('span');
  barsEl.className = 'tile__vol-bars';
  barsEl.setAttribute('aria-hidden', 'true');
  for (let i = 1; i <= 3; i++) barsEl.append(Object.assign(document.createElement('i'), { className: i <= bars ? 'is-on' : '' }));
  vol.append(barsEl, Object.assign(document.createElement('span'), { className: 'tile__vol-label', textContent: 'Zmienność' }),
    Object.assign(document.createElement('span'), { className: 'sr-only', textContent: `: ${volLabel}` }));
  const play = document.createElement('span');
  play.className = 'btn btn--primary btn--sm tile__play';
  play.append(icon('graj'), Object.assign(document.createElement('span'), { textContent: 'Graj' }));
  foot.append(vol, play);
  body.append(title, specs, foot);

  tile.append(media, top, body, Object.assign(document.createElement('div'), { className: 'tile__frame' }));
  bindTile(tile, slot);
  return tile;
}

/** Kliknięcie kafla: bez sesji → logowanie; z sesją → płynne przejście do gry. Pochylenie 3D za kursorem. */
function bindTile(tile, slot) {
  tile.addEventListener('click', (e) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return; // nowa karta: zostawiamy przeglądarce
    e.preventDefault();
    audio.unlock();
    audio.play('ui_klik');
    if (!store.loggedIn) openLogin({ game: slot.code });
    else goToGame(slot.code);
  });

  if (!finePointer.matches || reducedMotion.matches) return;
  let frame = 0;
  let px = 0.5;
  let py = 0.5;
  const apply = () => {
    frame = 0;
    tile.style.setProperty('--rx', `${((0.5 - py) * 7).toFixed(2)}deg`);
    tile.style.setProperty('--ry', `${((px - 0.5) * 9).toFixed(2)}deg`);
    tile.style.setProperty('--mx', `${(px * 100).toFixed(1)}%`);
    tile.style.setProperty('--my', `${(py * 100).toFixed(1)}%`);
  };
  tile.addEventListener('pointerenter', (e) => {
    if (e.pointerType !== 'mouse') return;
    tile.style.transitionDuration = '160ms';
    audio.play('ui_hover');
    playVideo(tile);
  });
  tile.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    const r = tile.getBoundingClientRect();
    px = (e.clientX - r.left) / r.width;
    py = (e.clientY - r.top) / r.height;
    frame ||= requestAnimationFrame(apply);
  });
  tile.addEventListener('pointerleave', () => {
    cancelAnimationFrame(frame);
    frame = 0;
    tile.style.transitionDuration = '';
    for (const prop of ['--rx', '--ry', '--mx', '--my']) tile.style.removeProperty(prop);
    pauseVideo(tile);
  });
  tile.addEventListener('focus', () => playVideo(tile));
  tile.addEventListener('blur', () => pauseVideo(tile));
}

/**
 * Filmik z rozgrywki (plan § 7): tylko gdy jest wpisany w assets/video/manifest.json (brak pliku = brak 404).
 * muted + playsinline pozwalają na autoodtwarzanie na telefonach; preload="none" — nic nie pobieramy przed startem.
 */
function attachVideo(tile, media, code, cover) {
  const entry = videos[code];
  const saveData = navigator.connection?.saveData || /(^|-)2g$/.test(navigator.connection?.effectiveType ?? '');
  if (!entry || reducedMotion.matches || saveData) return;
  const base = new URL('assets/video/', document.baseURI);
  const video = document.createElement('video');
  video.className = 'tile__video';
  video.muted = true;
  video.loop = true;
  video.playsInline = true;
  video.preload = 'none';
  video.setAttribute('muted', '');
  video.setAttribute('playsinline', '');
  video.setAttribute('aria-hidden', 'true');
  video.disablePictureInPicture = true;
  if (entry.poster) video.poster = new URL(entry.poster, base).href;
  else if (cover) video.poster = cover.currentSrc || cover.src;
  for (const [key, type] of [['webm', 'video/webm'], ['mp4', 'video/mp4']]) {
    if (!entry[key]) continue;
    const source = document.createElement('source');
    source.src = new URL(entry[key], base).href;
    source.type = type;
    video.append(source);
  }
  video.addEventListener('error', () => video.remove(), true);
  media.append(video);
}

function playVideo(tile) {
  const video = tile.querySelector('video');
  if (!video) return;
  video.play().then(() => tile.classList.add('is-playing')).catch(() => {});
}

function pauseVideo(tile) {
  const video = tile.querySelector('video');
  tile.classList.remove('is-playing');
  video?.pause();
}

/**
 * Widoczność kafli (IntersectionObserver):
 *   * kropki karuzeli na telefonie,
 *   * na urządzeniach dotykowych gra maksymalnie JEDEN filmik naraz — z kafla najbardziej widocznego.
 */
function setupTileVisibility(tiles) {
  const ratios = new Map();
  const dots = [...el.dots.children];
  const io = new IntersectionObserver((entries) => {
    for (const entry of entries) ratios.set(entry.target, entry.intersectionRatio);
    let best = null;
    let bestRatio = 0;
    for (const [tile, ratio] of ratios) {
      if (ratio > bestRatio) {
        best = tile;
        bestRatio = ratio;
      }
    }
    tiles.forEach((tile, i) => dots[i]?.classList.toggle('is-active', tile === best));
    if (finePointer.matches) return; // na komputerze filmik startuje po najechaniu
    for (const tile of tiles) {
      if (tile === best && bestRatio >= 0.6) playVideo(tile);
      else pauseVideo(tile);
    }
  }, { threshold: [0, 0.25, 0.6, 0.9, 1] });
  tiles.forEach((tile) => io.observe(tile));

  // Ukryta karta: zatrzymujemy filmy (dekodowanie wideo w tle zjada baterię). Po powrocie na telefonie
  // wznawiamy film najbardziej widocznego kafla; na komputerze film i tak startuje dopiero po najechaniu.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      tiles.forEach(pauseVideo);
      return;
    }
    if (finePointer.matches) return;
    let best = null;
    let bestRatio = 0;
    for (const [tile, ratio] of ratios) if (ratio > bestRatio) [best, bestRatio] = [tile, ratio];
    if (best && bestRatio >= 0.6) playVideo(best);
  });
}

/** Przejście lobby → gra (E12): zasłona + dźwięk „whoosh”, potem zmiana strony. */
function goToGame(code) {
  audio.play('sfx_przejscie_whoosh');
  const url = `gra.html?gra=${encodeURIComponent(code)}`;
  if (reducedMotion.matches) {
    location.href = url;
    return;
  }
  document.body.classList.add('is-leaving');
  setTimeout(() => { location.href = url; }, 300);
}

// Powrót przyciskiem „Wstecz” z gry: przeglądarka może przywrócić stronę z pamięci (bfcache) razem z zasłoną.
window.addEventListener('pageshow', (e) => {
  if (e.persisted) document.body.classList.remove('is-leaving');
});

// --------------------------------------------------------------------------------------------- feed i ranking

function emptyState(title, text) {
  const box = document.createElement('div');
  box.className = 'empty-state';
  const img = new Image();
  img.src = EMBLEM_FALLBACK;
  img.alt = '';
  box.append(img,
    Object.assign(document.createElement('p'), { className: 'empty-state__title', textContent: title }),
    Object.assign(document.createElement('p'), { className: 'empty-state__text', textContent: text }));
  return box;
}

function errorState(text, retry) {
  const box = emptyState('Nie udało się wczytać danych', text);
  const btn = Object.assign(document.createElement('button'), { type: 'button', className: 'btn btn--secondary btn--sm', textContent: 'Spróbuj ponownie' });
  btn.addEventListener('click', retry);
  box.append(btn);
  return box;
}

const gameName = (code) => slots.find((s) => s.code === code)?.name ?? FALLBACK_SLOTS.find((s) => s.code === code)?.name ?? '';

async function loadFeed(silent = false) {
  try {
    const items = await api.bigWins(8);
    renderFeed(Array.isArray(items) ? items : []);
  } catch (err) {
    if (!silent) el.feed.replaceChildren(wrapLi(errorState(messageFor(err), () => loadFeed())));
  } finally {
    el.feed.setAttribute('aria-busy', 'false');
  }
}

function wrapLi(node) {
  const li = document.createElement('li');
  li.style.gridColumn = '1 / -1';
  li.append(node);
  return li;
}

function tierBadge(tier, multiplier) {
  const badge = document.createElement('span');
  badge.className = `tier tier--${TIER_LABEL[tier] ? tier : 'big'}`;
  badge.append(Object.assign(document.createElement('span'), { textContent: `${TIER_LABEL[tier] ?? 'Wygrana'} ${formatMultiplier(multiplier)}` }));
  return badge;
}

function renderFeed(items) {
  if (!items.length) {
    el.feed.replaceChildren(wrapLi(emptyState('Jeszcze nikt nie rozbił banku', 'Duża wygrana to co najmniej 15× zakładu. Może to Ty będziesz pierwszy?')));
    return;
  }
  el.feed.replaceChildren(...items.slice(0, 8).map((w, i) => {
    const li = document.createElement('li');
    li.className = `win win--${TIER_LABEL[w.tier] ? w.tier : 'big'}`;
    li.style.setProperty('--i', String(i));
    const who = document.createElement('div');
    who.className = 'win__who';
    who.append(
      Object.assign(document.createElement('span'), { className: 'win__nick', textContent: w.nick }),
      Object.assign(document.createElement('span'), { className: 'win__where', textContent: `${w.gameName || gameName(w.gameCode)} · ${formatRelative(w.at)}` }),
    );
    const right = document.createElement('div');
    right.className = 'win__right';
    const amount = document.createElement('span');
    amount.className = 'win__amount num';
    amount.append(coinImg('coin'), formatAmount(w.win));
    right.append(amount, tierBadge(w.tier, w.multiplier));
    li.append(createAvatar({ nick: w.nick, avatarIndex: w.avatarIndex }), who, right);
    return li;
  }));
}

function bindBoardTabs() {
  el.tabs.forEach((tab, i) => {
    tab.addEventListener('click', () => selectBoard(tab));
    // wzorzec WAI-ARIA „tabs”: strzałki w lewo/prawo oraz Home/End przełączają zakładki
    tab.addEventListener('keydown', (e) => {
      const n = el.tabs.length;
      const index = { ArrowRight: (i + 1) % n, ArrowLeft: (i - 1 + n) % n, Home: 0, End: n - 1 }[e.key];
      if (index === undefined) return;
      e.preventDefault();
      const next = el.tabs[index];
      next.focus();
      if (next !== tab) selectBoard(next);
    });
  });
}

function selectBoard(tab) {
  el.tabs.forEach((t) => {
    const on = t === tab;
    t.setAttribute('aria-selected', String(on));
    t.tabIndex = on ? 0 : -1;
  });
  el.board.setAttribute('aria-labelledby', tab.id);
  currentBoard = tab.dataset.type;
  audio.play('ui_klik');
  loadBoard(currentBoard);
}

async function loadBoard(type, silent = false) {
  try {
    const rows = await api.leaderboard(type, 10);
    if (type !== currentBoard) return;
    renderBoard(Array.isArray(rows) ? rows : [], type);
  } catch (err) {
    if (!silent) el.board.replaceChildren(wrapLi(errorState(messageFor(err), () => loadBoard(type))));
  } finally {
    el.board.setAttribute('aria-busy', 'false');
  }
}

function renderBoard(rows, type) {
  if (!rows.length) {
    el.board.replaceChildren(wrapLi(emptyState('Ranking czeka na pierwszych graczy', 'Zagraj, a Twoje wygrane pojawią się tutaj.')));
    return;
  }
  el.board.replaceChildren(...rows.map((r, i) => {
    const li = document.createElement('li');
    li.className = 'rank';
    li.dataset.nick = r.nick.toLowerCase();
    li.style.setProperty('--i', String(i));
    const pos = Object.assign(document.createElement('span'), { className: 'rank__pos num', textContent: String(r.rank ?? i + 1) });
    const who = document.createElement('div');
    who.className = 'rank__who';
    const sub = type === 'balance' ? 'saldo' : [gameName(r.gameCode), formatRelative(r.at)].filter(Boolean).join(' · ');
    who.append(
      Object.assign(document.createElement('span'), { className: 'rank__nick', textContent: r.nick }),
      Object.assign(document.createElement('span'), { className: 'rank__sub', textContent: sub }),
    );
    const value = document.createElement('span');
    value.className = 'rank__value num';
    value.append(coinImg('coin'), formatAmount(r.value));
    li.append(pos, createAvatar({ nick: r.nick, avatarIndex: r.avatarIndex, size: 'sm' }), who, value);
    return li;
  }));
  markMeInBoard();
}

/** Wyróżnia w rankingu wiersz zalogowanego gracza („· Ty”). */
function markMeInBoard() {
  const me = store.player?.nick?.toLowerCase();
  for (const row of el.board.querySelectorAll('.rank')) row.classList.toggle('is-me', Boolean(me) && row.dataset.nick === me);
}

// --------------------------------------------------------------------------------------------- historia gry

let historyPage = 0;

function openHistory() {
  if (!store.loggedIn) return openLogin();
  historyPage = 0;
  el.historyList.replaceChildren(...Array.from({ length: 4 }, () => Object.assign(document.createElement('div'), { className: 'skeleton skeleton-row' })));
  openModal(el.historyModal, { onClose: () => audio.play('ui_zamknij') });
  audio.play('ui_otworz');
  loadHistory();
}

async function loadHistory(append = false) {
  try {
    const page = await api.history(historyPage, 20);
    const items = page?.items ?? [];
    if (!append) el.historyList.replaceChildren();
    el.historyList.querySelector('.history__more')?.remove();
    if (!items.length && !append) {
      el.historyList.append(emptyState('Nie masz jeszcze żadnych rund', 'Wybierz automat i zakręć — każda runda pojawi się tutaj.'));
      return;
    }
    for (const round of items) el.historyList.append(historyRow(round));
    if (page.page + 1 < page.totalPages) {
      const more = Object.assign(document.createElement('button'), { type: 'button', className: 'btn btn--secondary btn--sm history__more', textContent: 'Pokaż starsze' });
      more.addEventListener('click', () => { historyPage++; loadHistory(true); });
      el.historyList.append(more);
    }
  } catch (err) {
    if (err.code === 'NOT_LOGGED_IN') {
      closeModal(el.historyModal);
      sessionLost();
      return;
    }
    el.historyList.replaceChildren(errorState(messageFor(err), () => loadHistory()));
  }
}

function historyRow(round) {
  const row = document.createElement('div');
  row.className = 'history__row';
  const left = document.createElement('div');
  left.append(
    Object.assign(document.createElement('p'), { className: 'history__game', textContent: round.gameName || gameName(round.gameCode) }),
    Object.assign(document.createElement('p'), { className: 'history__date', textContent: formatDateTime(round.createdAt) }),
  );
  const nums = document.createElement('div');
  nums.className = 'history__nums num';
  const win = Number(round.win) || 0;
  // FAILED (kontrakt: cykl życia rundy) = zakład nie został rozliczony — pokazujemy to wprost, a nie „brak wygranej”
  const failed = round.status === 'FAILED';
  nums.append(
    Object.assign(document.createElement('span'), { className: 'history__bet', textContent: `zakład ${formatAmount(round.bet)}` }),
    Object.assign(document.createElement('span'), {
      className: `history__win${win > 0 && !failed ? ' is-plus' : ''}`,
      textContent: failed ? 'runda anulowana' : win > 0 ? formatSigned(win) : 'brak wygranej',
    }),
  );
  // odznaka tylko dla wyraźnych wygranych (≥ 5×); serwer zwraca też 'none' i 'small' — tych nie wyróżniamy
  if (!failed && TIER_LABEL[round.tier] && round.tier !== 'small') nums.append(tierBadge(round.tier, round.multiplier));
  row.append(left, nums);
  return row;
}

// --------------------------------------------------------------------------------------------- tło, wejścia, status

let revealObserver = null;

/** Elementy [data-reveal] pojawiają się płynnie, gdy wjadą na ekran. */
function setupReveal() {
  const items = document.querySelectorAll('[data-reveal]');
  if (reducedMotion.matches || !('IntersectionObserver' in window)) {
    items.forEach((item) => item.classList.add('is-visible'));
    return;
  }
  revealObserver = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      entry.target.classList.add('is-visible');
      revealObserver.unobserve(entry.target);
    }
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
  items.forEach((item) => revealObserver.observe(item));
}

/** Pył i bokeh w sekcji powitalnej (E02) — działa tylko, gdy sekcja jest na ekranie. */
function setupHeroFx() {
  if (reducedMotion.matches) return;
  heroFx = new FxLite(el.heroFx, { maxParticles: 64, maxDpr: 1.5 });
  heroFx.ambient(40, 12);
  let visible = true;
  let rewardPlaying = false;
  const sync = () => heroFx.setActive(visible && !rewardPlaying);
  new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; sync(); }).observe(el.heroFx);
  // pod zasłoną sekwencji nagrody pyłu i tak nie widać — oszczędzamy klatki dla monet
  document.addEventListener('reward:start', () => { rewardPlaying = true; sync(); });
  document.addEventListener('reward:end', () => { rewardPlaying = false; sync(); });
}

/** Pasek górny bez rozmycia tła na czas sekwencji nagrody (pod nim obracają się promienie). */
function bindRewardTopbar() {
  document.addEventListener('reward:start', () => el.topbar.classList.add('is-reward'));
  document.addEventListener('reward:end', () => el.topbar.classList.remove('is-reward'));
}

function setServerStatus(ok) {
  el.status.classList.toggle('is-ok', ok);
  el.status.classList.toggle('is-down', !ok);
  el.status.lastElementChild.textContent = ok ? 'Serwer gry działa' : 'Brak połączenia z serwerem gry';
}

init().catch((err) => {
  // ostatnia linia obrony: strona ma się pokazać nawet przy nieoczekiwanym błędzie
  document.body.classList.add('is-ready');
  document.querySelectorAll('[data-reveal]').forEach((item) => item.classList.add('is-visible'));
  toast({ type: 'error', title: 'Coś poszło nie tak', message: messageFor(err) });
});
