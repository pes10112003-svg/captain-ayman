import { requireCoachPage } from "@/server/auth/guards";
import { listPhotos } from "@/server/services/photos";
import { coachToday } from "@/server/services/settings";
import { orNotFound } from "@/server/page-helpers";
import { PhotoGallery } from "@/components/shared/photo-gallery";
import { getI18n } from "@/i18n/server";

export default async function ClientPhotosPage({
  params,
  searchParams,
}: {
  params: Promise<{ clientId: string }>;
  searchParams: Promise<{ upload?: string }>;
}) {
  const actor = await requireCoachPage();
  const { clientId } = await params;
  const { upload } = await searchParams;
  const [photos, { today }] = await Promise.all([orNotFound(listPhotos(actor, clientId)), coachToday(actor.userId)]);
  const { t } = await getI18n();
  const openPhase = upload === "1" ? (photos.some((p) => p.phase === "before") ? "after" : "before") : undefined;
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">{t.photos.title}</h2>
        <p className="text-sm text-muted">{t.photos.subtitle}</p>
      </div>
      <PhotoGallery photos={photos} clientId={clientId} canDelete upload={{ today, openPhase }} />
    </div>
  );
}
