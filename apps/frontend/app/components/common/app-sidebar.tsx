"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Settings } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/app/components/ui/sidebar";
import { NavUser } from "@/app/components/common/nav-user";
import { SidebarSurveys } from "@/app/components/common/sidebar-surveys";
import { SidebarFolders } from "@/app/components/common/sidebar-folders";
import { useTranslation } from "@/app/i18n/context";

/** Returns true when the current pathname matches (or is nested under) href. */
export function isNavItemActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppSidebar() {
  const pathname = usePathname();
  const { t } = useTranslation();
  const { setOpenMobile } = useSidebar();

  // On mobile, collapse the sidebar after navigating so it doesn't cover the
  // page (#91). On desktop, `openMobile` is unused so this is a no-op there.
  useEffect(() => {
    setOpenMobile(false);
  }, [pathname, setOpenMobile]);

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <Link
          href="/surveys"
          data-brand-logo
          className="flex items-center gap-2 px-2 py-1 font-semibold"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/icons/icon.svg"
            alt=""
            className="size-6 shrink-0 rounded-md"
          />
          <span className="truncate group-data-[collapsible=icon]:hidden">
            {t("nav.brand")}
          </span>
        </Link>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarSurveys />
              <SidebarFolders />
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={isNavItemActive(pathname, "/settings")}
                  tooltip={t("nav.settings")}
                >
                  <Link href="/settings">
                    <Settings />
                    <span>{t("nav.settings")}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        <nav className="flex flex-wrap justify-center gap-x-3 gap-y-1 px-1 text-xs text-muted-foreground group-data-[collapsible=icon]:hidden">
          <Link href="/impressum" className="hover:text-foreground hover:underline">
            {t("legal.imprint")}
          </Link>
          <Link href="/privacy" className="hover:text-foreground hover:underline">
            {t("legal.privacy")}
          </Link>
        </nav>
        <NavUser />
      </SidebarFooter>
    </Sidebar>
  );
}
