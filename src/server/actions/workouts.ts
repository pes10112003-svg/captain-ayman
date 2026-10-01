"use server";

import { revalidatePath } from "next/cache";
import { requireActor } from "../auth/guards";
import { completeWorkout, editWorkoutLog, recordSet, saveWorkoutPlan } from "../services/workouts";
import { recordSetSchema, workoutLogEditSchema, workoutPlanSchema } from "@/lib/validation";
import { parseInput, runAction } from "./helpers";

export async function saveWorkoutPlanAction(clientId: string, input: unknown) {
  return runAction(async () => {
    const actor = await requireActor("coach");
    const result = await saveWorkoutPlan(actor, clientId, parseInput(workoutPlanSchema, input));
    revalidatePath("/coach", "layout");
    return result;
  });
}

export async function editWorkoutLogAction(clientId: string, logId: string, input: unknown) {
  return runAction(async () => {
    const actor = await requireActor("coach");
    await editWorkoutLog(actor, clientId, logId, parseInput(workoutLogEditSchema, input));
    revalidatePath("/coach", "layout");
    return null;
  });
}

/** Client: tick / untick a set, optionally with actual reps. */
export async function recordSetAction(setLogId: string, input: unknown) {
  return runAction(async () => {
    const actor = await requireActor("client");
    return recordSet(actor, setLogId, parseInput(recordSetSchema, input));
  });
}

export async function completeWorkoutAction() {
  return runAction(async () => {
    const actor = await requireActor("client");
    const result = await completeWorkout(actor);
    revalidatePath("/client", "layout");
    return result;
  });
}
