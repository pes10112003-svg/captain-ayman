/** Unit conversion — values are stored canonically in metric (kg / cm) and converted for display. */

export type WeightUnit = "kg" | "lb";
export type LengthUnit = "cm" | "in";
export type UnitPrefs = { weightUnit: WeightUnit; lengthUnit: LengthUnit };

export const KG_PER_LB = 0.45359237;
export const CM_PER_IN = 2.54;

export const round = (n: number, digits = 1) => {
  const f = 10 ** digits;
  return Math.round(n * f) / f;
};

export const kgTo = (kg: number, unit: WeightUnit) => (unit === "kg" ? kg : kg / KG_PER_LB);
export const toKg = (value: number, unit: WeightUnit) => (unit === "kg" ? value : value * KG_PER_LB);
export const cmTo = (cm: number, unit: LengthUnit) => (unit === "cm" ? cm : cm / CM_PER_IN);
export const toCm = (value: number, unit: LengthUnit) => (unit === "cm" ? value : value * CM_PER_IN);

export function formatWeight(kg: number | null | undefined, unit: WeightUnit, digits = 1) {
  if (kg == null) return "—";
  return `${round(kgTo(kg, unit), digits)} ${unit}`;
}

export function formatLength(cm: number | null | undefined, unit: LengthUnit, digits = 1) {
  if (cm == null) return "—";
  return `${round(cmTo(cm, unit), digits)} ${unit}`;
}

export function formatSignedWeight(kg: number | null | undefined, unit: WeightUnit) {
  if (kg == null) return "—";
  const v = round(kgTo(kg, unit), 1);
  return `${v > 0 ? "+" : v < 0 ? "−" : "±"}${Math.abs(v)} ${unit}`;
}

export type MeasurementKind = "mass" | "length" | "percent" | "index" | "other";

/** Convert a canonical measurement value into the coach's preferred display unit. */
export function displayMeasurement(kind: MeasurementKind, value: number, canonicalUnit: string, prefs: UnitPrefs) {
  if (kind === "mass") return { value: round(kgTo(value, prefs.weightUnit), 1), unit: prefs.weightUnit };
  if (kind === "length") return { value: round(cmTo(value, prefs.lengthUnit), 1), unit: prefs.lengthUnit };
  return { value: round(value, 1), unit: canonicalUnit };
}

/** Convert a value typed in the display unit back to canonical storage. */
export function toCanonicalMeasurement(kind: MeasurementKind, value: number, prefs: UnitPrefs) {
  if (kind === "mass") return round(toKg(value, prefs.weightUnit), 2);
  if (kind === "length") return round(toCm(value, prefs.lengthUnit), 2);
  return round(value, 2);
}

export function inputUnitFor(kind: MeasurementKind, canonicalUnit: string, prefs: UnitPrefs) {
  if (kind === "mass") return prefs.weightUnit;
  if (kind === "length") return prefs.lengthUnit;
  return canonicalUnit;
}

export function bmi(weightKg: number | null | undefined, heightCm: number | null | undefined) {
  if (!weightKg || !heightCm) return null;
  const m = heightCm / 100;
  return round(weightKg / (m * m), 1);
}
