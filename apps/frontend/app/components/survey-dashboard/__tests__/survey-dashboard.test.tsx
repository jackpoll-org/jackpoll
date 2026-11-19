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
const surveys = [
  survey("d1", "draft"),
  survey("p1", "published"),
  survey("x1", "draft", "f1"),
  survey("x2", "closed", "f1"),
  survey("o1", "draft", null, "other"),
];

vi.mock("next/navigation", () => ({
  useSearchParams: () => search,
  useRouter: () => router,
  usePathname: () => "/surveys",
}));
vi.mock("@/app/hooks/survey", () => ({
  useSurveys: () => ({ data: { surveys }, isLoading: false, isError: false }),
  useFolders: () => ({ data: folders }),
  useOrganizeSurvey: () => ({ mutateAsync: vi.fn() }),
  useReorderSurveys: () => ({ mutate: vi.fn() }),
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
vi.mock("../template-picker-dialog", () => ({ TemplatePickerDialog: () => null }));
vi.mock("../join-by-code-dialog", () => ({ JoinByCodeDialog: () => null }));
vi.mock("../invitations-banner", () => ({ InvitationsBanner: () => null }));

import { SurveyDashboard } from "../survey-dashboard";

function survey(
  id: string,
  status: Survey["status"],
  folderId: string | null = null,
  ownerId = "me",
): Survey {
  return {
    id,
    ownerId,
    title: `Quiz ${id}`,
    status,
    folderId,
    tags: ["exam"],
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

  it("keeps the search across its own URL changes but clears search and tag on deep links", () => {
    const { rerender, go } = renderDashboard("/surveys");
    const searchBox = screen.getByPlaceholderText("dashboard.searchPlaceholder");
    fireEvent.click(screen.getByRole("button", { name: "tag d1" }));
    expect(screen.getByText("dashboard.tagFilter")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "dashboard.folder.open:Physics" }));
    rerender(<SurveyDashboard />);
    expect(screen.getByText("dashboard.tagFilter")).toBeInTheDocument();

    fireEvent.change(searchBox, { target: { value: "x2" } });
    expect(shown()).toEqual(["Quiz x2"]);

    go("/surveys?status=draft");
    expect(searchBox).toHaveValue("");
    expect(screen.queryByText("dashboard.tagFilter")).not.toBeInTheDocument();
    expect(shown()).toEqual(["Quiz o1", "Quiz d1"]);
  });
});
