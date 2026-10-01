"use client";

import * as RD from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/i18n/client";
import { Button, type ButtonVariant } from "./button";

export const Dialog = RD.Root;
export const DialogTrigger = RD.Trigger;
export const DialogClose = RD.Close;

export function DialogContent({
  title,
  description,
  children,
  className,
  size = "md",
}: {
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  className?: string;
  size?: "sm" | "md" | "lg" | "xl";
}) {
  const { t } = useI18n();
  const width = { sm: "sm:max-w-md", md: "sm:max-w-lg", lg: "sm:max-w-2xl", xl: "sm:max-w-5xl" }[size];
  return (
    <RD.Portal>
      <RD.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px] data-[state=open]:animate-fade-in" />
      <RD.Content
        className={cn(
          "fixed inset-x-0 bottom-0 z-50 max-h-[92dvh] overflow-y-auto rounded-t-3xl border border-line bg-surface p-5 shadow-modal outline-none data-[state=open]:animate-slide-up sm:inset-auto sm:left-1/2 sm:top-1/2 sm:w-full sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl sm:p-6",
          width,
          className,
        )}
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <RD.Title className="text-lg font-semibold tracking-tight text-ink">{title}</RD.Title>
            {description ? (
              <RD.Description className="mt-1 text-sm text-muted">{description}</RD.Description>
            ) : (
              <RD.Description className="sr-only">{typeof title === "string" ? title : t.common.details}</RD.Description>
            )}
          </div>
          <RD.Close className="-me-1 -mt-1 grid size-9 place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-ink" aria-label={t.common.close}>
            <X className="size-4" />
          </RD.Close>
        </div>
        {children}
      </RD.Content>
    </RD.Portal>
  );
}

/** Confirmation modal for destructive or important actions. */
export function ConfirmDialog({
  trigger,
  title,
  description,
  confirmLabel,
  variant = "danger",
  onConfirm,
  children,
}: {
  trigger: ReactNode;
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  variant?: ButtonVariant;
  onConfirm: () => Promise<boolean | void> | boolean | void;
  children?: ReactNode;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  return (
    <Dialog open={open} onOpenChange={(o) => !busy && setOpen(o)}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent title={title} description={description} size="sm">
        {children}
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={() => setOpen(false)} disabled={busy}>
            {t.common.cancel}
          </Button>
          <Button
            variant={variant}
            loading={busy}
            onClick={async () => {
              setBusy(true);
              try {
                const keepOpen = (await onConfirm()) === false;
                if (!keepOpen) setOpen(false);
              } finally {
                setBusy(false);
              }
            }}
          >
            {confirmLabel ?? t.common.confirm}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
