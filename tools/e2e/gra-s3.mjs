/** S3 deterministic contract/e2e checks; injected API fixtures leave the real server wallet untouched. */
import { chromium } from 'playwright-core';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const REAL = process.argv.includes('--backend');
const BASE = process.argv[2] ?? 'http://127.0.0.1:8090';
const OUT = path.resolve(process.argv[3] ?? 'E:/CebulionCasino/testy/s3');
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--enable-unsafe-swiftshader'] });
const context = await browser.newContext({ viewport: { width: 1366, height: 900 }, deviceScaleFactor: 1, locale: 'pl-PL' });
const page = await context.newPage();
const errors = [], checks = [];
page.on('pageerror', (e) => { errors.push(e.stack); console.log('PAGEERROR',e.stack); });
page.on('console', (msg) => { if (msg.type() === 'error' && !msg.text().includes('Failed to load resource')) errors.push(msg.text()); });
const check = (name, ok, detail = '') => { checks.push({ name, ok: !!ok, detail }); console.log(`${ok ? 'OK' : 'FAIL'} ${name} ${detail}`); };
const grid = () => Array.from({ length: 6 }, (_, c) => Array.from({ length: 5 }, (_, r) => ['szafir','szmaragd','ametyst','topaz','rubin','diament','cebula'][(c+r)%7]));
const copy = (g) => g.map((c) => [...c]);
const removed = Array.from({ length: 5 }, (_, c) => [c, 4]);
function cascade(g, addOrb = false) {
  const next = copy(g), symbols = Array.from({ length: 6 }, () => []);
  for (let c = 0; c < 5; c++) { symbols[c] = [addOrb && c === 2 ? 'mnoznik' : c % 2 ? 'topaz' : 'ametyst']; next[c] = [...symbols[c], ...g[c].slice(0, 4)]; }
  return { type: 'cascade', removed, newSymbols: symbols, grid: next, orbs: addOrb ? [{ pos: [2,0], value: 5 }] : [] };
}
function fixtures(kind, bet) {
  const start = grid();
  if (kind === 'anticipation') {
    for (const [c,r] of [[0,0],[1,1],[2,2]]) start[c][r] = 'scatter';
    return { steps: [{ type: 'spin', phase: 'base', grid: start, orbs: [], anticipation: [3,4,5] }], win: 0 };
  }
  if (kind === 'lose') return { steps: [{ type: 'spin', phase: 'base', grid: start, orbs: [], anticipation: [] }], win: 0 };
  if (kind === 'cascade') {
    for (let c = 0; c < 5; c++) start[c][4] = 'rubin';
    return { steps: [{ type: 'spin', phase: 'base', grid: start, orbs: [], anticipation: [] }, { type: 'win', win: bet * 2, totalWin: bet * 2, wins: [{ kind: 'cluster', symbol: 'rubin', count: 5, positions: removed, amount: bet * 2 }] }, cascade(start)], win: bet * 2 };
  }
  const trigger = [[0,0],[1,1],[2,2],[3,3]];
  trigger.forEach(([c,r]) => start[c][r] = 'scatter');
  const free = grid(); free[0][0] = 'mnoznik';
  for (let c = 0; c < 5; c++) free[c][4] = 'szafir';
  for (const [c,r] of [[0,3],[1,2],[3,2]]) free[c][r] = 'scatter';
  const casc = cascade(free, true);
  const baseWin = bet * 5, sequenceWin = bet * 0.4, fsWin = sequenceWin * 7;
  const steps = [
    { type: 'spin', phase: 'base', grid: start, orbs: [], anticipation: [] },
    { type: 'win', win: baseWin, totalWin: baseWin, wins: [{ kind: 'scatter', symbol: 'scatter', count: 4, positions: trigger, amount: baseWin }] },
    { type: 'freeSpinsStart', count: 10, trigger },
    { type: 'spin', phase: 'free', grid: free, orbs: [{ pos: [0,0], value: 2 }], freeSpinIndex: 1, freeSpinsLeft: 9, anticipation: [] },
    { type: 'win', win: sequenceWin, totalWin: baseWin + sequenceWin, wins: [{ kind: 'cluster', symbol: 'szafir', count: 5, positions: removed, amount: sequenceWin }] },
    casc,
    { type: 'applyMultiplier', baseWin: sequenceWin, orbsSum: 7, win: sequenceWin * 6, totalWin: baseWin + fsWin },
    { type: 'freeSpinsRetrigger', added: 5, trigger: [[0,4],[1,3],[3,3]], freeSpinsLeft: 14 },
  ];
  for (let i = 2; i <= 15; i++) {
    const g = grid(), orbs = i === 15 ? [{ pos: [4,2], value: 50 }] : [];
    if (orbs.length) g[4][2] = 'mnoznik';
    steps.push({ type: 'spin', phase: 'free', grid: g, orbs, freeSpinIndex: i, freeSpinsLeft: 15 - i, anticipation: [] });
  }
  steps.push({ type: 'freeSpinsEnd', freeSpinsWin: fsWin });
  return { steps, win: baseWin + fsWin };
}

