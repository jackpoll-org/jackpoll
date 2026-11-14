import { isManuallyGraded } from "@/app/lib/survey/grading";
import type { QuestionType, Survey, SurveySettings } from "@/app/types/survey";

export const UNSTORED_QUESTION_TYPES = new Set<QuestionType>(["long-answer", "file-upload", "signature"]);

export function storesResponses(settings: SurveySettings): boolean {
  return !(settings.isQuiz && settings.doNotStoreResponses);
}

export function allowsSaveLater(settings: SurveySettings): boolean {
  return !settings.disableSaveLater && storesResponses(settings);
}

export function storageConflict(survey: Survey): "settings" | "questions" | null {
  const s = survey.settings;
  if (
    s.liveMode ||
    s.showLiveResults ||
    s.studentResults ||
    s.allowEditResponses ||
    s.onePerBrowser ||
    (s.responseLimit ?? 0) > 0 ||
    s.requireRespondentToken ||
    (s.ownerNotify ?? "off") !== "off" ||
    s.respondentReceipts
  ) {
    return "settings";
  }
  const needsStorage = survey.questions.some(
    (q) =>
      UNSTORED_QUESTION_TYPES.has(q.type) ||
      isManuallyGraded(q) ||
      (q.options ?? []).some((o) => (o.capacity ?? 0) > 0),
  );
  return needsStorage ? "questions" : null;
}
