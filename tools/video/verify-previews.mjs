/** Verify shipped preview codecs, sizes, files and real lobby hover playback. */
import assert from 'node:assert/strict';
import { readFile, stat, mkdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = path.join(ROOT, 'src/main/resources/static/assets/video');
const WORK = process.env.VIDEO_WORK ?? 'E:/CebulionCasino/tmp/video';
await mkdir(WORK, { recursive: true });
process.env.TEMP = WORK;
process.env.TMP = WORK;
process.env.TMPDIR = WORK;
const BASE = process.argv[2] ?? 'http://127.0.0.1:8081';
const FFPROBE = process.env.FFPROBE ?? 'E:/AI/tools/ffmpeg/bin/ffprobe.exe';
const manifest = JSON.parse(await readFile(path.join(OUT, 'manifest.json'), 'utf8'));
assert.equal(Object.keys(manifest.videos).length, 3, 'all three games have previews');
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
const failures = [];
const results = [];
try {
  const page = await browser.newPage({ viewport: { width: 1366, height: 1000 } });
  page.on('pageerror', (error) => failures.push(error.message));
  page.on('response', (response) => { if (response.url().includes('/assets/video/') && response.status() >= 400) failures.push(`${response.status()} ${response.url()}`); });
  await page.goto(BASE);
  await page.locator('#kafle .tile:not(.tile--skeleton)').first().waitFor();
  for (const [code, entry] of Object.entries(manifest.videos)) {
    for (const type of ['mp4', 'webm']) {
      const file = path.join(OUT, entry[type].split('?')[0]);
      assert.ok((await stat(file)).size < 2 * 1024 * 1024, `${code}.${type} fits 2 MiB`);
      const result = spawnSync(FFPROBE, ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', file], { windowsHide: true, encoding: 'utf8' });
      assert.equal(result.status, 0, result.stderr);
      const probe = JSON.parse(result.stdout);
      assert.equal(probe.streams.length, 1, 'video without audio');
      assert.equal(probe.streams[0].codec_name, type === 'mp4' ? 'h264' : 'vp9');
      assert.equal(probe.streams[0].width, 480);
      assert.equal(probe.streams[0].height, 720);
      assert.ok(Number(probe.format.duration) >= 8 && Number(probe.format.duration) <= 12.1);
    }
    await stat(path.resolve(OUT, entry.poster));
    const tile = page.locator(`#kafle .tile[data-code="${code}"]`);
    await tile.hover();
    await page.waitForFunction((c) => {
      const video = document.querySelector(`.tile[data-code="${c}"] video`);
      return video && !video.paused && video.currentTime > 0.2 && video.videoWidth === 480;
    }, code, { timeout: 15000 }).catch(async (error) => {
      console.error(JSON.stringify(await tile.evaluate((t) => {
        const v = t.querySelector('video');
        return { reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches, fine: matchMedia('(hover:hover) and (pointer:fine)').matches,
          video: v ? { src: v.currentSrc, paused: v.paused, time: v.currentTime, ready: v.readyState, width: v.videoWidth, error: v.error?.message, html: v.outerHTML } : null };
      }), null, 2));
      console.error(failures);
      throw error;
    });
    results.push({ code, ...await tile.locator('video').evaluate((v) => ({ currentTime: v.currentTime, muted: v.muted, loop: v.loop, playsInline: v.playsInline })) });
    await page.waitForTimeout(1200); // finish the poster-to-video crossfade before visual QA
    await tile.screenshot({ path: path.join(WORK, `${code}-lobby.png`) });
  }
  assert.deepEqual(failures, []);
  console.log(JSON.stringify({ result: '3/3 previews play in lobby; codecs, budgets, posters and URLs verified', games: results }, null, 2));
} finally { await browser.close(); }