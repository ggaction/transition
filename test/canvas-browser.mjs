import {chromium} from 'playwright';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
const root=new URL('../',import.meta.url);
const server=createServer(async(req,res)=>{try{
 const path=new URL(req.url,'http://localhost').pathname;
 if(path==='/'){res.setHeader('Content-Type','text/html');res.end('<div id="host" style="position:relative;width:500px;height:400px"></div>');return;}
 if(!/^\/src\/[a-z-]+\.js$/.test(path)){res.writeHead(404).end();return;}
 res.setHeader('Content-Type','text/javascript');res.end(await readFile(new URL('.'+path,root)));
}catch{res.writeHead(404).end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});
try{
 const page=await browser.newPage({deviceScaleFactor:2,reducedMotion:'no-preference'});
 await page.goto(`http://127.0.0.1:${server.address().port}/`);
 await page.evaluate(async()=>{
  const {createCanvasTransitionPlayer}=await import('/src/index.js');
  const assert=(x,m)=>{if(!x)throw new Error(m);};
  const scene=(x,color='#000')=>({version:2,width:500,height:400,nodes:[{key:'p',type:'circle',topology:'',properties:{x,y:100,radius:6,fill:color},offset:[0,0],clip:[0,0,500,400]}]});
  const host=document.querySelector('#host');let painted;
  function render(s,ctx,{pixelRatio}){
   painted=structuredClone(s);ctx.canvas.width=Math.round(s.width*pixelRatio);ctx.canvas.height=Math.round(s.height*pixelRatio);
   ctx.scale(pixelRatio,pixelRatio);for(const n of s.nodes){ctx.fillStyle=n.properties.fill;ctx.globalAlpha=n.properties.opacity??1;ctx.beginPath();ctx.arc(n.properties.x,n.properties.y,n.properties.radius,0,Math.PI*2);ctx.fill();}
  }
  const player=createCanvasTransitionPlayer(host,{render});window.canvasPlayer=player;
  const a=scene(10),b=scene(400,'#f00'),c=scene(120,'#00f');
  await player.set(a);assert(player.element.width===1000,'DPR applied');
  const pending=player.transitionTo(b);await new Promise(r=>setTimeout(r,70));
  const from=painted.nodes[0].properties.x;assert(from>10&&from<400,'intermediate geometry');
  const next=player.transitionTo(c);assert(painted.nodes[0].properties.x===from,'retarget starts at displayed frame');
  assert((await pending).status==='superseded','superseded settles');await next;
  assert(painted.nodes[0].properties.x===120,'exact endpoint');
  const promises=[];for(let i=0;i<160;i++){promises.push(player.transitionTo(i%2?a:b));await new Promise(r=>setTimeout(r,4));}
  await player.set(c);await Promise.all(promises);assert(player.stats.nodes===1&&host.children.length===1,'bounded resources');
  const before=painted;try{player.transitionTo({...a,version:1});throw new Error('accepted invalid scene');}catch(error){assert(error.message!=='accepted invalid scene','version rejected');}
  assert(painted===before,'invalid scene preserves display');
  host.style.width='250px';await new Promise(r=>setTimeout(r,70));assert(player.element.width===500,'host resize redraws at display resolution');
  const last=player.transitionTo(a);player.destroy();assert((await last).status==='destroyed','destroy settles');assert(host.children.length===0,'destroy releases canvas');
  // Reject asynchronous backend failures rather than stranding pending callers.
  let fail=false;const broken=createCanvasTransitionPlayer(host,{render:(...args)=>{if(fail)throw new Error('backend failure');render(...args);}});
  await broken.set(a);fail=true;await broken.transitionTo(b).then(()=>{throw new Error('missing rejection');},e=>assert(e.message==='backend failure','backend error forwarded'));broken.destroy();
  const dense=createCanvasTransitionPlayer(host,{render,maxAnimatedNodes:1});
  const crowded={...a,nodes:[a.nodes[0],{...a.nodes[0],key:'q',properties:{...a.nodes[0].properties,x:80}}]};
  await dense.set(crowded);const fade=dense.transitionTo(b);await new Promise(r=>setTimeout(r,50));
  const pixels=dense.element.getContext('2d').getImageData(0,0,dense.element.width,dense.element.height).data;
  assert(pixels.some(v=>v>0),'dense fallback paints native snapshots');
  const again=dense.transitionTo(crowded);assert((await fade).status==='superseded','dense retarget settles');await again;
  assert(dense.stats.nodes===2,'dense endpoint restores exact scene');dense.destroy();
  window.makeReduced=()=>createCanvasTransitionPlayer(host,{render});window.scene=a;
 });
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.evaluate(async()=>{const p=makeReduced();await p.set(scene);await p.transitionTo({...scene,width:600});if(p.animating)throw new Error('reduced motion');p.destroy();});
 console.log('PASS Canvas interpolation, retarget continuity, 160 interruptions, cleanup, DPR/resize, errors and reduced motion');
}finally{await browser.close();await new Promise(r=>server.close(r));}
