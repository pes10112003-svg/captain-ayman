"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Eye, EyeOff, LockKeyhole, LockOpen, MessageCircle, Save, Wand2 } from "lucide-react";
import { updateAccessCodeAction } from "@/server/actions/access";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/input";
import { CopyButton } from "@/components/shared/copy-button";
import { useI18n } from "@/i18n/client";
import { brandName } from "@/lib/constants";
import { generateAccessCode } from "@/lib/passwords";
import { cn } from "@/lib/utils";

/** Coach-only: view, share, change or turn off the site-wide access code. */
export function AccessCodeCard({ enabled, code, appUrl }: { enabled: boolean; code: string | null; appUrl: string }) {
  const { t, f, locale } = useI18n();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [show, setShow] = useState(false);
  const [next, setNext] = useState("");
  const [error, setError] = useState<string | undefined>();

  const save = (value: string | null) =>
    start(async () => {
      setError(undefined);
      const res = await updateAccessCodeAction(value);
      if (!res.ok) {
        setError(res.fieldErrors?.code?.[0] ?? res.error);
        return;
      }
      toast.success(value ? t.settings.codeSaved : t.settings.codeOff);
      setNext("");
      setShow(true);
      router.refresh();
    });

  const invite = code ? f(t.settings.inviteTemplate, { brand: brandName(locale), url: appUrl, code }) : "";

  return (
    <div className="space-y-5">
      <div
        className={cn(
          "flex items-start gap-3 rounded-2xl p-4 text-sm",
          enabled ? "bg-good-soft text-good-text" : "bg-warn-soft text-warn-text",
        )}
      >
        {enabled ? <LockKeyhole className="mt-0.5 size-4 shrink-0" /> : <LockOpen className="mt-0.5 size-4 shrink-0" />}
        <p className="font-medium">{enabled ? t.settings.accessOn : t.settings.accessOff}</p>
      </div>

      {enabled && code ? (
        <div className="rounded-2xl border border-line bg-surface-2 p-4">
          <p className="text-xs text-muted">{t.settings.currentCode}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <code className="min-w-0 flex-1 font-mono text-xl font-semibold tracking-[0.18em]" dir="ltr">
              {show ? code : "•".repeat(Math.min(code.length, 10))}
            </code>
            <Button type="button" variant="ghost" size="sm" onClick={() => setShow((s) => !s)}>
              {show ? <EyeOff /> : <Eye />} {show ? t.settings.hide : t.settings.show}
            </Button>
            <CopyButton value={code} />
          </div>
          <div className="mt-3 flex flex-wrap gap-2 border-t border-line pt-3">
            <CopyButton value={invite} label={t.settings.copyInvite} variant="primary" />
            <a
              href={`https://wa.me/?text=${encodeURIComponent(invite)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-line px-3 text-[13px] font-medium text-ink-2 hover:bg-surface"
            >
              <MessageCircle className="size-4" aria-hidden /> WhatsApp
            </a>
          </div>
        </div>
      ) : null}

      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          save(next);
        }}
        noValidate
      >
        <Field label={t.settings.newCode} htmlFor="access-code" error={error} hint={t.settings.newCodeHint}>
          <div className="flex gap-2">
            <Input
              id="access-code"
              value={next}
              onChange={(e) => setNext(e.target.value)}
              dir="ltr"
              autoComplete="off"
              spellCheck={false}
              invalid={!!error}
              className="font-mono uppercase tracking-wider"
              maxLength={40}
            />
            <Button type="button" variant="secondary" onClick={() => setNext(generateAccessCode())}>
              <Wand2 /> {t.account.generate}
            </Button>
          </div>
        </Field>
        <div className="flex flex-wrap gap-2">
          <Button type="submit" loading={pending} disabled={!next.trim()}>
            {!pending ? <Save /> : null} {t.settings.setCode}
          </Button>
          {enabled ? (
            <ConfirmDialog
              title={t.settings.turnOffTitle}
              description={t.settings.turnOffText}
              confirmLabel={t.settings.turnOff}
              onConfirm={() => save(null)}
              trigger={
                <Button type="button" variant="danger-ghost">
                  <LockOpen /> {t.settings.turnOff}
                </Button>
              }
            />
          ) : null}
        </div>
      </form>
    </div>
  );
}
