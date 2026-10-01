/**
 * Locale-aware formatting shared by server and client components.
 * Calendar days (YYYY-MM-DD) are formatted in UTC (they carry no time); instants use the coach timezone.
 */
import { intlLocale, type Locale, type Plural } from "./config";
import type { Dict } from "./en";
import { diffDays, isoDateInTz, zonedParts } from "@/lib/time";
import { cmTo, kgTo, round, type LengthUnit, type WeightUnit } from "@/lib/units";

/** "{name} completed {workout}" + { name, workout } */
export function interpolate(template: string, vars: Record<string, string | number | null | undefined> = {}) {
  return template.replace(/\{(\w+)\}/g, (_, k: string) => (vars[k] == null ? "" : String(vars[k])));
}

export function makeFormat(locale: Locale, t: Dict) {
  const L = intlLocale(locale);
  const cache = new Map<string, Intl.DateTimeFormat>();
  const dtf = (opts: Intl.DateTimeFormatOptions) => {
    const key = JSON.stringify(opts);
    let f = cache.get(key);
    if (!f) cache.set(key, (f = new Intl.DateTimeFormat(L, opts)));
    return f;
  };
  const day = (iso: string) => new Date(`${iso}T12:00:00Z`);
  const pluralRules = new Intl.PluralRules(L);

  const fmt = {
    locale,
    /** "Sep 30, 2026" */
    date: (iso: string, opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", year: "numeric" }) =>
      dtf({ ...opts, timeZone: "UTC" }).format(day(iso)),
    dateShort: (iso: string) => dtf({ month: "short", day: "numeric", timeZone: "UTC" }).format(day(iso)),
    dateLong: (iso: string) => dtf({ weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone: "UTC" }).format(day(iso)),
    weekday: (iso: string, style: "long" | "short" = "long") => dtf({ weekday: style, timeZone: "UTC" }).format(day(iso)),
    /** 0 = Sunday */
    weekdayName: (dow: number, style: "long" | "short" = "long") =>
      dtf({ weekday: style, timeZone: "UTC" }).format(new Date(Date.UTC(2023, 0, 1 + dow, 12))),
    month: (iso: string) => dtf({ month: "short", timeZone: "UTC" }).format(day(iso)),
    dayNum: (iso: string) => dtf({ day: "numeric", timeZone: "UTC" }).format(day(iso)),
    time: (instant: Date | string, tz: string) => dtf({ hour: "numeric", minute: "2-digit", timeZone: tz }).format(new Date(instant)),
    dateTime: (instant: Date | string, tz: string, style: "long" | "short" = "long") => {
      const d = new Date(instant);
      const datePart = dtf({ month: style === "long" ? "long" : "short", day: "numeric", year: "numeric", timeZone: tz }).format(d);
      return `${datePart} — ${fmt.time(d, tz)}`;
    },
    /** "Today — 8:42 PM" */
    relativeDay: (instant: Date | string, tz: string, now: Date = new Date()) => {
      const d = new Date(instant);
      const delta = diffDays(isoDateInTz(now, tz), isoDateInTz(d, tz));
      if (delta === 0) return `${t.common.today} — ${fmt.time(d, tz)}`;
      if (delta === 1) return `${t.common.yesterday} — ${fmt.time(d, tz)}`;
      return fmt.dateTime(d, tz, "short");
    },
    /** "5 min ago" */
    timeAgo: (instant: Date | string, now: Date = new Date()) => {
      const rtf = new Intl.RelativeTimeFormat(L, { numeric: "auto", style: "short" });
      const secs = Math.round((new Date(instant).getTime() - now.getTime()) / 1000);
      const abs = Math.abs(secs);
      if (abs < 45) return rtf.format(0, "second");
      if (abs < 3600) return rtf.format(Math.round(secs / 60), "minute");
      if (abs < 86_400) return rtf.format(Math.round(secs / 3600), "hour");
      if (abs < 86_400 * 30) return rtf.format(Math.round(secs / 86_400), "day");
      if (abs < 86_400 * 365) return rtf.format(Math.round(secs / (86_400 * 30)), "month");
      return rtf.format(Math.round(secs / (86_400 * 365)), "year");
    },
    /** "08:00:00" → "8:00 AM" / "8:00 ص" */
    clock: (time: string) => {
      const [h, m] = time.split(":").map(Number);
      return dtf({ hour: "numeric", minute: "2-digit", timeZone: "UTC" }).format(new Date(Date.UTC(2020, 0, 1, h, m)));
    },
    greeting: (tz: string, now: Date = new Date()) => {
      const h = zonedParts(now, tz).hour;
      if (h < 5) return t.greeting.evening;
      if (h < 12) return t.greeting.morning;
      if (h < 17) return t.greeting.afternoon;
      return t.greeting.evening;
    },
    num: (n: number | null | undefined, digits = 1) =>
      n == null ? "—" : new Intl.NumberFormat(L, { maximumFractionDigits: digits }).format(n),
    pct: (n: number | null | undefined, digits = 0) =>
      n == null || Number.isNaN(n) ? "—" : `${new Intl.NumberFormat(L, { maximumFractionDigits: digits, minimumFractionDigits: digits }).format(n)}%`,
    unit: (u: string) => (t.units as Record<string, string>)[u === "%" ? "pct" : u] ?? u,
    weight: (kg: number | null | undefined, unit: WeightUnit, digits = 1) =>
      kg == null ? "—" : `${fmt.num(round(kgTo(kg, unit), digits), digits)} ${fmt.unit(unit)}`,
    length: (cm: number | null | undefined, unit: LengthUnit, digits = 1) =>
      cm == null ? "—" : `${fmt.num(round(cmTo(cm, unit), digits), digits)} ${fmt.unit(unit)}`,
    signedWeight: (kg: number | null | undefined, unit: WeightUnit) => {
      if (kg == null) return "—";
      const v = round(kgTo(kg, unit), 1);
      return `${v > 0 ? "+" : v < 0 ? "−" : "±"}${fmt.num(Math.abs(v))} ${fmt.unit(unit)}`;
    },
    /** value + display unit, percent glued: "20.6%" / "35.1 kg" */
    measure: (value: number, unit: string) => (unit === "%" ? `${fmt.num(value)}%` : `${fmt.num(value)} ${fmt.unit(unit)}`),
    plural: (p: Plural, n: number) => {
      const cat = n === 0 && p.zero ? "zero" : (pluralRules.select(n) as keyof Plural);
      return interpolate(p[cat] ?? p.other, { n: fmt.num(n, 0) });
    },
  };
  return fmt;
}
export type Format = ReturnType<typeof makeFormat>;
