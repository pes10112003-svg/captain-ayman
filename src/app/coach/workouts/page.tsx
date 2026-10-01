import Link from "next/link";
import { CalendarCheck2, CircleDashed, Clock } from "lucide-react";
import { requireCoachPage } from "@/server/auth/guards";
import { getWorkoutsOverview } from "@/server/services/coach-overviews";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Avatar } from "@/components/ui/avatar";
import { ProgressBar } from "@/components/ui/progress";
import { EmptyState } from "@/components/ui/empty-state";
import { WorkoutStatusBadge } from "@/components/shared/status";
import { getI18n } from "@/i18n/server";

export async function generateMetadata() {
  const { t } = await getI18n();
  return { title: t.titles.workouts };
}

const ORDER = { in_progress: 0, pending: 1, completed: 2, rest: 3, no_plan: 4 } as const;

export default async function WorkoutsOverviewPage() {
  const actor = await requireCoachPage();
  const d = await getWorkoutsOverview(actor);
  const { t, f, fmt } = await getI18n();
  const tz = d.prefs.timezone;
  const training = d.rows.filter((r) => ["pending", "in_progress", "completed"].includes(r.today.workout));
  const noPlan = d.rows.filter((r) => r.today.workout === "no_plan");
  const sorted = [...d.rows].sort((a, b) => ORDER[a.today.workout] - ORDER[b.today.workout] || a.fullName.localeCompare(b.fullName));

  return (
    <>
      <PageHeader
        eyebrow={fmt.dateLong(d.today)}
        title={t.titles.workouts}
        description={f(t.coachPages.workoutsSub, {
          done: fmt.num(training.filter((r) => r.today.workout === "completed").length, 0),
          total: fmt.num(training.length, 0),
        })}
      />
      {d.rows.length === 0 ? (
        <EmptyState icon={<CalendarCheck2 />} title={t.coachPages.noActive} description={t.coachPages.noActiveText} />
      ) : (
        <div className="grid gap-6 xl:grid-cols-3">
          <Card className="xl:col-span-2">
            <CardHeader title={t.coachPages.todayAll} />
            <CardBody className="p-0 pt-3">
              <ul className="divide-y divide-line">
                {sorted.map((r) => (
                  <li key={r.id}>
                    <Link href={`/coach/clients/${r.id}/workouts${r.today.workout === "no_plan" ? "" : "/history"}`} className="flex items-center gap-3 px-5 py-3 hover:bg-surface-2/60">
                      <Avatar name={r.fullName} clientId={r.id} avatarKey={r.avatarKey} size="sm" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{r.fullName}</p>
                        <p className="truncate text-xs text-muted">{r.today.workoutTitle ?? (r.today.workout === "rest" ? t.common.restDay : t.overview.noWorkoutPlan)}</p>
                      </div>
                      {r.today.workout === "in_progress" || r.today.workout === "completed" ? (
                        <div className="hidden w-28 sm:block">
                          <ProgressBar value={r.today.workoutPct} size="sm" tone="series-1" label={f(t.coachPages.workoutProgress, { name: r.fullName })} />
                        </div>
                      ) : null}
                      {r.today.completedAt ? (
                        <span className="hidden items-center gap-1 text-xs text-muted md:inline-flex">
                          <Clock className="size-3" />
                          {fmt.time(r.today.completedAt, tz)}
                        </span>
                      ) : null}
                      <WorkoutStatusBadge status={r.today.workout} pct={r.today.workout === "completed" || r.today.workout === "in_progress" ? r.today.workoutPct : null} />
                    </Link>
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>
          <div className="space-y-6">
            <Card>
              <CardHeader title={t.coachPages.completed7} />
              <CardBody>
                {d.recent.length ? (
                  <ul className="space-y-3">
                    {d.recent.map((r) => (
                      <li key={r.id}>
                        <Link href={`/coach/clients/${r.clientId}/workouts/history/${r.id}`} className="flex items-center gap-3 rounded-xl p-1 hover:bg-surface-2">
                          <Avatar name={r.client.fullName} clientId={r.client.id} avatarKey={r.client.avatarKey} size="sm" />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">
                              {r.client.fullName} <span className="font-normal text-muted">· {r.title}</span>
                            </p>
                            <p className="text-xs text-muted">{r.completedAt ? fmt.relativeDay(r.completedAt, tz) : fmt.date(r.date)}</p>
                          </div>
                          <span className="text-sm font-semibold tabular">{fmt.pct(Math.round(r.completionPercent))}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted">{t.coachPages.noneThisWeek}</p>
                )}
              </CardBody>
            </Card>
            {noPlan.length ? (
              <Card>
                <CardHeader title={t.coachPages.needsPlan} icon={<CircleDashed />} />
                <CardBody className="space-y-2">
                  {noPlan.map((c) => (
                    <Link key={c.id} href={`/coach/clients/${c.id}/workouts`} className="flex items-center gap-3 rounded-xl p-1 hover:bg-surface-2">
                      <Avatar name={c.fullName} clientId={c.id} avatarKey={c.avatarKey} size="sm" />
                      <span className="flex-1 truncate text-sm font-medium">{c.fullName}</span>
                      <span className="text-xs font-medium text-info-text">{t.coachPages.buildPlan}</span>
                    </Link>
                  ))}
                </CardBody>
              </Card>
            ) : null}
          </div>
        </div>
      )}
    </>
  );
}
