CREATE TABLE customer_api_keys (
 id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL REFERENCES customer_users(id),
 token_hash TEXT NOT NULL UNIQUE, prefix TEXT NOT NULL, created_at INTEGER NOT NULL,
 revoked_at INTEGER, last_used_at INTEGER
);
--> statement-breakpoint
CREATE INDEX idx_customer_api_keys_user ON customer_api_keys(user_id,revoked_at);
--> statement-breakpoint
CREATE UNIQUE INDEX idx_customer_api_keys_active ON customer_api_keys(user_id) WHERE revoked_at IS NULL;
--> statement-breakpoint
CREATE TABLE customer_api_usage (key_id INTEGER NOT NULL REFERENCES customer_api_keys(id), minute INTEGER NOT NULL, requests INTEGER NOT NULL DEFAULT 1, PRIMARY KEY(key_id,minute));
--> statement-breakpoint
CREATE TABLE customer_api_requests (user_id INTEGER NOT NULL REFERENCES customer_users(id), request_key TEXT NOT NULL, body_hash TEXT NOT NULL, state TEXT NOT NULL DEFAULT 'processing', response TEXT NOT NULL DEFAULT '', status_code INTEGER NOT NULL DEFAULT 202, created_at INTEGER NOT NULL, PRIMARY KEY(user_id,request_key));
--> statement-breakpoint
CREATE TABLE reseller_subscriptions (user_id INTEGER PRIMARY KEY REFERENCES customer_users(id), business_name TEXT NOT NULL, website TEXT NOT NULL DEFAULT '', state TEXT NOT NULL DEFAULT 'pending_payment', period_end INTEGER, cancel_at_period_end INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL);
--> statement-breakpoint
CREATE TABLE reseller_invoices (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL REFERENCES customer_users(id), reference TEXT NOT NULL UNIQUE, amount_usd INTEGER NOT NULL DEFAULT 2500, state TEXT NOT NULL DEFAULT 'pending', payment_reference TEXT NOT NULL DEFAULT '', created_at INTEGER NOT NULL, paid_at INTEGER);
--> statement-breakpoint
CREATE INDEX idx_reseller_invoices_user ON reseller_invoices(user_id,created_at);
--> statement-breakpoint
CREATE UNIQUE INDEX idx_reseller_invoice_pending ON reseller_invoices(user_id) WHERE state='pending';
--> statement-breakpoint
CREATE TABLE reseller_clients (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL REFERENCES customer_users(id), name TEXT NOT NULL, reference TEXT NOT NULL DEFAULT '', created_at INTEGER NOT NULL, archived_at INTEGER);
--> statement-breakpoint
CREATE INDEX idx_reseller_clients_user ON reseller_clients(user_id,archived_at);
