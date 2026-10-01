import { and, asc, count, desc, eq, ilike, inArray, ne, or, sql } from "drizzle-orm";
import { db } from "../db";
import {
  clientPermissions,
  clients,
  mealLogs,
  meals,
  measurementTypes,
  measurements,
  nutritionPlans,
  progressPhotos,
  sessions,
  users,
  workoutDays,
  workoutLogs,
  workoutPlans,
  workouts,
} from "../db/schema";
import { assertCoach, authorizeClient, authorizeSelf, loadPermissions } from "../authz";
import { logActivity } from "../activity";
import { ValidationError, isUniqueViolation } from "../errors";
import { storage } from "../storage";
import { generateTemporaryPassword, hashPassword } from "../auth/password";
import type { Actor } from "../auth/types";
import { createPasswordResetLink } from "./auth";
import { adherenceByClient, type AdherenceStats } from "./analytics";
import { coachToday, getCoachPrefs } from "./settings";
import { DEFAULT_PERMISSIONS, type Goal, type Permissions } from "@/lib/constants";
import { addDays, dayOfWeek, todayInTz } from "@/lib/time";
import { round, toCm, toKg, type UnitPrefs } from "@/lib/units";
import type { ClientProfileInput } from "@/lib/validation";

/* ───────────────────────── helpers ───────────────────────── */

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export function generateClientCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return `KN-${Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join("")}`;
}

function profileToColumns(input: ClientProfileInput, prefs: UnitPrefs) {
  const kg = (v: number | null | undefined) => (v == null ? null : round(toKg(v, prefs.weightUnit), 2));
  return {
    fullName: input.fullName,
    phone: input.phone ?? null,
    dateOfBirth: input.dateOfBirth ?? null,
    gender: input.gender,
    heightCm: input.height == null ? null : round(toCm(input.height, prefs.lengthUnit), 1),
    startingWeightKg: kg(input.startingWeight),
    goalWeightKg: kg(input.goalWeight),
    goal: input.goal,
    goalNote: input.goalNote ?? null,
    coachNotes: input.coachNotes ?? null,
    status: input.status,
  };
}

async function assertEmailAvailable(email: string, exceptUserId?: string) {
  const [row] = await db
    .select({ id: users.id })
    .from(users)
    .where(
      exceptUserId
        ? and(sql`lower(${users.email}) = ${email.toLowerCase()}`, ne(users.id, exceptUserId))
        : sql`lower(${users.email}) = ${email.toLowerCase()}`,
    )
    .limit(1);
  if (row) throw new ValidationError("That email is already in use.", { email: ["That email is already in use."] });
}

/* ───────────────────────── commands ───────────────────────── */

export async function createClient(actor: Actor, input: ClientProfileInput & { password?: string | null; forcePasswordChange?: boolean }) {
  assertCoach(actor);
  await assertEmailAvailable(input.email);
  const prefs = await getCoachPrefs(actor.userId);
  const today = todayInTz(prefs.timezone);
  // A password the coach typed is never echoed back; a generated one is returned once so it can be shared.
  const generatedPassword = input.password ? null : generateTemporaryPassword();
  const passwordHash = await hashPassword(input.password ?? generatedPassword!);
  const cols = profileToColumns(input, prefs);

  try {
    const client = await db.transaction(async (tx) => {
      const [user] = await tx
        .insert(users)
        .values({
          email: input.email,
          passwordHash,
          role: "client",
          name: input.fullName,
          // The coach decides whether the client must pick their own password at first sign-in.
          mustChangePassword: input.forcePasswordChange ?? false,
          isActive: true,
        })
        .returning({ id: users.id });

      let created: typeof clients.$inferSelect | undefined;
      for (let attempt = 0; attempt < 5 && !created; attempt++) {
        try {
          [created] = await tx
            .insert(clients)
            .values({
              userId: user!.id,
              coachId: actor.userId,
              code: generateClientCode(),
              ...cols,
              currentWeightKg: cols.startingWeightKg,
              joinedOn: today,
            })
            .returning();
        } catch (err) {
          if (!isUniqueViolation(err) || attempt === 4) throw err;
        }
      }

      await tx.insert(clientPermissions).values({ clientId: created!.id, ...DEFAULT_PERMISSIONS, updatedById: actor.userId });

      // Seed the progress history with the starting stats so charts begin at day one.
      const [weightType] = await tx
        .select()
        .from(measurementTypes)
        .where(and(sql`${measurementTypes.coachId} IS NULL`, eq(measurementTypes.key, "weight")))
        .limit(1);
      if (weightType && cols.startingWeightKg != null) {
        await tx.insert(measurements).values({
          clientId: created!.id,
          typeId: weightType.id,
          value: cols.startingWeightKg,
          unit: "kg",
          measuredOn: today,
          note: "Starting weight",
          recordedById: actor.userId,
        });
      }

      await logActivity(
        { actorId: actor.userId, clientId: created!.id, coachId: actor.userId, action: "coach.client.created", entityType: "client", entityId: created!.id },
        tx,
      );
      return created!;
    });
    return { client, generatedPassword };
  } catch (err) {
    if (isUniqueViolation(err)) throw new ValidationError("That email is already in use.", { email: ["That email is already in use."] });
    throw err;
  }
}

