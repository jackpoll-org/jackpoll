"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/app/components/ui/select";
import { useTranslation } from "@/app/i18n/context";
import type { LiveSession } from "@/app/types/survey";

const ALL = "__all__";

interface SessionPickerProps {
  sessions: LiveSession[];
  /** The picked round's id, or null for all rounds. */
  value: string | null;
  onChange: (sessionId: string | null) => void;
}

/**
 * Results filter for live quizzes: every "start game" is its own round, and
 * the owner can look at one round (players, scores, answers) or all of them.
 * Hidden until the quiz has been played as a live game at least once.
 */
export function SessionPicker({ sessions, value, onChange }: SessionPickerProps) {
  const { t, locale } = useTranslation();
  if (sessions.length === 0) return null;

  const when = (iso: string) =>
    new Date(iso).toLocaleString(locale, { dateStyle: "short", timeStyle: "short" });

  return (
    <Select value={value ?? ALL} onValueChange={(v) => onChange(v === ALL ? null : v)}>
      <SelectTrigger className="h-8 w-56 text-sm" aria-label={t("results.session.label")}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>{t("results.session.all")}</SelectItem>
        {sessions.map((s) => (
          <SelectItem key={s.id} value={s.id}>
            {t("results.session.option", { date: when(s.startedAt), players: String(s.players) })}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
