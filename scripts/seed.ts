/**
 * Development / demo seed.
 *
 * Creates one coach, seven clients and ~8 weeks of realistic history (workout snapshots with
 * partial reps, meals with server-style timestamps, weekly measurements, progress photos and an
 * activity trail). All data is fictional. Safe to delete: `npm run db:reset`.
 *
 *   npm run db:seed            # refuses to run if the seed coach already exists
 *   npm run db:reset           # drop schema → migrate → seed (dev only)
 */
import "dotenv/config";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { eq, isNull, sql } from "drizzle-orm";
import { db, pool } from "@/server/db";
import * as s from "@/server/db/schema";
import { hashPassword } from "@/server/auth/password";
import { storage } from "@/server/storage";
import { generateClientCode } from "@/server/services/clients";
import { addDays, dayOfWeek, diffDays, startOfWeek, todayInTz, zonedParts } from "@/lib/time";
import { planWeek } from "@/server/services/workouts";
import { bmi } from "@/lib/units";
import { FIXED_COACH_SETTINGS } from "@/lib/validation";
import { encrypt } from "@/server/crypto";

if (process.env.NODE_ENV === "production" && process.env.ALLOW_PROD_SEED !== "true") {
  console.error("Refusing to seed demo data in production (set ALLOW_PROD_SEED=true to override).");
  process.exit(1);
}

const TZ = FIXED_COACH_SETTINGS.timezone; // the app is fixed to Egypt time
const COACH_EMAIL = (process.env.SEED_COACH_EMAIL ?? "coach@kinetic.test").toLowerCase();
const COACH_PASSWORD = process.env.SEED_COACH_PASSWORD ?? "CoachDemo!2026";
const CLIENT_PASSWORD = process.env.SEED_CLIENT_PASSWORD ?? "ClientDemo!2026";
/** Demo site access code (visitors enter it once per device). Set SEED_ACCESS_CODE="" to leave the site open. */
const ACCESS_CODE = process.env.SEED_ACCESS_CODE ?? "AYMAN-2026";

/* ── deterministic randomness ─────────────────────────────── */
let seed = 20261001;
const rand = () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
};
const chance = (p: number) => rand() < p;
const between = (a: number, b: number) => a + rand() * (b - a);
const int = (a: number, b: number) => Math.floor(between(a, b + 1));
const gauss = () => (rand() + rand() + rand() - 1.5) / 1.5;

const NOW = Date.now();
/** Local wall-clock time in TZ → UTC instant (never later than "now": demo data can't be in the future). */
function localToUtc(date: string, minutes: number) {
  const t = rawLocalToUtc(date, minutes);
  return t.getTime() > NOW - 60_000 ? new Date(NOW - 60_000 - Math.floor(rand() * 600_000)) : t;
}
function rawLocalToUtc(date: string, minutes: number) {
  const [y, m, d] = date.split("-").map(Number);
  const guess = Date.UTC(y!, m! - 1, d!, Math.floor(minutes / 60), minutes % 60);
  let t = guess;
  for (let i = 0; i < 2; i++) {
    const p = zonedParts(new Date(t), TZ);
    const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute);
    t = guess - (asUtc - t);
  }
  return new Date(t);
}

/* ── plan templates ─────────────────────────────────────────── */
type Ex = {
  name: string;
  sets: number;
  reps: number;
  kg: number | null;
  rest?: number;
  tempo?: string;
  notes?: string;
  video?: string;
};
type WorkoutT = {
  title: string;
  muscle: string;
  instructions?: string;
  ex: Ex[];
};

