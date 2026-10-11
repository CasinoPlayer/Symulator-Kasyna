// =====================================================================================================
// tools/dev/mock-api.mjs — serwer ATRAPA (mock) do pracy nad front-endem bez uruchamiania Javy.
//
// WAŻNE: prawdziwe API to aplikacja Spring Boot (pakiet pl.wsb.kasyno, port 8080). Ten plik jej NIE zastępuje:
// nie ma bazy danych, nie liczy spinów, trzyma graczy tylko w pamięci (znikają po restarcie).
// Odpowiada dokładnie w kształcie z kontraktu docs/projekt/09-kontrakt-api-i-assetow.md, dzięki czemu front
// i backend mogą powstawać równolegle, a testy e2e (tools/e2e/smoke.mjs) da się uruchomić w kilka sekund.
//
// Uruchomienie (Node 20+, bez żadnych zależności):
//   node tools/dev/mock-api.mjs                  → http://localhost:8090 (dane demonstracyjne w rankingu i feedzie)
//   node tools/dev/mock-api.mjs --pusty          → ranking i feed puste (sprawdzanie "stanów pustych" w UI)
//   node tools/dev/mock-api.mjs --opoznienie=600 → każde /api/* odpowiada po 600 ms (sprawdzanie stanów ładowania)
//   node tools/dev/mock-api.mjs --port=9000 --cicho
//
// Co serwuje:
//   * pliki z src/main/resources/static (tak jak Spring Boot: "/" → index.html),
//   * endpointy z kontraktu: /api/auth/login, /api/auth/logout, /api/me, /api/me/rescue, /api/me/history,
//     /api/me/transactions, /api/me/stats, /api/slots, /api/slots/{code}, /api/leaderboard, /api/feed/big-wins,
//   * POST /api/dev/gracz — TYLKO W ATRAPIE: ustawia saldo / odliczanie bonusu ratunkowego zalogowanego gracza,
//     żeby e2e mogło sprawdzić ekran bankructwa bez grania setek spinów.
// =====================================================================================================

import http from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';

// ----------------------------------------------------------------------------------------------------- konfiguracja

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, '').split('=');
    return [k, v ?? true];
  }),
);
const PORT = Number(args.port ?? process.env.PORT ?? 8090);
const EMPTY = Boolean(args.pusty);
const DELAY_MS = Number(args.opoznienie ?? 0);
const QUIET = Boolean(args.cicho);

const HERE = path.dirname(fileURLToPath(import.meta.url));
const STATIC_ROOT = path.resolve(HERE, '..', '..', 'src', 'main', 'resources', 'static');

/** Stałe gry — te same wartości co w briefie i kontrakcie (bonus 10 000, ratunek raz na 10 minut). */
const WELCOME_BONUS = 10_000;
const RESCUE_BONUS = 10_000;
const RESCUE_COOLDOWN_S = 600;
const SESSION_COOKIE = 'JSESSIONID'; // ta sama nazwa, której używa Spring Boot — front i tak jej nie czyta (HttpOnly)

/** Zasady nazwy gracza z kontraktu: 3–16 znaków, litery (z polskimi), cyfry, _ i -. */
const NICK_PATTERN = /^[A-Za-z0-9ĄĆĘŁŃÓŚŹŻąćęłńóśźż_-]{3,16}$/u;
/** Przykładowa lista zakazanych słów (prawdziwą listę ma backend). */
const FORBIDDEN = ['admin', 'administrator', 'moderator', 'root', 'system', 'support'];

// ----------------------------------------------------------------------------------------------------- katalog gier

const SLOTS = [
  {
    code: 'cebulowy-777', name: 'Cebulowy 777', engineType: 'LINES', reels: 3, rows: 3, lines: 5,
    betLevels: [10, 20, 50, 100, 200, 500, 1000], minBet: 10, maxBet: 1000, targetRtp: 95.0, volatility: 'LOW_MEDIUM',
  },
  {
    code: 'zloty-faraon', name: 'Złoty Faraon', engineType: 'LINES', reels: 5, rows: 3, lines: 20,
    betLevels: [20, 40, 100, 200, 400, 1000, 2000], minBet: 20, maxBet: 2000, targetRtp: 96.0, volatility: 'MEDIUM_HIGH',
  },
  {
    code: 'krysztalowa-kaskada', name: 'Kryształowa Kaskada', engineType: 'CLUSTER', reels: 6, rows: 5, lines: null,
    betLevels: [20, 40, 100, 200, 400, 1000, 2000], minBet: 20, maxBet: 2000, targetRtp: 96.0, volatility: 'HIGH',
  },
];
const MIN_BET = Math.min(...SLOTS.map((s) => s.minBet));

