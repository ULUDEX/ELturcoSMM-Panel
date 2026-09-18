import { env } from "cloudflare:workers";
import { NextResponse } from "next/server";
import { randomHex } from "@/lib/customer-auth";
const COOKIE="elturco_google_state";
export async function GET(request:Request){
 const clientId=String((env as any).GOOGLE_CLIENT_ID||"");
 if(!clientId)return NextResponse.json({error:"Google girişi için GOOGLE_CLIENT_ID ve GOOGLE_CLIENT_SECRET tanımlanmalı."},{status:503});
 const state=randomHex(24),origin=new URL(request.url).origin,redirectUri=String((env as any).GOOGLE_REDIRECT_URI||origin+"/api/account/google/callback");
 const url=new URL("https://accounts.google.com/o/oauth2/v2/auth");
 url.searchParams.set("client_id",clientId);url.searchParams.set("redirect_uri",redirectUri);url.searchParams.set("response_type","code");url.searchParams.set("scope","openid email profile");url.searchParams.set("state",state);url.searchParams.set("prompt","select_account");
 const response=NextResponse.redirect(url);response.cookies.set(COOKIE,state,{httpOnly:true,secure:true,sameSite:"lax",path:"/",maxAge:600});return response;
}