const PUSH: WorkoutT = {
  title: "PUSH",
  muscle: "Chest, shoulders & triceps",
  instructions: "Warm up 8–10 min (bike + band pull-aparts). Two ramp-up sets before bench press.",
  ex: [
    {
      name: "Bench Press",
      sets: 3,
      reps: 12,
      kg: 40,
      rest: 120,
      tempo: "3-1-1-0",
      notes: "Shoulder blades pinned, feet planted.",
      video: "https://www.youtube.com/results?search_query=bench+press+form",
    },
    { name: "Incline Dumbbell Press", sets: 3, reps: 10, kg: 18, rest: 90 },
    { name: "Seated Overhead Press", sets: 3, reps: 10, kg: 30, rest: 90 },
    { name: "Cable Lateral Raise", sets: 3, reps: 15, kg: 7.5, rest: 60 },
    { name: "Triceps Rope Pushdown", sets: 3, reps: 12, kg: 25, rest: 60 },
  ],
};
const PULL: WorkoutT = {
  title: "PULL",
  muscle: "Back & biceps",
  ex: [
    {
      name: "Conventional Deadlift",
      sets: 3,
      reps: 5,
      kg: 90,
      rest: 180,
      notes: "Brace hard, bar close to shins.",
    },
    { name: "Lat Pulldown", sets: 3, reps: 12, kg: 50, rest: 90 },
    { name: "Seated Cable Row", sets: 3, reps: 12, kg: 45, rest: 90 },
    { name: "Face Pull", sets: 3, reps: 15, kg: 15, rest: 60 },
    { name: "EZ-Bar Curl", sets: 3, reps: 10, kg: 25, rest: 60 },
  ],
};
const LEGS: WorkoutT = {
  title: "LEGS",
  muscle: "Quads, hamstrings & glutes",
  instructions: "Mobility first: 5 min hips & ankles. Depth before load on squats.",
  ex: [
    {
      name: "Back Squat",
      sets: 4,
      reps: 8,
      kg: 70,
      rest: 150,
      tempo: "3-0-1-0",
    },
    { name: "Romanian Deadlift", sets: 3, reps: 10, kg: 60, rest: 120 },
    { name: "Leg Press", sets: 3, reps: 12, kg: 140, rest: 90 },
    {
      name: "Walking Lunge",
      sets: 3,
      reps: 12,
      kg: 14,
      rest: 90,
      notes: "12 steps per leg.",
    },
    { name: "Standing Calf Raise", sets: 4, reps: 15, kg: 40, rest: 45 },
  ],
};
const FULL_A: WorkoutT = {
  title: "FULL BODY A",
  muscle: "Full body",
  ex: [
    { name: "Goblet Squat", sets: 3, reps: 12, kg: 16, rest: 90 },
    { name: "Barbell Hip Thrust", sets: 3, reps: 12, kg: 50, rest: 90 },
    { name: "Dumbbell Bench Press", sets: 3, reps: 10, kg: 12, rest: 90 },
    { name: "Single-Arm Dumbbell Row", sets: 3, reps: 12, kg: 14, rest: 60 },
    { name: "Dead Bug", sets: 3, reps: 12, kg: null, rest: 45 },
  ],
};
const FULL_B: WorkoutT = {
  title: "FULL BODY B",
  muscle: "Full body",
  ex: [
    { name: "Trap Bar Deadlift", sets: 3, reps: 8, kg: 60, rest: 120 },
    { name: "Reverse Lunge", sets: 3, reps: 10, kg: 10, rest: 90 },
    { name: "Assisted Pull-up", sets: 3, reps: 8, kg: null, rest: 90 },
    { name: "Arnold Press", sets: 3, reps: 10, kg: 10, rest: 60 },
    { name: "Cable Glute Kickback", sets: 3, reps: 15, kg: 10, rest: 45 },
  ],
};
const UPPER: WorkoutT = {
  title: "UPPER",
  muscle: "Upper body",
  ex: [
    { name: "Bench Press", sets: 4, reps: 6, kg: 70, rest: 150 },
    { name: "Weighted Pull-up", sets: 4, reps: 6, kg: 10, rest: 150 },
    { name: "Dumbbell Shoulder Press", sets: 3, reps: 10, kg: 22, rest: 90 },
    { name: "Chest-Supported Row", sets: 3, reps: 10, kg: 26, rest: 90 },
  ],
};
const LOWER: WorkoutT = {
  title: "LOWER",
  muscle: "Lower body",
  ex: [
    { name: "Back Squat", sets: 4, reps: 6, kg: 100, rest: 180 },
    { name: "Romanian Deadlift", sets: 3, reps: 8, kg: 90, rest: 120 },
    { name: "Bulgarian Split Squat", sets: 3, reps: 10, kg: 20, rest: 90 },
    { name: "Seated Leg Curl", sets: 3, reps: 12, kg: 40, rest: 60 },
  ],
};

type Item = [name: string, qty: string, kcal: number, p: number, c: number, f: number];
type MealT = { name: string; time: string; items: Item[]; notes?: string };
const MEALS_STANDARD: MealT[] = [
  {
    name: "Breakfast",
    time: "08:00",
    items: [
      ["Eggs", "3 whole", 215, 19, 1, 15],
      ["Whole-wheat bread", "2 slices", 160, 8, 28, 2],
      ["Feta cheese", "30 g", 80, 4, 1, 6],
      ["Cucumber & tomato", "1 bowl", 35, 1, 7, 0],
    ],
  },
  {
    name: "Snack",
    time: "11:00",
    items: [
      ["Greek yogurt", "170 g", 100, 17, 6, 0],
      ["Banana", "1 medium", 105, 1, 27, 0],
    ],
  },
  {
    name: "Lunch",
    time: "14:00",
    items: [
      ["Grilled chicken breast", "200 g", 330, 62, 0, 7],
      ["Basmati rice (cooked)", "150 g", 195, 4, 42, 0],
      ["Green salad + olive oil", "1 bowl", 90, 1, 5, 7],
    ],
    notes: "Swap rice for sweet potato on rest days.",
  },
  {
    name: "Dinner",
    time: "20:00",
    items: [
      ["Tuna in water", "1 can", 120, 26, 0, 1],
      ["Ful medames", "150 g", 165, 11, 26, 2],
      ["Baladi bread", "½ loaf", 140, 5, 28, 1],
    ],
  },
];
const MEALS_CUT: MealT[] = [
  {
    name: "Breakfast",
    time: "07:30",
    items: [
      ["Oats", "50 g", 190, 7, 33, 3],
      ["Whey protein", "1 scoop", 120, 24, 3, 1],
      ["Blueberries", "80 g", 45, 1, 11, 0],
    ],
  },
  {
    name: "Lunch",
    time: "13:30",
    items: [
      ["Grilled salmon", "150 g", 280, 34, 0, 16],
      ["Quinoa (cooked)", "120 g", 145, 5, 26, 2],
      ["Roasted vegetables", "1 cup", 70, 2, 12, 2],
    ],
  },
  {
    name: "Snack",
    time: "16:30",
    items: [
      ["Cottage cheese", "150 g", 120, 17, 5, 3],
      ["Apple", "1 medium", 95, 0, 25, 0],
    ],
  },
  {
    name: "Dinner",
    time: "20:00",
    items: [
      ["Chicken breast", "150 g", 250, 46, 0, 5],
      ["Mixed salad", "1 large bowl", 60, 2, 10, 1],
      ["Avocado", "½", 120, 1, 6, 11],
    ],
  },
];
const MEALS_BULK: MealT[] = [
  ...MEALS_STANDARD.slice(0, 3),
  {
    name: "Pre-workout",
    time: "17:00",
    items: [
      ["Peanut butter toast", "2 slices", 380, 14, 36, 19],
      ["Dates", "4 pieces", 110, 1, 30, 0],
    ],
  },
  MEALS_STANDARD[3]!,
];

