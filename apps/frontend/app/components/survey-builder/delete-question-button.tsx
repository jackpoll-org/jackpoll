"use client";

import { Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/app/components/ui/alert-dialog";
import { Button } from "@/app/components/ui/button";
import { getQuestionTypeDefinition } from "@/app/components/question-types/registry";
import { useTranslation } from "@/app/i18n/context";
import type { Question } from "@/app/types/survey";

function isUntouched(question: Question): boolean {
  const fresh: Partial<Question> = getQuestionTypeDefinition(question.type).createDefaults();
  const labels = (options?: { label: string }[] | null) => (options ?? []).map((o) => o.label.trim());
  const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
  const meaningful = (settings?: Record<string, unknown> | null) =>
    Object.entries(settings ?? {})
      .filter(([, v]) => v != null && v !== "" && !(Array.isArray(v) && v.length === 0))
      .sort(([x], [y]) => x.localeCompare(y));
  return (
    question.title.trim() === "" &&
    (question.description ?? "").trim() === "" &&
    (question.correctAnswers ?? []).length === 0 &&
    same(labels(question.options), labels(fresh.options)) &&
    same(labels(question.rows), labels(fresh.rows)) &&
    same(labels(question.columns), labels(fresh.columns)) &&
    same(meaningful(question.settings), meaningful(fresh.settings))
  );
}

export function DeleteQuestionButton({ question, onDelete }: { question: Question; onDelete: () => void }) {
  const { t } = useTranslation();
  const confirm = !isUntouched(question);
  const trigger = (
    <Button
      variant="ghost"
      size="icon"
      aria-label={t("builder.question.delete")}
      className="text-muted-foreground hover:text-destructive"
      onClick={confirm ? undefined : onDelete}
    >
      <Trash2 className="size-4" />
    </Button>
  );
  if (!confirm) return trigger;

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("builder.question.deleteConfirmTitle")}</AlertDialogTitle>
          <AlertDialogDescription>
            {question.title.trim() && (
              <span className="mb-2 line-clamp-2 block font-medium text-foreground">
                {question.title.trim()}
              </span>
            )}
            {t("builder.question.deleteConfirmBody")}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={onDelete}>
            {t("common.delete")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
