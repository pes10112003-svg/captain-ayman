import { sql } from "drizzle-orm";
import { db } from "../db";
import { RateLimitError } from "../errors";
import { env } from "../env";

/**
 * Fixed-window rate limiter backed by Postgres, so limits hold across multiple app instances
 * without Redis. One atomic UPSERT per check.
 */
export async function hitRateLimit(key: string, limit: number, windowSeconds: number) {
  const res = await db.execute<{ count: number; reset_at: string | Date }>(sql`
    INSERT INTO rate_limits (key, count, reset_at)
    VALUES (${key}, 1, now() + make_interval(secs => ${windowSeconds}))
    ON CONFLICT (key) DO UPDATE SET
      count    = CASE WHEN rate_limits.reset_at <= now() THEN 1 ELSE rate_limits.count + 1 END,
      reset_at = CASE WHEN rate_limits.reset_at <= now() THEN EXCLUDED.reset_at ELSE rate_limits.reset_at END
    RETURNING count, reset_at
  `);
  const row = res.rows[0]!;
  const resetAt = new Date(row.reset_at);
  return { allowed: Number(row.count) <= limit, count: Number(row.count), resetAt };
}

export async function assertRateLimit(key: string, limit: number, windowSeconds: number) {
  const r = await hitRateLimit(key, limit, windowSeconds);
  if (!r.allowed) throw new RateLimitError((r.resetAt.getTime() - Date.now()) / 1000);
}

/** Read-only check: throws if `key` has already reached `limit` in its current window. */
export async function assertNotLimited(key: string, limit: number) {
  const res = await db.execute<{ count: number; reset_at: string | Date }>(
    sql`SELECT count, reset_at FROM rate_limits WHERE key = ${key} AND reset_at > now()`,
  );
  const row = res.rows[0];
  if (row && Number(row.count) >= limit) throw new RateLimitError((new Date(row.reset_at).getTime() - Date.now()) / 1000);
}

export async function clearRateLimit(key: string) {
  await db.execute(sql`DELETE FROM rate_limits WHERE key = ${key}`);
}

/** Housekeeping — called by the daily cron. */
export async function pruneRateLimits() {
  await db.execute(sql`DELETE FROM rate_limits WHERE reset_at < now() - interval '1 day'`);
}

/**
 * Best-effort client IP. Only trusts X-Forwarded-For's first hop when TRUST_PROXY=true
 * (i.e. you run behind a reverse proxy that overwrites the header).
 */
export function clientIp(headers: Headers): string | null {
  const xff = headers.get("x-forwarded-for");
  if (env().TRUST_PROXY) {
    return xff?.split(",")[0]?.trim() || headers.get("x-real-ip") || null;
  }
  // Without a trusted proxy, the right-most hop is the one our own server observed.
  const hops = xff?.split(",").map((s) => s.trim()).filter(Boolean);
  return hops?.length ? hops[hops.length - 1]! : null;
}
