-- Local user ids are the Keycloak username (the sign-in email) whenever the
-- token carries no sub claim, and emails exceed the 36 characters sized for
-- UUIDs: those accounts could not sign in. Widening a varchar only changes
-- metadata in Postgres, so existing rows and indexes stay untouched.
ALTER TABLE users ALTER COLUMN id TYPE VARCHAR(255);
ALTER TABLE surveys ALTER COLUMN owner_id TYPE VARCHAR(255);
ALTER TABLE folders ALTER COLUMN owner_id TYPE VARCHAR(255);
ALTER TABLE templates ALTER COLUMN owner_id TYPE VARCHAR(255);
ALTER TABLE survey_collaborators ALTER COLUMN user_id TYPE VARCHAR(255);
ALTER TABLE notifications ALTER COLUMN user_id TYPE VARCHAR(255);
ALTER TABLE notification_preferences ALTER COLUMN user_id TYPE VARCHAR(255);
ALTER TABLE device_tokens ALTER COLUMN user_id TYPE VARCHAR(255);
