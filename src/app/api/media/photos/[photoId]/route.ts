import { apiRoute } from "@/server/api/handler";
import { readPhoto } from "@/server/services/photos";

/**
 * GET /api/media/photos/:photoId?size=thumb|full
 * Private progress photos. Authorization is re-checked for every request; there are no public URLs.
 */
export const GET = apiRoute<{ photoId: string }>(async (req, { actor, params }) => {
  const size = req.nextUrl.searchParams.get("size") === "thumb" ? "thumb" : "full";
  const { body, mimeType } = await readPhoto(actor, params.photoId, size);
  return new Response(new Uint8Array(body), {
    headers: {
      "Content-Type": mimeType,
      "Content-Length": String(body.length),
      "Cache-Control": "private, max-age=600",
      "Content-Disposition": "inline",
      "X-Content-Type-Options": "nosniff",
      "Cross-Origin-Resource-Policy": "same-origin",
    },
  });
});
