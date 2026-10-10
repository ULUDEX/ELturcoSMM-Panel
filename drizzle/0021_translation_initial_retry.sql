-- Retry initial setup failures only when no successful translations exist.
UPDATE translation_usage SET characters=0 WHERE day=date('now') AND NOT EXISTS (SELECT 1 FROM translation_cache LIMIT 1);
