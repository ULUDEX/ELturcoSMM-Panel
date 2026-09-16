import { env } from "cloudflare:workers";
import { NextResponse } from "next/server";
export async function GET(){return NextResponse.json({enabled:Boolean((env as any).SHOPIER_ACCESS_TOKEN&&(env as any).SHOPIER_WEBHOOK_SECRET&&(env as any).SHOPIER_CHECKOUT_URL)});}
