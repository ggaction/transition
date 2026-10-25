import { colorInterpolator, mix } from './interpolate.js';

export function validateCanvasScene(scene) {
  if (scene?.version !== 2 || ![scene.width, scene.height].every(n=>Number.isFinite(n)&&n>0) || !Array.isArray(scene.nodes)) throw new TypeError('Expected a version 2 Canvas scene.');
  const keys=new Set();
  for(const n of scene.nodes){
    if(typeof n.key!=='string'||keys.has(n.key)||!['circle','rect','line','path','text'].includes(n.type)||
      n.offset?.length!==2||n.clip?.length!==4||![...n.offset,...n.clip].every(Number.isFinite)||n.clip[2]<0||n.clip[3]<0||!n.properties||
      n.clips!==undefined&&(!Array.isArray(n.clips)||n.clips.some(c=>!Array.isArray(c)||c.length!==4||!c.every(Number.isFinite)||c[2]<0||c[3]<0))) throw new TypeError('Invalid Canvas scene node.');
    keys.add(n.key);
  }
  return scene;
}

// Null means incompatible topology or discrete content: fade that primitive.
function interpolateValue(a,b,document,key='') {
  if(a===b)return ()=>b;
  if(typeof a==='number'&&typeof b==='number'&&Number.isFinite(a)&&Number.isFinite(b))return t=>mix(a,b,t);
  if(typeof a==='string'&&typeof b==='string'&&['fill','stroke','color'].includes(key))return colorInterpolator(a,b,document);
  if(a&&b&&typeof a==='object'&&typeof b==='object'&&Array.isArray(a)===Array.isArray(b)){
    const keys=Object.keys(b);if(Object.keys(a).length!==keys.length||keys.some(k=>!(k in a)))return null;
    const children=keys.map(k=>[k,interpolateValue(a[k],b[k],document,k)]);if(children.some(([,f])=>!f))return null;
    return t=>{const out=Array.isArray(b)?[]:{};for(const [k,f] of children)out[k]=f(t);return out;};
  }
  return null;
}
function propertiesBetween(a,b,document){
  const defaults={opacity:1,stroke:'none',strokeWidth:0,rotation:0};
  const from={...a},to={...b};
  for(const k of Object.keys(defaults))if((k in from)!==(k in to)){from[k]??=defaults[k];to[k]??=defaults[k];}
  return interpolateValue(from,to,document);
}

