"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { Upload, X } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import { Switch } from "@/app/components/ui/switch";
import { Spinner } from "@/app/components/ui/spinner";
import { uploadFileApi } from "@/app/lib/survey/api";
import { useBuilder } from "./builder-context";
import { useTranslation } from "@/app/i18n/context";

function ImageField({
  label,
  url,
  onChange,
}: {
  label: string;
  url?: string;
  onChange: (url: string | undefined) => void;
}) {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    try {
      const uploaded = await uploadFileApi(file);
      onChange(uploaded.url);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("qprev.uploadFailed"));
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="grid gap-1">
      <Label className="text-xs">{label}</Label>
      <div className="flex items-center gap-3">
        {url && (
          <div className="relative h-12 w-24 overflow-hidden rounded border">
            <Image
              src={url}
              alt={label}
              fill
              unoptimized
              sizes="96px"
              className="object-contain"
            />
          </div>
        )}
        <input
          ref={inputRef}
          type="file"
          aria-label={label}
          accept="image/png,image/jpeg,image/gif,image/webp"
          className="hidden"
          onChange={(e) => handleFile(e.target.files?.[0])}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? <Spinner className="size-4" /> : <Upload className="size-4" />}
          {url ? t("branding.replace") : t("branding.upload")}
        </Button>
        {url && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={t("branding.remove", { label })}
            onClick={() => onChange(undefined)}
          >
            <X className="size-4" />
          </Button>
        )}
      </div>
    </div>
  );
}

/** Per-survey branding shown on public pages (issue #30). */
export function BrandingCard() {
  const { t } = useTranslation();
  const { survey, updateSettings } = useBuilder();
  const settings = survey.settings;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t("branding.title")}</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="grid gap-1">
          <Label htmlFor="accent" className="text-xs">
            {t("branding.accent")}
          </Label>
          <div className="flex items-center gap-2">
            <Input
              id="accent"
              type="color"
              className="h-9 w-16 p-1"
              value={settings.accentColor ?? "#000000"}
              onChange={(e) => updateSettings({ accentColor: e.target.value })}
            />
            {settings.accentColor && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => updateSettings({ accentColor: undefined })}
              >
                {t("branding.reset")}
              </Button>
            )}
          </div>
        </div>

        <div className="grid gap-1">
          <Label htmlFor="bg-color" className="text-xs">
            {t("branding.background")}
          </Label>
          <div className="flex items-center gap-2">
            <Input
              id="bg-color"
              type="color"
              className="h-9 w-16 p-1"
              value={settings.backgroundColor ?? "#ffffff"}
              onChange={(e) => updateSettings({ backgroundColor: e.target.value })}
            />
            {settings.backgroundColor && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => updateSettings({ backgroundColor: undefined })}
              >
                {t("branding.reset")}
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {t("branding.backgroundHelp")}
          </p>
        </div>

        <ImageField
          label={t("branding.logo")}
          url={settings.logoUrl}
          onChange={(url) => updateSettings({ logoUrl: url })}
        />
        <ImageField
          label={t("branding.header")}
          url={settings.headerImageUrl}
          onChange={(url) => updateSettings({ headerImageUrl: url })}
        />

        <div className="flex items-center gap-2">
          <Switch
            id="powered-by"
            checked={settings.showPoweredBy}
            onCheckedChange={(c) => updateSettings({ showPoweredBy: c })}
          />
          <Label htmlFor="powered-by" className="font-normal">
            {t("branding.poweredBy")}
          </Label>
        </div>

        <p className="text-xs text-muted-foreground">
          {t("branding.help")}
        </p>
      </CardContent>
    </Card>
  );
}
