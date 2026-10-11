import { chromium } from 'playwright-core';
import { mkdir, writeFile } from 'node:fs/promises';
const BASE=process.argv[2] ?? 'http://127.0.0.1:8080', OUT=process.argv[3] ?? 'E:/CebulionCasino/testy/audit-win-timing';
const browser=await chromium.launch({executablePath:process.env.PW_CHROMIUM ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:1366,height:900},locale:'pl-PL'});
const errors=[]; page.on('pageerror', e=>errors.push(e.stack));
const grid = () => Array.from({ length: 6 }, (_, c) => Array.from({ length: 5 }, (_, r) => ['szafir','szmaragd','ametyst','topaz','rubin','diament','cebula'][(c+r)%7]));
const copy = (g) => g.map((c) => [...c]);
const removed = Array.from({ length: 5 }, (_, c) => [c, 4]);
function cascade(g, addOrb = false) {
  const next = copy(g), symbols = Array.from({ length: 6 }, () => []);
  for (let c = 0; c < 5; c++) { symbols[c] = [addOrb && c === 2 ? 'mnoznik' : c % 2 ? 'topaz' : 'ametyst']; next[c] = [...symbols[c], ...g[c].slice(0, 4)]; }
  return { type: 'cascade', removed, newSymbols: symbols, grid: next, orbs: addOrb ? [{ pos: [2,0], value: 5 }] : [] };
}
function fixtures(kind, bet) {
  const start = grid();
  if (kind === 'anticipation') {
    for (const [c,r] of [[0,0],[1,1],[2,2]]) start[c][r] = 'scatter';
    return { steps: [{ type: 'spin', phase: 'base', grid: start, orbs: [], anticipation: [3,4,5] }], win: 0 };
  }
  if (kind === 'lose') return { steps: [{ type: 'spin', phase: 'base', grid: start, orbs: [], anticipation: [] }], win: 0 };
  if (kind === 'cascade') {
    for (let c = 0; c < 5; c++) start[c][4] = 'rubin';
    return { steps: [{ type: 'spin', phase: 'base', grid: start, orbs: [], anticipation: [] }, { type: 'win', win: bet * 2, totalWin: bet * 2, wins: [{ kind: 'cluster', symbol: 'rubin', count: 5, positions: removed, amount: bet * 2 }] }, cascade(start)], win: bet * 2 };
  }
  const trigger = [[0,0],[1,1],[2,2],[3,3]];
  trigger.forEach(([c,r]) => start[c][r] = 'scatter');
  const free = grid(); free[0][0] = 'mnoznik';
  for (let c = 0; c < 5; c++) free[c][4] = 'szafir';
  for (const [c,r] of [[0,3],[1,2],[3,2]]) free[c][r] = 'scatter';
  const casc = cascade(free, true);
  const baseWin = bet * 5, sequenceWin = bet * 3, fsWin = sequenceWin * 7;
  const steps = [
    { type: 'spin', phase: 'base', grid: start, orbs: [], anticipation: [] },
    { type: 'win', win: baseWin, totalWin: baseWin, wins: [{ kind: 'scatter', symbol: 'scatter', count: 4, positions: trigger, amount: baseWin }] },
    { type: 'freeSpinsStart', count: 10, trigger },
    { type: 'spin', phase: 'free', grid: free, orbs: [{ pos: [0,0], value: 2 }], freeSpinIndex: 1, freeSpinsLeft: 9, anticipation: [] },
    { type: 'win', win: sequenceWin, totalWin: baseWin + sequenceWin, wins: [{ kind: 'cluster', symbol: 'szafir', count: 5, positions: removed, amount: sequenceWin }] },
    casc,
    { type: 'applyMultiplier', baseWin: sequenceWin, orbsSum: 7, win: sequenceWin * 6, totalWin: baseWin + fsWin },
    { type: 'freeSpinsRetrigger', added: 5, trigger: [[0,4],[1,3],[3,3]], freeSpinsLeft: 14 },
  ];
  for (let i = 2; i <= 15; i++) {
    const g = grid(), orbs = i === 15 ? [{ pos: [4,2], value: 50 }] : [];
    if (orbs.length) g[4][2] = 'mnoznik';
    steps.push({ type: 'spin', phase: 'free', grid: g, orbs, freeSpinIndex: i, freeSpinsLeft: 15 - i, anticipation: [] });
  }
  steps.push({ type: 'freeSpinsEnd', freeSpinsWin: fsWin });
  return { steps, win: baseWin + fsWin };
}

