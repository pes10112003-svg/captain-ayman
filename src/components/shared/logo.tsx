"use client";

import { cn } from "@/lib/utils";
import { brandName } from "@/lib/constants";
import { useI18n } from "@/i18n/client";
import { AYMAN_PATHS, CAPTAIN_PATHS, LOGO_VIEWBOX } from "./logo-paths";

/**
 * The Captain Ayman wordmark. "AYMAN" uses the current text colour; "CAPTAIN" uses
 * --logo-accent (ink on light backgrounds, lime on dark) or lime when `invert` (dark sidebar).
 */
export function LogoWordmark({ className, invert }: { className?: string; invert?: boolean }) {
  const { locale } = useI18n();
  const accent = invert ? "#C4F042" : "var(--logo-accent)";
  return (
    <svg viewBox={LOGO_VIEWBOX} className={cn("h-9 w-auto shrink-0", invert ? "text-white" : "text-ink", className)} role="img" aria-label={brandName(locale)}>
      {CAPTAIN_PATHS.map((d, i) => (
        <path key={`c${i}`} d={d} fill={accent} />
      ))}
      {AYMAN_PATHS.map((d, i) => (
        <path key={`a${i}`} d={d} fill="currentColor" />
      ))}
    </svg>
  );
}

/** Logo with an optional small caption beside it (business name / tagline). */
export function Logo({ className, subtitle, invert, size = "md" }: { className?: string; subtitle?: string; invert?: boolean; size?: "sm" | "md" | "lg" }) {
  return (
    <span className={cn("inline-flex items-center gap-3", className)}>
      <LogoWordmark invert={invert} className={{ sm: "h-8", md: "h-10", lg: "h-12" }[size]} />
      {subtitle ? (
        <span className={cn("border-s ps-3 text-xs leading-snug", invert ? "border-white/15 text-white/60" : "border-line text-muted")}>{subtitle}</span>
      ) : null}
    </span>
  );
}
