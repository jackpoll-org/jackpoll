-- Allow the LONG_ANSWER question type (multi-line paragraph answers, public #8).
-- Same immutable-constraint pattern as V7–V12: the questions_type_check
-- constraint is recreated with the full current QuestionType set so it matches
-- the JPA entity.
ALTER TABLE public.questions DROP CONSTRAINT IF EXISTS questions_type_check;
ALTER TABLE public.questions ADD CONSTRAINT questions_type_check
    CHECK (((type)::text = ANY ((ARRAY[
        'SHORT_ANSWER'::character varying,
        'LONG_ANSWER'::character varying,
        'MULTIPLE_CHOICE'::character varying,
        'CHECKBOXES'::character varying,
        'DROPDOWN'::character varying,
        'MULTIPLE_CHOICE_GRID'::character varying,
        'CHECKBOX_GRID'::character varying,
        'FILE_UPLOAD'::character varying,
        'SLIDER'::character varying,
        'RATING'::character varying,
        'DATE'::character varying,
        'RANKING'::character varying,
        'RATING_GRID'::character varying,
        'SIGNATURE'::character varying,
        'WORDCLOUD'::character varying
    ])::text[])));
