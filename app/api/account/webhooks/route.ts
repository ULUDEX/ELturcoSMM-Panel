import { NextResponse } from "next/server";
import { currentCustomer } from "@/lib/customer-auth";
import { webhookList,webhookCreate,webhookAction,eventList } from "@/lib/api-webhooks";
import { apiHeaders } from "@/lib/customer-api";
import { errorResponse,positiveId,type ApiUser } from "@/lib/api-contract";
export async function GET(request:Request){const user=await currentCustomer();if(!user)return NextResponse.json({error:'Giriş yapmalısın.'},{status:401,headers:apiHeaders});try{return NextResponse.json(await webhookList(user as ApiUser),{headers:apiHeaders})}catch(error){return errorResponse(error,request)}}
export async function POST(request:Request){
 const user=await currentCustomer();if(!user)return NextResponse.json({error:'Giriş yapmalısın.'},{status:401,headers:apiHeaders});const origin=request.headers.get('origin');if(origin&&origin!==new URL(request.url).origin)return NextResponse.json({error:'Geçersiz kaynak.'},{status:403});
 try{const body:any=await request.json();if(body.action==='create')return NextResponse.json(await webhookCreate(user as ApiUser,body),{status:201,headers:apiHeaders});const action=String(body.action||''),id=positiveId(body.id);if(!['update','delete','test','rotate_secret','deliveries'].includes(action))return NextResponse.json({error:'Geçersiz işlem.'},{status:400});const method=action==='delete'?'DELETE':action==='update'?'PATCH':action==='deliveries'?'GET':'POST';return NextResponse.json(await webhookAction(id,user as ApiUser,new Request(request.url,{method}),body,['test','rotate_secret','deliveries'].includes(action)?action:''),{headers:apiHeaders})}catch(error){return errorResponse(error,request)}
}
