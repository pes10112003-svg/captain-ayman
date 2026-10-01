"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireActor } from "../auth/guards";
import {
  createClient,
  deleteClient,
  resetClientPassword,
  setClientStatus,
  updateClient,
  updateOwnProfile,
  updatePermissions,
} from "../services/clients";
import { removeAvatar, uploadAvatar } from "../services/photos";
import { clientCreateSchema, clientProfileSchema, clientSelfUpdateSchema, permissionsSchema, setClientPasswordSchema } from "@/lib/validation";
import { formObject, parseInput, runAction, type ActionResult } from "./helpers";

export async function createClientAction(
  _prev: ActionResult<{ id: string; email: string; generatedPassword: string | null }> | null,
  formData: FormData,
) {
  return runAction(async () => {
    const actor = await requireActor("coach");
    const input = parseInput(clientCreateSchema, formObject(formData));
    const { client, generatedPassword } = await createClient(actor, input);
    const avatar = formData.get("avatar");
    if (avatar instanceof File && avatar.size > 0) await uploadAvatar(actor, client.id, avatar).catch(() => undefined);
    revalidatePath("/coach", "layout");
    return { id: client.id, email: input.email, generatedPassword };
  });
}

export async function updateClientAction(clientId: string, _prev: ActionResult | null, formData: FormData) {
  return runAction(async () => {
    const actor = await requireActor("coach");
    const input = parseInput(clientProfileSchema, formObject(formData));
    await updateClient(actor, clientId, input);
    revalidatePath("/coach", "layout");
    return null;
  });
}

export async function setClientStatusAction(clientId: string, status: "active" | "inactive") {
  return runAction(async () => {
    const actor = await requireActor("coach");
    await setClientStatus(actor, clientId, z.enum(["active", "inactive"]).parse(status));
    revalidatePath("/coach", "layout");
    return null;
  });
}

export async function deleteClientAction(clientId: string, confirmName: string) {
  const result = await runAction(async () => {
    const actor = await requireActor("coach");
    await deleteClient(actor, clientId, String(confirmName ?? ""));
    revalidatePath("/coach", "layout");
    return null;
  });
  if (!result.ok) return result;
  redirect("/coach/clients?deleted=1");
}

/** Coach sets the client's password (typed, or generated when empty). */
export async function setClientPasswordAction(clientId: string, input: { password?: string; forcePasswordChange?: boolean }) {
  return runAction(async () => {
    const actor = await requireActor("coach");
    const parsed = parseInput(setClientPasswordSchema, input);
    return resetClientPassword(actor, clientId, "set", parsed);
  });
}

/** Coach issues a one-time 24h reset link instead. */
export async function createClientResetLinkAction(clientId: string) {
  return runAction(async () => {
    const actor = await requireActor("coach");
    return resetClientPassword(actor, clientId, "link");
  });
}

export async function updatePermissionsAction(clientId: string, permissions: unknown) {
  return runAction(async () => {
    const actor = await requireActor("coach");
    await updatePermissions(actor, clientId, parseInput(permissionsSchema, permissions));
    revalidatePath("/coach", "layout");
    return null;
  });
}

export async function uploadClientAvatarAction(clientId: string, formData: FormData) {
  return runAction(async () => {
    const actor = await requireActor();
    const file = formData.get("avatar");
    if (!(file instanceof File)) throw new Error("No file");
    await uploadAvatar(actor, clientId, file);
    revalidatePath("/", "layout");
    return null;
  });
}

export async function removeClientAvatarAction(clientId: string) {
  return runAction(async () => {
    const actor = await requireActor();
    await removeAvatar(actor, clientId);
    revalidatePath("/", "layout");
    return null;
  });
}

/* ── client self-service ─────────────────────────────── */

export async function updateOwnProfileAction(_prev: ActionResult | null, formData: FormData) {
  return runAction(async () => {
    const actor = await requireActor("client");
    await updateOwnProfile(actor, parseInput(clientSelfUpdateSchema, formObject(formData)));
    revalidatePath("/client", "layout");
    return null;
  });
}
