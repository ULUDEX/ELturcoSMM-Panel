import { env } from "cloudflare:workers";
import { cookies } from "next/headers";

export const CUSTOMER_COOKIE="elturco_customer";
const encoder=new TextEncoder();
const hex=(bytes:ArrayBuffer|Uint8Array)=>[...new Uint8Array(bytes)].map(x=>x.toString(16).padStart(2,"0")).join("");
const fromHex=(value:string)=>new Uint8Array((value.match(/.{1,2}/g)||[]).map(x=>parseInt(x,16)));
export const randomHex=(size=32)=>{const bytes=new Uint8Array(size);crypto.getRandomValues(bytes);return hex(bytes)};
export async function digest(value:string){return hex(await crypto.subtle.digest("SHA-256",encoder.encode(value)))}
export async function passwordHash(password:string,salt:string){const key=await crypto.subtle.importKey("raw",encoder.encode(password),"PBKDF2",false,["deriveBits"]);return hex(await crypto.subtle.deriveBits({name:"PBKDF2",hash:"SHA-256",salt:fromHex(salt),iterations:210000},key,256))}
export async function verifyPassword(password:string,salt:string,expected:string){const actual=await passwordHash(password,salt);if(actual.length!==expected.length)return false;let mismatch=0;for(let i=0;i<actual.length;i++)mismatch|=actual.charCodeAt(i)^expected.charCodeAt(i);return mismatch===0}
export async function createCustomerSession(userId:number){const token=randomHex(32),tokenHash=await digest(token),created=Math.floor(Date.now()/1000),expires=created+60*60*24*30;await env.DB.prepare("INSERT INTO customer_sessions(user_id,token_hash,expires_at,created_at) VALUES(?,?,?,?)").bind(userId,tokenHash,expires,created).run();return{token,expires}}
export const customerCookieOptions=(expires?:number)=>({httpOnly:true,secure:true,sameSite:"lax" as const,path:"/",...(expires?{expires:new Date(expires*1000)}:{maxAge:0})});
export async function currentCustomer(){const token=(await cookies()).get(CUSTOMER_COOKIE)?.value;if(!token)return null;const tokenHash=await digest(token),now=Math.floor(Date.now()/1000);return await env.DB.prepare("SELECT u.id,u.name,u.email,COALESCE(b.balance,0) balance FROM customer_sessions s JOIN customer_users u ON u.id=s.user_id LEFT JOIN customer_balances b ON b.email=u.email WHERE s.token_hash=? AND s.expires_at>?").bind(tokenHash,now).first() as {id:number,name:string,email:string,balance:number}|null}
