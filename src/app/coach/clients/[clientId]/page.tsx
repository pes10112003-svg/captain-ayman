import Link from "next/link";
import { ArrowDownRight, ArrowRight, ArrowUpRight, Clock, Dumbbell, NotebookPen, Scale, Target, Utensils } from "lucide-react";
import { requireCoachPage } from "@/server/auth/guards";
import { getClientOverview } from "@/server/services/overview";
import { orNotFound } from "@/server/page-helpers";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat";
import { ProgressBar, ProgressRing } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { LinkButton } from "@/components/ui/button";
import { PercentLinesChart, TrendChart } from "@/components/charts/charts";
import { ActivityList } from "@/components/shared/activity-list";
import { WorkoutStatusBadge } from "@/components/shared/status";
import { ageFromDob, dayOfWeek } from "@/lib/time";
import { kgTo, round } from "@/lib/units";
import { cn } from "@/lib/utils";
import { getI18n } from "@/i18n/server";
import { genderLabel, goalLabel } from "@/i18n/labels";

export default async function ClientOverviewPage({ params }: { params: Promise<{ clientId: string }> }) {
  const actor = await requireCoachPage();
  const { clientId } = await params;
  const o = await orNotFound(getClientOverview(actor, clientId));
  const { t, f, fmt } = await getI18n();
  const { client, prefs, progress, analytics } = o;
  const tz = prefs.timezone;
  const base = `/coach/clients/${client.id}`;
  const s = progress.summary;
  const todayDow = dayOfWeek(o.today);

  const weightType = progress.types.find((ty) => ty.key === "weight" && ty.isSystem);
  const weightSeries = weightType ? (progress.series[weightType.id] ?? []) : [];
  const goalDisplay = client.goalWeightKg != null ? round(kgTo(client.goalWeightKg, prefs.weightUnit), 1) : null;

  // Progress toward goal weight (0–100), only when start, current and goal are all known.
  let goalProgress: number | null = null;
  if (s.startingWeightKg != null && s.currentWeightKg != null && client.goalWeightKg != null && s.startingWeightKg !== client.goalWeightKg) {
    goalProgress = Math.max(0, Math.min(100, ((s.startingWeightKg - s.currentWeightKg) / (s.startingWeightKg - client.goalWeightKg)) * 100));
  }
  const losing = client.goalWeightKg != null && s.startingWeightKg != null ? client.goalWeightKg < s.startingWeightKg : true;
  const changeGood = s.changeKg == null ? null : losing ? s.changeKg <= 0 : s.changeKg >= 0;

  const mealsDone = o.mealsToday.filter((m) => m.status === "completed").length;
  const workoutStatus = o.todayLog ? o.todayLog.status : o.schedule[todayDow]?.title ? "pending" : o.workoutPlan ? "rest" : "no_plan";

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-5">
        <StatCard
          label={t.overview.currentWeight}
          icon={<Scale />}
          value={fmt.weight(s.currentWeightKg, prefs.weightUnit)}
          sub={s.lastMeasuredOn ? f(t.overview.measuredOn, { date: fmt.date(s.lastMeasuredOn) }) : t.overview.noMeasurements}
        />
        <StatCard
          label={t.overview.startingWeight}
          value={fmt.weight(s.startingWeightKg, prefs.weightUnit)}
          sub={f(t.overview.joined, { date: fmt.date(client.joinedOn) })}
        />
        <StatCard
          label={t.overview.weightChange}
          value={fmt.signedWeight(s.changeKg, prefs.weightUnit)}
          delta={
            changeGood == null || s.changeKg === 0
              ? undefined
              : {
                  value: changeGood ? t.overview.onTrack : t.overview.offTrack,
                  tone: changeGood ? "good" : "crit",
                  icon: (s.changeKg ?? 0) < 0 ? <ArrowDownRight className="rtl-flip" /> : <ArrowUpRight className="rtl-flip" />,
                }
          }
        />
        <StatCard
          label={t.overview.workoutCompletion}
          icon={<Dumbbell />}
          value={fmt.pct(analytics.last30.workoutRate)}
          sub={f(t.overview.workouts30, {
            done: fmt.num(analytics.last30.workoutsCompleted, 0),
            due: fmt.num(analytics.last30.workoutsDue, 0),
          })}
        />
        <StatCard
          label={t.overview.mealCompletion}
          icon={<Utensils />}
          value={fmt.pct(analytics.last30.mealRate)}
          sub={f(t.overview.meals30, {
            done: fmt.num(analytics.last30.mealsCompleted, 0),
            due: fmt.num(analytics.last30.mealsDue, 0),
          })}
          className="col-span-2 lg:col-span-1"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card>
          <CardHeader
            title={t.overview.today}
            description={fmt.date(o.today, {
              weekday: "long",
              month: "long",
              day: "numeric",
            })}
          />
          <CardBody className="space-y-5">
            <div className="flex items-center gap-4">
              <ProgressRing value={o.todayLog ? o.todayLog.completionPercent : 0} tone="series-1" size={64} label={t.overview.workoutCompletion}>
                <Dumbbell className="size-5 text-ink-2" />
              </ProgressRing>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium uppercase tracking-wide text-muted">{t.overview.workout}</p>
                <p className="truncate font-semibold">
                  {o.todayLog?.title ?? o.schedule[todayDow]?.title ?? (o.workoutPlan ? t.common.restDay : t.overview.noPlan)}
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <WorkoutStatusBadge status={workoutStatus} pct={o.todayLog?.status !== "pending" ? o.todayLog?.completionPercent : null} />
                  {o.todayLog?.completedAt ? (
                    <span className="inline-flex items-center gap-1 text-xs text-muted">
                      <Clock className="size-3" /> {fmt.time(o.todayLog.completedAt, tz)}
                    </span>
                  ) : null}
                </div>
              </div>
            </div>
            <div className="border-t border-line pt-4">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-xs font-medium uppercase tracking-wide text-muted">{t.overview.nutrition}</p>
                <span className="text-sm font-semibold tabular">
                  {f(t.overview.mealsCount, {
                    done: fmt.num(mealsDone, 0),
                    total: fmt.num(o.mealsToday.length, 0),
                  })}
                </span>
              </div>
              {o.mealsToday.length ? (
                <ul className="space-y-2">
                  {o.mealsToday.map((m) => (
                    <li key={m.id} className="flex items-center justify-between gap-3 text-sm">
                      <span className="flex min-w-0 items-center gap-2">
                        <span
                          className={cn("size-2 shrink-0 rounded-full", m.status === "completed" ? "bg-good" : "bg-surface-3 ring-1 ring-line-strong")}
                          aria-hidden
                        />
                        <span className="truncate">{m.mealName}</span>
                        <span className="text-xs text-muted">{fmt.clock(m.scheduledTime)}</span>
                      </span>
                      <span className={cn("shrink-0 text-xs", m.consumedAt ? "font-medium text-good-text" : "text-muted")}>
                        {m.consumedAt
                          ? f(t.overview.eatenAt, {
                              time: fmt.time(m.consumedAt, tz),
                            })
                          : t.overview.pending}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted">{t.overview.noNutritionPlan}</p>
              )}
            </div>
            <p className="border-t border-line pt-4 text-xs text-muted">
              {t.overview.lastActivity}{" "}
              <span className="font-medium text-ink-2">{client.lastActivityAt ? fmt.relativeDay(client.lastActivityAt, tz) : t.overview.noneYet}</span>
            </p>
          </CardBody>
        </Card>

        <Card className="xl:col-span-2">
          <CardHeader
            title={t.overview.weightProgress}
            description={
              goalDisplay != null
                ? f(t.overview.goalLine, {
                    value: fmt.weight(client.goalWeightKg, prefs.weightUnit),
                  })
                : t.overview.setGoalHint
            }
            action={
              <Link href={`${base}/progress`} className="inline-flex items-center gap-1 text-sm font-medium text-ink-2 hover:text-ink">
                {t.common.details} <ArrowRight className="rtl-flip size-4" />
              </Link>
            }
          />
          <CardBody>
            {goalProgress != null ? (
              <div className="mb-4">
                <div className="mb-1.5 flex justify-between text-xs text-muted">
                  <span>
                    {f(t.overview.start, {
                      value: fmt.weight(s.startingWeightKg, prefs.weightUnit),
                    })}
                  </span>
                  <span className="font-medium text-ink">
                    {f(t.overview.toGoal, {
                      pct: fmt.num(Math.round(goalProgress), 0),
                    })}
                  </span>
                  <span>
                    {f(t.overview.goal, {
                      value: fmt.weight(client.goalWeightKg, prefs.weightUnit),
                    })}
                  </span>
                </div>
                <ProgressBar
                  value={goalProgress}
                  tone="good"
                  label={f(t.overview.toGoal, {
                    pct: fmt.num(Math.round(goalProgress), 0),
                  })}
                />
              </div>
            ) : null}
            {weightSeries.length >= 2 ? (
              <TrendChart
                data={weightSeries}
                unit={fmt.unit(prefs.weightUnit)}
                name={t.progress.weight}
                color="series-3"
                goal={goalDisplay}
                goalLabel={t.progress.goal}
                height={230}
              />
            ) : (
              <EmptyState
                compact
                icon={<Scale />}
                title={t.overview.notEnoughData}
                description={t.overview.notEnoughDataText}
                action={
                  <LinkButton href={`${base}/progress?add=1`} size="sm" variant="secondary">
                    {t.clientHeader.addMeasurement}
                  </LinkButton>
                }
              />
            )}
          </CardBody>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader
            title={t.overview.adherenceTrend}
            description={f(t.overview.adherenceTrendSub, {
              w: fmt.pct(analytics.avgWeeklyWorkoutAdherence),
              n: fmt.pct(analytics.avgWeeklyNutritionAdherence),
            })}
          />
          <CardBody>
            {analytics.weekly.some((w) => w.workoutAdherence != null || w.mealAdherence != null) ? (
              <PercentLinesChart
                data={analytics.weekly.map((w) => ({
                  label: fmt.dateShort(w.week),
                  workout: w.workoutAdherence,
                  nutrition: w.mealAdherence,
                }))}
                series={[
                  {
                    key: "workout",
                    name: t.overview.workoutAdherence,
                    color: "series-1",
                  },
                  {
                    key: "nutrition",
                    name: t.overview.mealsEaten,
                    color: "series-2",
                  },
                ]}
              />
            ) : (
              <p className="py-10 text-center text-sm text-muted">{t.overview.adherenceEmpty}</p>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title={t.overview.profile} icon={<Target />} />
          <CardBody>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3.5 text-sm">
              {[
                [t.overview.age, fmt.num(ageFromDob(client.dateOfBirth, o.today), 0)],
                [t.overview.gender, genderLabel(t, client.gender)],
                [t.overview.height, fmt.length(client.heightCm, prefs.lengthUnit, 0)],
                [t.overview.goalWeight, fmt.weight(client.goalWeightKg, prefs.weightUnit)],
                [t.overview.fitnessGoal, goalLabel(t, client.goal)],
                [t.overview.joinedLabel, fmt.date(client.joinedOn)],
                [t.overview.lastSignIn, client.lastLoginAt ? fmt.relativeDay(client.lastLoginAt, tz) : t.common.never],
                [t.overview.bmi, fmt.num(s.bmi)],
              ].map(([k, v]) => (
                <div key={String(k)}>
                  <dt className="text-xs text-muted">{k}</dt>
                  <dd className="mt-0.5 font-medium">{v}</dd>
                </div>
              ))}
            </dl>
            {client.goalNote ? (
              <p dir="auto" className="mt-4 rounded-xl bg-surface-2 px-3 py-2.5 text-start text-sm text-ink-2">
                {client.goalNote}
              </p>
            ) : null}
          </CardBody>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card>
          <CardHeader
            title={t.overview.schedule}
            description={
              o.workoutPlan
                ? f(t.overview.scheduleSub, {
                    name: o.workoutPlan.name,
                    n: fmt.num(o.workoutPlan.trainingDays, 0),
                  })
                : t.overview.noWorkoutPlan
            }
            action={
              <LinkButton href={`${base}/workouts`} size="xs" variant="secondary">
                {t.common.edit}
              </LinkButton>
            }
          />
          <CardBody>
            <ul className="grid grid-cols-7 gap-1.5">
              {Array.from({ length: 7 }, (_, i) => (prefs.weekStartsOn + i) % 7).map((dow) => {
                const slot = o.schedule[dow]!;
                return (
                  <li
                    key={dow}
                    className={cn(
                      "flex flex-col items-center gap-1 rounded-xl border px-1 py-2.5 text-center",
                      dow === todayDow ? "border-ink bg-surface-2" : "border-line",
                    )}
                  >
                    <span className="text-[11px] font-medium text-muted">{fmt.weekdayName(dow, "short")}</span>
                    <span className={cn("line-clamp-2 text-[11px] font-semibold leading-tight", slot.title ? "text-ink" : "text-muted")}>
                      {slot.title ?? t.common.rest}
                    </span>
                  </li>
                );
              })}
            </ul>
          </CardBody>
        </Card>
        <Card>
          <CardHeader
            title={t.overview.nutritionPlan}
            description={o.nutritionPlan ? o.nutritionPlan.name : t.overview.noNutritionPlanTitle}
            action={
              <LinkButton href={`${base}/nutrition`} size="xs" variant="secondary">
                {t.common.edit}
              </LinkButton>
            }
          />
          <CardBody>
            {o.nutritionPlan ? (
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-xl bg-surface-2 p-3">
                  <dt className="text-xs text-muted">{t.overview.mealsPerDay}</dt>
                  <dd className="text-lg font-semibold">{fmt.num(o.nutritionPlan.meals, 0)}</dd>
                </div>
                <div className="rounded-xl bg-surface-2 p-3">
                  <dt className="text-xs text-muted">{t.overview.caloriesPerDay}</dt>
                  <dd className="text-lg font-semibold tabular">{fmt.num(o.nutritionPlan.totals?.calories, 0)}</dd>
                </div>
                <div className="col-span-2 flex justify-between text-xs text-muted">
                  <span>
                    {t.nutritionEditor.protein} {fmt.num(o.nutritionPlan.totals?.protein)} {fmt.unit("g")}
                  </span>
                  <span>
                    {t.nutritionEditor.carbs} {fmt.num(o.nutritionPlan.totals?.carbs)} {fmt.unit("g")}
                  </span>
                  <span>
                    {t.nutritionEditor.fats} {fmt.num(o.nutritionPlan.totals?.fats)} {fmt.unit("g")}
                  </span>
                </div>
              </dl>
            ) : (
              <p className="text-sm text-muted">{t.overview.nutritionPlanEmpty}</p>
            )}
          </CardBody>
        </Card>
        <Card>
          <CardHeader title={t.dashboard.recentActivity} />
          <CardBody>
            {o.activity.length ? (
              <ActivityList rows={o.activity} timezone={tz} showClient={false} dense />
            ) : (
              <p className="text-sm text-muted">{t.common.noActivityYet}</p>
            )}
          </CardBody>
        </Card>
      </div>

      {client.coachNotes ? (
        <Card>
          <CardHeader title={t.overview.privateNotes} icon={<NotebookPen />} action={<Badge tone="outline">{t.overview.onlyYou}</Badge>} />
          <CardBody>
            <p dir="auto" className="whitespace-pre-wrap text-start text-sm leading-relaxed text-ink-2">
              {client.coachNotes}
            </p>
          </CardBody>
        </Card>
      ) : null}
    </div>
  );
}
