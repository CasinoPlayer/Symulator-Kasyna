/**
 * ui/reward.js — sekwencja nagrody: bonus powitalny (E07) i bonus ratunkowy (E10).
 *
 * Oś czasu (ms od startu):
 *     0  zasłona + promienie (obrót), jeden rozbłysk (WCAG 2.3.1: nie więcej niż 3 błyski na sekundę)
 *   100  skrzynia / emblemat wskakuje ze sprężyną (art-pop 760 ms), kwota liczy się od 0 w górę
 *   650  pierścień + iskry, z wnętrza skrzyni tryska fontanna monet (fx-lite)
 *  ~1300  monety po łukach lecą do pigułki salda; każda doliczona → licznik salda rośnie, pigułka pulsuje
 * ~2600  ostatnia moneta: licznik dochodzi do wartości końcowej, „+10 000” pod pigułką, zasłona znika
 * Kliknięcie, Esc, Enter albo „Pomiń” przewija od razu do końca (saldo zawsze kończy się poprawną wartością).
 * prefers-reduced-motion: bez zasłony i cząsteczek — saldo ustawia się od razu, zostaje sam toast.
 * Zdarzenia 'reward:start' / 'reward:end' na document pozwalają wstrzymać inne animacje (np. pył w tle lobby).
 */

import { assets } from '../assets.js';
import { audio } from '../audio/audio-engine.js';
import { formatSigned } from '../format.js';
import { EMBLEM_FALLBACK, coinImg } from './icons.js';

const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const easeOutCubic = (t) => 1 - (1 - t) ** 3;