let kind = 'lose', lastResponse, ledger = 10000, round = 0;
await page.route('**/api/slots/krysztalowa-kaskada/spins', async (route) => {
  if (REAL) {
    const response = await route.fetch({ headers: { ...route.request().headers(), 'x-demo-seed': '0000000000000009' } });
    lastResponse = await response.json();
    await route.fulfill({ response });
    return;
  }
  const { bet } = route.request().postDataJSON(), f = fixtures(kind, bet);
  const tier = f.win / bet >= 15 ? 'big' : f.win / bet >= 5 ? 'medium' : f.win ? 'small' : 'none';
  lastResponse = { roundId: ++round, gameCode: 'krysztalowa-kaskada', bet, totalWin: f.win, multiplier: f.win / bet, tier, balanceBefore: ledger, balanceAfter: ledger - bet + f.win, seed: '5353000000000001', steps: f.steps };
  ledger = lastResponse.balanceAfter;
  await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(lastResponse) });
});

async function spin(type, skip = false) {
  kind = type;
  const before = await page.evaluate(() => window.__gra.responses.length);
  await page.click('#btn-spin');
  await page.waitForFunction((n) => window.__gra.responses.length > n, before);
  if (skip) {
    await page.click('#btn-spin');
    await page.waitForTimeout(100);
    await page.click('#scena', { position: { x: 20, y: 20 } });
  }
  await page.waitForFunction(() => window.__gra.state === 'ready', null, { timeout: 90000 });
  const snapshot = await page.evaluate(() => ({ debug: window.__gra.debug(), balance: window.__gra.displayedBalance, win: document.querySelector('#wygrana')?.textContent, slots: window.__gra._game.reels.reels.map((_,c) => Array.from({ length: 5 },(_,r)=>window.__gra._game.reels.slotAt(c,r).code)) }));
  check(`${type}: saldo zgodne z odpowiedzią`, snapshot.balance === lastResponse.balanceAfter);
  check(`${type}: pole WYGRANA zgodne z totalWin`, Number(snapshot.win.replace(/\s/g, '').replace(',', '.')) === lastResponse.totalWin, snapshot.win);
  const expected = [...lastResponse.steps].reverse().find((s) => s.grid).grid;
  check(`${type}: końcowa siatka i widoczne symbole zgodne z serwerem`, JSON.stringify(snapshot.debug.s3.grid) === JSON.stringify(expected) && JSON.stringify(snapshot.slots) === JSON.stringify(expected));
  const stepsWithGrid = lastResponse.steps.filter((s) => s.grid);
  const records = snapshot.debug.s3.history.filter((s) => ['spin','cascade'].includes(s.type));
  check(`${type}: wszystkie plansze pośrednie zgodne z krokami`, stepsWithGrid.length === records.length && stepsWithGrid.every((s,i) => JSON.stringify(s.grid) === JSON.stringify(records[i].grid)));
  return snapshot;
}

