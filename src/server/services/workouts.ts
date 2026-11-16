import { randomUUID } from "node:crypto";
import { and, asc, count, desc, eq, gte, inArray, isNotNull, lte, ne, notInArray, sql } from "drizzle-orm";
import { db, type Executor, type Tx } from "../db";
import { workoutDays, workoutExerciseLogs, workoutExercises, workoutLogs, workoutPlans, workoutSetLogs, workoutSets, workouts } from "../db/schema";
import { assertCoach, authorizeClient, authorizeSelf } from "../authz";
import { logActivity, touchClient } from "../activity";
import { emit } from "../events";
import { ConflictError, ForbiddenError, NotFoundError, isUniqueViolation } from "../errors";
import type { Actor } from "../auth/types";
import { coachToday } from "./settings";
import { addDays, dayOfWeek, startOfWeek } from "@/lib/time";
import { planWeek } from "@/lib/plan-week";
import { kgTo, round, toKg, type WeightUnit } from "@/lib/units";
import { isUuid } from "@/lib/utils";
import type { WorkoutPlanInput } from "@/lib/validation";

/* ───────────────────────── plan (template) ───────────────────────── */

export async function loadActiveWorkoutPlan(clientId: string, dbx: Executor = db) {
  return dbx.query.workoutPlans.findFirst({
    where: and(eq(workoutPlans.clientId, clientId), eq(workoutPlans.isActive, true)),
    with: {
      days: true,
      workouts: {
        orderBy: [asc(workouts.position)],
        with: {
          exercises: {
            orderBy: [asc(workoutExercises.position)],
            with: { sets: { orderBy: [asc(workoutSets.week), asc(workoutSets.setNumber)] } },
          },
        },
      },
    },
  });
}
export type WorkoutPlanTree = NonNullable<Awaited<ReturnType<typeof loadActiveWorkoutPlan>>>;

export { planWeek };

/** Shape consumed by the coach's plan editor (weights converted to the coach's display unit). */
export async function getWorkoutPlanForEditor(actor: Actor, clientId: string) {
  assertCoach(actor);
  const { client } = await authorizeClient(actor, clientId);
  const { prefs, today } = await coachToday(actor.userId);
  const plan = await loadActiveWorkoutPlan(client.id);
  const toDisplay = (kg: number | null) => (kg == null ? null : round(kgTo(kg, prefs.weightUnit), 2));
  const week = plan ? planWeek(plan.weekCount, plan.startsOn, today) : null;
  return {
    weightUnit: prefs.weightUnit,
    today,
    thisWeekStart: startOfWeek(today, prefs.weekStartsOn),
    results: plan ? await getSheetResults(client.id, plan.id, plan.startsOn, today) : [],
    plan: plan
      ? {
          id: plan.id,
          name: plan.name,
          notes: plan.notes,
          weekCount: plan.weekCount,
          startsOn: plan.startsOn,
          currentWeek: week!.index,
          cycleFinished: week!.finished,
          updatedAt: plan.contentUpdatedAt.toISOString(),
          schedule: Array.from({ length: 7 }, (_, dow) => plan.days.find((d) => d.dayOfWeek === dow)?.workoutId ?? null),
          workouts: plan.workouts.map((w) => ({
            id: w.id,
            key: w.id,
            title: w.title,
            muscleGroup: w.muscleGroup,
            instructions: w.instructions,
            setCount: w.setCount,
            exercises: w.exercises.map((e) => ({
              key: e.id,
              name: e.name,
              restSeconds: e.restSeconds,
              tempo: e.tempo,
              notes: e.notes,
              videoUrl: e.videoUrl,
              sets: e.sets.map((s) => ({
                key: s.id,
                week: s.week,
                setNumber: s.setNumber,
                targetReps: s.targetReps,
                targetWeight: toDisplay(s.targetWeightKg),
              })),
            })),
          })),
        }
      : null,
  };
}

export type SheetResult = {
  workoutId: string;
  week: number;
  date: string;
  exercises: {
    name: string;
    position: number;
    sets: {
      setNumber: number;
      status: "pending" | "completed" | "partial" | "skipped";
      actualReps: number | null;
      targetReps: number;
      actualWeightKg: number | null;
      targetWeightKg: number | null;
    }[];
  }[];
};

