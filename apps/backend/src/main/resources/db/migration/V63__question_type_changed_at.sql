ALTER TABLE public.questions
    ADD COLUMN IF NOT EXISTS type_changed_at timestamp(6) with time zone;

UPDATE public.questions q
SET type_changed_at = now()
WHERE q.type IN ('MULTIPLE_CHOICE', 'DROPDOWN', 'CHECKBOXES', 'RANKING')
  AND EXISTS (
    SELECT 1
    FROM public.response_answers a
    CROSS JOIN LATERAL jsonb_array_elements(
        CASE WHEN jsonb_typeof(a.value) = 'array' THEN a.value ELSE jsonb_build_array(a.value) END) AS item(value)
    WHERE a.question_id = q.id
      AND jsonb_typeof(item.value) = 'string'
      AND item.value #>> '{}' !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      AND NOT EXISTS (
        SELECT 1 FROM public.question_options o
        WHERE o.question_id = q.id AND o.kind = 'OPTION' AND o.id = item.value #>> '{}'));
