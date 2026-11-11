import { arrayMove } from "@dnd-kit/sortable";
import type { Option } from "@/app/types/survey";

/** Generate a client-side id. The backend regenerates ids it doesn't recognise. */
export function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `tmp-${Math.random().toString(36).slice(2)}-${Date.now()}`;
}

/** Create a new option/row/column with a default label. */
export function createOption(label: string): Option {
  return { id: newId(), label };
}

export function shuffled<T>(items: T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Options for each non-empty line; blank existing options are replaced, others kept. */
export function addOptionLines(options: Option[], text: string): Option[] {
  const added = text.split("\n").flatMap((line) => {
    const label = line.trim();
    return label ? [createOption(label)] : [];
  });
  if (added.length === 0) return options;
  const kept = options.filter((o) => o.label.trim() !== "");
  return [...kept, ...added];
}

/** Immutably update the label of the option with the given id. */
export function updateOptionLabel(
  options: Option[],
  id: string,
  label: string,
): Option[] {
  return options.map((o) => (o.id === id ? { ...o, label } : o));
}

/** Immutably remove the option with the given id. */
export function removeOption(options: Option[], id: string): Option[] {
  return options.filter((o) => o.id !== id);
}

/** Immutably set an option's quota capacity (#38); null clears it. */
export function updateOptionCapacity(
  options: Option[],
  id: string,
  capacity: number | null,
): Option[] {
  return options.map((o) => (o.id === id ? { ...o, capacity } : o));
}

/**
 * Immutably move the option `activeId` to the position of `overId` (#10).
 * Returns the input unchanged when either id is unknown or they are equal.
 */
export function reorderOptions(
  options: Option[],
  activeId: string,
  overId: string,
): Option[] {
  const from = options.findIndex((o) => o.id === activeId);
  const to = options.findIndex((o) => o.id === overId);
  if (from === -1 || to === -1 || from === to) return options;
  return arrayMove(options, from, to);
}
