/**
 * Timezone-aware date helpers (safe to use on client and server).
 *
 * Conventions
 * • Instants (timestamps) are JS `Date` objects / ISO strings in UTC, always produced by the server.
 * • Calendar days are ISO strings `YYYY-MM-DD` interpreted in the coach's configured IANA timezone.
 */

const WEEKDAY_INDEX: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

export const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;
export const WEEKDAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

const partsCache = new Map<string, Intl.DateTimeFormat>();
function partsFormatter(timeZone: string) {
  let f = partsCache.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
      weekday: "short",
    });
    partsCache.set(timeZone, f);
  }
  return f;
}

export function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export function zonedParts(date: Date, timeZone: string) {
  const parts: Record<string, string> = {};
  for (const p of partsFormatter(timeZone).formatToParts(date)) parts[p.type] = p.value;
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour) % 24,
    minute: Number(parts.minute),
    second: Number(parts.second),
    weekday: WEEKDAY_INDEX[parts.weekday] ?? 0,
  };
}

const pad = (n: number) => String(n).padStart(2, "0");

/** Calendar date (YYYY-MM-DD) of `date` in `timeZone`. */
export function isoDateInTz(date: Date, timeZone: string): string {
  const p = zonedParts(date, timeZone);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

export function todayInTz(timeZone: string, now: Date = new Date()): string {
  return isoDateInTz(now, timeZone);
}

/** Minutes since local midnight for `date` in `timeZone`. */
export function minutesOfDayInTz(date: Date, timeZone: string): number {
  const p = zonedParts(date, timeZone);
  return p.hour * 60 + p.minute;
}

/** 0 = Sunday … 6 = Saturday for a calendar day. */
export function dayOfWeek(isoDate: string): number {
  return new Date(`${isoDate}T12:00:00Z`).getUTCDay();
}

export function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function diffDays(a: string, b: string): number {
  return Math.round((Date.parse(`${a}T12:00:00Z`) - Date.parse(`${b}T12:00:00Z`)) / 86_400_000);
}

export function startOfWeek(isoDate: string, weekStartsOn: number): string {
  const dow = dayOfWeek(isoDate);
  return addDays(isoDate, -((dow - weekStartsOn + 7) % 7));
}

export function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

/** "Sep 30, 2026" — calendar dates are formatted in UTC because they carry no time. */
export function formatDate(isoDate: string, opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", year: "numeric" }) {
  return new Intl.DateTimeFormat("en-US", { ...opts, timeZone: "UTC" }).format(new Date(`${isoDate}T12:00:00Z`));
}

export function formatDateLong(isoDate: string) {
  return formatDate(isoDate, { weekday: "long", month: "long", day: "numeric", year: "numeric" });
}

export function formatDateShort(isoDate: string) {
  return formatDate(isoDate, { month: "short", day: "numeric" });
}

/** "6:42 PM" for an instant, in the given timezone. */
export function formatTime(date: Date | string, timeZone: string) {
  return new Intl.DateTimeFormat("en-US", { timeZone, hour: "numeric", minute: "2-digit" }).format(new Date(date));
}

/** "September 30, 2026 — 6:42 PM" */
export function formatDateTime(date: Date | string, timeZone: string, style: "long" | "short" = "long") {
  const d = new Date(date);
  const day = new Intl.DateTimeFormat("en-US", {
    timeZone,
    month: style === "long" ? "long" : "short",
    day: "numeric",
    year: "numeric",
  }).format(d);
  return `${day} — ${formatTime(d, timeZone)}`;
}

/** "Today — 8:42 PM", "Yesterday — 7:10 AM" or full date. */
export function formatRelativeDay(date: Date | string, timeZone: string, now: Date = new Date()) {
  const d = new Date(date);
  const day = isoDateInTz(d, timeZone);
  const today = isoDateInTz(now, timeZone);
  const delta = diffDays(today, day);
  if (delta === 0) return `Today — ${formatTime(d, timeZone)}`;
  if (delta === 1) return `Yesterday — ${formatTime(d, timeZone)}`;
  return formatDateTime(d, timeZone, "short");
}

/** "08:00:00" → "8:00 AM" */
export function formatClock(time: string) {
  const [h, m] = time.split(":").map(Number);
  const suffix = h >= 12 ? "PM" : "AM";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${pad(m)} ${suffix}`;
}

export function clockToMinutes(time: string) {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

export function timeAgo(date: Date | string, now: Date = new Date()) {
  const secs = Math.max(0, Math.round((now.getTime() - new Date(date).getTime()) / 1000));
  if (secs < 45) return "just now";
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.round(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.round(months / 12)}y ago`;
}

export function greetingFor(timeZone: string, now: Date = new Date()) {
  const h = zonedParts(now, timeZone).hour;
  if (h < 5) return "Good evening";
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

export function ageFromDob(dob: string | null | undefined, today: string): number | null {
  if (!dob) return null;
  const [y, m, d] = dob.split("-").map(Number);
  const [ty, tm, td] = today.split("-").map(Number);
  let age = ty - y;
  if (tm < m || (tm === m && td < d)) age--;
  return age;
}