/** Szczegóły automatów (GET /api/slots/{code}). Wypłaty są PRZYKŁADOWE — prawdziwe tabele są w 07-gry-i-matematyka.md i w Javie. */
const DETAILS = {
  'cebulowy-777': {
    symbols: [
      ['wisnie', 'NORMAL', { 3: 2 }], ['cytryna', 'NORMAL', { 3: 3 }], ['sliwka', 'NORMAL', { 3: 4 }],
      ['arbuz', 'NORMAL', { 3: 6 }], ['dzwonek', 'NORMAL', { 3: 10 }], ['bar', 'NORMAL', { 3: 20 }],
      ['siodemka', 'NORMAL', { 3: 50 }], ['wild', 'WILD', { 3: 100 }],
    ],
    features: [
      { code: 'NEON_MULTIPLIER', name: 'Neonowy mnożnik', description: 'Wygrana z WILD na linii jest mnożona ×2.' },
      { code: 'NEON_JACKPOT', name: 'NEON JACKPOT', description: 'Cały ekran tego samego symbolu: wygrana ×10.' },
    ],
  },
  'zloty-faraon': {
    symbols: [
      ['10', 'NORMAL', { 3: 0.25, 4: 1, 5: 5 }], ['j', 'NORMAL', { 3: 0.25, 4: 1, 5: 5 }], ['q', 'NORMAL', { 3: 0.5, 4: 1.5, 5: 7.5 }],
      ['k', 'NORMAL', { 3: 0.5, 4: 2, 5: 10 }], ['a', 'NORMAL', { 3: 0.75, 4: 2.5, 5: 12.5 }],
      ['ankh', 'NORMAL', { 3: 1, 4: 4, 5: 20 }], ['oko', 'NORMAL', { 3: 1.5, 4: 5, 5: 25 }],
      ['skarabeusz', 'NORMAL', { 3: 2, 4: 7.5, 5: 37.5 }], ['anubis', 'NORMAL', { 3: 2.5, 4: 10, 5: 50 }],
      ['faraon', 'NORMAL', { 3: 5, 4: 25, 5: 100 }], ['wild', 'WILD', { 5: 100 }], ['scatter', 'SCATTER', { 3: 2, 4: 10, 5: 50 }],
    ],
    features: [
      { code: 'FREE_SPINS', name: 'Darmowe spiny', description: '3 lub więcej piramid (SCATTER) daje 10 darmowych spinów.' },
      { code: 'EXPANDING_WILD', name: 'Rozszerzający się WILD', description: 'W darmowych spinach WILD zajmuje cały bęben, a wygrane są ×2.' },
      { code: 'RETRIGGER', name: '+10 spinów', description: '3 piramidy w darmowych spinach dodają kolejne 10 spinów.' },
    ],
  },
  'krysztalowa-kaskada': {
    symbols: [
      ['szafir', 'NORMAL', { 5: 0.25, 8: 0.75, 12: 2 }], ['szmaragd', 'NORMAL', { 5: 0.3, 8: 1, 12: 2.5 }],
      ['ametyst', 'NORMAL', { 5: 0.4, 8: 1.2, 12: 3 }], ['topaz', 'NORMAL', { 5: 0.5, 8: 1.5, 12: 4 }],
      ['rubin', 'NORMAL', { 5: 1, 8: 3, 12: 8 }], ['diament', 'NORMAL', { 5: 1.5, 8: 5, 12: 15 }],
      ['cebula', 'NORMAL', { 5: 2.5, 8: 10, 12: 30 }], ['scatter', 'SCATTER', { 4: 3, 5: 5, 6: 100 }],
      ['mnoznik', 'MULTIPLIER', {}],
    ],
    features: [
      { code: 'CLUSTER_PAYS', name: 'Wygrane klastrowe', description: '5 lub więcej takich samych symboli połączonych poziomo lub pionowo.' },
      { code: 'CASCADES', name: 'Kaskady', description: 'Wygrywające symbole pękają, a na ich miejsce spadają nowe.' },
      { code: 'MULTIPLIERS', name: 'Kule mnożników', description: 'W darmowych spinach spadają kule ×2…×100 mnożące wygraną sekwencji.' },
    ],
  },
};

