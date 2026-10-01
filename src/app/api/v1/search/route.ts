import { apiRoute } from "@/server/api/handler";
import { searchClients } from "@/server/services/clients";

/** GET /api/v1/search?q=… — coach-only global client search. */
export const GET = apiRoute(async (req, { actor }) => {
  const q = req.nextUrl.searchParams.get("q") ?? "";
  return { results: await searchClients(actor, q) };
}, { role: "coach" });