export async function updateClient(actor: Actor, clientId: string, input: ClientProfileInput) {
  assertCoach(actor);
  const { client } = await authorizeClient(actor, clientId);
  await assertEmailAvailable(input.email, client.userId);
  const prefs = await getCoachPrefs(actor.userId);
  const cols = profileToColumns(input, prefs);

  await db.transaction(async (tx) => {
    await tx.update(users).set({ email: input.email, name: input.fullName }).where(eq(users.id, client.userId));
    await tx
      .update(clients)
      .set({
        ...cols,
        currentWeightKg: client.currentWeightKg ?? cols.startingWeightKg,
      })
      .where(eq(clients.id, client.id));
    await logActivity(
      { actorId: actor.userId, clientId: client.id, coachId: actor.userId, action: "coach.client.updated", entityType: "client", entityId: client.id },
      tx,
    );
    if (client.status !== input.status) {
      await logActivity(
        {
          actorId: actor.userId,
          clientId: client.id,
          coachId: actor.userId,
          action: "coach.client.status_changed",
          entityType: "client",
          entityId: client.id,
          metadata: { from: client.status, to: input.status },
        },
        tx,
      );
      if (input.status === "inactive") await tx.delete(sessions).where(eq(sessions.userId, client.userId));
    }
  });
}

export async function setClientStatus(actor: Actor, clientId: string, status: "active" | "inactive") {
  assertCoach(actor);
  const { client } = await authorizeClient(actor, clientId);
  if (client.status === status) return;
  await db.transaction(async (tx) => {
    await tx.update(clients).set({ status }).where(eq(clients.id, client.id));
    // Disabling revokes every live session immediately.
    if (status === "inactive") await tx.delete(sessions).where(eq(sessions.userId, client.userId));
    await logActivity(
      {
        actorId: actor.userId,
        clientId: client.id,
        coachId: actor.userId,
        action: "coach.client.status_changed",
        entityType: "client",
        entityId: client.id,
        metadata: { from: client.status, to: status },
      },
      tx,
    );
  });
}

/** Permanently deletes the client, their login and every related record + private files. */
export async function deleteClient(actor: Actor, clientId: string, confirmName: string) {
  assertCoach(actor);
  const { client } = await authorizeClient(actor, clientId);
  if (confirmName.trim().toLowerCase() !== client.fullName.trim().toLowerCase()) {
    throw new ValidationError("Type the client's full name to confirm.", { confirmName: ["Name doesn't match."] });
  }
  const photos = await db.select({ a: progressPhotos.storageKey, b: progressPhotos.thumbKey }).from(progressPhotos).where(eq(progressPhotos.clientId, client.id));
  await db.delete(users).where(eq(users.id, client.userId)); // cascades to clients → all client data
  const keys = [...photos.flatMap((p) => [p.a, p.b]), ...(client.avatarKey ? [client.avatarKey] : [])];
  await Promise.allSettled(keys.map((k) => storage().delete(k)));
}

/**
 * The coach sets the client's password ("set": typed or generated), or issues a one-time reset link.
 * Setting a password signs the client out of every device.
 */
