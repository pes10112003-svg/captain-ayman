export const LOCALES = ["ar", "en"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "ar";

export const THEMES = ["light", "dark", "system"] as const;
export type Theme = (typeof THEMES)[number];

export const LOCALE_COOKIE = "ca_locale";
export const THEME_COOKIE = "ca_theme";

export const isLocale = (v: unknown): v is Locale => v === "ar" || v === "en";
export const isTheme = (v: unknown): v is Theme => v === "light" || v === "dark" || v === "system";

/** Arabic UI uses Latin digits so numbers match inputs, charts and phone keypads. */
export const intlLocale = (l: Locale) => (l === "ar" ? "ar-EG-u-nu-latn" : "en-US");
export const dirOf = (l: Locale): "rtl" | "ltr" => (l === "ar" ? "rtl" : "ltr");

export type Plural = { zero?: string; one: string; two?: string; few?: string; many?: string; other: string };
export const plural = (p: Plural) => p;
