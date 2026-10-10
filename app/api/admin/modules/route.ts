import { env } from "cloudflare:workers";
const db=()=>{const value=env.DB;if(!value)throw new Error("Veritabanı bağlantısı yapılandırılmamış.");return value};
import { NextResponse } from "next/server";
import { adminIdentity,isAdmin } from "@/lib/admin-auth";
import { MODULES,activity,now,records } from "@/lib/admin-controls";
import { digest,passwordHash,randomHex } from "@/lib/customer-auth";
import { createAutomation,changeAutomation } from "@/lib/automation-jobs";
import { requestProviderOrderAction } from "@/lib/provider";
import { providerId } from "@/lib/providers";
import { runCatalogSchedule } from "@/lib/catalog-schedule";
import { LOCALES,translationOverview,runTranslationQueue,textHash } from "@/lib/localization";

const editable=new Set(["blacklist-ip","blacklist-link","blacklist-email","blog-category","blog-posts","role-permissions","payment-bonuses","modules","news","languages","faqs"]);
const fields:Record<string,string[]>={
 "blacklist-ip":["value","reason"],"blacklist-link":["value","reason"],"blacklist-email":["value","reason"],
 "blog-category":["title","slug"],"blog-posts":["title","slug","category","body"],"role-permissions":["title","permissions"],
 "payment-bonuses":["title","minimum","percent"],"modules":["name"],"news":["title","body"],"languages":["locale","key","value","source"],"faqs":["question","answer"],
};
export async function GET(r:Request){
 const identity=await adminIdentity();if(!identity)return NextResponse.json({error:"Yetkisiz"},{status:403});
 const module=new URL(r.url).searchParams.get("module")||"session";
 if(module==="session")return NextResponse.json(identity);
 if(!await isAdmin(r))return NextResponse.json({error:"Bu bölüme erişim iznin yok."},{status:403});
 if(module==='languages'&&new URL(r.url).searchParams.get('translations')==='1')return NextResponse.json(await translationOverview((new URL(r.url).searchParams.get('search')||'').slice(0,100)));
 if(editable.has(module))return NextResponse.json(await records(module));
 if((module==="dripfeed"||module==="subscriptions")&&new URL(r.url).searchParams.get("catalog")==="1"){
 const search=(new URL(r.url).searchParams.get("search")||"").slice(0,100);const q:any=await db().prepare("SELECT id,name,provider_id providerId,sale_price salePrice,price_unit priceUnit FROM services WHERE active=1 AND name LIKE ? ORDER BY id DESC LIMIT 30").bind(`%${search}%`).all();return NextResponse.json(q.results);
 }
 if(module==="staffs"){const q:any=await db().prepare("SELECT s.id,s.username,s.name,s.role_id,s.active,s.created_at,r.data role FROM admin_staff s LEFT JOIN admin_records r ON r.id=s.role_id ORDER BY s.id DESC").all();return NextResponse.json(q.results);}
 if(module==="staff-activity"||module==="user-activity"){const q:any=await db().prepare("SELECT * FROM admin_activity WHERE kind=? ORDER BY id DESC LIMIT 300").bind(module==="staff-activity"?"admin":"customer").all();return NextResponse.json(q.results);}
 if(module==="subscribers"){const q:any=await db().prepare("SELECT u.id,u.name,u.email,u.created_at,COUNT(j.id) plan_count FROM customer_users u JOIN automation_jobs j ON j.customer_email=u.email AND j.kind='subscriptions' GROUP BY u.id ORDER BY u.id DESC").all();return NextResponse.json(q.results);}
 if(module==="dripfeed"||module==="subscriptions"){const q:any=await db().prepare("SELECT * FROM automation_jobs WHERE kind=? ORDER BY id DESC LIMIT 200").bind(module).all();return NextResponse.json(q.results);}
 if(module==="cancel"){const q:any=await db().prepare("SELECT id,customer_name,service_name,amount,status,provider_id,provider_order_id,provider_action,provider_error FROM orders WHERE provider_action LIKE 'cancel%' OR status IN ('canceled','cancelled') ORDER BY id DESC LIMIT 200").all();return NextResponse.json(q.results);}
 if(module==="cronjobs"){const q:any=await db().prepare("SELECT key,value,updated_at FROM site_settings WHERE key LIKE 'provider_catalog_last_sync%' OR key IN ('schedule_last_run','schedule_last_error')").all();const pending:any=await db().prepare("SELECT COUNT(*) total FROM site_settings WHERE key GLOB 'telegram_catalog_outbox:*'").first();return NextResponse.json({schedule:"Her 5 dakika; katalog 6 saatte bir",runs:q.results,telegramPending:pending?.total||0});}
 if(module==="reports"){
  const days=Math.min(365,Math.max(1,Number(new URL(r.url).searchParams.get("days"))||30)),since=now()-days*86400;
  const [daily,suppliers,statuses]:any=await db().batch([
   db().prepare("SELECT strftime('%Y-%m-%d',created_at,'unixepoch','+3 hours') date,COUNT(*) orders,SUM(amount) revenue,SUM(provider_cost) cost,SUM(CASE WHEN status='completed' THEN 1 ELSE 0 END) completed FROM orders WHERE created_at>=? GROUP BY date ORDER BY date DESC").bind(since),
   db().prepare("SELECT provider_id,COUNT(*) orders,SUM(amount) revenue,SUM(provider_cost) cost FROM orders WHERE created_at>=? GROUP BY provider_id").bind(since),
   db().prepare("SELECT status,COUNT(*) total FROM orders WHERE created_at>=? GROUP BY status").bind(since),
  ]);return NextResponse.json({days,daily:daily.results,suppliers:suppliers.results,statuses:statuses.results});
 }
 return NextResponse.json({error:"Bölüm bulunamadı."},{status:404});
}
export async function POST(r:Request){
 if(!await isAdmin(r))return NextResponse.json({error:"Bu işlem için yetkin yok."},{status:403});
 const identity=await adminIdentity();let b:any;try{b=await r.json()}catch{return NextResponse.json({error:"Geçersiz istek"},{status:400})}
 const module=String(b.module||""),id=Number(b.id)||0;
 try{
  if(module==='languages'&&b.action==='translation-run'){await runTranslationQueue();return NextResponse.json({ok:true});}
  if(module==='languages'&&b.action==='translation-save'){
   const locale=String(b.locale||''),source=String(b.source||'').trim(),translated=String(b.translated||'').trim();
   if(!LOCALES.includes(locale as any)||!source||source.length>3000||!translated||translated.length>10000)throw Error('Geçerli dil ve metin gir.');
   await db().prepare('INSERT INTO translation_cache(locale,source_hash,source,translated,updated_at,manual) VALUES(?,?,?,?,?,1) ON CONFLICT(locale,source_hash) DO UPDATE SET translated=excluded.translated,manual=1,updated_at=excluded.updated_at').bind(locale,await textHash(source),source,translated,now()).run();
   await db().prepare('DELETE FROM translation_queue WHERE locale=? AND source_hash=?').bind(locale,await textHash(source)).run();await activity(identity!.name,'admin','languages:translation-save',locale);return NextResponse.json({ok:true});
  }
  if(module==="dripfeed"||module==="subscriptions"){
   const result=b.action==="save"?await createAutomation({...b.data,kind:module}):await changeAutomation(id,b.action);
   await activity(identity!.name,"admin",`${module}:${b.action}`,String(id||result?.id||""));return NextResponse.json({ok:true,...result});
  }
  if(module==="cronjobs"){
   // Catalog updates and queue dispatch only; never manually run paid automation.
   await runCatalogSchedule();await activity(identity!.name,"admin","cronjobs:run");return NextResponse.json({ok:true});
  }
  if(module==="cancel"){
   const order:any=await db().prepare("SELECT o.*,s.provider_features FROM orders o LEFT JOIN services s ON s.id=o.service_id WHERE o.id=?").bind(id).first();
   if(!order||!order.provider_order_id||!["pending","processing"].includes(order.status)||!JSON.parse(order.provider_features||"{}").cancel)throw Error("Sipariş iptal için uygun değil.");
   const claimed=await db().prepare("UPDATE orders SET provider_action='cancel_sending' WHERE id=? AND provider_action NOT LIKE 'cancel%'").bind(id).run();if(!claimed.meta.changes)throw Error("İptal isteği zaten gönderilmiş.");
   const result=await requestProviderOrderAction("cancel",String(order.provider_order_id),providerId(order.provider_id));
   await db().prepare("UPDATE orders SET provider_action=?,provider_error=? WHERE id=?").bind(result.ok?"cancel_requested":"cancel_failed",result.error||"",id).run();
   if(!result.ok)throw Error(result.error||"Tedarikçi iptali reddetti.");
  }else if(module==="staffs"){
   if(b.action==="toggle"){await db().prepare("UPDATE admin_staff SET active=? WHERE id=?").bind(b.active?1:0,id).run();}
   else {
    const d=b.data||{},username=String(d.username||"").toLowerCase().trim(),name=String(d.name||"").trim(),role=Number(d.role_id);
    if(!/^[a-z0-9._-]{3,60}$/.test(username)||!name||name.length>120)throw Error("Ad ve 3–60 karakterli kullanıcı adı gerekli.");
    const roleRow:any=await db().prepare("SELECT id FROM admin_records WHERE id=? AND module='role-permissions' AND active=1").bind(role).first();if(!roleRow)throw Error("Aktif bir rol seç.");
    if(id)await db().prepare("UPDATE admin_staff SET username=?,name=?,role_id=? WHERE id=?").bind(username,name,role,id).run();
    else {if(String(d.password||"").length<12||String(d.password).length>128)throw Error("En az 12 karakterli şifre gerekli.");const salt=randomHex(16),hash=await passwordHash(d.password,salt);await db().prepare("INSERT INTO admin_staff(username,name,password_hash,password_salt,role_id,created_at) VALUES(?,?,?,?,?,?)").bind(username,name,hash,salt,role,now()).run();}
   }
  }else if(editable.has(module)){
   if(b.action==="toggle")await db().prepare("UPDATE admin_records SET active=?,updated_at=? WHERE id=? AND module=?").bind(b.active?1:0,now(),id,module).run();
   else if(b.action==="delete")await db().prepare("UPDATE admin_records SET active=0,updated_at=? WHERE id=? AND module=?").bind(now(),id,module).run();
   else {
    const data:any={};for(const key of fields[module])data[key]=key==="permissions"?b.data?.[key]:String(b.data?.[key]??"").trim();
    if(Object.values(data).some(v=>typeof v==="string"&&v.length>20000))throw Error("Metin çok uzun.");
    const first=fields[module][0];if(!data[first]||fields[module].some(k=>!["reason","category","permissions","source"].includes(k)&&!data[k]))throw Error("Zorunlu alanları doldur.");
    if(module==="role-permissions"){data.permissions=Array.isArray(data.permissions)?data.permissions.filter((p:any)=>MODULES.some(m=>p===`${m}:read`||p===`${m}:write`)):[];if(!data.permissions.length)throw Error("En az bir izin seç.");}
    if(module==="payment-bonuses"){data.minimum=Number(data.minimum);data.percent=Number(data.percent);if(!Number.isFinite(data.minimum)||data.minimum<0||!Number.isFinite(data.percent)||data.percent<0||data.percent>100)throw Error("Geçerli eşik ve %0–100 bonus gir.");}
    if(module==="modules"&&!['dripfeed','subscriptions','orders','blog','radio','api'].includes(data.name))throw Error("Geçerli modül seç.");
    if(module==="languages"&&(![...LOCALES,'pt'].includes(data.locale)||!/^[a-zA-Z0-9._-]{1,80}$/.test(data.key)))throw Error("Geçerli dil ve metin anahtarı gir.");
    if(module.startsWith("blog-")&&!/^[a-z0-9-]{1,120}$/.test(data.slug))throw Error("Adres yalnızca küçük harf, rakam ve tire içerebilir.");
    if(module==="blacklist-email"&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.value))throw Error("Geçerli e-posta gir.");
    if(module==="blacklist-ip"&&!/^([0-9]{1,3}\.){3}[0-9]{1,3}$|^[a-f0-9:]+$/i.test(data.value))throw Error("Geçerli IP gir.");
    if(module==="blacklist-link"){try{new URL(data.value.includes("://")?data.value:`https://${data.value}`)}catch{throw Error("Geçerli alan adı veya bağlantı gir.")}}
    if(id)await db().prepare("UPDATE admin_records SET data=?,updated_at=? WHERE id=? AND module=?").bind(JSON.stringify(data),now(),id,module).run();
    else await db().prepare("INSERT INTO admin_records(module,data,created_at,updated_at) VALUES(?,?,?,?)").bind(module,JSON.stringify(data),now(),now()).run();
   }
  }else throw Error("Geçersiz bölüm.");
  await activity(identity!.name,"admin",`${module}:${b.action||"save"}`,String(id));return NextResponse.json({ok:true});
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:"İşlem tamamlanamadı."},{status:400})}
}
