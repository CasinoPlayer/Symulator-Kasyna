/**
 * ui/toast.js — krótkie powiadomienia („tosty”) w rogu ekranu.
 *
 * Po co: potwierdzenia („Witaj, Kamil!”), bonusy i błędy sieci (E40) bez przerywania gry oknem modalnym.
 * Dostępność: kontener jest regionem aria-live, więc czytnik ekranu odczyta treść; błędy mają role="alert".
 * Najechanie myszą wstrzymuje odliczanie, żeby dało się spokojnie przeczytać dłuższy komunikat.
 * Treść wstawiamy przez textContent (nigdy innerHTML) — nazwa gracza nie może wstrzyknąć HTML (XSS).
 */

import { icon } from './icons.js';

const MAX_VISIBLE = 3;
const ICONS = { info: 'info', success: 'check', error: 'alert', bonus: 'prezent' };
let region = null;

function ensureRegion() {
  if (region?.isConnected) return region;
  region = document.createElement('div');
  region.className = 'toast-region';
  region.setAttribute('aria-live', 'polite');
  region.setAttribute('aria-label', 'Powiadomienia');
  document.body.append(region);
  return region;
}

/**
 * Pokazuje powiadomienie.
 * @param {{title: string, message?: string, type?: 'info'|'success'|'error'|'bonus', duration?: number}} options
 * @returns {{dismiss: () => void}}
 */
export function toast({ title, message = '', type = 'info', duration = 4200 }) {
  const host = ensureRegion();
  const el = document.createElement('div');
  el.className = `toast toast--${type}`;
  el.setAttribute('role', type === 'error' ? 'alert' : 'status');

  const iconWrap = document.createElement('span');
  iconWrap.className = 'toast__icon';
  iconWrap.append(icon(ICONS[type] ?? 'info'));

  const body = document.createElement('div');
  const titleEl = document.createElement('p');
  titleEl.className = 'toast__title';
  titleEl.textContent = title;
  body.append(titleEl);
  if (message) {
    const msg = document.createElement('p');
    msg.className = 'toast__msg';
    msg.textContent = message;
    body.append(msg);
  }

  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'btn-icon toast__close';
  close.setAttribute('aria-label', 'Zamknij powiadomienie');
  close.append(icon('zamknij'));

  const timer = document.createElement('span');
  timer.className = 'toast__timer';
  timer.style.animationDuration = `${duration}ms`;

  el.append(iconWrap, body, close, timer);
  host.append(el);
  while (host.children.length > MAX_VISIBLE) host.firstElementChild.remove();

  let remaining = duration;
  let startedAt = performance.now();
  let handle = setTimeout(dismiss, remaining);

  function dismiss() {
    clearTimeout(handle);
    if (!el.isConnected || el.classList.contains('is-leaving')) return;
    el.classList.add('is-leaving');
    el.addEventListener('animationend', () => el.remove(), { once: true });
    setTimeout(() => el.remove(), 400); // zapas, gdyby animacja była wyłączona (reduced motion)
  }

  el.addEventListener('mouseenter', () => {
    clearTimeout(handle);
    remaining -= performance.now() - startedAt;
    timer.style.animationPlayState = 'paused';
  });
  el.addEventListener('mouseleave', () => {
    startedAt = performance.now();
    timer.style.animationPlayState = 'running';
    handle = setTimeout(dismiss, Math.max(800, remaining));
  });
  close.addEventListener('click', dismiss);

  return { dismiss };
}
