import { apiRoute } from "@/server/api/handler";
import { listPhotos } from "@/server/services/photos";

/** GET /api/v1/clients/:clientId/photos — metadata only; image bytes via /api/media/photos/:id. */
export const GET = apiRoute<{ clientId: string }>(async (_req, { actor, params }) => {
  const photos = await listPhotos(actor, params.clientId);
  return { photos: photos.map((p) => ({ ...p, url: `/api/media/photos/${p.id}?size=full`, thumbUrl: `/api/media/photos/${p.id}?size=thumb` })) };
});
