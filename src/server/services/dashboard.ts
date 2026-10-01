import { desc, eq, inArray } from "drizzle-orm";
import { db } from "../db";
import { clients, measurementTypes, measurements, progressPhotos } from "../db/schema";
import { assertCoach } from "../authz";
import type { Actor } from "../auth/types";
import { listActivity } from "./activity-feed";
import { adherenceByClient, coachDailySeries } from "./analytics";
import { todayStatusFor } from "./clients";
import { coachToday } from "./settings";
import { runDailySnapshotIfNeeded } from "./snapshots";
import { addDays } from "@/lib/time";

export async function getCoachDashboard(actor: Actor) {
  assertCoach(actor);
  await runDailySnapshotIfNeeded(actor.userId);
  const { prefs, today } = await coachToday(actor.userId);

  const all = await db
    .select({
      id: clients.id,
      fullName: clients.fullName,
      status: clients.status,
      avatarKey: clients.avatarKey,
      goal: clients.goal,
      joinedOn: clients.joinedOn,
      createdAt: clients.createdAt,
      lastActivityAt: clients.lastActivityAt,
      currentWeightKg: clients.currentWeightKg,
    })
    .from(clients)
    .where(eq(clients.coachId, actor.userId));

  const active = all.filter((c) => c.status === "active");
  const activeIds = active.map((c) => c.id);
  const [status, adherence, series, activity] = await Promise.all([
    todayStatusFor(activeIds, today),
    adherenceByClient(activeIds, addDays(today, -29), today),
    coachDailySeries(activeIds, today, 14),
    listActivity(actor, { pageSize: 10 }),
  ]);

  const training = active
    .map((c) => ({ ...c, today: status.get(c.id)! }))
    .filter((c) => ["pending", "in_progress", "completed"].includes(c.today.workout));
  const completedToday = training.filter((c) => c.today.workout === "completed");
  const notCompletedToday = training.filter((c) => c.today.workout !== "completed");

  let mealsTotal = 0;
  let mealsDone = 0;
  for (const id of activeIds) {
    const s = status.get(id)!;
    mealsTotal += s.mealsTotal;
    mealsDone += s.mealsDone;
  }

  const avg = (vals: (number | null)[]) => {
    const v = vals.filter((x): x is number => x != null);
    return v.length ? Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 10) / 10 : null;
  };

  // Progress updates: latest measurement days + latest photos, merged chronologically.
  const ids = all.map((c) => c.id);
  const recentMeasurements = ids.length
    ? await db
        .select({
          clientId: measurements.clientId,
          measuredOn: measurements.measuredOn,
          createdAt: measurements.createdAt,
          value: measurements.value,
          key: measurementTypes.key,
          name: measurementTypes.name,
          unit: measurements.unit,
          kind: measurementTypes.kind,
        })
        .from(measurements)
        .innerJoin(measurementTypes, eq(measurementTypes.id, measurements.typeId))
        .where(inArray(measurements.clientId, ids))
        .orderBy(desc(measurements.createdAt))
        .limit(40)
    : [];
  const recentPhotos = ids.length
    ? await db
        .select({ id: progressPhotos.id, clientId: progressPhotos.clientId, takenOn: progressPhotos.takenOn, angle: progressPhotos.angle, createdAt: progressPhotos.createdAt })
        .from(progressPhotos)
        .where(inArray(progressPhotos.clientId, ids))
        .orderBy(desc(progressPhotos.createdAt))
        .limit(6)
    : [];

  const nameOf = new Map(all.map((c) => [c.id, c]));
  const measurementUpdates: { type: "measurement"; clientId: string; clientName: string; date: string; createdAt: Date; items: { key: string; name: string; value: number; kind: string; unit: string }[] }[] = [];
  for (const m of recentMeasurements) {
    let group = measurementUpdates.find((g) => g.clientId === m.clientId && g.date === m.measuredOn);
    if (!group) {
      if (measurementUpdates.length >= 6) continue;
      group = { type: "measurement", clientId: m.clientId, clientName: nameOf.get(m.clientId)?.fullName ?? "", date: m.measuredOn, createdAt: m.createdAt, items: [] };
      measurementUpdates.push(group);
    }
    group.items.push({ key: m.key, name: m.name, value: m.value, kind: m.kind, unit: m.unit });
  }
  const photoUpdates = recentPhotos.map((p) => ({
    type: "photo" as const,
    clientId: p.clientId,
    clientName: nameOf.get(p.clientId)?.fullName ?? "",
    date: p.takenOn,
    createdAt: p.createdAt,
    photoId: p.id,
    angle: p.angle,
  }));
  const progressUpdates = [...measurementUpdates, ...photoUpdates].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).slice(0, 6);

  return {
    prefs,
    today,
    counts: { total: all.length, active: active.length, inactive: all.length - active.length },
    workoutsToday: { scheduled: training.length, completed: completedToday.length },
    mealsToday: { total: mealsTotal, done: mealsDone },
    completedToday,
    notCompletedToday,
    series,
    adherence30: {
      workout: avg(activeIds.map((id) => adherence.get(id)?.workoutAdherence ?? null)),
      nutrition: avg(activeIds.map((id) => adherence.get(id)?.mealRate ?? null)),
    },
    activity: activity.rows,
    recentClients: [...all].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).slice(0, 5),
    quickAccess: [...active]
      .sort((a, b) => (b.lastActivityAt?.getTime() ?? 0) - (a.lastActivityAt?.getTime() ?? 0))
      .slice(0, 8),
    progressUpdates,
    todayStatus: status,
  };
}
export type CoachDashboard = Awaited<ReturnType<typeof getCoachDashboard>>;

