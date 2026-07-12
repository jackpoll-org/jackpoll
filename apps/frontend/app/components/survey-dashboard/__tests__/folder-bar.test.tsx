import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { DndContext } from "@dnd-kit/core";
import type { Folder, Survey } from "@/app/types/survey";

const mutateAsync = vi.fn().mockResolvedValue(undefined);
vi.mock("@/app/hooks/survey", () => ({
  useCreateFolder: () => ({ mutateAsync }),
  useRenameFolder: () => ({ mutateAsync }),
  useDeleteFolder: () => ({ mutateAsync }),
}));
vi.mock("@/app/i18n/context", () => ({
  useTranslation: () => ({
    t: (k: string, vars?: Record<string, string>) =>
      vars ? `${k}:${Object.values(vars).join(",")}` : k,
  }),
}));

import { FolderBar } from "../folder-bar";

const folders: Folder[] = [
  { id: "f1", name: "Work" },
  { id: "f2", name: "Personal" },
];
function survey(id: string, folderId: string | null): Survey {
  return {
    id,
    ownerId: "o1",
    title: id,
    status: "draft",
    settings: {} as Survey["settings"],
    questions: [],
    folderId,
    createdAt: "2026-06-10T00:00:00Z",
    updatedAt: "2026-06-10T00:00:00Z",
  };
}
const surveys = [survey("s1", "f1"), survey("s2", "f1"), survey("s3", null)];

function renderBar(openFolderId: string | null, onOpen = vi.fn()) {
  return render(
    <DndContext>
      <FolderBar
        folders={folders}
        surveys={surveys}
        openFolderId={openFolderId}
        onOpen={onOpen}
      />
    </DndContext>,
  );
}

beforeEach(() => {
  cleanup();
  mutateAsync.mockClear();
});

describe("FolderBar", () => {
  it("renders a tile per folder with its survey count at root", () => {
    renderBar(null);
    expect(screen.getByText("Work")).toBeTruthy();
    expect(screen.getByText("Personal")).toBeTruthy();
    // Work has 2 surveys, Personal 0.
    expect(screen.getByText("2")).toBeTruthy();
    expect(screen.getByText("dashboard.folder.new")).toBeTruthy();
  });

  it("opens a folder when its tile is clicked", () => {
    const onOpen = vi.fn();
    renderBar(null, onOpen);
    fireEvent.click(screen.getByRole("button", { name: "dashboard.folder.open:Work" }));
    expect(onOpen).toHaveBeenCalledWith("f1");
  });

  it("shows a breadcrumb with the open folder name and a back action", () => {
    const onOpen = vi.fn();
    renderBar("f1", onOpen);
    expect(screen.getByText("Work")).toBeTruthy();
    expect(screen.getByText("dashboard.folder.root")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /dashboard.folder.back/ }));
    expect(onOpen).toHaveBeenCalledWith(null);
  });
});
