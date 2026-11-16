import { describe, it, expect, vi, afterEach } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import type { Question, Survey } from "@/app/types/survey";

const mock = { survey: {} as Survey, setQuestionSection: vi.fn() };

vi.mock("../builder-context", () => ({
  useBuilder: () => ({
    ...mock,
    updateQuestion: vi.fn(),
    removeQuestion: vi.fn(),
    moveQuestion: vi.fn(),
    focusByQuestion: new Map(),
    attemptedSave: false,
    setFocus: vi.fn(),
  }),
}));
vi.mock("@/app/i18n/context", () => ({
  useTranslation: () => ({
    t: (k: string, vars?: Record<string, string>) => (k === "builder.page.numbered" ? `Page ${vars?.n}` : k),
  }),
}));
vi.mock("../collab-text-input", () => ({ CollabTextInput: () => null }));
vi.mock("@/app/components/ui/select", () => ({
  Select: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SelectTrigger: () => null,
  SelectValue: () => null,
  SelectContent: ({ children }: { children: ReactNode }) => <ul aria-label="pages">{children}</ul>,
  SelectItem: ({ value, children }: { value: string; children: ReactNode }) => (
    <li data-value={value}>{children}</li>
  ),
}));

import { QuestionCard } from "../question-card";

afterEach(cleanup);

function question(sectionId: string | null): Question {
  return { id: "q0", type: "short-answer", title: "q0", required: false, order: 0, sectionId };
}

function survey(questions: Question[], sections: { id: string; title?: string }[], settings = {}): Survey {
  return {
    id: "s1",
    ownerId: "o1",
    title: "T",
    status: "draft",
    settings: settings as Survey["settings"],
    questions,
    sections: sections.map((s, order) => ({ ...s, order })),
    createdAt: "",
    updatedAt: "",
  };
}

function pageOptions(q: Question) {
  render(<QuestionCard question={q} index={0} total={1} />);
  return [...screen.getByRole("list", { name: "pages" }).querySelectorAll("li")].map((li) => [
    li.dataset.value,
    li.textContent,
  ]);
}

describe("QuestionCard page dropdown", () => {
  it("offers Page 1 as __none__ and numbers sections from 2 while Page 1 exists", () => {
    const q = question(null);
    mock.survey = survey([q], [{ id: "a" }, { id: "b", title: "Demographics" }]);
    expect(pageOptions(q)).toEqual([
      ["__none__", "Page 1"],
      ["a", "Page 2"],
      ["b", "Demographics"],
    ]);
  });

  it("drops __none__ and numbers sections from 1 once Page 1 is gone", () => {
    const q = question("a");
    mock.survey = survey([q], [{ id: "a" }, { id: "b" }]);
    expect(pageOptions(q)).toEqual([
      ["a", "Page 1"],
      ["b", "Page 2"],
    ]);
  });

  it("keeps Page 1 when only its title holds it", () => {
    const q = question("a");
    mock.survey = survey([q], [{ id: "a" }], { firstPageTitle: "Intro" });
    expect(pageOptions(q)).toEqual([
      ["__none__", "Page 1"],
      ["a", "Page 2"],
    ]);
  });
});
