"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Check, Loader2, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import { Spinner } from "@/app/components/ui/spinner";
import { Leaderboard } from "./leaderboard";
import { answerTile } from "@/app/lib/live/answer-tiles";
import { playCorrect, playWrong } from "@/app/lib/live/sound";
import { getQuestionTypeDefinition } from "@/app/components/question-types/registry";
import { useCountdown, useJoinLive, useLivePresence } from "@/app/hooks/live";
import type { LivePhase } from "@/app/lib/live/messages";
import { useBeginToken, useSubmitResponse } from "@/app/hooks/survey";
import { validateAnswer, type AnswerValue } from "@/app/lib/survey/validation";
import type { Question, Survey } from "@/app/types/survey";
import { useTranslation } from "@/app/i18n/context";

// Big tap-to-answer buttons for single-choice questions (quiz feel, #97).
const BIG_CHOICE_TYPES = new Set<Question["type"]>(["multiple-choice", "dropdown"]);

/** Time-to-answer for the speed bonus (module-level so it's clearly a callback). */
function elapsedSince(startedAt: number | null): number | undefined {
  return startedAt != null ? Date.now() - startedAt : undefined;
}

/**
 * Presenter-paced live participant (#99). Shows only the question the host is
 * presenting; the respondent answers, it's submitted live, and they wait for the
 * host to advance. In quiz mode (#97) single-choice questions render as big
 * tap-to-answer buttons and the respondent enters a name first (for the
 * leaderboard).
 */
