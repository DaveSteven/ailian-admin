DO $$
BEGIN
  CREATE TYPE staff_role AS ENUM ('field_agent', 'reviewer', 'admin');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS staff_users (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  open_id varchar(128) NOT NULL UNIQUE,
  name varchar(80) NOT NULL,
  phone varchar(32),
  role staff_role NOT NULL DEFAULT 'field_agent',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS staff_sessions (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  staff_user_id uuid NOT NULL REFERENCES staff_users(id) ON DELETE CASCADE,
  token_hash varchar(64) NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS staff_sessions_staff_user_idx ON staff_sessions (staff_user_id);

ALTER TABLE merchants
  ADD COLUMN IF NOT EXISTS created_by_staff_id uuid REFERENCES staff_users(id);

CREATE INDEX IF NOT EXISTS merchants_created_by_staff_idx ON merchants (created_by_staff_id);
