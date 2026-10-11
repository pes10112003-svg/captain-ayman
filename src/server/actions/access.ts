"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { clientIp } from "../auth/rate-limit";
import { runSetup } from "../services/setup";
import { ValidationError } from "../errors";
import { fieldErrors, password as passwordSchema } from "@/lib/validation";
import { runAction, type ActionResult } from "./helpers";

const setupSchema = z.object({
  adminKey: z.string().min(1).max(200),
  mode: z.enum(["create", "reset"]),
  name: z.string().trim().max(120).optional(),
  email: z.string().trim().email({ error: "Enter a valid email address" }).max(254),
  password: passwordSchema,
});

/** Admin setup & recovery (/setup): create the coach account or reset its password with ADMIN_KEY. */
export async function setupAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const parsed = setupSchema.safeParse({
      adminKey: formData.get("adminKey"),
      mode: formData.get("mode"),
      name: formData.get("name") || undefined,
      email: formData.get("email"),
      password: formData.get("password"),
    });
    if (!parsed.success) throw new ValidationError(undefined, fieldErrors(parsed.error));
    await runSetup(parsed.data, clientIp(await headers()));
    return null;
  });
}
