import type { Folder, Survey, SurveyStatus } from "@/app/types/survey";

export const SIDEBAR_STATUSES: readonly SurveyStatus[] = ["draft", "published", "closed"];
export const SIDEBAR_GROUP_LIMIT = 50;
export const MINE_SECTION = "mine";
export const SHARED_SECTION = "shared";
export const TAGS_SECTION = "tags";
export const TEMPLATES_SECTION = "templates";
export const UNFILED_FOLDER = "none";
export const ALL_FOLDER = "all";

export interface SidebarTreePrefs {
  open: Record<string, boolean>;
  hiddenFolders: string[];
  hiddenGroups: string[];
}

export type HiddenList = "hiddenFolders" | "hiddenGroups";
export type StatusGroups = Partial<Record<SurveyStatus, Survey[]>>;

export const DEFAULT_SIDEBAR_TREE: SidebarTreePrefs = {
  open: {},
  hiddenFolders: [],
  hiddenGroups: [],
};

export function groupKey(section: string, status: SurveyStatus): string {
  return `${section}:${status}`;
}

export function splitByOwner(surveys: Survey[], myId: string | undefined) {
  if (!myId) return { owned: surveys, shared: [] as Survey[] };
  return {
    owned: surveys.filter((s) => s.ownerId === myId),
    shared: surveys.filter((s) => s.ownerId !== myId),
  };
}

export function hasKnownFolder(
  survey: Survey,
  folderIds: ReadonlySet<string>,
): survey is Survey & { folderId: string } {
  return Boolean(survey.folderId && folderIds.has(survey.folderId));
}

export interface TagCount {
  tag: string;
  count: number;
}

export function countTags(surveys: Survey[]): TagCount[] {
  const counts = new Map<string, number>();
  for (const survey of surveys) {
    for (const tag of new Set(survey.tags ?? [])) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  }
  return [...counts]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => a.tag.localeCompare(b.tag));
}

export function buildSidebarTree(
  surveys: Survey[],
  folders: Folder[],
  myId: string | undefined,
): Map<string, StatusGroups> {
  const tree = new Map<string, StatusGroups>([
    [MINE_SECTION, {}],
    [SHARED_SECTION, {}],
    ...folders.map((f): [string, StatusGroups] => [f.id, {}]),
  ]);
  const folderIds = new Set(folders.map((f) => f.id));
  for (const survey of surveys) {
    const section =
      myId && survey.ownerId !== myId
        ? SHARED_SECTION
        : hasKnownFolder(survey, folderIds)
          ? survey.folderId
          : MINE_SECTION;
    (tree.get(section)![survey.status] ??= []).push(survey);
  }
  return tree;
}

export function countSurveys(groups: StatusGroups | undefined): number {
  return SIDEBAR_STATUSES.reduce((sum, status) => sum + (groups?.[status]?.length ?? 0), 0);
}

export function isOpen(prefs: SidebarTreePrefs, key: string, fallback: boolean): boolean {
  return prefs.open[key] ?? fallback;
}

export function withOpen(prefs: SidebarTreePrefs, key: string, open: boolean): SidebarTreePrefs {
  return { ...prefs, open: { ...prefs.open, [key]: open } };
}

export function withHiddenToggled(
  prefs: SidebarTreePrefs,
  list: HiddenList,
  key: string,
): SidebarTreePrefs {
  const current = prefs[list];
  return {
    ...prefs,
    [list]: current.includes(key) ? current.filter((k) => k !== key) : [...current, key],
  };
}

export function prunePrefs(prefs: SidebarTreePrefs, folders: Folder[]): SidebarTreePrefs {
  const folderIds = new Set(folders.map((f) => f.id));
  const sections = new Set([MINE_SECTION, SHARED_SECTION, TAGS_SECTION, TEMPLATES_SECTION, ...folderIds]);
  const inSection = (key: string) => sections.has(key.split(":")[0]);
  return {
    open: Object.fromEntries(Object.entries(prefs.open).filter(([key]) => inSection(key))),
    hiddenFolders: prefs.hiddenFolders.filter((id) => folderIds.has(id)),
    hiddenGroups: prefs.hiddenGroups.filter(inSection),
  };
}

function stringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((k): k is string => typeof k === "string") : [];
}

export function parseSidebarTree(raw: string): SidebarTreePrefs {
  const value: unknown = JSON.parse(raw);
  if (!value || typeof value !== "object") return DEFAULT_SIDEBAR_TREE;
  const { open, hiddenFolders, hiddenGroups } = value as Record<string, unknown>;
  return {
    open:
      open && typeof open === "object"
        ? Object.fromEntries(Object.entries(open).filter(([, v]) => typeof v === "boolean"))
        : {},
    hiddenFolders: stringList(hiddenFolders),
    hiddenGroups: stringList(hiddenGroups),
  };
}

export function showAllHref(folderId: string | null, status: SurveyStatus): string {
  const params = new URLSearchParams({ status });
  if (folderId) params.set("folder", folderId);
  return `/surveys?${params.toString()}`;
}
