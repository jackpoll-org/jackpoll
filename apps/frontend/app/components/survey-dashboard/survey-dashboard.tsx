"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { FileText, KeyRound, LayoutGrid, List, Search, X } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { SortableContext, rectSortingStrategy } from "@dnd-kit/sortable";
import { toast } from "sonner";
import {
  useFolders,
  useOrganizeSurvey,
  useReorderSurveys,
  useSurveys,
} from "@/app/hooks/survey";
import { useCustomTemplates } from "@/app/hooks/templates";
import { Skeleton } from "@/app/components/ui/skeleton";
import { Input } from "@/app/components/ui/input";
import { Badge } from "@/app/components/ui/badge";
import { Card, CardTitle } from "@/app/components/ui/card";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/app/components/ui/toggle-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/app/components/ui/select";
import { TemplatePickerDialog } from "./template-picker-dialog";
import { SurveyCard } from "./survey-card";
import { FolderBar } from "./folder-bar";
import { FolderExplorer } from "./folder-explorer";
import { SharedSurveysFolder } from "./shared-surveys-folder";
import { InvitationsBanner } from "./invitations-banner";
import { useAuthContext } from "@/app/components/auth/auth-provider";
import { resolveFolderDrop, resolveReorder } from "@/app/lib/survey/folder-dnd";
import { sortSurveys, type SortBy } from "@/app/lib/survey/sort";
import { useTranslation } from "@/app/i18n/context";
import {
  useListDensity,
  useListSort,
  useListView,
} from "@/app/lib/preferences/ui-prefs";

type StatusFilter = "all" | "draft" | "published" | "closed";

