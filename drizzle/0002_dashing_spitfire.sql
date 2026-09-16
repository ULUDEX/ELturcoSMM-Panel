ALTER TABLE `orders` ADD `service_id` integer;--> statement-breakpoint
ALTER TABLE `orders` ADD `provider_service_id` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `orders` ADD `provider_order_id` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `orders` ADD `provider_error` text DEFAULT '' NOT NULL;