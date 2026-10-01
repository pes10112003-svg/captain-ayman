"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef, useTransition } from "react";
import { toast } from "sonner";
import { Camera, Save } from "lucide-react";
import { updateOwnProfileAction, uploadClientAvatarAction } from "@/server/actions/clients";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";
import { GENDER_KEYS } from "@/lib/constants";
import { useI18n } from "@/i18n/client";
import { genderLabel } from "@/i18n/labels";

export function AvatarEditor({ clientId, name, avatarKey, canEdit }: { clientId: string; name: string; avatarKey: string | null; canEdit: boolean }) {
  const router = useRouter();
  const { t } = useI18n();
  const [pending, start] = useTransition();
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div className="relative">
      <Avatar name={name} clientId={clientId} avatarKey={avatarKey} size="xl" />
      {canEdit ? (
        <>
          <button
            type="button"
            onClick={() => ref.current?.click()}
            disabled={pending}
            className="absolute -bottom-1 -end-1 grid size-8 place-items-center rounded-full border-2 border-surface bg-primary text-primary-fg"
            aria-label={t.clientProfile.changePhoto}
          >
            <Camera className="size-4" />
          </button>
          <input
            ref={ref}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
            className="sr-only"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              const fd = new FormData();
              fd.set("avatar", f);
              start(async () => {
                const res = await uploadClientAvatarAction(clientId, fd);
                if (!res.ok) return void toast.error(res.error);
                toast.success(t.account.photoUpdated);
                router.refresh();
              });
            }}
          />
        </>
      ) : null}
    </div>
  );
}

export function OwnProfileForm({ phone, dateOfBirth, gender, today }: { phone: string | null; dateOfBirth: string | null; gender: string; today: string }) {
  const router = useRouter();
  const { t } = useI18n();
  const [state, action, pending] = useActionState(updateOwnProfileAction, null);
  const errors = state && !state.ok ? state.fieldErrors : undefined;
  const savedMsg = t.clientProfile.saved;
  useEffect(() => {
    if (state?.ok) {
      toast.success(savedMsg);
      router.refresh();
    } else if (state && !state.ok && !state.fieldErrors) toast.error(state.error);
  }, [state, router, savedMsg]);
  return (
    <form action={action} className="space-y-4" noValidate>
      <Field label={t.common.phone} htmlFor="phone" error={errors?.phone}>
        <Input id="phone" name="phone" type="tel" dir="ltr" defaultValue={phone ?? ""} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label={t.clientForm.dob} htmlFor="dateOfBirth" error={errors?.dateOfBirth}>
          <Input id="dateOfBirth" name="dateOfBirth" type="date" max={today} defaultValue={dateOfBirth ?? ""} />
        </Field>
        <Field label={t.clientForm.gender} htmlFor="gender" error={errors?.gender}>
          <Select id="gender" name="gender" defaultValue={gender}>
            {GENDER_KEYS.map((k) => (
              <option key={k} value={k}>
                {genderLabel(t, k)}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <Button type="submit" loading={pending}>
        {!pending ? <Save /> : null} {t.common.save}
      </Button>
    </form>
  );
}
