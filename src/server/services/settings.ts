import { eq } from "drizzle-orm";
import { db, type Executor } from "../db";
import { coachSettings } from "../db/schema";
import { env } from "../env";
import { todayInTz } from "@/lib/time";
import type { UnitPrefs } from "@/lib/units";

export type CoachPrefs = UnitPrefs & {
  coachId: string;
  timezone: string;
  weekStartsOn: number;
  businessName: string | null;
  lastSnapshotDate: string | null;
};

export async function getCoachPrefs(coachId: string, dbx: Executor = db): Promise<CoachPrefs> {
  const [row] = await dbx.select().from(coachSettings).where(eq(coachSettings.coachId, coachId)).limit(1);
  if (row) {
    return {
      coachId,
      timezone: row.timezone,
      weightUnit: row.weightUnit,
      lengthUnit: row.lengthUnit,
      weekStartsOn: row.weekStartsOn,
      businessName: row.businessName,
      lastSnapshotDate: row.lastSnapshotDate,
    };
  }
  const [created] = await dbx
    .insert(coachSettings)
    .values({ coachId, timezone: env().APP_TIMEZONE })
    .onConflictDoNothing()
    .returning();
  const tz = created?.timezone ?? env().APP_TIMEZONE;
  return { coachId, timezone: tz, weightUnit: "kg", lengthUnit: "cm", weekStartsOn: 1, businessName: null, lastSnapshotDate: null };
}

export async function coachToday(coachId: string, dbx: Executor = db) {
  const prefs = await getCoachPrefs(coachId, dbx);
  return { prefs, today: todayInTz(prefs.timezone) };
}
