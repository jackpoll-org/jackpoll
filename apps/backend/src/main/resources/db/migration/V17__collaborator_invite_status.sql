-- Collaboration invitations (#8): a collaborator now has a status so an invite
-- can be PENDING until the invitee accepts it in the app. Existing rows are
-- back-filled as ACCEPTED so current collaborators keep their access; new
-- invites are created PENDING by the app.
ALTER TABLE public.survey_collaborators
    ADD COLUMN status varchar(20) NOT NULL DEFAULT 'ACCEPTED';

ALTER TABLE public.survey_collaborators
    ADD CONSTRAINT survey_collaborators_status_check
    CHECK (status IN ('PENDING', 'ACCEPTED'));
