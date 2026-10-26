import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { Metadata } from "next";
import { ImageResponse } from "next/og";
import type { ApiResponse } from "@/app/types/auth";
import type { Survey } from "@/app/types/survey";
import { serverT } from "@/app/i18n/server";
import { OG_SIZE, OgCardView, recolorLogo, type OgCard, type Page } from "./card";

export { OG_SIZE, pageCard, surveyCard } from "./card";
export const OG_ALT = "Jackpoll";

export async function previewSurvey(load: () => Promise<ApiResponse<Survey>>): Promise<Survey | null> {
  try {
    return (await load()).data ?? null;
  } catch {
    return null;
  }
}

export async function pageMetadata(page: Page): Promise<Metadata> {
  const t = await serverT();
  return { title: t(`og.${page}.title`), description: t(`og.${page}.description`) };
}

export function surveyMetadata(survey: Survey | null): Metadata {
  return survey ? { title: survey.title, description: survey.description || null } : {};
}

let assets: Promise<Buffer[]> | undefined;

export async function renderOgImage(card: OgCard): Promise<ImageResponse> {
  // The Geist files ship without their GPOS table: Satori mis-measures kerned
  // word endings, which left uneven gaps between words.
  const [icon, regular, semibold] = await (assets ??= Promise.all(
    ["icons/icon.svg", "fonts/Geist-Regular.ttf", "fonts/Geist-SemiBold.ttf"].map((file) =>
      readFile(join(process.cwd(), "public", file)),
    ),
  ).catch((error) => {
    assets = undefined;
    throw error;
  }));
  const svg = icon.toString();

  return new ImageResponse(<OgCardView card={card} logo={(color) => recolorLogo(svg, color)} />, {
    ...OG_SIZE,
    fonts: [
      { name: "Geist", data: regular, weight: 400, style: "normal" },
      { name: "Geist", data: semibold, weight: 600, style: "normal" },
    ],
  });
}
