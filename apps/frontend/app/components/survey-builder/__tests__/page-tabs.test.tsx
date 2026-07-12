import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import type { Survey } from "@/app/types/survey";

// Controllable builder mock — each test tweaks `mock` before rendering.
const mock: {
  survey: Survey;
  activePageId: string | null;
  setActivePageId: ReturnType<typeof vi.fn>;
  addSection: ReturnType<typeof vi.fn>;
  updateSection: ReturnType<typeof vi.fn>;
  removeSection: ReturnType<typeof vi.fn>;
  moveSection: ReturnType<typeof vi.fn>;
} = {
  survey: {} as Survey,
  activePageId: null,
  setActivePageId: vi.fn(),
  addSection: vi.fn(),
  updateSection: vi.fn(),
  removeSection: vi.fn(),
  moveSection: vi.fn(),
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

function surveyWith(sections: { id: string; title?: string }[]): Survey {
  return {
    id: "s1",
    ownerId: "o1",
    title: "T",
    status: "draft",
    settings: {} as Survey["settings"],
    questions: [],
    sections: sections.map((s, i) => ({ ...s, order: i })),
    createdAt: "2026-06-10T00:00:00Z",
    updatedAt: "2026-06-10T00:00:00Z",
  };
}

beforeEach(() => {
  cleanup();
  Object.values(mock).forEach((v) => typeof v === "function" && v.mockReset?.());
  mock.activePageId = null;
});

describe("PageTabs", () => {
  it("always shows Page 1, plus a chip per section labelled Page 2+", () => {
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
    expect(mock.setActivePageId).toHaveBeenCalledWith(null);
  });

  it("does not show page settings while Page 1 is active", () => {
    mock.survey = surveyWith([{ id: "sec-a" }]);
    mock.activePageId = null;
    render(<PageTabs />);

    expect(screen.queryByRole("button", { name: "Delete page" })).toBeNull();
  });
});
