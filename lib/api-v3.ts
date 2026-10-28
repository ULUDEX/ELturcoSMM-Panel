import { env } from "cloudflare:workers";
import { handleApiAction,apiOrderReplay,orderInputHash } from "./customer-api-actions";
import { apiUser,apiResponse,errorResponse,errorObject,ApiFault,fault,readApiBody,positiveId,cents,money,fromSharedError,API_VERSION,API_ERRORS,type ApiUser } from "./api-contract";
import { serviceList,oneService,catalogGroups,oneOrder,orderList,previewOrder,refillList,refillObject,parse } from "./api-resources";
import { eventList,webhookList,webhookCreate,webhookAction,API_EVENT_TYPES } from "./api-webhooks";
import { openApiDocument } from "./api-openapi";

export const API_ENDPOINTS=[['GET','/account'],['PATCH','/account'],['GET','/services'],['GET','/services/top'],['GET','/services/{id}'],['GET','/categories'],['GET','/platforms'],['POST','/orders'],['POST','/orders/preview'],['POST','/orders/batch'],['GET','/orders'],['GET','/orders/{id}'],['POST','/orders/{id}/cancel'],['POST','/orders/{id}/refill'],['GET','/refills'],['GET','/refills/{id}'],['GET','/events'],['GET','/webhooks'],['POST','/webhooks'],['GET','/webhooks/{id}'],['PATCH','/webhooks/{id}'],['DELETE','/webhooks/{id}'],['POST','/webhooks/{id}/test'],['POST','/webhooks/{id}/rotate_secret'],['GET','/webhooks/{id}/deliveries']];
async function createOrder(body:any,user:ApiUser,request:Request){
 const key=request.headers.get('idempotency-key');if(!key)fault('missing_parameter','Idempotency-Key');if(!/^[a-zA-Z0-9._:-]{8,128}$/.test(key))fault('invalid_parameter','Idempotency-Key');
 if(!body||typeof body!=='object'||Array.isArray(body))fault('invalid_parameter','order');
 const hash=await orderInputHash(body),replay=await apiOrderReplay(user,key,hash);
 if(replay){const data:any=await replay.json();if(!replay.ok)fault(fromSharedError(data,replay.status));const resource=data.api_v3||await oneOrder(data.order,user,request,false);return apiResponse(resource,201,request,{'idempotent-replay':'true'})}
 const preview=await previewOrder(body,user,request),result=await handleApiAction(request,{action:'add',service:preview.service,quantity:preview.quantity,link:preview.link,fields:preview.fields},user,hash),data:any=await result.json();
 if(!result.ok)fault(fromSharedError(data,result.status));
 const resource=await oneOrder(data.order,user,request,false);
 await env.DB.prepare("UPDATE customer_api_requests SET response=json_set(response,'$.api_v3',json(?)) WHERE user_id=? AND request_key=? AND state='finished'").bind(JSON.stringify(resource),user.id,key).run();
 return apiResponse(resource,201,request,result.headers.get('idempotent-replay')?{'idempotent-replay':'true'}:{});
}
export async function modernApi(request:Request){
 try{
  const path=new URL(request.url).pathname.replace(/^\/api\/v3\/?/,'').replace(/\/$/,''),method=request.method;
  if(path==='openapi.json'&&method==='GET')return apiResponse(openApiDocument(new URL(request.url).origin),200,request);
  if(path===''&&method==='GET')return apiResponse({object:'api',version:API_VERSION,currency:'TRY',legacy:'/api/v2',base:'/api/v3',openapi:'/api/v3/openapi.json',documentation:'/api-docs',limits:{requests_per_minute:60,max_page_size:500,max_batch_size:50,max_webhooks:5},languages:['tr','en','es','fr','uk','it','ru','de','pt-BR'],translation_policy:'Cached service translations; source text retained when unavailable. Error/status labels: tr/en.',events:API_EVENT_TYPES,errors:Object.entries(API_ERRORS).map(([code,[status,tr]])=>({code,status,message:tr})),endpoints:API_ENDPOINTS.map(([method,path])=>({method,path:'/api/v3'+path}))},200,request);
  if(method==='OPTIONS')return new Response(null,{status:204,headers:{allow:'GET, POST, PATCH, DELETE, OPTIONS'}});
  const pattern='/'+path.replace(/\d+/g,'{id}'),known=API_ENDPOINTS.filter(([,p])=>p===pattern);if(!known.length)fault('unknown_endpoint');if(!known.some(([m])=>m===method))fault('method_not_allowed');
  const user=await apiUser(request),emptyAction=method==='POST'&&/^(orders\/\d+\/(cancel|refill)|webhooks\/\d+\/(test|rotate_secret))$/.test(path)&&!request.headers.get('content-type')&&!Number(request.headers.get('content-length'));
  const body=['POST','PATCH'].includes(method)&&!emptyAction?await readApiBody(request):{};
  if(path==='account'){
   if(method==='PATCH'){if(!Object.hasOwn(body,'low_balance_threshold'))fault('missing_parameter','low_balance_threshold');const value=body.low_balance_threshold===null?null:cents(body.low_balance_threshold);await env.DB.prepare('INSERT INTO customer_api_preferences(user_id,low_balance_threshold) VALUES(?,?) ON CONFLICT(user_id) DO UPDATE SET low_balance_threshold=excluded.low_balance_threshold').bind(user.id,value).run()}
   const preferences:any=await env.DB.prepare('SELECT low_balance_threshold FROM customer_api_preferences WHERE user_id=?').bind(user.id).first();return apiResponse({object:'account',id:user.id,balance:money(user.balance),currency:'TRY',low_balance_threshold:preferences?.low_balance_threshold===null||preferences?.low_balance_threshold===undefined?null:money(preferences.low_balance_threshold),rate_limit:{limit:60,window_seconds:60}},200,request);
  }
  if(path==='services'||path==='services/top')return apiResponse(await serviceList(request,path.endsWith('/top')),200,request);
  if(/^services\/\d+$/.test(path))return apiResponse(await oneService(positiveId(path.split('/')[1]),request),200,request);
  if(path==='categories'||path==='platforms')return apiResponse(await catalogGroups(path),200,request);
  if(path==='orders/preview')return apiResponse(await previewOrder(body,user,request),200,request);
  if(path==='orders/batch'){
   if(!Array.isArray(body.orders)||body.orders.length<1)fault('missing_parameter','orders');if(body.orders.length>50)fault('batch_too_large','orders');const key=request.headers.get('idempotency-key');if(!key||!/^[a-zA-Z0-9._:-]{8,110}$/.test(key))fault('invalid_parameter','Idempotency-Key');const results=[];
   for(let index=0;index<body.orders.length;index++){try{const headers=new Headers(request.headers);headers.set('idempotency-key',key+'.'+index);const response=await createOrder(body.orders[index],user,new Request(request.url,{method:'POST',headers}));results.push({index,order:await response.json()})}catch(error){results.push({index,...errorObject(error instanceof ApiFault?error.code:'internal_error',request,error instanceof ApiFault?error.param:null)})}}
   return apiResponse({object:'batch',data:results},200,request);
  }
  if(path==='orders')return method==='GET'?apiResponse(await orderList(user,request),200,request):await createOrder(body,user,request);
  if(/^orders\/\d+$/.test(path))return apiResponse(await oneOrder(positiveId(path.split('/')[1]),user,request),200,request);
  if(/^orders\/\d+\/(cancel|refill)$/.test(path)){
   const [,id,action]=path.split('/'),order=await oneOrder(positiveId(id),user,request,false),service=await oneService(order.service,request,false);
   if(!service.features[action])fault(action==='cancel'?'cancel_not_supported':'refill_not_supported');if(action==='refill'&&order.status!=='completed')fault('order_not_completed');if(action==='cancel'&&!['pending','in_progress'].includes(order.status))fault('order_not_cancelable');
   const result=await handleApiAction(request,{action,order:Number(id)},user),data:any=await result.json();if(!result.ok)fault(fromSharedError(data,result.status));
   if(action==='refill'){const at=Math.floor(Date.now()/1000);await env.DB.prepare("INSERT OR IGNORE INTO customer_api_refills(order_id,user_id,status,created_at,updated_at) VALUES(?,?,'pending',?,?)").bind(Number(id),user.id,at,at).run();const refill:any=await env.DB.prepare('SELECT id FROM customer_api_refills WHERE order_id=? AND user_id=?').bind(Number(id),user.id).first();return apiResponse(await refillObject(refill.id,user,false),201,request)}
   return apiResponse({object:'cancellation',order:Number(id),status:'requested'},202,request);
  }
  if(path==='refills')return apiResponse(await refillList(user,request),200,request);
  if(/^refills\/\d+$/.test(path))return apiResponse(await refillObject(positiveId(path.split('/')[1]),user),200,request);
  if(path==='events')return apiResponse(await eventList(user,request),200,request);
  if(path==='webhooks')return method==='GET'?apiResponse(await webhookList(user),200,request):apiResponse(await webhookCreate(user,body),201,request);
  if(/^webhooks\/\d+(\/(test|rotate_secret|deliveries))?$/.test(path)){const [,id,action]=path.split('/');return apiResponse(await webhookAction(positiveId(id),user,request,body,action),action==='test'?202:200,request)}
  fault('unknown_endpoint');
 }catch(error){return errorResponse(error,request)}
}
