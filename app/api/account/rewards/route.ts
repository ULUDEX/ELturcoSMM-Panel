import { env } from "cloudflare:workers";
import { NextResponse } from "next/server";
import { currentCustomer } from "@/lib/customer-auth";
import { rewardTiers } from "@/lib/rewards";

export const dynamic = "force-dynamic";
const noStore = { "cache-control": "private, no-store, max-age=0", vary: "Cookie" };

export async function GET() {
  const customer = await currentCustomer();
  if (!customer) return NextResponse.json({ error: "Puanlarını görmek için giriş yapmalısın." }, { status: 401, headers: noStore });
  try {
    const totals: any = await env.DB.prepare(`
      SELECT COALESCE(SUM(CASE WHEN event_type='earn' THEN spend_amount ELSE 0 END),0) lifetimeSpent,
        COALESCE(SUM(CASE WHEN event_type='earn' THEN points ELSE 0 END),0) lifetimePoints,
        COALESCE(SUM(points),0) availablePoints
      FROM customer_reward_events WHERE customer_email=?
    `).bind(customer.email).first();
    const history: any = await env.DB.prepare(`
      SELECT event_type eventType,order_id orderId,spend_amount spendAmount,points,balance_credit balanceCredit,created_at createdAt
      FROM customer_reward_events WHERE customer_email=? ORDER BY id DESC LIMIT 12
    `).bind(customer.email).all();
    const lifetimeSpent = Number(totals?.lifetimeSpent || 0);
    const tierIndex = rewardTiers.reduce((current, tier, index) => lifetimeSpent >= tier.minSpend ? index : current, 0);
    const tier = rewardTiers[tierIndex];
    const nextTier = rewardTiers[tierIndex + 1] || null;
    const progress = nextTier ? Math.min(100, Math.max(0, ((lifetimeSpent - tier.minSpend) / (nextTier.minSpend - tier.minSpend)) * 100)) : 100;
    return NextResponse.json({
      lifetimeSpent, lifetimePoints: Number(totals?.lifetimePoints || 0), availablePoints: Number(totals?.availablePoints || 0),
      redeemableBalance: Number(totals?.availablePoints || 0), tier: tier.key, multiplier: tier.multiplierBps / 10_000,
      nextTier: nextTier?.key || null, nextTierAt: nextTier?.minSpend || null, progress,
      pointValue: 1, tiers: rewardTiers.map(item => ({ key: item.key, minSpend: item.minSpend, multiplier: item.multiplierBps / 10_000 })),
      history: history.results,
    }, { headers: noStore });
  } catch {
    return NextResponse.json({ error: "Ödül bilgileri şu anda alınamıyor." }, { status: 503, headers: noStore });
  }
}

export async function POST() {
  const customer = await currentCustomer();
  if (!customer) return NextResponse.json({ error: "Puanlarını kullanmak için giriş yapmalısın." }, { status: 401, headers: noStore });
  const at = Math.floor(Date.now() / 1000);
  try {
    const results: any[] = await env.DB.batch([
      env.DB.prepare(`
        INSERT INTO customer_reward_events(customer_email,event_type,order_id,spend_amount,points,balance_credit,created_at)
        SELECT ?, 'redeem', NULL, 0, -availablePoints, availablePoints, ?
        FROM (SELECT COALESCE(SUM(points),0) availablePoints FROM customer_reward_events WHERE customer_email=?)
        WHERE availablePoints>=100
        RETURNING balance_credit balanceCredit, -points points
      `).bind(customer.email, at, customer.email),
      env.DB.prepare(`INSERT INTO customer_balances(email,balance,created_at,updated_at) SELECT ?,balance_credit,?,? FROM customer_reward_events WHERE customer_email=? AND event_type='redeem' AND id=(SELECT MAX(id) FROM customer_reward_events WHERE customer_email=? AND event_type='redeem') AND changes()=1 ON CONFLICT(email) DO UPDATE SET balance=customer_balances.balance+excluded.balance,updated_at=excluded.updated_at`).bind(customer.email, at, at, customer.email, customer.email),
      env.DB.prepare(`INSERT INTO transactions(type,amount,category,description,status,created_at) SELECT 'expense',balance_credit,'Sadakat puanı',?,'completed',? FROM customer_reward_events WHERE customer_email=? AND event_type='redeem' AND id=(SELECT MAX(id) FROM customer_reward_events WHERE customer_email=? AND event_type='redeem') AND changes()=1`)
        .bind(`Puanlar bakiyeye çevrildi · ${customer.email}`, at, customer.email, customer.email),
    ]);
    const redeemed = Number(results[0]?.results?.[0]?.points || 0);
    if (!redeemed) return NextResponse.json({ error: "Bakiyeye çevirmek için en az 100 puan gerekli." }, { status: 400, headers: noStore });
    return NextResponse.json({ ok: true, points: redeemed, credited: redeemed, balance: Number(customer.balance || 0) + redeemed }, { headers: noStore });
  } catch {
    return NextResponse.json({ error: "Puanlar şu anda kullanılamıyor. Tekrar dene." }, { status: 503, headers: noStore });
  }
}
