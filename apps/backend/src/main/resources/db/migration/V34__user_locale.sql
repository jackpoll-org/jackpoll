-- Language for transactional email, captured from the browser on sign-up /
-- sign-in. Null means "not known yet" and falls back to English at send time.
ALTER TABLE users ADD COLUMN IF NOT EXISTS locale VARCHAR(8);
