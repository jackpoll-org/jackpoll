"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Check, CheckCircle2 } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { Checkbox } from "@/app/components/ui/checkbox";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/app/components/ui/card";
import { Spinner } from "@/app/components/ui/spinner";
import { Badge } from "@/app/components/ui/badge";
import { getQuestionTypeDefinition } from "@/app/components/question-types/registry";
import { useSubmitResponse } from "@/app/hooks/survey";
import { validateAnswer, type AnswerValue } from "@/app/lib/survey/validation";
import { isQuestionVisible } from "@/app/lib/survey/logic";
import { buildPages } from "@/app/lib/survey/pagination";
import { matchOutcome } from "@/app/lib/survey/outcomes";
import { resolvePiping } from "@/app/lib/survey/piping";
import { normalizeRedirectUrl } from "@/app/lib/survey/redirect";
import { trackEvent } from "@/app/lib/survey/track";
import { LiveResultsSummary } from "./live-results-summary";
import { LiveParticipant } from "@/app/components/live/live-participant";
import { BrandingHeader, PoweredBy, brandingStyle } from "./branding-frame";
import { SaveLaterDialog } from "./save-later-dialog";
import { AltchaWidget } from "./altcha-widget";
import {
  useSaveDraft,
  useDeleteDraft,
  useBeginToken,
  useEditResponse,
} from "@/app/hooks/survey";
import { altchaChallengeUrl } from "@/app/lib/survey/api";
import { getClientId } from "@/app/lib/survey/client-id";
import {
  answersToInputs,
  clearLocalDraft,
  loadLocalDraft,
  saveLocalDraft,
} from "@/app/lib/survey/draft-storage";
import { useTranslation } from "@/app/i18n/context";
import { LOCALE_LABELS } from "@/app/i18n/translations";
import {
  isMultilingual,
  localizeSurvey,
  resolveContentLocale,
} from "@/app/lib/survey/content-i18n";
import { fullOptionIds } from "@/app/lib/survey/quota";
import { enqueueSubmission } from "@/app/lib/survey/offline-queue";
import { hNotify, hSelection, NotificationType } from "@/app/lib/native/haptics";
import {
  firstErrorId,
  prefersReducedMotion,
  questionIds,
  scrollToTop,
} from "@/app/lib/survey/a11y";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/app/components/ui/select";
import type {
  AnswerInput,
  Question,
  SubmitResponseRequest,
  Survey,
  SurveyResponseDto,
} from "@/app/types/survey";
import { cn } from "@/lib/utils";

/** Wrapped so the impure clock read isn't treated as a render-time call. */
function nowMs(): number {
  return Date.now();
}

/** Question types that fire a single haptic tick when the answer changes. */
const DISCRETE_CHOICE_TYPES = new Set<string>([
  "multiple-choice",
  "checkboxes",
  "dropdown",
  "multiple-choice-grid",
  "checkbox-grid",
]);

/** A fetch network failure (offline / unreachable) rather than a server error. */
function isNetworkError(err: unknown): boolean {
  if (typeof navigator !== "undefined" && !navigator.onLine) return true;
  return err instanceof TypeError;
}

function formatClock(totalSeconds: number): string {
  const s = Math.max(0, totalSeconds);
  const mm = Math.floor(s / 60);
  const ss = s % 60;
  return `${mm}:${ss.toString().padStart(2, "0")}`;
}

/**
 * Interactive survey player. Holds local answer state, shows real-time
 * validation (issue #4) and persists the response on submit (issue #12).
 */
