-- When an account accepted the terms of use, and which version. Nullable:
-- accounts created before terms existed never accepted any.
ALTER TABLE users ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS terms_version VARCHAR(32);
