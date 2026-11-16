import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, render, screen, fireEvent, cleanup } from "@testing-library/react";
import type { Survey } from "@/app/types/survey";

// Controllable builder mock — each test tweaks `mock` before rendering.
const mock: {
  survey: Survey;
  activePageId: string | null;
  setActivePageId: ReturnType<typeof vi.fn>;
  addSection: ReturnType<typeof vi.fn>;
  updateSection: ReturnType<typeof vi.fn>;
  removeSection: ReturnType<typeof vi.fn>;
  reorderSections: ReturnType<typeof vi.fn>;
} = {
  survey: {} as Survey,
  activePageId: null,
  setActivePageId: vi.fn(),
  addSection: vi.fn(),
  updateSection: vi.fn(),
  removeSection: vi.fn(),
  reorderSections: vi.fn(),
};

vi.mock("../builder-context", () => ({ useBuilder: () => mock }));
// Minimal i18n stub: numbered pages render as "Page N", other keys map to
// their English label so the existing assertions keep working.
vi.mock("@/app/i18n/context", () => ({
  useTranslation: () => ({
    t: (k: string, vars?: Record<string, string>) => {
      if (k === "builder.page.numbered") return `Page ${vars?.n}`;
      const map: Record<string, string> = {
        "builder.page.add": "Add page",
        "builder.page.delete": "Delete page",
        "builder.page.moveLeft": "Move page left",
        "builder.page.moveRight": "Move page right",
        "builder.page.settings": "Page settings",
        "builder.page.help": "help",
        "builder.page.titlePlaceholder": "Page title",
        "builder.page.descPlaceholder": "Description",
        "builder.page.dragReorder": `Drag to reorder ${vars?.label}`,
        "builder.page.dragOver": `${vars?.label} is over ${vars?.over}.`,
        "builder.page.dragInstructions": "Page drag instructions",
      };
      return map[k] ?? k;
    },
  }),
}));
// Stub the collab input so we don't drag in caret/awareness machinery.
vi.mock("../collab-text-input", () => ({
  CollabTextInput: (props: { placeholder?: string; value: string }) => (
    <input aria-label={props.placeholder} defaultValue={props.value} />
  ),
}));

import { PageTabs } from "../page-tabs";
import { FIRST_PAGE_ID } from "../builder-reducer";

function surveyWith(
  sections: { id: string; title?: string }[],
  questionSections: (string | null)[] = [null],
): Survey {
  return {
    id: "s1",
    ownerId: "o1",
    title: "T",
    status: "draft",
    settings: {} as Survey["settings"],
    questions: questionSections.map((sectionId, i) => ({
      id: `q${i}`,
      type: "short-answer",
      title: `q${i}`,
      required: false,
      order: i,
      sectionId,
    })),
    sections: sections.map((s, i) => ({ ...s, order: i })),
    createdAt: "2026-06-10T00:00:00Z",
    updatedAt: "2026-06-10T00:00:00Z",
  };
}

const CHIP_WIDTH = 100;
let rectSpy: ReturnType<typeof vi.spyOn>;
afterEach(() => rectSpy?.mockRestore());

function layoutChips() {
  rectSpy = vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function (
    this: Element,
  ) {
    const chip = this.closest("[data-page-id]");
    const ids = [FIRST_PAGE_ID, ...(mock.survey.sections?.map((s) => s.id) ?? [])];
    const index = chip ? ids.indexOf(chip.getAttribute("data-page-id") ?? "") : 0;
    const left = index * CHIP_WIDTH;
    return {
      x: left, y: 0, top: 0, left, width: CHIP_WIDTH, height: 32,
      right: left + CHIP_WIDTH, bottom: 32, toJSON: () => ({}),
    } as DOMRect;
  });
}

async function press(target: Element | Document, code: string) {
  await act(async () => {
    fireEvent.keyDown(target, { code });
    await new Promise((r) => setTimeout(r, 50));
  });
}

beforeEach(() => {
  cleanup();
  Object.values(mock).forEach((v) => typeof v === "function" && v.mockReset?.());
  mock.activePageId = null;
});

