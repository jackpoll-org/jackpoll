-- Flyway baseline (V1): the Survey School application schema.
-- Generated from the Hibernate-managed schema (issue #41). Keycloak owns
-- its own tables in the same database and is NOT part of this migration.
-- After this baseline, every schema change ships as a new V<n>__*.sql file.

--
-- PostgreSQL database dump
--


-- Dumped from database version 16.13
-- Dumped by pg_dump version 16.13

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: access_codes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.access_codes (
    require_code boolean NOT NULL,
    last_rotated_at timestamp(6) with time zone NOT NULL,
    code character varying(16) NOT NULL,
    id character varying(36) NOT NULL,
    survey_id character varying(36) NOT NULL
);


--
-- Name: analytics_counters; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.analytics_counters (
    count bigint NOT NULL,
    dimension character varying(20) NOT NULL,
    id character varying(36) NOT NULL,
    survey_id character varying(36) NOT NULL,
    metric_key character varying(120) NOT NULL
);


--
-- Name: collab_links; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.collab_links (
    created_at timestamp(6) with time zone NOT NULL,
    updated_at timestamp(6) with time zone NOT NULL,
    slug character varying(24) NOT NULL,
    id character varying(36) NOT NULL,
    survey_id character varying(36) NOT NULL,
    expires_at character varying(255)
);


--
-- Name: folders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.folders (
    created_at timestamp(6) with time zone NOT NULL,
    id character varying(36) NOT NULL,
    owner_id character varying(36) NOT NULL,
    name character varying(120) NOT NULL
);


--
-- Name: question_options; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.question_options (
    option_order integer NOT NULL,
    kind character varying(10) NOT NULL,
    id character varying(36) NOT NULL,
    question_id character varying(36) NOT NULL,
    label character varying(500) NOT NULL,
    CONSTRAINT question_options_kind_check CHECK (((kind)::text = ANY ((ARRAY['OPTION'::character varying, 'ROW'::character varying, 'COLUMN'::character varying])::text[])))
);


--
-- Name: questions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.questions (
    points integer,
    question_order integer NOT NULL,
    required boolean NOT NULL,
    show_in_live_results boolean,
    id character varying(36) NOT NULL,
    section_id character varying(36),
    survey_id character varying(36) NOT NULL,
    type character varying(40) NOT NULL,
    title character varying(500) NOT NULL,
    description text,
    correct_answers jsonb,
    settings jsonb,
    CONSTRAINT questions_type_check CHECK (((type)::text = ANY ((ARRAY['SHORT_ANSWER'::character varying, 'MULTIPLE_CHOICE'::character varying, 'CHECKBOXES'::character varying, 'DROPDOWN'::character varying, 'MULTIPLE_CHOICE_GRID'::character varying, 'CHECKBOX_GRID'::character varying, 'FILE_UPLOAD'::character varying])::text[])))
);


--
-- Name: response_answers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.response_answers (
    id character varying(36) NOT NULL,
    question_id character varying(36) NOT NULL,
    response_id character varying(36) NOT NULL,
    value jsonb
);


--
-- Name: response_drafts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.response_drafts (
    "position" integer,
    created_at timestamp(6) with time zone NOT NULL,
    expires_at timestamp(6) with time zone NOT NULL,
    updated_at timestamp(6) with time zone NOT NULL,
    id character varying(36) NOT NULL,
    survey_id character varying(36) NOT NULL,
    token character varying(48) NOT NULL,
    answers jsonb
);


--
-- Name: share_links; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.share_links (
    max_responses integer,
    created_at timestamp(6) with time zone NOT NULL,
    updated_at timestamp(6) with time zone NOT NULL,
    slug character varying(24) NOT NULL,
    id character varying(36) NOT NULL,
    survey_id character varying(36) NOT NULL,
    expires_at character varying(255)
);


--
-- Name: survey_collaborators; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.survey_collaborators (
    created_at timestamp(6) with time zone NOT NULL,
    role character varying(20) NOT NULL,
    id character varying(36) NOT NULL,
    survey_id character varying(36) NOT NULL,
    user_id character varying(36) NOT NULL,
    CONSTRAINT survey_collaborators_role_check CHECK (((role)::text = ANY ((ARRAY['EDITOR'::character varying, 'VIEWER'::character varying])::text[])))
);


--
-- Name: survey_responses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.survey_responses (
    max_score integer,
    passed boolean,
    score integer,
    duration_ms bigint,
    submitted_at timestamp(6) with time zone NOT NULL,
    id character varying(36) NOT NULL,
    survey_id character varying(36) NOT NULL,
    client_id character varying(64)
);


--
-- Name: surveys; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.surveys (
    created_at timestamp(6) with time zone NOT NULL,
    updated_at timestamp(6) with time zone NOT NULL,
    status character varying(20) NOT NULL,
    folder_id character varying(36),
    id character varying(36) NOT NULL,
    owner_id character varying(36) NOT NULL,
    description text,
    title character varying(255) NOT NULL,
    sections jsonb,
    settings jsonb,
    tags jsonb,
    CONSTRAINT surveys_status_check CHECK (((status)::text = ANY ((ARRAY['DRAFT'::character varying, 'PUBLISHED'::character varying, 'CLOSED'::character varying])::text[])))
);


--
-- Name: templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.templates (
    created_at timestamp(6) with time zone NOT NULL,
    updated_at timestamp(6) with time zone NOT NULL,
    id character varying(36) NOT NULL,
    owner_id character varying(36) NOT NULL,
    description text,
    name character varying(255) NOT NULL,
    questions jsonb,
    settings jsonb
);


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    email_verified boolean NOT NULL,
    created_at timestamp(6) with time zone NOT NULL,
    updated_at timestamp(6) with time zone NOT NULL,
    id character varying(36) NOT NULL,
    email character varying(255) NOT NULL,
    name character varying(255) NOT NULL
);


