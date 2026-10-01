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
import { PHOTO_ANGLE_KEYS, type PhotoAngle } from "@/lib/constants";
import { diffDays } from "@/lib/time";
import { cn } from "@/lib/utils";
import { useI18n } from "@/i18n/client";
import { angleLabel } from "@/i18n/labels";

export type GalleryPhoto = { id: string; angle: PhotoAngle; takenOn: string; note: string | null; width: number; height: number };

const src = (id: string, size: "thumb" | "full") => `/api/media/photos/${id}?size=${size}`;

export function PhotoGallery({ photos, clientId, canDelete }: { photos: GalleryPhoto[]; clientId: string; canDelete: boolean }) {
  const [angle, setAngle] = useState<"all" | PhotoAngle>("all");
  const [view, setView] = useState<"grid" | "compare">("grid");
  const [lightbox, setLightbox] = useState<GalleryPhoto | null>(null);
  const router = useRouter();
  const [, start] = useTransition();
  const { t, f, fmt } = useI18n();

  const filtered = useMemo(() => photos.filter((p) => angle === "all" || p.angle === angle), [photos, angle]);
  const byDate = useMemo(() => {
    const m = new Map<string, GalleryPhoto[]>();
    for (const p of filtered) m.set(p.takenOn, [...(m.get(p.takenOn) ?? []), p]);
    return [...m.entries()];
  }, [filtered]);

  if (!photos.length) {
    return <EmptyState icon={<Images />} title={t.photos.emptyTitle} description={t.photos.emptyText} />;
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-xl border border-line bg-surface-2 p-1">
          {(["grid", "compare"] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              aria-pressed={view === v}
              className={cn("flex h-8 items-center gap-1.5 rounded-lg px-3 text-[13px] font-medium transition", view === v ? "bg-surface text-ink shadow-card" : "text-muted hover:text-ink")}
            >
              {v === "grid" ? <Images className="size-3.5" /> : <Columns2 className="size-3.5" />}
              {v === "grid" ? t.photos.timeline : t.photos.beforeAfter}
            </button>
          ))}
        </div>
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
      </div>

      {view === "compare" ? (
        <PhotoCompare photos={filtered.length ? filtered : photos} />
      ) : (
        <div className="space-y-6">
          {byDate.map(([date, list]) => (
            <section key={date}>
              <h3 className="mb-2.5 text-sm font-semibold">{fmt.date(date, { weekday: "short", month: "long", day: "numeric", year: "numeric" })}</h3>
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                {list.map((p) => (
                  <li key={p.id} className="group relative overflow-hidden rounded-2xl border border-line bg-surface-2">
                    <button type="button" onClick={() => setLightbox(p)} className="block w-full" aria-label={`${t.photos.open}: ${angleLabel(t, p.angle)} · ${fmt.date(p.takenOn)}`}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={src(p.id, "thumb")} alt={`${f(t.dashboard.photo, { angle: angleLabel(t, p.angle) })} · ${fmt.date(p.takenOn)}`} loading="lazy" decoding="async" className="aspect-[3/4] w-full object-cover transition duration-300 group-hover:scale-[1.02]" />
                    </button>
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between bg-gradient-to-t from-black/60 to-transparent p-2.5 pt-8 text-white">
                      <span className="text-xs font-semibold">{angleLabel(t, p.angle)}</span>
                    </div>
                    {canDelete ? (
                      <div className="absolute end-2 top-2 opacity-0 transition group-hover:opacity-100 focus-within:opacity-100">
                        <ConfirmDialog
                          title={t.photos.deleteTitle}
                          description={t.photos.deleteText}
                          confirmLabel={t.photos.deletePhoto}
                          onConfirm={async () => {
                            const res = await deletePhotoAction(clientId, p.id);
                            if (!res.ok) {
                              toast.error(res.error);
                              return false;
                            }
                            toast.success(t.photos.deleted);
                            start(() => router.refresh());
                          }}
                          trigger={
                            <button type="button" className="grid size-8 place-items-center rounded-lg bg-black/55 text-white backdrop-blur hover:bg-crit" aria-label={t.photos.deletePhoto}>
                              <Trash2 className="size-4" />
                            </button>
                          }
                        />
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      <Dialog open={!!lightbox} onOpenChange={(o) => !o && setLightbox(null)}>
        {lightbox ? (
          <DialogContent title={`${angleLabel(t, lightbox.angle)} · ${fmt.date(lightbox.takenOn)}`} description={lightbox.note ?? undefined} size="lg">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src(lightbox.id, "full")} alt="" className="max-h-[70dvh] w-full rounded-xl bg-surface-2 object-contain" />
          </DialogContent>
        ) : null}
      </Dialog>
    </div>
  );
}

/** Side-by-side and slider comparison of two photos. Defaults to earliest vs latest. */
export function PhotoCompare({ photos }: { photos: GalleryPhoto[] }) {
  const { t, f, fmt } = useI18n();
  const sorted = useMemo(() => [...photos].sort((a, b) => (a.takenOn < b.takenOn ? -1 : a.takenOn > b.takenOn ? 1 : 0)), [photos]);
  const [beforeId, setBeforeId] = useState(sorted[0]?.id ?? "");
  const [afterId, setAfterId] = useState(sorted[sorted.length - 1]?.id ?? "");
  const [mode, setMode] = useState<"side" | "slider">("side");
  const [pos, setPos] = useState(50);
  const before = sorted.find((p) => p.id === beforeId) ?? sorted[0];
  const after = sorted.find((p) => p.id === afterId) ?? sorted[sorted.length - 1];
  if (!before || !after) return null;
  const days = diffDays(after.takenOn, before.takenOn);
  const label = (p: GalleryPhoto) => `${fmt.date(p.takenOn)} · ${angleLabel(t, p.angle)}`;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
        <Select value={before.id} onChange={(e) => setBeforeId(e.target.value)} aria-label={t.photos.beforePhoto}>
          {sorted.map((p) => (
            <option key={p.id} value={p.id}>
              {f(t.photos.beforeLabel, { label: label(p) })}
            </option>
          ))}
        </Select>
        <Select value={after.id} onChange={(e) => setAfterId(e.target.value)} aria-label={t.photos.afterPhoto}>
          {sorted.map((p) => (
            <option key={p.id} value={p.id}>
              {f(t.photos.afterLabel, { label: label(p) })}
            </option>
          ))}
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
            { p: before, key: "before", tag: t.photos.before, alt: t.photos.beforePhoto },
            { p: after, key: "after", tag: t.photos.after, alt: t.photos.afterPhoto },
          ].map(({ p, key, tag, alt }) => (
            <figure key={key} className="overflow-hidden rounded-2xl border border-line bg-surface-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src(p.id, "full")} alt={`${alt} · ${fmt.date(p.takenOn)}`} className="aspect-[3/4] w-full object-cover" />
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
          <span className="absolute start-3 top-3 rounded-md bg-black/60 px-2 py-1 text-[10px] font-bold tracking-widest text-white">{t.photos.before}</span>
          <span className="absolute end-3 top-3 rounded-md bg-black/60 px-2 py-1 text-[10px] font-bold tracking-widest text-white">{t.photos.after}</span>
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
