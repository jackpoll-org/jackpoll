CREATE TABLE IF NOT EXISTS public.audit_events (
    id character varying(36) NOT NULL,
    actor_id character varying(36),
    action character varying(64) NOT NULL,
    target character varying(255),
    created_at timestamp(6) with time zone NOT NULL,
    CONSTRAINT audit_events_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_audit_events_actor ON public.audit_events (actor_id, created_at);
CREATE INDEX IF NOT EXISTS idx_audit_events_created ON public.audit_events (created_at);
