"use server";

import { revalidatePath } from "next/cache";
import { and, eq, ne, sql } from "drizzle-orm";
import { db } from "../db";
import { coachSettings, users } from "../db/schema";
import { requireActor } from "../auth/guards";
import { ValidationError } from "../errors";
import { markAllNotificationsRead } from "../services/notifications";
import { coachProfileSchema, coachSettingsSchema } from "@/lib/validation";
import { formObject, parseInput, runAction, type ActionResult } from "./helpers";

export async function updateCoachSettingsAction(_prev: ActionResult | null, formData: FormData) {
  return runAction(async () => {
    const actor = await requireActor("coach");
    const input = parseInput(coachSettingsSchema, formObject(formData));
    await db
      .insert(coachSettings)
      .values({ coachId: actor.userId, ...input })
      .onConflictDoUpdate({ target: coachSettings.coachId, set: input });
    revalidatePath("/", "layout");
    return null;
  });
}

export async function updateCoachProfileAction(_prev: ActionResult | null, formData: FormData) {
  return runAction(async () => {
    const actor = await requireActor("coach");
    const input = parseInput(coachProfileSchema, formObject(formData));
    const [taken] = await db
      .select({ id: users.id })
      .from(users)
      .where(and(sql`lower(${users.email}) = ${input.email}`, ne(users.id, actor.userId)))
      .limit(1);
    if (taken) throw new ValidationError("That email is already in use.", { email: ["That email is already in use."] });
    await db.update(users).set({ name: input.name, email: input.email }).where(eq(users.id, actor.userId));
    revalidatePath("/", "layout");
    return null;
  });
}

export async function markNotificationsReadAction() {
  return runAction(async () => {
    const actor = await requireActor();
    await markAllNotificationsRead(actor);
    revalidatePath("/", "layout");
    return null;
  });
}
