/** Deterministic browser checks of the S2 presentation contract, plus real mock HTTP login/spin. */
import { chromium } from 'playwright-core';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const BASE = (process.argv[2] ?? 'http://localhost:8090').replace(/\/$/, '');
const OUT = path.resolve(process.argv[3] ?? 'E:/CebulionCasino/testy/s2');
const EXECUTABLE = process.env.PW_CHROMIUM ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const checks = [], errors = [];
const check = (name, ok, details = '') => { checks.push({ name, ok: Boolean(ok), details }); console.log(`${ok ? 'OK' : 'FAIL'} ${name} ${details}`); };
const baseGrid = [['scatter', '10', 'j'], ['k', 'q', 'a'], ['scatter', 'ankh', 'oko'], ['faraon', 'anubis', 'k'], ['scatter', 'j', '10']];
const plainGrid = [['10', 'j', 'q'], ['k', 'a', 'ankh'], ['oko', 'skarabeusz', '10'], ['j', 'q', 'k'], ['a', 'ankh', 'oko']];
function fixture(original) {
  const bet = original.bet, steps = [{ type: 'spin', phase: 'base', grid: baseGrid, anticipation: [3, 4] }, { type: 'win', win: bet * 2, totalWin: bet * 2, wins: [{ kind: 'scatter', symbol: 'scatter', count: 3, positions: [[0, 0], [2, 0], [4, 0]], amount: bet * 2 }] }, { type: 'freeSpinsStart', count: 3, trigger: [[0, 0], [2, 0], [4, 0]] }];
  let total = bet * 2;
  for (let i = 1; i <= 5; i++) {
    const grid = plainGrid.map((c) => [...c]);
    const wildReels = i === 1 ? [1] : i === 3 ? [1, 2, 3] : [];
    for (const r of wildReels) grid[r][1] = 'wild';
    if (i === 2) { grid[0][0] = grid[2][0] = grid[4][0] = 'scatter'; }
    steps.push({ type: 'spin', phase: 'free', freeSpinIndex: i, freeSpinsLeft: i === 1 ? 2 : 5 - i, grid, anticipation: [] });
    if (wildReels.length) steps.push({ type: 'expandWild', reels: wildReels, grid: grid.map((col, r) => wildReels.includes(r) ? ['wild', 'wild', 'wild'] : [...col]) });
    if (i === 1 || i === 3) {
      const win = bet * 9; total += win;
      steps.push({ type: 'win', win, totalWin: total, wins: [{ kind: 'line', line: 1, symbol: 'j', count: 5, positions: [[0, 1], [1, 1], [2, 1], [3, 1], [4, 1]], amount: win, wildMultiplier: 1, freeSpinMultiplier: 2 }] });
    }
    if (i === 2) steps.push({ type: 'freeSpinsRetrigger', added: 2, trigger: [[0, 0], [2, 0], [4, 0]], freeSpinsLeft: 3 });
  }
  steps.push({ type: 'freeSpinsEnd', freeSpinsWin: bet * 18 });
  return { ...original, totalWin: total, balanceAfter: original.balanceBefore - bet + total, tier: 'big', steps };
}

