import { env } from "cloudflare:workers";
import { NextResponse } from "next/server";
import { currentCustomer,randomHex } from "@/lib/customer-auth";
import { RESELLER_MONTHLY_USD,resellerActive } from "@/lib/resellers";
const headers={"cache-control":"private, no-store",vary:"Cookie"};
export async function GET() {
 const user=await currentCustomer();if(!user)return NextResponse.json({error:"Giriş yapmalısın."},{status:401});
 const subscription:any=await env.DB!.prepare('SELECT * FROM reseller_subscriptions WHERE user_id=?').bind(user.id).first();
 const invoices=await env.DB!.prepare('SELECT id,reference,amount_usd amountUsd,state,created_at createdAt,paid_at paidAt FROM reseller_invoices WHERE user_id=? ORDER BY id DESC LIMIT 20').bind(user.id).all();
 const clients=await env.DB!.prepare('SELECT id,name,reference,created_at createdAt FROM reseller_clients WHERE user_id=? AND archived_at IS NULL ORDER BY id DESC LIMIT 100').bind(user.id).all();
 return NextResponse.json({subscription,active:resellerActive(subscription),monthlyUsd:RESELLER_MONTHLY_USD,currency:'USD',invoices:invoices.results,clients:clients.results,automaticBilling:false,apiIncludedSeparately:true},{headers});
}
export async function POST(request:Request) {
 const user=await currentCustomer();if(!user)return NextResponse.json({error:"Giriş yapmalısın."},{status:401});
 const origin=request.headers.get('origin');if(origin&&origin!==new URL(request.url).origin)return NextResponse.json({error:"Geçersiz kaynak."},{status:403});
 try {
  const body:any=await request.json(),at=Math.floor(Date.now()/1000);
  const subscription:any=await env.DB!.prepare('SELECT * FROM reseller_subscriptions WHERE user_id=?').bind(user.id).first();
  if(body.action==='cancel'){
   if(!subscription)return NextResponse.json({error:'Üyelik bulunamadı.'},{status:404});
   await env.DB!.batch([env.DB!.prepare("UPDATE reseller_subscriptions SET cancel_at_period_end=1,state=CASE WHEN period_end>? THEN state ELSE 'cancelled' END,updated_at=? WHERE user_id=?").bind(at,at,user.id),env.DB!.prepare("UPDATE reseller_invoices SET state='cancelled' WHERE user_id=? AND state='pending'").bind(user.id)]);
   return NextResponse.json({ok:true,message:'Yeni dönem talebin iptal edildi. Ödenen dönem sonuna kadar erişimin sürer.'},{headers});
  }
  if(body.action==='client-add'||body.action==='client-archive'){
   if(!resellerActive(subscription))return NextResponse.json({error:'Müşteri yönetimi için aktif bayilik gerekli.'},{status:403});
   if(body.action==='client-archive'){await env.DB!.prepare('UPDATE reseller_clients SET archived_at=? WHERE id=? AND user_id=?').bind(at,Number(body.id)||0,user.id).run();return NextResponse.json({ok:true},{headers});}
   const name=String(body.name||'').trim(),reference=String(body.reference||'').trim();if(name.length<2||name.length>80||reference.length>150)return NextResponse.json({error:'2–80 karakter müşteri adı ve en fazla 150 karakter referans gir.'},{status:400});
   const count:any=await env.DB!.prepare('SELECT COUNT(*) n FROM reseller_clients WHERE user_id=? AND archived_at IS NULL').bind(user.id).first();if(count.n>=100)return NextResponse.json({error:'En fazla 100 aktif müşteri kaydedebilirsin.'},{status:400});
   await env.DB!.prepare('INSERT INTO reseller_clients(user_id,name,reference,created_at) VALUES(?,?,?,?)').bind(user.id,name,reference,at).run();return NextResponse.json({ok:true},{status:201,headers});
  }
  if(!['apply','renew'].includes(body.action))return NextResponse.json({error:'Geçersiz işlem.'},{status:400});
  const name=String(body.businessName||subscription?.business_name||'').trim(),website=String(body.website??subscription?.website??'').trim();
  if(name.length<2||name.length>80)return NextResponse.json({error:'2–80 karakter işletme adı gerekli.'},{status:400});
  if(website){try{const u=new URL(website);if(u.protocol!=='https:'||website.length>250)throw Error()}catch{return NextResponse.json({error:'Geçerli HTTPS site adresi gir.'},{status:400});}}
  const pending=await env.DB!.prepare("SELECT id,reference FROM reseller_invoices WHERE user_id=? AND state='pending'").bind(user.id).first();if(pending)return NextResponse.json({ok:true,invoice:pending,message:'Mevcut ödeme talebin bekliyor.'},{headers});
  const reference='BAYI-'+randomHex(6).toUpperCase();
  await env.DB!.batch([
   env.DB!.prepare("INSERT INTO reseller_subscriptions(user_id,business_name,website,state,created_at,updated_at) VALUES(?,?,?,'pending_payment',?,?) ON CONFLICT(user_id) DO UPDATE SET business_name=excluded.business_name,website=excluded.website,cancel_at_period_end=0,updated_at=excluded.updated_at").bind(user.id,name,website,at,at),
   env.DB!.prepare("INSERT INTO reseller_invoices(user_id,reference,amount_usd,state,created_at) VALUES(?,?,?,'pending',?)").bind(user.id,reference,RESELLER_MONTHLY_USD,at),
  ]);
  return NextResponse.json({ok:true,reference,message:'25 USD aylık bayilik talebin oluşturuldu. Ödeme referansınla destek ekibine ulaş; ödeme doğrulanınca üyeliğin açılır.'},{status:201,headers});
 }catch{return NextResponse.json({error:'İşlem tamamlanamadı. Sayfayı yenileyip tekrar dene.'},{status:503,headers});}
}
