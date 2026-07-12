"use client";

import { QRCodeSVG } from "qrcode.react";
import { Users } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { Spinner } from "@/app/components/ui/spinner";
import { useAccessCode } from "@/app/hooks/survey";
import { useTranslation } from "@/app/i18n/context";

/**
 * Quiz game lobby: shown on the presenter before the first question. Displays
 * the join PIN + QR and the nicknames of players as they check in, with a Start
 * button to begin. Roster comes from the presenter's live socket.
 */
export function LobbyView({
  surveyId,
  players,
  onStart,
}: {
  surveyId: string;
  players: string[];
  onStart: () => void;
}) {
  const { t } = useTranslation();
  const accessCode = useAccessCode(surveyId);
  const code = accessCode.data?.code ?? "";
  const joinUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/join${code ? `?code=${code}` : ""}`
      : "";

  return (
    <div className="grid min-h-0 flex-1 gap-6 overflow-y-auto lg:grid-cols-2">
      <div className="flex flex-col items-center justify-center gap-4">
        <p className="text-sm text-muted-foreground">{t("live.lobby.joinAt")}</p>
        {joinUrl ? (
          <div className="rounded-xl bg-white p-4">
            <QRCodeSVG value={joinUrl} size={200} />
          </div>
        ) : (
          <Spinner className="size-6 text-muted-foreground" />
        )}
        {code && (
          <div className="text-center">
            <p className="text-sm text-muted-foreground">{t("live.lobby.pin")}</p>
            <p className="text-4xl font-black tracking-[0.2em] tabular-nums">{code}</p>
          </div>
        )}
      </div>

      <div className="flex min-h-0 flex-col gap-3">
        <p className="flex items-center gap-2 text-lg font-semibold">
          <Users className="size-5" />
          {t("live.lobby.players", { count: String(players.length) })}
        </p>
        <div className="flex min-h-0 flex-1 flex-wrap content-start gap-2 overflow-y-auto">
          {players.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("live.lobby.waiting")}</p>
          ) : (
            players.map((name) => (
              <span
                key={name}
                className="rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary"
              >
                {name}
              </span>
            ))
          )}
        </div>
        <Button size="lg" disabled={players.length === 0} onClick={onStart}>
          {t("live.lobby.start")}
        </Button>
      </div>
    </div>
  );
}
