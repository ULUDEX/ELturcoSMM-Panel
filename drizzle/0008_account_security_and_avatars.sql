ALTER TABLE customer_users ADD COLUMN avatar TEXT NOT NULL DEFAULT 'star';
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS account_challenges (
  id TEXT PRIMARY KEY NOT NULL,
  answer_hash TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_account_challenges_expiry ON account_challenges(expires_at);
