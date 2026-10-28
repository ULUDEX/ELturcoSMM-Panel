import { env } from "cloudflare:workers";
import { NextResponse } from "next/server";
import { previewAccountVerification } from "@/lib/private-preview";
import { CUSTOMER_COOKIE,createCustomerSession,customerCookieOptions,digest,randomHex,passwordHash } from "@/lib/customer-auth";

// Native Sites identity is trusted only behind the owner-private staging gate.
export async function POST(request:Request) {
  if(!previewAccountVerification(request))return NextResponse.json({error:"Bu işlem yalnızca özel test ortamında kullanılabilir."},{status:403});
  const email=`${await digest(request.headers.get('oai-authenticated-user-id')!)}@preview.invalid`;
  const now=Math.floor(Date.now()/1000), salt=randomHex(16);
  await env.DB.prepare("INSERT OR IGNORE INTO customer_users(name,email,password_hash,password_salt,avatar,created_at,email_verified_at) VALUES(?,?,?,?,?,?,?)")
    .bind('Test hesabım',email,await passwordHash(randomHex(),salt),salt,'man-1',now,now).run();
  const user:any=await env.DB.prepare("SELECT id FROM customer_users WHERE email=?").bind(email).first();
  await env.DB.prepare("INSERT OR IGNORE INTO customer_balances(email,balance,created_at,updated_at) VALUES(?,0,?,?)").bind(email,now,now).run();
  const session=await createCustomerSession(user.id), response=NextResponse.json({ok:true},{headers:{'cache-control':'private, no-store'}});
  response.cookies.set(CUSTOMER_COOKIE,session.token,customerCookieOptions(session.expires));
  return response;
}
