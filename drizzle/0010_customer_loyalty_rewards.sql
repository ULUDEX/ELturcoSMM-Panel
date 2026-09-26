CREATE TABLE IF NOT EXISTS customer_reward_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_email TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('earn', 'redeem')),
  order_id INTEGER,
  spend_amount INTEGER NOT NULL DEFAULT 0,
  points INTEGER NOT NULL,
  balance_credit INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_customer_reward_events_email_id
  ON customer_reward_events(customer_email, id DESC);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS idx_customer_reward_events_order
  ON customer_reward_events(order_id)
  WHERE event_type='earn' AND order_id IS NOT NULL;
--> statement-breakpoint
INSERT INTO site_settings(key,value,updated_at)
VALUES('loyalty_started_at',CAST(strftime('%s','now') AS TEXT),CAST(strftime('%s','now') AS INTEGER))
ON CONFLICT(key) DO NOTHING;
