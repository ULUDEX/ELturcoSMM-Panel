import { env } from "cloudflare:workers";
const db=()=>{const value=env.DB;if(!value)throw new Error("Veritabanı bağlantısı yapılandırılmamış.");return value};
import { blocked,moduleEnabled,now } from "./admin-controls";
import { forwardOrder,providerConfigured } from "./provider";
import { providerId } from "./providers";

export async function createAutomation(b:any) {
 const kind=b.kind==="subscriptions"?"subscriptions":"dripfeed",quantity=Number(b.quantity),runs=Number(b.runs),minutes=Number(b.minutes),email=String(b.email||"").trim().toLowerCase(),link=String(b.link||"").trim();
 if(!Number.isInteger(quantity)||quantity<1||!Number.isInteger(runs)||runs<2||runs>100||!Number.isInteger(minutes)||minutes<5||minutes>43200||!/^https?:\/\//.test(link)||link.length>2000||!email)throw Error("Geçerli e-posta, bağlantı, adet, 2–100 tekrar ve en az 5 dakika aralık gerekli.");
 if(!await moduleEnabled(kind))throw Error("Bu modül durdurulmuş.");
 const s:any=await db().prepare("SELECT * FROM services WHERE id=? AND active=1").bind(Number(b.serviceId)||0).first();
 if(!s||!s.provider_service_id||!providerConfigured(providerId(s.provider_id)))throw Error("Aktif tedarikçi hizmeti seç.");
 if(quantity<s.min_order||quantity>s.max_order)throw Error("Adet hizmet sınırları dışında.");
 if(JSON.parse(s.provider_fields||"[]").some((f:any)=>f.required!==false))throw Error("Planlı sipariş yalnızca ek alan istemeyen standart hizmetlerde kullanılabilir.");
 const customer:any=await db().prepare("SELECT name,email FROM customer_users WHERE email=? AND email_verified_at IS NOT NULL").bind(email).first();
 if(!customer)throw Error("Doğrulanmış müşteri bulunamadı.");
 if(await blocked(new Request("https://elturcosmm.com"),email,link))throw Error("E-posta veya bağlantı kara listede.");
 const amount=Math.max(1,s.price_unit==="per_order"?s.sale_price:Math.ceil(s.sale_price*quantity/1000)),cost=s.price_unit==="per_order"?s.cost_price:Math.ceil(s.cost_price*quantity/1000),total=amount*runs;
 if(!Number.isSafeInteger(total)||!Number.isSafeInteger(cost))throw Error("Plan tutarı geçersiz.");
 const key=String(b.requestKey||"");if(!/^[a-zA-Z0-9-]{16,80}$/.test(key))throw Error("İstek anahtarı eksik.");
 const existing:any=await db().prepare("SELECT id FROM automation_jobs WHERE request_key=?").bind(key).first();if(existing)return existing;
 await db().batch([
  db().prepare("INSERT OR IGNORE INTO automation_jobs(request_key,kind,customer_email,customer_name,service_id,service_name,provider_id,provider_service_id,link,quantity,unit_amount,unit_cost,total_runs,interval_minutes,next_run_at,created_at) SELECT ?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM customer_balances WHERE email=? AND balance>=?)").bind(key,kind,email,customer.name,s.id,s.name,s.provider_id,s.provider_service_id,link,quantity,amount,cost,runs,minutes,now()+300,now(),email,total),
  db().prepare("UPDATE customer_balances SET balance=balance-?,updated_at=? WHERE email=? AND changes()>0").bind(total,now(),email),
 ]);
 const saved:any=await db().prepare("SELECT id FROM automation_jobs WHERE request_key=?").bind(key).first();
 if(!saved)throw Error(`Bakiye yetersiz. Toplam ${(total/100).toFixed(2)} ₺ gerekli.`);
 return {...saved,total};
}
export async function changeAutomation(id:number,action:string) {
 if(action==="pause"||action==="resume") {
  const result=await db().prepare("UPDATE automation_jobs SET state=?,error='' WHERE id=? AND state=?").bind(action==="pause"?"paused":"active",id,action==="pause"?"active":"paused").run();if(!result.meta.changes)throw Error("Plan bu işlem için uygun durumda değil.");return;
 }
 const job:any=await db().prepare("SELECT * FROM automation_jobs WHERE id=? AND state IN ('active','paused','needs_review')").bind(id).first();if(!job)throw Error("Plan işleniyor veya zaten tamamlanmış.");
 await db().batch([
  db().prepare("UPDATE automation_jobs SET state='canceled' WHERE id=? AND state IN ('active','paused','needs_review')").bind(id),
  db().prepare("UPDATE customer_balances SET balance=balance+(SELECT unit_amount*(total_runs-completed_runs) FROM automation_jobs WHERE id=?),updated_at=? WHERE email=(SELECT customer_email FROM automation_jobs WHERE id=?) AND changes()>0").bind(id,now(),id),
 ]);
}
export async function runAutomationJobs() {
 if(!await moduleEnabled("orders"))return;
 const rows:any=await db().prepare("SELECT id FROM automation_jobs WHERE state='active' AND next_run_at<=? ORDER BY next_run_at LIMIT 5").bind(now()).all();
 for(const row of rows.results){
  const snapshot:any=await db().prepare("SELECT * FROM automation_jobs WHERE id=?").bind(row.id).first();
  if(!await moduleEnabled(snapshot.kind))continue;
  if(await blocked(new Request("https://elturcosmm.com"),snapshot.customer_email,snapshot.link)){await changeAutomation(row.id,"cancel");continue;}
  const j:any=await db().prepare("UPDATE automation_jobs SET state='running',completed_runs=completed_runs+1 WHERE id=? AND state='active' AND next_run_at<=? RETURNING *").bind(row.id,now()).first();if(!j)continue;
  try {
   const o:any=await db().prepare("INSERT INTO orders(customer_name,customer_email,service_name,service_id,provider_id,provider_service_id,link,quantity,amount,provider_cost,status,source,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,'pending','automation',?) RETURNING id").bind(j.customer_name,j.customer_email,j.service_name,j.service_id,j.provider_id,j.provider_service_id,j.link,j.quantity,j.unit_amount,j.unit_cost,now()).first();
   await db().prepare("INSERT INTO automation_runs(job_id,run_number,order_id,state,created_at) VALUES(?,?,?,'pending',?)").bind(j.id,j.completed_runs,o.id,now()).run();
   const result=await forwardOrder({providerId:providerId(j.provider_id),service:j.provider_service_id,link:j.link,quantity:j.quantity,idempotencyKey:`elturco-automation-${j.id}-${j.completed_runs}`});
   await db().prepare("UPDATE orders SET provider_order_id=?,provider_error=?,status=? WHERE id=?").bind(result.providerOrderId||"",result.error||"",result.forwarded?"processing":result.uncertain?"pending":"failed",o.id).run();
   await db().prepare("UPDATE automation_runs SET state=? WHERE job_id=? AND run_number=?").bind(result.forwarded?"sent":result.uncertain?"uncertain":"failed",j.id,j.completed_runs).run();
   if(!result.forwarded&&!result.uncertain){
    await db().batch([
     db().prepare("UPDATE automation_jobs SET state='failed',error=? WHERE id=? AND state='running'").bind(result.error||"Tedarikçi reddetti.",j.id),
     db().prepare("UPDATE customer_balances SET balance=balance+?,updated_at=? WHERE email=? AND changes()>0").bind(j.unit_amount*(j.total_runs-j.completed_runs+1),now(),j.customer_email),
    ]);
   }else await db().prepare("UPDATE automation_jobs SET state=?,error=?,next_run_at=? WHERE id=?").bind(result.uncertain?"needs_review":j.completed_runs>=j.total_runs?"completed":"active",result.error||"",now()+j.interval_minutes*60,j.id).run();
  }catch {
   // A claimed run is never retried automatically: the provider may have accepted it.
   await db().prepare("UPDATE automation_jobs SET state='needs_review',error='Gönderim sonucu doğrulanmalı; otomatik tekrar durduruldu.' WHERE id=?").bind(j.id).run();
  }
 }
 // Claims left by an interrupted Worker require human review, never a resend.
 await db().prepare("UPDATE automation_jobs SET state='needs_review',error='Kesilen gönderim kontrol edilmeli.' WHERE state='running' AND next_run_at<?").bind(now()-900).run();
}
