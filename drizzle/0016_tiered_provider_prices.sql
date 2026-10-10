-- Apply the requested markup to supplier-backed services; historic orders are untouched.
UPDATE services
SET sale_price = CAST((cost_price * CASE
  WHEN cost_price < 1000 THEN 175
  WHEN cost_price < 5000 THEN 165
  ELSE 150 END + 50) / 100 AS INTEGER)
WHERE provider_service_id <> '' AND cost_price > 0;
