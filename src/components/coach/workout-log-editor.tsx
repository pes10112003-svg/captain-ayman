"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Check, Pencil, Save, X } from "lucide-react";
import { editWorkoutLogAction } from "@/server/actions/workouts";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Textarea } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useI18n } from "@/i18n/client";
import type { Dict } from "@/i18n/en";

type SetStatus = "pending" | "completed" | "partial" | "skipped";
type LogSet = { id: string; setNumber: number; targetReps: number; targetWeight: string; actualReps: number | null; status: SetStatus; completedAt: string | null };
type LogExercise = { id: string; name: string; notes: string | null; tempo: string | null; restSeconds: number | null; sets: LogSet[] };

const STATUS_TONE: Record<SetStatus, "good" | "warn" | "neutral" | "crit"> = { completed: "good", partial: "warn", pending: "neutral", skipped: "crit" };
const STATUS_LABEL: Record<SetStatus, keyof Dict["history"]> = { completed: "statusDone", partial: "statusPartial", pending: "statusPending", skipped: "statusSkipped" };

export function WorkoutLogEditor({
  clientId,
  logId,
  exercises,
  coachNote,
  status,
  timezone,
}: {
  clientId: string;
  logId: string;
  exercises: LogExercise[];
  coachNote: string | null;
  status: "pending" | "in_progress" | "completed";
  timezone: string;
}) {
  const { t, f, fmt } = useI18n();
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [pending, start] = useTransition();
  const [sets, setSets] = useState(() => Object.fromEntries(exercises.flatMap((e) => e.sets.map((s) => [s.id, { actualReps: s.actualReps, status: s.status }]))));
  const [note, setNote] = useState(coachNote ?? "");
  const [markCompleted, setMarkCompleted] = useState(false);

  const save = () =>
    start(async () => {
      const res = await editWorkoutLogAction(clientId, logId, {
        coachNote: note.trim() || null,
        sets: Object.entries(sets).map(([id, v]) => ({ id, actualReps: v.actualReps, status: v.status })),
        markCompleted,
      });
      if (!res.ok) return void toast.error(res.error);
      toast.success(t.history.updated);
      setEditing(false);
      router.refresh();
    });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted">{t.history.snapshotNote}</p>
        {editing ? (
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => setEditing(false)} disabled={pending}>
              <X /> {t.common.cancel}
            </Button>
            <Button size="sm" onClick={save} loading={pending}>
              {!pending ? <Save /> : null} {t.history.saveRecord}
            </Button>
          </div>
        ) : (
          <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>
            <Pencil /> {t.history.editResults}
          </Button>
        )}
      </div>

      {exercises.map((e) => (
        <Card key={e.id}>
          <CardHeader
            title={e.name}
            description={
              [e.tempo ? f(t.history.tempo, { v: e.tempo }) : null, e.restSeconds ? f(t.history.rest, { v: fmt.num(e.restSeconds, 0) }) : null, e.notes].filter(Boolean).join(" · ") ||
              undefined
            }
          />
          <CardBody className="pt-3">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-sm">
                <thead className="text-start text-xs text-muted">
                  <tr className="border-b border-line">
                    <th className="py-2 pe-3 text-start font-medium">{t.workoutEditor.set}</th>
                    <th className="py-2 pe-3 text-start font-medium">{t.history.target}</th>
                    <th className="py-2 pe-3 text-start font-medium">{t.history.actualReps}</th>
                    <th className="py-2 pe-3 text-start font-medium">{t.common.status}</th>
                    <th className="py-2 text-start font-medium">{t.history.loggedAt}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {e.sets.map((s) => {
                    const cur = sets[s.id]!;
                    return (
                      <tr key={s.id}>
                        <td className="py-2.5 pe-3 font-semibold tabular text-ink-2">{fmt.num(s.setNumber, 0)}</td>
                        <td className="py-2.5 pe-3 tabular">
                          {fmt.num(s.targetReps, 0)} {fmt.unit("reps")} <span className="text-muted">@ {s.targetWeight}</span>
                        </td>
                        <td className="py-2.5 pe-3 tabular">
                          {editing ? (
                            <input
                              type="number"
                              min={0}
                              max={1000}
                              value={cur.actualReps ?? ""}
                              onChange={(ev) => {
                                const v = ev.target.value === "" ? null : Number(ev.target.value);
                                setSets((all) => ({
                                  ...all,
                                  [s.id]: { actualReps: v, status: v == null ? "pending" : v === 0 ? "skipped" : v >= s.targetReps ? "completed" : "partial" },
                                }));
                              }}
                              className="h-8 w-20 rounded-lg border border-line bg-surface px-2 outline-none focus:border-ring"
                              aria-label={f(t.history.setActual, { exercise: e.name, n: s.setNumber })}
                            />
                          ) : (
                            <span className={cn("font-semibold", cur.status === "partial" && "text-warn-text", cur.status === "completed" && "text-good-text")}>
                              {cur.status === "pending" ? "—" : `${fmt.num(cur.actualReps, 0)}/${fmt.num(s.targetReps, 0)}`}
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 pe-3">
                          <Badge tone={STATUS_TONE[cur.status]}>{t.history[STATUS_LABEL[cur.status]]}</Badge>
                        </td>
                        <td className="py-2.5 text-xs text-muted tabular">{s.completedAt ? fmt.time(s.completedAt, timezone) : "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardBody>
        </Card>
      ))}

      <Card>
        <CardHeader title={t.history.coachNote} description={t.history.coachNoteSub} />
        <CardBody className="space-y-3 pt-3">
          {editing ? (
            <>
              <Textarea value={note} onChange={(ev) => setNote(ev.target.value)} maxLength={2000} placeholder={t.history.coachNotePh} />
              {status !== "completed" ? (
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={markCompleted} onChange={(ev) => setMarkCompleted(ev.target.checked)} className="size-4 accent-[var(--primary)]" />
                  {t.history.markCompleted}
                </label>
              ) : null}
            </>
          ) : (
            <p dir={coachNote ? "auto" : undefined} className="text-start text-sm text-ink-2">{coachNote || <span className="text-muted">{t.history.noNote}</span>}</p>
          )}
        </CardBody>
      </Card>
      {editing ? (
        <div className="flex justify-end">
          <Button onClick={save} loading={pending}>
            {!pending ? <Check /> : null} {t.history.saveRecord}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
