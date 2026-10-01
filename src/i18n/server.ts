import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { ar } from "./ar";
import { DEFAULT_LOCALE, LOCALE_COOKIE, THEME_COOKIE, dirOf, isLocale, isTheme, type Locale, type Theme } from "./config";
import { en, type Dict } from "./en";
import { interpolate, makeFormat } from "./format";

export const DICTS: Record<Locale, Dict> = { ar, en };

/** Locale: the viewer's explicit choice (cookie), otherwise Arabic — the app's default for everyone. */
export const getLocale = cache(async (): Promise<Locale> => {
  const fromCookie = (await cookies()).get(LOCALE_COOKIE)?.value;
  return isLocale(fromCookie) ? fromCookie : DEFAULT_LOCALE;
});

export const getTheme = cache(async (): Promise<Theme> => {
  const v = (await cookies()).get(THEME_COOKIE)?.value;
  return isTheme(v) ? v : "system";
});

/** Per-request translation bundle for server components & actions. */
export const getI18n = cache(async () => {
  const locale = await getLocale();
  const t = DICTS[locale];
  return { locale, dir: dirOf(locale), t, f: interpolate, fmt: makeFormat(locale, t) };
});
export type I18n = Awaited<ReturnType<typeof getI18n>>;
