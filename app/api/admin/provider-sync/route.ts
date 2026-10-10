import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { providerId } from "@/lib/providers";
import { syncProviderCatalog } from "@/lib/provider-catalog";

export async function POST(request:Request) {
  if (!await isAdmin()) return NextResponse.json({ error: "Yetkisiz işlem." }, { status: 403 });
  try {
    const body:any=await request.json().catch(()=>({}));return NextResponse.json({ ok: true, ...await syncProviderCatalog(providerId(body.providerId)) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message.slice(0, 300) : "Katalog senkronlanamadı." }, { status: 502 });
  }
}
