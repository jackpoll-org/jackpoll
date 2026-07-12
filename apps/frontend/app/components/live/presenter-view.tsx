"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Check, ChevronLeft, ChevronRight, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/app/components/ui/button";
import { QuestionResultCard } from "@/app/components/survey-results/question-result-card";
import { Leaderboard } from "./leaderboard";
import { LobbyView } from "./lobby-view";
import { Podium } from "./podium";
import { answerTile } from "@/app/lib/live/answer-tiles";
import { isQuizGame } from "@/app/lib/live/quiz-game";
import { playReveal, playTick } from "@/app/lib/live/sound";
import { useSurvey, useSurveyResults } from "@/app/hooks/survey";
import { useLiveResultsSocket } from "@/app/hooks/results-live";
import { useCountdown, useLiveRoster, useSetLiveState } from "@/app/hooks/live";
import type { Question, Survey } from "@/app/types/survey";
import { useTranslation } from "@/app/i18n/context";

/** The slice of an aggregated question result the presenter tiles read. */
type QuestionResult = {
  questionId: string;
  answered: number;
  optionCounts?: Record<string, number> | null;
};

/**
 * Presenter-paced live view (#): the host steps through the questions one at a
 * time with the arrows; each move is broadcast so every participant jumps to the
 * same question. In a Quiz game the host also sees the answer tiles, the timed
 * reveal of the correct answer, and a quick standings screen between questions.
 */
export function PresenterView({ surveyId }: { surveyId: string }) {
  const { t } = useTranslation();
  const surveyQuery = useSurvey(surveyId);
  const survey = surveyQuery.data;

  return survey ? (
    <PresenterInner survey={survey} />
  ) : (
    <div className="flex min-h-svh items-center justify-center text-sm text-muted-foreground">
      {surveyQuery.isError ? t("results.loadFailed") : t("common.loading")}
    </div>
  );
}

