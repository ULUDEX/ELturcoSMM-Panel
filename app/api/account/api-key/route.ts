import { env } from "cloudflare:workers";
import { NextResponse } from "next/server";
import { currentCustomer,digest,randomHex } from "@/lib/customer-auth";
import { privatePreview } from "@/lib/private-preview";
import { apiHeaders } from "@/lib/customer-api";

export const dynamic="force-dynamic";
export async function GET() {
  const user=await currentCustomer();if(!user)return NextResponse.json({error:"Giriş yapmalısın."},{status:401,headers:apiHeaders});
  const key=await env.DB!.prepare("SELECT id,prefix,created_at createdAt,last_used_at lastUsedAt FROM customer_api_keys WHERE user_id=? AND revoked_at IS NULL").bind(user.id).first();
  return NextResponse.json({key,endpoint:"/api/v1",currency:"TRY",resellerRequired:false},{headers:apiHeaders});
}
export async function POST(request:Request) {
  const user=await currentCustomer();if(!user)return NextResponse.json({error:"Giriş yapmalısın."},{status:401,headers:apiHeaders});
  const origin=request.headers.get('origin');if(origin&&origin!==new URL(request.url).origin)return NextResponse.json({error:"Geçersiz kaynak."},{status:403});
  try {
    const {action}=await request.json() as {action?:string};
    if(!['create','rotate','revoke'].includes(action||''))return NextResponse.json({error:"Geçersiz işlem."},{status:400});
    const at=Math.floor(Date.now()/1000);
    if(action==='revoke'){await env.DB!.prepare("UPDATE customer_api_keys SET revoked_at=? WHERE user_id=? AND revoked_at IS NULL").bind(at,user.id).run();return NextResponse.json({ok:true},{headers:apiHeaders});}
    if(action==='create'&&await env.DB!.prepare("SELECT id FROM customer_api_keys WHERE user_id=? AND revoked_at IS NULL").bind(user.id).first())return NextResponse.json({error:"Aktif anahtarın var. Değiştirmek için yenileyi kullan."},{status:409,headers:apiHeaders});
    const token=`ets_${privatePreview()?'test':'live'}_${randomHex(32)}`,prefix=token.slice(0,17);
    await env.DB!.batch([
      env.DB!.prepare("UPDATE customer_api_keys SET revoked_at=? WHERE user_id=? AND revoked_at IS NULL").bind(at,user.id),
      env.DB!.prepare("INSERT INTO customer_api_keys(user_id,token_hash,prefix,created_at) VALUES(?,?,?,?)").bind(user.id,await digest(token),prefix,at),
    ]);
    return NextResponse.json({ok:true,token,prefix,message:"Bu anahtar yalnızca şimdi gösterilir. Güvenli bir yerde sakla."},{headers:apiHeaders});
  }catch{return NextResponse.json({error:"Anahtar işlemi tamamlanamadı. Yenileyip tekrar dene."},{status:503,headers:apiHeaders});}
}