// ----------------------------------------------------------------------------------------------------- dane w pamięci

/** Gracze po nazwie zapisanej małymi literami (logowanie nie rozróżnia wielkości liter — jak w kontrakcie). */
const players = new Map();
/** Sesje: identyfikator z cookie → klucz gracza. */
const sessions = new Map();
let nextId = 100;

/** avatarIndex 0–7 wyznaczany z nazwy (stały dla danej nazwy) — tak samo robi backend. */
function avatarIndexFor(nick) {
  let h = 0;
  for (const ch of nick.toLowerCase()) h = (h * 31 + ch.codePointAt(0)) >>> 0;
  return h % 8;
}

function minutesAgo(min) {
  return new Date(Date.now() - min * 60_000).toISOString();
}

/** Dane demonstracyjne do rankingu i feedu, żeby lobby w trybie deweloperskim nie było puste. */
const DEMO_FEED = EMPTY ? [] : [
  ['Złota_Ola', 'zloty-faraon', 48_000, 120, 'ultra', 2],
  ['NeonKuba', 'cebulowy-777', 10_000, 100, 'ultra', 7],
  ['Kryształ', 'krysztalowa-kaskada', 12_400, 62, 'epic', 15],
  ['Kamil_77', 'cebulowy-777', 3_500, 35, 'mega', 26],
  ['Faraon99', 'zloty-faraon', 6_000, 30, 'mega', 41],
  ['Zosia-W', 'krysztalowa-kaskada', 3_200, 16, 'big', 63],
  ['MistrzCebuli', 'cebulowy-777', 1_500, 15, 'big', 95],
].map(([nick, gameCode, win, multiplier, tier, min]) => ({
  nick, avatarIndex: avatarIndexFor(nick), gameCode, gameName: SLOTS.find((s) => s.code === gameCode).name,
  win, multiplier, tier, at: minutesAgo(min),
}));

const DEMO_LEADERS = EMPTY ? [] : [
  ['Złota_Ola', 48_000, 'zloty-faraon', 2, 61_250], ['Kryształ', 12_400, 'krysztalowa-kaskada', 15, 38_900],
  ['NeonKuba', 10_000, 'cebulowy-777', 7, 22_410], ['Faraon99', 6_000, 'zloty-faraon', 41, 19_870],
  ['Kamil_77', 3_500, 'cebulowy-777', 26, 15_300], ['Zosia-W', 3_200, 'krysztalowa-kaskada', 63, 12_050],
  ['MistrzCebuli', 1_500, 'cebulowy-777', 95, 9_870], ['Bartek_K', 1_200, 'zloty-faraon', 180, 8_200],
].map(([nick, biggestWin, gameCode, min, balance]) => ({ nick, biggestWin, gameCode, at: minutesAgo(min), balance }));

// ----------------------------------------------------------------------------------------------------- pomocnicze HTTP

function send(res, status, body, headers = {}) {
  const payload = body === undefined ? '' : JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    ...headers,
  });
  res.end(payload);
}

/** Błąd w formacie ProblemDetail (RFC 9457) z polem `code` — dokładnie jak w kontrakcie § 1. */
function problem(res, status, code, title, detail, extra = {}) {
  send(res, status, { type: 'about:blank', title, status, detail, code, ...extra }, {
    'Content-Type': 'application/problem+json; charset=utf-8',
  });
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (!chunks.length) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    return null;
  }
}

function cookies(req) {
  return Object.fromEntries(
    (req.headers.cookie ?? '').split(';').map((c) => c.trim().split('=')).filter(([k]) => k),
  );
}

function currentPlayer(req) {
  const sid = cookies(req)[SESSION_COOKIE];
  const key = sid && sessions.get(sid);
  return key ? players.get(key) : null;
}

