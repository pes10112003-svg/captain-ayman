/**
 * Resource-level authorization. EVERY read or write of client data goes through here.
 *
 * Rules
 * 1. Coaches can only reach clients where clients.coach_id = their user id.
 * 2. Clients can only reach their own client record — the id comes from the session, and any
 *    other id (from a URL, query string, body or forged request) is rejected with 404 so the
 *    existence of other clients is never revealed.
 * 3. Per-client permissions are *additional* restrictions inside the client's own account.
 */
import { and, eq } from "drizzle-orm";
import { db, type Executor } from "./db";
import { clientPermissions, clients } from "./db/schema";
import { ForbiddenError, NotFoundError } from "./errors";
import type { Actor } from "./auth/types";
import { DEFAULT_PERMISSIONS, type PermissionKey, type Permissions } from "@/lib/constants";
import { isUuid } from "@/lib/utils";

export type ClientRow = typeof clients.$inferSelect;
export type ClientScope = { client: ClientRow; permissions: Permissions; actor: Actor };

export async function loadPermissions(clientId: string, dbx: Executor = db): Promise<Permissions> {
  const [row] = await dbx.select().from(clientPermissions).where(eq(clientPermissions.clientId, clientId)).limit(1);
  if (!row) return { ...DEFAULT_PERMISSIONS };
  return {
    viewWorkouts: row.viewWorkouts,
    completeWorkouts: row.completeWorkouts,
    enterActualReps: row.enterActualReps,
    viewNutrition: row.viewNutrition,
    completeMeals: row.completeMeals,
    viewProgress: row.viewProgress,
    viewMeasurements: row.viewMeasurements,
    viewPhotos: row.viewPhotos,
    uploadPhotos: row.uploadPhotos,
    editPersonalInfo: row.editPersonalInfo,
    changeOwnPassword: row.changeOwnPassword,
  };
}

const PERMISSION_MESSAGES: Partial<Record<PermissionKey, string>> = {
  viewWorkouts: "Your coach hasn't enabled workout access for your account.",
  completeWorkouts: "Your coach hasn't enabled workout logging for your account.",
  enterActualReps: "Your coach hasn't enabled custom rep entry for your account.",
  viewNutrition: "Your coach hasn't enabled nutrition access for your account.",
  completeMeals: "Your coach hasn't enabled meal logging for your account.",
  viewProgress: "Your coach hasn't enabled progress access for your account.",
  viewMeasurements: "Your coach hasn't enabled measurements for your account.",
  viewPhotos: "Your coach hasn't enabled progress photos for your account.",
  uploadPhotos: "Your coach hasn't enabled photo uploads for your account.",
  editPersonalInfo: "Your coach manages your personal info.",
  changeOwnPassword: "Your coach manages your password.",
};

/**
 * Authorize `actor` against `clientId`, optionally requiring client permissions.
 * Coaches bypass permission flags (they are the highest-privileged role for their own clients).
 */
export async function authorizeClient(
  actor: Actor,
  clientId: string,
  required: PermissionKey | PermissionKey[] = [],
  dbx: Executor = db,
): Promise<ClientScope> {
  if (!isUuid(clientId)) throw new NotFoundError("Client not found.");

  if (actor.role === "coach") {
    const [client] = await dbx
      .select()
      .from(clients)
      .where(and(eq(clients.id, clientId), eq(clients.coachId, actor.userId)))
      .limit(1);
    if (!client) throw new NotFoundError("Client not found.");
    return { client, permissions: await loadPermissions(client.id, dbx), actor };
  }

  // role === "client": the only client id they may ever touch is their own.
  if (!actor.clientId || actor.clientId !== clientId) throw new NotFoundError("Client not found.");
  const [client] = await dbx.select().from(clients).where(eq(clients.id, actor.clientId)).limit(1);
  if (!client || client.status !== "active") throw new NotFoundError("Client not found.");

  const permissions = await loadPermissions(client.id, dbx);
  for (const key of Array.isArray(required) ? required : [required]) {
    if (!permissions[key]) throw new ForbiddenError(PERMISSION_MESSAGES[key]);
  }
  return { client, permissions, actor };
}

/** Convenience for client-only flows: the client id always comes from the session. */
export function authorizeSelf(actor: Actor, required: PermissionKey | PermissionKey[] = [], dbx: Executor = db) {
  if (actor.role !== "client" || !actor.clientId) throw new ForbiddenError();
  return authorizeClient(actor, actor.clientId, required, dbx);
}

export function assertCoach(actor: Actor) {
  if (actor.role !== "coach") throw new ForbiddenError();
}
