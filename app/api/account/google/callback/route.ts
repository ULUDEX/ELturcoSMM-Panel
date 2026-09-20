import { env } from "cloudflare:workers";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { CUSTOMER_COOKIE,createCustomerSession,customerCookieOptions,passwordHash,randomHex } from "@/lib/customer-auth";
const STATE_COOKIE="elturco_google_state";
export async function GET(request:Request){
 const url=new URL(request.url),origin=url.origin,code=url.searchParams.get("code"),state=url.searchParams.get("state"),saved=(await cookies()).get(STATE_COOKIE)?.value;
 if(!code||!state||!saved||state!==saved)return NextResponse.redirect(origin+"/site/index.html?auth=google_error");
 const clientId=String((env as any).GOOGLE_CLIENT_ID||""),clientSecret=String((env as any).GOOGLE_CLIENT_SECRET||""),redirectUri=String((env as any).GOOGLE_REDIRECT_URI||origin+"/api/account/google/callback");
 if(!clientId||!clientSecret)return NextResponse.redirect(origin+"/site/index.html?auth=google_config");
 try{
  const tokenResponse=await fetch("https://oauth2.googleapis.com/token",{method:"POST",headers:{"content-type":"application/x-www-form-urlencoded"},body:new URLSearchParams({code,client_id:clientId,client_secret:clientSecret,redirect_uri:redirectUri,grant_type:"authorization_code"})});
  if(!tokenResponse.ok)throw new Error("token");
  const token:any=await tokenResponse.json();
  const profileResponse=await fetch("https://openidconnect.googleapis.com/v1/userinfo",{headers:{authorization:"Bearer "+token.access_token}});
  if(!profileResponse.ok)throw new Error("profile");
  const profile:any=await profileResponse.json(),email=String(profile.email||"").trim().toLowerCase(),name=String(profile.name||email.split("@")[0]).trim();
  if(!profile.email_verified||!email)throw new Error("email");
  let user:any=await env.DB.prepare("SELECT id,name,email FROM customer_users WHERE email=?").bind(email).first();
  if(!user){const salt=randomHex(16),hash=await passwordHash(randomHex(32),salt),created=Math.floor(Date.now()/1000),createdUser:any=await env.DB.prepare("INSERT INTO customer_users(name,email,password_hash,password_salt,created_at) VALUES(?,?,?,?,?) RETURNING id").bind(name,email,hash,salt,created).first();const userId=Number(createdUser?.id);if(!Number.isInteger(userId)||userId<1)throw new Error("user_id");user={id:userId,name,email};await env.DB.prepare("INSERT OR IGNORE INTO customer_balances(email,balance,created_at,updated_at) VALUES(?,0,?,?)").bind(email,created,created).run()}
  const session=await createCustomerSession(Number(user.id)),response=NextResponse.redirect(origin+"/site/index.html?auth=google_ok");
  response.cookies.set(CUSTOMER_COOKIE,session.token,customerCookieOptions(session.expires));response.cookies.set(STATE_COOKIE,"",{httpOnly:true,secure:true,sameSite:"lax",path:"/",maxAge:0});return response;
 }catch{return NextResponse.redirect(origin+"/site/index.html?auth=google_error")}
}