export function SurveyDashboard() {
  const { t } = useTranslation();
  const { data, isLoading, isError, error } = useSurveys();
  const allSurveys = data?.surveys ?? [];
  const { user } = useAuthContext();
  const myId = user?.id;
  // Split owned vs. shared-with-me (surveys someone else added me to, #8). The
  // owner's own folder UI only operates on owned surveys; shared ones live in a
  // dedicated "Shared with me" folder.
  const surveys = myId ? allSurveys.filter((s) => s.ownerId === myId) : allSurveys;
  const sharedSurveys = myId
    ? allSurveys.filter((s) => s.ownerId !== myId)
    : [];
  const customTemplates = useCustomTemplates().data ?? [];
  const folders = useFolders().data ?? [];
  const organize = useOrganizeSurvey();
  const reorder = useReorderSurveys();

  const params = useSearchParams();
  const autoCreate = params.get("new") === "1";
  const deepLinkedFolder = params.get("folder");

  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  // Default sort + list density come from the user's Settings (#settings).
  const [sort, setSort] = useListSort();
  const [density] = useListDensity();
  const [view, setView] = useListView();
  const [openFolderId, setOpenFolderId] = useState<string | null>(
    deepLinkedFolder ?? null,
  );
  const [tag, setTag] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);

  // Drag activates from the card's grip handle (survey-card.tsx), so a small
  // move threshold is all that's needed — the card body still scrolls/taps.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  const gridClass =
    density === "compact"
      ? "grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
      : "grid gap-4 sm:grid-cols-2 lg:grid-cols-3";
  const listClass = "grid gap-2";

  const q = query.trim().toLowerCase();
  // Filter by query/status/tag — but NOT folder; the folder split is applied
  // per-view below (drill-in for grid, inline buckets for the explorer).
  const matches = (s: (typeof allSurveys)[number]) => {
    const matchesQuery = q
      ? s.title.toLowerCase().includes(q) ||
        (s.description ?? "").toLowerCase().includes(q)
      : true;
    const matchesStatus = status === "all" ? true : s.status === status;
    const matchesTag = tag ? (s.tags ?? []).includes(tag) : true;
    return matchesQuery && matchesStatus && matchesTag;
  };
  const baseFiltered = surveys.filter(matches);
  const sharedFiltered = sharedSurveys.filter(matches);

  // Grid view shows one folder at a time (root = unfiled). Search spans all.
  const gridFiltered = q
    ? baseFiltered
    : baseFiltered.filter((s) => (s.folderId ?? null) === openFolderId);
  const sorted = sortSurveys(gridFiltered, sort as SortBy);

  // Explorer renders folders + their surveys itself; while searching we fall
  // back to a flat sorted list (results span every folder).
  const useExplorer = view === "list" && !q;

  async function handleDragEnd(event: DragEndEvent) {
    setDraggingId(null);
    const activeId = String(event.active.id);
    const overId = event.over ? String(event.over.id) : null;
    if (!overId) return;

    // 1) Dropped onto a folder / All / Unfiled target → move between folders.
    const move = resolveFolderDrop(activeId, overId, surveys);
    if (move) {
      try {
        await organize.mutateAsync({
          id: move.id,
          tags: move.tags,
          folderId: move.folderId,
        });
        if (move.folderId) {
          const name = folders.find((f) => f.id === move.folderId)?.name ?? "";
          toast.success(t("dashboard.folder.moved", { folder: name }));
        } else {
          toast.success(t("dashboard.folder.movedUnfiled"));
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : t("dashboard.folder.moveFailed"));
      }
      return;
    }

    // 2) Dropped onto another card → reorder within that folder bucket. Skip
    //    while searching (the list isn't a single folder then).
    if (q) return;
    const active = surveys.find((s) => s.id === activeId);
    if (!active) return;
    const scopeIds = sortSurveys(
      baseFiltered.filter((s) => (s.folderId ?? null) === (active.folderId ?? null)),
      sort as SortBy,
    ).map((s) => s.id);
    const result = resolveReorder(activeId, overId, surveys, scopeIds);
    if (!result) return;
    // Dragging to reorder implies a manual order — switch to it so the new
    // arrangement is what the user sees (and keeps seeing).
    if (sort !== "manual") setSort("manual");
    reorder.mutate(result);
  }

  const draggingSurvey = draggingId
    ? surveys.find((s) => s.id === draggingId)
    : null;

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {t("dashboard.title")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t("dashboard.subtitle")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline">
            <Link href="/join">
              <KeyRound className="size-4" />
              {t("dashboard.joinByCode")}
            </Link>
          </Button>
          <TemplatePickerDialog autoOpen={autoCreate} customTemplates={customTemplates} />
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-48 flex-1">
          <Search className="absolute left-2 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("dashboard.searchPlaceholder")}
            className="pl-8"
          />
        </div>

        <Select value={status} onValueChange={(v) => setStatus(v as StatusFilter)}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("dashboard.status.all")}</SelectItem>
            <SelectItem value="draft">{t("dashboard.status.draft")}</SelectItem>
            <SelectItem value="published">{t("dashboard.status.published")}</SelectItem>
            <SelectItem value="closed">{t("dashboard.status.closed")}</SelectItem>
          </SelectContent>
        </Select>

        <Select value={sort} onValueChange={(v) => setSort(v as SortBy)}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="manual">{t("dashboard.sort.manual")}</SelectItem>
            <SelectItem value="updated">{t("dashboard.sort.updated")}</SelectItem>
            <SelectItem value="created">{t("dashboard.sort.created")}</SelectItem>
            <SelectItem value="title">{t("dashboard.sort.title")}</SelectItem>
          </SelectContent>
        </Select>

        <ToggleGroup
          type="single"
          value={view}
          onValueChange={(v) => v && setView(v as "grid" | "list")}
          variant="outline"
        >
          <ToggleGroupItem value="grid" aria-label={t("dashboard.view.grid")}>
            <LayoutGrid className="size-4" />
          </ToggleGroupItem>
          <ToggleGroupItem value="list" aria-label={t("dashboard.view.list")}>
            <List className="size-4" />
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      {tag && (
        <div className="mb-4 flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">{t("dashboard.tagFilter")}</span>
          <Badge variant="secondary" className="gap-1">
            {tag}
            <button type="button" aria-label="Clear tag filter" onClick={() => setTag(null)}>
              <X className="size-3" />
            </button>
          </Badge>
        </div>
      )}

      <InvitationsBanner />

      {isLoading ? (
        <div className={gridClass}>
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-32 w-full rounded-xl" />
          ))}
        </div>
      ) : isError ? (
        <p className="text-sm text-destructive">
          {error instanceof Error ? error.message : t("dashboard.loadFailed")}
        </p>
      ) : allSurveys.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed py-20 text-center">
          <FileText className="size-10 text-muted-foreground" />
          <div>
            <p className="font-medium">{t("dashboard.empty.title")}</p>
            <p className="text-sm text-muted-foreground">
              {t("dashboard.empty.subtitle")}
            </p>
          </div>
          <TemplatePickerDialog customTemplates={customTemplates} />
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          onDragStart={(e: DragStartEvent) => setDraggingId(String(e.active.id))}
          onDragEnd={handleDragEnd}
          onDragCancel={() => setDraggingId(null)}
        >
          <SharedSurveysFolder
            surveys={sharedFiltered}
            view={view}
            sort={sort as SortBy}
            onTagClick={setTag}
          />

          {surveys.length > 0 && (useExplorer ? (
            <FolderExplorer
              folders={folders}
              surveys={baseFiltered}
              sort={sort as SortBy}
              onTagClick={setTag}
              initialExpandedId={openFolderId}
            />
          ) : (
            <>
              {/* Grid view: folder tiles + drill-in (hidden while searching). */}
              {!q && view === "grid" && (
                <div className="mb-4">
                  <FolderBar
                    folders={folders}
                    surveys={surveys}
                    openFolderId={openFolderId}
                    onOpen={setOpenFolderId}
                  />
                </div>
              )}

              {sorted.length === 0 ? (
                <p className="py-12 text-center text-sm text-muted-foreground">
                  {t("dashboard.noMatches")}
                </p>
              ) : (
                <SortableContext
                  items={sorted.map((s) => s.id)}
                  strategy={rectSortingStrategy}
                >
                  <div className={view === "list" ? listClass : gridClass}>
                    {sorted.map((survey) => (
                      <SurveyCard
                        key={survey.id}
                        survey={survey}
                        onTagClick={setTag}
                        view={view}
                      />
                    ))}
                  </div>
                </SortableContext>
              )}
            </>
          ))}

          <DragOverlay>
            {draggingSurvey ? (
              <Card className="w-56 cursor-grabbing border-primary p-3 shadow-lg">
                <CardTitle className="truncate text-sm">
                  {draggingSurvey.title}
                </CardTitle>
              </Card>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}
    </div>
  );
}
