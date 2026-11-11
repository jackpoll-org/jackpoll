WITH stored AS (
    SELECT id,
           CASE WHEN jsonb_typeof(sections) = 'array' THEN sections ELSE '[]'::jsonb END AS sections
    FROM surveys
),
orphans AS (
    SELECT q.survey_id,
           q.section_id,
           row_number() OVER (PARTITION BY q.survey_id ORDER BY min(q.question_order), q.section_id) AS rn
    FROM questions q
    JOIN stored s ON s.id = q.survey_id
    WHERE q.section_id IS NOT NULL
      AND NOT EXISTS (
          SELECT 1 FROM jsonb_array_elements(s.sections) e WHERE e->>'id' = q.section_id
      )
    GROUP BY q.survey_id, q.section_id
),
next_order AS (
    SELECT s.id AS survey_id,
           greatest(coalesce(max(
               CASE WHEN jsonb_typeof(e->'order') = 'number' THEN (e->>'order')::numeric::int END
           ) + 1, 0), 0) AS base
    FROM stored s
    LEFT JOIN LATERAL jsonb_array_elements(s.sections) e ON true
    WHERE s.id IN (SELECT survey_id FROM orphans)
    GROUP BY s.id
),
recovered AS (
    SELECT o.survey_id,
           jsonb_agg(jsonb_build_object('id', o.section_id, 'order', n.base + o.rn - 1) ORDER BY o.rn) AS added
    FROM orphans o
    JOIN next_order n ON n.survey_id = o.survey_id
    GROUP BY o.survey_id
)
UPDATE surveys
SET sections = CASE WHEN jsonb_typeof(surveys.sections) = 'array' THEN surveys.sections ELSE '[]'::jsonb END
               || recovered.added
FROM recovered
WHERE surveys.id = recovered.survey_id;
