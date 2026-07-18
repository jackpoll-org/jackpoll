"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/app/components/ui/card";
import { useTranslation } from "@/app/i18n/context";

/**
 * Links to the dedicated notification settings page (issue #89). The full
 * event x channel matrix (9 events) no longer fits as an inline card, so this
 * stays a lightweight entry point in the flat settings list.
 */
export function NotificationsLinkCard() {
  const { t } = useTranslation();

  return (
    <Link href="/settings/notifications">
      <Card className="transition-colors hover:border-primary/40">
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="text-base">{t("settings.notify.linkTitle")}</CardTitle>
            <CardDescription>{t("settings.notify.linkDescription")}</CardDescription>
          </div>
          <ChevronRight className="size-4 text-muted-foreground" />
        </CardHeader>
        <CardContent className="sr-only">{t("settings.notify.manage")}</CardContent>
      </Card>
    </Link>
  );
}
