CREATE TABLE IF NOT EXISTS customer_password_resets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at INTEGER NOT NULL,
  used_at INTEGER,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_customer_password_resets_user_created
  ON customer_password_resets(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS customer_notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_email TEXT NOT NULL,
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  translations TEXT NOT NULL DEFAULT '{}',
  order_id INTEGER,
  read_at INTEGER,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_customer_notifications_email_id
  ON customer_notifications(customer_email, id DESC);

UPDATE customer_users SET avatar='man-1' WHERE avatar IS NULL OR avatar NOT IN ('man-1','man-2','man-3','woman-1','woman-2','woman-3');
