import { validateScene } from './plan.js';
import { mix, stringInterpolator, colorInterpolator } from './interpolate.js';
const NS='http://www.w3.org/2000/svg';
let serial=0;

/** One retained SVG surface. New destinations sample and retarget the visible frame. */
export function createTransitionPlayer(host, { duration=300, maxAnimatedNodes=3000, onFinish }={}) {
  if (!host?.ownerDocument) throw new TypeError('A DOM container is required.');
  if (!Number.isFinite(duration) || duration<0 || !Number.isInteger(maxAnimatedNodes) || maxAnimatedNodes<1) throw new TypeError('Invalid transition options.');
  const document=host.ownerDocument, win=document.defaultView, prefix=`transition-${++serial}`;
  const el=tag=>document.createElementNS(NS,tag);
  const svg=el('svg'), defs=el('defs'), body=el('g');
  svg.setAttribute('role','img');svg.setAttribute('aria-label','Visualization');
  svg.setAttribute('preserveAspectRatio','xMidYMid meet');svg.style.cssText='width:100%;height:100%;display:block;overflow:hidden;isolation:isolate';
  svg.append(defs,body);host.replaceChildren(svg);
  const media=win.matchMedia('(prefers-reduced-motion: reduce)');
  let records=new Map(), frame=0, destroyed=false, target=null, viewport=[1,1], viewTrack=null, start=0, ms=duration;
  let waiter=null, sequence=0, cache=new Map(), definitionSets=new Map(), clips=[], viewportAttribute='';
  const stats={frames:0,retargets:0,maxFrameMs:0};
  // SVG painting includes browser work after this callback (large transparent
  // marks can be cheap JS but expensive to rasterize). When that misses frames,
  // leave alternate display frames free for pointer/card compositor animations.
  let lastFrame=0,lastPaint=0,lastSlow=0,pressure=0,paced=false;
  const attrs=node=>Object.fromEntries([...node.attributes].map(a=>[a.name,a.value]));
  function compile(scene) {
    if(cache.has(scene)) return cache.get(scene);
    validateScene(scene);
    const namespace=`${prefix}-s${++sequence}`;
    const rewrite=s=>s.replace(/id="([^"]+)"/g,(_,id)=>`id="${namespace}-${id}"`).replace(/url\(#([^)]+)\)/g,(_,id)=>`url(#${namespace}-${id})`);
    const template=el('svg');template.innerHTML=rewrite(scene.definitions);
    const definition=[...template.childNodes];
    const list=scene.nodes.map(n=>{
      template.innerHTML=rewrite(n.svg);const node=template.firstElementChild;
      if(!node || !['circle','rect','line','path','text'].includes(node.localName) || template.children.length!==1 ||
        [...node.querySelectorAll('*')].some(c=>c.localName!=='tspan') ||
        [node,...node.querySelectorAll('*')].some(c=>[...c.attributes].some(a=>/^on/i.test(a.name)||a.name==='href'))) throw new TypeError('Invalid concrete SVG fragment.');
      return {...n,node,attrs:attrs(node),content:node.innerHTML,namespace};
    });
    const compiled={scene,list,definition,namespace};cache.set(scene,compiled);
    if(cache.size>8)cache.delete(cache.keys().next().value);
    return compiled;
  }
  function mount(n) {
    const outer=el('g'),group=el('g');
    group.append(n.node.cloneNode(true));outer.append(group);body.append(outer);
    const r={key:n.key,type:n.type,topology:n.topology,outer,group,node:group.firstElementChild,
      attrs:{...n.attrs},content:n.content,offset:[...n.offset],bounds:[...n.clip],alpha:0,namespace:n.namespace,track:null};
    paint(r);return r;
  }
  function paint(r) {
    if(r.lastAlpha!==r.alpha){r.outer.setAttribute('opacity',String(r.alpha));r.lastAlpha=r.alpha;}
    const transform=`translate(${r.offset.join(' ')})`;
    if(r.lastTransform!==transform){r.group.setAttribute('transform',transform);r.lastTransform=transform;}
  }
  function remove(r) { r.outer.remove(); }
  function settleWait(value) { const f=waiter;waiter=null;f?.(value); }
  function cleanupDefinitions() {
    const needed=new Set([...records.values()].map(r=>r.namespace));
    for(const [ns,nodes] of definitionSets)if(!needed.has(ns)){nodes.forEach(n=>n.remove());definitionSets.delete(ns);}
  }
  function sample(now) {
    const raw=ms===0?1:Math.max(0,Math.min(1,(now-start)/ms));
    const t=1-(1-raw)**3;
    for(const [key,r] of records){const tr=r.track;if(!tr)continue;
      r.alpha=mix(tr.alpha,tr.endAlpha,t);
      r.offset=tr.offset.map((v,i)=>mix(v,tr.endOffset[i],t));
      r.bounds=tr.bounds.map((v,i)=>mix(v,tr.endBounds[i],t));
      for(const [name,interpolate] of tr.attributes){const value=interpolate(t);if(r.attrs[name]!==value){r.attrs[name]=value;r.node.setAttribute(name,value);}}
      paint(r);
      if(raw===1){r.track=null;if(tr.endAlpha===0){remove(r);records.delete(key);}else if(tr.destination){
        const n=tr.destination;
        for(const name of [...r.node.attributes].map(a=>a.name))if(!(name in n.attrs))r.node.removeAttribute(name);
        for(const [name,value] of Object.entries(n.attrs))if(r.attrs[name]!==value)r.node.setAttribute(name,value);
        r.attrs={...n.attrs};r.namespace=n.namespace;
      }}
    }
    for(const clip of clips){const bounds=clip.from.map((v,i)=>mix(v,clip.to[i],t));
      for(const [i,k] of ['x','y','width','height'].entries())if(clip.last?.[i]!==bounds[i])clip.rect.setAttribute(k,String(bounds[i]));
      clip.last=bounds;
    }
    if(viewTrack){viewport=viewTrack.from.map((v,i)=>mix(v,viewTrack.to[i],t));const value=`0 0 ${viewport.join(' ')}`;if(value!==viewportAttribute){svg.setAttribute('viewBox',value);viewportAttribute=value;}}
    if(raw===1){viewTrack=null;cleanupDefinitions();return true;}return false;
  }
  function loop(now) {
    frame=0;if(destroyed)return;
    const gap=lastFrame?now-lastFrame:0;lastFrame=now;
    if(gap>24&&gap<200){pressure=Math.min(4,pressure+1);lastSlow=now;}
    else if(gap>0)pressure=Math.max(0,pressure-.05);
    if(pressure>=2)paced=true;
    // Avoid repeatedly probing the expensive rate during a short hover burst.
    if(paced&&now-lastSlow>5000){paced=false;pressure=0;}
    if(paced&&now-lastPaint<31&&now<start+ms){frame=win.requestAnimationFrame(loop);return;}
    lastPaint=now;
    const begun=win.performance.now(),done=sample(now);stats.frames++;stats.maxFrameMs=Math.max(stats.maxFrameMs,win.performance.now()-begun);
    if(done){svg.dataset.animating='false';settleWait({status:'finished'});onFinish?.(target);}else frame=win.requestAnimationFrame(loop);
  }
  function interpolators(r,n) {
    if(r.type!==n.type || r.topology!==n.topology || r.content!==n.content)return null;
    const changes=[];
    for(const name of new Set([...Object.keys(r.attrs),...Object.keys(n.attrs)])) {
      const defaults={stroke:'none','stroke-width':'0',opacity:'1'};
      const a=r.attrs[name]??defaults[name],b=n.attrs[name]??defaults[name];if(a===b)continue;
      if(a===undefined || b===undefined)return null;
      let fn;
      if(['fill','stroke'].includes(name))fn=colorInterpolator(a,b,document);
      else if(['cx','cy','r','x','y','x1','x2','y1','y2','rx','ry','width','height','opacity','stroke-width','font-size','d','transform','stroke-dasharray'].includes(name))fn=stringInterpolator(a,b);
      if(!fn)return null;changes.push([name,fn]);
    }
    return changes;
  }
  function transitionTo(scene, options={}) {
    if(destroyed)throw new Error('Transition player was destroyed.');
    const requested=options.duration??duration;
    if(!Number.isFinite(requested)||requested<0)throw new TypeError('Duration must be nonnegative.');
    if(target===scene&&options.duration!==0)return waiter ? new Promise(resolve=>{const old=waiter;waiter=v=>{old?.(v);resolve(v);};}) : Promise.resolve({status:'finished'});
    const compiled=compile(scene); // Validate before disturbing the visible scene.
    const now=win.performance.now(),interrupted=Boolean(frame);if(frame){win.cancelAnimationFrame(frame);frame=0;stats.retargets++;}
    if(now-lastFrame>500){lastFrame=0;lastPaint=0;pressure=0;paced=false;}
    if(!interrupted)lastFrame=0; // Time spent idle is not a missed display frame.
    settleWait({status:'superseded'});
    const first=target===null;target=scene;
    ms=first||media.matches?0:requested;start=now;
    if(!definitionSets.has(compiled.namespace)){
      const nodes=compiled.definition.map(n=>n.cloneNode(true));defs.append(...nodes);definitionSets.set(compiled.namespace,nodes);
    }
    const next=new Map(),used=new Set(),available=new Map();
    for(const [recordKey,r] of records)if(!available.has(r.key)||available.get(r.key)[1].alpha<r.alpha)available.set(r.key,[recordKey,r]);
    const dense=scene.nodes.length>maxAnimatedNodes;
    for(const n of compiled.list){
      const [recordKey,candidate]=available.get(n.key)??[];
      let r=candidate,changes=r?interpolators(r,n):null;
      if(!r || !changes){r=mount(n);changes=[];}else used.add(recordKey);
      const stationary=changes.length===0 && r.alpha===1 && r.offset.every((v,i)=>v===n.offset[i]) && r.bounds.every((v,i)=>v===n.clip[i]);
      r.track=stationary?null:{alpha:r.alpha,endAlpha:1,offset:[...r.offset],endOffset:n.offset,bounds:[...r.bounds],endBounds:n.clip,attributes:changes,destination:n};
      if(dense && changes.length){ // Bound per-frame numeric work; retain local fades.
        used.delete(recordKey);r=mount(n);r.track={alpha:0,endAlpha:1,offset:n.offset,endOffset:n.offset,bounds:n.clip,endBounds:n.clip,attributes:[],destination:n};
      }
      next.set(n.key,r);
    }
    for(const [key,r] of records)if(!used.has(key)){
      if(r.alpha<0.005){remove(r);continue;}
      const exitKey=`exit-${++sequence}`;
      r.track={alpha:r.alpha,endAlpha:0,offset:r.offset,endOffset:r.offset,bounds:r.bounds,endBounds:r.bounds,attributes:[]};next.set(exitKey,r);
    }
    // Bound outgoing ghosts during arbitrarily fast switches between unrelated scenes.
    const exits=[...next.entries()].filter(([key])=>key.startsWith('exit-')).sort((a,b)=>b[1].alpha-a[1].alpha);
    for(const [key,r] of exits.slice(Math.max(100,scene.nodes.length*2))){remove(r);next.delete(key);}
    records=next;
    // Hundreds of marks usually share one plot clip. Share each clipping motion
    // rather than animating hundreds of identical SVG clipPath resources.
    const oldClips=new Map(clips.map(c=>[c.key,c]));clips=[];const clipGroups=new Map();
    for(const r of records.values()){
      const from=r.track?.bounds??r.bounds,to=r.track?.endBounds??r.bounds,key=JSON.stringify([from,to]);
      let clip=clipGroups.get(key);
      if(!clip){clip=oldClips.get(key);oldClips.delete(key);
        if(!clip){const node=el('clipPath'),rect=el('rect'),id=`${prefix}-c${++sequence}`;node.id=id;node.append(rect);defs.append(node);clip={node,rect,id,from,to,key};}
        clipGroups.set(key,clip);clips.push(clip);}
      if(r.clipId!==clip.id){r.outer.setAttribute('clip-path',`url(#${clip.id})`);r.clipId=clip.id;}
    }
    oldClips.forEach(c=>c.node.remove());
    // Only move DOM nodes whose paint order actually changed.
    let cursor=body.firstElementChild;
    for(const r of records.values()){if(r.outer!==cursor)body.insertBefore(r.outer,cursor);else cursor=cursor.nextElementSibling;}
    viewTrack={from:first?[scene.width,scene.height]:[...viewport],to:[scene.width,scene.height]};
    svg.dataset.animating=String(ms>0);const promise=new Promise(resolve=>waiter=resolve);
    if(ms===0){sample(now);settleWait({status:'finished'});onFinish?.(scene);}else frame=win.requestAnimationFrame(loop);
    return promise;
  }
  function motionChanged(){if(media.matches&&target){ms=0;if(frame)win.cancelAnimationFrame(frame);loop(win.performance.now());}}
  media.addEventListener('change',motionChanged);
  return {
    set(scene){return transitionTo(scene,{duration:0});},transitionTo,
    get scene(){return target;},get element(){return svg;},get animating(){return Boolean(frame);},
    get stats(){return {...stats,nodes:records.size,definitions:definitionSets.size};},
    destroy(){if(destroyed)return;destroyed=true;if(frame)win.cancelAnimationFrame(frame);frame=0;settleWait({status:'destroyed'});
      media.removeEventListener('change',motionChanged);svg.remove();records.clear();cache.clear();definitionSets.clear();}
  };
}
