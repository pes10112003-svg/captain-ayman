import { apiRoute } from "@/server/api/handler";
import { readAvatar } from "@/server/services/photos";

/** GET /api/media/avatars/:clientId — private profile photo (coach-owner or the client themself). */
export const GET = apiRoute<{ clientId: string }>(async (_req, { actor, params }) => {
  const { body, mimeType } = await readAvatar(actor, params.clientId);
  return new Response(new Uint8Array(body), {
    headers: {
      "Content-Type": mimeType,
      "Cache-Control": "private, max-age=86400",
      "X-Content-Type-Options": "nosniff",
      "Cross-Origin-Resource-Policy": "same-origin",
    },
  });
});
