import { and, asc, desc, eq, isNull, or } from "drizzle-orm";
import { db, type Tx } from "../db";
import { clients, measurementTypes, measurements } from "../db/schema";
import { assertCoach, authorizeClient } from "../authz";
import { logActivity } from "../activity";
import { NotFoundError, ValidationError } from "../errors";
import type { Actor } from "../auth/types";
import { getCoachPrefs } from "./settings";
import { bmi, displayMeasurement, round, toCanonicalMeasurement, type MeasurementKind } from "@/lib/units";
import { isUuid } from "@/lib/utils";

export type MeasurementTypeRow = typeof measurementTypes.$inferSelect;

export async function listMeasurementTypes(coachId: string) {
  return db
    .select()
    .from(measurementTypes)
    .where(or(isNull(measurementTypes.coachId), eq(measurementTypes.coachId, coachId)))
    .orderBy(asc(measurementTypes.isSystem), asc(measurementTypes.position), asc(measurementTypes.createdAt))
    .then((rows) => [...rows.filter((r) => r.isSystem), ...rows.filter((r) => !r.isSystem)]);
}

export async function createMeasurementType(actor: Actor, input: { name: string; kind: MeasurementKind; unit: string }) {
  assertCoach(actor);
  const unit = input.kind === "mass" ? "kg" : input.kind === "length" ? "cm" : input.kind === "percent" ? "%" : input.unit;
  const base = input.name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 28) || "custom";
  const key = `${base}_${Math.random().toString(36).slice(2, 7)}`;
  const [row] = await db
    .insert(measurementTypes)
    .values({ coachId: actor.userId, key, name: input.name, kind: input.kind, unit, isSystem: false, position: 100 })
    .returning();
  return row!;
}

/** Keeps the denormalised current weight / height on the client row in sync with history. */
async function recalcBodyStats(tx: Tx, clientId: string, types: MeasurementTypeRow[]) {
  const weightType = types.find((t) => t.key === "weight" && t.isSystem);
  const heightType = types.find((t) => t.key === "height" && t.isSystem);
  const latest = async (typeId?: string) => {
    if (!typeId) return null;
    const [row] = await tx
      .select({ value: measurements.value })
      .from(measurements)
      .where(and(eq(measurements.clientId, clientId), eq(measurements.typeId, typeId)))
      .orderBy(desc(measurements.measuredOn), desc(measurements.createdAt))
      .limit(1);
    return row?.value ?? null;
  };
  const [client] = await tx.select().from(clients).where(eq(clients.id, clientId)).limit(1);
  const weight = await latest(weightType?.id);
  const height = await latest(heightType?.id);
  await tx
    .update(clients)
    .set({
      currentWeightKg: weight ?? client?.startingWeightKg ?? null,
      ...(height != null ? { heightCm: height } : {}),
    })
    .where(eq(clients.id, clientId));
}

export async function addMeasurements(
  actor: Actor,
  clientId: string,
  input: { measuredOn: string; note: string | null; values: { typeId: string; value: number }[] },
) {
  assertCoach(actor);
  const { client } = await authorizeClient(actor, clientId);
  const prefs = await getCoachPrefs(actor.userId);
  const types = await listMeasurementTypes(actor.userId);
  const typeById = new Map(types.map((t) => [t.id, t]));

  const seen = new Set<string>();
  const rows = input.values.map((v) => {
    const type = typeById.get(v.typeId);
    if (!type) throw new ValidationError("Unknown measurement type.");
    if (seen.has(type.id)) throw new ValidationError(`${type.name} was entered twice.`);
    seen.add(type.id);
    const value = toCanonicalMeasurement(type.kind, v.value, prefs);
    if (type.kind === "percent" && value > 100) throw new ValidationError(`${type.name} must be 100% or less.`);
    return { clientId: client.id, typeId: type.id, value, unit: type.unit, measuredOn: input.measuredOn, note: input.note, recordedById: actor.userId };
  });

  // Auto-derive BMI when weight is recorded, height is known and BMI wasn't typed in.
  const weightType = types.find((t) => t.key === "weight" && t.isSystem);
  const heightType = types.find((t) => t.key === "height" && t.isSystem);
  const bmiType = types.find((t) => t.key === "bmi" && t.isSystem);
  const weightRow = rows.find((r) => r.typeId === weightType?.id);
  const heightRow = rows.find((r) => r.typeId === heightType?.id);
  if (weightRow && bmiType && !seen.has(bmiType.id)) {
    const value = bmi(weightRow.value, heightRow?.value ?? client.heightCm);
    if (value) rows.push({ ...weightRow, typeId: bmiType.id, value, unit: bmiType.unit, note: "Auto-calculated from weight & height" });
  }

  await db.transaction(async (tx) => {
    await tx.insert(measurements).values(rows);
    await recalcBodyStats(tx, client.id, types);
    await logActivity(
      {
        actorId: actor.userId,
        clientId: client.id,
        coachId: actor.userId,
        action: "coach.measurements.added",
        entityType: "measurement",
        metadata: { date: input.measuredOn, count: rows.length, types: rows.map((r) => typeById.get(r.typeId)?.name) },
      },
      tx,
    );
  });
  return { count: rows.length };
}

