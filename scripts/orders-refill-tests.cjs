const fs=require('fs'),vm=require('vm'),ts=require('typescript'),assert=require('node:assert/strict'),{DatabaseSync}=require('node:sqlite');
const compile=file=>ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const helpers={exports:{}};vm.runInNewContext(compile('lib/order-actions.ts'),{module:helpers,exports:helpers.exports});
async function apiTests(){
 const db=new DatabaseSync(':memory:');db.exec(`CREATE TABLE services(id INTEGER PRIMARY KEY,provider_features TEXT,price_unit TEXT);CREATE TABLE orders(id INTEGER PRIMARY KEY,service_id INTEGER,customer_email TEXT,service_name TEXT,link TEXT,quantity INTEGER,amount INTEGER,status TEXT,provider_id TEXT,provider_order_id TEXT,provider_service_id TEXT,provider_refill_id TEXT DEFAULT '',provider_action TEXT DEFAULT '',provider_synced_at INTEGER DEFAULT 0,created_at INTEGER,provider_error TEXT DEFAULT '');INSERT INTO services VALUES(1,'{"refill":true,"cancel":true}','per_1000');INSERT INTO orders(id,service_id,customer_email,service_name,link,quantity,amount,status,provider_id,provider_order_id,provider_service_id,created_at) VALUES(1,1,'owner@test.invalid','Service','https://example.test',100,123,'completed','panelfollows','99','1',1);`);
 let customer={email:'owner@test.invalid'},calls=0,release,reply={ok:true,refillId:'8'},refillStatus='pending';
 const env={DB:{prepare(sql){return{bind(...values){return{
  first:async()=>db.prepare(sql).get(...values),
  all:async()=>({results:db.prepare(sql).all(...values)}),
  run:async()=>({meta:{changes:Number(db.prepare(sql).run(...values).changes)}})
 }}}}}};
 const provider={requestProviderOrderAction:async()=>{calls++;if(release===null)await new Promise(resolve=>release=resolve);return reply},getProviderRefillStatus:async()=>({ok:true,status:refillStatus}),getProviderStatuses:async()=>({})};
 const module={exports:{}};vm.runInNewContext(compile('app/api/orders/route.ts'),{exports:module.exports,module,Date,Response,require:name=>name==='cloudflare:workers'?{env}:name==='next/server'?{NextResponse:{json:(data,init)=>Response.json(data,init)}}:name==='@/lib/order-actions'?helpers.exports:name==='@/lib/providers'?{PROVIDER_IDS:['panelfollows'],providerId:x=>x}:name==='@/lib/customer-auth'?{currentCustomer:async()=>customer}:name==='@/lib/provider'?provider:name==='@/lib/rewards'?{awardCompletedOrder:async()=>{}}:name==='@/lib/customer-notifications'?{addCustomerNotification:async()=>{}}:{}});
 const {POST,GET}=module.exports,req=()=>({json:async()=>({id:1,action:'refill'})});
 customer=null;assert.equal((await POST(req())).status,401);customer={email:'stranger@test.invalid'};assert.equal((await POST(req())).status,404);assert.equal(calls,0);customer={email:'owner@test.invalid'};
 db.prepare('UPDATE services SET provider_features=?').run('{"refill":"false"}');assert.equal((await POST(req())).status,409);assert.equal(calls,0);
 db.prepare('UPDATE services SET provider_features=?').run('{"refill":"true"}');let rows=await(await GET()).json();assert.equal(rows[0].canRefill,true,'GET and POST must read aliased providerFeatures consistently');
 release=null;const first=POST(req());for(let i=0;i<30&&release===null;i++)await Promise.resolve();assert.equal(typeof release,'function');assert.equal((await POST(req())).status,409);assert.equal(calls,1);release();assert.equal((await first).status,200);
 rows=await(await GET()).json();assert.equal(rows[0].canRefill,false);assert.equal(rows[0].providerAction,'refill_requested');
 refillStatus='Completed';rows=await(await GET()).json();assert.equal(rows[0].providerAction,'refill_completed');assert.equal(rows[0].canRefill,false);assert.equal((await POST(req())).status,409);
 db.exec("UPDATE orders SET provider_action='',provider_refill_id='' WHERE id=1");reply={ok:false,uncertain:true,error:'network'};release=undefined;
 assert.equal((await POST(req())).status,409);assert.equal(db.prepare('SELECT provider_action AS state FROM orders').get().state,'refill_uncertain');const count=calls;assert.equal((await POST(req())).status,409);assert.equal(calls,count,'uncertain request is never automatically resent');
 db.exec("UPDATE orders SET provider_action='' WHERE id=1");reply={ok:false,uncertain:false,error:'Rejected'};assert.equal((await POST(req())).status,502);assert.equal(db.prepare('SELECT provider_action AS state FROM orders').get().state,'refill_failed');db.close();
}
function markupTests(){
 const app=fs.readFileSync('public/site/app-20260927.js','utf8'),start=app.indexOf('function orderStatusInfo'),info=app.slice(start,app.indexOf('\n',start));
 const context={currentLanguage:'tr',escapeHtml:value=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;'),money:value=>'₺'+value.toFixed(2)};
 vm.createContext(context);vm.runInContext(info+'\n'+fs.readFileSync('public/site/orders-table.js','utf8'),context);
 const html=vm.runInContext('orderTableMarkup([{id:1,service:"<script>bad</script>",link:"https://example.test",quantity:1000,amount:1234,status:"completed",createdAt:1,canRefill:true}])',context);
 assert.match(html,/<table/);assert.match(html,/₺12.34/);assert.match(html,/data-order-action="refill"/);assert.doesNotMatch(html,/<script>/);assert.doesNotMatch(html,/order-track/);
 const disabled=vm.runInContext('orderRefillControl({id:2,refillSupported:false,refillUnavailableReason:"Telafi yok"})',context);assert.doesNotMatch(disabled,/data-order-action/);
}
apiTests().then(()=>{markupTests();console.log('PASS: compact table, safe markup, owner checks, strict refill flags, GET/POST eligibility, duplicate lock and uncertain outcomes.');}).catch(error=>{console.error(error);process.exit(1)});
