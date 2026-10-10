import { env } from "cloudflare:workers";
const db = () => (env as any).DB;

export type CatalogNotice = {
  providerServiceId: string;
  platform: string;
  category: string;
  name: string;
  salePrice: number;
  priceUnit: string;
};

const OUTBOX_PREFIX = "telegram_catalog_outbox:";
const LOCK_KEY = "telegram_catalog_dispatch_lock";
const RETRY_KEY = "telegram_catalog_retry_after";
const now = () => Math.floor(Date.now() / 1000);
const setting = (name: string) => String((env as any)[name] || "").trim();
export const catalogAnnouncementStatement = (notice: CatalogNotice, uniqueKey: string, createdAt = now()) => db().prepare("INSERT INTO site_settings(key,value,updated_at) VALUES(?,?,?) ON CONFLICT(key) DO NOTHING").bind(`${OUTBOX_PREFIX}${uniqueKey}`, JSON.stringify(notice), createdAt);
const escapeHtml = (value: unknown) => String(value ?? "").replace(/[&<>\"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[char]!);

export async function flushCatalogAnnouncements() {
  const token = setting("TELEGRAM_BOT_TOKEN");
  const chatId = setting("TELEGRAM_CHAT_ID") || "@ElTurcoSmm";
  if (!token) return { sent: 0, configured: false };

  const retry: any = await db().prepare("SELECT value FROM site_settings WHERE key=?").bind(RETRY_KEY).first();
  if (Number(retry?.value || 0) > now()) return { sent: 0, configured: true };
  const pending: any = await db().prepare("SELECT COUNT(*) AS total FROM site_settings WHERE key GLOB ?").bind(`${OUTBOX_PREFIX}*`).first();
  if (!Number(pending?.total || 0)) return { sent: 0, configured: true };

  const lockValue = `${now()}:${crypto.randomUUID()}`;
  const lockTime = now();
  await db().prepare("INSERT INTO site_settings(key,value,updated_at) VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at WHERE site_settings.updated_at < ?")
    .bind(LOCK_KEY, lockValue, lockTime, lockTime - 600).run();
  const held: any = await db().prepare("SELECT value FROM site_settings WHERE key=?").bind(LOCK_KEY).first();
  if (held?.value !== lockValue) return { sent: 0, configured: true };

  let sent = 0;
  let notices: { key: string; notice: CatalogNotice }[] = [];
  try {
    const result: any = await db().prepare("SELECT key,value FROM site_settings WHERE key GLOB ? ORDER BY updated_at,key LIMIT 100").bind(`${OUTBOX_PREFIX}*`).all();
    notices = (result.results as any[]).flatMap((row) => {
      try { return [{ key: String(row.key), notice: JSON.parse(String(row.value)) as CatalogNotice }]; }
      catch { console.error("Telegram catalog notice has invalid saved data."); return []; }
    });
    const chunks: typeof notices[] = [];
    let chunk: typeof notices = [];
    let length = 0;
    for (const item of notices) {
      const price = `${(Number(item.notice.salePrice || 0) / 100).toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺${item.notice.priceUnit === "per_order" ? " / sipariş" : " / 1.000"}`;
      const link = `https://elturcosmm.com/site/?platform=${encodeURIComponent(item.notice.platform || "")}`;
      const entry = `\n• <b>${escapeHtml(item.notice.name)}</b>\n  ${escapeHtml(item.notice.platform)} · ${escapeHtml(item.notice.category)} · ${price}\n  <a href="${link}">Hizmeti gör</a>\n`;
      if (chunk.length && length + entry.length > 3400) { chunks.push(chunk); chunk = []; length = 0; }
      (item as any).entry = entry;
      chunk.push(item);
      length += entry.length;
    }
    if (chunk.length) chunks.push(chunk);

    for (const batch of chunks) {
      const message = `🆕 <b>ELTURCO SMM · Yeni hizmetler</b>\n${batch.map((item: any) => item.entry).join("")}`;
      const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text: message, parse_mode: "HTML", disable_web_page_preview: true }),
        signal: AbortSignal.timeout(8000),
      });
      const payload: any = await response.json().catch(() => ({}));
      if (!response.ok || payload.ok !== true) throw new Error(`Telegram returned HTTP ${response.status}`);
      await db().batch(batch.map((item) => db().prepare("DELETE FROM site_settings WHERE key=?").bind(item.key)));
      await db().prepare("DELETE FROM site_settings WHERE key=?").bind(RETRY_KEY).run();
      sent += batch.length;
    }
  } catch (error) {
    console.error("Telegram catalog announcement could not be delivered.", error instanceof Error ? error.name : "Unknown error");
    const retryAt = now() + 60;
    await db().prepare("INSERT INTO site_settings(key,value,updated_at) VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at").bind(RETRY_KEY, String(retryAt), now()).run();
  } finally {
    await db().prepare("DELETE FROM site_settings WHERE key=? AND value=?").bind(LOCK_KEY, lockValue).run();
  }
  return { sent, configured: true };
}
