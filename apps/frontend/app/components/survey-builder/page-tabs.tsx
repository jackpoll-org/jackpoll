"use client";

import { ChevronLeft, ChevronRight, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { newId } from "@/app/components/question-types/helpers";
import { useBuilder } from "./builder-context";
import { CollabTextInput } from "./collab-text-input";
import { useTranslation } from "@/app/i18n/context";

/**
 * Page strip for the builder (issue #88). Pages are the renamed "sections":
 * Page 1 is the implicit ungrouped bucket (sectionId === null); each section is
 * Page 2, 3, … in order — matching how the player paginates in buildPages().
 * Clicking a chip selects the active page; questions and "Add question" target
 * it. The `+` button appends a new page and selects it.
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
    moveSection,
    updateSettings,
  } = useBuilder();
  const sections = survey.sections ?? [];

  const pages: { id: string | null; label: string }[] = [
    {
      id: null,
      // Page 1 is the implicit bucket; its heading lives in settings (#94).
      label:
        survey.settings.firstPageTitle?.trim() ||
        t("builder.page.numbered", { n: "1" }),
    },
    ...sections.map((s, i) => ({
      id: s.id,
      label: s.title?.trim() || t("builder.page.numbered", { n: String(i + 2) }),
    })),
  ];

  function addPage() {
    const id = newId();
    addSection(id);
    setActivePageId(id);
  }

  function deletePage(id: string) {
    removeSection(id);
    setActivePageId(null);
  }

  const activeIndex = sections.findIndex((s) => s.id === activePageId);
  const activeSection = activeIndex >= 0 ? sections[activeIndex] : null;

  return (
    <Card>
      <CardContent className="grid gap-3 py-4">
        <div className="flex items-center gap-2">
          <div className="flex min-w-0 items-center gap-1 overflow-x-auto">
            {pages.map((page) => (
              <button
                key={page.id ?? "__page1__"}
                type="button"
                onClick={() => setActivePageId(page.id)}
                className={cn(
                  "shrink-0 rounded-full border px-3 py-1.5 text-sm transition-colors",
                  (page.id ?? null) === (activePageId ?? null)
                    ? "border-primary bg-primary text-primary-foreground"
                    : "bg-background text-muted-foreground hover:bg-muted",
                )}
              >
                {page.label}
              </button>
            ))}
          </div>
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

        {activePageId == null && (
          <div className="grid gap-2 rounded-lg border p-3">
            <span className="text-xs font-medium text-muted-foreground">
              {t("builder.page.settings", { n: "1" })}
            </span>
            <Input
              value={survey.settings.firstPageTitle ?? ""}
              onChange={(e) => updateSettings({ firstPageTitle: e.target.value })}
              placeholder={t("builder.page.titlePlaceholder")}
            />
            <Input
              value={survey.settings.firstPageDescription ?? ""}
              onChange={(e) =>
                updateSettings({ firstPageDescription: e.target.value })
              }
              placeholder={t("builder.page.descPlaceholder")}
            />
          </div>
        )}

        {activeSection && (
          <div className="grid gap-2 rounded-lg border p-3">
            <div className="flex items-center gap-1">
              <span className="text-xs font-medium text-muted-foreground">
                {t("builder.page.settings", { n: String(activeIndex + 2) })}
              </span>
              <div className="ml-auto flex items-center gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={t("builder.page.moveLeft")}
                  disabled={activeIndex === 0}
                  onClick={() => moveSection(activeSection.id, "up")}
                >
                  <ChevronLeft className="size-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={t("builder.page.moveRight")}
                  disabled={activeIndex === sections.length - 1}
                  onClick={() => moveSection(activeSection.id, "down")}
                >
                  <ChevronRight className="size-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={t("builder.page.delete")}
                  className="text-muted-foreground hover:text-destructive"
                  onClick={() => deletePage(activeSection.id)}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </div>
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
              onChange={(v) =>
                updateSection(activeSection.id, { description: v })
              }
              placeholder={t("builder.page.descPlaceholder")}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
