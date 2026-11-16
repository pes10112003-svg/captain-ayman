/**
 * The client's own training statistics, computed only from the sets they recorded
 * (nothing estimated). Read-only: this file never writes to the database.
 */
import { and, asc, eq, lte, ne } from "drizzle-orm";
import { db } from "../db";
import { workoutExerciseLogs, workoutLogs, workoutSetLogs } from "../db/schema";
import { authorizeSelf } from "../authz";
import type { Actor } from "../auth/types";
import { coachToday, getCoachPrefs } from "./settings";
import { getWorkoutLogDetail, listWorkoutHistory } from "./workouts";
import { addDays } from "@/lib/time";

export type ExerciseSession = {
  date: string;
  logId: string;
  /** Heaviest weight lifted in a recorded set that day (null when no weight was written or prescribed). */
  topWeightKg: number | null;
  /** Reps done in the heaviest set. */
  topReps: number | null;
  reps: number;
  sets: number;
  volumeKg: number;
};

export type ExerciseProgress = {
  key: string;
  name: string;
  /** The workout day it belongs to ("PUSH", "Legs"…): the same exercise on two days with different reps is tracked separately. */
  workout: string;
  sessions: ExerciseSession[];
  firstWeightKg: number | null;
  latestWeightKg: number | null;
  bestWeightKg: number | null;
  bestDate: string | null;
  bestReps: number;
};

const keyOf = (name: string) => name.trim().replace(/\s+/g, " ").toLowerCase();

