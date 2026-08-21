"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/app/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/app/components/ui/select";
import { SettingRow } from "./setting-row";
import {
  useListDensity,
  useListSort,
  type ListDensity,
  type ListSort,
} from "@/app/lib/preferences/ui-prefs";
import { useTranslation } from "@/app/i18n/context";

export function SurveysCard() {
  const { t } = useTranslation();
  const [density, setDensity] = useListDensity();
  const [sort, setSort] = useListSort();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t("settings.section.surveys")}</CardTitle>
        <CardDescription>{t("settings.surveys.description")}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-5">
        <SettingRow
          title={t("settings.listDensity.label")}
          control={
            <Select value={density} onValueChange={(v) => setDensity(v as ListDensity)}>
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="comfortable">{t("settings.listDensity.comfortable")}</SelectItem>
                <SelectItem value="compact">{t("settings.listDensity.compact")}</SelectItem>
              </SelectContent>
            </Select>
          }
        />
        <SettingRow
          title={t("settings.listSort.label")}
          control={
            <Select value={sort} onValueChange={(v) => setSort(v as ListSort)}>
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="updated">{t("dashboard.sort.updated")}</SelectItem>
                <SelectItem value="created">{t("dashboard.sort.created")}</SelectItem>
                <SelectItem value="title">{t("dashboard.sort.title")}</SelectItem>
              </SelectContent>
            </Select>
          }
        />
      </CardContent>
    </Card>
  );
}
