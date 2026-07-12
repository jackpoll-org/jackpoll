-- Account-level notification preferences (issue #89). Master channel switches
-- gating the dispatch on top of the per-survey ownerNotify cadence. Default
-- true so existing users keep today's behaviour (all channels on).
ALTER TABLE public.users ADD COLUMN notify_new_response_email boolean NOT NULL DEFAULT true;
ALTER TABLE public.users ADD COLUMN notify_new_response_mobile boolean NOT NULL DEFAULT true;
ALTER TABLE public.users ADD COLUMN notify_new_response_web boolean NOT NULL DEFAULT true;
ALTER TABLE public.users ADD COLUMN notify_daily_digest_email boolean NOT NULL DEFAULT true;
