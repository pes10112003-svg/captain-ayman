/**
 * Shared Zod schemas. Every server action and API route validates its input with these
 * before touching the database — the same schemas power client-side form hints.
 */
import { z } from "zod";
import { GENDER_KEYS, GOAL_KEYS, PERMISSION_KEYS, PHOTO_ANGLE_KEYS, PHOTO_PHASE_KEYS } from "./constants";
import { isIsoDate } from "./time";

/* ── primitives ─────────────────────────────────────────────── */

const emptyToNull = (v: unknown) => (typeof v === "string" && v.trim() === "" ? null : v);

export const optText = (max: number) => z.preprocess(emptyToNull, z.string().trim().max(max, `Must be ${max} characters or fewer`).nullable().optional());

export const optNumber = (min: number, max: number, label = "Value") =>
  z.preprocess(
    (v) => (v === "" || v == null ? null : typeof v === "string" ? Number(v) : v),
    z
      .number({ error: `${label} must be a number` })
      .finite()
      .min(min, `${label} must be at least ${min}`)
      .max(max, `${label} must be at most ${max}`)
      .nullable()
      .optional(),
  );

export const isoDate = z.string().refine(isIsoDate, "Enter a valid date");
export const optIsoDate = z.preprocess(emptyToNull, isoDate.nullable().optional());
export const uuid = z.uuid({ error: "Invalid identifier" });
export const httpUrl = z.url({ protocol: /^https?$/, error: "Enter a valid http(s) URL" }).max(500);
export const optHttpUrl = z.preprocess(emptyToNull, httpUrl.nullable().optional());
export const clock = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/, "Use HH:MM (24h)");

export const email = z
  .email({ error: "Enter a valid email address" })
  .max(254)
  .transform((v) => v.trim().toLowerCase());

export const password = z.string().min(8, "Password must be at least 8 characters").max(128, "Password must be 128 characters or fewer");

/* ── auth ───────────────────────────────────────────────────── */

export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "Email is required")
    .max(254)
    .transform((v) => v.toLowerCase()),
  password: z.string().min(1, "Password is required").max(200),
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().max(200).optional(),
    newPassword: password,
    confirmPassword: z.string(),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords don't match",
  });

export const resetPasswordSchema = z
  .object({
    token: z.string().min(20).max(200),
    newPassword: password,
    confirmPassword: z.string(),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords don't match",
  });

/* ── clients ────────────────────────────────────────────────── */

const phone = z.preprocess(
  emptyToNull,
  z
    .string()
    .trim()
    .max(32)
    .regex(/^[+0-9()\-\s]{6,32}$/, "Enter a valid phone number")
    .nullable()
    .optional(),
);

/** Measurements in these forms are in the coach's *display* units; services convert to kg/cm. */
export const clientProfileSchema = z.object({
  fullName: z.string().trim().min(2, "Name is too short").max(120),
  email,
  phone,
  dateOfBirth: optIsoDate,
  gender: z.enum(GENDER_KEYS).default("unspecified"),
  height: optNumber(40, 300, "Height"),
  startingWeight: optNumber(20, 700, "Starting weight"),
  goalWeight: optNumber(20, 700, "Goal weight"),
  goal: z.enum(GOAL_KEYS).default("general_fitness"),
  goalNote: optText(280),
  coachNotes: optText(5000),
  status: z.enum(["active", "inactive"]).default("active"),
});
export type ClientProfileInput = z.infer<typeof clientProfileSchema>;

const checkbox = z.preprocess((v) => v === true || v === "on" || v === "true" || v === "1", z.boolean());

export const clientCreateSchema = clientProfileSchema.extend({
  password: z.preprocess(emptyToNull, password.nullable().optional()),
  /** Off by default: the coach owns the client's password and shares it with them. */
  forcePasswordChange: checkbox.default(false),
});

export const setClientPasswordSchema = z.object({
  /** Empty ⇒ the server generates a strong, human-typable password. */
  password: z.preprocess(emptyToNull, password.nullable().optional()),
  forcePasswordChange: checkbox.default(false),
});

export const clientSelfUpdateSchema = z.object({
  phone,
  dateOfBirth: optIsoDate,
  gender: z.enum(GENDER_KEYS).default("unspecified"),
});

export const permissionsSchema = z.object(
  Object.fromEntries(PERMISSION_KEYS.map((k) => [k, z.boolean()])) as Record<(typeof PERMISSION_KEYS)[number], z.ZodBoolean>,
);

/* ── workouts ───────────────────────────────────────────────── */

export const workoutSetInput = z.object({
  targetReps: z.number().int().min(0).max(1000),
  /** display unit (kg/lb); null = bodyweight */
  targetWeight: z.number().min(0).max(2000).nullable(),
});

export const workoutExerciseInput = z.object({
  name: z.string().trim().min(1, "Exercise name is required").max(120),
  restSeconds: z.number().int().min(0).max(3600).nullable(),
  tempo: z.string().trim().max(20).nullable(),
  notes: z.string().trim().max(2000).nullable(),
  videoUrl: z.preprocess(emptyToNull, httpUrl.nullable()),
  sets: z.array(workoutSetInput).min(1, "Add at least one set").max(20),
});