/**
 * What the client actually did in each (day, week) of the current cycle — the latest session
 * per cell — so the coach's sheet can colour targets green (done) or orange (fewer reps).
 */
async function getSheetResults(clientId: string, planId: string, startsOn: string | null, today: string): Promise<SheetResult[]> {
  const logs = await db
    .select({ id: workoutLogs.id, workoutId: workoutLogs.workoutId, week: workoutLogs.weekIndex, date: workoutLogs.date, status: workoutLogs.status })
    .from(workoutLogs)
    .where(
      and(
        eq(workoutLogs.clientId, clientId),
        eq(workoutLogs.planId, planId),
        isNotNull(workoutLogs.weekIndex),
        isNotNull(workoutLogs.workoutId),
        ne(workoutLogs.status, "pending"),
        lte(workoutLogs.date, today),
        ...(startsOn ? [gte(workoutLogs.date, startsOn)] : []),
      ),
    )
    .orderBy(desc(workoutLogs.date));
  const latest = new Map<string, (typeof logs)[number]>();
  for (const l of logs) {
    const k = `${l.workoutId}:${l.week}`;
    if (!latest.has(k)) latest.set(k, l);
  }
  const picked = [...latest.values()];
  if (!picked.length) return [];
  const ids = picked.map((l) => l.id);
  const [exLogs, setLogs] = await Promise.all([
    db
      .select({ id: workoutExerciseLogs.id, logId: workoutExerciseLogs.workoutLogId, name: workoutExerciseLogs.name, position: workoutExerciseLogs.position })
      .from(workoutExerciseLogs)
      .where(inArray(workoutExerciseLogs.workoutLogId, ids)),
    db
      .select({
        exerciseLogId: workoutSetLogs.exerciseLogId,
        setNumber: workoutSetLogs.setNumber,
        status: workoutSetLogs.status,
        actualReps: workoutSetLogs.actualReps,
        targetReps: workoutSetLogs.targetReps,
        actualWeightKg: workoutSetLogs.actualWeightKg,
        targetWeightKg: workoutSetLogs.targetWeightKg,
      })
      .from(workoutSetLogs)
      .where(inArray(workoutSetLogs.workoutLogId, ids)),
  ]);
  return picked.map((l) => ({
    workoutId: l.workoutId!,
    week: l.week!,
    date: l.date,
    exercises: exLogs
      .filter((e) => e.logId === l.id)
      .map((e) => ({
        name: e.name,
        position: e.position,
        sets: setLogs
          .filter((x) => x.exerciseLogId === e.id)
          .map(({ setNumber, status, actualReps, targetReps, actualWeightKg, targetWeightKg }) => ({
            setNumber,
            status,
            actualReps,
            targetReps,
            actualWeightKg,
            targetWeightKg,
          })),
      })),
  }));
}