function centerOf(el) {
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

/**
 * Odgrywa sekwencję nagrody.
 * @param {object} o
 * @param {number} o.amount kwota bonusu (np. 10000)
 * @param {number} o.from saldo przed bonusem, @param {number} o.to saldo po bonusie
 * @param {string} o.eyebrow napis nad kwotą, @param {string} o.sub podpis pod kwotą
 * @param {import('../fx-lite.js').FxLite} o.fx silnik cząsteczek (płótno na cały ekran)
 * @param {import('./balance.js').BalanceCounter} o.counter licznik w pigułce salda
 * @param {HTMLElement} o.target element, do którego lecą monety (pigułka salda)
 * @param {string} [o.artId] ID obrazu z manifestu (domyślnie g_skrzynia)
 * @returns {Promise<void>}
 */
export function playReward({ amount, from, to, eyebrow, sub, fx, counter, target, artId = 'g_skrzynia' }) {
  if (reducedMotion.matches || !fx.enabled) {
    counter.set(to, { animate: false });
    counter.pulse();
    counter.showDelta(amount);
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'reward';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'reward-kwota');

    const art = document.createElement('div');
    art.className = 'reward__art';
    const img = assets.createImg(artId, { loading: 'eager' }) ?? Object.assign(new Image(), { src: EMBLEM_FALLBACK, alt: '' });
    img.alt = '';
    // obraz jest w manifeście, ale plik się nie wczytał → emblemat zastępczy zamiast pustego miejsca
    img.addEventListener('error', () => { img.removeAttribute('srcset'); img.src = EMBLEM_FALLBACK; }, { once: true });
    art.append(img);

    const eyebrowEl = Object.assign(document.createElement('p'), { className: 'reward__eyebrow', textContent: eyebrow });
    const amountEl = document.createElement('p');
    amountEl.className = 'reward__amount num';
    amountEl.id = 'reward-kwota';
    const amountText = document.createElement('span');
    amountText.textContent = '+0';
    amountEl.append(coinImg('coin'), amountText);
    const subEl = Object.assign(document.createElement('p'), { className: 'reward__sub', textContent: sub });
    const skip = Object.assign(document.createElement('button'), { type: 'button', className: 'btn btn--ghost btn--sm reward__skip', textContent: 'Pomiń' });

    const stage = document.createElement('div');
    stage.className = 'reward__stage';
    stage.append(art, eyebrowEl, amountEl, subEl, skip);
    overlay.append(
      Object.assign(document.createElement('div'), { className: 'reward__veil' }),
      Object.assign(document.createElement('div'), { className: 'reward__rays' }),
      Object.assign(document.createElement('div'), { className: 'reward__flash' }),
      stage,
    );

    const previousFocus = document.activeElement;
    document.body.append(overlay);
    document.dispatchEvent(new CustomEvent('reward:start'));
    // Fokus zostaje w zasłonie (Tab jest blokowany w onKey, jedyny cel to „Pomiń”), a aria-modal mówi czytnikom
    // ekranu, żeby pominęły resztę strony. Nie ustawiamy `inert` na całej stronie: przeliczenie stylów całego
    // dokumentu w chwili startu animacji kosztowało na słabym telefonie ~100 ms (zacięcie na początku sekwencji).
    skip.focus({ preventScroll: true });

    audio.play('sfx_skrzynia_otwarcie');
    audio.play('sfx_blysk');

    // kwota w środku ekranu liczy się od 0 do bonusu
    const countStart = performance.now() + 250;
    let countFrame = requestAnimationFrame(function step(now) {
      const t = Math.min(1, Math.max(0, (now - countStart) / 1500));
      amountText.textContent = formatSigned(Math.round(amount * easeOutCubic(t))).replace(/^0$/, '+0');
      if (t < 1) countFrame = requestAnimationFrame(step);
    });

    let done = false;
    let fountainLoop = null;
    const timers = [];

    timers.push(setTimeout(() => {
      const r = art.getBoundingClientRect();
      const origin = { x: r.left + r.width / 2, y: r.top + r.height * 0.42 };
      fx.ring({ ...origin, radius: Math.min(window.innerWidth, 560) * 0.45 });
      fx.burst({ ...origin, count: 44, colors: ['gold', 'white', 'magenta', 'cyan'], speed: 640 });
      audio.play('sfx_uderzenie_basu');
      fountainLoop = audio.play('sfx_monety_fontanna');
      fx.fountain({
        ...origin,
        count: 24,
        target: () => centerOf(target),
        onArrive: (n, total) => {
          counter.set(from + Math.round((amount * n) / total), { duration: 240 });
          if (n % 3 === 0 || n === total) counter.pulse();
          audio.playVariant('sfx_moneta_', 5); // wysokość i głośność różnicuje manifest (pitchCents, gainJitterDb)
        },
        onDone: finish,
      });
    }, 650));
    timers.push(setTimeout(finish, 7000)); // zabezpieczenie: sekwencja nigdy nie „zawiśnie”

    function finish() {
      if (done) return;
      done = true;
      timers.forEach(clearTimeout);
      cancelAnimationFrame(countFrame);
      amountText.textContent = formatSigned(amount);
      fountainLoop?.stop(250);
      fx.finishAll();
      counter.set(to, { duration: 320 }).then(() => {
        counter.pulse();
        counter.showDelta(amount);
        audio.play('sfx_licznik_koniec');
      });
      overlay.classList.add('is-leaving');
      overlay.removeEventListener('keydown', onKey);
      setTimeout(() => {
        overlay.remove();
        document.dispatchEvent(new CustomEvent('reward:end'));
        if (previousFocus instanceof HTMLElement && previousFocus.isConnected && !previousFocus.closest('[hidden]')) {
          previousFocus.focus({ preventScroll: true });
        }
        resolve();
      }, 420);
    }

    function onKey(event) {
      if (['Escape', 'Enter', ' '].includes(event.key)) {
        event.preventDefault();
        finish();
      }
      if (event.key === 'Tab') event.preventDefault(); // jedyny element fokusowalny to „Pomiń”
    }

    overlay.addEventListener('click', finish);
    overlay.addEventListener('keydown', onKey);
  });
}
