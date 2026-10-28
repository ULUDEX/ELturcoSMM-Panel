import { env } from "cloudflare:workers";
import { digest } from "@/lib/customer-auth";

export const apiHeaders={"cache-control":"private, no-store",vary:"Authorization"};
export async function authenticateApiKey(token:string) {
  if(!/^ets_(live|test)_[a-f0-9]{64}$/.test(token))return null;
  return await env.DB!.prepare(`SELECT k.id keyId,u.id,u.name,u.email,u.avatar,COALESCE(b.balance,0) balance
    FROM customer_api_keys k JOIN customer_users u ON u.id=k.user_id
    LEFT JOIN customer_balances b ON b.email=u.email
    WHERE k.token_hash=? AND k.revoked_at IS NULL AND u.email_verified_at IS NOT NULL`)
    .bind(await digest(token)).first() as {keyId:number,id:number,name:string,email:string,avatar:string,balance:number}|null;
}
export async function consumeApiRequest(keyId:number) {
  const at=Math.floor(Date.now()/1000),minute=Math.floor(at/60);
  const row:any=await env.DB!.prepare(`INSERT INTO customer_api_usage(key_id,minute,requests) VALUES(?,?,1)
    ON CONFLICT(key_id,minute) DO UPDATE SET requests=requests+1 RETURNING requests`).bind(keyId,minute).first();
  if(Number(row?.requests)>60)return false;
  await env.DB!.batch([
    env.DB!.prepare("UPDATE customer_api_keys SET last_used_at=? WHERE id=?").bind(at,keyId),
    env.DB!.prepare("DELETE FROM customer_api_usage WHERE key_id=? AND minute<?").bind(keyId,minute-2),
  ]);
  return true;
}
