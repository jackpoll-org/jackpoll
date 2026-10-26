/* eslint-disable @next/next/no-img-element -- rendered by Satori, which has no next/image */
import type { CSSProperties, ReactNode } from "react";
import { DEFAULT_LOCALE, LOCALES, en, translations, type Locale, type TranslationKey } from "@/app/i18n/translations";
import { defaultLanguageOf } from "@/app/lib/survey/content-i18n";
import type { Survey, SurveySettings } from "@/app/types/survey";
import { Ballot, alpha, clamp, isDark, type BallotQuestion } from "./ballot";

export const OG_SIZE = { width: 1200, height: 630 };
export const OG_STYLES = ["classic", "bold", "minimal", "spotlight", "split"] as const satisfies readonly NonNullable<
  SurveySettings["ogStyle"]
>[];
export type OgStyle = (typeof OG_STYLES)[number];

const BRAND = "#024DB2";
const HEX = /^#[0-9a-f]{6}$/i;
const CHOICE_TYPES = new Set(["multiple-choice", "checkboxes", "dropdown"]);
const MAX_OPTIONS = 4;

export type Page = "brand" | "join" | "resume" | "edit";

export interface OgCard {
  title: string;
  description?: string;
  owner?: string;
  /** Kind first ("Umfrage"), then details ("4 Fragen", "ca. 2 Min."). */
  meta: string[];
  cta?: string;
  ballot?: BallotQuestion;
  accent?: string;
  background?: string;
  style?: OgStyle;
}

function text(locale: Locale, key: TranslationKey, n: number | string = 0): string {
  return (translations[locale][key] ?? en[key]).replace(/\{\w+\}/, () => String(n));
}

export function isOgStyle(value: unknown): value is OgStyle {
  return (OG_STYLES as readonly unknown[]).includes(value);
}

export function pageCard(page: Page): OgCard {
  return {
    title: text(DEFAULT_LOCALE, `og.${page}.title`),
    description: text(DEFAULT_LOCALE, `og.${page}.description`),
    meta: [],
    cta: text(DEFAULT_LOCALE, `og.${page}.cta`),
  };
}

const QUESTION_STYLES: ReadonlySet<OgStyle> = new Set(["classic", "spotlight"]);

function previewQuestion(survey: Survey) {
  if (survey.settings.isQuiz || survey.settings.liveMode) return undefined;
  return survey.questions.find((q) => CHOICE_TYPES.has(q.type) && q.options?.some((o) => o.label?.trim()));
}

export function canShowQuestion(survey: Survey, style: OgStyle): boolean {
  return QUESTION_STYLES.has(style) && !!previewQuestion(survey);
}

export function surveyCard(survey: Survey, label?: TranslationKey, ownerFallback?: string): OgCard {
  const lang = defaultLanguageOf(survey) ?? "";
  const locale = (LOCALES as readonly string[]).includes(lang) ? (lang as Locale) : DEFAULT_LOCALE;
  const { isQuiz, liveMode, accentColor, backgroundColor, ogShowTitle, ogShowDescription, ogShowOwner, ogShowQuestion, ogStyle } =
    survey.settings;
  const questions = survey.questions.filter((q) => q.type !== "content");
  const total = questions.length;
  const choice = previewQuestion(survey);
  const labels = choice?.options?.map((o) => o.label).filter((l) => l?.trim()) ?? [];
  const owner = ogShowOwner ? (survey.ownerName ?? ownerFallback)?.trim() : "";
  const meta = [
    text(locale, label ?? (liveMode ? "og.live" : isQuiz ? "og.quiz" : "og.survey")),
    total > 0 && text(locale, total === 1 ? "card.questionCount_one" : "card.questionCount_other", total),
    total > 0 && !liveMode && text(locale, "og.minutes", Math.ceil(total / 3)),
  ];
  return {
    title: ogShowTitle === false || !survey.title.trim() ? text(locale, "og.brand.title") : survey.title,
    description: ogShowDescription === false ? undefined : survey.description,
    owner: owner ? text(locale, "og.owner", owner) : undefined,
    meta: meta.filter((part): part is string => !!part),
    cta: text(locale, label === "og.collab" ? "og.ctaCollab" : "og.cta"),
    ballot:
      choice && ogShowQuestion !== false
        ? {
            question: choice.title,
            options: labels.slice(0, MAX_OPTIONS),
            more: labels.length > MAX_OPTIONS ? text(locale, "og.moreOptions", labels.length - MAX_OPTIONS) : "",
            total: labels.length,
          }
        : undefined,
    accent: accentColor,
    background: backgroundColor,
    style: isOgStyle(ogStyle) ? ogStyle : "classic",
  };
}

