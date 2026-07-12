import { z } from "zod/v4";

import { normalizeRedirectUrl } from "@/app/lib/survey/redirect";

// ── Survey Zod schemas ─────────────────────────────────────────────
//
// Client-side validation for the builder. The backend re-validates on save.

const questionTypeSchema = z.enum([
  "short-answer",
  "multiple-choice",
  "checkboxes",
  "dropdown",
  "multiple-choice-grid",
  "checkbox-grid",
  "file-upload",
  "slider",
  "rating",
  "date",
  "ranking",
  "rating-grid",
  "signature",
]);

const surveyStatusSchema = z.enum(["draft", "published", "closed"]);

export const optionSchema = z.object({
  id: z.string(),
  label: z.string().min(1, "Option label is required").max(500),
});

export const questionSchema = z.object({
  id: z.string(),
  type: questionTypeSchema,
  title: z.string().min(1, "Question title is required").max(500),
  description: z.string().optional(),
  required: z.boolean(),
  order: z.number().int().min(0),
  options: z.array(optionSchema).nullish(),
  rows: z.array(optionSchema).nullish(),
  columns: z.array(optionSchema).nullish(),
  settings: z.record(z.string(), z.unknown()).nullish(),
  points: z.number().nullish(),
  correctAnswers: z.array(z.string()).nullish(),
});

const surveySettingsSchema = z.object({
  allowMultipleResponses: z.boolean(),
  confirmationMessage: z.string().optional(),
  // Only http/https targets are allowed — a bad scheme (javascript:, data:, …)
  // is rejected so the confirmation link can't execute script (see redirect.ts).
  redirectUrl: z
    .string()
    .optional()
    .refine((v) => !v || !v.trim() || normalizeRedirectUrl(v) !== null, {
      message: "Enter a valid http(s) URL",
    }),
  showProgressBar: z.boolean(),
  shuffleQuestions: z.boolean(),
  isQuiz: z.boolean(),
  timeLimit: z.number().optional(),
  passingScore: z.number().optional(),
  showCorrectAnswers: z
    .enum(["immediately", "after-submission", "never"])
    .optional(),
  // Data retention (issue #64)
  retentionDays: z.number().int().min(0).optional(),
  retentionAnonymize: z.boolean().optional(),
  // Respondent privacy notice & legal basis (issue #63)
  privacyNotice: z.string().optional(),
  requireConsent: z.boolean().optional(),
});

export const createSurveySchema = z.object({
  title: z.string().min(1, "Title is required").max(255),
  description: z.string().optional(),
});

export const updateSurveySchema = z.object({
  title: z.string().min(1, "Title is required").max(255),
  description: z.string().optional(),
  status: surveyStatusSchema,
  settings: surveySettingsSchema.optional(),
  questions: z.array(questionSchema),
});

// ── Inferred types ─────────────────────────────────────────────────

export type CreateSurveyFormData = z.infer<typeof createSurveySchema>;
export type UpdateSurveyFormData = z.infer<typeof updateSurveySchema>;
