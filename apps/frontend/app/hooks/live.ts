"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { liveJoinApi, setLiveStateApi } from "@/app/lib/survey/api";
import { ResultsLiveSocket, liveResultsEnabled } from "@/app/lib/results/live-socket";
import {
  parseJoinMessage,
  parseLiveMessage,
  type LivePhase,
  type LiveState,
} from "@/app/lib/live/messages";

/**
 * Subscribe to the presenter's live position for a survey (#). Reuses the
 * results WebSocket; invokes `onState` whenever the presenter moves. When live
 * push is unavailable this simply never fires (participant sees the waiting
 * screen) — no polling fallback for control messages.
 */
export function useLivePresence(
  surveyId: string | undefined,
  enabled: boolean,
  onState: (state: LiveState) => void,
): void {
  const cb = useRef(onState);
  useEffect(() => {
    cb.current = onState;
  }, [onState]);

  useEffect(() => {
    if (!surveyId || !enabled || !liveResultsEnabled()) return;
    const socket = new ResultsLiveSocket(surveyId, (data) => {
      const state = parseLiveMessage(data);
      if (state) cb.current(state);
    });
    return () => socket.destroy();
  }, [surveyId, enabled]);
}

/**
 * Whole-second countdown remaining for the live quiz timer (#), from when the
 * current question started for `seconds`. Returns null when there's no timer.
 */
export function useCountdown(startedAt: number | null, seconds: number): number | null {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!startedAt || seconds <= 0) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [startedAt, seconds]);
  if (!startedAt || seconds <= 0) return null;
  return Math.max(0, Math.ceil((startedAt + seconds * 1000 - now) / 1000));
}

/** Presenter action: broadcast the current question index to participants. */
export function useSetLiveState(surveyId: string) {
  return useMutation({
    mutationFn: async (args: { index: number; phase?: LivePhase }) => {
      const res = await setLiveStateApi(surveyId, args.index, args.phase ?? "question");
      if (!res.success) throw new Error(res.error ?? "Failed to update live state");
    },
  });
}

/** Participant action: check in to the lobby with a nickname. */
export function useJoinLive(surveyId: string) {
  return useMutation({
    mutationFn: (name: string) => liveJoinApi(surveyId, name),
  });
}

/**
 * Presenter lobby roster: the unique nicknames of participants who have checked
 * in, accumulated live off the results socket. Also the denominator for the
 * "answered / total" count during questions.
 */
export function useLiveRoster(
  surveyId: string | undefined,
  enabled: boolean,
): string[] {
  const [names, setNames] = useState<string[]>([]);
  useEffect(() => {
    if (!surveyId || !enabled || !liveResultsEnabled()) return;
    const seen = new Set<string>();
    const socket = new ResultsLiveSocket(surveyId, (data) => {
      const name = parseJoinMessage(data);
      if (name && !seen.has(name)) {
        seen.add(name);
        setNames((prev) => [...prev, name]);
      }
    });
    return () => socket.destroy();
  }, [surveyId, enabled]);
  return names;
}
