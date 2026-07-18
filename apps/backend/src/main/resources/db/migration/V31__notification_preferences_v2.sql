-- Extend account-level notification preferences (issue #89) to a full
-- event x channel matrix (9 events), plus a persisted in-app notification
-- center. Replaces the flat notify_* boolean columns on users (V14) with a
-- normalized table, since a handful of flat columns no longer scales to
-- 9 events x up to 4 channels. A missing (user_id, event_type, channel) row
-- means "enabled" by default, so existing users keep today's all-on
-- behaviour with no backfill needed.
CREATE TABLE public.notification_preferences (
    user_id     varchar(36) NOT NULL,
    event_type  varchar(40) NOT NULL,
    channel     varchar(16) NOT NULL,
    enabled     boolean     NOT NULL,
    PRIMARY KEY (user_id, event_type, channel)
);

-- Carry over any existing opt-outs from the old flat columns (V14) before
-- dropping them. New scheme defaults a missing row to "enabled", so we only
-- need to insert the false (disabled) cases here.
INSERT INTO public.notification_preferences (user_id, event_type, channel, enabled)
SELECT id, 'new_response', 'email', false FROM public.users WHERE notify_new_response_email = false
UNION ALL
SELECT id, 'new_response', 'mobile_push', false FROM public.users WHERE notify_new_response_mobile = false
UNION ALL
SELECT id, 'new_response', 'web_push', false FROM public.users WHERE notify_new_response_web = false
UNION ALL
SELECT id, 'daily_digest', 'email', false FROM public.users WHERE notify_daily_digest_email = false;

ALTER TABLE public.users DROP COLUMN notify_new_response_email;
ALTER TABLE public.users DROP COLUMN notify_new_response_mobile;
ALTER TABLE public.users DROP COLUMN notify_new_response_web;
ALTER TABLE public.users DROP COLUMN notify_daily_digest_email;

-- In-app notification center: persisted, per-user notification records.
CREATE TABLE public.notifications (
    id          varchar(36) NOT NULL,
    user_id     varchar(36) NOT NULL,
    event_type  varchar(40) NOT NULL,
    title       varchar(255) NOT NULL,
    body        text,
    link        varchar(512),
    read_at     timestamp(6) with time zone,
    created_at  timestamp(6) with time zone NOT NULL DEFAULT now(),
    PRIMARY KEY (id)
);

-- Unread-count query: WHERE user_id = ? AND read_at IS NULL. Partial index
-- keeps it small since unread rows are the hot, shrinking subset.
CREATE INDEX idx_notifications_user_unread
    ON public.notifications (user_id)
    WHERE read_at IS NULL;

-- Paginated "all notifications" list: WHERE user_id = ? ORDER BY created_at DESC.
CREATE INDEX idx_notifications_user_created
    ON public.notifications (user_id, created_at DESC);

-- Response-milestone notifications: last response-count threshold already
-- notified for, so we fire once per threshold crossing instead of on every
-- subsequent response.
ALTER TABLE public.surveys ADD COLUMN milestone_notified integer NOT NULL DEFAULT 0;

-- Webhook-failing notifications: track a consecutive-failure streak and
-- whether we've already notified for the current streak, so we notify once
-- when it crosses the threshold and reset on the next successful delivery.
ALTER TABLE public.webhooks ADD COLUMN consecutive_failures integer NOT NULL DEFAULT 0;
ALTER TABLE public.webhooks ADD COLUMN failure_notified boolean NOT NULL DEFAULT false;