// Largest size that keeps the title within three lines without splitting a word.
function titleSize(title: string, width: number, max: number): number {
  const longest = Math.max(...title.split(" ").map((word) => word.length));
  return Math.round(Math.max(40, Math.min(max, (3 * width) / (0.56 * title.length), width / (0.56 * longest))));
}

interface ViewProps {
  card: OgCard;
  logo: (color: string) => string;
  accent: string;
  background: string;
  dark: boolean;
  ink: string;
  muted: string;
  onAccent: string;
  mark: string;
}

const ROOT: CSSProperties = { display: "flex", width: "100%", height: "100%", position: "relative", wordBreak: "break-word" };

function Title({ text, width, max, align, color }: { text: string; width: number; max: number; align?: "center"; color?: string }) {
  const title = clamp(text, 90);
  return (
    <div
      style={{
        display: "flex",
        ...(align && { justifyContent: align, textAlign: align }),
        width,
        fontSize: titleSize(title, width, max),
        fontWeight: 600,
        lineHeight: 1.05,
        letterSpacing: -1.5,
        ...(color && { color }),
      }}
    >
      {title}
    </div>
  );
}

function Description({ text, max, width, color, size = 30, align }: { text?: string; max: number; width: number; color: string; size?: number; align?: "center" }) {
  if (!text?.trim()) return null;
  return (
    <div style={{ display: "flex", ...(align && { justifyContent: align, textAlign: align }), width, marginTop: 22, fontSize: size, lineHeight: 1.38, color }}>
      {clamp(text, max)}
    </div>
  );
}

function Brand({ src, color, children }: { src: string; color?: string; children?: ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14, ...(color && { color }) }}>
      <img src={src} width={44} height={44} alt="" />
      <div style={{ display: "flex", fontSize: 30, fontWeight: 600, letterSpacing: -0.5 }}>Jackpoll</div>
      {children}
    </div>
  );
}

function Pill({ text, border, fill }: { text: string; border: string; fill: string }) {
  if (!text) return null;
  return (
    <div
      style={{
        display: "flex",
        marginLeft: 12,
        padding: "8px 18px",
        borderRadius: 999,
        border: `1.5px solid ${border}`,
        background: fill,
        fontSize: 21,
        whiteSpace: "nowrap",
      }}
    >
      {text}
    </div>
  );
}

function Action({ card, fill, color, ownerColor }: { card: OgCard; fill: string; color: string; ownerColor: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 20, height: 56 }}>
      {card.cta && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            height: 56,
            padding: "0 28px",
            borderRadius: 999,
            background: fill,
            color,
            fontSize: 24,
            fontWeight: 600,
            whiteSpace: "nowrap",
          }}
        >
          {`${card.cta} →`}
        </div>
      )}
      {card.owner && (
        <div style={{ display: "flex", fontSize: 23, fontWeight: 600, color: ownerColor, whiteSpace: "nowrap" }}>
          {clamp(card.owner, 32)}
        </div>
      )}
    </div>
  );
}

function Classic({ card, logo, accent, background, dark, ink, muted, onAccent, mark }: ViewProps) {
  const narrow = !!card.ballot;
  const width = narrow ? 560 : 860;
  return (
    <div
      style={{
        ...ROOT,
        background,
        backgroundImage: `radial-gradient(circle at 100% 0%, ${alpha(accent, dark ? 0.32 : 0.16)} 0%, ${alpha(accent, 0)} 55%)`,
        color: ink,
        borderTop: `14px solid ${accent}`,
      }}
    >
      {!narrow && (
        <img src={logo(mark)} width={500} height={500} alt="" style={{ position: "absolute", right: -70, bottom: -120, opacity: 0.14 }} />
      )}
      <div style={{ display: "flex", flex: 1, alignItems: "center", gap: 56, padding: "48px 72px 56px" }}>
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", height: "100%", width }}>
          <Brand src={logo(mark)}>
            <Pill text={card.meta.join(" · ")} border={alpha(accent, 0.45)} fill={alpha(accent, dark ? 0.2 : 0.07)} />
          </Brand>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <Title text={card.title} width={width} max={narrow ? 64 : 92} />
            <Description text={card.description} max={narrow ? 100 : 160} width={width} color={muted} size={narrow ? 27 : 30} />
          </div>
          <Action card={card} fill={accent} color={onAccent} ownerColor={muted} />
        </div>
        {card.ballot && <Ballot ballot={card.ballot} ink={ink} muted={muted} accent={accent} dark={dark} />}
      </div>
    </div>
  );
}

