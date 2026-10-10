import { env } from "cloudflare:workers";
const db=()=>{const value=env.DB;if(!value)throw new Error("Veritabanı bağlantısı yapılandırılmamış.");return value};
export const MODULES = ["overview","reports","orders","dripfeed","subscriptions","cancel","services","finance","support","customers","subscribers","user-activity","blacklist-ip","blacklist-link","blacklist-email","blog-category","blog-posts","staffs","staff-activity","role-permissions","settings","integration","payments","payment-bonuses","modules","news","languages","faqs","cronjobs","marketplace","reviews","music","api"];
export const now = () => Math.floor(Date.now()/1000);
export async function records(module:string) {
 const q:any=await db().prepare("SELECT * FROM admin_records WHERE module=? ORDER BY id DESC").bind(module).all();
 return q.results.map((r:any)=>({...r,data:JSON.parse(r.data)}));
}
export async function activity(actor:string,kind:string,action:string,target="") {
 await db().prepare("INSERT INTO admin_activity(actor,kind,action,target,created_at) VALUES(?,?,?,?,?)").bind(actor,kind,action.slice(0,100),target.slice(0,250),now()).run();
}
export async function blocked(request:Request,email="",link="") {
 const ip=request.headers.get("cf-connecting-ip")||"";
 const q:any=await db().prepare("SELECT module,data FROM admin_records WHERE active=1 AND module IN ('blacklist-ip','blacklist-email','blacklist-link')").all();
 const normalizeIp=(value:string)=>{try{return new URL(`http://${value.includes(":")?`[${value}]`:value}`).hostname.toLowerCase()}catch{return value.toLowerCase()}};
 return q.results.some((r:any)=>{const d=JSON.parse(r.data),value=String(d.value||"").trim();if(!value)return false;
  if(r.module==="blacklist-ip")return Boolean(ip)&&normalizeIp(value)===normalizeIp(ip);
  if(r.module==="blacklist-email")return Boolean(email)&&value.toLowerCase()===email.trim().toLowerCase();
  try {const a=new URL(value.includes("://")?value:`https://${value}`),b=new URL(link);return a.hostname===b.hostname&&(a.pathname==="/"||b.pathname.replace(/\/$/,"")===a.pathname.replace(/\/$/,""));}catch{return false}
 });
}
export async function moduleEnabled(name:string) {
 const rows=await records("modules"),row=rows.find((r:any)=>r.data.name===name);
 return !row || Boolean(row.active);
}
export async function paymentBonus(amount:number) {
 const rows=await records("payment-bonuses");
 const tier=rows.filter((r:any)=>r.active&&r.data.minimum*100<=amount).sort((a:any,b:any)=>b.data.minimum-a.data.minimum)[0];
 return tier?Math.floor(amount*Number(tier.data.percent)/100):0;
}
export async function publicContent(){
 const q:any=await db().prepare("SELECT id,module,data,active FROM admin_records WHERE (active=1 OR module='modules') AND module IN ('faqs','news','languages','modules') ORDER BY id DESC").all();
 return q.results.map((r:any)=>({...r,data:JSON.parse(r.data)}));
}
