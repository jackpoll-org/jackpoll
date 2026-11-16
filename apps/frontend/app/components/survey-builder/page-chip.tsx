"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/app/i18n/context";

interface PageChipProps {
  id: string;
  label: string;
  active: boolean;
  onSelect: () => void;
}

export function PageChip({ id, label, active, onSelect }: PageChipProps) {
  const { t } = useTranslation();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id });

  return (
    <div
      ref={setNodeRef}
      data-page-id={id}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn(
        "flex shrink-0 items-center rounded-full border text-sm transition-colors",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "bg-background text-muted-foreground hover:bg-muted",
        isDragging && "relative z-10 opacity-70 shadow-lg",
      )}
    >
      <button
        type="button"
        aria-label={t("builder.page.dragReorder", { label })}
        className="cursor-grab touch-none rounded-full py-1.5 pl-2 active:cursor-grabbing"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="size-3.5" />
      </button>
      <button
        type="button"
        onClick={onSelect}
        className="rounded-full py-1.5 pl-1 pr-3"
      >
        {label}
      </button>
    </div>
  );
}
