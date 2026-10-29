import { describe, it, expect } from "vitest";
import {
  buildResponsesCsv,
  buildTokensCsv,
  formatAnswer,
  labelMap,
  parseTokenList,
} from "@/app/lib/survey/export";
import type { Question, Survey, SurveyResponseDto } from "@/app/types/survey";

function question(overrides: Partial<Question>): Question {
  return {
    id: "q1",
    type: "short-answer",
    title: "Q",
    required: false,
    order: 0,
    ...overrides,
  };
}

describe("labelMap", () => {
  it("maps option, row and column ids to labels", () => {
    const q = question({
      type: "multiple-choice-grid",
      rows: [{ id: "r1", label: "Speed" }],
      columns: [{ id: "c1", label: "Good" }],
      options: [{ id: "o1", label: "A" }],
    });
    expect(labelMap(q)).toEqual({ o1: "A", r1: "Speed", c1: "Good" });
  });
});

describe("formatAnswer", () => {
  it("resolves a single choice id to its label", () => {
    const q = question({
      type: "multiple-choice",
      options: [{ id: "o1", label: "Yes" }],
    });
    expect(formatAnswer(q, "o1")).toBe("Yes");
  });

  it("keeps free text as-is", () => {
    expect(formatAnswer(question({}), "hello world")).toBe("hello world");
  });

  it("joins checkbox selections by label", () => {
    const q = question({
      type: "checkboxes",
      options: [
        { id: "o1", label: "A" },
        { id: "o2", label: "B" },
      ],
    });
    expect(formatAnswer(q, ["o1", "o2"])).toBe("A; B");
  });

  it("renders grid answers as row: column pairs", () => {
    const q = question({
      type: "multiple-choice-grid",
      rows: [{ id: "r1", label: "Speed" }],
      columns: [{ id: "c1", label: "Good" }],
    });
    expect(formatAnswer(q, { r1: "c1" })).toBe("Speed: Good");
  });

  it("lists uploaded file names", () => {
    const q = question({ type: "file-upload" });
    const files = [
      { key: "k1", url: "http://x/1", filename: "a.png", contentType: "image/png", size: 1 },
    ];
    expect(formatAnswer(q, files)).toBe("a.png");
  });
});

describe("buildResponsesCsv", () => {
  const survey: Survey = {
    id: "s1",
    ownerId: "o1",
    title: "Feedback",
    status: "published",
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
    questions: [question({ id: "q1", title: "Name" })],
    createdAt: "2026-06-11T00:00:00Z",
    updatedAt: "2026-06-11T00:00:00Z",
  };

  it("includes a header and one row per response, escaping commas", () => {
    const responses: SurveyResponseDto[] = [
      {
        id: "r1",
        submittedAt: "2026-06-11T10:00:00Z",
        durationMs: 5000,
        answers: [{ questionId: "q1", value: "Ada, the great" }],
      },
    ];
    const csv = buildResponsesCsv(survey, responses);
    const lines = csv.split("\n");
    expect(lines[0]).toBe("Response ID,Submitted at,Duration (s),Name");
    expect(lines[1]).toContain('"Ada, the great"');
    expect(lines[1]).toContain("5.0");
  });

  it("leaves content blocks out of the columns (public #7)", () => {
    const withContent: Survey = {
      ...survey,
      questions: [
        question({ id: "c1", type: "content", title: "Read this" }),
        question({ id: "q1", title: "Name" }),
      ],
    };
    const csv = buildResponsesCsv(withContent, [
      { id: "r1", submittedAt: "2026-06-11T10:00:00Z", answers: [{ questionId: "q1", value: "Ada" }] },
    ]);
    expect(csv.split("\n")[0]).toBe("Response ID,Submitted at,Duration (s),Name");
  });

  it("adds a token column when responses carry respondent tokens", () => {
    const csv = buildResponsesCsv(survey, [
      { id: "r1", submittedAt: "2026-06-11T10:00:00Z", respondentToken: "T-1", answers: [] },
      { id: "r2", submittedAt: "2026-06-11T11:00:00Z", answers: [] },
    ]);
    const lines = csv.split("\n");
    expect(lines[0]).toBe("Response ID,Submitted at,Duration (s),Token,Name");
    expect(lines[1]).toBe("r1,2026-06-11T10:00:00Z,,T-1,");
    expect(lines[2]).toBe("r2,2026-06-11T11:00:00Z,,,");
  });
});

describe("parseTokenList", () => {
  it("takes one trimmed token per line, skipping blanks and duplicates", () => {
    expect(parseTokenList(" alice \r\n\nbob\nalice\n")).toEqual(["alice", "bob"]);
  });
});

describe("buildTokensCsv", () => {
  it("lists each token with its prefilled link and whether it was used", () => {
    const csv = buildTokensCsv(
      [
        { id: "1", token: "A,B", createdAt: "x", usedAt: "2026-06-11T10:00:00Z" },
        { id: "2", token: "C", createdAt: "x" },
      ],
      (token) => `https://app.test/s/abc?token=${encodeURIComponent(token)}`,
    );
    expect(csv.split("\n")).toEqual([
      "token,link,used",
      '"A,B",https://app.test/s/abc?token=A%2CB,yes',
      "C,https://app.test/s/abc?token=C,no",
    ]);
  });
});
