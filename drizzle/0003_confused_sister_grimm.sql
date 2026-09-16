CREATE TABLE `admin_login_attempts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`fingerprint` text NOT NULL,
	`success` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `customer_balances` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`email` text NOT NULL,
	`balance` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `customer_balances_email_unique` ON `customer_balances` (`email`);--> statement-breakpoint
CREATE TABLE `shopier_payments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`payment_ref` text NOT NULL,
	`shopier_order_id` text,
	`customer_email` text NOT NULL,
	`amount` integer NOT NULL,
	`status` text DEFAULT 'created' NOT NULL,
	`credited` integer DEFAULT false NOT NULL,
	`raw_event_hash` text DEFAULT '' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `shopier_payments_payment_ref_unique` ON `shopier_payments` (`payment_ref`);--> statement-breakpoint
CREATE UNIQUE INDEX `shopier_payments_shopier_order_id_unique` ON `shopier_payments` (`shopier_order_id`);