import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { syncProviderCatalog } from "@/lib/provider-catalog";

export async function POST() {
  if (!await isAdmin()) return NextResponse.json({ error: "Yetkisiz işlem." }, { status: 403 });
  try {
    return NextResponse.json({ ok: true, ...await syncProviderCatalog() });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message.slice(0, 300) : "Katalog senkronlanamadı." }, { status: 502 });
  }
}
