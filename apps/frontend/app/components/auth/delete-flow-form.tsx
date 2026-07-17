"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { EyeIcon, EyeOffIcon, Trash2 } from "lucide-react";

import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import { Alert, AlertDescription } from "@/app/components/ui/alert";
import { Spinner } from "@/app/components/ui/spinner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/app/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

import {
  deleteRequestSchema,
  deleteConfirmSchema,
  type DeleteRequestFormData,
  type DeleteConfirmFormData,
} from "@/app/lib/auth/schemas";
import {
  useRequestAccountDeletion,
  useConfirmAccountDeletion,
  useRequestDataDeletion,
  useConfirmDataDeletion,
} from "@/app/hooks/auth";
import { useTranslation } from "@/app/i18n/context";
import type { TranslationKey } from "@/app/i18n/translations";

type DeleteMode = "account" | "data";

interface DeleteFlowFormProps {
  mode: DeleteMode;
}

interface ModeCopy {
  submit: TranslationKey;
  submitting: TranslationKey;
  genericError: TranslationKey;
  codeSentTitle: TranslationKey;
  codeSentBody: TranslationKey;
  codeLabel: TranslationKey;
  confirmWarning: TranslationKey;
  confirmButton: TranslationKey;
  doneTitle: TranslationKey;
  doneBody: TranslationKey;
  backLabel: TranslationKey;
  backHref: string;
}

const COPY: Record<DeleteMode, ModeCopy> = {
  account: {
    submit: "auth.deleteAccountPublic.submit",
    submitting: "auth.deleteAccountPublic.submitting",
    genericError: "auth.deleteAccountPublic.genericError",
    codeSentTitle: "auth.deleteAccountPublic.codeSentTitle",
    codeSentBody: "auth.deleteAccountPublic.codeSentBody",
    codeLabel: "auth.deleteAccountPublic.codeLabel",
    confirmWarning: "auth.deleteAccountPublic.confirmWarning",
    confirmButton: "auth.deleteAccountPublic.confirmButton",
    doneTitle: "auth.deleteAccountPublic.doneTitle",
    doneBody: "auth.deleteAccountPublic.doneBody",
    backLabel: "auth.deleteAccountPublic.backToHome",
    backHref: "/",
  },
  data: {
    submit: "auth.deleteDataPublic.submit",
    submitting: "auth.deleteDataPublic.submitting",
    genericError: "auth.deleteDataPublic.genericError",
    codeSentTitle: "auth.deleteDataPublic.codeSentTitle",
    codeSentBody: "auth.deleteDataPublic.codeSentBody",
    codeLabel: "auth.deleteDataPublic.codeLabel",
    confirmWarning: "auth.deleteDataPublic.confirmWarning",
    confirmButton: "auth.deleteDataPublic.confirmButton",
    doneTitle: "auth.deleteDataPublic.doneTitle",
    doneBody: "auth.deleteDataPublic.doneBody",
    backLabel: "auth.deleteDataPublic.backToLogin",
    backHref: "/login",
  },
};

type Step = "credentials" | "code" | "done";

