CREATE TABLE translation_cache (locale TEXT NOT NULL, source_hash TEXT NOT NULL, source TEXT NOT NULL, translated TEXT NOT NULL, updated_at INTEGER NOT NULL, manual INTEGER NOT NULL DEFAULT 0, PRIMARY KEY(locale,source_hash));
CREATE TABLE translation_usage (day TEXT PRIMARY KEY, characters INTEGER NOT NULL DEFAULT 0);
CREATE TABLE translation_queue (locale TEXT NOT NULL, source_hash TEXT NOT NULL, source TEXT NOT NULL, attempts INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL, PRIMARY KEY(locale,source_hash));