function Bold({ card, logo, accent, onAccent }: ViewProps) {
  const soft = alpha(onAccent, 0.84);
  return (
    <div
      style={{
        ...ROOT,
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "56px 72px",
        background: accent,
        backgroundImage: `linear-gradient(135deg, ${alpha("#FFFFFF", 0.16)} 0%, ${alpha("#FFFFFF", 0)} 45%, ${alpha("#000000", 0.22)} 100%)`,
        color: onAccent,
      }}
    >
      <img
        src={logo(onAccent)}
        width={640}
        height={640}
        alt=""
        style={{ position: "absolute", right: -150, top: 30, opacity: 0.13, transform: "rotate(-14deg)" }}
      />
      <Brand src={logo(onAccent)}>
        <Pill text={card.meta.join(" · ")} border={alpha(onAccent, 0.45)} fill={alpha(onAccent, 0.12)} />
      </Brand>
      <div style={{ display: "flex", flexDirection: "column" }}>
        <Title text={card.title} width={920} max={84} />
        <Description text={card.description} max={105} width={860} color={soft} />
      </div>
      <Action card={card} fill={onAccent} color={accent} ownerColor={soft} />
    </div>
  );
}

function Minimal({ card, logo, background, ink, muted, mark }: ViewProps) {
  const [kind, ...details] = card.meta;
  return (
    <div
      style={{
        ...ROOT,
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "56px 120px",
        background,
        color: ink,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 14, color: mark, fontSize: 20, fontWeight: 600, letterSpacing: 4 }}>
        <img src={logo(mark)} width={36} height={36} alt="" />
        <div style={{ display: "flex" }}>{["JACKPOLL", kind?.toUpperCase()].filter(Boolean).join("  ·  ")}</div>
      </div>
      <div style={{ display: "flex", marginTop: 34 }}>
        <Title text={card.title} width={960} max={84} align="center" />
      </div>
      <div style={{ display: "flex", width: 96, height: 8, marginTop: 30, borderRadius: 999, background: mark }} />
      <Description text={card.description} max={120} width={860} color={muted} size={28} align="center" />
      <div style={{ display: "flex", alignItems: "center", gap: 18, marginTop: 34, fontSize: 23, color: muted, whiteSpace: "nowrap" }}>
        {details.length > 0 && <div style={{ display: "flex" }}>{details.join(" · ")}</div>}
        {card.owner && <div style={{ display: "flex" }}>{clamp(card.owner, 32)}</div>}
        {card.cta && <div style={{ display: "flex", color: mark, fontWeight: 600 }}>{`${card.cta} →`}</div>}
      </div>
    </div>
  );
}

function Check({ color }: { color: string }) {
  return (
    <svg width={22} height={22} viewBox="0 0 24 24">
      <path d="M4 12.5l5 5L20 6.5" stroke={color} strokeWidth={3.2} strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}

function Spotlight({ card, logo, accent, background, dark, onAccent }: ViewProps) {
  const base = dark ? background : "#0B1220";
  const ink = "#F8FAFC";
  const muted = "rgba(248,250,252,0.72)";
  const ballot = card.ballot;
  const chips = ballot?.options.slice(0, 3) ?? [];
  const rest = (ballot?.total ?? 0) - chips.length;
  return (
    <div
      style={{
        ...ROOT,
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "52px 80px 56px",
        background: base,
        backgroundImage: `radial-gradient(circle at 10% 0%, ${alpha(accent, 0.55)} 0%, ${alpha(accent, 0)} 42%), radial-gradient(circle at 100% 100%, ${alpha(accent, 0.42)} 0%, ${alpha(accent, 0)} 48%)`,
        color: ink,
      }}
    >
      <Brand src={logo(ink)}>
        <Pill text={card.meta.join(" · ")} border="rgba(248,250,252,0.28)" fill="rgba(248,250,252,0.08)" />
      </Brand>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
        <Title text={card.title} width={1000} max={ballot ? 68 : 88} align="center" />
        <Description text={card.description} max={ballot ? 90 : 120} width={920} color={muted} size={28} align="center" />
      </div>
      {ballot ? (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
          <div style={{ display: "flex", fontSize: 22, color: muted }}>{clamp(ballot.question, 70)}</div>
          <div style={{ display: "flex", gap: 14 }}>
            {chips.map((option, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  height: 54,
                  padding: "0 24px",
                  borderRadius: 999,
                  border: `2px solid ${i === 0 ? accent : "rgba(248,250,252,0.24)"}`,
                  background: i === 0 ? accent : "rgba(248,250,252,0.06)",
                  color: i === 0 ? onAccent : ink,
                  fontSize: 23,
                  whiteSpace: "nowrap",
                }}
              >
                {i === 0 && <Check color={onAccent} />}
                {clamp(option, 20)}
              </div>
            ))}
            {rest > 0 && (
              <div style={{ display: "flex", alignItems: "center", height: 54, padding: "0 6px", fontSize: 22, color: muted }}>{`+${rest}`}</div>
            )}
          </div>
        </div>
      ) : (
        <Action card={card} fill={accent} color={onAccent} ownerColor={muted} />
      )}
    </div>
  );
}

