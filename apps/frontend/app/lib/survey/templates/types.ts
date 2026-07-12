import type { Question, SurveySettings } from "@/app/types/survey";

/** A reusable survey blueprint (curated catalog or user-saved, issues #17/#20). */
export interface SurveyTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  /** Marks user-saved templates so the picker can group them. */
  source?: "curated" | "custom";
  /** Optional survey-level settings applied when the template is used. */
  settings?: Partial<SurveySettings>;
  questions: Question[];
}

/** Payload to save a survey as a custom template (issue #20). */
export interface CreateTemplateInput {
  name: string;
  description?: string;
  questions: Question[];
  settings?: SurveySettings;
}

/** Raw custom-template record from the backend. */
export interface CustomTemplateDto {
  id: string;
  name: string;
  description?: string | null;
  questions: Question[];
  settings?: SurveySettings | null;
  updatedAt: string;
}
