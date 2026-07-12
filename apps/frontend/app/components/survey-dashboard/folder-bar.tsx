"use client";

import { useDroppable } from "@dnd-kit/core";
import { ChevronLeft, Folder as FolderIcon, MoreVertical, Plus } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/app/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/app/components/ui/dropdown-menu";
import {
  useCreateFolder,
  useDeleteFolder,
  useRenameFolder,
} from "@/app/hooks/survey";
import { folderDropId, ALL_DROP_ID } from "@/app/lib/survey/folder-dnd";
import { useTranslation } from "@/app/i18n/context";
import type { Folder, Survey } from "@/app/types/survey";
import { useState } from "react";
import { FolderNameDialog } from "./folder-name-dialog";

interface FolderBarProps {
  folders: Folder[];
  surveys: Survey[];
  /** Currently opened folder id, or null for the root view. */
  openFolderId: string | null;
  onOpen: (folderId: string | null) => void;
}

/**
 * Visual folder browser for the dashboard (issue #94). Shows folder tiles that
 * double as drop targets (a survey card dropped on a tile moves into it), a
 * breadcrumb while a folder is open, and create/rename/delete actions. Survey
 * counts are derived from the already-fetched list — no extra request.
 */
export function FolderBar({ folders, surveys, openFolderId, onOpen }: FolderBarProps) {
  const { t } = useTranslation();
  const createFolder = useCreateFolder();
  const renameFolder = useRenameFolder();
  const deleteFolder = useDeleteFolder();
  const [dialog, setDialog] = useState<{ mode: "create" | "rename"; folder?: Folder } | null>(null);

  const counts = new Map<string, number>();
  for (const s of surveys) {
    if (s.folderId) counts.set(s.folderId, (counts.get(s.folderId) ?? 0) + 1);
  }

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
      if (openFolderId === folder.id) onOpen(null);
      toast.success(t("dashboard.folder.deleted"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("dashboard.folder.deleteFailed"));
    }
  }

  const dialogEl = (
    <FolderNameDialog
      open={!!dialog}
      onOpenChange={(o) => !o && setDialog(null)}
      title={dialog?.mode === "rename" ? t("dashboard.folder.rename") : t("dashboard.folder.new")}
      submitLabel={dialog?.mode === "rename" ? t("dashboard.folder.rename") : t("common.add")}
      initialName={dialog?.folder?.name ?? ""}
      pending={createFolder.isPending || renameFolder.isPending}
      onSubmit={submitDialog}
    />
  );

  const openFolder = folders.find((f) => f.id === openFolderId) ?? null;

  // Inside a folder: a breadcrumb whose root crumb is also a drop target so a
  // card can be dragged out of the folder (back to unfiled).
  if (openFolder) {
    return (
      <>
      {dialogEl}
      <div className="flex items-center gap-2">
        <BreadcrumbRoot label={t("dashboard.folder.root")} onClick={() => onOpen(null)} />
        <span className="text-muted-foreground">/</span>
        <span className="flex items-center gap-1.5 text-sm font-medium">
          <FolderIcon className="size-4" />
          {openFolder.name}
        </span>
        <div className="ml-auto flex items-center gap-1">
          <FolderMenu
            label={t("dashboard.folder.menu")}
            renameLabel={t("dashboard.folder.rename")}
            deleteLabel={t("dashboard.folder.delete")}
            onRename={() => handleRename(openFolder)}
            onDelete={() => handleDelete(openFolder)}
          />
          <Button variant="ghost" size="sm" onClick={() => onOpen(null)}>
            <ChevronLeft className="size-4" />
            {t("dashboard.folder.back")}
          </Button>
        </div>
      </div>
      </>
    );
  }

  // Root view: folder tiles + a "New folder" tile.
  return (
    <>
    {dialogEl}
    <div className="flex flex-wrap items-stretch gap-3">
      {folders.map((folder) => (
        <FolderTile
          key={folder.id}
          folder={folder}
          count={counts.get(folder.id) ?? 0}
          openLabel={t("dashboard.folder.open", { name: folder.name })}
          menu={
            <FolderMenu
              label={t("dashboard.folder.menu")}
              renameLabel={t("dashboard.folder.rename")}
              deleteLabel={t("dashboard.folder.delete")}
              onRename={() => handleRename(folder)}
              onDelete={() => handleDelete(folder)}
            />
          }
          onOpen={() => onOpen(folder.id)}
        />
      ))}

      <Button
        variant="outline"
        className="h-auto min-h-[4.5rem] flex-col gap-1 border-dashed px-4 text-muted-foreground"
        onClick={handleCreate}
      >
        <Plus className="size-5" />
        <span className="text-xs">{t("dashboard.folder.new")}</span>
      </Button>
    </div>
    </>
  );
}

/** The "All surveys" breadcrumb crumb — also a drop target to unfile a card. */
function BreadcrumbRoot({ label, onClick }: { label: string; onClick: () => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: ALL_DROP_ID });
  return (
    <button
      ref={setNodeRef}
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-md px-2 py-1 text-sm text-muted-foreground transition-colors hover:text-foreground",
        isOver && "bg-primary/10 text-foreground ring-1 ring-primary",
      )}
    >
      {label}
    </button>
  );
}

function FolderTile({
  folder,
  count,
  openLabel,
  menu,
  onOpen,
}: {
  folder: Folder;
  count: number;
  openLabel: string;
  menu: React.ReactNode;
  onOpen: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: folderDropId(folder.id) });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "relative flex w-40 flex-col rounded-xl border bg-card p-3 transition-colors",
        isOver
          ? "border-primary ring-2 ring-primary/40"
          : "hover:border-primary/50",
      )}
    >
      <button
        type="button"
        aria-label={openLabel}
        onClick={onOpen}
        className="flex items-start gap-2 text-left"
      >
        <FolderIcon className="size-5 shrink-0 text-muted-foreground" />
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium">{folder.name}</span>
          <span className="text-xs text-muted-foreground tabular-nums">{count}</span>
        </span>
      </button>
      <div className="absolute right-1 top-1">{menu}</div>
    </div>
  );
}

function FolderMenu({
  label,
  renameLabel,
  deleteLabel,
  onRename,
  onDelete,
}: {
  label: string;
  renameLabel: string;
  deleteLabel: string;
  onRename: () => void;
  onDelete: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={label}
          className="size-7 text-muted-foreground hover:text-foreground"
        >
          <MoreVertical className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={onRename}>{renameLabel}</DropdownMenuItem>
        <DropdownMenuItem
          onSelect={onDelete}
          className="text-destructive focus:text-destructive"
        >
          {deleteLabel}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
