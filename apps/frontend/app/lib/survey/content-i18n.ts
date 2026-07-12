// ── Multilingual survey content (issue #37) ────────────────────────
//
// Translations are stored as a per-locale bag on the survey
// (`survey.i18n[locale][fieldKey] = text`). Field keys are built from the
// stable entity ids so logic, results and exports keep working against the
// canonical fields while respondents see translated text. Untranslated fields
// fall back to the canonical value — translations never block rendering.

import type { Option, Question, Section, Survey } from "@/app/types/survey";

/** Stable translation keys for every translatable field. */
export const fieldKeys = {
  surveyTitle: "title",
  surveyDescription: "description",
  confirmationMessage: "confirmationMessage",
  questionTitle: (id: string) => `question:${id}:title`,
  questionDescription: (id: string) => `question:${id}:description`,
  optionLabel: (id: string) => `option:${id}:label`,
  sectionTitle: (id: string) => `section:${id}:title`,
  sectionDescription: (id: string) => `section:${id}:description`,
} as const;

/** Whether a survey has more than one content language enabled. */
export function isMultilingual(survey: Survey): boolean {
  return (survey.languages?.length ?? 0) > 1;
}

/** The locale a survey was authored in (its canonical fields). */
export function defaultLanguageOf(survey: Survey): string | undefined {
  return survey.defaultLanguage ?? survey.languages?.[0];
}

/**
 * Resolve the best content locale for a respondent: the requested locale when
 * it is an enabled language, otherwise the survey default.
 */
export function resolveContentLocale(
  survey: Survey,
  requested: string | undefined,
): string | undefined {
  const langs = survey.languages ?? [];
  if (requested && langs.includes(requested)) return requested;
  return defaultLanguageOf(survey);
}

/** Read a single translation, or undefined when missing/blank. */
export function getTranslation(
  survey: Survey,
  locale: string | undefined,
  key: string,
): string | undefined {
  if (!locale) return undefined;
  const value = survey.i18n?.[locale]?.[key];
  return value && value.trim() ? value : undefined;
}

/**
 * Translate `canonical` for `locale`, falling back to the canonical value when
 * there is no translation (or when editing the default language).
 */
function tr(
  survey: Survey,
  locale: string | undefined,
  key: string,
  canonical: string | undefined,
): string | undefined {
  if (!locale || locale === defaultLanguageOf(survey)) return canonical;
  return getTranslation(survey, locale, key) ?? canonical;
}

function localizeOption(survey: Survey, locale: string | undefined, o: Option): Option {
  const label = tr(survey, locale, fieldKeys.optionLabel(o.id), o.label);
  return label === o.label ? o : { ...o, label: label ?? o.label };
}

function localizeOptions(
  survey: Survey,
  locale: string | undefined,
  options: Option[] | null | undefined,
): Option[] | null | undefined {
  if (!options) return options;
  return options.map((o) => localizeOption(survey, locale, o));
}

function localizeQuestion(survey: Survey, locale: string | undefined, q: Question): Question {
  return {
    ...q,
    title: tr(survey, locale, fieldKeys.questionTitle(q.id), q.title) ?? q.title,
    description: tr(survey, locale, fieldKeys.questionDescription(q.id), q.description),
    options: localizeOptions(survey, locale, q.options),
    rows: localizeOptions(survey, locale, q.rows),
    columns: localizeOptions(survey, locale, q.columns),
  };
}

function localizeSection(survey: Survey, locale: string | undefined, s: Section): Section {
  return {
    ...s,
    title: tr(survey, locale, fieldKeys.sectionTitle(s.id), s.title),
    description: tr(survey, locale, fieldKeys.sectionDescription(s.id), s.description),
  };
}

/**
 * Return a copy of the survey with every translatable field resolved for
 * `locale`. Ids are untouched so pagination, logic, piping and results still
 * align with the canonical survey. Returns the original survey when there is
 * nothing to translate (single language or default locale).
 */
export function localizeSurvey(survey: Survey, locale: string | undefined): Survey {
  if (!locale || locale === defaultLanguageOf(survey) || !survey.i18n) {
    return survey;
  }
  return {
    ...survey,
    title: tr(survey, locale, fieldKeys.surveyTitle, survey.title) ?? survey.title,
    description: tr(survey, locale, fieldKeys.surveyDescription, survey.description),
    settings: {
      ...survey.settings,
      confirmationMessage: tr(
        survey,
        locale,
        fieldKeys.confirmationMessage,
        survey.settings.confirmationMessage,
      ),
    },
    questions: survey.questions.map((q) => localizeQuestion(survey, locale, q)),
    sections: survey.sections?.map((s) => localizeSection(survey, locale, s)),
  };
}
