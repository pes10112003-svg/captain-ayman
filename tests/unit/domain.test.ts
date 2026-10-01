import { describe, expect, it } from "vitest";
import { computeCompletion } from "@/server/services/workouts";
import { addDays, dayOfWeek, formatClock, isIsoDate, startOfWeek, todayInTz } from "@/lib/time";
import { bmi, toCanonicalMeasurement, displayMeasurement } from "@/lib/units";
import { recordSetSchema, workoutExerciseInput, loginSchema } from "@/lib/validation";

describe("completion maths", () => {
  it("counts reps (capped at target) over total target reps", () => {
    const c = computeCompletion([
      { targetReps: 12, actualReps: 12, status: "completed" },
      { targetReps: 12, actualReps: 12, status: "completed" },
      { targetReps: 12, actualReps: 8, status: "partial" },
      { targetReps: 12, actualReps: null, status: "pending" },
    ]);
    expect(c).toMatchObject({ total: 4, completed: 2, partial: 1, recorded: 3 });
    expect(c.percent).toBeCloseTo((32 / 48) * 100, 2);
  });
  it("never exceeds 100% when a client does extra reps", () => {
    expect(computeCompletion([{ targetReps: 10, actualReps: 15, status: "completed" }]).percent).toBe(100);
  });
});

describe("time helpers", () => {
  it("handles calendar maths without timezone drift", () => {
    expect(addDays("2026-02-28", 1)).toBe("2026-03-01");
    expect(dayOfWeek("2026-10-01")).toBe(4); // Thursday
    expect(startOfWeek("2026-10-01", 1)).toBe("2026-09-28");
    expect(startOfWeek("2026-10-01", 6)).toBe("2026-09-26");
    expect(isIsoDate("2026-02-30")).toBe(false);
    expect(formatClock("20:05:00")).toBe("8:05 PM");
  });
  it("computes 'today' in the configured timezone", () => {
    const instant = new Date("2026-09-30T22:30:00Z");
    expect(todayInTz("Africa/Cairo", instant)).toBe("2026-10-01");
    expect(todayInTz("America/New_York", instant)).toBe("2026-09-30");
  });
});

describe("units", () => {
  it("stores metric canonically and converts for display", () => {
    expect(toCanonicalMeasurement("mass", 176.4, { weightUnit: "lb", lengthUnit: "cm" })).toBeCloseTo(80.01, 1);
    expect(displayMeasurement("length", 100, "cm", { weightUnit: "kg", lengthUnit: "in" }).value).toBeCloseTo(39.4, 1);
    expect(bmi(80, 180)).toBe(24.7);
  });
});

describe("validation", () => {
  it("rejects non-http(s) video links (no javascript: URLs)", () => {
    const base = { name: "Squat", restSeconds: null, tempo: null, notes: null, sets: [{ targetReps: 5, targetWeight: 100 }] };
    expect(workoutExerciseInput.safeParse({ ...base, videoUrl: "javascript:alert(1)" }).success).toBe(false);
    expect(workoutExerciseInput.safeParse({ ...base, videoUrl: "https://youtube.com/watch?v=x" }).success).toBe(true);
  });
  it("bounds rep input", () => {
    expect(recordSetSchema.safeParse({ done: true, actualReps: -1 }).success).toBe(false);
    expect(recordSetSchema.safeParse({ done: true, actualReps: 5000 }).success).toBe(false);
    expect(recordSetSchema.safeParse({ done: true, actualReps: 8 }).success).toBe(true);
  });
  it("normalises login email", () => {
    expect(loginSchema.parse({ email: "  Coach@Kinetic.TEST ", password: "x" }).email).toBe("coach@kinetic.test");
  });
});
