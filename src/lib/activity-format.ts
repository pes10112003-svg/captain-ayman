import type { Dict } from "@/i18n/en";
import type { Format } from "@/i18n/format";
import { interpolate as f } from "@/i18n/format";
import { angleLabel, measureTypeLabel } from "@/i18n/labels";
import { PERMISSION_KEYS, type PermissionKey } from "./constants";

export type ActivityLike = {
  action: string;
  metadata: Record<string, unknown> | null;
  clientName: string | null;
  actorName: string | null;
  actorRole: "coach" | "client" | null;
};

export type ActivityKind = "login" | "workout" | "set" | "meal" | "plan" | "measure" | "photo" | "account" | "permission";

const str = (v: unknown) => (typeof v === "string" ? v : v == null ? "" : String(v));

/** Localised sentence for an audit-log row. */
export function describeActivity(
  a: ActivityLike,
  t: Dict,
  fmt: Format,
): { text: string; detail?: string; kind: ActivityKind; tone?: "good" | "warn" | "crit" } {
  const m = a.metadata ?? {};
  const A = t.activity;
  const who = a.clientName ?? A.client;
  const reps = () => f(A.repsDetail, { workout: str(m.workout), actual: str(m.actualReps), target: str(m.targetReps) });
  const angle = () => angleLabel(t, str(m.angle));
  switch (a.action) {
    case "auth.login":
      return { text: a.actorRole === "coach" ? A.coachSignedIn : f(A.signedIn, { who }), kind: "login" };
    case "auth.password_changed":
      return { text: f(A.passwordChanged, { who: a.actorRole === "coach" ? A.coach : who }), kind: "account" };
    case "auth.password_reset":
      return { text: f(A.passwordReset, { who }), kind: "account" };
    case "client.workout_set.completed":
      return { text: f(A.setCompleted, { who, set: str(m.set) }), detail: reps(), kind: "set", tone: "good" };
    case "client.workout_set.partial":
      return { text: f(A.setPartial, { who, set: str(m.set) }), detail: reps(), kind: "set", tone: "warn" };
    case "client.workout_set.reset":
      return { text: f(A.setReset, { who, set: str(m.set) }), detail: str(m.workout), kind: "set" };
    case "client.workout.completed":
      return {
        text: f(A.workoutCompleted, { who, workout: str(m.workout) }),
        detail: m.completionPercent != null ? f(A.completionDetail, { pct: fmt.num(Math.round(Number(m.completionPercent)), 0) }) : undefined,
        kind: "workout",
        tone: "good",
      };
    case "client.meal.completed":
      return {
        text: f(A.mealCompleted, { who, meal: str(m.meal) }),
        detail: m.scheduledTime ? f(A.scheduledDetail, { time: fmt.clock(str(m.scheduledTime)) }) : undefined,
        kind: "meal",
        tone: "good",
      };
    case "client.meal.undone":
      return { text: f(A.mealUndone, { who, meal: str(m.meal) }), kind: "meal" };
    case "client.photo.uploaded":
      return { text: f(A.photoUploaded, { who }), detail: angle(), kind: "photo" };
    case "client.profile.updated":
      return { text: f(A.profileUpdated, { who }), kind: "account" };
    case "coach.client.created":
      return { text: f(A.clientCreated, { who }), kind: "account" };
    case "coach.client.updated":
      return { text: f(A.clientUpdated, { who }), kind: "account" };
    case "coach.client.status_changed":
      return {
        text: f(A.statusChanged, { who, status: m.to === "inactive" ? A.inactive : A.active }),
        kind: "account",
        tone: m.to === "inactive" ? "crit" : "good",
      };
    case "coach.client.password_reset":
      return {
        text: m.mode === "link" ? f(A.passwordIssued, { who }) : f(A.passwordSetByCoach, { who }),
        detail: m.mode === "link" ? A.resetLink : A.tempPassword,
        kind: "account",
      };
    case "coach.workout_plan.updated":
      return {
        text: f(A.workoutPlanUpdated, { who }),
        detail: m.trainingDays != null ? f(A.trainingDaysDetail, { n: str(m.trainingDays) }) : undefined,
        kind: "plan",
      };
    case "coach.workout_log.edited":
      return {
        text: f(A.workoutLogEdited, { who }),
        detail: `${str(m.workout)} · ${typeof m.date === "string" ? fmt.date(m.date) : ""}`,
        kind: "plan",
      };
    case "coach.nutrition_plan.updated":
      return { text: f(A.nutritionPlanUpdated, { who }), detail: m.meals != null ? f(A.mealsDetail, { n: str(m.meals) }) : undefined, kind: "plan" };
    case "coach.measurements.added":
      return {
        text: f(A.measurementsAdded, { who }),
        detail: Array.isArray(m.types)
          ? (m.types as string[])
              .slice(0, 4)
              .map((name) => measureTypeLabel(t, { name: str(name) }))
              .join("، ")
          : undefined,
        kind: "measure",
      };
    case "coach.measurement.deleted":
      return { text: f(A.measurementDeleted, { who }), kind: "measure" };
    case "coach.photo.uploaded":
      return { text: f(A.coachPhotoUploaded, { who }), detail: angle(), kind: "photo" };
    case "coach.photo.deleted":
      return { text: f(A.coachPhotoDeleted, { who }), kind: "photo" };
    case "coach.permissions.updated": {
      const changed = m.changed && typeof m.changed === "object" ? Object.entries(m.changed as Record<string, boolean>) : [];
      return {
        text: f(A.permissionsChanged, { who }),
        detail: changed
          .map(([k, v]) => {
            const label = (PERMISSION_KEYS as string[]).includes(k) ? t.permissions[k as PermissionKey].label : k;
            return `${label}: ${v ? t.common.on : t.common.off}`;
          })
          .join("، "),
        kind: "permission",
      };
    }
    case "coach.access_code.changed":
      return { text: A.accessCodeChanged, kind: "permission" };
    default:
      return { text: a.action, kind: "account" };
  }
}
