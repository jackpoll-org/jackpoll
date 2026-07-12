-- Require respondent name (#): when a survey enables settings.requireRespondentName,
-- each response carries the name the respondent entered. Optional column; existing
-- responses have none.
ALTER TABLE public.survey_responses
    ADD COLUMN respondent_name varchar(200);
