-- Push-notification device tokens (mobile app).
CREATE TABLE public.device_tokens (
    id varchar(36) PRIMARY KEY,
    user_id varchar(36) NOT NULL,
    token varchar(512) NOT NULL,
    platform varchar(16),
    created_at timestamp(6) with time zone NOT NULL
);
CREATE UNIQUE INDEX idx_device_tokens_token ON public.device_tokens (token);
CREATE INDEX idx_device_tokens_user ON public.device_tokens (user_id);
