/**
 * ui/modal.js — okna modalne z pułapką fokusu (dostępność WCAG 2.1).
 *
 * Co robi i dlaczego:
 *   * fokus wchodzi do okna i NIE wychodzi z niego klawiszem Tab (pułapka) — użytkownik klawiatury nie „gubi się”
 *     za oknem, którego nie widać,
 *   * reszta strony dostaje atrybut `inert` (niedostępna dla myszy, klawiatury i czytnika ekranu),
 *   * Esc i kliknięcie w tło zamykają okno (chyba że okno jest „zablokowane”, np. w trakcie logowania),
 *   * po zamknięciu fokus wraca na element, który okno otworzył (np. przycisk „Zaloguj”),
 *   * przewijanie strony pod oknem jest zablokowane bez „skoku” układu (kompensujemy szerokość paska przewijania).
 *
 * Struktura HTML: <div class="modal" role="dialog" aria-modal="true" aria-labelledby="…" hidden>
 *                   <div class="modal__backdrop" data-close></div>
 *                   <div class="modal__panel"> … <button data-close>…</button> </div>
 *                 </div>
 * Okna muszą leżeć POZA elementem #app (który na czas otwarcia dostaje `inert`).
 */

const FOCUSABLE = [
  'a[href]', 'button:not([disabled])', 'input:not([disabled]):not([type="hidden"])', 'select:not([disabled])',
  'textarea:not([disabled])', '[tabindex]:not([tabindex="-1"])', 'video[controls]',
].join(',');

const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const stack = []; // otwarte okna (ostatnie = na wierzchu)

function focusables(container) {
  return [...container.querySelectorAll(FOCUSABLE)].filter((el) => !el.closest('[hidden]') && el.getClientRects().length > 0);
}

function lockPage(lock) {
  const root = document.documentElement;
  const app = document.getElementById('app');
  if (lock) {
    root.style.setProperty('--scrollbar-w', `${window.innerWidth - root.clientWidth}px`);
    root.classList.add('is-locked');
    if (app) app.inert = true;
  } else {
    root.classList.remove('is-locked');
    root.style.removeProperty('--scrollbar-w');
    if (app) app.inert = false;
  }
}

/**
 * Otwiera okno.
 * @param {HTMLElement} modal element .modal
 * @param {{initialFocus?: HTMLElement|string, onClose?: (reason: string) => void}} options
 */
export function openModal(modal, { initialFocus, onClose } = {}) {
  if (!modal || stack.some((entry) => entry.modal === modal)) return;
  const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;

  const onKeydown = (event) => {
    if (stack.at(-1)?.modal !== modal) return;
    if (event.key === 'Escape') {
      if (modal.dataset.locked !== 'true') {
        event.preventDefault();
        closeModal(modal, 'escape');
      }
      return;
    }
    if (event.key !== 'Tab') return;
    const items = focusables(modal);
    if (!items.length) {
      event.preventDefault();
      return;
    }
    const first = items[0];
    const last = items.at(-1);
    if (event.shiftKey && (document.activeElement === first || !modal.contains(document.activeElement))) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };
  const onClick = (event) => {
    if (event.target.closest('[data-close]') && modal.dataset.locked !== 'true') closeModal(modal, 'close');
  };

  if (!stack.length) lockPage(true);
  else stack.at(-1).modal.inert = true;
  stack.push({ modal, opener, onClose, onKeydown, onClick });

  modal.hidden = false;
  modal.classList.remove('is-closing');
  document.addEventListener('keydown', onKeydown, true);
  modal.addEventListener('click', onClick);

  // klasa .is-open w następnej klatce, żeby przeglądarka zdążyła narysować stan początkowy przejścia CSS
  requestAnimationFrame(() => {
    modal.classList.add('is-open');
    const target = typeof initialFocus === 'string' ? modal.querySelector(initialFocus) : initialFocus;
    const panel = modal.querySelector('.modal__panel') ?? modal;
    const el = target ?? focusables(modal)[0] ?? panel;
    if (el === panel && !panel.hasAttribute('tabindex')) panel.setAttribute('tabindex', '-1');
    el.focus({ preventScroll: true });
  });
}

/**
 * Zamyka okno (z animacją) i oddaje fokus elementowi, który je otworzył.
 * @param {HTMLElement} modal
 * @param {string} reason powód przekazywany do onClose: 'escape' | 'close' | 'success' | …
 */
export function closeModal(modal, reason = 'close') {
  const index = stack.findIndex((entry) => entry.modal === modal);
  if (index === -1) return;
  const [entry] = stack.splice(index, 1);
  document.removeEventListener('keydown', entry.onKeydown, true);
  modal.removeEventListener('click', entry.onClick);
  modal.classList.remove('is-open');
  modal.classList.add('is-closing');

  const finish = () => {
    modal.classList.remove('is-closing');
    if (!stack.some((e) => e.modal === modal)) modal.hidden = true;
  };
  if (reducedMotion.matches) finish();
  else setTimeout(finish, 200);

  if (stack.length) stack.at(-1).modal.inert = false;
  else lockPage(false);

  if (entry.opener?.isConnected && !entry.opener.closest('[inert]')) entry.opener.focus({ preventScroll: true });
  entry.onClose?.(reason);
}

/** Czy jakiekolwiek okno jest otwarte (np. skróty klawiszowe gry mają wtedy milczeć). */
export function isModalOpen() {
  return stack.length > 0;
}