/* ── clients ────────────────────────────────────────────────── */
type ClientSeed = {
  name: string;
  email: string;
  phone: string;
  dob: string;
  gender: "male" | "female";
  heightCm: number;
  startKg: number;
  goalKg: number;
  goal: (typeof s.fitnessGoal.enumValues)[number];
  goalNote: string;
  notes?: string;
  daysAgo: number;
  status?: "active" | "inactive";
  mustChange?: boolean;
  /** Relative weekly schedule: index 0 = the day the seed runs ("today"), 1 = tomorrow, … */
  schedule: (WorkoutT | null)[];
  meals: MealT[] | null;
  adherence: {
    workout: number;
    meal: number;
    bf?: [number, number];
    mm?: [number, number];
  };
  today?: { workout: "completed" | "partial" | "none"; meals: number };
  perms?: Partial<import("@/lib/constants").Permissions>;
  photos?: boolean;
};

const CLIENTS: ClientSeed[] = [
  {
    name: "Omar Hassan",
    email: "omar@kinetic.test",
    phone: "+20 100 555 0101",
    dob: "1996-04-12",
    gender: "male",
    heightCm: 178,
    startKg: 86.4,
    goalKg: 78,
    goal: "fat_loss",
    goalNote: "Get under 80 kg and see abs by summer.",
    notes: "Desk job, trains after work (6–8 PM). Mild left-knee discomfort on deep lunges — keep ROM controlled.",
    daysAgo: 58,
    schedule: [PUSH, null, PULL, null, LEGS, UPPER, null],
    meals: MEALS_STANDARD,
    adherence: {
      workout: 0.86,
      meal: 0.84,
      bf: [24.5, 20.8],
      mm: [34.2, 35.0],
    },
    today: { workout: "partial", meals: 2 },
    photos: true,
  },
  {
    name: "Mariam Adel",
    email: "mariam@kinetic.test",
    phone: "+20 111 555 0202",
    dob: "1999-09-03",
    gender: "female",
    heightCm: 164,
    startKg: 63.5,
    goalKg: 60,
    goal: "recomposition",
    goalNote: "Stronger glutes & first unassisted pull-up.",
    daysAgo: 56,
    schedule: [FULL_A, null, FULL_B, null, FULL_A, null, null],
    meals: MEALS_CUT,
    adherence: {
      workout: 0.95,
      meal: 0.92,
      bf: [28.0, 24.9],
      mm: [24.1, 25.3],
    },
    today: { workout: "completed", meals: 3 },
    perms: { uploadPhotos: true, editPersonalInfo: true },
    photos: true,
  },
  {
    name: "Youssef Tarek",
    email: "youssef@kinetic.test",
    phone: "+20 122 555 0303",
    dob: "1992-01-21",
    gender: "male",
    heightCm: 183,
    startKg: 79,
    goalKg: 85,
    goal: "muscle_gain",
    goalNote: "Lean bulk to 85 kg, 140 kg squat.",
    daysAgo: 55,
    schedule: [UPPER, LOWER, null, UPPER, LOWER, null, null],
    meals: MEALS_BULK,
    adherence: { workout: 0.74, meal: 0.7, bf: [15.2, 15.8], mm: [38.5, 40.1] },
    today: { workout: "none", meals: 1 },
    perms: { enterActualReps: false },
  },
  {
    name: "Nour El-Sayed",
    email: "nour@kinetic.test",
    phone: "+20 106 555 0404",
    dob: "2001-06-30",
    gender: "female",
    heightCm: 170,
    startKg: 72,
    goalKg: 65,
    goal: "fat_loss",
    goalNote: "Feel confident for my wedding in March.",
    daysAgo: 44,
    schedule: [LEGS, null, PUSH, null, PULL, null, null],
    meals: MEALS_CUT,
    adherence: { workout: 0.8, meal: 0.88, bf: [31.0, 28.6] },
    today: { workout: "none", meals: 2 },
  },
  {
    name: "Karim Mostafa",
    email: "karim@kinetic.test",
    phone: "+20 109 555 0505",
    dob: "1988-11-15",
    gender: "male",
    heightCm: 175,
    startKg: 94,
    goalKg: 85,
    goal: "general_fitness",
    goalNote: "Move better, lower blood pressure, more energy.",
    notes: "Travels for work every other week — keep sessions under 50 min.",
    daysAgo: 30,
    schedule: [null, FULL_A, null, FULL_B, null, null, null],
    meals: null,
    adherence: { workout: 0.55, meal: 0 },
    today: { workout: "none", meals: 0 },
  },
  {
    name: "Salma Farouk",
    email: "salma@kinetic.test",
    phone: "+20 115 555 0606",
    dob: "1994-02-08",
    gender: "female",
    heightCm: 160,
    startKg: 58,
    goalKg: 56,
    goal: "maintenance",
    goalNote: "Maintain while training for a 10K.",
    daysAgo: 70,
    status: "inactive",
    schedule: [FULL_A, null, null, FULL_B, null, null, null],
    meals: MEALS_STANDARD,
    adherence: { workout: 0.6, meal: 0.6 },
  },
  {
    name: "Hana Ibrahim",
    email: "hana@kinetic.test",
    phone: "+20 127 555 0707",
    dob: "2000-12-01",
    gender: "female",
    heightCm: 167,
    startKg: 61,
    goalKg: 58,
    goal: "strength",
    goalNote: "Learn the big lifts properly.",
    daysAgo: 0,
    mustChange: true,
    schedule: [null, null, null, null, null, null, null],
    meals: null,
    adherence: { workout: 0, meal: 0 },
  },
];

