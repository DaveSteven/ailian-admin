CREATE TABLE IF NOT EXISTS merchant_contacts (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  merchant_id uuid NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  name varchar(80) NOT NULL,
  phone varchar(32) NOT NULL,
  is_primary boolean NOT NULL DEFAULT false,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS merchant_contacts_merchant_idx
  ON merchant_contacts (merchant_id, position);

INSERT INTO merchant_contacts (merchant_id, name, phone, is_primary, position)
SELECT id, COALESCE(contact_name, '负责人'), phone, true, 0
FROM merchants
WHERE NOT EXISTS (
  SELECT 1 FROM merchant_contacts mc WHERE mc.merchant_id = merchants.id
);

CREATE TABLE IF NOT EXISTS merchant_media (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  merchant_id uuid NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  media_type varchar(24) NOT NULL CHECK (media_type IN ('merchant', 'qualification')),
  storage_key varchar(160) NOT NULL UNIQUE,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS merchant_media_merchant_idx
  ON merchant_media (merchant_id, media_type, position);
