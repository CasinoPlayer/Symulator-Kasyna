// Regresje wspólnego runtime: saldo całej rundy nie ujawnia późniejszych bonusów.
import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
const base = process.argv[2] ?? 'http://127.0.0.1:8081';
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
try {
  const page = await browser.newPage();
  await page.goto(base);
  const result = await page.evaluate(async () => {
    const { BaseGame } = await import('/js/game/base-game.js');
    const { StepPlayer } = await import('/js/game/step-player.js');
    const timeline = [];
    const game = { booked: false, ui: { book: () => timeline.push('book') } };
    game.player = new StepPlayer();
    const book = () => BaseGame.prototype.book.call(game);
    for (const type of ['spin', 'win', 'freeSpinsStart', 'freeSpinsEnd']) {
      game.player.register(type, (_step, ctx) => { timeline.push(`${ctx.index}:${type}`); book(); });
    }
    await game.player.play({ bet: 20, roundId: 1, steps: [
      { type: 'spin' }, { type: 'win', totalWin: 5 }, { type: 'freeSpinsStart', count: 2 },
      { type: 'spin', phase: 'free' }, { type: 'win', totalWin: 25 },
      { type: 'spin', phase: 'free' }, { type: 'win', totalWin: 30 },
      { type: 'freeSpinsEnd', freeSpinsWin: 25, totalWin: 30 },
    ] });
    book();
    const bonus = [...timeline];
    timeline.length = 0;
    game.booked = false;
    await game.player.play({ bet: 10, roundId: 2, steps: [{ type: 'spin' }, { type: 'win', totalWin: 6 }] });
    book();
    return { bonus, ordinary: [...timeline] };
  });
  assert.deepEqual(result.bonus, ['0:spin', '1:win', '2:freeSpinsStart', '3:spin', '4:win', '5:spin', '6:win', '7:freeSpinsEnd', 'book']);
  assert.deepEqual(result.ordinary, ['0:spin', '1:win', 'book']);
  console.log('2/2: saldo po końcu bonusu, zwykła wygrana zaksięgowana dokładnie raz.');
} finally { await browser.close(); }
