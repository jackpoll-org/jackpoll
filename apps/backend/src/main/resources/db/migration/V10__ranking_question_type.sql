-- Allow the RANKING question type (#78).
-- Same immutable-constraint pattern as V7/V8/V9.
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
        'RATING'::character varying,
        'DATE'::character varying,
        'RANKING'::character varying
    ])::text[])));
