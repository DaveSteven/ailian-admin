ALTER TABLE staff_users
  ALTER COLUMN open_id DROP NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS staff_users_phone_idx
  ON staff_users (phone)
  WHERE phone IS NOT NULL;
