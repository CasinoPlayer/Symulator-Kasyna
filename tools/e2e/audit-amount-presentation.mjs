/** Regression: an old skipped presentation must not fade a newer scene amount. */
import { chromium } from 'playwright-core';
import { mkdir, writeFile } from 'node:fs/promises';
const BASE=process.argv[2] ?? 'http://127.0.0.1:8081', OUT=process.argv[3] ?? 'E:/CebulionCasino/testy/audit-amount-presentation';
const browser=await chromium.launch({executablePath:process.env.PW_CHROMIUM ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:1366,height:900},locale:'pl-PL'});
const errors=[];page.on('pageerror',e=>errors.push(e.stack));
try {
 await mkdir(OUT,{recursive:true}); await page.goto(BASE,{waitUntil:'networkidle'});
 await page.click('#btn-zaloguj');await page.fill('#nick',`Fade${Date.now().toString(36).slice(-6)}`);
 await Promise.all([page.waitForResponse(r=>r.url().includes('/auth/login')&&r.status()===200),page.keyboard.press('Enter')]);await page.waitForSelector('#modal-logowanie.is-open',{state:'hidden'});
 await page.goto(`${BASE}/gra.html?gra=krysztalowa-kaskada`,{waitUntil:'load'});await page.waitForSelector('#btn-graj:not([hidden])',{timeout:45000});await page.click('#btn-graj');await page.waitForFunction(()=>window.__gra?.state==='ready');
 const result=await page.evaluate(async()=>{
  const g=window.__gra._game,tw=g.gameApp.tweener;
  const {SkipToken}=await import('/js/game/core/tween.js');
  const present=async(amount)=>{const skip=new SkipToken();skip.skip(); const ctx={bet:20,tempo:1,autoplay:true,skip,state:{}}; await g.presentWins({wins:[],totalWin:amount,win:amount},ctx,{m:amount/20,tier:'small',amount,base:0})};
  const samples=[]; const sample=label=>samples.push({label,t:tw.now,visible:g.amountRoot.visible,alpha:g.amountRoot.alpha,amount:g.amountDigits.text});
  g.clearPresentation(); await present(40); sample('first');
  await tw.wait(200); g.clearPresentation(); await present(60);sample('second');
  await tw.wait(550);sample('after-old-fade-before-own-fade');
  await tw.wait(250);sample('after-own-fade');
  return {samples,ok:samples[1].visible&&samples[2].visible&&!samples[3].visible};
 });
 await writeFile(`${OUT}/wyniki.json`,JSON.stringify({...result,errors},null,2));console.log(JSON.stringify({...result,errors}));if((!result.ok||errors.length)&&!process.argv.includes('--diagnostic'))process.exitCode=1;
}finally{await browser.close()}