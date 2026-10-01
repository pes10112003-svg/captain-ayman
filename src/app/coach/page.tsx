import Link from "next/link";
import { ArrowRight, CheckCircle2, Dumbbell, Percent, Plus, Ruler, Camera, Users, Utensils, BarChart3 } from "lucide-react";
import { requireCoachPage } from "@/server/auth/guards";
import { getCoachDashboard } from "@/server/services/dashboard";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { LinkButton } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat";
import { ProgressBar } from "@/components/ui/progress";
import { Avatar } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/empty-state";
import { DailyBars } from "@/components/charts/charts";
import { ActivityList } from "@/components/shared/activity-list";
import { WorkoutStatusBadge, NutritionStatusBadge } from "@/components/shared/status";
import { angleLabel, goalLabel, measureTypeLabel } from "@/i18n/labels";
import { getI18n } from "@/i18n/server";
import { displayMeasurement } from "@/lib/units";
import { pct } from "@/lib/utils";

export async function generateMetadata() {
  const { t } = await getI18n();
  return { title: t.titles.dashboard };
}

export default async function CoachDashboardPage() {
  const actor = await requireCoachPage();
  const d = await getCoachDashboard(actor);
  const { t, f, fmt } = await getI18n();
  const tz = d.prefs.timezone;
  const firstName = actor.name.split(" ")[0];
  const greeting = f(t.dashboard.greetingName, { greeting: fmt.greeting(tz), name: firstName });

  if (d.counts.total === 0) {
    return (
      <>
        <PageHeader eyebrow={fmt.dateLong(d.today)} title={greeting} />
        <EmptyState
          icon={<Users />}
          title={t.dashboard.firstClientTitle}
          description={t.dashboard.firstClientText}
          action={
            <LinkButton href="/coach/clients/new">
              <Plus /> {t.clients.addClient}
            </LinkButton>
          }
        />
      </>
    );
  }

  const workoutPct = pct(d.workoutsToday.completed, d.workoutsToday.scheduled);
  const mealPct = pct(d.mealsToday.done, d.mealsToday.total);

  return (
    <>
      <PageHeader
        eyebrow={fmt.dateLong(d.today)}
        title={greeting}
        description={t.dashboard.subtitle}
        actions={
          <>
            <LinkButton href="/coach/reports" variant="secondary" size="sm">
              <BarChart3 /> {t.nav.reports}
            </LinkButton>
            <LinkButton href="/coach/clients/new" size="sm">
              <Plus /> {t.clients.addClient}
            </LinkButton>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard
          label={t.dashboard.clients}
          icon={<Users />}
          value={d.counts.total}
          sub={
            <span>
              <span className="font-medium text-good-text">{f(t.dashboard.activeN, { n: fmt.num(d.counts.active, 0) })}</span> ·{" "}
              {f(t.dashboard.inactiveN, { n: fmt.num(d.counts.inactive, 0) })}
            </span>
          }
          href="/coach/clients"
        />
        <StatCard
          label={t.dashboard.workoutsToday}
          icon={<Dumbbell />}
          value={
            <span className="tabular">
              {d.workoutsToday.completed}
              <span className="text-lg text-muted">/{d.workoutsToday.scheduled}</span>
            </span>
          }
          sub={<ProgressBar value={workoutPct} size="sm" tone="series-1" className="mt-1 w-24" label={t.dashboard.workoutsDoneToday} />}
          href="/coach/workouts"
        />
        <StatCard
          label={t.dashboard.mealsToday}
          icon={<Utensils />}
          value={
            <span className="tabular">
              {d.mealsToday.done}
              <span className="text-lg text-muted">/{d.mealsToday.total}</span>
            </span>
          }
          sub={<ProgressBar value={mealPct} size="sm" tone="series-2" className="mt-1 w-24" label={t.dashboard.mealsEatenToday} />}
          href="/coach/nutrition"
        />
        <StatCard
          label={t.dashboard.adherence30}
          icon={<Percent />}
          value={fmt.pct(d.adherence30.workout)}
          sub={<span>{f(t.dashboard.adherenceSub, { pct: fmt.pct(d.adherence30.nutrition) })}</span>}
          href="/coach/reports"
        />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader
            title={t.dashboard.todaysWorkouts}
            description={f(t.dashboard.scheduledToday, { n: fmt.num(d.workoutsToday.scheduled, 0) })}
            action={
              <Link href="/coach/workouts" className="inline-flex items-center gap-1 text-sm font-medium text-ink-2 hover:text-ink">
                {t.common.viewAll} <ArrowRight className="rtl-flip size-4" />
              </Link>
            }
          />
          <CardBody className="grid gap-6 md:grid-cols-2">
            <section aria-labelledby="done-h">
              <h4 id="done-h" className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted">
                <CheckCircle2 className="size-3.5 text-good" /> {f(t.dashboard.completedN, { n: fmt.num(d.completedToday.length, 0) })}
              </h4>
              {d.completedToday.length ? (
                <ul className="space-y-1">
                  {d.completedToday.map((c) => (
                    <li key={c.id}>
                      <Link href={`/coach/clients/${c.id}/workouts/history`} className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-surface-2">
                        <Avatar name={c.fullName} clientId={c.id} avatarKey={c.avatarKey} size="sm" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{c.fullName}</p>
                          <p className="truncate text-xs text-muted">
                            {c.today.workoutTitle} · {c.today.completedAt ? fmt.time(c.today.completedAt, tz) : ""}
                          </p>
                        </div>
                        <span className="text-sm font-semibold tabular text-good-text">{fmt.pct(Math.round(c.today.workoutPct ?? 0))}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="rounded-xl bg-surface-2 px-3 py-4 text-sm text-muted">{t.dashboard.noneCompleted}</p>
              )}
            </section>
            <section aria-labelledby="pending-h">
              <h4 id="pending-h" className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted">
                <span className="size-2 rounded-full bg-warn" aria-hidden /> {f(t.dashboard.notCompletedN, { n: fmt.num(d.notCompletedToday.length, 0) })}
              </h4>
              {d.notCompletedToday.length ? (
                <ul className="space-y-1">
                  {d.notCompletedToday.map((c) => (
                    <li key={c.id}>
                      <Link href={`/coach/clients/${c.id}`} className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-surface-2">
                        <Avatar name={c.fullName} clientId={c.id} avatarKey={c.avatarKey} size="sm" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{c.fullName}</p>
                          <p className="truncate text-xs text-muted">{c.today.workoutTitle}</p>
                        </div>
                        <WorkoutStatusBadge status={c.today.workout} pct={c.today.workout === "in_progress" ? c.today.workoutPct : null} />
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="rounded-xl bg-good-soft px-3 py-4 text-sm text-good-text">{t.dashboard.allTrained}</p>
              )}
            </section>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title={t.dashboard.recentActivity}
            action={
              <Link href="/coach/activity" className="inline-flex items-center gap-1 text-sm font-medium text-ink-2 hover:text-ink">
                {t.common.all} <ArrowRight className="rtl-flip size-4" />
              </Link>
            }
          />
          <CardBody>
            {d.activity.length ? (
              <ActivityList rows={d.activity.slice(0, 8)} timezone={tz} dense />
            ) : (
              <p className="text-sm text-muted">{t.dashboard.noActivity}</p>
            )}
          </CardBody>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title={t.dashboard.workoutsCompleted} description={t.dashboard.last14All} />
          <CardBody className="pt-3">
            <DailyBars data={d.series} valueKey="workoutsCompleted" name={t.dashboard.workoutsCompletedName} color="series-1" />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title={t.dashboard.mealAdherence} description={t.dashboard.last14Meals} />
          <CardBody className="pt-3">
            <DailyBars
              data={d.series}
              valueKey="mealAdherence"
              name={t.dashboard.ofMealsEaten}
              color="series-2"
              percent
            />
          </CardBody>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader title={t.dashboard.progressUpdates} description={t.dashboard.progressUpdatesSub} />
          <CardBody>
            {d.progressUpdates.length ? (
              <ul className="space-y-3">
                {d.progressUpdates.map((u, i) => (
                  <li key={i}>
                    <Link
                      href={`/coach/clients/${u.clientId}/${u.type === "photo" ? "photos" : "progress"}`}
                      className="flex items-start gap-3 rounded-xl p-1 hover:bg-surface-2"
                    >
                      <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-surface-2 text-ink-2">
                        {u.type === "photo" ? <Camera className="size-4" /> : <Ruler className="size-4" />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{u.clientName}</span>
                        <span className="block truncate text-xs text-muted">
                          {u.type === "photo"
                            ? f(t.dashboard.photo, { angle: angleLabel(t, u.angle) })
                            : u.items
                                .slice(0, 3)
                                .map((it) => {
                                  const dv = displayMeasurement(it.kind as never, it.value, it.unit, d.prefs);
                                  return `${measureTypeLabel(t, it)} ${fmt.measure(dv.value, dv.unit)}`;
                                })
                                .join(" · ")}
                        </span>
                      </span>
                      <span className="shrink-0 text-xs text-muted">{fmt.dateShort(u.date)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted">{t.dashboard.noProgress}</p>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title={t.dashboard.recentlyAdded}
            action={
              <Link href="/coach/clients?sort=joined&dir=desc" className="text-sm font-medium text-ink-2 hover:text-ink">
                {t.common.viewAll}
              </Link>
            }
          />
          <CardBody>
            <ul className="space-y-1">
              {d.recentClients.map((c) => (
                <li key={c.id}>
                  <Link href={`/coach/clients/${c.id}`} className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-surface-2">
                    <Avatar name={c.fullName} clientId={c.id} avatarKey={c.avatarKey} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{c.fullName}</span>
                      <span className="block truncate text-xs text-muted">{goalLabel(t, c.goal)}</span>
                    </span>
                    <span className="text-xs text-muted">{f(t.dashboard.joinedOn, { date: fmt.dateShort(c.joinedOn) })}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title={t.dashboard.quickAccess} description={t.dashboard.quickAccessSub} />
          <CardBody>
            <ul className="grid grid-cols-2 gap-2">
              {d.quickAccess.map((c) => {
                const s = d.todayStatus.get(c.id);
                return (
                  <li key={c.id}>
                    <Link href={`/coach/clients/${c.id}`} className="flex h-full flex-col gap-2 rounded-xl border border-line p-3 transition hover:border-line-strong hover:bg-surface-2">
                      <div className="flex items-center gap-2">
                        <Avatar name={c.fullName} clientId={c.id} avatarKey={c.avatarKey} size="xs" />
                        <span className="truncate text-[13px] font-medium">{c.fullName.split(" ")[0]}</span>
                      </div>
                      <span className="text-[11px] text-muted">{c.lastActivityAt ? f(t.dashboard.activeAgo, { ago: fmt.timeAgo(c.lastActivityAt) }) : t.dashboard.noActivity}</span>
                      {s ? (
                        <div className="flex flex-wrap gap-1">
                          {s.workout !== "no_plan" ? <WorkoutStatusBadge status={s.workout} /> : null}
                          {s.nutrition !== "no_plan" ? <NutritionStatusBadge status={s.nutrition} done={s.mealsDone} total={s.mealsTotal} /> : null}
                        </div>
                      ) : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </CardBody>
        </Card>
      </div>
    </>
  );
}
