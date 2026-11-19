import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, within } from "@testing-library/react";
import type { Folder, Survey } from "@/app/types/survey";

let surveys: Survey[] = [];
const folders: Folder[] = [{ id: "f1", name: "Physics" }];
let foldersLoading = false;
let foldersFailed = false;
const createFolder = vi.fn().mockResolvedValue(undefined);
const renameFolder = vi.fn().mockResolvedValue(undefined);

vi.mock("@/app/hooks/survey", () => ({
  useSurveys: () => ({ data: { surveys }, isLoading: false }),
  useFolders: () =>
    foldersLoading
      ? { data: undefined, isLoading: true, isError: false }
      : foldersFailed
        ? { data: undefined, isLoading: false, isError: true }
        : { data: folders, isLoading: false, isError: false },
  useCreateFolder: () => ({ mutateAsync: createFolder, isPending: false }),
  useRenameFolder: () => ({ mutateAsync: renameFolder, isPending: false }),
}));
vi.mock("@/app/i18n/context", () => ({
  useTranslation: () => ({
    t: (k: string, vars?: Record<string, string | number>) =>
      vars ? `${k}:${Object.values(vars).join(",")}` : k,
  }),
}));
vi.mock("next/navigation", () => ({
  usePathname: () => "/surveys",
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/app/components/auth/auth-provider", () => ({
  useAuthContext: () => ({ user: { id: "me" } }),
}));
vi.mock("@/app/hooks/use-mobile", () => ({ useIsMobile: () => false }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { SidebarProvider } from "@/app/components/ui/sidebar";
import { SidebarSurveys } from "../sidebar-surveys";

function survey(
  id: string,
  status: Survey["status"],
  folderId: string | null = null,
  ownerId = "me",
): Survey {
  return { id, title: `Quiz ${id}`, status, folderId, ownerId } as Survey;
}

function renderSidebar() {
  return render(
    <SidebarProvider>
      <ul>
        <SidebarSurveys />
      </ul>
    </SidebarProvider>,
  );
}

function openMenu(name: string) {
  const trigger = screen.getByRole("button", { name: `nav.sidebar.menu:${name}` });
  fireEvent.keyDown(trigger, { key: "Enter" });
  return screen.getByRole("menu");
}

beforeEach(() => {
  localStorage.clear();
  surveys = [
    survey("d1", "draft"),
    survey("p1", "published"),
    survey("x1", "draft", "f1"),
    survey("x2", "closed", "f1"),
  ];
});
afterEach(cleanup);

describe("SidebarSurveys", () => {
  it("lists unfiled surveys under status groups and hides empty groups", () => {
    renderSidebar();
    expect(screen.getByText("Quiz d1")).toBeInTheDocument();
    expect(screen.getByText("Quiz p1")).toBeInTheDocument();
    expect(screen.queryByText("Quiz x1")).not.toBeInTheDocument();
    expect(screen.getAllByText("dashboard.status.draft")).toHaveLength(1);
    expect(screen.queryByText("dashboard.status.closed")).not.toBeInTheDocument();
  });

  it("persists expanding a folder and its status groups", () => {
    renderSidebar();
    fireEvent.click(screen.getByRole("button", { name: "nav.sidebar.toggle:Physics" }));
    expect(screen.getByText("Quiz x2")).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem("ui_sidebar_tree")!).open).toEqual({ f1: true });

    const closedGroup = screen.getByText("dashboard.status.closed").closest("button")!;
    fireEvent.click(closedGroup);
    expect(screen.queryByText("Quiz x2")).not.toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem("ui_sidebar_tree")!).open["f1:closed"]).toBe(false);

    cleanup();
    renderSidebar();
    expect(screen.getByText("Quiz x1")).toBeInTheDocument();
    expect(screen.queryByText("Quiz x2")).not.toBeInTheDocument();
  });

  it("hides a status group and a folder from the menu and shows them again", () => {
    renderSidebar();
    fireEvent.click(within(openMenu("nav.mySurveys")).getByRole("menuitemcheckbox", { name: "dashboard.status.draft" }));
    expect(screen.queryByText("Quiz d1")).not.toBeInTheDocument();
    expect(screen.getByText("Quiz p1")).toBeInTheDocument();

    fireEvent.click(within(openMenu("Physics")).getByRole("menuitem", { name: "nav.sidebar.hideFolder" }));
    expect(screen.queryByRole("button", { name: "Physics" })).not.toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem("ui_sidebar_tree")!)).toMatchObject({
      hiddenGroups: ["mine:draft"],
      hiddenFolders: ["f1"],
    });

    const menu = openMenu("nav.mySurveys");
    fireEvent.click(within(menu).getByRole("menuitemcheckbox", { name: "dashboard.status.draft" }));
    fireEvent.click(within(openMenu("nav.mySurveys")).getByRole("menuitem", { name: "nav.sidebar.showFolder:Physics" }));
    expect(screen.getByText("Quiz d1")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "nav.sidebar.toggle:Physics" })).toBeInTheDocument();
  });

  it("renames the section label and clears it when set back to the default", () => {
    renderSidebar();
    fireEvent.click(within(openMenu("nav.mySurveys")).getByRole("menuitem", { name: "nav.sidebar.renameLabel" }));
    const input = screen.getByPlaceholderText("nav.mySurveys");
    expect(input).toHaveValue("");
    fireEvent.change(input, { target: { value: "Quizzes" } });
    fireEvent.submit(input.closest("form")!);
    expect(screen.getByText("Quizzes")).toBeInTheDocument();
    expect(localStorage.getItem("ui_sidebar_label")).toBe("Quizzes");

    fireEvent.click(within(openMenu("Quizzes")).getByRole("menuitem", { name: "nav.sidebar.renameLabel" }));
    const cleared = screen.getByPlaceholderText("nav.mySurveys");
    expect(cleared).toHaveValue("Quizzes");
    fireEvent.change(cleared, { target: { value: "" } });
    fireEvent.submit(cleared.closest("form")!);
    expect(localStorage.getItem("ui_sidebar_label")).toBe("");
    expect(screen.getByRole("button", { name: "nav.sidebar.menu:nav.mySurveys" })).toBeInTheDocument();

    fireEvent.click(within(openMenu("nav.mySurveys")).getByRole("menuitem", { name: "nav.sidebar.renameLabel" }));
    const typedDefault = screen.getByPlaceholderText("nav.mySurveys");
    fireEvent.change(typedDefault, { target: { value: "nav.mySurveys" } });
    fireEvent.submit(typedDefault.closest("form")!);
    expect(localStorage.getItem("ui_sidebar_label")).toBe("");
  });

  it("applies the saved layout and label on first render", () => {
    localStorage.setItem(
      "ui_sidebar_tree",
      JSON.stringify({ open: { f1: true }, hiddenFolders: [], hiddenGroups: ["mine:draft"] }),
    );
    localStorage.setItem("ui_sidebar_label", "Quizzes");
    renderSidebar();
    expect(screen.getByText("Quizzes")).toBeInTheDocument();
    expect(screen.queryByText("Quiz d1")).not.toBeInTheDocument();
    expect(screen.getByText("Quiz x2")).toBeInTheDocument();
  });

  it("shows a hint when every group of a section is hidden", () => {
    localStorage.setItem(
      "ui_sidebar_tree",
      JSON.stringify({ open: {}, hiddenFolders: [], hiddenGroups: ["mine:draft", "mine:published"] }),
    );
    renderSidebar();
    expect(screen.getByText("nav.sidebar.allGroupsHidden")).toBeInTheDocument();
  });

  it("keeps surveys shared by others out of my surveys and lists them under shared", () => {
    surveys = [...surveys, survey("o1", "published", null, "other"), survey("o2", "draft", "theirs", "other")];
    renderSidebar();
    expect(screen.queryByText("Quiz o1")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "nav.sidebar.toggle:dashboard.shared.title" }));
    expect(screen.getByText("Quiz o1")).toBeInTheDocument();
    expect(screen.getByText("Quiz o2")).toBeInTheDocument();
  });

  it("hides the shared section when nothing is shared", () => {
    renderSidebar();
    expect(screen.queryByText("dashboard.shared.title")).not.toBeInTheDocument();
  });

  it("drops prefs of deleted folders when saving", () => {
    localStorage.setItem(
      "ui_sidebar_tree",
      JSON.stringify({ open: { gone: true }, hiddenFolders: ["gone"], hiddenGroups: ["gone:draft"] }),
    );
    renderSidebar();
    fireEvent.click(screen.getByRole("button", { name: "nav.sidebar.toggle:Physics" }));
    expect(JSON.parse(localStorage.getItem("ui_sidebar_tree")!)).toEqual({
      open: { f1: true },
      hiddenFolders: [],
      hiddenGroups: [],
    });
  });

  it("creates a folder from the sidebar", async () => {
    renderSidebar();
    fireEvent.click(within(openMenu("nav.mySurveys")).getByRole("menuitem", { name: "dashboard.folder.new" }));
    const input = screen.getByPlaceholderText("dashboard.folder.namePrompt");
    fireEvent.change(input, { target: { value: "Chemistry" } });
    fireEvent.submit(input.closest("form")!);
    await vi.waitFor(() => expect(createFolder).toHaveBeenCalledWith("Chemistry"));
  });

  it("caps long groups with a link to the filtered dashboard", () => {
    surveys = [
      ...Array.from({ length: 120 }, (_, i) => survey(`s${i}`, "published")),
      ...Array.from({ length: 60 }, (_, i) => survey(`f${i}`, "draft", "f1")),
      ...Array.from({ length: 60 }, (_, i) => survey(`o${i}`, "closed", null, "other")),
    ];
    renderSidebar();
    expect(screen.getByText("Quiz s49")).toBeInTheDocument();
    expect(screen.queryByText("Quiz s50")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "nav.sidebar.showAll:120" })).toHaveAttribute(
      "href",
      "/surveys?status=published",
    );
    fireEvent.click(screen.getByRole("button", { name: "nav.sidebar.toggle:Physics" }));
    expect(screen.getByRole("link", { name: "nav.sidebar.showAll:60" })).toHaveAttribute(
      "href",
      "/surveys?status=draft&folder=f1",
    );
    fireEvent.click(screen.getByRole("button", { name: "nav.sidebar.toggle:dashboard.shared.title" }));
    expect(screen.getByText("Quiz o49")).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /nav\.sidebar\.showAll/ })).toHaveLength(2);
  });
});

describe("SidebarSurveys while folders load", () => {
  afterEach(() => {
    foldersLoading = false;
    foldersFailed = false;
  });

  it("leaves my filed surveys out instead of listing them under My surveys when folders fail to load", () => {
    foldersFailed = true;
    surveys = [survey("filed", "draft", "f1"), survey("loose", "draft")];
    renderSidebar();
    expect(screen.queryByText("Quiz filed")).toBeNull();
    expect(screen.getByText("Quiz loose")).toBeInTheDocument();
  });

  it("shows a skeleton instead of listing filed surveys under My surveys", () => {
    foldersLoading = true;
    surveys = [survey("filed", "draft", "f1")];
    renderSidebar();
    expect(screen.queryByText("Quiz filed")).toBeNull();
    expect(screen.queryByText("nav.mySurveys")).toBeNull();
  });
});
