import "server-only";
import { unstable_rethrow } from "next/navigation";
import type { z } from "zod";
import { ValidationError, toSafeError } from "../errors";
import { fieldErrors } from "@/lib/validation";
import { getLocale } from "@/i18n/server";
import { translateFieldErrors, translateServerMessage } from "@/i18n/server-messages";

export type ActionResult<T = null> =
  | { ok: true; data: T }
  | { ok: false; error: string; code?: string; fieldErrors?: Record<string, string[]> };

/** Wraps a server action: typed success, safe error messages, and Next redirects preserved. */
export async function runAction<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (err) {
    unstable_rethrow(err);
    const safe = toSafeError(err);
    const locale = await getLocale().catch(() => "ar" as const);
    return {
      ok: false,
      error: translateServerMessage(safe.message, locale),
      code: safe.code,
      fieldErrors: translateFieldErrors(safe.fieldErrors, locale),
    };
  }
}

export function parseInput<S extends z.ZodType>(schema: S, input: unknown): z.infer<S> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) throw new ValidationError("Please check the highlighted fields.", fieldErrors(parsed.error));
  return parsed.data;
}

export function formObject(formData: FormData) {
  const obj: Record<string, FormDataEntryValue> = {};
  for (const [k, v] of formData.entries()) if (!k.startsWith("$ACTION")) obj[k] = v;
  return obj;
}
