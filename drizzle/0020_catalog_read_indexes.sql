CREATE INDEX IF NOT EXISTS orders_service_count_idx ON orders(service_id);
CREATE INDEX IF NOT EXISTS services_active_catalog_idx ON services(active,id DESC);
CREATE INDEX IF NOT EXISTS orders_created_report_idx ON orders(created_at);
