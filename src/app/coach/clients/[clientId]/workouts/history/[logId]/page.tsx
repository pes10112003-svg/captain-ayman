import Link from "next/link";
import { ChevronLeft, Clock, PlayCircle } from "lucide-react";
import { requireCoachPage } from "@/server/auth/guards";
import { getWorkoutLogDetail } from "@/server/services/workouts";
import { getCoachPrefs } from "@/server/services/settings";
import { orNotFound } from "@/server/page-helpers";
import { Card, CardBody } from "@/components/ui/card";
import { ProgressRing } from "@/components/ui/progress";
import { WorkoutStatusBadge } from "@/components/shared/status";
import { WorkoutLogEditor } from "@/components/coach/workout-log-editor";
import { getI18n } from "@/i18n/server";

export default async function WorkoutLogPage({ params }: { params: Promise<{ clientId: string; logId: string }> }) {
  const actor = await requireCoachPage();
  const { clientId, logId } = await params;
  const [{ log }, prefs] = await Promise.all([orNotFound(getWorkoutLogDetail(actor, clientId, logId)), getCoachPrefs(actor.userId)]);
  const { t, f, fmt } = await getI18n();
  const tz = prefs.timezone;
  const pct = Math.round(log.completionPercent);
  return (
    <div className="space-y-5">
      <Link href={`/coach/clients/${clientId}/workouts/history`} className="inline-flex items-center gap-1 text-sm text-muted hover:text-ink">
        <ChevronLeft className="rtl-flip size-4" /> {t.history.backToHistory}
      </Link>
      <Card>
        <CardBody className="flex flex-col gap-5 sm:flex-row sm:items-center">
          <ProgressRing value={log.completionPercent} size={84} stroke={8} tone="series-1" label={f(t.activity.completionDetail, { pct: fmt.num(pct, 0) })}>
            <span className="text-lg font-semibold tabular">{fmt.pct(pct)}</span>
          </ProgressRing>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium uppercase tracking-wide text-muted">{fmt.dateLong(log.date)}</p>
            <h2 className="mt-1 text-2xl font-semibold tracking-wide">{log.title}</h2>
            {log.muscleGroup ? <p className="text-sm text-muted">{log.muscleGroup}</p> : null}
            <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
              <WorkoutStatusBadge status={log.displayStatus} />
              {log.startedAt ? (
                <span className="inline-flex items-center gap-1.5 text-muted">
                  <PlayCircle className="size-4" /> {f(t.history.started, { when: fmt.dateTime(log.startedAt, tz, "short") })}
                </span>
              ) : null}
              {log.completedAt ? (
                <span className="inline-flex items-center gap-1.5 font-medium text-good-text">
                  <Clock className="size-4" /> {f(t.history.completedAt, { when: fmt.dateTime(log.completedAt, tz) })}
                </span>
              ) : null}
            </div>
          </div>
          <dl className="grid grid-cols-3 gap-4 text-center sm:text-end">
            <div>
              <dt className="text-xs text-muted">{t.history.fullSets}</dt>
              <dd className="text-xl font-semibold tabular">{fmt.num(log.completedSets, 0)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted">{t.history.partial}</dt>
              <dd className="text-xl font-semibold tabular text-warn-text">{fmt.num(log.partialSets, 0)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted">{t.history.total}</dt>
              <dd className="text-xl font-semibold tabular">{fmt.num(log.totalSets, 0)}</dd>
            </div>
          </dl>
        </CardBody>
        {log.instructions ? <p dir="auto" className="border-t border-line px-5 py-3 text-start text-sm text-ink-2">{log.instructions}</p> : null}
      </Card>
      <WorkoutLogEditor
        clientId={clientId}
        logId={log.id}
        status={log.status}
        coachNote={log.coachNote}
        timezone={tz}
        exercises={log.exercises.map((e) => ({
          id: e.id,
          name: e.name,
          notes: e.notes,
          tempo: e.tempo,
          restSeconds: e.restSeconds,
          sets: e.sets.map((s) => ({
            id: s.id,
            setNumber: s.setNumber,
            targetReps: s.targetReps,
            targetWeight: s.targetWeightKg == null ? t.common.bodyweight : fmt.weight(s.targetWeightKg, prefs.weightUnit),
            actualReps: s.actualReps,
            status: s.status,
            completedAt: s.completedAt?.toISOString() ?? null,
          })),
        }))}
      />
    </div>
  );
}
