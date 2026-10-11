// =====================================================================================================
// tools/dev/mock-spins.mjs — generator odpowiedzi spinu dla ATRAPY API (kontrakt docs/projekt/09 § 2.4).
//
// WAŻNE: prawdziwe spiny liczy serwer w Javie (silniki gier, RTP, ziarno). Ten plik służy WYŁĄCZNIE do pracy nad
// front-endem i testów e2e: zwraca odpowiedzi w dokładnie tym samym kształcie (kroki spin / win / feature /
// expandWild / cascade / applyMultiplier / freeSpins*), żeby animacje można było rozwijać bez backendu.
//
// Wymuszanie wyniku (tylko atrapa): nagłówek `X-Mock-Force` albo parametr `?force=` w adresie spinu:
//   S1: lose | small | medium | big | mega | epic | ultra | jackpot | wild | anticipation
//   S2: fs (darmowe spiny z rozszerzonym WILD) | lose | win
//   S3: fs (darmowe spiny z kulami) | cascade | lose
// Dzięki temu da się nagrać i przetestować każdą sekwencję efektów (BIG/MEGA/EPIC/ULTRA WIN, NEON JACKPOT).
// =====================================================================================================

import { randomBytes } from 'node:crypto';

/** Linie wygrywające: indeks rzędu (0 = górny) dla kolejnych bębnów; numer linii = indeks + 1 (09 § 2.2). */
export const PAYLINES = {
  'cebulowy-777': [[1, 1, 1], [0, 0, 0], [2, 2, 2], [0, 1, 2], [2, 1, 0]],
  'zloty-faraon': [
    [1, 1, 1, 1, 1], [0, 0, 0, 0, 0], [2, 2, 2, 2, 2], [0, 1, 2, 1, 0], [2, 1, 0, 1, 2],
    [1, 0, 0, 0, 1], [1, 2, 2, 2, 1], [0, 0, 1, 2, 2], [2, 2, 1, 0, 0], [1, 2, 1, 0, 1],
    [1, 0, 1, 2, 1], [0, 1, 1, 1, 0], [2, 1, 1, 1, 2], [0, 1, 0, 1, 0], [2, 1, 2, 1, 2],
    [1, 1, 0, 1, 1], [1, 1, 2, 1, 1], [0, 0, 2, 0, 0], [2, 2, 0, 2, 2], [0, 2, 2, 2, 0],
  ],
};

/** Progi poziomów (brief § 3) — te same co w kontrakcie. */
export function tierFor(m) {
  if (!(m > 0)) return 'none';
  if (m >= 100) return 'ultra';
  if (m >= 60) return 'epic';
  if (m >= 30) return 'mega';
  if (m >= 15) return 'big';
  if (m >= 5) return 'medium';
  return 'small';
}

const TIER_RANGES = { lose: [0, 0], small: [0.01, 5], medium: [5, 15], big: [15, 30], mega: [30, 60], epic: [60, 100], ultra: [100, 1e9] };

function weighted(weights) {
  const entries = Object.entries(weights);
  const total = entries.reduce((a, [, w]) => a + w, 0);
  return () => {
    let r = Math.random() * total;
    for (const [k, w] of entries) if ((r -= w) < 0) return k;
    return entries[0][0];
  };
}

const seedHex = () => randomBytes(8).toString('hex');

// ===================================================================================================== S1

const S1_NORMAL = { wisnie: 7, cytryna: 7, sliwka: 6, arbuz: 5, dzwonek: 4, bar: 3, siodemka: 2, wild: 1.2 };
const S1_RICH = { wisnie: 1, cytryna: 1, sliwka: 1, arbuz: 1, dzwonek: 2, bar: 3, siodemka: 5, wild: 3 };
const S1_ULTRA = { wisnie: 0.3, cytryna: 0.3, sliwka: 0.3, arbuz: 0.3, dzwonek: 1, bar: 2, siodemka: 7, wild: 5 };

