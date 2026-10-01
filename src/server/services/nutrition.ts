import { randomUUID } from "node:crypto";
import { and, asc, eq, gte, inArray, lte, notInArray, sql } from "drizzle-orm";
import { db, type Executor } from "../db";
import { mealItems, mealLogs, meals, nutritionPlans, type MealItemSnapshot } from "../db/schema";
import { assertCoach, authorizeClient, authorizeSelf } from "../authz";
import { logActivity, touchClient } from "../activity";
import { emit } from "../events";
import { ForbiddenError, NotFoundError, isUniqueViolation } from "../errors";
import type { Actor } from "../auth/types";
import { coachToday } from "./settings";
import { addDays } from "@/lib/time";
import { isUuid } from "@/lib/utils";
import type { NutritionPlanInput } from "@/lib/validation";

export async function loadActiveNutritionPlan(clientId: string, dbx: Executor = db) {
  return dbx.query.nutritionPlans.findFirst({
    where: and(eq(nutritionPlans.clientId, clientId), eq(nutritionPlans.isActive, true)),
    with: {
      meals: {
        orderBy: [asc(meals.position)],
        with: { items: { orderBy: [asc(mealItems.position)] } },
      },
    },
  });
}
export type NutritionPlanTree = NonNullable<Awaited<ReturnType<typeof loadActiveNutritionPlan>>>;

const n = (v: number | null | undefined) => (v == null ? 0 : v);
export function mealTotals(items: { calories: number | null; protein: number | null; carbs: number | null; fats: number | null }[]) {
  const has = (k: "calories" | "protein" | "carbs" | "fats") => items.some((i) => i[k] != null);
  const total = (k: "calories" | "protein" | "carbs" | "fats") =>
    has(k) ? Math.round(items.reduce((a, i) => a + n(i[k]), 0) * 10) / 10 : null;
  return { calories: total("calories"), protein: total("protein"), carbs: total("carbs"), fats: total("fats") };
}

export async function getNutritionPlanForEditor(actor: Actor, clientId: string) {
  assertCoach(actor);
  const { client } = await authorizeClient(actor, clientId);
  const plan = await loadActiveNutritionPlan(client.id);
  return plan
    ? {
        id: plan.id,
        name: plan.name,
        notes: plan.notes,
        updatedAt: plan.contentUpdatedAt.toISOString(),
        meals: plan.meals.map((m) => ({
          id: m.id,
          key: m.id,
          name: m.name,
          time: m.scheduledTime.slice(0, 5),
          notes: m.notes,
          referenceUrl: m.referenceUrl,
          items: m.items.map((i) => ({
            key: i.id,
            name: i.name,
            quantity: i.quantity,
            calories: i.calories,
            protein: i.protein,
            carbs: i.carbs,
            fats: i.fats,
          })),
        })),
      }
    : null;
}

