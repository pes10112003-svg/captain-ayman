import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  sub,
  icon,
  delta,
  className,
  href,
}: {
  label: ReactNode;
  value: ReactNode;
  sub?: ReactNode;
  icon?: ReactNode;
  delta?: { value: string; tone: "good" | "crit" | "neutral"; icon?: ReactNode };
  className?: string;
  href?: string;
}) {
  const body = (
    <>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[13px] font-medium text-muted">{label}</p>
        {icon ? <span className="grid size-8 place-items-center rounded-lg bg-surface-2 text-ink-2 [&_svg]:size-4">{icon}</span> : null}
      </div>
      <p className="mt-2 text-[26px] font-semibold leading-none tracking-tight text-ink">{value}</p>
      {sub || delta ? (
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted">
          {delta ? (
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 font-medium [&_svg]:size-3",
                delta.tone === "good" ? "bg-good-soft text-good-text" : delta.tone === "crit" ? "bg-crit-soft text-crit-text" : "bg-surface-2 text-ink-2",
              )}
            >
              {delta.icon}
              {delta.value}
            </span>
          ) : null}
          {sub}
        </div>
      ) : null}
    </>
  );
  const cls = cn("block rounded-2xl border border-line bg-surface p-4 shadow-card sm:p-5", href && "transition hover:border-line-strong hover:shadow-pop", className);
  return href ? (
    <a href={href} className={cls}>
      {body}
    </a>
  ) : (
    <div className={cls}>{body}</div>
  );
}
