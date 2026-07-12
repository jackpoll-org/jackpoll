"use client";

import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/app/components/ui/card";
import { Switch } from "@/app/components/ui/switch";
import { Skeleton } from "@/app/components/ui/skeleton";
import {
  useNotificationPrefs,
  useUpdateNotificationPrefs,
} from "@/app/hooks/survey";
import { useTranslation } from "@/app/i18n/context";
import type { NotificationPreferences } from "@/app/types/survey";

/**
 * Account-level notification preferences (issue #89): a matrix of events
 * (rows) × channels (columns). Preferences apply across all of the user's
 * devices, so channels are always toggleable here regardless of the current
 * device — per-device permission is handled separately by PushSettingsCard.
 */
export function NotificationPrefsCard() {
  const { t } = useTranslation();
  const prefs = useNotificationPrefs();
  const update = useUpdateNotificationPrefs();

  async function save(next: NotificationPreferences) {
    try {
      await update.mutateAsync(next);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("settings.notify.saveFailed"));
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t("settings.notify.prefsTitle")}</CardTitle>
        <CardDescription>{t("settings.notify.prefsDescription")}</CardDescription>
      </CardHeader>
      <CardContent>
        {prefs.isLoading ? (
          <Skeleton className="h-24 w-full rounded-lg" />
        ) : prefs.isError || !prefs.data ? (
          <p className="text-sm text-destructive">{t("settings.notify.loadFailed")}</p>
        ) : (
          <div className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-x-6 gap-y-3 text-sm">
            {/* Header row */}
            <span />
            <span className="text-center text-xs font-medium text-muted-foreground">
              {t("settings.notify.colEmail")}
            </span>
            <span className="text-center text-xs font-medium text-muted-foreground">
              {t("settings.notify.colMobile")}
            </span>
            <span className="text-center text-xs font-medium text-muted-foreground">
              {t("settings.notify.colWeb")}
            </span>

            {/* New response */}
            <span>{t("settings.notify.newResponse")}</span>
            <Cell
              checked={prefs.data.newResponse.email}
              disabled={update.isPending}
              label={`${t("settings.notify.newResponse")} – ${t("settings.notify.colEmail")}`}
              onChange={(v) =>
                save({
                  ...prefs.data,
                  newResponse: { ...prefs.data.newResponse, email: v },
                })
              }
            />
            <Cell
              checked={prefs.data.newResponse.mobilePush}
              disabled={update.isPending}
              label={`${t("settings.notify.newResponse")} – ${t("settings.notify.colMobile")}`}
              onChange={(v) =>
                save({
                  ...prefs.data,
                  newResponse: { ...prefs.data.newResponse, mobilePush: v },
                })
              }
            />
            <Cell
              checked={prefs.data.newResponse.webPush}
              disabled={update.isPending}
              label={`${t("settings.notify.newResponse")} – ${t("settings.notify.colWeb")}`}
              onChange={(v) =>
                save({
                  ...prefs.data,
                  newResponse: { ...prefs.data.newResponse, webPush: v },
                })
              }
            />

            {/* Daily digest — email only */}
            <span>{t("settings.notify.dailyDigest")}</span>
            <Cell
              checked={prefs.data.dailyDigest.email}
              disabled={update.isPending}
              label={`${t("settings.notify.dailyDigest")} – ${t("settings.notify.colEmail")}`}
              onChange={(v) =>
                save({ ...prefs.data, dailyDigest: { email: v } })
              }
            />
            <span className="text-center text-muted-foreground">{t("settings.notify.na")}</span>
            <span className="text-center text-muted-foreground">{t("settings.notify.na")}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Cell({
  checked,
  disabled,
  label,
  onChange,
}: {
  checked: boolean;
  disabled: boolean;
  label: string;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex justify-center">
      <Switch
        checked={checked}
        disabled={disabled}
        aria-label={label}
        onCheckedChange={onChange}
      />
    </div>
  );
}
