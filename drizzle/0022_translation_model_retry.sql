-- Retry setup calls rejected by a deprecated model; preserve successful caches.
UPDATE translation_usage SET characters=0 WHERE day=date('now') AND NOT EXISTS (SELECT 1 FROM translation_cache LIMIT 1);
