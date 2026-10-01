"use client";

import { useActionState, useEffect, useRef } from "react";
import { KeyRound } from "lucide-react";
import { toast } from "sonner";
import { changePasswordAction, resetPasswordAction } from "@/server/actions/auth";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/input";
import { useI18n } from "@/i18n/client";
import { FormMessage } from "./form-message";
import { PasswordInput } from "./password-input";

export function ChangePasswordForm({ requireCurrent, redirectHome, submitLabel }: { requireCurrent: boolean; redirectHome?: boolean; submitLabel?: string }) {
  const { t } = useI18n();
  const [state, action, pending] = useActionState(changePasswordAction, null);
  const formRef = useRef<HTMLFormElement>(null);
  const errors = state && !state.ok ? state.fieldErrors : undefined;
  const updatedMsg = t.auth.passwordUpdated;
  useEffect(() => {
    if (state?.ok) {
      toast.success(updatedMsg);
      formRef.current?.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);
  return (
    <form ref={formRef} action={action} className="space-y-4" noValidate>
      {redirectHome ? <input type="hidden" name="redirect" value="home" /> : null}
      {state && !state.ok && !errors ? <FormMessage>{state.error}</FormMessage> : null}
      {requireCurrent ? (
        <Field label={t.auth.currentPassword} htmlFor="currentPassword" error={errors?.currentPassword}>
          <PasswordInput id="currentPassword" name="currentPassword" autoComplete="current-password" required />
        </Field>
      ) : null}
      <Field label={t.auth.newPassword} htmlFor="newPassword" error={errors?.newPassword} hint={t.auth.newPasswordHint}>
        <PasswordInput id="newPassword" name="newPassword" autoComplete="new-password" minLength={8} required />
      </Field>
      <Field label={t.auth.confirmPassword} htmlFor="confirmPassword" error={errors?.confirmPassword}>
        <PasswordInput id="confirmPassword" name="confirmPassword" autoComplete="new-password" required />
      </Field>
      <Button type="submit" loading={pending} className={redirectHome ? "w-full" : undefined} size={redirectHome ? "lg" : "md"}>
        {!pending ? <KeyRound /> : null} {submitLabel ?? t.auth.updatePassword}
      </Button>
    </form>
  );
}

export function ResetPasswordForm({ token }: { token: string }) {
  const { t } = useI18n();
  const [state, action, pending] = useActionState(resetPasswordAction, null);
  const errors = state && !state.ok ? state.fieldErrors : undefined;
  return (
    <form action={action} className="space-y-4" noValidate>
      <input type="hidden" name="token" value={token} />
      {state && !state.ok ? <FormMessage>{state.error}</FormMessage> : null}
      <Field label={t.auth.newPassword} htmlFor="newPassword" error={errors?.newPassword} hint={t.auth.newPasswordHint}>
        <PasswordInput id="newPassword" name="newPassword" autoComplete="new-password" minLength={8} required autoFocus />
      </Field>
      <Field label={t.auth.confirmPassword} htmlFor="confirmPassword" error={errors?.confirmPassword}>
        <PasswordInput id="confirmPassword" name="confirmPassword" autoComplete="new-password" required />
      </Field>
      <Button type="submit" size="lg" className="w-full" loading={pending}>
        {t.auth.setNewPassword}
      </Button>
    </form>
  );
}
