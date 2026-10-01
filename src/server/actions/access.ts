"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireActor } from "../auth/guards";
import { assertNotLimited, clearRateLimit, clientIp, hitRateLimit } from "../auth/rate-limit";
import { grantAccess, verifyAccessCode } from "../auth/gate";
import { updateAccessCode } from "../services/access";
import { runSetup } from "../services/setup";
import { ValidationError } from "../errors";
import { fieldErrors, password as passwordSchema } from "@/lib/validation";
import { runAction, type ActionResult } from "./helpers";

const ACCESS_LIMIT = 10;
const ACCESS_WINDOW = 15 * 60;

function safeNext(next: unknown) {
  if (typeof next !== "string" || !next.startsWith("/") || next.startsWith("//") || next.includes("\\") || next.startsWith("/access")) return "/login";
  return next;
}

/** Visitor enters the site access code → gets a long-lived, signed access cookie for this device. */
export async function enterAccessCodeAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const code = String(formData.get("code") ?? "").trim();
  const result = await runAction(async () => {
    if (!code) throw new ValidationError("Enter the access code.", { code: ["Enter the access code."] });
    const key = `access:${clientIp(await headers()) ?? "unknown"}`;
    await assertNotLimited(key, ACCESS_LIMIT);
    if (!(await verifyAccessCode(code))) {
      await hitRateLimit(key, ACCESS_LIMIT, ACCESS_WINDOW);
      throw new ValidationError("That access code isn't correct.", { code: ["That access code isn't correct."] });
    }
    await clearRateLimit(key);
    await grantAccess();
    return null;
  });
  if (!result.ok) return result;
  redirect(safeNext(formData.get("next")));
}

/** Coach changes the access code (or turns it off). The coach's own device keeps access. */
export async function updateAccessCodeAction(code: string | null) {
  return runAction(async () => {
    const actor = await requireActor("coach");
    await updateAccessCode(actor, code === null ? null : z.string().max(60).parse(code));
    await grantAccess();
    revalidatePath("/coach/settings");
    return null;
  });
}

const setupSchema = z.object({
  adminKey: z.string().min(1).max(200),
  mode: z.enum(["create", "reset"]),
  name: z.string().trim().max(120).optional(),
  email: z.string().trim().email({ error: "Enter a valid email address" }).max(254),
  password: passwordSchema,
  accessCode: z.string().trim().max(60).optional(),
});

export async function setupAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const result = await runAction(async () => {
    const parsed = setupSchema.safeParse({
      adminKey: formData.get("adminKey"),
      mode: formData.get("mode"),
      name: formData.get("name") || undefined,
      email: formData.get("email"),
      password: formData.get("password"),
      accessCode: formData.get("accessCode") || undefined,
    });
    if (!parsed.success) throw new ValidationError(undefined, fieldErrors(parsed.error));
    await runSetup(parsed.data, clientIp(await headers()));
    // The administrator's own browser can open the app right away.
    await grantAccess();
    return null;
  });
  return result;
}
