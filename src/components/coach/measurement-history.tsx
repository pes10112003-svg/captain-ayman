"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { X } from "lucide-react";
import { deleteMeasurementAction } from "@/server/actions/progress";
import { ConfirmDialog } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useI18n } from "@/i18n/client";
import { measureTypeLabel } from "@/i18n/labels";

type Entry = { date: string; note: string | null; values: { id: string; key?: string | null; name: string; value: number; unit: string; auto: boolean }[] };

export function MeasurementHistory({ clientId, entries, canDelete }: { clientId?: string; entries: Entry[]; canDelete: boolean }) {
  const { t, f, fmt } = useI18n();
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <ol className="divide-y divide-line">
      {entries.map((e) => (
        <li key={e.date} className="flex flex-col gap-2 py-3.5 sm:flex-row sm:gap-5">
          <div className="w-32 shrink-0">
            <p className="text-sm font-semibold">{fmt.date(e.date)}</p>
            {e.note ? <p dir="auto" className="text-start text-xs text-muted">{e.note}</p> : null}
          </div>
          <ul className="flex flex-1 flex-wrap gap-1.5">
            {e.values.map((v) => {
              const name = measureTypeLabel(t, { key: v.key, name: v.name });
              const value = fmt.measure(v.value, v.unit);
              return (
                <li
                  key={v.id}
                  className={cn("group inline-flex h-7 items-center gap-1.5 rounded-lg border border-line bg-surface-2/60 ps-2.5 text-[13px]", canDelete ? "pe-1" : "pe-2.5")}
                  title={v.auto ? t.progress.autoCalculated : undefined}
                >
                  <span className="text-muted">{name}</span>
                  <span className="font-semibold tabular">{value}</span>
                  {canDelete && clientId ? (
                    <ConfirmDialog
                      title={f(t.progress.deleteTitle, { name })}
                      description={f(t.progress.deleteText, { value, date: fmt.date(e.date) })}
                      confirmLabel={t.common.delete}
                      onConfirm={async () => {
                        const res = await deleteMeasurementAction(clientId, v.id);
                        if (!res.ok) {
                          toast.error(res.error);
                          return false;
                        }
                        toast.success(t.progress.deleted);
                        start(() => router.refresh());
                      }}
                      trigger={
                        <button
                          type="button"
                          disabled={pending}
                          className="grid size-5 place-items-center rounded text-muted opacity-60 hover:bg-crit-soft hover:text-crit-text group-hover:opacity-100"
                          aria-label={f(t.progress.deleteLabel, { name, date: fmt.date(e.date) })}
                        >
                          <X className="size-3" />
                        </button>
                      }
                    />
                  ) : null}
                </li>
              );
            })}
          </ul>
        </li>
      ))}
    </ol>
  );
}
