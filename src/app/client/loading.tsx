import { Skeleton } from "@/components/ui/skeleton";
import { getI18n } from "@/i18n/server";

export default async function Loading() {
  const { t } = await getI18n();
  return (
    <div className="space-y-4" aria-busy="true" aria-label={t.common.loading}>
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-44" />
      <Skeleton className="h-36" />
      <div className="grid grid-cols-2 gap-3">
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
      </div>
    </div>
  );
}
