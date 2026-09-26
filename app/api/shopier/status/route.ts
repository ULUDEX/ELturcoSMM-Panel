import { env } from "cloudflare:workers";
import { NextResponse } from "next/server";
const shopierEnv = env as unknown as { SHOPIER_API_KEY?: string; SHOPIER_API_SECRET?: string; SHOPIER_ACCESS_TOKEN?: string; SHOPIER_CALLBACK_URL?: string };
export async function GET(){const configured=Boolean(shopierEnv.SHOPIER_API_KEY&&shopierEnv.SHOPIER_API_SECRET&&shopierEnv.SHOPIER_ACCESS_TOKEN);return NextResponse.json({enabled:configured,checkoutConfigured:configured,callbackUrlConfigured:Boolean(shopierEnv.SHOPIER_CALLBACK_URL)});}