export const workoutInput = z.object({
  id: z.string().max(64).nullable().optional(),
  key: z.string().min(1).max(64),
  title: z.string().trim().min(1, "Workout title is required").max(80),
  muscleGroup: z.string().trim().max(80).nullable(),
  instructions: z.string().trim().max(4000).nullable(),
  exercises: z.array(workoutExerciseInput).max(40),
});

export const workoutPlanSchema = z
  .object({
    name: z.string().trim().min(1, "Plan name is required").max(120),
    notes: z.string().trim().max(4000).nullable(),
    workouts: z.array(workoutInput).max(14),
    /** index 0 = Sunday … 6 = Saturday → workout `key` or null (rest) */
    schedule: z.array(z.string().max(64).nullable()).length(7),
  })
  .superRefine((plan, ctx) => {
    const keys = new Set(plan.workouts.map((w) => w.key));
    if (keys.size !== plan.workouts.length) ctx.addIssue({ code: "custom", message: "Duplicate workout keys" });
    plan.schedule.forEach((k, i) => {
      if (k && !keys.has(k))
        ctx.addIssue({
          code: "custom",
          path: ["schedule", i],
          message: "Unknown workout in schedule",
        });
    });
  });
export type WorkoutPlanInput = z.infer<typeof workoutPlanSchema>;

export const recordSetSchema = z.object({
  done: z.boolean(),
  actualReps: z.number().int().min(0).max(1000).nullable().optional(),
});

export const workoutLogEditSchema = z.object({
  coachNote: z.string().trim().max(2000).nullable(),
  sets: z
    .array(
      z.object({
        id: uuid,
        actualReps: z.number().int().min(0).max(1000).nullable(),
        status: z.enum(["pending", "completed", "partial", "skipped"]),
      }),
    )
    .max(400),
  markCompleted: z.boolean().optional(),
});

/* ── nutrition ──────────────────────────────────────────────── */

const macro = z.number().min(0).max(20000).nullable();

export const mealItemInput = z.object({
  name: z.string().trim().min(1, "Food name is required").max(120),
  quantity: z.string().trim().max(60).nullable(),
  calories: macro,
  protein: macro,
  carbs: macro,
  fats: macro,
});

export const mealInput = z.object({
  id: z.string().max(64).nullable().optional(),
  name: z.string().trim().min(1, "Meal name is required").max(80),
  time: clock,
  notes: z.string().trim().max(2000).nullable(),
  referenceUrl: z.preprocess(emptyToNull, httpUrl.nullable()),
  items: z.array(mealItemInput).max(40),
});

export const nutritionPlanSchema = z.object({
  name: z.string().trim().min(1, "Plan name is required").max(120),
  notes: z.string().trim().max(4000).nullable(),
  meals: z.array(mealInput).max(12),
});
export type NutritionPlanInput = z.infer<typeof nutritionPlanSchema>;

/* ── progress ───────────────────────────────────────────────── */

export const measurementEntrySchema = z.object({
  measuredOn: isoDate,
  note: z.preprocess(emptyToNull, z.string().trim().max(500).nullable()),
  values: z
    .array(
      z.object({
        typeId: uuid,
        value: z.number().finite().gt(0, "Must be greater than 0").lt(10000),
      }),
    )
    .min(1, "Enter at least one measurement"),
});

export const measurementTypeSchema = z.object({
  name: z.string().trim().min(2).max(60),
  kind: z.enum(["mass", "length", "percent", "index", "other"]),
  unit: z.string().trim().min(1).max(16),
});

export const photoMetaSchema = z.object({
  /** «قبل» / «بعد». Missing (e.g. a form from an older cached app) → "after", like the column default. */
  phase: z.preprocess((v) => (v == null || v === "" ? "after" : v), z.enum(PHOTO_PHASE_KEYS)),
  /** Photo type: front / side / back / inbody / other. */
  angle: z.enum(PHOTO_ANGLE_KEYS),
  takenOn: isoDate,
  note: z.preprocess(emptyToNull, z.string().trim().max(500).nullable().optional()),
});

/* ── settings ───────────────────────────────────────────────── */

/** Only the brand name is editable; timezone (Africa/Cairo), units (kg/cm) and week start (Saturday) are fixed. */
export const coachSettingsSchema = z.object({
  businessName: z.preprocess(emptyToNull, z.string().trim().max(120).nullable()),
});

export const FIXED_COACH_SETTINGS = {
  timezone: "Africa/Cairo",
  weightUnit: "kg",
  lengthUnit: "cm",
  weekStartsOn: 6,
} as const;

export const coachProfileSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email,
});

export function fieldErrors(error: z.ZodError): Record<string, string[]> {
  const flat = z.flattenError(error);
  const out: Record<string, string[]> = {
    ...(flat.fieldErrors as Record<string, string[]>),
  };
  if (flat.formErrors.length) out._form = flat.formErrors;
  return out;
}
