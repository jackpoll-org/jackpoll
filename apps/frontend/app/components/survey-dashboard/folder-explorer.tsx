"use client";

import { useState } from "react";
import { FolderNameDialog } from "./folder-name-dialog";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { ChevronRight, Folder as FolderIcon, FolderOpen, Plus } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/app/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/app/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/app/components/ui/dropdown-menu";
import { MoreVertical } from "lucide-react";
import {
  useCreateFolder,
  useDeleteFolder,
  useRenameFolder,
} from "@/app/hooks/survey";
import {
  folderDropId,
  UNFILED_DROP_ID,
} from "@/app/lib/survey/folder-dnd";
import { sortSurveys, type SortBy } from "@/app/lib/survey/sort";
import { useTranslation } from "@/app/i18n/context";
import type { Folder, Survey } from "@/app/types/survey";
import { SurveyCard } from "./survey-card";

interface FolderExplorerProps {
  folders: Folder[];
  /** Already filtered by query/status/tag, but NOT by folder. */
  surveys: Survey[];
  sort: SortBy;
  onTagClick: (tag: string) => void;
  /** Folder to auto-expand on mount (e.g. from a sidebar deep-link). */
  initialExpandedId?: string | null;
}

/**
 * Explorer-style folder browser for the dashboard list view (issue #94):
 * folders unfold inline (like the sidebar / a file manager) to reveal their
 * surveys, instead of the grid view's drill-in tiles. Folder rows are drop
 * targets (drag a survey onto one to move it) and each unfolded list is
 * sortable so surveys can be reordered within their folder.
 */
export function FolderExplorer({
  folders,
  surveys,
  sort,
  onTagClick,
  initialExpandedId,
}: FolderExplorerProps) {
  const { t } = useTranslation();
  const createFolder = useCreateFolder();
  const renameFolder = useRenameFolder();
  const deleteFolder = useDeleteFolder();
  const [dialog, setDialog] = useState<{ mode: "create" | "rename"; folder?: Folder } | null>(null);

  const [expanded, setExpanded] = useState<Set<string>>(
    () => new Set(initialExpandedId ? [initialExpandedId] : []),
  );

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const inFolder = (folderId: string | null) =>
    sortSurveys(
      surveys.filter((s) => (s.folderId ?? null) === folderId),
      sort,
    );

  const rootSurveys = inFolder(null);

  function handleCreate() {
    setDialog({ mode: "create" });
  }

  function handleRename(folder: Folder) {
    setDialog({ mode: "rename", folder });
  }

  async function submitDialog(name: string) {
    try {
      if (dialog?.mode === "rename" && dialog.folder) {
        if (name === dialog.folder.name) return setDialog(null);
        await renameFolder.mutateAsync({ id: dialog.folder.id, name });
        toast.success(t("dashboard.folder.renamed"));
      } else {
        await createFolder.mutateAsync(name);
        toast.success(t("dashboard.folder.created"));
      }
      setDialog(null);
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : t(dialog?.mode === "rename" ? "dashboard.folder.renameFailed" : "dashboard.folder.createFailed"),
      );
    }
  }

  async function handleDelete(folder: Folder) {
    if (!window.confirm(t("dashboard.folder.deleteConfirm"))) return;
    try {
      await deleteFolder.mutateAsync(folder.id);
      toast.success(t("dashboard.folder.deleted"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("dashboard.folder.deleteFailed"));
    }
  }

  return (
    <div className="grid gap-2">
      <FolderNameDialog
        open={!!dialog}
        onOpenChange={(o) => !o && setDialog(null)}
        title={dialog?.mode === "rename" ? t("dashboard.folder.rename") : t("dashboard.folder.new")}
        submitLabel={dialog?.mode === "rename" ? t("dashboard.folder.rename") : t("common.add")}
        initialName={dialog?.folder?.name ?? ""}
        pending={createFolder.isPending || renameFolder.isPending}
        onSubmit={submitDialog}
      />
      {folders.map((folder) => (
        <ExplorerFolderRow
          key={folder.id}
          folder={folder}
          surveys={inFolder(folder.id)}
          open={expanded.has(folder.id)}
          onToggle={() => toggle(folder.id)}
          onRename={() => handleRename(folder)}
          onDelete={() => handleDelete(folder)}
          onTagClick={onTagClick}
        />
      ))}

      <Button
        variant="ghost"
        size="sm"
        className="w-fit gap-1 text-muted-foreground"
        onClick={handleCreate}
      >
        <Plus className="size-4" />
        {t("dashboard.folder.new")}
      </Button>

      <RootSection surveys={rootSurveys} onTagClick={onTagClick} label={t("dashboard.folder.ungrouped")} />
    </div>
  );
}

