import { env } from "cloudflare:workers";
import { NextResponse } from "next/server";
import { currentCustomer } from "@/lib/customer-auth";

const supportedLanguages = new Set(["tr", "en", "es", "ru", "pt", "de"]);
export async function GET(request: Request) {
  const user = await currentCustomer();
  if (!user) return NextResponse.json({ error: "Giriş yapman gerekiyor." }, { status: 401 });
  const requested = new URL(request.url).searchParams.get("lang") || "tr";
  const language = supportedLanguages.has(requested) ? requested : "tr";
  try {
    const [notifications, unread] = await env.DB.batch([
      env.DB.prepare("SELECT id,kind,title,body,translations,order_id orderId,read_at readAt,created_at createdAt FROM customer_notifications WHERE customer_email=? ORDER BY id DESC LIMIT 100").bind(user.email.toLowerCase()),
      env.DB.prepare("SELECT COUNT(*) count FROM customer_notifications WHERE customer_email=? AND read_at IS NULL").bind(user.email.toLowerCase()),
    ]);
    const rows = (notifications.results as any[]).map(row => {
      let translations: any = {};
      try { translations = JSON.parse(row.translations || "{}"); } catch { /* keep the default text */ }
      const translated = translations?.[language];
      return { ...row, title: translated?.title || row.title, body: translated?.body || row.body, translations: undefined };
    });
    return NextResponse.json({ notifications: rows, unread: Number((unread.results as any[])[0]?.count || 0) }, { headers: { "cache-control": "private, no-store" } });
  } catch {
    return NextResponse.json({ error: "Bildirimler alınamadı." }, { status: 503 });
  }
}

export async function POST(request: Request) {
  const user = await currentCustomer();
  if (!user) return NextResponse.json({ error: "Giriş yapman gerekiyor." }, { status: 401 });
  try {
    const body = await request.json() as { id?: unknown; action?: unknown };
    const at = Math.floor(Date.now() / 1000);
    if (body.action === "read-all") {
      await env.DB.prepare("UPDATE customer_notifications SET read_at=? WHERE customer_email=? AND read_at IS NULL").bind(at, user.email.toLowerCase()).run();
    } else {
      const id = Math.floor(Number(body.id));
      if (!id) return NextResponse.json({ error: "Bildirim bulunamadı." }, { status: 400 });
      await env.DB.prepare("UPDATE customer_notifications SET read_at=? WHERE id=? AND customer_email=?").bind(at, id, user.email.toLowerCase()).run();
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Bildirim güncellenemedi." }, { status: 500 });
  }
}
