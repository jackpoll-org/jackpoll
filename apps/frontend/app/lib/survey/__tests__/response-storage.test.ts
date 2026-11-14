import { describe, it, expect } from "vitest";
import type { Question, Survey } from "@/app/types/survey";
import { allowsSaveLater, storageConflict, storesResponses } from "../response-storage";

function survey(settings: Partial<Survey["settings"]>, questions: Partial<Question>[] = []): Survey {
  return {
    id: "s1",
    title: "Quiz",
    status: "draft",
    settings: { isQuiz: true, ...settings },
    questions,
  } as unknown as Survey;
}

describe("response storage", () => {
  it("stores responses unless a quiz turns it off", () => {
    expect(storesResponses(survey({}).settings)).toBe(true);
    expect(storesResponses(survey({ doNotStoreResponses: true }).settings)).toBe(false);
    expect(storesResponses(survey({ isQuiz: false, doNotStoreResponses: true }).settings)).toBe(true);
  });

  it("allows save for later only when on and responses are stored", () => {
    expect(allowsSaveLater(survey({}).settings)).toBe(true);
    expect(allowsSaveLater(survey({ disableSaveLater: true }).settings)).toBe(false);
    expect(allowsSaveLater(survey({ doNotStoreResponses: true }).settings)).toBe(false);
  });

  it("reports settings and questions that need stored responses", () => {
    expect(storageConflict(survey({}))).toBeNull();
    expect(storageConflict(survey({ ownerNotify: "off" }))).toBeNull();
    for (const s of [
      { liveMode: true },
      { showLiveResults: true },
      { studentResults: true },
      { allowEditResponses: true },
      { onePerBrowser: true },
      { responseLimit: 5 },
      { requireRespondentToken: true },
      { ownerNotify: "daily" as const },
      { respondentReceipts: true },
    ]) {
      expect(storageConflict(survey(s))).toBe("settings");
    }
    for (const q of [
      { type: "long-answer" as const },
      { type: "file-upload" as const },
      { type: "signature" as const },
      { type: "short-answer" as const, settings: { manualGrading: true } },
      { type: "multiple-choice" as const, options: [{ id: "a", label: "A", capacity: 2 }] },
    ]) {
      expect(storageConflict(survey({}, [q]))).toBe("questions");
    }
  });
});
