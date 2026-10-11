/**
 * session.js — logowanie, wylogowanie i przywracanie sesji po odświeżeniu strony.
 *
 * Sesja to cookie HttpOnly ustawiane przez serwer — JavaScript go nie widzi (i dobrze: skrypt nie ukradnie sesji).
 * Żeby nie pytać serwera „czy jestem zalogowany?” przy każdym wejściu nowego gościa (odpowiedź 401 zaśmieca
 * konsolę przeglądarki czerwonym wpisem), zapisujemy w localStorage tylko WSKAZÓWKĘ „logowałem się tu”.
 * To nie jest dane poufne ani dowód tożsamości — o tym, kto jest zalogowany, zawsze decyduje serwer (GET /api/me).
 */

import { api } from './api.js';
import { store } from './store.js';

const HINT_KEY = 'cebulion.sesja';

/** Czy w tej przeglądarce była sesja? Gdy localStorage jest niedostępny (tryb prywatny) — pytamy serwer. */
export function hasSessionHint() {
  try {
    return localStorage.getItem(HINT_KEY) === '1';
  } catch {
    return true;
  }
}

function setHint(on) {
  try {
    if (on) localStorage.setItem(HINT_KEY, '1');
    else localStorage.removeItem(HINT_KEY);
  } catch {
    /* brak dostępu do localStorage — nic nie szkodzi, najwyżej zapytamy serwer */
  }
}

/**
 * Przywraca sesję: GET /api/me, jeśli wskazówka mówi, że gracz się tu logował.
 * @returns {Promise<object|null>} gracz albo null
 * @throws {ApiError} przy błędzie sieci (żeby strona mogła pokazać komunikat E40)
 */
export async function restoreSession() {
  if (!hasSessionHint()) {
    store.setPlayer(null, { reason: 'restore' });
    return null;
  }
  try {
    const player = await api.me();
    setHint(true);
    store.setPlayer(player, { reason: 'restore' });
    return player;
  } catch (err) {
    if (err.code === 'NOT_LOGGED_IN' || err.status === 401) {
      sessionLost();
      return null;
    }
    throw err;
  }
}

/** POST /api/auth/login. Stan gracza ustawia wywołujący (żeby zdążyć przygotować animację bonusu). */
export async function login(nick) {
  const result = await api.login(nick);
  setHint(true);
  return result;
}

/** POST /api/auth/logout — nawet gdy serwer nie odpowie, lokalnie traktujemy gracza jako wylogowanego. */
export async function logout() {
  try {
    await api.logout();
  } finally {
    sessionLost('logout');
  }
}

/** Serwer odpowiedział 401 (sesja wygasła / wylogowanie w innej karcie). */
export function sessionLost(reason = 'expired') {
  setHint(false);
  store.setPlayer(null, { reason });
}
