import { cn } from "@/lib/utils";

/**
 * Readable long-form container for legal text (no typography plugin in this
 * project, so element styles are applied with arbitrary child selectors).
 */
export function LegalProse({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "space-y-4 text-sm leading-relaxed text-foreground/90",
        "[&_h1]:mb-2 [&_h1]:text-2xl [&_h1]:font-bold [&_h1]:tracking-tight [&_h1]:text-foreground",
        "[&_h2]:mt-6 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-foreground",
        "[&_h3]:mt-4 [&_h3]:font-semibold [&_h3]:text-foreground",
        "[&_a]:underline [&_a]:underline-offset-2 hover:[&_a]:text-foreground",
        "[&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5",
        "[&_table]:w-full [&_table]:border-collapse [&_th]:py-1 [&_th]:pr-3 [&_th]:text-left [&_th]:font-medium",
        "[&_td]:py-1 [&_td]:pr-3 [&_td]:align-top [&_thead]:border-b",
        className,
      )}
    >
      {children}
    </div>
  );
}
