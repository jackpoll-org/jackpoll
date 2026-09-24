-- Student-by-student grading (public #6): teachers award points to answers
-- that can't be scored automatically (paragraphs, file uploads, ...).
--   response_answers.awarded_points  points given by the teacher; null = not graded
--   response_answers.graded_at       when those points were last set
--   survey_responses.auto_score      the automatic score at submit (incl. the live
--                                    quiz speed bonus); score = auto_score + awards
--   survey_responses.grading_pending true while answered manual questions await points
ALTER TABLE public.response_answers ADD COLUMN IF NOT EXISTS awarded_points INTEGER;
ALTER TABLE public.response_answers ADD COLUMN IF NOT EXISTS graded_at TIMESTAMP(6) WITH TIME ZONE;
ALTER TABLE public.survey_responses ADD COLUMN IF NOT EXISTS auto_score INTEGER;
ALTER TABLE public.survey_responses ADD COLUMN IF NOT EXISTS grading_pending BOOLEAN;

-- Existing scores were entirely automatic.
UPDATE public.survey_responses SET auto_score = score WHERE score IS NOT NULL AND auto_score IS NULL;
