import { and, asc, desc, eq, gte, inArray } from "drizzle-orm";
import { db } from "../db";
import { clients, mealLogs, measurementTypes, measurements, progressPhotos, workoutLogs } from "../db/schema";
import { assertCoach } from "../authz";
import type { Actor } from "../auth/types";
import { adherenceByClient, coachDailySeries } from "./analytics";
import { todayStatusFor } from "./clients";
import { coachToday } from "./settings";
import { runDailySnapshotIfNeeded } from "./snapshots";
import { addDays } from "@/lib/time";

async function coachClients(coachId: string, activeOnly = true) {
  return db
    .select({
      id: clients.id,
      fullName: clients.fullName,
      avatarKey: clients.avatarKey,
      status: clients.status,
      goal: clients.goal,
      startingWeightKg: clients.startingWeightKg,
      currentWeightKg: clients.currentWeightKg,
      goalWeightKg: clients.goalWeightKg,
      lastActivityAt: clients.lastActivityAt,
    })
    .from(clients)
    .where(activeOnly ? and(eq(clients.coachId, coachId), eq(clients.status, "active")) : eq(clients.coachId, coachId))
    .orderBy(asc(clients.fullName));
}

/** Coach › Workouts: today's training across every active client + recent completions. */
export async function getWorkoutsOverview(actor: Actor) {
  assertCoach(actor);
  await runDailySnapshotIfNeeded(actor.userId);
  const { prefs, today } = await coachToday(actor.userId);
  const list = await coachClients(actor.userId);
  const ids = list.map((c) => c.id);
  const status = await todayStatusFor(ids, today);
  const rows = list.map((c) => ({ ...c, today: status.get(c.id)! }));

  const recent = ids.length
    ? await db
        .select({
          id: workoutLogs.id,
          clientId: workoutLogs.clientId,
          date: workoutLogs.date,
          title: workoutLogs.title,
          completionPercent: workoutLogs.completionPercent,
          completedAt: workoutLogs.completedAt,
          completedSets: workoutLogs.completedSets,
          partialSets: workoutLogs.partialSets,
          totalSets: workoutLogs.totalSets,
        })
        .from(workoutLogs)
        .where(and(inArray(workoutLogs.clientId, ids), eq(workoutLogs.status, "completed"), gte(workoutLogs.date, addDays(today, -6))))
        .orderBy(desc(workoutLogs.completedAt))
        .limit(20)
    : [];
  const byId = new Map(list.map((c) => [c.id, c]));
  return {
    prefs,
    today,
    rows,
    recent: recent.map((r) => ({ ...r, client: byId.get(r.clientId)! })),
  };
}

/** Coach › Nutrition: today's meals across every active client with exact consumed times. */
export async function getNutritionOverview(actor: Actor) {
  assertCoach(actor);
  await runDailySnapshotIfNeeded(actor.userId);
  const { prefs, today } = await coachToday(actor.userId);
  const list = await coachClients(actor.userId);
  const ids = list.map((c) => c.id);
  const logs = ids.length
    ? await db
        .select()
        .from(mealLogs)
        .where(and(inArray(mealLogs.clientId, ids), eq(mealLogs.date, today)))
        .orderBy(asc(mealLogs.scheduledTime), asc(mealLogs.position))
    : [];
  const adherence = await adherenceByClient(ids, addDays(today, -6), today);
  const rows = list.map((c) => {
    const meals = logs.filter((l) => l.clientId === c.id);
    return { ...c, meals, done: meals.filter((m) => m.status === "completed").length, week: adherence.get(c.id)?.mealRate ?? null };
  });
  const feed = logs
    .filter((l) => l.status === "completed" && l.consumedAt)
    .sort((a, b) => b.consumedAt!.getTime() - a.consumedAt!.getTime())
    .slice(0, 12)
    .map((l) => ({ ...l, client: list.find((c) => c.id === l.clientId)! }));
  return {
    prefs,
    today,
    rows,
    feed,
    totals: { meals: logs.length, done: logs.filter((l) => l.status === "completed").length },
  };
}

/** Coach › Progress: weight change per client, latest measurements & photos. */
export async function getProgressOverview(actor: Actor) {
  assertCoach(actor);
  const { prefs, today } = await coachToday(actor.userId);
  const list = await coachClients(actor.userId, false);
  const ids = list.map((c) => c.id);
  const latest = ids.length
    ? await db
        .select({
          id: measurements.id,
          clientId: measurements.clientId,
          measuredOn: measurements.measuredOn,
          value: measurements.value,
          unit: measurements.unit,
          name: measurementTypes.name,
          kind: measurementTypes.kind,
          createdAt: measurements.createdAt,
        })
        .from(measurements)
        .innerJoin(measurementTypes, eq(measurementTypes.id, measurements.typeId))
        .where(inArray(measurements.clientId, ids))
        .orderBy(desc(measurements.measuredOn), desc(measurements.createdAt))
        .limit(30)
    : [];
  const photos = ids.length
    ? await db
        .select({ id: progressPhotos.id, clientId: progressPhotos.clientId, angle: progressPhotos.angle, takenOn: progressPhotos.takenOn })
        .from(progressPhotos)
        .where(inArray(progressPhotos.clientId, ids))
        .orderBy(desc(progressPhotos.takenOn), desc(progressPhotos.createdAt))
        .limit(10)
    : [];
  const byId = new Map(list.map((c) => [c.id, c]));
  const changes = list
    .map((c) => ({
      ...c,
      changeKg: c.startingWeightKg != null && c.currentWeightKg != null ? Math.round((c.currentWeightKg - c.startingWeightKg) * 10) / 10 : null,
    }))
    .sort((a, b) => Math.abs(b.changeKg ?? 0) - Math.abs(a.changeKg ?? 0));
  return {
    prefs,
    today,
    changes,
    latest: latest.map((m) => ({ ...m, client: byId.get(m.clientId)! })),
    photos: photos.map((p) => ({ ...p, client: byId.get(p.clientId)! })),
  };
}

/** Coach › Reports: 30-day aggregates computed from stored logs only. */
export async function getReports(actor: Actor, days = 30) {
  assertCoach(actor);
  const { prefs, today } = await coachToday(actor.userId);
  const list = await coachClients(actor.userId);
  const ids = list.map((c) => c.id);
  const from = addDays(today, -(days - 1));
  const [series, adherence] = await Promise.all([coachDailySeries(ids, today, days), adherenceByClient(ids, from, today)]);
  const rows = list
    .map((c) => ({
      ...c,
      a: adherence.get(c.id)!,
      changeKg: c.startingWeightKg != null && c.currentWeightKg != null ? Math.round((c.currentWeightKg - c.startingWeightKg) * 10) / 10 : null,
    }))
    .sort((a, b) => (b.a.workoutAdherence ?? -1) - (a.a.workoutAdherence ?? -1));
  const sum = (k: "workoutsDue" | "workoutsCompleted" | "mealsDue" | "mealsCompleted") => rows.reduce((acc, r) => acc + r.a[k], 0);
  const withAdh = rows.filter((r) => r.a.workoutAdherence != null);
  return {
    prefs,
    today,
    from,
    days,
    series,
    rows,
    totals: {
      workoutsDue: sum("workoutsDue"),
      workoutsCompleted: sum("workoutsCompleted"),
      mealsDue: sum("mealsDue"),
      mealsCompleted: sum("mealsCompleted"),
      avgWorkoutAdherence: withAdh.length ? Math.round((withAdh.reduce((a, r) => a + (r.a.workoutAdherence ?? 0), 0) / withAdh.length) * 10) / 10 : null,
    },
  };
}
