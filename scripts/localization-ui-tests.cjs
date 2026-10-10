const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync(path.join(__dirname,'../public/site/localization.js'),'utf8');
async function run({local={},shared={},visible=[],hidden=[]}){
 let clock=10000,id=0;const timers=new Map(),calls=[],store=new Map([['elturco_language','en'],['elturco_i18n_en',JSON.stringify(local)]]);
 const node=(text,isVisible)=>({nodeValue:text,parentElement:{closest:()=>null,getClientRects:()=>isVisible?[{}]:[],getBoundingClientRect:()=>({top:100,bottom:120})}});
 const nodes=[...visible.map(x=>node(x,true)),...hidden.map(x=>node(x,false))];
 const document={body:{},documentElement:{},visibilityState:'visible',querySelector:()=>null,querySelectorAll:()=>[],createTreeWalker:()=>{let i=0;return{nextNode:()=>nodes[i++]||null}},addEventListener(){},dispatchEvent(){}};
 const context={document,window:{},innerHeight:900,NodeFilter:{SHOW_TEXT:4},MutationObserver:class{observe(){}disconnect(){}},AbortController,CustomEvent:class{},localStorage:{getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v)},Date:class extends Date{static now(){return clock}},setTimeout:(fn,delay)=>{const key=++id;timers.set(key,{fn,at:clock+delay});return key},clearTimeout:key=>timers.delete(key),setInterval:()=>0,fetch:async(url,options)=>{
  if(!options?.method)return{ok:true,json:async()=>({translations:{}})};
  const body=JSON.parse(options.body);calls.push(body);const translations={};
  for(const text of body.texts)if(body.cacheOnly&&shared[text])translations[text]=shared[text];else if(!body.cacheOnly)translations[text]='English '+text;
  return{ok:true,json:async()=>({translations})};
 }};
 vm.runInNewContext(source,context);
 for(let turns=0;turns<30;turns++){await new Promise(setImmediate);if(!timers.size)break;const [key,next]=[...timers].sort((a,b)=>a[1].at-b[1].at)[0];timers.delete(key);clock=next.at;next.fn()}
 await new Promise(setImmediate);return{calls,nodes,clock,store};
}
(async()=>{
 const warm=await run({local:{'Yerel metin':'Local text'},shared:{'Ortak metin':'Shared text'},visible:['Yerel metin','Ortak metin'],hidden:Array.from({length:100},(_,i)=>'Kapalı hizmet '+i)});
 assert.deepEqual(warm.nodes.slice(0,2).map(x=>x.nodeValue),['Local text','Shared text']);
 assert.equal(warm.calls.filter(x=>!x.cacheOnly).length,0,'new visitor reuses shared translations without waiting for AI');
 assert.equal(warm.calls.length,1,'visible cache texts are fetched together');
 assert.ok(!warm.calls.some(x=>x.texts.some(t=>t.startsWith('Kapalı'))),'hidden panels cannot delay current page');
 const cold=await run({visible:Array.from({length:48},(_,i)=>'Yeni görünür metin '+i)});
 const modelCalls=cold.calls.filter(x=>!x.cacheOnly);assert.equal(modelCalls.length,2);assert.ok(modelCalls.every(x=>x.texts.length===24),'larger batches');
 assert.ok(cold.clock<11000,'no three-second delay between model batches');
 assert.ok(cold.nodes.every(x=>x.nodeValue.startsWith('English ')),'all visible cold text eventually translated');
 console.log('PASS: shared cache avoids AI, hidden panels deferred, 24-item batches, no fixed delay, visible content completes.');
})().catch(error=>{console.error(error);process.exitCode=1});
