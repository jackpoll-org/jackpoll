"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { ChevronRight, Folder as FolderIcon } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/app/components/ui/collapsible";
import {
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/app/components/ui/sidebar";
import { useFolders, useSurveys } from "@/app/hooks/survey";
import { useTranslation } from "@/app/i18n/context";

/**
 * Sidebar folders (issue #94): each folder expands inline (like a file
 * explorer) to reveal its surveys, and the folder name deep-links to the
 * dashboard with that folder opened (`/surveys?folder=<id>`).
 */
export function SidebarFolders() {
  const { t } = useTranslation();
  const pathname = usePathname();
  const params = useSearchParams();
  const folders = useFolders().data ?? [];
  const surveys = useSurveys().data?.surveys ?? [];

  if (folders.length === 0) return null;

  const activeFolder = params.get("folder");

  return (
    <>
      {folders.map((folder) => {
        const items = surveys.filter((s) => (s.folderId ?? null) === folder.id);
        const isActive = pathname === "/surveys" && activeFolder === folder.id;
        return (
          <Collapsible
            asChild
            key={folder.id}
            className="group/folder"
          >
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                isActive={isActive}
                tooltip={folder.name}
              >
                <Link href={`/surveys?folder=${folder.id}`}>
                  <FolderIcon />
                  <span>{folder.name}</span>
                </Link>
              </SidebarMenuButton>
              <CollapsibleTrigger asChild>
                <SidebarMenuAction
                  aria-label={folder.name}
                  className="transition-transform data-[state=open]:rotate-90"
                >
                  <ChevronRight />
                </SidebarMenuAction>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <SidebarMenuSub>
                  {items.length === 0 ? (
                    <SidebarMenuSubItem>
                      <span className="px-2 py-1 text-xs text-muted-foreground">
                        {t("dashboard.folder.emptyFolder")}
                      </span>
                    </SidebarMenuSubItem>
                  ) : (
                    items.map((survey) => (
                      <SidebarMenuSubItem key={survey.id}>
                        <SidebarMenuSubButton
                          asChild
                          isActive={pathname.startsWith(`/surveys/${survey.id}`)}
                        >
                          <Link href={`/surveys/${survey.id}/edit`}>
                            <span>{survey.title || t("player.untitledSurvey")}</span>
                          </Link>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                    ))
                  )}
                </SidebarMenuSub>
              </CollapsibleContent>
            </SidebarMenuItem>
          </Collapsible>
        );
      })}
    </>
  );
}
