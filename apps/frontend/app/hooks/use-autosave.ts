"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Survey, UpdateSurveyRequest } from "@/app/types/survey";

const AUTOSAVE_DELAY_MS = 3500;

interface UseAutosaveArgs {
  /** Master switch — autosave only runs for live co-editing sessions (#85). */
  enabled: boolean;
  /** Wait for the collab doc to seed so we don't save mid-sync. */
  ready: boolean;
  /** Only the locally-editing client persists (avoids the N-client echo storm). */
  locallyDirty: boolean;
  /** Latest survey snapshot to persist. */
  survey: Survey;
  /** Persist + return the saved survey (owner REST or passwordless collab). */
  save: (req: UpdateSurveyRequest) => Promise<Survey>;
  /** Build the request body from a survey snapshot. */
  toRequest: (survey: Survey) => UpdateSurveyRequest;
}

interface UseAutosaveResult {
  isAutosaving: boolean;
  /** Persist immediately (e.g. on blur / tab hide) if there are local edits. */
  flush: () => void;
}

/**
 * Debounced autosave for the survey builder (issue #85). Fires ~3.5s after the
 * last *local* edit so live co-editing stays durable without a manual Save, and
 * survives all peers disconnecting. Keyed on `locallyDirty` (not `dirty`) so a
 * client that merely received a remote change never re-saves it.
 */
export function useAutosave({
  enabled,
  ready,
  locallyDirty,
  survey,
  save,
  toRequest,
}: UseAutosaveArgs): UseAutosaveResult {
  const [isAutosaving, setIsAutosaving] = useState(false);

  // Hold the freshest values so the debounced timer always saves the latest
  // snapshot without re-arming on every keystroke.
  const surveyRef = useRef(survey);
  const saveRef = useRef(save);
  const toRequestRef = useRef(toRequest);
  const dirtyRef = useRef(locallyDirty);
  const savingRef = useRef(false);
  useEffect(() => {
    surveyRef.current = survey;
  }, [survey]);
  useEffect(() => {
    saveRef.current = save;
    toRequestRef.current = toRequest;
  }, [save, toRequest]);
  useEffect(() => {
    dirtyRef.current = locallyDirty;
  }, [locallyDirty]);

  const run = useCallback(async () => {
    if (savingRef.current || !dirtyRef.current) return;
    savingRef.current = true;
    setIsAutosaving(true);
    try {
      await saveRef.current(toRequestRef.current(surveyRef.current));
    } catch {
      // Best-effort: a failed autosave stays dirty and retries on the next
      // edit; the manual Save button surfaces hard errors to the user.
    } finally {
      savingRef.current = false;
      setIsAutosaving(false);
    }
  }, []);

  const flush = useCallback(() => {
    void run();
  }, [run]);

  // Debounced trigger: restart the timer on each change while editing locally.
  useEffect(() => {
    if (!enabled || !ready || !locallyDirty) return;
    const timer = setTimeout(() => void run(), AUTOSAVE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [enabled, ready, locallyDirty, survey, run]);

  return { isAutosaving, flush };
}
