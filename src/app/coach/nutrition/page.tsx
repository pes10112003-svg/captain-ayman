import Link from "next/link";
import { Utensils } from "lucide-react";
import { requireCoachPage } from "@/server/auth/guards";
import { getNutritionOverview } from "@/server/services/coach-overviews";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Avatar } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/empty-state";
import { getI18n } from "@/i18n/server";
import { cn } from "@/lib/utils";

export async function generateMetadata() {
  const { t } = await getI18n();
  return { title: t.titles.nutrition };
}

export default async function NutritionOverviewPage() {
  const actor = await requireCoachPage();
  const d = await getNutritionOverview(actor);
  const { t, f, fmt } = await getI18n();
  const tz = d.prefs.timezone;
  // "Scheduled {scheduled} · eaten {eaten}" — the eaten time is highlighted, so split around it.
  const [mealLineBefore = "", mealLineAfter = ""] = t.coachPages.latestMealLine.split("{eaten}");
  return (
    <>
      <PageHeader
        eyebrow={fmt.dateLong(d.today)}
        title={t.titles.nutrition}
        description={f(t.coachPages.nutritionSub, { done: fmt.num(d.totals.done, 0), total: fmt.num(d.totals.meals, 0) })}
      />
      {d.rows.length === 0 ? (
        <EmptyState icon={<Utensils />} title={t.coachPages.noActive} />
      ) : (
        <div className="grid gap-6 xl:grid-cols-3">
          <Card className="xl:col-span-2">
            <CardHeader title={t.coachPages.mealsByClient} description={t.coachPages.mealsByClientSub} />
            <CardBody className="p-0 pt-3">
              <ul className="divide-y divide-line">
                {d.rows.map((r) => (
                  <li key={r.id} className="px-5 py-4">
                    <div className="mb-3 flex items-center gap-3">
                      <Avatar name={r.fullName} clientId={r.id} avatarKey={r.avatarKey} size="sm" />
                      <Link href={`/coach/clients/${r.id}/nutrition/history`} className="min-w-0 flex-1 truncate text-sm font-medium hover:underline">
                        {r.fullName}
                      </Link>
                      <span className="text-xs text-muted">{f(t.coachPages.week, { pct: fmt.pct(r.week) })}</span>
                      <span className="text-sm font-semibold tabular">
                        {r.done}/{r.meals.length}
                      </span>
                    </div>
                    {r.meals.length ? (
                      <ol className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                        {r.meals.map((m) => (
                          <li
                            key={m.id}
                            className={cn(
                              "min-w-28 shrink-0 rounded-xl border px-3 py-2",
                              m.status === "completed" ? "border-good/40 bg-good-soft" : "border-line bg-surface-2/60",
                            )}
                          >
                            <p className="truncate text-xs font-semibold">{m.mealName}</p>
                            <p className="text-[11px] text-muted">{fmt.clock(m.scheduledTime)}</p>
                            <p className={cn("mt-1 text-[11px] font-medium", m.consumedAt ? "text-good-text" : "text-muted")}>
                              {m.consumedAt ? `✓ ${fmt.time(m.consumedAt, tz)}` : t.mealHistory.pending}
                            </p>
                          </li>
                        ))}
                      </ol>
                    ) : (
                      <Link href={`/coach/clients/${r.id}/nutrition`} className="text-xs font-medium text-info-text">
                        {t.coachPages.createNutrition}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>
          <Card>
            <CardHeader title={t.coachPages.latestMeals} />
            <CardBody>
              {d.feed.length ? (
                <ul className="space-y-3">
                  {d.feed.map((m) => (
                    <li key={m.id} className="flex items-center gap-3">
                      <Avatar name={m.client.fullName} clientId={m.client.id} avatarKey={m.client.avatarKey} size="sm" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm">
                          <span className="font-medium">{m.client.fullName}</span> · {m.mealName}
                        </p>
                        <p className="text-xs text-muted">
                          {f(mealLineBefore, { scheduled: fmt.clock(m.scheduledTime) })}
                          <span className="font-medium text-good-text">{fmt.time(m.consumedAt!, tz)}</span>
                          {mealLineAfter}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted">{t.coachPages.noMealsToday}</p>
              )}
            </CardBody>
          </Card>
        </div>
      )}
    </>
  );
}
