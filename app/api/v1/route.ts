import { handleApiAction } from "@/lib/customer-api-actions";
import { env } from "cloudflare:workers";
import { NextResponse } from "next/server";
import { authenticateApiKey,consumeApiRequest,apiHeaders } from "@/lib/customer-api";
import { blocked } from "@/lib/admin-controls";
const reply=(data:unknown,status=200)=>NextResponse.json(data,{status,headers:apiHeaders});
export async function POST(request:Request) {
 try {
  if(Number(request.headers.get('content-length'))>20000)return reply({error:'Request too large'},413);
  const raw=await request.text();if(raw.length>20000)return reply({error:'Request too large'},413);
  let body:any;try{body=(request.headers.get('content-type')||'').includes('json')?JSON.parse(raw):Object.fromEntries(new URLSearchParams(raw));}catch{return reply({error:'Invalid request'},400);}
  if(!body||typeof body!=='object'||Array.isArray(body))return reply({error:'Invalid request'},400);
  const token=(request.headers.get('authorization')||'').replace(/^Bearer\s+/i,'')||String(body.key||'');
  const user=await authenticateApiKey(token);
  const legacy=!user&&Boolean((env as any).ELTURCO_API_KEY)&&token===(env as any).ELTURCO_API_KEY;
  if(!user&&!(legacy&&body.action==='services'))return reply({error:legacy?'Create an account-scoped API key for order and balance access':'Invalid API key'},401);
  if(user&&!await consumeApiRequest(user.keyId))return reply({error:'Rate limit: 60 requests per minute'},429);
  if(user&&await blocked(request,user.email))return reply({error:'Account unavailable'},403);
  return await handleApiAction(request,body,user);
 }catch{return reply({error:'API request could not be completed. Check order history before retrying an uncertain add request.'},503);}
}
