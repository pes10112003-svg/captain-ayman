import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { headers } from "next/headers";
import { Toaster } from "sonner";
import "@fontsource/ibm-plex-sans-arabic/arabic-400.css";
import "@fontsource/ibm-plex-sans-arabic/arabic-500.css";
import "@fontsource/ibm-plex-sans-arabic/arabic-600.css";
import "@fontsource/ibm-plex-sans-arabic/arabic-700.css";
import { ServiceWorkerRegister } from "@/components/shared/sw-register";
import { I18nProvider } from "@/i18n/client";
import { DICTS, getI18n, getTheme } from "@/i18n/server";
import { brandName } from "@/lib/constants";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const { locale } = await getI18n();
  const name = brandName(locale);
  return {
    title: { default: name, template: `%s · ${name}` },
    description:
      locale === "ar" ? "منصة الكابتن والعملاء للتمارين والتغذية ومتابعة التقدم." : "Coach and client platform for workouts, nutrition and progress tracking.",
    applicationName: name,
    appleWebApp: { capable: true, title: name, statusBarStyle: "default" },
    formatDetection: { telephone: false },
    robots: { index: false, follow: false },
    icons: { icon: "/icon.svg", apple: "/icons/apple-touch-icon.png" },
  };
}

export async function generateViewport(): Promise<Viewport> {
  const theme = await getTheme();
  const light = "#f6f6f3";
  const dark = "#0d0d0d";
  return {
    width: "device-width",
    initialScale: 1,
    viewportFit: "cover",
    themeColor:
      theme === "system"
        ? [
            { media: "(prefers-color-scheme: light)", color: light },
            { media: "(prefers-color-scheme: dark)", color: dark },
          ]
        : theme === "dark"
          ? dark
          : light,
  };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Reading request headers opts every route into dynamic rendering, which the per-request
  // CSP nonce requires (and all data here is per-user anyway).
  await headers();
  const [{ locale, dir }, theme] = await Promise.all([getI18n(), getTheme()]);
  return (
    <html
      lang={locale}
      dir={dir}
      data-theme={theme === "system" ? undefined : theme}
      className={`${GeistSans.variable} ${GeistMono.variable}`}
      suppressHydrationWarning
    >
      <body className="min-h-dvh">
        <I18nProvider locale={locale} dict={DICTS[locale]}>
          {children}
          <Toaster
            position="top-center"
            dir={dir}
            theme={theme === "system" ? "system" : theme}
            richColors
            closeButton
            toastOptions={{ className: "!rounded-xl !font-sans" }}
          />
        </I18nProvider>
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
