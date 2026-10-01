import { eq } from "drizzle-orm";
import { db, type Executor } from "./db";
import { activityLogs, clients } from "./db/schema";

export type ActivityAction =
  | "auth.login"
  | "auth.password_changed"
  | "auth.password_reset"
  | "client.workout_set.completed"
  | "client.workout_set.partial"
  | "client.workout_set.reset"
  | "client.workout.completed"
  | "client.meal.completed"
  | "client.meal.undone"
  | "client.photo.uploaded"
  | "client.profile.updated"
  | "coach.client.created"
  | "coach.client.updated"
  | "coach.client.status_changed"
  | "coach.client.password_reset"
  | "coach.workout_plan.updated"
  | "coach.workout_log.edited"
  | "coach.nutrition_plan.updated"
  | "coach.measurements.added"
  | "coach.measurement.deleted"
  | "coach.photo.uploaded"
  | "coach.photo.deleted"
  | "coach.permissions.updated"
  | "coach.access_code.changed";

export type ActivityInput = {
  actorId: string | null;
  clientId?: string | null;
  coachId?: string | null;
  action: ActivityAction;
  entityType?: string;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
};

/** Append-only audit trail. Never updated or deleted by application code. */
export async function logActivity(input: ActivityInput, dbx: Executor = db) {
  await dbx.insert(activityLogs).values({
    actorId: input.actorId,
    clientId: input.clientId ?? null,
    coachId: input.coachId ?? null,
    action: input.action,
    entityType: input.entityType ?? null,
    entityId: input.entityId ?? null,
    metadata: input.metadata ?? null,
  });
}

/** Marks the client as recently active (drives "last activity" columns & filters). */
export async function touchClient(clientId: string, dbx: Executor = db) {
  await dbx.update(clients).set({ lastActivityAt: new Date() }).where(eq(clients.id, clientId));
}
