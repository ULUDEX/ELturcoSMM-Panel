import { env } from "cloudflare:workers";
import { cookies } from "next/headers";

export const CUSTOMER_COOKIE="elturco_customer";
const encoder=new TextEncoder();
const PASSWORD_ITERATIONS=100000;
const hex=(bytes:ArrayBuffer|Uint8Array)=>[...new Uint8Array(bytes)].map(x=>x.toString(16).padStart(2,"0")).join("");
const fromHex=(value:string)=>new Uint8Array((value.match(/.{1,2}/g)||[]).map(x=>parseInt(x,16)));
export const randomHex=(size=32)=>{const bytes=new Uint8Array(size);crypto.getRandomValues(bytes);return hex(bytes)};
export async function digest(value:string){return hex(await crypto.subtle.digest("SHA-256",encoder.encode(value)))}
async function derivePassword(password:string,salt:string,iterations:number){const key=await crypto.subtle.importKey("raw",encoder.encode(password),"PBKDF2",false,["deriveBits"]);return hex(await crypto.subtle.deriveBits({name:"PBKDF2",hash:"SHA-256",salt:fromHex(salt),iterations},key,256))}
export async function passwordHash(password:string,salt:string){return `pbkdf2-sha256$${PASSWORD_ITERATIONS}$${await derivePassword(password,salt,PASSWORD_ITERATIONS)}`}
export async function verifyPassword(password:string,salt:string,expected:string){const parts=expected.split("$"),iterations=parts[0]==="pbkdf2-sha256"?Number(parts[1]):210000,target=parts[0]==="pbkdf2-sha256"?parts[2]:expected;if(!Number.isInteger(iterations)||iterations<50000||iterations>600000||!target)return false;let actual="";try{actual=await derivePassword(password,salt,iterations)}catch{return false}if(actual.length!==target.length)return false;let mismatch=0;for(let i=0;i<actual.length;i++)mismatch|=actual.charCodeAt(i)^target.charCodeAt(i);return mismatch===0}
export async function createCustomerSession(userId:number){const token=randomHex(32),tokenHash=await digest(token),created=Math.floor(Date.now()/1000),expires=created+60*60*24*30;await env.DB.prepare("INSERT INTO customer_sessions(user_id,token_hash,expires_at,created_at) VALUES(?,?,?,?)").bind(userId,tokenHash,expires,created).run();return{token,expires}}
export const customerCookieOptions=(expires?:number)=>({httpOnly:true,secure:true,sameSite:"lax" as const,path:"/",...(expires?{expires:new Date(expires*1000)}:{maxAge:0})});
export async function currentCustomer(){const token=(await cookies()).get(CUSTOMER_COOKIE)?.value;if(!token)return null;const tokenHash=await digest(token),now=Math.floor(Date.now()/1000);return await env.DB.prepare("SELECT u.id,u.name,u.email,u.avatar,COALESCE(b.balance,0) balance FROM customer_sessions s JOIN customer_users u ON u.id=s.user_id LEFT JOIN customer_balances b ON b.email=u.email WHERE s.token_hash=? AND s.expires_at>?").bind(tokenHash,now).first() as {id:number,name:string,email:string,avatar:string,balance:number}|null}
