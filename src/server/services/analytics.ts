/**
 * Analytics are computed exclusively from stored logs — nothing is estimated or invented.
 *
 * "Due" items: anything dated before today, plus anything already completed today.
 * (Today's not-yet-done workout/meals aren't counted against the client until the day ends.)
 */
import { and, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { db } from "../db";
import { mealLogs, workoutLogs } from "../db/schema";
import { authorizeClient } from "../authz";
import type { Actor } from "../auth/types";
import { coachToday } from "./settings";
import { addDays, startOfWeek } from "@/lib/time";
import { pct } from "@/lib/utils";

export type AdherenceStats = {
  workoutsDue: number;
  workoutsCompleted: number;
  workoutRate: number | null;
  workoutAdherence: number | null;
  mealsDue: number;
  mealsCompleted: number;
  mealRate: number | null;
};

const EMPTY: AdherenceStats = {
  workoutsDue: 0,
  workoutsCompleted: 0,
  workoutRate: null,
  workoutAdherence: null,
  mealsDue: 0,
  mealsCompleted: 0,
  mealRate: null,
};

export async function adherenceByClient(clientIds: string[], from: string, today: string) {
  const out = new Map<string, AdherenceStats>();
  if (!clientIds.length) return out;

  const due = sql`(${workoutLogs.date} < ${today} OR ${workoutLogs.status} = 'completed')`;
  const w = await db
    .select({
      clientId: workoutLogs.clientId,
      due: sql<number>`count(*) FILTER (WHERE ${due})`.mapWith(Number),
      completed: sql<number>`count(*) FILTER (WHERE ${workoutLogs.status} = 'completed')`.mapWith(Number),
      avgPct: sql<number | null>`avg(${workoutLogs.completionPercent}) FILTER (WHERE ${due})`.mapWith((v) => (v == null ? null : Number(v))),
    })
    .from(workoutLogs)
    .where(and(inArray(workoutLogs.clientId, clientIds), gte(workoutLogs.date, from), lte(workoutLogs.date, today)))
    .groupBy(workoutLogs.clientId);

  const mealDue = sql`(${mealLogs.date} < ${today} OR ${mealLogs.status} = 'completed')`;
  const m = await db
    .select({
      clientId: mealLogs.clientId,
      due: sql<number>`count(*) FILTER (WHERE ${mealDue})`.mapWith(Number),
      completed: sql<number>`count(*) FILTER (WHERE ${mealLogs.status} = 'completed')`.mapWith(Number),
    })
    .from(mealLogs)
    .where(and(inArray(mealLogs.clientId, clientIds), gte(mealLogs.date, from), lte(mealLogs.date, today)))
    .groupBy(mealLogs.clientId);

  for (const id of clientIds) out.set(id, { ...EMPTY });
  for (const r of w) {
    const s = out.get(r.clientId)!;
    s.workoutsDue = r.due;
    s.workoutsCompleted = r.completed;
    s.workoutRate = pct(r.completed, r.due);
    s.workoutAdherence = r.avgPct == null ? null : Math.round(r.avgPct * 10) / 10;
  }
  for (const r of m) {
    const s = out.get(r.clientId)!;
    s.mealsDue = r.due;
    s.mealsCompleted = r.completed;
    s.mealRate = pct(r.completed, r.due);
  }
  return out;
}

/** Per-client analytics: rolling 30-day rates, all-time totals and a weekly adherence series. */
export async function getClientAnalytics(actor: Actor, clientId: string, opts: { weeks?: number } = {}) {
  const scope = await authorizeClient(actor, clientId, "viewProgress");
  const { prefs, today } = await coachToday(scope.client.coachId);
  const weeks = Math.min(Math.max(opts.weeks ?? 12, 4), 52);
  const windowStart = startOfWeek(addDays(today, -(weeks * 7 - 1)), prefs.weekStartsOn);
  // Don't chart empty weeks from before the client joined.
  const joinedWeek = startOfWeek(scope.client.joinedOn, prefs.weekStartsOn);
  const from = joinedWeek > windowStart ? joinedWeek : windowStart;

  const wl = await db
    .select({ date: workoutLogs.date, status: workoutLogs.status, pct: workoutLogs.completionPercent })
    .from(workoutLogs)
    .where(and(eq(workoutLogs.clientId, scope.client.id), gte(workoutLogs.date, from), lte(workoutLogs.date, today)));
  const ml = await db
    .select({ date: mealLogs.date, status: mealLogs.status })
    .from(mealLogs)
    .where(and(eq(mealLogs.clientId, scope.client.id), gte(mealLogs.date, from), lte(mealLogs.date, today)));

  const isDue = (l: { date: string; status: string }) => l.date < today || l.status === "completed";

  const weekly: {
    week: string;
    /** ISO start date of the week (same as `week`) — the UI formats it for the viewer's language. */
    label: string;
    workoutAdherence: number | null;
    workoutRate: number | null;
    mealAdherence: number | null;
    workoutsDue: number;
    workoutsCompleted: number;
    mealsDue: number;
    mealsCompleted: number;
  }[] = [];
  for (let start = from; start <= today; start = addDays(start, 7)) {
    const end = addDays(start, 6);
    const inWeek = <T extends { date: string }>(l: T) => l.date >= start && l.date <= end;
    const w = wl.filter(inWeek).filter(isDue);
    const m = ml.filter(inWeek).filter(isDue);
    const wDone = w.filter((l) => l.status === "completed").length;
    const mDone = m.filter((l) => l.status === "completed").length;
    weekly.push({
      week: start,
      label: start,
      workoutAdherence: w.length ? Math.round((w.reduce((a, l) => a + l.pct, 0) / w.length) * 10) / 10 : null,
      workoutRate: pct(wDone, w.length),
      mealAdherence: pct(mDone, m.length),
      workoutsDue: w.length,
      workoutsCompleted: wDone,
      mealsDue: m.length,
      mealsCompleted: mDone,
    });
  }

  const last30From = addDays(today, -29);
  const last30 = (await adherenceByClient([scope.client.id], last30From, today)).get(scope.client.id)!;
  const allTime = (await adherenceByClient([scope.client.id], "1970-01-01", today)).get(scope.client.id)!;

  const withData = weekly.filter((w) => w.workoutAdherence != null);
  const withMeals = weekly.filter((w) => w.mealAdherence != null);
  return {
    today,
    weekly,
    last30,
    allTime,
    avgWeeklyWorkoutAdherence: withData.length
      ? Math.round((withData.reduce((a, w) => a + (w.workoutAdherence ?? 0), 0) / withData.length) * 10) / 10
      : null,
    avgWeeklyNutritionAdherence: withMeals.length
      ? Math.round((withMeals.reduce((a, w) => a + (w.mealAdherence ?? 0), 0) / withMeals.length) * 10) / 10
      : null,
  };
}
export type ClientAnalytics = Awaited<ReturnType<typeof getClientAnalytics>>;

/** Coach-wide daily series across all active clients (dashboard + reports). */
export async function coachDailySeries(clientIds: string[], today: string, days: number) {
  const from = addDays(today, -(days - 1));
  if (!clientIds.length) {
    return Array.from({ length: days }, (_, i) => {
      const date = addDays(from, i);
      return { date, workoutsScheduled: 0, workoutsCompleted: 0, mealsTotal: 0, mealsCompleted: 0, mealAdherence: null as number | null };
    });
  }
  const w = await db
    .select({
      date: workoutLogs.date,
      total: sql<number>`count(*)`.mapWith(Number),
      completed: sql<number>`count(*) FILTER (WHERE ${workoutLogs.status} = 'completed')`.mapWith(Number),
    })
    .from(workoutLogs)
    .where(and(inArray(workoutLogs.clientId, clientIds), gte(workoutLogs.date, from), lte(workoutLogs.date, today)))
    .groupBy(workoutLogs.date);
  const m = await db
    .select({
      date: mealLogs.date,
      total: sql<number>`count(*)`.mapWith(Number),
      completed: sql<number>`count(*) FILTER (WHERE ${mealLogs.status} = 'completed')`.mapWith(Number),
    })
    .from(mealLogs)
    .where(and(inArray(mealLogs.clientId, clientIds), gte(mealLogs.date, from), lte(mealLogs.date, today)))
    .groupBy(mealLogs.date);

  return Array.from({ length: days }, (_, i) => {
    const date = addDays(from, i);
    const wr = w.find((r) => r.date === date);
    const mr = m.find((r) => r.date === date);
    return {
      date,
      workoutsScheduled: wr?.total ?? 0,
      workoutsCompleted: wr?.completed ?? 0,
      mealsTotal: mr?.total ?? 0,
      mealsCompleted: mr?.completed ?? 0,
      mealAdherence: mr ? pct(mr.completed, mr.total) : null,
    };
  });
}
