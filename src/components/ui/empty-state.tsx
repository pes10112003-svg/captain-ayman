import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
  compact,
}: {
  icon?: ReactNode;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-2xl border border-dashed border-line-strong/70 bg-surface/60 text-center",
        compact ? "px-4 py-8" : "px-6 py-14",
        className,
      )}
    >
      {icon ? (
        <div className="mb-4 grid size-12 place-items-center rounded-2xl bg-surface-2 text-ink-2 ring-1 ring-line [&_svg]:size-5">{icon}</div>
      ) : null}
      <h3 className="text-[15px] font-semibold text-ink">{title}</h3>
      {description ? <p className="mt-1 max-w-sm text-sm text-muted">{description}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
