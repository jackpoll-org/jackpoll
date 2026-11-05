ALTER TABLE public.survey_responses ADD COLUMN IF NOT EXISTS bonus_points INTEGER;
ALTER TABLE public.survey_responses ADD COLUMN IF NOT EXISTS feedback TEXT;
ALTER TABLE public.survey_responses ADD COLUMN IF NOT EXISTS result_code VARCHAR(16);

CREATE UNIQUE INDEX IF NOT EXISTS ux_survey_responses_result_code
    ON public.survey_responses (survey_id, result_code)
    WHERE result_code IS NOT NULL;
