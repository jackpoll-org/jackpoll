import { Label } from "@/app/components/ui/label";

/**
 * A label + optional description on the left, a control on the right.
 *
 * The row wraps instead of overflowing: German compounds get long
 * ("Standardsortierung") and the controls are fixed-width and `whitespace-nowrap`
 * by design, so on a narrow phone the pair no longer fits on one line. Without
 * wrapping the card grew past the viewport and the whole settings page scrolled
 * sideways.
 */
export function SettingRow({
  title,
  description,
  htmlFor,
  control,
}: {
  title: string;
  description?: string;
  htmlFor?: string;
  control: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
      <div className="grid min-w-0 flex-1 gap-0.5 break-words">
        <Label htmlFor={htmlFor} className="font-normal break-words">
          {title}
        </Label>
        {description && (
          <p className="text-xs break-words text-muted-foreground">{description}</p>
        )}
      </div>
      {control}
    </div>
  );
}