export async function saveNutritionPlan(actor: Actor, clientId: string, input: NutritionPlanInput) {
  assertCoach(actor);
  const { client } = await authorizeClient(actor, clientId);
  const { today } = await coachToday(actor.userId);

  const planId = await db.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(nutritionPlans)
      .where(and(eq(nutritionPlans.clientId, client.id), eq(nutritionPlans.isActive, true)))
      .for("update")
      .limit(1);
    let planId: string;
    if (existing) {
      planId = existing.id;
      await tx
        .update(nutritionPlans)
        .set({ name: input.name, notes: input.notes, contentUpdatedAt: sql`now()` })
        .where(eq(nutritionPlans.id, planId));
    } else {
      const [created] = await tx
        .insert(nutritionPlans)
        .values({ clientId: client.id, name: input.name, notes: input.notes })
        .returning({ id: nutritionPlans.id });
      planId = created!.id;
    }

    const existingIds = new Set((await tx.select({ id: meals.id }).from(meals).where(eq(meals.planId, planId))).map((r) => r.id));
    const keep: string[] = [];
    const itemRows: (typeof mealItems.$inferInsert)[] = [];

    for (const [position, m] of input.meals.entries()) {
      const values = {
        name: m.name,
        scheduledTime: m.time.length === 5 ? `${m.time}:00` : m.time,
        notes: m.notes || null,
        referenceUrl: m.referenceUrl || null,
        position,
      };
      let id: string;
      if (m.id && isUuid(m.id) && existingIds.has(m.id)) {
        id = m.id;
        await tx.update(meals).set(values).where(and(eq(meals.id, id), eq(meals.planId, planId)));
      } else {
        id = randomUUID();
        await tx.insert(meals).values({ id, planId, ...values });
      }
      keep.push(id);
      m.items.forEach((item, i) =>
        itemRows.push({
          mealId: id,
          name: item.name,
          quantity: item.quantity || null,
          calories: item.calories,
          protein: item.protein,
          carbs: item.carbs,
          fats: item.fats,
          position: i,
        }),
      );
    }

    await tx.delete(meals).where(keep.length ? and(eq(meals.planId, planId), notInArray(meals.id, keep)) : eq(meals.planId, planId));
    if (keep.length) await tx.delete(mealItems).where(inArray(mealItems.mealId, keep));
    if (itemRows.length) await tx.insert(mealItems).values(itemRows);

    await logActivity(
      {
        actorId: actor.userId,
        clientId: client.id,
        coachId: actor.userId,
        action: "coach.nutrition_plan.updated",
        entityType: "nutrition_plan",
        entityId: planId,
        metadata: { meals: input.meals.length },
      },
      tx,
    );
    return planId;
  });

  await ensureMealLogsForDate(client.id, today);
  await emit({ type: "plan.updated", clientUserId: client.userId, clientId: client.id, plan: "nutrition" });
  return { planId };
}

/**
 * Materialise the day's meals as snapshots. Completed meals are frozen; pending meals follow
 * the latest plan for *today only* (added meals appear, removed meals disappear).
 */
export async function ensureMealLogsForDate(clientId: string, date: string) {
  const plan = await loadActiveNutritionPlan(clientId);
  const existing = await db.select().from(mealLogs).where(and(eq(mealLogs.clientId, clientId), eq(mealLogs.date, date)));
  const planMealIds = new Set(plan?.meals.map((m) => m.id) ?? []);

  // Drop pending rows for meals that no longer exist in the plan.
  const orphaned = existing.filter((l) => l.status === "pending" && (!l.mealId || !planMealIds.has(l.mealId))).map((l) => l.id);
  if (orphaned.length) await db.delete(mealLogs).where(and(inArray(mealLogs.id, orphaned), eq(mealLogs.status, "pending")));
  if (!plan) return;

  for (const meal of plan.meals) {
    const items: MealItemSnapshot[] = meal.items.map((i) => ({
      name: i.name,
      quantity: i.quantity,
      calories: i.calories,
      protein: i.protein,
      carbs: i.carbs,
      fats: i.fats,
    }));
    const t = mealTotals(items);
    const snapshot = {
      planId: plan.id,
      mealName: meal.name,
      scheduledTime: meal.scheduledTime,
      notes: meal.notes,
      items,
      totalCalories: t.calories,
      totalProtein: t.protein,
      totalCarbs: t.carbs,
      totalFats: t.fats,
      position: meal.position,
    };
    const log = existing.find((l) => l.mealId === meal.id);
    if (!log) {
      try {
        await db.insert(mealLogs).values({ clientId, date, mealId: meal.id, ...snapshot });
      } catch (err) {
        if (!isUniqueViolation(err)) throw err;
      }
    } else if (log.status === "pending" && plan.contentUpdatedAt.getTime() > log.snapshotAt.getTime()) {
      await db
        .update(mealLogs)
        .set({ ...snapshot, snapshotAt: sql`now()` })
        .where(and(eq(mealLogs.id, log.id), eq(mealLogs.status, "pending")));
    }
  }
}

export async function loadMealLogs(clientId: string, date: string) {
  const rows = await db
    .select()
    .from(mealLogs)
    .where(and(eq(mealLogs.clientId, clientId), eq(mealLogs.date, date)))
    .orderBy(asc(mealLogs.scheduledTime), asc(mealLogs.position));
  return rows;
}
export type MealLogRow = Awaited<ReturnType<typeof loadMealLogs>>[number];

