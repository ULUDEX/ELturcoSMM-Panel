CREATE TABLE `customer_api_deliveries` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`webhook_id` integer NOT NULL,
	`event_id` integer NOT NULL,
	`state` text DEFAULT 'pending' NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`next_attempt_at` integer NOT NULL,
	`http_status` integer,
	`error` text DEFAULT '' NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`webhook_id`) REFERENCES `customer_api_webhooks`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`event_id`) REFERENCES `customer_api_events`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_customer_api_deliveries_due` ON `customer_api_deliveries` (`state`,`next_attempt_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_customer_api_delivery_event` ON `customer_api_deliveries` (`webhook_id`,`event_id`);--> statement-breakpoint
CREATE TABLE `customer_api_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`public_id` text NOT NULL,
	`user_id` integer NOT NULL,
	`type` text NOT NULL,
	`data` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `customer_users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `customer_api_events_public_id_unique` ON `customer_api_events` (`public_id`);--> statement-breakpoint
CREATE INDEX `idx_customer_api_events_user` ON `customer_api_events` (`user_id`,`id`);--> statement-breakpoint
CREATE TABLE `customer_api_order_metrics` (
	`order_id` integer PRIMARY KEY NOT NULL,
	`start_count` integer,
	`remains` integer,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `customer_api_preferences` (
	`user_id` integer PRIMARY KEY NOT NULL,
	`low_balance_threshold` integer,
	FOREIGN KEY (`user_id`) REFERENCES `customer_users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `customer_api_refills` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`order_id` integer NOT NULL,
	`user_id` integer NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `customer_users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `customer_api_refills_order_id_unique` ON `customer_api_refills` (`order_id`);--> statement-breakpoint
CREATE INDEX `idx_customer_api_refills_user` ON `customer_api_refills` (`user_id`,`id`);--> statement-breakpoint
CREATE TABLE `customer_api_webhooks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`url` text NOT NULL,
	`events` text DEFAULT '[]' NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`secret_cipher` text NOT NULL,
	`active` integer DEFAULT 1 NOT NULL,
	`failures` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `customer_users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_customer_api_webhooks_user` ON `customer_api_webhooks` (`user_id`,`id`);--> statement-breakpoint
DROP INDEX `idx_customer_api_keys_active`;--> statement-breakpoint
ALTER TABLE `customer_api_keys` ADD `label` text DEFAULT 'API key' NOT NULL;
--> statement-breakpoint
CREATE TRIGGER customer_api_order_created AFTER INSERT ON orders BEGIN
 INSERT INTO customer_api_events(public_id,user_id,type,data,created_at)
 SELECT 'evt_'||lower(hex(randomblob(16))),u.id,'order.created',json_object('order',json_object('object','order','id',NEW.id,'service',NEW.service_id,'status',NEW.status,'quantity',NEW.quantity,'charge',printf('%.4f',NEW.amount/100.0),'currency','TRY')),unixepoch()
 FROM customer_users u WHERE u.email=NEW.customer_email;
END;
--> statement-breakpoint
CREATE TRIGGER customer_api_order_updated AFTER UPDATE OF status ON orders WHEN OLD.status<>NEW.status BEGIN
 INSERT INTO customer_api_events(public_id,user_id,type,data,created_at)
 SELECT 'evt_'||lower(hex(randomblob(16))),u.id,CASE NEW.status WHEN 'processing' THEN 'order.processing' WHEN 'completed' THEN 'order.completed' WHEN 'partial' THEN 'order.partial' WHEN 'canceled' THEN 'order.canceled' ELSE 'order.updated' END,
 json_object('previous_status',OLD.status,'order',json_object('object','order','id',NEW.id,'service',NEW.service_id,'status',NEW.status,'quantity',NEW.quantity,'charge',printf('%.4f',NEW.amount/100.0),'currency','TRY')),unixepoch()
 FROM customer_users u WHERE u.email=NEW.customer_email;
END;
--> statement-breakpoint
CREATE TRIGGER customer_api_register_refill AFTER UPDATE OF provider_refill_id,provider_action ON orders WHEN NEW.provider_refill_id<>'' AND NEW.provider_action='refill_requested' BEGIN
 INSERT OR IGNORE INTO customer_api_refills(order_id,user_id,status,created_at,updated_at)
 SELECT NEW.id,u.id,'pending',unixepoch(),unixepoch() FROM customer_users u WHERE u.email=NEW.customer_email;
END;
--> statement-breakpoint
CREATE TRIGGER customer_api_refill_created AFTER INSERT ON customer_api_refills BEGIN
 INSERT INTO customer_api_events(public_id,user_id,type,data,created_at) VALUES('evt_'||lower(hex(randomblob(16))),NEW.user_id,'refill.created',json_object('refill',json_object('object','refill','id',NEW.id,'order',NEW.order_id,'status',NEW.status)),unixepoch());
END;
--> statement-breakpoint
CREATE TRIGGER customer_api_refill_updated AFTER UPDATE OF status ON customer_api_refills WHEN OLD.status<>NEW.status BEGIN
 INSERT INTO customer_api_events(public_id,user_id,type,data,created_at) VALUES('evt_'||lower(hex(randomblob(16))),NEW.user_id,'refill.updated',json_object('refill',json_object('object','refill','id',NEW.id,'order',NEW.order_id,'status',NEW.status)),unixepoch());
END;
--> statement-breakpoint
CREATE TRIGGER customer_api_low_balance AFTER UPDATE OF balance ON customer_balances BEGIN
 INSERT INTO customer_api_events(public_id,user_id,type,data,created_at)
 SELECT 'evt_'||lower(hex(randomblob(16))),u.id,'account.low_balance',json_object('balance',printf('%.4f',NEW.balance/100.0),'threshold',printf('%.4f',p.low_balance_threshold/100.0),'currency','TRY'),unixepoch()
 FROM customer_users u JOIN customer_api_preferences p ON p.user_id=u.id WHERE u.email=NEW.email AND p.low_balance_threshold IS NOT NULL AND OLD.balance>=p.low_balance_threshold AND NEW.balance<p.low_balance_threshold;
END;
--> statement-breakpoint
CREATE TRIGGER customer_api_event_outbox AFTER INSERT ON customer_api_events WHEN NEW.type<>'webhook.test' BEGIN
 INSERT OR IGNORE INTO customer_api_deliveries(webhook_id,event_id,next_attempt_at,updated_at)
 SELECT w.id,NEW.id,unixepoch(),unixepoch() FROM customer_api_webhooks w WHERE w.user_id=NEW.user_id AND w.active=1 AND (w.events='[]' OR EXISTS(SELECT 1 FROM json_each(w.events) WHERE value=NEW.type));
END;
