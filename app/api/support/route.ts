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
export async function POST(request:Request){
 const customer=await currentCustomer();
 if(!customer)return NextResponse.json({error:"Destek için giriş yapmalısın.",loginRequired:true},{status:401});
 const body=await request.json() as any;
 if(!String(body.message||"").trim())return NextResponse.json({error:"Mesaj boş olamaz."},{status:400});
 let key=String(body.key||""),thread:any=key?await env.DB.prepare("SELECT id FROM support_threads WHERE public_key=? AND email=?").bind(key,customer.email).first():null;
 if(!thread){key=crypto.randomUUID();thread=await env.DB.prepare("INSERT INTO support_threads(public_key,customer_name,email,status,created_at,updated_at) VALUES(?,?,?,'open',?,?) RETURNING id").bind(key,customer.name,customer.email,now(),now()).first()}
 await env.DB.prepare("INSERT INTO support_messages(thread_id,sender,message,created_at) VALUES(?,'customer',?,?)").bind(thread.id,String(body.message).trim().slice(0,2000),now()).run();
 await env.DB.prepare("UPDATE support_threads SET updated_at=?,status='open' WHERE id=?").bind(now(),thread.id).run();
 return NextResponse.json({ok:true,key});
}