export async function getClientWorkoutStats(actor: Actor) {
  const scope = await authorizeSelf(actor, "viewWorkouts");
  const { prefs, today } = await coachToday(scope.client.coachId);
  const clientId = scope.client.id;

  const [logs, sets] = await Promise.all([
    db
      .select({ id: workoutLogs.id, date: workoutLogs.date, status: workoutLogs.status, pct: workoutLogs.completionPercent })
      .from(workoutLogs)
      .where(and(eq(workoutLogs.clientId, clientId), lte(workoutLogs.date, today)))
      .orderBy(asc(workoutLogs.date)),
    db
      .select({
        logId: workoutSetLogs.workoutLogId,
        date: workoutLogs.date,
        workout: workoutLogs.title,
        exercise: workoutExerciseLogs.name,
        status: workoutSetLogs.status,
        actualReps: workoutSetLogs.actualReps,
        targetReps: workoutSetLogs.targetReps,
        actualWeightKg: workoutSetLogs.actualWeightKg,
        targetWeightKg: workoutSetLogs.targetWeightKg,
      })
      .from(workoutSetLogs)
      .innerJoin(workoutLogs, eq(workoutLogs.id, workoutSetLogs.workoutLogId))
      .innerJoin(workoutExerciseLogs, eq(workoutExerciseLogs.id, workoutSetLogs.exerciseLogId))
      .where(and(eq(workoutSetLogs.clientId, clientId), ne(workoutSetLogs.status, "pending"), lte(workoutLogs.date, today)))
      .orderBy(asc(workoutLogs.date)),
  ]);

  // ── per exercise, per session ──
  const byExercise = new Map<string, { name: string; workout: string; sessions: Map<string, ExerciseSession> }>();
  let totalReps = 0;
  let totalVolume = 0;
  let totalSets = 0;
  for (const s of sets) {
    const reps = s.actualReps ?? s.targetReps;
    const weight = s.actualWeightKg ?? s.targetWeightKg;
    if (reps <= 0) continue;
    totalSets += 1;
    totalReps += reps;
    const volume = weight != null ? weight * reps : 0;
    totalVolume += volume;

    const key = `${keyOf(s.workout)}|${keyOf(s.exercise)}`;
    let ex = byExercise.get(key);
    if (!ex) byExercise.set(key, (ex = { name: s.exercise.trim(), workout: s.workout.trim(), sessions: new Map() }));
    else {
      ex.name = s.exercise.trim(); // latest spelling wins
      ex.workout = s.workout.trim();
    }
    let session = ex.sessions.get(s.logId);
    if (!session) ex.sessions.set(s.logId, (session = { date: s.date, logId: s.logId, topWeightKg: null, topReps: null, reps: 0, sets: 0, volumeKg: 0 }));
    session.reps += reps;
    session.sets += 1;
    session.volumeKg += volume;
    if (weight != null && (session.topWeightKg == null || weight > session.topWeightKg || (weight === session.topWeightKg && reps > (session.topReps ?? 0)))) {
      session.topWeightKg = weight;
      session.topReps = reps;
    }
  }

  const exercises: ExerciseProgress[] = [...byExercise.entries()]
    .map(([key, ex]) => {
      const sessions = [...ex.sessions.values()].sort((a, b) => a.date.localeCompare(b.date));
      const weighted = sessions.filter((x) => x.topWeightKg != null);
      let best: ExerciseSession | null = null;
      for (const x of weighted) if (!best || x.topWeightKg! > best.topWeightKg!) best = x;
      return {
        key,
        name: ex.name,
        workout: ex.workout,
        sessions,
        firstWeightKg: weighted[0]?.topWeightKg ?? null,
        latestWeightKg: weighted.at(-1)?.topWeightKg ?? null,
        bestWeightKg: best?.topWeightKg ?? null,
        bestDate: best?.date ?? null,
        bestReps: Math.max(0, ...sessions.map((x) => x.reps)),
      };
    })
    // Most trained first, then most recent.
    .sort((a, b) => b.sessions.length - a.sessions.length || (b.sessions.at(-1)?.date ?? "").localeCompare(a.sessions.at(-1)?.date ?? ""));

  // ── workouts ──
  const completed = logs.filter((l) => l.status === "completed");
  const since30 = addDays(today, -29);
  const due30 = logs.filter((l) => l.date >= since30 && (l.date < today || l.status === "completed"));
  const done30 = due30.filter((l) => l.status === "completed");

  // Streak: consecutive scheduled workouts (most recent first) that were completed; today's unfinished one doesn't break it.
  let streak = 0;
  for (let i = logs.length - 1; i >= 0; i--) {
    const l = logs[i]!;
    if (l.status === "completed") streak++;
    else if (l.date === today) continue;
    else break;
  }

  // Weekly completed-workout counts for the last 8 weeks (oldest → newest).
  const weekly = Array.from({ length: 8 }, (_, i) => {
    const end = addDays(today, -7 * (7 - i));
    const start = addDays(end, -6);
    return { start, count: completed.filter((l) => l.date >= start && l.date <= end).length };
  });

  const improved = exercises.filter((e) => e.firstWeightKg != null && e.latestWeightKg != null && e.sessions.length > 1 && e.latestWeightKg > e.firstWeightKg).length;

  return {
    today,
    prefs,
    firstDate: logs.find((l) => l.status !== "pending")?.date ?? null,
    totals: {
      workoutsCompleted: completed.length,
      workoutsDue30: due30.length,
      workoutsDone30: done30.length,
      sets: totalSets,
      reps: totalReps,
      volumeKg: Math.round(totalVolume),
      streak,
      improved,
    },
    weekly,
    exercises,
  };
}
export type ClientWorkoutStats = Awaited<ReturnType<typeof getClientWorkoutStats>>;

/** The client's own past workouts (today and earlier), newest first, with the coach's display units. */
export async function getMyWorkoutHistory(actor: Actor, page: number) {
  const scope = await authorizeSelf(actor, "viewWorkouts");
  const [history, prefs] = await Promise.all([listWorkoutHistory(actor, scope.client.id, { page, pageSize: 15 }), getCoachPrefs(scope.client.coachId)]);
  return { ...history, prefs, logs: history.logs.filter((l) => l.date <= history.today) };
}

/** One of the client's own past workouts. Another client's log id simply isn't found. */
export async function getMyWorkoutLog(actor: Actor, logId: string) {
  const scope = await authorizeSelf(actor, "viewWorkouts");
  const [{ log }, { prefs, today }] = await Promise.all([getWorkoutLogDetail(actor, scope.client.id, logId), coachToday(scope.client.coachId)]);
  return { log, prefs, today };
}
