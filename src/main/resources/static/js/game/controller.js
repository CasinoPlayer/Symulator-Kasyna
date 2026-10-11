/**
 * game/controller.js — panel sterowania (HTML nad płótnem) i przebieg rundy.
 *
 * Stany: 'intro' → 'ready' → 'spinning' (bębny kręcą się, czekamy na serwer) → 'presenting' (odgrywanie kroków) → 'ready'.
 * Zasady (do obrony):
 *   * SPIN rusza bębny w TEJ SAMEJ klatce (E24) — żądanie POST /api/slots/{code}/spins idzie równolegle,
 *     z nowym `Idempotency-Key` (crypto.randomUUID()) na każde kliknięcie,
 *   * saldo: przy starcie spinu od razu odejmujemy zakład (gracz widzi, ile postawił), a wartość z serwera
 *     (`balanceAfter`) księgujemy w chwili zakończenia liczenia wygranej (E28/E29) albo przylotu licznika Big Win
 *     do panelu (E32) — liczba w pasku zgadza się z tym, co widać na ekranie (04 § 5.5),
 *   * ten sam przycisk: SPIN → STOP (szybkie zatrzymanie) → przewinięcie prezentacji; Spacja działa tak samo,
 *     dotknięcie sceny przewija Big Win (skip),
 *   * błędy: INSUFFICIENT_FUNDS → okno z bonusem ratunkowym (gdy dostępny), błąd sieci → toast, bębny łagodnie
 *     stają na planszy sprzed spinu (nie wymyślamy wyniku — E40) i gra wraca do gotowości.
 */

import { api, messageFor, newIdempotencyKey } from '../api.js';
import { store } from '../store.js';
import { sessionLost } from '../session.js';
import { audio } from '../audio/audio-engine.js';
import { BalanceCounter } from '../ui/balance.js';
import { openModal, closeModal, isModalOpen } from '../ui/modal.js';
import { toast } from '../ui/toast.js';
import { formatAmount } from '../format.js';

const $ = (s) => document.querySelector(s);
const storage = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* tryb prywatny */ } },
};

/** Wzorce wibracji z 04 § 1.6. */
const HAPTICS = {
  H_tik: [8], H_lekki: [14], H_sredni: [24], H_mocny: [40], H_podwojny: [20, 60, 30], H_serce: [28, 110, 16],
  H_fanfara: [30, 40, 30, 40, 70], H_eskalacja: [50, 30, 90], H_blad: [25, 50, 25],
};

export class GameController {
  state = 'intro';
  responses = [];
  #autoplay = null;
  #pendingResolution = false;
  #lastHaptic = 0;
  #interacted = false;

  /**
   * @param {{code: string, slot: object, gameApp: object, game: object}} o
   */
  constructor({ code, slot, gameApp, game }) {
    this.code = code;
    this.slot = slot;
    this.gameApp = gameApp;
    this.game = game;
    this.el = {
      spin: $('#btn-spin'), spinCount: $('#spin-licznik'), auto: $('#btn-auto'), autoMenu: $('#auto-menu'), autoStart: $('#auto-start'),
      turbo: $('#btn-turbo'), minus: $('#bet-minus'), plus: $('#bet-plus'), bet: $('#bet-wartosc'), win: $('#wygrana'),
      panel: $('#panel'), stage: $('#scena'), lobby: $('#btn-lobby'), announce: $('#ogloszenia'), fs: $('#gra-fs'), skipHint: $('#gra-skip'),
      funds: $('#modal-srodki'), fundsText: $('#srodki-opis'), fundsNote: $('#srodki-uwaga'), rescue: $('#btn-ratunek-gra'), lower: $('#btn-zmniejsz'),
      settings: $('#modal-ustawienia'), settingsBtn: $('#btn-ustawienia'), qualityNote: $('#ust-jakosc-opis'), haptics: $('#ust-wibracje'),
    };
    this.counters = [$('#saldo'), $('#saldo-panel')].filter(Boolean).map((p) => new BalanceCounter(p));
    this.levels = slot.betLevels?.length ? slot.betLevels : [slot.minBet];
    const saved = Number(storage.get(`cebulion.zaklad.${code}`));
    this.betIndex = Math.max(0, this.levels.indexOf(saved));
    this.turbo = storage.get('cebulion.turbo') === '1';
    this.hapticsOn = storage.get('cebulion.haptyka') !== '0';
    this.balance = store.player?.balance ?? 0;
    this.counters.forEach((c) => c.set(this.balance, { animate: false }));
    this.#bind();
    this.#renderBet();
    this.#renderTurbo();
    this.#exposeForTests();
  }

