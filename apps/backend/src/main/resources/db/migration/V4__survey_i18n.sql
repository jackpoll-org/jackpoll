-- Multilingual survey content (issue #37).
-- Enabled locales, the default/canonical locale, and a per-locale field→text
-- translation bag keyed by stable field ids. All nullable so existing
-- single-language surveys are unaffected.
ALTER TABLE public.surveys ADD COLUMN languages jsonb;
ALTER TABLE public.surveys ADD COLUMN default_language varchar(10);
ALTER TABLE public.surveys ADD COLUMN i18n jsonb;
