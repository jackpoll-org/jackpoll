-- Manual drag-to-reorder of surveys on the dashboard (issue #94). A per-owner,
-- per-folder ordering index; lower sorts first. Nullable so existing rows are
-- backfilled below and new rows can default to "end of list" in the service.
ALTER TABLE public.surveys ADD COLUMN sort_position double precision;

-- Seed the manual order from the current default (most-recently-updated first)
-- within each owner+folder bucket, so the first manual view matches today's.
WITH ordered AS (
    SELECT
        id,
        row_number() OVER (
            PARTITION BY owner_id, folder_id
            ORDER BY updated_at DESC
        ) AS rn
    FROM public.surveys
)
UPDATE public.surveys s
SET sort_position = o.rn
FROM ordered o
WHERE s.id = o.id;
