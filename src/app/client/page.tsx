import Link from "next/link";
import { ArrowRight, CheckCircle2, Coffee, Dumbbell, Scale, Utensils } from "lucide-react";
import { requireClientPage } from "@/server/auth/guards";
import { getClientHome } from "@/server/services/client-home";
import { Card } from "@/components/ui/card";
import { ProgressBar, ProgressRing } from "@/components/ui/progress";
import { Sparkline } from "@/components/charts/sparkline";
import { WeekStrip } from "@/components/client/week-strip";
import { clockToMinutes, minutesOfDayInTz } from "@/lib/time";
import { cn } from "@/lib/utils";
import { getI18n } from "@/i18n/server";

export async function generateMetadata() {
  const { t } = await getI18n();
  return { title: t.titles.today };
}

export default async function ClientHomePage() {
  const actor = await requireClientPage();
  const [h, { t, f, fmt }] = await Promise.all([getClientHome(actor), getI18n()]);
  const tz = h.prefs.timezone;
  const firstName = h.client.fullName.split(" ")[0];
  const nowMin = minutesOfDayInTz(new Date(), tz);

  const mealsDone = h.meals?.filter((m) => m.status === "completed").length ?? 0;
  const nextMeal = h.meals?.find((m) => m.status === "pending");
  const w = h.workout;
  const weightType = h.progress?.types.find((ty) => ty.key === "weight" && ty.isSystem);
  const weightSeries = weightType ? (h.progress?.series[weightType.id] ?? []) : [];

  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm text-muted">{fmt.dateLong(h.today)}</p>
        <h1 className="mt-0.5 text-[26px] font-semibold tracking-tight">{f(t.clientHome.hello, { greeting: fmt.greeting(tz), name: firstName })}</h1>
      </div>

      {h.permissions.viewWorkouts ? (
        <Link href="/client/workout" className="block">
          <Card
            className={cn(
              "relative overflow-hidden p-5 transition active:scale-[0.99]",
              w && w.status !== "completed" && "border-transparent bg-sidebar text-white shadow-pop",
            )}
          >
            {w && w.status !== "completed" ? (
              <div
                className="pointer-events-none absolute -end-16 -top-16 size-56 rounded-full opacity-25 blur-2xl"
                style={{ background: "radial-gradient(circle, #C4F042, transparent 65%)" }}
                aria-hidden
              />
            ) : null}
            <p
              className={cn(
                "flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.1em]",
                w && w.status !== "completed" ? "text-[#C4F042]" : "text-muted",
              )}
            >
              <Dumbbell className="size-4" /> {t.clientHome.todaysWorkout}
            </p>
            {w ? (
              <div className="relative mt-3 flex items-center gap-4">
                <div className="min-w-0 flex-1">
                  <h2 className="text-3xl font-bold tracking-tight">{w.title}</h2>
                  {w.muscleGroup ? <p className={cn("text-sm", w.status !== "completed" ? "text-white/60" : "text-muted")}>{w.muscleGroup}</p> : null}
                  <p className={cn("mt-3 text-sm font-medium", w.status !== "completed" ? "text-white/85" : "text-ink-2")}>
                    {w.status === "completed" ? (
                      <span className="inline-flex items-center gap-1.5 text-good-text">
                        <CheckCircle2 className="size-4" />{" "}
                        {f(t.clientHome.completedAt, {
                          time: w.completedAt ? fmt.time(w.completedAt, tz) : "",
                          pct: fmt.num(Math.round(w.completionPercent), 0),
                        })}
                      </span>
                    ) : (
                      f(t.clientHome.exercisesDone, { done: fmt.num(w.exercisesDone, 0), total: fmt.num(w.exercisesTotal, 0) })
                    )}
                  </p>
                  {w.status !== "completed" ? (
                    <span className="mt-4 inline-flex h-11 items-center gap-2 rounded-xl bg-brand px-4 text-sm font-semibold text-brand-ink">
                      {w.status === "pending" ? t.clientHome.start : t.clientHome.continue} <ArrowRight className="rtl-flip size-4" />
                    </span>
                  ) : null}
                </div>
                <ProgressRing
                  value={w.completionPercent}
                  size={88}
                  stroke={8}
                  tone={w.status === "completed" ? "good" : "lime"}
                  label={`${t.clientHome.progress}: ${fmt.pct(Math.round(w.completionPercent))}`}
                >
                  <span className="text-lg font-bold tabular">{fmt.pct(Math.round(w.completionPercent))}</span>
                </ProgressRing>
              </div>
            ) : (
              <div className="mt-3 flex items-center gap-3">
                <span className="grid size-11 place-items-center rounded-2xl bg-surface-2">
                  <Coffee className="size-5 text-ink-2" />
                </span>
                <div>
                  <h2 className="text-xl font-semibold">{h.week?.some((d) => d.title) ? t.clientHome.restTitle : t.clientHome.noWorkout}</h2>
                  <p className="text-sm text-muted">{h.week?.some((d) => d.title) ? t.clientHome.restText : t.clientHome.noWorkoutText}</p>
                </div>
              </div>
            )}
          </Card>
        </Link>
      ) : null}

      {h.permissions.viewNutrition && h.meals ? (
        <Link href="/client/nutrition" className="block">
          <Card className="p-5 transition active:scale-[0.99]">
            <div className="flex items-center justify-between">
              <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.1em] text-muted">
                <Utensils className="size-4" /> {t.clientHome.todaysMeals}
              </p>
              <span className="text-sm font-semibold tabular">
                {mealsDone}/{h.meals.length}
              </span>
            </div>
            {h.meals.length ? (
              <>
                <ProgressBar value={(mealsDone / h.meals.length) * 100} tone="series-2" className="mt-3" label={t.overview.mealsEaten} />
                <ul className="mt-4 space-y-2.5">
                  {h.meals.map((m) => {
                    const late = m.status === "pending" && clockToMinutes(m.scheduledTime) < nowMin;
                    return (
                      <li key={m.id} className="flex items-center gap-3 text-sm">
                        <span
                          className={cn(
                            "grid size-6 shrink-0 place-items-center rounded-full border-2",
                            m.status === "completed" ? "border-primary bg-primary text-primary-fg" : late ? "border-warn" : "border-line-strong",
                          )}
                          aria-hidden
                        >
                          {m.status === "completed" ? <CheckCircle2 className="size-3.5" /> : null}
                        </span>
                        <span className={cn("flex-1 font-medium", m.status === "completed" && "text-muted line-through decoration-1")}>{m.mealName}</span>
                        <span className="text-xs text-muted tabular">
                          {m.consumedAt ? f(t.clientHome.eatenAt, { time: fmt.time(m.consumedAt, tz) }) : fmt.clock(m.scheduledTime)}
                        </span>
                      </li>
                    );
                  })}
                </ul>
                {nextMeal ? (
                  <p className="mt-4 rounded-xl bg-surface-2 px-3 py-2.5 text-sm">
                    {t.clientHome.nextUp} <span className="font-semibold">{nextMeal.mealName}</span>{" "}
                    {f(t.clientHome.at, { time: fmt.clock(nextMeal.scheduledTime) })}
                  </p>
                ) : (
                  <p className="mt-4 rounded-xl bg-good-soft px-3 py-2.5 text-sm font-medium text-good-text">{t.clientHome.allDone}</p>
                )}
              </>
            ) : (
              <p className="mt-3 text-sm text-muted">{t.clientHome.noPlan}</p>
            )}
          </Card>
        </Link>
      ) : null}

      <div className="grid grid-cols-2 gap-3">
        {h.progress ? (
          <Link href="/client/progress" className="col-span-2 block sm:col-span-1">
            <Card className="h-full p-4">
              <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.1em] text-muted">
                <Scale className="size-4" /> {t.clientHome.weight}
              </p>
              <p className="mt-2 text-2xl font-semibold tabular">{fmt.weight(h.progress.summary.currentWeightKg, h.prefs.weightUnit)}</p>
              <p className="text-xs text-muted">{f(t.clientHome.sinceStart, { v: fmt.signedWeight(h.progress.summary.changeKg, h.prefs.weightUnit) })}</p>
              {weightSeries.length >= 2 ? <Sparkline data={weightSeries.map((p) => p.value)} /> : null}
            </Card>
          </Link>
        ) : null}
        {h.analytics ? (
          <Card className="col-span-2 p-4 sm:col-span-1">
            <p className="text-xs font-semibold uppercase tracking-[0.1em] text-muted">{t.clientHome.last30}</p>
            <dl className="mt-3 grid grid-cols-2 gap-3">
              <div>
                <dt className="text-xs text-muted">{t.clientHome.workouts}</dt>
                <dd className="text-xl font-semibold tabular">{fmt.pct(h.analytics.last30.workoutRate)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted">{t.clientHome.meals}</dt>
                <dd className="text-xl font-semibold tabular">{fmt.pct(h.analytics.last30.mealRate)}</dd>
              </div>
            </dl>
            <p className="mt-2 text-xs text-muted">
              {f(t.clientHome.logged, { w: fmt.num(h.analytics.last30.workoutsCompleted, 0), m: fmt.num(h.analytics.last30.mealsCompleted, 0) })}
            </p>
          </Card>
        ) : null}
      </div>

      {h.week ? (
        <section>
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-[0.1em] text-muted">{t.clientHome.thisWeek}</h2>
          <WeekStrip days={h.week} />
        </section>
      ) : null}
    </div>
  );
}
