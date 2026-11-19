import { usePreference } from "@/app/hooks/use-preference";
import { getCookie } from "@/app/lib/cookies";
import {
  DEFAULT_SIDEBAR_TREE,
  parseSidebarTree,
  type SidebarTreePrefs,
} from "@/app/lib/survey/sidebar-tree";

/** Keys for the UI preferences managed from the Settings page. */
export const PREF_KEYS = {
  hideBrand: "ui_hide_brand",
  reducedMotion: "ui_reduced_motion",
  listDensity: "ui_list_density",
  listSort: "ui_list_sort",
  listView: "ui_list_view",
  sidebarTree: "ui_sidebar_tree",
  sidebarLabel: "ui_sidebar_label",
} as const;

const HIDE_BRAND_ATTR = "data-hide-brand";

export type ReducedMotionPref = "system" | "on" | "off";
export type ListDensity = "comfortable" | "compact";
/** Matches the survey dashboard's SortBy. `manual` = user's drag order (#94). */
export type ListSort = "updated" | "created" | "title" | "manual";
/** Dashboard display mode: card grid or compact list (issue #94). */
export type ListView = "grid" | "list";

// ── Non-React readers (for modules that can't use hooks) ───────────

/** Read the reduced-motion override; "system" defers to the OS media query. */
export function readReducedMotionPref(): ReducedMotionPref {
  if (typeof localStorage === "undefined") return "system";
  const v = localStorage.getItem(PREF_KEYS.reducedMotion);
  return v === "on" || v === "off" ? v : "system";
}

/** Read the hide-brand cookie (true when the header logo is hidden). */
export function readHideBrand(): boolean {
  return getCookie(PREF_KEYS.hideBrand) === "1";
}

// ── React hooks ────────────────────────────────────────────────────

/** Hide the header/sidebar brand logo + name. Cookie-backed, zero-flash. */
export function useHideBrand(): [boolean, (v: boolean) => void, boolean] {
  return usePreference<boolean>({
    key: PREF_KEYS.hideBrand,
    defaultValue: false,
    backend: "cookie",
    bodyAttr: HIDE_BRAND_ATTR,
    serialize: (v) => (v ? "1" : ""),
    deserialize: (s) => s === "1",
  });
}

export function useReducedMotionPref(): [ReducedMotionPref, (v: ReducedMotionPref) => void, boolean] {
  return usePreference<ReducedMotionPref>({
    key: PREF_KEYS.reducedMotion,
    defaultValue: "system",
  });
}

export function useListDensity(): [ListDensity, (v: ListDensity) => void, boolean] {
  return usePreference<ListDensity>({
    key: PREF_KEYS.listDensity,
    defaultValue: "comfortable",
  });
}

export function useListSort(): [ListSort, (v: ListSort) => void, boolean] {
  return usePreference<ListSort>({
    key: PREF_KEYS.listSort,
    defaultValue: "updated",
  });
}

export function useListView(): [ListView, (v: ListView) => void, boolean] {
  return usePreference<ListView>({
    key: PREF_KEYS.listView,
    defaultValue: "grid",
  });
}

export function useSidebarTree(): [SidebarTreePrefs, (v: SidebarTreePrefs) => void, boolean] {
  return usePreference<SidebarTreePrefs>({
    key: PREF_KEYS.sidebarTree,
    defaultValue: DEFAULT_SIDEBAR_TREE,
    serialize: JSON.stringify,
    deserialize: parseSidebarTree,
  });
}

export function useSidebarLabel(): [string, (v: string) => void, boolean] {
  return usePreference<string>({
    key: PREF_KEYS.sidebarLabel,
    defaultValue: "",
  });
}
