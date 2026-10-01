"use client";

import { useActionState } from "react";
import { Mail } from "lucide-react";
import { forgotPasswordAction } from "@/server/actions/auth";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { FormMessage } from "@/components/shared/form-message";
import { useI18n } from "@/i18n/client";

export function ForgotPasswordForm() {
  const { t } = useI18n();
  const [state, action, pending] = useActionState(forgotPasswordAction, null);
  if (state?.ok) return <FormMessage tone="success">{t.auth.resetSent}</FormMessage>;
  return (
    <form action={action} className="space-y-4" noValidate>
      {state && !state.ok ? <FormMessage>{state.error}</FormMessage> : null}
      <Field label={t.auth.email} htmlFor="email" error={state && !state.ok ? state.fieldErrors?.email : undefined}>
        <Input id="email" name="email" type="email" dir="ltr" autoComplete="email" required autoFocus />
      </Field>
      <Button type="submit" size="lg" className="w-full" loading={pending}>
        {!pending ? <Mail /> : null} {t.auth.sendLink}
      </Button>
    </form>
  );
}
