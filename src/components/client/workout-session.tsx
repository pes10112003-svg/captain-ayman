"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { Check, CheckCircle2, ExternalLink, Info, Loader2, Lock, Minus, PartyPopper, Plus, Timer } from "lucide-react";
import { completeWorkoutAction, recordSetAction } from "@/server/actions/workouts";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { ProgressBar } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { useI18n } from "@/i18n/client";

type SetStatus = "pending" | "completed" | "partial" | "skipped";
export type SessionSet = { id: string; setNumber: number; targetReps: number; weightLabel: string | null; actualReps: number | null; status: SetStatus };
export type SessionExercise = { id: string; name: string; notes: string | null; tempo: string | null; restSeconds: number | null; videoUrl: string | null; sets: SessionSet[] };

type LocalSet = SessionSet & { draftReps: number; saving: boolean };

function completion(sets: LocalSet[]) {
  const target = sets.reduce((a, s) => a + s.targetReps, 0);
  const done = sets.reduce((a, s) => a + (s.status === "pending" ? 0 : Math.min(s.actualReps ?? s.targetReps, s.targetReps)), 0);
  return target ? (done / target) * 100 : 0;
}

export function WorkoutSession({
  exercises,
  status,
  completedAt,
  completionPercent,
  canComplete,
  canEnterReps,
  timezone,
}: {
  exercises: SessionExercise[];
  status: "pending" | "in_progress" | "completed";
  completedAt: string | null;
  completionPercent: number;
  canComplete: boolean;
  canEnterReps: boolean;
  timezone: string;
}) {
  const router = useRouter();
  const { t, f, fmt, locale } = useI18n();
  const [sets, setSets] = useState<Record<string, LocalSet>>(() =>
    Object.fromEntries(exercises.flatMap((e) => e.sets.map((s) => [s.id, { ...s, draftReps: s.actualReps ?? s.targetReps, saving: false }]))),
  );
  const [done, setDone] = useState<{ at: string; pct: number } | null>(status === "completed" && completedAt ? { at: completedAt, pct: completionPercent } : null);
  const [completing, startCompleting] = useTransition();
  const debounce = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const readOnly = !!done || !canComplete;

  useEffect(() => {
    const timers = debounce.current;
    return () => Object.values(timers).forEach(clearTimeout);
  }, []);

  const all = Object.values(sets);
  const pct = useMemo(() => completion(all), [all]);
  const recorded = all.filter((s) => s.status !== "pending").length;
  const remaining = all.length - recorded;

  async function persist(id: string, next: { done: boolean; reps: number }) {
    const prev = sets[id]!;
    const status: SetStatus = !next.done ? "pending" : next.reps === 0 ? "skipped" : next.reps >= prev.targetReps ? "completed" : "partial";
    setSets((s) => ({ ...s, [id]: { ...s[id]!, status, actualReps: next.done ? next.reps : null, draftReps: next.reps, saving: true } }));
    if (next.done && typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate?.(12);
    const res = await recordSetAction(id, { done: next.done, actualReps: next.done ? next.reps : null });
    if (!res.ok) {
      setSets((s) => ({ ...s, [id]: { ...prev, saving: false } }));
      toast.error(res.error);
      if (res.code === "not_found" || res.code === "conflict") router.refresh();
      return;
    }
    setSets((s) => ({ ...s, [id]: { ...s[id]!, status: res.data.set.status, actualReps: res.data.set.actualReps, saving: false } }));
  }

  const toggle = (s: LocalSet) => {
    if (readOnly || s.saving) return;
    void persist(s.id, { done: s.status === "pending", reps: canEnterReps ? s.draftReps : s.targetReps });
  };

  const changeReps = (s: LocalSet, value: number) => {
    const reps = Math.max(0, Math.min(999, value));
    setSets((all) => ({ ...all, [s.id]: { ...all[s.id]!, draftReps: reps } }));
    // Editing an already-ticked set re-saves it (debounced) so mistakes are easy to fix.
    if (s.status !== "pending") {
      clearTimeout(debounce.current[s.id]);
      debounce.current[s.id] = setTimeout(() => void persist(s.id, { done: true, reps }), 700);
    }
  };

  const complete = async () => {
    const res = await completeWorkoutAction();
    if (!res.ok) {
      toast.error(res.error);
      return false;
    }
    setDone({ at: res.data.completedAt, pct: res.data.completionPercent });
    toast.success(t.session.completeToast);
    router.refresh();
  };

  return (
    <div className="space-y-4">
      <div className="sticky top-14 z-20 -mx-4 border-b border-line/70 bg-page/90 px-4 py-3 backdrop-blur-xl md:top-16">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium">{f(t.session.sets, { done: fmt.num(recorded, 0), total: fmt.num(all.length, 0) })}</span>
          <span className="font-semibold tabular">{fmt.pct(Math.round(done?.pct ?? pct))}</span>
        </div>
        <ProgressBar value={done?.pct ?? pct} tone="ink" className="mt-2" label={t.clientHome.progress} />
      </div>

      {done ? (
        <div className="flex items-center gap-3 rounded-2xl bg-good-soft p-4 text-good-text">
          <PartyPopper className="size-6 shrink-0" />
          <div>
            <p className="font-semibold">{t.session.completedTitle}</p>
            <p className="text-sm">{f(t.session.completedText, { time: fmt.time(done.at, timezone), pct: fmt.num(Math.round(done.pct), 0) })}</p>
          </div>
        </div>
      ) : !canComplete ? (
        <div className="flex items-center gap-3 rounded-2xl bg-surface-2 p-4 text-sm text-ink-2">
          <Lock className="size-5 shrink-0" /> {t.session.viewOnly}
        </div>
      ) : null}

      <ol className="space-y-4" aria-label={t.session.exercises}>
        {exercises.map((e, idx) => {
          const list = e.sets.map((s) => sets[s.id]!);
          const exDone = list.every((s) => s.status !== "pending");
          const reps = [...new Set(e.sets.map((s) => s.targetReps))].join("/");
          const weights = [...new Set(e.sets.map((s) => s.weightLabel).filter(Boolean))].join(" / ");
          return (
            <li key={e.id} className={cn("overflow-hidden rounded-3xl border bg-surface shadow-card transition", exDone ? "border-good/40" : "border-line")}>
              <div className="flex items-start gap-3 p-4 pb-3">
                <span className={cn("grid size-8 shrink-0 place-items-center rounded-xl text-sm font-bold", exDone ? "bg-good text-white" : "bg-surface-2 text-ink-2")}>
                  {exDone ? <Check className="size-4" strokeWidth={3} /> : idx + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <h3 className="text-[17px] font-semibold leading-tight">{e.name}</h3>
                  <p className="mt-0.5 text-sm text-ink-2">
                    {f(t.session.target, { sets: fmt.num(e.sets.length, 0), reps })}
                    {weights ? ` · ${weights}` : ""}
                  </p>
                  <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted">
                    {e.restSeconds ? (
                      <span className="inline-flex items-center gap-1">
                        <Timer className="size-3" />{" "}
                        {f(t.session.rest, {
                          v:
                            e.restSeconds >= 60
                              ? `${Math.floor(e.restSeconds / 60)}:${String(e.restSeconds % 60).padStart(2, "0")}`
                              : `${e.restSeconds}${locale === "ar" ? " " : ""}${t.units.sec}`,
                        })}
                      </span>
                    ) : null}
                    {e.tempo ? <span>{f(t.session.tempo, { v: e.tempo })}</span> : null}
                    {e.videoUrl ? (
                      <a href={e.videoUrl} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-1 font-medium text-info-text">
                        <ExternalLink className="size-3" /> {t.session.demo}
                      </a>
                    ) : null}
                  </div>
                  {e.notes ? (
                    <p className="mt-2 flex gap-1.5 rounded-xl bg-surface-2 px-3 py-2 text-xs text-ink-2">
                      <Info className="mt-px size-3.5 shrink-0" />
                      <span dir="auto" className="min-w-0 flex-1 text-start">{e.notes}</span>
                    </p>
                  ) : null}
                </div>
              </div>
              <ul className="divide-y divide-line border-t border-line">
                {list.map((s) => {
                  const isDone = s.status !== "pending";
                  const partial = s.status === "partial" || s.status === "skipped";
                  return (
                    <li key={s.id} className={cn("flex items-center gap-3 px-4 py-2.5 transition-colors", isDone && (partial ? "bg-warn-soft/60" : "bg-good-soft/50"))}>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold">{f(t.session.set, { n: s.setNumber })}</p>
                        <p className="truncate text-[11px] text-muted">
                          {s.targetReps} {t.units.reps}
                          {s.weightLabel ? ` · ${s.weightLabel}` : ""}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center justify-end gap-2">
                        {canEnterReps && !readOnly ? (
                          <div className="flex items-center rounded-xl border border-line bg-surface" dir="ltr">
                            <button
                              type="button"
                              onClick={() => changeReps(s, s.draftReps - 1)}
                              disabled={s.draftReps <= 0}
                              className="grid size-10 place-items-center text-ink-2 disabled:opacity-30"
                              aria-label={f(t.session.fewer, { n: s.setNumber })}
                            >
                              <Minus className="size-4" />
                            </button>
                            <label className="sr-only" htmlFor={`reps-${s.id}`}>
                              {f(t.session.repsCompleted, { n: s.setNumber })}
                            </label>
                            <input
                              id={`reps-${s.id}`}
                              type="number"
                              inputMode="numeric"
                              min={0}
                              max={999}
                              value={s.draftReps}
                              onChange={(ev) => changeReps(s, Number(ev.target.value || 0))}
                              className={cn("h-10 w-10 bg-transparent text-center text-base font-semibold tabular outline-none", s.draftReps < s.targetReps && "text-warn-text")}
                            />
                            <button
                              type="button"
                              onClick={() => changeReps(s, s.draftReps + 1)}
                              className="grid size-10 place-items-center text-ink-2"
                              aria-label={f(t.session.more, { n: s.setNumber })}
                            >
                              <Plus className="size-4" />
                            </button>
                          </div>
                        ) : isDone ? (
                          <span className={cn("text-sm font-semibold tabular", partial ? "text-warn-text" : "text-good-text")}>
                            {s.actualReps}/{s.targetReps}
                          </span>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => toggle(s)}
                          disabled={readOnly}
                          aria-pressed={isDone}
                          aria-label={isDone ? f(t.session.doneUndo, { n: s.setNumber }) : f(t.session.markDone, { n: s.setNumber })}
                          className={cn(
                            "grid size-12 shrink-0 place-items-center rounded-2xl border-2 transition active:scale-90",
                            isDone
                              ? partial
                                ? "border-warn bg-warn text-black"
                                : "border-primary bg-primary text-primary-fg"
                              : "border-line-strong bg-surface text-muted hover:border-ink",
                            readOnly && "cursor-default active:scale-100",
                          )}
                        >
                          {s.saving ? <Loader2 className="size-5 animate-spin" /> : <Check className={cn("size-6", isDone && "animate-pop")} strokeWidth={3} />}
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </li>
          );
        })}
      </ol>

      {!readOnly ? (
        <div className="sticky bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-20 -mx-4 bg-gradient-to-t from-page from-60% to-transparent px-4 pb-3 pt-8 md:bottom-0">
          {remaining > 0 ? (
            <ConfirmDialog
              title={t.session.finishTitle}
              description={`${fmt.plural(t.session.setsLeft, remaining)} ${f(t.session.finishNote, { pct: fmt.num(Math.round(pct), 0) })}`}
              confirmLabel={t.session.complete}
              variant="primary"
              onConfirm={complete}
              trigger={
                <Button size="xl" className="w-full shadow-pop" loading={completing}>
                  <CheckCircle2 /> {t.session.complete}
                </Button>
              }
            />
          ) : (
            <Button size="xl" variant="brand" className="w-full shadow-pop" loading={completing} onClick={() => startCompleting(async () => void (await complete()))}>
              {!completing ? <CheckCircle2 /> : null} {t.session.complete}
            </Button>
          )}
          <p className="mt-2 text-center text-xs text-muted">{t.session.autoTime}</p>
        </div>
      ) : null}
    </div>
  );
}
