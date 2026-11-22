import { describe, it, expect } from "vitest";
import * as Y from "yjs";
import { applyContentToDoc, docToContent, type CollabContent } from "../doc";
import type { Question } from "@/app/types/survey";
import { FIRST_PAGE_ID, builderReducer, initialBuilderState } from "@/app/components/survey-builder/builder-reducer";

function q(id: string, title: string, order: number): Question {
  return {
    id,
    type: "short-answer",
    title,
    required: false,
    order,
    options: null,
    rows: null,
    columns: null,
    settings: null,
    points: null,
    correctAnswers: null,
    showInLiveResults: null,
    sectionId: null,
    description: undefined,
  };
}

function content(questions: Question[]): CollabContent {
  return {
    title: "Survey",
    description: "desc",
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
    questions,
    sections: [],
  };
}

describe("collab doc binding", () => {
  it("syncs Page 1 turned into a real page to a peer", () => {
    const base = { ...content([q("q1", "Q1", 0)]), sections: [{ id: "a", order: 0 }] };
    base.settings = { ...base.settings, firstPageTitle: "Intro", firstPageDescription: "Hello" };
    const a = new Y.Doc();
    const b = new Y.Doc();
    applyContentToDoc(a, base);
    Y.applyUpdate(b, Y.encodeStateAsUpdate(a));

    const survey = { ...base, id: "s", ownerId: "o", createdAt: "", updatedAt: "" };
    const next = builderReducer(
      initialBuilderState(survey),
      { type: "reorderSections", activeId: FIRST_PAGE_ID, overId: "a" },
    ).survey;
    applyContentToDoc(a, { ...next, sections: next.sections ?? [] });
    Y.applyUpdate(b, Y.encodeStateAsUpdate(a, Y.encodeStateVector(b)));

    const out = docToContent(b);
    expect(out.sections.map((s) => [s.id, s.title, s.description])).toEqual([
      ["a", undefined, undefined],
      ["s-page-1", "Intro", "Hello"],
    ]);
    expect(out.settings).not.toHaveProperty("firstPageTitle");
    expect(out.settings).not.toHaveProperty("firstPageDescription");
    expect(out.questions.map((x) => x.sectionId)).toEqual(["s-page-1"]);
  });

  it("merges Page 1 moved by two editors at once into one page", () => {
    const base = { ...content([q("q1", "Q1", 0)]), sections: [{ id: "a", order: 0 }] };
    const survey = { ...base, id: "s", ownerId: "o", createdAt: "", updatedAt: "" };
    const [a, b] = [new Y.Doc(), new Y.Doc()];
    applyContentToDoc(a, base);
    Y.applyUpdate(b, Y.encodeStateAsUpdate(a));

    for (const doc of [a, b]) {
      const next = builderReducer(
        initialBuilderState(survey),
        { type: "reorderSections", activeId: FIRST_PAGE_ID, overId: "a" },
      ).survey;
      applyContentToDoc(doc, { ...next, sections: next.sections ?? [] });
    }
    Y.applyUpdate(b, Y.encodeStateAsUpdate(a, Y.encodeStateVector(b)));
    Y.applyUpdate(a, Y.encodeStateAsUpdate(b, Y.encodeStateVector(a)));

    for (const doc of [a, b]) {
      const out = docToContent(doc);
      expect(out.sections.map((s) => s.id)).toEqual(["a", "s-page-1"]);
      expect(out.questions.map((x) => x.sectionId)).toEqual(["s-page-1"]);
    }
  });

  it("round-trips content through the Y.Doc, sorted by order", () => {
    const doc = new Y.Doc();
    applyContentToDoc(doc, content([q("b", "Two", 1), q("a", "One", 0)]));
    const out = docToContent(doc);
    expect(out.title).toBe("Survey");
    expect(out.questions.map((x) => x.id)).toEqual(["a", "b"]);
    expect(out.questions[0].title).toBe("One");
  });

  it("merges concurrent edits to different questions without duplication", () => {
    const base = content([q("q1", "Q1", 0), q("q2", "Q2", 1)]);
    const a = new Y.Doc();
    const b = new Y.Doc();
    applyContentToDoc(a, base);
    // B starts from A's state (shared identities).
    Y.applyUpdate(b, Y.encodeStateAsUpdate(a));

    // A edits q1, B edits q2 — concurrently.
    applyContentToDoc(a, content([q("q1", "Q1-A", 0), q("q2", "Q2", 1)]));
    applyContentToDoc(b, content([q("q1", "Q1", 0), q("q2", "Q2-B", 1)]));

    // Exchange updates both ways.
    const ua = Y.encodeStateAsUpdate(a, Y.encodeStateVector(b));
    const ub = Y.encodeStateAsUpdate(b, Y.encodeStateVector(a));
    Y.applyUpdate(b, ua);
    Y.applyUpdate(a, ub);

    for (const doc of [a, b]) {
      const c = docToContent(doc);
      expect(c.questions).toHaveLength(2);
      expect(new Set(c.questions.map((x) => x.id)).size).toBe(2);
      expect(c.questions.find((x) => x.id === "q1")!.title).toBe("Q1-A");
      expect(c.questions.find((x) => x.id === "q2")!.title).toBe("Q2-B");
    }
  });

  it("removes deleted questions", () => {
    const doc = new Y.Doc();
    applyContentToDoc(doc, content([q("q1", "Q1", 0), q("q2", "Q2", 1)]));
    applyContentToDoc(doc, content([q("q2", "Q2", 0)]));
    expect(docToContent(doc).questions.map((x) => x.id)).toEqual(["q2"]);
  });

  it("merges concurrent edits to the SAME title char-by-char (no clobber)", () => {
    const a = new Y.Doc();
    const b = new Y.Doc();
    applyContentToDoc(a, content([q("q1", "Hello", 0)]));
    Y.applyUpdate(b, Y.encodeStateAsUpdate(a));

    // A prepends, B appends — to the same field, concurrently.
    applyContentToDoc(a, content([q("q1", "Hi Hello", 0)]));
    applyContentToDoc(b, content([q("q1", "Hello!", 0)]));

    Y.applyUpdate(b, Y.encodeStateAsUpdate(a, Y.encodeStateVector(b)));
    Y.applyUpdate(a, Y.encodeStateAsUpdate(b, Y.encodeStateVector(a)));

    const ta = docToContent(a).questions[0].title;
    const tb = docToContent(b).questions[0].title;
    expect(ta).toBe(tb); // converged
    expect(ta).toBe("Hi Hello!"); // both edits preserved, not overwritten
  });

  it("keeps owner-only settings out of the shared doc, so differing peers don't fight over them", () => {
    const doc = new Y.Doc();
    const base = content([]);
    applyContentToDoc(doc, { ...base, settings: { ...base.settings, showLiveResults: true } });
    let updates = 0;
    doc.on("update", () => updates++);
    applyContentToDoc(doc, { ...base, settings: { ...base.settings, showLiveResults: false } });

    expect(updates).toBe(0);
    expect(docToContent(doc).settings).not.toHaveProperty("showLiveResults");
  });
});
