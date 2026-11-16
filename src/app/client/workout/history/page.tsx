import Link from "next/link";
import { ChevronRight, History, Lock } from "lucide-react";
import { requireClientPage } from "@/server/auth/guards";
import { getMyWorkoutHistory } from "@/server/services/workout-stats";
import { ForbiddenError } from "@/server/errors";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Pagination } from "@/components/ui/pagination";
import { WorkoutStatusBadge } from "@/components/shared/status";
import { WorkoutTabs } from "@/components/client/workout-tabs";
import { getI18n } from "@/i18n/server";
import { translateServerMessage } from "@/i18n/server-messages";

export async function generateMetadata() {
  const { t } = await getI18n();
  return { title: t.myTraining.historyTitle };
}

export default async function ClientWorkoutHistoryPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const actor = await requireClientPage();
  const { page } = await searchParams;
  const { t, fmt, locale } = await getI18n();
  let data;
  try {
    data = await getMyWorkoutHistory(actor, Number(page) || 1);
  } catch (err) {
    if (err instanceof ForbiddenError)
      return <EmptyState icon={<Lock />} title={t.session.turnedOff} description={translateServerMessage(err.message, locale)} />;
    throw err;
  }
  const unit = data.prefs.weightUnit;

  return (
    <div className="space-y-5">
      <WorkoutTabs />
      <div>
        <h1 className="text-[26px] font-semibold tracking-tight">{t.myTraining.historyTitle}</h1>
        <p className="mt-1 text-sm text-muted">{t.myTraining.historySub}</p>
      </div>
      {data.logs.length === 0 ? (
        <EmptyState icon={<History />} title={t.myTraining.emptyTitle} description={t.myTraining.emptyText} />
      ) : (
        <div className="space-y-3">
          {data.logs.map((log) => {
            const isToday = log.date === data.today;
            // Heaviest recorded set of each exercise — the numbers the client wants to compare.
            const tops = log.exercises
              .map((e) => {
                let best: { w: number; r: number } | null = null;
                for (const s of e.sets) {
                  if (s.status === "pending") continue;
                  const w = s.actualWeightKg ?? s.targetWeightKg;
                  const r = s.actualReps ?? s.targetReps;
                  if (w == null || r <= 0) continue;
                  if (!best || w > best.w || (w === best.w && r > best.r)) best = { w, r };
                }
                return best ? { name: e.name, ...best } : null;
              })
              .filter((x) => x != null);
            return (
              <Card key={log.id} className="overflow-hidden">
                <Link href={isToday ? "/client/workout" : `/client/workout/history/${log.id}`} className="group flex items-center gap-4 p-4 transition hover:bg-surface-2/50">
                  <div className="grid size-12 shrink-0 place-items-center rounded-xl bg-surface-2 text-center leading-none">
                    <span className="text-[10px] font-medium uppercase text-muted">{fmt.month(log.date)}</span>
                    <span className="text-lg font-semibold tabular">{fmt.dayNum(log.date)}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate font-semibold tracking-wide">{log.title}</p>
                      <WorkoutStatusBadge
                        status={log.displayStatus}
                        pct={log.displayStatus === "missed" || log.displayStatus === "pending" ? null : log.completionPercent}
                      />
                    </div>
                    <p className="text-xs text-muted">{isToday ? t.common.today : fmt.weekday(log.date)}</p>
                    {tops.length ? (
                      <ul className="mt-2 space-y-0.5 text-xs">
                        {tops.slice(0, 4).map((x) => (
                          <li key={x.name} className="flex gap-2">
                            <span dir="auto" className="min-w-0 truncate text-ink-2">
                              {x.name}
                            </span>
                            <span className="shrink-0 font-semibold tabular">
                              <bdi>{fmt.weight(x.w, unit)}</bdi> × <bdi>{fmt.num(x.r, 0)}</bdi>
                            </span>
                          </li>
                        ))}
                        {tops.length > 4 ? <li className="text-muted">+{fmt.num(tops.length - 4, 0)}</li> : null}
                      </ul>
                    ) : null}
                  </div>
                  <ChevronRight className="rtl-flip size-4 shrink-0 text-muted transition group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5" />
                </Link>
              </Card>
            );
          })}
          <div className="pt-2">
            <Pagination
              page={data.page}
              pages={data.pages}
              total={data.total}
              label={t.history.records}
              hrefFor={(p) => `/client/workout/history?page=${p}`}
            />
          </div>
        </div>
      )}
    </div>
  );
}