/** Ocena planszy S1: 5 linii, WILD zastępuje wszystko, WILD na linii = ×2, pełny ekran = NEON JACKPOT ×10. */
function evalS1(grid, bet, pays) {
  const lines = PAYLINES['cebulowy-777'];
  const wins = [];
  for (let i = 0; i < lines.length; i++) {
    const pos = lines[i].map((row, reel) => [reel, row]);
    const syms = pos.map(([r, row]) => grid[r][row]);
    const base = syms.find((s) => s !== 'wild') ?? 'wild';
    if (!syms.every((s) => s === base || s === 'wild')) continue;
    const hasWild = syms.includes('wild') && base !== 'wild';
    const mult = pays[base]?.[3] ?? 0;
    const amount = Math.floor(mult * (bet / 5) * (hasWild ? 2 : 1));
    if (amount <= 0) continue;
    wins.push({ kind: 'line', line: i + 1, symbol: base, count: 3, positions: pos, amount, wildMultiplier: hasWild ? 2 : 1, freeSpinMultiplier: 1 });
  }
  const flat = grid.flat();
  const first = flat.find((s) => s !== 'wild') ?? 'wild';
  const jackpot = flat.every((s) => s === first || s === 'wild');
  if (jackpot) for (const w of wins) w.amount *= 10;
  const total = wins.reduce((a, w) => a + w.amount, 0);
  return { wins, total, jackpot };
}

/** Antycypacja S1 (04 E27): 2 WILD na bębnach 1 i 2 na wspólnej linii → spowolnienie 3. bębna. */
function anticipationS1(grid) {
  const lines = PAYLINES['cebulowy-777'];
  return lines.some((l) => grid[0][l[0]] === 'wild' && grid[1][l[1]] === 'wild') ? [2] : [];
}

function randomGridS1(weights) {
  const pick = weighted(weights);
  return Array.from({ length: 3 }, () => Array.from({ length: 3 }, pick));
}

function makeS1Grid(force, bet, pays) {
  if (force === 'jackpot') {
    const sym = ['wisnie', 'cytryna', 'sliwka', 'arbuz', 'dzwonek'][Math.floor(Math.random() * 5)];
    const grid = Array.from({ length: 3 }, () => Array.from({ length: 3 }, () => sym));
    grid[Math.floor(Math.random() * 3)][Math.floor(Math.random() * 3)] = Math.random() < 0.5 ? 'wild' : sym;
    return grid;
  }
  const want = (g) => {
    const e = evalS1(g, bet, pays);
    const m = e.total / bet;
    if (e.jackpot) return false;
    if (force === 'wild') return e.wins.some((w) => w.wildMultiplier === 2) && m < 15;
    if (force === 'anticipation') return anticipationS1(g).length > 0;
    const range = TIER_RANGES[force];
    if (!range) return true;
    return force === 'lose' ? e.total === 0 : m >= range[0] && m < range[1];
  };
  const rich = ['big', 'mega', 'epic'].includes(force);
  const weights = force === 'ultra' ? S1_ULTRA : rich ? S1_RICH : force === 'wild' || force === 'anticipation' ? { ...S1_NORMAL, wild: 4 } : S1_NORMAL;
  // przykładowa tabela wypłat atrapy pozwala na ≥ 100× praktycznie tylko przez NEON JACKPOT (pełny ekran),
  // więc dla „ultra” po krótkiej próbie budujemy pełny ekran wysokiego symbolu (dzwonek / BAR / siódemka)
  const tries = force === 'ultra' ? 1500 : 60000;
  for (let i = 0; i < tries; i++) {
    const g = randomGridS1(weights);
    if (want(g)) return g;
  }
  if (force === 'ultra') {
    const sym = ['dzwonek', 'bar', 'siodemka'][Math.floor(Math.random() * 3)];
    return Array.from({ length: 3 }, () => Array.from({ length: 3 }, () => sym));
  }
  // zapas (nie powinien być potrzebny): siódemki z WILD na wszystkich liniach
  return [['siodemka', 'siodemka', 'siodemka'], ['wild', 'wild', 'wild'], ['siodemka', 'siodemka', 'siodemka']];
}

