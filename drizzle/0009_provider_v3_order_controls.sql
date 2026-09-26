ALTER TABLE services ADD COLUMN price_unit TEXT NOT NULL DEFAULT 'per_1000';
--> statement-breakpoint
ALTER TABLE services ADD COLUMN provider_features TEXT NOT NULL DEFAULT '{}';
--> statement-breakpoint
ALTER TABLE services ADD COLUMN provider_fields TEXT NOT NULL DEFAULT '[]';
--> statement-breakpoint
ALTER TABLE services ADD COLUMN average_time_seconds INTEGER NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE orders ADD COLUMN customer_email TEXT NOT NULL DEFAULT '';
--> statement-breakpoint
ALTER TABLE orders ADD COLUMN provider_refill_id TEXT NOT NULL DEFAULT '';
--> statement-breakpoint
ALTER TABLE orders ADD COLUMN provider_action TEXT NOT NULL DEFAULT '';
--> statement-breakpoint
ALTER TABLE orders ADD COLUMN provider_synced_at INTEGER NOT NULL DEFAULT 0;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON orders(customer_email, id);
