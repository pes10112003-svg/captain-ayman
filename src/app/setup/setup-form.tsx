"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { setupAction } from "@/server/actions/access";
import { Button, buttonClass } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { FormMessage } from "@/components/shared/form-message";
import { PasswordInput } from "@/components/shared/password-input";
import { useI18n } from "@/i18n/client";
import { cn } from "@/lib/utils";

export function SetupForm({ hasCoach }: { hasCoach: boolean }) {
  const { t } = useI18n();
  const [mode, setMode] = useState<"create" | "reset">(hasCoach ? "reset" : "create");
  const [state, action, pending] = useActionState(setupAction, null);
  const errors = state && !state.ok ? state.fieldErrors : undefined;

  if (state?.ok)
    return (
      <div className="space-y-5">
        <FormMessage tone="success">{t.setup.done}</FormMessage>
        <Link href="/login" className={buttonClass("primary", "lg", "w-full")}>
          {t.auth.signIn}
        </Link>
      </div>
    );

  return (
    <form action={action} className="space-y-4" noValidate>
      <input type="hidden" name="mode" value={mode} />
      <div className="inline-flex w-full rounded-xl border border-line bg-surface-2 p-1" role="radiogroup">
        {(
          [
            ["create", t.setup.createCoach],
            ["reset", t.setup.resetCoach],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={mode === value}
            disabled={value === "create" && hasCoach}
            onClick={() => setMode(value)}
            className={cn(
              "h-9 flex-1 rounded-lg px-2 text-[13px] font-medium transition disabled:opacity-40",
              mode === value ? "bg-surface text-ink shadow-card" : "text-muted hover:text-ink",
            )}
          >
            {label}
          </button>
        ))}
      </div>
      {state && !state.ok && !errors ? <FormMessage>{state.error}</FormMessage> : null}
      <Field label={t.setup.adminKey} htmlFor="adminKey" error={errors?.adminKey}>
        <PasswordInput id="adminKey" name="adminKey" autoComplete="off" required />
      </Field>
      {mode === "create" ? (
        <Field label={t.setup.coachName} htmlFor="name" error={errors?.name}>
          <Input id="name" name="name" autoComplete="name" required />
        </Field>
      ) : null}
      <Field label={t.setup.coachEmail} htmlFor="email" error={errors?.email}>
        <Input id="email" name="email" type="email" dir="ltr" autoComplete="username" required />
      </Field>
      <Field label={t.setup.coachPassword} htmlFor="password" error={errors?.password} hint={t.auth.newPasswordHint}>
        <PasswordInput id="password" name="password" autoComplete="new-password" minLength={8} required />
      </Field>
      <Button type="submit" size="lg" className="w-full" loading={pending}>
        {mode === "create" ? t.setup.submitCreate : t.setup.submitReset}
      </Button>
    </form>
  );
}
