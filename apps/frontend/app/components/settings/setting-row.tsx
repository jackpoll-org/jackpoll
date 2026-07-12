import { Label } from "@/app/components/ui/label";

/** A label + optional description on the left, a control on the right. */
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
    <div className="flex items-center justify-between gap-4">
      <div className="grid gap-0.5">
        <Label htmlFor={htmlFor} className="font-normal">
          {title}
        </Label>
        {description && (
          <p className="text-xs text-muted-foreground">{description}</p>
        )}
      </div>
      {control}
    </div>
  );
}
