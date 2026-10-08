import { Images, Lock, Ruler } from "lucide-react";
import { requireClientPage } from "@/server/auth/guards";
import { getProgress } from "@/server/services/progress";
import { getClientAnalytics } from "@/server/services/analytics";
import { listPhotos } from "@/server/services/photos";
import { coachToday } from "@/server/services/settings";
import { ForbiddenError } from "@/server/errors";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PercentLinesChart, TrendChart } from "@/components/charts/lazy";
import { BodyComposition } from "@/components/shared/body-composition";
import { MeasurementTrend } from "@/components/shared/measurement-trend";
import { MeasurementHistory } from "@/components/coach/measurement-history";
import { PhotoGallery } from "@/components/shared/photo-gallery";
import { kgTo, round } from "@/lib/units";
import { getI18n } from "@/i18n/server";
import { translateServerMessage } from "@/i18n/server-messages";

export async function generateMetadata() {
  const { t } = await getI18n();
  return { title: t.titles.myProgress };
}

export default async function ClientProgressPage() {
  const actor = await requireClientPage();
  const { t, f, fmt, locale } = await getI18n();
  let progress;
  try {
    progress = await getProgress(actor, actor.clientId);
  } catch (err) {
    if (err instanceof ForbiddenError)
      return <EmptyState icon={<Lock />} title={t.progress.turnedOff} description={translateServerMessage(err.message, locale)} />;
    throw err;
  }
  const { prefs, permissions } = progress;
  const [analytics, photos, { today }] = await Promise.all([
    getClientAnalytics(actor, actor.clientId, { weeks: 8 }),
    permissions.viewPhotos ? listPhotos(actor, actor.clientId) : Promise.resolve(null),
    coachToday(prefs.coachId),
  ]);
  const weight = progress.types.find((ty) => ty.key === "weight" && ty.isSystem);
  const bodyFat = progress.types.find((ty) => ty.key === "body_fat" && ty.isSystem);
  const weightSeries = weight ? (progress.series[weight.id] ?? []) : [];
  const bfSeries = bodyFat ? (progress.series[bodyFat.id] ?? []) : [];
  const goal = progress.client.goalWeightKg != null ? round(kgTo(progress.client.goalWeightKg, prefs.weightUnit), 1) : null;

  return (
    <div className="space-y-5">
      <h1 className="text-[26px] font-semibold tracking-tight">{t.titles.myProgress}</h1>
      <BodyComposition progress={progress} />

      <Card>
        <CardHeader
          title={t.progress.weight}
          description={
            goal != null
              ? f(t.overview.goalLine, {
                  value: fmt.weight(progress.client.goalWeightKg, prefs.weightUnit),
                })
              : undefined
          }
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
              height={200}
            />
          ) : (
            <p className="py-10 text-center text-sm text-muted">{t.progress.weightTrendHint}</p>
          )}
        </CardBody>
      </Card>

      {bfSeries.length >= 2 ? (
        <Card>
          <CardHeader title={t.progress.bodyFat} />
          <CardBody>
            <TrendChart data={bfSeries} unit="%" name={t.progress.bodyFat} color="series-2" height={180} />
          </CardBody>
        </Card>
      ) : null}

      <Card>
        <CardHeader title={t.progress.consistency} description={t.progress.consistencySub} />
        <CardBody>
          <PercentLinesChart
            height={200}
            data={analytics.weekly.map((w) => ({
              label: fmt.dateShort(w.week),
              workout: w.workoutAdherence,
              nutrition: w.mealAdherence,
            }))}
            series={[
              {
                key: "workout",
                name: t.progress.workoutsSeries,
                color: "series-1",
              },
              {
                key: "nutrition",
                name: t.progress.mealsSeries,
                color: "series-2",
              },
            ]}
          />
        </CardBody>
      </Card>

      {progress.detailed ? (
        <>
          <Card>
            <CardHeader title={t.progress.measurements} icon={<Ruler />} />
            <CardBody>
              <MeasurementTrend
                types={progress.types
                  .filter((ty) => !["weight", "body_fat", "bmi"].includes(ty.key) || !ty.isSystem)
                  .map((ty) => ({
                    id: ty.id,
                    key: ty.key,
                    isSystem: ty.isSystem,
                    name: ty.name,
                    kind: ty.kind,
                    unit: ty.unit,
                  }))}
                series={progress.series}
                weightUnit={prefs.weightUnit}
                lengthUnit={prefs.lengthUnit}
              />
            </CardBody>
          </Card>
          <Card>
            <CardHeader title={t.progress.historyShort} />
            <CardBody className="pt-2">
              {progress.entries.length ? (
                <MeasurementHistory entries={progress.entries} canDelete={false} />
              ) : (
                <p className="text-sm text-muted">{t.progress.emptyTitle}</p>
              )}
            </CardBody>
          </Card>
        </>
      ) : null}

      {photos ? (
        <section className="space-y-3">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Images className="size-5" /> {t.progress.photos}
          </h2>
          <PhotoGallery photos={photos} clientId={actor.clientId} canDelete={false} upload={permissions.uploadPhotos ? { today } : null} />
        </section>
      ) : null}
    </div>
  );
}
