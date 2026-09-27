ALTER TABLE orders ADD COLUMN source TEXT NOT NULL DEFAULT 'site';
ALTER TABLE orders ADD COLUMN external_reference TEXT NOT NULL DEFAULT '';
ALTER TABLE orders ADD COLUMN external_sale_amount INTEGER NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN provider_cost INTEGER NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS orders_source_created_at_idx ON orders(source, created_at DESC);
