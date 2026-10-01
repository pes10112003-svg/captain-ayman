"use client";

import { useActionState } from "react";
import { ArrowRight } from "lucide-react";
import { enterAccessCodeAction } from "@/server/actions/access";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { FormMessage } from "@/components/shared/form-message";
import { useI18n } from "@/i18n/client";

export function AccessForm({ next }: { next: string }) {
  const { t } = useI18n();
  const [state, action, pending] = useActionState(enterAccessCodeAction, null);
  const fieldError = state && !state.ok ? state.fieldErrors?.code : undefined;
  return (
    <form action={action} className="space-y-4" noValidate>
      <input type="hidden" name="next" value={next} />
      {state && !state.ok && !fieldError ? <FormMessage>{state.error}</FormMessage> : null}
      <Field label={t.access.code} htmlFor="code" error={fieldError}>
        <Input
          id="code"
          name="code"
          dir="ltr"
          required
          autoFocus
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          placeholder={t.access.placeholder}
          className="h-12 text-center font-mono text-lg tracking-[0.2em] uppercase"
        />
      </Field>
      <Button type="submit" size="lg" className="w-full" loading={pending}>
        {t.access.submit} {!pending ? <ArrowRight className="rtl-flip" /> : null}
      </Button>
    </form>
  );
}