  get bet() {
    return this.levels[this.betIndex];
  }

  get tempo() {
    return this.turbo ? 0.45 : 1;
  }

  /** Callbacki dla gry (BaseGame.ui). */
  uiCallbacks() {
    return {
      winField: (v) => { this.el.win.textContent = formatAmount(v); },
      book: () => this.#book(),
      dim: (on) => {
        this.el.panel.classList.toggle('is-dimmed', on);
        this.el.skipHint.hidden = !on;
      },
      panelTarget: () => {
        const c = this.gameApp.app.canvas.getBoundingClientRect();
        const r = this.el.win.getBoundingClientRect();
        if (!r.width) return null;
        return { x: r.left + r.width / 2 - c.left, y: r.top + r.height / 2 - c.top };
      },
      announce: (text) => { this.el.announce.textContent = text; },
      haptic: (id) => this.#haptic(id),
      freeSpins: (info) => {
        this.el.fs.hidden = !info;
        if (info) this.el.fs.textContent = info.left === 0 ? 'OSTATNI DARMOWY SPIN' : `DARMOWE SPINY: ${info.left ?? info.total}`;
      },
    };
  }

  // ------------------------------------------------------------------------------------------- start

  /** Po intro (E21): SPIN aktywny od 1000 ms intro (R7). */
  ready() {
    this.state = 'ready';
    this.el.panel.classList.add('is-in');
    this.#renderSpin();
    this.el.spin.focus({ preventScroll: true });
  }

  // ------------------------------------------------------------------------------------------- spin

