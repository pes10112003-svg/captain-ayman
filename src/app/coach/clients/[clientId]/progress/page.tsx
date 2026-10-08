import { LineChart as LineIcon, Ruler } from "lucide-react";
import { requireCoachPage } from "@/server/auth/guards";
import { getProgress } from "@/server/services/progress";
import { getClientAnalytics } from "@/server/services/analytics";
import { coachToday } from "@/server/services/settings";
import { orNotFound } from "@/server/page-helpers";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PercentLinesChart, TrendChart } from "@/components/charts/lazy";
import { BodyComposition } from "@/components/shared/body-composition";
import { MeasurementTrend } from "@/components/shared/measurement-trend";
import { MeasurementDialog } from "@/components/coach/measurement-form";
import { MeasurementHistory } from "@/components/coach/measurement-history";
import { kgTo, round } from "@/lib/units";
import { getI18n } from "@/i18n/server";
import { measureTypeLabel } from "@/i18n/labels";

export default async function ClientProgressPage({ params, searchParams }: { params: Promise<{ clientId: string }>; searchParams: Promise<{ add?: string }> }) {
  const actor = await requireCoachPage();
  const { clientId } = await params;
  const { add } = await searchParams;
  const [progress, analytics, { today }] = await Promise.all([
    orNotFound(getProgress(actor, clientId)),
    orNotFound(getClientAnalytics(actor, clientId, { weeks: 12 })),
    coachToday(actor.userId),
  ]);
  const { t, f, fmt } = await getI18n();
  const { prefs } = progress;
  const find = (key: string) => progress.types.find((ty) => ty.key === key && ty.isSystem);
  const weight = find("weight");
  const bodyFat = find("body_fat");
  const weightSeries = weight ? (progress.series[weight.id] ?? []) : [];
  const bfSeries = bodyFat ? (progress.series[bodyFat.id] ?? []) : [];
  const goal = progress.client.goalWeightKg != null ? round(kgTo(progress.client.goalWeightKg, prefs.weightUnit), 1) : null;
  const circumferenceTypes = progress.types.filter((ty) => !["weight", "body_fat", "bmi"].includes(ty.key) || !ty.isSystem);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">{t.progress.bodyComposition}</h2>
          <p className="text-sm text-muted">{t.progress.bodyCompositionSub}</p>
        </div>
        <MeasurementDialog
          clientId={clientId}
          types={progress.types.map((ty) => ({ id: ty.id, key: ty.key, name: ty.name, kind: ty.kind, unit: ty.unit, isSystem: ty.isSystem }))}
          weightUnit={prefs.weightUnit}
          lengthUnit={prefs.lengthUnit}
          today={today}
          defaultOpen={add === "1"}
        />
      </div>

      <BodyComposition progress={progress} />

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader
            title={t.progress.weightOverTime}
            description={goal != null ? f(t.progress.dashedGoal, { v: fmt.weight(progress.client.goalWeightKg, prefs.weightUnit) }) : undefined}
          />
          <CardBody>
            {weightSeries.length >= 2 ? (
              <TrendChart
                data={weightSeries}
                unit={fmt.unit(prefs.weightUnit)}
                name={t.progress.weight}
                color="series-3"
                goal={goal}
                goalLabel={t.progress.goal}
              />
            ) : (
              <p className="py-16 text-center text-sm text-muted">{t.progress.addWeightHint}</p>
            )}
          </CardBody>
        </Card>
        <Card>
          <CardHeader title={t.progress.bodyFatOverTime} />
          <CardBody>
            {bfSeries.length >= 2 ? (
              <TrendChart data={bfSeries} unit="%" name={t.progress.bodyFat} color="series-2" />
            ) : (
              <p className="py-16 text-center text-sm text-muted">{t.progress.bodyFatHint}</p>
            )}
          </CardBody>
        </Card>
        <Card>
          <CardHeader title={t.progress.measurementTrends} description={t.progress.measurementTrendsSub} />
          <CardBody>
            <MeasurementTrend
              types={circumferenceTypes.map((ty) => ({ id: ty.id, name: measureTypeLabel(t, ty), kind: ty.kind, unit: ty.unit }))}
              series={progress.series}
              weightUnit={prefs.weightUnit}
              lengthUnit={prefs.lengthUnit}
            />
          </CardBody>
        </Card>
        <Card>
          <CardHeader
            title={t.progress.adherenceOverTime}
            description={f(t.progress.adherenceSub, { w: fmt.pct(analytics.avgWeeklyWorkoutAdherence), n: fmt.pct(analytics.avgWeeklyNutritionAdherence) })}
            icon={<LineIcon />}
          />
          <CardBody>
            <PercentLinesChart
              data={analytics.weekly.map((w) => ({ label: fmt.dateShort(w.week), workout: w.workoutAdherence, nutrition: w.mealAdherence }))}
              series={[
                { key: "workout", name: t.overview.workoutAdherence, color: "series-1" },
                { key: "nutrition", name: t.overview.mealsEaten, color: "series-2" },
              ]}
              height={220}
            />
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader title={t.progress.history} description={t.progress.newestFirst} icon={<Ruler />} />
        <CardBody className="pt-2">
          {progress.entries.length ? (
            <MeasurementHistory clientId={clientId} entries={progress.entries} canDelete />
          ) : (
            <EmptyState compact icon={<Ruler />} title={t.progress.emptyTitle} description={t.progress.emptyText} />
          )}
        </CardBody>
      </Card>
    </div>
  );
}
