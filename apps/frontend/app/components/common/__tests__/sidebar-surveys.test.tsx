import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, within } from "@testing-library/react";
import type { Folder, Survey } from "@/app/types/survey";

let surveys: Survey[] = [];
const folders: Folder[] = [{ id: "f1", name: "Physics" }];
let foldersLoading = false;
let foldersFailed = false;
const createFolder = vi.fn().mockResolvedValue(undefined);
const renameFolder = vi.fn().mockResolvedValue(undefined);
const startFromTemplate = vi.fn().mockResolvedValue(undefined);
let templates: { id: string; name: string }[] = [];
let search = new URLSearchParams();

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
vi.mock("@/app/hooks/templates", () => ({
  useCustomTemplates: () => ({ data: templates }),
  useStartFromTemplate: () => ({ start: startFromTemplate, isPending: false }),
}));
vi.mock("@/app/i18n/context", () => ({
  useTranslation: () => ({
    t: (k: string, vars?: Record<string, string | number>) =>
      vars ? `${k}:${Object.values(vars).join(",")}` : k,
  }),
}));
vi.mock("next/navigation", () => ({
  usePathname: () => "/surveys",
  useSearchParams: () => search,
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
  tags: string[] = [],
): Survey {
  return { id, title: `Quiz ${id}`, status, folderId, ownerId, tags } as Survey;
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
  templates = [];
  search = new URLSearchParams();
  startFromTemplate.mockClear();
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
    fireEvent.click(within(openMenu("nav.unorganized")).getByRole("menuitemcheckbox", { name: "dashboard.status.draft" }));
    expect(screen.queryByText("Quiz d1")).not.toBeInTheDocument();
    expect(screen.getByText("Quiz p1")).toBeInTheDocument();

    fireEvent.click(within(openMenu("Physics")).getByRole("menuitem", { name: "nav.sidebar.hideFolder" }));
    expect(screen.queryByRole("button", { name: "Physics" })).not.toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem("ui_sidebar_tree")!)).toMatchObject({
      hiddenGroups: ["mine:draft"],
      hiddenFolders: ["f1"],
    });

    const menu = openMenu("nav.unorganized");
    fireEvent.click(within(menu).getByRole("menuitemcheckbox", { name: "dashboard.status.draft" }));
    fireEvent.click(within(openMenu("nav.unorganized")).getByRole("menuitem", { name: "nav.sidebar.showFolder:Physics" }));
    expect(screen.getByText("Quiz d1")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "nav.sidebar.toggle:Physics" })).toBeInTheDocument();
  });

  it("links a fixed All surveys entry and the Unorganized section to the dashboard", () => {
    renderSidebar();
    const all = screen.getByRole("link", { name: "nav.allSurveys" });
    expect(all).toHaveAttribute("href", "/surveys?folder=all");
    expect(all).toHaveAttribute("data-active", "false");
    const unorganized = screen.getByRole("link", { name: "nav.unorganized" });
    expect(unorganized).toHaveAttribute("href", "/surveys?folder=none");
    expect(unorganized).toHaveAttribute("data-active", "false");
    expect(screen.queryByRole("menuitem", { name: /renameLabel/ })).toBeNull();
  });

  it("marks All surveys active on the flat all-surveys view", () => {
    search = new URLSearchParams("folder=all");
    renderSidebar();
    expect(screen.getByRole("link", { name: "nav.allSurveys" })).toHaveAttribute("data-active", "true");
    expect(screen.getByRole("link", { name: "nav.unorganized" })).toHaveAttribute("data-active", "false");
  });

  it("marks a folder active only while no tag filter is set", () => {
    surveys = [survey("a", "draft", "f1", "me", ["exam"])];
    search = new URLSearchParams("folder=f1");
    renderSidebar();
    expect(screen.getByRole("link", { name: "Physics" })).toHaveAttribute("data-active", "true");
    cleanup();

    search = new URLSearchParams("folder=f1&tag=exam");
    renderSidebar();
    expect(screen.getByRole("link", { name: "Physics" })).toHaveAttribute("data-active", "false");
    fireEvent.click(screen.getByRole("button", { name: "nav.sidebar.toggle:nav.tags" }));
    expect(screen.getByRole("link", { name: "exam1" })).toHaveAttribute("data-active", "true");
  });

  it("marks Unorganized active instead of All surveys on the unfiled view", () => {
    search = new URLSearchParams("folder=none");
    renderSidebar();
    expect(screen.getByRole("link", { name: "nav.allSurveys" })).toHaveAttribute("data-active", "false");
    expect(screen.getByRole("link", { name: "nav.unorganized" })).toHaveAttribute("data-active", "true");
  });

  it("lists tags across all surveys with counts and links to the tag filter", () => {
    surveys = [
      survey("a", "draft", null, "me", ["exam", "math"]),
      survey("b", "draft", "f1", "me", ["exam"]),
      survey("c", "draft", null, "other", ["Biology"]),
    ];
    search = new URLSearchParams("tag=exam");
    renderSidebar();
    expect(screen.queryByText("exam")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "nav.sidebar.toggle:nav.tags" }));
    const links = screen.getAllByRole("link").filter((l) => l.getAttribute("href")?.includes("tag="));
    expect(links.map((l) => [l.textContent, l.getAttribute("href")])).toEqual([
      ["Biology1", "/surveys?tag=Biology"],
      ["exam2", "/surveys?tag=exam"],
      ["math1", "/surveys?tag=math"],
    ]);
    expect(links[1]).toHaveAttribute("data-active", "true");
    expect(screen.getByRole("link", { name: "nav.allSurveys" })).toHaveAttribute("data-active", "false");
  });

  it("hides the tags and templates sections when empty", () => {
    renderSidebar();
    expect(screen.queryByText("nav.tags")).toBeNull();
    expect(screen.queryByText("nav.templates")).toBeNull();
  });

  it("starts a new survey from a custom template", async () => {
    templates = [{ id: "t1", name: "Weekly check-in" }];
    renderSidebar();
    fireEvent.click(screen.getByRole("button", { name: "nav.sidebar.toggle:nav.templates" }));
    fireEvent.click(screen.getByRole("button", { name: "nav.sidebar.useTemplate:Weekly check-in" }));
    await vi.waitFor(() => expect(startFromTemplate).toHaveBeenCalledWith(templates[0]));
    expect(
      within(openMenu("nav.templates")).getByRole("menuitem", { name: "nav.sidebar.manageTemplates" }),
    ).toHaveAttribute("href", "/surveys?new=1");
  });

  it("offers no hide option for the tags section and hides it in the icon sidebar", () => {
    surveys = [survey("a", "draft", null, "me", ["exam"])];
    renderSidebar();
    expect(screen.queryByRole("button", { name: "nav.sidebar.menu:nav.tags" })).toBeNull();
    const item = screen.getByRole("button", { name: "nav.sidebar.toggle:nav.tags" }).closest("li");
    expect(item).toHaveClass("group-data-[collapsible=icon]:hidden");
  });

  it("applies the saved layout on first render", () => {
    localStorage.setItem(
      "ui_sidebar_tree",
      JSON.stringify({ open: { f1: true }, hiddenFolders: [], hiddenGroups: ["mine:draft"] }),
    );
    renderSidebar();
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
      JSON.stringify({ open: { gone: true }, hiddenFolders: ["gone", "tags"], hiddenGroups: ["gone:draft"] }),
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
    fireEvent.click(within(openMenu("nav.unorganized")).getByRole("menuitem", { name: "dashboard.folder.new" }));
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
      "/surveys?status=published&folder=none",
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

  it("leaves my filed surveys out instead of listing them under Unorganized when folders fail to load", () => {
    foldersFailed = true;
    surveys = [survey("filed", "draft", "f1"), survey("loose", "draft")];
    renderSidebar();
    expect(screen.queryByText("Quiz filed")).toBeNull();
    expect(screen.getByText("Quiz loose")).toBeInTheDocument();
  });

  it("shows a skeleton instead of listing filed surveys under Unorganized", () => {
    foldersLoading = true;
    surveys = [survey("filed", "draft", "f1")];
    renderSidebar();
    expect(screen.queryByText("Quiz filed")).toBeNull();
    expect(screen.queryByText("nav.unorganized")).toBeNull();
  });
});
