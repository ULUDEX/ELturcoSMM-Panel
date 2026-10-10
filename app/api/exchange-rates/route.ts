import { env } from 'cloudflare:workers';
import { NextResponse } from 'next/server';
const currencies=['TRY','USD','EUR','GBP','UAH','RUB','BRL'];
export async function GET(){
 if(!env.DB)return NextResponse.json({rates:{TRY:1},unavailable:true},{status:503});
 const stored:any=await env.DB.prepare("SELECT value FROM site_settings WHERE key='display_exchange_rates'").first();let saved:any=null;try{saved=JSON.parse(stored?.value||'null')}catch{}
 if(!saved||Date.now()/1000-Number(saved.fetchedAt)>86400){
  try{const response=await fetch('https://open.er-api.com/v6/latest/TRY',{signal:AbortSignal.timeout(8000)}),data:any=await response.json();if(!response.ok||data.result!=='success'||data.base_code!=='TRY'||currencies.some(code=>!Number.isFinite(data.rates?.[code])||data.rates[code]<=0))throw Error();
   saved={rates:Object.fromEntries(currencies.map(code=>[code,data.rates[code]])),updatedAt:data.time_last_update_unix,fetchedAt:Math.floor(Date.now()/1000)};
   await env.DB.prepare("INSERT INTO site_settings(key,value,updated_at) VALUES('display_exchange_rates',?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at").bind(JSON.stringify(saved),saved.fetchedAt).run();
  }catch{if(!saved)return NextResponse.json({rates:{TRY:1},unavailable:true},{status:503})}
 }
 return NextResponse.json({...saved,stale:Date.now()/1000-saved.fetchedAt>86400},{headers:{'cache-control':'public, max-age=3600'}});
}
