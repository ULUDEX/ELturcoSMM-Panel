import { env } from "cloudflare:workers";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { CUSTOMER_COOKIE,customerCookieOptions,digest } from "@/lib/customer-auth";
export async function POST(){const token=(await cookies()).get(CUSTOMER_COOKIE)?.value;if(token)await env.DB.prepare("DELETE FROM customer_sessions WHERE token_hash=?").bind(await digest(token)).run();const response=NextResponse.json({ok:true});response.cookies.set(CUSTOMER_COOKIE,"",customerCookieOptions());return response}
