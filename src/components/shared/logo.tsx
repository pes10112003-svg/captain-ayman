"use client";

import { cn } from "@/lib/utils";
import { brandName } from "@/lib/constants";
import { useI18n } from "@/i18n/client";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("size-8", className)} aria-hidden>
      <rect width="32" height="32" rx="9" fill="#C4F042" />
      <path d="M7 17.5h4.2l2.6-6.5 4.4 11 2.6-6.5H25" fill="none" stroke="#0B0B0B" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Brand name in the viewer's language ("كابتن أيمن" / "Captain Ayman"). */
export function BrandName({ className }: { className?: string }) {
  const { locale } = useI18n();
  return <span className={className}>{brandName(locale)}</span>;
}

export function Logo({ className, subtitle, invert }: { className?: string; subtitle?: string; invert?: boolean }) {
  const { locale } = useI18n();
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark />
      <span className="leading-none">
        <span className={cn("block text-[17px] font-semibold tracking-tight", invert ? "text-white" : "text-ink")}>{brandName(locale)}</span>
        {subtitle ? <span className={cn("mt-1 block text-[11px]", invert ? "text-white/55" : "text-muted")}>{subtitle}</span> : null}
      </span>
    </span>
  );
}
