import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const server=createServer(async(req,res)=>{try{const pathname=new URL(req.url,'http://localhost').pathname;
 if(pathname==='/'){res.setHeader('Content-Type','text/html');res.end('<div id="host" style="width:500px;height:400px"></div>');return;}
 if(!/^\/src\/[a-z-]+\.js$/.test(pathname)){res.writeHead(404).end();return;}
 res.setHeader('Content-Type','text/javascript');res.end(await readFile(root+pathname));}catch{res.writeHead(404).end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});
try{
 const page=await browser.newPage({reducedMotion:'no-preference'});await page.goto(`http://127.0.0.1:${server.address().port}/`);
 const result=await page.evaluate(async()=>{
  const {createTransitionPlayer}=await import('/src/index.js');
  const assert=(x,m)=>{if(!x)throw new Error(m);};
  const node=(x,color)=>({key:'point',type:'circle',topology:'',svg:`<circle cx="${x}" cy="100" r="6" fill="${color}"/>`,offset:[0,0],clip:[0,0,500,400]});
  const scene=(x,c)=>({version:1,width:500,height:400,definitions:'',nodes:[node(x,c)]});
  const a=scene(10,'#000000'),b=scene(400,'#ff0000'),c=scene(120,'#0000ff');
  const player=createTransitionPlayer(document.querySelector('#host'));
  await player.set(a);const mark=player.element.querySelector('circle');
  const pending=player.transitionTo(b);await new Promise(r=>setTimeout(r,70));
  const from=Number(mark.getAttribute('cx'));assert(from>10&&from<400,'intermediate position');
  const next=player.transitionTo(c),sample=Number(mark.getAttribute('cx'));
  assert(Math.abs(from-sample)<.001,'retarget continues from the visible position');
  assert(player.element.querySelector('circle')===mark,'retains matched DOM node');
  assert((await pending).status==='superseded','superseded promise settles');await next;
  assert(mark.getAttribute('cx')==='120','exact endpoint');
  const promises=[];for(let i=0;i<120;i++){promises.push(player.transitionTo(i%2?a:b));await new Promise(r=>setTimeout(r,4));}
  await player.set(c);await Promise.all(promises);
  assert(player.stats.nodes===1&&player.element.querySelectorAll('circle').length===1,'no ghost accumulation');
  assert(player.element.querySelectorAll('clipPath').length<=2,'bounded clip definitions');
  const invalid={...a,version:99};try{player.transitionTo(invalid);throw new Error('accepted invalid version');}catch(e){assert(e.message!=='accepted invalid version','version rejected');}
  assert(mark.getAttribute('cx')==='120','invalid input preserves current');
  const last=player.transitionTo(a);player.destroy();assert((await last).status==='destroyed','destroy settles promise');
  assert(document.querySelector('#host').children.length===0,'destroy removes view');
  return {passed:true};
 });
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.evaluate(async()=>{
  const {createTransitionPlayer}=await import('/src/index.js');const p=createTransitionPlayer(document.querySelector('#host'));
  const a={version:1,width:100,height:100,definitions:'',nodes:[]};await p.set(a);await p.transitionTo({...a,width:200});
  if(p.animating||p.element.getAttribute('viewBox')!=='0 0 200 100')throw new Error('reduced motion did not settle');p.destroy();
 });
 console.log('PASS interruption continuity, identity, exact endpoints, 120 retargets, cleanup, invalid input and reduced motion',result);
}finally{await browser.close();await new Promise(r=>server.close(r));}
