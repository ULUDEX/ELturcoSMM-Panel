const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync('public/site/app-20260927.js','utf8');
async function radioTests(){
 const nodes=new Map();let loads=0,plays=0,toasts=0;
 const audio={paused:true,getAttribute:()=>audio.src,play:async()=>{plays++},pause(){},set src(value){loads++;this.current=value},get src(){return this.current}};
 const $=id=>{if(id==='#radio-audio')return audio;if(!nodes.has(id))nodes.set(id,{value:0,textContent:'',querySelectorAll:()=>[],classList:{toggle(){}},setAttribute(){}});return nodes.get(id)};
 const context={$,console,Number,String,Math,escapeHtml:String,toast:()=>toasts++,fetch:async()=>({json:async()=>({settings:{},tracks:[{src:'/site/audio/missing.mp3'},{src:'https://external.invalid/song.mp3'},{src:'/api/media/real-song',title:'Parça'}]})}),applyAdminContent(){},document:{}};
 vm.createContext(context);
 vm.runInContext(source.slice(source.indexOf('let tracks='),source.indexOf('\nsetInterval',source.indexOf('let tracks='))),context);
 assert.equal(loads,0,'empty initial player must not request a missing file');
 await vm.runInContext('loadSiteConfig()',context);
 assert.equal(vm.runInContext('tracks.length',context),1,'only uploaded media is available');
 assert.equal(loads,0,'configuration must not preload audio');
 $('#music-toggle').onclick();await Promise.resolve();assert.equal(loads,1);assert.equal(plays,1);
 audio.onerror();assert.equal(toasts,0,'media error must stay inside the player');
 context.fetch=async()=>({json:async()=>({settings:{show_radio:'0'},tracks:[]})});
 await vm.runInContext('loadSiteConfig()',context);assert.equal($('#music-player').hidden,true);
 vm.runInContext('nextTrack();loadTrack(100,true)',context);assert.equal(plays,1,'empty and invalid selections are safe');
 const eta=source.slice(source.indexOf('function etaFor'),source.indexOf('\n',source.indexOf('function etaFor')));
 vm.runInContext(eta,context);assert.match(vm.runInContext('etaFor({name:"Instant 1 hour"})',context),/belirtilmemiş/);assert.match(vm.runInContext('etaFor({averageTimeSeconds:7200})',context),/2 saat.*garanti değildir/);
}
async function authTests(){
 const start=source.lastIndexOf('async function loadAccount()');
 const code=source.slice(start,source.indexOf('\n',start));
 let opened;
 const node={classList:{toggle(){},remove(){},add(){}},parentElement:{querySelector:()=>null}};
 const context={account:null,authMode:'register',fetch:async()=>({ok:true,json:async()=>({loggedIn:false})}),document:{body:node},accountModal:node,$:()=>node,openAccount:mode=>opened=mode,renderProfileAvatar(){},updateReviewGate(){},translation:()=>({account:'Hesap'})};
 vm.createContext(context);vm.runInContext(code,context);await vm.runInContext('loadAccount()',context);assert.equal(opened,'register','late account response preserves registration choice');
 context.authMode='forgot';context.fetch=async()=>{throw Error('offline')};await vm.runInContext('loadAccount()',context);assert.equal(opened,'forgot','network failure must not close password recovery');
}
function savedTests(raw,storageFails=false){
 class Element{constructor(){this.children=[];this.value='';this.hidden=false}append(...items){this.children.push(...items)}replaceChildren(){this.children=[]}before(node){this.beforeNode=node}after(node){this.afterNode=node}setAttribute(){}addEventListener(name,fn){this[name]=fn}}
 const host=new Element(),selector=new Element(),info=new Element();let stored,chosen;
 const context={document:{querySelector:selectorText=>({'#service-list':host,'#service-select':selector,'#service-info':info})[selectorText]||null,createElement:()=>new Element()},localStorage:{getItem:()=>raw,setItem:(key,value)=>{if(storageFails)throw Error('blocked');stored=value}},services:[{id:7,name:'Test hizmeti'}],chooseService:id=>chosen=id,toast(){},MutationObserver:class{observe(){}}};
 vm.createContext(context);vm.runInContext(fs.readFileSync('public/site/customer-experience.js','utf8'),context);
 selector.value='7';selector.change();info.afterNode.onclick();
 const item=host.beforeNode.children[2].children.find(x=>x.children.length===2);
 assert.ok(item,'saving creates a usable shortcut even with unavailable storage');item.children[0].onclick();assert.equal(chosen,7);
 if(!storageFails)assert.deepEqual(JSON.parse(stored),[7]);
 item.children[1].onclick();if(!storageFails)assert.deepEqual(JSON.parse(stored),[]);
}
Promise.all([radioTests(),authTests()]).then(()=>{savedTests('{broken');savedTests('{}');savedTests('[null,"7",-4,0]');savedTests('[]',true);console.log('PASS: radio opt-in, missing media, honest ETA, auth race and safe saved-service selection/removal.');}).catch(error=>{console.error(error);process.exit(1)});
