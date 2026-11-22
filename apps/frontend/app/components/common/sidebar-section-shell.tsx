"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useDroppable } from "@dnd-kit/core";
import { ChevronRight, MoreHorizontal } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/app/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/app/components/ui/dropdown-menu";
import {
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
} from "@/app/components/ui/sidebar";
import { useTranslation } from "@/app/i18n/context";
import { cn } from "@/lib/utils";
import { isOpen, withOpen, type SidebarTreePrefs } from "@/app/lib/survey/sidebar-tree";

const BUTTON_PADDING = "group-has-data-[sidebar=menu-action]/menu-item:pr-14";

interface SidebarSectionShellProps {
  id: string;
  title: string;
  icon: ReactNode;
  href?: string;
  isActive?: boolean;
  defaultOpen: boolean;
  prefs: SidebarTreePrefs;
  onPrefsChange: (prefs: SidebarTreePrefs) => void;
  menu?: ReactNode;
  className?: string;
  dropId?: string;
  children: ReactNode;
}

export function SidebarSectionShell({
  id,
  title,
  icon,
  href,
  isActive = false,
  defaultOpen,
  prefs,
  onPrefsChange,
  menu,
  className,
  dropId,
  children,
}: SidebarSectionShellProps) {
  const { t } = useTranslation();
  const { setNodeRef, isOver } = useDroppable({ id: dropId ?? `section:${id}`, disabled: !dropId });
  const label = (
    <>
      {icon}
      <span>{title}</span>
    </>
  );

  return (
    <Collapsible
      asChild
      open={isOpen(prefs, id, defaultOpen)}
      onOpenChange={(open) => onPrefsChange(withOpen(prefs, id, open))}
      className="group/collapsible"
    >
      <SidebarMenuItem className={className}>
        {href ? (
          <SidebarMenuButton
            ref={setNodeRef}
            asChild
            isActive={isActive}
            tooltip={title}
            data-drop-over={isOver || undefined}
            className={cn(BUTTON_PADDING, isOver && "bg-sidebar-accent ring-2 ring-sidebar-ring")}
          >
            <Link href={href}>{label}</Link>
          </SidebarMenuButton>
        ) : (
          <CollapsibleTrigger asChild>
            <SidebarMenuButton tooltip={title} className={BUTTON_PADDING}>
              {label}
            </SidebarMenuButton>
          </CollapsibleTrigger>
        )}
        {menu && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <SidebarMenuAction
                className="right-7 hover:opacity-100 focus-visible:opacity-100 peer-hover/menu-button:opacity-100 data-[state=open]:opacity-100 md:opacity-0"
                aria-label={t("nav.sidebar.menu", { name: title })}
              >
                <MoreHorizontal />
              </SidebarMenuAction>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="right" align="start">
              {menu}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        <CollapsibleTrigger asChild>
          <SidebarMenuAction
            aria-label={t("nav.sidebar.toggle", { name: title })}
            className="transition-transform data-[state=open]:rotate-90"
          >
            <ChevronRight />
          </SidebarMenuAction>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <SidebarMenuSub>{children}</SidebarMenuSub>
        </CollapsibleContent>
      </SidebarMenuItem>
    </Collapsible>
  );
}
