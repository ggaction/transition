const number = /[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:e[-+]?\d+)?/gi;
export const mix = (a,b,t) => a+(b-a)*t;
export function stringInterpolator(a, b) {
  if (a === b) return () => b;
  const av = a.match(number)?.map(Number) ?? [], bv = b.match(number)?.map(Number) ?? [];
  if (!av.length || av.length !== bv.length || a.replace(number,'#') !== b.replace(number,'#')) return null;
  // Arc flags are discrete. Different topology uses a local crossfade.
  if (/[aA]/.test(a)) {
    const tokens=s=>s.match(/[a-df-zA-DF-Z]|[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:e[-+]?\d+)?/g)??[];
    const x=tokens(a),y=tokens(b);
    for(let i=0;i<x.length;i++)if(x[i]==='A'||x[i]==='a'){
      if(x[i+4]!==y[i+4]||x[i+5]!==y[i+5])return null;
    }
  }
  return t => { let i=0; return b.replace(number, () => String(mix(av[i],bv[i++],t))); };
}
const colorCaches=new WeakMap();
export function colorInterpolator(a,b,document) {
  let cache=colorCaches.get(document);
  if(!cache){cache={values:new Map(),ctx:document.createElement("canvas").getContext("2d")};colorCaches.set(document,cache);}
  const normalize = value => {
    if(cache.values.has(value))return cache.values.get(value);
    const ctx=cache.ctx;
    ctx.fillStyle='#010203';ctx.fillStyle=value;
    const v=ctx.fillStyle;
    const nums=v.match(/[\d.]+/g)?.map(Number);
    const parsed=v[0]==='#'?[parseInt(v.slice(1,3),16),parseInt(v.slice(3,5),16),parseInt(v.slice(5,7),16),v.length===9?parseInt(v.slice(7,9),16)/255:1]:nums?.length===3?[...nums,1]:nums;
    cache.values.set(value,parsed);if(cache.values.size>256)cache.values.delete(cache.values.keys().next().value);return parsed;
  };
  if ([a,b].some(v => v.startsWith('url('))) return null;
  const x=a==='none'?[...normalize(b).slice(0,3),0]:normalize(a),y=b==='none'?[...normalize(a).slice(0,3),0]:normalize(b);
  if (!x || !y) return null;
  return t => `rgba(${x.slice(0,3).map((n,i)=>Math.round(mix(n,y[i],t))).join(',')},${mix(x[3],y[3],t)})`;
}
