"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, Users } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/app/components/ui/badge";
import { Button } from "@/app/components/ui/button";
import { Card, CardContent, CardHeader } from "@/app/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/app/components/ui/collapsible";
import { Input } from "@/app/components/ui/input";
import { useGradeQuestion } from "@/app/hooks/survey";
import { useTranslation } from "@/app/i18n/context";
import { formatAnswer } from "@/app/lib/survey/export";
import { maxPointsFor, sharedPoints, type AnswerGroup } from "@/app/lib/survey/grading";
import type { Question, UploadedFile } from "@/app/types/survey";
import { AnswerFeedbackField } from "./answer-feedback-field";
import { ChoiceAnswer } from "./choice-answer";
import { FileList, parsePoints } from "./grading-view";

interface AnswerGroupCardProps {
  surveyId: string;
  question: Question;
  group: AnswerGroup;
  studentLabel: (responseId: string) => string;
  studentHref: (responseId: string) => string;
  commentable: boolean;
}

export function AnswerGroupCard({
  surveyId,
  question,
  group,
  studentLabel,
  studentHref,
  commentable,
}: AnswerGroupCardProps) {
  const { t } = useTranslation();
  const ids = group.responses.map((r) => r.id);
  const shared = sharedPoints(question, group.responses);
  const autoPoints = group.responses[0]?.answers.find((a) => a.questionId === question.id)?.autoPoints ?? null;
  const feedbacks = new Set(
    group.responses.map((r) => r.answers.find((a) => a.questionId === question.id)?.feedback ?? ""),
  );
  const sharedFeedback = feedbacks.size === 1 ? [...feedbacks][0] : null;

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
        <Badge variant="secondary" className="gap-1">
          <Users className="size-3.5" />
          {t("grading.byQuestion.count", { n: String(ids.length) })}
        </Badge>
        <PointsField
          key={`${group.key}-${String(shared)}`}
          surveyId={surveyId}
          question={question}
          responseIds={ids}
          initial={shared === "mixed" ? undefined : shared}
          placeholder={shared === "mixed" ? t("grading.byQuestion.mixed") : autoPoints != null ? String(autoPoints) : undefined}
          label={ids.length > 1 ? t("grading.byQuestion.pointsForAll") : t("grading.points")}
        />
      </CardHeader>
      <CardContent className="grid gap-3">
        <GroupAnswer question={question} value={group.value} />
        {commentable && (
          <AnswerFeedbackField
            key={ids.join()}
            surveyId={surveyId}
            questionId={question.id}
            responseIds={ids}
            initial={sharedFeedback ?? ""}
            label={ids.length > 1 ? t("grading.byQuestion.feedbackForAll") : t("grading.answerFeedback")}
            placeholder={sharedFeedback == null ? t("grading.byQuestion.mixed") : undefined}
          />
        )}
        <Collapsible>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="w-fit gap-1 px-2">
              <ChevronDown className="size-4" />
              {t("grading.byQuestion.students")}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <ul className="mt-2 grid gap-2">
              {group.responses.map((response) => {
                const answer = response.answers.find((a) => a.questionId === question.id);
                const points = answer?.awardedPoints ?? null;
                return (
                  <li key={response.id} className="flex flex-wrap items-center justify-between gap-2">
                    <Link href={studentHref(response.id)} className="text-sm hover:underline">
                      {studentLabel(response.id)}
                    </Link>
                    <PointsField
                      key={`${response.id}-${String(points)}`}
                      surveyId={surveyId}
                      question={question}
                      responseIds={[response.id]}
                      initial={points}
                      placeholder={answer?.autoPoints != null ? String(answer.autoPoints) : undefined}
                      label={t("grading.points")}
                    />
                  </li>
                );
              })}
            </ul>
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  );
}

function GroupAnswer({ question, value }: { question: Question; value: unknown }) {
  if (question.type === "checkboxes") return <ChoiceAnswer question={question} value={value} />;
  if (question.type === "file-upload" || question.type === "signature") {
    return <FileList files={value as UploadedFile[]} />;
  }
  return <p className="text-sm break-words whitespace-pre-wrap">{formatAnswer(question, value)}</p>;
}

interface PointsFieldProps {
  surveyId: string;
  question: Question;
  responseIds: string[];
  initial: number | null | undefined;
  placeholder?: string;
  label: string;
}

function PointsField({ surveyId, question, responseIds, initial, placeholder, label }: PointsFieldProps) {
  const { t } = useTranslation();
  const grade = useGradeQuestion(surveyId);
  const max = maxPointsFor(question);
  const [text, setText] = useState(initial == null ? "" : String(initial));
  const [dirty, setDirty] = useState(false);
  const parsed = parsePoints(text, max);
  const invalid = parsed === "invalid";

  function save() {
    if (!dirty || grade.isPending || parsed === "invalid" || parsed === initial) return;
    setDirty(false);
    grade.mutate(
      { questionId: question.id, grades: responseIds.map((responseId) => ({ responseId, points: parsed })) },
      {
        onSuccess: () => toast.success(t("grading.byQuestion.saved", { n: String(responseIds.length) })),
        onError: (err) => toast.error(err instanceof Error ? err.message : t("grading.saveFailed")),
      },
    );
  }

  return (
    <div className="grid gap-1">
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">{label}</span>
        <Input
          aria-label={label}
          type="number"
          inputMode="numeric"
          min={0}
          max={max}
          step={1}
          className="w-24 tabular-nums"
          aria-invalid={invalid}
          placeholder={placeholder}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setDirty(true);
          }}
          onBlur={save}
          onKeyDown={(e) => {
            if (e.key === "Enter") save();
          }}
        />
        <span className="text-sm text-muted-foreground tabular-nums">/ {max}</span>
      </div>
      {invalid && (
        <p className="text-xs text-destructive">{t("grading.invalidPoints", { max: String(max) })}</p>
      )}
    </div>
  );
}