export function SurveyPlayer({
  survey: baseSurvey,
  analytics = false,
  initialAnswers,
  initialDraftToken,
  editToken,
  preview = false,
}: {
  survey: Survey;
  /** Enable the cookieless analytics beacon — set on public surfaces only (#34). */
  analytics?: boolean;
  /** Builder preview tab: submissions are flagged as test data (#). */
  preview?: boolean;
  /** Answers to pre-fill when resuming a saved draft (issue #26). */
  initialAnswers?: Record<string, AnswerValue>;
  /** Server draft token when resuming, so re-saves update the same draft. */
  initialDraftToken?: string;
  /** When set, the player edits an existing response in place (issue #40). */
  editToken?: string;
}) {
  const { t, locale } = useTranslation();
  // Multilingual content (issue #37): resolve a content language and render a
  // translated copy of the survey. Ids stay canonical so answers/results align.
  const [contentLang, setContentLang] = useState<string | undefined>(() =>
    resolveContentLocale(baseSurvey, locale),
  );
  const survey = useMemo(
    () => localizeSurvey(baseSurvey, contentLang),
    [baseSurvey, contentLang],
  );
  const [answers, setAnswers] = useState<Record<string, AnswerValue>>(
    () => initialAnswers ?? {},
  );
  const [errors, setErrors] = useState<Record<string, string | null>>({});
  const [submitted, setSubmitted] = useState(false);
  const [result, setResult] = useState<SurveyResponseDto | null>(null);
  // Set when a submission was stored offline and will sync later (mobile #2).
  const [queuedOffline, setQueuedOffline] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [page, setPage] = useState(0);
  // Accessibility (issue #45): screen-reader announcements + focus targets.
  const [stepAnnounce, setStepAnnounce] = useState("");
  const [errorAnnounce, setErrorAnnounce] = useState("");
  const topRef = useRef<HTMLDivElement>(null);
  const mountedRef = useRef(false);
  const startedAt = useRef<number>(0);
  const startedTracked = useRef(false);
  const draftToken = useRef<string | undefined>(initialDraftToken);
  const localRestored = useRef(false);
  const submitResponse = useSubmitResponse(survey.id);
  const editResponse = useEditResponse(editToken ?? "");
  const isEditing = !!editToken;
  const saveDraft = useSaveDraft(survey.id);
  const deleteDraft = useDeleteDraft();

  // Spam & bot protection (issue #31) — only on public surfaces.
  const honeypot = useRef("");
  const [captcha, setCaptcha] = useState<string | null>(null);
  const beginToken = useBeginToken(survey.id, analytics).data;
  const requireCaptcha = analytics && survey.settings.requireCaptcha;

  // Optional respondent receipt (issue #24).
  const offerReceipt = analytics && !!survey.settings.respondentReceipts;
  const [receiptEmail, setReceiptEmail] = useState("");

  // Respondent privacy notice & consent (issue #63).
  const privacyNotice = survey.settings.privacyNotice?.trim();
  const requireConsent = !isEditing && !!survey.settings.requireConsent;
  const [consent, setConsent] = useState(false);

  // Require + collect the respondent's name when the owner enabled it (#).
  const requireName = !isEditing && !!survey.settings.requireRespondentName;
  const [respondentName, setRespondentName] = useState("");

  // Restore a local autosave once on mount, unless resuming a server draft.
  useEffect(() => {
    if (localRestored.current || initialAnswers) return;
    localRestored.current = true;
    const stored = loadLocalDraft(survey.id);
    if (stored && Object.keys(stored.answers).length > 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setAnswers(stored.answers as Record<string, AnswerValue>);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Autosave answers locally whenever they change (instant, offline-friendly).
  useEffect(() => {
    if (submitted || Object.keys(answers).length === 0) return;
    saveLocalDraft(survey.id, answers);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSavedAt(nowMs());
  }, [answers, submitted, survey.id]);

  // Paginate by section (#28); flat surveys collapse to a single page.
  const pages = useMemo(() => buildPages(survey, answers), [survey, answers]);
  const pageCount = pages.length;
  const currentPageIndex = Math.min(page, Math.max(0, pageCount - 1));
  const currentPage = pages[currentPageIndex];
  const isLastPage = currentPageIndex >= pageCount - 1;

  const isTimed = survey.settings.isQuiz && !!survey.settings.timeLimit;
  const [remaining, setRemaining] = useState(survey.settings.timeLimit ?? 0);

  // Record when the respondent started (in an effect to keep render pure).
  useEffect(() => {
    startedAt.current = nowMs();
  }, []);

  // Fire the cookieless "view" beacon once on public surfaces (#34).
  useEffect(() => {
    if (analytics) trackEvent(survey.id, "view");
  }, [analytics, survey.id]);

  // Announce page changes and move focus to the top of the new page (#45).
  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      return;
    }
    if (pageCount > 1) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setStepAnnounce(
        t("player.stepOf", { current: currentPageIndex + 1, total: pageCount }),
      );
    }
    topRef.current?.focus();
    scrollToTop();
  }, [currentPageIndex, pageCount, t]);

  // Keep a ref to the latest auto-submit so the timer isn't stale. doSubmit is
  // a hoisted function declared below; referencing it here is safe and this
  // effect (no deps) refreshes the ref every render.
  const autoSubmitRef = useRef<() => void>(() => {});
  useEffect(() => {
    // eslint-disable-next-line react-hooks/immutability
    autoSubmitRef.current = () => void doSubmit(false);
  });

  // Quiz countdown + auto-submit on expiry (issue #10).
  useEffect(() => {
    if (!isTimed || submitted) return;
    if (remaining <= 0) {
      autoSubmitRef.current();
      return;
    }
    const timer = setTimeout(() => setRemaining((r) => r - 1), 1000);
    return () => clearTimeout(timer);
  }, [isTimed, submitted, remaining]);

  // Presenter-paced live mode (#): a real respondent answers only the question
  // the host is currently presenting, not the whole form at once.
  if (analytics && !isEditing && !preview && survey.settings.liveMode) {
    return (
      <div className="grid gap-4">
        <div>
          <h2 className="text-2xl font-bold">{survey.title || t("player.untitledSurvey")}</h2>
          {survey.description && (
            <p className="mt-1 text-muted-foreground">{survey.description}</p>
          )}
        </div>
        <LiveParticipant survey={survey} />
      </div>
    );
  }

  if (submitted) {
    return (
      <ConfirmationScreen
        survey={survey}
        result={result}
        answers={answers}
        isEditing={isEditing}
        queued={queuedOffline}
        onReset={() => {
          setSubmitted(false);
          setResult(null);
          setQueuedOffline(false);
          setAnswers({});
          setErrors({});
          setPage(0);
          clearLocalDraft(survey.id);
        }}
      />
    );
  }

  // Scheduled opening (issue #39): show a "not open yet" state before opensAt
  // on public surfaces. Owners can still preview in the builder (analytics=false).
  const opensAt = survey.settings.opensAt;
  if (analytics && opensAt && new Date(opensAt).getTime() > nowMs()) {
    return (
      <Card className="mx-auto max-w-xl text-center">
        <CardContent className="py-12 text-sm text-muted-foreground">
          {t("player.notOpenYet", {
            date: new Date(opensAt).toLocaleString(),
          })}
        </CardContent>
      </Card>
    );
  }

  const closesAt = survey.settings.closesAt;
  if (closesAt && new Date(closesAt).getTime() < nowMs()) {
    return (
      <Card className="mx-auto max-w-xl text-center">
        <CardContent className="py-12 text-sm text-muted-foreground">
          {t("player.closed")}
        </CardContent>
      </Card>
    );
  }

  if (survey.questions.length === 0 || pageCount === 0 || !currentPage) {
    return (
      <p className="py-12 text-center text-sm text-muted-foreground">
        {t("player.noQuestions")}
      </p>
    );
  }

  function setAnswer(question: Question, value: AnswerValue) {
    if (analytics && !startedTracked.current) {
      startedTracked.current = true;
      trackEvent(survey.id, "start");
    }
    setAnswers((prev) => ({ ...prev, [question.id]: value }));
    setErrors((prev) => ({ ...prev, [question.id]: validateAnswer(question, value, t) }));
    // Tick on discrete choice picks only — not on text typing or slider drags,
    // which fire continuously.
    if (DISCRETE_CHOICE_TYPES.has(question.type)) void hSelection();
  }

  // Wordcloud presentation mode (#): each word is sent live as its own response
  // rather than batched into the survey submit. We omit clientId so the
  // one-per-browser guard doesn't block later words, but DO send the begin token
  // — it's not single-use and satisfies a survey's minimum-submit-time check.
  // The captcha token isn't consumed server-side either (SpamProtectionService
  // re-verifies it cryptographically each call), so the same solved token is
  // reused across every word in the page without asking the respondent again.
  async function submitWord(question: Question, value: AnswerValue) {
    const words = Array.isArray(value) ? value : [];
    if (words.length === 0) return;
    if (requireCaptcha && !captcha) {
      toast.error(t("spam.captchaRequired"));
      return;
    }
    if (analytics && !startedTracked.current) {
      startedTracked.current = true;
      trackEvent(survey.id, "start");
    }
    await submitResponse.mutateAsync({
      durationMs: nowMs() - startedAt.current,
      answers: [{ questionId: question.id, value: words }],
      honeypot: analytics ? honeypot.current : undefined,
      beginToken: analytics ? (beginToken ?? undefined) : undefined,
      captcha: requireCaptcha ? (captcha ?? undefined) : undefined,
      preview: preview || undefined,
    });
    if (analytics) trackEvent(survey.id, "submit");
  }

  /** Wordcloud answers are sent live per word, so they never join the batch. */
  function isInstant(question: Question): boolean {
    return analytics && !isEditing && question.type === "wordcloud";
  }

  /** Move focus + screen-reader announcement to the first errored question (#45). */
  function announceErrors(
    errs: Record<string, string | null>,
    questions: Question[],
  ) {
    const count = questions.filter((q) => errs[q.id]).length;
    if (count === 0) return;
    setErrorAnnounce(t("player.errorsAnnounce", { count }));
    const id = firstErrorId(questions, errs);
    if (id && typeof document !== "undefined") {
      const el = document.getElementById(questionIds(id).group);
      el?.focus();
      el?.scrollIntoView({
        block: "center",
        behavior: prefersReducedMotion() ? "auto" : "smooth",
      });
    }
  }

  async function doSubmit(validate: boolean) {
    const visible = survey.questions.filter(
      (q) => isQuestionVisible(q, answers) && !isInstant(q),
    );
    if (validate) {
      const nextErrors: Record<string, string | null> = {};
      let hasError = false;
      for (const question of visible) {
        const error = validateAnswer(question, answers[question.id], t);
        nextErrors[question.id] = error;
        if (error) hasError = true;
      }
      setErrors(nextErrors);
      if (hasError) {
        void hNotify(NotificationType.Error);
        toast.error(t("player.fixErrors"));
        announceErrors(nextErrors, visible);
        return;
      }
    }

    // Block submit until the CAPTCHA is solved (server enforces this too).
    if (requireCaptcha && !captcha) {
      toast.error(t("spam.captchaRequired"));
      return;
    }

    // Require consent before submitting when the owner enabled it (#63).
    if (requireConsent && !consent) {
      toast.error(t("privacy.consentRequired"));
      return;
    }

    // Require the respondent's name when the owner enabled it (#).
    if (requireName && !respondentName.trim()) {
      toast.error(t("player.nameRequired"));
      return;
    }

    const answerInputs: AnswerInput[] = visible.flatMap((q) => {
      const value = answers[q.id];
      return value !== undefined && value !== null && value !== ""
        ? [{ questionId: q.id, value }]
        : [];
    });

    // A normal submission carries spam hints / receipt opt-in (#31/#24); the
    // server re-checks all of them.
    const payload: SubmitResponseRequest = {
      durationMs: nowMs() - startedAt.current,
      answers: answerInputs,
      honeypot: analytics ? honeypot.current : undefined,
      beginToken: analytics ? (beginToken ?? undefined) : undefined,
      clientId: analytics ? getClientId() : undefined,
      captcha: captcha ?? undefined,
      respondentEmail:
        offerReceipt && receiptEmail.trim() ? receiptEmail.trim() : undefined,
      preview: preview || undefined,
      respondentName: requireName ? respondentName.trim() : undefined,
      // The receipt is written in the language the form was answered in — the
      // respondent has no account we could look one up from.
      locale,
    };

    const finishSubmitted = () => {
      setSubmitted(true);
      // A draft is no longer needed once the response is recorded (#26).
      clearLocalDraft(survey.id);
      if (draftToken.current) {
        void deleteDraft.mutateAsync(draftToken.current).catch(() => {});
      }
    };

    // Pure wordcloud survey: every word was already sent live as its own
    // response, so there's nothing left to batch — confirm without creating an
    // empty response.
    if (
      !isEditing &&
      answerInputs.length === 0 &&
      survey.questions.some((q) => isInstant(q))
    ) {
      setResult(null);
      void hNotify(NotificationType.Success);
      if (analytics) trackEvent(survey.id, "submit");
      finishSubmitted();
      return;
    }

    const offline = typeof navigator !== "undefined" && !navigator.onLine;

    // Editing an existing response needs a connection (#53) — tell the user.
    if (isEditing && offline) {
      toast.error(t("edit.offlineBlocked"));
      return;
    }

    // Offline (mobile phase 2): queue a fresh submission and confirm; it syncs
    // when the connection returns.
    if (!isEditing && offline) {
      await enqueueSubmission(survey.id, payload);
      setResult(null);
      setQueuedOffline(true);
      finishSubmitted();
      return;
    }

    try {
      // Editing (issue #40) updates the response in place; otherwise create one.
      const res = isEditing
        ? await editResponse.mutateAsync({
            durationMs: payload.durationMs,
            answers: answerInputs,
          })
        : await submitResponse.mutateAsync(payload);
      setResult(res);
      // Quiz: warn on a failed attempt, celebrate a pass; otherwise plain success.
      void hNotify(
        res?.passed === false ? NotificationType.Warning : NotificationType.Success,
      );
      if (analytics && !isEditing) trackEvent(survey.id, "submit");
      finishSubmitted();
    } catch (err) {
      // A network failure on a fresh submission → queue it for later sync.
      if (!isEditing && isNetworkError(err)) {
        await enqueueSubmission(survey.id, payload);
        setResult(null);
        setQueuedOffline(true);
        finishSubmitted();
        return;
      }
      void hNotify(NotificationType.Error);
      toast.error(err instanceof Error ? err.message : t("player.submitFailed"));
    }
  }

  /** Validate the visible questions on the current page before advancing. */
  function validateCurrentPage(): boolean {
    const questions = currentPage?.questions ?? [];
    const nextErrors: Record<string, string | null> = {};
    let hasError = false;
    for (const question of questions) {
      const error = validateAnswer(question, answers[question.id], t);
      nextErrors[question.id] = error;
      if (error) hasError = true;
    }
    setErrors((prev) => ({ ...prev, ...nextErrors }));
    if (hasError) {
      toast.error(t("player.fixErrors"));
      announceErrors(nextErrors, questions);
    }
    return !hasError;
  }

  function goNext() {
    if (!validateCurrentPage()) return;
    setPage(currentPageIndex + 1);
  }

  function goBack() {
    setPage(Math.max(0, currentPageIndex - 1));
  }

  /** Persist a server-side draft and return its resume token (issue #26). */
  async function handleSaveLater(): Promise<string> {
    const draft = await saveDraft.mutateAsync({
      token: draftToken.current,
      answers: answersToInputs(answers),
    });
    draftToken.current = draft.token;
    return draft.token;
  }

  return (
    <div className="grid gap-4" style={brandingStyle(survey)}>
      {/* Screen-reader announcements for step changes and validation (#45). */}
      <div aria-live="polite" className="sr-only">
        {stepAnnounce}
      </div>
      <div aria-live="assertive" role="status" className="sr-only">
        {errorAnnounce}
      </div>
      <BrandingHeader survey={survey} />
      {isMultilingual(baseSurvey) && (
        <div className="flex justify-end">
          <Select
            value={contentLang ?? ""}
            onValueChange={(v) => setContentLang(v)}
          >
            <SelectTrigger className="w-44" aria-label={t("content.language")}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(baseSurvey.languages ?? []).map((l) => (
                <SelectItem key={l} value={l}>
                  {LOCALE_LABELS[l as keyof typeof LOCALE_LABELS] ?? l}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      {isTimed && (
        <div
          className={cn(
            "sticky top-2 z-10 self-start rounded-md border bg-card px-3 py-1.5 text-sm font-medium tabular-nums",
            remaining < 60 && "border-destructive text-destructive",
          )}
        >
          {t("player.timeLeft", { time: formatClock(remaining) })}
        </div>
      )}
      <div ref={topRef} tabIndex={-1} className="outline-none">
        <h2 className="text-2xl font-bold">
          {survey.title || t("player.untitledSurvey")}
        </h2>
        {survey.description && (
          <p className="mt-1 text-muted-foreground">{survey.description}</p>
        )}
      </div>

      {/* Solved once, right at entry (like a Cloudflare-style gate), instead of
          at final submit — the token isn't consumed server-side so the same
          solve covers every submission, including instant ones (wordcloud
          words) that used to hit a 400 with no captcha attached (#). */}
      {requireCaptcha && !isEditing && currentPageIndex === 0 && (
        <AltchaWidget
          challengeUrl={altchaChallengeUrl(survey.id)}
          onVerified={setCaptcha}
        />
      )}

      {requireName && currentPageIndex === 0 && (
        <div className="grid gap-1.5">
          <Label htmlFor="respondent-name">
            {t("player.yourName")}
            <span aria-hidden className="ml-1 text-destructive">*</span>
          </Label>
          <Input
            id="respondent-name"
            value={respondentName}
            onChange={(e) => setRespondentName(e.target.value)}
            placeholder={t("player.yourNamePlaceholder")}
            autoComplete="name"
            required
          />
        </div>
      )}

      {pageCount > 1 && survey.settings.showProgressBar && (
        <div className="grid gap-1">
          <div
            className="h-2 w-full overflow-hidden rounded-full bg-primary/20"
            role="progressbar"
            aria-valuenow={currentPageIndex + 1}
            aria-valuemin={1}
            aria-valuemax={pageCount}
            aria-label={t("player.stepOf", {
              current: currentPageIndex + 1,
              total: pageCount,
            })}
          >
            <div
              className="h-full bg-primary motion-safe:transition-all"
              style={{ width: `${((currentPageIndex + 1) / pageCount) * 100}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            {t("player.stepOf", {
              current: currentPageIndex + 1,
              total: pageCount,
            })}
          </p>
        </div>
      )}

      {(currentPage.title || currentPage.description) && (
        <div>
          {currentPage.title && (
            <h3 className="text-lg font-semibold">{currentPage.title}</h3>
          )}
          {currentPage.description && (
            <p className="text-sm text-muted-foreground">
              {currentPage.description}
            </p>
          )}
        </div>
      )}

      {currentPage.questions.map((question) => {
        const { Preview } = getQuestionTypeDefinition(question.type);
        const error = errors[question.id];
        const currentValue = answers[question.id];
        const fullIds = fullOptionIds(
          question,
          typeof currentValue === "string" ? currentValue : undefined,
        );
        const ids = questionIds(question.id);
        return (
          <Card
            key={question.id}
            id={ids.group}
            tabIndex={-1}
            role="group"
            aria-labelledby={ids.title}
            aria-describedby={error ? ids.error : undefined}
            className={cn(
              "outline-none focus-visible:ring-2 focus-visible:ring-ring",
              error && "border-destructive",
            )}
          >
            <CardHeader>
              <CardTitle id={ids.title} className="text-base font-medium">
                {resolvePiping(question.title, answers, survey.questions) ||
                  t("player.untitledQuestion")}
                {question.required && (
                  <>
                    <span aria-hidden className="ml-1 text-destructive">
                      *
                    </span>
                    <span className="sr-only"> ({t("player.required")})</span>
                  </>
                )}
              </CardTitle>
              {question.description && (
                <p className="text-sm text-muted-foreground">
                  {resolvePiping(question.description, answers, survey.questions)}
                </p>
              )}
            </CardHeader>
            <CardContent className="grid gap-2">
              <Preview
                question={question}
                value={answers[question.id]}
                onChange={(value) => setAnswer(question, value)}
                onInstantSubmit={
                  isInstant(question)
                    ? (value) => submitWord(question, value)
                    : undefined
                }
                disabledOptionIds={fullIds.length > 0 ? fullIds : undefined}
              />
              {error && (
                <p id={ids.error} role="alert" className="text-sm text-destructive">
                  {error}
                </p>
              )}
            </CardContent>
          </Card>
        );
      })}

      {/* Honeypot — hidden from humans, tempting to bots (#31). */}
      {analytics && !isEditing && (
        <div aria-hidden className="absolute left-[-9999px] h-0 w-0 overflow-hidden">
          <label>
            Leave this field empty
            <input
              type="text"
              tabIndex={-1}
              autoComplete="off"
              defaultValue=""
              onChange={(e) => {
                honeypot.current = e.target.value;
              }}
            />
          </label>
        </div>
      )}

      {isLastPage && !isEditing && (privacyNotice || requireConsent) && (
        <div className="grid gap-2 rounded-md border bg-muted/30 p-3 text-sm">
          {privacyNotice && (
            <p className="whitespace-pre-wrap text-muted-foreground">{privacyNotice}</p>
          )}
          {requireConsent && (
            <label
              htmlFor="respondent-consent"
              className="flex items-start gap-2 font-medium"
            >
              <Checkbox
                id="respondent-consent"
                checked={consent}
                onCheckedChange={(c) => setConsent(c === true)}
                className="mt-0.5"
              />
              <span>{t("privacy.consentLabel")}</span>
            </label>
          )}
        </div>
      )}

      {offerReceipt && isLastPage && !isEditing && (
        <div className="grid max-w-sm gap-1">
          <label htmlFor="receipt-email" className="text-sm font-medium">
            {t("receipt.label")}
          </label>
          <input
            id="receipt-email"
            type="email"
            value={receiptEmail}
            onChange={(e) => setReceiptEmail(e.target.value)}
            placeholder={t("receipt.placeholder")}
            className="rounded-md border bg-background px-3 py-2 text-sm"
          />
          <p className="text-xs text-muted-foreground">{t("receipt.note")}</p>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        {currentPageIndex > 0 && (
          <Button type="button" variant="outline" onClick={goBack}>
            {t("common.back")}
          </Button>
        )}
        {isLastPage ? (
          <Button
            onClick={() => doSubmit(true)}
            disabled={isEditing ? editResponse.isPending : submitResponse.isPending}
          >
            {(isEditing ? editResponse.isPending : submitResponse.isPending) && (
              <Spinner className="size-4" />
            )}
            {isEditing ? t("edit.save") : t("common.submit")}
          </Button>
        ) : (
          <Button type="button" onClick={goNext}>
            {t("common.next")}
          </Button>
        )}
        {analytics && !isEditing && <SaveLaterDialog onSave={handleSaveLater} />}
        {analytics && !isEditing && savedAt !== null && (
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <Check className="size-3" />
            {t("draft.saved")}
          </span>
        )}
      </div>

      <PoweredBy survey={survey} />
    </div>
  );
}

/** Post-submission confirmation (#9) with quiz score when applicable (#10). */
function ConfirmationScreen({
  survey,
  result,
  answers,
  isEditing,
  queued,
  onReset,
}: {
  survey: Survey;
  result: SurveyResponseDto | null;
  answers: Record<string, AnswerValue>;
  isEditing: boolean;
  queued: boolean;
  onReset: () => void;
}) {
  const { t } = useTranslation();
  const rawMessage = queued
    ? t("offline.queued")
    : isEditing
      ? t("edit.updated")
      : survey.settings.confirmationMessage?.trim() ||
        t("player.defaultConfirmation");
  const message = resolvePiping(rawMessage, answers, survey.questions);
  // Normalise to a safe absolute http(s) URL — a bare host like "example.com"
  // resolves to https://…, and any non-http(s) scheme is dropped (see
  // redirect.ts) so a malicious redirectUrl can't run script from the href.
  const redirectUrl =
    normalizeRedirectUrl(survey.settings.redirectUrl) ?? undefined;
  const showScore = survey.settings.isQuiz && result?.score != null;
  // Score-based outcome page (#83) — takes over the confirmation when matched.
  const outcome = survey.settings.isQuiz
    ? matchOutcome(survey.settings.outcomes, result?.score ?? null)
    : null;
  const showSummary =
    survey.settings.showLiveResults && survey.settings.postSubmitSummary;
  // A fresh (non-edit) submit returns an edit token when the survey allows
  // editing (issue #40); surface the link so the respondent can change it later.
  const editToken = !isEditing ? result?.editToken : null;

  function copyEditLink() {
    if (!editToken || typeof window === "undefined") return;
    const url = `${window.location.origin}/e/${editToken}`;
    void navigator.clipboard
      .writeText(url)
      .then(() => toast.success(t("edit.linkCopied")))
      .catch(() => toast.error(t("edit.linkCopyFailed")));
  }

  return (
    <div className="mx-auto grid max-w-xl gap-4" style={brandingStyle(survey)}>
      <BrandingHeader survey={survey} />
      <Card className="text-center">
        <CardContent className="flex flex-col items-center gap-4 py-12">
          {outcome ? (
            <div className="flex flex-col items-center gap-3">
              {outcome.imageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={outcome.imageUrl}
                  alt=""
                  className="size-28 rounded-lg object-cover"
                />
              )}
              <p className="text-2xl font-bold">{outcome.title}</p>
              {outcome.description && (
                <p className="text-muted-foreground">{outcome.description}</p>
              )}
            </div>
          ) : (
            <>
              <CheckCircle2 className="size-12 text-primary" />
              <p className="text-lg font-medium">{message}</p>
            </>
          )}

          {showScore && (
            <div className="flex flex-col items-center gap-2">
              <p className="text-3xl font-bold">
                {result!.score} / {result!.maxScore}
              </p>
              {result!.passed != null && (
                <Badge variant={result!.passed ? "default" : "destructive"}>
                  {result!.passed ? t("player.passed") : t("player.failed")}
                </Badge>
              )}
            </div>
          )}

          {editToken && (
            <div className="flex flex-col items-center gap-2">
              <p className="text-sm text-muted-foreground">{t("edit.hint")}</p>
              <div className="flex flex-wrap items-center justify-center gap-2">
                <Button variant="outline" asChild>
                  <Link href={`/e/${editToken}`}>{t("edit.link")}</Link>
                </Button>
                <Button variant="ghost" onClick={copyEditLink}>
                  {t("edit.copyLink")}
                </Button>
              </div>
            </div>
          )}

          <div className="flex flex-wrap justify-center gap-2">
            {redirectUrl && (
              <Button asChild>
                <a href={redirectUrl} target="_blank" rel="noopener noreferrer">
                  {t("player.continue")}
                </a>
              </Button>
            )}
            {!isEditing && (
              <Button variant="outline" onClick={onReset}>
                {t("player.submitAnother")}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {showSummary && <LiveResultsSummary survey={survey} />}
      <PoweredBy survey={survey} />
    </div>
  );
}