/** Canvas-native geometry transitions; rendering belongs to the supplied backend. */
export function createCanvasTransitionPlayer(host,{render,duration=300,maxAnimatedNodes=3000,onFinish}={}) {
  if(!host?.ownerDocument||typeof render!=='function'||!Number.isFinite(duration)||duration<0||!Number.isInteger(maxAnimatedNodes)||maxAnimatedNodes<1)throw new TypeError('Invalid Canvas player options.');
  const document=host.ownerDocument,win=document.defaultView,canvas=document.createElement('canvas'),ctx=canvas.getContext('2d');
  canvas.setAttribute('role','img');canvas.setAttribute('aria-label','Visualization');canvas.dataset.renderer='canvas';
  host.replaceChildren(canvas);
  const media=win.matchMedia('(prefers-reduced-motion: reduce)');
  let target=null,display=null,records=[],frame=0,waiters=[],destroyed=false,start=0,ms=duration,viewport=[1,1],viewFrom=[1,1];
  let drawing=false,raster=null;
  const stats={frames:0,retargets:0,maxFrameMs:0};
  function settle(status){const pending=waiters;waiters=[];for(const {resolve} of pending)resolve({status});}
  function fail(error){const pending=waiters;waiters=[];for(const {reject} of pending)reject(error);}
  function size(scene){
    const css=win.getComputedStyle(host),left=parseFloat(css.paddingLeft)||0,top=parseFloat(css.paddingTop)||0;
    const w=host.clientWidth-left-(parseFloat(css.paddingRight)||0),h=host.clientHeight-top-(parseFloat(css.paddingBottom)||0);if(w<=0||h<=0)return null;
    const scale=Math.min(w/scene.width,h/scene.height),dpr=win.devicePixelRatio||1;
    const pixelRatio=Math.max(.001,Math.min(scale*dpr,4096/scene.width,4096/scene.height,Math.sqrt(16000000/(scene.width*scene.height))));
    return {pixelRatio,style:{display:'block',position:'absolute',maxWidth:'none',maxHeight:'none',
      width:`${scene.width*scale}px`,height:`${scene.height*scale}px`,left:`${left+(w-scene.width*scale)/2}px`,top:`${top+(h-scene.height*scale)/2}px`}};
  }
  function paint(scene){
    const fit=size(scene);if(!fit)return;
    drawing=true;
    try{render(scene,ctx,{pixelRatio:fit.pixelRatio});}finally{drawing=false;}
    Object.assign(canvas.style,fit.style);
    canvas.dataset.nodes=String(scene.nodes.length);display=scene;
  }
  function snapshot(source){const copy=document.createElement('canvas');copy.width=source.width;copy.height=source.height;copy.getContext('2d').drawImage(source,0,0);return copy;}
  function paintRaster(t){
    const scene={version:2,width:viewport[0],height:viewport[1],nodes:[]},fit=size(scene);if(!fit)return;
    const width=Math.max(1,Math.round(scene.width*fit.pixelRatio)),height=Math.max(1,Math.round(scene.height*fit.pixelRatio));
    if(canvas.width!==width)canvas.width=width;if(canvas.height!==height)canvas.height=height;
    ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,width,height);
    ctx.save();ctx.globalCompositeOperation='lighter';
    for(const [image,alpha] of [[raster.from,1-t],[raster.to,t]]){
      const scale=Math.min(width/image.width,height/image.height);ctx.globalAlpha=alpha;
      ctx.drawImage(image,(width-image.width*scale)/2,(height-image.height*scale)/2,image.width*scale,image.height*scale);
    }
    ctx.restore();Object.assign(canvas.style,fit.style);raster.progress=t;
  }
  function sample(now){
    const raw=ms===0?1:Math.max(0,Math.min(1,(now-start)/ms)),t=1-(1-raw)**3;
    viewport=viewFrom.map((v,i)=>mix(v,[target.width,target.height][i],t));
    if(raster&&raw<1){paintRaster(t);return false;}
    for(const r of records){const tr=r.track;if(!tr)continue;
      r.alpha=mix(tr.alpha,tr.endAlpha,t);
      r.node={...r.node,properties:tr.properties?tr.properties(t):r.node.properties,
        offset:tr.from.offset.map((v,i)=>mix(v,tr.to.offset[i],t)),clip:tr.from.clip.map((v,i)=>mix(v,tr.to.clip[i],t)),
        ...(tr.clips?{clips:tr.clips(t)}:{})};
    }
    if(raw===1){raster=null;records=target.nodes.map(node=>({node,alpha:1}));viewport=[target.width,target.height];paint(target);return true;}
    const nodes=records.filter(r=>r.alpha>.0001).map((r,i)=>({...r.node,key:`frame-${i}`,
      properties:r.alpha===1?r.node.properties:{...r.node.properties,opacity:(r.node.properties.opacity??1)*r.alpha}}));
    paint({version:2,width:viewport[0],height:viewport[1],nodes});return false;
  }
  function loop(now){frame=0;if(destroyed)return;
    const begun=win.performance.now();let done;
    try{done=sample(now);}catch(error){canvas.dataset.animating='false';fail(error);return;}
    stats.frames++;stats.maxFrameMs=Math.max(stats.maxFrameMs,win.performance.now()-begun);
    if(done){canvas.dataset.animating='false';settle('finished');onFinish?.(target);}else frame=win.requestAnimationFrame(loop);
  }
  function transitionTo(scene,options={}){
    if(destroyed)throw new Error('Transition player was destroyed.');
    validateCanvasScene(scene);const requested=options.duration??duration;
    if(!Number.isFinite(requested)||requested<0)throw new TypeError('Duration must be nonnegative.');
    if(target===scene&&options.duration!==0)return waiters.length?new Promise((resolve,reject)=>waiters.push({resolve,reject})):Promise.resolve({status:'finished'});
    if(frame){win.cancelAnimationFrame(frame);frame=0;stats.retargets++;}
    // Records represent exactly the last painted frame, including midway fades.
    settle('superseded');const first=!target;target=scene;start=win.performance.now();ms=first||media.matches?0:requested;
    viewFrom=first?[scene.width,scene.height]:[...viewport];
    // A direct endpoint needs no correspondence map, color parser or per-value
    // interpolation closures. This also keeps reduced-motion/dense commits cheap.
    if(ms===0){
      raster=null;records=scene.nodes.map(node=>({node,alpha:1}));viewport=[scene.width,scene.height];
      canvas.dataset.animating='false';
      return new Promise((resolve,reject)=>{
        try{paint(scene);resolve({status:'finished'});onFinish?.(scene);}
        catch(error){reject(error);}
      });
    }
    const dense=ms>0&&(raster||scene.nodes.length>maxAnimatedNodes||records.length>maxAnimatedNodes);
    if(dense){
      const from=snapshot(canvas),to=document.createElement('canvas'),fit=size(scene);
      try{render(scene,to.getContext('2d'),{pixelRatio:fit?.pixelRatio??1});}catch(error){return Promise.reject(error);}
      raster={from,to,progress:0};records=[];
    }
    const old=new Map();for(const r of records)if(!old.has(r.node.key)||old.get(r.node.key).alpha<r.alpha)old.set(r.node.key,r);
    const used=new Set(),next=[];
    for(const node of dense?[]:scene.nodes){const before=old.get(node.key);
      const interpolator=before&&before.node.type===node.type&&before.node.topology===node.topology?
        propertiesBetween(before.node.properties,node.properties,document):null;
      const r=interpolator&&scene.nodes.length<=maxAnimatedNodes?before:{node,alpha:0};
      if(r===before)used.add(r);
      const clipsFrom=r.node.clips,clipsTo=node.clips;
      const clipCount=Math.max(clipsFrom?.length??0,clipsTo?.length??0);
      const startClips=Array.from({length:clipCount},(_,i)=>clipsFrom?.[i]??r.node.clip);
      const endClips=Array.from({length:clipCount},(_,i)=>clipsTo?.[i]??node.clip);
      r.track={alpha:r.alpha,endAlpha:1,from:r.node,to:node,properties:r===before?interpolator:null,
        ...((clipsFrom||clipsTo)?{clips:interpolateValue(startClips,endClips,document)}:{})};next.push(r);
    }
    const exits=records.filter(r=>!used.has(r)&&r.alpha>.005).sort((a,b)=>b.alpha-a.alpha).slice(0,Math.max(100,scene.nodes.length*2));
    for(const r of exits){r.track={alpha:r.alpha,endAlpha:0,from:r.node,to:r.node,properties:null};next.push(r);}
    records=next;canvas.dataset.animating=String(ms>0);
    const promise=new Promise((resolve,reject)=>waiters.push({resolve,reject}));
    if(ms===0){try{sample(start);settle('finished');onFinish?.(scene);}catch(error){fail(error);}}else frame=win.requestAnimationFrame(loop);
    return promise;
  }
  function resized(){if(!destroyed&&!drawing&&display){if(raster)paintRaster(raster.progress);else paint(display);}}
  const observer=new win.ResizeObserver(resized);observer.observe(host);
  win.addEventListener('resize',resized);
  let resolution;
  function densityChanged(){resolution?.removeEventListener('change',densityChanged);resolution=win.matchMedia(`(resolution: ${win.devicePixelRatio||1}dppx)`);resolution.addEventListener('change',densityChanged);resized();}
  densityChanged();
  function motionChanged(){if(media.matches&&target){ms=0;if(frame)win.cancelAnimationFrame(frame);loop(win.performance.now());}}
  media.addEventListener('change',motionChanged);
  return {set(scene){return transitionTo(scene,{duration:0});},transitionTo,
    get scene(){return target;},get element(){return canvas;},get animating(){return Boolean(frame);},
    get stats(){return {...stats,nodes:raster?target.nodes.length:records.length,definitions:0};},
    destroy(){if(destroyed)return;destroyed=true;if(frame)win.cancelAnimationFrame(frame);frame=0;settle('destroyed');
      observer.disconnect();resolution.removeEventListener('change',densityChanged);win.removeEventListener('resize',resized);media.removeEventListener('change',motionChanged);records=[];raster=null;display=null;target=null;canvas.remove();canvas.width=canvas.height=1;}
  };
}
