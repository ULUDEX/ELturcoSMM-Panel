import { env } from "cloudflare:workers";
import { NextResponse } from "next/server";
import { currentCustomer } from "@/lib/customer-auth";
import { forwardOrder, getProviderRefillStatus, getProviderStatuses, previewProviderOrder, providerConfigured, requestProviderOrderAction } from "@/lib/provider";

const now=()=>Math.floor(Date.now()/1000);
function mapStatus(input:unknown){const value=String(input||"").trim().toLocaleLowerCase("tr-TR");if(/partial|kısmi/.test(value))return"partial";if(/cancel|canceled|cancelled|iptal|refunded|iade/.test(value))return"canceled";if(/complete|completed|tamamlandı|bitti/.test(value))return"completed";if(/progress|processing|işleniyor|başladı/.test(value))return"processing";if(/fail|error|rejected|başarısız/.test(value))return"failed";return"pending"}
function features(row:any){try{return JSON.parse(row.provider_features||"{}")}catch{return{}}}
function safeFields(value:unknown){if(!value||typeof value!=="object"||Array.isArray(value))return{};const out:Record<string,string>={};for(const [key,raw] of Object.entries(value as Record<string,unknown>)){if(!/^[a-z][a-z0-9_]{0,39}$/i.test(key)||["service","link","quantity","id"].includes(key))continue;if(typeof raw==="string"||typeof raw==="number")out[key]=String(raw).slice(0,5000)}return out}
async function customerOrders(email:string){
 const result:any=await env.DB.prepare("SELECT o.id,o.service_name service,o.link,o.quantity,o.amount,o.status,o.provider_order_id providerOrderId,o.provider_service_id providerServiceId,o.provider_refill_id providerRefillId,o.provider_action providerAction,o.provider_synced_at providerSyncedAt,o.created_at createdAt,s.provider_features providerFeatures,s.price_unit priceUnit FROM orders o LEFT JOIN services s ON s.id=o.service_id WHERE o.customer_email=? ORDER BY o.id DESC LIMIT 50").bind(email).all();
 const rows=result.results as any[],at=now(),statusIds=rows.filter(row=>row.providerOrderId&&at-Number(row.providerSyncedAt||0)>30&&!["completed","canceled","failed"].includes(mapStatus(row.status))).map(row=>String(row.providerOrderId));
 if(statusIds.length){const statuses=await getProviderStatuses(statusIds),updates=[] as any[];for(const row of rows){const external=(statuses as any)[String(row.providerOrderId)];if(!external)continue;const next=mapStatus(external.status??external);if(next!==mapStatus(row.status)||at-Number(row.providerSyncedAt||0)>30)updates.push(env.DB.prepare("UPDATE orders SET status=?,provider_synced_at=?,provider_error=? WHERE id=? AND customer_email=?").bind(next,at,"",row.id,email));row.status=next;row.providerSyncedAt=at}if(updates.length)await env.DB.batch(updates)}
 for(const row of rows){if(row.providerRefillId&&row.providerAction==="refill_requested"){const refill=await getProviderRefillStatus(String(row.providerRefillId));if(refill.ok){row.refillStatus=refill.status;const normalized=String(refill.status).toLowerCase();if(/complete|success|done/.test(normalized))row.providerAction="refill_completed";if(/fail|reject|error/.test(normalized))row.providerAction="refill_failed";if(row.providerAction!=="refill_requested")await env.DB.prepare("UPDATE orders SET provider_action=? WHERE id=? AND customer_email=?").bind(row.providerAction,row.id,email).run()}}
  row.features=features({provider_features:row.providerFeatures});delete row.providerFeatures;
  row.canRefill=Boolean(row.features.refill)&&mapStatus(row.status)==="completed"&&!["refill_requested"].includes(row.providerAction);
  row.canCancel=Boolean(row.features.cancel)&&["pending","processing"].includes(mapStatus(row.status))&&!row.providerAction.includes("cancel");
  delete row.providerOrderId;delete row.providerServiceId;delete row.providerRefillId;delete row.providerSyncedAt;delete row.features;
 }
 return rows;
}
export async function GET(){const customer=await currentCustomer();if(!customer)return NextResponse.json({error:"Siparişleri görmek için giriş yapmalısın.",loginRequired:true},{status:401});try{return NextResponse.json(await customerOrders(customer.email),{headers:{"cache-control":"no-store"}})}catch{return NextResponse.json({error:"Siparişlerin şu anda alınamıyor. Birazdan tekrar dene."},{status:503})}}
export async function POST(request:Request){
 const customer=await currentCustomer();if(!customer)return NextResponse.json({error:"Sipariş vermek için giriş yapmalısın.",loginRequired:true},{status:401});
 let body:any;try{body=await request.json()}catch{return NextResponse.json({error:"İstek bilgileri okunamadı."},{status:400})}
 if(body.action==="refill"||body.action==="cancel"){
  const id=Math.floor(Number(body.id));if(!id)return NextResponse.json({error:"Sipariş bulunamadı."},{status:400});
  const order:any=await env.DB.prepare("SELECT o.id,o.provider_order_id providerOrderId,o.provider_action providerAction,o.status,s.provider_features providerFeatures FROM orders o LEFT JOIN services s ON s.id=o.service_id WHERE o.id=? AND o.customer_email=?").bind(id,customer.email).first();
  if(!order)return NextResponse.json({error:"Sipariş bulunamadı."},{status:404});if(!order.providerOrderId)return NextResponse.json({error:"Bu sipariş sağlayıcıya henüz iletilmemiş."},{status:409});
  const supported=features(order),status=mapStatus(order.status),action=body.action as "refill"|"cancel";
  if(action==="refill"&&(!supported.refill||status!=="completed"))return NextResponse.json({error:"Telafi yalnızca telafi desteği olan tamamlanmış siparişlerde kullanılabilir."},{status:409});
  if(action==="cancel"&&(!supported.cancel||!["pending","processing"].includes(status)))return NextResponse.json({error:"Bu sipariş şu anda iptal edilemiyor."},{status:409});
  if(action==="refill"&&["refill_requested","refill_completed"].includes(order.providerAction))return NextResponse.json({error:"Bu sipariş için telafi isteği zaten gönderilmiş."},{status:409});
  if(action==="cancel"&&String(order.providerAction).includes("cancel"))return NextResponse.json({error:"İptal isteği zaten gönderilmiş."},{status:409});
  const result=await requestProviderOrderAction(action,String(order.providerOrderId));if(!result.ok)return NextResponse.json({error:result.error||"Sağlayıcı işlemi kabul etmedi."},{status:502});
  const actionState=action==="refill"?"refill_requested":"cancel_requested";
  await env.DB.prepare("UPDATE orders SET provider_action=?,provider_refill_id=?,provider_error=?,provider_synced_at=? WHERE id=? AND customer_email=?").bind(actionState,result.refillId||"", "",now(),id,customer.email).run();
  return NextResponse.json({ok:true,action:actionState,message:action==="refill"?"Telafi isteği sağlayıcıya gönderildi.":"İptal isteği sağlayıcıya gönderildi."});
 }
 const quantity=Math.floor(Number(body.quantity)),serviceId=Number(body.serviceId),link=String(body.link||"").trim();
 if(!serviceId||!link||!Number.isFinite(quantity)||quantity<1)return NextResponse.json({error:"Hizmet, bağlantı ve adet zorunlu."},{status:400});
 if(!providerConfigured())return NextResponse.json({error:"Sipariş sistemi henüz etkin değil. Sağlayıcı API anahtarı sunucu ayarlarına eklenmeli."},{status:503});
 const service:any=await env.DB.prepare("SELECT id,name,provider_service_id,min_order,max_order,sale_price,price_unit,provider_fields FROM services WHERE id=? AND active=1").bind(serviceId).first();
 if(!service)return NextResponse.json({error:"Hizmet aktif değil."},{status:400});
 if(quantity<service.min_order||quantity>service.max_order)return NextResponse.json({error:`Adet ${service.min_order}–${service.max_order} arasında olmalı.`},{status:400});
 if(!service.provider_service_id)return NextResponse.json({error:"Bu hizmet sağlayıcıya bağlı değil."},{status:503});
 const priceUnit=service.price_unit==="per_order"?"per_order":"per_1000",amount=Math.max(1,priceUnit==="per_order"?Number(service.sale_price):Math.ceil(Number(service.sale_price)*quantity/1000));
 const fields=safeFields(body.fields);let allowedFields:any[]=[];try{allowedFields=JSON.parse(service.provider_fields||"[]")}catch{}
 const allowed=new Set(allowedFields.map((field:any)=>String(field.name||"")).filter((name:string)=>name&&name!=="link"&&name!=="quantity"));for(const name of Object.keys(fields))if(!allowed.has(name))delete fields[name];
 const order={service:String(service.provider_service_id),link,quantity,fields};
 const preview=await previewProviderOrder(order);if(!preview.ok)return NextResponse.json({error:preview.error||"Tedarikçi bu siparişi doğrulayamadı."},{status:preview.status===0?502:400});
 const charged=await env.DB.prepare("UPDATE customer_balances SET balance=balance-?,updated_at=? WHERE email=? AND balance>=?").bind(amount,now(),customer.email,amount).run();
 if(!charged.meta.changes)return NextResponse.json({error:"Bakiyen yetersiz. Önce bakiye yükle.",balanceRequired:true,required:amount,balance:customer.balance},{status:402});
 let created:any;try{created=await env.DB.prepare("INSERT INTO orders(customer_name,customer_email,service_name,service_id,provider_service_id,link,quantity,amount,status,created_at) VALUES(?,?,?,?,?,?,?,?,'pending',?) RETURNING id").bind(customer.name,customer.email,service.name,serviceId,service.provider_service_id,link,quantity,amount,now()).first()}catch{await env.DB.prepare("UPDATE customer_balances SET balance=balance+?,updated_at=? WHERE email=?").bind(amount,now(),customer.email).run();return NextResponse.json({error:"Sipariş kaydedilemedi; bakiyen iade edildi."},{status:500})}
 const result=await forwardOrder({...order,idempotencyKey:`elturco-order-${created.id}`});
 if(!result.forwarded&&!result.uncertain){await env.DB.prepare("UPDATE customer_balances SET balance=balance+?,updated_at=? WHERE email=?").bind(amount,now(),customer.email).run();await env.DB.prepare("UPDATE orders SET provider_error=?,status='failed' WHERE id=?").bind(result.error||"Sağlayıcı siparişi kabul etmedi.",created.id).run();return NextResponse.json({error:result.error||"Sağlayıcı siparişi kabul etmedi. Bakiyen iade edildi."},{status:502})}
 await env.DB.prepare("UPDATE orders SET provider_order_id=?,provider_error=?,status=?,provider_synced_at=? WHERE id=?").bind(result.providerOrderId||"",result.error||"",result.forwarded?"processing":"pending",now(),created.id).run();
 await env.DB.prepare("INSERT INTO transactions(type,amount,category,description,status,created_at) VALUES('expense',?,'Müşteri siparişi',?,'completed',?)").bind(amount,`#${created.id} · ${customer.email} · ${service.name}`,now()).run();
 return NextResponse.json({id:created.id,forwarded:result.forwarded,status:result.forwarded?"processing":"pending",amount},{status:201});
}
