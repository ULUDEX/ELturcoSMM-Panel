import { env } from "cloudflare:workers";
import { cookies } from "next/headers";
const COOKIE="elturco_admin";const enc=new TextEncoder();
function secret(){const value=String((env as any).ADMIN_SESSION_SECRET||"");if(value.length<32)throw new Error("Admin oturum anahtarı yapılandırılmamış.");return value}
async function signature(value:string){const key=await crypto.subtle.importKey("raw",enc.encode(secret()),{name:"HMAC",hash:"SHA-256"},false,["sign"]);const bytes=new Uint8Array(await crypto.subtle.sign("HMAC",key,enc.encode(value)));return Array.from(bytes,b=>b.toString(16).padStart(2,"0")).join("")}
export async function createAdminToken(){const value=String(Date.now()+1000*60*60*12);return value+"."+await signature(value)}
export async function isAdmin(){const raw=(await cookies()).get(COOKIE)?.value;if(!raw)return false;const [expires,sig]=raw.split(".");if(!expires||!sig||Number(expires)<=Date.now())return false;try{return sig===await signature(expires)}catch{return false}}
export const adminCookie={name:COOKIE,options:{httpOnly:true,secure:true,sameSite:"lax" as const,path:"/",maxAge:60*60*12}};
