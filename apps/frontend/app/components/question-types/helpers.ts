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
