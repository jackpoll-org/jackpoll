// Shared timing budget for the synced 3-2-1-Go countdown (presenter + participant),
// so both sides animate on identical numbers even though each derives its own local
// timing from when it received the "countdown" phase (no server clock available).

/** How long each of "3", "2", "1" is shown. */
export const COUNTDOWN_STEP_MS = 700;

/** How long "Go!" is held before the presenter starts the real per-question timer. */
export const COUNTDOWN_GO_MS = 500;

export const COUNTDOWN_NUMERALS = [3, 2, 1] as const;

export const COUNTDOWN_TOTAL_MS =
  COUNTDOWN_STEP_MS * COUNTDOWN_NUMERALS.length + COUNTDOWN_GO_MS;
