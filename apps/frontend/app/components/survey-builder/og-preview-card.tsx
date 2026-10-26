"use client";

import { useCallback, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/app/components/ui/card";
import { Label } from "@/app/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/app/components/ui/radio-group";
import { Switch } from "@/app/components/ui/switch";
import { useCurrentUser } from "@/app/hooks/auth";
import { useTranslation } from "@/app/i18n/context";
import { OG_SIZE, OG_STYLES, OgCardView, canShowQuestion, isOgStyle, recolorLogo, surveyCard, type OgCard } from "@/app/lib/og/card";
import type { TranslationKey } from "@/app/i18n/translations";
import { useBuilder } from "./builder-context";

const TOGGLES: {
  key: "ogShowTitle" | "ogShowDescription" | "ogShowQuestion" | "ogShowOwner";
  label: TranslationKey;
  fallback: boolean;
}[] = [
  { key: "ogShowTitle", label: "builder.og.showTitle", fallback: true },
  { key: "ogShowDescription", label: "builder.og.showDescription", fallback: true },
  { key: "ogShowQuestion", label: "builder.og.showQuestion", fallback: true },
  { key: "ogShowOwner", label: "builder.og.showOwner", fallback: false },
];

function ScaledCard({ card, icon }: { card: OgCard; icon: string }) {
  const [scale, setScale] = useState(0);
  const frame = useCallback((node: HTMLDivElement | null) => {
    if (!node) return;
    const observer = new ResizeObserver(([entry]) => setScale(entry.contentRect.width / OG_SIZE.width));
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={frame} className="relative aspect-[1200/630] w-full overflow-hidden" aria-hidden>
      {scale > 0 && (
        <div className="absolute left-0 top-0 origin-top-left" style={{ ...OG_SIZE, transform: `scale(${scale})` }}>
          <OgCardView card={card} logo={(color) => recolorLogo(icon, color)} fontFamily="var(--font-geist-sans)" />
        </div>
      )}
    </div>
  );
}

export function OgPreviewCard() {
  const { t } = useTranslation();
  const { survey, updateSettings } = useBuilder();
  const { data: user } = useCurrentUser();
  const { data: icon } = useQuery({
    queryKey: ["og-icon"],
    queryFn: () => fetch("/icons/icon.svg").then((res) => (res.ok ? res.text() : Promise.reject(new Error(res.statusText)))),
    staleTime: Infinity,
  });

  const isOwner = user?.id === survey.ownerId;
  const card = surveyCard(survey, undefined, isOwner ? user.name : undefined);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t("builder.og.title")}</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-5">
        <p className="text-xs text-muted-foreground">{t("builder.og.help")}</p>

        <div className="grid gap-1.5">
          <Label className="text-xs">{t("builder.og.preview")}</Label>
          <div className="max-w-md overflow-hidden rounded-xl border bg-muted/40 shadow-sm">
            {icon && <ScaledCard card={card} icon={icon} />}
            <div className="grid gap-0.5 border-t px-3 py-2.5">
              <p className="truncate text-sm font-semibold">{`${survey.title || t("og.brand.title")} · Jackpoll`}</p>
              {survey.description && (
                <p className="line-clamp-2 text-xs text-muted-foreground">{survey.description}</p>
              )}
            </div>
          </div>
        </div>

        <div className="grid gap-2">
          <Label className="text-xs">{t("builder.og.design")}</Label>
          <RadioGroup
            value={card.style}
            onValueChange={(value) => isOgStyle(value) && updateSettings({ ogStyle: value })}
            className="grid grid-cols-2 gap-3 sm:grid-cols-3"
            aria-label={t("builder.og.design")}
          >
            {OG_STYLES.map((style) => (
              <Label
                key={style}
                className="group grid cursor-pointer gap-2 rounded-lg border p-1.5 font-normal transition-colors hover:bg-accent/50 has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:ring-2 has-[[data-state=checked]]:ring-primary/30"
              >
                <div className="overflow-hidden rounded-md border">
                  {icon && <ScaledCard card={{ ...card, style }} icon={icon} />}
                </div>
                <span className="flex items-center gap-2 px-1 pb-0.5 text-xs">
                  <RadioGroupItem value={style} />
                  {t(`builder.og.style.${style}`)}
                </span>
              </Label>
            ))}
          </RadioGroup>
        </div>

        <div className="grid gap-3">
          {TOGGLES.filter(({ key }) => key !== "ogShowQuestion" || canShowQuestion(survey, card.style ?? "classic")).map(({ key, label, fallback }) => (
            <div key={key} className="flex items-center gap-2">
              <Switch
                id={`og-${key}`}
                checked={survey.settings[key] ?? fallback}
                disabled={key === "ogShowOwner" && !isOwner}
                onCheckedChange={(c) => updateSettings({ [key]: c })}
              />
              <Label htmlFor={`og-${key}`} className="font-normal">
                {t(label)}
              </Label>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
