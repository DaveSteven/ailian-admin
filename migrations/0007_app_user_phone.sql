ALTER TABLE app_users ADD COLUMN IF NOT EXISTS phone varchar(32);
CREATE UNIQUE INDEX IF NOT EXISTS app_users_phone_idx ON app_users (phone) WHERE phone IS NOT NULL;
