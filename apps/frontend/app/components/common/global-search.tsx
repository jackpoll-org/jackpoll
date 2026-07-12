"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, PlusCircle, SearchIcon } from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/app/components/ui/command";
import { Button } from "@/app/components/ui/button";
import { useSurveys } from "@/app/hooks/survey";
import { useTranslation } from "@/app/i18n/context";

/**
 * Global search shown in the dashboard top bar. Opens a command palette via
 * click or ⌘K / Ctrl+K to jump to a survey or run a quick action.
 */
export function GlobalSearch() {
  const { t } = useTranslation();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const { data } = useSurveys();
  const surveys = data?.surveys ?? [];

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  function go(href: string) {
    setOpen(false);
    router.push(href);
  }

  return (
    <>
      <Button
        variant="outline"
        onClick={() => setOpen(true)}
        className="relative h-9 w-full justify-start gap-2 text-muted-foreground sm:w-64 md:w-80"
      >
        <SearchIcon className="size-4" />
        <span>{t("search.surveys")}</span>
        <kbd className="pointer-events-none absolute right-1.5 top-1/2 hidden -translate-y-1/2 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium sm:flex">
          ⌘K
        </kbd>
      </Button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder={t("search.placeholder")} />
        <CommandList>
          <CommandEmpty>{t("search.noResults")}</CommandEmpty>

          <CommandGroup heading={t("search.actions")}>
            <CommandItem value="my surveys dashboard" onSelect={() => go("/surveys")}>
              <FileText className="size-4" />
              {t("search.goToSurveys")}
            </CommandItem>
            <CommandItem
              value="new survey create"
              onSelect={() => go("/surveys?new=1")}
            >
              <PlusCircle className="size-4" />
              {t("search.createSurvey")}
            </CommandItem>
          </CommandGroup>

          {surveys.length > 0 && (
            <>
              <CommandSeparator />
              <CommandGroup heading={t("search.surveysGroup")}>
                {surveys.map((survey) => (
                  <CommandItem
                    key={survey.id}
                    value={`${survey.title} ${survey.id}`}
                    onSelect={() => go(`/surveys/${survey.id}/edit`)}
                  >
                    <FileText className="size-4" />
                    <span className="truncate">{survey.title}</span>
                    <span className="ml-auto text-xs capitalize text-muted-foreground">
                      {survey.status}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </>
          )}
        </CommandList>
      </CommandDialog>
    </>
  );
}
