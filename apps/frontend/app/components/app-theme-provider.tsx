"use client";

import { createContext, useContext, useLayoutEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { ThemeProvider } from "next-themes";
import { PUBLIC_THEME_STORAGE_KEY, isPublicPath } from "@/app/lib/theme/public-theme";

const ForceLightContext = createContext<(force: boolean) => void>(() => {});

export function AppThemeProvider({ children }: { children: ReactNode }) {
  const publicPage = isPublicPath(usePathname());
  const [forceLight, setForceLight] = useState(false);
  return (
    <ForceLightContext.Provider value={setForceLight}>
      <ThemeProvider
        key={publicPage ? "public" : "app"}
        attribute="class"
        storageKey={publicPage ? PUBLIC_THEME_STORAGE_KEY : "theme"}
        defaultTheme={publicPage ? "system" : "light"}
        forcedTheme={publicPage && forceLight ? "light" : undefined}
        enableSystem
        disableTransitionOnChange
      >
        {children}
      </ThemeProvider>
    </ForceLightContext.Provider>
  );
}

export function useForceLightTheme(force: boolean) {
  const setForceLight = useContext(ForceLightContext);
  useLayoutEffect(() => {
    if (!force) return;
    setForceLight(true);
    return () => setForceLight(false);
  }, [force, setForceLight]);
}

const FORCE_LIGHT_SCRIPT =
  'var d=document.documentElement;d.classList.remove("dark");d.classList.add("light");d.style.colorScheme="light"';

export function ForceLightTheme() {
  useForceLightTheme(true);
  return <script dangerouslySetInnerHTML={{ __html: FORCE_LIGHT_SCRIPT }} />;
}
