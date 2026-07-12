"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FilePlus2, FileText, Gamepad2, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/app/components/ui/dialog";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Badge } from "@/app/components/ui/badge";
import { useCreateSurvey } from "@/app/hooks/survey";
import { useDeleteTemplate } from "@/app/hooks/templates";
import { updateSurveyApi } from "@/app/lib/survey/api";
import {
  CURATED_TEMPLATES,
  instantiateTemplateQuestions,
  type SurveyTemplate,
} from "@/app/lib/survey/templates";
import { QUIZ_GAME_DEFAULT_SECONDS } from "@/app/lib/live/quiz-game";
import { useTranslation } from "@/app/i18n/context";

interface TemplatePickerDialogProps {
  autoOpen?: boolean;
  /** User-saved templates (issue #20); merged with the curated catalog. */
  customTemplates?: SurveyTemplate[];
}

/** Stable empty default so the prop reference doesn't change each render. */
const NO_CUSTOM_TEMPLATES: SurveyTemplate[] = [];

function matches(t: SurveyTemplate, query: string): boolean {
  const q = query.toLowerCase();
  return (
    t.name.toLowerCase().includes(q) ||
    t.description.toLowerCase().includes(q) ||
    t.category.toLowerCase().includes(q)
  );
}

export function TemplatePickerDialog({
  autoOpen = false,
  customTemplates = NO_CUSTOM_TEMPLATES,
}: TemplatePickerDialogProps) {
  const { t: tr } = useTranslation();
  const router = useRouter();
  const createSurvey = useCreateSurvey();
  const deleteTemplate = useDeleteTemplate();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);

  function handleCreateError(err: unknown) {
    setBusy(false);
    toast.error(err instanceof Error ? err.message : tr("templates.createFailed"));
  }

  // Open from the command palette / deep link (`/surveys?new=1`). Driven by an
  // effect — not useState's initial value — so it also fires when the dashboard
  // is already mounted. router.replace clears the param (updating Next's
  // searchParams, which a bare history.replaceState would not) so the action
  // can be triggered again later.
  useEffect(() => {
    if (!autoOpen) return;
    // Syncing dialog state from an external system (the URL search param).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOpen(true);
    router.replace("/surveys");
  }, [autoOpen, router]);

  async function startBlank() {
    setBusy(true);
    try {
      const survey = await createSurvey.mutateAsync({ title: "Untitled survey" });
      router.push(`/surveys/${survey.id}/edit`);
    } catch (err) {
      handleCreateError(err);
    }
  }

  // Quiz game: a live, presenter-paced scored quiz. Presets the live + quiz
  // flags and seeds one multiple-choice question so the builder opens ready.
  async function startQuizGame() {
    setBusy(true);
    try {
      const survey = await createSurvey.mutateAsync({
        title: tr("templates.quizGameTitle"),
      });
      const optId = () => crypto.randomUUID();
      const ids = [optId(), optId(), optId(), optId()];
      const res = await updateSurveyApi(survey.id, {
        title: survey.title,
        description: survey.description,
        status: survey.status,
        settings: {
          ...survey.settings,
          isQuiz: true,
          liveMode: true,
          liveQuestionSeconds: QUIZ_GAME_DEFAULT_SECONDS,
          showCorrectAnswers: "after-submission",
        },
        questions: [
          {
            id: crypto.randomUUID(),
            type: "multiple-choice",
            title: "",
            required: true,
            order: 0,
            options: ids.map((id) => ({ id, label: "" })),
            correctAnswers: [ids[0]],
            points: 1000,
          },
        ],
      });
      if (!res.success) throw new Error(res.error ?? tr("templates.applyFailed"));
      router.push(`/surveys/${survey.id}/edit`);
    } catch (err) {
      handleCreateError(err);
    }
  }

  async function useTemplate(template: SurveyTemplate) {
    setBusy(true);
    try {
      const survey = await createSurvey.mutateAsync({ title: template.name });
      const res = await updateSurveyApi(survey.id, {
        title: survey.title,
        description: survey.description,
        status: survey.status,
        settings: { ...survey.settings, ...(template.settings ?? {}) },
        questions: instantiateTemplateQuestions(template),
      });
      if (!res.success) throw new Error(res.error ?? tr("templates.applyFailed"));
      router.push(`/surveys/${survey.id}/edit`);
    } catch (err) {
      handleCreateError(err);
    }
  }

  const curated = CURATED_TEMPLATES.filter((t) => matches(t, query));
  const custom = customTemplates.filter((t) => matches(t, query));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>{tr("templates.trigger")}</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{tr("templates.title")}</DialogTitle>
          <DialogDescription>
            {tr("templates.description")}
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-2 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={tr("templates.searchPlaceholder")}
            className="pl-8"
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={startBlank}
            disabled={busy}
            className="flex flex-col items-start gap-1 rounded-lg border border-dashed p-4 text-left transition-colors hover:border-primary/50 disabled:opacity-50"
          >
            <FilePlus2 className="size-5 text-muted-foreground" />
            <span className="font-medium">{tr("templates.blankTitle")}</span>
            <span className="text-xs text-muted-foreground">{tr("templates.blankDescription")}</span>
          </button>

          <button
            type="button"
            onClick={startQuizGame}
            disabled={busy}
            className="flex flex-col items-start gap-1 rounded-lg border border-dashed p-4 text-left transition-colors hover:border-primary/50 disabled:opacity-50"
          >
            <Gamepad2 className="size-5 text-muted-foreground" />
            <span className="font-medium">{tr("templates.quizGameTitle")}</span>
            <span className="text-xs text-muted-foreground">{tr("templates.quizGameDescription")}</span>
          </button>

          {custom.length > 0 && (
            <p className="col-span-full mt-1 text-xs font-medium text-muted-foreground">
              {tr("templates.yours")}
            </p>
          )}
          {custom.map((t) => (
            <TemplateCard
              key={t.id}
              template={t}
              busy={busy}
              onUse={useTemplate}
              onDelete={async () => {
                if (!window.confirm(tr("templates.deleteConfirm", { name: t.name }))) return;
                try {
                  await deleteTemplate.mutateAsync(t.id);
                  toast.success(tr("templates.deleted"));
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : tr("templates.deleteFailed"));
                }
              }}
            />
          ))}

          <p className="col-span-full mt-1 text-xs font-medium text-muted-foreground">
            {tr("templates.curated")}
          </p>
          {curated.map((t) => (
            <TemplateCard key={t.id} template={t} busy={busy} onUse={useTemplate} />
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function TemplateCard({
  template,
  busy,
  onUse,
  onDelete,
}: {
  template: SurveyTemplate;
  busy: boolean;
  onUse: (t: SurveyTemplate) => void;
  onDelete?: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => onUse(template)}
        disabled={busy}
        className="flex h-full w-full flex-col items-start gap-1 rounded-lg border p-4 text-left transition-colors hover:border-primary/50 disabled:opacity-50"
      >
        <div className="flex w-full items-center justify-between gap-2">
          <FileText className="size-5 text-muted-foreground" />
          <Badge variant="secondary" className="capitalize">
            {template.category}
          </Badge>
        </div>
        <span className="font-medium">{template.name}</span>
        <span className="text-xs text-muted-foreground">{template.description}</span>
      </button>
      {onDelete && (
        <Button
          variant="ghost"
          size="icon"
          aria-label={t("templates.deleteAria", { name: template.name })}
          onClick={onDelete}
          className="absolute right-1 top-1 size-7 text-muted-foreground hover:text-destructive"
        >
          <Trash2 className="size-4" />
        </Button>
      )}
    </div>
  );
}
