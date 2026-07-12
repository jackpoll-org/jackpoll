-- Outbound webhooks per survey (issue #36).
CREATE TABLE public.webhooks (
    id               varchar(36)  NOT NULL,
    survey_id        varchar(36)  NOT NULL,
    url              varchar(2048) NOT NULL,
    enabled          boolean      NOT NULL,
    secret           varchar(64)  NOT NULL,
    created_at       timestamp(6) with time zone NOT NULL,
    last_status      integer,
    last_error       varchar(500),
    last_delivery_at timestamp(6) with time zone,
    PRIMARY KEY (id)
);

CREATE INDEX idx_webhooks_survey_id ON public.webhooks (survey_id);