function spinS1(bet, force, pays) {
  const grid = force ? makeS1Grid(force, bet, pays) : randomGridS1(S1_NORMAL);
  const ev = evalS1(grid, bet, pays);
  const steps = [{ type: 'spin', phase: 'base', grid, anticipation: anticipationS1(grid) }];
  if (ev.jackpot && ev.total > 0) steps.push({ type: 'feature', name: 'neonJackpot', multiplier: 10 });
  if (ev.total > 0) steps.push({ type: 'win', win: ev.total, totalWin: ev.total, wins: ev.wins });
  return { totalWin: ev.total, steps };
}

// ===================================================================================================== S2

const S2_WEIGHTS = { 10: 9, j: 9, q: 8, k: 8, a: 7, ankh: 5, oko: 4, skarabeusz: 3, anubis: 2.5, faraon: 2, wild: 1.6, scatter: 1.4 };

function randomGrid(reels, rows, weights) {
  const pick = weighted(weights);
  return Array.from({ length: reels }, () => Array.from({ length: rows }, pick));
}

function evalS2(grid, bet, pays, freeMul) {
  const wins = [];
  PAYLINES['zloty-faraon'].forEach((rows, i) => {
    const syms = rows.map((row, reel) => grid[reel][row]);
    if (syms[0] === 'scatter') return;
    const base = syms.find((s) => s !== 'wild') ?? 'wild';
    if (base === 'scatter') return;
    let count = 0;
    while (count < 5 && (syms[count] === base || syms[count] === 'wild')) count++;
    const mult = pays[base]?.[count];
    if (!mult) return;
    const amount = Math.floor(mult * (bet / 20) * freeMul);
    if (amount > 0) wins.push({ kind: 'line', line: i + 1, symbol: base, count, positions: rows.slice(0, count).map((row, reel) => [reel, row]), amount, wildMultiplier: 1, freeSpinMultiplier: freeMul });
  });
  const scatters = [];
  grid.forEach((col, r) => col.forEach((s, row) => { if (s === 'scatter') scatters.push([r, row]); }));
  if (scatters.length >= 3) {
    const amount = Math.floor((pays.scatter?.[Math.min(5, scatters.length)] ?? 0) * bet);
    if (amount > 0) wins.push({ kind: 'scatter', symbol: 'scatter', count: scatters.length, positions: scatters, amount });
  }
  return { wins, total: wins.reduce((a, w) => a + w.amount, 0), scatters };
}

function anticipationS2(grid) {
  let seen = 0;
  const out = [];
  for (let r = 0; r < 5; r++) {
    if (seen >= 2) out.push(r);
    if (grid[r].includes('scatter')) seen++;
  }
  return out;
}

function spinS2(bet, force, pays) {
  let grid = randomGrid(5, 3, S2_WEIGHTS);
  if (force === 'fs') {
    for (const r of [0, 2, 4]) grid[r][Math.floor(Math.random() * 3)] = 'scatter';
  } else if (force === 'lose') {
    for (let i = 0; i < 5000 && evalS2(grid, bet, pays, 1).total > 0; i++) grid = randomGrid(5, 3, S2_WEIGHTS);
  }
  const steps = [];
  let total = 0;
  const base = evalS2(grid, bet, pays, 1);
  steps.push({ type: 'spin', phase: 'base', grid, anticipation: anticipationS2(grid) });
  if (base.total > 0) {
    total += base.total;
    steps.push({ type: 'win', win: base.total, totalWin: total, wins: base.wins });
  }
  if (base.scatters.length >= 3) {
    let left = 10;
    let index = 0;
    let fsWin = 0;
    steps.push({ type: 'freeSpinsStart', count: 10, trigger: base.scatters });
    while (left > 0 && index < 30) {
      left -= 1;
      index += 1;
      const g = randomGrid(5, 3, { ...S2_WEIGHTS, wild: 2.4 });
      steps.push({ type: 'spin', phase: 'free', grid: g, anticipation: anticipationS2(g), freeSpinIndex: index, freeSpinsLeft: left });
      const wildReels = g.map((col, r) => (col.includes('wild') ? r : -1)).filter((r) => r >= 0);
      let evalGrid = g;
      if (wildReels.length) {
        evalGrid = g.map((col, r) => (wildReels.includes(r) ? col.map(() => 'wild') : [...col]));
        steps.push({ type: 'expandWild', reels: wildReels, grid: evalGrid });
      }
      const ev = evalS2(evalGrid, bet, pays, 2);
      if (ev.total > 0) {
        total += ev.total;
        fsWin += ev.total;
        steps.push({ type: 'win', win: ev.total, totalWin: total, wins: ev.wins });
      }
      if (ev.scatters.length >= 3 && index + left < 30) {
        left += 10;
        steps.push({ type: 'freeSpinsRetrigger', added: 10, trigger: ev.scatters, freeSpinsLeft: left });
      }
    }
    steps.push({ type: 'freeSpinsEnd', freeSpinsWin: fsWin });
  }
  return { totalWin: total, steps };
}

