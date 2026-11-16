"use client";

import Link from "next/link";
import { useState } from "react";
import { Trophy } from "lucide-react";
import { TrendChart } from "@/components/charts/lazy";
import { cn } from "@/lib/utils";
import { kgTo, round, type WeightUnit } from "@/lib/units";
import { useI18n } from "@/i18n/client";
import type { ExerciseProgress } from "@/server/services/workout-stats";

/** Pick an exercise → the heaviest weight lifted each time, first vs last vs best, and recent sessions. */
export function ExerciseProgressPanel({ exercises, unit, today }: { exercises: ExerciseProgress[]; unit: WeightUnit; today: string }) {
  const { t, fmt } = useI18n();
  const [key, setKey] = useState(exercises[0]?.key ?? "");
  const ex = exercises.find((e) => e.key === key) ?? exercises[0];
  if (!ex) return null;

  const weighted = ex.sessions.filter((s) => s.topWeightKg != null);
  const series = weighted.map((s) => ({ date: s.date, value: round(kgTo(s.topWeightKg!, unit), 1) }));
  const change = ex.firstWeightKg != null && ex.latestWeightKg != null && weighted.length > 1 ? ex.latestWeightKg - ex.firstWeightKg : null;
  const changeText =
    change == null ? "—" : `${change > 0 ? "+" : change < 0 ? "−" : "±"}${fmt.num(Math.abs(round(kgTo(change, unit), 1)))} ${fmt.unit(unit)}`;

  return (
    <div className="space-y-4">
      <label className="block">
        <span className="mb-1.5 block text-xs font-medium text-muted">{t.myTraining.pickExercise}</span>
        <select
          value={ex.key}
          onChange={(e) => setKey(e.target.value)}
          dir="auto"
          className="h-11 w-full rounded-xl border border-line bg-surface px-3 text-[15px] outline-none focus:border-ink"
        >
          {exercises.map((e) => (
            <option key={e.key} value={e.key}>
              {e.name} · {e.workout} ({fmt.num(e.sessions.length, 0)})
            </option>
          ))}
        </select>
      </label>

      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          { label: t.myTraining.first, value: fmt.weight(ex.firstWeightKg, unit) },
          { label: t.myTraining.latest, value: fmt.weight(ex.latestWeightKg, unit) },
          { label: t.myTraining.best, value: fmt.weight(ex.bestWeightKg, unit), best: true },
          { label: t.myTraining.change, value: changeText, tone: change == null ? "" : change > 0 ? "text-good-text" : change < 0 ? "text-crit-text" : "" },
        ].map((x) => (
          <div key={x.label} className="rounded-xl bg-surface-2 px-3 py-2.5">
            <dt className="flex items-center gap-1 text-[11px] font-medium text-muted">
              {x.best ? <Trophy className="size-3.5 text-warn-text" /> : null}
              {x.label}
            </dt>
            <dd className={cn("mt-0.5 text-lg font-semibold tabular", x.tone)}>
              <bdi>{x.value}</bdi>
            </dd>
          </div>
        ))}
      </dl>

      {series.length >= 2 ? (
        <TrendChart data={series} unit={fmt.unit(unit)} name={t.myTraining.topWeight} color="series-1" height={200} />
      ) : (
        <p className="rounded-xl bg-surface-2 px-4 py-6 text-center text-sm text-muted">
          {series.length === 0 ? t.myTraining.noWeight : t.myTraining.oneSession}
        </p>
      )}

      <div>
        <p className="mb-2 text-xs font-semibold text-muted">{t.myTraining.recent}</p>
        <ul className="divide-y divide-line rounded-xl border border-line">
          {[...ex.sessions]
            .reverse()
            .slice(0, 6)
            .map((s) => (
              <li key={s.logId}>
                <Link
                  href={s.date === today ? "/client/workout" : `/client/workout/history/${s.logId}`}
                  className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm transition hover:bg-surface-2"
                >
                  <span className="text-ink-2">{fmt.date(s.date)}</span>
                  <span className="flex items-center gap-1.5 font-semibold tabular">
                    {s.topWeightKg != null ? (
                      <span>
                        <bdi>{fmt.weight(s.topWeightKg, unit)}</bdi> × <bdi>{fmt.num(s.topReps, 0)}</bdi>
                      </span>
                    ) : (
                      <bdi>{`${fmt.num(s.reps, 0)} ${t.units.reps}`}</bdi>
                    )}
                    {ex.bestWeightKg != null && s.topWeightKg === ex.bestWeightKg && s.date === ex.bestDate ? (
                      <Trophy className="size-3.5 text-warn-text" aria-label={t.myTraining.best} />
                    ) : null}
                  </span>
                </Link>
              </li>
            ))}
        </ul>
      </div>
    </div>
  );
}
