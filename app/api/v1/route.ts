import { env } from "cloudflare:workers";
import { NextResponse } from "next/server";
import { authenticateApiKey,consumeApiRequest,apiHeaders } from "@/lib/customer-api";
import { digest } from "@/lib/customer-auth";
import { handleCustomerOrder } from "@/app/api/orders/route";
import { GET as catalog } from "@/app/api/services/route";
import { blocked,moduleEnabled } from "@/lib/admin-controls";
const reply=(data:unknown,status=200)=>NextResponse.json(data,{status,headers:apiHeaders});
export async function POST(request:Request) {
 try {
  if(Number(request.headers.get('content-length'))>20000)return reply({error:'Request too large'},413);
  const raw=await request.text();if(raw.length>20000)return reply({error:'Request too large'},413);
  let body:any;try{body=(request.headers.get('content-type')||'').includes('json')?JSON.parse(raw):Object.fromEntries(new URLSearchParams(raw));}catch{return reply({error:'Invalid request'},400);}
  if(!body||typeof body!=='object'||Array.isArray(body))return reply({error:'Invalid request'},400);
  const token=(request.headers.get('authorization')||'').replace(/^Bearer\s+/i,'')||String(body.key||'');
  const user=await authenticateApiKey(token);
  const legacy=!user&&Boolean((env as any).ELTURCO_API_KEY)&&token===(env as any).ELTURCO_API_KEY;
  if(!user&&!(legacy&&body.action==='services'))return reply({error:legacy?'Create an account-scoped API key for order and balance access':'Invalid API key'},401);
  if(user&&!await consumeApiRequest(user.keyId))return reply({error:'Rate limit: 60 requests per minute'},429);
  if(user&&await blocked(request,user.email))return reply({error:'Account unavailable'},403);
  if(body.action==='services') {
   const response=await catalog(new Request(new URL('/api/services',request.url)));if(!response.ok)return reply({error:'Catalog temporarily unavailable'},503);
   const rows:any[]=await response.json();
   return reply(rows.map(s=>({service:s.id,name:s.name,type:s.priceUnit==='per_order'?'Package':'Default',category:s.platform+' · '+s.category,rate:(Number(s.salePrice)/100).toFixed(4),min:s.minOrder,max:s.maxOrder,currency:'TRY',price_unit:s.priceUnit,refill:s.providerFeatures?.refill===true,cancel:s.providerFeatures?.cancel===true,description:s.description,fields:s.providerFields||[]})));
  }
  if(!user)return reply({error:'Invalid API key'},401);
  if(body.action==='balance')return reply({balance:(user.balance/100).toFixed(2),currency:'TRY'});
  if(body.action==='status') {
   const ids=String(body.orders||body.order||'').split(',').map(Number);
   if(ids.length>100||!ids.length||ids.some(id=>!Number.isSafeInteger(id)||id<1))return reply({error:'Invalid order ID'},400);
   const rows=await env.DB!.prepare('SELECT id,amount,status,quantity,created_at FROM orders WHERE customer_email=? AND id IN ('+ids.map(()=>'?').join(',')+')').bind(user.email,...ids).all();
   const found=new Map((rows.results as any[]).map(row=>[Number(row.id),{charge:(row.amount/100).toFixed(2),status:row.status,currency:'TRY',quantity:row.quantity,start_count:null,remains:null,created_at:row.created_at}]));
   if(body.orders)return reply(Object.fromEntries(ids.map(id=>[id,found.get(id)||{error:'Order not found'}])));
   return found.has(ids[0])?reply(found.get(ids[0])):reply({error:'Order not found'},404);
  }
  if(['refill','cancel'].includes(body.action)) {
   const id=Number(body.order);if(!Number.isSafeInteger(id)||id<1)return reply({error:'Invalid order ID'},400);
   return await handleCustomerOrder(request,user,{action:body.action,id});
  }
  if(body.action!=='add')return reply({error:'Unsupported action. Use services, balance, add, status, refill or cancel.'},400);
  if(!await moduleEnabled('api'))return reply({error:'API ordering unavailable'},403);
  const quantity=Number(body.quantity),serviceId=Number(body.service),link=String(body.link||'').trim();
  if(!Number.isSafeInteger(quantity)||quantity<1||!Number.isSafeInteger(serviceId)||serviceId<1)return reply({error:'Invalid service or quantity'},400);
  try{const url=new URL(link);if(!['https:','http:'].includes(url.protocol)||link.length>2000)throw Error();}catch{return reply({error:'Invalid target URL'},400);}
  const requestKey=request.headers.get('idempotency-key')||String(body.idempotency_key||'');
  if(!/^[a-zA-Z0-9._:-]{8,128}$/.test(requestKey))return reply({error:'Idempotency-Key (8–128 letters, digits, . _ : -) is required for add'},400);
  const fields=typeof body.fields==='object'&&body.fields?body.fields:Object.fromEntries(Object.entries(body).filter(([name])=>!['key','action','service','link','quantity','idempotency_key'].includes(name)));
  const payload={serviceId,quantity,link,fields},bodyHash=await digest(JSON.stringify(payload));
  const claim=await env.DB!.prepare('INSERT OR IGNORE INTO customer_api_requests(user_id,request_key,body_hash,created_at) VALUES(?,?,?,?)').bind(user.id,requestKey,bodyHash,Math.floor(Date.now()/1000)).run();
  if(!claim.meta.changes){
   const previous:any=await env.DB!.prepare('SELECT * FROM customer_api_requests WHERE user_id=? AND request_key=?').bind(user.id,requestKey).first();
   if(previous.body_hash!==bodyHash)return reply({error:'Idempotency key already used with different parameters'},409);
   if(previous.state!=='finished')return reply({error:'Request processing or outcome unknown. Check your order history before retrying.'},409);
   return reply(JSON.parse(previous.response),previous.status_code);
  }
  const response=await handleCustomerOrder(request,user,payload),result:any=await response.json();
  if(response.ok&&result.id)await env.DB!.prepare("UPDATE orders SET source='api' WHERE id=? AND customer_email=?").bind(result.id,user.email).run();
  const data=response.ok?{order:result.id,status:result.status,charge:(Number(result.amount)/100).toFixed(2),currency:'TRY'}:result;
  await env.DB!.prepare("UPDATE customer_api_requests SET state='finished',response=?,status_code=? WHERE user_id=? AND request_key=?").bind(JSON.stringify(data),response.status,user.id,requestKey).run();
  return reply(data,response.status);
 }catch{return reply({error:'API request could not be completed. Check order history before retrying an uncertain add request.'},503);}
}
