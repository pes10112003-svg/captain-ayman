"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Check, Copy } from "lucide-react";
import { Button, type ButtonVariant } from "@/components/ui/button";
import { useI18n } from "@/i18n/client";

export function CopyButton({ value, label, variant = "secondary", className }: { value: string; label?: string; variant?: ButtonVariant; className?: string }) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  return (
    <Button
      type="button"
      variant={variant}
      size="sm"
      className={className}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1600);
        } catch {
          toast.error(t.common.copyFailed);
        }
      }}
    >
      {copied ? <Check /> : <Copy />} {copied ? t.common.copied : (label ?? t.common.copy)}
    </Button>
  );
}
