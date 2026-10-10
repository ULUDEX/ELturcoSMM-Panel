import { env } from "cloudflare:workers";
const db=()=>{const value=env.DB;if(!value)throw new Error("Veritabanı bağlantısı yapılandırılmamış.");return value};
import { now,paymentBonus } from "./admin-controls";
import { addCustomerNotification } from "./customer-notifications";
export async function approvePayment(id:number){
 const payment:any=await db().prepare("SELECT * FROM payment_requests WHERE id=?").bind(id).first();
 if(!payment)throw Error("Ödeme bulunamadı.");
 if(payment.status==='approved')return {duplicate:true,bonus:payment.bonus_amount};
 if(payment.status!=='pending')throw Error("Yalnızca bekleyen ödeme onaylanabilir.");
 const bonus=await paymentBonus(payment.amount),time=now();
 const result=await db().batch([
  db().prepare("UPDATE payment_requests SET status='approved',bonus_amount=? WHERE id=? AND status='pending'").bind(bonus,id),
  db().prepare("INSERT INTO transactions(type,amount,category,description,status,created_at) SELECT 'income',?,'Bakiye yükleme',?,'completed',? WHERE changes()>0").bind(payment.amount,`Ödeme #${id} · ${payment.customer_name}`,time),
  db().prepare("INSERT INTO customer_balances(email,balance,created_at,updated_at) SELECT ?,?,?,? WHERE changes()>0 ON CONFLICT(email) DO UPDATE SET balance=balance+excluded.balance,updated_at=excluded.updated_at").bind(payment.email,payment.amount+bonus,time,time),
 ]);
 if(result[0].meta.changes&&payment.email)try{await addCustomerNotification({email:payment.email,kind:"balance",title:"Bakiye yüklemen onaylandı",body:`${((payment.amount+bonus)/100).toFixed(2)} ₺ hesabına eklendi.${bonus?` Bonus: ${(bonus/100).toFixed(2)} ₺.`:""}`,emailSubject:"ElTurco SMM · Bakiye yüklemen onaylandı"})}catch{console.error("Payment notification could not be delivered.")}
 return {bonus};
}
