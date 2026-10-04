"use client";

import type { ReactNode } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { useTranslation } from "@/app/i18n/context";

interface SortableOptionRowProps {
  id: string;
  /** Accessible name of the option, used in the drag handle's label. */
  label: string;
  children: ReactNode;
}

/** One draggable row of an {@link OptionListEditor}, reordered via its grip handle (#10). */
export function SortableOptionRow({ id, label, children }: SortableOptionRowProps) {
  const { t } = useTranslation();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      data-option-id={id}
      className={
        isDragging
          ? "relative z-10 flex items-center gap-2 rounded-md bg-background opacity-80 shadow-md"
          : "flex items-center gap-2"
      }
    >
      <button
        type="button"
        aria-label={t("qedit.dragReorder", { label })}
        className="cursor-grab touch-none rounded p-0.5 text-muted-foreground hover:text-foreground active:cursor-grabbing"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="size-4" />
      </button>
      {children}
    </div>
  );
}
