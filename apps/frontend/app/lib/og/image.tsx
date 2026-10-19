import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { Metadata } from "next";
import { ImageResponse } from "next/og";
import { DEFAULT_LOCALE, LOCALES, en, translations, type Locale, type TranslationKey } from "@/app/i18n/translations";
import { defaultLanguageOf } from "@/app/lib/survey/content-i18n";
import type { ApiResponse } from "@/app/types/auth";
import type { Survey } from "@/app/types/survey";
import { Ballot, clamp, isDark, type BallotQuestion } from "./ballot";

export const OG_SIZE = { width: 1200, height: 630 };
export const OG_ALT = "Jackpoll";

const BRAND = "#024DB2";
const HEX = /^#[0-9a-f]{6}$/i;
const CHOICE_TYPES = new Set(["multiple-choice", "checkboxes", "dropdown"]);
const MAX_OPTIONS = 4;

type Page = "brand" | "join" | "resume" | "edit";

interface OgCard {
  title: string;
  description?: string;
  meta: string;
  ballot?: BallotQuestion;
  accent?: string;
  background?: string;
}

function text(locale: Locale, key: TranslationKey, n = 0): string {
  return (translations[locale][key] ?? en[key]).replace(/\{\w+\}/, String(n));
}

export function pageCard(page: Page): OgCard {
  return {
    title: text(DEFAULT_LOCALE, `og.${page}.title`),
    description: text(DEFAULT_LOCALE, `og.${page}.description`),
    meta: "",
  };
}

export function surveyCard(survey: Survey, label?: TranslationKey): OgCard {
  const lang = defaultLanguageOf(survey) ?? "";
  const locale = (LOCALES as readonly string[]).includes(lang) ? (lang as Locale) : DEFAULT_LOCALE;
  const { isQuiz, liveMode, accentColor, backgroundColor } = survey.settings;
  const questions = survey.questions.filter((q) => q.type !== "content");
  const total = questions.length;
  const choice = questions.find((q) => CHOICE_TYPES.has(q.type) && q.options?.some((o) => o.label?.trim()));
  const labels = choice?.options?.map((o) => o.label).filter((l) => l?.trim()) ?? [];
  const meta = [
    text(locale, label ?? (liveMode ? "og.live" : isQuiz ? "og.quiz" : "og.survey")),
    total > 0 && text(locale, total === 1 ? "card.questionCount_one" : "card.questionCount_other", total),
    total > 0 && !liveMode && text(locale, "og.minutes", Math.ceil(total / 3)),
  ];
  return {
    title: survey.title,
    description: survey.description,
    meta: meta.filter((part): part is string => !!part).join(" · "),
    ballot:
      choice && !isQuiz && !liveMode
        ? {
            question: choice.title,
            options: labels.slice(0, MAX_OPTIONS),
            more: labels.length > MAX_OPTIONS ? text(locale, "og.moreOptions", labels.length - MAX_OPTIONS) : "",
          }
        : undefined,
    accent: accentColor,
    background: backgroundColor,
  };
}

/** Public survey for a preview, or null when the link is unknown, closed or unreachable. */
export async function previewSurvey(load: () => Promise<ApiResponse<Survey>>): Promise<Survey | null> {
  try {
    return (await load()).data ?? null;
  } catch {
    return null;
  }
}

export function surveyMetadata(survey: Survey | null): Metadata {
  return survey ? { title: survey.title, description: survey.description || null } : {};
}

let assets: Promise<Buffer[]> | undefined;

function titleSize(length: number, narrow: boolean): number {
  if (narrow) return length > 48 ? 44 : length > 24 ? 54 : 64;
  return length > 56 ? 54 : length > 28 ? 66 : 82;
}

export async function renderOgImage(card: OgCard): Promise<ImageResponse> {
  const accent = card.accent && HEX.test(card.accent) ? card.accent : BRAND;
  const background = card.background && HEX.test(card.background) ? card.background : "#FFFFFF";
  const dark = isDark(background);
  const ink = dark ? "#F1F5F9" : "#0B1220";
  const muted = dark ? "rgba(241,245,249,0.72)" : "#4B5A70";
  const onAccent = isDark(accent) ? "#FFFFFF" : "#0B1220";
  const mark = isDark(accent) !== dark ? accent : ink;
  const narrow = !!card.ballot;
  const title = clamp(card.title, narrow ? 70 : 90);
  // The Geist files ship without their GPOS table: Satori mis-measures kerned
  // word endings, which left uneven gaps between words.
  const [icon, regular, semibold] = await (assets ??= Promise.all(
    ["icons/icon.svg", "fonts/Geist-Regular.ttf", "fonts/Geist-SemiBold.ttf"].map((file) =>
      readFile(join(process.cwd(), "public", file)),
    ),
  ));
  const logo = (color: string) =>
    `data:image/svg+xml;base64,${Buffer.from(icon.toString().replace(/#024DB2|#4987D9/gi, color)).toString("base64")}`;

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: "100%",
          height: "100%",
          background,
          color: ink,
          fontFamily: "Geist",
          wordBreak: "break-word",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            height: 88,
            padding: "0 64px",
            background: accent,
            color: onAccent,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <img src={logo(onAccent)} width={42} height={42} alt="" />
            <div style={{ display: "flex", fontSize: 30, fontWeight: 600, letterSpacing: -0.5 }}>Jackpoll</div>
          </div>
          <div style={{ display: "flex", fontSize: 23 }}>{card.meta}</div>
        </div>

        <div
          style={{
            display: "flex",
            flex: 1,
            alignItems: narrow ? "center" : "flex-start",
            position: "relative",
            padding: "60px 64px",
            gap: 64,
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", width: narrow ? 540 : 760 }}>
            <div
              style={{
                display: "flex",
                fontSize: titleSize(title.length, narrow),
                fontWeight: 600,
                lineHeight: 1.06,
                letterSpacing: -1.5,
              }}
            >
              {title}
            </div>
            {card.description && (
              <div style={{ display: "flex", marginTop: 26, fontSize: 26, lineHeight: 1.4, color: muted }}>
                {clamp(card.description, narrow ? 110 : 150)}
              </div>
            )}
          </div>
          {card.ballot ? (
            <Ballot ballot={card.ballot} ink={ink} muted={muted} mark={mark} />
          ) : (
            <img
              src={logo(mark)}
              width={430}
              height={430}
              alt=""
              style={{ position: "absolute", right: -46, bottom: -96 }}
            />
          )}
        </div>
      </div>
    ),
    {
      ...OG_SIZE,
      fonts: [
        { name: "Geist", data: regular, weight: 400, style: "normal" },
        { name: "Geist", data: semibold, weight: 600, style: "normal" },
      ],
    },
  );
}
