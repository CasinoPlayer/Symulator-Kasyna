// =====================================================================================================
// tools/e2e/gra-s1.mjs — test e2e gry S1 „Cebulowy 777” (runtime gier w PixiJS) w Chromium (playwright-core).
//
// Co sprawdza:
//   * logowanie w lobby → kafel S1 → ekran ładowania z paskiem → „Graj” → intro → stan gotowości,
//   * 20 spinów, w tym WYMUSZONE w atrapie (nagłówek X-Mock-Force): small, medium, WILD ×2, antycypacja, BIG, MEGA
//     (z przewinięciem), NEON JACKPOT, EPIC, ULTRA, szybki stop, TURBO, autoplay,
//   * po każdej rundzie saldo na ekranie = `balanceAfter` z odpowiedzi; na końcu = saldo z GET /api/me,
//   * brak błędów w konsoli; strażnik błysków: ≤ 3 błyski / s i żaden błysk-bohater nie pominięty;
//     poziom prezentacji z frontu = pole `tier` (04 § 2.19),
//   * zrzuty: spin w ruchu, wygrana liniowa, E50, big win w trakcie, jackpot, telefon 390×844 i 844×390,
//     komputer 1366 i 1920,
//   * wydajność: czasy klatek (requestAnimationFrame) w trakcie spinu i big win, także przy dławieniu CPU × 4
//     (CDP Emulation.setCPUThrottlingRate), liczba long tasks (> 50 ms), czas logiki i renderu z pętli gry,
//   * tryb ograniczonego ruchu: zero błysków i drżenia.
//
// Uruchomienie (najpierw atrapa: node tools/dev/mock-api.mjs):
//   cd tools && node e2e/gra-s1.mjs [http://localhost:8090] [katalog-zrzutów]
// Przeglądarka: Chromium z /opt/pw-browsers (albo PW_CHROMIUM=/ścieżka/do/chrome).
// =====================================================================================================

import { chromium } from 'playwright-core';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BASE = (process.argv[2] ?? 'http://localhost:8090').replace(/\/$/, '');
const OUT = path.resolve(process.argv[3] ?? path.join(HERE, 'zrzuty', 'gra-s1'));
const EXECUTABLE = process.env.PW_CHROMIUM ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

/** Zasoby opcjonalne (dostarcza pipeline grafiki / dźwięku) — ich brak to ostrzeżenie, nie błąd. */
const OPTIONAL = [/\/assets\/img\/manifest\.json/, /\/assets\/audio\/manifest\.json/];
/** Komunikaty sterownika programowego WebGL (SwiftShader w kontenerze bez GPU) — nie dotyczą kodu gry. */
const DRIVER_NOISE = [/GPU stall due to ReadPixels/, /swiftshader/i, /GroupMarkerNotSet/, /WebGL-0x/];

const results = [];
const warnings = [];
const consoleErrors = [];
const perf = {};

function check(name, ok, details = '') {
  results.push({ name, ok: Boolean(ok), details });
  console.log(`${ok ? '✔' : '✘'} ${name}${details ? ` — ${details}` : ''}`);
}

