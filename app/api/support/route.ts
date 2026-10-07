import { env } from "cloudflare:workers";
import { NextResponse } from "next/server";
import { currentCustomer } from "@/lib/customer-auth";
const now=()=>Math.floor(Date.now()/1000);

export async function GET(request:Request){
 const customer=await currentCustomer();
 if(!customer)return NextResponse.json({error:"Destek için giriş yapmalısın.",loginRequired:true},{status:401});
 const key=new URL(request.url).searchParams.get("key");
 if(!key)return NextResponse.json([]);
 const thread:any=await env.DB.prepare("SELECT id,status FROM support_threads WHERE public_key=? AND email=?").bind(key,customer.email).first();
 if(!thread)return NextResponse.json([]);
 const messages=await env.DB.prepare("SELECT sender,message,created_at createdAt FROM support_messages WHERE thread_id=? ORDER BY id ASC").bind(thread.id).all();
 return NextResponse.json({status:thread.status,messages:messages.results});
}
export async function POST(){
 return NextResponse.json({error:"Destek için canlı sohbeti kullanın.",chatUrl:"https://tawk.to/chat/6ac60b8069205a34bff50751/1k4appsfq?layout=modern"},{status:410});
}
