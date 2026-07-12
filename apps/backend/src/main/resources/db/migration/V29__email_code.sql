-- Transient email verification / password-reset codes (#security email-verify).
-- Codes are short (6-digit) one-time secrets emailed via the backend mailer and
-- entered in the frontend. Only the HMAC hash is stored (never the plaintext).
-- One active code per (email, purpose): issuing a new code clears prior rows for
-- that pair. Rows are single-use (consumed) and expire; a scheduled sweep drops
-- stale rows. The durable "email verified" truth lives in Keycloak (the token's
-- email_verified claim) + the users table — this table is only the code channel.
CREATE TABLE email_code (
    id          VARCHAR(36)  PRIMARY KEY,          -- UUID
    email       VARCHAR(255) NOT NULL,
    purpose     VARCHAR(16)  NOT NULL,             -- VERIFY | RESET
    code_hash   VARCHAR(64)  NOT NULL,             -- HMAC-SHA256 hex of the code
    expires_at  TIMESTAMP    NOT NULL,
    attempts    INT          NOT NULL DEFAULT 0,   -- wrong-guess counter (lockout)
    consumed    BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMP    NOT NULL
);

-- Lookups are always by (email, purpose); expiry sweep scans expires_at.
CREATE INDEX idx_email_code_email_purpose ON email_code (email, purpose);
CREATE INDEX idx_email_code_expires_at ON email_code (expires_at);
