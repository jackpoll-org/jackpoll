"use client";

import { useMemo, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { FileText, Folder as FolderIcon, Users } from "lucide-react";
import {
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/app/components/ui/dropdown-menu";
import { SidebarMenuItem, SidebarMenuSkeleton } from "@/app/components/ui/sidebar";
import { FolderNameDialog } from "@/app/components/survey-dashboard/folder-name-dialog";
import { SidebarSection } from "@/app/components/common/sidebar-section";
import { useAuthContext } from "@/app/components/auth/auth-provider";
import { useFolders, useSurveys } from "@/app/hooks/survey";
import { useFolderDialog } from "@/app/hooks/use-folder-dialog";
import { useTranslation } from "@/app/i18n/context";
import { useSidebarLabel, useSidebarTree } from "@/app/lib/preferences/ui-prefs";
import {
  MINE_SECTION,
  SHARED_SECTION,
  buildSidebarTree,
  countSurveys,
  prunePrefs,
  showAllHref,
  withHiddenToggled,
  type SidebarTreePrefs,
} from "@/app/lib/survey/sidebar-tree";

export function SidebarSurveys() {
  const { t } = useTranslation();
  const pathname = usePathname();
  const params = useSearchParams();
  const { user } = useAuthContext();
  const { data, isLoading } = useSurveys();
  const foldersQuery = useFolders();
  const folders = useMemo(() => foldersQuery.data ?? [], [foldersQuery.data]);
  const folderDialog = useFolderDialog();
  const [prefs, setPrefs, prefsReady] = useSidebarTree();
  const [label, setLabel, labelReady] = useSidebarLabel();
  const [labelDialogOpen, setLabelDialogOpen] = useState(false);

  const foldersFailed = foldersQuery.isError;
  const tree = useMemo(() => {
    const surveys = data?.surveys ?? [];
    const placeable = foldersFailed ? surveys.filter((s) => !s.folderId || s.ownerId !== user?.id) : surveys;
    return buildSidebarTree(placeable, folders, user?.id);
  }, [data?.surveys, folders, user?.id, foldersFailed]);

  if (!prefsReady || !labelReady || foldersQuery.isLoading) {
    return (
      <SidebarMenuItem>
        <SidebarMenuSkeleton showIcon />
      </SidebarMenuItem>
    );
  }

  const savePrefs = (next: SidebarTreePrefs) =>
    setPrefs(foldersQuery.data ? prunePrefs(next, foldersQuery.data) : next);
  const onDashboard = pathname === "/surveys";
  const activeFolder = params.get("folder");
  const defaultTitle = t("nav.mySurveys");
  const hiddenFolders = folders.filter((f) => prefs.hiddenFolders.includes(f.id));
  const sharedGroups = tree.get(SHARED_SECTION);

  function submitLabel(name: string) {
    setLabel(name === defaultTitle ? "" : name);
    setLabelDialogOpen(false);
  }

  return (
    <>
      <SidebarSection
        id={MINE_SECTION}
        title={label || defaultTitle}
        href="/surveys"
        icon={<FileText />}
        isActive={onDashboard && !activeFolder}
        groups={tree.get(MINE_SECTION)}
        showAllHref={(status) => showAllHref(null, status)}
        isLoading={isLoading}
        emptyLabel={t("nav.surveysEmpty")}
        defaultOpen
        prefs={prefs}
        onPrefsChange={savePrefs}
        menu={
          <>
            <DropdownMenuItem onSelect={folderDialog.openCreate}>
              {t("dashboard.folder.new")}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setLabelDialogOpen(true)}>
              {t("nav.sidebar.renameLabel")}
            </DropdownMenuItem>
            {label && (
              <DropdownMenuItem onSelect={() => setLabel("")}>
                {t("nav.sidebar.resetLabel")}
              </DropdownMenuItem>
            )}
            {hiddenFolders.map((folder) => (
              <DropdownMenuItem
                key={folder.id}
                onSelect={() => savePrefs(withHiddenToggled(prefs, "hiddenFolders", folder.id))}
              >
                {t("nav.sidebar.showFolder", { name: folder.name })}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
          </>
        }
      />
      {folders
        .filter((folder) => !prefs.hiddenFolders.includes(folder.id))
        .map((folder) => (
          <SidebarSection
            key={folder.id}
            id={folder.id}
            title={folder.name}
            href={`/surveys?folder=${encodeURIComponent(folder.id)}`}
            icon={<FolderIcon />}
            isActive={onDashboard && activeFolder === folder.id}
            groups={tree.get(folder.id)}
            showAllHref={(status) => showAllHref(folder.id, status)}
            emptyLabel={t("dashboard.folder.emptyFolder")}
            defaultOpen={false}
            prefs={prefs}
            onPrefsChange={savePrefs}
            menu={
              <>
                <DropdownMenuItem onSelect={() => folderDialog.openRename(folder)}>
                  {t("dashboard.folder.rename")}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() => savePrefs(withHiddenToggled(prefs, "hiddenFolders", folder.id))}
                >
                  {t("nav.sidebar.hideFolder")}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
              </>
            }
          />
        ))}
      {countSurveys(sharedGroups) > 0 && (
        <SidebarSection
          id={SHARED_SECTION}
          title={t("dashboard.shared.title")}
          href="/surveys"
          icon={<Users />}
          isActive={false}
          groups={sharedGroups}
          emptyLabel=""
          defaultOpen={false}
          prefs={prefs}
          onPrefsChange={savePrefs}
        />
      )}
      <FolderNameDialog {...folderDialog.dialogProps} />
      <FolderNameDialog
        open={labelDialogOpen}
        onOpenChange={setLabelDialogOpen}
        title={t("nav.sidebar.renameLabel")}
        submitLabel={t("nav.sidebar.renameLabel")}
        initialName={label}
        placeholder={defaultTitle}
        allowEmpty
        onSubmit={submitLabel}
      />
    </>
  );
}
