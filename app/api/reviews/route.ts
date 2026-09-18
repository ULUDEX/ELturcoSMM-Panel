import { env } from "cloudflare:workers";
import { NextResponse } from "next/server";
import { currentCustomer } from "@/lib/customer-auth";
const now=()=>Math.floor(Date.now()/1000);
async function ensureTable(){await env.DB.prepare("CREATE TABLE IF NOT EXISTS customer_reviews (id INTEGER PRIMARY KEY AUTOINCREMENT, customer_email TEXT NOT NULL UNIQUE, customer_name TEXT NOT NULL, rating INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5), title TEXT NOT NULL DEFAULT '', comment TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1, created_at INTEGER NOT NULL)").run()}
const publicName=(name:string)=>{const parts=name.trim().split(/\s+/);return parts.map((part,index)=>index===0?part:(part[0]||"")+"***").join(" ")};
export async function GET(){await ensureTable();const q=await env.DB.prepare("SELECT id,customer_name name,rating,title,comment,created_at createdAt FROM customer_reviews WHERE active=1 ORDER BY id DESC LIMIT 30").all();return NextResponse.json(q.results)}
export async function POST(request:Request){
 const customer=await currentCustomer();if(!customer)return NextResponse.json({error:"Yorum yazmak için giriş yapmalısın.",loginRequired:true},{status:401});
 await ensureTable();const body=await request.json() as any,rating=Math.floor(Number(body.rating)),title=String(body.title||"").trim().slice(0,80),comment=String(body.comment||"").trim().slice(0,600);
 if(rating<1||rating>5||comment.length<10)return NextResponse.json({error:"1–5 puan ve en az 10 karakterlik yorum gerekli."},{status:400});
 const completed:any=await env.DB.prepare("SELECT id FROM orders WHERE customer_name=? AND status='completed' ORDER BY id DESC LIMIT 1").bind(customer.name).first();
 if(!completed)return NextResponse.json({error:"Yorum için en az bir tamamlanmış sipariş gerekli."},{status:403});
 try{await env.DB.prepare("INSERT INTO customer_reviews(customer_email,customer_name,rating,title,comment,active,created_at) VALUES(?,?,?,?,?,1,?)").bind(customer.email,publicName(customer.name),rating,title,comment,now()).run()}catch{return NextResponse.json({error:"Bu hesap daha önce yorum yaptı."},{status:409})}
 return NextResponse.json({ok:true},{status:201});
}