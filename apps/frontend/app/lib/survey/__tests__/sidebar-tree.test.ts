import { describe, it, expect } from "vitest";
import type { Survey } from "@/app/types/survey";
import {
  DEFAULT_SIDEBAR_TREE,
  buildSidebarTree,
  countSurveys,
  countTags,
  hasKnownFolder,
  groupKey,
  isOpen,
  parseSidebarTree,
  prunePrefs,
  showAllHref,
  splitByOwner,
  withHiddenToggled,
  withOpen,
} from "../sidebar-tree";

function survey(
  id: string,
  status: Survey["status"],
  folderId: string | null = null,
  ownerId = "me",
): Survey {
  return { id, title: id, status, folderId, ownerId } as Survey;
}

const ids = (list: Survey[] | undefined) => (list ?? []).map((s) => s.id);

describe("buildSidebarTree", () => {
  const folders = [{ id: "f1", name: "Work" }];
  const surveys = [
    survey("a", "closed"),
    survey("b", "draft"),
    survey("c", "closed"),
    survey("d", "draft", "f1"),
    survey("e", "draft", "foreign"),
    survey("s", "published", "theirs", "other"),
    survey("t", "draft", null, "other"),
  ];

  it("groups owned unfiled surveys by status, keeping unknown folders unfiled", () => {
    const mine = buildSidebarTree(surveys, folders, "me").get("mine");
    expect(ids(mine?.draft)).toEqual(["b", "e"]);
    expect(ids(mine?.closed)).toEqual(["a", "c"]);
    expect(mine?.published).toBeUndefined();
  });

  it("puts owned folder surveys under their folder and others' surveys under shared", () => {
    const tree = buildSidebarTree(surveys, folders, "me");
    expect(ids(tree.get("f1")?.draft)).toEqual(["d"]);
    expect(ids(tree.get("shared")?.published)).toEqual(["s"]);
    expect(ids(tree.get("shared")?.draft)).toEqual(["t"]);
    expect(countSurveys(tree.get("shared"))).toBe(2);
  });

  it("treats every survey as owned while the user is unknown", () => {
    const tree = buildSidebarTree(surveys, folders, undefined);
    expect(countSurveys(tree.get("shared"))).toBe(0);
    expect(countSurveys(tree.get("mine"))).toBe(6);
    expect(countSurveys(tree.get("f1"))).toBe(1);
  });
});

describe("splitByOwner", () => {
  it("splits owned and shared surveys", () => {
    const { owned, shared } = splitByOwner([survey("a", "draft"), survey("b", "draft", null, "x")], "me");
    expect(ids(owned)).toEqual(["a"]);
    expect(ids(shared)).toEqual(["b"]);
  });

  it("treats everything as owned without a user", () => {
    const { owned, shared } = splitByOwner([survey("a", "draft", null, "x")], undefined);
    expect(ids(owned)).toEqual(["a"]);
    expect(shared).toEqual([]);
  });
});

describe("prefs helpers", () => {
  it("falls back to the default until a section is toggled", () => {
    expect(isOpen(DEFAULT_SIDEBAR_TREE, "f1", false)).toBe(false);
    const next = withOpen(DEFAULT_SIDEBAR_TREE, "f1", true);
    expect(isOpen(next, "f1", false)).toBe(true);
    expect(DEFAULT_SIDEBAR_TREE.open).toEqual({});
  });

  it("toggles hidden groups and folders separately without mutating", () => {
    const hidden = withHiddenToggled(DEFAULT_SIDEBAR_TREE, "hiddenGroups", groupKey("f1", "draft"));
    expect(hidden.hiddenGroups).toEqual(["f1:draft"]);
    expect(hidden.hiddenFolders).toEqual([]);
    expect(withHiddenToggled(hidden, "hiddenGroups", "f1:draft").hiddenGroups).toEqual([]);
    expect(withHiddenToggled(hidden, "hiddenFolders", "f1").hiddenFolders).toEqual(["f1"]);
    expect(DEFAULT_SIDEBAR_TREE).toEqual({ open: {}, hiddenFolders: [], hiddenGroups: [] });
  });

  it("prunes entries of folders that no longer exist", () => {
    const prefs = {
      open: { mine: true, "mine:draft": false, f1: true, "f1:closed": false, gone: true, "gone:draft": true, shared: true },
      hiddenFolders: ["f1", "gone"],
      hiddenGroups: ["f1:draft", "gone:draft", "shared:closed"],
    };
    expect(prunePrefs(prefs, [{ id: "f1", name: "Work" }])).toEqual({
      open: { mine: true, "mine:draft": false, f1: true, "f1:closed": false, shared: true },
      hiddenFolders: ["f1"],
      hiddenGroups: ["f1:draft", "shared:closed"],
    });
  });

  it("keeps the open state of tags and templates but no stale hidden flags when pruning", () => {
    const prefs = { open: { tags: true, templates: false }, hiddenFolders: ["tags", "templates"], hiddenGroups: [] };
    expect(prunePrefs(prefs, [])).toEqual({ ...prefs, hiddenFolders: [] });
  });

  it("parses stored prefs and drops invalid entries", () => {
    expect(
      parseSidebarTree('{"open":{"a":true,"b":"x"},"hiddenFolders":["f1",2],"hiddenGroups":["f1:draft"]}'),
    ).toEqual({ open: { a: true }, hiddenFolders: ["f1"], hiddenGroups: ["f1:draft"] });
    expect(parseSidebarTree('{"hidden":["f1"]}')).toEqual(DEFAULT_SIDEBAR_TREE);
    expect(parseSidebarTree('{"open":[true],"hiddenGroups":"x"}')).toEqual({
      open: { "0": true },
      hiddenFolders: [],
      hiddenGroups: [],
    });
    expect(parseSidebarTree("null")).toEqual(DEFAULT_SIDEBAR_TREE);
    expect(parseSidebarTree("[1]")).toEqual(DEFAULT_SIDEBAR_TREE);
    expect(() => parseSidebarTree("{")).toThrow();
  });
});

describe("showAllHref", () => {
  it("links to the dashboard filtered by folder and status", () => {
    expect(showAllHref("f1", "draft")).toBe("/surveys?status=draft&folder=f1");
    expect(showAllHref(null, "closed")).toBe("/surveys?status=closed");
    expect(showAllHref("none", "draft")).toBe("/surveys?status=draft&folder=none");
  });
});

describe("tag helpers", () => {
  const tagged = (id: string, tags: string[] | undefined, ownerId = "me") =>
    ({ ...survey(id, "draft", null, ownerId), tags }) as Survey;

  it("counts each tag once per survey across owned and shared surveys, sorted by name", () => {
    expect(
      countTags([
        tagged("a", ["exam", "math", "exam"]),
        tagged("b", ["Biology", "exam"], "other"),
        tagged("c", undefined),
      ]),
    ).toEqual([
      { tag: "Biology", count: 1 },
      { tag: "exam", count: 2 },
      { tag: "math", count: 1 },
    ]);
    expect(countTags([])).toEqual([]);
  });
});

describe("hasKnownFolder", () => {
  it("treats missing and unknown folders as unfiled", () => {
    const folderIds = new Set(["f1"]);
    expect(hasKnownFolder(survey("a", "draft", "f1"), folderIds)).toBe(true);
    expect(hasKnownFolder(survey("b", "draft", "gone"), folderIds)).toBe(false);
    expect(hasKnownFolder(survey("c", "draft"), folderIds)).toBe(false);
  });
});
