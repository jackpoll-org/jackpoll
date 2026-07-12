"use client";

import { useAuthContext } from "@/app/components/auth/auth-provider";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Spinner } from "@/app/components/ui/spinner";
import { RequireAuth } from "@/app/components/auth/require-auth";

/**
 * Once a session exists, jump to the dashboard. Kept separate so it only mounts
 * *after* RequireAuth has restored/confirmed auth — by then the auth cookie is
 * back, so the `/surveys` middleware guard lets the navigation through.
 */
function EnterApp() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/surveys");
  }, [router]);
  return (
    <div className="flex flex-1 items-center justify-center py-32">
      <Spinner className="size-8 text-muted-foreground" />
    </div>
  );
}

export default function Home() {
  const { isLoading } = useAuthContext();

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center py-32">
        <Spinner className="size-8 text-muted-foreground" />
      </div>
    );
  }

  // The root path is public in the middleware, so the biometric unlock screen
  // stays reachable here even after the auth cookie was cleared on token expiry.
  // We must NOT redirect to `/surveys` ourselves while unauthenticated: that
  // route is cookie-gated and would 307 to /login, skipping the Face ID
  // restore. RequireAuth handles both cases — offline-token unlock (native) or
  // a redirect to /login when no biometric session exists.
  return (
    <RequireAuth>
      <EnterApp />
    </RequireAuth>
  );
}
