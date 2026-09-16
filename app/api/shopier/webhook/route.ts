import { env } from "cloudflare:workers";
import { NextResponse } from "next/server";

const enc=new TextEncoder();
function hex(bytes:ArrayBuffer){return Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,"0")).join("")}
function safeEqual(a:string,b:string){if(a.length!==b.length)return false;let out=0;for(let i=0;i<a.length;i++)out|=a.charCodeAt(i)^b.charCodeAt(i);return out===0}

export async function POST(r:Request){
 const secret=String((env as any).SHOPIER_WEBHOOK_SECRET||"");
 if(!secret)return NextResponse.json({error:"Shopier entegrasyonu aktif değil."},{status:503});
 const body=await r.text(),received=r.headers.get("shopier-signature")||"";
 const key=await crypto.subtle.importKey("raw",enc.encode(secret),{name:"HMAC",hash:"SHA-256"},false,["sign"]);
 const expected=hex(await crypto.subtle.sign("HMAC",key,enc.encode(body)));
 if(!safeEqual(expected.toLowerCase(),received.toLowerCase()))return NextResponse.json({error:"Geçersiz imza."},{status:401});
 const eventHash=hex(await crypto.subtle.digest("SHA-256",enc.encode(body)));
 const exists=await env.DB.prepare("SELECT id FROM shopier_payments WHERE raw_event_hash=? LIMIT 1").bind(eventHash).first();
 if(exists)return NextResponse.json({ok:true,duplicate:true});
 // Ödeme alan eşlemesi, Shopier hesabındaki gerçek event örneği ve sipariş API doğrulamasıyla etkinleştirilecek.
 // Bu aşamada hiçbir bildirim müşteri bakiyesine para yazamaz.
 return NextResponse.json({ok:true,verified:true,pendingActivation:true});
}
