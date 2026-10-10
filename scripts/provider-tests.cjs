const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {DatabaseSync}=require('node:sqlite');
const ts=require('typescript');
const root=path.join(__dirname,'..');
const env={SMM_PROVIDER_API_KEY:'test-pf',SMM_PROVIDER_API_VERSION:'3',SMMXSERVER_API_KEY:'test-smmx',SMM_PROVIDER_USD_TRY_RATE:'40'};
const db=new DatabaseSync(':memory:');
for(const name of fs.readdirSync(path.join(root,'drizzle')).filter(x=>x.endsWith('.sql')).sort())db.exec(fs.readFileSync(path.join(root,'drizzle',name),'utf8'));
env.DB={prepare(sql){let args=[];return{bind(...values){args=values;return this},async all(){return{results:db.prepare(sql).all(...args)}},async first(){return db.prepare(sql).get(...args)||null},async run(){const r=db.prepare(sql).run(...args);return{meta:{changes:Number(r.changes)}}}}},async batch(statements){db.exec('BEGIN');try{const r=[];for(const s of statements)r.push(await s.run());db.exec('COMMIT');return r}catch(e){db.exec('ROLLBACK');throw e}}};
const loaded={};let notices=0;
function load(file){if(loaded[file])return loaded[file];const source=fs.readFileSync(path.join(root,file),'utf8');const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;const module={exports:{}};const req=name=>name==='cloudflare:workers'?{env}:name==='next/server'?{NextResponse:{json:(data,options)=>({data,status:options?.status||200})}}:name==='@/lib/telegram-announcements'?{catalogAnnouncementStatement:()=>{notices++;return env.DB.prepare("INSERT INTO site_settings(key,value,updated_at) VALUES('test_notice','1',0) ON CONFLICT(key) DO NOTHING")},flushCatalogAnnouncements:async()=>({sent:0,configured:false})}:name==='@/lib/admin-auth'?{isAdmin:async()=>true}:name==='@/lib/customer-auth'?{currentCustomer:async()=>({email:'test@example.invalid',name:'Test',balance:100000})}:name==='@/lib/rewards'?{awardCompletedOrder:async()=>{}}:name==='@/lib/customer-notifications'?{addCustomerNotification:async()=>{}}:name.startsWith('@/')?load(name.slice(2)+'.ts'):require(name);new Function('require','module','exports',js)(req,module,module.exports);loaded[file]=module.exports;return module.exports;}
const provider=load('lib/provider.ts'),catalog=load('lib/provider-catalog.ts');
let calls=[],services=[{service:42,type:'Default',name:'Instagram SMMX',category:'Instagram Followers',rate:'1.00',min:10,max:10000,refill:true,cancel:true}];
global.fetch=async(url,options={})=>{const u=String(url),b=new URLSearchParams(options.body),action=b.get('action');calls.push({url:u,action,body:b,headers:options.headers});let data;
 if(u.includes('api.telegram.org')){assert.equal(JSON.parse(options.body).chat_id,'@test-group');return{ok:true,status:200,json:async()=>({ok:true})};}
 if(u.includes('smmxserver')){assert.equal(b.get('key'),'test-smmx');if(action==='services')data=services;else if(action==='balance')data={balance:'5',currency:'USD'};else if(action==='add')data={order:42};else if(action==='status')data={'42':{status:'In progress'}};else if(action==='refill')data={refill:9};else if(action==='cancel')data=[{order:42,cancel:{error:'Cannot cancel'}}];else if(action==='refill_status')data={status:'Completed'};else throw new Error('Unexpected action');}
 else {assert.equal(options.headers.authorization||options.headers.Authorization,'Bearer test-pf');data=u.endsWith('/orders')?{data:{id:42}}:u.includes('/orders/42')?{data:{status:'Completed'}}:{data:services,has_more:false};}
 return{ok:true,status:200,json:async()=>data};};
