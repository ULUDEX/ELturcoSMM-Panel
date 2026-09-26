import { env } from "cloudflare:workers";

type ProviderOrder={service:string;link:string;quantity:number;fields?:Record<string,string>;idempotencyKey:string};
type ProviderReply={ok:boolean;data:any;error:string;status:number};
const apiKey=()=>String((env as any).SMM_PROVIDER_API_KEY||"");
const apiVersion=()=>String((env as any).SMM_PROVIDER_API_VERSION||"3")==="2"?2:3;
export function providerConfigured(){return Boolean(apiKey())}
function configuredBase(){return String((env as any).SMM_PROVIDER_API_URL||"https://panelfollows.com/api/v2").replace(/\/$/,"")}
function v3Base(){const base=configuredBase();return /\/api\/v[23](?:\/tr)?$/i.test(base)?base.replace(/\/api\/v[23](?:\/tr)?$/i,"/api/v3"):base+"/api/v3"}
function v2Base(){const base=configuredBase();return /\/api\/v[23](?:\/tr)?$/i.test(base)?base.replace(/\/api\/v[23](?:\/tr)?$/i,"/api/v2"):base+"/api/v2"}
async function v3(path:string,method="GET",body?:unknown,idempotencyKey?:string):Promise<ProviderReply>{
 if(!apiKey())return{ok:false,data:null,error:"PanelFollows API anahtarı sunucuda tanımlı değil.",status:503};
 try{const headers:Record<string,string>={authorization:`Bearer ${apiKey()}`,accept:"application/json","accept-language":"tr"};if(body!==undefined)headers["content-type"]="application/json";if(idempotencyKey)headers["idempotency-key"]=idempotencyKey;
  const response=await fetch(`${v3Base()}${path}`,{method,headers,...(body!==undefined?{body:JSON.stringify(body)}:{})}),data:any=await response.json().catch(()=>({}));
  const error=String(data?.error?.message??data?.message??data?.error??`PanelFollows v3 HTTP ${response.status}`).slice(0,500);
  return{ok:response.ok&&!data?.error,data,error,status:response.status};
 }catch(error){return{ok:false,data:null,error:(error instanceof Error?error.message:"PanelFollows bağlantı hatası").slice(0,500),status:0}}
}
async function v2(action:string,params:Record<string,string>={}):Promise<ProviderReply>{
 if(!apiKey())return{ok:false,data:null,error:"PanelFollows API anahtarı sunucuda tanımlı değil.",status:503};
 try{const response=await fetch(v2Base(),{method:"POST",headers:{"content-type":"application/x-www-form-urlencoded",accept:"application/json"},body:new URLSearchParams({key:apiKey(),action,...params}).toString()}),data:any=await response.json().catch(()=>({}));
  const error=String(data?.error??data?.message??`PanelFollows v2 HTTP ${response.status}`).slice(0,500);
  return{ok:response.ok&&!data?.error,data,error,status:response.status};
 }catch(error){return{ok:false,data:null,error:(error instanceof Error?error.message:"PanelFollows bağlantı hatası").slice(0,500),status:0}}
}
export async function previewProviderOrder(order:Omit<ProviderOrder,"idempotencyKey">){
 if(apiVersion()===2)return{ok:true};
 const payload={service:Number(order.service),link:order.link,quantity:order.quantity,...(order.fields||{})};
 const result=await v3("/orders/preview","POST",payload);
 return{ok:result.ok,error:result.error,status:result.status,data:result.data};
}
export async function forwardOrder(order:ProviderOrder){
 if(apiVersion()===2){const result=await v2("add",{service:order.service,link:order.link,quantity:String(order.quantity),...(order.fields||{})});const id=String(result.data?.order??result.data?.order_id??result.data?.id??"");return{forwarded:result.ok&&Boolean(id),providerOrderId:id,error:result.ok?"Sağlayıcı sipariş numarası döndürmedi.":result.error,uncertain:result.status===0||result.status>=500}}
 const payload={service:Number(order.service),link:order.link,quantity:order.quantity,...(order.fields||{})};
 const result=await v3("/orders","POST",payload,order.idempotencyKey);
 const responseData=result.data?.data??result.data;const id=String(responseData?.id??responseData?.order?.id??responseData?.order_id??responseData?.order??"");
 return{forwarded:result.ok&&Boolean(id),providerOrderId:id,error:result.ok?"Sağlayıcı sipariş numarası döndürmedi.":result.error,uncertain:result.status===0||result.status>=500};
}
export async function getProviderStatuses(ids:string[]){
 const clean=ids.map(String).filter(Boolean);if(!clean.length)return{};
 if(apiVersion()===3){const entries=await Promise.all(clean.map(async id=>{const result=await v3(`/orders/${encodeURIComponent(id)}`);const order=result.data?.data??result.data?.order??result.data;return result.ok&&order?[[id,order] as const]:null}));return Object.fromEntries(entries.filter(Boolean) as [string,any][])}
 const result=await v2("status",{orders:clean.join(",")});if(!result.ok)return{};
 const data=result.data?.data??result.data;return Array.isArray(data)?Object.fromEntries(data.map((x:any)=>[String(x.id??x.order),x])):(data&&typeof data==="object"?data:{});
}
export async function getProviderRefillStatus(refillId:string){const result=apiVersion()===3?await v3(`/refills/${encodeURIComponent(refillId)}`):await v2("refill_status",{refill:String(refillId)});if(!result.ok)return{ok:false,error:result.error};const data=result.data?.data??result.data;return{ok:true,status:String(data?.status??data?.refill_status??"pending"),data}}
export async function requestProviderOrderAction(action:"refill"|"cancel",orderId:string){
 if(apiVersion()===2){const result=await v2(action,{[action==="cancel"?"orders":"order"]:String(orderId)});const refillId=String(result.data?.refill??result.data?.refill_id??result.data?.id??"");return{ok:result.ok,error:result.error,refillId}}
 const result=await v3(`/orders/${encodeURIComponent(orderId)}/${action}`,"POST",{});
 const responseData=result.data?.data??result.data;const refillId=String(responseData?.id??responseData?.refill?.id??responseData?.refill_id??"");return{ok:result.ok,error:result.error,refillId};
}
