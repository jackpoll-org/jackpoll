"use client";

import { RequireAuth } from "@/app/components/auth/require-auth";
import { BiometricLock } from "@/app/components/native/biometric-lock";
import { PushRegister } from "@/app/components/native/push-register";
import { RememberRoute } from "@/app/components/native/remember-route";
import { AppSidebar } from "@/app/components/common/app-sidebar";
import { GlobalSearch } from "@/app/components/common/global-search";
import { NotificationBell } from "@/app/components/common/notification-bell";
import { ThemeCustomizerPanel } from "@/app/components/common/theme-panel";
import { Separator } from "@/app/components/ui/separator";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/app/components/ui/sidebar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <RequireAuth>
      <BiometricLock>
      <PushRegister />
      <RememberRoute />
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          {/* Sticky + opaque so the iOS status bar area has a solid background,
              and pt safe-area-inset-top drops the controls below the notch so
              they stay tappable on iOS (taps under the status bar are dropped). */}
          <header className="sticky top-0 z-30 shrink-0 border-b bg-background pt-[env(safe-area-inset-top)]">
            <div className="flex h-14 items-center gap-2 px-4">
              <SidebarTrigger className="shrink-0" />
              <Separator orientation="vertical" className="mr-1 h-5 shrink-0" />
              {/* Search shrinks (min-w-0 flex-1) so the theme button always fits. */}
              <div className="min-w-0 flex-1">
                <GlobalSearch />
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <NotificationBell />
                <ThemeCustomizerPanel />
              </div>
            </div>
          </header>
          {children}
        </SidebarInset>
      </SidebarProvider>
      </BiometricLock>
    </RequireAuth>
  );
}
