"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell } from "lucide-react";
import { Badge } from "@/app/components/ui/badge";
import { Button } from "@/app/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/app/components/ui/dropdown-menu";
import { useAuthContext } from "@/app/components/auth/auth-provider";
import { useIsClient } from "@/app/hooks/use-is-client";
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
  useUnreadNotificationCount,
} from "@/app/hooks/survey";
import { useTranslation } from "@/app/i18n/context";
import { formatRelative } from "@/app/lib/survey/format";
import type { AppNotification } from "@/app/types/survey";

export function NotificationBell() {
  const { user } = useAuthContext();
  const mounted = useIsClient();
  const { t, locale } = useTranslation();
  const router = useRouter();

  const isAuthed = mounted && !!user;
  const unread = useUnreadNotificationCount(isAuthed);
  const recent = useNotifications(0, 10, isAuthed);
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

  // Same hydration-safety pattern as UserMenu: nothing auth-dependent until mounted.
  if (!isAuthed) return null;

  const count = unread.data ?? 0;
  const items = recent.data?.items ?? [];

  async function openNotification(n: AppNotification) {
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
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label={t("notifications.bell.label")}
        >
          <Bell className="size-5" />
          {count > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-4 min-w-4 justify-center rounded-full px-1 text-[10px]"
            >
              {count > 9 ? "9+" : count}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <div className="flex items-center justify-between px-2 py-1.5">
          <DropdownMenuLabel className="p-0">
            {t("notifications.bell.label")}
          </DropdownMenuLabel>
          {count > 0 && (
            <button
              type="button"
              className="text-xs text-primary hover:underline"
              onClick={() => markAllRead.mutate()}
            >
              {t("notifications.markAllRead")}
            </button>
          )}
        </div>
        <DropdownMenuSeparator />
        {items.length === 0 ? (
          <p className="px-2 py-4 text-center text-sm text-muted-foreground">
            {t("notifications.empty")}
          </p>
        ) : (
          items.map((n) => (
            <DropdownMenuItem
              key={n.id}
              className="flex flex-col items-start gap-0.5 whitespace-normal"
              onSelect={() => void openNotification(n)}
            >
              <span className="flex w-full items-center gap-1.5 text-sm font-medium">
                {!n.read && <span className="size-1.5 shrink-0 rounded-full bg-primary" />}
                {n.title}
              </span>
              <span className="text-xs text-muted-foreground">
                {formatRelative(n.createdAt, locale)}
              </span>
            </DropdownMenuItem>
          ))
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/notifications" className="justify-center text-sm text-primary">
            {t("notifications.viewAll")}
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
