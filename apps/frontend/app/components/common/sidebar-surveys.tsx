"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, FileText } from "lucide-react";
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
import { Skeleton } from "@/app/components/ui/skeleton";
import { useSurveys } from "@/app/hooks/survey";
import { useTranslation } from "@/app/i18n/context";

/**
 * Sidebar "Surveys" entry: the label links to the dashboard; a chevron expands a
 * collapsible list of the user's surveys, each opening its builder.
 */
export function SidebarSurveys() {
  const { t } = useTranslation();
  const pathname = usePathname();
  const { data, isLoading } = useSurveys();
  const surveys = data?.surveys ?? [];

  return (
    <Collapsible asChild defaultOpen className="group/collapsible">
      <SidebarMenuItem>
        <SidebarMenuButton
          asChild
          isActive={pathname === "/surveys"}
          tooltip={t("nav.mySurveys")}
        >
          <Link href="/surveys">
            <FileText />
            <span>{t("nav.mySurveys")}</span>
          </Link>
        </SidebarMenuButton>
        <CollapsibleTrigger asChild>
          <SidebarMenuAction
            aria-label={t("nav.mySurveys")}
            className="transition-transform data-[state=open]:rotate-90"
          >
            <ChevronRight />
          </SidebarMenuAction>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <SidebarMenuSub>
            {isLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <SidebarMenuSubItem key={i}>
                  <Skeleton className="mx-2 my-1 h-4 w-24" />
                </SidebarMenuSubItem>
              ))
            ) : surveys.length === 0 ? (
              <SidebarMenuSubItem>
                <span className="px-2 py-1 text-xs text-muted-foreground">
                  {t("nav.surveysEmpty")}
                </span>
              </SidebarMenuSubItem>
            ) : (
              surveys.map((survey) => (
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
}
