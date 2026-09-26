import { env } from "cloudflare:workers";

export const rewardTiers = [
  { key: "new", minSpend: 0, multiplierBps: 10_000 },
  { key: "junior", minSpend: 20_000, multiplierBps: 11_500 },
  { key: "regular", minSpend: 50_000, multiplierBps: 13_000 },
  { key: "frequent", minSpend: 300_000, multiplierBps: 15_000 },
  { key: "elite", minSpend: 750_000, multiplierBps: 16_500 },
  { key: "vip", minSpend: 1_250_000, multiplierBps: 18_000 },
  { key: "legend", minSpend: 2_500_000, multiplierBps: 20_000 },
] as const;

export async function awardCompletedOrder(email: string, orderId: number) {
  const at = Math.floor(Date.now() / 1000);
  return env.DB.prepare(`
    INSERT OR IGNORE INTO customer_reward_events
      (customer_email,event_type,order_id,spend_amount,points,balance_credit,created_at)
    SELECT o.customer_email,'earn',o.id,o.amount,
      CAST((o.amount * CASE
        WHEN COALESCE((SELECT SUM(spend_amount) FROM customer_reward_events e WHERE e.customer_email=o.customer_email AND e.event_type='earn'),0)<20000 THEN 10000
        WHEN COALESCE((SELECT SUM(spend_amount) FROM customer_reward_events e WHERE e.customer_email=o.customer_email AND e.event_type='earn'),0)<50000 THEN 11500
        WHEN COALESCE((SELECT SUM(spend_amount) FROM customer_reward_events e WHERE e.customer_email=o.customer_email AND e.event_type='earn'),0)<300000 THEN 13000
        WHEN COALESCE((SELECT SUM(spend_amount) FROM customer_reward_events e WHERE e.customer_email=o.customer_email AND e.event_type='earn'),0)<750000 THEN 15000
        WHEN COALESCE((SELECT SUM(spend_amount) FROM customer_reward_events e WHERE e.customer_email=o.customer_email AND e.event_type='earn'),0)<1250000 THEN 16500
        WHEN COALESCE((SELECT SUM(spend_amount) FROM customer_reward_events e WHERE e.customer_email=o.customer_email AND e.event_type='earn'),0)<2500000 THEN 18000
        ELSE 20000 END + 500000)/1000000 AS INTEGER),0,?
    FROM orders o
    WHERE o.id=? AND o.customer_email=? AND o.status='completed' AND o.amount>0
      AND o.created_at>=COALESCE((SELECT CAST(value AS INTEGER) FROM site_settings WHERE key='loyalty_started_at'),?)
  `).bind(at, orderId, email, at).run();
}