// ===================================================================================================== S3

const S3_WEIGHTS = { szafir: 9, szmaragd: 9, ametyst: 8, topaz: 8, rubin: 4, diament: 3, cebula: 2, scatter: 0.9 };
const S3_COLS = 6;
const S3_ROWS = 5;

/** Klastry: ≥ 5 takich samych symboli połączonych poziomo/pionowo (scatter i mnożnik nie tworzą klastrów). */
function findClusters(grid) {
  const seen = new Set();
  const clusters = [];
  for (let c = 0; c < S3_COLS; c++) {
    for (let r = 0; r < S3_ROWS; r++) {
      const sym = grid[c][r];
      const key = `${c}:${r}`;
      if (seen.has(key) || sym === 'scatter' || sym === 'mnoznik') continue;
      const stack = [[c, r]];
      const cells = [];
      seen.add(key);
      while (stack.length) {
        const [x, y] = stack.pop();
        cells.push([x, y]);
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = x + dx;
          const ny = y + dy;
          const k = `${nx}:${ny}`;
          if (nx < 0 || ny < 0 || nx >= S3_COLS || ny >= S3_ROWS || seen.has(k) || grid[nx][ny] !== sym) continue;
          seen.add(k);
          stack.push([nx, ny]);
        }
      }
      if (cells.length >= 5) clusters.push({ symbol: sym, cells });
    }
  }
  return clusters;
}

function clusterPay(pays, symbol, size) {
  const keys = Object.keys(pays[symbol] ?? {}).map(Number).sort((a, b) => a - b);
  let mult = 0;
  for (const k of keys) if (size >= k) mult = pays[symbol][k];
  return mult;
}

