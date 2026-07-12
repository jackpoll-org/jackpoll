-- Allow the RATING question type (#77).
-- Same pattern as V7 (slider): the questions_type_check constraint is immutable
-- per value, so recreate it with the full current QuestionType set including
-- RATING. Without this, saving a rating question 500s on a Flyway-managed DB.
ALTER TABLE public.questions DROP CONSTRAINT IF EXISTS questions_type_check;
ALTER TABLE public.questions ADD CONSTRAINT questions_type_check
    CHECK (((type)::text = ANY ((ARRAY[
        'SHORT_ANSWER'::character varying,
        'MULTIPLE_CHOICE'::character varying,
        'CHECKBOXES'::character varying,
        'DROPDOWN'::character varying,
        'MULTIPLE_CHOICE_GRID'::character varying,
        'CHECKBOX_GRID'::character varying,
        'FILE_UPLOAD'::character varying,
        'SLIDER'::character varying,
        'RATING'::character varying
    ])::text[])));
