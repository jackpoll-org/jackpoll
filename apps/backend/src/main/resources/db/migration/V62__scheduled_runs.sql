ALTER TABLE public.live_sessions
    ADD COLUMN IF NOT EXISTS kind character varying(16) NOT NULL DEFAULT 'live',
    ADD COLUMN IF NOT EXISTS label character varying(120),
    ADD COLUMN IF NOT EXISTS opens_at timestamp(6) with time zone,
    ADD COLUMN IF NOT EXISTS closes_at timestamp(6) with time zone,
    ADD COLUMN IF NOT EXISTS closed_at timestamp(6) with time zone,
    ADD COLUMN IF NOT EXISTS snapshot jsonb,
    ADD COLUMN IF NOT EXISTS snapshot_at timestamp(6) with time zone;

CREATE INDEX IF NOT EXISTS idx_live_sessions_kind_opens
    ON public.live_sessions (kind, opens_at);

ALTER TABLE public.response_drafts
    ADD COLUMN IF NOT EXISTS run_id character varying(36);
