/**
 * Real local backend + UI checks of the debug panel. No mocked responses or injected seeds.
 * Run after the app is rebuilt/restarted with debug enabled:
 *   node tools/e2e/debug-scenarios.mjs http://localhost:8080 E:/CebulionCasino/testy/debug-scenarios
 * Browser profiles, caches, screenshots and report all stay on E:.
 */
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const BASE = (process.argv[2] ?? 'http://localhost:8080').replace(/\/$/, '');
const OUT = path.resolve(process.argv[3] ?? 'E:/CebulionCasino/testy/debug-scenarios');
assert.match(OUT, /^E:[\\/]/i, 'Output/cache directory must be on E:');
const CACHE = path.join(OUT, 'browser-cache');
await mkdir(CACHE, { recursive: true });
process.env.TEMP = CACHE;
process.env.TMP = CACHE;
process.env.TMPDIR = CACHE;
const { chromium } = await import('playwright-core');
const report = { base: BASE, at: new Date().toISOString(), checks: [], rounds: [], errors: [], failedHttp: [], requests: [] };
const scenarioButton = (id) => `#debug-scenarios button[data-debug-scenario="${id}"]`;
const games = [
  { code: 'cebulowy-777', ids: ['wild-win'], scatterTrigger: null },
  { code: 'zloty-faraon', ids: ['scatter', 'bonus'], scatterTrigger: 3 },
  { code: 'krysztalowa-kaskada', ids: ['scatter', 'bonus', 'cascade'], scatterTrigger: 4 },
];
const number = (text) => Number(String(text).replace(/[^0-9,.-]/g, '').replace(',', '.'));
function check(name, ok, details) {
  const entry = { name, ok: Boolean(ok), ...(details === undefined ? {} : { details }) };
  report.checks.push(entry);
  console.log(`${entry.ok ? 'OK' : 'FAIL'} ${name}`);
  assert.ok(entry.ok, `${name}: ${JSON.stringify(details)}`);
}
function equal(name, actual, expected) {
  check(name, JSON.stringify(actual) === JSON.stringify(expected), { actual, expected });
}
function lastGrid(response) {
  return [...response.steps].reverse().find((step) => Array.isArray(step.grid))?.grid;
}
const browser = await chromium.launch({
  executablePath: process.env.PW_CHROMIUM ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: true,
  downloadsPath: CACHE,
  args: ['--enable-unsafe-swiftshader', `--disk-cache-dir=${path.join(CACHE, 'http-cache')}`],
});
let page;
try {
  for (const viewport of [{ width: 1366, height: 768 }, { width: 320, height: 640 }]) {
    const size = `${viewport.width}x${viewport.height}`;
    const context = await browser.newContext({ viewport, deviceScaleFactor: 1, locale: 'pl-PL' });
    await context.addInitScript(() => localStorage.setItem('cebulion.audio', JSON.stringify({ muted: true })));
    page = await context.newPage();
    page.on('pageerror', (error) => report.errors.push({ size, message: error.message }));
    page.on('console', (message) => {
      if (message.type() === 'error' && !/WebGL|swiftshader|GroupMarker/.test(message.text())) {
        report.errors.push({ size, message: message.text() });
      }
    });
    page.on('response', (response) => {
      if (response.status() >= 400) report.failedHttp.push({ size, status: response.status(), url: response.url() });
    });
    page.on('request', (request) => {
      if (request.method() !== 'POST' || !/\/api\/slots\/[^/]+\/spins$/.test(new URL(request.url()).pathname)) return;
      const headers = request.headers();
      report.requests.push({ size, url: request.url(), seed: headers['x-demo-seed'] ?? null,
        idempotencyKey: headers['idempotency-key'] ?? null, body: request.postDataJSON() });
    });
    await page.goto(BASE);
    const nick = `Dbg${viewport.width}_${Date.now().toString(36).slice(-6)}`;
    const login = await context.request.post(`${BASE}/api/auth/login`, { data: { nick } });
    check(`${size}: new local QA account`, login.ok(), { status: login.status(), nick });
    await page.evaluate(() => localStorage.setItem('cebulion.sesja', '1'));

    for (const game of games) {
      const prefix = `${game.code} ${size}`;
      const metadataResponse = await context.request.get(`${BASE}/api/slots/${game.code}/debug`);
      check(`${prefix}: debug endpoint`, metadataResponse.ok(), metadataResponse.status());
      const metadata = await metadataResponse.json();
      check(`${prefix}: debug explicitly enabled`, metadata.enabled === true, metadata);
      equal(`${prefix}: available scenarios`, metadata.scenarios.map((s) => s.id).sort(), [...game.ids].sort());
      check(`${prefix}: scenarios have labels and 16-digit seeds`, metadata.scenarios.every((s) => s.label?.trim() && /^[0-9a-f]{16}$/i.test(s.seed)), metadata.scenarios);
      await page.goto(`${BASE}/gra.html?gra=${game.code}`);
      await page.locator('#btn-graj:not([hidden])').waitFor({ timeout: 60000 });
      await page.locator('#btn-graj').click();
      await page.waitForFunction(() => window.__gra?.state === 'ready', null, { timeout: 60000 });
      await page.locator('#debug-panel:not([hidden])').waitFor();
      check(`${prefix}: panel starts collapsed`, await page.locator('#debug-toggle').getAttribute('aria-expanded') !== 'true');
      const toggleRequestCount = report.requests.length;
      await page.locator('#debug-toggle').focus();
      await page.keyboard.press('Space');
      equal(`${prefix}: Space opens debug panel`, await page.locator('#debug-toggle').getAttribute('aria-expanded'), 'true');
      await page.keyboard.press('Enter');
      equal(`${prefix}: Enter closes debug panel`, await page.locator('#debug-toggle').getAttribute('aria-expanded'), 'false');
      equal(`${prefix}: toggle keys do not start a round`, report.requests.length, toggleRequestCount);
      equal(`${prefix}: ready after toggle keys`, await page.evaluate(() => window.__gra.state), 'ready');
      if (await page.locator('#btn-turbo').getAttribute('aria-pressed') !== 'true') await page.locator('#btn-turbo').click();
      await page.locator('#debug-toggle').click();
      await page.waitForTimeout(250);
      const layout = await page.evaluate(() => {
        const rect = (el) => { const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, right: r.right, bottom: r.bottom, width: r.width, height: r.height }; };
        const panel = document.querySelector('#debug-panel');
        const controls = [document.querySelector('#debug-toggle'), ...document.querySelectorAll('#debug-scenarios button'), document.querySelector('#btn-spin')].map((el) => {
          const r = rect(el), hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
          return { id: el.dataset.debugScenario ?? el.id, ...r, hit: Boolean(hit && el.contains(hit)), clipped: el.scrollWidth > el.clientWidth + 1 };
        });
        return { panel: rect(panel), controls, overflow: document.documentElement.scrollWidth > innerWidth + 1, w: innerWidth, h: innerHeight };
      });
      check(`${prefix}: open panel fits viewport`, layout.panel.x >= 0 && layout.panel.y >= 0 && layout.panel.right <= layout.w + 1 && layout.panel.bottom <= layout.h + 1 && !layout.overflow, layout);
      check(`${prefix}: controls fit, remain readable and clickable`, layout.controls.every((r) => r.x >= 0 && r.y >= 0 && r.right <= layout.w + 1 && r.bottom <= layout.h + 1 && r.width >= 30 && r.height >= 30 && r.hit && (r.id === 'btn-spin' || !r.clipped)), layout.controls);
      await page.screenshot({ path: path.join(OUT, `${game.code}-${size}-panel.png`) });

      async function runRound(scenario, { autoplay = false } = {}) {
        const id = scenario?.id ?? (autoplay ? 'autoplay' : 'normal');
        const label = `${prefix} / ${id}`;
        if (await page.locator('#debug-toggle').getAttribute('aria-expanded') !== 'true') await page.locator('#debug-toggle').click();
        const before = await page.evaluate(() => ({ balance: window.__gra.displayedBalance, count: window.__gra.responses.length }));
        const requestOffset = report.requests.length;
        // Observe the first ready frame; stop the autoplay probe with its actual UI button.
        await page.evaluate((stopAutoAtReady) => {
          window.__debugQa = { busy: false, enabledWhileBusy: [], ready: null, cancelled: false };
          const qa = window.__debugQa;
          const sample = () => {
            if (qa.cancelled || qa.ready) return;
            const state = window.__gra.state;
            if (state === 'spinning' || state === 'presenting') {
              qa.busy = true;
              const enabled = [...document.querySelectorAll('#debug-scenarios button')].filter((b) => !b.disabled).map((b) => b.dataset.debugScenario);
              if (enabled.length && qa.enabledWhileBusy.length < 5) qa.enabledWhileBusy.push({ state, enabled });
            } else if (qa.busy && state === 'ready') {
              qa.ready = { balance: window.__gra.displayedBalance, balanceText: window.__gra.shownBalanceText,
                winText: document.querySelector('#wygrana').textContent,
                currentGrid: window.__gra._game.currentGrid, renderedGrid: window.__gra._game.reels.grid,
                freeMode: Boolean(window.__gra._game.freeMode),
                autoplay: window.__gra.autoplay,
                buttonsDisabled: [...document.querySelectorAll('#debug-scenarios button')].some((b) => b.disabled) };
              if (stopAutoAtReady) document.querySelector('#btn-auto').click();
            }
            requestAnimationFrame(sample);
          };
          requestAnimationFrame(sample);
        }, autoplay);
        const responsePromise = page.waitForResponse((r) => r.request().method() === 'POST' && new URL(r.url()).pathname === `/api/slots/${game.code}/spins`, { timeout: 20000 });
        if (autoplay) {
          await page.locator('#btn-auto').click();
          await page.locator('#auto-start').click();
          check(`${label}: autoplay active`, await page.evaluate(() => window.__gra.autoplay));
        } else await page.locator(scenario ? scenarioButton(id) : '#btn-spin').click();
        const busy = await page.evaluate(() => ({
          state: window.__gra.state,
          disabled: [...document.querySelectorAll('#debug-scenarios button')].every((b) => b.disabled),
        }));
        check(`${label}: debug buttons disabled during round`, busy.state !== 'ready' && busy.disabled, busy);
        // Native clicks on disabled controls must not submit additional paid rounds.
        await page.evaluate(() => document.querySelectorAll('#debug-scenarios button').forEach((b) => b.click()));
        const httpResponse = await responsePromise;
        check(`${label}: real spin API succeeded`, httpResponse.ok(), httpResponse.status());
        const response = await httpResponse.json();
        await page.waitForFunction((n) => window.__gra.responses.length === n + 1, before.count, { timeout: 20000 });
        const baseSpin = response.steps.find((s) => s.type === 'spin' && s.phase === 'base');
        const freeStart = response.steps.find((s) => s.type === 'freeSpinsStart');
        const freeSpins = response.steps.filter((s) => s.type === 'spin' && s.phase === 'free');
        const scatters = baseSpin.grid.flat().filter((s) => s === 'scatter').length;
        if (scenario) {
          equal(`${label}: server used advertised seed`, response.seed.toLowerCase(), scenario.seed.toLowerCase());
          if (id === 'scatter') {
            check(`${label}: visible scatters without bonus`, scatters === 1 && !freeStart && freeSpins.length === 0, { scatters, freeStart, freeSpins: freeSpins.length });
          } else if (id === 'bonus') {
            check(`${label}: real scatter trigger and free spins`, scatters === game.scatterTrigger && freeStart?.count === 10 && freeStart.trigger.length === game.scatterTrigger && freeSpins.length === 10 && response.steps.at(-1).type === 'freeSpinsEnd', { scatters, freeStart, freeSpins: freeSpins.length });
            await page.waitForFunction(() => window.__gra._game.freeMode === true, null, { timeout: 60000 });
            check(`${label}: bonus visibly enters free-spin mode`, true);
            await page.screenshot({ path: path.join(OUT, `${game.code}-${size}-bonus-active.png`) });
          } else if (id === 'cascade') {
            check(`${label}: actual cluster win and cascade`, !freeStart && response.steps.some((s) => s.type === 'cascade') && response.steps.some((s) => s.type === 'win' && s.wins.some((w) => w.kind === 'cluster')), response.steps.map((s) => s.type));
          } else if (id === 'wild-win') {
            check(`${label}: actual paid WILD substitution`, response.steps.some((s) => s.type === 'win' && s.wins.some((w) => w.kind === 'line' && w.wildMultiplier === 2 && w.amount > 0)), response.totalWin);
          }
        }
        await page.waitForFunction(() => window.__debugQa.ready !== null, null, { timeout: 240000 });
        const observed = await page.evaluate(() => window.__debugQa);
        const ready = observed.ready;
        equal(`${label}: debug controls stayed disabled`, observed.enabledWhileBusy, []);
        if (autoplay) {
          check(`${label}: debug disabled between autoplay rounds`, ready.autoplay && ready.buttonsDisabled, ready);
          check(`${label}: autoplay stops through UI`, await page.evaluate(() => !window.__gra.autoplay && [...document.querySelectorAll('#debug-scenarios button')].every((b) => !b.disabled)));
        } else check(`${label}: controls re-enabled at ready`, !ready.buttonsDisabled);
        equal(`${label}: response starting balance`, response.balanceBefore, before.balance);
        equal(`${label}: server balance arithmetic`, response.balanceAfter, before.balance - response.bet + response.totalWin);
        equal(`${label}: balance target at ready`, ready.balance, response.balanceAfter);
        equal(`${label}: visible balance at ready`, number(ready.balanceText), response.balanceAfter);
        equal(`${label}: visible final win at ready`, number(ready.winText), response.totalWin);
        equal(`${label}: logical final grid`, ready.currentGrid, lastGrid(response));
        equal(`${label}: rendered final grid`, ready.renderedGrid, lastGrid(response));
        check(`${label}: bonus mode cleared`, !ready.freeMode);
        const meResponse = await context.request.get(`${BASE}/api/me`);
        check(`${label}: player API succeeded`, meResponse.ok());
        equal(`${label}: persisted wallet matches result`, (await meResponse.json()).balance, response.balanceAfter);
        const requests = report.requests.slice(requestOffset);
        equal(`${label}: exactly one paid POST`, requests.length, 1);
        equal(`${label}: one-shot debug header`, requests[0].seed?.toLowerCase() ?? null, scenario?.seed.toLowerCase() ?? null);
        check(`${label}: request has idempotency key`, Boolean(requests[0].idempotencyKey));
        report.rounds.push({ game: game.code, size, scenario: id, seed: response.seed, bet: response.bet, totalWin: response.totalWin,
          balanceBefore: before.balance, balanceAfter: response.balanceAfter, scatters, freeSpins: freeSpins.length, ready, request: requests[0] });
        await page.screenshot({ path: path.join(OUT, `${game.code}-${size}-${id}-ready.png`) });
      }
      for (const id of game.ids) await runRound(metadata.scenarios.find((scenario) => scenario.id === id));
      await runRound(null); // First ordinary SPIN after debug must omit X-Demo-Seed.
      if (game.code === 'zloty-faraon') await runRound(null, { autoplay: true });
    }
    await context.close();
  }
  equal('No browser runtime errors', report.errors, []);
  equal('No HTTP failures or missing assets', report.failedHttp, []);
  const keys = report.requests.map((request) => request.idempotencyKey);
  equal('Every paid action has a fresh idempotency key', new Set(keys).size, keys.length);
  report.ok = true;
} catch (error) {
  report.ok = false;
  report.failure = error.stack ?? String(error);
  console.error(report.failure);
  if (page && !page.isClosed()) {
    await page.evaluate(() => { if (window.__debugQa) window.__debugQa.cancelled = true; }).catch(() => {});
    await page.screenshot({ path: path.join(OUT, 'failure.png') }).catch(() => {});
  }
  process.exitCode = 1;
} finally {
  await browser.close();
  await writeFile(path.join(OUT, 'results.json'), JSON.stringify(report, null, 2));
  console.log(`RESULT ${report.checks.filter((c) => c.ok).length}/${report.checks.length}; ${report.rounds.length} real rounds; report: ${path.join(OUT, 'results.json')}`);
}
