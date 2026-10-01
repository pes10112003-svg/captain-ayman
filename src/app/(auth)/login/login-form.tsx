"use client";

import Link from "next/link";
import { useActionState } from "react";
import { LogIn } from "lucide-react";
import { loginAction } from "@/server/actions/auth";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { FormMessage } from "@/components/shared/form-message";
import { PasswordInput } from "@/components/shared/password-input";
import { useI18n } from "@/i18n/client";

export function LoginForm({ next }: { next?: string }) {
  const { t } = useI18n();
  const [state, formAction, pending] = useActionState(loginAction, null);
  const errors = state && !state.ok ? state.fieldErrors : undefined;
  return (
    <form action={formAction} className="space-y-4" noValidate>
      {next ? <input type="hidden" name="next" value={next} /> : null}
      {state && !state.ok ? <FormMessage>{state.error}</FormMessage> : null}
      <Field label={t.auth.email} htmlFor="email" error={errors?.email}>
        <Input id="email" name="email" type="email" dir="ltr" autoComplete="username" inputMode="email" required autoFocus placeholder="you@example.com" />
      </Field>
      <Field label={t.auth.password} htmlFor="password" error={errors?.password}>
        <PasswordInput id="password" name="password" autoComplete="current-password" required />
      </Field>
      <div className="flex justify-end">
        <Link href="/forgot-password" className="text-[13px] font-medium text-ink-2 hover:text-ink hover:underline">
          {t.auth.forgot}
        </Link>
      </div>
      <Button type="submit" size="lg" className="w-full" loading={pending}>
        {!pending ? <LogIn className="rtl-flip" /> : null} {t.auth.signIn}
      </Button>
    </form>
  );
}
