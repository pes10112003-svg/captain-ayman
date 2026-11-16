import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft, Clock, Lock } from "lucide-react";
import { requireClientPage } from "@/server/auth/guards";
import { getMyWorkoutLog } from "@/server/services/workout-stats";
import { ForbiddenError, NotFoundError } from "@/server/errors";
import { Card, CardBody } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ProgressRing } from "@/components/ui/progress";
import { WorkoutStatusBadge } from "@/components/shared/status";
import { WorkoutSheetView } from "@/components/client/workout-session";
import { getI18n } from "@/i18n/server";
import { translateServerMessage } from "@/i18n/server-messages";

export async function generateMetadata() {
  const { t } = await getI18n();
  return { title: t.myTraining.historyTitle };
}

export default async function ClientWorkoutLogPage({ params }: { params: Promise<{ logId: string }> }) {
  const actor = await requireClientPage();
  const { logId } = await params;
  const { t, f, fmt, locale } = await getI18n();
  let data;
  try {
    data = await getMyWorkoutLog(actor, logId);
  } catch (err) {
    if (err instanceof NotFoundError) notFound();
    if (err instanceof ForbiddenError)
      return <EmptyState icon={<Lock />} title={t.session.turnedOff} description={translateServerMessage(err.message, locale)} />;
    throw err;
  }
  const { log, prefs, today } = data;
  // Today's workout is still being filled in on the workout page.
  if (log.date === today) redirect("/client/workout");
  const pct = Math.round(log.completionPercent);

  return (
    <div className="space-y-5">
      <Link href="/client/workout/history" className="inline-flex items-center gap-1 text-sm text-muted hover:text-ink">
        <ChevronLeft className="rtl-flip size-4" /> {t.myTraining.back}
      </Link>
      <Card>
        <CardBody className="flex items-center gap-4">
          <ProgressRing value={log.completionPercent} size={72} stroke={7} tone="series-1" label={f(t.activity.completionDetail, { pct: fmt.num(pct, 0) })}>
            <span className="text-base font-semibold tabular">{fmt.pct(pct)}</span>
          </ProgressRing>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-muted">{fmt.dateLong(log.date)}</p>
            <h1 className="mt-0.5 text-2xl font-semibold tracking-wide">{log.title}</h1>
            {log.muscleGroup ? <p className="text-sm text-muted">{log.muscleGroup}</p> : null}
            <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">
              <WorkoutStatusBadge status={log.displayStatus} />
              {log.completedAt ? (
                <span className="inline-flex items-center gap-1.5 text-muted">
                  <Clock className="size-4" /> {fmt.time(log.completedAt, prefs.timezone)}
                </span>
              ) : null}
            </div>
          </div>
        </CardBody>
        {log.coachNote ? (
          <div className="border-t border-line px-5 py-3 text-sm">
            <p className="mb-1 text-xs font-semibold text-muted">{t.history.coachNote}</p>
            <p dir="auto" className="text-start text-ink-2">
              {log.coachNote}
            </p>
          </div>
        ) : null}
      </Card>

      {log.exercises.length ? (
        <>
          <WorkoutSheetView
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
          <p className="text-xs leading-relaxed text-muted">{t.myTraining.sheetHint}</p>
        </>
      ) : (
        <p className="py-8 text-center text-sm text-muted">{t.myTraining.noResults}</p>
      )}
    </div>
  );
}
