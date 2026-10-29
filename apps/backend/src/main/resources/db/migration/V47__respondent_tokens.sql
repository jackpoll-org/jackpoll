CREATE TABLE public.respondent_tokens (
    id varchar(36) PRIMARY KEY,
    survey_id varchar(36) NOT NULL,
    token varchar(128) NOT NULL,
    used_at timestamp(6) with time zone,
    session_id varchar(36),
    created_at timestamp(6) with time zone NOT NULL,
    CONSTRAINT uk_respondent_tokens_survey_token UNIQUE (survey_id, token)
);

ALTER TABLE public.survey_responses
    ADD COLUMN respondent_token varchar(128);
