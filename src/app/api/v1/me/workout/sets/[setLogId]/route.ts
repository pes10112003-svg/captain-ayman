import { apiRoute, readJson } from "@/server/api/handler";
import { recordSet } from "@/server/services/workouts";
import { ValidationError } from "@/server/errors";
import { fieldErrors, recordSetSchema } from "@/lib/validation";

/** POST /api/v1/me/workout/sets/:setLogId  { done: boolean, actualReps?: number } */
export const POST = apiRoute<{ setLogId: string }>(async (req, { actor, params }) => {
  const parsed = recordSetSchema.safeParse(await readJson(req));
  if (!parsed.success) throw new ValidationError(undefined, fieldErrors(parsed.error));
  return recordSet(actor, params.setLogId, parsed.data);
}, { role: "client" });