function Split({ card, logo, accent, background, dark, ink, muted, onAccent }: ViewProps) {
  const [kind, ...details] = card.meta;
  return (
    <div style={{ ...ROOT, background, color: ink }}>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          position: "relative",
          width: 420,
          height: "100%",
          padding: 56,
          overflow: "hidden",
          background: accent,
          backgroundImage: `linear-gradient(160deg, ${alpha("#FFFFFF", 0.14)} 0%, ${alpha("#000000", 0.2)} 100%)`,
          color: onAccent,
        }}
      >
        <img
          src={logo(onAccent)}
          width={460}
          height={460}
          alt=""
          style={{ position: "absolute", right: -170, bottom: -40, opacity: 0.14 }}
        />
        <Brand src={logo(onAccent)} />
        <div style={{ display: "flex", flexDirection: "column" }}>
          {kind && (
            <div style={{ display: "flex", marginBottom: 10, fontSize: 22, fontWeight: 600, letterSpacing: 3, color: alpha(onAccent, 0.78) }}>
              {kind.toUpperCase()}
            </div>
          )}
          {details.map((detail) => (
            <div key={detail} style={{ display: "flex", fontSize: 48, fontWeight: 600, lineHeight: 1.15, letterSpacing: -1 }}>
              {detail}
            </div>
          ))}
        </div>
      </div>
      <div
        style={{
          display: "flex",
          flex: 1,
          flexDirection: "column",
          justifyContent: "center",
          padding: "56px 64px",
          backgroundImage: `radial-gradient(circle at 100% 100%, ${alpha(accent, dark ? 0.24 : 0.1)} 0%, ${alpha(accent, 0)} 55%)`,
        }}
      >
        <Title text={card.title} width={652} max={76} />
        <Description text={card.description} max={120} width={652} color={muted} size={28} />
        <div style={{ display: "flex", marginTop: 40 }}>
          <Action card={card} fill={accent} color={onAccent} ownerColor={muted} />
        </div>
      </div>
    </div>
  );
}

const VIEWS: Record<OgStyle, (props: ViewProps) => ReactNode> = {
  classic: Classic,
  bold: Bold,
  minimal: Minimal,
  spotlight: Spotlight,
  split: Split,
};

export function OgCardView({
  card,
  logo,
  fontFamily = "Geist",
}: {
  card: OgCard;
  logo: (color: string) => string;
  fontFamily?: string;
}) {
  const accent = card.accent && HEX.test(card.accent) ? card.accent : BRAND;
  const background = card.background && HEX.test(card.background) ? card.background : "#FFFFFF";
  const dark = isDark(background);
  const View = VIEWS[card.style ?? "classic"];
  return (
    <div style={{ display: "flex", width: "100%", height: "100%", fontFamily }}>
      <View
        card={card}
        logo={logo}
        accent={accent}
        background={background}
        dark={dark}
        ink={dark ? "#F1F5F9" : "#0B1220"}
        muted={dark ? "rgba(241,245,249,0.72)" : "#4B5A70"}
        onAccent={isDark(accent) ? "#FFFFFF" : "#0B1220"}
        mark={isDark(accent) !== dark ? accent : dark ? "#F1F5F9" : "#0B1220"}
      />
    </div>
  );
}

export function recolorLogo(svg: string, color: string): string {
  return `data:image/svg+xml;base64,${btoa(svg.replace(/#024DB2|#4987D9/gi, color))}`;
}
