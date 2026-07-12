"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogOutIcon, UserIcon } from "lucide-react";

import { Avatar, AvatarFallback } from "@/app/components/ui/avatar";
import { Button } from "@/app/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/app/components/ui/dropdown-menu";
import { Spinner } from "@/app/components/ui/spinner";

import { useAuthContext } from "@/app/components/auth/auth-provider";
import { useLogout } from "@/app/hooks/auth";
import { useIsClient } from "@/app/hooks/use-is-client";
import { useTranslation } from "@/app/i18n/context";

export function UserMenu() {
  const { t } = useTranslation();
  const { user, isLoading } = useAuthContext();
  const logout = useLogout();
  const router = useRouter();

  // Defer auth-dependent rendering until after hydration to avoid a
  // server/client mismatch: the server has no localStorage so user=null, but
  // the client starts with isLoading=true. useIsClient is false during SSR and
  // the first hydration render, then true — without a setState-in-effect.
  const mounted = useIsClient();

  const handleLogout = async () => {
    try {
      await logout.mutateAsync();
    } finally {
      router.replace("/login");
    }
  };

  if (!mounted || isLoading) {
    // Return a placeholder with the same dimensions as the rendered content
    // to minimize layout shift. A small skeleton avoids the SVG hydration issue.
    return <div className="size-5" aria-hidden />;
  }

  if (!user) {
    return (
      <div className="flex items-center gap-2">
        <Link href="/login">
          <Button variant="ghost" size="sm">
            {t("auth.signIn")}
          </Button>
        </Link>
        <Link href="/register">
          <Button size="sm">{t("auth.signUp")}</Button>
        </Link>
      </div>
    );
  }

  const initials = user.name
    .split(" ")
    .map((n) => n.charAt(0).toUpperCase())
    .join("")
    .slice(0, 2);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="rounded-full">
          <Avatar size="sm">
            <AvatarFallback className="text-xs">{initials}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-medium">{user.name}</span>
            <span className="text-xs text-muted-foreground">{user.email}</span>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => router.push("/profile")}>
          <UserIcon className="size-4" />
          {t("auth.profile")}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={handleLogout}
          disabled={logout.isPending}
          className="text-destructive focus:text-destructive"
        >
          {logout.isPending ? (
            <Spinner className="size-4" />
          ) : (
            <LogOutIcon className="size-4" />
          )}
          {t("auth.signOut")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
