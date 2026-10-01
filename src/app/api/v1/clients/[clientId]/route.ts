import { apiRoute } from "@/server/api/handler";
import { getClientProfile } from "@/server/services/clients";

/**
 * GET /api/v1/clients/:clientId
 * Coach: any of their own clients. Client: only themselves. Anyone else → 404.
 */
export const GET = apiRoute<{ clientId: string }>(async (_req, { actor, params }) => {
  const { client, permissions } = await getClientProfile(actor, params.clientId);
  const { userId, avatarKey, ...safe } = client;
  return { client: { ...safe, hasAvatar: !!avatarKey, hasLogin: !!userId }, permissions };
});
