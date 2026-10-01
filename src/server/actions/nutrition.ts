"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireActor } from "../auth/guards";
import { saveNutritionPlan, setMealConsumed } from "../services/nutrition";
import { nutritionPlanSchema } from "@/lib/validation";
import { parseInput, runAction } from "./helpers";

export async function saveNutritionPlanAction(clientId: string, input: unknown) {
  return runAction(async () => {
    const actor = await requireActor("coach");
    const result = await saveNutritionPlan(actor, clientId, parseInput(nutritionPlanSchema, input));
    revalidatePath("/coach", "layout");
    return result;
  });
}

/** Client: mark a meal as eaten (server timestamp) or undo it. */
export async function setMealConsumedAction(mealLogId: string, consumed: boolean) {
  return runAction(async () => {
    const actor = await requireActor("client");
    return setMealConsumed(actor, mealLogId, z.boolean().parse(consumed));
  });
}