function rescueState(p) {
  const bankrupt = p.balance < MIN_BET;
  const elapsed = p.lastRescueAt ? (Date.now() - p.lastRescueAt) / 1000 : Infinity;
  const wait = Math.max(0, Math.ceil(RESCUE_COOLDOWN_S - elapsed));
  return { canRescue: bankrupt && wait === 0, rescueAvailableInSeconds: bankrupt ? wait : 0 };
}

/** Obiekt `player` z kontraktu § 2.1. */
function playerDto(p) {
  return {
    id: p.id, nick: p.nick, avatarIndex: p.avatarIndex, balance: p.balance, minBet: MIN_BET,
    ...rescueState(p), createdAt: p.createdAt,
  };
}

function page(items, url) {
  const pageNo = Math.max(0, Number(url.searchParams.get('page') ?? 0));
  const size = Math.min(100, Math.max(1, Number(url.searchParams.get('size') ?? 20)));
  return {
    items: items.slice(pageNo * size, pageNo * size + size), page: pageNo, size,
    totalItems: items.length, totalPages: Math.ceil(items.length / size),
  };
}

// ----------------------------------------------------------------------------------------------------- endpointy

async function handleApi(req, res, url) {
  const route = `${req.method} ${url.pathname}`;

  if (route === 'POST /api/auth/login') {
    const body = await readBody(req);
    const nick = typeof body?.nick === 'string' ? body.nick.trim() : '';
    if (!NICK_PATTERN.test(nick)) {
      return problem(res, 400, 'NICK_INVALID', 'Niepoprawna nazwa gracza',
        'Nazwa gracza musi mieć 3–16 znaków: litery (także polskie), cyfry, _ lub -.',
        { errors: [{ field: 'nick', message: 'Nazwa gracza musi mieć 3–16 znaków: litery, cyfry, _ lub -.' }] });
    }
    if (FORBIDDEN.some((w) => nick.toLowerCase().includes(w))) {
      return problem(res, 400, 'NICK_FORBIDDEN', 'Niedozwolona nazwa gracza', 'Ta nazwa gracza jest niedozwolona. Wybierz inną.');
    }
    const key = nick.toLowerCase();
    let p = players.get(key);
    const newPlayer = !p;
    if (!p) {
      p = { id: nextId++, nick, avatarIndex: avatarIndexFor(nick), balance: WELCOME_BONUS, createdAt: new Date().toISOString(), lastRescueAt: null, history: [] };
      players.set(key, p);
    }
    const sid = randomUUID();
    sessions.set(sid, key);
    return send(res, 200, { player: playerDto(p), newPlayer, welcomeBonus: newPlayer ? WELCOME_BONUS : 0 }, {
      'Set-Cookie': `${SESSION_COOKIE}=${sid}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${7 * 24 * 3600}`,
    });
  }

  if (route === 'POST /api/auth/logout') {
    const sid = cookies(req)[SESSION_COOKIE];
    if (sid) sessions.delete(sid);
    res.writeHead(204, { 'Set-Cookie': `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0` });
    return res.end();
  }

  if (route === 'GET /api/slots') return send(res, 200, SLOTS);

  const slotMatch = url.pathname.match(/^\/api\/slots\/([a-z0-9-]+)$/);
  if (req.method === 'GET' && slotMatch) {
    const slot = SLOTS.find((s) => s.code === slotMatch[1]);
    if (!slot) return problem(res, 404, 'GAME_NOT_FOUND', 'Nie ma takiej gry', `Nie znaleziono automatu „${slotMatch[1]}”.`);
    const d = DETAILS[slot.code];
    return send(res, 200, {
      ...slot,
      symbols: d.symbols.map(([code, kind, pays]) => ({ code, kind, pays })),
      features: d.features,
    });
  }

  if (route === 'GET /api/leaderboard') {
    const type = url.searchParams.get('type') ?? 'biggest-win';
    const limit = Math.min(100, Number(url.searchParams.get('limit') ?? 10));
    const real = [...players.values()].map((p) => ({ nick: p.nick, biggestWin: 0, gameCode: null, at: p.createdAt, balance: p.balance }));
    const rows = type === 'balance'
      ? [...DEMO_LEADERS, ...real].sort((a, b) => b.balance - a.balance).map((r) => ({ ...r, value: r.balance, gameCode: null }))
      : DEMO_LEADERS.map((r) => ({ ...r, value: r.biggestWin }));
    return send(res, 200, rows.slice(0, limit).map((r, i) => ({
      rank: i + 1, nick: r.nick, avatarIndex: avatarIndexFor(r.nick), value: r.value, gameCode: r.gameCode, at: r.at,
    })));
  }

  if (route === 'GET /api/feed/big-wins') {
    const limit = Math.min(50, Number(url.searchParams.get('limit') ?? 10));
    return send(res, 200, DEMO_FEED.slice(0, limit));
  }

  if (req.method === 'POST' && /^\/api\/slots\/[^/]+\/spins$/.test(url.pathname)) {
    return problem(res, 501, 'NOT_IMPLEMENTED_IN_MOCK', 'Atrapa nie liczy spinów',
      'Spiny liczy serwer w Javie. Uruchom aplikację Spring Boot albo rozbuduj atrapę w kolejnym etapie.');
  }

  // --- poniżej endpointy wymagające zalogowanego gracza
  const p = currentPlayer(req);
  if (url.pathname.startsWith('/api/me') || url.pathname.startsWith('/api/dev')) {
    if (!p) return problem(res, 401, 'NOT_LOGGED_IN', 'Nie jesteś zalogowany', 'Zaloguj się nazwą gracza, aby kontynuować.');
  }

  if (route === 'GET /api/me') return send(res, 200, playerDto(p));

  if (route === 'POST /api/me/rescue') {
    const st = rescueState(p);
    if (!st.canRescue) {
      return problem(res, 409, 'RESCUE_NOT_AVAILABLE', 'Bonus ratunkowy niedostępny',
        p.balance >= MIN_BET ? 'Bonus ratunkowy przysługuje, gdy saldo spadnie poniżej minimalnego zakładu.' : 'Bonus ratunkowy będzie dostępny za chwilę.',
        st.rescueAvailableInSeconds ? { retryAfterSeconds: st.rescueAvailableInSeconds } : {});
    }
    p.balance += RESCUE_BONUS;
    p.lastRescueAt = Date.now();
    return send(res, 200, { player: playerDto(p), amount: RESCUE_BONUS });
  }

  if (route === 'GET /api/me/history') return send(res, 200, page(p.history, url));
  if (route === 'GET /api/me/transactions') return send(res, 200, page([], url));
  if (route === 'GET /api/me/stats') return send(res, 200, []);

  if (route === 'POST /api/dev/gracz') {
    // TYLKO ATRAPA: { balance?: number, rescueCooldownSeconds?: number, demoHistory?: number }
    const body = (await readBody(req)) ?? {};
    if (Number.isFinite(body.balance)) p.balance = Math.max(0, Math.round(body.balance));
    if (Number.isFinite(body.rescueCooldownSeconds)) {
      p.lastRescueAt = body.rescueCooldownSeconds > 0 ? Date.now() - (RESCUE_COOLDOWN_S - body.rescueCooldownSeconds) * 1000 : null;
    }
    if (Number.isFinite(body.demoHistory)) p.history = demoHistory(body.demoHistory);
    return send(res, 200, playerDto(p));
  }

  return problem(res, 404, 'NOT_FOUND', 'Nie ma takiego zasobu', `Atrapa nie obsługuje ${route}.`);
}

