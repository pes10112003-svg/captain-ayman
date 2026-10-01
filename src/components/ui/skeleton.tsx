import { cn } from "@/lib/utils";
import { getI18n } from "@/i18n/server";

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-xl bg-surface-3/70", className)} aria-hidden />;
}

export async function PageSkeleton({ cards = 4 }: { cards?: number }) {
  const { t } = await getI18n();
  return (
    <div className="space-y-6" aria-busy="true" aria-label={t.common.loading}>
      <div className="space-y-2">
        <Skeleton className="h-7 w-56" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: cards }, (_, i) => (
          <Skeleton key={i} className="h-28" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Skeleton className="h-72 lg:col-span-2" />
        <Skeleton className="h-72" />
      </div>
    </div>
  );
}
