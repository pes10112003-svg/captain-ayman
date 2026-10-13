"use client";

import { useRouter } from "next/navigation";
import { Fragment, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { Check, CheckCircle2, ExternalLink, Info, Lock, PartyPopper, Timer } from "lucide-react";
import { completeWorkoutAction, recordSetAction } from "@/server/actions/workouts";
import { celebrate } from "@/lib/celebrate";
import { Button } from "@/components/ui/button";
import { ConfirmDialog, Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { ProgressBar } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { useI18n } from "@/i18n/client";

type SetStatus = "pending" | "completed" | "partial" | "skipped";
export type SessionSet = {
  id: string;
  setNumber: number;
  targetReps: number;
  targetWeightKg: number | null;
  actualReps: number | null;
  actualWeightKg: number | null;
  status: SetStatus;
};
export type SessionExercise = {
  id: string;
  name: string;
  notes: string | null;
  tempo: string | null;
  restSeconds: number | null;
  videoUrl: string | null;
  sets: SessionSet[];
};

/** A set as shown in the sheet: what's typed in the "wt" and "Rep" cells, and whether it's saving. */
type LocalSet = SessionSet & { wt: string; reps: string; saving: boolean };
type Entry = { reps: number | null; wt: number | null };

const toNum = (v: string) => {
  const n = Number(v.replace(",", "."));
  return v.trim() === "" || !Number.isFinite(n) ? null : n;
};
/** Arabic/Persian digits → Latin, keep digits and one decimal point. */
const cleanNum = (v: string, decimals: boolean) => {
  const latin = v.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x660)).replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x6f0));
  const only = latin.replace(decimals ? /[^\d.,]/g : /\D/g, "").replace(",", ".");
  const [a, ...rest] = only.split(".");
  return (decimals && rest.length ? `${a}.${rest.join("")}` : a!).slice(0, decimals ? 6 : 3);
};
const statusFor = (reps: number | null, target: number): SetStatus =>
  reps == null ? "pending" : reps === 0 ? "skipped" : reps >= target ? "completed" : "partial";

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
  week,
}: {
  exercises: SessionExercise[];
  /** Which week of the coach's plan this is (1-based) — the "Week (n)" over the sheet. */
  week: number;
  status: "pending" | "in_progress" | "completed";
  completedAt: string | null;
  completionPercent: number;
  canComplete: boolean;
  canEnterReps: boolean;
  timezone: string;
}) {
  const router = useRouter();
  const { t, f, fmt } = useI18n();
  const [sets, setSets] = useState<Record<string, LocalSet>>(() =>
    Object.fromEntries(
      exercises.flatMap((e) =>
        e.sets.map((s) => [
          s.id,
          { ...s, reps: s.actualReps == null ? "" : String(s.actualReps), wt: s.actualWeightKg == null ? "" : String(s.actualWeightKg), saving: false },
        ]),
      ),
    ),
  );
  const [done, setDone] = useState<{ at: string; pct: number } | null>(
    status === "completed" && completedAt ? { at: completedAt, pct: completionPercent } : null,
  );
  const [completing, startCompleting] = useTransition();
  const debounce = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const readOnly = !!done || !canComplete;
  const setsRef = useRef(sets);
  useEffect(() => {
    setsRef.current = sets;
  }, [sets]);

  useEffect(() => {
    const timers = debounce.current;
    return () => Object.values(timers).forEach(clearTimeout);
  }, []);

  const all = Object.values(sets);
  const pct = useMemo(() => completion(all), [all]);
  const recorded = all.filter((s) => s.status !== "pending").length;
  const remaining = all.length - recorded;

  // Last state the server confirmed for each set (used to roll back if saving keeps failing).
  const confirmed = useRef<Record<string, LocalSet>>({});
  const inflight = useRef<Record<string, boolean>>({});
  const queued = useRef<Record<string, Entry | undefined>>({});

  /** Calls the server; retries a couple of times on network hiccups (slow mobile data, sleeping server). */
  async function send(id: string, next: Entry) {
    for (let attempt = 0; ; attempt++) {
      try {
        return await recordSetAction(id, { done: next.reps != null, actualReps: next.reps, actualWeightKg: next.wt });
      } catch (err) {
        if (attempt >= 2) throw err;
        await new Promise((r) => setTimeout(r, 700 * (attempt + 1)));
      }
    }
  }

  /**
   * Optimistic: the cell colours instantly and the save runs in the background. Edits made while a
   * save is in flight are queued (only the latest one is sent), so nothing ever waits on the server.
   */
  async function persist(id: string, next: Entry) {
    const base = sets[id]!;
    confirmed.current[id] ??= { ...base, saving: false };
    const status = statusFor(next.reps, base.targetReps);
    setSets((s) => ({ ...s, [id]: { ...s[id]!, status, actualReps: next.reps, actualWeightKg: next.wt, saving: true } }));
    if (next.reps != null && base.status === "pending" && typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate?.(12);
    if (inflight.current[id]) {
      queued.current[id] = next;
      return;
    }
    inflight.current[id] = true;
    let payload: Entry | undefined = next;
    try {
      while (payload) {
        queued.current[id] = undefined;
        const res = await send(id, payload);
        if (!res.ok) {
          queued.current[id] = undefined;
          setSets((s) => ({ ...s, [id]: { ...confirmed.current[id]!, saving: false } }));
          toast.error(res.error);
          if (res.code === "not_found" || res.code === "conflict") router.refresh();
          return;
        }
        const saved = res.data.set;
        confirmed.current[id] = {
          ...confirmed.current[id]!,
          status: saved.status,
          actualReps: saved.actualReps,
          actualWeightKg: saved.actualWeightKg,
          reps: saved.actualReps == null ? "" : String(saved.actualReps),
          wt: saved.actualWeightKg == null ? "" : String(saved.actualWeightKg),
          saving: false,
        };
        payload = queued.current[id];
        if (!payload) {
          setSets((s) => ({
            ...s,
            [id]: { ...s[id]!, status: saved.status, actualReps: saved.actualReps, actualWeightKg: saved.actualWeightKg, saving: false },
          }));
        }
      }
    } catch {
      setSets((s) => ({ ...s, [id]: { ...confirmed.current[id]!, saving: false } }));
      toast.error(t.errors.offlineText);
    } finally {
      inflight.current[id] = false;
    }
  }

  /** Saves a set from what's typed in its cells (debounced while typing, right away on leaving the cell). */
  const commit = (id: string) => {
    clearTimeout(debounce.current[id]);
    const cur = setsRef.current[id];
    if (!cur || readOnly) return;
    const reps = toNum(cur.reps);
    const wt = toNum(cur.wt);
    if (reps === cur.actualReps && wt === cur.actualWeightKg) return;
    void persist(id, { reps: reps == null ? null : Math.min(999, Math.round(reps)), wt });
  };
  const type = (s: LocalSet, field: "wt" | "reps", raw: string) => {
    const value = cleanNum(raw, field === "wt");
    setSets((all) => ({ ...all, [s.id]: { ...all[s.id]!, [field]: value } }));
    clearTimeout(debounce.current[s.id]);
    debounce.current[s.id] = setTimeout(() => commit(s.id), 900);
  };
  /** Without permission to change the numbers, a tap on "Rep" marks the set done as prescribed. */
  const toggle = (s: LocalSet) => {
    if (readOnly) return;
    void persist(s.id, { reps: s.status === "pending" ? s.targetReps : null, wt: null });
  };

  const complete = async () => {
    const res = await completeWorkoutAction();
    if (!res.ok) {
      toast.error(res.error);
      return false;
    }
    setDone({ at: res.data.completedAt, pct: res.data.completionPercent });
    celebrate();
    if ("vibrate" in navigator) navigator.vibrate?.([20, 40, 30]);
    toast.success(t.session.completeToast);
    router.refresh();
  };

  return (
    <div className="space-y-4">
      <div className="sticky top-14 z-20 -mx-4 border-b border-line/70 bg-page px-4 py-3 md:top-16 md:bg-page/90 md:backdrop-blur-xl">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium">
            {f(t.session.sets, {
              done: fmt.num(recorded, 0),
              total: fmt.num(all.length, 0),
            })}
          </span>
          <span className="font-semibold tabular">{fmt.pct(Math.round(done?.pct ?? pct))}</span>
        </div>
        <ProgressBar value={done?.pct ?? pct} tone="ink" className="mt-2" label={t.clientHome.progress} />
      </div>

      {done ? (
        <div className="flex items-center gap-3 rounded-2xl bg-good-soft p-4 text-good-text">
          <PartyPopper className="size-6 shrink-0" />
          <div>
            <p className="font-semibold">{t.session.completedTitle}</p>
            <p className="text-sm">
              {f(t.session.completedText, {
                time: fmt.time(done.at, timezone),
                pct: fmt.num(Math.round(done.pct), 0),
              })}
            </p>
          </div>
        </div>
      ) : !canComplete ? (
        <div className="flex items-center gap-3 rounded-2xl bg-surface-2 p-4 text-sm text-ink-2">
          <Lock className="size-5 shrink-0" /> {t.session.viewOnly}
        </div>
      ) : null}

      <SessionSheet
        exercises={exercises}
        sets={sets}
        week={week}
        readOnly={readOnly}
        canEnterReps={canEnterReps}
        onType={type}
        onCommit={commit}
        onToggle={toggle}
      />

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
            <Button
              size="xl"
              variant="brand"
              className="w-full shadow-pop"
              loading={completing}
              onClick={() => startCompleting(async () => void (await complete()))}
            >
              {!completing ? <CheckCircle2 /> : null} {t.session.complete}
            </Button>
          )}
          <p className="mt-2 text-center text-xs text-muted">{t.session.autoTime}</p>
        </div>
      ) : null}
    </div>
  );
}