  async spin() {
    if (this.state !== 'ready') return;
    if (this.balance < this.bet) {
      this.#stopAutoplay('brak środków');
      this.#showFunds();
      return;
    }
    this.state = 'spinning';
    const bet = this.bet;
    const key = newIdempotencyKey();       // crypto.randomUUID() — nowy na każde kliknięcie
    this.round = { bet, key, booked: false, before: this.balance };
    this.el.win.textContent = '0';
    this.counters.forEach((c) => c.set(this.balance - bet, { duration: 300 }));
    this.el.spin.classList.remove('is-pressed');
    void this.el.spin.offsetWidth;
    this.el.spin.classList.add('is-pressed');
    this.#haptic(this.#autoplay ? null : 'H_lekki');
    this.game.startSpin({ tempo: this.tempo, autoplay: Boolean(this.#autoplay) });
    this.#renderSpin();
    let response;
    try {
      response = await api.spin(this.code, bet, key);
    } catch (err) {
      await this.#spinFailed(err);
      return;
    }
    this.responses.push(response);
    this.lastResponse = response;
    this.round.response = response;
    this.state = 'presenting';
    this.#renderSpin();
    try {
      await this.game.play(response, { tempo: this.tempo, autoplay: Boolean(this.#autoplay) });
    } catch (err) {
      console.error('Błąd odgrywania rundy:', err);
    }
    this.#book();
    this.state = 'ready';
    this.#renderSpin();
    this.#afterRound(response);
  }

  /** Księgowanie salda z odpowiedzi serwera (dokładnie raz na rundę). */
  #book() {
    const r = this.round;
    if (!r?.response || r.booked) return;
    r.booked = true;
    const after = r.response.balanceAfter;
    const delta = after - (r.before - r.bet);
    this.balance = after;
    this.counters.forEach((c) => {
      c.set(after);
      if (delta > 0) c.pulse();
    });
    store.updateBalance(after, 'spin');
    this.#renderBet();
  }

  #afterRound(response) {
    // zmiana rozdzielczości po zmianie poziomu jakości — tylko między rundami (04 § 2.2)
    if (this.#pendingResolution) {
      this.#pendingResolution = false;
      this.gameApp.applyResolution();
    }
    this.gameApp.quality.maybeUpgrade();
    if (!this.#autoplay) return;
    const a = this.#autoplay;
    a.left -= 1;
    const unitWin = response.totalWin;
    if (a.stopWin && unitWin >= a.stopWin * response.bet) return this.#stopAutoplay('wygrana', true);
    if (a.left <= 0) return this.#stopAutoplay('limit', true);
    if (this.balance < this.bet) return this.#stopAutoplay('brak środków', true);
    this.#renderSpin();
    setTimeout(() => {
      if (this.#autoplay && this.state === 'ready' && !isModalOpen()) this.spin();
    }, 260 * this.tempo);
  }

  async #spinFailed(err) {
    const code = err?.code;
    await this.game.abort();
    this.counters.forEach((c) => c.set(this.balance, { duration: 300 }));
    this.state = 'ready';
    this.#renderSpin();
    this.#stopAutoplay('błąd');
    if (code === 'NOT_LOGGED_IN') {
      sessionLost();
      location.replace(`./?gra=${encodeURIComponent(this.code)}`);
      return;
    }
    if (code === 'INSUFFICIENT_FUNDS') {
      this.#showFunds();
      return;
    }
    if (code === 'BET_INVALID') {
      this.betIndex = 0;
      this.#renderBet();
    }
    this.#haptic('H_blad');
    toast({ type: 'error', title: code === 'BET_INVALID' ? 'Niedozwolony zakład' : 'Spin nie został rozegrany', message: messageFor(err) });
    // runda mogła zostać rozliczona po stronie serwera (zerwane połączenie) — odświeżamy saldo z GET /api/me
    api.me().then((p) => {
      store.setPlayer(p, { reason: 'sync' });
      this.balance = p.balance;
      this.counters.forEach((c) => c.set(p.balance));
      this.#renderBet();
    }).catch(() => {});
  }

  /** SPIN / Spacja / dotknięcie: start, szybki stop albo przewinięcie (zależnie od stanu). */
  primary() {
    this.#markInteraction();
    if (this.state === 'ready') {
      if (this.#autoplay) return this.#stopAutoplay('gracz');
      return this.spin();
    }
    if (this.#autoplay && this.state !== 'intro') this.#stopAutoplay('gracz');
    if (this.state === 'spinning' || this.state === 'presenting') this.game.skip();
    return undefined;
  }

  // ------------------------------------------------------------------------------------------- autoplay (E38)

  #toggleAutoMenu(open = this.el.autoMenu.hidden) {
    if (this.#autoplay) {
      this.#stopAutoplay('gracz');
      return;
    }
    this.el.autoMenu.hidden = !open;
    this.el.auto.setAttribute('aria-expanded', String(open));
    if (open) this.el.autoMenu.querySelector('input:checked')?.focus();
  }

  #startAutoplay() {
    const n = Number(this.el.autoMenu.querySelector('input[name="auto-ile"]:checked')?.value ?? 10);
    const stopWin = Number(this.el.autoMenu.querySelector('input[name="auto-stop"]:checked')?.value ?? 0);
    this.el.autoMenu.hidden = true;
    this.#autoplay = { left: n, total: n, stopWin };
    this.el.auto.setAttribute('aria-pressed', 'true');
    audio.play('ui_przelacznik', { detune: 200 });
    this.#haptic('H_tik');
    this.#renderSpin();
    if (this.state === 'ready') this.spin();
  }

  #stopAutoplay(reason, byCondition = false) {
    if (!this.#autoplay) return;
    this.#autoplay = null;
    this.el.auto.setAttribute('aria-pressed', 'false');
    audio.play(byCondition ? 'ui_zamknij' : 'ui_przelacznik', { detune: byCondition ? 0 : -200 });
    this.#renderSpin();
    if (byCondition && reason !== 'limit') toast({ type: 'info', title: 'Autoplay zatrzymany', message: reason === 'wygrana' ? 'Osiągnięto ustawioną wygraną.' : 'Za mało cebulionów na kolejny spin.', duration: 2600 });
  }

  get autoplayActive() {
    return Boolean(this.#autoplay);
  }

  // ------------------------------------------------------------------------------------------- zakład, turbo, ustawienia

  changeBet(step) {
    if (this.state !== 'ready' || this.#autoplay) return;
    const next = Math.min(this.levels.length - 1, Math.max(0, this.betIndex + step));
    if (next === this.betIndex) return;
    this.betIndex = next;
    storage.set(`cebulion.zaklad.${this.code}`, String(this.bet));
    audio.play(step > 0 ? 'ui_zaklad_gora' : 'ui_zaklad_dol', { detune: next * 100 });   // E23: +100 c × poziom
    this.#haptic('H_tik');
    this.el.bet.classList.remove('is-roll-up', 'is-roll-down');
    void this.el.bet.offsetWidth;
    this.el.bet.classList.add(step > 0 ? 'is-roll-up' : 'is-roll-down');
    this.#renderBet();
  }

  #renderBet() {
    this.el.bet.textContent = formatAmount(this.bet);
    const busy = this.state !== 'ready' || Boolean(this.#autoplay);
    this.el.minus.disabled = busy || this.betIndex === 0;
    this.el.plus.disabled = busy || this.betIndex === this.levels.length - 1;
    const tooHigh = this.balance < this.bet;
    this.el.bet.classList.toggle('is-too-high', tooHigh);
    this.el.bet.classList.toggle('is-max', this.betIndex === this.levels.length - 1);
    this.el.bet.title = tooHigh ? 'Za mało cebulionów na ten zakład' : '';
  }

  #renderTurbo() {
    this.el.turbo.setAttribute('aria-pressed', String(this.turbo));
  }

  #renderSpin() {
    const s = this.state;
    const spin = this.el.spin;
    const stopping = s === 'spinning' || (s === 'presenting' && this.game.bigWinActive);
    spin.classList.toggle('is-stop', s === 'spinning');
    spin.classList.toggle('is-auto', Boolean(this.#autoplay));
    spin.disabled = s === 'intro';
    spin.setAttribute('aria-label', s === 'spinning' ? 'Zatrzymaj bębny (spacja)' : stopping ? 'Przewiń (spacja)' : this.#autoplay ? 'Zatrzymaj autoplay' : 'Zakręć (spacja)');
    this.el.spinCount.hidden = !this.#autoplay;
    if (this.#autoplay) this.el.spinCount.textContent = String(this.#autoplay.left);
    this.el.lobby.classList.toggle('is-disabled', s !== 'ready');
    this.el.lobby.setAttribute('aria-disabled', String(s !== 'ready'));
    this.#renderBet();
  }

  #showFunds() {
    const p = store.player;
    this.el.fundsText.textContent = `Saldo ${formatAmount(this.balance)} nie wystarcza na zakład ${formatAmount(this.bet)}.`;
    const canLower = this.levels.some((l) => l <= this.balance) && this.betIndex > 0;
    this.el.lower.hidden = !canLower;
    this.el.rescue.hidden = true;
    this.el.fundsNote.textContent = '';
    openModal(this.el.funds);
    audio.play('ui_blad');
    // stan bonusu ratunkowego z serwera (canRescue / rescueAvailableInSeconds — kontrakt 09 § 2.1)
    api.me().then((player) => {
      store.setPlayer(player, { reason: 'sync' });
      this.el.rescue.hidden = !player.canRescue;
      if (!player.canRescue && player.balance < player.minBet && player.rescueAvailableInSeconds > 0) {
        this.el.fundsNote.textContent = `Bonus ratunkowy będzie dostępny za ${Math.ceil(player.rescueAvailableInSeconds / 60)} min.`;
      }
    }).catch(() => {});
    void p;
  }

  async #rescue() {
    this.el.rescue.disabled = true;
    try {
      const res = await api.rescue();
      store.setPlayer(res.player, { reason: 'rescue' });
      this.balance = res.player.balance;
      this.counters.forEach((c) => { c.set(this.balance); c.pulse(); c.showDelta(res.amount); });
      audio.play('sfx_saldo_puls');
      closeModal(this.el.funds, 'success');
      toast({ type: 'bonus', title: `+${formatAmount(res.amount)} cebulionów`, message: 'Bonus ratunkowy odebrany. Powodzenia!' });
      this.#renderBet();
    } catch (err) {
      toast({ type: 'error', title: 'Bonus niedostępny', message: messageFor(err) });
    } finally {
      this.el.rescue.disabled = false;
    }
  }

  #openSettings() {
    const q = this.gameApp.quality;
    for (const input of this.el.settings.querySelectorAll('input[name="jakosc"]')) input.checked = input.value === q.mode;
    for (const input of this.el.settings.querySelectorAll('input[name="ruch"]')) input.checked = input.value === this.gameApp.motion.setting;
    this.el.haptics.checked = this.hapticsOn;
    this.#qualityNote();
    openModal(this.el.settings);
    audio.play('ui_otworz');
  }

  #qualityNote() {
    const q = this.gameApp.quality;
    const names = { high: 'wysoka', medium: 'średnia', low: 'niska' };
    this.el.qualityNote.textContent = q.mode === 'auto'
      ? `Teraz: ${names[q.level]} (automat dobiera poziom po pomiarze płynności${q.p90 ? `, p90 klatki ${q.p90.toFixed(1)} ms` : ''}).`
      : `Wybrano ręcznie: ${names[q.level]}.`;
  }

  #haptic(id) {
    if (!id || !this.hapticsOn || !this.#interacted || document.hidden) return;
    if (!navigator.vibrate || !matchMedia('(pointer: coarse)').matches) return;
    const now = performance.now();
    if (now - this.#lastHaptic < 120) return;      // najwyżej jeden wzorzec na 120 ms, bez kolejki (04 § 1.6)
    this.#lastHaptic = now;
    try { navigator.vibrate(HAPTICS[id] ?? [10]); } catch { /* brak wsparcia */ }
  }

  #markInteraction() {
    this.#interacted = true;
  }

  // ------------------------------------------------------------------------------------------- zdarzenia

  #bind() {
    const e = this.el;
    e.spin.addEventListener('click', () => this.primary());
    e.minus.addEventListener('click', () => this.changeBet(-1));
    e.plus.addEventListener('click', () => this.changeBet(1));
    e.auto.addEventListener('click', () => { this.#markInteraction(); this.#toggleAutoMenu(); });
    e.autoStart.addEventListener('click', () => this.#startAutoplay());
    e.turbo.addEventListener('click', () => {
      this.turbo = !this.turbo;
      storage.set('cebulion.turbo', this.turbo ? '1' : '0');
      this.#renderTurbo();
      audio.play('ui_przelacznik', { detune: this.turbo ? 200 : -200 });   // E39
      this.#haptic('H_tik');
      e.turbo.classList.remove('is-flash');
      void e.turbo.offsetWidth;
      if (this.turbo) e.turbo.classList.add('is-flash');
    });
    e.settingsBtn.addEventListener('click', () => this.#openSettings());
    e.settings.addEventListener('change', (ev) => {
      const t = ev.target;
      if (t.name === 'jakosc') {
        this.gameApp.quality.setMode(t.value);
        this.#qualityNote();
      } else if (t.name === 'ruch') this.gameApp.motion.set(t.value);
      else if (t.id === 'ust-wibracje') {
        this.hapticsOn = t.checked;
        storage.set('cebulion.haptyka', t.checked ? '1' : '0');
      }
      audio.play('ui_przelacznik');
    });
    e.rescue.addEventListener('click', () => this.#rescue());
    e.lower.addEventListener('click', () => {
      const idx = this.levels.reduce((best, l, i) => (l <= this.balance ? i : best), 0);
      this.betIndex = idx;
      storage.set(`cebulion.zaklad.${this.code}`, String(this.bet));
      this.#renderBet();
      closeModal(e.funds, 'lower');
    });
    // dotknięcie sceny: przewinięcie Big Win / szybki stop (04 § 4.5)
    e.stage.addEventListener('pointerdown', (ev) => {
      if (ev.target.closest('button, a, .loader')) return;
      this.#markInteraction();
      if (this.state === 'spinning' || this.state === 'presenting') this.game.skip();
    });
    document.addEventListener('pointerdown', (ev) => {
      if (!e.autoMenu.hidden && !ev.target.closest('.auto-wrap')) this.#toggleAutoMenu(false);
    });
    // przycisk, który dostał fokus z myszy/dotyku (a nie z klawiatury) — dla niego spacja dalej znaczy SPIN
    let pointerFocus = null;
    document.addEventListener('pointerdown', (ev) => {
      if (!ev.target.closest?.('.modal')) pointerFocus = ev.target.closest?.('button, a') ?? null;
    }, true);
    document.addEventListener('focusin', (ev) => {
      // fokus wewnątrz okna (i jego powrót na przycisk, który je otworzył) nie zmienia „pochodzenia” fokusu
      if (ev.target.closest?.('.modal') || ev.target === pointerFocus) return;
      pointerFocus = null;
    });
    // skróty: Spacja = SPIN / stop / przewinięcie, + / − = zakład, Esc = zamknięcie menu AUTO / stop autoplay
    document.addEventListener('keydown', (ev) => {
      if (isModalOpen() || ev.repeat) return;
      if (ev.target.closest?.('input, textarea, select, [contenteditable="true"]')) return;
      if (ev.code === 'Space' || ev.code === 'Enter') {
        // spacja na innym przycisku = jego kliknięcie, ale tylko gdy fokus przyszedł z KLAWIATURY (Tab);
        // po kliknięciu myszą np. TURBO fokus zostaje na nim, a spacja ma dalej znaczyć SPIN (konwencja automatów).
        // (:focus-visible się tu nie nadaje — Chrome włącza go już przy tym samym naciśnięciu klawisza)
        const btn = ev.target.closest?.('button, a');
        if (btn && btn !== e.spin && btn !== pointerFocus) return;
        ev.preventDefault();
        this.primary();
      } else if (ev.key === '+' || ev.key === '=' || ev.code === 'NumpadAdd') {
        ev.preventDefault();
        this.changeBet(1);
      } else if (ev.key === '-' || ev.code === 'NumpadSubtract') {
        ev.preventDefault();
        this.changeBet(-1);
      } else if (ev.key === 'Escape') {
        if (!e.autoMenu.hidden) this.#toggleAutoMenu(false);
        else if (this.#autoplay) this.#stopAutoplay('gracz');
      }
    });
    // przycisk aktywuje się spacją przy PUSZCZENIU klawisza — blokujemy to dla przycisków z fokusem „z myszy”,
    // żeby spacja = SPIN nie przełączyła przy okazji np. TURBO
    document.addEventListener('keyup', (ev) => {
      if (ev.code !== 'Space' || isModalOpen()) return;
      const btn = ev.target.closest?.('button, a');
      if (btn && (btn === e.spin || btn === pointerFocus)) ev.preventDefault();   // SPIN obsłużył już keydown
    });
    // przejście gra → lobby (E12) — tylko między rundami
    e.lobby.addEventListener('click', (ev) => {
      if (ev.metaKey || ev.ctrlKey) return;
      ev.preventDefault();
      if (this.state !== 'ready') return;
      audio.play('sfx_przejscie_whoosh');
      audio.stopMusic(220);
      document.body.classList.add('is-leaving');
      setTimeout(() => { location.href = e.lobby.href; }, 220);
    });
    this.gameApp.quality.addEventListener('change', () => {
      if (this.state === 'ready') this.gameApp.applyResolution();
      else this.#pendingResolution = true;
    });
  }

  /** Punkt kontrolny dla testów e2e (tools/e2e/gra-s1.mjs) i panelu ?fx=debug — tylko odczyt. */
  #exposeForTests() {
    const self = this;
    window.__gra = {
      get state() { return self.state; },
      get responses() { return self.responses; },
      get lastResponse() { return self.lastResponse; },
      get autoplay() { return self.autoplayActive; },
      get displayedBalance() { return self.counters[0]?.target; },
      get shownBalanceText() { return document.querySelector('#saldo .balance-pill__value')?.textContent; },
      get bigWin() { return self.game.bigWinActive; },
      get bigWinPhase() { return self.game.bigwin.phase; },
      get bigWinLevel() { return self.game.bigwin.level; },
      get linesShown() { return self.game.lines.count; },
      get reelsSpinning() { return self.game.reels.spinning; },
      get jackpotShowing() { return Boolean(self.game.jackpotText?.root.visible); },
      get trauma() { return self.game.camera.trauma; },
      debug: () => self.game.debugInfo(),
      /** Obiekt gry — tylko do pomiarów wydajności w narzędziach deweloperskich (warstwy, systemy). */
      get _game() { return self.game; },
      flashLog: () => self.game.governor.log,
      perf: () => self.gameApp.perfStats(),
      perfReset: () => self.gameApp.perfReset(),
      qualityLog: () => self.gameApp.quality.log,
      audio: () => audio.stats(),
    };
  }
}
