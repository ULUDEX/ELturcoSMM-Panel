ALTER TABLE customer_users ADD COLUMN email_verified_at INTEGER;

-- Accounts created before verification was introduced remain usable.
UPDATE customer_users SET email_verified_at=created_at WHERE email_verified_at IS NULL;

CREATE TABLE IF NOT EXISTS customer_email_verifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at INTEGER NOT NULL,
  used_at INTEGER,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_customer_email_verifications_user_created
  ON customer_email_verifications(user_id, created_at DESC);
