// ── Dashboard folder drag & drop (issue #94) ───────────────────────
//
// Pure helpers that translate a @dnd-kit drag (a survey card dropped onto a
// folder tile / All / Unfiled target) into the survey move it implies. Kept
// free of React so the wiring in survey-dashboard stays thin and testable.

import type { Survey } from "@/app/types/survey";

/** Droppable id for the "Unfiled" target. */
export const UNFILED_DROP_ID = "unfiled";
/** Droppable id for the "All" target (also clears the folder). */
export const ALL_DROP_ID = "all";
/** Prefix for a folder droppable id, e.g. `folder:abc`. */
const FOLDER_DROP_PREFIX = "folder:";

/** Build the droppable id for a folder. */
export function folderDropId(folderId: string): string {
  return `${FOLDER_DROP_PREFIX}${folderId}`;
}

/** The target folderId a droppable id represents (null = unfiled/all). */
export function dropTargetFolderId(overId: string): string | null {
  if (overId.startsWith(FOLDER_DROP_PREFIX)) {
    return overId.slice(FOLDER_DROP_PREFIX.length);
  }
  return null; // UNFILED_DROP_ID or ALL_DROP_ID
}

/** True when a drop id is one of our move targets. */
export function isFolderDropTarget(overId: string): boolean {
  return (
    overId === UNFILED_DROP_ID ||
    overId === ALL_DROP_ID ||
    overId.startsWith(FOLDER_DROP_PREFIX)
  );
}

export interface FolderMove {
  id: string;
  folderId: string | null;
  /** The survey's current tags — preserved through the organize call. */
  tags: string[];
}

/**
 * Resolve a card-onto-target drag into the move it implies, or null when it is
 * a no-op (unknown survey, non-target drop, or already in that folder).
 */
export function resolveFolderDrop(
  activeId: string,
  overId: string | null,
  surveys: readonly Survey[],
): FolderMove | null {
  if (!overId || !isFolderDropTarget(overId)) return null;
  const survey = surveys.find((s) => s.id === activeId);
  if (!survey) return null;

  const target = dropTargetFolderId(overId);
  const current = survey.folderId ?? null;
  if (current === target) return null; // already there

  return { id: survey.id, folderId: target, tags: survey.tags ?? [] };
}

/** Immutable move of one item within an array (dnd-kit style, dep-free). */
export function arrayMove<T>(items: readonly T[], from: number, to: number): T[] {
  const next = items.slice();
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

export interface ReorderResult {
  folderId: string | null;
  orderedIds: string[];
}

/**
 * Resolve a card-onto-card drag into the new manual order for that folder/root
 * bucket, or null when it's a no-op or the two cards live in different folders
 * (cross-folder drags are handled as moves, not reorders).
 *
 * @param scopeIds The survey ids currently shown in the active card's bucket,
 *   in their displayed order.
 */
export function resolveReorder(
  activeId: string,
  overId: string,
  surveys: readonly Survey[],
  scopeIds: readonly string[],
): ReorderResult | null {
  if (activeId === overId) return null;
  const active = surveys.find((s) => s.id === activeId);
  const over = surveys.find((s) => s.id === overId);
  if (!active || !over) return null;
  const folderId = active.folderId ?? null;
  if (folderId !== (over.folderId ?? null)) return null; // different buckets

  const from = scopeIds.indexOf(activeId);
  const to = scopeIds.indexOf(overId);
  if (from === -1 || to === -1 || from === to) return null;

  return { folderId, orderedIds: arrayMove(scopeIds, from, to) };
}
