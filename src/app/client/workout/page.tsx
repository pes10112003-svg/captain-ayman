import { Coffee, Dumbbell, Lock } from "lucide-react";
import { requireClientPage } from "@/server/auth/guards";
import { getTodayWorkout } from "@/server/services/workouts";
import { ForbiddenError } from "@/server/errors";
import { EmptyState } from "@/components/ui/empty-state";
import { WeekStrip } from "@/components/client/week-strip";
import { WorkoutSession } from "@/components/client/workout-session";
import { getI18n } from "@/i18n/server";
import { translateServerMessage } from "@/i18n/server-messages";

export async function generateMetadata() {
  const { t } = await getI18n();
  return { title: t.titles.todaysWorkout };
}

export default async function ClientWorkoutPage() {
  const actor = await requireClientPage();
  const { t, f, fmt, locale } = await getI18n();
  let data;
  try {
    data = await getTodayWorkout(actor);
  } catch (err) {
    if (err instanceof ForbiddenError)
      return <EmptyState icon={<Lock />} title={t.session.turnedOff} description={translateServerMessage(err.message, locale)} />;
    throw err;
  }
  const { log, prefs, permissions, week } = data;

  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm text-muted">{fmt.dateLong(data.today)}</p>
        <h1 className="mt-0.5 flex flex-wrap items-center gap-2 text-[26px] font-semibold tracking-tight">
          {log ? log.title : t.titles.todaysWorkout}
          {log?.weekCount && log.weekCount > 1 && log.weekIndex != null ? (
            <span className="rounded-full bg-brand px-2.5 py-0.5 text-xs font-bold tracking-normal text-brand-ink">
              {f(t.sheet.clientWeek, { n: log.weekIndex + 1, total: log.weekCount })}
            </span>
          ) : null}
        </h1>
        {log?.muscleGroup ? <p className="text-sm text-muted">{log.muscleGroup}</p> : null}
      </div>
      <WeekStrip days={week} />
      {log ? (
        <>
          {log.instructions ? (
            <div className="rounded-2xl border border-line bg-surface p-4 text-sm leading-relaxed text-ink-2">
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">{t.session.fromCoach}</p>
              <p dir="auto" className="text-start">
                {log.instructions}
              </p>
            </div>
          ) : null}
          <WorkoutSession
            timezone={prefs.timezone}
            status={log.status}
            completedAt={log.completedAt?.toISOString() ?? null}
            completionPercent={log.completionPercent}
            canComplete={permissions.completeWorkouts}
            canEnterReps={permissions.enterActualReps}
            week={(log.weekIndex ?? 0) + 1}
            exercises={log.exercises.map((e) => ({
              id: e.id,
              name: e.name,
              notes: e.notes,
              tempo: e.tempo,
              restSeconds: e.restSeconds,
              videoUrl: e.videoUrl,
              sets: e.sets.map((s) => ({
                id: s.id,
                setNumber: s.setNumber,
                targetReps: s.targetReps,
                targetWeightKg: s.targetWeightKg,
                actualReps: s.actualReps,
                actualWeightKg: s.actualWeightKg,
                status: s.status,
              })),
            }))}
          />
        </>
      ) : week.some((d) => d.title) ? (
        <EmptyState icon={<Coffee />} title={t.common.restDay} description={t.session.restText} />
      ) : (
        <EmptyState icon={<Dumbbell />} title={t.clientHome.noWorkout} description={t.session.noPlanText} />
      )}
    </div>
  );
}
