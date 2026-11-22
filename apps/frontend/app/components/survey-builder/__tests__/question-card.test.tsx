import { describe, it, expect, vi, afterEach } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
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

describe("QuestionCard live results switch", () => {
  const cloud: Question = { id: "w1", type: "wordcloud", title: "Words", required: false, order: 0, sectionId: null };

  it("shows the switch for a word cloud when only the combined word cloud is on", () => {
    mock.survey = survey([cloud], [], { postSubmitCombinedWordcloud: true });
    render(<QuestionCard question={cloud} index={0} total={1} />);
    fireEvent.click(screen.getByRole("button", { name: "builder.question.more" }));
    expect(screen.getByText("builder.showInLiveResults")).toBeTruthy();
  });

  it("hides the switch when neither live results nor the combined word cloud is on", () => {
    mock.survey = survey([cloud], [], {});
    render(<QuestionCard question={cloud} index={0} total={1} />);
    fireEvent.click(screen.getByRole("button", { name: "builder.question.more" }));
    expect(screen.queryByText("builder.showInLiveResults")).toBeNull();
  });

  it("hides the switch for other questions while the combined word cloud is on", () => {
    const choice: Question = { id: "c1", type: "multiple-choice", title: "Pick", required: false, order: 0, sectionId: null, options: [] };
    mock.survey = survey([choice], [], { showLiveResults: true, postSubmitCombinedWordcloud: true });
    render(<QuestionCard question={choice} index={0} total={1} />);
    fireEvent.click(screen.getByRole("button", { name: "builder.question.more" }));
    expect(screen.queryByText("builder.showInLiveResults")).toBeNull();
  });

  it("shows the switch for a choice question shown as a word cloud while the combined word cloud is on", () => {
    const choice: Question = {
      id: "c1", type: "multiple-choice", title: "Pick", required: false, order: 0, sectionId: null, options: [],
      settings: { resultChart: "wordcloud" },
    };
    mock.survey = survey([choice], [], { postSubmitCombinedWordcloud: true });
    render(<QuestionCard question={choice} index={0} total={1} />);
    fireEvent.click(screen.getByRole("button", { name: "builder.question.more" }));
    expect(screen.getByText("builder.showInLiveResults")).toBeTruthy();
  });

  it("hides the switch for a scored quiz choice question shown as a word cloud", () => {
    const choice: Question = {
      id: "c1", type: "multiple-choice", title: "Pick", required: false, order: 0, sectionId: null,
      options: [{ id: "o1", label: "A" }], correctAnswers: ["o1"], settings: { resultChart: "wordcloud" },
    };
    mock.survey = survey([choice], [], { isQuiz: true, postSubmitCombinedWordcloud: true });
    render(<QuestionCard question={choice} index={0} total={1} />);
    fireEvent.click(screen.getByRole("button", { name: "builder.question.more" }));
    expect(screen.queryByText("builder.showInLiveResults")).toBeNull();
  });
});