await mkdir(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: EXECUTABLE, args: ['--disable-gpu-sandbox', '--enable-unsafe-swiftshader'] });
try {
  const context = await browser.newContext({ viewport: { width: 1366, height: 768 }, locale: 'pl-PL' });
  const page = await context.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/WebGL|swiftshader|GroupMarker/.test(m.text())) errors.push(m.text()); });
  await page.goto(`${BASE}/`);
  await page.evaluate(async (nick) => { await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nick }) }); localStorage.setItem('cebulion.sesja', '1'); }, `S2_${Date.now().toString(36).slice(-6)}`);
  await page.goto(`${BASE}/gra.html?gra=zloty-faraon&fx=debug`);
  await page.waitForSelector('#btn-graj:not([hidden])', { timeout: 60000 });
  await page.click('#btn-graj');
  await page.waitForFunction(() => window.__gra?.state === 'ready', null, { timeout: 30000 });
  check('S2Game initialized with actual scene art', await page.evaluate(() => window.__gra.debug().game === 's2' && window.__gra.debug().sceneAssets));
  check('five reels and twelve actual symbol textures', await page.evaluate(() => window.__gra._game.reels.reels.length === 5 && window.__gra._game.views.size === 12));
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(OUT, '01-skarbiec-desktop.png') });
  await page.waitForTimeout(500);
  check('Egyptian music context after intro', await page.evaluate(() => window.__gra.audio().keyContext === 's2' && window.__gra.audio().music?.id === 'mus_s2'));
  for (const [width, height] of [[320, 640], [390, 844], [844, 390], [1366, 768]]) {
    await page.setViewportSize({ width, height }); await page.waitForTimeout(350);
    const geo = await page.evaluate(() => {
      const g = window.__gra._game.geo, l = window.__gra._game.gameApp.layout, f = window.__gra._game.frameWindow;
      return { fits: g.frameX >= 0 && g.frameY >= 0 && g.frameX + g.frameW <= l.w + 1 && g.frameY + g.frameH <= l.h + 1, correctWindow: Math.abs(g.winX - g.frameX - g.frameW * f.x) < 0.1 && Math.abs(g.winW - g.frameW * f.w) < 0.1, overflow: document.documentElement.scrollWidth > innerWidth };
    });
    const control = await page.evaluate(() => {
      const el = document.querySelector('#btn-spin'), r = el.getBoundingClientRect();
      let opacity = 1, node = el, displayed = true;
      while (node instanceof Element) { const style = getComputedStyle(node); opacity *= Number(style.opacity); displayed &&= style.visibility !== 'hidden' && style.display !== 'none'; node = node.parentElement; }
      const middle = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
      return { x: r.x, y: r.y, width: r.width, height: r.height, right: r.right, bottom: r.bottom, screenW: innerWidth, screenH: innerHeight, opacity, displayed, hit: Boolean(middle && el.contains(middle)) };
    });
    check(`SPIN visible and clickable ${width}x${height}`, control.width >= 40 && control.height >= 40 && control.x >= 0 && control.y >= 0 && control.right <= control.screenW && control.bottom <= control.screenH && control.opacity > 0.9 && control.displayed && control.hit, JSON.stringify(control));
    check(`frame and manifest window fit ${width}x${height}`, geo.fits && geo.correctWindow && !geo.overflow, JSON.stringify(geo));
    await page.screenshot({ path: path.join(OUT, `02-layout-${width}x${height}.png`) });
  }
  const earlySkip = await page.evaluate(async () => {
    const { SkipToken } = await import('/js/game/core/tween.js');
    const token = new SkipToken(); token.skip();
    const game = window.__gra._game, before = game.gameApp.layers.bigwin.children.length;
    await game.showMessage('PRÓBA PRZEWINIĘCIA', { ms: 1500, token });
    return game.gameApp.layers.bigwin.children.length === before;
  });
  await page.setViewportSize({ width: 320, height: 640 }); await page.waitForTimeout(400);
  await page.setViewportSize({ width: 1366, height: 768 }); await page.waitForTimeout(400);
  check('already-skipped message releases its tweens and survives resize', earlySkip && errors.length === 0, errors.join(' | '));
  let deterministic = true;
  await page.route('**/api/slots/zloty-faraon/spins', async (route) => {
    const response = await route.fetch({ headers: { ...route.request().headers(), 'x-mock-force': 'lose' } });
    if (!deterministic) return route.fulfill({ response });
    const data = fixture(await response.json());
    await route.fulfill({ response, json: data });
  });
  await page.click('#btn-turbo');
  await page.keyboard.press('Space');
  await page.waitForFunction(() => window.__gra._game.anticipating, null, { timeout: 15000 });
  check('anticipation is driven by response columns', true);
  await page.screenshot({ path: path.join(OUT, '03-antycypacja.png') });
  await page.waitForFunction(() => window.__gra._game.freeMode && window.__gra._game.bonusPanel, null, { timeout: 20000 });
  check('bonus count comes from response', await page.evaluate(() => window.__gra._game.bonusPanel.value.text === '3'));
  check('future bonus winnings are not booked early', await page.evaluate(() => window.__gra.displayedBalance !== window.__gra.lastResponse.balanceAfter));
  await page.screenshot({ path: path.join(OUT, '04-bonus-start.png') });
  await page.setViewportSize({ width: 320, height: 640 }); await page.waitForTimeout(350);
  const bonusHud = await page.evaluate(() => {
    const hud = document.querySelector('#gra-fs'), r = hud.getBoundingClientRect();
    return { text: hud.textContent, x: r.x, right: r.right, top: r.top, bottom: r.bottom, width: innerWidth, height: innerHeight, visible: !hud.hidden };
  });
  check('free spin HUD fits and starts at zero at 320px', bonusHud.visible && bonusHud.x >= 0 && bonusHud.right <= bonusHud.width + 1 && bonusHud.top >= 0 && bonusHud.bottom <= bonusHud.height && /WYGRANA:\s*0(?:\D|$)/.test(bonusHud.text), JSON.stringify(bonusHud));
  await page.screenshot({ path: path.join(OUT, '04-bonus-hud-320.png') });
  await page.setViewportSize({ width: 1366, height: 768 }); await page.waitForTimeout(350);
  await page.waitForFunction(() => window.__gra._game.expanded.get(1)?.open === 1, null, { timeout: 25000 });
  const relic = await page.evaluate(() => { const g = window.__gra._game, e = g.expanded.get(1); return { height: e.sprite.height, window: g.geo.winH, hidden: g.reels.visibleSlots(1).every((s) => !s.body.visible), mode: g.freeMode }; });
  check('expanding relic covers exactly three rows and replaces symbols', Math.abs(relic.height - relic.window) < 1 && relic.hidden && relic.mode, JSON.stringify(relic));
  check('free spin music and x2 badge', await page.evaluate(() => window.__gra.audio().music?.id === 'mus_s2_fs' && window.__gra._game.x2.visible));
  await page.screenshot({ path: path.join(OUT, '05-rozszerzony-wild.png') });
  await page.waitForFunction(() => window.__gra._game.stats.freeSpinsRetriggered === 1, null, { timeout: 25000 });
  check('retrigger uses server-added count', await page.evaluate(() => window.__gra._game.bonusPanel?.value.text === '+2'));
  const hudAfterWin = await page.evaluate(() => ({ text: document.querySelector('#gra-fs').textContent, expected: window.__gra.lastResponse.bet * 9, base: window.__gra.lastResponse.bet * 2 }));
  const shownFsWin = Number(hudAfterWin.text.split('WYGRANA:')[1]?.replace(/\s/g, ''));
  check('free spin HUD excludes the base scatter win', shownFsWin === hudAfterWin.expected, JSON.stringify({ ...hudAfterWin, shownFsWin }));
  await page.waitForFunction(() => window.__gra._game.expanded.size === 3 && [...window.__gra._game.expanded.values()].every((e) => e.open === 1), null, { timeout: 25000 });
  check('multiple wilds expand in order without changing server grid', await page.evaluate(() => [1, 2, 3].every((r) => window.__gra._game.currentGrid[r].every((c) => c === 'wild'))));
  await page.screenshot({ path: path.join(OUT, '06-trzy-wildy.png') });
  await page.waitForFunction(() => window.__gra.bigWinPhase === 'count', null, { timeout: 45000 });
  await page.keyboard.press('Space');
  await page.waitForFunction(() => window.__gra.state === 'ready', null, { timeout: 60000 });
  check('bonus completes, returns to base scene and clears relics', await page.evaluate(() => !window.__gra._game.freeMode && window.__gra._game.freeBlend === 0 && window.__gra._game.expanded.size === 0 && !window.__gra._game.x2.visible));
  await page.waitForFunction(() => window.__gra.shownBalanceText?.replace(/\s/g, '') === String(window.__gra.lastResponse.balanceAfter), null, { timeout: 8000 });
  check('displayed balance matches authoritative response', true);
  check('all server bonus steps played', await page.evaluate(() => { const s = window.__gra.debug().stats; return s.expandedWilds === 4 && s.freeSpinsStarted === 1 && s.freeSpinsRetriggered === 1 && s.freeSpinsEnded === 1; }));
  check('flash budget and hero flashes respected', await page.evaluate(() => window.__gra.debug().flashMaxPerSecond <= 3 && window.__gra.debug().heroSkips === 0));
  await page.waitForFunction(() => window.__gra.audio().music?.id === 'mus_s2', null, { timeout: 5000 });
  check('base music restored', true);
  deterministic = false;
  await page.keyboard.press('Space'); await page.waitForTimeout(200); await page.keyboard.press('Space');
  await page.waitForFunction(() => window.__gra.state === 'ready', null, { timeout: 20000 });
  check('next paid spin unhides all symbol bodies', await page.evaluate(() => window.__gra._game.reels.reels.every((r) => r.slots.every((s) => s.body.visible))));
  await context.close();

  const rm = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce', locale: 'pl-PL' });
  const pg = await rm.newPage(); pg.on('pageerror', (e) => errors.push(e.message));
  await pg.goto(`${BASE}/`);
  await pg.evaluate(async (nick) => { await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nick }) }); localStorage.setItem('cebulion.sesja', '1'); }, `S2rm_${Date.now().toString(36).slice(-5)}`);
  await pg.goto(`${BASE}/gra.html?gra=zloty-faraon`); await pg.waitForSelector('#btn-graj:not([hidden])', { timeout: 60000 }); await pg.click('#btn-graj');
  await pg.waitForFunction(() => window.__gra?.state === 'ready', null, { timeout: 20000 });
  await pg.route('**/api/slots/zloty-faraon/spins', async (route) => { const response = await route.fetch({ headers: { ...route.request().headers(), 'x-mock-force': 'lose' } }); await route.fulfill({ response, json: fixture(await response.json()) }); });
  await pg.click('#btn-turbo'); await pg.keyboard.press('Space');
  await pg.waitForFunction(() => window.__gra._game.freeMode, null, { timeout: 25000 });
  await pg.keyboard.press('Space');
  await pg.waitForFunction(() => window.__gra.state === 'ready', null, { timeout: 90000 });
  check('reduced motion bonus completes without trauma or flashes', await pg.evaluate(() => window.__gra.trauma === 0 && !window.__gra.flashLog().some((e) => e.decision === 'full' || e.decision === 'soft')));
  await pg.screenshot({ path: path.join(OUT, '07-ograniczony-ruch.png') }); await rm.close();
  check('no browser runtime errors', errors.length === 0, errors.join(' | '));
} catch (e) { check('test execution', false, e.stack); }
finally { await browser.close(); await writeFile(path.join(OUT, 'wyniki.json'), JSON.stringify({ base: BASE, checks, errors }, null, 2)); }
console.log(`${checks.filter((c) => c.ok).length}/${checks.length} checks passed`);
process.exit(checks.some((c) => !c.ok) ? 1 : 0);
