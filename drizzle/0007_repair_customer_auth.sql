CREATE TABLE IF NOT EXISTS `customer_users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`password_hash` text NOT NULL,
	`password_salt` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `customer_users_email_unique` ON `customer_users` (`email`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `customer_sessions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`token_hash` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `customer_sessions_token_unique` ON `customer_sessions` (`token_hash`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_customer_sessions_expiry` ON `customer_sessions` (`expires_at`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `customer_balances` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`email` text NOT NULL,
	`balance` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `customer_balances_email_unique` ON `customer_balances` (`email`);