export async function resetClientPassword(
  actor: Actor,
  clientId: string,
  mode: "set" | "link",
  opts: { password?: string | null; forcePasswordChange?: boolean } = {},
) {
  assertCoach(actor);
  const { client } = await authorizeClient(actor, clientId);
  let result: { generatedPassword?: string; resetUrl?: string };
  if (mode === "set") {
    const generatedPassword = opts.password ? null : generateTemporaryPassword();
    await db
      .update(users)
      .set({
        passwordHash: await hashPassword(opts.password ?? generatedPassword!),
        mustChangePassword: opts.forcePasswordChange ?? false,
        passwordChangedAt: new Date(),
      })
      .where(eq(users.id, client.userId));
    await db.delete(sessions).where(eq(sessions.userId, client.userId));
    result = generatedPassword ? { generatedPassword } : {};
  } else {
    result = { resetUrl: await createPasswordResetLink(client.userId, actor.userId, 60 * 24) };
  }
  await logActivity({
    actorId: actor.userId,
    clientId: client.id,
    coachId: actor.userId,
    action: "coach.client.password_reset",
    entityType: "user",
    entityId: client.userId,
    metadata: { mode },
  });
  return result;
}

export async function updatePermissions(actor: Actor, clientId: string, next: Permissions) {
  assertCoach(actor);
  const { client } = await authorizeClient(actor, clientId);
  const before = await loadPermissions(client.id);
  await db
    .insert(clientPermissions)
    .values({ clientId: client.id, ...next, updatedById: actor.userId })
    .onConflictDoUpdate({ target: clientPermissions.clientId, set: { ...next, updatedById: actor.userId, updatedAt: new Date() } });
  const changed = Object.fromEntries(
    (Object.keys(next) as (keyof Permissions)[]).filter((k) => before[k] !== next[k]).map((k) => [k, next[k]]),
  );
  if (Object.keys(changed).length) {
    await logActivity({
      actorId: actor.userId,
      clientId: client.id,
      coachId: actor.userId,
      action: "coach.permissions.updated",
      entityType: "client_permissions",
      entityId: client.id,
      metadata: { changed },
    });
  }
}

/** Client self-service — only when the coach enabled `editPersonalInfo`. */
export async function updateOwnProfile(
  actor: Actor,
  input: { phone?: string | null; dateOfBirth?: string | null; gender: "male" | "female" | "other" | "unspecified" },
) {
  const { client } = await authorizeSelf(actor, "editPersonalInfo");
  await db
    .update(clients)
    .set({ phone: input.phone ?? null, dateOfBirth: input.dateOfBirth ?? null, gender: input.gender })
    .where(eq(clients.id, client.id));
  await logActivity({
    actorId: actor.userId,
    clientId: client.id,
    coachId: client.coachId,
    action: "client.profile.updated",
    entityType: "client",
    entityId: client.id,
  });
}

/* ───────────────────────── queries ───────────────────────── */

export async function getClientProfile(actor: Actor, clientId: string) {
  const scope = await authorizeClient(actor, clientId);
  const [user] = await db
    .select({ email: users.email, lastLoginAt: users.lastLoginAt, mustChangePassword: users.mustChangePassword })
    .from(users)
    .where(eq(users.id, scope.client.userId))
    .limit(1);
  const client = { ...scope.client, email: user?.email ?? "", lastLoginAt: user?.lastLoginAt ?? null, pendingPasswordSetup: user?.mustChangePassword ?? false };
  // Private coach notes never leave the server for client actors.
  if (actor.role !== "coach") client.coachNotes = null;
  return { client, permissions: scope.permissions };
}

export type TodayWorkoutStatus = "completed" | "in_progress" | "pending" | "rest" | "no_plan";
export type TodayNutritionStatus = "done" | "partial" | "not_started" | "no_plan";

