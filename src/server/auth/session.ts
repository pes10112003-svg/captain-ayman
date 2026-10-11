import "server-only";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { and, eq, gt, lt, ne } from "drizzle-orm";
import { db } from "../db";
import { clients, sessions, users } from "../db/schema";
import { env } from "../env";
import { clientIp } from "./rate-limit";
import { generateToken, hashToken } from "./tokens";
import type { Actor } from "./types";

const TOUCH_INTERVAL_MS = 10 * 60 * 1000;

export function sessionCookieName() {
  return env().APP_URL.startsWith("https://") ? "__Host-kinetic_session" : "kinetic_session";
}

function cookieOptions(maxAgeSeconds: number) {
  return {
    httpOnly: true,
    secure: env().APP_URL.startsWith("https://"),
    sameSite: "lax" as const,
    path: "/",
    maxAge: maxAgeSeconds,
  };
}

/** Creates a DB-backed session and sets the httpOnly cookie. Only call from server actions / route handlers. */
export async function createSession(userId: string) {
  const token = generateToken();
  const ttlSeconds = env().SESSION_TTL_DAYS * 86_400;
  const h = await headers();
  await db.insert(sessions).values({
    userId,
    tokenHash: hashToken(token),
    expiresAt: new Date(Date.now() + ttlSeconds * 1000),
    ipAddress: clientIp(h)?.slice(0, 64) ?? null,
    userAgent: h.get("user-agent")?.slice(0, 400) ?? null,
  });
  (await cookies()).set(sessionCookieName(), token, cookieOptions(ttlSeconds));
}

/** Resolve a raw session token into an Actor, or null if invalid/expired/disabled. */
export async function resolveSessionToken(token: string | undefined | null): Promise<Actor | null> {
  if (!token || token.length < 20 || token.length > 128) return null;
  const now = new Date();
  const [row] = await db
    .select({
      sessionId: sessions.id,
      lastUsedAt: sessions.lastUsedAt,
      userId: users.id,
      role: users.role,
      name: users.name,
      email: users.email,
      isActive: users.isActive,
      mustChangePassword: users.mustChangePassword,
    })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.tokenHash, hashToken(token)), gt(sessions.expiresAt, now)))
    .limit(1);

  if (!row || !row.isActive) return null;

  let clientId: string | null = null;
  let coachId = row.userId;
  if (row.role === "client") {
    const [client] = await db
      .select({ id: clients.id, coachId: clients.coachId, status: clients.status })
      .from(clients)
      .where(eq(clients.userId, row.userId))
      .limit(1);
    // A deactivated client loses access immediately, even with a live cookie.
    if (!client || client.status !== "active") return null;
    clientId = client.id;
    coachId = client.coachId;
  }

  if (now.getTime() - row.lastUsedAt.getTime() > TOUCH_INTERVAL_MS) {
    await db.update(sessions).set({ lastUsedAt: now }).where(eq(sessions.id, row.sessionId));
  }

  return {
    sessionId: row.sessionId,
    userId: row.userId,
    role: row.role,
    name: row.name,
    email: row.email,
    clientId,
    coachId,
    mustChangePassword: row.mustChangePassword,
  };
}

/** Per-request memoised current actor (works in RSC, server actions and route handlers). */
export const getCurrentActor = cache(async (): Promise<Actor | null> => {
  const token = (await cookies()).get(sessionCookieName())?.value;
  return resolveSessionToken(token);
});

export async function destroyCurrentSession() {
  const jar = await cookies();
  const token = jar.get(sessionCookieName())?.value;
  if (token) await db.delete(sessions).where(eq(sessions.tokenHash, hashToken(token)));
  jar.delete(sessionCookieName());
}

/** Sign a user out everywhere (password change, account disabled, password reset). */
export async function revokeUserSessions(userId: string, exceptSessionId?: string) {
  await db
    .delete(sessions)
    .where(exceptSessionId ? and(eq(sessions.userId, userId), ne(sessions.id, exceptSessionId)) : eq(sessions.userId, userId));
}

export async function pruneExpiredSessions() {
  await db.delete(sessions).where(lt(sessions.expiresAt, new Date()));
}
