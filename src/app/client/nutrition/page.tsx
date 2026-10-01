import { Lock, Utensils } from "lucide-react";
import { requireClientPage } from "@/server/auth/guards";
import { getTodayMeals } from "@/server/services/nutrition";
import { ForbiddenError } from "@/server/errors";
import { EmptyState } from "@/components/ui/empty-state";
import { ProgressBar } from "@/components/ui/progress";
import { MealList } from "@/components/client/meal-list";
import { minutesOfDayInTz } from "@/lib/time";
import { getI18n } from "@/i18n/server";
import { translateServerMessage } from "@/i18n/server-messages";

export async function generateMetadata() {
  const { t } = await getI18n();
  return { title: t.titles.nutrition };
}

export default async function ClientNutritionPage() {
  const actor = await requireClientPage();
  const { t, fmt, locale } = await getI18n();
  let data;
  try {
    data = await getTodayMeals(actor);
  } catch (err) {
    if (err instanceof ForbiddenError) return <EmptyState icon={<Lock />} title={t.meals.turnedOff} description={translateServerMessage(err.message, locale)} />;
    throw err;
  }
  const { logs, prefs, permissions, plan } = data;
  const done = logs.filter((l) => l.status === "completed");
  const sum = (k: "totalCalories" | "totalProtein") => Math.round(logs.reduce((a, l) => a + (l[k] ?? 0), 0));
  const eaten = (k: "totalCalories" | "totalProtein") => Math.round(done.reduce((a, l) => a + (l[k] ?? 0), 0));

  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm text-muted">{fmt.dateLong(data.today)}</p>
        <h1 className="mt-0.5 text-[26px] font-semibold tracking-tight">{t.meals.title}</h1>
      </div>
      {logs.length ? (
        <>
          <div className="rounded-3xl border border-line bg-surface p-4 shadow-card">
            <div className="flex items-end justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.1em] text-muted">{t.meals.completed}</p>
                <p className="text-3xl font-bold tabular">
                  {done.length}
                  <span className="text-lg text-muted">/{logs.length}</span>
                </p>
              </div>
              <dl className="flex gap-4 text-end text-xs">
                <div>
                  <dt className="text-muted">{t.meals.calories}</dt>
                  <dd className="font-semibold tabular">
                    {eaten("totalCalories")} / {sum("totalCalories")}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted">{t.meals.protein}</dt>
                  <dd className="font-semibold tabular">
                    {eaten("totalProtein")} / {sum("totalProtein")} {t.units.g}
                  </dd>
                </div>
              </dl>
            </div>
            <ProgressBar value={(done.length / logs.length) * 100} tone="series-2" className="mt-3" label={t.overview.mealsEaten} />
            {plan?.notes ? <p dir="auto" className="mt-3 text-start text-sm text-ink-2">{plan.notes}</p> : null}
          </div>
          {!permissions.completeMeals ? (
            <p className="flex items-center gap-2 rounded-2xl bg-surface-2 p-3 text-sm text-ink-2">
              <Lock className="size-4" /> {t.meals.viewOnly}
            </p>
          ) : (
            <p className="text-xs text-muted">{t.meals.hint}</p>
          )}
          <MealList
            timezone={prefs.timezone}
            canComplete={permissions.completeMeals}
            nowMinutes={minutesOfDayInTz(new Date(), prefs.timezone)}
            meals={logs.map((l) => ({
              id: l.id,
              mealName: l.mealName,
              scheduledTime: l.scheduledTime,
              notes: l.notes,
              items: l.items,
              totalCalories: l.totalCalories,
              totalProtein: l.totalProtein,
              totalCarbs: l.totalCarbs,
              totalFats: l.totalFats,
              status: l.status,
              consumedAt: l.consumedAt?.toISOString() ?? null,
            }))}
          />
        </>
      ) : (
        <EmptyState icon={<Utensils />} title={t.clientHome.noPlan} description={t.meals.noPlanText} />
      )}
    </div>
  );
}
