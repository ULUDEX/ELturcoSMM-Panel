const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync('public/site/app-20260927.js','utf8');
const line=name=>source.slice(source.indexOf('function '+name),source.indexOf('\n',source.indexOf('function '+name)));
function tracking(){
 const context={currentLanguage:'tr',escapeHtml:value=>String(value).replaceAll('<','&lt;')};vm.createContext(context);vm.runInContext(line('orderStatusInfo')+'\n'+line('orderTrack'),context);
 const track=status=>vm.runInContext('orderTrack({status:'+JSON.stringify(status)+'})',context);
 assert.match(track('processing'),/data-step="2"/);assert.match(track('completed'),/data-step="3"/);
 assert.equal((track('completed').match(/aria-current="step"/g)||[]).length,1);
 for(const state of ['failed','refunded','canceled','cancelled']){assert.match(track(state),/is-failed/);assert.doesNotMatch(track(state),/class="track-step done/);assert.doesNotMatch(track(state),/aria-current/)}
 assert.match(track('pending'),/data-step="0"/);assert.match(track('unknown'),/data-step="0"/);
}
function slider(reduce=false){
 const events={},buttons={},trackEvents={};let interval,clears=0;
 const track={children:Array(8).fill({}),firstElementChild:{getBoundingClientRect:()=>({width:238})},clientWidth:988,scrollWidth:1988,scrollLeft:0,addEventListener:(name,fn)=>trackEvents[name]=fn,scrollTo:options=>{track.scrollLeft=options.left;trackEvents.scroll?.()}};
 for(const name of ['prev','next','pause','status'])buttons[name]={setAttribute(){}};
 const host={querySelector:selector=>selector==='.new-services-track'?track:buttons[selector.match(/slide-(\w+)/)?.[1]],querySelectorAll:()=>[buttons.prev,buttons.next],addEventListener:(name,fn)=>events[name]=fn,contains:()=>false};
 const context={document:{querySelector:()=>host,addEventListener:(name,fn)=>events[name]=fn,hidden:false},window:{},matchMedia:()=>({matches:reduce,addEventListener(){}}),MutationObserver:class{observe(){}},setInterval:fn=>{interval=fn;return 1},clearInterval:()=>{interval=null;clears++}};
 vm.runInNewContext(fs.readFileSync('public/site/service-slider.js','utf8'),context);
 assert.equal(buttons.status.textContent,'1–4 / 8');
 if(reduce){assert.equal(interval,null);assert.equal(buttons.pause.hidden,true)}else{assert.equal(typeof interval,'function');interval();assert.equal(track.scrollLeft,1000);interval();assert.equal(track.scrollLeft,0);events.mouseenter();assert.equal(interval,null);events.mouseleave();assert.equal(typeof interval,'function');buttons.pause.onclick();assert.equal(interval,null);buttons.pause.onclick();assert.equal(typeof interval,'function');events.focusin();assert.equal(interval,null);events.focusout({relatedTarget:null});assert.equal(typeof interval,'function');context.document.hidden=true;events.visibilitychange();assert.equal(interval,null)}
 buttons.next.onclick();assert.equal(track.scrollLeft,1000);buttons.prev.onclick();assert.equal(track.scrollLeft,0);
}
tracking();slider();slider(true);console.log('PASS: truthful order stages and carousel paging, wrapping, pause, focus, visibility and reduced motion.');