export async function saveWorkoutPlan(actor: Actor, clientId: string, input: WorkoutPlanInput) {
  assertCoach(actor);
  const { client } = await authorizeClient(actor, clientId);
  const { prefs, today } = await coachToday(actor.userId);
  const unit: WeightUnit = prefs.weightUnit;

  const planId = await db.transaction(async (tx) => {
    const [existingPlan] = await tx
      .select()
      .from(workoutPlans)
      .where(and(eq(workoutPlans.clientId, client.id), eq(workoutPlans.isActive, true)))
      .for("update")
      .limit(1);

    let planId: string;
    if (existingPlan) {
      planId = existingPlan.id;
      await tx
        .update(workoutPlans)
        .set({
          name: input.name,
          notes: input.notes,
          weekCount: input.weekCount,
          startsOn: input.startsOn ?? existingPlan.startsOn ?? startOfWeek(today, prefs.weekStartsOn),
          contentUpdatedAt: sql`now()`,
        })
        .where(eq(workoutPlans.id, planId));
    } else {
      const [created] = await tx
        .insert(workoutPlans)
        .values({
          clientId: client.id,
          name: input.name,
          notes: input.notes,
          weekCount: input.weekCount,
          startsOn: input.startsOn ?? startOfWeek(today, prefs.weekStartsOn),
        })
        .returning({ id: workoutPlans.id });
      planId = created!.id;
    }

    // Only ids that already belong to THIS plan may be updated — anything else is treated as new.
    const existingIds = new Set((await tx.select({ id: workouts.id }).from(workouts).where(eq(workouts.planId, planId))).map((r) => r.id));
    const keyToId = new Map<string, string>();
    const keep: string[] = [];

    for (const [position, w] of input.workouts.entries()) {
      const values = { title: w.title, muscleGroup: w.muscleGroup || null, instructions: w.instructions || null, setCount: w.setCount, position };
      let id: string;
      if (w.id && isUuid(w.id) && existingIds.has(w.id)) {
        id = w.id;
        await tx
          .update(workouts)
          .set(values)
          .where(and(eq(workouts.id, id), eq(workouts.planId, planId)));
      } else {
        id = randomUUID();
        await tx.insert(workouts).values({ id, planId, ...values });
      }
      keyToId.set(w.key, id);
      keep.push(id);
    }

    await tx.delete(workouts).where(keep.length ? and(eq(workouts.planId, planId), notInArray(workouts.id, keep)) : eq(workouts.planId, planId));

    if (keep.length) {
      await tx.delete(workoutExercises).where(inArray(workoutExercises.workoutId, keep));
      const exRows: (typeof workoutExercises.$inferInsert)[] = [];
      const setRows: (typeof workoutSets.$inferInsert)[] = [];
      for (const w of input.workouts) {
        const workoutId = keyToId.get(w.key)!;
        w.exercises.forEach((e, position) => {
          const exId = randomUUID();
          exRows.push({
            id: exId,
            workoutId,
            name: e.name,
            restSeconds: e.restSeconds,
            tempo: e.tempo || null,
            notes: e.notes || null,
            videoUrl: e.videoUrl || null,
            position,
          });
          const perWeek = new Map<number, number>();
          for (const st of e.sets) {
            const order = (perWeek.get(st.week) ?? 0) + 1;
            perWeek.set(st.week, order);
            setRows.push({
              exerciseId: exId,
              week: st.week,
              setNumber: st.setNumber ?? order,
              targetReps: st.targetReps,
              targetWeightKg: st.targetWeight == null ? null : round(toKg(st.targetWeight, unit), 2),
            });
          }
        });
      }
      if (exRows.length) await tx.insert(workoutExercises).values(exRows);
      if (setRows.length) await tx.insert(workoutSets).values(setRows);
    }

    await tx.delete(workoutDays).where(eq(workoutDays.planId, planId));
    await tx.insert(workoutDays).values(input.schedule.map((key, dow) => ({ planId, dayOfWeek: dow, workoutId: key ? (keyToId.get(key) ?? null) : null })));

    await logActivity(
      {
        actorId: actor.userId,
        clientId: client.id,
        coachId: actor.userId,
        action: "coach.workout_plan.updated",
        entityType: "workout_plan",
        entityId: planId,
        metadata: { workouts: input.workouts.length, trainingDays: input.schedule.filter(Boolean).length },
      },
      tx,
    );
    return planId;
  });

  // Re-sync today's snapshot only if the client hasn't started it. Past days are never touched.
  await ensureWorkoutLogForDate(client.id, today);
  await emit({ type: "plan.updated", clientUserId: client.userId, clientId: client.id, plan: "workout" });
  return { planId };
}

/* ───────────────────────── daily snapshot ───────────────────────── */

function resolveWorkoutForDate(plan: WorkoutPlanTree | undefined, date: string) {
  if (!plan) return null;
  const slot = plan.days.find((d) => d.dayOfWeek === dayOfWeek(date));
  if (!slot?.workoutId) return null;
  return plan.workouts.find((w) => w.id === slot.workoutId) ?? null;
}