async function main(){
 const pricing=load('lib/provider-pricing.ts');for(const [cost,percent,sale] of [[999,75,1748],[1000,65,1650],[4999,65,8248],[5000,50,7500]]){assert.equal(pricing.providerMarkupPercent(cost),percent);assert.equal(pricing.providerSalePrice(cost),sale);}
 const priceDb=new DatabaseSync(':memory:');priceDb.exec("CREATE TABLE services(cost_price INTEGER,sale_price INTEGER,provider_service_id TEXT);INSERT INTO services VALUES(999,0,'a'),(1000,0,'b'),(4999,0,'c'),(5000,0,'d'),(999,1234,'');");priceDb.exec(fs.readFileSync(path.join(root,'drizzle/0016_tiered_provider_prices.sql'),'utf8'));assert.deepEqual(priceDb.prepare('SELECT sale_price FROM services').all().map(x=>x.sale_price),[1748,1650,8248,7500,1234]);priceDb.close();
 // Existing rows retain PanelFollows by migration default.
 db.exec("INSERT INTO services(platform,category,name,provider_service_id,min_order,max_order,cost_price,sale_price,description,active,created_at) VALUES('Instagram','Followers','PF original','42',10,10000,100,150,'',1,0),('Instagram','Followers','PF second','99',10,10000,100,150,'',1,0)");
 assert.equal(db.prepare('SELECT provider_id FROM services WHERE id=1').get().provider_id,'panelfollows');
 await provider.forwardOrder({service:'42',link:'https://example.invalid/a',quantity:10,idempotencyKey:'local-1'});assert.equal(calls.at(-1).headers.authorization,'Bearer test-pf');
 await provider.forwardOrder({providerId:'smmxserver',service:'42',link:'https://example.invalid/a',quantity:10,idempotencyKey:'local-2',fields:{key:'attacker',action:'balance',service:'99'}});assert.equal(calls.at(-1).body.get('service'),'42');assert.equal(calls.at(-1).body.get('action'),'add');
 const canceled=await provider.requestProviderOrderAction('cancel','42','smmxserver');assert.equal(canceled.ok,false);assert.equal(canceled.error,'Cannot cancel');
 const sync=await catalog.syncProviderCatalog('smmxserver');assert.equal(sync.added,1);assert.equal(notices,1);
 assert.equal(db.prepare('SELECT name FROM services WHERE id=1').get().name,'PF original');assert.equal(db.prepare('SELECT active FROM services WHERE id=2').get().active,1);
 assert.equal(db.prepare("SELECT cost_price FROM services WHERE provider_id='smmxserver'").get().cost_price,4000);
 const servicesApi=load('app/api/services/route.ts');
 const override=await servicesApi.PUT(new Request('https://example.invalid/api/services',{method:'PUT',body:JSON.stringify({action:'set-price',id:3,salePrice:88})}));assert.equal(override.status,200);
 await catalog.syncProviderCatalog('smmxserver');assert.equal(notices,1);assert.equal(db.prepare('SELECT sale_price FROM services WHERE id=3').get().sale_price,8800);
 const reset=await servicesApi.PUT(new Request('https://example.invalid/api/services',{method:'PUT',body:JSON.stringify({action:'set-price',id:3,automatic:true})}));assert.equal(reset.status,200);assert.equal(db.prepare('SELECT sale_price FROM services WHERE id=3').get().sale_price,6600);
 assert.equal(db.prepare("SELECT COUNT(*) n FROM services WHERE provider_id='smmxserver'").get().n,1);
 services=[{...services[0],service:100}];await catalog.syncProviderCatalog('smmxserver');assert.equal(db.prepare("SELECT active FROM services WHERE provider_id='smmxserver' AND provider_service_id='42'").get().active,0);assert.equal(db.prepare('SELECT active FROM services WHERE id=1').get().active,1);
 const smmx=db.prepare("SELECT id FROM services WHERE provider_id='smmxserver' AND provider_service_id='100'").get().id;
 for(const [id,p,s] of [[1,'panelfollows',1],[2,'smmxserver',smmx]])db.prepare("INSERT INTO orders(id,customer_name,customer_email,service_name,service_id,provider_id,provider_service_id,provider_order_id,link,quantity,amount,status,created_at) VALUES(?,'Test','test@example.invalid','Test',?,?,'42','42','https://example.invalid',10,100,'processing',0)").run(id,s,p);
 const orders=load('app/api/orders/route.ts');const result=await orders.GET();assert.equal(result.status,200);assert.equal(result.data.find(x=>x.id===1).status,'completed');assert.equal(result.data.find(x=>x.id===2).status,'processing');assert.equal(result.data[0].providerId,undefined);
 db.prepare("INSERT INTO customer_balances(email,balance,created_at,updated_at) VALUES('test@example.invalid',100000,0,0)").run();
 const placed=await orders.POST(new Request('https://example.invalid/api/orders',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({serviceId:smmx,link:'https://example.invalid/target',quantity:10,providerId:'panelfollows'})}));assert.equal(placed.status,201);const saved=db.prepare('SELECT provider_id,provider_order_id FROM orders WHERE id=?').get(placed.data.id);assert.equal(saved.provider_id,'smmxserver');assert.equal(saved.provider_order_id,'42');assert.equal(calls.at(-1).url,'https://smmxserver.com/api/v2');
 const telegram=load('lib/telegram-announcements.ts');env.TELEGRAM_BOT_TOKEN='fake-test-token';env.TELEGRAM_CHAT_ID='@test-group';
 const notice={providerServiceId:'42',platform:'Instagram',category:'Followers',name:'A <test>',salePrice:175,priceUnit:'per_1000'};
 await telegram.catalogAnnouncementStatement(notice,'provider-42').run();await telegram.catalogAnnouncementStatement(notice,'smmxserver-42').run();await telegram.catalogAnnouncementStatement(notice,'smmxserver-42').run();
 assert.equal(db.prepare("SELECT COUNT(*) n FROM site_settings WHERE key GLOB 'telegram_catalog_outbox:*'").get().n,2);
 const sent=await telegram.flushCatalogAnnouncements();assert.equal(sent.sent,2);assert.equal(db.prepare("SELECT COUNT(*) n FROM site_settings WHERE key GLOB 'telegram_catalog_outbox:*'").get().n,0);
 delete env.SMMXSERVER_API_KEY;const n=calls.length;const missing=await provider.forwardOrder({providerId:'smmxserver',service:'42',link:'x',quantity:10,idempotencyKey:'missing'});assert.equal(missing.forwarded,false);assert.equal(calls.length,n);assert.equal(provider.providerConfigured(),true);
 assert.throws(()=>load('lib/providers.ts').providerId('unknown'));
 console.log('PASS: persistent manual price overrides/reset, Telegram dispatch/deduplication, markup tiers and persisted price migration; migration defaults, isolated supplier routing, equal-ID order statuses, scoped catalog updates, secret override protection, nested cancel errors and missing-key isolation.');
}
main().catch(e=>{console.error(e);process.exitCode=1}).finally(()=>db.close());
