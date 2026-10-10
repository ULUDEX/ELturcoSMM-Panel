-- Preserve the supplier for existing services and historic orders.
ALTER TABLE services ADD COLUMN provider_id TEXT NOT NULL DEFAULT 'panelfollows';
ALTER TABLE orders ADD COLUMN provider_id TEXT NOT NULL DEFAULT 'panelfollows';
CREATE INDEX services_provider_service_idx ON services(provider_id, provider_service_id);
CREATE INDEX orders_provider_order_idx ON orders(provider_id, provider_order_id);
