/** A released tween cannot be reused while an old active reference remains. */
import { Tweener, SkipToken } from '../../src/main/resources/static/js/game/core/tween.js';
const checks=[];
function scenario(name, arrange){
 const tw=new Tweener();let completedAt=null;
 const create=()=>tw.tween(400,()=>{}, {onComplete:()=>{completedAt=tw.now}});
 arrange(tw,create);const start=tw.now;
 tw.update(200);checks.push({name:`${name}: still running after200ms`,ok:completedAt===null,completedAt});
 tw.update(200);checks.push({name:`${name}: completes after400ms`,ok:completedAt===start+400,completedAt});
}
scenario('already skipped token',(tw,create)=>{const token=new SkipToken();token.skip();tw.tween(500,()=>{},{token});create()});
scenario('onComplete starts next tween',(tw,create)=>{tw.tween(100,()=>{}, {onComplete:create});tw.update(100)});
scenario('killed tween replaced',(tw,create)=>{const first=tw.tween(1000,()=>{});tw.kill(first);create()});
for(const c of checks)console.log(`${c.ok?'OK':'FAIL'} ${c.name}: ${c.completedAt}`);
console.log(`${checks.filter(c=>c.ok).length}/${checks.length} PASS`);
if(checks.some(c=>!c.ok)&&!process.argv.includes('--diagnostic'))process.exitCode=1;