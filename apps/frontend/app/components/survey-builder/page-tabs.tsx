"use client";

import { ChevronLeft, ChevronRight, Plus, Trash2 } from "lucide-react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  horizontalListSortingStrategy,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { Card, CardContent } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { newId } from "@/app/components/question-types/helpers";
import { useBuilder } from "./builder-context";
import { CollabTextInput } from "./collab-text-input";
import { useTranslation } from "@/app/i18n/context";
import { PageChip } from "./page-chip";
import { FIRST_PAGE_ID } from "./builder-reducer";
import { hasImplicitFirstPage } from "@/app/lib/survey/pagination";

/**
 * Page strip for the builder (issue #88). Pages are the renamed "sections",
 * shown in the order the player paginates them in buildPages(). The implicit
 * ungrouped bucket (sectionId === null) comes first while it exists; moving it
 * turns it into a real section. Clicking a chip selects the active page;
 * questions and "Add question" target it. `+` appends a new page and selects it.
 */
export function PageTabs() {
  const { t } = useTranslation();
  const {
    survey,
    activePageId,
    setActivePageId,
    addSection,
    updateSection,
    removeSection,
    reorderSections,
    updateSettings,
  } = useBuilder();
  const sections = survey.sections ?? [];

  const pages = [
    ...(hasImplicitFirstPage(survey) || activePageId === null
      ? [{ id: null, sortId: FIRST_PAGE_ID, title: survey.settings.firstPageTitle }]
      : []),
    ...sections.map((s) => ({ id: s.id, sortId: s.id, title: s.title })),
  ].map((page, i) => ({
    ...page,
    label: page.title?.trim() || t("builder.page.numbered", { n: String(i + 1) }),
  }));

  function addPage() {
    const id = newId();
    addSection(id);
    setActivePageId(id);
  }


  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragEnd({ active, over }: DragEndEvent) {
    if (over && active.id !== over.id) {
      reorderSections(String(active.id), String(over.id));
    }
  }

  const labelOf = (id: string | number) =>
    pages.find((p) => p.sortId === String(id))?.label ?? "";
  const announcements: Announcements = {
    onDragStart: ({ active }) => t("builder.page.dragStart", { label: labelOf(active.id) }),
    onDragOver: ({ active, over }) =>
      over ? t("builder.page.dragOver", { label: labelOf(active.id), over: labelOf(over.id) }) : undefined,
    onDragEnd: ({ active }) => t("builder.page.dragEnd", { label: labelOf(active.id) }),
    onDragCancel: ({ active }) => t("builder.page.dragCancel", { label: labelOf(active.id) }),
  };

  const activeIndex = pages.findIndex((p) => p.id === (activePageId ?? null));
  const activePage = activeIndex >= 0 ? pages[activeIndex] : null;
  const activeSection = sections.find((s) => s.id === activePage?.id) ?? null;

  return (
    <Card>
      <CardContent className="grid gap-3 py-4">
        <div className="flex items-center gap-2">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
            accessibility={{
              announcements,
              screenReaderInstructions: { draggable: t("builder.page.dragInstructions") },
            }}
          >
            <SortableContext
              items={pages.map((p) => p.sortId)}
              strategy={horizontalListSortingStrategy}
            >
              <div className="flex min-w-0 items-center gap-1 overflow-x-auto">
                {pages.map((page) => (
                  <PageChip
                    key={page.sortId}
                    id={page.sortId}
                    label={page.label}
                    active={(page.id ?? null) === (activePageId ?? null)}
                    onSelect={() => setActivePageId(page.id)}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="ml-1 shrink-0 rounded-full"
            aria-label={t("builder.page.add")}
            onClick={addPage}
          >
            <Plus className="size-4" />
          </Button>
        </div>

        <p className="text-xs text-muted-foreground">
          {t("builder.page.help")}
        </p>

        {activePage && (
          <div className="grid gap-2 rounded-lg border p-3">
            <div className="flex items-center gap-1">
              <span className="text-xs font-medium text-muted-foreground">
                {t("builder.page.settings", { n: String(activeIndex + 1) })}
              </span>
              <div className="ml-auto flex items-center gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={t("builder.page.moveLeft")}
                  disabled={activeIndex === 0}
                  onClick={() => reorderSections(activePage.sortId, pages[activeIndex - 1].sortId)}
                >
                  <ChevronLeft className="size-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={t("builder.page.moveRight")}
                  disabled={activeIndex === pages.length - 1}
                  onClick={() => reorderSections(activePage.sortId, pages[activeIndex + 1].sortId)}
                >
                  <ChevronRight className="size-4" />
                </Button>
                {activeSection && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={t("builder.page.delete")}
                    className="text-muted-foreground hover:text-destructive"
                    onClick={() => removeSection(activeSection.id)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                )}
              </div>
            </div>
            {activeSection ? (
              <>
                <CollabTextInput
                  sectionId={activeSection.id}
                  field="title"
                  value={activeSection.title ?? ""}
                  onChange={(v) => updateSection(activeSection.id, { title: v })}
                  placeholder={t("builder.page.titlePlaceholder")}
                />
                <CollabTextInput
                  sectionId={activeSection.id}
                  field="description"
                  value={activeSection.description ?? ""}
                  onChange={(v) => updateSection(activeSection.id, { description: v })}
                  placeholder={t("builder.page.descPlaceholder")}
                />
              </>
            ) : (
              <>
                <Input
                  value={survey.settings.firstPageTitle ?? ""}
                  onChange={(e) => updateSettings({ firstPageTitle: e.target.value })}
                  placeholder={t("builder.page.titlePlaceholder")}
                />
                <Input
                  value={survey.settings.firstPageDescription ?? ""}
                  onChange={(e) => updateSettings({ firstPageDescription: e.target.value })}
                  placeholder={t("builder.page.descPlaceholder")}
                />
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
