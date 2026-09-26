import { env } from "cloudflare:workers";
import { NextResponse } from "next/server";
import { currentCustomer } from "@/lib/customer-auth";

const cents = (value: unknown) => Math.round(Number(value || 0) * 100);
const shopierEnv = env as unknown as { SHOPIER_API_KEY?: string; SHOPIER_API_SECRET?: string; SHOPIER_ACCESS_TOKEN?: string };
const shopierConfigured = () => Boolean(shopierEnv.SHOPIER_API_KEY && shopierEnv.SHOPIER_API_SECRET && shopierEnv.SHOPIER_ACCESS_TOKEN);

export async function GET() {
  const q = await env.DB.prepare("SELECT id,name,type,instructions FROM payment_methods WHERE active=1 ORDER BY id DESC").all();
  const methods = [...q.results];
  if (shopierConfigured()) methods.unshift({ id: "shopier", name: "Shopier · Kartla ödeme", type: "Kart altyapısı", instructions: "Shopier'in güvenli ödeme sayfasına yönlendirileceksin." });
  if (!methods.length) methods.push({ id: 0, name: "Telegram ile ödeme", type: "Manuel ödeme", instructions: "Ödeme bilgilerini almak için Telegram destek düğmesinden @taycanqs hesabına yaz. Ödeme yaptıktan sonra bu formdan bildirim oluştur." });
  return NextResponse.json(methods);
}

export async function POST(r: Request) {
  const customer = await currentCustomer();
  if (!customer) return NextResponse.json({ error: "Bakiye yüklemek için giriş yapmalısın.", loginRequired: true }, { status: 401 });
  const b = await r.json() as Record<string, unknown>;
  const amount = cents(b.amount);
  const methodName = String(b.method || "");
  if (!Number.isSafeInteger(amount) || amount < 1000 || amount > 10_000_000 || !methodName) {
    return NextResponse.json({ error: "En az 10 TL, en fazla 100.000 TL tutar ve ödeme yöntemi gerekli." }, { status: 400 });
  }
  if (methodName === "Shopier · Kartla ödeme" || methodName === "shopier") {
    return NextResponse.json({ error: "Shopier ödemesini başlatmak için ödeme sayfasını yeniden aç." }, { status: 400 });
  }
  const method = await env.DB.prepare("SELECT name FROM payment_methods WHERE active=1 AND name=? LIMIT 1").bind(methodName).first() as { name: string } | null;
  if (!method) return NextResponse.json({ error: "Seçilen ödeme yöntemi artık aktif değil." }, { status: 400 });
  const x = await env.DB.prepare("INSERT INTO payment_requests(customer_name,email,amount,method,note,status,created_at) VALUES(?,?,?,?,?,'pending',?) RETURNING id")
    .bind(customer.name, customer.email, amount, method.name, String(b.note || "").trim().slice(0, 500), Math.floor(Date.now() / 1000)).first();
  return NextResponse.json(x, { status: 201 });
}
