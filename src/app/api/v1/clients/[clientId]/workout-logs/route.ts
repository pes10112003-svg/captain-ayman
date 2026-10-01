import { apiRoute } from "@/server/api/handler";
import { listWorkoutHistory } from "@/server/services/workouts";

/** GET /api/v1/clients/:clientId/workout-logs?page=1 — historical workout records with per-set results. */
export const GET = apiRoute<{ clientId: string }>(async (req, { actor, params }) => {
  const page = Number(req.nextUrl.searchParams.get("page")) || 1;
  return listWorkoutHistory(actor, params.clientId, { page, pageSize: 20 });
});
