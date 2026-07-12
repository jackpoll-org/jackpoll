"use client";

import { useRef, useState } from "react";
import { ImagePlus, Plus, Trash2 } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import { Spinner } from "@/app/components/ui/spinner";
import { uploadFileApi } from "@/app/lib/survey/api";
import { useTranslation } from "@/app/i18n/context";
import type { Outcome } from "@/app/types/survey";

interface Props {
  outcomes: Outcome[];
  onChange: (outcomes: Outcome[]) => void;
}

/** Builder editor for score-based outcome pages (issue #83). */
export function OutcomesEditor({ outcomes, onChange }: Props) {
  const { t } = useTranslation();
  function add() {
    onChange([...outcomes, { id: crypto.randomUUID(), title: "" }]);
  }
  function patch(id: string, p: Partial<Outcome>) {
    onChange(outcomes.map((o) => (o.id === id ? { ...o, ...p } : o)));
  }
  function remove(id: string) {
    onChange(outcomes.filter((o) => o.id !== id));
  }

  return (
    <div className="grid gap-3">
      <div>
        <Label className="text-xs">{t("builder.outcomes.label")}</Label>
        <p className="text-xs text-muted-foreground">
          {t("builder.outcomes.help")}
        </p>
      </div>

      {outcomes.map((o) => (
        <OutcomeRow
          key={o.id}
          outcome={o}
          onPatch={(p) => patch(o.id, p)}
          onRemove={() => remove(o.id)}
        />
      ))}

      <Button variant="outline" size="sm" className="w-fit" onClick={add}>
        <Plus className="size-4" /> {t("builder.outcomes.add")}
      </Button>
    </div>
  );
}

function OutcomeRow({
  outcome: o,
  onPatch,
  onRemove,
}: {
  outcome: Outcome;
  onPatch: (p: Partial<Outcome>) => void;
  onRemove: () => void;
}) {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function upload(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    try {
      const uploaded = await uploadFileApi(file);
      onPatch({ imageUrl: uploaded.url });
    } catch {
      // ignore — author can retry
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="grid gap-2 rounded-md border p-3">
      <div className="flex gap-2">
        <Input
          placeholder={t("builder.outcomes.titlePlaceholder")}
          value={o.title}
          onChange={(e) => onPatch({ title: e.target.value })}
        />
        <Button
          variant="ghost"
          size="icon"
          onClick={onRemove}
          aria-label={t("builder.outcomes.remove")}
        >
          <Trash2 className="size-4" />
        </Button>
      </div>
      <Input
        placeholder={t("builder.outcomes.descPlaceholder")}
        value={o.description ?? ""}
        onChange={(e) => onPatch({ description: e.target.value })}
      />
      <div className="flex flex-wrap items-end gap-3">
        <div className="grid gap-1">
          <Label className="text-xs">{t("builder.outcomes.minScore")}</Label>
          <Input
            type="number"
            className="w-24"
            value={o.minScore ?? ""}
            placeholder="−∞"
            onChange={(e) =>
              onPatch({ minScore: e.target.value ? Number(e.target.value) : undefined })
            }
          />
        </div>
        <div className="grid gap-1">
          <Label className="text-xs">{t("builder.outcomes.maxScore")}</Label>
          <Input
            type="number"
            className="w-24"
            value={o.maxScore ?? ""}
            placeholder="∞"
            onChange={(e) =>
              onPatch({ maxScore: e.target.value ? Number(e.target.value) : undefined })
            }
          />
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? <Spinner className="size-4" /> : <ImagePlus className="size-4" />}
          {t("builder.outcomes.image")}
        </Button>
        {o.imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={o.imageUrl} alt="" className="size-10 rounded object-cover" />
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/gif,image/webp"
          className="hidden"
          onChange={(e) => upload(e.target.files?.[0])}
        />
      </div>
    </div>
  );
}
