-- Per-option response quotas (issue #38).
-- capacity = optional cap on single-select choices (null = unlimited);
-- used = atomically maintained reservation counter.
ALTER TABLE public.question_options ADD COLUMN capacity integer;
ALTER TABLE public.question_options ADD COLUMN used integer NOT NULL DEFAULT 0;
