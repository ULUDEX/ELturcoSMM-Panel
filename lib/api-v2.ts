import { env } from "cloudflare:workers";
import { GET as catalog } from "@/app/api/services/route";
import { handleApiAction,apiOrderReplay,orderInputHash } from "./customer-api-actions";
import { apiUser,readApiBody,positiveId,ApiFault,API_ERRORS,lang,statusLabel,money,fromSharedError } from "./api-contract";
import { oneOrder,syncApiOrders,previewOrder,refillObject } from "./api-resources";

export async function legacyApi(request:Request){
 const tr=new URL(request.url).pathname.replace(/\/$/,'').endsWith('/tr');
 const error=(code:string)=>({error:(API_ERRORS[code]||API_ERRORS.internal_error)[tr?1:2]});
 const response=(data:unknown,http=200)=>new Response(JSON.stringify(data),{status:http,headers:{'content-type':'application/json; charset=utf-8','cache-control':'private, no-store',...(http===429?{'retry-after':'60'}:{})}});
 try{
  if(!['GET','POST'].includes(request.method))throw new ApiFault('method_not_allowed');
  const body=request.method==='GET'?Object.fromEntries(new URL(request.url).searchParams):await readApiBody(request),user=await apiUser(request,String(body.key||''));
  const localized=new Request(new URL('/api/v3?lang='+(tr?'tr':'en'),request.url),{headers:request.headers});
  const ids=(value:unknown)=>{const values=String(value||'').split(',');if(values.length>100)throw new ApiFault('batch_too_large');return values.map(x=>positiveId(x))};
  if(body.action==='services'){const result=await catalog(new Request(new URL('/api/services',request.url)));if(!result.ok)throw new ApiFault('service_temporarily_unavailable');const rows:any[]=await result.json();return response(rows.map(s=>({service:s.id,name:s.name,type:s.priceUnit==='per_order'?'Package':(s.providerFields||[]).some((f:any)=>f.name==='comments')?'Custom Comments':'Default',category:s.platform+' · '+s.category,rate:money(s.salePrice),min:s.minOrder,max:s.maxOrder,refill:s.providerFeatures?.refill===true,cancel:s.providerFeatures?.cancel===true,dripfeed:false})))}
  if(body.action==='balance')return response({balance:money(user.balance),currency:'TRY'});
  if(body.action==='status'){const values=ids(body.orders||body.order);await syncApiOrders(user.email,values);const statusOf=async(id:number)=>{try{const order=await oneOrder(id,user,localized,false);return {charge:order.charge,start_count:order.start_count,status:order.status_label,remains:order.remains,currency:'TRY'}}catch{return error('order_not_found')}};if(body.orders){const rows=[];for(const id of values)rows.push([id,await statusOf(id)]);return response(Object.fromEntries(rows))}return response(await statusOf(values[0]))}
  if(body.action==='refill_status'){const values=ids(body.refills||body.refill),statusOf=async(id:number)=>{try{const r=await refillObject(id,user);return {status:statusLabel(r.status,'en')}}catch{return error('refill_not_found')}};if(body.refills){const rows=[];for(const id of values)rows.push({refill:id,...await statusOf(id)});return response(rows)}return response(await statusOf(values[0]))}
  if(body.action==='add'){
   const key=request.headers.get('idempotency-key')||body.idempotency_key||'legacy_'+crypto.randomUUID(),hash=await orderInputHash(body),replay=await apiOrderReplay(user,key,hash);
   if(replay){const data:any=await replay.json();return response(replay.ok?{order:data.order}:error(fromSharedError(data,replay.status)))}
   const preview=await previewOrder(body,user,localized);
   const operation=new Request(request.url,{method:'POST',headers:{'idempotency-key':key}}),result=await handleApiAction(operation,{action:'add',service:preview.service,quantity:preview.quantity,link:preview.link,fields:preview.fields},user,hash),data:any=await result.json();
   return response(result.ok?{order:data.order}:error(fromSharedError(data,result.status)));
  }
  if(['cancel','refill'].includes(body.action)){
   const values=ids(body.orders||body.order),results=[];
   for(const id of values){const result=await handleApiAction(request,{action:body.action,order:id},user),data:any=await result.json();if(!result.ok){results.push({order:id,...error(fromSharedError(data,result.status))});continue}if(body.action==='refill'){await env.DB.prepare('INSERT OR IGNORE INTO customer_api_refills(order_id,user_id,status,created_at,updated_at) VALUES(?,?,\'pending\',?,?)').bind(id,user.id,Math.floor(Date.now()/1000),Math.floor(Date.now()/1000)).run();const row:any=await env.DB.prepare('SELECT id FROM customer_api_refills WHERE order_id=? AND user_id=?').bind(id,user.id).first();results.push({order:id,refill:row.id})}else results.push({order:id,cancel:1})}
   if(body.action==='refill'&&!body.orders){const first:any=results[0];return response(first.error?{error:first.error}:{refill:first.refill})}return response(results);
  }
  throw new ApiFault('invalid_parameter','action');
 }catch(errorValue){const code=errorValue instanceof ApiFault?errorValue.code:'internal_error';return response(error(code),code==='rate_limit_exceeded'?429:200)}
}
