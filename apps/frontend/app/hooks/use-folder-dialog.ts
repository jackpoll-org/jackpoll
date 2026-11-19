"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useCreateFolder, useRenameFolder } from "@/app/hooks/survey";
import { useTranslation } from "@/app/i18n/context";
import type { Folder } from "@/app/types/survey";

type FolderDialogTarget = { mode: "create" } | { mode: "rename"; folder: Folder };

export function useFolderDialog() {
  const { t } = useTranslation();
  const createFolder = useCreateFolder();
  const renameFolder = useRenameFolder();
  const [target, setTarget] = useState<FolderDialogTarget | null>(null);
  const renaming = target?.mode === "rename";

  async function onSubmit(name: string) {
    try {
      if (target?.mode === "rename") {
        if (name === target.folder.name) return setTarget(null);
        await renameFolder.mutateAsync({ id: target.folder.id, name });
        toast.success(t("dashboard.folder.renamed"));
      } else {
        await createFolder.mutateAsync(name);
        toast.success(t("dashboard.folder.created"));
      }
      setTarget(null);
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : t(renaming ? "dashboard.folder.renameFailed" : "dashboard.folder.createFailed"),
      );
    }
  }

  return {
    openCreate: () => setTarget({ mode: "create" }),
    openRename: (folder: Folder) => setTarget({ mode: "rename", folder }),
    dialogProps: {
      open: !!target,
      onOpenChange: (open: boolean) => !open && setTarget(null),
      title: renaming ? t("dashboard.folder.rename") : t("dashboard.folder.new"),
      submitLabel: renaming ? t("dashboard.folder.rename") : t("common.add"),
      initialName: target?.mode === "rename" ? target.folder.name : "",
      pending: createFolder.isPending || renameFolder.isPending,
      onSubmit,
    },
  };
}
