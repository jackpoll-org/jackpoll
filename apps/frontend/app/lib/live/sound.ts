// Tiny synthesized game sounds for the Quiz game — generated with the Web Audio
// API so there are no audio asset files to ship or license. All calls are
// no-ops on the server or when the browser has no AudioContext, and the context
// resumes on the first user gesture (Start button, answer tap).

let ctx: AudioContext | null = null;

function audio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

function tone(
  freq: number,
  durationMs: number,
  type: OscillatorType = "sine",
  gain = 0.05,
  delaySec = 0,
): void {
  const ac = audio();
  if (!ac) return;
  const start = ac.currentTime + delaySec;
  const end = start + durationMs / 1000;
  const osc = ac.createOscillator();
  const vol = ac.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  vol.gain.setValueAtTime(gain, start);
  vol.gain.exponentialRampToValueAtTime(0.0001, end);
  osc.connect(vol).connect(ac.destination);
  osc.start(start);
  osc.stop(end);
}

/** Countdown tick (last few seconds). */
export function playTick(): void {
  tone(880, 80, "square", 0.03);
}

/** Correct answer — rising two-tone. */
export function playCorrect(): void {
  tone(660, 120, "sine", 0.06);
  tone(990, 200, "sine", 0.06, 0.12);
}

/** Wrong answer — low buzz. */
export function playWrong(): void {
  tone(160, 300, "sawtooth", 0.05);
}

/** Answer reveal sting. */
export function playReveal(): void {
  tone(520, 120, "triangle", 0.05);
  tone(780, 220, "triangle", 0.05, 0.12);
}
