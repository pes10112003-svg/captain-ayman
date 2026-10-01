import { eq } from "drizzle-orm";
import { db, type Executor } from "../db";
import { coachSettings } from "../db/schema";
import { todayInTz } from "@/lib/time";
import type { UnitPrefs } from "@/lib/units";
import { FIXED_COACH_SETTINGS } from "@/lib/validation";

export type CoachPrefs = UnitPrefs & {
  coachId: string;
  timezone: string;
  weekStartsOn: number;
  businessName: string | null;
  lastSnapshotDate: string | null;
};

export async function getCoachPrefs(coachId: string, dbx: Executor = db): Promise<CoachPrefs> {
  const [row] = await dbx.select().from(coachSettings).where(eq(coachSettings.coachId, coachId)).limit(1);
  // Timezone, units and week start are fixed for this app (Egypt · kg · cm · Saturday).
  const fixed = { ...FIXED_COACH_SETTINGS } as const;
  if (row) {
    return {
      coachId,
      ...fixed,
      businessName: row.businessName,
      lastSnapshotDate: row.lastSnapshotDate,
    };
  }
  await dbx
    .insert(coachSettings)
    .values({ coachId, ...fixed })
    .onConflictDoNothing();
  return { coachId, ...fixed, businessName: null, lastSnapshotDate: null };
}

export async function coachToday(coachId: string, dbx: Executor = db) {
  const prefs = await getCoachPrefs(coachId, dbx);
  return { prefs, today: todayInTz(prefs.timezone) };
}
