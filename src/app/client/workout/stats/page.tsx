import { BarChart3, Dumbbell, Flame, Layers, Lock, Repeat, TrendingUp, Trophy, Weight } from "lucide-react";
import { requireClientPage } from "@/server/auth/guards";
import { getClientWorkoutStats } from "@/server/services/workout-stats";
import { ForbiddenError } from "@/server/errors";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { StatCard } from "@/components/ui/stat";
import { DailyBars } from "@/components/charts/lazy";
import { WorkoutTabs } from "@/components/client/workout-tabs";
import { ExerciseProgressPanel } from "@/components/client/exercise-progress";
import { getI18n } from "@/i18n/server";
import { translateServerMessage } from "@/i18n/server-messages";

export async function generateMetadata() {
  const { t } = await getI18n();
  return { title: t.myTraining.statsTitle };
}

export default async function ClientWorkoutStatsPage() {
  const actor = await requireClientPage();
  const { t, f, fmt, locale } = await getI18n();
  let s;
  try {
    s = await getClientWorkoutStats(actor);
  } catch (err) {
    if (err instanceof ForbiddenError)
      return <EmptyState icon={<Lock />} title={t.session.turnedOff} description={translateServerMessage(err.message, locale)} />;
    throw err;
  }
  const unit = s.prefs.weightUnit;
  const empty = s.totals.sets === 0 && s.totals.workoutsCompleted === 0;

  return (
    <div className="space-y-5">
      <WorkoutTabs />
      <div>
        <h1 className="text-[26px] font-semibold tracking-tight">{t.myTraining.statsTitle}</h1>
        <p className="mt-1 text-sm text-muted">
          {s.firstDate ? `${f(t.myTraining.since, { date: fmt.date(s.firstDate) })} · ` : ""}
          {t.myTraining.statsSub}
        </p>
      </div>

      {empty ? (
        <EmptyState icon={<BarChart3 />} title={t.myTraining.statsEmptyTitle} description={t.myTraining.statsEmptyText} />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            <StatCard
              label={t.myTraining.workoutsDone}
              value={fmt.num(s.totals.workoutsCompleted, 0)}
              icon={<Dumbbell />}
              sub={`${t.myTraining.last30}: ${fmt.num(s.totals.workoutsDone30, 0)}/${fmt.num(s.totals.workoutsDue30, 0)}`}
            />
            <StatCard label={t.myTraining.streak} value={fmt.num(s.totals.streak, 0)} icon={<Flame />} />
            <StatCard label={t.myTraining.setsDone} value={fmt.num(s.totals.sets, 0)} icon={<Layers />} />
            <StatCard label={t.myTraining.repsDone} value={fmt.num(s.totals.reps, 0)} icon={<Repeat />} />
            <StatCard label={t.myTraining.volume} value={fmt.weight(s.totals.volumeKg, unit, 0)} icon={<Weight />} sub={t.myTraining.volumeHint} />
            <StatCard label={t.myTraining.improved} value={fmt.num(s.totals.improved, 0)} icon={<TrendingUp />} />
          </div>

          <Card>
            <CardHeader title={t.myTraining.weeklyTitle} description={t.myTraining.weeklySub} />
            <CardBody>
              <DailyBars data={s.weekly.map((w) => ({ date: w.start, count: w.count }))} valueKey="count" name={t.myTraining.workoutsDone} height={170} />
            </CardBody>
          </Card>

          {s.exercises.length ? (
            <Card>
              <CardHeader title={t.myTraining.exercisesTitle} description={t.myTraining.exercisesSub} icon={<Trophy />} />
              <CardBody>
                <ExerciseProgressPanel exercises={s.exercises} unit={unit} today={s.today} />
              </CardBody>
            </Card>
          ) : null}
        </>
      )}
    </div>
  );
}
