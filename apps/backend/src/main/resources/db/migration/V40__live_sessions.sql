-- Live quiz sessions: every time the presenter starts a live game a session is
-- opened, and live answers are tagged with the session running when they
-- arrive. Results, the leaderboard and exports can then be narrowed to one
-- game instead of mixing every run of the quiz. Existing responses have no
-- session and keep showing under "all sessions".
CREATE TABLE IF NOT EXISTS public.live_sessions (
    id character varying(36) NOT NULL,
    survey_id character varying(36) NOT NULL,
    started_at timestamp(6) with time zone NOT NULL,
    CONSTRAINT live_sessions_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_live_sessions_survey
    ON public.live_sessions (survey_id, started_at);

ALTER TABLE public.survey_responses
    ADD COLUMN IF NOT EXISTS session_id character varying(36);

CREATE INDEX IF NOT EXISTS idx_survey_responses_session
    ON public.survey_responses (session_id);