export async function deleteMeasurement(actor: Actor, clientId: string, measurementId: string) {
  assertCoach(actor);
  const { client } = await authorizeClient(actor, clientId);
  if (!isUuid(measurementId)) throw new NotFoundError("Measurement not found.");
  const types = await listMeasurementTypes(actor.userId);
  await db.transaction(async (tx) => {
    const deleted = await tx
      .delete(measurements)
      .where(and(eq(measurements.id, measurementId), eq(measurements.clientId, client.id)))
      .returning();
    if (!deleted.length) throw new NotFoundError("Measurement not found.");
    await recalcBodyStats(tx, client.id, types);
    await logActivity(
      {
        actorId: actor.userId,
        clientId: client.id,
        coachId: actor.userId,
        action: "coach.measurement.deleted",
        entityType: "measurement",
        entityId: measurementId,
        metadata: { date: deleted[0]!.measuredOn, value: deleted[0]!.value, unit: deleted[0]!.unit },
      },
      tx,
    );
  });
}

/**
 * Progress read model. `viewProgress` unlocks the body-composition summary & weight trend;
 * `viewMeasurements` additionally unlocks the detailed tape-measure history.
 */
export async function getProgress(actor: Actor, clientId: string) {
  const scope = await authorizeClient(actor, clientId, "viewProgress");
  const { client, permissions } = scope;
  const prefs = await getCoachPrefs(client.coachId);
  const types = await listMeasurementTypes(client.coachId);
  const typeById = new Map(types.map((t) => [t.id, t]));
  const detailed = actor.role === "coach" || permissions.viewMeasurements;

  const rows = await db
    .select()
    .from(measurements)
    .where(eq(measurements.clientId, client.id))
    .orderBy(asc(measurements.measuredOn), asc(measurements.createdAt));

  const summaryKeys = new Set(["weight", "body_fat", "muscle_mass", "bmi"]);
  const visible = rows.filter((r) => {
    const t = typeById.get(r.typeId);
    return t && (detailed || (t.isSystem && summaryKeys.has(t.key)));
  });

  const series: Record<string, { date: string; value: number }[]> = {};
  for (const r of visible) {
    const t = typeById.get(r.typeId)!;
    const d = displayMeasurement(t.kind, r.value, t.unit, prefs);
    (series[t.id] ??= []).push({ date: r.measuredOn, value: d.value });
  }

  const byDate = new Map<string, typeof visible>();
  for (const r of visible) byDate.set(r.measuredOn, [...(byDate.get(r.measuredOn) ?? []), r]);
  const entries = [...byDate.entries()]
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .map(([date, list]) => ({
      date,
      note: list.find((l) => l.note && !l.note.startsWith("Auto-calculated"))?.note ?? null,
      values: list.map((r) => {
        const t = typeById.get(r.typeId)!;
        const d = displayMeasurement(t.kind, r.value, t.unit, prefs);
        return { id: r.id, typeId: t.id, key: t.key, name: t.name, value: d.value, unit: d.unit, auto: !!r.note?.startsWith("Auto-calculated") };
      }),
    }));

  const typeKey = (key: string) => types.find((t) => t.key === key && t.isSystem);
  const latestOf = (key: string) => {
    const t = typeKey(key);
    const list = t ? series[t.id] : undefined;
    return list?.length ? list[list.length - 1]! : null;
  };
  const firstOf = (key: string) => {
    const t = typeKey(key);
    const list = t ? series[t.id] : undefined;
    return list?.length ? list[0]! : null;
  };

  const weightKey = typeKey("weight");
  const weightSeriesKg = rows.filter((r) => r.typeId === weightKey?.id);
  const startingKg = client.startingWeightKg ?? weightSeriesKg[0]?.value ?? null;
  const currentKg = client.currentWeightKg ?? startingKg;

  return {
    prefs,
    detailed,
    permissions,
    client: { id: client.id, heightCm: client.heightCm, goalWeightKg: client.goalWeightKg },
    types: types.filter((t) => series[t.id]?.length || detailed),
    series,
    entries,
    summary: {
      startingWeightKg: startingKg,
      currentWeightKg: currentKg,
      changeKg: startingKg != null && currentKg != null ? round(currentKg - startingKg, 2) : null,
      goalWeightKg: client.goalWeightKg,
      bodyFat: latestOf("body_fat"),
      bodyFatStart: firstOf("body_fat"),
      muscleMass: latestOf("muscle_mass"),
      muscleMassStart: firstOf("muscle_mass"),
      bmi: latestOf("bmi")?.value ?? bmi(currentKg, client.heightCm),
      lastMeasuredOn: rows.length ? rows[rows.length - 1]!.measuredOn : null,
    },
  };
}
export type ProgressData = Awaited<ReturnType<typeof getProgress>>;
