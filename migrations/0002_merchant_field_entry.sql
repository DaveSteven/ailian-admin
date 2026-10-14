DO $$
BEGIN
  CREATE TYPE merchant_review_status AS ENUM ('pending', 'approved', 'rejected');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE merchants
  ADD COLUMN IF NOT EXISTS coordinate_system varchar(16) NOT NULL DEFAULT 'gcj02';

ALTER TABLE merchants
  ADD COLUMN IF NOT EXISTS review_status merchant_review_status;

UPDATE merchants
SET review_status = 'approved'
WHERE review_status IS NULL;

ALTER TABLE merchants
  ALTER COLUMN review_status SET NOT NULL,
  ALTER COLUMN review_status SET DEFAULT 'pending';

CREATE INDEX IF NOT EXISTS merchants_review_status_idx ON merchants (review_status);
