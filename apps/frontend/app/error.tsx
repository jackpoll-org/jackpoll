"use client";

import { useEffect } from "react";
import { Button } from "@/app/components/ui/button";
import { useTranslation } from "@/app/i18n/context";

export default function ErrorPage({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  const { t } = useTranslation();

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-xl font-semibold">{t("error.title")}</h1>
      <p className="max-w-sm text-sm text-muted-foreground">{t("error.body")}</p>
      <Button onClick={() => retry()}>{t("error.retry")}</Button>
    </div>
  );
}
