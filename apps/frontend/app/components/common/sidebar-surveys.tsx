"use client";

import { useMemo } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import Link from "next/link";
import { FileText, Folder as FolderIcon, Inbox, Users } from "lucide-react";
import {
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/app/components/ui/dropdown-menu";
import {
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
} from "@/app/components/ui/sidebar";
import { FolderNameDialog } from "@/app/components/survey-dashboard/folder-name-dialog";
import { SidebarSection } from "@/app/components/common/sidebar-section";
import { SidebarTags, SidebarTemplates } from "@/app/components/common/sidebar-tags-templates";
import { useAuthContext } from "@/app/components/auth/auth-provider";
import { useFolders, useSurveys } from "@/app/hooks/survey";
import { useFolderDialog } from "@/app/hooks/use-folder-dialog";
import { useTranslation } from "@/app/i18n/context";
import { useSidebarTree } from "@/app/lib/preferences/ui-prefs";
import {
  ALL_FOLDER,
  MINE_SECTION,
  SHARED_SECTION,
  UNFILED_FOLDER,
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

  const foldersFailed = foldersQuery.isError;
  const tree = useMemo(() => {
    const surveys = data?.surveys ?? [];
    const placeable = foldersFailed ? surveys.filter((s) => !s.folderId || s.ownerId !== user?.id) : surveys;
    return buildSidebarTree(placeable, folders, user?.id);
  }, [data?.surveys, folders, user?.id, foldersFailed]);

  if (!prefsReady || foldersQuery.isLoading) {
    return (
      <SidebarMenuItem>
        <SidebarMenuSkeleton showIcon />
      </SidebarMenuItem>
    );
  }

  const savePrefs = (next: SidebarTreePrefs) =>
    setPrefs(foldersQuery.data ? prunePrefs(next, foldersQuery.data) : next);
  const onDashboard = pathname === "/surveys";
  const activeFolder = params.get("tag") ? null : params.get("folder");
  const hiddenFolders = folders.filter((f) => prefs.hiddenFolders.includes(f.id));
  const sharedGroups = tree.get(SHARED_SECTION);

  return (
    <>
      <SidebarMenuItem>
        <SidebarMenuButton
          asChild
          isActive={onDashboard && activeFolder === ALL_FOLDER}
          tooltip={t("nav.allSurveys")}
        >
          <Link href={`/surveys?folder=${ALL_FOLDER}`}>
            <FileText />
            <span>{t("nav.allSurveys")}</span>
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
      <SidebarSection
        id={MINE_SECTION}
        title={t("nav.unorganized")}
        href={`/surveys?folder=${UNFILED_FOLDER}`}
        icon={<Inbox />}
        isActive={onDashboard && activeFolder === UNFILED_FOLDER}
        groups={tree.get(MINE_SECTION)}
        showAllHref={(status) => showAllHref(UNFILED_FOLDER, status)}
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
      <SidebarTags prefs={prefs} onPrefsChange={savePrefs} />
      <SidebarTemplates prefs={prefs} onPrefsChange={savePrefs} />
      <FolderNameDialog {...folderDialog.dialogProps} />
    </>
  );
}
