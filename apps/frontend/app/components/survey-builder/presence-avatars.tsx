"use client";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/app/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useBuilder } from "./builder-context";

function initials(name: string): string {
  return name
    .split(" ")
    .map((n) => n.charAt(0).toUpperCase())
    .join("")
    .slice(0, 2);
}

/**
 * Live presence: avatars of other people editing this survey (issue #85).
 * Click an avatar to follow that person — the builder scrolls to whatever
 * question they focus, until you click again to stop.
 */
export function PresenceAvatars() {
  const { presence, followingClientId, toggleFollow } = useBuilder();
  if (presence.length === 0) return null;

  return (
    <TooltipProvider>
      <div className="flex -space-x-2">
        {presence.map((p) => {
          const following = followingClientId === p.clientId;
          return (
            <Tooltip key={p.clientId}>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => toggleFollow(p.clientId)}
                  aria-pressed={following}
                  className={cn(
                    "grid size-7 place-items-center rounded-full border-2 border-background text-xs font-medium text-white transition-transform hover:z-10 hover:scale-110",
                    following && "ring-2 ring-offset-1 ring-offset-background",
                  )}
                  style={{
                    backgroundColor: p.color,
                    ...(following ? { ["--tw-ring-color" as string]: p.color } : {}),
                  }}
                >
                  {initials(p.name)}
                </button>
              </TooltipTrigger>
              <TooltipContent>
                {following ? `Stop following ${p.name}` : `Follow ${p.name}`}
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </TooltipProvider>
  );
}