export async function getTodayMeals(actor: Actor) {
  const scope = await authorizeSelf(actor, "viewNutrition");
  const { prefs, today } = await coachToday(scope.client.coachId);
  await ensureMealLogsForDate(scope.client.id, today);
  const logs = await loadMealLogs(scope.client.id, today);
  const plan = await db
    .select({ name: nutritionPlans.name, notes: nutritionPlans.notes })
    .from(nutritionPlans)
    .where(and(eq(nutritionPlans.clientId, scope.client.id), eq(nutritionPlans.isActive, true)))
    .limit(1);
  return { today, prefs, permissions: scope.permissions, logs, plan: plan[0] ?? null };
}

/** Client taps "eaten" — the timestamp is ALWAYS the server's clock, never client input. */
export async function setMealConsumed(actor: Actor, mealLogId: string, consumed: boolean) {
  if (!isUuid(mealLogId)) throw new NotFoundError("Meal not found.");
  const scope = await authorizeSelf(actor, "completeMeals");
  const { today } = await coachToday(scope.client.coachId);

  const updated = await db.transaction(async (tx) => {
    const [log] = await tx
      .select()
      .from(mealLogs)
      .where(and(eq(mealLogs.id, mealLogId), eq(mealLogs.clientId, scope.client.id)))
      .for("update")
      .limit(1);
    if (!log) throw new NotFoundError("This meal is no longer in your plan — refresh to see the latest.");
    if (log.date !== today) throw new ForbiddenError("Only today's meals can be updated.");
    if (consumed && log.status === "completed") return log; // idempotent
    if (!consumed && log.status === "pending") return log;

    const [row] = await tx
      .update(mealLogs)
      .set(consumed ? { status: "completed", consumedAt: sql`now()` } : { status: "pending", consumedAt: null })
      .where(eq(mealLogs.id, log.id))
      .returning();

    await logActivity(
      {
        actorId: actor.userId,
        clientId: scope.client.id,
        coachId: scope.client.coachId,
        action: consumed ? "client.meal.completed" : "client.meal.undone",
        entityType: "meal_log",
        entityId: log.id,
        metadata: { meal: log.mealName, scheduledTime: log.scheduledTime, date: log.date },
      },
      tx,
    );
    await touchClient(scope.client.id, tx);
    return row!;
  });

  if (consumed && updated.status === "completed") {
    await emit({
      type: "meal.completed",
      coachId: scope.client.coachId,
      clientId: scope.client.id,
      clientName: scope.client.fullName,
      mealName: updated.mealName,
    });
  }
  return { id: updated.id, status: updated.status, consumedAt: updated.consumedAt?.toISOString() ?? null };
}

export type MealDisplayStatus = "completed" | "pending" | "missed";
export function mealDisplayStatus(status: string, date: string, today: string): MealDisplayStatus {
  if (status === "completed") return "completed";
  return date < today ? "missed" : "pending";
}

/** Meal history grouped by day (newest first). */
export async function getMealHistory(actor: Actor, clientId: string, opts: { days?: number; before?: string } = {}) {
  const scope = await authorizeClient(actor, clientId, "viewNutrition");
  const { today } = await coachToday(scope.client.coachId);
  const days = Math.min(Math.max(opts.days ?? 14, 1), 60);
  const end = opts.before && opts.before <= today ? opts.before : today;
  const start = addDays(end, -(days - 1));
  const rows = await db
    .select()
    .from(mealLogs)
    .where(and(eq(mealLogs.clientId, scope.client.id), gte(mealLogs.date, start), lte(mealLogs.date, end)))
    .orderBy(asc(mealLogs.date), asc(mealLogs.scheduledTime), asc(mealLogs.position));

  const byDate = new Map<string, typeof rows>();
  for (const r of rows) byDate.set(r.date, [...(byDate.get(r.date) ?? []), r]);
  const groups = [...byDate.entries()]
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .map(([date, logs]) => {
      const completed = logs.filter((l) => l.status === "completed").length;
      return {
        date,
        total: logs.length,
        completed,
        adherence: logs.length ? Math.round((completed / logs.length) * 1000) / 10 : null,
        logs: logs.map((l) => ({ ...l, displayStatus: mealDisplayStatus(l.status, l.date, today) })),
      };
    });
  return { today, start, end, groups, hasMore: start > scope.client.joinedOn };
}