export function LiveParticipant({ survey }: { survey: Survey }) {
  const { t } = useTranslation();
  const isQuiz = !!survey.settings.isQuiz;
  const questions = useMemo(
    () => survey.questions.toSorted((a, b) => a.order - b.order),
    [survey.questions],
  );
  const [index, setIndex] = useState<number | null>(null);
  const [phase, setPhase] = useState<LivePhase>("lobby");
  const [value, setValue] = useState<AnswerValue>(undefined);
  const [answeredIndex, setAnsweredIndex] = useState<number | null>(null);
  // Feedback after each answer: points earned this question, running total, and
  // consecutive-correct streak.
  const [lastScore, setLastScore] = useState<number | null>(null);
  const [total, setTotal] = useState(0);
  const [streak, setStreak] = useState(0);
  // When the current question was revealed (for the timer + time-to-answer).
  const [startedAt, setStartedAt] = useState<number | null>(null);
  // Quiz mode collects a name once so scores can be attributed on the leaderboard.
  const [name, setName] = useState("");
  const [joined, setJoined] = useState(!isQuiz);
  const submit = useSubmitResponse(survey.id);
  const joinLive = useJoinLive(survey.id);
  // Begin token satisfies a survey's minimum-submit-time check (not single-use).
  const beginToken = useBeginToken(survey.id, true).data;

  // Announce presence to the presenter's lobby, then keep re-announcing every
  // few seconds while waiting — so a player who joined before the presenter
  // opened the lobby still shows up once the presenter is listening.
  useEffect(() => {
    if (!joined || phase !== "lobby" || !name.trim()) return;
    const announce = () => joinLive.mutate(name.trim());
    announce();
    const id = setInterval(announce, 4000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [joined, phase]);

  // Per-question timer (live quiz only). 0 = no timer.
  const seconds = isQuiz ? survey.settings.liveQuestionSeconds ?? 0 : 0;
  const remaining = useCountdown(startedAt, seconds);
  const expired = remaining === 0;

  useLivePresence(survey.id, true, (state) => {
    setPhase(state.phase);
    setIndex((prev) => {
      if (prev !== state.index) {
        setValue(undefined);
        setAnsweredIndex(null);
        setLastScore(null);
        setStartedAt(Date.now());
      }
      return state.index;
    });
  });

  const question = index != null ? questions[index] : undefined;
  const answered = answeredIndex === index;

  // Chime only when the presenter reveals, matching the on-screen reveal (and
  // never leaking correctness early).
  useEffect(() => {
    if (isQuiz && phase === "reveal" && answered) {
      if ((lastScore ?? 0) > 0) playCorrect();
      else playWrong();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  async function send(answer: AnswerValue) {
    if (!question || expired) return;
    const error = validateAnswer(question, answer, t);
    if (error) {
      toast.error(error);
      return;
    }
    try {
      const res = await submit.mutateAsync({
        answers: [{ questionId: question.id, value: answer }],
        respondentName: isQuiz && name.trim() ? name.trim() : undefined,
        durationMs: elapsedSince(startedAt),
        beginToken: beginToken ?? undefined,
      });
      const gained = res.score ?? 0;
      setLastScore(gained);
      setTotal((prevTotal) => prevTotal + gained);
      setStreak((prevStreak) => (gained > 0 ? prevStreak + 1 : 0));
      setAnsweredIndex(index);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("live.sendFailed"));
    }
  }

  // Quiz: ask for a name before the game starts.
  if (!joined) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-medium">{t("live.enterName")}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="live-name">{t("player.yourName")}</Label>
            <Input
              id="live-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("player.yourNamePlaceholder")}
              autoComplete="name"
              autoFocus
            />
          </div>
          <Button
            disabled={!name.trim()}
            onClick={() => {
              const n = name.trim();
              if (!n) return;
              setJoined(true);
              joinLive.mutate(n);
            }}
          >
            {t("live.join")}
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Joined, waiting for the host to start the game (lobby).
  if (isQuiz && phase === "lobby") {
    return (
      <div className="flex min-h-[60svh] flex-col items-center justify-center gap-3 text-center">
        <Check className="size-10 text-green-600" />
        <p className="text-lg font-semibold">{t("live.youreIn", { name })}</p>
        <p className="text-sm text-muted-foreground">{t("live.waitingHost")}</p>
      </div>
    );
  }

  // The presenter reached the final screen — show the overall outcome.
  if (phase === "results") {
    return (
      <div className="flex flex-col items-center gap-4">
        <h2 className="text-center text-xl font-bold">{t("live.finalResults")}</h2>
        {isQuiz ? (
          <div className="w-full">
            <Leaderboard surveyId={survey.id} />
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">{t("live.ended")}</p>
        )}
      </div>
    );
  }

  if (index == null || !question) {
    return (
      <div className="flex min-h-[60svh] flex-col items-center justify-center gap-3 text-center">
        <Spinner className="size-6 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">{t("live.waitingStart")}</p>
      </div>
    );
  }

  // Presenter revealed the answer — only now do we show whether we were right.
  // Holding it until here means the correct option can't be read off a fast
  // answerer's phone before the reveal.
  if (isQuiz && phase === "reveal") {
    // Correctness comes from the server score, not from the question's correct
    // answers (which aren't sent to phones), so a correct answer scores > 0.
    const correct = (lastScore ?? 0) > 0;
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-medium">
            {question.title || t("player.untitledQuestion")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            {!answered ? (
              <>
                <X className="size-12 text-muted-foreground" />
                <p className="text-lg font-bold">{t("live.noAnswer")}</p>
              </>
            ) : correct ? (
              <>
                <Check className="size-12 text-green-600" />
                <p className="text-lg font-bold">{t("live.correct")}</p>
                <p className="text-2xl font-black tabular-nums text-green-600">
                  +{lastScore}
                </p>
                {streak > 1 && (
                  <p className="text-sm font-medium text-amber-500">
                    {t("live.streak", { count: String(streak) })}
                  </p>
                )}
              </>
            ) : (
              <>
                <X className="size-12 text-destructive" />
                <p className="text-lg font-bold">{t("live.wrong")}</p>
              </>
            )}
            <p className="text-sm text-muted-foreground tabular-nums">
              {t("live.totalPoints", { total: String(total) })}
            </p>
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="size-3 animate-spin" />
              {t("live.waitingNext")}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Answered, waiting for the presenter to reveal — no correctness shown yet.
  if (answered) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-medium">
            {question.title || t("player.untitledQuestion")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <Check className="size-10 text-green-600" />
            <p className="text-sm font-medium">{t("live.answerSent")}</p>
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="size-3 animate-spin" />
              {t("live.waitingNext")}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Quiz single-choice → big tap-to-answer buttons.
  const bigButtons = isQuiz && BIG_CHOICE_TYPES.has(question.type);
  const options = question.options ?? [];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-lg font-semibold">
            {question.title || t("player.untitledQuestion")}
          </CardTitle>
          {remaining != null && (
            <span
              className={`shrink-0 rounded-full border px-3 py-1 text-sm font-bold tabular-nums ${
                remaining <= 5 ? "border-destructive text-destructive" : ""
              }`}
            >
              {remaining}s
            </span>
          )}
        </div>
        {question.description && (
          <p className="text-sm text-muted-foreground">{question.description}</p>
        )}
      </CardHeader>
      <CardContent className="grid gap-4">
        {expired ? (
          <p className="py-8 text-center text-sm font-medium text-muted-foreground">
            {t("live.timesUp")}
          </p>
        ) : bigButtons && options.length > 0 ? (
          // Buzzer: colour + shape only (no text) — players read the options off
          // the presenter screen. The label rides along as the aria-label.
          <div className="grid gap-3 sm:grid-cols-2">
            {options.map((opt, i) => {
              const tile = answerTile(i);
              return (
                <button
                  key={opt.id}
                  type="button"
                  aria-label={opt.label}
                  disabled={submit.isPending}
                  onClick={() => send(opt.id)}
                  className={`flex min-h-28 items-center justify-center rounded-xl text-white transition-colors disabled:opacity-60 ${tile.color}`}
                >
                  <tile.Shape className="size-12" strokeWidth={2.5} aria-hidden />
                </button>
              );
            })}
          </div>
        ) : (
          <>
            {(() => {
              const { Preview } = getQuestionTypeDefinition(question.type);
              return <Preview question={question} value={value} onChange={setValue} />;
            })()}
            <Button onClick={() => send(value)} disabled={submit.isPending}>
              {submit.isPending && <Spinner className="size-4" />}
              {t("live.submitAnswer")}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
