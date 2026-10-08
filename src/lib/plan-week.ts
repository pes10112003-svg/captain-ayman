import { diffDays } from "./time";

/**
 * Which week of a training-sheet cycle `date` falls in, counted in whole weeks from `startsOn`.
 * Before the start it's week 1; after the last week it stays on the last week and `finished`
 * tells the coach the cycle is over (until they write the next block or restart it).
 */
export function planWeek(weekCount: number, startsOn: string | null, date: string) {
  if (!startsOn) return { index: 0, raw: 0, finished: false };
  const raw = Math.floor(diffDays(date, startsOn) / 7);
  return { index: Math.min(Math.max(raw, 0), Math.max(weekCount, 1) - 1), raw, finished: raw >= weekCount };
}
