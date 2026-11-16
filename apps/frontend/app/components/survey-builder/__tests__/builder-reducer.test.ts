import { describe, it, expect } from "vitest";
import { FIRST_PAGE_ID, builderReducer, firstPageSectionId, type BuilderState } from "../builder-reducer";
import type { Question, Survey } from "@/app/types/survey";
import { questionsInPageOrder } from "@/app/lib/survey/pagination";

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

  describe("reorderSections", () => {
    function paged(): BuilderState {
      const q = (id: string, sectionId: string | null, order: number) =>
        ({ id, type: "short-answer", title: id, required: false, order, sectionId }) as Survey["questions"][number];
      return state({
        ...baseSurvey(),
        sections: [
          { id: "a", order: 0 },
          { id: "b", order: 1 },
          { id: "c", order: 2 },
        ],
        questions: [q("p1", null, 0), q("a1", "a", 1), q("b1", "b", 2), q("b2", "b", 3), q("c1", "c", 4), q("orphan", "gone", 5)],
      });
    }

    it("moves a page to the drop target and renumbers section order", () => {
      const next = builderReducer(paged(), { type: "reorderSections", activeId: "c", overId: "a" });
      expect(next.survey.sections?.map((s) => [s.id, s.order])).toEqual([["c", 0], ["a", 1], ["b", 2]]);
      expect(next.dirty).toBe(true);
      expect(next.locallyDirty).toBe(true);
    });

    it("keeps each question on its page and puts question order into the new page flow", () => {
      const next = builderReducer(paged(), { type: "reorderSections", activeId: "b", overId: "a" });
      expect(next.survey.questions.map((q) => [q.id, q.sectionId, q.order])).toEqual([
        ["p1", null, 0],
        ["b1", "b", 1],
        ["b2", "b", 2],
        ["a1", "a", 3],
        ["c1", "c", 4],
        ["orphan", "gone", 5],
      ]);
    });

    function withFirstPageHeading(): BuilderState {
      const s = paged();
      return { ...s, survey: { ...s.survey, settings: { ...s.survey.settings, firstPageTitle: "Intro", firstPageDescription: "Hello" } } };
    }

    it("turns Page 1 into a real page when it is moved, then reorders", () => {
      const next = builderReducer(withFirstPageHeading(), {
        type: "reorderSections",
        activeId: FIRST_PAGE_ID,
        overId: "b"
      });
      expect(next.survey.sections?.map((s) => [s.id, s.order, s.title, s.description])).toEqual([
        ["a", 0, undefined, undefined],
        ["b", 1, undefined, undefined],
        ["s1-page-1", 2, "Intro", "Hello"],
        ["c", 3, undefined, undefined],
      ]);
      expect(next.survey.settings).not.toHaveProperty("firstPageTitle");
      expect(next.survey.settings).not.toHaveProperty("firstPageDescription");
      expect(next.survey.questions.map((q) => [q.id, q.sectionId, q.order])).toEqual([
        ["a1", "a", 0],
        ["b1", "b", 1],
        ["b2", "b", 2],
        ["p1", "s1-page-1", 3],
        ["c1", "c", 4],
        ["orphan", "gone", 5],
      ]);
      expect(next.locallyDirty).toBe(true);
    });

    it("treats a whitespace-only section id as Page 1 when converting", () => {
      const s = paged();
      const questions = s.survey.questions.map((q) => (q.id === "p1" ? { ...q, sectionId: " " } : q));
      const next = builderReducer({ ...s, survey: { ...s.survey, questions } }, {
        type: "reorderSections",
        activeId: FIRST_PAGE_ID,
        overId: "b"
      });
      expect(next.survey.questions.find((q) => q.id === "p1")?.sectionId).toBe("s1-page-1");
    });

    it("keeps the question order when pages move in conversational mode", () => {
      const s = paged();
      const conversational = { ...s, survey: { ...s.survey, settings: { ...s.survey.settings, conversational: true } } };
      const before = conversational.survey.questions.map((q) => q.id);
      const next = builderReducer(conversational, { type: "reorderSections", activeId: "c", overId: "a" });
      expect(next.survey.sections?.map((x) => x.id)).toEqual(["c", "a", "b"]);
      expect(next.survey.questions.map((q) => q.id)).toEqual(before);
    });

    it("turns Page 1 into a real page when another page is dropped before it", () => {
      const next = builderReducer(withFirstPageHeading(), {
        type: "reorderSections",
        activeId: "c",
        overId: FIRST_PAGE_ID
      });
      expect(next.survey.sections?.map((s) => s.id)).toEqual(["c", "s1-page-1", "a", "b"]);
      expect(next.survey.questions.filter((q) => q.sectionId == null)).toEqual([]);
      expect(next.survey.questions.map((q) => q.id)).toEqual(["c1", "p1", "a1", "b1", "b2", "orphan"]);
    });

    it("gives the converted Page 1 the same id on every editor", () => {
      const move = { type: "reorderSections", activeId: FIRST_PAGE_ID, overId: "a" } as const;
      const one = builderReducer(withFirstPageHeading(), move);
      const two = builderReducer(withFirstPageHeading(), move);
      expect(one.survey.sections?.[1].id).toBe("s1-page-1");
      expect(two.survey.sections?.map((s) => s.id)).toEqual(one.survey.sections?.map((s) => s.id));
    });

    it("derives a free id when the converted Page 1 id is taken", () => {
      const s = paged().survey;
      expect(firstPageSectionId(s)).toBe("s1-page-1");
      const taken = { ...s, sections: [...(s.sections ?? []), { id: "s1-page-1", order: 3 }, { id: "s1-page-1-2", order: 4 }] };
      expect(firstPageSectionId(taken)).toBe("s1-page-1-3");
    });

    it("leaves Page 1 implicit when it is not involved", () => {
      const initial = withFirstPageHeading();
      const next = builderReducer(initial, { type: "reorderSections", activeId: "c", overId: "a" });
      expect(next.survey.sections?.map((s) => s.id)).toEqual(["c", "a", "b"]);
      expect(next.survey.settings).toEqual(initial.survey.settings);
      expect(next.survey.questions.find((q) => q.id === "p1")?.sectionId).toBeNull();
    });

    it("is a no-op for the same id or an unknown id", () => {
      const initial = paged();
      expect(builderReducer(initial, { type: "reorderSections", activeId: "a", overId: "a" })).toBe(initial);
      expect(builderReducer(initial, { type: "reorderSections", activeId: "x", overId: "a" })).toBe(initial);
      expect(builderReducer(initial, { type: "reorderSections", activeId: FIRST_PAGE_ID, overId: "x" })).toBe(initial);
    });
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

  it("applyRemote never takes over a peer's owner-only settings", () => {
    const local = baseSurvey();
    const next = builderReducer(state(local), {
      type: "applyRemote",
      content: {
        title: local.title,
        description: undefined,
        status: "draft",
        settings: {
          ...local.settings,
          retentionDays: 1,
          showLiveResults: true,
          resultsReleased: true,
          ogShowOwner: true,
          showProgressBar: !local.settings.showProgressBar,
        },
        questions: [],
        sections: [],
      },
    });
    expect(next.survey.settings.retentionDays).toBe(local.settings.retentionDays);
    expect(next.survey.settings.showLiveResults).toBe(local.settings.showLiveResults);
    expect(next.survey.settings.resultsReleased).toBe(local.settings.resultsReleased);
    expect(next.survey.settings.ogShowOwner).toBe(local.settings.ogShowOwner);
    expect(next.survey.settings.showProgressBar).toBe(!local.settings.showProgressBar);
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

describe("saving a survey the server returns in page order", () => {
  const q = (id: string, sectionId: string | null, order: number) =>
    ({ id, type: "short-answer", title: id, required: false, order, sectionId }) as Question;
  const sections = [
    { id: "p2", title: "Two", order: 1 },
    { id: "p1", title: "One", order: 0 },
  ];
  const creationOrder = {
    ...baseSurvey(),
    sections,
    questions: [q("late", "p2", 0), q("a", "p1", 1), q("u", null, 2), q("b", "p1", 3), q("later", "p2", 4)],
  };
  const pageOrder = {
    ...creationOrder,
    questions: questionsInPageOrder(creationOrder).map((x, order) => ({ ...x, order })),
  };
  const onPage = (survey: Survey, page: string | null) =>
    survey.questions.filter((x) => (x.sectionId ?? null) === page).map((x) => x.id);

  it("keeps every builder page's questions in the same order", () => {
    const saved = builderReducer(state(creationOrder, true), { type: "saved", survey: pageOrder });
    for (const page of [null, "p1", "p2"]) {
      expect(onPage(saved.survey, page)).toEqual(onPage(creationOrder, page));
    }
    expect(saved.dirty).toBe(false);
    expect(saved.survey.questions.map((x) => x.order)).toEqual([0, 1, 2, 3, 4]);
  });

  it("still reorders within a page after the save", () => {
    const saved = builderReducer(state(creationOrder), { type: "saved", survey: pageOrder });
    const moved = builderReducer(saved, { type: "reorderQuestions", activeId: "later", overId: "late" });
    expect(onPage(moved.survey, "p2")).toEqual(["later", "late"]);
    expect(onPage(moved.survey, "p1")).toEqual(["a", "b"]);
  });
});