export async function todayStatusFor(clientIds: string[], today: string) {
  const out = new Map<
    string,
    {
      workout: TodayWorkoutStatus;
      workoutTitle: string | null;
      workoutPct: number | null;
      completedAt: Date | null;
      mealsDone: number;
      mealsTotal: number;
      nutrition: TodayNutritionStatus;
    }
  >();
  if (!clientIds.length) return out;
  const dow = dayOfWeek(today);

  const slots = await db
    .select({ clientId: workoutPlans.clientId, workoutId: workoutDays.workoutId, title: workouts.title })
    .from(workoutPlans)
    .leftJoin(workoutDays, and(eq(workoutDays.planId, workoutPlans.id), eq(workoutDays.dayOfWeek, dow)))
    .leftJoin(workouts, eq(workouts.id, workoutDays.workoutId))
    .where(and(inArray(workoutPlans.clientId, clientIds), eq(workoutPlans.isActive, true)));
  const logs = await db
    .select({
      clientId: workoutLogs.clientId,
      status: workoutLogs.status,
      pct: workoutLogs.completionPercent,
      title: workoutLogs.title,
      completedAt: workoutLogs.completedAt,
    })
    .from(workoutLogs)
    .where(and(inArray(workoutLogs.clientId, clientIds), eq(workoutLogs.date, today)));
  const planMeals = await db
    .select({ clientId: nutritionPlans.clientId, total: count(meals.id) })
    .from(nutritionPlans)
    .leftJoin(meals, eq(meals.planId, nutritionPlans.id))
    .where(and(inArray(nutritionPlans.clientId, clientIds), eq(nutritionPlans.isActive, true)))
    .groupBy(nutritionPlans.clientId);
  const mealToday = await db
    .select({
      clientId: mealLogs.clientId,
      total: sql<number>`count(*)`.mapWith(Number),
      done: sql<number>`count(*) FILTER (WHERE ${mealLogs.status} = 'completed')`.mapWith(Number),
    })
    .from(mealLogs)
    .where(and(inArray(mealLogs.clientId, clientIds), eq(mealLogs.date, today)))
    .groupBy(mealLogs.clientId);

  for (const id of clientIds) {
    const slot = slots.find((s) => s.clientId === id);
    const log = logs.find((l) => l.clientId === id);
    const workout: TodayWorkoutStatus = log
      ? log.status
      : !slot
        ? "no_plan"
        : slot.workoutId
          ? "pending"
          : "rest";
    const planned = planMeals.find((p) => p.clientId === id);
    const ml = mealToday.find((m) => m.clientId === id);
    const mealsTotal = ml?.total || planned?.total || 0;
    const mealsDone = ml?.done ?? 0;
    const nutrition: TodayNutritionStatus = !planned && !ml
      ? "no_plan"
      : mealsTotal === 0
        ? "no_plan"
        : mealsDone >= mealsTotal
          ? "done"
          : mealsDone > 0
            ? "partial"
            : "not_started";
    out.set(id, {
      workout,
      workoutTitle: log?.title ?? slot?.title ?? null,
      workoutPct: log?.pct ?? null,
      completedAt: log?.completedAt ?? null,
      mealsDone,
      mealsTotal,
      nutrition,
    });
  }
  return out;
}

export type ClientListFilters = {
  q?: string;
  status?: "all" | "active" | "inactive";
  workout?: "all" | TodayWorkoutStatus;
  nutrition?: "all" | TodayNutritionStatus;
  goal?: "all" | Goal;
  activity?: "all" | "24h" | "7d" | "stale" | "never";
  sort?: "name" | "status" | "lastActivity" | "joined" | "weight" | "goal" | "workoutAdherence" | "nutritionAdherence";
  dir?: "asc" | "desc";
  page?: number;
  pageSize?: number;
};

