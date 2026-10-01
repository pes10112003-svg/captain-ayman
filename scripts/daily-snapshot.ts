/**
 * Materialise today's workouts & meals for every active client and prune expired sessions.
 * Schedule once a day shortly after midnight in the coach timezone (system cron, k8s CronJob…):
 *   5 0 * * *  cd /app && npm run cron:daily
 * Alternatively call GET /api/cron/daily with `Authorization: Bearer $CRON_SECRET`.
 */
import "dotenv/config";
import { lt } from "drizzle-orm";
import { db, pool } from "@/server/db";
import { sessions } from "@/server/db/schema";
import { pruneRateLimits } from "@/server/auth/rate-limit";
import { runDailySnapshotForAllCoaches } from "@/server/services/snapshots";

async function main() {
  const res = await runDailySnapshotForAllCoaches();
  await db.delete(sessions).where(lt(sessions.expiresAt, new Date()));
  await pruneRateLimits();
  console.log("✓ Daily snapshot", JSON.stringify(res));
  await pool.end();
}

main().catch(async (e) => {
  console.error(e);
  await pool.end();
  process.exit(1);
});
