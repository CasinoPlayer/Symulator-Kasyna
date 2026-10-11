/** Funds dialog layout and interaction checks against the development mock. */
import { chromium } from 'playwright-core';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
const BASE = process.argv[2] ?? 'http://localhost:8090';
const OUT = path.resolve(process.argv[3] ?? 'E:/CebulionCasino/testy/funds-modal');
const checks = [], errors = [];
const check = (name, ok, details = '') => { checks.push({ name, ok: !!ok, details }); console.log(`${ok ? 'OK' : 'FAIL'} ${name} ${details}`); };
await mkdir(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--enable-unsafe-swiftshader'] });
try {
  const context = await browser.newContext({ viewport: { width: 320, height: 640 }, locale: 'pl-PL' });
  const page = await context.newPage();
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(BASE);
  await page.evaluate(async nick => {
    await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nick }) });
    localStorage.setItem('cebulion.sesja', '1');
    localStorage.setItem('cebulion.zaklad.zloty-faraon', '2000');
  }, `Funds_${Date.now().toString(36).slice(-6)}`);
  async function openFunds(balance, rescueCooldownSeconds) {
    await page.evaluate(async body => {
      const res = await fetch('/api/dev/gracz', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (!res.ok) throw new Error('Mock player setup failed');
    }, { balance, rescueCooldownSeconds });
    await page.goto(`${BASE}/gra.html?gra=zloty-faraon&fx=debug`);
    await page.waitForSelector('#btn-graj:not([hidden])', { timeout: 60000 });
    await page.click('#btn-graj');
    await page.waitForFunction(() => window.__gra?.state === 'ready', null, { timeout: 30000 });
    await page.click('#btn-spin');
    await page.waitForSelector('#modal-srodki.is-open');
    await page.waitForTimeout(550);
  }
  async function geometry() {
    return page.evaluate(() => {
      const modal = document.querySelector('#modal-srodki'), panel = modal.querySelector('.modal__panel');
      const rect = el => { const r = el.getBoundingClientRect(); return { x:r.x, y:r.y, right:r.right, bottom:r.bottom, width:r.width, height:r.height }; };
      const p = rect(panel), title = rect(modal.querySelector('h2')), close = rect(modal.querySelector('.modal__close'));
      const buttons = [...modal.querySelectorAll('button')].filter(el => !el.hidden).map(el => {
        const r = rect(el), target = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
        return { id: el.id || 'close', ...r, hit: el.contains(target), noClip: el.scrollWidth <= el.clientWidth + 1 };
      });
      return { p, title, close, buttons, panelOverflow: panel.scrollWidth > panel.clientWidth + 1, pageOverflow: document.documentElement.scrollWidth > innerWidth,
        inside: p.x >= 0 && p.y >= 0 && p.right <= innerWidth && p.bottom <= innerHeight,
        titleClear: title.right <= close.x || title.x >= close.right || title.bottom <= close.y || title.y >= close.bottom,
        controlsVisible: buttons.every(b => b.x >= p.x && b.y >= p.y && b.right <= p.right && b.bottom <= p.bottom && b.width >= 44 && b.height >= 44 && b.hit && b.noClip),
        focusInside: modal.contains(document.activeElement) };
    });
  }
  await openFunds(0, 0);
  await page.waitForSelector('#btn-ratunek-gra:not([hidden])');
  check('rescue is available with zero balance', await page.locator('#btn-ratunek-gra').isVisible());
  for (const [width, height] of [[320,640],[390,844],[844,390],[1366,768]]) {
    await page.setViewportSize({ width, height }); await page.waitForTimeout(450);
    const g = await geometry();
    check(`dialog fits ${width}x${height}`, g.inside && !g.panelOverflow && !g.pageOverflow, JSON.stringify(g.p));
    check(`title clears close ${width}x${height}`, g.titleClear, JSON.stringify({ title: g.title, close: g.close }));
    check(`controls readable and clickable ${width}x${height}`, g.controlsVisible, JSON.stringify(g.buttons));
    check(`focus stays in dialog ${width}x${height}`, g.focusInside);
    await page.screenshot({ path: path.join(OUT, `rescue-${width}x${height}.png`) });
  }
  await page.setViewportSize({ width:320, height:640 });
  await page.click('#btn-ratunek-gra');
  await page.waitForSelector('#modal-srodki[hidden]', { state: 'attached' });
  check('rescue button completes flow and restores focus', await page.evaluate(() => window.__gra.displayedBalance === 10000 && document.activeElement.id === 'btn-spin'));
  await openFunds(0, 600);
  await page.waitForFunction(() => document.querySelector('#srodki-uwaga').textContent.includes('min.'));
  for (const [width,height] of [[320,640],[844,390]]) {
    await page.setViewportSize({ width,height }); await page.waitForTimeout(350);
    const g = await geometry();
    check(`cooldown dialog fits ${width}x${height}`, g.inside && !g.panelOverflow && g.controlsVisible && g.titleClear);
    check(`cooldown message readable ${width}x${height}`, await page.evaluate(() => {
      const note = document.querySelector('#srodki-uwaga'), r = note.getBoundingClientRect();
      return r.x >= 0 && r.right <= innerWidth && r.y >= 0 && r.bottom <= innerHeight && note.scrollWidth <= note.clientWidth;
    }));
    await page.screenshot({ path: path.join(OUT, `cooldown-${width}x${height}.png`) });
  }
  await page.keyboard.press('Escape');
  await page.waitForSelector('#modal-srodki[hidden]', { state: 'attached' });
  check('Escape closes dialog and restores focus', await page.evaluate(() => document.activeElement.id === 'btn-spin'));
  await page.setViewportSize({ width:320,height:640 });
  await openFunds(100, 600);
  const lower = await geometry();
  check('lower-bet action fits narrow screen', lower.controlsVisible && lower.inside && !lower.panelOverflow && lower.titleClear && await page.locator('#btn-zmniejsz').isVisible());
  await page.screenshot({ path: path.join(OUT, 'lower-320x640.png') });
  await page.click('#btn-zmniejsz');
  await page.waitForSelector('#modal-srodki[hidden]', { state: 'attached' });
  check('lower-bet button completes flow', await page.evaluate(() => document.querySelector('#bet-wartosc').textContent.trim() === '100'));
  check('no JavaScript errors', errors.length === 0, errors.join(' | '));
} catch (e) { check('test completed', false, e.stack); }
finally {
  await browser.close();
  await writeFile(path.join(OUT, 'wyniki.json'), JSON.stringify({ checks, errors }, null, 2));
  console.log(`RESULT ${checks.filter(c => c.ok).length}/${checks.length}`);
  if (checks.some(c => !c.ok)) process.exitCode = 1;
}