/** Coloured/shaped answer tiles the presenter shows so participants can read. */
function GameAnswerTiles({
  question,
  result,
  reveal,
}: {
  question: Question;
  result?: QuestionResult;
  reveal: boolean;
}) {
  const options = question.options ?? [];
  const correct = new Set(question.correctAnswers ?? []);
  const counts = result?.optionCounts ?? {};
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {options.map((opt, i) => {
        const tile = answerTile(i);
        const isCorrect = correct.has(opt.id);
        return (
          <div
            key={opt.id}
            className={cn(
              "relative flex items-center gap-4 rounded-xl px-5 py-6 text-xl font-semibold text-white",
              tile.color.split(" ")[0],
              reveal && !isCorrect && "opacity-40",
              reveal && isCorrect && `ring-4 ring-offset-2 ${tile.ring}`,
            )}
          >
            <tile.Shape className="size-8 shrink-0" strokeWidth={2.5} aria-hidden />
            <span className="min-w-0 flex-1 break-words">{opt.label}</span>
            {reveal && isCorrect && <Check className="size-7 shrink-0" />}
            {reveal && (
              <span className="shrink-0 tabular-nums text-lg">
                {counts[opt.id] ?? 0}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

function PresenterInner({ survey }: { survey: Survey }) {
  const { t } = useTranslation();
  const game = isQuizGame(survey.settings);
  const questions = useMemo(
    () => survey.questions.toSorted((a, b) => a.order - b.order),
    [survey.questions],
  );
  const [index, setIndex] = useState(0);
  const [startedAt, setStartedAt] = useState(() => Date.now());
  // Quiz games open in a lobby; the host starts the first question from there.
  const [started, setStarted] = useState(false);
  // Per-question flow for a Quiz game: read the options → reveal the correct
  // answer → show a quick standings screen → advance.
  const [stage, setStage] = useState<"asking" | "reveal" | "standings">("asking");
  // Brief 3-2-1 "get ready" shown over the tiles at the start of each question.
  const [intro, setIntro] = useState(false);
  const results = useSurveyResults(survey.id);
  const roster = useLiveRoster(survey.id, game);
  useLiveResultsSocket(survey.id); // keep the shown result fresh in real time
  const live = useSetLiveState(survey.id);
  const inLobby = game && !started;

  const seconds = survey.settings.isQuiz ? survey.settings.liveQuestionSeconds ?? 0 : 0;
  const remaining = useCountdown(startedAt, seconds);
  const go = (next: number) => {
    setIndex(next);
    setStartedAt(Date.now()); // restart the countdown for the new question
    setStage("asking");
    if (next < questions.length) setIntro(true);
  };

  // Clear the get-ready overlay shortly after a question opens.
  useEffect(() => {
    if (!intro) return;
    const id = setTimeout(() => setIntro(false), 1600);
    return () => clearTimeout(id);
  }, [intro]);

  // Countdown tick in the last 5 seconds, and a sting on reveal.
  useEffect(() => {
    if (game && started && stage === "asking" && !intro && remaining != null && remaining > 0 && remaining <= 5) {
      playTick();
    }
  }, [remaining, game, started, stage, intro]);
  useEffect(() => {
    if (game && stage === "reveal") playReveal();
  }, [stage, game]);

  // Auto-reveal the correct answer when the countdown runs out (games only).
  useEffect(() => {
    // Timer hit 0 → move from asking to the reveal; syncing UI stage to an
    // external countdown is exactly what an effect is for.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (game && started && stage === "asking" && remaining === 0) setStage("reveal");
  }, [game, started, stage, remaining]);

  // Broadcast the current position + phase to participants on mount and each
  // move (lobby while waiting to start, then question/results).
  const liveRef = useRef(live);
  useEffect(() => {
    liveRef.current = live;
  });
  useEffect(() => {
    const phase =
      game && !started
        ? "lobby"
        : index >= questions.length
          ? "results"
          : game && (stage === "reveal" || stage === "standings")
            ? "reveal"
            : "question";
    liveRef.current.mutate({
      index: Math.min(Math.max(index, 0), questions.length - 1),
      phase,
    });
  }, [index, started, game, stage, questions.length]);

  if (questions.length === 0) {
    return (
      <div className="flex min-h-svh items-center justify-center text-sm text-muted-foreground">
        {t("live.noQuestions")}
      </div>
    );
  }

  if (inLobby) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col gap-4 bg-background p-6">
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-2xl font-bold tracking-tight">
            {survey.title || t("player.untitledSurvey")}
          </h1>
          <Button asChild variant="ghost" size="sm">
            <Link href={`/surveys/${survey.id}/results`}>
              <X className="size-4" />
              {t("live.exit")}
            </Link>
          </Button>
        </div>
        <LobbyView
          surveyId={survey.id}
          players={roster}
          onStart={() => {
            setStarted(true);
            go(0);
          }}
        />
      </div>
    );
  }

  // One step past the last question is the final overall-results screen.
  const isResults = index >= questions.length;
  const question = questions[Math.min(index, questions.length - 1)];
  const result = results.data?.questions.find(
    (r) => r.questionId === question.id,
  );
  const atStart = index === 0;
  const atLastQuestion = index === questions.length - 1;
  const showTimer =
    !isResults && remaining != null && (!game || stage === "asking");

  // Advance: non-game jumps straight to the next question; a game walks through
  // asking → reveal → standings first.
  const handleNext = () => {
    if (game && !isResults) {
      if (stage === "asking") return setStage("reveal");
      if (stage === "reveal") return setStage("standings");
    }
    go(Math.min(questions.length, index + 1));
  };
  const nextLabel =
    game && !isResults && stage === "asking"
      ? t("live.reveal")
      : game && !isResults && stage === "reveal"
        ? t("live.standings")
        : atLastQuestion
          ? t("live.showResults")
          : t("live.next");
  // During asking the host may reveal early; otherwise Next always progresses.
  const nextDisabled = isResults;

  const title = isResults
    ? t("live.finalResults")
    : game && stage === "standings"
      ? t("live.standings")
      : question.title || t("player.untitledQuestion");

  return (
    <div className="fixed inset-0 z-50 flex flex-col gap-4 bg-background p-6">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-3">
          {!isResults && (
            <span className="text-sm text-muted-foreground tabular-nums">
              {t("live.questionOf", {
                current: String(index + 1),
                total: String(questions.length),
              })}
            </span>
          )}
          {showTimer && (
            <span
              className={`rounded-full border px-3 py-1 text-sm font-bold tabular-nums ${
                remaining! <= 5 ? "border-destructive text-destructive" : ""
              }`}
            >
              {remaining}s
            </span>
          )}
          {game && !isResults && stage === "asking" && result && (
            <span className="text-sm text-muted-foreground tabular-nums">
              {roster.length > 0
                ? t("live.answeredOfTotal", {
                    count: String(result.answered),
                    total: String(roster.length),
                  })
                : t("live.answeredCount", { count: String(result.answered) })}
            </span>
          )}
        </span>
        <Button asChild variant="ghost" size="sm">
          <Link href={`/surveys/${survey.id}/results`}>
            <X className="size-4" />
            {t("live.exit")}
          </Link>
        </Button>
      </div>

      <h1 className="text-center text-2xl font-bold tracking-tight sm:text-3xl">
        {title}
      </h1>

      {isResults ? (
        <div className="mx-auto min-h-0 w-full max-w-2xl flex-1 overflow-y-auto">
          {survey.settings.isQuiz ? (
            <Podium surveyId={survey.id} />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-sm text-muted-foreground">
              <p>{t("live.ended")}</p>
              <Button asChild variant="outline">
                <Link href={`/surveys/${survey.id}/results`}>
                  {t("live.viewFullResults")}
                </Link>
              </Button>
            </div>
          )}
        </div>
      ) : game && stage === "standings" ? (
        <div className="mx-auto min-h-0 w-full max-w-xl flex-1 overflow-y-auto">
          <Leaderboard surveyId={survey.id} limit={5} />
        </div>
      ) : game && (question.options?.length ?? 0) > 0 ? (
        <div className="relative mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col justify-center overflow-y-auto">
          <GameAnswerTiles
            question={question}
            result={result}
            reveal={stage === "reveal"}
          />
          {intro && stage === "asking" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-background/90 backdrop-blur-sm">
              <p className="text-lg font-medium text-muted-foreground">
                {t("live.getReady")}
              </p>
              <p className="text-7xl font-black tracking-widest">3·2·1</p>
            </div>
          )}
        </div>
      ) : (
        // Non-tile questions (sliders) and non-game presenter surveys keep the
        // aggregated result card + running leaderboard.
        <div className="grid min-h-0 flex-1 gap-4 overflow-y-auto lg:grid-cols-3">
          <div className={survey.settings.isQuiz ? "lg:col-span-2" : "lg:col-span-3"}>
            {result && result.answered > 0 ? (
              <QuestionResultCard result={result} question={question} />
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                {t("live.awaitingAnswers")}
              </div>
            )}
          </div>
          {survey.settings.isQuiz && <Leaderboard surveyId={survey.id} />}
        </div>
      )}

      <div className="flex items-center justify-between gap-4">
        <Button
          variant="outline"
          size="lg"
          disabled={atStart || (game && stage !== "asking")}
          onClick={() => go(Math.max(0, index - 1))}
        >
          <ChevronLeft className="size-5" />
          {t("live.prev")}
        </Button>
        <Button size="lg" disabled={nextDisabled} onClick={handleNext}>
          {nextLabel}
          <ChevronRight className="size-5" />
        </Button>
      </div>
    </div>
  );
}
