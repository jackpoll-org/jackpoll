CREATE TABLE IF NOT EXISTS public.job_runs (
    name character varying(64) NOT NULL,
    run_on date NOT NULL,
    CONSTRAINT job_runs_pkey PRIMARY KEY (name)
);
