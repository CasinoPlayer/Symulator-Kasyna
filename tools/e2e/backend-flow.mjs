// =====================================================================================================
// tools/e2e/backend-flow.mjs — scenariusz gracza na PRAWDZIWYM backendzie (Spring Boot + H2), w przeglądarce.
//
// Po co: smoke.mjs sprawdza wygląd i zachowanie lobby; ten skrypt sprawdza, czy pieniądze się zgadzają, gdy gracz
// naprawdę gra. Żądania idą przez fetch z kontekstu strony (to samo ciasteczko sesji HttpOnly, ten sam adres co
// lobby), więc testujemy dokładnie tę drogę, którą idzie przeglądarka gracza.
//
// Scenariusz:
//   1. lobby z prawdziwego serwera, logowanie nowym graczem przez okno „Zaloguj” → saldo 10 000 (WELCOME_BONUS),
//   2. po 30 spinów w każdej z 3 gier: kształt odpowiedzi (kontrakt 09 § 2.4), balanceBefore = poprzednie balanceAfter,
//      balanceAfter = balanceBefore − bet + totalWin, ostatni krok z totalWin = totalWin rundy,
//   3. idempotencja: ten sam Idempotency-Key → ta sama runda (bajt w bajt, nagłówek Idempotent-Replayed), bez drugiego
//      zakładu; ten sam klucz z innym zakładem → 409 IDEMPOTENCY_CONFLICT,
//   4. gra do pierwszej dużej wygranej (≥ 15×), żeby feed miał co pokazać,
//   5. suma kwot wszystkich transakcji = saldo; historia i statystyki zgodne z liczbą rund,
//   6. bankructwo → bonus ratunkowy: 409 przy wysokim saldzie, 200 po bankructwie, po kolejnym bankructwie 409
//      z retryAfterSeconds (odliczanie 10 minut), INSUFFICIENT_FUNDS przy saldzie poniżej zakładu,
//   7. ranking, feed i 5 raportów inwestora niepuste i zgodne z grą; lobby po odświeżeniu pokazuje gracza w rankingu
//      i w feedzie (feed był w pamięci podręcznej przed grą: sprawdza unieważnienie zdarzeniem po commicie),
//   8. wylogowanie → 401.
//
// Uruchomienie (najpierw aplikacja, np. java -jar target/*.jar --server.port=8088):
//   cd tools && node e2e/backend-flow.mjs http://localhost:8088
// Przeglądarka: Chromium z /opt/pw-browsers (albo PW_CHROMIUM=/ścieżka/do/chrome), playwright-core bez `install`.
// Kod wyjścia: 0 = wszystko OK, 1 = co najmniej jedno sprawdzenie nie przeszło, 2 = błąd skryptu.
// =====================================================================================================

import { chromium } from 'playwright-core';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BASE = (process.argv[2] ?? 'http://localhost:8080').replace(/\/$/, '');
const OUT = path.resolve(process.argv[3] ?? path.join(HERE, 'zrzuty', 'backend'));
const EXECUTABLE = process.env.PW_CHROMIUM ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

const SPINS_PER_GAME = 30;
const BIG_WIN_HUNT_LIMIT = 1500;
const BANKRUPTCY_LIMIT = 5000;
const BIG_TIERS = new Set(['big', 'mega', 'epic', 'ultra']);

const results = [];
const warnings = [];
const consoleErrors = [];

function check(name, ok, details = '') {
  results.push({ name, ok: Boolean(ok), details });
  console.log(`${ok ? '✔' : '✘'} ${name}${details ? ` — ${details}` : ''}`);
}

const norm = (s) => (s ?? '').replace(/\s+/g, ' ').trim();

