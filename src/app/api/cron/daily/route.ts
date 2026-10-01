import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { lt } from "drizzle-orm";
import { env } from "@/server/env";
import { db } from "@/server/db";
import { sessions } from "@/server/db/schema";
import { pruneRateLimits } from "@/server/auth/rate-limit";
import { runDailySnapshotForAllCoaches } from "@/server/services/snapshots";

/**
 * Daily maintenance — call once a day shortly after midnight in the coach timezone:
 *   curl -H "Authorization: Bearer $CRON_SECRET" https://your-app/api/cron/daily
 * Materialises today's workouts/meals for every active client (so missed days are recorded),
 * and prunes expired sessions and rate-limit buckets.
 */
async function handle(req: NextRequest) {
  const secret = env().CRON_SECRET;
  const given = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const ok = !!secret && secret.length >= 16 && given.length === secret.length && timingSafeEqual(Buffer.from(given), Buffer.from(secret));
  if (!ok) return NextResponse.json({ error: { code: "unauthorized", message: "Unauthorized" } }, { status: 401 });
  const snapshots = await runDailySnapshotForAllCoaches();
  await db.delete(sessions).where(lt(sessions.expiresAt, new Date()));
  await pruneRateLimits();
  return NextResponse.json({ ok: true, snapshots }, { headers: { "Cache-Control": "no-store" } });
}

export const GET = handle;
export const POST = handle;