async function insertWorkoutSnapshot(tx: Tx, clientId: string, date: string, plan: WorkoutPlanTree, workout: WorkoutPlanTree["workouts"][number]) {
  const logId = randomUUID();
  const week = planWeek(plan.weekCount, plan.startsOn, date);
  const exRows: (typeof workoutExerciseLogs.$inferInsert)[] = [];
  const setRows: (typeof workoutSetLogs.$inferInsert)[] = [];
  for (const ex of workout.exercises) {
    const sets = ex.sets.filter((st) => st.week === week.index);
    if (!sets.length) continue; // nothing planned for this exercise this week
    const exId = randomUUID();
    exRows.push({
      id: exId,
      workoutLogId: logId,
      sourceExerciseId: ex.id,
      name: ex.name,
      restSeconds: ex.restSeconds,
      tempo: ex.tempo,
      notes: ex.notes,
      videoUrl: ex.videoUrl,
      position: ex.position,
    });
    for (const s of sets) {
      setRows.push({
        clientId,
        workoutLogId: logId,
        exerciseLogId: exId,
        setNumber: s.setNumber,
        targetReps: s.targetReps,
        targetWeightKg: s.targetWeightKg,
      });
    }
  }
  await tx.insert(workoutLogs).values({
    id: logId,
    clientId,
    date,
    planId: plan.id,
    workoutId: workout.id,
    title: workout.title,
    muscleGroup: workout.muscleGroup,
    instructions: workout.instructions,
    weekIndex: week.index,
    weekCount: plan.weekCount,
    status: "pending",
    totalSets: setRows.length,
  });
  if (exRows.length) await tx.insert(workoutExerciseLogs).values(exRows);
  if (setRows.length) await tx.insert(workoutSetLogs).values(setRows);
  return logId;
}

/**
 * Idempotently materialises the day's workout as an immutable snapshot.
 * • Started/completed logs are never modified by plan edits.
 * • A still-untouched ("pending") log for the day is rebuilt if the plan changed since.
 */
export async function ensureWorkoutLogForDate(clientId: string, date: string): Promise<string | null> {
  const plan = await loadActiveWorkoutPlan(clientId);
  const workout = resolveWorkoutForDate(plan, date);
  const [existing] = await db
    .select()
    .from(workoutLogs)
    .where(and(eq(workoutLogs.clientId, clientId), eq(workoutLogs.date, date)))
    .limit(1);

  if (existing && existing.status !== "pending") return existing.id;

  const weekIdx = plan ? planWeek(plan.weekCount, plan.startsOn, date).index : 0;
  const hasSets = !!workout?.exercises.some((e) => e.sets.some((st) => st.week === weekIdx));
  if (!workout || !hasSets) {
    if (existing) {
      await db.delete(workoutLogs).where(and(eq(workoutLogs.id, existing.id), eq(workoutLogs.status, "pending")));
    }
    return null;
  }

  if (existing) {
    const stale = existing.workoutId !== workout.id || plan!.contentUpdatedAt.getTime() > existing.snapshotAt.getTime();
    if (!stale) return existing.id;
  }

  try {
    return await db.transaction(async (tx) => {
      if (existing) {
        const removed = await tx
          .delete(workoutLogs)
          .where(and(eq(workoutLogs.id, existing.id), eq(workoutLogs.status, "pending")))
          .returning({ id: workoutLogs.id });
        if (!removed.length) return existing.id; // client started it in the meantime
      }
      return insertWorkoutSnapshot(tx, clientId, date, plan!, workout);
    });
  } catch (err) {
    if (!isUniqueViolation(err)) throw err;
    const [row] = await db
      .select({ id: workoutLogs.id })
      .from(workoutLogs)
      .where(and(eq(workoutLogs.clientId, clientId), eq(workoutLogs.date, date)))
      .limit(1);
    return row?.id ?? null;
  }
}

/* ───────────────────────── logs ───────────────────────── */

export async function loadWorkoutLogTree(logId: string, dbx: Executor = db) {
  return dbx.query.workoutLogs.findFirst({
    where: eq(workoutLogs.id, logId),
    with: {
      exercises: {
        orderBy: [asc(workoutExerciseLogs.position)],
        with: { sets: { orderBy: [asc(workoutSetLogs.setNumber)] } },
      },
    },
  });
}
export type WorkoutLogTree = NonNullable<Awaited<ReturnType<typeof loadWorkoutLogTree>>>;

type SetLike = { targetReps: number; actualReps: number | null; status: "pending" | "completed" | "partial" | "skipped" };

export function computeCompletion(sets: SetLike[]) {
  const total = sets.length;
  const completed = sets.filter((s) => s.status === "completed").length;
  const partial = sets.filter((s) => s.status === "partial").length;
  const recorded = sets.filter((s) => s.status !== "pending").length;
  const targetSum = sets.reduce((a, s) => a + s.targetReps, 0);
  const doneSum = sets.reduce((a, s) => a + (s.status === "pending" ? 0 : Math.min(s.actualReps ?? s.targetReps, s.targetReps)), 0);
  const percent = targetSum > 0 ? (doneSum / targetSum) * 100 : total > 0 ? (completed / total) * 100 : 0;
  return { total, completed, partial, recorded, percent: Math.round(percent * 100) / 100 };
}

