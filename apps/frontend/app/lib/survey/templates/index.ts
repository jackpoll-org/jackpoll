import { cloneContent } from "@/app/lib/survey/clone";
import { curatedTemplates } from "./catalog";
import type { SurveyTemplate } from "./types";

export { curatedTemplates };
export type { SurveyTemplate };

export function instantiateTemplate(template: SurveyTemplate) {
  return cloneContent(template.questions, template.sections);
}
