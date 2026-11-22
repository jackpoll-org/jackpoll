import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, within } from "@testing-library/react";
import type { Folder, Survey } from "@/app/types/survey";

let search = new URLSearchParams();
const router = {
  push: vi.fn((url: string) => navigate(url)),
  replace: vi.fn((url: string) => navigate(url)),
};
function navigate(url: string) {
  search = new URLSearchParams(url.split("?")[1] ?? "");
}

const folders: Folder[] = [{ id: "f1", name: "Physics" }];
let foldersState: { data?: Folder[]; isLoading?: boolean; isError?: boolean } = { data: folders };
const reorder = vi.fn();
const organize = vi.fn();
let dragEnd: ((event: unknown) => Promise<void>) | undefined;
let surveys = [
  survey("d1", "draft"),
  survey("p1", "published"),
  survey("x1", "draft", "f1"),
  survey("x2", "closed", "f1", "me", ["exam", "final"]),
  survey("o1", "draft", null, "other"),
];

vi.mock("next/navigation", () => ({
  useSearchParams: () => search,
  useRouter: () => router,
  usePathname: () => "/surveys",
}));
vi.mock("@/app/hooks/survey", () => ({
  useSurveys: () => ({ data: { surveys }, isLoading: false, isError: false }),
  useFolders: () => foldersState,
  useOrganizeSurvey: () => ({ mutateAsync: organize }),
  useReorderSurveys: () => ({ mutate: reorder }),
  useCreateFolder: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useRenameFolder: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDeleteFolder: () => ({ mutateAsync: vi.fn() }),
}));
vi.mock("@/app/hooks/templates", () => ({ useCustomTemplates: () => ({ data: [] }) }));
vi.mock("@/app/components/auth/auth-provider", () => ({
  useAuthContext: () => ({ user: { id: "me" } }),
}));
vi.mock("@/app/i18n/context", () => ({
  useTranslation: () => ({
    t: (k: string, vars?: Record<string, string | number>) =>
      vars ? `${k}:${Object.values(vars).join(",")}` : k,
  }),
}));
vi.mock("../survey-card", () => ({
  SurveyCard: ({ survey, onTagClick }: { survey: Survey; onTagClick: (tag: string) => void }) => (
    <div data-testid="survey">
      {survey.title}
      <button type="button" onClick={() => onTagClick("exam")}>
        tag {survey.id}
      </button>
    </div>
  ),
}));
vi.mock("@dnd-kit/core", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@dnd-kit/core")>()),
  useDndMonitor: ({ onDragEnd }: { onDragEnd: (event: unknown) => Promise<void> }) => {
    dragEnd = onDragEnd;
  },
}));
vi.mock("../template-picker-dialog", () => ({ TemplatePickerDialog: () => null }));
vi.mock("../join-by-code-dialog", () => ({ JoinByCodeDialog: () => null }));
vi.mock("../invitations-banner", () => ({ InvitationsBanner: () => null }));

import { SurveyDashboard } from "../survey-dashboard";

function survey(
  id: string,
  status: Survey["status"],
  folderId: string | null = null,
  ownerId = "me",
  tags = ["exam"],
): Survey {
  return {
    id,
    ownerId,
    title: `Quiz ${id}`,
    status,
    folderId,
    tags,
    settings: {} as Survey["settings"],
    questions: [],
    createdAt: "2026-06-10T00:00:00Z",
    updatedAt: "2026-06-10T00:00:00Z",
  };
}

function shown() {
  return screen.queryAllByTestId("survey").map((el) => el.textContent?.split("tag")[0]);
}

function renderDashboard(url: string, view: "grid" | "list" = "grid") {
  localStorage.setItem("ui_list_view", view);
  navigate(url);
  const utils = render(<SurveyDashboard />);
  return { ...utils, go: (next: string) => (navigate(next), utils.rerender(<SurveyDashboard />)) };
}

beforeEach(() => {
  localStorage.clear();
  foldersState = { data: folders };
  reorder.mockClear();
  organize.mockClear();
  router.push.mockClear();
  router.replace.mockClear();
});
afterEach(cleanup);

