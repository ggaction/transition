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
  const viewportWrites=[];
  const observer=new MutationObserver(entries=>viewportWrites.push(...entries));
  observer.observe(player.element,{attributes:true,attributeFilter:['viewBox']});
  const pending=player.transitionTo(b);await new Promise(r=>setTimeout(r,70));
  const from=Number(mark.getAttribute('cx'));assert(from>10&&from<400,'intermediate position');
  const next=player.transitionTo(c),sample=Number(mark.getAttribute('cx'));
  assert(Math.abs(from-sample)<.001,'retarget continues from the visible position');
  assert(player.element.querySelector('circle')===mark,'retains matched DOM node');
  assert((await pending).status==='superseded','superseded promise settles');await next;
  assert(mark.getAttribute('cx')==='120','exact endpoint');
  assert(viewportWrites.length===0,'unchanged viewport must not invalidate every animation frame');
  await player.transitionTo({...c,width:600});
  assert(viewportWrites.length>0&&player.element.getAttribute('viewBox')==='0 0 600 400','changed viewport still animates to its exact dimensions');
  observer.disconnect();
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
 await page.evaluate(async()=>{
  const {createTransitionPlayer}=await import('/src/index.js');
  const request=window.requestAnimationFrame,cancel=window.cancelAnimationFrame,clock=performance.now.bind(performance);
  const callbacks=new Map();let time=5000,id=0;
  window.requestAnimationFrame=cb=>{callbacks.set(++id,cb);return id;};window.cancelAnimationFrame=id=>callbacks.delete(id);
  performance.now=()=>time;
  const tick=t=>{time=t;const batch=[...callbacks.values()];callbacks.clear();batch.forEach(cb=>cb(t));};
  const scene=x=>({version:1,width:500,height:400,definitions:'',nodes:[{key:'p',type:'circle',topology:'',svg:`<circle cx="${x}" cy="40" r="4"/>`,offset:[0,0],clip:[0,0,500,400]}]});
  const host=document.querySelector('#host'),a=scene(10),b=scene(400);
  let player;
  const check=(ok,message)=>{if(!ok)throw new Error(message);};
  try{
   player=createTransitionPlayer(host);await player.set(a);
   const pending=player.transitionTo(b),mark=player.element.querySelector('circle');
   tick(5016);tick(5050);tick(5084);const before=mark.getAttribute('cx');
   tick(5100);check(mark.getAttribute('cx')===before,'slow SVG must leave a display frame free');
   tick(5117);check(mark.getAttribute('cx')!==before,'paced playback still advances');
   tick(5317);check((await pending).status==='finished'&&mark.getAttribute('cx')==='400','pacing preserves duration and endpoint');
   player.destroy();
   player=createTransitionPlayer(host);await player.set(a);
   for(let i=0;i<6;i++){
    time+=400;const start=time,frames=player.stats.frames,promise=player.transitionTo(i%2?a:b);
    tick(start+16);tick(start+32);
    check(player.stats.frames===frames+2,'idle gaps must not lower the normal render rate');
    tick(start+301);await promise;
   }
  }finally{player?.destroy();window.requestAnimationFrame=request;window.cancelAnimationFrame=cancel;performance.now=clock;}
 });
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.evaluate(async()=>{
  const {createTransitionPlayer}=await import('/src/index.js');const p=createTransitionPlayer(document.querySelector('#host'));
  const a={version:1,width:100,height:100,definitions:'',nodes:[]};await p.set(a);await p.transitionTo({...a,width:200});
  if(p.animating||p.element.getAttribute('viewBox')!=='0 0 200 100')throw new Error('reduced motion did not settle');p.destroy();
 });
 console.log('PASS interruption continuity, identity, exact endpoints, 120 retargets, cleanup, frame pacing, invalid input and reduced motion',result);
}finally{await browser.close();await new Promise(r=>server.close(r));}
