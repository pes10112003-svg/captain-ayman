import type { Actor } from "../auth/types";
import { authorizeSelf } from "../authz";
import { getClientAnalytics } from "./analytics";
import { ensureMealLogsForDate, loadMealLogs } from "./nutrition";
import { getProgress } from "./progress";
import { coachToday } from "./settings";
import { ensureWorkoutLogForDate, getWeekOverview, loadWorkoutLogTree } from "./workouts";

/** Client home: "what do I need to do today?" — only the client's own data, gated by permissions. */
export async function getClientHome(actor: Actor) {
  const { client, permissions } = await authorizeSelf(actor);
  const { prefs, today } = await coachToday(client.coachId);

  let workout = null;
  let week = null;
  if (permissions.viewWorkouts) {
    const logId = await ensureWorkoutLogForDate(client.id, today);
    const log = logId ? await loadWorkoutLogTree(logId) : null;
    week = await getWeekOverview(client.id, today, prefs.weekStartsOn);
    if (log) {
      const exercisesDone = log.exercises.filter((e) => e.sets.length && e.sets.every((s) => s.status !== "pending")).length;
      workout = {
        title: log.title,
        muscleGroup: log.muscleGroup,
        status: log.status,
        completionPercent: log.completionPercent,
        completedAt: log.completedAt,
        exercisesDone,
        exercisesTotal: log.exercises.length,
        setsDone: log.completedSets + log.partialSets,
        setsTotal: log.totalSets,
      };
    }
  }

  let meals = null;
  if (permissions.viewNutrition) {
    await ensureMealLogsForDate(client.id, today);
    meals = await loadMealLogs(client.id, today);
  }

  const progress = permissions.viewProgress ? await getProgress(actor, client.id) : null;
  const analytics = permissions.viewProgress ? await getClientAnalytics(actor, client.id, { weeks: 4 }) : null;

  return { client, permissions, prefs, today, workout, week, meals, progress, analytics };
}
