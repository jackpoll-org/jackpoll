"use client";

import Link from "next/link";
import { Button } from "@/app/components/ui/button";
import { useTranslation } from "@/app/i18n/context";

export default function NotFound() {
  const { t } = useTranslation();
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="text-6xl font-bold text-primary tabular-nums">404</p>
      <h1 className="text-xl font-semibold">{t("notFound.title")}</h1>
      <p className="max-w-sm text-sm text-muted-foreground">{t("notFound.body")}</p>
      <Button asChild>
        <Link href="/">{t("notFound.home")}</Link>
      </Button>
    </div>
  );
}
