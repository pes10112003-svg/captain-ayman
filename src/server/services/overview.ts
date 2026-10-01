import { and, eq } from "drizzle-orm";
import { db } from "../db";
import { users, workoutLogs } from "../db/schema";
import { assertCoach, authorizeClient } from "../authz";
import type { Actor } from "../auth/types";
import { listActivity } from "./activity-feed";
import { getClientAnalytics } from "./analytics";
import { loadActiveNutritionPlan, loadMealLogs, mealTotals } from "./nutrition";
import { getProgress } from "./progress";
import { coachToday } from "./settings";
import { snapshotClientDay } from "./snapshots";
import { loadActiveWorkoutPlan } from "./workouts";

/** Everything the coach's client-overview tab needs, in one authorized call. */
export async function getClientOverview(actor: Actor, clientId: string) {
  assertCoach(actor);
  const { client, permissions } = await authorizeClient(actor, clientId);
  const { prefs, today } = await coachToday(actor.userId);
  if (client.status === "active") await snapshotClientDay(client.id, today);

  const [user] = await db
    .select({ email: users.email, lastLoginAt: users.lastLoginAt, mustChangePassword: users.mustChangePassword })
    .from(users)
    .where(eq(users.id, client.userId))
    .limit(1);

  const [analytics, progress, workoutPlan, nutritionPlan, mealsToday, activity, todayLog] = await Promise.all([
    getClientAnalytics(actor, client.id, { weeks: 12 }),
    getProgress(actor, client.id),
    loadActiveWorkoutPlan(client.id),
    loadActiveNutritionPlan(client.id),
    loadMealLogs(client.id, today),
    listActivity(actor, { clientId: client.id, pageSize: 6 }),
    db.query.workoutLogs.findFirst({ where: and(eq(workoutLogs.clientId, client.id), eq(workoutLogs.date, today)) }),
  ]);

  const schedule = Array.from({ length: 7 }, (_, dow) => {
    const slot = workoutPlan?.days.find((d) => d.dayOfWeek === dow);
    const w = slot?.workoutId ? workoutPlan?.workouts.find((x) => x.id === slot.workoutId) : null;
    return { dow, title: w?.title ?? null, muscleGroup: w?.muscleGroup ?? null, exercises: w?.exercises.length ?? 0 };
  });

  const dailyTotals = nutritionPlan ? mealTotals(nutritionPlan.meals.flatMap((m) => m.items)) : null;

  return {
    prefs,
    today,
    client: { ...client, email: user?.email ?? "", lastLoginAt: user?.lastLoginAt ?? null, pendingPasswordSetup: user?.mustChangePassword ?? false },
    permissions,
    analytics,
    progress,
    schedule,
    workoutPlan: workoutPlan ? { name: workoutPlan.name, trainingDays: schedule.filter((s) => s.title).length, updatedAt: workoutPlan.contentUpdatedAt } : null,
    nutritionPlan: nutritionPlan
      ? { name: nutritionPlan.name, meals: nutritionPlan.meals.length, totals: dailyTotals, updatedAt: nutritionPlan.contentUpdatedAt }
      : null,
    mealsToday,
    todayLog: todayLog ?? null,
    activity: activity.rows,
  };
}
export type ClientOverview = Awaited<ReturnType<typeof getClientOverview>>;
