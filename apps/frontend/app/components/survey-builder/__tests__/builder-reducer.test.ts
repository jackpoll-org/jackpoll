import { describe, it, expect } from "vitest";
import { builderReducer, type BuilderState } from "../builder-reducer";
import type { Survey } from "@/app/types/survey";

function baseSurvey(): Survey {
  return {
    id: "s1",
    ownerId: "owner-1",
    title: "Test",
    status: "draft",
    settings: {
      allowMultipleResponses: false,
      showProgressBar: false,
      shuffleQuestions: false,
      isQuiz: false,
      showLiveResults: false,
      postSubmitSummary: false,
      showPoweredBy: false,
    rateLimit: false,
    onePerBrowser: false,
    requireCaptcha: false,
    },
    questions: [],
    createdAt: "2026-06-10T00:00:00Z",
    updatedAt: "2026-06-10T00:00:00Z",
  };
}

function state(survey: Survey, dirty = false): BuilderState {
  return { survey, dirty, locallyDirty: dirty };
}

describe("builderReducer", () => {
  it("updateMeta returns a new survey without mutating the original", () => {
    const initial = state(baseSurvey());
    const next = builderReducer(initial, {
      type: "updateMeta",
      patch: { title: "Renamed" },
    });

    expect(next.survey.title).toBe("Renamed");
    expect(next.dirty).toBe(true);
    expect(initial.survey.title).toBe("Test"); // unchanged
    expect(next.survey).not.toBe(initial.survey);
  });

  it("addQuestion appends a question with type defaults", () => {
    const next = builderReducer(state(baseSurvey()), {
      type: "addQuestion",
      questionType: "multiple-choice",
    });

    expect(next.survey.questions).toHaveLength(1);
    const q = next.survey.questions[0];
    expect(q.type).toBe("multiple-choice");
    expect(q.order).toBe(0);
    expect(q.options).toHaveLength(1);
    expect(next.dirty).toBe(true);
  });

  it("addQuestion for a grid type seeds rows and columns", () => {
    const next = builderReducer(state(baseSurvey()), {
      type: "addQuestion",
      questionType: "checkbox-grid",
    });
    const q = next.survey.questions[0];
    expect(q.rows).toHaveLength(1);
    expect(q.columns).toHaveLength(1);
  });

  it("addQuestion assigns the given sectionId (page), or null by default", () => {
    const onPage = builderReducer(state(baseSurvey()), {
      type: "addQuestion",
      questionType: "short-answer",
      sectionId: "sec-2",
    });
    expect(onPage.survey.questions[0].sectionId).toBe("sec-2");

    const onPage1 = builderReducer(state(baseSurvey()), {
      type: "addQuestion",
      questionType: "short-answer",
    });
    expect(onPage1.survey.questions[0].sectionId).toBeNull();
  });

  it("addSection uses the supplied id so the caller can select it", () => {
    const next = builderReducer(state(baseSurvey()), {
      type: "addSection",
      id: "sec-fixed",
    });
    expect(next.survey.sections).toHaveLength(1);
    expect(next.survey.sections?.[0].id).toBe("sec-fixed");
    expect(next.survey.sections?.[0].order).toBe(0);
  });

  it("updateQuestion patches only the targeted question", () => {
    const s1 = builderReducer(state(baseSurvey()), {
      type: "addQuestion",
      questionType: "short-answer",
    });
    const id = s1.survey.questions[0].id;

    const s2 = builderReducer(s1, {
      type: "updateQuestion",
      id,
      patch: { title: "What is your name?", required: true },
    });

    expect(s2.survey.questions[0].title).toBe("What is your name?");
    expect(s2.survey.questions[0].required).toBe(true);
    expect(s1.survey.questions[0].title).toBe(""); // original untouched
  });

  it("removeQuestion drops the question and reorders the rest", () => {
    let s = state(baseSurvey());
    s = builderReducer(s, { type: "addQuestion", questionType: "short-answer" });
    s = builderReducer(s, { type: "addQuestion", questionType: "dropdown" });
    const firstId = s.survey.questions[0].id;

    const after = builderReducer(s, { type: "removeQuestion", id: firstId });

    expect(after.survey.questions).toHaveLength(1);
    expect(after.survey.questions[0].type).toBe("dropdown");
    expect(after.survey.questions[0].order).toBe(0);
  });

  it("moveQuestion swaps order and respects bounds", () => {
    let s = state(baseSurvey());
    s = builderReducer(s, { type: "addQuestion", questionType: "short-answer" });
    s = builderReducer(s, { type: "addQuestion", questionType: "dropdown" });
    const [a, b] = s.survey.questions;

    const moved = builderReducer(s, {
      type: "moveQuestion",
      id: b.id,
      direction: "up",
    });
    expect(moved.survey.questions[0].id).toBe(b.id);
    expect(moved.survey.questions[0].order).toBe(0);
    expect(moved.survey.questions[1].id).toBe(a.id);

    // moving the top item up is a no-op
    const noop = builderReducer(moved, {
      type: "moveQuestion",
      id: b.id,
      direction: "up",
    });
    expect(noop).toBe(moved);
  });

  it("reorderQuestions moves a question and reindexes order", () => {
    let s = state(baseSurvey());
    s = builderReducer(s, { type: "addQuestion", questionType: "short-answer" });
    s = builderReducer(s, { type: "addQuestion", questionType: "dropdown" });
    s = builderReducer(s, { type: "addQuestion", questionType: "checkboxes" });
    const [a, b, c] = s.survey.questions;

    // drag the first question onto the third position
    const after = builderReducer(s, {
      type: "reorderQuestions",
      activeId: a.id,
      overId: c.id,
    });

    expect(after.survey.questions.map((q) => q.id)).toEqual([b.id, c.id, a.id]);
    expect(after.survey.questions.map((q) => q.order)).toEqual([0, 1, 2]);
    expect(after.dirty).toBe(true);
    // original untouched (immutability)
    expect(s.survey.questions[0].id).toBe(a.id);
  });

  it("reorderQuestions is a no-op when active equals over", () => {
    let s = state(baseSurvey());
    s = builderReducer(s, { type: "addQuestion", questionType: "short-answer" });
    const id = s.survey.questions[0].id;
    const after = builderReducer(s, {
      type: "reorderQuestions",
      activeId: id,
      overId: id,
    });
    expect(after).toBe(s);
  });

  it("updateSettings merges into survey settings immutably", () => {
    const initial = state(baseSurvey());
    const next = builderReducer(initial, {
      type: "updateSettings",
      patch: { confirmationMessage: "Danke!" },
    });

    expect(next.survey.settings.confirmationMessage).toBe("Danke!");
    // other settings preserved
    expect(next.survey.settings.showProgressBar).toBe(false);
    expect(next.dirty).toBe(true);
    expect(initial.survey.settings.confirmationMessage).toBeUndefined();
  });

  it("saved resets the dirty flag with the persisted survey", () => {
    const dirty = state(baseSurvey(), true);
    const saved = builderReducer(dirty, {
      type: "saved",
      survey: { ...baseSurvey(), title: "Persisted" },
    });
    expect(saved.dirty).toBe(false);
    expect(saved.survey.title).toBe("Persisted");
  });

  it("setLanguages stores enabled languages + default and prunes others", () => {
    const initial = state({
      ...baseSurvey(),
      languages: ["en", "de", "fr"],
      defaultLanguage: "en",
      i18n: { de: { title: "Hallo" }, fr: { title: "Bonjour" } },
    });
    const next = builderReducer(initial, {
      type: "setLanguages",
      languages: ["en", "de"],
      defaultLanguage: "en",
    });
    expect(next.survey.languages).toEqual(["en", "de"]);
    expect(next.survey.defaultLanguage).toBe("en");
    // fr was dropped from the enabled set, so its translations are pruned.
    expect(next.survey.i18n).toEqual({ de: { title: "Hallo" } });
    expect(next.dirty).toBe(true);
  });

  it("setTranslation sets and clears values immutably", () => {
    const initial = state({
      ...baseSurvey(),
      languages: ["en", "de"],
      defaultLanguage: "en",
    });
    const set = builderReducer(initial, {
      type: "setTranslation",
      locale: "de",
      key: "title",
      value: "Hallo",
    });
    expect(set.survey.i18n).toEqual({ de: { title: "Hallo" } });
    expect(initial.survey.i18n).toBeUndefined();

    const cleared = builderReducer(set, {
      type: "setTranslation",
      locale: "de",
      key: "title",
      value: "   ",
    });
    // Removing the last key drops the locale bag, then the whole map.
    expect(cleared.survey.i18n).toBeUndefined();
  });

  // ── locallyDirty flag (issue #85 autosave gating) ──────────────────
  it("local edits set both dirty and locallyDirty", () => {
    const next = builderReducer(state(baseSurvey()), {
      type: "updateMeta",
      patch: { title: "X" },
    });
    expect(next.dirty).toBe(true);
    expect(next.locallyDirty).toBe(true);
  });

  it("applyRemote is dirty but NOT locallyDirty (no autosave echo)", () => {
    const next = builderReducer(state(baseSurvey()), {
      type: "applyRemote",
      content: {
        title: "Remote",
        description: undefined,
        status: "draft",
        settings: baseSurvey().settings,
        questions: [],
        sections: [],
      },
    });
    expect(next.dirty).toBe(true);
    expect(next.locallyDirty).toBe(false);
    expect(next.survey.title).toBe("Remote");
  });

  it("saved clears locallyDirty", () => {
    const dirty = builderReducer(state(baseSurvey()), {
      type: "updateMeta",
      patch: { title: "X" },
    });
    const saved = builderReducer(dirty, { type: "saved", survey: baseSurvey() });
    expect(saved.locallyDirty).toBe(false);
  });
});
