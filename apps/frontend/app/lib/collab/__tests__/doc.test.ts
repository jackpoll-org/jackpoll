import { describe, it, expect } from "vitest";
import * as Y from "yjs";
import { applyContentToDoc, docToContent, type CollabContent } from "../doc";
import type { Question } from "@/app/types/survey";

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
});
