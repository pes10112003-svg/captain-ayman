"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { Columns2, Images, Trash2 } from "lucide-react";
import { deletePhotoAction } from "@/server/actions/progress";
import { Button } from "@/components/ui/button";
import { ConfirmDialog, Dialog, DialogContent } from "@/components/ui/dialog";
import { Select } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { PhotoUploader } from "@/components/shared/photo-uploader";
import { PHOTO_ANGLE_KEYS, PHOTO_PHASE_KEYS, type PhotoAngle, type PhotoPhase } from "@/lib/constants";
import { diffDays } from "@/lib/time";
import { cn } from "@/lib/utils";
import { useI18n } from "@/i18n/client";
import { angleLabel } from "@/i18n/labels";
import type { Dict } from "@/i18n/en";

export type GalleryPhoto = {
  id: string;
  phase: PhotoPhase;
  angle: PhotoAngle;
  takenOn: string;
  note: string | null;
  width: number;
  height: number;
};

const src = (id: string, size: "thumb" | "full") => `/api/media/photos/${id}?size=${size}`;
const byDateAsc = (a: GalleryPhoto, b: GalleryPhoto) => (a.takenOn < b.takenOn ? -1 : a.takenOn > b.takenOn ? 1 : 0);
const phaseLabel = (t: Dict, p: PhotoPhase) => (p === "before" ? t.photos.phaseBefore : t.photos.phaseAfter);

/**
 * Photos split into «Before» and «After» panels (body photos, InBody reports, …) plus a compare view.
 * `upload` renders an add button per panel; `canDelete` is coach-only.
 */
