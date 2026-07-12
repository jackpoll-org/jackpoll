"use client";

import { useEffect } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Option } from "@/app/types/survey";
import type { QuestionPreviewProps } from "../types";
import { useTranslation } from "@/app/i18n/context";

/** Preview / answer renderer for ranking questions (drag options into order). */
export function RankingPreview({
  question,
  value,
  onChange,
  disabled,
}: QuestionPreviewProps) {
  const options: Option[] = question.options ?? [];
  const interactive = !!onChange && !disabled;
  const byId = new Map(options.map((o) => [o.id, o]));

  // Current order: stored ids (filtered to still-existing options, then any new
  // options appended), or the default option order.
  const stored = Array.isArray(value) ? (value as string[]) : [];
  const ordered = [
    ...stored.filter((id) => byId.has(id)),
    ...options.filter((o) => !stored.includes(o.id)).map((o) => o.id),
  ];

  // A ranking always shows a full order, so record the default once — keeps the
  // stored answer in sync and satisfies a required question.
  useEffect(() => {
    if (interactive && !Array.isArray(value)) onChange?.(ordered);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const from = ordered.indexOf(String(active.id));
    const to = ordered.indexOf(String(over.id));
    if (from < 0 || to < 0) return;
    onChange?.(arrayMove(ordered, from, to));
  }

  const rows = ordered.map((id, i) => (
    <RankRow
      key={id}
      id={id}
      rank={i + 1}
      label={byId.get(id)?.label ?? id}
      interactive={interactive}
    />
  ));

  if (!interactive) {
    return <ol className="grid gap-2">{rows}</ol>;
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={ordered} strategy={verticalListSortingStrategy}>
        <ol className="grid gap-2">{rows}</ol>
      </SortableContext>
    </DndContext>
  );
}

function RankRow({
  id,
  rank,
  label,
  interactive,
}: {
  id: string;
  rank: number;
  label: string;
  interactive: boolean;
}) {
  const { t } = useTranslation();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id, disabled: !interactive });

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "flex items-center gap-3 rounded-md border bg-background px-3 py-2",
        isDragging && "opacity-60 shadow-sm",
      )}
    >
      <span className="grid size-6 shrink-0 place-items-center rounded-full bg-primary text-xs font-medium text-primary-foreground tabular-nums">
        {rank}
      </span>
      <span className="flex-1 text-sm">{label}</span>
      {interactive && (
        <button
          type="button"
          className="cursor-grab text-muted-foreground active:cursor-grabbing"
          aria-label={t("builder.question.dragReorder")}
          {...attributes}
          {...listeners}
        >
          <GripVertical className="size-4" />
        </button>
      )}
    </li>
  );
}
