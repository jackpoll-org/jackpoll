"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { FileStack, Tags } from "lucide-react";
import { toast } from "sonner";
import { DropdownMenuItem } from "@/app/components/ui/dropdown-menu";
import { SidebarMenuSubButton, SidebarMenuSubItem } from "@/app/components/ui/sidebar";
import { SidebarSectionShell } from "@/app/components/common/sidebar-section-shell";
import { useSurveys } from "@/app/hooks/survey";
import { useCustomTemplates, useStartFromTemplate } from "@/app/hooks/templates";
import { useTranslation } from "@/app/i18n/context";
import {
  TAGS_SECTION,
  TEMPLATES_SECTION,
  countTags,
  type SidebarTreePrefs,
} from "@/app/lib/survey/sidebar-tree";
import type { SurveyTemplate } from "@/app/lib/survey/templates";

const ICON_COLLAPSED_HIDDEN = "group-data-[collapsible=icon]:hidden";

interface SectionProps {
  prefs: SidebarTreePrefs;
  onPrefsChange: (prefs: SidebarTreePrefs) => void;
}

export function SidebarTags({ prefs, onPrefsChange }: SectionProps) {
  const { t } = useTranslation();
  const pathname = usePathname();
  const activeTag = useSearchParams().get("tag");
  const tags = countTags(useSurveys().data?.surveys ?? []);
  if (tags.length === 0) return null;

  return (
    <SidebarSectionShell
      id={TAGS_SECTION}
      title={t("nav.tags")}
      icon={<Tags />}
      defaultOpen={false}
      prefs={prefs}
      onPrefsChange={onPrefsChange}
      className={ICON_COLLAPSED_HIDDEN}
    >
      {tags.map(({ tag, count }) => (
        <SidebarMenuSubItem key={tag}>
          <SidebarMenuSubButton asChild isActive={pathname === "/surveys" && activeTag === tag}>
            <Link href={`/surveys?tag=${encodeURIComponent(tag)}`}>
              <span className="flex-1">{tag}</span>
              <span className="text-muted-foreground">{count}</span>
            </Link>
          </SidebarMenuSubButton>
        </SidebarMenuSubItem>
      ))}
    </SidebarSectionShell>
  );
}

export function SidebarTemplates({ prefs, onPrefsChange }: SectionProps) {
  const { t } = useTranslation();
  const templates = useCustomTemplates().data ?? [];
  const { start, isPending } = useStartFromTemplate();
  if (templates.length === 0) return null;

  async function startFrom(template: SurveyTemplate) {
    try {
      await start(template);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("templates.createFailed"));
    }
  }

  return (
    <SidebarSectionShell
      id={TEMPLATES_SECTION}
      title={t("nav.templates")}
      icon={<FileStack />}
      defaultOpen={false}
      prefs={prefs}
      onPrefsChange={onPrefsChange}
      className={ICON_COLLAPSED_HIDDEN}
      menu={
        <DropdownMenuItem asChild>
          <Link href="/surveys?new=1">{t("nav.sidebar.manageTemplates")}</Link>
        </DropdownMenuItem>
      }
    >
      {templates.map((template) => (
        <SidebarMenuSubItem key={template.id}>
          <SidebarMenuSubButton asChild>
            <button
              type="button"
              disabled={isPending}
              aria-label={t("nav.sidebar.useTemplate", { name: template.name })}
              title={t("nav.sidebar.useTemplate", { name: template.name })}
              onClick={() => startFrom(template)}
              className="w-full disabled:opacity-50"
            >
              <span>{template.name}</span>
            </button>
          </SidebarMenuSubButton>
        </SidebarMenuSubItem>
      ))}
    </SidebarSectionShell>
  );
}
