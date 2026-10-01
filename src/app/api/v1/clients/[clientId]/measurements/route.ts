import { apiRoute } from "@/server/api/handler";
import { getProgress } from "@/server/services/progress";

/** GET /api/v1/clients/:clientId/measurements — progress summary, series and history. */
export const GET = apiRoute<{ clientId: string }>(async (_req, { actor, params }) => {
  const p = await getProgress(actor, params.clientId);
  return { summary: p.summary, entries: p.entries, series: p.series, units: { weight: p.prefs.weightUnit, length: p.prefs.lengthUnit } };
});
