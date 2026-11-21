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
  quiz?: boolean;
}

/**
 * Results filter for live mode: every start from the lobby is its own round,
 * and the owner can look at one round (players, scores, answers) or all of
 * them. Hidden until the survey has been presented live at least once.
 */
export function SessionPicker({ sessions, value, onChange, quiz = false }: SessionPickerProps) {
  const { t, locale } = useTranslation();
  if (sessions.length === 0) return null;

  const when = (iso: string) =>
    new Date(iso).toLocaleString(locale, { dateStyle: "short", timeStyle: "short" });
  const hasRuns = sessions.some((s) => s.kind === "scheduled");

  const optionLabel = (s: LiveSession) => {
    if (s.kind === "scheduled") {
      return t("results.session.optionRun", {
        label: s.label || when(s.opensAt ?? s.startedAt),
        answers: String(s.responses ?? 0),
      });
    }
    return quiz
      ? t("results.session.option", { date: when(s.startedAt), players: String(s.players) })
      : t("results.session.optionAnswers", { date: when(s.startedAt), answers: String(s.responses) });
  };

  return (
    <Select value={value ?? ALL} onValueChange={(v) => onChange(v === ALL ? null : v)}>
      <SelectTrigger
        className="h-8 w-56 text-sm"
        aria-label={t(hasRuns ? "results.session.runLabel" : "results.session.label")}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>
          {t(hasRuns ? "results.session.allRuns" : "results.session.all")}
        </SelectItem>
        {sessions.map((s) => (
          <SelectItem key={s.id} value={s.id}>
            {optionLabel(s)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
