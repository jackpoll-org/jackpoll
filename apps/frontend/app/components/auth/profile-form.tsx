"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Download, LogOut, Trash2 } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import { Spinner } from "@/app/components/ui/spinner";
import { Badge } from "@/app/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/app/components/ui/alert-dialog";
import {
  useCurrentUser,
  useChangePassword,
  useDeleteAccount,
  useLogoutAllDevices,
  useUpdateProfile,
} from "@/app/hooks/auth";
import { downloadMyDataExport } from "@/app/lib/auth/api";
import { useTranslation } from "@/app/i18n/context";

const PW_RULE = /^(?=.*[A-Z])(?=.*[a-z])(?=.*[0-9]).+$/;

export function ProfileForm() {
  const { t, locale } = useTranslation();
  const router = useRouter();
  const { data: user, isLoading } = useCurrentUser();
  const updateProfile = useUpdateProfile();
  const changePassword = useChangePassword();
  const deleteAccount = useDeleteAccount();
  const logoutAll = useLogoutAllDevices();
  const [exporting, setExporting] = useState(false);

  const [name, setName] = useState("");
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (user?.name) setName(user.name);
  }, [user?.name]);

  // The backend re-checks this on every save regardless — nextNameChangeAt is
  // only here so the field can be locked and explained before a wasted round trip.
  const nameChangeLockedUntil =
    user?.nextNameChangeAt && new Date(user.nextNameChangeAt) > new Date()
      ? new Date(user.nextNameChangeAt)
      : null;

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner className="size-6 text-muted-foreground" />
      </div>
    );
  }

  async function saveName(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      toast.error(t("profile.nameEmpty"));
      return;
    }
    try {
      await updateProfile.mutateAsync(name.trim());
      toast.success(t("profile.updated"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("profile.updateFailed"));
    }
  }

  async function savePassword(e: React.FormEvent) {
    e.preventDefault();
    if (next.length < 8 || !PW_RULE.test(next)) {
      toast.error(t("profile.password.rule"));
      return;
    }
    if (next !== confirm) {
      toast.error(t("profile.password.mismatch"));
      return;
    }
    try {
      await changePassword.mutateAsync({ currentPassword: current, newPassword: next });
      toast.success(t("profile.password.changed"));
      setCurrent("");
      setNext("");
      setConfirm("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("profile.password.changeFailed"));
    }
  }

  async function exportData() {
    setExporting(true);
    try {
      await downloadMyDataExport();
      toast.success(t("profile.data.exported"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("profile.data.exportFailed"));
    } finally {
      setExporting(false);
    }
  }

  async function logoutEverywhere() {
    try {
      await logoutAll.mutateAsync();
      toast.success(t("profile.sessions.done"));
      router.replace("/login");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("profile.sessions.failed"));
    }
  }

  async function deleteMyAccount() {
    try {
      await deleteAccount.mutateAsync();
      toast.success(t("profile.delete.done"));
      router.replace("/login");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("profile.delete.failed"));
    }
  }

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("profile.title")}</h1>
        <p className="text-sm text-muted-foreground">
          {t("profile.subtitle")}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("profile.account.title")}</CardTitle>
          <CardDescription>{t("profile.account.description")}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={saveName} className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="profile-name">{t("profile.nameLabel")}</Label>
              <Input
                id="profile-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("profile.namePlaceholder")}
                disabled={!!nameChangeLockedUntil}
              />
              {nameChangeLockedUntil && (
                <p className="text-xs text-muted-foreground">
                  {t("profile.nameCooldown", {
                    date: nameChangeLockedUntil.toLocaleDateString(locale),
                  })}
                </p>
              )}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="profile-email">{t("profile.emailLabel")}</Label>
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  id="profile-email"
                  value={user?.email ?? ""}
                  disabled
                  className="flex-1"
                />
                {user?.emailVerified ? (
                  <Badge variant="secondary">{t("profile.verified")}</Badge>
                ) : (
                  <Badge variant="outline">{t("profile.unverified")}</Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {t("profile.emailReadonly")}
              </p>
            </div>
            <div>
              <Button
                type="submit"
                disabled={updateProfile.isPending || !!nameChangeLockedUntil}
              >
                {updateProfile.isPending && <Spinner className="size-4" />}
                {t("profile.saveChanges")}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("profile.password.title")}</CardTitle>
          <CardDescription>
            {t("profile.password.description")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={savePassword} className="grid max-w-md gap-4">
            <div className="grid gap-2">
              <Label htmlFor="pw-current">{t("profile.password.current")}</Label>
              <Input
                id="pw-current"
                type="password"
                autoComplete="current-password"
                value={current}
                onChange={(e) => setCurrent(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="pw-new">{t("profile.password.new")}</Label>
              <Input
                id="pw-new"
                type="password"
                autoComplete="new-password"
                value={next}
                onChange={(e) => setNext(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="pw-confirm">{t("profile.password.confirm")}</Label>
              <Input
                id="pw-confirm"
                type="password"
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />
            </div>
            <div>
              <Button
                type="submit"
                disabled={changePassword.isPending || !current || !next}
              >
                {changePassword.isPending && <Spinner className="size-4" />}
                {t("profile.password.update")}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("profile.data.title")}</CardTitle>
          <CardDescription>
            {t("profile.data.description")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" onClick={exportData} disabled={exporting}>
            {exporting ? <Spinner className="size-4" /> : <Download className="size-4" />}
            {t("profile.data.export")}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("profile.sessions.title")}</CardTitle>
          <CardDescription>
            {t("profile.sessions.description")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" disabled={logoutAll.isPending}>
                {logoutAll.isPending ? (
                  <Spinner className="size-4" />
                ) : (
                  <LogOut className="size-4" />
                )}
                {t("profile.sessions.logoutAll")}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t("profile.sessions.confirmTitle")}</AlertDialogTitle>
                <AlertDialogDescription>
                  {t("profile.sessions.confirmBody")}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
                <AlertDialogAction onClick={logoutEverywhere}>
                  {t("profile.sessions.confirmAction")}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>

      <Card className="border-destructive/40">
        <CardHeader>
          <CardTitle className="text-base text-destructive">{t("profile.delete.title")}</CardTitle>
          <CardDescription>
            {t("profile.delete.description")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" disabled={deleteAccount.isPending}>
                {deleteAccount.isPending ? (
                  <Spinner className="size-4" />
                ) : (
                  <Trash2 className="size-4" />
                )}
                {t("profile.delete.button")}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t("profile.delete.confirmTitle")}</AlertDialogTitle>
                <AlertDialogDescription>
                  {t("profile.delete.confirmBody")}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
                <AlertDialogAction
                  onClick={deleteMyAccount}
                  className="bg-destructive text-white hover:bg-destructive/90"
                >
                  {t("profile.delete.confirmAction")}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>
    </div>
  );
}