/** Żądanie do API z kontekstu strony (fetch przeglądarki: ciasteczko sesji, ten sam adres co lobby). */
async function call(page, method, apiPath, { body, headers = {} } = {}) {
  return page.evaluate(async ({ method, url, body, headers }) => {
    const response = await fetch(url, {
      method,
      credentials: 'same-origin',
      cache: 'no-store',
      headers: {
        Accept: 'application/json, application/problem+json',
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...headers,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const text = await response.text();
    let json = null;
    try { json = text ? JSON.parse(text) : null; } catch { /* nie-JSON */ }
    return { status: response.status, headers: Object.fromEntries(response.headers.entries()), text, json };
  }, { method, url: `api/${apiPath}`, body, headers });
}

/** Stan gracza po stronie testu: łańcuch sald i liczniki rund. */
const state = {
  balance: null,          // ostatnie znane saldo (balanceAfter ostatniej rundy albo saldo z /api/me)
  rounds: 0,              // rundy rozegrane (bez powtórek idempotentnych)
  roundsByGame: {},
  chainBreaks: [],        // naruszenia balanceBefore === poprzednie balanceAfter
  mathBreaks: [],         // naruszenia balanceAfter === balanceBefore − bet + totalWin
  shapeBreaks: [],        // naruszenia kształtu odpowiedzi
  stepBreaks: [],         // ostatni krok z totalWin ≠ totalWin rundy
  biggestWin: 0,
  bigWins: [],
};

/** Jeden spin z pełnym sprawdzeniem odpowiedzi; zwraca odpowiedź (także błędną). */
async function spin(page, game, bet, { key = randomUUID(), expectOk = true } = {}) {
  const res = await call(page, 'POST', `slots/${game}/spins`, { body: { bet }, headers: { 'Idempotency-Key': key } });
  if (res.status !== 200) {
    if (expectOk) state.shapeBreaks.push(`${game} bet=${bet}: HTTP ${res.status} ${res.json?.code ?? ''}`);
    return res;
  }
  const r = res.json;
  const label = `${game}#${r?.roundId}`;
  const shapeOk = r && Number.isInteger(r.roundId) && r.gameCode === game && r.bet === bet
    && Number.isFinite(r.totalWin) && r.totalWin >= 0 && Number.isFinite(r.multiplier) && typeof r.tier === 'string'
    && Number.isFinite(r.balanceBefore) && Number.isFinite(r.balanceAfter) && /^[0-9a-f]{16}$/.test(r.seed ?? '')
    && Array.isArray(r.steps) && r.steps.length > 0 && r.steps[0].type === 'spin';
  if (!shapeOk) state.shapeBreaks.push(`${label}: ${res.text.slice(0, 160)}`);
  if (state.balance !== null && r.balanceBefore !== state.balance) {
    state.chainBreaks.push(`${label}: balanceBefore ${r.balanceBefore} ≠ poprzednie saldo ${state.balance}`);
  }
  if (r.balanceAfter !== r.balanceBefore - r.bet + r.totalWin) {
    state.mathBreaks.push(`${label}: ${r.balanceBefore} − ${r.bet} + ${r.totalWin} ≠ ${r.balanceAfter}`);
  }
  const withTotals = r.steps.filter((s) => Number.isFinite(s.totalWin));
  const lastTotal = withTotals.length ? withTotals.at(-1).totalWin : 0;
  if (lastTotal !== r.totalWin) state.stepBreaks.push(`${label}: ostatni totalWin w krokach ${lastTotal} ≠ ${r.totalWin}`);
  if (res.headers['idempotent-replayed'] !== 'true') {
    state.rounds += 1;
    state.roundsByGame[game] = (state.roundsByGame[game] ?? 0) + 1;
    state.balance = r.balanceAfter;
    state.biggestWin = Math.max(state.biggestWin, r.totalWin);
    if (BIG_TIERS.has(r.tier)) state.bigWins.push({ game, roundId: r.roundId, win: r.totalWin, multiplier: r.multiplier, tier: r.tier });
  }
  return res;
}

/** Wszystkie transakcje gracza (strony po 100). */
async function allTransactions(page) {
  const items = [];
  for (let p = 0; p < 1000; p++) {
    const res = await call(page, 'GET', `me/transactions?page=${p}&size=100`);
    if (res.status !== 200) throw new Error(`GET me/transactions → ${res.status}`);
    items.push(...res.json.items);
    if (p + 1 >= res.json.totalPages) break;
  }
  return items;
}

/** Gra najwyższym dostępnym zakładem, aż saldo spadnie poniżej najmniejszego zakładu w kasynie. */
async function goBankrupt(page, games, minBet) {
  const levels = games.flatMap((g) => g.betLevels.map((bet) => ({ game: g.code, bet }))).sort((a, b) => b.bet - a.bet);
  let spins = 0;
  while (state.balance >= minBet && spins < BANKRUPTCY_LIMIT) {
    const choice = levels.find((l) => l.bet <= state.balance);
    await spin(page, choice.game, choice.bet);
    spins += 1;
  }
  return spins;
}

async function waitForLobby(page) {
  await page.goto(`${BASE}/`, { waitUntil: 'load' });
  await page.waitForSelector('#kafle .tile:not(.tile--skeleton)', { timeout: 15_000 });
  await page.waitForFunction(() => document.body.classList.contains('is-ready'));
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch({ executablePath: EXECUTABLE, args: ['--disable-gpu-sandbox'] });
  const context = await browser.newContext({ viewport: { width: 1366, height: 768 }, locale: 'pl-PL' });
  const page = await context.newPage();
  page.on('pageerror', (err) => consoleErrors.push(`wyjątek JS: ${err.message}`));
  page.on('console', (msg) => {
    if (msg.type() !== 'error') return;
    const url = msg.location()?.url ?? '';
    // celowe błędy HTTP z tego scenariusza (409 przy ratunku, idempotencji, bankructwie; 401 po wylogowaniu)
    if (/\/api\/(me\/rescue|slots\/.+\/spins|me)$/.test(url)) return;
    if (/\/assets\/(img|audio)\/manifest\.json/.test(url)) { warnings.push(`brak opcjonalnego zasobu: ${url}`); return; }
    consoleErrors.push(`console.error: ${msg.text()}${url ? ` (${url})` : ''}`);
  });
  const shot = (name) => page.screenshot({ path: path.join(OUT, `${name}.png`) });
  const nick = `Flow_${Date.now().toString(36).slice(-6)}`;

  // ------------------------------------------------------------------ 1. lobby i logowanie nowym graczem
  await waitForLobby(page);
  const slotsRes = await call(page, 'GET', 'slots');
  const games = slotsRes.json ?? [];
  check('GET /api/slots: 3 automaty z data.sql', slotsRes.status === 200 && games.length === 3,
    games.map((g) => g.code).join(', '));
  const minBet = Math.min(...games.map((g) => g.minBet));

  // lobby właśnie pobrało feed i ranking (trafiły do pamięci podręcznej serwera, zanim ten gracz zagrał)
  const feedBefore = await call(page, 'GET', 'feed/big-wins?limit=8');
  check('feed przed grą odpowiada 200', feedBefore.status === 200);

  await page.click('#btn-zaloguj');
  await page.waitForSelector('#modal-logowanie.is-open');
  await page.fill('#nick', nick);
  await page.keyboard.press('Enter');
  await page.waitForSelector('#topbar-gracz:not([hidden])', { timeout: 10_000 });
  await page.waitForSelector('.reward', { state: 'detached', timeout: 15_000 }).catch(() => {});
  await page.waitForFunction(() => document.querySelector('#saldo .balance-pill__value')?.textContent.replace(/\s/g, ' ') === '10 000', null, { timeout: 8000 }).catch(() => {});
  check(`logowanie w lobby nowym graczem ${nick}: saldo 10 000 w pasku`, norm(await page.textContent('#saldo .balance-pill__value')) === '10 000');
  const me = await call(page, 'GET', 'me');
  check('GET /api/me: saldo 10 000, minBet z katalogu, ratunek niedostępny', me.status === 200 && me.json.balance === 10000
    && me.json.minBet === minBet && me.json.canRescue === false, JSON.stringify(me.json));
  state.balance = me.json.balance;
  const firstTx = await allTransactions(page);
  check('jedna transakcja WELCOME_BONUS 10 000', firstTx.length === 1 && firstTx[0].type === 'WELCOME_BONUS' && firstTx[0].amount === 10000);
  await shot('01-zalogowany');

  // ------------------------------------------------------------------ 2. 30 spinów w każdej grze
  for (const game of games) {
    const bets = game.betLevels.slice(0, 3);
    for (let i = 0; i < SPINS_PER_GAME; i++) await spin(page, game.code, bets[i % bets.length]);
    check(`${SPINS_PER_GAME} spinów w ${game.name}`, state.roundsByGame[game.code] === SPINS_PER_GAME, `rundy: ${state.roundsByGame[game.code] ?? 0}`);
  }
  check('odpowiedzi spinu w kształcie kontraktu § 2.4 (seed hex, kroki, pola liczbowe)', state.shapeBreaks.length === 0, state.shapeBreaks.slice(0, 3).join(' | '));
  check('łańcuch sald: balanceBefore = poprzednie balanceAfter', state.chainBreaks.length === 0, state.chainBreaks.slice(0, 3).join(' | '));
  check('balanceAfter = balanceBefore − bet + totalWin', state.mathBreaks.length === 0, state.mathBreaks.slice(0, 3).join(' | '));
  check('ostatni krok z totalWin = totalWin rundy', state.stepBreaks.length === 0, state.stepBreaks.slice(0, 3).join(' | '));
  const meAfterSpins = await call(page, 'GET', 'me');
  check('GET /api/me po grze = balanceAfter ostatniej rundy', meAfterSpins.json.balance === state.balance, `${meAfterSpins.json.balance} vs ${state.balance}`);

  // ------------------------------------------------------------------ 3. idempotencja
  {
    const key = randomUUID();
    const game = games[0];
    const first = await spin(page, game.code, game.betLevels[0], { key });
    const replay = await spin(page, game.code, game.betLevels[0], { key });
    check('idempotencja: ten sam klucz → ta sama runda, identyczna treść, Idempotent-Replayed: true',
      first.status === 200 && replay.status === 200 && replay.text === first.text && replay.headers['idempotent-replayed'] === 'true'
      && first.headers['idempotent-replayed'] === undefined, `roundId ${first.json?.roundId} / ${replay.json?.roundId}`);
    const meNow = await call(page, 'GET', 'me');
    check('idempotencja: powtórka nie pobrała drugiego zakładu', meNow.json.balance === first.json.balanceAfter, `${meNow.json.balance}`);
    const conflict = await call(page, 'POST', `slots/${game.code}/spins`, { body: { bet: game.betLevels[1] }, headers: { 'Idempotency-Key': key } });
    check('idempotencja: ten sam klucz z innym zakładem → 409 IDEMPOTENCY_CONFLICT', conflict.status === 409 && conflict.json?.code === 'IDEMPOTENCY_CONFLICT');
    const badBet = await call(page, 'POST', `slots/${game.code}/spins`, { body: { bet: 7 }, headers: { 'Idempotency-Key': randomUUID() } });
    check('zakład spoza betLevels → 400 BET_INVALID (bez zmiany salda)', badBet.status === 400 && badBet.json?.code === 'BET_INVALID');
  }

  // ------------------------------------------------------------------ 4. gra do dużej wygranej (feed ≥ 15×)
  {
    const faraon = games.find((g) => g.code === 'zloty-faraon') ?? games[1];
    let hunt = 0;
    while (state.bigWins.length === 0 && hunt < BIG_WIN_HUNT_LIMIT && state.balance >= faraon.minBet) {
      await spin(page, faraon.code, faraon.minBet);
      hunt += 1;
    }
    check('duża wygrana (≥ 15×) padła w trakcie gry', state.bigWins.length > 0,
      state.bigWins.length ? `${state.bigWins[0].game} ${state.bigWins[0].win} (${state.bigWins[0].multiplier}×, ${state.bigWins[0].tier}) po ${hunt} dodatkowych spinach` : `brak po ${hunt} spinach`);
  }

  // ------------------------------------------------------------------ 5. księga: suma transakcji = saldo
  {
    const tx = await allTransactions(page);
    const sum = tx.reduce((acc, t) => acc + t.amount, 0);
    const meNow = await call(page, 'GET', 'me');
    check('suma kwot transakcji = saldo gracza', sum === meNow.json.balance && meNow.json.balance === state.balance, `suma ${sum}, saldo ${meNow.json.balance}`);
    const bets = tx.filter((t) => t.type === 'BET');
    check('liczba zakładów (BET) = liczba rund', bets.length === state.rounds, `${bets.length} vs ${state.rounds}`);
    check('każdy BET ujemny, każdy WIN dodatni, balanceAfter ≥ 0', tx.every((t) => (t.type !== 'BET' || t.amount < 0) && (t.type !== 'WIN' || t.amount > 0) && t.balanceAfter >= 0));
    const history = await call(page, 'GET', 'me/history?page=0&size=5');
    check('historia rund: totalItems = liczba rund, status SETTLED', history.json.totalItems === state.rounds && history.json.items.every((i) => i.status === 'SETTLED'));
    const stats = await call(page, 'GET', 'me/stats');
    const statsOk = games.every((g) => stats.json.find((s) => s.gameCode === g.code)?.spins === state.roundsByGame[g.code]);
    check('statystyki per automat zgodne z liczbą rund', statsOk, stats.json.map((s) => `${s.gameCode}:${s.spins}`).join(', '));
    const statsBiggest = Math.max(...stats.json.map((s) => s.biggestWin));
    check('statystyki: rekord = największa wygrana z gry', statsBiggest === state.biggestWin, `${statsBiggest} vs ${state.biggestWin}`);
  }

  // ------------------------------------------------------------------ 6. bankructwo → bonus ratunkowy
  {
    const early = await call(page, 'POST', 'me/rescue');
    check('ratunek przy wysokim saldzie → 409 RESCUE_NOT_AVAILABLE (bez odliczania)', early.status === 409
      && early.json?.code === 'RESCUE_NOT_AVAILABLE' && early.json?.retryAfterSeconds == null);

    const spinsToBankrupt = await goBankrupt(page, games, minBet);
    const broke = await call(page, 'GET', 'me');
    check('bankructwo: saldo poniżej najmniejszego zakładu, canRescue = true', broke.json.balance < minBet && broke.json.canRescue === true,
      `saldo ${broke.json.balance} po ${spinsToBankrupt} spinach`);
    const tooPoor = await call(page, 'POST', `slots/${games[0].code}/spins`, { body: { bet: games[0].minBet }, headers: { 'Idempotency-Key': randomUUID() } });
    check('spin bez środków → 409 INSUFFICIENT_FUNDS', tooPoor.status === 409 && tooPoor.json?.code === 'INSUFFICIENT_FUNDS');

    await page.reload({ waitUntil: 'load' });
    await page.waitForSelector('#ratunek:not([hidden])', { timeout: 8000 }).catch(() => {});
    check('lobby: bankrut widzi przycisk bonusu ratunkowego', await page.isVisible('#btn-ratunek'));
    await shot('02-bankrut');

    const rescue = await call(page, 'POST', 'me/rescue');
    check('ratunek po bankructwie → 200, +10 000', rescue.status === 200 && rescue.json.amount === 10000
      && rescue.json.player.balance === broke.json.balance + 10000, JSON.stringify(rescue.json?.player ?? rescue.json));
    state.balance = rescue.json.player.balance;

    const second = await goBankrupt(page, games, minBet);
    const brokeAgain = await call(page, 'GET', 'me');
    check('drugie bankructwo: canRescue = false, trwa odliczanie', brokeAgain.json.balance < minBet && brokeAgain.json.canRescue === false
      && brokeAgain.json.rescueAvailableInSeconds > 0, `po ${second} spinach, za ${brokeAgain.json.rescueAvailableInSeconds} s`);
    const cooling = await call(page, 'POST', 'me/rescue');
    check('ratunek przed upływem 10 minut → 409 z retryAfterSeconds i nagłówkiem Retry-After', cooling.status === 409
      && cooling.json?.code === 'RESCUE_NOT_AVAILABLE' && cooling.json?.retryAfterSeconds > 0 && cooling.json?.retryAfterSeconds <= 600
      && cooling.headers['retry-after'] === String(cooling.json?.retryAfterSeconds), `retryAfterSeconds=${cooling.json?.retryAfterSeconds}`);

    const tx = await allTransactions(page);
    const sum = tx.reduce((acc, t) => acc + t.amount, 0);
    check('po bankructwach i ratunku: suma transakcji = saldo, dokładnie 1 RESCUE_BONUS', sum === brokeAgain.json.balance
      && tx.filter((t) => t.type === 'RESCUE_BONUS').length === 1, `suma ${sum}, saldo ${brokeAgain.json.balance}, transakcji ${tx.length}`);
    check('łańcuch sald i rachunek rund bez błędów także w bankructwie', state.chainBreaks.length === 0 && state.mathBreaks.length === 0
      && state.shapeBreaks.length === 0 && state.stepBreaks.length === 0,
      [...state.chainBreaks, ...state.mathBreaks, ...state.shapeBreaks, ...state.stepBreaks].slice(0, 3).join(' | '));
  }

  // ------------------------------------------------------------------ 7. ranking, feed, raporty
  {
    const top = await call(page, 'GET', 'leaderboard?type=biggest-win&limit=100');
    const mine = top.json?.find((row) => row.nick === nick);
    check('ranking „największa wygrana”: gracz z rekordem z gry', mine && mine.value === state.biggestWin, mine ? `#${mine.rank} ${mine.value}` : 'brak gracza');
    const balances = await call(page, 'GET', 'leaderboard?type=balance&limit=100');
    const sorted = (balances.json ?? []).every((row, i, arr) => i === 0 || arr[i - 1].value >= row.value);
    check('ranking sald: niepusty, malejąco', balances.status === 200 && balances.json.length > 0 && sorted);
    const feed = await call(page, 'GET', 'feed/big-wins?limit=100');
    const myFeed = (feed.json ?? []).filter((w) => w.nick === nick);
    check('feed dużych wygranych: wygrane gracza (≥ 15×) widoczne od razu po grze', myFeed.length >= state.bigWins.length && state.bigWins.length > 0,
      `w feedzie ${myFeed.length}, dużych wygranych w grze ${state.bigWins.length}`);
    check('feed: same wygrane ≥ 15× zakładu', (feed.json ?? []).every((w) => w.multiplier >= 15));

    const popular = await call(page, 'GET', 'reports/popular-games?days=7');
    check('raport 1 (popularność): spiny każdej gry ≥ rundy gracza', popular.status === 200
      && games.every((g) => (popular.json.find((p) => p.gameCode === g.code)?.spins ?? 0) >= (state.roundsByGame[g.code] ?? 0)));
    const rtp = await call(page, 'GET', 'reports/rtp');
    check('raport 2 (RTP): każda gra ma rundy i rzeczywisty RTP', rtp.status === 200 && rtp.json.length === 3
      && rtp.json.every((r) => r.spins > 0 && Number.isFinite(r.actualRtp)), rtp.json.map((r) => `${r.gameCode}: ${r.actualRtp}% / ${r.targetRtp}%`).join(', '));
    const players = await call(page, 'GET', 'reports/top-players?limit=100');
    check('raport 3 (liderzy): obie listy niepuste, gracz w rankingu wygranych', players.status === 200
      && players.json.byNetResult.length > 0 && players.json.byBiggestWin.some((p) => p.nick === nick));
    const economy = await call(page, 'GET', 'reports/economy');
    check('raport 4 (gospodarka): gracze, bankruci, bonusy', economy.status === 200 && economy.json.players >= 1
      && economy.json.bankruptPlayers >= 1 && economy.json.totalRescueBonus >= 10000 && economy.json.totalWelcomeBonus >= 10000,
      JSON.stringify(economy.json));
    const peak = await call(page, 'GET', 'reports/peak-hours');
    const peakSpins = (peak.json ?? []).reduce((acc, h) => acc + h.spins, 0);
    check('raport 5 (godziny): niepusty, suma spinów ≥ rundy gracza', peak.status === 200 && peak.json.length > 0 && peakSpins >= state.rounds, `suma ${peakSpins}`);

    // lobby po odświeżeniu: gracz w rankingu i w feedzie (front pokazuje to, co zwraca backend)
    await waitForLobby(page);
    await page.locator('#wygrane').scrollIntoViewIfNeeded().catch(() => {});
    await page.waitForFunction((n) => document.querySelector('#ranking-lista')?.textContent.includes(n), nick, { timeout: 8000 }).catch(() => {});
    check('lobby: gracz w rankingu „największa wygrana”', norm(await page.textContent('#ranking-lista')).includes(nick));
    await page.waitForFunction((n) => document.querySelector('#feed')?.textContent.includes(n), nick, { timeout: 8000 }).catch(() => {});
    check('lobby: duża wygrana gracza w feedzie', norm(await page.textContent('#feed')).includes(nick));
    await page.waitForTimeout(600);
    await shot('03-lobby-ranking-feed');
  }

  // ------------------------------------------------------------------ 8. wylogowanie
  {
    const out = await call(page, 'POST', 'auth/logout');
    const after = await call(page, 'GET', 'me');
    check('wylogowanie → 204, potem GET /api/me → 401 NOT_LOGGED_IN', out.status === 204 && after.status === 401 && after.json?.code === 'NOT_LOGGED_IN');
  }

  await browser.close();

  check('brak błędów w konsoli przeglądarki', consoleErrors.length === 0, consoleErrors.slice(0, 5).join(' | '));
  for (const w of [...new Set(warnings)]) console.log(`! ${w}`);

  const failed = results.filter((r) => !r.ok);
  const summary = { base: BASE, at: new Date().toISOString(), nick, rounds: state.rounds, roundsByGame: state.roundsByGame,
    biggestWin: state.biggestWin, bigWins: state.bigWins.length, results, warnings: [...new Set(warnings)], consoleErrors };
  await writeFile(path.join(OUT, 'wyniki.json'), JSON.stringify(summary, null, 2));
  console.log(`\n${results.length - failed.length}/${results.length} sprawdzeń OK, ${state.rounds} rund. Zrzuty: ${OUT}`);
  process.exit(failed.length ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(2);
});
