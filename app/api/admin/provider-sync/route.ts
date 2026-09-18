import { env } from "cloudflare:workers";
import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { fetchProviderCatalog } from "@/lib/provider-catalog";

const chunks = <T,>(items: T[], size: number) => Array.from({ length: Math.ceil(items.length / size) }, (_, index) => items.slice(index * size, index * size + size));

export async function POST() {
  if (!await isAdmin()) return NextResponse.json({ error: "Yetkisiz işlem." }, { status: 403 });
  try {
    const services = await fetchProviderCatalog();
    const existing = await env.DB.prepare("SELECT id,provider_service_id FROM services WHERE provider_service_id<>''").all();
    const byProviderId = new Map((existing.results as any[]).map((row) => [String(row.provider_service_id), Number(row.id)]));
    let added = 0;
    let updated = 0;
    const statements = services.map((service) => {
      const currentId = byProviderId.get(service.providerServiceId);
      if (currentId) {
        updated += 1;
        return env.DB.prepare("UPDATE services SET platform=?,category=?,name=?,min_order=?,max_order=?,cost_price=?,sale_price=?,description=?,active=1 WHERE id=?")
          .bind(service.platform, service.category, service.name, service.minOrder, service.maxOrder, service.costPrice, service.salePrice, service.description, currentId);
      }
      added += 1;
      return env.DB.prepare("INSERT INTO services(platform,category,name,provider_service_id,min_order,max_order,cost_price,sale_price,description,active,created_at) VALUES(?,?,?,?,?,?,?,?,?,1,?)")
        .bind(service.platform, service.category, service.name, service.providerServiceId, service.minOrder, service.maxOrder, service.costPrice, service.salePrice, service.description, Math.floor(Date.now() / 1000));
    });
    for (const batch of chunks(statements, 50)) await env.DB.batch(batch);
    return NextResponse.json({ ok: true, total: services.length, added, updated });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message.slice(0, 300) : "Katalog senkronlanamadı." }, { status: 502 });
  }
}