/** Przykładowa historia rund (tylko przez /api/dev/gracz) — do oglądania wyglądu okna „Historia gry”. */
function demoHistory(n) {
  // tier jak w kontrakcie 09 § 2.4 i w backendzie: 'none' (a nie null) dla rundy bez wygranej
  const tiers = [[0, 'none'], [0.4, 'small'], [2, 'small'], [6, 'medium'], [0, 'none'], [18, 'big'], [1.2, 'small'], [0, 'none']];
  return Array.from({ length: n }, (_, i) => {
    const slot = SLOTS[i % SLOTS.length];
    const bet = slot.betLevels[(i * 3) % 4];
    const [mult, tier] = tiers[i % tiers.length];
    return {
      roundId: 9000 - i, gameCode: slot.code, gameName: slot.name, bet, win: Math.round(bet * mult),
      multiplier: mult, tier, status: 'SETTLED', createdAt: minutesAgo(i * 3 + 1),
    };
  });
}

// ----------------------------------------------------------------------------------------------------- pliki statyczne

const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.avif': 'image/avif',
  '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.woff': 'font/woff', '.txt': 'text/plain; charset=utf-8',
  '.mp4': 'video/mp4', '.webm': 'video/webm', '.m4a': 'audio/mp4', '.ogg': 'audio/ogg', '.map': 'application/json',
};

