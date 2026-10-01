import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { ForbiddenError, RateLimitError, toSafeError } from "../errors";
import { env } from "../env";
import { requireActor } from "../auth/guards";
import type { Actor, Role } from "../auth/types";
import { getLocale } from "@/i18n/server";
import { translateFieldErrors, translateServerMessage } from "@/i18n/server-messages";

type Ctx<P> = { params: Promise<P> };
type Handler<P, A> = (req: NextRequest, ctx: { actor: A; params: P }) => Promise<Response | object | null>;

/** Rejects cross-site state-changing requests (defence in depth on top of SameSite cookies). */
function assertSameOrigin(req: NextRequest) {
  if (req.headers.get("sec-fetch-site") === "cross-site") throw new ForbiddenError("Cross-site request blocked.");
  const origin = req.headers.get("origin");
  if (!origin) return;
  const allowed = new Set([new URL(env().APP_URL).origin, req.nextUrl.origin]);
  if (!allowed.has(origin)) throw new ForbiddenError("Cross-site request blocked.");
}

async function errorResponse(err: unknown) {
  const safe = toSafeError(err);
  const locale = await getLocale().catch(() => "ar" as const);
  safe.message = translateServerMessage(safe.message, locale);
  safe.fieldErrors = translateFieldErrors(safe.fieldErrors, locale);
  const headers: Record<string, string> = { "Cache-Control": "no-store" };
  if (err instanceof RateLimitError) headers["Retry-After"] = String(Math.ceil(err.retryAfterSeconds));
  return NextResponse.json(
    { error: { code: safe.code, message: safe.message, ...(safe.fieldErrors ? { fieldErrors: safe.fieldErrors } : {}) } },
    { status: safe.status, headers },
  );
}

/** Authenticated JSON route: session required, optional role, uniform error mapping. */
export function apiRoute<P = Record<string, never>>(handler: Handler<P, Actor>, opts: { role?: Role } = {}) {
  return async (req: NextRequest, ctx: Ctx<P>) => {
    try {
      if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) assertSameOrigin(req);
      const actor = await requireActor(opts.role);
      const result = await handler(req, { actor, params: await ctx.params });
      if (result instanceof Response) return result;
      return NextResponse.json(result ?? { ok: true }, { headers: { "Cache-Control": "no-store" } });
    } catch (err) {
      return await errorResponse(err);
    }
  };
}

export async function readJson(req: NextRequest) {
  try {
    return await req.json();
  } catch {
    return {};
  }
}
