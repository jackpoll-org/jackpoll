"use client";

import { useState } from "react";
import { Button } from "@/app/components/ui/button";
import { useTranslation } from "@/app/i18n/context";
import { isButtonComplete, safeButtonUrl } from "@/app/lib/survey/completion-buttons";
import type { CompletionButton } from "@/app/types/survey";

const CLOSE_CHECK_MS = 300;

export function CompletionButtons({
  buttons,
  allowRestart,
  onRestart,
}: {
  buttons: CompletionButton[] | null | undefined;
  allowRestart: boolean;
  onRestart: () => void;
}) {
  const { t } = useTranslation();
  const [closeBlocked, setCloseBlocked] = useState(false);
  const embedded = typeof window !== "undefined" && window.self !== window.top;
  const visible = (buttons ?? []).filter(
    (b) =>
      b.enabled &&
      isButtonComplete(b) &&
      (b.action !== "restart" || allowRestart) &&
      (b.action !== "close" || !embedded),
  );
  if (visible.length === 0) return null;

  function closeTab() {
    window.close();
    setTimeout(() => {
      if (!window.closed) setCloseBlocked(true);
    }, CLOSE_CHECK_MS);
  }

  return (
    <div data-testid="completion-buttons" className="flex w-full max-w-xs flex-col gap-2">
      {visible.map((b) => {
        if (b.action === "url") {
          const newTab = b.newTab || embedded;
          return (
            <Button key={b.id} variant="outline" asChild>
              <a
                href={safeButtonUrl(b.url)!}
                target={newTab ? "_blank" : undefined}
                rel={newTab ? "noopener noreferrer" : undefined}
              >
                {b.label}
              </a>
            </Button>
          );
        }
        return (
          <Button
            key={b.id}
            variant="outline"
            onClick={b.action === "close" ? closeTab : onRestart}
          >
            {b.label}
          </Button>
        );
      })}
      {closeBlocked && (
        <p role="status" className="text-sm text-muted-foreground">
          {t("player.closeTabFallback")}
        </p>
      )}
    </div>
  );
}
