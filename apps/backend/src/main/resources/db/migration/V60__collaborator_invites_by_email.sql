ALTER TABLE public.survey_collaborators ADD COLUMN email varchar(255);
ALTER TABLE public.survey_collaborators ALTER COLUMN user_id DROP NOT NULL;

DELETE FROM public.survey_collaborators sc
WHERE sc.status = 'PENDING'
  AND NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = sc.user_id);

DELETE FROM public.survey_collaborators a
USING public.survey_collaborators b, public.users ua, public.users ub
WHERE a.status = 'PENDING' AND b.status = 'PENDING'
  AND a.survey_id = b.survey_id AND (a.created_at, a.id) > (b.created_at, b.id)
  AND ua.id = a.user_id AND ub.id = b.user_id
  AND lower(ua.email) = lower(ub.email);

UPDATE public.survey_collaborators sc
SET email = lower(u.email), user_id = NULL
FROM public.users u
WHERE u.id = sc.user_id AND sc.status = 'PENDING';

CREATE UNIQUE INDEX IF NOT EXISTS ux_survey_collaborators_survey_email
    ON public.survey_collaborators (survey_id, email);
