"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { ImagePlus, Plus, Upload, X } from "lucide-react";
import { uploadPhotoAction } from "@/server/actions/progress";
import { Button, type ButtonSize, type ButtonVariant } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Field, Input, Select } from "@/components/ui/input";
import { Disclosure } from "@/components/ui/disclosure";
import { PHOTO_ANGLE_KEYS, PHOTO_PHASE_KEYS, type PhotoAngle, type PhotoPhase } from "@/lib/constants";
import { shrinkImage } from "@/lib/shrink-image";
import { cn } from "@/lib/utils";
import { useI18n } from "@/i18n/client";
import { angleLabel } from "@/i18n/labels";

const MAX_FILES = 10;
/** Hosting limit for one request is ~4.5 MB; stay safely below it after shrinking. */
const MAX_BYTES = 4 * 1024 * 1024;

type Picked = { key: string; file: File; url: string; angle: PhotoAngle };

export function PhotoUploader({
  clientId,
  today,
  phase: initialPhase = "after",
  defaultOpen,
  label,
  variant = "primary",
  size = "md",
}: {
  clientId: string;
  today: string;
  phase?: PhotoPhase;
  defaultOpen?: boolean;
  label?: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
}) {
  const router = useRouter();
  const { t, f } = useI18n();
  const [open, setOpen] = useState(!!defaultOpen);
  const [phase, setPhase] = useState<PhotoPhase>(initialPhase);
  const [files, setFiles] = useState<Picked[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ i: number; n: number } | null>(null);
  const [pending, start] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);
  const urls = useRef<string[]>([]);

  useEffect(() => () => urls.current.forEach((u) => URL.revokeObjectURL(u)), []);

  const reset = () => {
    files.forEach((p) => URL.revokeObjectURL(p.url));
    urls.current = [];
    setFiles([]);
    setError(null);
    setProgress(null);
    setPhase(initialPhase);
  };

  const addFiles = (list: FileList | null) => {
    if (!list?.length) return;
    const room = MAX_FILES - files.length;
    const picked = [...list].slice(0, Math.max(0, room)).map((file, i) => {
      const url = URL.createObjectURL(file);
      urls.current.push(url);
      return {
        key: `${Date.now()}-${i}-${file.name}`,
        file,
        url,
        angle: "front" as PhotoAngle,
      };
    });
    setFiles((cur) => [...cur, ...picked]);
    setError(list.length > room ? t.photos.maxFiles : null);
  };

  const remove = (key: string) =>
    setFiles((cur) => {
      const p = cur.find((x) => x.key === key);
      if (p) URL.revokeObjectURL(p.url);
      return cur.filter((x) => x.key !== key);
    });

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (pending) return;
        setOpen(o);
        if (!o) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button variant={variant} size={size}>
          <Plus /> {label ?? t.photos.upload}
        </Button>
      </DialogTrigger>
      <DialogContent title={t.photos.uploadTitle} description={t.photos.uploadSub}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!files.length) return setError(t.photos.chooseFirst);
            const fd = new FormData(e.currentTarget);
            const takenOn = String(fd.get("takenOn") ?? "");
            const note = String(fd.get("note") ?? "");
            setError(null);
            start(async () => {
              let ok = 0;
              let lastError = "";
              const failed: Picked[] = [];
              for (const [idx, p] of files.entries()) {
                setProgress({ i: idx + 1, n: files.length });
                const file = await shrinkImage(p.file, p.angle === "inbody" ? 2600 : 2200);
                if (file.size > MAX_BYTES) {
                  lastError = t.photos.tooBig;
                  failed.push(p);
                  continue;
                }
                const body = new FormData();
                body.set("photo", file);
                body.set("phase", phase);
                body.set("angle", p.angle);
                body.set("takenOn", takenOn);
                body.set("note", note);
                const res = await uploadPhotoAction(clientId, body).catch(() => ({ ok: false as const, error: t.photos.tooBig }));
                if (res.ok) ok++;
                else {
                  lastError = res.error;
                  failed.push(p);
                }
              }
              setProgress(null);
              if (ok) router.refresh();
              if (!failed.length) {
                toast.success(files.length > 1 ? f(t.photos.uploadedMany, { n: files.length }) : t.photos.uploaded);
                setOpen(false);
                reset();
                return;
              }
              // Keep only the photos that failed so the user can retry them.
              files.filter((p) => !failed.includes(p)).forEach((p) => URL.revokeObjectURL(p.url));
              setFiles(failed);
              setError(
                ok
                  ? f(t.photos.partialFail, {
                      ok,
                      n: files.length,
                      error: lastError,
                    })
                  : lastError,
              );
            });
          }}
          className="space-y-4"
        >
          <fieldset>
            <legend className="mb-1.5 text-[13px] font-medium text-ink-2">{t.photos.phase}</legend>
            <div className="grid grid-cols-2 gap-1 rounded-xl border border-line bg-surface-2 p-1">
              {PHOTO_PHASE_KEYS.map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setPhase(k)}
                  aria-pressed={phase === k}
                  className={cn(
                    "h-9 rounded-lg text-sm font-semibold transition",
                    phase === k ? "bg-surface text-ink shadow-card" : "text-muted hover:text-ink",
                  )}
                >
                  {k === "before" ? t.photos.phaseBefore : t.photos.phaseAfter}
                </button>
              ))}
            </div>
          </fieldset>

          {files.length ? (
            <ul className="space-y-2">
              {files.map((p) => (
                <li key={p.key} className="flex items-center gap-3 rounded-xl border border-line bg-surface-2 p-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.url} alt={t.photos.preview} className="size-14 shrink-0 rounded-lg bg-surface object-cover" />
                  <div className="min-w-0 flex-1">
                    <Select
                      value={p.angle}
                      onChange={(e) => setFiles((cur) => cur.map((x) => (x.key === p.key ? { ...x, angle: e.target.value as PhotoAngle } : x)))}
                      aria-label={t.photos.angle}
                      disabled={pending}
                    >
                      {PHOTO_ANGLE_KEYS.map((k) => (
                        <option key={k} value={k}>
                          {angleLabel(t, k)}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <button
                    type="button"
                    onClick={() => remove(p.key)}
                    disabled={pending}
                    className="grid size-9 shrink-0 place-items-center rounded-lg text-muted hover:bg-surface hover:text-crit-text disabled:opacity-40"
                    aria-label={t.photos.removeFile}
                  >
                    <X className="size-4" />
                  </button>
                </li>
              ))}
              {files.length < MAX_FILES ? (
                <li>
                  <Button variant="ghost" size="sm" onClick={() => fileRef.current?.click()} disabled={pending}>
                    <ImagePlus /> {t.photos.addMore}
                  </Button>
                </li>
              ) : null}
            </ul>
          ) : (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="grid aspect-[16/9] w-full place-items-center rounded-2xl border-2 border-dashed border-line-strong bg-surface-2 text-muted transition hover:border-ink hover:text-ink"
            >
              <span className="flex flex-col items-center gap-2 text-sm">
                <ImagePlus className="size-8" />
                {t.photos.tap}
                <span className="text-xs">{t.photos.formats}</span>
              </span>
            </button>
          )}
          <input
            ref={fileRef}
            type="file"
            multiple
            accept="image/jpeg,image/png,image/webp,image/heic,image/heif,image/avif"
            className="sr-only"
            tabIndex={-1}
            onChange={(e) => {
              addFiles(e.target.files);
              e.target.value = "";
            }}
          />

          <Field label={t.photos.takenOn} htmlFor="takenOn">
            <Input id="takenOn" name="takenOn" type="date" max={today} defaultValue={today} />
          </Field>
          <Disclosure title={t.common.moreOptions}>
            <Field label={t.photos.note} htmlFor="note" optional>
              <Input id="note" name="note" maxLength={500} placeholder={t.photos.notePh} />
            </Field>
          </Disclosure>

          {error ? (
            <p className="rounded-xl bg-crit-soft px-3 py-2 text-sm text-crit-text" role="alert">
              {error}
            </p>
          ) : null}
          <div className="flex items-center justify-end gap-2">
            {progress ? (
              <span className="me-auto text-sm text-muted" aria-live="polite">
                {f(t.photos.uploadingN, { i: progress.i, n: progress.n })}
              </span>
            ) : null}
            <Button variant="secondary" onClick={() => setOpen(false)} disabled={pending}>
              {t.common.cancel}
            </Button>
            <Button type="submit" loading={pending} disabled={!files.length}>
              {!pending ? <Upload /> : null} {files.length > 1 ? f(t.photos.uploadN, { n: files.length }) : t.common.upload}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
