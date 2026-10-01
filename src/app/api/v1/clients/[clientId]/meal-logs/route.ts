import { apiRoute } from "@/server/api/handler";
import { getMealHistory } from "@/server/services/nutrition";

/** GET /api/v1/clients/:clientId/meal-logs?days=14&before=YYYY-MM-DD */
export const GET = apiRoute<{ clientId: string }>(async (req, { actor, params }) => {
  const sp = req.nextUrl.searchParams;
  return getMealHistory(actor, params.clientId, { days: Number(sp.get("days")) || 14, before: sp.get("before") ?? undefined });
});
