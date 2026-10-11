/**
 * Audio regression checks with a real browser AudioContext and the shipped sound files.
 * Run from tools/: node e2e/audio-lifecycle.mjs
 * Set PW_CHROMIUM to Chrome/Edge; temporary browser files stay under tools/e2e/zrzuty/.
 */
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const STATIC = path.resolve(HERE, '../../src/main/resources/static');
const TEMP = path.join(HERE, 'zrzuty', 'audio-temp');
await mkdir(TEMP, { recursive: true });
process.env.TEMP = TEMP;
process.env.TMP = TEMP;
process.env.TMPDIR = TEMP;
const executablePath = process.env.PW_CHROMIUM
  ?? (process.platform === 'win32' ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
    : '/opt/pw-browsers/chromium-1194/chrome-linux/chrome');
const manifest = JSON.parse(await readFile(path.join(STATIC, 'assets/audio/manifest.json'), 'utf8'));
const source = await readFile(path.join(STATIC, 'js/audio/audio-engine.js'));
const sound = manifest.sounds.ui_klik;
const files = new Map(await Promise.all([sound.webm, sound.m4a].map(async (name) =>
  [name, await readFile(path.join(STATIC, 'assets/audio', name))])));
let version = 'audio-test-1';
const requests = [];
const errors = [];
let checks = 0;
const check = (name, condition) => { assert.ok(condition, name); checks++; console.log(`OK ${name}`); };
const html = `<!doctype html><meta charset="utf-8"><button>Włącz dźwięk</button>
<script type="module">
import { audio } from '/js/audio/audio-engine.js';
window.audio = audio;
document.querySelector('button').onclick = async () => {
  await audio.unlock();
  await audio.preload(['ui_klik']);
  audio.play('ui_klik');
  window.ready = true;
};
</script>`;
const server = createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const send = (type, body, cache = 'no-store') => {
    res.writeHead(200, { 'Content-Type': type, 'Cache-Control': cache });
    res.end(body);
  };
  if (url.pathname === '/') return send('text/html', html);
  if (url.pathname === '/js/audio/audio-engine.js') return send('text/javascript', source);
  if (url.pathname === '/assets/audio/manifest.json') {
    return send('application/json', JSON.stringify({ ...(version ? { version } : {}), sounds: { ui_klik: sound } }));
  }
  const name = url.pathname.replace('/assets/audio/', '');
  if (files.has(name)) {
    requests.push(url);
    const corrupt = version === 'aac-test' && name === sound.webm;
    return send(name.endsWith('.webm') ? 'audio/webm' : 'audio/mp4',
      corrupt ? Buffer.from('deliberately invalid Opus for fallback regression') : files.get(name), 'public, max-age=86400');
  }
  if (url.pathname === '/favicon.ico') { res.writeHead(204); res.end(); return; }
  res.writeHead(404); res.end();
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
let browser;
try {
  browser = await chromium.launch({ executablePath });
  const page = await browser.newPage();
  page.on('pageerror', (error) => errors.push(error.message));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const start = async () => {
    await page.goto(origin);
    await page.waitForFunction(() => Boolean(window.audio));
    await page.getByRole('button').click();
    await page.waitForFunction(() => window.ready && window.audio.stats().state === 'running');
  };
  const state = () => page.evaluate(() => window.audio.stats());
  const waitState = (value) => page.waitForFunction((s) => window.audio.stats().state === s, value);
  const event = (type) => page.evaluate((t) => window.dispatchEvent(new PageTransitionEvent(t, { persisted: true })), type);

  await page.goto(origin);
  await page.waitForFunction(() => Boolean(window.audio));
  await event('pagehide');
  await event('pageshow');
  check('lifecycle before a gesture does not create an AudioContext', (await state()).state === 'none');
  await page.getByRole('button').click();
  await page.waitForFunction(() => window.ready);
  check('real shipped Opus sound decodes after a gesture', (await state()).decoded === 1);
  check('audio URL includes the manifest version', requests.some((u) => u.searchParams.get('v') === version));

  await event('pagehide');
  await waitState('suspended');
  const time = await page.evaluate(() => window.audio.currentTime);
  await page.waitForTimeout(100);
  check('pagehide suspends the audio clock', Math.abs(await page.evaluate(() => window.audio.currentTime) - time) < 0.001);
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await page.waitForTimeout(50);
  check('visibilitychange cannot resume a page still hidden by pagehide', (await state()).state === 'suspended');
  await event('pageshow');
  await waitState('running');
  check('pageshow resumes the existing decoded audio', (await state()).decoded === 1);

  await event('pagehide');
  await waitState('suspended');
  await page.evaluate(() => Object.defineProperty(document, 'hidden', { configurable: true, value: true }));
  await event('pageshow');
  await page.waitForTimeout(50);
  check('pageshow does not resume a background tab', (await state()).state === 'suspended');
  await page.evaluate(() => { delete document.hidden; document.dispatchEvent(new Event('visibilitychange')); });
  await waitState('running');
  await page.evaluate(() => {
    window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true }));
    window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
  });
  await waitState('running');
  check('a rapid hide/show leaves the context running', (await state()).state === 'running');

  version = 'audio-test-2';
  await start();
  check('a new manifest version bypasses cached audio from the previous page', requests.some((u) => u.searchParams.get('v') === version));
  version = 'aac-test';
  await start();
  check('AAC fallback decodes after an Opus decode error', (await state()).format === 'm4a' && (await state()).decoded === 1);
  check('AAC fallback also includes the manifest version', requests.some((u) => u.pathname.endsWith('.m4a') && u.searchParams.get('v') === version));
  version = null;
  await start();
  check('a legacy manifest without version still loads audio', requests.some((u) => !u.searchParams.has('v')) && (await state()).decoded === 1);
  check('no browser exceptions', errors.length === 0);
  console.log(`${checks}/${checks} audio checks passed`);
} finally {
  await browser?.close();
  await new Promise((resolve) => server.close(resolve));
}