/* ── helpers ────────────────────────────────────────────────── */

async function placeholderPhoto(label: string, week: number, angle: string, hue: number, slim: number) {
  const w = 900;
  const h = 1200;
  const body = angle === "side" ? 120 - slim * 18 : 250 - slim * 40;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
    <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="hsl(${hue},25%,86%)"/><stop offset="1" stop-color="hsl(${hue},20%,68%)"/></linearGradient></defs>
    <rect width="100%" height="100%" fill="url(#g)"/>
    <g fill="hsl(${hue},18%,34%)" opacity="0.9">
      <circle cx="${w / 2}" cy="250" r="78"/>
      <rect x="${w / 2 - body / 2}" y="345" width="${body}" height="430" rx="${body / 3}"/>
      <rect x="${w / 2 - body / 2 + 10}" y="760" width="${body / 2 - 18}" height="360" rx="40"/>
      <rect x="${w / 2 + 8}" y="760" width="${body / 2 - 18}" height="360" rx="40"/>
    </g>
    <text x="40" y="${h - 50}" font-family="Helvetica, Arial, sans-serif" font-size="38" font-weight="700" fill="#ffffff" opacity="0.9">${label} · WEEK ${week}</text>
    <text x="40" y="${h - 100}" font-family="Helvetica, Arial, sans-serif" font-size="26" fill="#ffffff" opacity="0.75">Demo placeholder image</text>
  </svg>`;
  const main = await sharp(Buffer.from(svg)).webp({ quality: 80 }).toBuffer({ resolveWithObject: true });
  const thumb = await sharp(Buffer.from(svg)).resize(480).webp({ quality: 75 }).toBuffer();
  return {
    main: main.data,
    width: main.info.width,
    height: main.info.height,
    thumb,
  };
}

async function main() {
  const [existing] = await db
    .select({ id: s.users.id })
    .from(s.users)
    .where(sql`lower(${s.users.email}) = ${COACH_EMAIL}`)
    .limit(1);
  if (existing) {
    console.log(`Seed coach ${COACH_EMAIL} already exists — nothing to do. Run "npm run db:reset" to start over.`);
    await pool.end();
    return;
  }

  const today = todayInTz(TZ);
  const now = new Date();
  const nowParts = zonedParts(now, TZ);
  const nowMinutes = nowParts.hour * 60 + nowParts.minute;
  console.log(`→ Seeding demo data for ${today} (${TZ})…`);

  const types = await db.select().from(s.measurementTypes).where(isNull(s.measurementTypes.coachId));
  const T = Object.fromEntries(types.map((t) => [t.key, t]));
  if (!T.weight) throw new Error("System measurement types missing — run migrations first (npm run db:migrate).");

  const coachHash = await hashPassword(COACH_PASSWORD);
  const clientHash = await hashPassword(CLIENT_PASSWORD);

  const [coach] = await db
    .insert(s.users)
    .values({
      email: COACH_EMAIL,
      passwordHash: coachHash,
      role: "coach",
      name: "Captain Ayman",
      lastLoginAt: now,
    })
    .returning();
  await db.insert(s.coachSettings).values({
    coachId: coach!.id,
    timezone: TZ,
    businessName: null,
    weekStartsOn: 6,
  });
  await db
    .insert(s.siteSettings)
    .values({
      id: 1,
      accessCodeEnc: ACCESS_CODE ? encrypt(ACCESS_CODE) : null,
      accessVersion: randomUUID(),
    })
    .onConflictDoUpdate({
      target: s.siteSettings.id,
      set: {
        accessCodeEnc: ACCESS_CODE ? encrypt(ACCESS_CODE) : null,
        accessVersion: randomUUID(),
      },
    });

  const activity: (typeof s.activityLogs.$inferInsert)[] = [];
  const notifications: (typeof s.notifications.$inferInsert)[] = [];

  const todayDow = dayOfWeek(today);
  for (const c of CLIENTS) {
    const joined = addDays(today, -c.daysAgo);
    const schedule: (WorkoutT | null)[] = Array(7).fill(null);
    c.schedule.forEach((w, i) => (schedule[(todayDow + i) % 7] = w));
    const [user] = await db
      .insert(s.users)
      .values({
        email: c.email,
        passwordHash: clientHash,
        role: "client",
        name: c.name,
        mustChangePassword: !!c.mustChange,
        isActive: true,
      })
      .returning();
    const [client] = await db
      .insert(s.clients)
      .values({
        userId: user!.id,
        coachId: coach!.id,
        code: generateClientCode(),
        fullName: c.name,
        phone: c.phone,
        dateOfBirth: c.dob,
        gender: c.gender,
        heightCm: c.heightCm,
        startingWeightKg: c.startKg,
        currentWeightKg: c.startKg,
        goalWeightKg: c.goalKg,
        goal: c.goal,
        goalNote: c.goalNote,
        coachNotes: c.notes ?? null,
        status: c.status ?? "active",
        joinedOn: joined,
        createdAt: localToUtc(joined, 10 * 60),
      })
      .returning();
    const clientId = client!.id;
    await db.insert(s.clientPermissions).values({ clientId, ...(c.perms ?? {}) });
    activity.push({
      actorId: coach!.id,
      clientId,
      coachId: coach!.id,
      action: "coach.client.created",
      entityType: "client",
      entityId: clientId,
      createdAt: localToUtc(joined, 10 * 60),
    });

    /* workout plan (current targets): a 3-week training sheet that started last week (so this is week 2) */
    const WEEKS = 3;
    const planStart = addDays(startOfWeek(today, 6), -7);
    const kgFor = (e: Ex, wk: number) => (e.kg == null ? null : Math.round((e.kg + wk * (e.kg >= 40 ? 2.5 : e.kg >= 15 ? 1 : 0.5)) * 2) / 2);
    const uniq = [...new Set(schedule.filter(Boolean))] as WorkoutT[];
    let workoutPlanId: string | null = null;
    const workoutIds = new Map<WorkoutT, string>();
    const exerciseIds = new Map<Ex, string>();
    if (uniq.length) {
      const [plan] = await db
        .insert(s.workoutPlans)
        .values({
          clientId,
          name: uniq.length === 2 ? "Upper / Lower split" : uniq.length >= 3 ? "Push · Pull · Legs" : "Full-body program",
          notes: "Add 2.5 kg when every set hits the target reps.",
          weekCount: WEEKS,
          startsOn: planStart,
          contentUpdatedAt: localToUtc(addDays(today, -3), 21 * 60),
        })
        .returning();
      workoutPlanId = plan!.id;
      for (const [pos, w] of uniq.entries()) {
        const wid = randomUUID();
        workoutIds.set(w, wid);
        await db.insert(s.workouts).values({
          id: wid,
          planId: plan!.id,
          title: w.title,
          muscleGroup: w.muscle,
          instructions: w.instructions ?? null,
          position: pos,
        });
        for (const [i, e] of w.ex.entries()) {
          const eid = randomUUID();
          exerciseIds.set(e, eid);
          await db.insert(s.workoutExercises).values({
            id: eid,
            workoutId: wid,
            name: e.name,
            restSeconds: e.rest ?? null,
            tempo: e.tempo ?? null,
            notes: e.notes ?? null,
            videoUrl: e.video ?? null,
            position: i,
          });
          await db.insert(s.workoutSets).values(
            Array.from({ length: WEEKS }, (_, wk) =>
              Array.from({ length: e.sets }, (_, k) => ({
                exerciseId: eid,
                week: wk,
                setNumber: k + 1,
                targetReps: e.reps,
                targetWeightKg: kgFor(e, wk),
              })),
            ).flat(),
          );
        }
      }
      await db.insert(s.workoutDays).values(
        schedule.map((w, dow) => ({
          planId: plan!.id,
          dayOfWeek: dow,
          workoutId: w ? workoutIds.get(w)! : null,
        })),
      );
      activity.push({
        actorId: coach!.id,
        clientId,
        coachId: coach!.id,
        action: "coach.workout_plan.updated",
        entityType: "workout_plan",
        entityId: plan!.id,
        metadata: {
          workouts: uniq.length,
          trainingDays: schedule.filter(Boolean).length,
        },
        createdAt: localToUtc(joined, 11 * 60),
      });
    }

    /* nutrition plan */
    const mealIds = new Map<MealT, string>();
    let nutritionPlanId: string | null = null;
    if (c.meals) {
      const [np] = await db
        .insert(s.nutritionPlans)
        .values({
          clientId,
          name: c.goal === "muscle_gain" ? "Lean bulk · 2,900 kcal" : c.goal === "fat_loss" ? "Fat-loss plan" : "Balanced plan",
          notes: "Drink at least 3 L of water daily.",
          contentUpdatedAt: localToUtc(joined, 11 * 60),
        })
        .returning();
      nutritionPlanId = np!.id;
      for (const [pos, m] of c.meals.entries()) {
        const mid = randomUUID();
        mealIds.set(m, mid);
        await db.insert(s.meals).values({
          id: mid,
          planId: np!.id,
          name: m.name,
          scheduledTime: `${m.time}:00`,
          notes: m.notes ?? null,
          position: pos,
        });
        await db.insert(s.mealItems).values(
          m.items.map(([name, quantity, calories, protein, carbs, fats], i) => ({
            mealId: mid,
            name,
            quantity,
            calories,
            protein,
            carbs,
            fats,
            position: i,
          })),
        );
      }
      activity.push({
        actorId: coach!.id,
        clientId,
        coachId: coach!.id,
        action: "coach.nutrition_plan.updated",
        entityType: "nutrition_plan",
        entityId: np!.id,
        metadata: { meals: c.meals.length },
        createdAt: localToUtc(joined, 11 * 60 + 20),
      });
    }

    /* history */
    let lastActivity: Date | null = null;
    const touch = (d: Date) => {
      if (!lastActivity || d > lastActivity) lastActivity = d;
    };
    const totalDays = c.daysAgo;
    for (let i = 0; i <= totalDays; i++) {
      const date = addDays(joined, i);
      const isToday = date === today;
      const progress = totalDays ? i / totalDays : 1;
      if ((c.status ?? "active") === "inactive" && diffDays(today, date) < 12) continue; // went inactive ~12 days ago

      // Workouts — snapshot with *historical* (lighter) targets: proves history ≠ current plan.
      const w = schedule[dayOfWeek(date)];
      if (w && uniq.length) {
        const factor = Math.min(1, 0.86 + 0.14 * progress);
        // Never fabricate "today" activity that would lie in the future (e.g. seeding at 1 AM).
        const todayPlan = nowMinutes >= 8 * 60 ? c.today?.workout : "none";
        const done = isToday ? todayPlan === "completed" : chance(c.adherence.workout);
        const partialDay = isToday ? todayPlan === "partial" : !done && chance(0.3);
        if (isToday && todayPlan !== "completed" && todayPlan !== "partial") {
          // Today, not started yet: the app will snapshot it on first view.
        } else {
          const logId = randomUUID();
          // Sessions inside the current sheet cycle use that week's targets; older ones keep lighter historical targets.
          const inCycle = date >= planStart;
          const wk = inCycle ? planWeek(WEEKS, planStart, date).index : null;
          const finishMin = isToday ? nowMinutes - int(15, 60) : int(17 * 60 + 30, 21 * 60);
          const completedAt = done ? localToUtc(date, finishMin) : null;
          const startedAt = done || partialDay ? localToUtc(date, finishMin - int(50, 75)) : null;
          const exRows: (typeof s.workoutExerciseLogs.$inferInsert)[] = [];
          const setRows: (typeof s.workoutSetLogs.$inferInsert)[] = [];
          let total = 0,
            completed = 0,
            partial = 0,
            targetSum = 0,
            doneSum = 0;
          const stopAt = partialDay ? int(4, 8) : Infinity;
          let setIndex = 0;
          for (const [pos, e] of w.ex.entries()) {
            const exId = randomUUID();
            exRows.push({
              id: exId,
              workoutLogId: logId,
              sourceExerciseId: exerciseIds.get(e) ?? null,
              name: e.name,
              restSeconds: e.rest ?? null,
              tempo: e.tempo ?? null,
              notes: e.notes ?? null,
              videoUrl: e.video ?? null,
              position: pos,
            });
            for (let k = 1; k <= e.sets; k++) {
              setIndex++;
              total++;
              targetSum += e.reps;
              const recorded = done ? true : setIndex <= stopAt && (partialDay as boolean);
              let actual: number | null = null;
              let status: "pending" | "completed" | "partial" = "pending";
              if (recorded) {
                const miss = k === e.sets ? chance(0.28) : chance(0.1);
                actual = miss ? Math.max(1, e.reps - int(1, Math.max(1, Math.round(e.reps * 0.35)))) : e.reps;
                status = actual >= e.reps ? "completed" : "partial";
                if (status === "completed") completed++;
                else partial++;
                doneSum += Math.min(actual, e.reps);
              }
              setRows.push({
                clientId,
                workoutLogId: logId,
                exerciseLogId: exId,
                setNumber: k,
                targetReps: e.reps,
                targetWeightKg: wk != null ? kgFor(e, wk) : e.kg == null ? null : Math.round(e.kg * factor * 2) / 2,
                actualReps: actual,
                status,
                completedAt: recorded && startedAt ? new Date(startedAt.getTime() + setIndex * 2.5 * 60_000) : null,
              });
            }
          }
          const pct = targetSum ? Math.round((doneSum / targetSum) * 10000) / 100 : 0;
          await db.insert(s.workoutLogs).values({
            id: logId,
            clientId,
            date,
            planId: workoutPlanId,
            workoutId: workoutIds.get(w) ?? null,
            title: w.title,
            muscleGroup: w.muscle,
            instructions: w.instructions ?? null,
            weekIndex: wk,
            weekCount: wk != null ? WEEKS : null,
            status: done ? "completed" : partialDay ? "in_progress" : "pending",
            startedAt,
            completedAt,
            completionPercent: pct,
            totalSets: total,
            completedSets: completed,
            partialSets: partial,
            snapshotAt: localToUtc(date, 6 * 60),
            createdAt: localToUtc(date, 6 * 60),
          });
          await db.insert(s.workoutExerciseLogs).values(exRows);
          await db.insert(s.workoutSetLogs).values(setRows);
          if (completedAt) {
            touch(completedAt);
            if (diffDays(today, date) <= 14) {
              activity.push({
                actorId: user!.id,
                clientId,
                coachId: coach!.id,
                action: "client.workout.completed",
                entityType: "workout_log",
                entityId: logId,
                metadata: { workout: w.title, completionPercent: pct, date },
                createdAt: completedAt,
              });
              if (diffDays(today, date) <= 1)
                notifications.push({
                  userId: coach!.id,
                  type: "workout.completed",
                  title: `${c.name} completed ${w.title}`,
                  body: `Completion ${Math.round(pct)}%`,
                  data: {
                    clientId,
                    logId,
                    clientName: c.name,
                    workout: w.title,
                    pct: Math.round(pct),
                  },
                  createdAt: completedAt,
                  readAt: isToday ? null : completedAt,
                });
            }
          } else if (startedAt) {
            touch(startedAt);
            if (isToday) {
              const lastSet = setRows.filter((r) => r.status !== "pending").at(-1);
              if (lastSet)
                activity.push({
                  actorId: user!.id,
                  clientId,
                  coachId: coach!.id,
                  action: lastSet.status === "partial" ? "client.workout_set.partial" : "client.workout_set.completed",
                  entityType: "workout_set_log",
                  metadata: {
                    workout: w.title,
                    set: lastSet.setNumber,
                    targetReps: lastSet.targetReps,
                    actualReps: lastSet.actualReps,
                  },
                  createdAt: lastSet.completedAt ?? startedAt,
                });
            }
          }
        }
      }

      // Meals — consumed_at close to the scheduled time, like a real tap on the phone.
      if (c.meals && nutritionPlanId) {
        const eatenToday = c.today?.meals ?? 0;
        for (const [pos, m] of c.meals.entries()) {
          const [hh, mm] = m.time.split(":").map(Number);
          const sched = hh! * 60 + mm!;
          const eaten = isToday ? pos < eatenToday && sched - 20 < nowMinutes : chance(c.adherence.meal);
          const consumedMin = Math.max(5 * 60, Math.min(23 * 60 + 50, Math.round(sched + 12 + gauss() * 22)));
          const consumedAt = eaten ? localToUtc(date, isToday ? Math.min(consumedMin, nowMinutes - 2) : consumedMin) : null;
          const tot = m.items.reduce(
            (a, it) => ({
              k: a.k + it[2],
              p: a.p + it[3],
              c: a.c + it[4],
              f: a.f + it[5],
            }),
            { k: 0, p: 0, c: 0, f: 0 },
          );
          const mealLogId = randomUUID();
          await db.insert(s.mealLogs).values({
            id: mealLogId,
            clientId,
            date,
            planId: nutritionPlanId,
            mealId: mealIds.get(m)!,
            mealName: m.name,
            scheduledTime: `${m.time}:00`,
            notes: m.notes ?? null,
            items: m.items.map(([name, quantity, calories, protein, carbs, fats]) => ({
              name,
              quantity,
              calories,
              protein,
              carbs,
              fats,
            })),
            totalCalories: tot.k,
            totalProtein: tot.p,
            totalCarbs: tot.c,
            totalFats: tot.f,
            position: pos,
            status: eaten ? "completed" : "pending",
            consumedAt,
            snapshotAt: localToUtc(date, 5 * 60),
            createdAt: localToUtc(date, 5 * 60),
          });
          if (consumedAt) {
            touch(consumedAt);
            if (diffDays(today, date) <= 3)
              activity.push({
                actorId: user!.id,
                clientId,
                coachId: coach!.id,
                action: "client.meal.completed",
                entityType: "meal_log",
                entityId: mealLogId,
                metadata: { meal: m.name, scheduledTime: `${m.time}:00`, date },
                createdAt: consumedAt,
              });
          }
        }
      }
    }

    /* measurements — weekly weigh-ins trending toward the goal */
    if (c.daysAgo > 0) {
      const rows: (typeof s.measurements.$inferInsert)[] = [];
      let currentKg = c.startKg;
      const weeks = Math.floor(c.daysAgo / 7);
      for (let wk = 0; wk <= weeks; wk++) {
        const date = addDays(joined, wk * 7);
        if ((c.status ?? "active") === "inactive" && diffDays(today, date) < 12) break;
        const p = weeks ? wk / weeks : 0;
        const trend = c.startKg + (c.goalKg - c.startKg) * 0.62 * (1 - Math.pow(1 - p, 1.4));
        currentKg = Math.round((wk === 0 ? c.startKg : trend + gauss() * 0.35) * 10) / 10;
        const note = wk === 0 ? "Initial assessment" : null;
        rows.push({
          clientId,
          typeId: T.weight!.id,
          value: currentKg,
          unit: "kg",
          measuredOn: date,
          note,
          recordedById: coach!.id,
          createdAt: localToUtc(date, 9 * 60),
        });
        rows.push({
          clientId,
          typeId: T.bmi!.id,
          value: bmi(currentKg, c.heightCm)!,
          unit: "kg/m²",
          measuredOn: date,
          note: "Auto-calculated from weight & height",
          recordedById: coach!.id,
          createdAt: localToUtc(date, 9 * 60),
        });
        if (wk === 0)
          rows.push({
            clientId,
            typeId: T.height!.id,
            value: c.heightCm,
            unit: "cm",
            measuredOn: date,
            note,
            recordedById: coach!.id,
            createdAt: localToUtc(date, 9 * 60),
          });
        if (c.adherence.bf && wk % 2 === 0) {
          const [a, b] = c.adherence.bf;
          rows.push({
            clientId,
            typeId: T.body_fat!.id,
            value: Math.round((a + (b - a) * p + gauss() * 0.3) * 10) / 10,
            unit: "%",
            measuredOn: date,
            recordedById: coach!.id,
            createdAt: localToUtc(date, 9 * 60),
          });
        }
        if (c.adherence.mm && wk % 2 === 0) {
          const [a, b] = c.adherence.mm;
          rows.push({
            clientId,
            typeId: T.muscle_mass!.id,
            value: Math.round((a + (b - a) * p + gauss() * 0.2) * 10) / 10,
            unit: "kg",
            measuredOn: date,
            recordedById: coach!.id,
            createdAt: localToUtc(date, 9 * 60),
          });
        }
        if (wk % 4 === 0) {
          const k = c.goalKg < c.startKg ? -1 : 0.4;
          const tape: [string, number][] =
            c.gender === "male"
              ? [
                  ["waist", 92],
                  ["chest", 104],
                  ["arms", 35],
                  ["thighs", 58],
                  ["shoulders", 118],
                ]
              : [
                  ["waist", 76],
                  ["hips", 102],
                  ["arms", 29],
                  ["thighs", 57],
                  ["abdomen", 84],
                ];
          for (const [key, base] of tape) {
            const scale = base * (1 + (key === "arms" || key === "shoulders" ? 0.02 : 0.05 * k) * p * (c.goalKg < c.startKg ? 1 : 0.5));
            rows.push({
              clientId,
              typeId: T[key]!.id,
              value: Math.round(scale * 10) / 10,
              unit: "cm",
              measuredOn: date,
              recordedById: coach!.id,
              createdAt: localToUtc(date, 9 * 60 + 5),
            });
          }
        }
        if (wk > 0 && diffDays(today, date) <= 14)
          activity.push({
            actorId: coach!.id,
            clientId,
            coachId: coach!.id,
            action: "coach.measurements.added",
            entityType: "measurement",
            metadata: { date, count: 2, types: ["Weight", "BMI"] },
            createdAt: localToUtc(date, 9 * 60),
          });
      }
      await db.insert(s.measurements).values(rows);
      await db.update(s.clients).set({ currentWeightKg: currentKg }).where(eq(s.clients.id, clientId));
    } else {
      await db.insert(s.measurements).values({
        clientId,
        typeId: T.weight!.id,
        value: c.startKg,
        unit: "kg",
        measuredOn: joined,
        note: "Starting weight",
        recordedById: coach!.id,
      });
    }

    /* photos */
    if (c.photos) {
      const hue = c.gender === "male" ? 210 : 330;
      for (const wk of [0, 4, 8]) {
        const date = addDays(joined, Math.min(wk * 7, c.daysAgo));
        for (const angle of ["front", "side"] as const) {
          const img = await placeholderPhoto(angle.toUpperCase(), wk + 1, angle, hue, wk / 8);
          const id = randomUUID();
          const storageKey = `clients/${clientId}/photos/${id}.webp`;
          const thumbKey = `clients/${clientId}/photos/${id}_thumb.webp`;
          await storage().put(storageKey, img.main, "image/webp");
          await storage().put(thumbKey, img.thumb, "image/webp");
          await db.insert(s.progressPhotos).values({
            id,
            clientId,
            storageKey,
            thumbKey,
            mimeType: "image/webp",
            width: img.width,
            height: img.height,
            sizeBytes: img.main.length,
            phase: wk === 0 ? "before" : "after",
            angle,
            takenOn: date,
            note: wk === 0 ? "Initial assessment" : `Week ${wk + 1} check-in`,
            uploadedById: coach!.id,
            createdAt: localToUtc(date, 9 * 60 + 10),
          });
        }
      }
    }

    const last = lastActivity as Date | null;
    if (last) {
      await db.update(s.clients).set({ lastActivityAt: last }).where(eq(s.clients.id, clientId));
      await db
        .update(s.users)
        .set({ lastLoginAt: new Date(last.getTime() - 20 * 60_000) })
        .where(eq(s.users.id, user!.id));
      activity.push({
        actorId: user!.id,
        clientId,
        coachId: coach!.id,
        action: "auth.login",
        entityType: "user",
        entityId: user!.id,
        createdAt: new Date(last.getTime() - 20 * 60_000),
      });
    }
    console.log(`  ✓ ${c.name.padEnd(16)} ${c.email}`);
  }

  for (let i = 0; i < activity.length; i += 500) await db.insert(s.activityLogs).values(activity.slice(i, i + 500));
  if (notifications.length) await db.insert(s.notifications).values(notifications);
  await db.update(s.coachSettings).set({ lastSnapshotDate: null }).where(eq(s.coachSettings.coachId, coach!.id));

  console.log(`\n✓ Seed complete — ${activity.length} activity events.\n`);
  console.log("  Access code", ACCESS_CODE || "(off)");
  console.log("  Coach     ", COACH_EMAIL, " / ", COACH_PASSWORD);
  console.log("  Client A  ", "omar@kinetic.test", " / ", CLIENT_PASSWORD);
  console.log("  Client B  ", "mariam@kinetic.test", " / ", CLIENT_PASSWORD);
  console.log("  (hana@kinetic.test must set a new password on first sign-in; salma@ is disabled)\n");
  await pool.end();
}

main().catch(async (err) => {
  console.error(err);
  await pool.end();
  process.exit(1);
});
