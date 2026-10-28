import { env } from "cloudflare:workers";
import { authenticateApiKey, consumeApiRequest, apiHeaders } from "./customer-api";
import { digest } from "./customer-auth";
import { blocked } from "./admin-controls";

export type ApiUser={keyId:number;id:number;name:string;email:string;avatar:string;balance:number};
export const API_VERSION="2026-10-29";
const rateWindows=new WeakMap<Request,{remaining:number}>();
// Only errors produced by implemented operations are advertised.
export const API_ERRORS:Record<string,[number,string,string]>={
 missing_api_key:[401,"API anahtarı gerekli.","API key is required."],invalid_api_key:[401,"API anahtarı geçersiz.","Invalid API key."],revoked_api_key:[401,"API anahtarı iptal edilmiş.","This API key was revoked."],account_banned:[403,"Hesap erişime kapalı.","Account access is blocked."],
 invalid_json:[400,"Geçerli bir JSON nesnesi gönder.","Send a valid JSON object."],unsupported_content_type:[415,"JSON veya form gövdesi kullan.","Use JSON or form-urlencoded."],method_not_allowed:[405,"Bu metot desteklenmiyor.","Method not allowed."],payload_too_large:[413,"İstek gövdesi çok büyük.","Payload too large."],
 missing_parameter:[400,"Zorunlu parametre eksik.","Missing required parameter."],invalid_parameter:[400,"Parametre geçersiz.","Invalid parameter."],invalid_link:[400,"Geçerli bir HTTP(S) bağlantısı gerekli.","A valid HTTP(S) link is required."],invalid_quantity:[400,"Adet pozitif bir tam sayı olmalı.","Quantity must be a positive integer."],quantity_out_of_range:[400,"Adet hizmet limitleri dışında.","Quantity is outside the service limits."],missing_required_field:[400,"Zorunlu hizmet alanı eksik veya geçersiz.","A required service field is missing or invalid."],invalid_comments:[400,"Yorum satırları ve adet uyuşmuyor.","Comment lines do not match the quantity."],dripfeed_not_supported:[400,"Bu API sürümünde kademeli gönderim desteklenmiyor.","Dripfeed is not supported by this API release."],
 service_inactive:[400,"Hizmet siparişe kapalı.","Service is inactive."],invalid_cursor:[400,"Sayfalama imleci geçersiz.","Invalid pagination cursor."],invalid_limit:[400,"Limit 1–500 arasında olmalı.","Limit must be between 1 and 500."],invalid_webhook_url:[400,"Herkese açık bir HTTPS adresi gerekli.","A public HTTPS URL is required."],invalid_events:[400,"Olay türü geçersiz.","Invalid event type."],batch_too_large:[400,"Tek istekte en fazla 50 sipariş olabilir.","A batch can contain at most 50 orders."],cancel_not_supported:[400,"Hizmet iptal desteklemiyor.","Cancellation is not supported."],refill_not_supported:[400,"Hizmet telafi desteklemiyor.","Refill is not supported."],
 unknown_endpoint:[404,"API yolu bulunamadı.","Unknown endpoint."],service_not_found:[404,"Hizmet bulunamadı.","Service not found."],order_not_found:[404,"Hesabında böyle bir sipariş yok.","Order not found in your account."],refill_not_found:[404,"Hesabında böyle bir telafi kaydı yok.","Refill not found in your account."],webhook_not_found:[404,"Hesabında böyle bir webhook yok.","Webhook not found in your account."],
 order_not_cancelable:[409,"Sipariş şu anda iptal edilemiyor.","Order cannot be canceled in its current state."],order_not_completed:[409,"Telafi için sipariş tamamlanmış olmalı.","Order must be completed before refill."],request_in_progress:[409,"İşlem bekliyor; tekrar göndermeden önce durumunu kontrol et.","Request is pending; check its outcome before retrying."],idempotency_key_reuse:[409,"Bu işlem anahtarı farklı bilgilerle kullanılmış.","Idempotency key was reused with a different body."],idempotency_in_progress:[409,"Aynı işlem hâlâ sürüyor veya sonucu belirsiz.","The same request is processing or its outcome is uncertain."],webhook_limit_reached:[409,"En fazla 5 webhook tanımlanabilir.","At most 5 webhooks are allowed."],insufficient_balance:[402,"Bakiyen yetersiz.","Insufficient balance."],rate_limit_exceeded:[429,"İstek sınırı aşıldı.","Rate limit exceeded."],provider_error:[503,"Sağlayıcı işlemi tamamlayamadı.","The provider could not complete the operation."],service_temporarily_unavailable:[503,"Hizmet bağlantısı geçici olarak kullanılamıyor.","Service is temporarily unavailable."],private_preview:[409,"Özel test ortamında ücretli işlemler kapalı.","Paid operations are disabled in private preview."],internal_error:[500,"Beklenmeyen bir hata oluştu; işlem geçmişini kontrol et.","Unexpected error; check your history before retrying."],
};
export class ApiFault extends Error {constructor(public code:string,public param:string|null=null){super(code)}}
export const fault=(code:string,param:string|null=null):never=>{throw new ApiFault(code,param)};
export const lang=(request:Request)=>{
 const value=new URL(request.url).searchParams.get('lang')||request.headers.get('accept-language')?.split(',')[0].split(';')[0]||'en';
 const locale=value.toLowerCase().split('-')[0];return ['tr','en','es','fr','uk','it','ru','de','pt'].includes(locale)?(locale==='pt'?'pt-BR':locale):'en';
};
export function errorObject(code:string,request:Request,param:string|null=null,requestId='req_'+crypto.randomUUID()){
 const item=API_ERRORS[code]||API_ERRORS.internal_error,status=item[0];
 return {object:'error',error:{type:status===401?'authentication_error':status===429?'rate_limit_error':status>=500?'api_error':'invalid_request_error',code:API_ERRORS[code]?code:'internal_error',message:item[lang(request)==='tr'?1:2],param,doc_url:new URL('/api-docs#error-'+code,request.url).href,request_id:requestId}};
}
export function apiResponse(data:unknown,status=200,request?:Request,extra:Record<string,string>={}){
 const requestId='req_'+crypto.randomUUID();
 const headers={...apiHeaders,'content-type':'application/json; charset=utf-8','x-api-version':API_VERSION,'x-request-id':requestId,'ratelimit-limit':'60',...(request&&rateWindows.has(request)?{'ratelimit-remaining':String(rateWindows.get(request)!.remaining)}:{}),'ratelimit-reset':String((Math.floor(Date.now()/60000)+1)*60),...extra};
 return new Response(JSON.stringify(data),{status,headers});
}
export function errorResponse(error:unknown,request:Request){const known=error instanceof ApiFault?error:new ApiFault('internal_error');const data=errorObject(known.code,request,known.param);return apiResponse(data,API_ERRORS[known.code]?.[0]||500,request,{'x-request-id':data.error.request_id,...(known.code==='rate_limit_exceeded'?{'retry-after':String(60-Math.floor(Date.now()/1000)%60)}:{})})}
export async function readApiBody(request:Request){
 if(Number(request.headers.get('content-length'))>20000)fault('payload_too_large');
 const kind=(request.headers.get('content-type')||'').split(';')[0].trim();if(!['application/json','application/x-www-form-urlencoded'].includes(kind))fault('unsupported_content_type');
 const reader=request.body?.getReader(),decoder=new TextDecoder();let raw='',size=0;if(reader){while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>20000){await reader.cancel();fault('payload_too_large')}raw+=decoder.decode(value,{stream:true})}raw+=decoder.decode()}
 let data:any;try{data=kind==='application/json'?JSON.parse(raw):Object.fromEntries(new URLSearchParams(raw))}catch{fault('invalid_json')}
 if(!data||typeof data!=='object'||Array.isArray(data))fault('invalid_json');return data;
}
export async function apiUser(request:Request,bodyKey?:string){
 const token=(request.headers.get('authorization')||'').replace(/^Bearer\s+/i,'')||request.headers.get('x-api-key')||bodyKey||'';
 if(!token)fault('missing_api_key');
 const user=await authenticateApiKey(token);
 if(!user){const old:any=await env.DB.prepare('SELECT revoked_at FROM customer_api_keys WHERE token_hash=?').bind(await digest(token)).first();fault(old?.revoked_at?'revoked_api_key':'invalid_api_key')}
 const allowed=await consumeApiRequest(user.keyId);const usage:any=await env.DB.prepare('SELECT requests FROM customer_api_usage WHERE key_id=? AND minute=?').bind(user.keyId,Math.floor(Date.now()/60000)).first();rateWindows.set(request,{remaining:Math.max(0,60-Number(usage?.requests||0))});if(!allowed)fault('rate_limit_exceeded');
 if(await blocked(request,user.email))fault('account_banned');return user as ApiUser;
}
export function positiveId(value:unknown,code='invalid_parameter',param='id'){if(!/^\d+$/.test(String(value||''))||!Number.isSafeInteger(Number(value))||Number(value)<1)fault(code,param);return Number(value)}
export function pageArgs(url:URL){const limit=url.searchParams.has('limit')?positiveId(url.searchParams.get('limit'),'invalid_limit','limit'):100;if(limit>500)fault('invalid_limit','limit');const cursor=url.searchParams.get('starting_after');return {limit,cursor:cursor===null?null:positiveId(cursor,'invalid_cursor','starting_after')}}
export function listEnvelope(rows:any[],limit:number,kind:string){const has_more=rows.length>limit,data=rows.slice(0,limit);return {object:'list',data,has_more,next_cursor:has_more?String(data.at(-1)?.cursor??data.at(-1)?.id):null}}
export const iso=(seconds:number)=>new Date(Number(seconds)*1000).toISOString();
export const money=(cents:number)=>(Number(cents)/100).toFixed(4);
export function cents(value:unknown){if(typeof value!=='string'&&typeof value!=='number')fault('invalid_parameter');const s=String(value);if(!/^\d{1,9}(?:\.\d{1,2})?$/.test(s))fault('invalid_parameter');return Number(s.split('.')[0])*100+Number((s.split('.')[1]||'').padEnd(2,'0'))}
export function status(value:unknown){const s=String(value||'').toLocaleLowerCase('tr-TR');if(/partial|kısmi/.test(s))return 'partial';if(/cancel|iptal|refund|iade/.test(s))return 'canceled';if(/complete|success|tamam|bitti/.test(s))return 'completed';if(/progress|process|işlen|başladı/.test(s))return 'in_progress';if(/fail|error|reject|başarısız/.test(s))return 'failed';return 'pending'}
export function statusLabel(value:unknown,locale='en'){const s=status(value);return ({tr:{pending:'Beklemede',in_progress:'İşleniyor',completed:'Tamamlandı',partial:'Kısmi',canceled:'İptal edildi',failed:'Başarısız'},en:{pending:'Pending',in_progress:'In progress',completed:'Completed',partial:'Partial',canceled:'Canceled',failed:'Failed'}} as any)[locale==='tr'?'tr':'en'][s]}
export function fromSharedError(data:any,http:number){const text=String(data?.error||'');if(http===402)return 'insufficient_balance';if(/özel test/i.test(text))return 'private_preview';if(/Idempotency-Key.*different|different parameters/i.test(text))return 'idempotency_key_reuse';if(/processing or outcome/i.test(text))return 'idempotency_in_progress';if(http===404)return 'order_not_found';if(http===409)return 'request_in_progress';if(http===403)return 'account_banned';if(http===400&&/zorunlu/.test(text))return 'missing_required_field';if(http===400)return 'invalid_parameter';return 'provider_error'}
