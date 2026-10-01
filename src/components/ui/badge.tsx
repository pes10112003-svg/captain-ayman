import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const tones = {
  neutral: "bg-surface-2 text-ink-2 border-line",
  good: "bg-good-soft text-good-text border-transparent",
  warn: "bg-warn-soft text-warn-text border-transparent",
  crit: "bg-crit-soft text-crit-text border-transparent",
  info: "bg-info-soft text-info-text border-transparent",
  brand: "bg-brand text-brand-ink border-transparent",
  outline: "bg-transparent text-ink-2 border-line",
} as const;

const dots = {
  neutral: "bg-muted",
  good: "bg-good",
  warn: "bg-warn",
  crit: "bg-crit",
  info: "bg-info",
  brand: "bg-brand-ink",
  outline: "bg-muted",
} as const;

export type BadgeTone = keyof typeof tones;

export function Badge({
  tone = "neutral",
  dot,
  className,
  children,
  ...props
}: HTMLAttributes<HTMLSpanElement> & { tone?: BadgeTone; dot?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex h-6 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 text-xs font-medium [&_svg]:size-3.5",
        tones[tone],
        className,
      )}
      {...props}
    >
      {dot ? <span className={cn("size-1.5 rounded-full", dots[tone])} aria-hidden /> : null}
      {children}
    </span>
  );
}
