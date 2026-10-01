import type { Dict } from "./en";

/** English names of the built-in measurement types (as stored in the DB / older audit rows) → key. */
const SYSTEM_TYPE_BY_NAME: Record<string, string> = {
  Weight: "weight",
  Height: "height",
  "Body fat": "body_fat",
  "Muscle mass": "muscle_mass",
  BMI: "bmi",
  Waist: "waist",
  Abdomen: "abdomen",
  Chest: "chest",
  Shoulders: "shoulders",
  Arms: "arms",
  Thighs: "thighs",
  Hips: "hips",
};

/** Built-in measurement types are translated; coach-created custom types keep the coach's own name. */
export function measureTypeLabel(t: Dict, type: { key?: string | null; name: string; isSystem?: boolean | null }) {
  const names = t.measureTypes as Record<string, string>;
  if (type.key && (type.isSystem ?? true) && names[type.key]) return names[type.key]!;
  const byName = SYSTEM_TYPE_BY_NAME[type.name];
  if (byName && names[byName]) return names[byName]!;
  return type.name;
}

export const goalLabel = (t: Dict, goal: string | null | undefined) => (goal ? ((t.goals as Record<string, string>)[goal] ?? goal) : "—");
export const genderLabel = (t: Dict, g: string | null | undefined) => (g ? ((t.genders as Record<string, string>)[g] ?? g) : "—");
export const angleLabel = (t: Dict, a: string | null | undefined) => (a ? ((t.angles as Record<string, string>)[a] ?? a) : "");