try {
  await mkdir(OUT, { recursive: true });
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.click('#btn-zaloguj'); await page.fill('#nick', `S3_${Date.now().toString(36).slice(-6)}`); await Promise.all([page.waitForResponse(r=>r.url().includes('/auth/login') && r.status()===200), page.keyboard.press('Enter')]); await page.waitForSelector('#modal-logowanie.is-open', {state:'hidden'});
  await page.waitForSelector('.reward', { state: 'detached', timeout: 15000 }).catch(()=>{});
  await page.goto(`${BASE}/gra.html?gra=krysztalowa-kaskada`, { waitUntil: 'load' });
  await page.waitForSelector('#btn-graj:not([hidden])', { timeout: 45000 }); await page.click('#btn-graj');
  await page.waitForFunction(() => window.__gra?.state === 'ready', null, { timeout: 15000 });
  check('dedykowana klasa S3 i plansza grawitacyjna', await page.evaluate(() => window.__gra._game.constructor.name === 'S3Game' && window.__gra._game.reels.constructor.name === 'S3Board'));
  await page.waitForTimeout(500); await page.screenshot({ path: path.join(OUT,'01-desktop.png') });
  if (REAL) {
    await spin('backend-seed9');
    const player = await page.evaluate(async () => (await fetch('/api/me')).json());
    check('saldo po prezentacji zgodne z prawdziwym portfelem', await page.evaluate(() => window.__gra.displayedBalance) === player.balance);
    check('prawdziwy silnik dostarczył kaskady', lastResponse.steps.some((s) => s.type === 'cascade'));
    await page.screenshot({ path: path.join(OUT, 'backend-seed9.png') });
  } else {
  await spin('lose');
  await page.evaluate(() => {
    window.__s3AntEvents = [];
    window.__gra._game.reels.addEventListener('anticipation', (e) => window.__s3AntEvents.push({ ...e.detail, t:window.__gra._game.gameApp.tweener.now }));
  });
  await spin('anticipation');
  const ant = await page.evaluate(() => window.__s3AntEvents);
  check('antycypacje kolejno po lądowaniu wcześniejszych kolumn', ant.length===3 && ant[1].t-ant[0].t>=650 && ant[2].t-ant[1].t>=650 && ant.every(e=>e.durationMs>=700));
  await spin('cascade');
  await page.click('#btn-turbo');
  const bonus = await spin('fs');
  const moved = bonus.debug.s3.history.find((s) => s.type === 'cascade');
  check('istniejąca kula x2 opada z [0,0] do [0,1]', moved.orbs.some((o)=>o.pos[0]===0 && o.pos[1]===1 && o.value===2));
  check('nowa kula x5 dołączona bez zgubienia poprzedniej', moved.orbs.length===2 && moved.orbs.some((o)=>o.pos[0]===2 && o.pos[1]===0 && o.value===5));
  check('mnożnik sumuje 2+5 i używa kwoty serwera', bonus.debug.s3.stats.collections===1 && bonus.debug.s3.history.find((s)=>s.type==='applyMultiplier').shownWin===lastResponse.totalWin);
  check('retrigger i 15 darmowych spinów', bonus.debug.s3.stats.retriggers===1 && bonus.debug.s3.stats.freeSpins===15);
  check('kula x50 bez wygranej nie jest zbierana', bonus.debug.s3.stats.collections===1);
  check('FS przywraca tło i ukrywa licznik', bonus.debug.s3.freeMode===false && await page.locator('#gra-fs').isHidden());
  const skip = await spin('fs', true);
  check('przewinięcie nie zmienia rozliczenia', skip.balance===lastResponse.balanceAfter && skip.debug.s3.history.length===lastResponse.steps.length);
  for (const [width,height] of [[390,844],[844,390],[320,740]]) {
    await page.setViewportSize({width,height}); await page.waitForFunction(()=>Math.abs(window.__gra._game.gameApp.layout.w-document.querySelector('#scena').clientWidth)<2 && Math.abs(window.__gra._game.gameApp.layout.h-document.querySelector('#scena').clientHeight)<2,null,{timeout:10000}); await page.waitForTimeout(350);
    const fit = await page.evaluate(()=>{ const p=document.querySelector('#btn-spin').getBoundingClientRect(); const r=window.__gra._game.reels.windowRect; const l=window.__gra._game.gameApp.layout; return { overflow:document.documentElement.scrollWidth>innerWidth+1, spin:p.x>=0 && p.right<=innerWidth && p.bottom<=innerHeight+1, grid:r.x>=0 && r.y>=0 && r.x+r.w<=l.w+1 && r.y+r.h<=l.h+1 }; });
    check(`układ ${width}x${height}`, !fit.overflow && fit.spin && fit.grid, JSON.stringify(fit));
    await page.screenshot({path:path.join(OUT,`view-${width}x${height}.png`)});
  }
  await page.emulateMedia({ reducedMotion:'reduce' });
  const logsBefore = await page.evaluate(()=>window.__gra.flashLog().length);
  await spin('cascade');
  check('ograniczony ruch bez nowych pełnych błysków', await page.evaluate((n)=>window.__gra.flashLog().slice(n).every((e)=>e.decision!=='full'),logsBefore));
  }
  check('brak błędów JS', errors.length===0, errors.join(' | '));
  check('limit 3 błysków na sekundę', (await page.evaluate(()=>window.__gra.debug().flashMaxPerSecond))<=3);
} catch(e) {
  check('wykonanie testu',false,e.stack); await page.screenshot({path:path.join(OUT,'error.png')}).catch(()=>{});
} finally {
  await writeFile(path.join(OUT,'wyniki.json'),JSON.stringify({checks,errors},null,2));
  await browser.close();
}
console.log(`${checks.filter(c=>c.ok).length}/${checks.length} OK`);
if(checks.some(c=>!c.ok)) process.exitCode=1;
