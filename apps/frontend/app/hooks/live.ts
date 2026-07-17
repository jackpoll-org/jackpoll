"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { getLiveStateApi, liveJoinApi, setLiveStateApi } from "@/app/lib/survey/api";
import { ResultsLiveSocket, liveResultsEnabled } from "@/app/lib/results/live-socket";
import {
  normalizeLivePhase,
  parseJoinMessage,
  parseLiveMessage,
  type LivePhase,
  type LiveState,
} from "@/app/lib/live/messages";

/** How often to poll the resync fallback while subscribed (see useLivePresence). */
const LIVE_STATE_POLL_MS = 6_000;

/**
 * Subscribe to the presenter's live position for a survey (#). Reuses the
 * results WebSocket as the primary (near-instant) delivery path; invokes
 * `onState` whenever the presenter moves. The push is best-effort end to end
 * (fire-and-forget broadcast, no delivery guarantee — see LivePresentService),
 * so a periodic poll of the last-broadcast-state endpoint runs alongside it as
 * a resync safety net: if the fetched state differs from the last one applied,
 * it's fed through the same `onState` callback, self-healing a participant
 * whose socket missed or silently dropped a message.
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

  const last = useRef<LiveState | null>(null);
  const applyState = (state: LiveState) => {
    last.current = state;
    cb.current(state);
  };

  useEffect(() => {
    if (!surveyId || !enabled || !liveResultsEnabled()) return;
    const socket = new ResultsLiveSocket(surveyId, (data) => {
      const state = parseLiveMessage(data);
      if (state) applyState(state);
    });
    const poll = setInterval(() => {
      getLiveStateApi(surveyId)
        .then((res) => {
          const data = res.data;
          if (!data) return;
          const state: LiveState = { index: data.index, phase: normalizeLivePhase(data.phase) };
          const prev = last.current;
          if (!prev || prev.index !== state.index || prev.phase !== state.phase) {
            applyState(state);
          }
        })
        .catch(() => {
          // Best-effort resync; the socket remains the primary path.
        });
    }, LIVE_STATE_POLL_MS);
    return () => {
      socket.destroy();
      clearInterval(poll);
    };
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

/**
 * Fraction (0..1) of the live quiz timer remaining, ticking every 100ms for a
 * smooth progress-ring animation (vs. useCountdown's 250ms whole-second tick,
 * which stays as-is since auto-reveal/expiry logic depends on its semantics).
 */
export function useCountdownFraction(startedAt: number | null, seconds: number): number | null {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!startedAt || seconds <= 0) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(id);
  }, [startedAt, seconds]);
  if (!startedAt || seconds <= 0) return null;
  return Math.max(0, Math.min(1, (startedAt + seconds * 1000 - now) / (seconds * 1000)));
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
