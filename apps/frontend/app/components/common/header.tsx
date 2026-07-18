"use client";

import Link from "next/link";
import { UserMenu } from "@/app/components/auth/user-menu";
import { NotificationBell } from "@/app/components/common/notification-bell";
import { ThemeCustomizerPanel } from "@/app/components/common/theme-panel";
import { useTranslation } from "@/app/i18n/context";

export function Header() {
  const { t } = useTranslation();
  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 pt-[env(safe-area-inset-top)] backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-14 items-center justify-between px-4">
        <Link
          href="/"
          data-brand-logo
          className="flex items-center gap-2 font-semibold text-lg"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icons/icon.svg" alt="" className="size-7 rounded-md" />
          {t("nav.brand")}
        </Link>
        <div className="flex items-center gap-2">
          <NotificationBell />
          <ThemeCustomizerPanel />
          <UserMenu />
        </div>
      </div>
    </header>
  );
}

