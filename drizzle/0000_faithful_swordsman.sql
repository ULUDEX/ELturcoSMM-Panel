CREATE TABLE `services` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`platform` text NOT NULL,
	`category` text NOT NULL,
	`name` text NOT NULL,
	`provider_service_id` text DEFAULT '' NOT NULL,
	`min_order` integer DEFAULT 10 NOT NULL,
	`max_order` integer DEFAULT 10000 NOT NULL,
	`cost_price` integer DEFAULT 0 NOT NULL,
	`sale_price` integer DEFAULT 0 NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL
);
