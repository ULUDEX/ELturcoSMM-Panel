CREATE INDEX `idx_admin_login_attempts_fingerprint_time` ON `admin_login_attempts` (`fingerprint`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_shopier_payments_event_hash` ON `shopier_payments` (`raw_event_hash`);--> statement-breakpoint
CREATE INDEX `idx_shopier_payments_customer` ON `shopier_payments` (`customer_email`,`created_at`);