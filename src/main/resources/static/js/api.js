/**
 * api.js — jedyne miejsce, w którym przeglądarka rozmawia z serwerem (REST API w Spring Boot).
 *
 * Po co:
 *   * wszystkie żądania mają te same ustawienia: JSON, cookie sesji (credentials), limit czasu,
 *   * błędy serwera w formacie ProblemDetail (RFC 9457, kontrakt 09 § 1) zamieniamy na ApiError z polem `code`,
 *     dzięki czemu reszta kodu sprawdza `err.code === 'NICK_FORBIDDEN'` zamiast parsować teksty,
 *   * brak sieci i przekroczenie czasu też są ApiError (code NETWORK_ERROR / TIMEOUT), więc obsługa jest jedna.
 * Ścieżki są względne ('api/…'), więc aplikacja działa także pod innym adresem bazowym (np. /kasyno/).
 */

const BASE = new URL('api/', document.baseURI);
const DEFAULT_TIMEOUT_MS = 12_000;

/** Błąd z API: status HTTP + stały kod z kontraktu + czytelny opis. */
export class ApiError extends Error {
  constructor({ status = 0, code = 'UNKNOWN', title = '', detail = '', errors = null, retryAfterSeconds = null } = {}) {
    super(detail || title || code);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.title = title;
    this.detail = detail;
    this.errors = errors;
    this.retryAfterSeconds = retryAfterSeconds;
  }

  /** Buduje błąd z odpowiedzi serwera; gdy brak pola `code`, wyprowadza je ze statusu. */
  static fromResponse(status, body) {
    // brak pola `code` (np. błąd z serwera pośredniczącego, nie z naszego backendu) → kod wyprowadzony ze statusu
    const fallback = status === 401 ? 'NOT_LOGGED_IN' : status === 404 ? 'NOT_FOUND' : status === 503 ? 'SERVICE_UNAVAILABLE'
      : status >= 500 ? 'INTERNAL_ERROR' : 'HTTP_' + status;
    return new ApiError({
      status,
      code: body?.code ?? fallback,
      title: body?.title ?? '',
      detail: body?.detail ?? '',
      errors: body?.errors ?? null,
      retryAfterSeconds: body?.retryAfterSeconds ?? null,
    });
  }
}

/**
 * Wysyła żądanie i zwraca JSON (albo null dla 204).
 * @param {'GET'|'POST'} method
 * @param {string} path ścieżka względna do /api/, np. 'auth/login'
 */
async function request(method, path, { body, headers = {}, timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let response;
  try {
    response = await fetch(new URL(path, BASE), {
      method,
      credentials: 'same-origin',          // cookie sesji (HttpOnly) leci automatycznie
      cache: 'no-store',
      headers: {
        Accept: 'application/json, application/problem+json',
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...headers,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
  } catch (err) {
    const timeout = err?.name === 'AbortError';
    throw new ApiError({
      code: timeout ? 'TIMEOUT' : 'NETWORK_ERROR',
      title: timeout ? 'Serwer nie odpowiada' : 'Brak połączenia',
    });
  } finally {
    clearTimeout(timer);
  }

  if (response.status === 204) return null;
  const type = response.headers.get('content-type') ?? '';
  const data = type.includes('json') ? await response.json().catch(() => null) : null;
  if (!response.ok) throw ApiError.fromResponse(response.status, data);
  return data;
}

/** Losowy klucz idempotencji dla spinu (09 § 2.2) — ten sam klucz przy ponowieniu = ta sama runda. */
export function newIdempotencyKey() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

/** Endpointy z kontraktu docs/projekt/09-kontrakt-api-i-assetow.md. */
export const api = {
  login: (nick) => request('POST', 'auth/login', { body: { nick } }),
  logout: () => request('POST', 'auth/logout'),
  me: () => request('GET', 'me'),
  rescue: () => request('POST', 'me/rescue'),
  history: (page = 0, size = 20) => request('GET', `me/history?page=${page}&size=${size}`),
  transactions: (page = 0, size = 20) => request('GET', `me/transactions?page=${page}&size=${size}`),
  stats: () => request('GET', 'me/stats'),
  slots: () => request('GET', 'slots'),
  slot: (code) => request('GET', `slots/${encodeURIComponent(code)}`),
  spin: (code, bet, idempotencyKey = newIdempotencyKey()) =>
    request('POST', `slots/${encodeURIComponent(code)}/spins`, { body: { bet }, headers: { 'Idempotency-Key': idempotencyKey } }),
  leaderboard: (type = 'biggest-win', limit = 10) => request('GET', `leaderboard?type=${encodeURIComponent(type)}&limit=${limit}`),
  bigWins: (limit = 10) => request('GET', `feed/big-wins?limit=${limit}`),
};

/**
 * Teksty dla gracza do kodów błędów (po polsku, w tonie marki — 01 §2.8).
 * Pierwsze dziesięć to tabela z kontraktu 09 § 1; kolejne backend dodał ponad kontrakt
 * (pl.wsb.kasyno.shared.error.ErrorCode) — obsługujemy je, żeby gracz nie zobaczył pustego komunikatu.
 */
const MESSAGES = {
  NICK_INVALID: 'Nazwa gracza musi mieć 3–16 znaków: litery (także polskie), cyfry, „_” lub „-”.',
  NICK_FORBIDDEN: 'Ta nazwa gracza jest niedozwolona. Wybierz inną.',
  VALIDATION_FAILED: 'Sprawdź wpisane dane i spróbuj ponownie.',
  NOT_LOGGED_IN: 'Sesja wygasła. Zaloguj się ponownie.',
  GAME_NOT_FOUND: 'Nie znaleźliśmy takiej gry.',
  BET_INVALID: 'Taki zakład nie jest dostępny w tej grze.',
  INSUFFICIENT_FUNDS: 'Za mało cebulionów na ten zakład.',
  RESCUE_NOT_AVAILABLE: 'Bonus ratunkowy jest jeszcze niedostępny.',
  IDEMPOTENCY_CONFLICT: 'To żądanie zostało już wysłane. Odśwież stronę.',
  NETWORK_ERROR: 'Brak połączenia z serwerem gry. Sprawdź, czy aplikacja działa, i spróbuj ponownie.',
  TIMEOUT: 'Serwer nie odpowiada. Spróbuj ponownie za chwilę.',
  INTERNAL_ERROR: 'Coś poszło nie tak po stronie serwera. Spróbuj ponownie.',
  GAME_NOT_READY: 'Ten automat jest jeszcze w przygotowaniu. Wybierz inny albo zajrzyj później.',
  CONCURRENT_REQUEST: 'Poprzednie żądanie jeszcze trwa. Spróbuj ponownie za chwilę.',
  SERVICE_UNAVAILABLE: 'Serwer jest chwilowo niedostępny. Spróbuj ponownie za chwilę.',
  NOT_FOUND: 'Nie znaleziono zasobu na serwerze.',
  METHOD_NOT_ALLOWED: 'Serwer nie obsługuje tego żądania.',
};

/** Komunikat dla gracza: znany kod → nasz tekst; nieznany → opis z serwera albo tekst ogólny. */
export function messageFor(error) {
  // `||`, a nie `??`: ApiError trzyma brak opisu jako pusty tekst, a pusty komunikat nic graczowi nie mówi
  if (error instanceof ApiError) return MESSAGES[error.code] || error.detail || error.title || MESSAGES.INTERNAL_ERROR;
  return MESSAGES.INTERNAL_ERROR;
}
