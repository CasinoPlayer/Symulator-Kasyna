// =====================================================================================================
// tools/e2e/smoke.mjs — test dymny (smoke test) front-endu w prawdziwej przeglądarce (Chromium + playwright-core).
//
// Po co: jednym poleceniem sprawdzamy to, czego nie złapią testy jednostkowe Javy — że lobby się wyświetla,
// nie ma błędów w konsoli, strona nie przewija się w poziomie na telefonach, logowanie daje 10 000 cebulionów,
// okno logowania zamyka się klawiszem Esc, wizytówka „O projekcie” jest na miejscu, a strona gry się ładuje.
// Przy okazji robi zrzuty ekranu do obejrzenia (dokumentacja, porównanie przed/po zmianach).
//
// Uruchomienie (najpierw serwer: atrapa `npm run dev` w tools/ albo prawdziwa aplikacja Spring Boot):
//   cd tools && npm run e2e                                   → http://localhost:8090, zrzuty w tools/e2e/zrzuty/
//   node e2e/smoke.mjs http://localhost:8080 /tmp/zrzuty      → własny adres i katalog zrzutów
// Przeglądarka: Chromium z /opt/pw-browsers (albo zmienna PW_CHROMIUM=/ścieżka/do/chrome). NIE uruchamiamy
// `playwright install` — korzystamy z przeglądarki zainstalowanej w systemie (executablePath).
//
// Testy atrapy-specyficzne (bankructwo przez POST /api/dev/gracz) są pomijane, gdy serwer ich nie obsługuje.
// =====================================================================================================

import { chromium } from 'playwright-core';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BASE = (process.argv[2] ?? 'http://localhost:8090').replace(/\/$/, '');
const OUT = path.resolve(process.argv[3] ?? path.join(HERE, 'zrzuty'));
const EXECUTABLE = process.env.PW_CHROMIUM ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

/** Zasoby opcjonalne: ich brak (404) to ostrzeżenie, nie błąd — dostarcza je pipeline grafiki/dźwięku. */
const OPTIONAL = [/\/assets\/img\/manifest\.json/, /\/assets\/audio\/manifest\.json/];

const VIEWPORTS = [
  { width: 320, height: 640, name: '320' },
  { width: 390, height: 844, name: '390' },
  { width: 820, height: 1180, name: '820' },
  { width: 1366, height: 768, name: '1366' },
  { width: 1920, height: 1080, name: '1920' },
];

const results = [];
const warnings = [];
const consoleErrors = [];
/** Błędy HTTP, które test wywołuje CELOWO (np. zakazana nazwa → 400) — przeglądarka i tak loguje je w konsoli. */
const expectedHttp = [];

function check(name, ok, details = '') {
  results.push({ name, ok: Boolean(ok), details });
  console.log(`${ok ? '✔' : '✘'} ${name}${details ? ` — ${details}` : ''}`);
}

const norm = (s) => (s ?? '').replace(/\s+/g, ' ').trim();

/** Podłącza nasłuch błędów: wyjątki JS, console.error i odpowiedzi HTTP ≥ 400. */
function watch(page, label) {
  page.on('pageerror', (err) => consoleErrors.push(`[${label}] wyjątek JS: ${err.message}`));
  page.on('console', (msg) => {
    if (msg.type() !== 'error') return;
    const url = msg.location()?.url ?? '';
    if (expectedHttp.some((re) => re.test(url))) return;
    if (OPTIONAL.some((re) => re.test(url))) warnings.push(`[${label}] brak opcjonalnego zasobu: ${url}`);
    else consoleErrors.push(`[${label}] console.error: ${msg.text()}${url ? ` (${url})` : ''}`);
  });
  page.on('requestfailed', (req) => {
    const failure = req.failure()?.errorText ?? '';
    if (failure.includes('ERR_ABORTED')) return; // przerwane przy zmianie strony — normalne
    consoleErrors.push(`[${label}] żądanie nieudane: ${req.url()} ${failure}`);
  });
}

async function newPage(browser, viewport, label, options = {}) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1, locale: 'pl-PL', ...options });
  const page = await context.newPage();
  watch(page, label);
  return { context, page };
}

async function waitForLobby(page) {
  await page.goto(`${BASE}/`, { waitUntil: 'load' });
  await page.waitForSelector('#kafle .tile:not(.tile--skeleton)', { timeout: 10_000 });
  await page.waitForFunction(() => document.body.classList.contains('is-ready'));
  await page.waitForTimeout(900); // animacje wejścia (E01)
}

