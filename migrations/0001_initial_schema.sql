CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS postgis;

DO $$
BEGIN
  CREATE TYPE price_type AS ENUM ('starting', 'range', 'negotiable', 'hourly');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE lead_status AS ENUM ('new', 'contacted', 'closed', 'invalid');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE chat_role AS ENUM ('user', 'assistant', 'system');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS service_categories (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  code varchar(64) NOT NULL UNIQUE,
  name varchar(80) NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS communities (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name varchar(120) NOT NULL,
  province varchar(80),
  city varchar(80),
  district varchar(80),
  address text,
  longitude numeric(10, 7),
  latitude numeric(10, 7),
  geo_point geometry(Point, 4326),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS communities_name_idx ON communities (name);
CREATE INDEX IF NOT EXISTS communities_geo_point_idx ON communities USING gist (geo_point);

CREATE TABLE IF NOT EXISTS merchants (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name varchar(160) NOT NULL,
  contact_name varchar(80),
  phone varchar(32) NOT NULL,
  wechat_id varchar(80),
  primary_category_id uuid REFERENCES service_categories(id),
  tags text[] NOT NULL DEFAULT '{}',
  province varchar(80),
  city varchar(80),
  district varchar(80),
  address text,
  longitude numeric(10, 7),
  latitude numeric(10, 7),
  geo_point geometry(Point, 4326),
  service_radius_km numeric(5, 2) NOT NULL DEFAULT 3,
  business_hours varchar(120),
  night_service boolean NOT NULL DEFAULT false,
  verified boolean NOT NULL DEFAULT false,
  rating numeric(3, 2),
  note text,
  source varchar(80) NOT NULL DEFAULT 'manual',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT merchants_name_phone_unique UNIQUE (name, phone)
);

CREATE INDEX IF NOT EXISTS merchants_phone_idx ON merchants (phone);
CREATE INDEX IF NOT EXISTS merchants_primary_category_idx ON merchants (primary_category_id);
CREATE INDEX IF NOT EXISTS merchants_geo_point_idx ON merchants USING gist (geo_point);

CREATE TABLE IF NOT EXISTS merchant_services (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  merchant_id uuid NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  category_id uuid REFERENCES service_categories(id),
  name varchar(160) NOT NULL,
  common_phrases text[] NOT NULL DEFAULT '{}',
  price_type price_type NOT NULL DEFAULT 'negotiable',
  min_price integer,
  max_price integer,
  price_description text,
  emergency_available boolean NOT NULL DEFAULT false,
  average_response_time varchar(80),
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS merchant_services_merchant_idx ON merchant_services (merchant_id);
CREATE INDEX IF NOT EXISTS merchant_services_category_idx ON merchant_services (category_id);
CREATE UNIQUE INDEX IF NOT EXISTS merchant_services_merchant_name_idx ON merchant_services (merchant_id, name);

CREATE OR REPLACE FUNCTION set_geo_point_from_lng_lat()
RETURNS trigger AS $$
BEGIN
  IF NEW.longitude IS NOT NULL AND NEW.latitude IS NOT NULL THEN
    NEW.geo_point = ST_SetSRID(ST_MakePoint(NEW.longitude::double precision, NEW.latitude::double precision), 4326);
  ELSE
    NEW.geo_point = NULL;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS communities_set_geo_point ON communities;
CREATE TRIGGER communities_set_geo_point
BEFORE INSERT OR UPDATE OF longitude, latitude
ON communities
FOR EACH ROW
EXECUTE FUNCTION set_geo_point_from_lng_lat();

DROP TRIGGER IF EXISTS merchants_set_geo_point ON merchants;
CREATE TRIGGER merchants_set_geo_point
BEFORE INSERT OR UPDATE OF longitude, latitude
ON merchants
FOR EACH ROW
EXECUTE FUNCTION set_geo_point_from_lng_lat();

UPDATE communities
SET longitude = longitude
WHERE longitude IS NOT NULL AND latitude IS NOT NULL;

UPDATE merchants
SET longitude = longitude
WHERE longitude IS NOT NULL AND latitude IS NOT NULL;

CREATE TABLE IF NOT EXISTS leads (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  merchant_id uuid REFERENCES merchants(id),
  merchant_service_id uuid REFERENCES merchant_services(id),
  user_open_id varchar(128),
  user_message text NOT NULL,
  user_phone varchar(32),
  status lead_status NOT NULL DEFAULT 'new',
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS leads_merchant_idx ON leads (merchant_id);
CREATE INDEX IF NOT EXISTS leads_status_idx ON leads (status);

CREATE TABLE IF NOT EXISTS chat_sessions (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_open_id varchar(128),
  community_id uuid REFERENCES communities(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id uuid NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
  role chat_role NOT NULL,
  content text NOT NULL,
  intent jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS chat_messages_session_idx ON chat_messages (session_id);

INSERT INTO service_categories (code, name, description)
VALUES
  ('pipe_unclogging', '管道疏通', '厨房下水、马桶、地漏、反水等疏通服务'),
  ('locksmith', '开锁换锁', '紧急开锁、换锁芯、门锁维修'),
  ('appliance_repair', '家电维修', '空调、冰箱、洗衣机、热水器等家电维修'),
  ('housekeeping', '家政保洁', '日常保洁、深度清洁、钟点工')
ON CONFLICT (code) DO NOTHING;