const norm = (s) => (s ?? '').replace(/\s+/g, ' ').trim();
const fmt = (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

function watch(page, label) {
  page.on('pageerror', (err) => consoleErrors.push(`[${label}] wyjątek JS: ${err.message}`));
  page.on('console', (msg) => {
    const type = msg.type();
    const text = msg.text();
    if (DRIVER_NOISE.some((re) => re.test(text))) return;
    const url = msg.location()?.url ?? '';
    if (type === 'error') {
      if (OPTIONAL.some((re) => re.test(url)) || (text.includes('404') && OPTIONAL.some((re) => re.test(text + url)))) warnings.push(`[${label}] brak opcjonalnego zasobu: ${url}`);
      else if (text.startsWith('Failed to load resource') && url.includes('/assets/')) warnings.push(`[${label}] brak pliku: ${url}`);
      else consoleErrors.push(`[${label}] console.error: ${text}${url ? ` (${url})` : ''}`);
    } else if (type === 'warning' && /PixiJS|shader|program/i.test(text)) consoleErrors.push(`[${label}] ostrzeżenie Pixi: ${text}`);
  });
  page.on('requestfailed', (req) => {
    const failure = req.failure()?.errorText ?? '';
    if (failure.includes('ERR_ABORTED')) return;
    consoleErrors.push(`[${label}] żądanie nieudane: ${req.url()} ${failure}`);
  });
}

/** Mierzy czasy klatek (rAF) i long tasks w przeglądarce do chwili, gdy `stopFn` zwróci true. */
async function startFrameProbe(page) {
  await page.evaluate(() => {
    const st = { frames: [], long: [], running: true };
    window.__probe = st;
    let last = performance.now();
    const loop = (now) => {
      st.frames.push(now - last);
      last = now;
      if (st.running) requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
    try {
      st.obs = new PerformanceObserver((list) => { for (const e of list.getEntries()) st.long.push(Math.round(e.duration)); });
      st.obs.observe({ type: 'longtask', buffered: false });
    } catch { /* brak API */ }
  });
}

async function stopFrameProbe(page) {
  return page.evaluate(() => {
    const st = window.__probe;
    st.running = false;
    st.obs?.disconnect();
    const a = [...st.frames].slice(1).sort((x, y) => x - y);
    const q = (p) => (a.length ? a[Math.min(a.length - 1, Math.floor(p * a.length))] : 0);
    return { frames: a.length, p50: Number(q(0.5).toFixed(1)), p95: Number(q(0.95).toFixed(1)), max: Number((a.at(-1) ?? 0).toFixed(1)), longTasks: st.long.length, longest: Math.max(0, ...st.long) };
  });
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch({ executablePath: EXECUTABLE, args: ['--disable-gpu-sandbox', '--enable-unsafe-swiftshader'] });
  const context = await browser.newContext({ viewport: { width: 1366, height: 768 }, deviceScaleFactor: 1, locale: 'pl-PL' });
  const page = await context.newPage();
  watch(page, 'gra-s1');
  const shot = (name) => page.screenshot({ path: path.join(OUT, `${name}.png`) });
  const gra = (expr) => page.evaluate(`window.__gra?.${expr}`);

  // wymuszanie wyniku w atrapie: nagłówek X-Mock-Force dodawany do żądania spinu
  let force = null;
  await page.route('**/api/slots/*/spins', (route) => {
    const headers = { ...route.request().headers() };
    if (force) headers['x-mock-force'] = force;
    route.continue({ headers });
  });

  // ------------------------------------------------------------------ 1. logowanie w lobby i wejście do S1
  await page.goto(`${BASE}/`, { waitUntil: 'load' });
  await page.waitForSelector('#kafle .tile:not(.tile--skeleton)', { timeout: 15_000 });
  await page.click('#btn-zaloguj');
  await page.waitForSelector('#modal-logowanie.is-open');
  const nick = `S1_${Date.now().toString(36).slice(-6)}`;
  await page.fill('#nick', nick);
  await page.keyboard.press('Enter');
  await page.waitForSelector('.reward', { state: 'detached', timeout: 15_000 }).catch(() => {});
  await page.click('#kafle .tile[data-code="cebulowy-777"]');
  await page.waitForURL(/gra\.html\?gra=cebulowy-777/, { timeout: 10_000 });
  check('kafel S1 prowadzi do gra.html?gra=cebulowy-777', page.url().includes('gra=cebulowy-777'));
  const loadStart = Date.now();
  await page.waitForSelector('#ladowanie-pasek', { timeout: 5000 });
  await page.waitForTimeout(400);
  await shot('01-ladowanie');
  await page.waitForSelector('#btn-graj:not([hidden])', { timeout: 60_000 });
  perf.loadMs = Date.now() - loadStart;
  check('ekran ładowania dochodzi do 100% i pokazuje „Graj”', true, `${perf.loadMs} ms`);
  await page.click('#btn-graj');
  await page.waitForFunction(() => window.__gra?.state === 'ready', null, { timeout: 30_000 });
  check('intro kończy się stanem gotowości (SPIN aktywny)', (await gra('state')) === 'ready');
  check('płótno PixiJS na scenie', (await page.locator('#scena canvas').count()) === 1);
  await page.waitForTimeout(800);
  // dźwięk: odblokowany gestem „Graj”, pakiet krytyczny zdekodowany, muzyka gry gra od loopStart (05 § 2.4, § 7.3)
  const snd = await gra('audio()');
  perf.audioAfterIntro = snd;
  if (snd?.sounds > 0) {
    check('dźwięk odblokowany gestem „Graj” (AudioContext running)', snd.unlocked && snd.state === 'running', snd.state);
    check('pakiet krytyczny dźwięków zdekodowany (ui + gry-krytyczne + s1)', snd.decoded >= 30, `${snd.decoded} plików, format ${snd.format}`);
    check('muzyka gry mus_s1 gra po intro, tonacja s1', snd.music?.id === 'mus_s1' && snd.keyContext === 's1', JSON.stringify(snd.music));
  } else {
    warnings.push('brak manifestu dźwięków (static/assets/audio) — testy dźwięku pominięte');
  }
  await shot('02-gotowy-1366');

  // ------------------------------------------------------------------ 2. 20 spinów (wymuszone i losowe)
  const plan = [
    { f: null, note: 'losowy', shotSpin: true },
    { f: 'small', note: 'wygrana liniowa', shotLines: true },
    { f: 'medium', note: 'wygrana medium', shotLines: true },
    { f: 'wild', note: 'neonowy mnożnik ×2 (E50)', shotLines: true },
    { f: 'anticipation', note: 'antycypacja (E27)', shotAnticipation: true },
    { f: 'lose', note: 'przegrana' },
    { f: 'big', note: 'BIG WIN', shotBig: true, measure: 'bigwin' },
    { f: 'mega', note: 'MEGA WIN + przewinięcie', skipBig: true },
    { f: 'jackpot', note: 'NEON JACKPOT (E51)', shotJackpot: true },
    { f: 'epic', note: 'EPIC WIN (eskalacje)', shotBig: true },
    { f: null, note: 'szybki stop', slam: true },
    { f: 'ultra', note: 'ULTRA WIN', shotBig: true, skipBig: true },
    { f: null, note: 'TURBO', turbo: true },
    { f: 'small', note: 'TURBO small', turbo: true },
    { f: 'medium', note: 'TURBO medium', turbo: true },
    { f: 'big', note: 'TURBO big', turbo: true },
    { f: null, note: 'autoplay 1', auto: true },
    { f: null, note: 'autoplay 2', autoContinue: true },
    { f: 'wild', note: 'losowy z WILD' },
    { f: null, note: 'losowy' },
  ];
  let balanceMismatches = 0;
  let spins = 0;
  let turbo = false;
  for (let i = 0; i < plan.length; i++) {
    const p = plan[i];
    force = p.f;
    if (Boolean(p.turbo) !== turbo) {
      await page.click('#btn-turbo');
      turbo = Boolean(p.turbo);
    }
    const before = (await gra('responses.length')) ?? 0;
    if (p.auto) {
      await page.click('#btn-auto');
      await page.click('#auto-menu input[value="10"]');
      await page.click('#auto-start');
    } else if (!p.autoContinue) {
      await page.keyboard.press('Space');
    }
    if (p.slam) {
      await page.waitForTimeout(250);
      await page.keyboard.press('Space');       // STOP w trakcie obrotu
    }
    if (p.shotSpin) {
      await page.waitForFunction(() => window.__gra?.reelsSpinning, null, { timeout: 5000 });
      await page.waitForTimeout(350);
      await shot('03-spin-w-ruchu');
    }
    await page.waitForFunction((n) => (window.__gra?.responses.length ?? 0) > n, before, { timeout: 20_000 });
    if (p.measure === 'bigwin') {
      // pomiar klatek: big win bez dławienia CPU (dławienie × 4 — osobny pomiar w części 4)
      await startFrameProbe(page);
      await page.evaluate(() => window.__gra.perfReset());
    }
    if (p.shotLines) {
      // zrzut, gdy prezentacja się rozwinęła (przyciemnienie niewygrywających ≥ 0,5) — niezależnie od tempa klatek
      await page.waitForFunction(() => window.__gra?.linesShown > 0 && !window.__gra?.reelsSpinning && window.__gra._game.dimRect.alpha > 0.5, null, { timeout: 20_000 }).catch(() => {});
      await page.waitForTimeout(300);
      await shot(`04-wygrana-${p.f}`);
    }
    if (p.shotAnticipation) {
      await page.waitForFunction(() => window.__gra?._game.anticipating, null, { timeout: 10_000 }).catch(() => {});
      await page.waitForTimeout(300);
      await shot('05-antycypacja');
    }
    if (p.shotJackpot) {
      await page.waitForFunction(() => window.__gra?.jackpotShowing, null, { timeout: 20_000 }).catch(() => {});
      await page.waitForTimeout(500);
      await shot('07-neon-jackpot');
    }
    if (p.shotBig || p.skipBig) {
      await page.waitForFunction(() => window.__gra?.bigWinPhase === 'count', null, { timeout: 60_000 }).catch(() => {});
      if (p.shotBig) {
        await page.waitForTimeout(p.f === 'big' ? 700 : 1600);
        await shot(`06-${p.f}-win-w-trakcie`);
      }
      if (p.skipBig) {
        await page.waitForTimeout(500);
        await page.keyboard.press('Space');     // przewinięcie (04 § 4.5)
        await page.waitForFunction(() => window.__gra?.bigWinPhase === 'hold', null, { timeout: 10_000 }).catch(() => {});
        await shot(`06-${p.f}-po-przewinieciu`);
      }
    }
    if (p.auto) {
      // autoplay: czekamy na drugą rundę i zatrzymujemy autoplay przyciskiem SPIN
      await page.waitForFunction((n) => (window.__gra?.responses.length ?? 0) > n + 1, before, { timeout: 120_000 });
      await page.click('#btn-spin');
      check('autoplay zatrzymany przyciskiem SPIN', !(await gra('autoplay')));
    }
    await page.waitForFunction(() => window.__gra?.state === 'ready', null, { timeout: 240_000 });   // ULTRA/jackpot przy 10 fps (SwiftShader) trwa długo
    if (p.measure === 'bigwin') {
      perf.bigWinNoThrottle = await stopFrameProbe(page);
      perf.bigWinNoThrottleLoop = await page.evaluate(() => window.__gra.perf());
    }
    const last = await gra('lastResponse');
    spins = await gra('responses.length');
    // saldo na ekranie = balanceAfter (licznik salda animuje się do 1,8 s)
    const ok = await page.waitForFunction((v) => window.__gra?.shownBalanceText?.replace(/\s/g, '') === String(v), last.balanceAfter, { timeout: 5000 }).then(() => true).catch(() => false);
    if (!ok) balanceMismatches++;
    const tierLabel = last.tier === 'none' ? 'bez wygranej' : last.tier;
    console.log(`  spin ${String(spins).padStart(2)} [${p.note}] tier=${tierLabel} wygrana=${fmt(last.totalWin)} saldo=${fmt(last.balanceAfter)} ${ok ? '' : '✘ saldo na ekranie: ' + (await gra('shownBalanceText'))}`);
    if (p.auto) i++;     // autoplay rozegrał też rundę z kolejnego wpisu planu
  }
  if (turbo) await page.click('#btn-turbo');
  check('rozegrano co najmniej 20 spinów', spins >= 20, `${spins}`);
  check('saldo na ekranie zgodne z balanceAfter po każdej rundzie', balanceMismatches === 0, balanceMismatches ? `${balanceMismatches} rozbieżności` : '');
  const me = await page.evaluate(() => fetch('api/me').then((r) => r.json()));
  const lastResp = await gra('lastResponse');
  check('saldo z GET /api/me = balanceAfter ostatniej rundy', me.balance === lastResp.balanceAfter, `${me.balance} / ${lastResp.balanceAfter}`);
  const responses = await gra('responses');
  const tiers = responses.map((r) => r.tier);
  for (const t of ['big', 'mega', 'epic', 'ultra']) check(`w serii był poziom ${t.toUpperCase()}`, tiers.includes(t));
  check('w serii był NEON JACKPOT (krok feature)', responses.some((r) => r.steps.some((s) => s.type === 'feature' && s.name === 'neonJackpot')));
  const dbg = await gra('debug()');
  check('poziom prezentacji z frontu = pole tier (04 § 2.19)', dbg.stats.tierMismatch === 0, `rozjazdy: ${dbg.stats.tierMismatch}`);
  check('strażnik błysków: ≤ 3 błyski w każdym oknie 1 s', dbg.flashMaxPerSecond <= 3, `maks. ${dbg.flashMaxPerSecond}`);
  check('żaden błysk-bohater nie został pominięty', dbg.heroSkips === 0, `pominięte: ${dbg.heroSkips}`);
  check('E50 neonowy mnożnik odegrany', dbg.stats.wildMultipliers > 0, `${dbg.stats.wildMultipliers}×`);
  perf.qualityLog = await gra('qualityLog()');
  perf.finalQuality = dbg.quality;
  const sndAfter = await gra('audio()');
  perf.audioAfterSeries = sndAfter;
  if (sndAfter?.sounds > 0) {
    // po big winach muzyka wraca do utworu gry (od zapamiętanego taktu), tonacja s1, bez zawieszonego duckingu
    await page.waitForFunction(() => window.__gra.audio().music?.id === 'mus_s1', null, { timeout: 15_000 }).catch(() => {});
    const s = await gra('audio()');
    check('po big winach wraca muzyka gry, tonacja s1, ducking zwolniony', s.music?.id === 'mus_s1' && s.keyContext === 's1' && !Object.keys(s.ducks).length, JSON.stringify({ music: s.music, key: s.keyContext, ducks: s.ducks }));
    check('limit głosów dźwięku nieprzekroczony w spoczynku', s.voices <= s.maxVoices, `${s.voices}/${s.maxVoices}`);
  }

  // ------------------------------------------------------------------ 3. okno zasad, responsywność
  await page.click('#btn-info');
  await page.waitForSelector('#modal-info.is-open');
  await page.waitForTimeout(400);
  check('okno zasad: tabela wypłat i linie z API', (await page.locator('.paytable__row').count()) === 8 && (await page.locator('.payline').count()) === 5);
  await shot('08-zasady');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  for (const [w, h, name, f] of [[390, 844, '09-telefon-390x844', 'medium'], [844, 390, '10-telefon-844x390-poziomo', 'big'], [1920, 1080, '11-komputer-1920', 'epic'], [1366, 768, '12-komputer-1366', 'small']]) {
    await page.setViewportSize({ width: w, height: h });
    await page.waitForTimeout(900);
    const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    check(`brak poziomego przewijania @${w}×${h}`, over <= 0, over > 0 ? `nadmiar ${over}px` : '');
    const panelOk = await page.evaluate(() => {
      const s = document.querySelector('#btn-spin').getBoundingClientRect();
      return s.width > 40 && s.bottom <= window.innerHeight && s.right <= window.innerWidth && s.left >= 0;
    });
    check(`SPIN widoczny w całości @${w}×${h}`, panelOk);
    await shot(`${name}-spoczynek`);
    force = f;
    const before = await gra('responses.length');
    await page.keyboard.press('Space');
    await page.waitForFunction((n) => (window.__gra?.responses.length ?? 0) > n, before, { timeout: 20_000 });
    if (f === 'big' || f === 'epic') {
      await page.waitForFunction(() => window.__gra?.bigWinPhase === 'count', null, { timeout: 60_000 }).catch(() => {});
      await page.waitForTimeout(900);
    } else {
      await page.waitForFunction(() => window.__gra?.linesShown > 0 && !window.__gra?.reelsSpinning, null, { timeout: 20_000 }).catch(() => {});
      await page.waitForTimeout(600);
    }
    await shot(`${name}-wygrana`);
    await page.keyboard.press('Space');
    await page.waitForFunction(() => window.__gra?.state === 'ready', null, { timeout: 240_000 });   // ULTRA/jackpot przy 10 fps (SwiftShader) trwa długo
  }

  // ------------------------------------------------------------------ 4. wydajność: dławienie CPU × 4 (CDP)
  const cdp = await context.newCDPSession(page);
  for (const [label, rate] of [['bez dławienia', 1], ['CPU ×4', 4]]) {
    await cdp.send('Emulation.setCPUThrottlingRate', { rate });
    await page.waitForTimeout(500);
    force = 'big';
    await page.evaluate(() => window.__gra.perfReset());
    await startFrameProbe(page);
    const before = await gra('responses.length');
    await page.keyboard.press('Space');
    await page.waitForFunction((n) => (window.__gra?.responses.length ?? 0) > n, before, { timeout: 30_000 });
    await page.waitForFunction(() => !window.__gra?.reelsSpinning, null, { timeout: 60_000 });
    const spin = await stopFrameProbe(page);
    const spinLoop = await page.evaluate(() => window.__gra.perf());
    await page.evaluate(() => window.__gra.perfReset());
    await startFrameProbe(page);
    await page.waitForFunction(() => window.__gra?.state === 'ready', null, { timeout: 300_000 });
    const big = await stopFrameProbe(page);
    const bigLoop = await page.evaluate(() => window.__gra.perf());
    perf[label] = { spin, spinLoop, bigWin: big, bigWinLoop: bigLoop, quality: (await gra('debug()')).quality };
    console.log(`  wydajność [${label}] spin: p50 ${spin.p50} ms, p95 ${spin.p95} ms, long tasks ${spin.longTasks} | big win: p50 ${big.p50} ms, p95 ${big.p95} ms, long tasks ${big.longTasks} (najdłuższy ${big.longest} ms) | logika p95 ${bigLoop.logic.p95.toFixed(2)} ms, render p95 ${bigLoop.render.p95.toFixed(2)} ms`);
  }
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  await shot('13-po-pomiarach');
  await context.close();

  // ------------------------------------------------------------------ 5. ograniczony ruch: bez błysków i drżenia
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce', locale: 'pl-PL' });
    const pg = await ctx.newPage();
    watch(pg, 'reduced-motion');
    let f2 = 'big';
    await pg.route('**/api/slots/*/spins', (route) => route.continue({ headers: { ...route.request().headers(), 'x-mock-force': f2 } }));
    await pg.goto(`${BASE}/`);
    await pg.evaluate(async (n) => {
      await fetch('api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nick: n }) });
      localStorage.setItem('cebulion.sesja', '1');
    }, `RM_${Date.now().toString(36).slice(-6)}`);
    await pg.goto(`${BASE}/gra.html?gra=cebulowy-777`);
    await pg.waitForSelector('#btn-graj:not([hidden])', { timeout: 60_000 });
    await pg.click('#btn-graj');
    await pg.waitForFunction(() => window.__gra?.state === 'ready', null, { timeout: 30_000 });
    let maxTrauma = 0;
    for (const f of ['big', 'jackpot']) {
      f2 = f;
      const before = await pg.evaluate(() => window.__gra.responses.length);
      await pg.keyboard.press('Space');
      await pg.waitForFunction((n) => window.__gra.responses.length > n, before, { timeout: 20_000 });
      while ((await pg.evaluate(() => window.__gra.state)) !== 'ready') {
        maxTrauma = Math.max(maxTrauma, await pg.evaluate(() => window.__gra.trauma));
        await pg.waitForTimeout(150);
      }
    }
    await pg.screenshot({ path: path.join(OUT, '14-ograniczony-ruch-390.png') });
    const log = await pg.evaluate(() => window.__gra.flashLog());
    check('ograniczony ruch: zero błysków (strażnik pomija wszystkie)', !log.some((e) => e.decision === 'full' || e.decision === 'soft'), `${log.length} próśb`);
    check('ograniczony ruch: zero próśb o migotanie neonu', !log.some((e) => e.kind === 'neon'));
    check('ograniczony ruch: kamera nie drży (trauma 0)', maxTrauma === 0, `maks. ${maxTrauma}`);
    await ctx.close();
  }

  await browser.close();
  check('brak błędów w konsoli przeglądarki', consoleErrors.length === 0, consoleErrors.slice(0, 5).join(' | '));
  for (const w of [...new Set(warnings)]) console.log(`! ${w}`);
  const failed = results.filter((r) => !r.ok);
  await writeFile(path.join(OUT, 'wyniki.json'), JSON.stringify({ base: BASE, at: new Date().toISOString(), results, perf, warnings: [...new Set(warnings)], consoleErrors }, null, 2));
  console.log(`\n${results.length - failed.length}/${results.length} sprawdzeń OK. Zrzuty i wyniki: ${OUT}`);
  process.exit(failed.length ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(2);
});
