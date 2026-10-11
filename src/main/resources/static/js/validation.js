/**
 * validation.js — walidacja nazwy gracza po stronie przeglądarki.
 *
 * Po co: gracz dostaje komunikat od razu, bez czekania na serwer. To tylko WYGODA — prawdziwą walidację
 * (i listę zakazanych słów) zawsze robi backend, bo żądanie można wysłać z pominięciem przeglądarki.
 * Zasady z kontraktu (09 § 1, kod NICK_INVALID): 3–16 znaków; litery (także polskie), cyfry, „_” i „-”.
 */

export const NICK_MIN = 3;
export const NICK_MAX = 16;

/** Jeden dozwolony znak: litera łacińska, polska litera, cyfra, podkreślenie albo dywiz. */
const ALLOWED_CHAR = /[A-Za-z0-9ĄĆĘŁŃÓŚŹŻąćęłńóśźż_-]/u;

/**
 * Sprawdza nazwę gracza.
 * @param {string} raw tekst z pola formularza
 * @returns {{ok: true, nick: string} | {ok: false, message: string}}
 */
export function validateNick(raw) {
  // NFC: niektóre klawiatury (np. macOS) wpisują „ą” jako „a” + znak łączący; składamy to w jedną literę.
  const nick = String(raw ?? '').normalize('NFC').trim();
  if (!nick) return { ok: false, message: 'Wpisz nazwę gracza.' };
  if (/\s/.test(nick)) return { ok: false, message: 'Nazwa gracza nie może zawierać spacji. Użyj „_” albo „-”.' };

  for (const ch of nick) {
    if (!ALLOWED_CHAR.test(ch)) {
      return { ok: false, message: `Znak „${ch}” jest niedozwolony. Użyj liter, cyfr, „_” lub „-”.` };
    }
  }
  const length = [...nick].length;
  if (length < NICK_MIN) return { ok: false, message: `Nazwa gracza musi mieć co najmniej ${NICK_MIN} znaki.` };
  if (length > NICK_MAX) return { ok: false, message: `Nazwa gracza może mieć najwyżej ${NICK_MAX} znaków.` };
  return { ok: true, nick };
}
