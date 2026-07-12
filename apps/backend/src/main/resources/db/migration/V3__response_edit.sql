-- Edit response after submission (issue #40): a private edit token + edit time.
ALTER TABLE public.survey_responses ADD COLUMN edit_token varchar(64);
ALTER TABLE public.survey_responses ADD COLUMN edited_at  timestamp(6) with time zone;

-- Unique where present (Postgres allows multiple NULLs in a unique index).
CREATE UNIQUE INDEX idx_survey_responses_edit_token
    ON public.survey_responses (edit_token);
