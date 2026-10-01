import { requireCoachPage } from "@/server/auth/guards";
import { listPhotos } from "@/server/services/photos";
import { coachToday } from "@/server/services/settings";
import { orNotFound } from "@/server/page-helpers";
import { PhotoUploader } from "@/components/shared/photo-uploader";
import { PhotoGallery } from "@/components/shared/photo-gallery";
import { getI18n } from "@/i18n/server";

export default async function ClientPhotosPage({ params, searchParams }: { params: Promise<{ clientId: string }>; searchParams: Promise<{ upload?: string }> }) {
  const actor = await requireCoachPage();
  const { clientId } = await params;
  const { upload } = await searchParams;
  const [photos, { today }] = await Promise.all([orNotFound(listPhotos(actor, clientId)), coachToday(actor.userId)]);
  const { t, f, fmt } = await getI18n();
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">{t.photos.title}</h2>
          <p className="text-sm text-muted">{f(t.photos.subtitle, { n: fmt.num(photos.length, 0) })}</p>
        </div>
        <PhotoUploader clientId={clientId} today={today} defaultOpen={upload === "1"} />
      </div>
      <PhotoGallery photos={photos} clientId={clientId} canDelete />
    </div>
  );
}
