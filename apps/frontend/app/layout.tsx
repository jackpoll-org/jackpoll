import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { ActiveThemeProvider } from "@/app/components/active-theme";
import { AuthProvider } from "@/app/components/auth/auth-provider";
import { I18nProvider } from "@/app/i18n/context";
import { DEFAULT_LOCALE, LOCALES, type Locale } from "@/app/i18n/translations";
import { Toaster } from "@/app/components/ui/sonner";
import { PwaRegister } from "@/app/components/pwa-register";
import { DeepLinks } from "@/app/components/native/deep-links";
import { OfflineSync } from "@/app/components/offline-sync";
import { OfflineBanner } from "@/app/components/offline-banner";
import { DEFAULT_THEME, type ThemePreset, type ThemeRadius, type ThemeScale, type ThemeContentLayout } from "@/app/lib/themes";
import { cookies } from "next/headers";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Jackpoll",
  description: "Create and manage surveys with ease",
  applicationName: "Jackpoll",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Jackpoll",
    statusBarStyle: "default",
  },
  icons: {
    icon: [
      { url: "/icons/icon.svg", type: "image/svg+xml" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#024DB2",
  width: "device-width",
  initialScale: 1,
  // Draw under the iOS status bar / notch so safe-area insets can be used.
  viewportFit: "cover",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const themeSettings = {
    preset: (cookieStore.get("theme_preset")?.value ?? DEFAULT_THEME.preset) as ThemePreset,
    scale: (cookieStore.get("theme_scale")?.value ?? DEFAULT_THEME.scale) as ThemeScale,
    radius: (cookieStore.get("theme_radius")?.value ?? DEFAULT_THEME.radius) as ThemeRadius,
    contentLayout: (cookieStore.get("theme_content_layout")?.value ?? DEFAULT_THEME.contentLayout) as ThemeContentLayout,
  };

  const bodyAttributes: Record<string, string> = Object.fromEntries(
    Object.entries(themeSettings).flatMap(([key, value]) =>
      value && value !== "default" && value !== "none"
        ? [[`data-theme-${key.replace(/([A-Z])/g, "-$1").toLowerCase()}`, value]]
        : [],
    ),
  );

  // Hide-brand preference (#settings) — presence attribute drives a CSS rule,
  // server-read like the theme so there is no flash of the logo.
  if (cookieStore.get("ui_hide_brand")?.value === "1") {
    bodyAttributes["data-hide-brand"] = "";
  }

  const cookieLocale = cookieStore.get("locale")?.value;
  const initialLocale: Locale = (LOCALES as readonly string[]).includes(
    cookieLocale ?? "",
  )
    ? (cookieLocale as Locale)
    : DEFAULT_LOCALE;

  return (
    <html
      lang={initialLocale}
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable}`}
    >
      <body
        suppressHydrationWarning
        className="bg-background font-sans antialiased"
        {...bodyAttributes}
      >
        {/* Runtime feature flags so self-hosters toggle via env, no rebuild:
            collab (#85) and live-results push (wordcloud, default on). */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              `window.__COLLAB_ENABLED__=${process.env.COLLAB_ENABLED === "true"};` +
              `window.__LIVE_RESULTS_ENABLED__=${process.env.LIVE_RESULTS_ENABLED !== "false"};`,
          }}
        />
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
        >
          <ActiveThemeProvider initialTheme={themeSettings}>
            <I18nProvider initialLocale={initialLocale}>
              <OfflineBanner />
              <AuthProvider>{children}</AuthProvider>
              <PwaRegister />
              <DeepLinks />
              <OfflineSync />
              <Toaster position="top-center" richColors />
            </I18nProvider>
          </ActiveThemeProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}


