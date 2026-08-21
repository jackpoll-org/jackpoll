"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { Switch } from "@/app/components/ui/switch";
import { Skeleton } from "@/app/components/ui/skeleton";
import {
  useNotificationPrefs,
  useUpdateNotificationPrefs,
} from "@/app/hooks/survey";
import { useTranslation, type TranslateFn } from "@/app/i18n/context";
import type { TranslationKey } from "@/app/i18n/translations";
import {
  EVENT_CHANNELS,
  type NotificationChannelKey,
  type NotificationEventKey,
  type NotificationPreferences,
} from "@/app/types/survey";

/** Groups events into sections so the 9-event matrix reads as a page, not a wall. */
const GROUPS: { titleKey: TranslationKey; events: NotificationEventKey[] }[] = [
  {
    titleKey: "settings.notify.group.surveys",
    events: ["new_response", "response_milestone", "survey_auto_closed", "webhook_failing"],
  },
  {
    titleKey: "settings.notify.group.collaboration",
    events: [
      "collaborator_invited",
      "collaborator_accepted",
      "collaborator_declined",
      "collaborator_removed",
    ],
  },
  {
    titleKey: "settings.notify.group.digest",
    events: ["daily_digest"],
  },
];

const EVENT_LABEL_KEYS: Record<NotificationEventKey, TranslationKey> = {
  new_response: "settings.notify.newResponse",
  daily_digest: "settings.notify.dailyDigest",
  collaborator_invited: "settings.notify.collaboratorInvited",
  collaborator_accepted: "settings.notify.collaboratorAccepted",
  collaborator_declined: "settings.notify.collaboratorDeclined",
  collaborator_removed: "settings.notify.collaboratorRemoved",
  response_milestone: "settings.notify.responseMilestone",
  survey_auto_closed: "settings.notify.surveyAutoClosed",
  webhook_failing: "settings.notify.webhookFailing",
};

const CHANNEL_LABEL_KEYS: Record<NotificationChannelKey, TranslationKey> = {
  email: "settings.notify.colEmail",
  mobile_push: "settings.notify.colMobile",
  web_push: "settings.notify.colWeb",
  in_app: "settings.notify.colInApp",
};

const ALL_CHANNELS: NotificationChannelKey[] = ["email", "mobile_push", "web_push", "in_app"];
const ALL_EVENTS: NotificationEventKey[] = GROUPS.flatMap((group) => group.events);

/** Sets every valid channel of the given events to off, preserving the rest of the matrix. */
function buildAllOff(
  events: NotificationEventKey[],
  prefs: NotificationPreferences,
): NotificationPreferences {
  const byEvent = { ...prefs.byEvent };
  for (const event of events) {
    byEvent[event] = Object.fromEntries(
      EVENT_CHANNELS[event].map((channel) => [channel, false]),
    );
  }
  return { byEvent };
}

export function NotificationSettingsPage() {
  const { t } = useTranslation();
  const prefs = useNotificationPrefs();
  const update = useUpdateNotificationPrefs();

  async function toggle(event: NotificationEventKey, channel: NotificationChannelKey, value: boolean) {
    if (!prefs.data) return;
    const next: NotificationPreferences = {
      byEvent: {
        ...prefs.data.byEvent,
        [event]: { ...prefs.data.byEvent[event], [channel]: value },
      },
    };
    try {
      await update.mutateAsync(next);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("settings.notify.saveFailed"));
    }
  }

  async function turnOff(events: NotificationEventKey[], successKey: TranslationKey) {
    if (!prefs.data) return;
    try {
      await update.mutateAsync(buildAllOff(events, prefs.data));
      toast.success(t(successKey));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("settings.notify.saveFailed"));
    }
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8">
      <div className="mb-6">
        <Link
          href="/settings"
          className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          {t("settings.title")}
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{t("settings.notify.linkTitle")}</h1>
            <p className="text-sm text-muted-foreground">{t("settings.notify.prefsDescription")}</p>
          </div>
          {prefs.data && (
            <Button
              variant="outline"
              size="sm"
              disabled={update.isPending}
              onClick={() => turnOff(ALL_EVENTS, "settings.notify.turnedAllOff")}
            >
              {t("settings.notify.turnAllOff")}
            </Button>
          )}
        </div>
      </div>

      {prefs.isLoading ? (
        <div className="grid grid-cols-[minmax(0,1fr)] gap-6">
          <Skeleton className="h-40 w-full rounded-lg" />
          <Skeleton className="h-40 w-full rounded-lg" />
        </div>
      ) : prefs.isError || !prefs.data ? (
        <p className="text-sm text-destructive">{t("settings.notify.loadFailed")}</p>
      ) : (
        <div className="grid grid-cols-[minmax(0,1fr)] gap-6">
          {GROUPS.map((group) => (
            <EventGroup
              key={group.titleKey}
              titleKey={group.titleKey}
              events={group.events}
              prefs={prefs.data!}
              disabled={update.isPending}
              onToggle={toggle}
              onTurnOff={() => turnOff(group.events, "settings.notify.turnedGroupOff")}
              t={t}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function EventGroup({
  titleKey,
  events,
  prefs,
  disabled,
  onToggle,
  onTurnOff,
  t,
}: {
  titleKey: TranslationKey;
  events: NotificationEventKey[];
  prefs: NotificationPreferences;
  disabled: boolean;
  onToggle: (event: NotificationEventKey, channel: NotificationChannelKey, value: boolean) => void;
  onTurnOff: () => void;
  t: TranslateFn;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
        <CardTitle className="text-base">{t(titleKey)}</CardTitle>
        <Button variant="ghost" size="sm" disabled={disabled} onClick={onTurnOff}>
          {t("settings.notify.turnGroupOff")}
        </Button>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        {events.map((event) => (
          <EventRow
            key={event}
            event={event}
            prefs={prefs}
            disabled={disabled}
            onToggle={onToggle}
            t={t}
          />
        ))}
      </CardContent>
    </Card>
  );
}

function EventRow({
  event,
  prefs,
  disabled,
  onToggle,
  t,
}: {
  event: NotificationEventKey;
  prefs: NotificationPreferences;
  disabled: boolean;
  onToggle: (event: NotificationEventKey, channel: NotificationChannelKey, value: boolean) => void;
  t: TranslateFn;
}) {
  const validChannels = EVENT_CHANNELS[event];
  const label = t(EVENT_LABEL_KEYS[event]);

  return (
    <div className="flex flex-col gap-2 border-b border-border pb-4 last:border-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
      <span className="text-sm font-medium">{label}</span>
      <div className="flex flex-wrap gap-x-5 gap-y-2">
        {ALL_CHANNELS.map((channel) => {
          const isValid = validChannels.includes(channel);
          const channelLabel = t(CHANNEL_LABEL_KEYS[channel]);
          return (
            <div key={channel} className="flex flex-col items-center gap-1">
              <span className="text-[10px] font-medium text-muted-foreground">{channelLabel}</span>
              {isValid ? (
                <Switch
                  checked={prefs.byEvent[event]?.[channel] ?? true}
                  disabled={disabled}
                  aria-label={`${label} – ${channelLabel}`}
                  onCheckedChange={(v) => onToggle(event, channel, v)}
                />
              ) : (
                <span className="text-xs text-muted-foreground">{t("settings.notify.na")}</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
