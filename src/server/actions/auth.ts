"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { clientIp } from "../auth/rate-limit";
import { createSession, destroyCurrentSession } from "../auth/session";
import { homePathFor, requireActor } from "../auth/guards";
import { authenticate, changePassword, requestPasswordReset, resetPasswordWithToken } from "../services/auth";
import { changePasswordSchema, fieldErrors, loginSchema, resetPasswordSchema } from "@/lib/validation";
import { runAction, type ActionResult } from "./helpers";
import { ValidationError, toSafeError } from "../errors";
import { getLocale } from "@/i18n/server";
import { translateFieldErrors, translateServerMessage } from "@/i18n/server-messages";

async function localized(result: { ok: false; error: string; code?: string; fieldErrors?: Record<string, string[]> }) {
  const locale = await getLocale();
  return { ...result, error: translateServerMessage(result.error, locale), fieldErrors: translateFieldErrors(result.fieldErrors, locale) };
}

function safeNext(next: unknown, role: "coach" | "client") {
  if (typeof next !== "string" || !next.startsWith("/") || next.startsWith("//") || next.includes("\\")) return null;
  return next.startsWith(role === "coach" ? "/coach" : "/client") ? next : null;
}

export async function loginAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const parsed = loginSchema.safeParse({ email: formData.get("email"), password: formData.get("password") });
  if (!parsed.success) return localized({ ok: false, error: "Enter your email and password.", fieldErrors: fieldErrors(parsed.error) });

  let target: string;
  try {
    const user = await authenticate(parsed.data.email, parsed.data.password, clientIp(await headers()));
    await destroyCurrentSession();
    await createSession(user.id);
    target = user.mustChangePassword ? "/change-password" : (safeNext(formData.get("next"), user.role) ?? homePathFor(user));
  } catch (err) {
    const safe = toSafeError(err);
    return localized({ ok: false, error: safe.message, code: safe.code });
  }
  redirect(target);
}

export async function logoutAction() {
  await destroyCurrentSession();
  redirect("/login");
}

export async function changePasswordAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const result = await runAction(async () => {
    const actor = await requireActor(undefined, { allowPasswordChange: true });
    const parsed = changePasswordSchema.safeParse({
      currentPassword: formData.get("currentPassword") ?? undefined,
      newPassword: formData.get("newPassword"),
      confirmPassword: formData.get("confirmPassword"),
    });
    if (!parsed.success) throw new ValidationError(undefined, fieldErrors(parsed.error));
    await changePassword(actor, parsed.data.currentPassword || undefined, parsed.data.newPassword);
    return actor;
  });
  if (!result.ok) return result;
  if (formData.get("redirect") === "home") redirect(homePathFor(result.data));
  return { ok: true, data: null };
}

export async function forgotPasswordAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const email = z.string().trim().max(254).safeParse(formData.get("email"));
  if (!email.success || !email.data.includes("@")) {
    return localized({ ok: false, error: "Enter a valid email address.", fieldErrors: { email: ["Enter a valid email address."] } });
  }
  return runAction(async () => {
    await requestPasswordReset(email.data, clientIp(await headers()));
    return null;
  });
}

export async function resetPasswordAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const parsed = resetPasswordSchema.safeParse({
    token: formData.get("token"),
    newPassword: formData.get("newPassword"),
    confirmPassword: formData.get("confirmPassword"),
  });
  if (!parsed.success) return localized({ ok: false, error: "Please check the highlighted fields.", fieldErrors: fieldErrors(parsed.error) });
  const result = await runAction(() => resetPasswordWithToken(parsed.data.token, parsed.data.newPassword));
  if (!result.ok) return result;
  redirect("/login?reset=1");
}
