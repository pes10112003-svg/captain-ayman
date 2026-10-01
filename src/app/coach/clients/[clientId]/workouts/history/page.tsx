import Link from "next/link";
import { ChevronRight, ClipboardList, History, Pencil } from "lucide-react";
import { requireCoachPage } from "@/server/auth/guards";
import { listWorkoutHistory } from "@/server/services/workouts";
import { getCoachPrefs } from "@/server/services/settings";
import { orNotFound } from "@/server/page-helpers";
import { Card } from "@/components/ui/card";
import { Segmented } from "@/components/ui/link-tabs";
import { Pagination } from "@/components/ui/pagination";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { WorkoutStatusBadge } from "@/components/shared/status";
import { cn } from "@/lib/utils";
import { getI18n } from "@/i18n/server";

export default async function WorkoutHistoryPage({ params, searchParams }: { params: Promise<{ clientId: string }>; searchParams: Promise<{ page?: string }> }) {
  const actor = await requireCoachPage();
  const { clientId } = await params;
  const { page } = await searchParams;
  const [data, prefs] = await Promise.all([orNotFound(listWorkoutHistory(actor, clientId, { page: Number(page) || 1, pageSize: 12 })), getCoachPrefs(actor.userId)]);
  const { t, fmt } = await getI18n();
  const base = `/coach/clients/${clientId}/workouts`;
  const tz = prefs.timezone;

  return (
    <>
      <div className="mb-5">
        <Segmented
          items={[
            { href: base, label: t.tabs.planEditor, icon: <ClipboardList />, exact: true },
            { href: `${base}/history`, label: t.tabs.history, icon: <History /> },
          ]}
        />
      </div>
      {data.logs.length === 0 ? (
        <EmptyState icon={<History />} title={t.history.emptyTitle} description={t.history.emptyText} />
      ) : (
        <div className="space-y-3">
          {data.logs.map((log) => {
            const repsTarget = log.exercises.reduce((a, e) => a + e.sets.reduce((b, s) => b + s.targetReps, 0), 0);
            const repsDone = log.exercises.reduce((a, e) => a + e.sets.reduce((b, s) => b + (s.status === "pending" ? 0 : (s.actualReps ?? 0)), 0), 0);
            return (
              <Card key={log.id} className="overflow-hidden">
                <Link href={`${base}/history/${log.id}`} className="group flex flex-col gap-3 p-4 transition hover:bg-surface-2/50 sm:flex-row sm:items-center sm:p-5">
                  <div className="flex w-full items-center gap-4 sm:w-56 sm:shrink-0">
                    <div className="grid size-12 shrink-0 place-items-center rounded-xl bg-surface-2 text-center leading-none">
                      <span className="text-[10px] font-medium uppercase text-muted">{fmt.month(log.date)}</span>
                      <span className="text-lg font-semibold tabular">{fmt.dayNum(log.date)}</span>
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-semibold tracking-wide">{log.title}</p>
                      <p className="text-xs text-muted">{fmt.weekday(log.date)}</p>
                    </div>
                  </div>
                  <div className="min-w-0 flex-1 text-xs text-muted">
                    <p className="line-clamp-2">
                      {log.exercises.map((e, i) => (
                        <span key={e.id}>
                          {i ? " · " : ""}
                          <span className="text-ink-2">{e.name}</span>{" "}
                          <span className="tabular">
                            {e.sets.map((s) => (s.status === "pending" ? "–" : fmt.num(s.actualReps, 0))).join("/")}
                          </span>
                        </span>
                      ))}
                    </p>
                  </div>
                  <div className="flex items-center gap-4 sm:justify-end">
                    <dl className="flex gap-4 text-xs">
                      <div>
                        <dt className="text-muted">{t.history.sets}</dt>
                        <dd className="font-semibold tabular">
                          {fmt.num(log.completedSets + log.partialSets, 0)}/{fmt.num(log.totalSets, 0)}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-muted">{t.history.reps}</dt>
                        <dd className="font-semibold tabular">
                          {fmt.num(repsDone, 0)}/{fmt.num(repsTarget, 0)}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-muted">{t.history.doneAt}</dt>
                        <dd className="font-semibold tabular">{log.completedAt ? fmt.time(log.completedAt, tz) : "—"}</dd>
                      </div>
                    </dl>
                    <div className="flex flex-col items-end gap-1">
                      <WorkoutStatusBadge status={log.displayStatus} pct={log.displayStatus === "missed" || log.displayStatus === "pending" ? null : log.completionPercent} />
                      {log.coachEditedAt ? (
                        <Badge tone="outline" className="h-5 text-[10px]">
                          <Pencil /> {t.history.editedByCoach}
                        </Badge>
                      ) : null}
                    </div>
                    <ChevronRight className={cn("rtl-flip size-4 text-muted transition group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5")} />
                  </div>
                </Link>
              </Card>
            );
          })}
          <div className="pt-2">
            <Pagination page={data.page} pages={data.pages} total={data.total} label={t.history.records} hrefFor={(p) => `${base}/history?page=${p}`} />
          </div>
        </div>
      )}
    </>
  );
}