async function recomputeWorkoutLog(tx: Tx, logId: string) {
  const sets = await tx
    .select({ targetReps: workoutSetLogs.targetReps, actualReps: workoutSetLogs.actualReps, status: workoutSetLogs.status })
    .from(workoutSetLogs)
    .where(eq(workoutSetLogs.workoutLogId, logId));
  const c = computeCompletion(sets);
  await tx
    .update(workoutLogs)
    .set({
      totalSets: c.total,
      completedSets: c.completed,
      partialSets: c.partial,
      completionPercent: c.percent,
      status: sql`CASE WHEN ${workoutLogs.status} = 'pending' AND ${c.recorded} > 0 THEN 'in_progress'::workout_log_status ELSE ${workoutLogs.status} END`,
      startedAt: sql`COALESCE(${workoutLogs.startedAt}, CASE WHEN ${c.recorded} > 0 THEN now() END)`,
    })
    .where(eq(workoutLogs.id, logId));
  return c;
}

/** Client: today's workout (materialised on first view). */
export async function getTodayWorkout(actor: Actor) {
  const scope = await authorizeSelf(actor, "viewWorkouts");
  const { prefs, today } = await coachToday(scope.client.coachId);
  const logId = await ensureWorkoutLogForDate(scope.client.id, today);
  const log = logId ? await loadWorkoutLogTree(logId) : null;
  const week = await getWeekOverview(scope.client.id, today, prefs.weekStartsOn);
  return { today, prefs, permissions: scope.permissions, log, week };
}

/** 7-day strip: planned workout title + recorded status for each day of the current week. */
export async function getWeekOverview(clientId: string, today: string, weekStartsOn: number) {
  const start = startOfWeek(today, weekStartsOn);
  const end = addDays(start, 6);
  const plan = await loadActiveWorkoutPlan(clientId);
  const logs = await db
    .select({ id: workoutLogs.id, date: workoutLogs.date, status: workoutLogs.status, title: workoutLogs.title, pct: workoutLogs.completionPercent })
    .from(workoutLogs)
    .where(and(eq(workoutLogs.clientId, clientId), gte(workoutLogs.date, start), lte(workoutLogs.date, end)));
  return Array.from({ length: 7 }, (_, i) => {
    const date = addDays(start, i);
    const log = logs.find((l) => l.date === date);
    const planned = resolveWorkoutForDate(plan, date);
    return {
      date,
      isToday: date === today,
      isPast: date < today,
      title: log?.title ?? planned?.title ?? null,
      status: log?.status ?? null,
      completionPercent: log?.pct ?? null,
      logId: log?.id ?? null,
    };
  });
}

