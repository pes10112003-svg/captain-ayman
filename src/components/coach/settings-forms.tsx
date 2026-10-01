"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { Save } from "lucide-react";
import { updateCoachProfileAction, updateCoachSettingsAction } from "@/server/actions/settings";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";
import { FormMessage } from "@/components/shared/form-message";
import { COMMON_TIMEZONES } from "@/lib/constants";
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

export function AppSettingsForm({
  businessName,
  timezone,
  weightUnit,
  lengthUnit,
  weekStartsOn,
}: {
  businessName: string | null;
  timezone: string;
  weightUnit: string;
  lengthUnit: string;
  weekStartsOn: number;
}) {
  const { t, fmt } = useI18n();
  const [state, action, pending] = useActionState(updateCoachSettingsAction, null);
  useSaved(state, t.settings.settingsSaved);
  const errors = state && !state.ok ? state.fieldErrors : undefined;
  const zones = COMMON_TIMEZONES.includes(timezone) ? COMMON_TIMEZONES : [timezone, ...COMMON_TIMEZONES];
  return (
    <form action={action} className="space-y-4" noValidate>
      {state && !state.ok && !errors ? <FormMessage>{state.error}</FormMessage> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t.settings.businessName} htmlFor="businessName" error={errors?.businessName} optional hint={t.settings.businessNameHint}>
          <Input id="businessName" name="businessName" defaultValue={businessName ?? ""} maxLength={120} />
        </Field>
        <Field label={t.settings.timezone} htmlFor="timezone" error={errors?.timezone} hint={t.settings.timezoneHint}>
          <Select id="timezone" name="timezone" defaultValue={timezone}>
            {zones.map((z) => (
              <option key={z} value={z}>
                {z.replace(/_/g, " ")}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t.settings.weightUnit} htmlFor="weightUnit" error={errors?.weightUnit}>
          <Select id="weightUnit" name="weightUnit" defaultValue={weightUnit}>
            <option value="kg">{t.settings.kg}</option>
            <option value="lb">{t.settings.lb}</option>
          </Select>
        </Field>
        <Field label={t.settings.lengthUnit} htmlFor="lengthUnit" error={errors?.lengthUnit}>
          <Select id="lengthUnit" name="lengthUnit" defaultValue={lengthUnit}>
            <option value="cm">{t.settings.cm}</option>
            <option value="in">{t.settings.in}</option>
          </Select>
        </Field>
        <Field label={t.settings.weekStart} htmlFor="weekStartsOn" error={errors?.weekStartsOn} hint={t.settings.weekStartHint}>
          <Select id="weekStartsOn" name="weekStartsOn" defaultValue={String(weekStartsOn)}>
            {[0, 1, 2, 3, 4, 5, 6].map((i) => (
              <option key={i} value={i}>
                {fmt.weekdayName(i)}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <p className="text-xs text-muted">{t.settings.metricNote}</p>
      <Button type="submit" loading={pending}>
        {!pending ? <Save /> : null} {t.settings.saveSettings}
      </Button>
    </form>
  );
}
