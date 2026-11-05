CREATE TABLE public.api_keys (
    id varchar(36) PRIMARY KEY,
    user_id varchar(255) NOT NULL,
    name varchar(100) NOT NULL,
    prefix varchar(16) NOT NULL,
    key_hash varchar(64) NOT NULL,
    scopes varchar(100) NOT NULL,
    created_at timestamp(6) with time zone NOT NULL,
    last_used_at timestamp(6) with time zone,
    CONSTRAINT uk_api_keys_hash UNIQUE (key_hash)
);

CREATE INDEX ix_api_keys_user ON public.api_keys (user_id);