function spinS3(bet, force, pays) {
  const pick = weighted(S3_WEIGHTS);
  const fresh = () => Array.from({ length: S3_COLS }, () => Array.from({ length: S3_ROWS }, pick));
  let grid = fresh();
  if (force === 'fs') {
    for (const c of [0, 2, 3, 5]) grid[c][Math.floor(Math.random() * S3_ROWS)] = 'scatter';
  } else if (force === 'cascade') {
    for (let i = 0; i < 4000 && findClusters(grid).length === 0; i++) grid = fresh();
  } else if (force === 'lose') {
    for (let i = 0; i < 4000 && findClusters(grid).length > 0; i++) grid = fresh();
  }
  const steps = [];
  let total = 0;
  const playSequence = (g, phase, extra, orbs = []) => {
    let current = g;
    let seqWin = 0;
    const allOrbs = [...orbs];
    steps.push({ type: 'spin', phase, grid: current, anticipation: [], orbs, ...extra });
    for (let k = 0; k < 8; k++) {
      const clusters = findClusters(current);
      if (!clusters.length) break;
      const wins = clusters.map((cl) => ({ kind: 'cluster', symbol: cl.symbol, size: cl.cells.length, positions: cl.cells, amount: Math.floor(clusterPay(pays, cl.symbol, cl.cells.length) * bet) }));
      const w = wins.reduce((a, x) => a + x.amount, 0);
      seqWin += w;
      total += w;
      steps.push({ type: 'win', win: w, totalWin: total, wins });
      // pęknięcie i opad: pozostałe symbole spadają, z góry wpadają nowe
      const removed = clusters.flatMap((cl) => cl.cells);
      const rm = new Set(removed.map(([c, r]) => `${c}:${r}`));
      const newSymbols = [];
      const next = [];
      const newOrbs = [];
      for (let c = 0; c < S3_COLS; c++) {
        const keep = current[c].filter((_, r) => !rm.has(`${c}:${r}`));
        const n = S3_ROWS - keep.length;
        const add = Array.from({ length: n }, () => (phase === 'free' && Math.random() < 0.08 ? 'mnoznik' : pick()));
        add.forEach((s, i) => { if (s === 'mnoznik') newOrbs.push({ pos: [c, i], value: [2, 3, 5, 10, 25][Math.floor(Math.random() * 5)] }); });
        newSymbols.push(add);
        next.push([...add, ...keep]);
      }
      allOrbs.push(...newOrbs);
      current = next;
      steps.push({ type: 'cascade', removed, newSymbols, grid: current, orbs: newOrbs });
    }
    if (phase === 'free' && seqWin > 0 && allOrbs.length) {
      const orbsSum = allOrbs.reduce((a, o) => a + o.value, 0);
      const add = seqWin * orbsSum - seqWin;
      total += add;
      steps.push({ type: 'applyMultiplier', orbsSum, baseWin: seqWin, win: add, totalWin: total });
      seqWin += add;
    }
    return { current, seqWin };
  };
  const base = playSequence(grid, 'base', {});
  const scatters = [];
  grid.forEach((col, c) => col.forEach((s, r) => { if (s === 'scatter') scatters.push([c, r]); }));
  if (scatters.length >= 4) {
    steps.push({ type: 'freeSpinsStart', count: 10, trigger: scatters });
    let fsWin = 0;
    for (let i = 1; i <= 10; i++) {
      const g = fresh();
      const orbs = [];
      if (Math.random() < 0.45) {
        const c = Math.floor(Math.random() * S3_COLS);
        const r = Math.floor(Math.random() * S3_ROWS);
        g[c][r] = 'mnoznik';
        orbs.push({ pos: [c, r], value: [2, 3, 5, 10][Math.floor(Math.random() * 4)] });
      }
      fsWin += playSequence(g, 'free', { freeSpinIndex: i, freeSpinsLeft: 10 - i }, orbs).seqWin;
    }
    steps.push({ type: 'freeSpinsEnd', freeSpinsWin: fsWin });
  }
  void base;
  return { totalWin: total, steps };
}

// ===================================================================================================== wspólne

/**
 * Losuje rundę i buduje odpowiedź z kontraktu 09 § 2.4 (bez zmiany salda — robi to wywołujący).
 * @param {{code: string, bet: number, force?: string, symbols: Array<[string, string, object]>, roundId: number, balanceBefore: number}} o
 */
export function generateSpin({ code, bet, force, symbols, roundId, balanceBefore }) {
  const pays = Object.fromEntries(symbols.map(([c, , p]) => [c, p]));
  const f = force ? String(force).toLowerCase() : null;
  const round = code === 'cebulowy-777' ? spinS1(bet, f, pays) : code === 'zloty-faraon' ? spinS2(bet, f, pays) : spinS3(bet, f, pays);
  const multiplier = Math.round((round.totalWin / bet) * 100) / 100;
  return {
    roundId,
    gameCode: code,
    bet,
    totalWin: round.totalWin,
    multiplier,
    tier: tierFor(round.totalWin / bet),
    balanceBefore,
    balanceAfter: balanceBefore - bet + round.totalWin,
    seed: seedHex(),
    steps: round.steps,
  };
}
