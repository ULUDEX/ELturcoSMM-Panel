const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync('public/site/app-20260927.js','utf8');
const classes=(initial=[])=>{const set=new Set(initial);return{toggle(name,on){on?set.add(name):set.delete(name)},contains:name=>set.has(name),remove:name=>set.delete(name),add:name=>set.add(name)}};
const views=['new-order','services','orders','support','reseller','api'].map(name=>({id:'view-'+name,classList:classes(name==='new-order'?['active']:[])})),nodes=new Map();
const location={href:'https://example.invalid/site/?auth=login&view=reseller',get search(){return new URL(this.href).search}};
const context={URL,URLSearchParams,location,history:{replaceState(_a,_b,url){location.href=new URL(url,location.href).href}},scrollTo(){},renderLocalOrders(){},platformFilter(){},document:{body:{classList:classes()}},account:null,authMode:'login',orderRows:[],orderLoadFailed:false,services:[],renderProfileAvatar(){},updateReviewGate(){},loadNotifications(){},renderCatalogFilters(){},money:()=>'',loadServices:()=>new Promise(()=>{}),accountModal:{classList:classes()},openAccount(){},fetch:async()=>({ok:true,json:async()=>({loggedIn:true,user:{id:1,name:'QA',email:'qa@example.invalid',balance:0}})})};
context.$=selector=>{if(selector.startsWith('#view-'))return views.find(v=>'#'+v.id===selector);if(!nodes.has(selector))nodes.set(selector,{classList:classes(),querySelector:()=>null,parentElement:{querySelector:()=>null}});return nodes.get(selector)};
context.$$=selector=>selector==='.view'?views:selector.startsWith('.nav-item')?[]:[];
vm.createContext(context);
for(const name of ['showView','applyDeepLink','loadAccount']){const start=source.indexOf((name==='loadAccount'?'async ':'')+'function '+name+'(');const end=source.indexOf('\n',start);vm.runInContext(source.slice(start,end),context)}
(async()=>{
 await context.loadAccount();assert.equal(views.find(v=>v.classList.contains('active')).id,'view-reseller','membership opens while catalog remains pending');assert.equal(new URL(location.href).searchParams.get('auth'),null);
 context.showView('api');assert.equal(new URL(location.href).searchParams.get('view'),'api');
 views.forEach(v=>v.classList.toggle('active',v.id==='view-new-order'));context.applyDeepLink();assert.equal(views.find(v=>v.classList.contains('active')).id,'view-api','reload restores selected API workspace');
 location.href='https://example.invalid/site/?view=unknown';context.applyDeepLink();assert.equal(views.find(v=>v.classList.contains('active')).id,'view-api','unknown view does not hide the active workspace');
 assert.ok(!fs.existsSync('public/index.html'),'root is owned by the server redirect, not a stale static index');
 const html=fs.readFileSync('public/site/index.html','utf8');assert.ok(html.includes('workspace-shortcuts'));assert.ok(html.includes('Bayilik</b><small>25 USD / ay'));
 console.log('PASS: reseller/API navigation is independent from catalog loading, active view survives reload, invalid views remain safe, visible workspace shortcuts and a single root entry.');
})().catch(error=>{console.error(error);process.exitCode=1});
