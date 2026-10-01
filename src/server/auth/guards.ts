import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { ForbiddenError, UnauthorizedError } from "../errors";
import { getCurrentActor } from "./session";
import type { Actor, Role } from "./types";

async function loginRedirect(): Promise<never> {
  const path = (await headers()).get("x-pathname");
  const next = path && path.startsWith("/") && !path.startsWith("//") ? `?next=${encodeURIComponent(path)}` : "";
  redirect(`/login${next}`);
}

/** Page guard: any signed-in user. */
export async function requirePageActor(opts: { allowPasswordChange?: boolean } = {}): Promise<Actor> {
  const actor = await getCurrentActor();
  if (!actor) return loginRedirect();
  if (actor.mustChangePassword && !opts.allowPasswordChange) redirect("/change-password");
  return actor;
}

/** Page guard for the coach area. Clients are bounced to their own area — no coach data is ever rendered. */
export async function requireCoachPage(): Promise<Actor> {
  const actor = await requirePageActor();
  if (actor.role !== "coach") redirect("/client");
  return actor;
}

/** Page guard for the client area. */
export async function requireClientPage(): Promise<Actor & { clientId: string }> {
  const actor = await requirePageActor();
  if (actor.role !== "client" || !actor.clientId) redirect("/coach");
  return actor as Actor & { clientId: string };
}

/** Guard for server actions and API routes — throws typed errors instead of redirecting. */
export async function requireActor(role?: Role, opts: { allowPasswordChange?: boolean } = {}): Promise<Actor> {
  const actor = await getCurrentActor();
  if (!actor) throw new UnauthorizedError();
  if (actor.mustChangePassword && !opts.allowPasswordChange) throw new ForbiddenError("Please set a new password first.");
  if (role && actor.role !== role) throw new ForbiddenError();
  return actor;
}

export const homePathFor = (actor: Pick<Actor, "role">) => (actor.role === "coach" ? "/coach" : "/client");
