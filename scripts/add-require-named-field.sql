ALTER TABLE users
ADD COLUMN IF NOT EXISTS require_named_enabled boolean NOT NULL DEFAULT false;
