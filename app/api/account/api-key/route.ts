import { env } from "cloudflare:workers";
import { NextResponse } from "next/server";
import { currentCustomer,digest,randomHex } from "@/lib/customer-auth";
import { privatePreview } from "@/lib/private-preview";
import { apiHeaders } from "@/lib/customer-api";

export const dynamic="force-dynamic";
export async function GET() {
  const user=await currentCustomer();if(!user)return NextResponse.json({error:"Giriş yapmalısın."},{status:401,headers:apiHeaders});
  const result=await env.DB!.prepare("SELECT id,prefix,label,created_at createdAt,last_used_at lastUsedAt,revoked_at revokedAt FROM customer_api_keys WHERE user_id=? ORDER BY id DESC LIMIT 100").bind(user.id).all();
  const keys=result.results as any[],key=keys.find(k=>!k.revokedAt)||null;
  return NextResponse.json({key,keys,endpoint:"/api/v2",legacyEndpoint:"/api/v1",restEndpoint:"/api/v3",currency:"TRY",resellerRequired:false},{headers:apiHeaders});
}
export async function POST(request:Request) {
  const user=await currentCustomer();if(!user)return NextResponse.json({error:"Giriş yapmalısın."},{status:401,headers:apiHeaders});
  const origin=request.headers.get('origin');if(origin&&origin!==new URL(request.url).origin)return NextResponse.json({error:"Geçersiz kaynak."},{status:403});
  try {
    const {action,id,label}=await request.json() as {action?:string;id?:number;label?:string};
    if(!['create','mint','rotate','revoke'].includes(action||'')||(id!==undefined&&(!Number.isSafeInteger(id)||id<1)))return NextResponse.json({error:"Geçersiz işlem."},{status:400});
    const at=Math.floor(Date.now()/1000);
    if(action==='revoke'){await env.DB!.prepare("UPDATE customer_api_keys SET revoked_at=? WHERE user_id=? AND revoked_at IS NULL"+(id===undefined?'':' AND id=?')).bind(at,user.id,...(id===undefined?[]:[id])).run();return NextResponse.json({ok:true},{headers:apiHeaders});}
    if(action==='create'&&await env.DB!.prepare("SELECT id FROM customer_api_keys WHERE user_id=? AND revoked_at IS NULL").bind(user.id).first())return NextResponse.json({error:"Aktif anahtarın var. Değiştirmek için yenileyi kullan."},{status:409,headers:apiHeaders});
    if(label!==undefined&&(typeof label!=='string'||label.trim().length<2||label.length>80))return NextResponse.json({error:"Etiket 2–80 karakter olmalı."},{status:400});
    if(id!==undefined&&!await env.DB!.prepare('SELECT id FROM customer_api_keys WHERE id=? AND user_id=? AND revoked_at IS NULL').bind(id,user.id).first())return NextResponse.json({error:'Anahtar bulunamadı.'},{status:404});
    const token=`ets_${privatePreview()?'test':'live'}_${randomHex(32)}`,prefix=token.slice(0,17);
    if(action==='mint'){const made=await env.DB!.prepare('INSERT INTO customer_api_keys(user_id,token_hash,prefix,label,created_at) SELECT ?,?,?,?,? WHERE (SELECT COUNT(*) FROM customer_api_keys WHERE user_id=? AND revoked_at IS NULL)<20 RETURNING id').bind(user.id,await digest(token),prefix,label?.trim()||'API key',at,user.id).first();if(!made)return NextResponse.json({error:'En fazla 20 aktif anahtar oluşturabilirsin.'},{status:409});return NextResponse.json({ok:true,token,prefix,id:(made as any).id},{headers:apiHeaders});}
    await env.DB!.batch([
      env.DB!.prepare("UPDATE customer_api_keys SET revoked_at=? WHERE user_id=? AND revoked_at IS NULL"+(id===undefined?'':' AND id=?')).bind(at,user.id,...(id===undefined?[]:[id])),
      env.DB!.prepare("INSERT INTO customer_api_keys(user_id,token_hash,prefix,label,created_at) VALUES(?,?,?,?,?)").bind(user.id,await digest(token),prefix,label?.trim()||'API key',at),
    ]);
    return NextResponse.json({ok:true,token,prefix,message:"Bu anahtar yalnızca şimdi gösterilir. Güvenli bir yerde sakla."},{headers:apiHeaders});
  }catch{return NextResponse.json({error:"Anahtar işlemi tamamlanamadı. Yenileyip tekrar dene."},{status:503,headers:apiHeaders});}
}