function ExplorerFolderRow({
  folder,
  surveys,
  open,
  onToggle,
  onRename,
  onDelete,
  onTagClick,
}: {
  folder: Folder;
  surveys: Survey[];
  open: boolean;
  onToggle: () => void;
  onRename: () => void;
  onDelete: () => void;
  onTagClick: (tag: string) => void;
}) {
  const { t } = useTranslation();
  const { setNodeRef, isOver } = useDroppable({ id: folderDropId(folder.id) });

  return (
    <Collapsible open={open} onOpenChange={onToggle}>
      <div
        ref={setNodeRef}
        className={cn(
          "flex items-center gap-1 rounded-md border px-2 py-1.5 transition-colors",
          isOver ? "border-primary ring-2 ring-primary/40" : "hover:border-primary/50",
        )}
      >
        <CollapsibleTrigger className="flex min-w-0 flex-1 items-center gap-2 text-left">
          <ChevronRight
            className={cn(
              "size-4 shrink-0 text-muted-foreground transition-transform",
              open && "rotate-90",
            )}
          />
          {open ? (
            <FolderOpen className="size-4 shrink-0 text-muted-foreground" />
          ) : (
            <FolderIcon className="size-4 shrink-0 text-muted-foreground" />
          )}
          <span className="truncate text-sm font-medium">{folder.name}</span>
          <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
            {surveys.length}
          </span>
        </CollapsibleTrigger>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              aria-label={t("dashboard.folder.menu")}
              className="size-7 shrink-0 text-muted-foreground hover:text-foreground"
            >
              <MoreVertical className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={onRename}>
              {t("dashboard.folder.rename")}
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={onDelete}
              className="text-destructive focus:text-destructive"
            >
              {t("dashboard.folder.delete")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <CollapsibleContent className="py-1 pl-6">
        {surveys.length === 0 ? (
          <p className="px-2 py-1 text-xs text-muted-foreground">
            {t("dashboard.folder.emptyFolder")}
          </p>
        ) : (
          <SortableContext
            items={surveys.map((s) => s.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="grid gap-2">
              {surveys.map((s) => (
                <SurveyCard key={s.id} survey={s} onTagClick={onTagClick} view="list" />
              ))}
            </div>
          </SortableContext>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}

function RootSection({
  surveys,
  onTagClick,
  label,
}: {
  surveys: Survey[];
  onTagClick: (tag: string) => void;
  label: string;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: UNFILED_DROP_ID });
  if (surveys.length === 0) {
    // Still a drop target (to unfile a card) but visually minimal.
    return <div ref={setNodeRef} className={cn(isOver && "rounded-md ring-2 ring-primary/40")} />;
  }
  return (
    <div
      ref={setNodeRef}
      className={cn("rounded-md", isOver && "ring-2 ring-primary/40")}
    >
      <p className="px-2 pb-1 pt-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <SortableContext
        items={surveys.map((s) => s.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="grid gap-2">
          {surveys.map((s) => (
            <SurveyCard key={s.id} survey={s} onTagClick={onTagClick} view="list" />
          ))}
        </div>
      </SortableContext>
    </div>
  );
}
