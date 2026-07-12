import { describe, it, expect } from "vitest";
import {
  resolveFolderDrop,
  resolveReorder,
  arrayMove,
  folderDropId,
  dropTargetFolderId,
  isFolderDropTarget,
  UNFILED_DROP_ID,
  ALL_DROP_ID,
} from "../folder-dnd";
import type { Survey } from "@/app/types/survey";

function survey(id: string, folderId: string | null, tags: string[] = []): Survey {
  return {
    id,
    ownerId: "o1",
    title: id,
    status: "draft",
    settings: {} as Survey["settings"],
    questions: [],
    folderId,
    tags,
    createdAt: "2026-06-10T00:00:00Z",
    updatedAt: "2026-06-10T00:00:00Z",
  };
}

describe("folder-dnd helpers", () => {
  it("encodes/decodes folder drop ids", () => {
    expect(folderDropId("abc")).toBe("folder:abc");
    expect(dropTargetFolderId("folder:abc")).toBe("abc");
    expect(dropTargetFolderId(UNFILED_DROP_ID)).toBeNull();
    expect(dropTargetFolderId(ALL_DROP_ID)).toBeNull();
  });

  it("recognises valid drop targets only", () => {
    expect(isFolderDropTarget("folder:x")).toBe(true);
    expect(isFolderDropTarget(UNFILED_DROP_ID)).toBe(true);
    expect(isFolderDropTarget(ALL_DROP_ID)).toBe(true);
    expect(isFolderDropTarget("survey-card")).toBe(false);
  });

  const surveys = [survey("s1", null, ["x"]), survey("s2", "f1")];

  it("moves an unfiled survey into a folder, preserving tags", () => {
    expect(resolveFolderDrop("s1", "folder:f1", surveys)).toEqual({
      id: "s1",
      folderId: "f1",
      tags: ["x"],
    });
  });

  it("moves a filed survey to unfiled", () => {
    expect(resolveFolderDrop("s2", UNFILED_DROP_ID, surveys)).toEqual({
      id: "s2",
      folderId: null,
      tags: [],
    });
  });

  it("is a no-op when dropped on the folder it already lives in", () => {
    expect(resolveFolderDrop("s2", "folder:f1", surveys)).toBeNull();
  });

  it("is a no-op for unknown survey or non-target drop", () => {
    expect(resolveFolderDrop("nope", "folder:f1", surveys)).toBeNull();
    expect(resolveFolderDrop("s1", "another-card", surveys)).toBeNull();
    expect(resolveFolderDrop("s1", null, surveys)).toBeNull();
  });
});

describe("arrayMove", () => {
  it("moves an item and leaves the original untouched", () => {
    const src = ["a", "b", "c", "d"];
    expect(arrayMove(src, 0, 2)).toEqual(["b", "c", "a", "d"]);
    expect(src).toEqual(["a", "b", "c", "d"]); // immutable
  });
});

describe("resolveReorder", () => {
  const a = survey("a", "f1");
  const b = survey("b", "f1");
  const c = survey("c", "f1");
  const root = survey("r", null);
  const all = [a, b, c, root];
  const scope = ["a", "b", "c"];

  it("returns the new order within the same folder bucket", () => {
    expect(resolveReorder("a", "c", all, scope)).toEqual({
      folderId: "f1",
      orderedIds: ["b", "c", "a"],
    });
  });

  it("is a no-op when dropped on itself", () => {
    expect(resolveReorder("a", "a", all, scope)).toBeNull();
  });

  it("refuses to reorder across different folders", () => {
    expect(resolveReorder("a", "r", all, ["a", "b", "c", "r"])).toBeNull();
  });

  it("is a no-op for ids missing from the scope", () => {
    expect(resolveReorder("a", "z", all, scope)).toBeNull();
  });
});
