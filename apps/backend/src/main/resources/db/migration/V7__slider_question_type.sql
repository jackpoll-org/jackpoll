-- Allow the SLIDER question type (#55).
-- The V1 baseline `questions_type_check` constraint predates the slider type,
-- so saving a slider question on a Flyway-managed database violated the CHECK
-- and surfaced as a 500 on PUT /surveys/{id}. Recreate the constraint with the
-- full current QuestionType set so it matches the JPA entity.
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
        'SLIDER'::character varying
    ])::text[])));