/**
 * Today's workout as the paper sheet: "Exercise" on the left, "Week (n)" over set 1…n, and for every
 * exercise a "wt" row and a "Rep" row. The coach's numbers are the grey hints; the client writes what
 * they actually lifted and did, and each set turns green (done) or orange (fewer reps).
 */
function SessionSheet({
  exercises,
  sets,
  week,
  readOnly,
  canEnterReps,
  onType,
  onCommit,
  onToggle,
}: {
  exercises: SessionExercise[];
  sets: Record<string, LocalSet>;
  week: number;
  readOnly: boolean;
  canEnterReps: boolean;
  onType: (s: LocalSet, field: "wt" | "reps", raw: string) => void;
  onCommit: (id: string) => void;
  onToggle: (s: LocalSet) => void;
}) {
  const { t, f } = useI18n();
  const S = Math.max(1, ...exercises.map((e) => e.sets.length));
  const cols = Array.from({ length: S }, (_, i) => i);
  const tone = (s: LocalSet | undefined) => (!s || s.status === "pending" ? "" : s.status === "completed" ? "bg-good-soft" : "bg-warn-soft");
  const cellInput =
    "h-11 w-full min-w-0 bg-transparent text-center text-[15px] tabular outline-none placeholder:text-muted/60 focus:bg-brand/20 disabled:opacity-100";

  return (
    <div className="overflow-x-auto rounded-md border-2 border-ink bg-surface" dir="ltr">
      <table className="w-full table-fixed border-collapse text-sm" style={{ minWidth: 118 + S * 52 }} aria-label={t.session.exercises}>
        <colgroup>
          <col style={{ width: "30%", minWidth: 90 }} />
          <col style={{ width: 34 }} />
          {cols.map((c) => (
            <col key={c} />
          ))}
        </colgroup>
        <thead>
          <tr>
            <th scope="col" colSpan={2} rowSpan={2} className="border-b-2 border-e-2 border-ink bg-surface-2 px-2 text-start text-sm font-extrabold">
              {t.sheet.exercise}
            </th>
            <th scope="col" colSpan={S} className="border-b border-ink bg-surface-2 py-1.5 text-lg font-extrabold">
              {f(t.sheet.weekN, { n: week })}
            </th>
          </tr>
          <tr className="bg-surface-2 text-xs">
            {cols.map((c) => (
              <th key={c} scope="col" className="border-b-2 border-e border-ink border-e-line-strong py-1.5 font-medium last:border-e-0">
                {f(t.sheet.setN, { n: c + 1 })}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {exercises.map((e) => {
            const row = cols.map((c) => (e.sets[c] ? sets[e.sets[c]!.id] : undefined));
            const details = e.notes || e.tempo || e.restSeconds || e.videoUrl;
            return (
              <Fragment key={e.id}>
                <tr>
                  <td rowSpan={2} className="border-b-2 border-e border-ink border-e-line-strong px-1.5 py-1 align-top">
                    <span dir="auto" className="block text-[13px] font-bold leading-tight break-words">
                      {e.name}
                    </span>
                    {details ? <ExerciseInfo exercise={e} /> : null}
                  </td>
                  <td className="border-b border-e-2 border-ink border-b-line-strong text-center text-[10px] font-extrabold text-muted">{t.sheet.wt}</td>
                  {row.map((s, c) => (
                    <td key={c} className={cn("relative border-b border-e border-line-strong p-0 last:border-e-0", s ? tone(s) : "bg-surface-3/60")}>
                      {s ? (
                        <input
                          inputMode="decimal"
                          value={s.wt}
                          placeholder={s.targetWeightKg == null ? "" : String(s.targetWeightKg)}
                          disabled={readOnly || !canEnterReps}
                          onChange={(ev) => onType(s, "wt", ev.target.value)}
                          onBlur={() => onCommit(s.id)}
                          aria-label={`${e.name} · ${f(t.sheet.setN, { n: c + 1 })} · ${t.sheet.wt}`}
                          className={cn(cellInput, "font-bold")}
                        />
                      ) : null}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="border-b-2 border-e-2 border-ink text-center text-[10px] font-extrabold text-muted">{t.sheet.rep}</td>
                  {row.map((s, c) => (
                    <td
                      key={c}
                      className={cn("relative border-b-2 border-e border-b-ink border-e-line-strong p-0 last:border-e-0", s ? tone(s) : "bg-surface-3/60")}
                    >
                      {!s ? null : canEnterReps ? (
                        <input
                          inputMode="numeric"
                          value={s.reps}
                          placeholder={String(s.targetReps)}
                          disabled={readOnly}
                          onChange={(ev) => onType(s, "reps", ev.target.value)}
                          onBlur={() => onCommit(s.id)}
                          aria-label={`${e.name} · ${f(t.sheet.setN, { n: c + 1 })} · ${t.sheet.rep}`}
                          className={cn(
                            cellInput,
                            s.status === "partial" || s.status === "skipped" ? "text-warn-text" : s.status === "completed" ? "text-good-text" : "",
                          )}
                        />
                      ) : (
                        <button
                          type="button"
                          onClick={() => onToggle(s)}
                          disabled={readOnly}
                          aria-pressed={s.status !== "pending"}
                          aria-label={`${e.name} · ${f(t.sheet.setN, { n: c + 1 })}`}
                          className="grid h-11 w-full place-items-center text-[15px] tabular"
                        >
                          {s.status === "pending" ? (
                            <span className="text-muted/60">{s.targetReps}</span>
                          ) : (
                            <Check className="size-5 text-good-text" strokeWidth={3} />
                          )}
                        </button>
                      )}
                      {s?.saving ? <span className="absolute end-1 top-1 size-1.5 animate-pulse rounded-full bg-brand" aria-hidden /> : null}
                    </td>
                  ))}
                </tr>
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** The coach's notes for an exercise (rest, tempo, demo video, cues) behind a small ⓘ. */
function ExerciseInfo({ exercise: e }: { exercise: SessionExercise }) {
  const { t, f, locale } = useI18n();
  const rest = e.restSeconds
    ? e.restSeconds >= 60
      ? `${Math.floor(e.restSeconds / 60)}:${String(e.restSeconds % 60).padStart(2, "0")}`
      : `${e.restSeconds}${locale === "ar" ? " " : ""}${t.units.sec}`
    : null;
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type="button"
          aria-label={`${t.common.details}: ${e.name}`}
          className="mt-1 grid size-7 place-items-center rounded-md text-muted hover:bg-surface-2 hover:text-ink"
        >
          <Info className="size-4" />
        </button>
      </DialogTrigger>
      <DialogContent title={e.name}>
        <div className="space-y-3 text-sm" dir="auto">
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-ink-2">
            {rest ? (
              <span className="inline-flex items-center gap-1">
                <Timer className="size-4" /> {f(t.session.rest, { v: rest })}
              </span>
            ) : null}
            {e.tempo ? <span>{f(t.session.tempo, { v: e.tempo })}</span> : null}
          </div>
          {e.notes ? <p className="rounded-xl bg-surface-2 px-3 py-2 leading-relaxed text-ink-2">{e.notes}</p> : null}
          {e.videoUrl ? (
            <a href={e.videoUrl} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-1.5 font-medium text-info-text">
              <ExternalLink className="size-4" /> {t.session.demo}
            </a>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
