import { env } from "cloudflare:workers";
import { NextResponse } from "next/server";

const encoder = new TextEncoder();
const shopierEnv = env as unknown as { SHOPIER_API_KEY?: string; SHOPIER_API_SECRET?: string; SHOPIER_ACCESS_TOKEN?: string };
const now = () => Math.floor(Date.now() / 1000);
const hex = (bytes: Uint8Array) => Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");

function decodeBase64(value: string) {
  try { return Uint8Array.from(atob(value), (character) => character.charCodeAt(0)); } catch { return new Uint8Array(); }
}

function safeEqual(left: Uint8Array, right: Uint8Array) {
  if (left.length !== right.length || left.length === 0) return false;
  let result = 0;
  for (let i = 0; i < left.length; i++) result |= left[i] ^ right[i];
  return result === 0;
}

async function sign(value: string, secret: string) {
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(value)));
}

function resultPage(title: string, message: string, ok: boolean) {
  const color = ok ? "#138a52" : "#b42318";
  return new Response(`<!doctype html><html lang="tr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><body style="margin:0;background:#0c1016;color:#f7f7f7;font:16px system-ui;display:grid;min-height:100vh;place-items:center"><main style="max-width:480px;padding:32px;border:1px solid #ffffff20;border-radius:20px;background:#131922"><b style="color:${color}">${title}</b><p>${message}</p><a style="color:#ff784b" href="https://elturcosmm.com/site/">ElTurco SMM'ye dön</a></main></body></html>`, {
    status: 200,
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'", "x-content-type-options": "nosniff" },
  });
}

export async function POST(request: Request) {
  const secret = shopierEnv.SHOPIER_API_SECRET || "";
  const apiKey = shopierEnv.SHOPIER_API_KEY || "";
  if (!secret || !apiKey) return NextResponse.json({ error: "Shopier entegrasyonu etkin değil." }, { status: 503 });

  let form: FormData;
  try { form = await request.formData(); } catch { return NextResponse.json({ error: "Geçersiz Shopier dönüşü." }, { status: 400 }); }
  const field = (name: string) => String(form.get(name) || "").trim();
  const orderId = field("platform_order_id");
  const randomNumber = field("random_nr");
  const signature = field("signature");
  const paymentId = field("payment_id");
  const status = field("status").toLowerCase();
  const postedApiKey = field("API_key");
  if (!orderId || !randomNumber || !signature || !paymentId || !status || (postedApiKey && postedApiKey !== apiKey)) {
    return resultPage("Ödeme doğrulanamadı", "Shopier dönüşünde gerekli bilgiler eksik veya eşleşmiyor.", false);
  }

  // Shopier's official SDK validates the response signature over random_nr + platform_order_id.
  const expected = await sign(`${randomNumber}${orderId}`, secret);
  if (!safeEqual(expected, decodeBase64(signature))) return resultPage("Ödeme doğrulanamadı", "Ödeme imzası geçerli değil.", false);

  const payment = await env.DB.prepare("SELECT customer_email,amount,status,credited FROM shopier_payments WHERE payment_ref=? LIMIT 1").bind(orderId).first() as { customer_email: string; amount: number; status: string; credited: number } | null;
  if (!payment) return resultPage("Ödeme bulunamadı", "Bu ödeme numarası sistemde kayıtlı değil.", false);
  if (payment.status === "success" && payment.credited) return resultPage("Ödeme tamamlandı", "Bu ödeme hesabına daha önce işlendi.", true);
  if (payment.status !== "created") return resultPage("Ödeme tamamlanmadı", "Bu ödeme daha önce sonuçlandı. Yeni bir bakiye yükleme başlatabilirsin.", false);
  if (status !== "success") {
    await env.DB.prepare("UPDATE shopier_payments SET status='failed',updated_at=? WHERE payment_ref=? AND status='created'").bind(now(), orderId).run();
    return resultPage("Ödeme tamamlanmadı", "Shopier ödeme işlemini başarılı olarak bildirmedi.", false);
  }

  // The legacy callback signature does not cover status or amount, so confirm the actual order through Shopier's REST API.
  const accessToken = shopierEnv.SHOPIER_ACCESS_TOKEN || "";
  if (!accessToken) return NextResponse.json({ error: "Shopier ödeme doğrulaması yapılandırılmadı." }, { status: 503 });
  let order: { id?: string; paymentStatus?: string; currency?: string; totals?: { total?: string | number }; shippingInfo?: { email?: string } };
  try {
    const response = await fetch(`https://api.shopier.com/v1/orders/${encodeURIComponent(paymentId)}`, {
      headers: { accept: "application/json", authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) throw new Error("Shopier order lookup failed");
    order = await response.json() as typeof order;
  } catch {
    return NextResponse.json({ error: "Shopier ödeme durumu şu an doğrulanamıyor. Lütfen biraz sonra tekrar dene." }, { status: 503 });
  }
  const paidCents = Math.round(Number(order.totals?.total) * 100);
  const orderEmail = String(order.shippingInfo?.email || "").trim().toLowerCase();
  if (String(order.id || "") !== paymentId || String(order.paymentStatus || "").toLowerCase() !== "paid" || String(order.currency || "").toUpperCase() !== "TRY" || paidCents !== Number(payment.amount) || (orderEmail && orderEmail !== payment.customer_email.toLowerCase())) {
    return resultPage("Ödeme doğrulanamadı", "Shopier siparişinin ödeme durumu, tutarı veya müşteri bilgisi eşleşmiyor.", false);
  }

  const eventHash = hex(new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(`${orderId}:${paymentId}:${randomNumber}`))));
  const time = now();
  // D1 runs batch statements atomically. raw_event_hash acts as a short-lived claim so a replay cannot credit twice.
  await env.DB.batch([
    env.DB.prepare("UPDATE shopier_payments SET status='success',credited=1,shopier_order_id=?,raw_event_hash=?,updated_at=? WHERE payment_ref=? AND status='created' AND credited=0 AND shopier_order_id IS NULL")
      .bind(paymentId, eventHash, time, orderId),
    env.DB.prepare("INSERT INTO customer_balances(email,balance,created_at,updated_at) SELECT customer_email,amount,?,? FROM shopier_payments WHERE payment_ref=? AND status='success' AND credited=1 AND raw_event_hash=? ON CONFLICT(email) DO UPDATE SET balance=balance+excluded.balance,updated_at=excluded.updated_at")
      .bind(time, time, orderId, eventHash),
    env.DB.prepare("INSERT INTO transactions(type,amount,category,description,status,created_at) SELECT 'income',amount,'Bakiye yükleme',?,'completed',? FROM shopier_payments WHERE payment_ref=? AND status='success' AND credited=1 AND raw_event_hash=?")
      .bind(`Shopier ödeme · ${orderId}`, time, orderId, eventHash),
    env.DB.prepare("UPDATE shopier_payments SET raw_event_hash='' WHERE payment_ref=? AND raw_event_hash=?")
      .bind(orderId, eventHash),
  ]);
  return resultPage("Ödeme tamamlandı", `₺${(Number(payment.amount) / 100).toFixed(2)} bakiye hesabına eklendi.`, true);
}
