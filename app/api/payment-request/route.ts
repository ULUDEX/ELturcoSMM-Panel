import { env } from "cloudflare:workers";
import { NextResponse } from "next/server";
import { currentCustomer } from "@/lib/customer-auth";

const cents = (value: unknown) => Math.round(Number(value || 0) * 100);

const shopierProducts = [
  { amount: 100, url: "https://www.shopier.com/ElTurcoSMM/51237211" },
  { amount: 250, url: "https://www.shopier.com/ElTurcoSMM/51237220" },
  { amount: 500, url: "https://www.shopier.com/ElTurcoSMM/51237224" },
  { amount: 750, url: "https://www.shopier.com/ElTurcoSMM/51237225" },
  { amount: 1000, url: "https://www.shopier.com/ElTurcoSMM/51237228" },
  { amount: 2000, url: "https://www.shopier.com/ElTurcoSMM/51237231" },
].map(({ amount, url }) => ({
  key: `shopier:${amount}`,
  name: `Shopier · ${amount.toLocaleString("tr-TR")} TL`,
  instructions: `Shopier'de ${amount.toLocaleString("tr-TR")} TL öde. Sipariş notuna ELturcoSMM hesabındaki e-posta adresini yaz. Ödeme, sipariş kontrol edildikten sonra hesabına manuel olarak yansıtılır.`,
  checkoutUrl: url,
  amount,
}));

export async function GET() {
  const q = await env.DB.prepare(
    "SELECT id,name,type,instructions FROM payment_methods WHERE active=1 ORDER BY id DESC",
  ).all();
  const methods = q.results.filter((method: any) =>
    !/telegram|@taycanqs/i.test(
      `${method.name || ""} ${method.type || ""} ${method.instructions || ""}`,
    ),
  );
  return NextResponse.json({ methods, shopier: shopierProducts });
}

export async function POST(request: Request) {
  const customer = await currentCustomer();
  if (!customer) {
    return NextResponse.json(
      { error: "Bakiye yüklemek için giriş yapmalısın.", loginRequired: true },
      { status: 401 },
    );
  }

  const body = (await request.json()) as Record<string, unknown>;
  const paymentKey = String(body.method || "");
  const shopier = shopierProducts.find((item) => item.key === paymentKey);
  const method = shopier?.name || paymentKey;
  const amount = cents(body.amount);

  if (shopier && amount !== shopier.amount * 100) {
    return NextResponse.json(
      { error: "Seçtiğin Shopier tutarı değiştirilemez. Lütfen tutarı yeniden seç." },
      { status: 400 },
    );
  }
  if (!String(body.name || "").trim() || amount < 1000 || !method) {
    return NextResponse.json(
      { error: "Ad, yöntem ve en az 10 TL tutar zorunlu." },
      { status: 400 },
    );
  }

  const result = await env.DB.prepare(
    "INSERT INTO payment_requests(customer_name,email,amount,method,note,status,created_at) VALUES(?,?,?,?,?,'pending',?) RETURNING id",
  )
    .bind(
      String(body.name).trim(),
      customer.email,
      amount,
      method,
      String(body.note || "").trim(),
      Math.floor(Date.now() / 1000),
    )
    .first();

  return NextResponse.json(
    { ...result, checkoutUrl: shopier?.checkoutUrl || null },
    { status: 201 },
  );
}
