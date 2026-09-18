import { env } from "cloudflare:workers";
import { NextResponse } from "next/server";
import { forwardOrder } from "@/lib/provider";
import { currentCustomer } from "@/lib/customer-auth";

export async function POST(request:Request){
 const customer=await currentCustomer();
 if(!customer)return NextResponse.json({error:"Sipariş vermek için giriş yapmalısın.",loginRequired:true},{status:401});
 const body=await request.json() as any;
 const quantity=Math.floor(Number(body.quantity)),serviceId=Number(body.serviceId);
 if(!serviceId||!String(body.link||"").trim()||!Number.isFinite(quantity)||quantity<1)return NextResponse.json({error:"Hizmet, bağlantı ve adet zorunlu."},{status:400});
 const service:any=await env.DB.prepare("SELECT id,name,provider_service_id,min_order,max_order,sale_price FROM services WHERE id=? AND active=1").bind(serviceId).first();
 if(!service)return NextResponse.json({error:"Hizmet aktif değil."},{status:400});
 if(quantity<service.min_order||quantity>service.max_order)return NextResponse.json({error:`Adet ${service.min_order}–${service.max_order} arasında olmalı.`},{status:400});
 const amount=Math.max(1,Math.ceil(Number(service.sale_price)*quantity/1000));
 const charged=await env.DB.prepare("UPDATE customer_balances SET balance=balance-?,updated_at=? WHERE email=? AND balance>=?").bind(amount,Math.floor(Date.now()/1000),customer.email,amount).run();
 if(!charged.meta.changes)return NextResponse.json({error:"Bakiyen yetersiz. Önce bakiye yükle.",balanceRequired:true,required:amount,balance:customer.balance},{status:402});
 const created:any=await env.DB.prepare("INSERT INTO orders(customer_name,service_name,service_id,provider_service_id,link,quantity,amount,status,created_at) VALUES(?,?,?,?,?,?,?,'pending',?) RETURNING id").bind(customer.name,service.name,serviceId,service.provider_service_id||"",String(body.link).trim(),quantity,amount,Math.floor(Date.now()/1000)).first();
 await env.DB.prepare("INSERT INTO transactions(type,amount,category,description,status,created_at) VALUES('expense',?,'Müşteri siparişi',?,'completed',?)").bind(amount,`#${created.id} · ${customer.email} · ${service.name}`,Math.floor(Date.now()/1000)).run();
 let result:any={forwarded:false,error:"Hizmet için sağlayıcı servis ID girilmedi."};
 if(service.provider_service_id)result=await forwardOrder({service:String(service.provider_service_id),link:String(body.link).trim(),quantity});
 await env.DB.prepare("UPDATE orders SET provider_order_id=?,provider_error=?,status=? WHERE id=?").bind(result.providerOrderId||"",result.error||"",result.forwarded?"processing":"pending",created.id).run();
 return NextResponse.json({id:created.id,forwarded:result.forwarded,status:result.forwarded?"processing":"pending",amount},{status:201});
}