import { env } from "cloudflare:workers";
export const RESELLER_MONTHLY_USD=2500;
export const resellerActive=(row:any,at=Math.floor(Date.now()/1000))=>row?.state==='active'&&Number(row.period_end)>at;
export function nextBillingMonth(from:number) {
  const date=new Date(from*1000),day=date.getUTCDate();date.setUTCDate(1);date.setUTCMonth(date.getUTCMonth()+1);
  const last=new Date(Date.UTC(date.getUTCFullYear(),date.getUTCMonth()+1,0)).getUTCDate();date.setUTCDate(Math.min(day,last));return Math.floor(date.getTime()/1000);
}
export async function approveResellerInvoice(id:number,paymentReference:string) {
  if(paymentReference.trim().length<3)throw Error('Ödeme referansı gerekli.');
  const invoice:any=await env.DB!.prepare('SELECT * FROM reseller_invoices WHERE id=?').bind(id).first();
  if(!invoice)throw Error('Üyelik faturası bulunamadı.');
  if(invoice.state==='paid')return {duplicate:true};
  if(invoice.state!=='pending')throw Error('Yalnızca bekleyen üyelik faturası onaylanabilir.');
  const membership:any=await env.DB!.prepare('SELECT period_end FROM reseller_subscriptions WHERE user_id=?').bind(invoice.user_id).first();
  const at=Math.floor(Date.now()/1000),until=nextBillingMonth(Math.max(at,Number(membership?.period_end)||0));
  const result=await env.DB!.batch([
    env.DB!.prepare("UPDATE reseller_invoices SET state='paid',paid_at=?,payment_reference=? WHERE id=? AND state='pending'").bind(at,paymentReference.trim().slice(0,150),id),
    env.DB!.prepare("UPDATE reseller_subscriptions SET state='active',period_end=?,cancel_at_period_end=0,updated_at=? WHERE user_id=? AND changes()=1").bind(until,at,invoice.user_id),
  ]);
  return {duplicate:!result[0].meta.changes,periodEnd:until};
}
