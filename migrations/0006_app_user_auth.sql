CREATE TABLE IF NOT EXISTS app_users (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  open_id varchar(128) NOT NULL UNIQUE,
  union_id varchar(128),
  nickname varchar(80) NOT NULL DEFAULT '微信用户',
  avatar_url text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_login_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS app_user_sessions (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  app_user_id uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  token_hash varchar(64) NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS app_user_sessions_user_idx ON app_user_sessions (app_user_id);
