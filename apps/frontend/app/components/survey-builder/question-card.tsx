"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Braces, ChevronDown, ChevronUp, GitBranch, GripVertical, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/app/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/app/components/ui/dropdown-menu";
import { Label } from "@/app/components/ui/label";
import { Button } from "@/app/components/ui/button";
import { Switch } from "@/app/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/app/components/ui/select";
import { Separator } from "@/app/components/ui/separator";
import { Badge } from "@/app/components/ui/badge";
import type { Question } from "@/app/types/survey";
import { getQuestionTypeDefinition } from "@/app/components/question-types/registry";
import { getPrecedingQuestions, hasLogic } from "@/app/lib/survey/logic";
import { useBuilder } from "./builder-context";
import { useTranslation } from "@/app/i18n/context";
import { CollabTextInput } from "./collab-text-input";
import { QuestionValidationEditor } from "./question-validation-editor";
import { QuestionLogicEditor } from "./question-logic-editor";
import { QuestionQuizEditor } from "./question-quiz-editor";

interface QuestionCardProps {
  question: Question;
  index: number;
  total: number;
}

/** Free-text and file-upload answers are never aggregated for live results. */
function liveResultsApplicable(type: Question["type"]): boolean {
  return type !== "short-answer" && type !== "file-upload";
}

export function QuestionCard({ question, index, total }: QuestionCardProps) {
  const { t } = useTranslation();
  const {
    survey,
    updateQuestion,
    removeQuestion,
    moveQuestion,
    setQuestionSection,
    focusByQuestion,
    attemptedSave,
    setFocus,
  } = useBuilder();
  const titleMissing = attemptedSave && !question.title.trim();
  const sections = survey.sections ?? [];
  // Collaborators currently editing this question (issue #85).
  const peers = focusByQuestion.get(question.id) ?? [];
  const peer = peers[0];
  const def = getQuestionTypeDefinition(question.type);
  const { Editor, icon: Icon } = def;
  // Conditional logic may reference any question the respondent answers before
  // this one — earlier pages included — not just the current page's array
  // prefix. `index` is page-local, so slicing the flat list with it was wrong.
  const precedingQuestions = getPrecedingQuestions(survey, question.id);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: question.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    // Highlight the card in the collaborator's colour while they edit it.
    // Inset so the 2px ring draws inside the card — a non-inset shadow on a
    // full-width card bleeds past the viewport and causes horizontal scroll on
    // mobile.
    ...(peer ? { boxShadow: `inset 0 0 0 2px ${peer.color}` } : {}),
  };

  return (
    <Card
      ref={setNodeRef}
      style={style}
      data-question-id={question.id}
      // Any focus inside the card (title, options, settings, switches) marks
      // this question as the one we're working in, so collaborators following
      // us track every edit — not just title changes (#85).
      onFocusCapture={() => setFocus({ questionId: question.id, field: "card" })}
      className={isDragging ? "relative z-10 opacity-70 shadow-lg" : undefined}
    >
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-2 text-sm text-muted-foreground">
            <button
              type="button"
              aria-label={t("builder.question.dragReorder")}
              className="cursor-grab touch-none rounded p-0.5 text-muted-foreground hover:text-foreground active:cursor-grabbing"
              {...attributes}
              {...listeners}
            >
              <GripVertical className="size-4" />
            </button>
            <Icon className="size-4" />
            {t(def.labelKey)}
            {hasLogic(question) && (
              <Badge variant="outline" className="gap-1 font-normal">
                <GitBranch className="size-3" />
                {t("builder.question.conditional")}
              </Badge>
            )}
            {peer && (
              <Badge
                variant="outline"
                className="gap-1 font-normal"
                style={{ borderColor: peer.color, color: peer.color }}
              >
                {peer.name}
                {peers.length > 1 ? ` +${peers.length - 1}` : ""}{" "}
                {t("builder.question.editing")}
              </Badge>
            )}
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              aria-label={t("builder.question.moveUp")}
              disabled={index === 0}
              onClick={() => moveQuestion(question.id, "up")}
            >
              <ChevronUp className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label={t("builder.question.moveDown")}
              disabled={index === total - 1}
              onClick={() => moveQuestion(question.id, "down")}
            >
              <ChevronDown className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label={t("builder.question.delete")}
              className="text-muted-foreground hover:text-destructive"
              onClick={() => removeQuestion(question.id)}
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span
            className="text-base text-destructive"
            aria-label={t("builder.required")}
            title={t("builder.required")}
          >
            *
          </span>
          <CollabTextInput
            questionId={question.id}
            field="title"
            value={question.title}
            onChange={(v) => updateQuestion(question.id, { title: v })}
            placeholder={t("builder.question.titlePlaceholder")}
            className={
              titleMissing
                ? "text-base border-destructive focus-visible:ring-destructive"
                : "text-base"
            }
            aria-invalid={titleMissing}
          />
          {precedingQuestions.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  aria-label={t("builder.question.insertAnswer")}
                  title={t("builder.question.insertAnswer")}
                >
                  <Braces className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                {precedingQuestions.map((q) => (
                  <DropdownMenuItem
                    key={q.id}
                    onSelect={() =>
                      updateQuestion(question.id, {
                        title: `${question.title} {{${q.id}}}`,
                      })
                    }
                  >
                    {q.title || t("builder.question.untitled")}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
        {titleMissing && (
          <p className="text-sm text-destructive">
            {t("builder.question.titleRequired")}
          </p>
        )}
      </CardHeader>

      <CardContent className="grid gap-4">
        <Editor
          question={question}
          onChange={(patch) => updateQuestion(question.id, patch)}
        />

        <QuestionValidationEditor
          question={question}
          onChange={(patch) => updateQuestion(question.id, patch)}
        />

        <QuestionLogicEditor
          question={question}
          precedingQuestions={precedingQuestions}
          onChange={(patch) => updateQuestion(question.id, patch)}
        />

        {survey.settings.isQuiz && (
          <QuestionQuizEditor
            question={question}
            onChange={(patch) => updateQuestion(question.id, patch)}
          />
        )}

        <Separator />

        <div className="flex flex-wrap items-center justify-end gap-4">
          {sections.length > 0 && (
            <div className="mr-auto flex items-center gap-2">
              <Label className="text-sm font-normal">{t("builder.question.pageLabel")}</Label>
              <Select
                value={question.sectionId ?? "__none__"}
                onValueChange={(v) =>
                  setQuestionSection(question.id, v === "__none__" ? null : v)
                }
              >
                <SelectTrigger className="w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">
                    {t("builder.page.numbered", { n: "1" })}
                  </SelectItem>
                  {sections.map((s, i) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.title?.trim() || t("builder.page.numbered", { n: String(i + 2) })}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {survey.settings.showLiveResults && liveResultsApplicable(question.type) && (
            <div className="flex items-center gap-2">
              <Label
                htmlFor={`live-${question.id}`}
                className="text-sm font-normal"
              >
                Show in live results
              </Label>
              <Switch
                id={`live-${question.id}`}
                checked={question.showInLiveResults ?? true}
                onCheckedChange={(checked) =>
                  updateQuestion(question.id, { showInLiveResults: checked })
                }
              />
            </div>
          )}

          <div className="flex items-center gap-2">
            <Label htmlFor={`required-${question.id}`} className="text-sm font-normal">
              Required
            </Label>
            <Switch
              id={`required-${question.id}`}
              checked={question.required}
              onCheckedChange={(checked) =>
                updateQuestion(question.id, { required: checked })
              }
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