describe("SurveyDashboard URL state", () => {
  it("grid view follows the folder and status in the URL", () => {
    const { go } = renderDashboard("/surveys?status=draft&folder=f1");
    expect(shown()).toEqual(["Quiz o1", "Quiz x1"]);
    expect(screen.getByText("Physics")).toBeInTheDocument();

    go("/surveys?status=published");
    expect(shown()).toEqual(["Quiz p1"]);

    go("/surveys?folder=f1");
    expect(shown()).toEqual(["Quiz o1", "Quiz x1", "Quiz x2"]);
  });

  it("list view expands the folder from the URL even when already mounted", () => {
    const { go } = renderDashboard("/surveys", "list");
    expect(shown()).toEqual(["Quiz o1", "Quiz d1", "Quiz p1"]);

    go("/surveys?status=draft&folder=f1");
    expect(shown()).toEqual(["Quiz o1", "Quiz x1", "Quiz d1"]);
  });

  it("writes folder drill-in and status changes to the URL", () => {
    const { rerender } = renderDashboard("/surveys?new=1");
    fireEvent.click(screen.getByRole("button", { name: "dashboard.folder.open:Physics" }));
    expect(router.push).toHaveBeenCalledWith("/surveys?folder=f1", { scroll: false });
    rerender(<SurveyDashboard />);
    expect(shown()).toEqual(["Quiz o1", "Quiz x1", "Quiz x2"]);

    fireEvent.click(screen.getByRole("button", { name: "dashboard.folder.back" }));
    expect(router.push).toHaveBeenLastCalledWith("/surveys", { scroll: false });
  });

  it("writes the status filter to the URL", () => {
    Element.prototype.scrollIntoView = vi.fn();
    renderDashboard("/surveys?folder=f1");
    const trigger = screen.getByRole("combobox", { name: "dashboard.status.label" });
    fireEvent.keyDown(trigger, { key: "Enter" });
    fireEvent.click(within(screen.getByRole("listbox")).getByRole("option", { name: "dashboard.status.closed" }));
    expect(router.replace).toHaveBeenCalledWith("/surveys?folder=f1&status=closed", { scroll: false });
  });

  it("keeps the search across its own URL changes but clears it on deep links", () => {
    const { rerender, go } = renderDashboard("/surveys");
    const searchBox = screen.getByPlaceholderText("dashboard.searchPlaceholder");
    fireEvent.change(searchBox, { target: { value: "x2" } });
    fireEvent.click(screen.getByRole("button", { name: "tag x2" }));
    expect(router.push).toHaveBeenCalledWith("/surveys?tag=exam", { scroll: false });
    rerender(<SurveyDashboard />);
    expect(searchBox).toHaveValue("x2");
    expect(screen.getByText("dashboard.tagFilter")).toBeInTheDocument();
    expect(shown()).toEqual(["Quiz x2"]);

    go("/surveys?status=draft");
    expect(searchBox).toHaveValue("");
    expect(screen.queryByText("dashboard.tagFilter")).not.toBeInTheDocument();
    expect(shown()).toEqual(["Quiz o1", "Quiz d1"]);
  });

  it("filters by the tag in the URL across folders and clears it", () => {
    renderDashboard("/surveys?tag=final");
    expect(shown()).toEqual(["Quiz x2"]);
    expect(screen.queryByRole("button", { name: "dashboard.folder.open:Physics" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "dashboard.clearTag" }));
    expect(router.push).toHaveBeenCalledWith("/surveys", { scroll: false });
  });

  it("drops the folder when a card's tag is clicked", () => {
    renderDashboard("/surveys?folder=f1");
    fireEvent.click(screen.getByRole("button", { name: "tag x1" }));
    expect(router.push).toHaveBeenCalledWith("/surveys?tag=exam", { scroll: false });
  });

  it.each(["grid", "list"] as const)(
    "shows only my surveys without a folder for ?folder=none (%s view)",
    (view) => {
      surveys.push(survey("u1", "draft", "deleted-folder"));
      try {
        renderDashboard("/surveys?folder=none", view);
        expect(shown().sort()).toEqual(["Quiz d1", "Quiz p1", "Quiz u1"]);
        expect(screen.queryByRole("button", { name: "dashboard.folder.open:Physics" })).toBeNull();
        fireEvent.click(screen.getByRole("button", { name: "dashboard.clearFolderFilter" }));
        expect(router.push).toHaveBeenCalledWith("/surveys", { scroll: false });
      } finally {
        surveys.pop();
      }
    },
  );

  it.each(["grid", "list"] as const)(
    "lists every survey flat for ?folder=all, including shared ones (%s view)",
    (view) => {
      const { go } = renderDashboard("/surveys?folder=all", view);
      expect(shown().sort()).toEqual(["Quiz d1", "Quiz o1", "Quiz p1", "Quiz x1", "Quiz x2"]);
      expect(screen.queryByRole("button", { name: "dashboard.folder.open:Physics" })).toBeNull();
      expect(screen.queryByText("dashboard.shared.title")).toBeNull();

      go("/surveys?folder=all&status=draft");
      expect(shown().sort()).toEqual(["Quiz d1", "Quiz o1", "Quiz x1"]);
    },
  );

  it("waits for folders before listing ?folder=none", () => {
    foldersState = { isLoading: true };
    renderDashboard("/surveys?folder=none");
    expect(shown()).toEqual([]);
  });

  it("leaves filed surveys out of ?folder=none when folders fail to load", () => {
    foldersState = { isError: true };
    surveys.push(survey("u1", "draft", "deleted-folder"));
    try {
      renderDashboard("/surveys?folder=none");
      expect(shown().sort()).toEqual(["Quiz d1", "Quiz p1"]);
    } finally {
      surveys.pop();
    }
  });

  it("searches and filters tags across every folder even on ?folder=none", () => {
    const { go } = renderDashboard("/surveys?folder=none");
    fireEvent.change(screen.getByPlaceholderText("dashboard.searchPlaceholder"), {
      target: { value: "x2" },
    });
    expect(shown()).toEqual(["Quiz x2"]);

    go("/surveys?folder=none&tag=final");
    expect(shown()).toEqual(["Quiz x2"]);
  });

  it("says nothing is unorganized when every survey of mine is in a folder", () => {
    const previous = surveys;
    surveys = [survey("x1", "draft", "f1")];
    try {
      renderDashboard("/surveys?folder=none");
      expect(screen.getByText("dashboard.unorganizedEmpty")).toBeInTheDocument();
      expect(screen.queryByText("dashboard.noMatches")).toBeNull();
    } finally {
      surveys = previous;
    }
  });

  it("says nothing is unorganized for a user who only has shared surveys", () => {
    const previous = surveys;
    surveys = [survey("sh1", "draft", null, "someone-else")];
    try {
      renderDashboard("/surveys?folder=none");
      expect(screen.getByText("dashboard.unorganizedEmpty")).toBeInTheDocument();
    } finally {
      surveys = previous;
    }
  });

  it("reorders ?folder=none within the same surveys it shows, orphans included", async () => {
    surveys.push(survey("u1", "draft", "deleted-folder"));
    try {
      renderDashboard("/surveys?folder=none");
      await dragEnd!({ active: { id: "d1" }, over: { id: "p1" } });
      expect(reorder).toHaveBeenCalledTimes(1);
      expect([...reorder.mock.calls[0][0].orderedIds].sort()).toEqual(["d1", "p1", "u1"]);
    } finally {
      surveys.pop();
    }
  });

  it("moves a survey dropped onto a sidebar folder or Unorganized, keeping its tags", async () => {
    renderDashboard("/surveys?folder=f1");
    await dragEnd!({ active: { id: "d1" }, over: { id: "sidebar:folder:f1" } });
    await dragEnd!({ active: { id: "x2" }, over: { id: "sidebar:unfiled" } });
    expect(organize.mock.calls).toEqual([
      [{ id: "d1", tags: ["exam"], folderId: "f1" }],
      [{ id: "x2", tags: ["exam", "final"], folderId: null }],
    ]);
    expect(reorder).not.toHaveBeenCalled();
  });

  it("ignores sidebar drops of surveys shared with me", async () => {
    renderDashboard("/surveys?folder=all");
    await dragEnd!({ active: { id: "o1" }, over: { id: "sidebar:folder:f1" } });
    expect(organize).not.toHaveBeenCalled();
  });
});