describe("PageTabs", () => {
  it("shows Page 1, plus a chip per section labelled Page 2+", () => {
    mock.survey = surveyWith([{ id: "sec-a" }, { id: "sec-b", title: "Demographics" }]);
    render(<PageTabs />);

    expect(screen.getByRole("button", { name: "Page 1" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Page 2" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Demographics" })).toBeTruthy();
  });

  it("clicking a page chip selects it", () => {
    mock.survey = surveyWith([{ id: "sec-a" }]);
    render(<PageTabs />);

    fireEvent.click(screen.getByRole("button", { name: "Page 2" }));
    expect(mock.setActivePageId).toHaveBeenCalledWith("sec-a");
  });

  it("the + button adds a page and selects the new one", () => {
    mock.survey = surveyWith([]);
    render(<PageTabs />);

    fireEvent.click(screen.getByRole("button", { name: "Add page" }));
    expect(mock.addSection).toHaveBeenCalledTimes(1);
    // addSection(id) and setActivePageId(id) get the same generated id.
    const id = mock.addSection.mock.calls[0][0];
    expect(typeof id).toBe("string");
    expect(mock.setActivePageId).toHaveBeenCalledWith(id);
  });

  it("shows title/description + delete only for an active section page", () => {
    mock.survey = surveyWith([{ id: "sec-a" }]);
    mock.activePageId = "sec-a";
    render(<PageTabs />);

    expect(screen.getByRole("button", { name: "Delete page" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Delete page" }));
    expect(mock.removeSection).toHaveBeenCalledWith("sec-a");
    expect(mock.setActivePageId).not.toHaveBeenCalled();
  });

  it("does not show page settings while Page 1 is active", () => {
    mock.survey = surveyWith([{ id: "sec-a" }]);
    mock.activePageId = null;
    render(<PageTabs />);

    expect(screen.queryByRole("button", { name: "Delete page" })).toBeNull();
  });

  it("offers a drag handle for every page, Page 1 included", () => {
    mock.survey = surveyWith([{ id: "sec-a" }, { id: "sec-b", title: "Demographics" }]);
    render(<PageTabs />);

    expect(screen.getByRole("button", { name: "Drag to reorder Page 1" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Drag to reorder Page 2" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Drag to reorder Demographics" })).toBeTruthy();
  });

  it("moves Page 1 with the keyboard through reorderSections", async () => {
    mock.survey = surveyWith([{ id: "sec-a" }, { id: "sec-b" }]);
    layoutChips();
    render(<PageTabs />);
    const handle = screen.getByRole("button", { name: "Drag to reorder Page 1" });

    handle.focus();
    await press(handle, "Space");
    await press(document, "ArrowRight");
    expect(document.querySelector("[role=status]")?.textContent).toBe("Page 1 is over Page 2.");
    await press(document, "Space");

    expect(mock.reorderSections).toHaveBeenCalledTimes(1);
    expect(mock.reorderSections).toHaveBeenCalledWith(FIRST_PAGE_ID, "sec-a");
  });

  it("offers move buttons on Page 1", () => {
    mock.survey = surveyWith([{ id: "sec-a" }]);
    mock.activePageId = null;
    render(<PageTabs />);

    expect(screen.getByRole("button", { name: "Move page left" })).toHaveProperty("disabled", true);
    fireEvent.click(screen.getByRole("button", { name: "Move page right" }));
    expect(mock.reorderSections).toHaveBeenCalledWith(FIRST_PAGE_ID, "sec-a");
  });

  it("shows no empty Page 1 once every question belongs to a page", () => {
    mock.survey = surveyWith([{ id: "sec-b" }, { id: "sec-a", title: "Intro" }], ["sec-a", "sec-b"]);
    mock.activePageId = "sec-b";
    render(<PageTabs />);

    expect(document.querySelector(`[data-page-id="${FIRST_PAGE_ID}"]`)).toBeNull();
    expect(screen.getByRole("button", { name: "Drag to reorder Page 1" }).closest("[data-page-id]")?.getAttribute("data-page-id")).toBe("sec-b");
    expect(screen.getByRole("button", { name: "Intro" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Move page left" })).toHaveProperty("disabled", true);
    fireEvent.click(screen.getByRole("button", { name: "Move page right" }));
    expect(mock.reorderSections).toHaveBeenCalledWith("sec-b", "sec-a");
  });

  it("reorders pages with the keyboard through reorderSections", async () => {
    mock.survey = surveyWith([{ id: "sec-a" }, { id: "sec-b" }, { id: "sec-c" }]);
    layoutChips();
    render(<PageTabs />);
    const handle = screen.getByRole("button", { name: "Drag to reorder Page 2" });
    const describedBy = handle.getAttribute("aria-describedby");
    expect(describedBy && document.getElementById(describedBy)?.textContent).toBe("Page drag instructions");

    handle.focus();
    await press(handle, "Space");
    await press(document, "ArrowRight");
    expect(document.querySelector("[role=status]")?.textContent).toBe("Page 2 is over Page 3.");
    await press(document, "Space");

    expect(mock.reorderSections).toHaveBeenCalledTimes(1);
    expect(mock.reorderSections).toHaveBeenCalledWith("sec-a", "sec-b");
  });

  it("the move buttons reorder through the same reorderSections update", () => {
    mock.survey = surveyWith([{ id: "sec-a" }, { id: "sec-b" }, { id: "sec-c" }]);
    mock.activePageId = "sec-b";
    render(<PageTabs />);

    fireEvent.click(screen.getByRole("button", { name: "Move page left" }));
    expect(mock.reorderSections).toHaveBeenLastCalledWith("sec-b", "sec-a");
    fireEvent.click(screen.getByRole("button", { name: "Move page right" }));
    expect(mock.reorderSections).toHaveBeenLastCalledWith("sec-b", "sec-c");
  });
});
