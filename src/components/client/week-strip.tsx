import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { getI18n } from "@/i18n/server";

type Day = { date: string; isToday: boolean; isPast: boolean; title: string | null; status: string | null; completionPercent: number | null };

export async function WeekStrip({ days }: { days: Day[] }) {
  const { t, fmt } = await getI18n();
  return (
    <ol className="grid grid-cols-7 gap-1.5">
      {days.map((d) => {
        const done = d.status === "completed";
        const missed = d.isPast && d.title && !done;
        return (
          <li
            key={d.date}
            className={cn(
              "flex flex-col items-center gap-1 rounded-2xl border px-0.5 py-2 text-center",
              d.isToday ? "border-ink bg-surface shadow-card" : "border-transparent",
            )}
            aria-label={`${fmt.weekday(d.date, "long")}: ${d.title ?? t.common.rest}${done ? ` · ${t.status.completed}` : missed ? ` · ${t.status.missed}` : ""}`}
          >
            <span className={cn("text-[10px] font-medium uppercase", d.isToday ? "text-ink" : "text-muted")}>{fmt.weekday(d.date, "short")}</span>
            <span
              className={cn(
                "grid size-7 place-items-center rounded-full text-xs font-semibold tabular",
                done ? "bg-primary text-primary-fg" : missed ? "bg-crit-soft text-crit-text" : d.title ? "bg-surface-3 text-ink" : "text-muted",
              )}
            >
              {done ? <Check className="size-3.5" strokeWidth={3} /> : fmt.dayNum(d.date)}
            </span>
            <span className="line-clamp-1 w-full px-0.5 text-[9px] font-semibold uppercase tracking-wide text-muted">{d.title ?? t.common.rest}</span>
          </li>
        );
      })}
    </ol>
  );
}