export async function recordSet(actor: Actor, setLogId: string, input: { done: boolean; actualReps?: number | null; actualWeightKg?: number | null }) {
  if (!isUuid(setLogId)) throw new NotFoundError("Set not found.");
  const scope = await authorizeSelf(actor, "completeWorkouts");
  const { today } = await coachToday(scope.client.coachId);

  return db.transaction(async (tx) => {
    const [row] = await tx
      .select({ set: workoutSetLogs, log: workoutLogs })
      .from(workoutSetLogs)
      .innerJoin(workoutLogs, eq(workoutLogs.id, workoutSetLogs.workoutLogId))
      // Scoped to the caller's own client id — another client's set id simply doesn't match.
      .where(and(eq(workoutSetLogs.id, setLogId), eq(workoutSetLogs.clientId, scope.client.id)))
      .for("update")
      .limit(1);
    if (!row) throw new NotFoundError("This set is no longer available — your coach may have just updated the workout. Refresh to continue.");
    if (row.log.date !== today) throw new ForbiddenError("Only today's workout can be updated.");
    if (row.log.status === "completed") throw new ConflictError("This workout is already completed.");

    let values: Partial<typeof workoutSetLogs.$inferInsert>;
    // The weight is kept even before the reps are written (the client may fill "wt" first).
    const weight = input.actualWeightKg === undefined ? row.set.actualWeightKg : input.actualWeightKg;
    if (input.done) {
      let actual = row.set.targetReps;
      if (input.actualReps != null && input.actualReps !== row.set.targetReps) {
        if (!scope.permissions.enterActualReps) {
          throw new ForbiddenError("Your coach hasn't enabled custom rep entry for your account.");
        }
        actual = input.actualReps;
      }
      const status = actual === 0 ? "skipped" : actual >= row.set.targetReps ? "completed" : "partial";
      values = { actualReps: actual, actualWeightKg: weight, status, completedAt: new Date() };
    } else {
      values = { actualReps: null, actualWeightKg: weight, status: "pending", completedAt: null };
    }

    const [updated] = await tx.update(workoutSetLogs).set(values).where(eq(workoutSetLogs.id, row.set.id)).returning();
    const summary = await recomputeWorkoutLog(tx, row.log.id);

    await logActivity(
      {
        actorId: actor.userId,
        clientId: scope.client.id,
        coachId: scope.client.coachId,
        action: !input.done ? "client.workout_set.reset" : updated!.status === "completed" ? "client.workout_set.completed" : "client.workout_set.partial",
        entityType: "workout_set_log",
        entityId: row.set.id,
        metadata: {
          workout: row.log.title,
          set: row.set.setNumber,
          targetReps: row.set.targetReps,
          actualReps: updated!.actualReps,
          actualWeightKg: updated!.actualWeightKg,
        },
      },
      tx,
    );
    await touchClient(scope.client.id, tx);

    return {
      set: {
        id: updated!.id,
        status: updated!.status,
        actualReps: updated!.actualReps,
        actualWeightKg: updated!.actualWeightKg,
        completedAt: updated!.completedAt?.toISOString() ?? null,
      },
      summary,
    };
  });
}

export async function completeWorkout(actor: Actor) {
  const scope = await authorizeSelf(actor, "completeWorkouts");
  const { today } = await coachToday(scope.client.coachId);

  const result = await db.transaction(async (tx) => {
    const [log] = await tx
      .select()
      .from(workoutLogs)
      .where(and(eq(workoutLogs.clientId, scope.client.id), eq(workoutLogs.date, today)))
      .for("update")
      .limit(1);
    if (!log) throw new NotFoundError("No workout assigned for today.");
    if (log.status === "completed") {
      return { logId: log.id, completedAt: log.completedAt!, completionPercent: log.completionPercent, title: log.title, already: true };
    }
    const summary = await recomputeWorkoutLog(tx, log.id);
    const [done] = await tx
      .update(workoutLogs)
      .set({ status: "completed", completedAt: sql`now()`, startedAt: sql`COALESCE(${workoutLogs.startedAt}, now())` })
      .where(eq(workoutLogs.id, log.id))
      .returning({ completedAt: workoutLogs.completedAt });

    await logActivity(
      {
        actorId: actor.userId,
        clientId: scope.client.id,
        coachId: scope.client.coachId,
        action: "client.workout.completed",
        entityType: "workout_log",
        entityId: log.id,
        metadata: { workout: log.title, completionPercent: summary.percent, date: today },
      },
      tx,
    );
    await touchClient(scope.client.id, tx);
    return { logId: log.id, completedAt: done!.completedAt!, completionPercent: summary.percent, title: log.title, already: false };
  });

  if (!result.already) {
    await emit({
      type: "workout.completed",
      coachId: scope.client.coachId,
      clientId: scope.client.id,
      clientName: scope.client.fullName,
      title: result.title,
      completionPercent: result.completionPercent,
      logId: result.logId,
    });
  }
  return { completedAt: result.completedAt.toISOString(), completionPercent: result.completionPercent };
}

export type DisplayStatus = "completed" | "in_progress" | "pending" | "missed" | "incomplete";
export function workoutDisplayStatus(status: string, date: string, today: string): DisplayStatus {
  if (status === "completed") return "completed";
  if (date < today) return status === "in_progress" ? "incomplete" : "missed";
  return status === "in_progress" ? "in_progress" : "pending";
}

