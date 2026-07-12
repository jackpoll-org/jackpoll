"use client";

import { ReactNode, createContext, useContext, useEffect, useMemo, useState } from "react";
import { DEFAULT_THEME, type ThemeType } from "@/app/lib/themes";
import { setCookie } from "@/app/lib/cookies";

type ThemeContextType = {
  theme: ThemeType;
  setTheme: (theme: ThemeType) => void;
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ActiveThemeProvider({
  children,
  initialTheme,
}: {
  children: ReactNode;
  initialTheme?: ThemeType;
}) {
  const [theme, setTheme] = useState<ThemeType>(
    () => initialTheme ?? DEFAULT_THEME
  );

  useEffect(() => {
    const body = document.body;

    // Preset
    if (theme.preset !== "default") {
      setCookie("theme_preset", theme.preset);
      body.setAttribute("data-theme-preset", theme.preset);
    } else {
      setCookie("theme_preset", null);
      body.removeAttribute("data-theme-preset");
    }

    // Radius
    if (theme.radius !== "default") {
      setCookie("theme_radius", theme.radius);
      body.setAttribute("data-theme-radius", theme.radius);
    } else {
      setCookie("theme_radius", null);
      body.removeAttribute("data-theme-radius");
    }

    // Content layout
    setCookie("theme_content_layout", theme.contentLayout);
    body.setAttribute("data-theme-content-layout", theme.contentLayout);

    // Scale
    if (theme.scale !== "none") {
      setCookie("theme_scale", theme.scale);
      body.setAttribute("data-theme-scale", theme.scale);
    } else {
      setCookie("theme_scale", null);
      body.removeAttribute("data-theme-scale");
    }
  }, [theme]);

  const value = useMemo(() => ({ theme, setTheme }), [theme]);

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useThemeConfig() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error("useThemeConfig must be used within an ActiveThemeProvider");
  }
  return context;
}
