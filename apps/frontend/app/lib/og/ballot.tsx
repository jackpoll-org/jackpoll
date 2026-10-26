export interface BallotQuestion {
  question: string;
  options: string[];
  more: string;
  total: number;
}

export function isDark(hex: string): boolean {
  const n = parseInt(hex.slice(1), 16);
  return (n >> 16) * 0.299 + ((n >> 8) & 255) * 0.587 + (n & 255) * 0.114 < 150;
}

// Satori fetches emoji from a CDN at render time; offline installs would fail the whole image.
const EMOJI = /(?![\u00a9\u00ae\u2122])\p{Extended_Pictographic}|[\p{Emoji_Modifier}\p{Regional_Indicator}\u200d\ufe0f\u20e3\u{e0020}-\u{e007f}]/gu;

export function clamp(text: string, max: number): string {
  const flat = text.replace(EMOJI, "").replace(/\s+/g, " ").trim();
  if (flat.length <= max) return flat;
  const cut = flat.slice(0, max + 1).replace(/\s*\S*$/, "") || flat.slice(0, max);
  return `${cut.replace(/[\s\-–—,;:]+$/, "")}…`;
}

export function alpha(hex: string, opacity: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${opacity})`;
}

function Cross({ color }: { color: string }) {
  return (
    <svg width={40} height={40} viewBox="0 0 46 46" style={{ position: "absolute", top: -9, left: -7 }}>
      <path d="M9 11 C 17 18, 25 27, 37 36" stroke={color} strokeWidth={5} strokeLinecap="round" fill="none" />
      <path d="M35 8 C 28 17, 19 27, 11 37" stroke={color} strokeWidth={5} strokeLinecap="round" fill="none" />
    </svg>
  );
}

export function Ballot({ ballot, ink, muted, accent, dark }: { ballot: BallotQuestion; ink: string; muted: string; accent: string; dark: boolean }) {
  const line = dark ? "rgba(241,245,249,0.18)" : "rgba(11,18,32,0.12)";
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: 440,
        padding: "30px 30px 24px",
        borderRadius: 28,
        background: dark ? "rgba(255,255,255,0.07)" : "#FFFFFF",
        border: `1px solid ${line}`,
        boxShadow: dark ? "none" : `0 28px 64px ${alpha(accent, 0.18)}`,
        transform: "rotate(2deg)",
      }}
    >
      <div style={{ display: "flex", marginBottom: 20, fontSize: 25, fontWeight: 600, lineHeight: 1.3 }}>
        {clamp(ballot.question, 64)}
      </div>
      {ballot.options.map((option, i) => (
        <div
          key={i}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            height: 58,
            marginBottom: 10,
            padding: "0 18px",
            borderRadius: 14,
            border: `2px solid ${i === 0 ? accent : line}`,
            background: i === 0 ? alpha(accent, dark ? 0.22 : 0.08) : "transparent",
          }}
        >
          <div
            style={{
              display: "flex",
              position: "relative",
              width: 26,
              height: 26,
              borderRadius: 999,
              border: `2.5px solid ${i === 0 ? accent : muted}`,
            }}
          >
            {i === 0 && <Cross color={dark ? ink : accent} />}
          </div>
          <div style={{ display: "flex", fontSize: 23 }}>{clamp(option, 26)}</div>
        </div>
      ))}
      {ballot.more && <div style={{ display: "flex", paddingTop: 4, fontSize: 20, color: muted }}>{ballot.more}</div>}
    </div>
  );
}
