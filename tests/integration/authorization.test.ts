/**
 * Critical authorization & data-integrity suite (runs against a real PostgreSQL test database).
 * Mirrors the acceptance checklist: tenant isolation, set/meal logging, automatic timestamps,
 * plan edits vs. immutable history, per-client permissions and private photos.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { db } from "@/server/db";
import { mealLogs, siteSettings, users, workoutLogs, workoutSetLogs } from "@/server/db/schema";
import { ForbiddenError, NotFoundError, ValidationError } from "@/server/errors";
import type { Actor } from "@/server/auth/types";
import { authorizeClient } from "@/server/authz";
import { getClientProfile, listClients, resetClientPassword, updatePermissions } from "@/server/services/clients";
import { authenticate, changePassword } from "@/server/services/auth";
import { getAccessSettings, updateAccessCode } from "@/server/services/access";
import { getGateState, invalidateGateCache, verifyAccessCode } from "@/server/auth/gate";
import {
  completeWorkout,
  editWorkoutLog,
  ensureWorkoutLogForDate,
  getTodayWorkout,
  listWorkoutHistory,
  loadWorkoutLogTree,
  recordSet,
  saveWorkoutPlan,
  getWorkoutPlanForEditor,
} from "@/server/services/workouts";
import { getMealHistory, getTodayMeals, setMealConsumed } from "@/server/services/nutrition";
import { addMeasurements, getProgress, listMeasurementTypes } from "@/server/services/progress";
import { listPhotos, readPhoto, uploadProgressPhoto } from "@/server/services/photos";
import { getClientAnalytics } from "@/server/services/analytics";
import { DEFAULT_PERMISSIONS } from "@/lib/constants";
import { addDays, todayInTz } from "@/lib/time";
import { makeClient, makeCoach, pngFile, pushPlan, truncateAll, withPlans } from "./fixtures";

let coach: Actor;
let otherCoach: Actor;
let A: { id: string; actor: Actor };
let B: { id: string; actor: Actor };
let C: { id: string; actor: Actor }; // belongs to otherCoach
const today = () => todayInTz("UTC");

beforeEach(async () => {
  await truncateAll();
  coach = await makeCoach("Coach One");
  otherCoach = await makeCoach("Coach Two");
  A = await makeClient(coach, "Client A");
  B = await makeClient(coach, "Client B");
  C = await makeClient(otherCoach, "Client C");
  await withPlans(coach, A.id);
  await withPlans(coach, B.id);
});

async function firstSetId(clientActor: Actor) {
  const { log } = await getTodayWorkout(clientActor);
  return log!.exercises[0]!.sets;
}

describe("1 · coach access", () => {
  it("coach can access all of their own clients", async () => {
    const list = await listClients(coach, {});
    expect(list.clients.map((c) => c.fullName).sort()).toEqual(["Client A", "Client B"]);
    await expect(authorizeClient(coach, A.id)).resolves.toBeTruthy();
    await expect(authorizeClient(coach, B.id)).resolves.toBeTruthy();
    const profile = await getClientProfile(coach, A.id);
    expect(profile.client.coachNotes).toBe("PRIVATE COACH NOTE");
  });

  it("a coach cannot reach another coach's clients", async () => {
    await expect(getClientProfile(coach, C.id)).rejects.toBeInstanceOf(NotFoundError);
    await expect(getClientProfile(otherCoach, A.id)).rejects.toBeInstanceOf(NotFoundError);
    const list = await listClients(otherCoach, {});
    expect(list.clients.map((c) => c.fullName)).toEqual(["Client C"]);
  });
});

describe("2–3 · client isolation", () => {
  it("client A can access only client A data", async () => {
    const own = await getClientProfile(A.actor, A.id);
    expect(own.client.id).toBe(A.id);
    expect(own.client.coachNotes).toBeNull(); // private coach notes never reach the client
  });

  it("client A cannot read client B by swapping the id (profile, workouts, meals, progress, photos, analytics)", async () => {
    await expect(getClientProfile(A.actor, B.id)).rejects.toBeInstanceOf(NotFoundError);
    await expect(listWorkoutHistory(A.actor, B.id)).rejects.toBeInstanceOf(NotFoundError);
    await expect(getMealHistory(A.actor, B.id)).rejects.toBeInstanceOf(NotFoundError);
    await expect(getProgress(A.actor, B.id)).rejects.toBeInstanceOf(NotFoundError);
    await expect(listPhotos(A.actor, B.id)).rejects.toBeInstanceOf(NotFoundError);
    await expect(getClientAnalytics(A.actor, B.id)).rejects.toBeInstanceOf(NotFoundError);
    await expect(getClientProfile(A.actor, C.id)).rejects.toBeInstanceOf(NotFoundError);
    await expect(getClientProfile(A.actor, "not-a-uuid")).rejects.toBeInstanceOf(NotFoundError);
  });

  it("client A cannot write to client B's set or meal records via forged ids", async () => {
    const bSets = await firstSetId(B.actor);
    const bMeals = await getTodayMeals(B.actor);
    await expect(recordSet(A.actor, bSets[0]!.id, { done: true })).rejects.toBeInstanceOf(NotFoundError);
    await expect(setMealConsumed(A.actor, bMeals.logs[0]!.id, true)).rejects.toBeInstanceOf(NotFoundError);
    const [row] = await db.select().from(workoutSetLogs).where(eq(workoutSetLogs.id, bSets[0]!.id));
    expect(row!.status).toBe("pending");
    const [meal] = await db.select().from(mealLogs).where(eq(mealLogs.id, bMeals.logs[0]!.id));
    expect(meal!.status).toBe("pending");
  });

  it("clients cannot use coach-only operations, even on themselves", async () => {
    await expect(saveWorkoutPlan(A.actor, A.id, pushPlan(1))).rejects.toBeInstanceOf(ForbiddenError);
    await expect(getWorkoutPlanForEditor(A.actor, A.id)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(
      updatePermissions(A.actor, A.id, {
        ...DEFAULT_PERMISSIONS,
        uploadPhotos: true,
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);
    const types = await listMeasurementTypes(coach.userId);
    await expect(
      addMeasurements(A.actor, A.id, {
        measuredOn: today(),
        note: null,
        values: [{ typeId: types[0]!.id, value: 70 }],
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);
    await expect(listClients(A.actor, {})).rejects.toBeInstanceOf(ForbiddenError);
  });
});

describe("4–5 · set logging", () => {
  it("client A can complete a workout set (full reps)", async () => {
    const sets = await firstSetId(A.actor);
    const res = await recordSet(A.actor, sets[0]!.id, { done: true });
    expect(res.set.status).toBe("completed");
    expect(res.set.actualReps).toBe(12);
    expect(res.set.completedAt).not.toBeNull();
  });

  it("client A can enter actual reps lower than the target (partial set)", async () => {
    const sets = await firstSetId(A.actor);
    const res = await recordSet(A.actor, sets[1]!.id, {
      done: true,
      actualReps: 8,
    });
    expect(res.set.status).toBe("partial");
    const [row] = await db.select().from(workoutSetLogs).where(eq(workoutSetLogs.id, sets[1]!.id));
    expect(row).toMatchObject({
      targetReps: 12,
      actualReps: 8,
      status: "partial",
    });
    expect(row!.completedAt).toBeInstanceOf(Date);
    expect(res.summary.percent).toBeCloseTo((8 / 36) * 100, 1);
  });

  it("completing the workout records a server timestamp and completion %", async () => {
    const sets = await firstSetId(A.actor);
    await recordSet(A.actor, sets[0]!.id, { done: true });
    await recordSet(A.actor, sets[1]!.id, { done: true });
    await recordSet(A.actor, sets[2]!.id, { done: true, actualReps: 9 });
    const before = Date.now();
    const done = await completeWorkout(A.actor);
    const after = Date.now();
    const at = new Date(done.completedAt).getTime();
    expect(at).toBeGreaterThanOrEqual(before - 2000);
    expect(at).toBeLessThanOrEqual(after + 2000);
    expect(done.completionPercent).toBeCloseTo((33 / 36) * 100, 1); // 12 + 12 + 9 of 36
    await expect(recordSet(A.actor, sets[0]!.id, { done: false })).rejects.toThrow(/already completed/);
    const history = await listWorkoutHistory(coach, A.id);
    expect(history.logs[0]!.completedAt?.toISOString()).toBe(done.completedAt);
  });
});

describe("6–8 · meals & automatic timestamps", () => {
  it("meal completion stores the exact server timestamp and the coach can see it", async () => {
    const { logs } = await getTodayMeals(A.actor);
    const before = Date.now();
    const res = await setMealConsumed(A.actor, logs[0]!.id, true);
    const after = Date.now();
    const consumed = new Date(res.consumedAt!).getTime();
    expect(res.status).toBe("completed");
    expect(consumed).toBeGreaterThanOrEqual(before - 2000);
    expect(consumed).toBeLessThanOrEqual(after + 2000);

    const history = await getMealHistory(coach, A.id);
    const todayGroup = history.groups.find((g) => g.date === today())!;
    const breakfast = todayGroup.logs.find((l) => l.mealName === "Breakfast")!;
    expect(breakfast.consumedAt?.toISOString()).toBe(res.consumedAt);
    expect(breakfast.scheduledTime).toBe("08:00:00");
    expect(todayGroup.completed).toBe(1);
    expect(todayGroup.total).toBe(2);
    expect(todayGroup.adherence).toBe(50);
  });

  it("undoing a meal clears the timestamp; past days are read-only for clients", async () => {
    const { logs } = await getTodayMeals(A.actor);
    await setMealConsumed(A.actor, logs[0]!.id, true);
    const undone = await setMealConsumed(A.actor, logs[0]!.id, false);
    expect(undone.consumedAt).toBeNull();
    await db
      .update(mealLogs)
      .set({ date: addDays(today(), -1) })
      .where(eq(mealLogs.id, logs[1]!.id));
    await expect(setMealConsumed(A.actor, logs[1]!.id, true)).rejects.toBeInstanceOf(ForbiddenError);
  });
});

describe("9–10 · plan edits never rewrite history", () => {
  it("coach changes targets 12 → 10: today's recorded workout keeps 12/12/10, future days use 10", async () => {
    const sets = await firstSetId(A.actor);
    await recordSet(A.actor, sets[0]!.id, { done: true });
    await recordSet(A.actor, sets[1]!.id, { done: true });
    await recordSet(A.actor, sets[2]!.id, { done: true, actualReps: 10 });
    await completeWorkout(A.actor);

    // Tomorrow materialised before the edit (untouched → will follow the new plan).
    const tomorrow = addDays(today(), 1);
    await ensureWorkoutLogForDate(A.id, tomorrow);

    const editor = await getWorkoutPlanForEditor(coach, A.id);
    await saveWorkoutPlan(coach, A.id, pushPlan(10, editor.plan!.workouts[0]!.id));

    const [todayLog] = await db
      .select()
      .from(workoutLogs)
      .where(and(eq(workoutLogs.clientId, A.id), eq(workoutLogs.date, today())));
    const tree = await loadWorkoutLogTree(todayLog!.id);
    const recorded = tree!.exercises[0]!.sets;
    expect(recorded.map((s) => s.targetReps)).toEqual([12, 12, 12]);
    expect(recorded.map((s) => s.actualReps)).toEqual([12, 12, 10]);
    expect(todayLog!.status).toBe("completed");

    const tomorrowId = await ensureWorkoutLogForDate(A.id, tomorrow);
    const next = await loadWorkoutLogTree(tomorrowId!);
    expect(next!.exercises[0]!.sets.map((s) => s.targetReps)).toEqual([10, 10, 10]);

    const plan = await getWorkoutPlanForEditor(coach, A.id);
    expect(plan.plan!.workouts[0]!.exercises[0]!.sets.map((s) => s.targetReps)).toEqual([10, 10, 10]);
  });

  it("deleting a workout from the plan keeps the historical record", async () => {
    const sets = await firstSetId(A.actor);
    await recordSet(A.actor, sets[0]!.id, { done: true });
    await saveWorkoutPlan(coach, A.id, {
      name: "Empty",
      notes: null,
      workouts: [],
      schedule: Array(7).fill(null),
    });
    const history = await listWorkoutHistory(coach, A.id);
    expect(history.logs).toHaveLength(1);
    expect(history.logs[0]!.title).toBe("PUSH");
    expect(history.logs[0]!.exercises[0]!.sets[0]!.actualReps).toBe(12);
  });

  it("coach can correct a recorded workout; the edit is flagged", async () => {
    const sets = await firstSetId(A.actor);
    await recordSet(A.actor, sets[0]!.id, { done: true });
    const [log] = await db.select().from(workoutLogs).where(eq(workoutLogs.clientId, A.id));
    await editWorkoutLog(coach, A.id, log!.id, {
      coachNote: "Form check",
      sets: [{ id: sets[0]!.id, actualReps: 7, status: "partial" }],
    });
    const [after] = await db.select().from(workoutLogs).where(eq(workoutLogs.id, log!.id));
    expect(after!.coachEditedAt).not.toBeNull();
    expect(after!.coachNote).toBe("Form check");
    await expect(editWorkoutLog(A.actor, A.id, log!.id, { coachNote: null, sets: [] })).rejects.toBeInstanceOf(ForbiddenError);
    await expect(editWorkoutLog(otherCoach, A.id, log!.id, { coachNote: null, sets: [] })).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("11 · per-client permissions", () => {
  it("enterActualReps OFF: partial reps are rejected server-side, full sets still work", async () => {
    await updatePermissions(coach, A.id, {
      ...DEFAULT_PERMISSIONS,
      enterActualReps: false,
    });
    const sets = await firstSetId(A.actor);
    await expect(recordSet(A.actor, sets[0]!.id, { done: true, actualReps: 5 })).rejects.toBeInstanceOf(ForbiddenError);
    const ok = await recordSet(A.actor, sets[0]!.id, { done: true });
    expect(ok.set.actualReps).toBe(12);
  });

  it("completeWorkouts / completeMeals / viewNutrition / viewWorkouts OFF are enforced", async () => {
    const sets = await firstSetId(A.actor);
    const { logs } = await getTodayMeals(A.actor);
    await updatePermissions(coach, A.id, {
      ...DEFAULT_PERMISSIONS,
      completeWorkouts: false,
      completeMeals: false,
    });
    await expect(recordSet(A.actor, sets[0]!.id, { done: true })).rejects.toBeInstanceOf(ForbiddenError);
    await expect(completeWorkout(A.actor)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(setMealConsumed(A.actor, logs[0]!.id, true)).rejects.toBeInstanceOf(ForbiddenError);

    await updatePermissions(coach, A.id, {
      ...DEFAULT_PERMISSIONS,
      viewNutrition: false,
      viewWorkouts: false,
    });
    await expect(getTodayMeals(A.actor)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(getTodayWorkout(A.actor)).rejects.toBeInstanceOf(ForbiddenError);
    // …but the coach is never restricted by client permissions.
    await expect(listWorkoutHistory(coach, A.id)).resolves.toBeTruthy();
  });

  it("permissions never widen access: enabling everything still can't reach client B", async () => {
    await updatePermissions(coach, A.id, Object.fromEntries(Object.keys(DEFAULT_PERMISSIONS).map((k) => [k, true])) as typeof DEFAULT_PERMISSIONS);
    await expect(getProgress(A.actor, B.id)).rejects.toBeInstanceOf(NotFoundError);
    await expect(
      uploadProgressPhoto(A.actor, B.id, await pngFile(), {
        phase: "after",
        angle: "front",
        takenOn: today(),
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("12 · private progress photos", () => {
  it("only the owning coach and the client (with permission) can read a photo", async () => {
    const { id: photoId } = await uploadProgressPhoto(coach, B.id, await pngFile(), { phase: "after", angle: "front", takenOn: today() });

    await expect(readPhoto(coach, photoId, "thumb")).resolves.toMatchObject({
      mimeType: "image/webp",
    });
    await expect(readPhoto(B.actor, photoId, "full")).resolves.toMatchObject({
      mimeType: "image/webp",
    });
    await expect(readPhoto(A.actor, photoId, "full")).rejects.toBeInstanceOf(NotFoundError);
    await expect(readPhoto(otherCoach, photoId, "full")).rejects.toBeInstanceOf(NotFoundError);

    await updatePermissions(coach, B.id, {
      ...DEFAULT_PERMISSIONS,
      viewPhotos: false,
    });
    await expect(readPhoto(B.actor, photoId, "full")).rejects.toBeInstanceOf(ForbiddenError);
    await expect(listPhotos(B.actor, B.id)).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("keeps each photo's before/after stage and type (incl. InBody)", async () => {
    await uploadProgressPhoto(coach, A.id, await pngFile(), { phase: "before", angle: "inbody", takenOn: today() });
    await uploadProgressPhoto(coach, A.id, await pngFile(), { phase: "after", angle: "side", takenOn: today() });
    const list = await listPhotos(coach, A.id);
    expect(list.map((p) => `${p.phase}:${p.angle}`).sort()).toEqual(expect.arrayContaining(["after:side", "before:inbody"]));
  });

  it("clients can't upload unless allowed, and uploads are validated by decoding", async () => {
    await expect(
      uploadProgressPhoto(A.actor, A.id, await pngFile(), {
        phase: "after",
        angle: "front",
        takenOn: today(),
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);
    await updatePermissions(coach, A.id, {
      ...DEFAULT_PERMISSIONS,
      uploadPhotos: true,
    });
    await expect(
      uploadProgressPhoto(A.actor, A.id, await pngFile(), {
        phase: "after",
        angle: "side",
        takenOn: today(),
      }),
    ).resolves.toHaveProperty("id");
    const fake = new File([new TextEncoder().encode("<script>alert(1)</script>")], "evil.png", { type: "image/png" });
    await expect(
      uploadProgressPhoto(coach, A.id, fake, {
        phase: "after",
        angle: "front",
        takenOn: today(),
      }),
    ).rejects.toThrow(/valid image/);
  });
});

describe("measurements & analytics are computed from stored data", () => {
  it("adds measurements (history kept), updates current weight and derives BMI", async () => {
    const types = await listMeasurementTypes(coach.userId);
    const weight = types.find((t) => t.key === "weight")!;
    await addMeasurements(coach, A.id, {
      measuredOn: addDays(today(), -7),
      note: null,
      values: [{ typeId: weight.id, value: 79 }],
    });
    await addMeasurements(coach, A.id, {
      measuredOn: today(),
      note: "am",
      values: [{ typeId: weight.id, value: 77.5 }],
    });
    const p = await getProgress(coach, A.id);
    expect(p.summary.currentWeightKg).toBe(77.5);
    expect(p.summary.changeKg).toBe(-2.5);
    expect(p.series[weight.id]!.map((x) => x.value)).toEqual([79, 80, 77.5]); // chronological: 7 days ago, start (today), today
    expect(p.summary.bmi).toBeCloseTo(23.9, 1);
  });
});

describe("13 · coach-controlled passwords", () => {
  it("only the client's own coach can set their password; other coaches and clients can't", async () => {
    await expect(resetClientPassword(otherCoach, A.id, "set", { password: "Hijack!2026" })).rejects.toBeInstanceOf(NotFoundError);
    await expect(resetClientPassword(A.actor, A.id, "set", { password: "Hijack!2026" })).rejects.toBeInstanceOf(ForbiddenError);
    await expect(resetClientPassword(B.actor, A.id, "link")).rejects.toBeInstanceOf(ForbiddenError);

    const res = await resetClientPassword(coach, A.id, "set", {
      password: "CoachSet!2026",
    });
    expect(res).toEqual({}); // a typed password is never echoed back
    await expect(authenticate(A.actor.email, "CoachSet!2026", null)).resolves.toHaveProperty("id", A.actor.userId);
    await expect(authenticate(A.actor.email, "ClientPass!123", null)).rejects.toThrow();
    const [u] = await db.select().from(users).where(eq(users.id, A.actor.userId));
    expect(u!.mustChangePassword).toBe(false);

    const generated = await resetClientPassword(coach, A.id, "set", {});
    expect(generated.generatedPassword).toMatch(/^[A-Za-z0-9]{4}-[A-Za-z0-9]{4}-[A-Za-z0-9]{4}$/);
  });

  it("a client can't change the coach-issued password unless the coach allows it", async () => {
    await expect(changePassword(A.actor, "ClientPass!123", "Mine!2026xx")).rejects.toBeInstanceOf(ForbiddenError);
    await updatePermissions(coach, A.id, {
      ...DEFAULT_PERMISSIONS,
      changeOwnPassword: true,
    });
    await expect(changePassword(A.actor, "ClientPass!123", "Mine!2026xx")).resolves.toBeTruthy();
  });

  it("'ask to choose own password' lets the client set one at first sign-in even without the permission", async () => {
    await resetClientPassword(coach, B.id, "set", {
      password: "Temp!2026xx",
      forcePasswordChange: true,
    });
    const [u] = await db.select().from(users).where(eq(users.id, B.actor.userId));
    expect(u!.mustChangePassword).toBe(true);
    await expect(changePassword({ ...B.actor, mustChangePassword: true }, undefined, "Chosen!2026x")).resolves.toBeTruthy();
    await expect(authenticate(B.actor.email, "Chosen!2026x", null)).resolves.toHaveProperty("mustChangePassword", false);
  });
});

describe("14 · site access code", () => {
  it("only a coach can view or change the access code; it is stored encrypted and compared loosely", async () => {
    await expect(getAccessSettings(A.actor)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(updateAccessCode(A.actor, "CLIENT-CODE")).rejects.toBeInstanceOf(ForbiddenError);
    await expect(updateAccessCode(coach, "abc")).rejects.toBeInstanceOf(ValidationError);

    await updateAccessCode(coach, "Ayman-2026");
    const [row] = await db.select().from(siteSettings);
    expect(row!.accessCodeEnc).toBeTruthy();
    expect(row!.accessCodeEnc).not.toContain("Ayman");
    await expect(getAccessSettings(coach)).resolves.toEqual({
      enabled: true,
      code: "Ayman-2026",
    });
    await expect(verifyAccessCode("ayman 2026")).resolves.toBe(true);
    await expect(verifyAccessCode("AYMAN-2025")).resolves.toBe(false);
  });

  it("changing the code rotates the version (revoking every existing device); turning it off opens the gate", async () => {
    await updateAccessCode(coach, "FIRST-CODE-1");
    const v1 = (await getGateState(true)).version;
    await updateAccessCode(coach, "SECOND-CODE-2");
    invalidateGateCache();
    const s2 = await getGateState(true);
    expect(s2.version).not.toBe(v1);
    await expect(verifyAccessCode("FIRST-CODE-1")).resolves.toBe(false);
    await updateAccessCode(coach, null);
    const s3 = await getGateState(true);
    expect(s3.enabled).toBe(false);
    expect(s3.version).not.toBe(s2.version);
  });
});
