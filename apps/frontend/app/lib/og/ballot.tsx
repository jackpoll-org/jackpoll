export interface BallotQuestion {
  question: string;
  options: string[];
  more: string;
}

export function isDark(hex: string): boolean {
  const n = parseInt(hex.slice(1), 16);
  return (n >> 16) * 0.299 + ((n >> 8) & 255) * 0.587 + (n & 255) * 0.114 < 150;
}

// Satori fetches emoji from a CDN at render time; offline installs would fail the whole image.
const EMOJI = /(?![\u00a9\u00ae\u2122])\p{Extended_Pictographic}|[\p{Emoji_Modifier}\p{Regional_Indicator}\u200d\ufe0f\u20e3\u{e0020}-\u{e007f}]/gu;

export function clamp(text: string, max: number): string {
  const flat = text.replace(EMOJI, "").replace(/\s+/g, " ").trim();
  return flat.length <= max ? flat : `${flat.slice(0, max + 1).replace(/\s*\S*$/, "") || flat.slice(0, max)}…`;
}

function Cross({ color }: { color: string }) {
  return (
    <svg width={46} height={46} viewBox="0 0 46 46" style={{ position: "absolute", top: -10, left: -8 }}>
      <path d="M9 11 C 17 18, 25 27, 37 36" stroke={color} strokeWidth={5} strokeLinecap="round" fill="none" />
      <path d="M35 8 C 28 17, 19 27, 11 37" stroke={color} strokeWidth={5} strokeLinecap="round" fill="none" />
    </svg>
  );
}

export function Ballot({ ballot, ink, muted, mark }: { ballot: BallotQuestion; ink: string; muted: string; mark: string }) {
  const rule = `2px solid ${ink}`;
  return (
    <div style={{ display: "flex", flexDirection: "column", width: 470 }}>
      <div style={{ display: "flex", marginBottom: 20, fontSize: 26, fontWeight: 600, lineHeight: 1.3 }}>
        {clamp(ballot.question, 72)}
      </div>
      {ballot.options.map((option, i) => (
        <div
          key={i}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            height: 70,
            borderTop: rule,
          }}
        >
          <div style={{ display: "flex", fontSize: 24 }}>{clamp(option, 30)}</div>
          <div
            style={{
              display: "flex",
              position: "relative",
              width: 30,
              height: 30,
              borderRadius: 999,
              border: `2.5px solid ${ink}`,
            }}
          >
            {i === 0 && <Cross color={mark} />}
          </div>
        </div>
      ))}
      <div style={{ display: "flex", paddingTop: 12, borderTop: rule, fontSize: 20, color: muted }}>{ballot.more}</div>
    </div>
  );
}
