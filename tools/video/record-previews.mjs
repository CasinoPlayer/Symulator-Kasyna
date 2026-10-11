/**
 * Capture the real game canvas from Spring Boot's demo profile into lobby previews.
 * node tools/video/record-previews.mjs --game=s1 --base=http://127.0.0.1:8081
 * --game=all records all three. Optional --seed=hex, --seconds=12, --work=E:/... .
 * Uses existing Chrome and ffmpeg; never downloads tools. Temporary files stay on E: by default.
 */
import { chromium } from 'playwright-core';
import { mkdir, readFile, writeFile, stat } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { randomUUID, createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const args = Object.fromEntries(process.argv.slice(2).map((arg) => {
  const [key, ...value] = arg.replace(/^--/, '').split('=');
  return [key, value.length ? value.join('=') : true];
}));
const BASE = String(args.base ?? 'http://127.0.0.1:8081').replace(/\/$/, '');
const WORK = path.resolve(String(args.work ?? 'E:/CebulionCasino/tmp/video'));
const OUT = path.join(ROOT, 'src/main/resources/static/assets/video');
const SECONDS = Math.min(12, Math.max(8, Number(args.seconds ?? 12)));
const FF = process.env.FFMPEG ?? 'E:/AI/tools/ffmpeg/bin/ffmpeg.exe';
const FFPROBE = process.env.FFPROBE ?? path.join(path.dirname(FF), 'ffprobe.exe');
const CHROME = process.env.PW_CHROMIUM ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const GAMES = {
  s1: { code: 'cebulowy-777', className: 'S1Game', bet: 10, want: (r) => r.multiplier >= 5 && r.multiplier < 15 },
  s2: { code: 'zloty-faraon', className: 'S2Game', bet: 20,
    want: (r) => r.steps.some((s) => s.type === 'freeSpinsStart') && r.steps.some((s) => s.type === 'expandWild') },
  s3: { code: 'krysztalowa-kaskada', className: 'S3Game', bet: 20,
    want: (r) => r.steps.filter((s) => s.type === 'cascade').length >= 2 && !r.steps.some((s) => s.type === 'freeSpinsStart') },
};
const selected = args.game === 'all' ? Object.keys(GAMES) : [String(args.game ?? 's1')];
if (selected.some((key) => !GAMES[key])) throw new Error('Use --game=s1, s2, s3 or all');
await mkdir(WORK, { recursive: true });
await mkdir(OUT, { recursive: true });
process.env.TEMP = WORK;
process.env.TMP = WORK;
process.env.TMPDIR = WORK;
for (const executable of [FF, FFPROBE, CHROME]) await stat(executable);
const run = (executable, options) => {
  const result = spawnSync(executable, options, { windowsHide: true, encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
  if (result.error || result.status !== 0) throw new Error(result.error?.message ?? result.stderr);
  return result.stdout;
};
const browser = await chromium.launch({ executablePath: CHROME, args: ['--enable-unsafe-swiftshader'] });
const results = [];
try {
  for (const key of selected) {
    const game = GAMES[key];
    const context = await browser.newContext({ viewport: { width: 600, height: 1080 }, deviceScaleFactor: 1, locale: 'pl-PL' });
    await context.addInitScript(() => {
      localStorage.setItem('cebulion.audio', JSON.stringify({ muted: true }));
      localStorage.setItem('cebulion.turbo', '0');
      localStorage.setItem('cebulion.sesja', '1');
      localStorage.setItem('cebulion.jakosc', 'high');
    });
    const login = async () => {
      const response = await context.request.post(`${BASE}/api/auth/login`, { data: { nick: `Video_${randomUUID().slice(0, 8)}` } });
      if (!response.ok()) throw new Error(`Login ${response.status()}: ${await response.text()}`);
    };
    await login();
    let chosen;
    for (let attempt = 1; attempt <= 1200; attempt++) {
      const seed = String(args.seed ?? attempt.toString(16)).replace(/^0x/, '').padStart(16, '0');
      const response = await context.request.post(`${BASE}/api/slots/${game.code}/spins`, {
        headers: { 'Idempotency-Key': randomUUID(), 'X-Demo-Seed': seed }, data: { bet: game.bet },
      });
      const round = await response.json();
      if (!response.ok()) throw new Error(`Seed search ${response.status()}: ${JSON.stringify(round)}`);
      if (round.seed !== seed) throw new Error('X-Demo-Seed was ignored. Start the backend in profile demo.');
      if (args.seed || game.want(round)) { chosen = round; break; }
      if (round.balanceAfter < game.bet * 3) await login();
      if (attempt % 100 === 0) console.log(`${key}: searched ${attempt} seeds`);
    }
    if (!chosen) throw new Error(`No demonstration round found for ${key}`);
    console.log(`${key}: seed=${chosen.seed}, win=${chosen.multiplier}x, ${chosen.steps.length} steps`);
    if (args.find) { results.push({ key, seed: chosen.seed, steps: chosen.steps.map((s) => s.type) }); await context.close(); continue; }
    await login();
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (error) => { errors.push(error.message); console.error(error.message); });
    page.on('console', (message) => { if (message.type() === 'error') console.error(message.text()); });
    await page.route('**/api/slots/*/spins', (route) => route.continue({ headers: { ...route.request().headers(), 'x-demo-seed': chosen.seed } }));
    await page.goto(`${BASE}/gra.html?gra=${game.code}`, { waitUntil: 'load' });
    console.log(key + ': loaded ' + page.url());
    try { await page.locator('#btn-graj:not([hidden])').waitFor({ timeout: 60000 }); }
    catch (error) { await page.screenshot({ path: path.join(WORK, game.code + '-load-error.png') }); await writeFile(path.join(WORK, game.code + '-load-error.html'), await page.content()); throw error; }
    await page.locator('#btn-graj').click();
    await page.waitForFunction(() => window.__gra?.state === 'ready', null, { timeout: 60000 });
    const className = await page.evaluate(() => window.__gra._game.constructor.name);
    if (className !== game.className) throw new Error(`${key}: ${className} is not the finished ${game.className}`);
    await page.waitForTimeout(700);
    if (key === 's2') {
      await page.locator('#btn-spin').click();
      await page.waitForFunction(() => {
        const ctx = window.__gra?._game.player.ctx;
        return ctx && ctx.steps[ctx.index]?.type === 'freeSpinsStart';
      }, null, { timeout: 60000 });
    }
    await page.evaluate(() => {
      const canvas = document.querySelector('#scena canvas');
      const stream = canvas.captureStream(30);
      const chunks = [];
      const type = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8'].find((m) => MediaRecorder.isTypeSupported(m));
      const recorder = new MediaRecorder(stream, { mimeType: type, videoBitsPerSecond: 2500000 });
      recorder.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data); };
      window.__videoCapture = { recorder, chunks, stream, started: performance.now() };
      recorder.start(200);
    });
    const end = Date.now() + SECONDS * 1000;
    let shot = false;
    while (Date.now() < end) {
      if (await page.evaluate(() => window.__gra?.state === 'ready')) await page.locator('#btn-spin').click();
      if (!shot && Date.now() > end - SECONDS * 1000 + 4500) {
        await page.locator('#scena canvas').screenshot({ path: path.join(WORK, `${game.code}-canvas.png`) });
        shot = true;
      }
      await page.waitForTimeout(150);
    }
    const recording = await page.evaluate(async () => {
      const { recorder, chunks, stream } = window.__videoCapture;
      await new Promise((resolve) => { recorder.onstop = resolve; recorder.stop(); });
      stream.getTracks().forEach((track) => track.stop());
      const blob = new Blob(chunks, { type: recorder.mimeType });
      return await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result.split(',')[1]);
        reader.readAsDataURL(blob);
      });
    });
    if (errors.length) throw new Error(`${key} browser errors: ${errors.join('; ')}`);
    const raw = path.join(WORK, `${game.code}-raw.webm`);
    await writeFile(raw, Buffer.from(recording, 'base64'));
    await writeFile(path.join(WORK, `${game.code}-round.json`), JSON.stringify(chosen, null, 2));
    await context.close();
    const filter = `fps=30,scale=480:720:force_original_aspect_ratio=increase:flags=lanczos,crop=480:720,setsar=1,fade=t=in:st=0:d=0.18,fade=t=out:st=${SECONDS - 0.18}:d=0.18`;
    const common = ['-y', '-hide_banner', '-loglevel', 'error', '-i', raw, '-t', String(SECONDS), '-an', '-vf', filter];
    const mp4 = path.join(OUT, `${game.code}.mp4`);
    const webm = path.join(OUT, `${game.code}.webm`);
    run(FF, [...common, '-c:v', 'libx264', '-preset', 'slow', '-crf', '26', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', mp4]);
    run(FF, [...common, '-c:v', 'libvpx-vp9', '-crf', '35', '-b:v', '0', '-row-mt', '1', '-deadline', 'good', '-cpu-used', '3', webm]);
    const metadata = JSON.parse(run(FFPROBE, ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', mp4]));
    const vp9 = JSON.parse(run(FFPROBE, ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', webm]));
    if (metadata.streams[0]?.codec_name !== 'h264' || vp9.streams[0]?.codec_name !== 'vp9'
      || [metadata, vp9].some((m) => m.streams.length !== 1 || m.streams[0].width !== 480 || m.streams[0].height !== 720
        || Math.abs(Number(m.format.duration) - SECONDS) > 0.1)) throw new Error(`${key}: unexpected output format`);
    run(FF, ['-y', '-hide_banner', '-loglevel', 'error', '-ss', '4.5', '-i', mp4, '-frames:v', '1', path.join(WORK, `${game.code}-final.png`)]);
    const sizes = { mp4: (await stat(mp4)).size, webm: (await stat(webm)).size };
    if (Math.max(...Object.values(sizes)) > 2 * 1024 * 1024) throw new Error(`${key}: preview exceeds 2 MiB per format`);
    const videoManifestPath = path.join(OUT, 'manifest.json');
    const videoManifest = JSON.parse(await readFile(videoManifestPath, 'utf8'));
    videoManifest._opis = 'Prawdziwe rundy z profilu demo: pionowe podglądy 480×720, 30 fps, bez dźwięku. Plakaty wskazują istniejące okładki gier.';
    videoManifest.videos[game.code] = { mp4: `${game.code}.mp4`, webm: `${game.code}.webm`, poster: `../img/${key}/${key}_okladka.webp`, width: 480, height: 720, duration: SECONDS };
    videoManifest.version = createHash('sha256').update(JSON.stringify(videoManifest.videos)).update(recording).digest('hex').slice(0, 12);
    await writeFile(videoManifestPath, JSON.stringify(videoManifest, null, 2) + '\n');
    const summary = { key, code: game.code, seed: chosen.seed, sizes, duration: metadata.format.duration, codec: metadata.streams[0].codec_name, screenshot: path.join(WORK, `${game.code}-canvas.png`) };
    results.push(summary);
    console.log(JSON.stringify(summary));
  }
} finally {
  await browser.close();
}
await writeFile(path.join(WORK, `results-${args.game ?? 's1'}.json`), JSON.stringify(results, null, 2) + '\n');