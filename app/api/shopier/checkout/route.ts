import { env } from "cloudflare:workers";
import { NextResponse } from "next/server";
import { currentCustomer } from "@/lib/customer-auth";

const encoder = new TextEncoder();
const shopierEnv = env as unknown as { SHOPIER_API_KEY?: string; SHOPIER_API_SECRET?: string; SHOPIER_ACCESS_TOKEN?: string; SHOPIER_CALLBACK_URL?: string };
const now = () => Math.floor(Date.now() / 1000);
const base64 = (bytes: Uint8Array) => btoa(Array.from(bytes, (byte) => String.fromCharCode(byte)).join(""));
const clean = (value: unknown, max: number) => String(value ?? "").trim().slice(0, max);

async function hmac(value: string, secret: string) {
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return base64(new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(value))));
}

export async function POST(request: Request) {
  const customer = await currentCustomer();
  if (!customer) return NextResponse.json({ error: "Bakiye yüklemek için giriş yapmalısın.", loginRequired: true }, { status: 401 });

  const apiKey = shopierEnv.SHOPIER_API_KEY || "";
  const apiSecret = shopierEnv.SHOPIER_API_SECRET || "";
  if (!apiKey || !apiSecret || !shopierEnv.SHOPIER_ACCESS_TOKEN) return NextResponse.json({ error: "Shopier API anahtarı, secret ve kişisel erişim anahtarı birlikte yapılandırılmalı." }, { status: 503 });

  let body: Record<string, unknown>;
  try { body = await request.json() as Record<string, unknown>; } catch { return NextResponse.json({ error: "Geçersiz istek." }, { status: 400 }); }
  const amountCents = Math.round(Number(body.amount) * 100);
  if (!Number.isSafeInteger(amountCents) || amountCents < 1000 || amountCents > 10_000_000) {
    return NextResponse.json({ error: "Bakiye yükleme tutarı 10 TL ile 100.000 TL arasında olmalı." }, { status: 400 });
  }

  const phone = clean(body.phone, 30);
  const address = clean(body.address, 180);
  const city = clean(body.city, 80);
  const postcode = clean(body.postcode, 12);
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 10 || digits.length > 15 || address.length < 8 || !city || postcode.length < 4) {
    return NextResponse.json({ error: "Shopier için telefon, fatura adresi, şehir ve posta kodunu doldur." }, { status: 400 });
  }

  const names = clean(customer.name, 120).split(/\s+/).filter(Boolean);
  const firstName = names.shift() || "Müşteri";
  const surname = names.join(" ") || "ElTurco";
  const amount = `${Math.floor(amountCents / 100)}.${String(amountCents % 100).padStart(2, "0")}`;
  const orderId = `ET${crypto.randomUUID().replaceAll("-", "").slice(0, 24)}`;
  const randomNumber = String(crypto.getRandomValues(new Uint32Array(1))[0] % 900_000 + 100_000);
  const signature = await hmac(`${randomNumber}${orderId}${amount}0`, apiSecret);
  const callback = shopierEnv.SHOPIER_CALLBACK_URL || new URL("/api/shopier/webhook", request.url).toString();
  let callbackUrl: URL;
  try { callbackUrl = new URL(callback); } catch { return NextResponse.json({ error: "Shopier dönüş adresi geçersiz." }, { status: 503 }); }
  if (callbackUrl.protocol !== "https:") return NextResponse.json({ error: "Shopier dönüş adresi HTTPS olmalı." }, { status: 503 });

  const fields: Record<string, string> = {
    API_key: apiKey,
    website_index: "1",
    platform_order_id: orderId,
    product_name: "ElTurco SMM Bakiye Yükleme",
    product_type: "1",
    buyer_name: firstName,
    buyer_surname: surname,
    buyer_email: String(customer.email),
    buyer_account_age: "0",
    buyer_id_nr: String(customer.id),
    buyer_phone: phone,
    billing_address: address,
    billing_city: city,
    billing_country: "Türkiye",
    billing_postcode: postcode,
    shipping_address: address,
    shipping_city: city,
    shipping_country: "Türkiye",
    shipping_postcode: postcode,
    total_order_value: amount,
    currency: "0",
    platform: "0",
    is_in_frame: "0",
    current_language: "0",
    modul_version: "1.0.4",
    random_nr: randomNumber,
    signature,
    callback: callbackUrl.toString(),
  };

  try {
    await env.DB.prepare("INSERT INTO shopier_payments(payment_ref,customer_email,amount,status,credited,raw_event_hash,created_at,updated_at) VALUES(?,?,?,'created',0,'',?,?)")
      .bind(orderId, customer.email, amountCents, now(), now()).run();
  } catch {
    return NextResponse.json({ error: "Ödeme kaydı oluşturulamadı. Lütfen tekrar dene." }, { status: 500 });
  }

  return NextResponse.json({ action: "https://www.shopier.com/ShowProduct/api_pay4.php", fields });
}
