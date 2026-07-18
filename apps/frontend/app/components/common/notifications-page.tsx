"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { Card, CardContent } from "@/app/components/ui/card";
import { Skeleton } from "@/app/components/ui/skeleton";
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
} from "@/app/hooks/survey";
import { useTranslation } from "@/app/i18n/context";
import { formatRelative } from "@/app/lib/survey/format";
import type { AppNotification } from "@/app/types/survey";

const PAGE_SIZE = 20;

export function NotificationsPage() {
  const { t, locale } = useTranslation();
  const router = useRouter();
  const [page, setPage] = useState(0);

  const notifications = useNotifications(page, PAGE_SIZE);
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

  const items = notifications.data?.items ?? [];
  const total = notifications.data?.total ?? 0;
  const hasNext = (page + 1) * PAGE_SIZE < total;

  async function open(n: AppNotification) {
    if (!n.read) {
      try {
        await markRead.mutateAsync(n.id);
      } catch {
        // best-effort; navigation still proceeds
      }
    }
    if (n.link) router.push(n.link);
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">{t("notifications.page.title")}</h1>
        <button
          type="button"
          className="text-sm text-primary hover:underline"
          onClick={() => markAllRead.mutate()}
        >
          {t("notifications.markAllRead")}
        </button>
      </div>

      {notifications.isLoading ? (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-16 w-full rounded-lg" />
          <Skeleton className="h-16 w-full rounded-lg" />
          <Skeleton className="h-16 w-full rounded-lg" />
        </div>
      ) : notifications.isError ? (
        <p className="text-sm text-destructive">{t("notifications.loadFailed")}</p>
      ) : items.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">
          {t("notifications.empty")}
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {items.map((n) => (
            <Card
              key={n.id}
              role="button"
              tabIndex={0}
              onClick={() => void open(n)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") void open(n);
              }}
              className="cursor-pointer transition-colors hover:border-primary/40"
            >
              <CardContent className="flex items-start gap-2 py-3">
                {!n.read && (
                  <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />
                )}
                <div className="flex-1">
                  <p className="text-sm font-medium">{n.title}</p>
                  {n.body && (
                    <p className="text-sm text-muted-foreground">{n.body}</p>
                  )}
                  <p className="mt-1 text-xs text-muted-foreground">
                    {formatRelative(n.createdAt, locale)}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {(page > 0 || hasNext) && (
        <div className="mt-6 flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="icon"
            disabled={page === 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            disabled={!hasNext}
            onClick={() => setPage((p) => p + 1)}
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
