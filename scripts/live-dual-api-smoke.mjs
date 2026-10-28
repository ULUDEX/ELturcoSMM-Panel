import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const base='https://elturcosmm.com';
async function get(path,init={}){const response=await fetch(base+path,{...init,headers:{'accept-encoding':'identity','cache-control':'no-cache',...init.headers},signal:AbortSignal.timeout(30000)});return {response,text:await response.text()}}
let result=await get('/api/v3');assert.equal(result.response.status,200);const discovery=JSON.parse(result.text);assert.equal(discovery.object,'api');assert.equal(discovery.currency,'TRY');assert.ok(discovery.endpoints.some(e=>e.path==='/api/v3/orders/preview'));
result=await get('/api/v3/openapi.json');assert.equal(result.response.status,200);const spec=JSON.parse(result.text);assert.equal(spec.openapi,'3.1.0');assert.ok(spec.paths['/webhooks/{id}/rotate_secret']);
result=await get('/api/v2',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:'key=invalid-live-smoke-key&action=balance'});assert.equal(result.response.status,200);assert.equal(typeof JSON.parse(result.text).error,'string');
result=await get('/api/v2/tr',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:'key=invalid-live-smoke-key&action=balance'});assert.equal(result.response.status,200);assert.equal(typeof JSON.parse(result.text).error,'string');
for(const path of ['/api/v3/account','/api/v3/webhooks','/api/v3/events']){result=await get(path);assert.equal(result.response.status,401);const body=JSON.parse(result.text);assert.equal(body.error.code,'missing_api_key');assert.equal(result.response.headers.get('x-request-id'),body.error.request_id)}
result=await get('/api/account/webhooks');assert.equal(result.response.status,401);
for(const path of ['/site/api-center.js','/site/api-center.css','/site/workspace-upgrade.js','/api-docs/index.html']){result=await get(path.replace('/index.html','/')+'?release='+process.env.GITHUB_SHA);assert.equal(result.response.status,200);const hash=x=>createHash('sha256').update(x).digest('hex');assert.equal(hash(result.text),hash(readFileSync('public'+path)),path)}
console.log('PASS: published v2/TR legacy error contract, v3 discovery and OpenAPI 3.1, own-account guards, public docs and exact deployed API interface hashes. No valid credentials, supplier calls, orders or payments used.');
