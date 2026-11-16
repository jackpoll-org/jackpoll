import { describe, it, expect, vi, afterEach } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { Survey } from "@/app/types/survey";

vi.mock("@/app/components/auth/auth-provider", () => ({ useAuthContext: () => ({ user: null }) }));
vi.mock("@/app/i18n/context", () => ({
  useTranslation: () => ({
    t: (k: string, vars?: Record<string, string>) =>
      k === "builder.page.numbered" ? `Page ${vars?.n}` : k === "builder.page.titlePlaceholder" ? "Page title" : k,
  }),
}));
vi.mock("../collab-text-input", () => ({
  CollabTextInput: (props: { placeholder?: string; value: string }) => (
    <input aria-label={props.placeholder} defaultValue={props.value} />
  ),
}));

import { BuilderProvider, useBuilder } from "../builder-context";
import { FIRST_PAGE_ID } from "../builder-reducer";
import { PageTabs } from "../page-tabs";

afterEach(cleanup);

function survey(
  questionSections: (string | null)[],
  settings: Partial<Survey["settings"]> = { firstPageTitle: "Intro" },
  sectionIds = ["a"],
): Survey {
  return {
    id: "s1",
    ownerId: "o1",
    title: "T",
    status: "draft",
    settings: settings as Survey["settings"],
    questions: questionSections.map((sectionId, i) => ({
      id: `q${i}`,
      type: "short-answer",
      title: `q${i}`,
      required: false,
      order: i,
      sectionId,
    })),
    sections: sectionIds.map((id, order) => ({ id, order })),
    createdAt: "",
    updatedAt: "",
  };
}

function Probe() {
  const { activePageId, survey, reorderSections, setQuestionSection, removeQuestion, setActivePageId, removeSection } =
    useBuilder();
  const moved = survey.sections?.[1];
  return (
    <>
      <span data-testid="active">{String(activePageId)}</span>
      <span data-testid="moved">
        {moved ? `${moved.id}|${moved.title}|${survey.questions.find((q) => q.id === "q0")?.sectionId}` : ""}
      </span>
      <button type="button" onClick={() => reorderSections(FIRST_PAGE_ID, "a")}>
        move
      </button>
      <button type="button" onClick={() => setQuestionSection("q0", "a")}>
        q0 to a
      </button>
      <button type="button" onClick={() => setQuestionSection("q0", null)}>
        q0 to page 1
      </button>
      <button type="button" onClick={() => removeQuestion("q0")}>
        remove q0
      </button>
      <button type="button" onClick={() => setActivePageId("b")}>
        select b
      </button>
      <button type="button" onClick={() => removeSection("b")}>
        remove b
      </button>
    </>
  );
}

function renderBuilder(initial: Survey) {
  return render(
    <BuilderProvider initialSurvey={initial}>
      <PageTabs />
      <Probe />
    </BuilderProvider>,
  );
}

const click = (name: string) => fireEvent.click(screen.getByRole("button", { name }));
const active = () => screen.getByTestId("active").textContent;
const chipLabels = () => [...document.querySelectorAll("[data-page-id]")].map((c) => c.getAttribute("data-page-id"));

describe("BuilderProvider page selection", () => {
  it("keeps the moved Page 1 selected after it becomes a real page", () => {
    renderBuilder(survey([null, "a"]));
    expect(active()).toBe("null");

    click("move");

    const [movedId, title, q0Section] = screen.getByTestId("moved").textContent!.split("|");
    expect(movedId).toBe("s1-page-1");
    expect(title).toBe("Intro");
    expect(q0Section).toBe(movedId);
    expect(active()).toBe(movedId);
  });

  it("starts a converted survey on its first real page", () => {
    renderBuilder(survey(["a"], {}));
    expect(active()).toBe("a");
    expect(chipLabels()).toEqual(["a"]);
  });

  it("keeps Page 1 while its title is cleared, then drops it once another page is selected", () => {
    renderBuilder(survey(["a"], { firstPageTitle: "A" }));
    const input = screen.getByDisplayValue("A");
    input.focus();

    fireEvent.change(input, { target: { value: "" } });

    expect(chipLabels()).toEqual([FIRST_PAGE_ID, "a"]);
    expect(active()).toBe("null");
    expect(screen.getByPlaceholderText("Page title")).toBe(input);
    expect(document.activeElement).toBe(input);

    click("Page 2");
    expect(active()).toBe("a");
    expect(chipLabels()).toEqual(["a"]);
  });

  it("keeps Page 1 selected after its last question is moved away or deleted", () => {
    for (const action of ["q0 to a", "remove q0"]) {
      renderBuilder(survey([null, "a"], {}));
      click(action);
      expect(chipLabels()).toEqual([FIRST_PAGE_ID, "a"]);
      expect(active()).toBe("null");

      click("q0 to page 1");
      expect(active()).toBe("null");
      cleanup();
    }
  });

  it("does not jump back to Page 1 when it reappears after a fallback", () => {
    renderBuilder(survey(["a"], {}, ["a", "b"]));
    click("select b");
    expect(active()).toBe("b");

    click("remove b");
    expect(active()).toBe("a");

    click("q0 to page 1");
    expect(chipLabels()).toEqual([FIRST_PAGE_ID, "a"]);
    expect(active()).toBe("a");
  });
});
