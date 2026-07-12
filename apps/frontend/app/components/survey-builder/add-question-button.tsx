"use client";

import { Plus, ToggleLeft } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/app/components/ui/dropdown-menu";
import { createOption } from "@/app/components/question-types/helpers";
import { useBuilder } from "./builder-context";
import {
  BUILDER_QUESTION_TYPES,
  QUESTION_TYPES,
} from "@/app/components/question-types/registry";
import { isQuizGame } from "@/app/lib/live/quiz-game";
import type { QuestionType } from "@/app/types/survey";
import { useTranslation } from "@/app/i18n/context";

// A Quiz game only supports fast, presenter-readable question types.
const QUIZ_GAME_TYPES = new Set<QuestionType>(["multiple-choice", "slider"]);

export function AddQuestionButton() {
  const { t } = useTranslation();
  const { addQuestion, activePageId, survey } = useBuilder();
  const types = isQuizGame(survey.settings)
    ? BUILDER_QUESTION_TYPES.filter((type) => QUIZ_GAME_TYPES.has(type))
    : BUILDER_QUESTION_TYPES;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="w-full">
          <Plus className="size-4" />
          Add question
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        {types.map((type) => {
          const def = QUESTION_TYPES[type];
          const Icon = def.icon;
          return (
            <DropdownMenuItem
              key={type}
              onSelect={() => addQuestion(type, activePageId)}
            >
              <Icon className="size-4" />
              {t(def.labelKey)}
            </DropdownMenuItem>
          );
        })}
        <DropdownMenuSeparator />
        {/* True/False = a multiple-choice preset with two fixed options, so it
            reuses the choice player/results/scoring with no new question type. */}
        <DropdownMenuItem
          onSelect={() =>
            addQuestion("multiple-choice", activePageId, {
              options: [createOption(t("builder.true")), createOption(t("builder.false"))],
            })
          }
        >
          <ToggleLeft className="size-4" />
          {t("builder.addTrueFalse")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