/** Przewija stronę do końca, żeby zadziałały animacje wejścia sekcji (IntersectionObserver), i wraca na górę. */
async function scrollThrough(page) {
  await page.evaluate(async () => {
    const step = Math.max(200, window.innerHeight * 0.7);
    // behavior 'instant': strona ma scroll-behavior: smooth, a tu chcemy natychmiastowe przewinięcie
    for (let y = 0; y < document.documentElement.scrollHeight; y += step) {
      window.scrollTo({ top: y, behavior: 'instant' });
      await new Promise((r) => setTimeout(r, 60));
    }
    window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' });
    await new Promise((r) => setTimeout(r, 900));
    window.scrollTo({ top: 0, behavior: 'instant' });
  });
  await page.waitForTimeout(300);
}

async function balanceText(page, selector = '#saldo .balance-pill__value') {
  return norm(await page.textContent(selector));
}

/**
 * Strażnik płynności: wszystkie animacje CSS (@keyframes) działające w tej chwili na stronie mogą zmieniać tylko
 * właściwości, które liczy kompozytor (transform, translate, rotate, scale, opacity). Animacja np. box-shadow
 * albo background-position przemalowuje element w każdej klatce — na słabym telefonie to gubienie klatek.
 * Krótkich przejść stanu (transition przy najechaniu, pasek po przewinięciu) nie liczymy: trwają ≤ 320 ms
 * i dzieją się raz, a nie w pętli. Zwraca listę naruszeń w postaci „nazwa: właściwości”.
 */
async function nonCompositedAnimations(page) {
  return page.evaluate(() => {
    const allowed = new Set(['transform', 'translate', 'rotate', 'scale', 'opacity', 'offset', 'easing', 'composite', 'computedOffset']);
    return document.getAnimations().filter((a) => a.animationName).flatMap((a) => {
      const props = new Set((a.effect?.getKeyframes?.() ?? []).flatMap((k) => Object.keys(k)));
      const bad = [...props].filter((p) => !allowed.has(p));
      return bad.length ? [`${a.animationName ?? a.transitionProperty ?? 'animacja'}: ${bad.join(', ')}`] : [];
    });
  });
}

/** Czy elementy paska górnego (z rzeczywistą szerokością tekstu, nie tylko pudełek) nie nachodzą na siebie. */
async function topbarProblems(page) {
  return page.evaluate(() => {
    const visible = (el) => el && el.getClientRects().length > 0;
    // zasięg = pudełko elementu ∪ WIDOCZNY tekst (tekst może wylać się poza skurczony kontener); pomijamy
    // tekst .sr-only — jest przycięty do 1 px, ale jego geometria „wystaje” i dawała fałszywe alarmy
    const extent = (el) => {
      const box = el.getBoundingClientRect();
      let { left, right } = box;
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        if (!node.textContent.trim() || node.parentElement.closest('.sr-only, [hidden]')) continue;
        const range = document.createRange();
        range.selectNodeContents(node);
        for (const r of range.getClientRects()) {
          left = Math.min(left, r.left);
          right = Math.max(right, r.right);
        }
      }
      return { left, right };
    };
    const parts = ['.brand', '.topnav', '#btn-zaloguj', '#saldo', '#btn-menu'].map((s) => document.querySelector(s)).filter(visible).map(extent);
    const problems = [];
    for (let i = 1; i < parts.length; i++) if (parts[i].left < parts[i - 1].right - 0.5) problems.push('nachodzenie');
    if (parts.at(-1).right > window.innerWidth) problems.push('wychodzi poza ekran');
    if (document.documentElement.scrollWidth > document.documentElement.clientWidth) problems.push('poziome przewijanie');
    return problems;
  });
}

/**
 * Loguje i czeka, aż serwer odpowie (w pasku pojawi się saldo) oraz skończy się sekwencja bonusu.
 * Uwaga: samo waitForSelector('.reward', {state: 'detached'}) kończy się od razu, jeśli zasłona jeszcze
 * nie powstała — wtedy kolejne kroki testu startowały w trakcie logowania.
 */
