"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { DirectionProvider } from "@radix-ui/react-direction";
import { dirOf, type Locale } from "./config";
import type { Dict } from "./en";
import { interpolate, makeFormat } from "./format";

type Ctx = { locale: Locale; t: Dict };
const I18nContext = createContext<Ctx | null>(null);

export function I18nProvider({ locale, dict, children }: { locale: Locale; dict: Dict; children: ReactNode }) {
  const value = useMemo(() => ({ locale, t: dict }), [locale, dict]);
  return (
    <I18nContext.Provider value={value}>
      <DirectionProvider dir={dirOf(locale)}>{children}</DirectionProvider>
    </I18nContext.Provider>
  );
}

/** Client-side counterpart of getI18n(). */
export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used inside <I18nProvider>");
  const { locale, t } = ctx;
  const fmt = useMemo(() => makeFormat(locale, t), [locale, t]);
  return { locale, dir: dirOf(locale), t, f: interpolate, fmt };
}
