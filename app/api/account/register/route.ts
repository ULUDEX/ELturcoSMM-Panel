import { env } from "cloudflare:workers";
import { NextResponse } from "next/server";
import { CUSTOMER_COOKIE,createCustomerSession,customerCookieOptions,passwordHash,randomHex } from "@/lib/customer-auth";
export async function POST(request:Request){
 try{const body=await request.json() as any,name=String(body.name||"").trim(),email=String(body.email||"").trim().toLowerCase(),password=String(body.password||"");
 if(name.length<2||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||password.length<8)return NextResponse.json({error:"Ad, geçerli e-posta ve en az 8 karakterli şifre gerekli."},{status:400});
 if(await env.DB.prepare("SELECT id FROM customer_users WHERE email=?").bind(email).first())return NextResponse.json({error:"Bu e-posta zaten kayıtlı."},{status:409});
 const salt=randomHex(16),hash=await passwordHash(password,salt),created=Math.floor(Date.now()/1000),createdUser:any=await env.DB.prepare("INSERT INTO customer_users(name,email,password_hash,password_salt,created_at) VALUES(?,?,?,?,?) RETURNING id").bind(name,email,hash,salt,created).first();
 const userId=Number(createdUser?.id);if(!Number.isInteger(userId)||userId<1)throw new Error("user_id");await env.DB.prepare("INSERT OR IGNORE INTO customer_balances(email,balance,created_at,updated_at) VALUES(?,0,?,?)").bind(email,created,created).run();const session=await createCustomerSession(userId),response=NextResponse.json({ok:true,user:{name,email,balance:0}});response.cookies.set(CUSTOMER_COOKIE,session.token,customerCookieOptions(session.expires));return response
 }catch(error){const message=error instanceof Error?error.message:"";if(message.toLowerCase().includes("unique"))return NextResponse.json({error:"Bu e-posta zaten kayıtlı."},{status:409});return NextResponse.json({error:"Kayıt şu anda tamamlanamadı. Lütfen tekrar dene."},{status:500})}
}