async function login(page, nick) {
  await page.click('#btn-zaloguj');
  await page.waitForSelector('#modal-logowanie.is-open');
  await page.fill('#nick', nick);
  await page.keyboard.press('Enter');
  await page.waitForSelector('#topbar-gracz:not([hidden])', { timeout: 8000 });
  await page.waitForSelector('.reward', { state: 'detached', timeout: 12_000 });
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch({ executablePath: EXECUTABLE, args: ['--disable-gpu-sandbox'] });
  const shot = (page, name, fullPage = false) => page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage });
  const suffix = Date.now().toString(36).slice(-5);

  // ------------------------------------------------------------------ 1. lobby na 5 szerokościach
  for (const vp of VIEWPORTS) {
    const { context, page } = await newPage(browser, { width: vp.width, height: vp.height }, `lobby-${vp.name}`);
    await waitForLobby(page);
    await shot(page, `lobby-${vp.name}`);
    await scrollThrough(page);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    check(`brak poziomego przewijania @${vp.width}px`, overflow <= 0, overflow > 0 ? `nadmiar ${overflow}px` : '');
    const box = await page.locator('#btn-zaloguj').boundingBox();
    const topRight = box && box.x + box.width >= vp.width * 0.72 && box.y < 90 && box.x + box.width <= vp.width;
    check(`„Zaloguj” w prawym górnym rogu @${vp.width}px`, topRight, box ? `x=${Math.round(box.x)} y=${Math.round(box.y)} w=${Math.round(box.width)}` : 'brak przycisku');
    const badAnims = await nonCompositedAnimations(page);
    check(`animacje tylko transform/opacity @${vp.width}px`, badAnims.length === 0, badAnims.join(' | '));
    // ≤ 900 px kafle są karuzelą (na tablecie trzy kolumny były za ciasne), od 901 px — siatką 3 kolumn
    const tiles = await page.evaluate(() => {
      const list = document.querySelector('#kafle');
      return { carousel: list.scrollWidth > list.clientWidth + 1, width: Math.round(list.querySelector('.tile').getBoundingClientRect().width) };
    });
    if (vp.width <= 900) check(`kafle jako karuzela z czytelnymi kaflami @${vp.width}px`, tiles.carousel && tiles.width >= 220, `szerokość kafla ${tiles.width}px`);
    else check(`kafle w siatce 3 kolumn @${vp.width}px`, !tiles.carousel, `szerokość kafla ${tiles.width}px`);
    await shot(page, `lobby-${vp.name}-calosc`, true);
    await context.close();
  }

  // ------------------------------------------------------------------ 2. wizytówka „O projekcie” (R1.04)
  {
    const { context, page } = await newPage(browser, { width: 1366, height: 768 }, 'o-projekcie');
    await waitForLobby(page);
    const about = norm(await page.textContent('#o-projekcie').catch(() => ''));
    const needed = ['O projekcie', 'Konrad Paulus', '112960', 'Dominik Pacanowski', '112961', 'Dawid Majewski', '113154', 'Kamil', 'Najważniejsze funkcje', 'Zmiany w projekcie', 'LAB 01'];
    const missing = needed.filter((t) => !about.includes(t));
    check('sekcja „O projekcie” z autorami, personą, funkcjami i zmianami', missing.length === 0, missing.length ? `brak: ${missing.join(', ')}` : '');
    const html = await page.content();
    check('brak tekstu „[uzupełnij” na stronie', !html.includes('[uzupełnij'));
    check('link do konsoli H2', await page.locator('#o-projekcie a[href$="h2-console"]').count() === 1);
    check('stopka „symulator — cebuliony nie mają wartości”', norm(await page.textContent('footer')).includes('symulator — cebuliony nie mają wartości'));
    await page.locator('#o-projekcie').scrollIntoViewIfNeeded();
    await page.waitForTimeout(900);
    await shot(page, 'o-projekcie-1366');
    await context.close();
  }

  // ------------------------------------------------------------------ 3. okno logowania: Esc, walidacja, logowanie, bonus
  for (const vp of [{ width: 1366, height: 768, name: '1366' }, { width: 390, height: 844, name: '390' }]) {
    const { context, page } = await newPage(browser, { width: vp.width, height: vp.height }, `logowanie-${vp.name}`);
    await waitForLobby(page);

    await page.click('#btn-zaloguj');
    await page.waitForSelector('#modal-logowanie.is-open');
    await page.waitForTimeout(450);
    check(`okno logowania otwiera się @${vp.width}px`, await page.isVisible('#nick'));
    check(`fokus w polu „Nazwa gracza” @${vp.width}px`, await page.evaluate(() => document.activeElement?.id === 'nick'));
    await shot(page, `logowanie-okno-${vp.name}`);
    await page.keyboard.press('Escape');
    await page.waitForSelector('#modal-logowanie', { state: 'hidden', timeout: 3000 }).catch(() => {});
    check(`Esc zamyka okno logowania @${vp.width}px`, await page.isHidden('#modal-logowanie'));
    check(`fokus wraca na „Zaloguj” @${vp.width}px`, await page.evaluate(() => document.activeElement?.id === 'btn-zaloguj'));

    await page.click('#btn-zaloguj');
    await page.waitForSelector('#modal-logowanie.is-open');
    await page.fill('#nick', 'ab');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);
    const err = norm(await page.textContent('#nick-blad'));
    check(`walidacja nazwy po stronie przeglądarki @${vp.width}px`, err.includes('co najmniej 3'), err);
    expectedHttp.push(/\/api\/auth\/login$/);   // celowo zakazana nazwa: serwer odpowie 400 NICK_FORBIDDEN
    await page.fill('#nick', 'admin');
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => document.querySelector('#nick-blad')?.textContent.includes('niedozwolona'), null, { timeout: 4000 }).catch(() => {});
    await page.waitForTimeout(200);
    expectedHttp.pop();
    const forbidden = norm(await page.textContent('#nick-blad'));
    check(`błąd z serwera (NICK_FORBIDDEN) pokazany przy polu @${vp.width}px`, forbidden.includes('niedozwolona'), forbidden);
    await shot(page, `logowanie-blad-${vp.name}`);

    const nick = `Gracz_${vp.name}${suffix}`.slice(0, 16);
    await page.fill('#nick', nick);
    await page.keyboard.press('Enter');
    const overlay = await page.waitForSelector('.reward', { timeout: 5000 }).then(() => true).catch(() => false);
    check(`sekwencja bonusu powitalnego startuje @${vp.width}px`, overlay);
    await page.waitForTimeout(1250);
    await shot(page, `bonus-sekwencja-${vp.name}`);
    await page.waitForSelector('.reward', { state: 'detached', timeout: 9000 }).catch(() => {});
    await page.waitForFunction(() => document.querySelector('#saldo .balance-pill__value')?.textContent.replace(/\s/g, ' ') === '10 000', null, { timeout: 5000 }).catch(() => {});
    const balance = await balanceText(page);
    check(`po logowaniu saldo 10 000 widoczne @${vp.width}px`, balance === '10 000' && await page.isVisible('#saldo'), balance);
    const toastText = norm(await page.textContent('.toast-region').catch(() => ''));
    check(`toast „Witaj, ${nick}!” @${vp.width}px`, toastText.includes(`Witaj, ${nick}!`), toastText.slice(0, 80));
    // „Zaloguj” zniknął po zalogowaniu — fokus nie może spaść na <body> (użytkownik klawiatury zaczynałby od początku)
    const focused = await page.evaluate(() => document.activeElement?.id || document.activeElement?.tagName);
    check(`fokus po zalogowaniu na menu gracza @${vp.width}px`, focused === 'btn-menu', focused);
    await page.waitForTimeout(400);
    await shot(page, `zalogowany-${vp.name}`);

    await page.click('#btn-menu');
    await page.waitForSelector('#menu-gracza:not([hidden])');
    await page.waitForTimeout(350); // animacja otwarcia menu
    const covered = await page.evaluate(() => {
      const menu = document.querySelector('#menu-gracza').getBoundingClientRect();
      return [...document.querySelectorAll('.toast')].some((t) => {
        const r = t.getBoundingClientRect();
        return r.left < menu.right && r.right > menu.left && r.top < menu.bottom && r.bottom > menu.top;
      });
    });
    check(`powiadomienie nie zasłania menu gracza @${vp.width}px`, !covered);
    await shot(page, `menu-gracza-${vp.name}`);
    await page.keyboard.press('Escape');
    // wzorzec „menu button”: Tab z otwartego menu zamyka je (menu nie zostaje otwarte za plecami użytkownika)
    await page.focus('#btn-menu');
    await page.keyboard.press('Enter');
    await page.waitForSelector('#menu-gracza:not([hidden])');
    await page.keyboard.press('Tab');
    check(`Tab zamyka menu gracza @${vp.width}px`, await page.isHidden('#menu-gracza'));

    if (vp.name === '1366') {
      // pasek górny po zalogowaniu (duże saldo i najdłuższa nazwa ustawiamy w DOM — liczy się sam układ)
      await page.evaluate(() => {
        document.querySelector('#saldo .balance-pill__value').textContent = '1 234 567';
        document.querySelector('#nick-gracza').textContent = 'Żółwiowski_Mistr';
      });
      const bad = [];
      for (const w of [320, 360, 400, 440, 490, 520, 560, 640, 660, 700, 740, 820, 900, 1000, 1100, 1200, 1280, 1320, 1440]) {
        await page.setViewportSize({ width: w, height: 800 });
        await page.waitForTimeout(40);
        const problems = await topbarProblems(page);
        if (problems.length) bad.push(`${w}px: ${problems.join(', ')}`);
      }
      await page.setViewportSize({ width: vp.width, height: vp.height });
      check('pasek górny po zalogowaniu bez nachodzenia (320–1440 px, duże saldo, długa nazwa)', bad.length === 0, bad.join(' | '));
    }

    // odświeżenie strony przywraca sesję (GET /api/me)
    await page.reload({ waitUntil: 'load' });
    await page.waitForSelector('#topbar-gracz:not([hidden])', { timeout: 5000 }).catch(() => {});
    check(`odświeżenie przywraca sesję @${vp.width}px`, (await balanceText(page)) === '10 000');

    if (vp.name === '1366') {
      // kafel po zalogowaniu → strona gry
      await page.click('#kafle .tile[data-code="cebulowy-777"]');
      await page.waitForURL(/gra\.html\?gra=cebulowy-777/, { timeout: 5000 }).catch(() => {});
      check('kafel po zalogowaniu prowadzi do gra.html?gra=cebulowy-777', page.url().includes('gra.html?gra=cebulowy-777'), page.url());
      // ekran ładowania kończy się przyciskiem „Graj” — gest odblokowuje dźwięk (05 § 2.3, runtime gier: docs/projekt/10)
      await page.click('#btn-graj', { timeout: 30_000 }).catch(() => {});
      await page.waitForSelector('#ladowanie.is-done', { timeout: 15_000 }).catch(() => {});
      check('strona gry ładuje się (ekran ładowania znika)', await page.locator('#ladowanie.is-done').count() === 1);
      check('scena PixiJS ma płótno', await page.locator('#scena canvas').count() === 1);
      check('strona gry pokazuje saldo', (await balanceText(page)) === '10 000');
      await page.waitForTimeout(500);
      await shot(page, 'gra-1366');
      await page.click('#btn-info');
      await page.waitForSelector('#modal-info.is-open');
      await page.waitForTimeout(450);
      await shot(page, 'gra-info-1366');
      await page.keyboard.press('Escape');
      for (const [w, h, name] of [[390, 844, 'gra-390'], [844, 390, 'gra-844x390-poziomo'], [1920, 1080, 'gra-1920']]) {
        await page.setViewportSize({ width: w, height: h });
        await page.waitForTimeout(600);
        const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        check(`strona gry bez poziomego przewijania @${w}×${h}`, over <= 0, over > 0 ? `nadmiar ${over}px` : '');
        // SPIN i płótno sceny mieszczą się w całości na ekranie (scena zastępcza z napisem #scena-opis
        // zniknęła po scaleniu runtime gier — teraz sprawdzamy prawdziwą scenę PixiJS)
        const layout = await page.evaluate(() => {
          const r = (s) => document.querySelector(s)?.getBoundingClientRect();
          const canvas = r('#scena canvas');
          const spin = r('#btn-spin');
          const inView = (b) => !!b && b.top >= -1 && b.left >= -1 && b.bottom <= innerHeight + 1 && b.right <= innerWidth + 1;
          return { canvasOk: inView(canvas), spinOk: inView(spin) };
        });
        check(`strona gry: scena i SPIN w całości na ekranie @${w}×${h}`, layout.canvasOk && layout.spinOk, JSON.stringify(layout));
        await shot(page, name);
      }
      for (const code of ['zloty-faraon', 'krysztalowa-kaskada']) {
        await page.setViewportSize({ width: 1366, height: 768 });
        await page.goto(`${BASE}/gra.html?gra=${code}`);
        await page.click('#btn-graj', { timeout: 30_000 }).catch(() => {});
        await page.waitForSelector('#ladowanie.is-done', { timeout: 15_000 }).catch(() => {});
        await page.waitForTimeout(400);
        await shot(page, `gra-${code}-1366`);
      }
    }
    await context.close();
  }

  // ------------------------------------------------------------------ 4. kafel bez logowania → okno logowania; gra bez sesji → lobby
  {
    const { context, page } = await newPage(browser, { width: 1366, height: 768 }, 'kafel-bez-sesji');
    await waitForLobby(page);
    await page.click('#kafle .tile[data-code="zloty-faraon"]');
    await page.waitForSelector('#modal-logowanie.is-open', { timeout: 3000 }).catch(() => {});
    const lead = norm(await page.textContent('#logowanie-opis'));
    check('kafel bez logowania otwiera okno logowania z nazwą gry', lead.includes('Złoty Faraon'), lead);
    await page.keyboard.press('Escape');

    await page.goto(`${BASE}/gra.html?gra=krysztalowa-kaskada`);
    await page.waitForURL(/\/(\?|index\.html)/, { timeout: 5000 }).catch(() => {});
    await page.waitForSelector('#modal-logowanie.is-open', { timeout: 5000 }).catch(() => {});
    check('gra bez sesji → przekierowanie do lobby z oknem logowania', await page.isVisible('#nick'), page.url());
    await context.close();
  }

  // ------------------------------------------------------------------ 5. bankructwo i bonus ratunkowy (tylko atrapa: /api/dev/gracz)
  {
    const { context, page } = await newPage(browser, { width: 390, height: 844 }, 'bankructwo');
    await waitForLobby(page);
    await login(page, `Bankrut_${suffix}`);
    // POST /api/dev/gracz ma tylko atrapa (tools/dev/mock-api.mjs); prawdziwy backend odpowie 404, a przeglądarka
    // zapisze to w konsoli jako błąd — to sprawdzenie możliwości serwera, a nie błąd strony
    expectedHttp.push(/\/api\/dev\/gracz$/);
    const devOk = await page.evaluate(async () => {
      const r = await fetch('api/dev/gracz', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ balance: 0, rescueCooldownSeconds: 0, demoHistory: 14 }) });
      return r.ok;
    });
    if (!devOk) {
      warnings.push('serwer nie obsługuje POST /api/dev/gracz — test bankructwa pominięty (to normalne dla Spring Boot)');
    } else {
      await page.reload({ waitUntil: 'load' });
      await page.waitForSelector('#ratunek:not([hidden])', { timeout: 5000 }).catch(() => {});
      check('bankructwo: widoczny przycisk „Odbierz 10 000 cebulionów”', await page.isVisible('#btn-ratunek') && norm(await page.textContent('#btn-ratunek')).includes('Odbierz 10 000'));
      await page.waitForTimeout(700);
      // bankrut na telefonie: przycisk bonusu ma być widoczny BEZ przewijania (390×844 i najmniejszy 320×640)
      for (const [w, h] of [[390, 844], [320, 640]]) {
        await page.setViewportSize({ width: w, height: h });
        await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
        await page.waitForTimeout(150);
        const r = await page.locator('#btn-ratunek').boundingBox();
        check(`bankructwo: przycisk bonusu widoczny bez przewijania @${w}×${h}`, r && r.y + r.height <= h, r ? `dół przycisku ${Math.round(r.y + r.height)}px` : '');
      }
      await page.setViewportSize({ width: 390, height: 844 });
      check('bankructwo: „Graj teraz” schowane (grać i tak się nie da)', await page.isHidden('#cta-glowne'));
      const badAnims = await nonCompositedAnimations(page);
      check('bankructwo: poświata bonusu tylko transform/opacity', badAnims.length === 0, badAnims.join(' | '));
      await shot(page, 'bankructwo-390');
      await page.click('#btn-ratunek');
      await page.waitForSelector('.reward', { state: 'detached', timeout: 10_000 }).catch(() => {});
      await page.waitForFunction(() => document.querySelector('#saldo .balance-pill__value')?.textContent.replace(/\s/g, ' ') === '10 000', null, { timeout: 5000 }).catch(() => {});
      check('bonus ratunkowy doliczony (saldo 10 000)', (await balanceText(page)) === '10 000');
      check('panel bankructwa znika po bonusie', await page.isHidden('#ratunek'));

      await page.evaluate(() => fetch('api/dev/gracz', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ balance: 5, rescueCooldownSeconds: 125 }) }));
      await page.reload({ waitUntil: 'load' });
      await page.waitForSelector('#ratunek:not([hidden])', { timeout: 5000 }).catch(() => {});
      const label = norm(await page.textContent('#btn-ratunek'));
      check('bonus niedostępny: odliczanie na przycisku', /Dostępny za 02:0\d/.test(label) && await page.isDisabled('#btn-ratunek'), label);
      await page.waitForTimeout(500);
      await shot(page, 'bankructwo-odliczanie-390');

      await page.click('#btn-menu');
      await page.click('#menu-historia');
      await page.waitForSelector('#modal-historia.is-open');
      await page.waitForSelector('.history__row', { timeout: 4000 }).catch(() => {});
      await page.waitForTimeout(450);
      check('historia gry pokazuje rundy', await page.locator('.history__row').count() > 0);
      // atrapa: 14 rund, w tym 2 × medium i 2 × big; rundy 'none'/'small' nie dostają odznaki („Wygrana ×0” to był błąd)
      const badges = await page.evaluate(() => ({
        all: document.querySelectorAll('.history .tier').length,
        none: document.querySelectorAll('.history .tier--none, .history .tier--small').length,
      }));
      check('historia: odznaki tylko dla wygranych ≥ 5× (bez „none”)', badges.all === 4 && badges.none === 0, JSON.stringify(badges));
      await shot(page, 'historia-390');
    }
    await context.close();
  }

  // ------------------------------------------------------------------ 6. stany puste rankingu i feedu
  {
    const { context, page } = await newPage(browser, { width: 1366, height: 768 }, 'stany-puste');
    await page.route('**/api/feed/big-wins*', (route) => route.fulfill({ json: [] }));
    await page.route('**/api/leaderboard*', (route) => route.fulfill({ json: [] }));
    await waitForLobby(page);
    await page.locator('#wygrane').scrollIntoViewIfNeeded();
    await page.waitForTimeout(1000);
    check('pusty feed: łagodny komunikat', norm(await page.textContent('#feed')).includes('Jeszcze nikt'));
    check('pusty ranking: łagodny komunikat', norm(await page.textContent('#ranking-lista')).includes('Ranking czeka'));
    await shot(page, 'stany-puste-1366');
    await context.close();
  }

  // ------------------------------------------------------------------ 7. prefers-reduced-motion
  {
    const { context, page } = await newPage(browser, { width: 390, height: 844 }, 'reduced-motion', { reducedMotion: 'reduce' });
    await waitForLobby(page);
    await login(page, `Spokojny_${suffix}`);
    await page.waitForTimeout(600);
    check('reduced motion: bez sekwencji, saldo od razu 10 000', (await page.locator('.reward').count()) === 0 && (await balanceText(page)) === '10 000');
    await shot(page, 'reduced-motion-390');
    // wylogowanie: „Wyloguj” znika razem z menu — fokus ma trafić na „Zaloguj”, a nie spaść na <body>
    await page.click('#btn-menu');
    await page.click('#menu-wyloguj');
    await page.waitForSelector('#btn-zaloguj:not([hidden])', { timeout: 4000 }).catch(() => {});
    const afterLogout = await page.evaluate(() => document.activeElement?.id || document.activeElement?.tagName);
    check('po wylogowaniu fokus na „Zaloguj”', afterLogout === 'btn-zaloguj', afterLogout);
    await context.close();
  }

  await browser.close();

  check('brak błędów w konsoli przeglądarki', consoleErrors.length === 0, consoleErrors.slice(0, 5).join(' | '));
  for (const w of [...new Set(warnings)]) console.log(`! ${w}`);

  const failed = results.filter((r) => !r.ok);
  await writeFile(path.join(OUT, 'wyniki.json'), JSON.stringify({ base: BASE, at: new Date().toISOString(), results, warnings: [...new Set(warnings)], consoleErrors }, null, 2));
  console.log(`\n${results.length - failed.length}/${results.length} sprawdzeń OK. Zrzuty: ${OUT}`);
  process.exit(failed.length ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(2);
});