let kind='cascade', ledger=10000, round=0, response, autoNo=0;
await page.route('**/api/slots/krysztalowa-kaskada/spins',async route=>{
 const {bet}=route.request().postDataJSON(), fixtureKind=kind==='auto'?(autoNo++%2===0?'cascade':'lose'):kind==='fs-skip'?'fs':kind, f=fixtures(fixtureKind,bet); const m=f.win/bet;
 response={roundId:++round,gameCode:'krysztalowa-kaskada',bet,totalWin:f.win,multiplier:m,tier:m>=15?'big':m>=5?'medium':m?'small':'none',balanceBefore:ledger,balanceAfter:ledger-bet+f.win,seed:'5353000000000001',steps:f.steps}; ledger=response.balanceAfter;
 await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(response)});
});
try {
 await mkdir(OUT,{recursive:true});
 await page.goto(BASE,{waitUntil:'networkidle'}); await page.click('#btn-zaloguj'); await page.fill('#nick',`Audit${Date.now().toString(36).slice(-6)}`);
 await Promise.all([page.waitForResponse(r=>r.url().includes('/auth/login')&&r.status()===200),page.keyboard.press('Enter')]); await page.waitForSelector('#modal-logowanie.is-open',{state:'hidden'});
 await page.goto(`${BASE}/gra.html?gra=krysztalowa-kaskada`,{waitUntil:'load'}); await page.waitForSelector('#btn-graj:not([hidden])',{timeout:45000}); await page.click('#btn-graj'); await page.waitForFunction(()=>window.__gra?.state==='ready');
 await page.evaluate(()=>{
   const game=window.__gra._game; window.__audit=[];
   const log=(event,data={})=>window.__audit.push({event,t:performance.now(),round:window.__gra.responses.length,index:game.player.ctx?.index,type:game.player.ctx?.steps[game.player.ctx.index]?.type,phase:game.bigwin.phase,...data});
   const originalUi=game.ui, field=originalUi.winField, book=originalUi.book;
   const wrapField=v=>{field(v);log('win',{v:Number(document.querySelector('#wygrana').textContent.replace(/\s/g,'')),requested:v})};
   game.ui=new Proxy({}, {get:(_t,k)=>k==='winField'?wrapField:k==='book'?()=>{log('book');book()}:originalUi[k]});

   const present=game.presentWins.bind(game); game.presentWins=async (...args)=>{log('presentation-start',{info:args[2]});await present(...args);log('presentation-end')};
   game.player.addEventListener('step',e=>log('step',{step:e.detail.step}));
   window.__auditSnapshot=()=>({t:performance.now(),state:window.__gra.state,target:window.__gra.displayedBalance,text:document.querySelector('#saldo .balance-pill__value').textContent,win:document.querySelector('#wygrana').textContent});
   // Speed only the long decorative Big Win count, after it has emitted some samples.
   let lastPhase='',phaseStart=0; window.__auditSkip=setInterval(()=>{const phase=game.bigwin.phase;if(phase!==lastPhase){lastPhase=phase;phaseStart=performance.now()}if((phase==='count'||phase==='hold')&&performance.now()-phaseStart>230)game.bigwin.skip()},50);
 });
 const rounds=[];
 for(const k of (process.argv.includes('--quick')?['cascade','lose']:['cascade','fs','cascade','lose','lose','fs-skip'])){
   kind=k; const n=await page.evaluate(()=>window.__gra.responses.length); await page.click('#btn-spin'); await page.waitForFunction(n=>window.__gra.responses.length>n,n);
   if(k==='fs-skip'){await page.click('#btn-spin'); await page.waitForTimeout(100);await page.click('#scena',{position:{x:20,y:20}});}
   await page.waitForFunction(()=>window.__gra.state==='ready',null,{timeout:100000});
   const ready=await page.evaluate(()=>window.__auditSnapshot()); if(rounds.length<2 || k==='lose') await page.waitForTimeout(1850); const settled=await page.evaluate(()=>window.__auditSnapshot());
   rounds.push({kind:k,totalWin:response.totalWin,ready,settled}); console.log(JSON.stringify(rounds.at(-1)));
 }
 kind='auto'; const autoStart=round;
 await page.evaluate(()=>{
   window.__autoReady=[]; let last=window.__gra.responses.length;
   window.__autoMonitor=setInterval(()=>{if(window.__gra.state==='ready'&&window.__gra.responses.length>last){last=window.__gra.responses.length;window.__autoReady.push({...window.__auditSnapshot(),response:window.__gra.lastResponse})}},16);
 });
 if(await page.getAttribute('#btn-turbo','aria-pressed')!=='true') await page.click('#btn-turbo');
 await page.click('#btn-auto'); await page.click('#auto-start');
 await page.waitForFunction(n=>window.__gra.responses.length>=n+10&&!window.__gra.autoplay&&window.__gra.state==='ready',autoStart,{timeout:100000}); await page.waitForTimeout(180);
 const autoReady=await page.evaluate(()=>{clearInterval(window.__autoMonitor);return window.__autoReady});
 const numeric=v=>Number(v.replace(/\s/g,''));
 const checks=[
   {name:'saldo widoczne w ready zgodne z celem',ok:rounds.every(r=>numeric(r.ready.text)===r.ready.target)},
   {name:'wygrana końcowa zgodna z totalWin',ok:rounds.every(r=>numeric(r.ready.win)===r.totalWin)},
   {name:'zerowe spiny pozostają zerowe',ok:rounds.filter(r=>r.kind==='lose').every(r=>numeric(r.ready.win)===0&&numeric(r.settled.win)===0)},
   {name:'autoplay 10 rund bez opóźnionego salda lub wygranej',ok:autoReady.length===10&&autoReady.every(r=>numeric(r.text)===r.response.balanceAfter&&numeric(r.win)===r.response.totalWin)}
 ];
 const events=await page.evaluate(()=>window.__audit); const drops=[]; let prev;
 for(const e of events){if(e.event==='win'){if(prev&&e.round===prev.round&&e.v<prev.v)drops.push({before:prev,after:e});prev=e}}
 await writeFile(`${OUT}/wyniki.json`,JSON.stringify({checks:[...checks,{name:"wygrana nie cofa się w obrębie rundy",ok:drops.length===0},{name:"brak błędów JS",ok:errors.length===0}],rounds,autoReady,drops,events,errors},null,2)); console.log(JSON.stringify({checks,drops:drops.map(d=>({round:d.after.round,before:d.before.v,after:d.after.v,type:d.after.type,phase:d.after.phase})),errors}));
if((checks.some(c=>!c.ok)||drops.length||errors.length)&&!process.argv.includes('--diagnostic'))process.exitCode=1;
} finally {await browser.close()}