--
-- Name: access_codes access_codes_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.access_codes
    ADD CONSTRAINT access_codes_code_key UNIQUE (code);


--
-- Name: access_codes access_codes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.access_codes
    ADD CONSTRAINT access_codes_pkey PRIMARY KEY (id);


--
-- Name: access_codes access_codes_survey_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.access_codes
    ADD CONSTRAINT access_codes_survey_id_key UNIQUE (survey_id);


--
-- Name: analytics_counters analytics_counters_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.analytics_counters
    ADD CONSTRAINT analytics_counters_pkey PRIMARY KEY (id);


--
-- Name: analytics_counters analytics_counters_survey_id_dimension_metric_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.analytics_counters
    ADD CONSTRAINT analytics_counters_survey_id_dimension_metric_key_key UNIQUE (survey_id, dimension, metric_key);


--
-- Name: collab_links collab_links_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.collab_links
    ADD CONSTRAINT collab_links_pkey PRIMARY KEY (id);


--
-- Name: collab_links collab_links_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.collab_links
    ADD CONSTRAINT collab_links_slug_key UNIQUE (slug);


--
-- Name: collab_links collab_links_survey_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.collab_links
    ADD CONSTRAINT collab_links_survey_id_key UNIQUE (survey_id);


--
-- Name: folders folders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.folders
    ADD CONSTRAINT folders_pkey PRIMARY KEY (id);


--
-- Name: question_options question_options_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.question_options
    ADD CONSTRAINT question_options_pkey PRIMARY KEY (id);


--
-- Name: questions questions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.questions
    ADD CONSTRAINT questions_pkey PRIMARY KEY (id);


--
-- Name: response_answers response_answers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.response_answers
    ADD CONSTRAINT response_answers_pkey PRIMARY KEY (id);


--
-- Name: response_drafts response_drafts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.response_drafts
    ADD CONSTRAINT response_drafts_pkey PRIMARY KEY (id);


--
-- Name: response_drafts response_drafts_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.response_drafts
    ADD CONSTRAINT response_drafts_token_key UNIQUE (token);


--
-- Name: share_links share_links_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.share_links
    ADD CONSTRAINT share_links_pkey PRIMARY KEY (id);


--
-- Name: share_links share_links_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.share_links
    ADD CONSTRAINT share_links_slug_key UNIQUE (slug);


--
-- Name: share_links share_links_survey_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.share_links
    ADD CONSTRAINT share_links_survey_id_key UNIQUE (survey_id);


--
-- Name: survey_collaborators survey_collaborators_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.survey_collaborators
    ADD CONSTRAINT survey_collaborators_pkey PRIMARY KEY (id);


--
-- Name: survey_collaborators survey_collaborators_survey_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.survey_collaborators
    ADD CONSTRAINT survey_collaborators_survey_id_user_id_key UNIQUE (survey_id, user_id);


--
-- Name: survey_responses survey_responses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.survey_responses
    ADD CONSTRAINT survey_responses_pkey PRIMARY KEY (id);


--
-- Name: surveys surveys_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.surveys
    ADD CONSTRAINT surveys_pkey PRIMARY KEY (id);


--
-- Name: templates templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.templates
    ADD CONSTRAINT templates_pkey PRIMARY KEY (id);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: response_answers fk6sfaa34rk7qyobbrebm8uiwo7; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.response_answers
    ADD CONSTRAINT fk6sfaa34rk7qyobbrebm8uiwo7 FOREIGN KEY (response_id) REFERENCES public.survey_responses(id);


--
-- Name: questions fknf38uiy78c0g0tmo68btk3y0p; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.questions
    ADD CONSTRAINT fknf38uiy78c0g0tmo68btk3y0p FOREIGN KEY (survey_id) REFERENCES public.surveys(id);


--
-- Name: question_options fksb9v00wdrgc9qojtjkv7e1gkp; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.question_options
    ADD CONSTRAINT fksb9v00wdrgc9qojtjkv7e1gkp FOREIGN KEY (question_id) REFERENCES public.questions(id);


--
-- PostgreSQL database dump complete
--


