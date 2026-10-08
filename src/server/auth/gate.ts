/**
 * Site-wide access code ("gate").
 *
 * When enabled, nobody can reach the sign-in page, any page, server action or API without a
 * valid access cookie — the coach shares the code only with their clients. The cookie holds
 * `<version>.<HMAC(version)>`; changing the code rotates `version`, instantly revoking every
 * device that used the old code (the coach's own browser is re-issued a cookie).
 */
import "server-only";
import { randomUUID } from "node:crypto";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { siteSettings } from "../db/schema";
import { decrypt, encrypt, safeEqual, sign } from "../crypto";
import { env } from "../env";

export const ACCESS_COOKIE = "ca_access";
const TTL_MS = 10_000;
let cached: { enabled: boolean; version: string; codeEnc: string | null; at: number } | null = null;

export function normalizeAccessCode(input: string) {
  return input
    .normalize("NFKC")
    .toUpperCase()
    .replace(/[\s\-_.]/g, "");
}

export async function getGateState(fresh = false) {
  if (!fresh && cached && Date.now() - cached.at < TTL_MS) return cached;
  let [row] = await db.select().from(siteSettings).where(eq(siteSettings.id, 1)).limit(1);
  if (!row) {
    [row] = await db.insert(siteSettings).values({ id: 1 }).onConflictDoNothing().returning();
    row ??= (await db.select().from(siteSettings).where(eq(siteSettings.id, 1)).limit(1))[0];
  }
  cached = { enabled: !!row?.accessCodeEnc, version: row!.accessVersion, codeEnc: row?.accessCodeEnc ?? null, at: Date.now() };
  return cached;
}

export function invalidateGateCache() {
  cached = null;
}

export async function getAccessCode(): Promise<string | null> {
  const s = await getGateState(true);
  return s.codeEnc ? decrypt(s.codeEnc) : null;
}

export async function verifyAccessCode(input: string) {
  const s = await getGateState(true);
  if (!s.codeEnc) return true;
  const code = decrypt(s.codeEnc);
  if (!code) return false;
  return safeEqual(normalizeAccessCode(input), normalizeAccessCode(code));
}

const cookieValue = (version: string) => `${version}.${sign(`access:${version}`)}`;

/** True when the gate is off, or the request carries a cookie for the current code version. */
export async function hasValidAccess(): Promise<boolean> {
  const s = await getGateState();
  if (!s.enabled) return true;
  const raw = (await cookies()).get(ACCESS_COOKIE)?.value;
  if (!raw) return false;
  const [version] = raw.split(".");
  if (version === s.version) return safeEqual(raw, cookieValue(s.version));
  // A cookie for another version: re-check the database before refusing, so a code that was just
  // changed (possibly from another server instance with its own cache) works immediately.
  const fresh = await getGateState(true);
  return version === fresh.version && safeEqual(raw, cookieValue(fresh.version));
}

/** Issue an access cookie for the current version (server actions / route handlers only). */
export async function grantAccess() {
  const s = await getGateState(true);
  (await cookies()).set(ACCESS_COOKIE, cookieValue(s.version), {
    httpOnly: true,
    secure: env().APP_URL.startsWith("https://"),
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
}

/** Set (or clear with null) the access code. Rotates the version → all old cookies stop working. */
export async function setAccessCode(code: string | null, updatedById: string | null) {
  const accessCodeEnc = code ? encrypt(code.trim()) : null;
  const accessVersion = randomUUID();
  await db
    .insert(siteSettings)
    .values({ id: 1, accessCodeEnc, accessVersion, updatedById })
    .onConflictDoUpdate({ target: siteSettings.id, set: { accessCodeEnc, accessVersion, updatedById, updatedAt: new Date() } });
  invalidateGateCache();
}

export function isValidNewAccessCode(code: string) {
  return normalizeAccessCode(code).length >= 6 && /^[\p{L}\p{N}\s\-_.]+$/u.test(code) && code.length <= 40;
}

/** Page guard for public pages (sign-in, password reset): without access, send the visitor to /access. */
export async function requireAccess() {
  if (await hasValidAccess()) return;
  const path = (await headers()).get("x-pathname");
  const next = path && path.startsWith("/") && !path.startsWith("//") && !path.startsWith("/access") ? `?next=${encodeURIComponent(path)}` : "";
  redirect(`/access${next}`);
}
