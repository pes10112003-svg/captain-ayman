"use client";

import { useEffect } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n/client";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const { t, f } = useI18n();
  useEffect(() => {
    console.error(error);
  }, [error]);
  const offline = typeof navigator !== "undefined" && !navigator.onLine;
  return (
    <main className="grid min-h-[60dvh] place-items-center px-6 py-16 text-center">
      <div className="max-w-sm">
        <div className="mx-auto mb-5 grid size-14 place-items-center rounded-2xl bg-crit-soft">
          <AlertTriangle className="size-6 text-crit-text" />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">{offline ? t.errors.offlineTitle : t.errors.errorTitle}</h1>
        <p className="mt-2 text-sm text-muted">{offline ? t.errors.offlineText : t.errors.errorText}</p>
        {error.digest ? (
          <p className="mt-2 font-mono text-[11px] text-muted" dir="ltr">
            {f(t.errors.ref, { id: error.digest })}
          </p>
        ) : null}
        <Button className="mt-6" onClick={reset}>
          <RotateCcw /> {t.common.retry}
        </Button>
      </div>
    </main>
  );
}