/** Coach (or permitted client): paginated workout history with per-set results. */
export async function listWorkoutHistory(actor: Actor, clientId: string, opts: { page?: number; pageSize?: number } = {}) {
  const scope = await authorizeClient(actor, clientId, "viewWorkouts");
  const { today } = await coachToday(scope.client.coachId);
  const pageSize = Math.min(Math.max(opts.pageSize ?? 15, 1), 50);
  const page = Math.max(opts.page ?? 1, 1);

  const [{ total }] = await db.select({ total: count() }).from(workoutLogs).where(eq(workoutLogs.clientId, scope.client.id));
  const logs = await db.query.workoutLogs.findMany({
    where: eq(workoutLogs.clientId, scope.client.id),
    orderBy: [desc(workoutLogs.date)],
    limit: pageSize,
    offset: (page - 1) * pageSize,
    with: {
      exercises: {
        orderBy: [asc(workoutExerciseLogs.position)],
        with: { sets: { orderBy: [asc(workoutSetLogs.setNumber)] } },
      },
    },
  });

  return {
    today,
    page,
    pageSize,
    total,
    pages: Math.max(1, Math.ceil(total / pageSize)),
    logs: logs.map((l) => ({ ...l, displayStatus: workoutDisplayStatus(l.status, l.date, today) })),
  };
}

export async function getWorkoutLogDetail(actor: Actor, clientId: string, logId: string) {
  const scope = await authorizeClient(actor, clientId, "viewWorkouts");
  if (!isUuid(logId)) throw new NotFoundError("Workout record not found.");
  const log = await db.query.workoutLogs.findFirst({
    where: and(eq(workoutLogs.id, logId), eq(workoutLogs.clientId, scope.client.id)),
    with: {
      exercises: {
        orderBy: [asc(workoutExerciseLogs.position)],
        with: { sets: { orderBy: [asc(workoutSetLogs.setNumber)] } },
      },
    },
  });
  if (!log) throw new NotFoundError("Workout record not found.");
  const { today } = await coachToday(scope.client.coachId);
  return { log: { ...log, displayStatus: workoutDisplayStatus(log.status, log.date, today) }, client: scope.client };
}

/** Coach-only correction of a recorded workout. Targets are immutable; only results change. */
export async function editWorkoutLog(
  actor: Actor,
  clientId: string,
  logId: string,
  input: {
    coachNote: string | null;
    sets: { id: string; actualReps: number | null; status: "pending" | "completed" | "partial" | "skipped" }[];
    markCompleted?: boolean;
  },
) {
  assertCoach(actor);
  const { client } = await authorizeClient(actor, clientId);
  if (!isUuid(logId)) throw new NotFoundError("Workout record not found.");

  await db.transaction(async (tx) => {
    const [log] = await tx
      .select()
      .from(workoutLogs)
      .where(and(eq(workoutLogs.id, logId), eq(workoutLogs.clientId, client.id)))
      .for("update")
      .limit(1);
    if (!log) throw new NotFoundError("Workout record not found.");

    const setRows = await tx.select().from(workoutSetLogs).where(eq(workoutSetLogs.workoutLogId, log.id));
    const byId = new Map(setRows.map((s) => [s.id, s]));
    for (const s of input.sets) {
      const current = byId.get(s.id);
      if (!current) continue; // ignore ids that don't belong to this record
      const pending = s.status === "pending";
      const actual = pending ? null : (s.actualReps ?? current.targetReps);
      await tx
        .update(workoutSetLogs)
        .set({
          status: pending ? "pending" : s.status,
          actualReps: actual,
          completedAt: pending ? null : (current.completedAt ?? new Date()),
        })
        .where(and(eq(workoutSetLogs.id, s.id), eq(workoutSetLogs.workoutLogId, log.id)));
    }
    await recomputeWorkoutLog(tx, log.id);
    await tx
      .update(workoutLogs)
      .set({
        coachNote: input.coachNote,
        coachEditedAt: sql`now()`,
        ...(input.markCompleted && log.status !== "completed"
          ? { status: "completed" as const, completedAt: sql`COALESCE(${workoutLogs.completedAt}, now())` }
          : {}),
      })
      .where(eq(workoutLogs.id, log.id));

    await logActivity(
      {
        actorId: actor.userId,
        clientId: client.id,
        coachId: actor.userId,
        action: "coach.workout_log.edited",
        entityType: "workout_log",
        entityId: log.id,
        metadata: { workout: log.title, date: log.date },
      },
      tx,
    );
  });
}
