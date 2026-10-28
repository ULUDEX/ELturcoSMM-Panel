import { env } from "cloudflare:workers";
import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { approveResellerInvoice } from "@/lib/resellers";
export async function GET(request:Request){
 if(!await isAdmin(request))return NextResponse.json({error:'Yetkisiz işlem.'},{status:403});
 const rows=await env.DB!.prepare('SELECT i.*,u.name,u.email,s.business_name,s.website,s.period_end FROM reseller_invoices i JOIN customer_users u ON u.id=i.user_id JOIN reseller_subscriptions s ON s.user_id=i.user_id ORDER BY i.id DESC LIMIT 100').all();
 return NextResponse.json(rows.results,{headers:{'cache-control':'private, no-store'}});
}
export async function POST(request:Request){
 if(!await isAdmin(request))return NextResponse.json({error:'Yetkisiz işlem.'},{status:403});
 try{const body:any=await request.json();if(body.action!=='approve'||!Number.isSafeInteger(body.id))return NextResponse.json({error:'Geçersiz işlem.'},{status:400});return NextResponse.json({ok:true,...await approveResellerInvoice(body.id,String(body.paymentReference||''))});}
 catch(error){return NextResponse.json({error:error instanceof Error?error.message:'Ödeme doğrulanamadı.'},{status:400});}
}
