/** Final packaged-app check: UI login, one real round per game, balances, assets and lobby videos. */
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright-core';
const BASE = process.argv[2] ?? 'http://localhost:8080';
const WORK = process.env.FINAL_QA_OUT ?? 'E:/CebulionCasino/tmp/final-check';
await mkdir(WORK, { recursive: true });
process.env.TEMP = WORK;
process.env.TMP = WORK;
process.env.TMPDIR = WORK;
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--enable-unsafe-swiftshader'] });
const result = { base: BASE, at: new Date().toISOString(), nick: `QA_${Date.now().toString(36)}`, rounds: [], videos: [], errors: [], missing: [] };
const codes = ['cebulowy-777', 'zloty-faraon', 'krysztalowa-kaskada'];
try {
  const context = await browser.newContext({ viewport: { width: 1366, height: 900 }, deviceScaleFactor: 1, locale: 'pl-PL' });
  await context.addInitScript(() => localStorage.setItem('cebulion.audio', JSON.stringify({ muted: true })));
  const page = await context.newPage();
  page.on('pageerror', (error) => result.errors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') result.errors.push(message.text()); });
  page.on('response', (response) => { if (response.status() === 404) result.missing.push(response.url()); });
  await page.goto(BASE);
  await page.locator('#kafle .tile:not(.tile--skeleton)').first().waitFor();
  await page.locator('#btn-zaloguj').click();
  await page.locator('#modal-logowanie.is-open').waitFor();
  await page.locator('#nick').fill(result.nick);
  await page.locator('#nick').press('Enter');
  await page.waitForFunction(() => !document.querySelector('#modal-logowanie').classList.contains('is-open'));
  await page.locator('.reward').waitFor({ state: 'detached', timeout: 20000 });
  for (const code of codes) {
    const tile = page.locator(`#kafle .tile[data-code="${code}"]`);
    await tile.scrollIntoViewIfNeeded();
    await page.mouse.move(0, 0);
    await page.waitForTimeout(300);
    await tile.hover();
    await page.waitForFunction((c) => {
      const v = document.querySelector(`.tile[data-code="${c}"] video`);
      return v && !v.paused && v.currentTime > 0.2 && v.videoWidth === 480;
    }, code, { timeout: 15000 });
    result.videos.push({ code, ...await tile.locator('video').evaluate((v) => ({ currentTime: v.currentTime, muted: v.muted, loop: v.loop, playsInline: v.playsInline })) });
    await tile.click();
    await page.locator('#btn-graj:not([hidden])').waitFor({ timeout: 60000 });
    await page.locator('#btn-graj').click();
    await page.waitForFunction(() => window.__gra?.state === 'ready', null, { timeout: 60000 });
    const before = await page.evaluate(() => window.__gra.displayedBalance);
    await page.locator('#btn-spin').click();
    await page.waitForFunction(() => window.__gra?.responses.length === 1, null, { timeout: 20000 });
    await page.waitForFunction(() => window.__gra?.state === 'ready', null, { timeout: 240000 });
    // Saldo musi być już poprawne w stanie ready, bez dodatkowego czasu na odliczanie.
    const values = await page.evaluate(async () => ({
      className: window.__gra._game.constructor.name,
      response: window.__gra.lastResponse,
      displayedBalance: window.__gra.displayedBalance,
      shownBalanceText: window.__gra.shownBalanceText,
      player: await fetch('/api/me', { cache: 'no-store' }).then((r) => r.json()),
    }));
    assert.equal(values.response.balanceBefore, before, `${code}: previous balance`);
    assert.equal(values.response.balanceAfter, before - values.response.bet + values.response.totalWin, `${code}: round arithmetic`);
    assert.equal(values.displayedBalance, values.response.balanceAfter, `${code}: displayed balance`);
    assert.equal(Number(values.shownBalanceText.replace(/[^0-9,-]/g, '').replace(',', '.')), values.response.balanceAfter, `${code}: visible balance text`);
    assert.equal(values.player.balance, values.response.balanceAfter, `${code}: API balance`);
    assert.equal(values.className, `S${codes.indexOf(code) + 1}Game`, `${code}: final game implementation`);
    result.rounds.push({ code, className: values.className, seed: values.response.seed, before, bet: values.response.bet,
      win: values.response.totalWin, after: values.response.balanceAfter, visibleBalance: values.shownBalanceText, ready: true });
    await page.screenshot({ path: path.join(WORK, `${code}-final.png`) });
    console.log(`OK ${code}: ${before} - ${values.response.bet} + ${values.response.totalWin} = ${values.response.balanceAfter}`);
    await page.locator('#btn-lobby').click();
    await page.waitForURL((u) => !u.pathname.endsWith('gra.html'));
    await page.locator('#kafle .tile:not(.tile--skeleton)').first().waitFor();
  }
  assert.deepEqual(result.errors, [], 'no JavaScript or console errors');
  assert.deepEqual(result.missing, [], 'no missing assets');
  result.ok = true;
  console.log('Final: 3 real UI rounds and 3 lobby previews passed; no JS errors or 404.');
} catch (error) {
  result.ok = false;
  result.failure = error.stack ?? String(error);
  throw error;
} finally {
  await writeFile(path.join(WORK, 'results.json'), JSON.stringify(result, null, 2));
  await browser.close();
}