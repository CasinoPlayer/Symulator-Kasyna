/**
 * ui/icons.js — tworzenie ikon SVG i ikony monety w kodzie (dla elementów budowanych dynamicznie).
 *
 * Ikony liniowe pochodzą ze sprite'a icons/ikony.svg (<use href="…#nazwa">), więc biorą kolor z CSS.
 * Moneta to obraz: z manifestu (g_moneta_przod), a gdy go nie ma — wektorowy plik zastępczy icons/moneta.svg.
 */

import { assets } from '../assets.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const SPRITE = new URL('icons/ikony.svg', document.baseURI).pathname;
export const COIN_FALLBACK = new URL('icons/moneta.svg', document.baseURI).href;
export const EMBLEM_FALLBACK = new URL('icons/emblemat.svg', document.baseURI).href;

/** <svg class="icon"><use href="icons/ikony.svg#nazwa"/></svg> — ikona dekoracyjna (aria-hidden). */
export function icon(name, className = 'icon') {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('class', className);
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  const use = document.createElementNS(SVG_NS, 'use');
  use.setAttribute('href', `${SPRITE}#${name}`);
  svg.append(use);
  return svg;
}

/** Ikona waluty (moneta cebulion) jako <img>, dekoracyjna — kwotę zawsze opisuje tekst obok. */
export function coinImg(className = 'coin') {
  const img = new Image();
  img.className = className;
  img.alt = '';
  img.decoding = 'async';
  const data = assets.get('g_moneta_przod');
  if (data) {
    if (data.src2x) img.srcset = assets.srcset('g_moneta_przod');
    img.src = data.src;
    img.addEventListener('error', () => { img.removeAttribute('srcset'); img.src = COIN_FALLBACK; }, { once: true });
  } else {
    img.src = COIN_FALLBACK;
  }
  return img;
}
