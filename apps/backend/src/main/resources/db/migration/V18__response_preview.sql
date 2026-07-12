-- Preview submissions (#): a response created from the builder preview is
-- flagged so it never counts toward results/limits and is auto-purged after a
-- few minutes. Existing rows are real responses (default false).
ALTER TABLE public.survey_responses
    ADD COLUMN preview boolean NOT NULL DEFAULT false;

-- Fast lookup/cleanup of preview rows.
CREATE INDEX IF NOT EXISTS idx_survey_responses_preview
    ON public.survey_responses (preview, submitted_at);