export function DeleteFlowForm({ mode }: DeleteFlowFormProps) {
  const { t } = useTranslation();
  const copy = COPY[mode];

  const [step, setStep] = useState<Step>("credentials");
  const [email, setEmail] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  // Both mode's mutations are always created (rules of hooks); only the
  // matching pair is used, selected by `mode`.
  const requestAccount = useRequestAccountDeletion();
  const confirmAccount = useConfirmAccountDeletion();
  const requestData = useRequestDataDeletion();
  const confirmData = useConfirmDataDeletion();
  const requestMutation = mode === "account" ? requestAccount : requestData;
  const confirmMutation = mode === "account" ? confirmAccount : confirmData;

  const requestSchema = useMemo(() => deleteRequestSchema(t), [t]);
  const requestForm = useForm<DeleteRequestFormData>({
    resolver: zodResolver(requestSchema),
    defaultValues: { email: "", password: "" },
  });

  const codeSchema = useMemo(() => deleteConfirmSchema(t), [t]);
  const codeForm = useForm<DeleteConfirmFormData>({
    resolver: zodResolver(codeSchema),
    defaultValues: { code: "" },
  });

  const onSubmitCredentials = async (data: DeleteRequestFormData) => {
    try {
      await requestMutation.mutateAsync(data);
      setEmail(data.email);
      setStep("code");
    } catch {
      // Error handled via requestMutation.error
    }
  };

  const onCodeValid = () => setConfirmOpen(true);

  const handleConfirmDelete = async () => {
    const { code } = codeForm.getValues();
    try {
      await confirmMutation.mutateAsync({ email, code });
      setConfirmOpen(false);
      setStep("done");
    } catch {
      setConfirmOpen(false);
      // Error handled via confirmMutation.error
    }
  };

  if (step === "done") {
    return (
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-primary/10">
          <Trash2 className="size-6 text-primary" />
        </div>
        <h2 className="text-xl font-semibold">{t(copy.doneTitle)}</h2>
        <p className="text-sm text-muted-foreground">{t(copy.doneBody)}</p>
        <Link href={copy.backHref}>
          <Button className="mt-2">{t(copy.backLabel)}</Button>
        </Link>
      </div>
    );
  }

  if (step === "code") {
    return (
      <form onSubmit={codeForm.handleSubmit(onCodeValid)} className="flex flex-col gap-6">
        {confirmMutation.error && (
          <Alert variant="destructive">
            <AlertDescription>
              {confirmMutation.error instanceof Error
                ? confirmMutation.error.message
                : t(copy.genericError)}
            </AlertDescription>
          </Alert>
        )}

        <div className="text-center">
          <h2 className="text-lg font-semibold">{t(copy.codeSentTitle)}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {t(copy.codeSentBody, { email })}
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="delete-flow-code">{t(copy.codeLabel)}</Label>
          <Input
            id="delete-flow-code"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            placeholder="123456"
            disabled={confirmMutation.isPending}
            {...codeForm.register("code")}
            className={cn(
              "text-center text-lg tracking-[0.4em]",
              codeForm.formState.errors.code && "border-destructive",
            )}
          />
          {codeForm.formState.errors.code && (
            <p className="text-sm text-destructive">
              {codeForm.formState.errors.code.message}
            </p>
          )}
        </div>

        <Button type="submit" variant="destructive" className="w-full">
          <Trash2 className="size-4" />
          {t(copy.confirmButton)}
        </Button>

        <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t(copy.confirmButton)}?</AlertDialogTitle>
              <AlertDialogDescription>{t(copy.confirmWarning)}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={confirmMutation.isPending}>
                {t("common.cancel")}
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={handleConfirmDelete}
                disabled={confirmMutation.isPending}
                className="bg-destructive text-white hover:bg-destructive/90"
              >
                {confirmMutation.isPending ? (
                  <Spinner className="size-4" />
                ) : (
                  t(copy.confirmButton)
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </form>
    );
  }

  return (
    <form onSubmit={requestForm.handleSubmit(onSubmitCredentials)} className="flex flex-col gap-6">
      {requestMutation.error && (
        <Alert variant="destructive">
          <AlertDescription>
            {requestMutation.error instanceof Error
              ? requestMutation.error.message
              : t(copy.genericError)}
          </AlertDescription>
        </Alert>
      )}

      <div className="flex flex-col gap-2">
        <Label htmlFor="delete-flow-email">{t("auth.email")}</Label>
        <Input
          id="delete-flow-email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          disabled={requestMutation.isPending}
          {...requestForm.register("email")}
          className={cn(requestForm.formState.errors.email && "border-destructive")}
        />
        {requestForm.formState.errors.email && (
          <p className="text-sm text-destructive">
            {requestForm.formState.errors.email.message}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="delete-flow-password">{t("auth.password")}</Label>
        <div className="relative">
          <Input
            id="delete-flow-password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            disabled={requestMutation.isPending}
            {...requestForm.register("password")}
            className={cn(
              "pr-10",
              requestForm.formState.errors.password && "border-destructive",
            )}
          />
          <button
            type="button"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            onClick={() => setShowPassword(!showPassword)}
            tabIndex={-1}
            aria-label={showPassword ? t("auth.hidePassword") : t("auth.showPassword")}
          >
            {showPassword ? <EyeOffIcon className="size-4" /> : <EyeIcon className="size-4" />}
          </button>
        </div>
        {requestForm.formState.errors.password && (
          <p className="text-sm text-destructive">
            {requestForm.formState.errors.password.message}
          </p>
        )}
      </div>

      <Button type="submit" disabled={requestMutation.isPending} className="w-full">
        {requestMutation.isPending ? (
          <>
            <Spinner className="size-4" />
            {t(copy.submitting)}
          </>
        ) : (
          t(copy.submit)
        )}
      </Button>
    </form>
  );
}
