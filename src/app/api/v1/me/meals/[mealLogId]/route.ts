import { z } from "zod";
import { apiRoute, readJson } from "@/server/api/handler";
import { setMealConsumed } from "@/server/services/nutrition";
import { ValidationError } from "@/server/errors";

/** POST /api/v1/me/meals/:mealLogId  { consumed: boolean } — consumed_at = server time. Any client-sent time is ignored. */
export const POST = apiRoute<{ mealLogId: string }>(async (req, { actor, params }) => {
  const parsed = z.object({ consumed: z.boolean() }).safeParse(await readJson(req));
  if (!parsed.success) throw new ValidationError("Body must be { consumed: boolean }");
  return setMealConsumed(actor, params.mealLogId, parsed.data.consumed);
}, { role: "client" });
