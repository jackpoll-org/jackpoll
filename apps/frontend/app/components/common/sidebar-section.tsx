"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/app/components/ui/collapsible";
import {
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
} from "@/app/components/ui/dropdown-menu";
import {
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/app/components/ui/sidebar";
import { Skeleton } from "@/app/components/ui/skeleton";
import { SidebarSectionShell } from "@/app/components/common/sidebar-section-shell";
import { useTranslation } from "@/app/i18n/context";
import {
  SIDEBAR_GROUP_LIMIT,
  SIDEBAR_STATUSES,
  countSurveys,
  groupKey,
  isOpen,
  withHiddenToggled,
  withOpen,
  type SidebarTreePrefs,
  type StatusGroups,
} from "@/app/lib/survey/sidebar-tree";
import type { SurveyStatus } from "@/app/types/survey";

interface SidebarSectionProps {
  id: string;
  title: string;
  href: string;
  icon: ReactNode;
  isActive: boolean;
  groups: StatusGroups | undefined;
  showAllHref?: (status: SurveyStatus) => string;
  isLoading?: boolean;
  emptyLabel: string;
  defaultOpen: boolean;
  prefs: SidebarTreePrefs;
  onPrefsChange: (prefs: SidebarTreePrefs) => void;
  menu?: ReactNode;
}

export function SidebarSection({
  id,
  title,
  href,
  icon,
  isActive,
  groups,
  showAllHref,
  isLoading = false,
  emptyLabel,
  defaultOpen,
  prefs,
  onPrefsChange,
  menu,
}: SidebarSectionProps) {
  const { t } = useTranslation();
  const pathname = usePathname();
  const total = countSurveys(groups);
  const visible = SIDEBAR_STATUSES.flatMap((status) => {
    const items = groups?.[status] ?? [];
    return items.length > 0 && !prefs.hiddenGroups.includes(groupKey(id, status))
      ? [{ status, items }]
      : [];
  });

  return (
    <SidebarSectionShell
      id={id}
      title={title}
      icon={icon}
      href={href}
      isActive={isActive}
      defaultOpen={defaultOpen}
      prefs={prefs}
      onPrefsChange={onPrefsChange}
      menu={
        <>
          {menu}
          <DropdownMenuLabel>{t("nav.sidebar.showGroups")}</DropdownMenuLabel>
          {SIDEBAR_STATUSES.map((status) => (
            <DropdownMenuCheckboxItem
              key={status}
              checked={!prefs.hiddenGroups.includes(groupKey(id, status))}
              onCheckedChange={() =>
                onPrefsChange(withHiddenToggled(prefs, "hiddenGroups", groupKey(id, status)))
              }
            >
              {t(`dashboard.status.${status}`)}
            </DropdownMenuCheckboxItem>
          ))}
        </>
      }
    >
      {isLoading ? (
        Array.from({ length: 3 }).map((_, i) => (
          <SidebarMenuSubItem key={i}>
            <Skeleton className="mx-2 my-1 h-4 w-24" />
          </SidebarMenuSubItem>
        ))
      ) : total === 0 || visible.length === 0 ? (
        <SidebarMenuSubItem>
          <span className="px-2 py-1 text-xs text-muted-foreground">
            {total === 0 ? emptyLabel : t("nav.sidebar.allGroupsHidden")}
          </span>
        </SidebarMenuSubItem>
      ) : (
        visible.map(({ status, items }) => {
          const key = groupKey(id, status);
          const label = t(`dashboard.status.${status}`);
          return (
            <Collapsible
              asChild
              key={status}
              open={isOpen(prefs, key, true)}
              onOpenChange={(open) => onPrefsChange(withOpen(prefs, key, open))}
              className="group/status"
            >
              <SidebarMenuSubItem>
                <CollapsibleTrigger asChild>
                  <SidebarMenuSubButton asChild size="sm">
                    <button type="button" className="w-full text-muted-foreground">
                      <ChevronRight className="transition-transform group-data-[state=open]/status:rotate-90" />
                      <span className="flex-1 text-left">{label}</span>
                      <span>{items.length}</span>
                    </button>
                  </SidebarMenuSubButton>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <SidebarMenuSub>
                    {items.slice(0, SIDEBAR_GROUP_LIMIT).map((survey) => (
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
                    ))}
                    {showAllHref && items.length > SIDEBAR_GROUP_LIMIT && (
                      <SidebarMenuSubItem>
                        <SidebarMenuSubButton asChild size="sm">
                          <Link
                            href={showAllHref(status)}
                            className="text-muted-foreground"
                          >
                            <span>{t("nav.sidebar.showAll", { count: items.length })}</span>
                          </Link>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                    )}
                  </SidebarMenuSub>
                </CollapsibleContent>
              </SidebarMenuSubItem>
            </Collapsible>
          );
        })
      )}
    </SidebarSectionShell>
  );
}
