"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { Save } from "lucide-react";
import { updateCoachProfileAction, updateCoachSettingsAction } from "@/server/actions/settings";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { FormMessage } from "@/components/shared/form-message";
import { useI18n } from "@/i18n/client";

function useSaved(state: { ok: boolean } | null, message: string) {
  const router = useRouter();
  useEffect(() => {
    if (state?.ok) {
      toast.success(message);
      router.refresh();
    }
  }, [state, message, router]);
}

export function CoachProfileForm({ name, email }: { name: string; email: string }) {
  const { t } = useI18n();
  const [state, action, pending] = useActionState(updateCoachProfileAction, null);
  useSaved(state, t.settings.profileSaved);
  const errors = state && !state.ok ? state.fieldErrors : undefined;
  return (
    <form action={action} className="space-y-4" noValidate>
      {state && !state.ok && !errors ? <FormMessage>{state.error}</FormMessage> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t.settings.name} htmlFor="name" error={errors?.name}>
          <Input id="name" name="name" defaultValue={name} required />
        </Field>
        <Field label={t.settings.email} htmlFor="email" error={errors?.email}>
          <Input id="email" name="email" type="email" dir="ltr" defaultValue={email} required />
        </Field>
      </div>
      <Button type="submit" loading={pending}>
        {!pending ? <Save /> : null} {t.settings.saveProfile}
      </Button>
    </form>
  );
}

/** Brand name only — timezone (Egypt), units (kg/cm) and week start (Saturday) are fixed for this app. */
export function AppSettingsForm({ businessName }: { businessName: string | null }) {
  const { t } = useI18n();
  const [state, action, pending] = useActionState(updateCoachSettingsAction, null);
  useSaved(state, t.settings.settingsSaved);
  const errors = state && !state.ok ? state.fieldErrors : undefined;
  return (
    <form action={action} className="space-y-4" noValidate>
      {state && !state.ok && !errors ? <FormMessage>{state.error}</FormMessage> : null}
      <Field label={t.settings.businessName} htmlFor="businessName" error={errors?.businessName} optional hint={t.settings.businessNameHint}>
        <Input id="businessName" name="businessName" defaultValue={businessName ?? ""} maxLength={120} className="sm:max-w-sm" />
      </Field>
      <Button type="submit" loading={pending}>
        {!pending ? <Save /> : null} {t.settings.saveSettings}
      </Button>
    </form>
  );
}