export function PhotoGallery({
  photos,
  clientId,
  canDelete,
  upload,
}: {
  photos: GalleryPhoto[];
  clientId: string;
  canDelete: boolean;
  upload?: { today: string; openPhase?: PhotoPhase } | null;
}) {
  const [angle, setAngle] = useState<"all" | PhotoAngle>("all");
  const [view, setView] = useState<"photos" | "compare">("photos");
  const [lightbox, setLightbox] = useState<GalleryPhoto | null>(null);
  const router = useRouter();
  const [, start] = useTransition();
  const { t, fmt } = useI18n();

  const filtered = useMemo(() => photos.filter((p) => angle === "all" || p.angle === angle), [photos, angle]);
  const byPhase = useMemo(() => {
    const m: Record<PhotoPhase, GalleryPhoto[]> = { before: [], after: [] };
    for (const p of filtered) m[p.phase].push(p);
    m.before.sort((a, b) => -byDateAsc(a, b));
    m.after.sort((a, b) => -byDateAsc(a, b));
    return m;
  }, [filtered]);

  if (!photos.length && !upload) {
    return <EmptyState icon={<Images />} title={t.photos.emptyTitle} description={t.photos.emptyText} />;
  }

  const remove = async (p: GalleryPhoto) => {
    const res = await deletePhotoAction(clientId, p.id);
    if (!res.ok) {
      toast.error(res.error);
      return false;
    }
    toast.success(t.photos.deleted);
    setLightbox(null);
    start(() => router.refresh());
  };

  const pool = filtered.length >= 2 ? filtered : photos;
  const sortedPool = [...pool].sort(byDateAsc);
  const defaultBefore = sortedPool.find((p) => p.phase === "before") ?? sortedPool[0];
  const defaultAfter = [...sortedPool].reverse().find((p) => p.phase === "after") ?? sortedPool[sortedPool.length - 1];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {photos.length >= 2 ? (
          <div className="inline-flex rounded-xl border border-line bg-surface-2 p-1">
            {(["photos", "compare"] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setView(v)}
                aria-pressed={view === v}
                className={cn(
                  "flex h-8 items-center gap-1.5 rounded-lg px-3 text-[13px] font-medium transition",
                  view === v ? "bg-surface text-ink shadow-card" : "text-muted hover:text-ink",
                )}
              >
                {v === "photos" ? <Images className="size-3.5" /> : <Columns2 className="size-3.5" />}
                {v === "photos" ? t.photos.timeline : t.photos.beforeAfter}
              </button>
            ))}
          </div>
        ) : (
          <span />
        )}
        {photos.length ? (
          <div className="w-40">
            <Select value={angle} onChange={(e) => setAngle(e.target.value as typeof angle)} aria-label={t.photos.filter}>
              <option value="all">{t.photos.allAngles}</option>
              {PHOTO_ANGLE_KEYS.map((k) => (
                <option key={k} value={k}>
                  {angleLabel(t, k)}
                </option>
              ))}
            </Select>
          </div>
        ) : null}
      </div>

      {view === "compare" && defaultBefore && defaultAfter ? (
        <PhotoCompare key={`${angle}-${pool.length}`} photos={sortedPool} defaultBeforeId={defaultBefore.id} defaultAfterId={defaultAfter.id} />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {PHOTO_PHASE_KEYS.map((phase) => {
            const list = byPhase[phase];
            return (
              <section key={phase} aria-labelledby={`phase-${phase}`} className="rounded-2xl border border-line bg-surface p-4 shadow-card">
                <header className="mb-3 flex items-center justify-between gap-3">
                  <h3 id={`phase-${phase}`} className="flex items-center gap-2 text-base font-semibold">
                    <span className={cn("size-2.5 rounded-full", phase === "before" ? "bg-muted" : "bg-brand")} aria-hidden />
                    {phaseLabel(t, phase)}
                    <span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs font-medium text-muted tabular">{fmt.num(list.length, 0)}</span>
                  </h3>
                  {upload ? (
                    <PhotoUploader
                      clientId={clientId}
                      today={upload.today}
                      phase={phase}
                      defaultOpen={upload.openPhase === phase}
                      label={t.photos.add}
                      variant="secondary"
                      size="sm"
                    />
                  ) : null}
                </header>
                {list.length ? (
                  <ul className="grid grid-cols-3 gap-2">
                    {list.map((p) => (
                      <li key={p.id} className="group relative overflow-hidden rounded-xl border border-line bg-surface-2">
                        <button
                          type="button"
                          onClick={() => setLightbox(p)}
                          className="block w-full"
                          aria-label={`${t.photos.open}: ${phaseLabel(t, p.phase)} · ${angleLabel(t, p.angle)} · ${fmt.date(p.takenOn)}`}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={src(p.id, "thumb")}
                            alt=""
                            loading="lazy"
                            decoding="async"
                            className="aspect-[3/4] w-full object-cover transition duration-300 group-hover:scale-[1.03]"
                          />
                        </button>
                        <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/65 to-transparent p-2 pt-8 text-white">
                          <p className="text-xs font-semibold">{angleLabel(t, p.angle)}</p>
                          <p className="text-[11px] text-white/75">{fmt.dateShort(p.takenOn)}</p>
                        </div>
                        {canDelete ? (
                          <div className="absolute end-1.5 top-1.5 opacity-0 transition group-hover:opacity-100 focus-within:opacity-100 [@media(hover:none)]:hidden">
                            <ConfirmDialog
                              title={t.photos.deleteTitle}
                              description={t.photos.deleteText}
                              confirmLabel={t.photos.deletePhoto}
                              onConfirm={() => remove(p)}
                              trigger={
                                <button
                                  type="button"
                                  className="grid size-8 place-items-center rounded-lg bg-black/55 text-white backdrop-blur hover:bg-crit"
                                  aria-label={t.photos.deletePhoto}
                                >
                                  <Trash2 className="size-4" />
                                </button>
                              }
                            />
                          </div>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="grid min-h-28 place-items-center rounded-xl border border-dashed border-line-strong px-4 text-center text-sm text-muted">
                    {t.photos.emptyPhase}
                  </p>
                )}
              </section>
            );
          })}
        </div>
      )}

      <Dialog open={!!lightbox} onOpenChange={(o) => !o && setLightbox(null)}>
        {lightbox ? (
          <DialogContent
            title={`${phaseLabel(t, lightbox.phase)} · ${angleLabel(t, lightbox.angle)} · ${fmt.date(lightbox.takenOn)}`}
            description={lightbox.note ?? undefined}
            size="lg"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src(lightbox.id, "full")} alt="" className="max-h-[70dvh] w-full rounded-xl bg-surface-2 object-contain" />
            {canDelete ? (
              <div className="mt-4 flex justify-end">
                <ConfirmDialog
                  title={t.photos.deleteTitle}
                  description={t.photos.deleteText}
                  confirmLabel={t.photos.deletePhoto}
                  onConfirm={() => remove(lightbox)}
                  trigger={
                    <Button variant="ghost" size="sm" className="text-crit-text">
                      <Trash2 /> {t.photos.deletePhoto}
                    </Button>
                  }
                />
              </div>
            ) : null}
          </DialogContent>
        ) : null}
      </Dialog>
    </div>
  );
}

/** Side-by-side and slider comparison of two photos. Defaults to the first «before» vs the latest «after». */
export function PhotoCompare({ photos, defaultBeforeId, defaultAfterId }: { photos: GalleryPhoto[]; defaultBeforeId: string; defaultAfterId: string }) {
  const { t, f, fmt } = useI18n();
  const [beforeId, setBeforeId] = useState(defaultBeforeId);
  const [afterId, setAfterId] = useState(defaultAfterId);
  const [mode, setMode] = useState<"side" | "slider">("side");
  const [pos, setPos] = useState(50);
  const before = photos.find((p) => p.id === beforeId) ?? photos[0];
  const after = photos.find((p) => p.id === afterId) ?? photos[photos.length - 1];
  if (!before || !after) return null;
  const days = diffDays(after.takenOn, before.takenOn);
  const label = (p: GalleryPhoto) => `${phaseLabel(t, p.phase)} · ${angleLabel(t, p.angle)} · ${fmt.date(p.takenOn)}`;
  const options = PHOTO_PHASE_KEYS.map((phase) => ({
    phase,
    list: photos.filter((p) => p.phase === phase),
  })).filter((g) => g.list.length);
  const renderOptions = () =>
    options.map((g) => (
      <optgroup key={g.phase} label={phaseLabel(t, g.phase)}>
        {g.list.map((p) => (
          <option key={p.id} value={p.id}>
            {label(p)}
          </option>
        ))}
      </optgroup>
    ));

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
        <Select value={before.id} onChange={(e) => setBeforeId(e.target.value)} aria-label={t.photos.beforePhoto}>
          {renderOptions()}
        </Select>
        <Select value={after.id} onChange={(e) => setAfterId(e.target.value)} aria-label={t.photos.afterPhoto}>
          {renderOptions()}
        </Select>
        <Button variant="secondary" onClick={() => setMode((m) => (m === "side" ? "slider" : "side"))}>
          {mode === "side" ? t.photos.sliderView : t.photos.sideBySide}
        </Button>
      </div>
      <p className="text-sm text-muted">
        {days > 0 ? f(t.photos.daysApart, { n: fmt.num(days, 0) }) : days < 0 ? f(t.photos.reversed, { n: fmt.num(-days, 0) }) : t.photos.sameDay}
      </p>
      {mode === "side" ? (
        <div className="grid grid-cols-2 gap-3">
          {[
            {
              p: before,
              key: "before",
              tag: t.photos.before,
              alt: t.photos.beforePhoto,
            },
            {
              p: after,
              key: "after",
              tag: t.photos.after,
              alt: t.photos.afterPhoto,
            },
          ].map(({ p, key, tag, alt }) => (
            <figure key={key} className="overflow-hidden rounded-2xl border border-line bg-surface-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={src(p.id, "full")}
                alt={`${alt} · ${fmt.date(p.takenOn)}`}
                className={cn("aspect-[3/4] w-full", p.angle === "inbody" ? "bg-white object-contain" : "object-cover")}
              />
              <figcaption className="flex items-center justify-between px-3 py-2.5">
                <span className="text-xs font-bold tracking-[0.12em]">{tag}</span>
                <span className="text-xs text-muted">{fmt.date(p.takenOn)}</span>
              </figcaption>
            </figure>
          ))}
        </div>
      ) : (
        // dir="ltr": "before" stays on the left and the range input drags left→right in both languages.
        <div dir="ltr" className="relative mx-auto aspect-[3/4] max-w-md select-none overflow-hidden rounded-2xl border border-line bg-surface-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src(after.id, "full")} alt={t.photos.afterPhoto} className="absolute inset-0 size-full object-cover" draggable={false} />
          <div className="absolute inset-0 overflow-hidden" style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src(before.id, "full")} alt={t.photos.beforePhoto} className="absolute inset-0 size-full object-cover" draggable={false} />
          </div>
          <div className="pointer-events-none absolute inset-y-0 w-0.5 bg-white shadow-[0_0_0_1px_rgba(0,0,0,.2)]" style={{ left: `${pos}%` }} />
          <span className="absolute left-3 top-3 rounded-md bg-black/60 px-2 py-1 text-[10px] font-bold tracking-widest text-white">{t.photos.before}</span>
          <span className="absolute right-3 top-3 rounded-md bg-black/60 px-2 py-1 text-[10px] font-bold tracking-widest text-white">{t.photos.after}</span>
          <input
            type="range"
            min={0}
            max={100}
            value={pos}
            onChange={(e) => setPos(Number(e.target.value))}
            aria-label={t.photos.slider}
            className="absolute inset-x-4 bottom-4 accent-[var(--brand)]"
          />
        </div>
      )}
    </div>
  );
}
