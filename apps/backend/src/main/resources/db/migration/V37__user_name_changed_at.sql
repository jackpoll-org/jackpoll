-- Tracks the last display-name change so the once-a-week limit (#profile) can
-- be enforced independently of updated_at, which unrelated flows (email
-- verification, locale sync, ...) also touch.
ALTER TABLE users ADD COLUMN IF NOT EXISTS name_changed_at TIMESTAMP;
