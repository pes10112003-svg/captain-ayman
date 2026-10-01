import { readFileSync, readdirSync } from "node:fs";
import { sql } from "drizzle-orm";
import sharp from "sharp";
import { db } from "@/server/db";
import { coachSettings, users } from "@/server/db/schema";
import { hashPassword } from "@/server/auth/password";
import type { Actor } from "@/server/auth/types";
import { createClient } from "@/server/services/clients";
import { saveNutritionPlan } from "@/server/services/nutrition";
import { saveWorkoutPlan } from "@/server/services/workouts";
import type { NutritionPlanInput, WorkoutPlanInput } from "@/lib/validation";

let n = 0;

const systemTypesSql = readdirSync("drizzle")
  .filter((f) => f.includes("system_measurement_types"))
  .map((f) => readFileSync(`drizzle/${f}`, "utf8"))
  .join("\n");

export async function truncateAll() {
  // TRUNCATE … CASCADE also empties measurement_types (FK to users) — restore the built-ins.
  await db.execute(sql`TRUNCATE users, rate_limits, measurement_types RESTART IDENTITY CASCADE`);
  await db.execute(sql.raw(systemTypesSql));
}

export async function makeCoach(name = "Coach"): Promise<Actor> {
  const email = `coach${++n}@test.local`;
  const [u] = await db.insert(users).values({ email, name, role: "coach", passwordHash: await hashPassword("CoachPass!123") }).returning();
  await db.insert(coachSettings).values({ coachId: u!.id, timezone: "UTC" });
  return { sessionId: crypto.randomUUID(), userId: u!.id, role: "coach", name, email, clientId: null, coachId: u!.id, mustChangePassword: false };
}

export async function makeClient(coach: Actor, fullName: string): Promise<{ id: string; actor: Actor }> {
  const email = `client${++n}@test.local`;
  const { client } = await createClient(coach, {
    fullName,
    email,
    phone: null,
    dateOfBirth: null,
    gender: "unspecified",
    height: 180,
    startingWeight: 80,
    goalWeight: 75,
    goal: "fat_loss",
    goalNote: null,
    coachNotes: "PRIVATE COACH NOTE",
    status: "active",
    password: "ClientPass!123",
  });
  return {
    id: client.id,
    actor: { sessionId: crypto.randomUUID(), userId: client.userId, role: "client", name: fullName, email, clientId: client.id, coachId: coach.userId, mustChangePassword: false },
  };
}

/** Every day of the week trains PUSH: Bench Press 3 × `reps` @ 40 kg. */
export function pushPlan(reps = 12, workoutId?: string): WorkoutPlanInput {
  return {
    name: "Test plan",
    notes: null,
    schedule: Array(7).fill("push"),
    workouts: [
      {
        id: workoutId ?? null,
        key: "push",
        title: "PUSH",
        muscleGroup: "Chest",
        instructions: null,
        exercises: [
          { name: "Bench Press", restSeconds: 90, tempo: null, notes: null, videoUrl: null, sets: [0, 1, 2].map(() => ({ targetReps: reps, targetWeight: 40 })) },
        ],
      },
    ],
  };
}

export const mealPlan: NutritionPlanInput = {
  name: "Meals",
  notes: null,
  meals: [
    { id: null, name: "Breakfast", time: "08:00", notes: null, referenceUrl: null, items: [{ name: "Eggs", quantity: "3", calories: 215, protein: 19, carbs: 1, fats: 15 }] },
    { id: null, name: "Lunch", time: "14:00", notes: null, referenceUrl: null, items: [{ name: "Chicken", quantity: "200 g", calories: 330, protein: 62, carbs: 0, fats: 7 }] },
  ],
};

export async function withPlans(coach: Actor, clientId: string) {
  await saveWorkoutPlan(coach, clientId, pushPlan(12));
  await saveNutritionPlan(coach, clientId, mealPlan);
}

export async function pngFile(name = "photo.png") {
  const buf = await sharp({ create: { width: 64, height: 96, channels: 3, background: { r: 120, g: 140, b: 160 } } }).png().toBuffer();
  return new File([new Uint8Array(buf)], name, { type: "image/png" });
}