async function serveStatic(req, res, url) {
  let rel = decodeURIComponent(url.pathname);
  if (rel.endsWith('/')) rel += 'index.html';
  const file = path.resolve(STATIC_ROOT, '.' + rel);
  // Ochrona przed "../" (path traversal): plik musi leżeć wewnątrz katalogu static.
  if (!file.startsWith(STATIC_ROOT + path.sep)) return notFound(res);

  let info;
  try {
    info = await stat(file);
    if (info.isDirectory()) return serveStatic(req, res, new URL(url.pathname + '/', url));
  } catch {
    if (url.pathname === '/h2-console' || url.pathname.startsWith('/h2-console/')) return h2Info(res);
    return notFound(res);
  }

  const type = MIME[path.extname(file).toLowerCase()] ?? 'application/octet-stream';
  const headers = { 'Content-Type': type, 'Cache-Control': 'no-cache', 'Accept-Ranges': 'bytes' };

  // Obsługa nagłówka Range — przeglądarki pobierają wideo kawałkami (odpowiedź 206).
  const range = req.headers.range?.match(/^bytes=(\d*)-(\d*)$/);
  if (range) {
    const start = range[1] ? Number(range[1]) : 0;
    const end = range[2] ? Math.min(Number(range[2]), info.size - 1) : info.size - 1;
    if (start > end || start >= info.size) {
      res.writeHead(416, { 'Content-Range': `bytes */${info.size}` });
      return res.end();
    }
    res.writeHead(206, { ...headers, 'Content-Range': `bytes ${start}-${end}/${info.size}`, 'Content-Length': end - start + 1 });
    if (req.method === 'HEAD') return res.end();
    return createReadStream(file, { start, end }).pipe(res);
  }

  res.writeHead(200, { ...headers, 'Content-Length': info.size });
  if (req.method === 'HEAD') return res.end();
  createReadStream(file).pipe(res);
}

function notFound(res) {
  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('404 — nie ma takiego pliku');
}

function h2Info(res) {
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end('<!doctype html><meta charset="utf-8"><title>Konsola H2</title><body style="font:16px system-ui;background:#07060F;color:#C9C3E6;padding:32px">'
    + '<h1 style="color:#F5C542">Konsola H2</h1><p>To jest serwer atrapa (tools/dev/mock-api.mjs). Konsola bazy H2 działa w prawdziwej aplikacji Spring Boot: '
    + '<code>mvn spring-boot:run</code> → <code>http://localhost:8080/h2-console</code>.</p><p><a style="color:#FFE08A" href="/">← Wróć do lobby</a></p></body>');
}

// ----------------------------------------------------------------------------------------------------- serwer

const server = http.createServer(async (req, res) => {
  const started = Date.now();
  const url = new URL(req.url, `http://${req.headers.host ?? 'localhost'}`);
  res.on('finish', () => {
    if (!QUIET) console.log(`${req.method.padEnd(4)} ${url.pathname}${url.search} → ${res.statusCode} (${Date.now() - started} ms)`);
  });
  try {
    if (url.pathname.startsWith('/api/')) {
      if (DELAY_MS) await new Promise((r) => setTimeout(r, DELAY_MS));
      return await handleApi(req, res, url);
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405, { Allow: 'GET, HEAD' });
      return res.end();
    }
    return await serveStatic(req, res, url);
  } catch (err) {
    console.error(err);
    if (!res.headersSent) problem(res, 500, 'INTERNAL_ERROR', 'Błąd serwera', 'Wystąpił nieoczekiwany błąd.');
  }
});

server.listen(PORT, () => {
  console.log(`Atrapa API Cebulion Casino: http://localhost:${PORT}  (pliki: ${path.relative(process.cwd(), STATIC_ROOT) || STATIC_ROOT})`);
  console.log(`Tryb: ${EMPTY ? 'pusty ranking i feed' : 'dane demonstracyjne'}${DELAY_MS ? `, opóźnienie ${DELAY_MS} ms` : ''}. Prawdziwe API: Spring Boot (mvn spring-boot:run, port 8080).`);
});
