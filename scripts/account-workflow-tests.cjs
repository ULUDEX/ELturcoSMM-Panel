const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),ts=require('typescript');
const {DatabaseSync}=require('node:sqlite');
const db=new DatabaseSync(':memory:'),env={PRIVATE_PREVIEW:'1'};
for(const file of fs.readdirSync('drizzle').filter(x=>x.endsWith('.sql')).sort())db.exec(fs.readFileSync(path.join('drizzle',file),'utf8'));
env.DB={prepare(sql){let args=[];return{bind(...v){args=v;return this},async all(){return{results:db.prepare(sql).all(...args)}},async first(){return db.prepare(sql).get(...args)||null},async run(){const statement=db.prepare(sql);if(statement.columns().length)return{results:statement.all(...args),meta:{changes:1}};return{results:[],meta:{changes:Number(statement.run(...args).changes)}}}}},async batch(statements){db.exec('BEGIN');try{const rows=[];for(const s of statements)rows.push(await s.run());db.exec('COMMIT');return rows}catch(e){db.exec('ROLLBACK');throw e}}};
let cookie='',emails=0;const modules={};
function load(file){if(modules[file])return modules[file];const js=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,module={exports:{}};
 const req=name=>name==='@/lib/catalog-snapshot'?{privateCatalogSnapshot:async()=>null}:name==='cloudflare:workers'?{env}:name==='next/headers'?{cookies:async()=>({get:()=>cookie?{value:cookie}:undefined})}:name==='next/server'?{NextResponse:{json:(data,options)=>{const r={data,status:options?.status||200,headers:options?.headers,cookies:{set:(name,value,flags)=>{r.cookie={name,value,flags}}}};return r}}}:name==='@/lib/mailer'?{siteBaseUrl:()=> 'https://preview.test',sendTransactionalEmail:async()=>{emails++;return{sent:false}}}:name==='@/lib/admin-auth'?{isAdmin:async()=>false}:name.startsWith('@/')?load(name.slice(2)+'.ts'):name.startsWith('./')?load(path.join(path.dirname(file),name)+'.ts'):require(name);
 new Function('require','module','exports',js)(req,module,module.exports);modules[file]=module.exports;return module.exports;
}
const request=(route,body={},headers={})=>new Request('https://preview.test'+route,{method:'POST',headers:{'content-type':'application/json',...headers},body:JSON.stringify(body)});
async function challenge(){const r=await load('app/api/account/challenge/route.ts').POST();assert.equal(r.status,200);const [a,b]=r.data.question.match(/\d+/g).map(Number);return{challengeId:r.data.id,challengeAnswer:String(a+b)}}
async function main(){
 const register=load('app/api/account/register/route.ts').POST,login=load('app/api/account/login/route.ts').POST;
 const account=load('app/api/account/route.ts').GET,profile=load('app/api/account/profile/route.ts').POST;
 assert.equal((await profile(request('/api/account/profile',{name:'No session'}))).status,401);
 assert.equal((await load('app/api/account/preview/route.ts').POST(request('/api/account/preview'))).status,403);
 const form={name:'Test User',email:'qa@example.invalid',password:'Working-Account-9284',avatar:'woman-6'};
 const made=await register(request('/api/account/register',{...form,...await challenge()},{'oai-authenticated-user-id':'isolated-owner'}));
 assert.equal(made.status,200);assert.ok(made.data.previewVerificationUrl);assert.equal(emails,0);
 assert.equal((await account()).data.loggedIn,false,'registration does not skip verification');
 const before=await login(request('/api/account/login',{...form,...await challenge()}));assert.equal(before.status,403);
 const token=made.data.previewVerificationUrl.split('=')[1],verify=load('app/api/account/verify-email/route.ts').POST;
 assert.equal((await verify(request('/api/account/verify-email',{token}))).status,200);
 assert.equal((await verify(request('/api/account/verify-email',{token}))).status,400,'verification tokens are single use');
 const logged=await login(request('/api/account/login',{...form,...await challenge()}));assert.equal(logged.status,200);assert.equal(logged.cookie.flags.httpOnly,true);assert.equal(logged.cookie.flags.secure,true);cookie=logged.cookie.value;
 assert.equal((await account()).data.user.avatar,'woman-6');
 assert.equal((await profile(request('/api/account/profile',{name:'Updated Name',avatar:'man-4'}))).status,200);
 assert.equal((await profile(request('/api/account/profile',{name:'x'}))).status,400);
 assert.equal((await profile(request('/api/account/profile',{avatar:'../../bad'}))).status,400);
 const refreshed=await account();assert.equal(refreshed.data.user.name,'Updated Name');assert.equal(refreshed.data.user.avatar,'man-4');
 const rewards=load('app/api/account/rewards/route.ts');assert.equal((await rewards.GET()).data.availablePoints,0);assert.equal((await rewards.POST()).status,400);
 db.prepare("INSERT INTO customer_reward_events(customer_email,event_type,spend_amount,points,created_at) VALUES(?,'earn',10000,120,1)").run(form.email);
 assert.equal((await rewards.POST()).data.credited,120);assert.equal((await rewards.POST()).status,400);assert.equal(db.prepare('SELECT balance FROM customer_balances WHERE email=?').get(form.email).balance,120,'redemption credits exactly once');
 const orders=load('app/api/orders/route.ts');assert.equal((await orders.GET()).data.length,0);
 assert.equal((await orders.POST(request('/api/orders',{serviceId:1,quantity:100,link:'https://example.invalid'}))).status,409,'preview cannot dispatch paid orders');
 assert.equal((await load('app/api/payment-request/route.ts').POST(request('/api/payment-request',{amount:100}))).status,409);
 db.prepare("INSERT INTO customer_notifications(customer_email,kind,title,body,translations,created_at) VALUES(?,'announcement','Private news','Owner only','{}',1)").run(form.email);
 const notifications=load('app/api/account/notifications/route.ts');assert.equal((await notifications.GET(new Request('https://preview.test/api/account/notifications'))).data.notifications.length,1);
 const catalog=load('app/api/services/route.ts');assert.deepEqual((await catalog.GET(new Request('https://preview.test/api/services'))).data,[]);
 db.prepare("INSERT INTO services(platform,category,name,provider_service_id,min_order,max_order,sale_price,active,created_at) VALUES('Instagram','Test','Fixture only','42',10,1000,1234,1,0)").run();
 const listed=await catalog.GET(new Request('https://preview.test/api/services'));assert.equal(listed.status,200);assert.equal(listed.data[0].salePrice,1234,'nonempty catalog has no ReferenceError');
 for(const locale of ['tr','en','de','fr','it','es','pt-BR','ru','uk']){const texts=load('lib/storefront-translations.ts').storefrontTranslations(locale);assert.equal(Object.keys(texts).length,52);if(locale!=='tr')assert.notEqual(texts['Profili kaydet'],'Profili kaydet');}
 cookie='';assert.equal((await orders.GET()).status,401);assert.equal((await account()).data.loggedIn,false);
 env.PRIVATE_PREVIEW='';assert.equal((await load('app/api/account/preview/route.ts').POST(request('/api/account/preview',{}, {'oai-authenticated-user-id':'isolated-owner'}))).status,403,'preview auth is unavailable on production');
 console.log('PASS: real SQL/crypto registration → verification → login → persisted profile/avatar, private-preview boundary, cookie flags, single-use tokens, rewards exactly once, account ownership, empty/nonempty catalog and nine bundled locales. No external delivery or production writes.');
}
main().catch(e=>{console.error(e);process.exitCode=1}).finally(()=>db.close());
