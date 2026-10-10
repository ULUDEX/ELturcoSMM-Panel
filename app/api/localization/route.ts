import { NextResponse } from 'next/server';
import { LOCALES,translateTexts,manualTranslations,cachedTranslations } from '@/lib/localization';
export async function GET(request:Request){const locale=new URL(request.url).searchParams.get('locale')||'tr';if(!LOCALES.includes(locale as any))return NextResponse.json({error:'Invalid locale'},{status:400});return NextResponse.json({translations:await manualTranslations(locale)},{headers:{'cache-control':'no-store'}})}
const visits=new Map<string,{at:number,count:number}>();
export async function POST(request:Request){
 const origin=request.headers.get('origin');if(origin&&origin!==new URL(request.url).origin)return NextResponse.json({error:'Origin rejected'},{status:403});
 const ip=request.headers.get('cf-connecting-ip')||'local',time=Date.now(),visit=visits.get(ip);if(visit&&time-visit.at<60000&&visit.count>=40)return NextResponse.json({error:'Try again shortly'},{status:429});visits.set(ip,{at:visit&&time-visit.at<60000?visit.at:time,count:visit&&time-visit.at<60000?visit.count+1:1});if(visits.size>5000)visits.clear();
 let body:any;try{if(Number(request.headers.get('content-length')||0)>40000)throw Error();const raw=await request.text();if(raw.length>40000)throw Error();body=JSON.parse(raw)}catch{return NextResponse.json({error:'Invalid request'},{status:400})}
 if(!LOCALES.includes(body.locale)||!Array.isArray(body.texts)||body.texts.length>(body.cacheOnly===true?96:24)||body.texts.some((x:any)=>typeof x!=='string'||x.length>3000)||body.texts.join('').length>(body.cacheOnly===true?24000:12000))return NextResponse.json({error:'Invalid translation batch'},{status:400});
 try{return NextResponse.json(await (body.cacheOnly===true?cachedTranslations(body.locale,body.texts):translateTexts(body.locale,body.texts)),{headers:{'cache-control':'no-store'}})}catch{return NextResponse.json({translations:{},pending:body.texts},{status:503})}
}
