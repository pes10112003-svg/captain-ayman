"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Languages, Monitor, Moon, Sun } from "lucide-react";
import { useI18n } from "@/i18n/client";
import { LOCALE_COOKIE, THEME_COOKIE, dirOf, type Locale, type Theme } from "@/i18n/config";
import { cn } from "@/lib/utils";

const YEAR = 60 * 60 * 24 * 365;

function writeCookie(name: string, value: string) {
  const secure = location.protocol === "https:" ? "; secure" : "";
  document.cookie = `${name}=${value}; path=/; max-age=${YEAR}; samesite=lax${secure}`;
}

function readThemeCookie(): Theme {
  const m = document.cookie.match(new RegExp(`(?:^|; )${THEME_COOKIE}=(light|dark|system)`));
  return (m?.[1] as Theme) ?? "system";
}

/** Applies a theme instantly (no reload) and remembers it on this device. */
export function applyTheme(theme: Theme) {
  writeCookie(THEME_COOKIE, theme);
  const root = document.documentElement;
  if (theme === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", theme);
  const dark = theme === "dark" || (theme === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute("content", dark ? "#0d0d0d" : "#f6f6f3"));
}

function useTheme() {
  const [theme, setTheme] = useState<Theme>("system");
  useEffect(() => {
    // Sync the control with the cookie after hydration (the server already rendered data-theme).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTheme(readThemeCookie());
  }, []);
  return [
    theme,
    (next: Theme) => {
      setTheme(next);
      applyTheme(next);
    },
  ] as const;
}

function useLocaleSwitch() {
  const router = useRouter();
  const { locale } = useI18n();
  const [pending, start] = useTransition();
  const switchTo = (next: Locale) => {
    if (next === locale) return;
    writeCookie(LOCALE_COOKIE, next);
    document.documentElement.lang = next;
    document.documentElement.dir = dirOf(next);
    start(() => router.refresh());
  };
  return { locale, switchTo, pending };
}

/** Icon button that flips light ↔ dark (for compact headers). */
export function ThemeIconButton({ className, tone = "default" }: { className?: string; tone?: "default" | "sidebar" }) {
  const { t } = useI18n();
  const [theme, setTheme] = useTheme();
  const isDark = () =>
    theme === "dark" || (theme === "system" && typeof window !== "undefined" && matchMedia("(prefers-color-scheme: dark)").matches);
  return (
    <button
      type="button"
      onClick={() => setTheme(isDark() ? "light" : "dark")}
      className={cn(
        "grid size-10 place-items-center rounded-xl transition",
        tone === "sidebar" ? "text-sidebar-muted hover:bg-sidebar-hover hover:text-white" : "text-ink-2 hover:bg-surface-2",
        className,
      )}
      aria-label={`${t.common.theme}: ${t.common.dark} / ${t.common.light}`}
      title={`${t.common.dark} / ${t.common.light}`}
    >
      <Moon className="size-[18px] dark-hidden" aria-hidden />
      <Sun className="size-[18px] light-hidden" aria-hidden />
    </button>
  );
}

/** Small "EN" / "ع" button that switches language. */
export function LanguageIconButton({ className, tone = "default" }: { className?: string; tone?: "default" | "sidebar" }) {
  const { t } = useI18n();
  const { locale, switchTo, pending } = useLocaleSwitch();
  const next: Locale = locale === "ar" ? "en" : "ar";
  return (
    <button
      type="button"
      onClick={() => switchTo(next)}
      disabled={pending}
      lang={next}
      className={cn(
        "grid h-10 min-w-10 place-items-center rounded-xl px-2 text-[13px] font-semibold transition disabled:opacity-50",
        tone === "sidebar" ? "text-sidebar-muted hover:bg-sidebar-hover hover:text-white" : "text-ink-2 hover:bg-surface-2",
        className,
      )}
      aria-label={`${t.common.language}: ${next === "en" ? "English" : "العربية"}`}
      title={next === "en" ? "English" : "العربية"}
    >
      {next === "en" ? "EN" : "ع"}
    </button>
  );
}

const THEME_OPTIONS: { value: Theme; icon: typeof Sun }[] = [
  { value: "light", icon: Sun },
  { value: "dark", icon: Moon },
  { value: "system", icon: Monitor },
];

/** Full segmented controls for settings / profile pages. */
export function AppearanceControls({ className }: { className?: string }) {
  const { t } = useI18n();
  const [theme, setTheme] = useTheme();
  const { locale, switchTo, pending } = useLocaleSwitch();
  const seg = "inline-flex rounded-xl border border-line bg-surface-2 p-1";
  const item = (active: boolean) =>
    cn(
      "flex h-9 min-w-[5.5rem] flex-1 items-center justify-center gap-1.5 rounded-lg px-3 text-[13px] font-medium transition [&_svg]:size-4",
      active ? "bg-surface text-ink shadow-card" : "text-muted hover:text-ink",
    );
  return (
    <div className={cn("grid gap-5 sm:grid-cols-2", className)}>
      <div>
        <p className="mb-2 flex items-center gap-1.5 text-sm font-medium text-ink">
          <Languages className="size-4 text-muted" aria-hidden /> {t.common.language}
        </p>
        <div className={cn(seg, "w-full")} role="radiogroup" aria-label={t.common.language}>
          {(["ar", "en"] as const).map((l) => (
            <button
              key={l}
              type="button"
              role="radio"
              aria-checked={locale === l}
              disabled={pending}
              lang={l}
              onClick={() => switchTo(l)}
              className={item(locale === l)}
            >
              {l === "ar" ? "العربية" : "English"}
            </button>
          ))}
        </div>
      </div>
      <div>
        <p className="mb-2 flex items-center gap-1.5 text-sm font-medium text-ink">
          <Moon className="size-4 text-muted" aria-hidden /> {t.common.theme}
        </p>
        <div className={cn(seg, "w-full")} role="radiogroup" aria-label={t.common.theme}>
          {THEME_OPTIONS.map(({ value, icon: Icon }) => (
            <button key={value} type="button" role="radio" aria-checked={theme === value} onClick={() => setTheme(value)} className={item(theme === value)}>
              <Icon aria-hidden /> {t.common[value]}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
