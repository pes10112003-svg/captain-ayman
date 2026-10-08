import Link from "next/link";
import { BarChart3 } from "lucide-react";
import { requireCoachPage } from "@/server/auth/guards";
import { getReports } from "@/server/services/coach-overviews";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat";
import { Avatar } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/empty-state";
import { Segmented } from "@/components/ui/link-tabs";
import { DailyBars } from "@/components/charts/lazy";
import { getI18n } from "@/i18n/server";
import { cn, pct } from "@/lib/utils";

export async function generateMetadata() {
  const { t } = await getI18n();
  return { title: t.titles.reports };
}

const tone = (v: number | null) => (v == null ? "text-muted" : v >= 80 ? "text-good-text" : v >= 50 ? "text-warn-text" : "text-crit-text");

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  const actor = await requireCoachPage();
  const { days: daysParam } = await searchParams;
  const days = [7, 30, 90].includes(Number(daysParam)) ? Number(daysParam) : 30;
  const r = await getReports(actor, days);
  const { t, f, fmt } = await getI18n();
  const n0 = (n: number) => fmt.num(n, 0);
  return (
    <>
      <PageHeader
        title={t.coachPages.reportsTitle}
        description={f(t.coachPages.reportsSub, { from: fmt.date(r.from), to: fmt.date(r.today) })}
        actions={
          <Segmented
            items={[7, 30, 90].map((d) => ({ href: `/coach/reports?days=${d}`, label: fmt.plural(t.coachPages.days, d), exact: true }))}
            className={days ? "" : ""}
          />
        }
      />
      {!r.rows.length ? (
        <EmptyState icon={<BarChart3 />} title={t.coachPages.noActive} />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
            <StatCard
              label={t.coachPages.workoutCompletion}
              value={fmt.pct(pct(r.totals.workoutsCompleted, r.totals.workoutsDue))}
              sub={f(t.coachPages.workoutsRatio, { done: n0(r.totals.workoutsCompleted), due: n0(r.totals.workoutsDue) })}
            />
            <StatCard label={t.coachPages.avgAdherence} value={fmt.pct(r.totals.avgWorkoutAdherence)} sub={t.coachPages.repsVsTarget} />
            <StatCard
              label={t.coachPages.mealCompletion}
              value={fmt.pct(pct(r.totals.mealsCompleted, r.totals.mealsDue))}
              sub={f(t.coachPages.mealsRatio, { done: n0(r.totals.mealsCompleted), due: n0(r.totals.mealsDue) })}
            />
            <StatCard
              label={t.coachPages.activeClients}
              value={r.rows.length}
              sub={f(t.coachPages.withScheduled, { n: n0(r.rows.filter((x) => x.a.workoutsDue > 0).length) })}
            />
          </div>
          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader title={t.coachPages.workoutsPerDay} />
              <CardBody className="pt-3">
                <DailyBars data={r.series} valueKey="workoutsCompleted" name={t.dashboard.workoutsCompletedName} color="series-1" />
              </CardBody>
            </Card>
            <Card>
              <CardHeader title={t.coachPages.mealsPerDay} />
              <CardBody className="pt-3">
                <DailyBars data={r.series} valueKey="mealAdherence" name={t.dashboard.ofMealsEaten} color="series-2" percent />
              </CardBody>
            </Card>
          </div>
          <Card className="mt-6">
            <CardHeader title={t.coachPages.clientAdherence} description={f(t.coachPages.clientAdherenceSub, { n: n0(days) })} />
            <CardBody className="p-0 pt-3">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-sm">
                  <thead className="text-start text-xs text-muted">
                    <tr className="border-b border-line">
                      <th className="py-2.5 ps-5 text-start font-medium">{t.coachPages.colClient}</th>
                      <th className="py-2.5 text-start font-medium">{t.coachPages.colWorkoutsDone}</th>
                      <th className="py-2.5 text-start font-medium">{t.coachPages.colCompletion}</th>
                      <th className="py-2.5 text-start font-medium">{t.coachPages.colAvg}</th>
                      <th className="py-2.5 text-start font-medium">{t.coachPages.colMeals}</th>
                      <th className="py-2.5 text-start font-medium">{t.coachPages.colMealRate}</th>
                      <th className="py-2.5 pe-5 text-end font-medium">{t.coachPages.colWeight}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {r.rows.map((c) => (
                      <tr key={c.id} className="hover:bg-surface-2/50">
                        <td className="py-2.5 ps-5">
                          <Link href={`/coach/clients/${c.id}`} className="flex items-center gap-2.5 hover:underline">
                            <Avatar name={c.fullName} clientId={c.id} avatarKey={c.avatarKey} size="xs" />
                            <span className="font-medium">{c.fullName}</span>
                          </Link>
                        </td>
                        <td className="py-2.5 tabular">
                          {c.a.workoutsCompleted}/{c.a.workoutsDue}
                        </td>
                        <td className={cn("py-2.5 font-semibold tabular", tone(c.a.workoutRate))}>{fmt.pct(c.a.workoutRate)}</td>
                        <td className={cn("py-2.5 font-semibold tabular", tone(c.a.workoutAdherence))}>{fmt.pct(c.a.workoutAdherence)}</td>
                        <td className="py-2.5 tabular">
                          {c.a.mealsCompleted}/{c.a.mealsDue}
                        </td>
                        <td className={cn("py-2.5 font-semibold tabular", tone(c.a.mealRate))}>{fmt.pct(c.a.mealRate)}</td>
                        <td className="py-2.5 pe-5 text-end tabular">{`\u200E${fmt.signedWeight(c.changeKg, r.prefs.weightUnit)}`}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardBody>
          </Card>
        </>
      )}
    </>
  );
}