export async function listClients(actor: Actor, filters: ClientListFilters = {}) {
  assertCoach(actor);
  const { prefs, today } = await coachToday(actor.userId);
  const q = filters.q?.trim().slice(0, 100);
  const like = q ? `%${q.replace(/[%_\\]/g, (c) => `\\${c}`)}%` : null;

  const rows = await db
    .select({
      id: clients.id,
      code: clients.code,
      fullName: clients.fullName,
      phone: clients.phone,
      email: users.email,
      status: clients.status,
      heightCm: clients.heightCm,
      currentWeightKg: clients.currentWeightKg,
      startingWeightKg: clients.startingWeightKg,
      goal: clients.goal,
      avatarKey: clients.avatarKey,
      joinedOn: clients.joinedOn,
      lastActivityAt: clients.lastActivityAt,
      createdAt: clients.createdAt,
    })
    .from(clients)
    .innerJoin(users, eq(users.id, clients.userId))
    .where(
      and(
        eq(clients.coachId, actor.userId),
        like
          ? or(ilike(clients.fullName, like), ilike(users.email, like), ilike(clients.phone, like), ilike(clients.code, like))
          : undefined,
      ),
    )
    .orderBy(asc(clients.fullName));

  const ids = rows.map((r) => r.id);
  const [statusMap, adherence] = await Promise.all([
    todayStatusFor(ids, today),
    adherenceByClient(ids, addDays(today, -29), today),
  ]);

  const now = Date.now();
  let list = rows.map((r) => ({
    ...r,
    today: statusMap.get(r.id)!,
    adherence: adherence.get(r.id) as AdherenceStats,
  }));

  if (filters.status && filters.status !== "all") list = list.filter((c) => c.status === filters.status);
  if (filters.goal && filters.goal !== "all") list = list.filter((c) => c.goal === filters.goal);
  if (filters.workout && filters.workout !== "all") list = list.filter((c) => c.today.workout === filters.workout);
  if (filters.nutrition && filters.nutrition !== "all") list = list.filter((c) => c.today.nutrition === filters.nutrition);
  if (filters.activity && filters.activity !== "all") {
    const age = (c: (typeof list)[number]) => (c.lastActivityAt ? now - c.lastActivityAt.getTime() : Infinity);
    const DAY = 86_400_000;
    list = list.filter((c) =>
      filters.activity === "24h"
        ? age(c) <= DAY
        : filters.activity === "7d"
          ? age(c) <= 7 * DAY
          : filters.activity === "stale"
            ? age(c) > 7 * DAY && c.lastActivityAt != null
            : c.lastActivityAt == null,
    );
  }

  const dir = filters.dir === "desc" ? -1 : 1;
  const nullsLast = (a: number | null | undefined, b: number | null | undefined) =>
    a == null && b == null ? 0 : a == null ? 1 : b == null ? -1 : (a - b) * dir;
  const sorters: Record<NonNullable<ClientListFilters["sort"]>, (a: (typeof list)[number], b: (typeof list)[number]) => number> = {
    name: (a, b) => a.fullName.localeCompare(b.fullName) * dir,
    status: (a, b) => a.status.localeCompare(b.status) * dir,
    goal: (a, b) => a.goal.localeCompare(b.goal) * dir,
    joined: (a, b) => (a.joinedOn < b.joinedOn ? -1 : a.joinedOn > b.joinedOn ? 1 : 0) * dir,
    lastActivity: (a, b) => nullsLast(a.lastActivityAt?.getTime(), b.lastActivityAt?.getTime()),
    weight: (a, b) => nullsLast(a.currentWeightKg, b.currentWeightKg),
    workoutAdherence: (a, b) => nullsLast(a.adherence.workoutAdherence, b.adherence.workoutAdherence),
    nutritionAdherence: (a, b) => nullsLast(a.adherence.mealRate, b.adherence.mealRate),
  };
  list.sort(sorters[filters.sort ?? "name"] ?? sorters.name);

  const pageSize = Math.min(Math.max(filters.pageSize ?? 12, 1), 100);
  const total = list.length;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(Math.max(filters.page ?? 1, 1), pages);
  return { prefs, today, total, page, pages, pageSize, clients: list.slice((page - 1) * pageSize, page * pageSize) };
}
export type ClientListItem = Awaited<ReturnType<typeof listClients>>["clients"][number];

/** Global search (coach only). Matches name, email, phone or client code. */
export async function searchClients(actor: Actor, query: string) {
  assertCoach(actor);
  const q = query.trim().slice(0, 100);
  if (q.length < 1) return [];
  const like = `%${q.replace(/[%_\\]/g, (c) => `\\${c}`)}%`;
  return db
    .select({
      id: clients.id,
      fullName: clients.fullName,
      email: users.email,
      phone: clients.phone,
      code: clients.code,
      status: clients.status,
      avatarKey: clients.avatarKey,
    })
    .from(clients)
    .innerJoin(users, eq(users.id, clients.userId))
    .where(
      and(
        eq(clients.coachId, actor.userId),
        or(ilike(clients.fullName, like), ilike(users.email, like), ilike(clients.phone, like), ilike(clients.code, like)),
      ),
    )
    .orderBy(desc(sql`${clients.fullName} ILIKE ${q + "%"}`), asc(clients.fullName))
    .limit(8);
}
