"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { Camera, ImagePlus, Upload } from "lucide-react";
import { uploadPhotoAction } from "@/server/actions/progress";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Field, Input, Select } from "@/components/ui/input";
import { PHOTO_ANGLE_KEYS } from "@/lib/constants";
import { useI18n } from "@/i18n/client";
import { angleLabel } from "@/i18n/labels";

export function PhotoUploader({ clientId, today, defaultOpen, label }: { clientId: string; today: string; defaultOpen?: boolean; label?: string }) {
  const router = useRouter();
  const { t } = useI18n();
  const [open, setOpen] = useState(!!defaultOpen);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) {
          setPreview(null);
          setError(null);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button>
          <Camera /> {label ?? t.photos.upload}
        </Button>
      </DialogTrigger>
      <DialogContent title={t.photos.uploadTitle} description={t.photos.uploadSub}>
        <form
          ref={formRef}
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            const file = fd.get("photo");
            if (!(file instanceof File) || !file.size) return setError(t.photos.chooseFirst);
            if (file.size > 10 * 1024 * 1024) return setError(t.photos.tooBig);
            setError(null);
            start(async () => {
              const res = await uploadPhotoAction(clientId, fd);
              if (!res.ok) return setError(res.error);
              toast.success(t.photos.uploaded);
              setOpen(false);
              setPreview(null);
              router.refresh();
            });
          }}
          className="space-y-4"
        >
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="relative grid aspect-[4/3] w-full place-items-center overflow-hidden rounded-2xl border-2 border-dashed border-line-strong bg-surface-2 text-muted transition hover:border-ink hover:text-ink"
          >
            {preview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview} alt={t.photos.preview} className="absolute inset-0 size-full object-contain" />
            ) : (
              <span className="flex flex-col items-center gap-2 text-sm">
                <ImagePlus className="size-8" />
                {t.photos.tap}
                <span className="text-xs">{t.photos.formats}</span>
              </span>
            )}
          </button>
          <input
            ref={fileRef}
            name="photo"
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic,image/heif,image/avif"
            className="sr-only"
            onChange={(e) => {
              const f = e.target.files?.[0];
              setPreview(f ? URL.createObjectURL(f) : null);
            }}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t.photos.angle} htmlFor="angle">
              <Select id="angle" name="angle" defaultValue="front">
                {PHOTO_ANGLE_KEYS.map((k) => (
                  <option key={k} value={k}>
                    {angleLabel(t, k)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t.photos.takenOn} htmlFor="takenOn">
              <Input id="takenOn" name="takenOn" type="date" max={today} defaultValue={today} />
            </Field>
            <Field label={t.photos.note} htmlFor="note" optional className="sm:col-span-2">
              <Input id="note" name="note" maxLength={500} placeholder={t.photos.notePh} />
            </Field>
          </div>
          {error ? (
            <p className="rounded-xl bg-crit-soft px-3 py-2 text-sm text-crit-text" role="alert">
              {error}
            </p>
          ) : null}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpen(false)} disabled={pending}>
              {t.common.cancel}
            </Button>
            <Button type="submit" loading={pending}>
              {!pending ? <Upload /> : null} {t.common.upload}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
