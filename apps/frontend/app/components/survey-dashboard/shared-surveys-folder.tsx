"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, Users } from "lucide-react";
import { Badge } from "@/app/components/ui/badge";
import { SurveyCard } from "./survey-card";
import { sortSurveys, type SortBy } from "@/app/lib/survey/sort";
import type { Survey } from "@/app/types/survey";
import type { ListView } from "@/app/lib/preferences/ui-prefs";
import { useTranslation } from "@/app/i18n/context";

interface SharedSurveysFolderProps {
  surveys: Survey[];
  view: ListView;
  sort: SortBy;
  onTagClick?: (tag: string) => void;
}

/**
 * A dedicated "Shared with me" folder on the dashboard for surveys owned by
 * someone else who added me as a collaborator (#8). Read-mostly: the cards have
 * no owner actions and aren't draggable into my own folders.
 */
export function SharedSurveysFolder({
  surveys,
  view,
  sort,
  onTagClick,
}: SharedSurveysFolderProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(true);
  if (surveys.length === 0) return null;

  const sorted = sortSurveys(surveys, sort);
  const gridClass =
    view === "list"
      ? "mt-2 grid gap-2"
      : "mt-2 grid gap-4 sm:grid-cols-2 lg:grid-cols-3";

  return (
    <div className="mb-6">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 rounded-lg border bg-card px-3 py-2 text-left transition-colors hover:bg-muted"
      >
        {open ? (
          <ChevronDown className="size-4" />
        ) : (
          <ChevronRight className="size-4" />
        )}
        <Users className="size-4 text-muted-foreground" />
        <span className="text-sm font-medium">{t("dashboard.shared.title")}</span>
        <Badge variant="secondary" className="ml-auto tabular-nums">
          {surveys.length}
        </Badge>
      </button>

      {open && (
        <div className={gridClass}>
          {sorted.map((survey) => (
            <SurveyCard
              key={survey.id}
              survey={survey}
              onTagClick={onTagClick}
              view={view}
              shared
            />
          ))}
        </div>
      )}
    </div>
  );
}
