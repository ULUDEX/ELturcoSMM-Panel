ALTER TABLE customer_password_resets ADD COLUMN attempts INTEGER NOT NULL DEFAULT 0;
