/**
 * ui/avatar.js — awatar gracza.
 *
 * Serwer podaje `avatarIndex` (0–7, stały dla nazwy gracza — 09 § 2.1). Jeśli pipeline grafiki pociął arkusz
 * g_awatary (komórki w manifeście), pokazujemy obrazek z tej komórki. Jeśli nie — kółko z inicjałami
 * w jednym z 8 gradientów marki (ten sam indeks = zawsze ten sam kolor, więc gracz jest rozpoznawalny).
 */

import { assets } from '../assets.js';

const GRADIENTS = [
  ['#6A3CFF', '#FF2E88'], ['#FF2E88', '#FFB020'], ['#0096C7', '#6A3CFF'], ['#F5C542', '#D9480F'],
  ['#21E6FF', '#1F4FD8'], ['#2BD67B', '#00796B'], ['#8F3DFF', '#21E6FF'], ['#FF4D4D', '#8F3DFF'],
];

/** Inicjały: „Kamil_77” → „K7”, „NeonKuba” → „NK”, „Kryształ” → „KR”. */
export function initials(nick = '') {
  const parts = nick.split(/[_\-\s]+|(?<=[a-ząćęłńóśźż])(?=[A-ZĄĆĘŁŃÓŚŹŻ])/u).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return [...nick].slice(0, 2).join('').toUpperCase() || '?';
}

/**
 * Tworzy element awatara.
 * @param {{nick: string, avatarIndex?: number, size?: 'sm'|'md'|'lg'}} options
 */
export function createAvatar({ nick, avatarIndex = 0, size = 'md' }) {
  const el = document.createElement('span');
  el.className = `avatar${size !== 'md' ? ` avatar--${size}` : ''}`;
  el.setAttribute('aria-hidden', 'true'); // nazwa gracza zawsze stoi obok jako tekst
  const index = ((Number(avatarIndex) || 0) % 8 + 8) % 8;
  const [a, b] = GRADIENTS[index];
  el.style.setProperty('--av-a', a);
  el.style.setProperty('--av-b', b);

  const cellId = assets.sheetCell('g_awatary', index);
  const img = cellId ? assets.createImg(cellId, { loading: 'lazy' }) : null;
  if (img) {
    img.addEventListener('error', () => { img.remove(); el.textContent = initials(nick); }, { once: true });
    el.append(img);
  } else {
    el.textContent = initials(nick);
  }
  return el;
}

/** Podmienia zawartość istniejącego awatara (np. w pasku górnym po zmianie gracza). */
export function updateAvatar(el, { nick, avatarIndex }) {
  const fresh = createAvatar({ nick, avatarIndex });
  el.replaceChildren(...fresh.childNodes);
  el.style.cssText = fresh.style.cssText;
}
