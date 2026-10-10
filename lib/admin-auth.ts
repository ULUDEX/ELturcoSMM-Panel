import { env } from "cloudflare:workers";
const db=()=>{const value=env.DB;if(!value)throw new Error("Veritabanı bağlantısı yapılandırılmamış.");return value};
import { cookies } from "next/headers";
import { activity } from "./admin-controls";
const COOKIE="elturco_admin";const enc=new TextEncoder();
function secret(){const value=String((env as any).ADMIN_SESSION_SECRET||"");if(value.length<32)throw new Error("Admin oturum anahtarı yapılandırılmamış.");return value}
async function signature(value:string){const key=await crypto.subtle.importKey("raw",enc.encode(secret()),{name:"HMAC",hash:"SHA-256"},false,["sign"]);const bytes=new Uint8Array(await crypto.subtle.sign("HMAC",key,enc.encode(value)));return Array.from(bytes,b=>b.toString(16).padStart(2,"0")).join("")}
export async function createAdminToken(){const value=String(Date.now()+1000*60*60*12);return value+"."+await signature(value)}
async function rootAdmin(){const raw=(await cookies()).get(COOKIE)?.value;if(!raw)return false;const [expires,sig]=raw.split(".");if(!expires||!sig||Number(expires)<=Date.now())return false;try{return sig===await signature(expires)}catch{return false}}
export const adminCookie={name:COOKIE,options:{httpOnly:true,secure:true,sameSite:"lax" as const,path:"/",maxAge:60*60*12}};

export async function adminIdentity(){
 if(await rootAdmin())return {id:0,name:"Yönetici",root:true,permissions:["*"]};
 const raw=(await cookies()).get("elturco_staff")?.value;if(!raw)return null;
 const bytes=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(raw)),hash=Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,"0")).join("");
 const row:any=await db().prepare("SELECT s.id,s.name,r.data FROM admin_staff_sessions t JOIN admin_staff s ON s.id=t.staff_id JOIN admin_records r ON r.id=s.role_id AND r.module='role-permissions' AND r.active=1 WHERE t.token_hash=? AND t.expires_at>? AND s.active=1").bind(hash,Math.floor(Date.now()/1000)).first();
 if(!row)return null;return {id:row.id,name:row.name,root:false,permissions:JSON.parse(row.data).permissions||[]};
}
export async function isAdmin(request?:Request){
 const identity=await adminIdentity();if(!identity)return false;if(identity.root){if(request&&!["GET","HEAD"].includes(request.method)&&!request.url.includes("/api/admin/modules"))await activity(identity.name,"admin","authorized",new URL(request.url).pathname);return true}if(!request)return true;
 const u=new URL(request.url),write=!['GET','HEAD'].includes(request.method);let module="overview";
 if(u.pathname==="/api/admin/modules"){
  let body:any={};if(write)try{body=await request.clone().json()}catch{}module=u.searchParams.get("module")||body.module||"overview";
  if(module==="session")return true;
  if(["staffs","role-permissions"].includes(module))return false;
 }else if(u.pathname==="/api/admin/operations"){
  let body:any={};if(write)try{body=await request.clone().json()}catch{}
  const views:any={transactions:"finance",methods:"payments","marketplace-orders":"marketplace"};const actions:any={transaction:"finance",method:"payments","method-update":"payments",settings:"settings","publish-announcement":"news","customer-balance":"customers","review-status":"reviews","music-save":"music","retry-order":"orders",reply:"support","marketplace-order":"marketplace","smtp-test":"integration"};
  module=write?(body.action==="status"?({order:"orders",payment:"payments",support:"support"} as any)[body.target]:actions[body.action]||({transaction:"finance",method:"payments",music:"music",review:"reviews"} as any)[u.searchParams.get("kind")||""]):views[u.searchParams.get("view")||""]||u.searchParams.get("view")||"overview";
 }else if(u.pathname==="/api/services"||u.pathname==="/api/admin/provider-sync")module="services";
 else if(u.pathname==="/api/admin/media")module="music";
 else return false;
 const allowed=identity.permissions.includes(`${module}:${write?"write":"read"}`);if(allowed&&write&&u.pathname!=="/api/admin/modules")await activity(identity.name,"admin","authorized",u.pathname);return allowed;
}
