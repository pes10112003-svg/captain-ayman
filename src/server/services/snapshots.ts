/**
 * Daily snapshots: materialise each active client's workout + meals for "today" so that
 * missed days are recorded as missed (not silently absent) in history and analytics.
 *
 * Triggered by: GET /api/cron/daily (schedule it at ~00:05 in the coach timezone),
 * `npm run cron:daily`, and lazily on the first coach dashboard view of each day.
 */
import { and, eq } from "drizzle-orm";
import { db } from "../db";
import { clients, coachSettings, users } from "../db/schema";
import { ensureMealLogsForDate } from "./nutrition";
import { coachToday } from "./settings";
import { ensureWorkoutLogForDate } from "./workouts";

export async function snapshotClientDay(clientId: string, date: string) {
  await ensureWorkoutLogForDate(clientId, date);
  await ensureMealLogsForDate(clientId, date);
}

export async function runDailySnapshot(coachId: string) {
  const { today } = await coachToday(coachId);
  const active = await db
    .select({ id: clients.id })
    .from(clients)
    .where(and(eq(clients.coachId, coachId), eq(clients.status, "active")));
  for (const c of active) {
    try {
      await snapshotClientDay(c.id, today);
    } catch (err) {
      console.error(`[kinetic] snapshot failed for client ${c.id}`, err);
    }
  }
  await db.update(coachSettings).set({ lastSnapshotDate: today }).where(eq(coachSettings.coachId, coachId));
  return { date: today, clients: active.length };
}

export async function runDailySnapshotIfNeeded(coachId: string) {
  const { prefs, today } = await coachToday(coachId);
  if (prefs.lastSnapshotDate === today) return null;
  return runDailySnapshot(coachId);
}

export async function runDailySnapshotForAllCoaches() {
  const coaches = await db.select({ id: users.id }).from(users).where(and(eq(users.role, "coach"), eq(users.isActive, true)));
  const results = [];
  for (const c of coaches) results.push({ coachId: c.id, ...(await runDailySnapshot(c.id)) });
  return results;
}
