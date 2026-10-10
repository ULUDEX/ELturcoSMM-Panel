import { env } from "cloudflare:workers";
import { providerConfigured } from "@/lib/provider";
import { syncProviderCatalog } from "@/lib/provider-catalog";
import { flushCatalogAnnouncements } from "@/lib/telegram-announcements";

export async function runCatalogSchedule() {
  const at = Math.floor(Date.now() / 1000);
  for (const id of ["panelfollows", "smmxserver"] as const) {
    if (!providerConfigured(id)) continue;
    const key = id === "panelfollows" ? "provider_catalog_last_sync" : `provider_catalog_last_sync:${id}`;
    const last: any = await env.DB.prepare("SELECT value FROM site_settings WHERE key=?").bind(key).first();
    if (at - Number(last?.value || 0) < 21600) continue;
    try {
      await syncProviderCatalog(id);
      await env.DB.prepare("INSERT INTO site_settings(key,value,updated_at) VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at").bind(key, String(at), at).run();
    } catch {
      console.error(`Catalog scheduled sync failed: ${id}`);
    }
  }
  await flushCatalogAnnouncements();
}
