"use client";

/**
 * Training sheet editor — the coach's paper sheet, on screen.
 * Every table is one training day (PUSH, PULL, LEG…) with all its exercises. Each exercise has a
 * weight row (wt) and a reps row (Rep) per set, and the weeks of the cycle are stacked under each
 * other so the sheet fits a phone. What the client actually did is coloured into the same cells.
 *
 * Performance: state lives in a reducer with copy-on-write updates and every exercise row is
 * memoised, so typing in one cell only re-renders that exercise — not the whole sheet.
 */

import { useRouter } from "next/navigation";
import { memo, useCallback, useEffect, useMemo, useReducer, useState, useTransition, type Dispatch } from "react";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Copy, MoreHorizontal, Plus, RotateCcw, Save, Trash2 } from "lucide-react";
import { saveWorkoutPlanAction } from "@/server/actions/workouts";
import { Button } from "@/components/ui/button";
import { ConfirmDialog, Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Input, Textarea } from "@/components/ui/input";
import { Disclosure } from "@/components/ui/disclosure";
import { EmptyState } from "@/components/ui/empty-state";
import { planWeek } from "@/lib/plan-week";
import { addDays } from "@/lib/time";
import { cn } from "@/lib/utils";
import { useI18n } from "@/i18n/client";

/* ── types ─────────────────────────────────────────────── */

export type SheetPlan = {
  name: string;
  notes: string | null;
  weekCount: number;
  startsOn: string | null;
  updatedAt: string;
  schedule: (string | null)[];
  workouts: {
    id: string;
    key: string;
    title: string;
    muscleGroup: string | null;
    instructions: string | null;
    setCount: number;
    exercises: {
      key: string;
      name: string;
      restSeconds: number | null;
      tempo: string | null;
      notes: string | null;
      videoUrl: string | null;
      sets: { key: string; week: number; setNumber: number; targetReps: number; targetWeight: number | null }[];
    }[];
  }[];
};

export type SheetResultData = {
  workoutId: string;
  week: number;
  date: string;
  exercises: {
    name: string;
    position: number;
    sets: {
      setNumber: number;
      status: "pending" | "completed" | "partial" | "skipped";
      actualReps: number | null;
      targetReps: number;
      actualWeightKg: number | null;
      targetWeightKg: number | null;
    }[];
  }[];
};

type Cell = { w: string; r: string };
type Ex = { key: string; name: string; restSeconds: string; tempo: string; notes: string; videoUrl: string; cells: Cell[][] };
type Table = { key: string; id: string | null; title: string; muscleGroup: string; instructions: string; setCount: number; exercises: Ex[] };
type Draft = { name: string; notes: string; weekCount: number; startsOn: string; tables: Table[]; schedule: (string | null)[] };
type State = { draft: Draft; dirty: boolean };
type ExResult = SheetResultData["exercises"][number] & { date: string };

type Action =
  | { type: "plan"; patch: Partial<Pick<Draft, "name" | "notes" | "startsOn">> }
  | { type: "weeks"; n: number }
  | { type: "addTable"; table: Table }
  | { type: "removeTable"; key: string }
  | { type: "table"; key: string; patch: Partial<Pick<Table, "title" | "instructions">> }
  | { type: "setCount"; key: string; n: number }
  | { type: "day"; key: string; dow: number }
  | { type: "addEx"; key: string; ex: Ex }
  | { type: "removeEx"; key: string; exKey: string }
  | { type: "moveEx"; key: string; exKey: string; dir: -1 | 1 }
  | { type: "ex"; key: string; exKey: string; patch: Partial<Omit<Ex, "key" | "cells">> }
  | { type: "cell"; key: string; exKey: string; w: number; s: number; field: keyof Cell; value: string }
  | { type: "copyWeek"; key: string; from: number; to: number }
  | { type: "reset"; draft: Draft };

const MAX_WEEKS = 12;
const MAX_SETS = 10;
/** Saturday-first, like the gym week in Egypt (0 = Sunday … 6 = Saturday). */
const DAY_ORDER = [6, 0, 1, 2, 3, 4, 5];
const EMPTY: Cell = { w: "", r: "" };

let counter = 0;
const uid = () => `k${Date.now().toString(36)}${(counter++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const cellOf = (ex: Ex, w: number, s: number) => ex.cells[w]?.[s] ?? EMPTY;
const newExercise = (): Ex => ({ key: uid(), name: "", restSeconds: "", tempo: "", notes: "", videoUrl: "", cells: [] });
const newTable = (title: string): Table => ({ key: uid(), id: null, title, muscleGroup: "", instructions: "", setCount: 4, exercises: [newExercise()] });
const ARABIC_DIGITS = /[٠-٩]/g;
const toLatin = (v: string) => v.replace(ARABIC_DIGITS, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));
const cleanWeight = (v: string) =>
  toLatin(v)
    .replace(/[,٫]/g, ".")
    .replace(/[^\d.]/g, "")
    .replace(/(\..*)\./g, "$1")
    .slice(0, 6);
const cleanReps = (v: string) => toLatin(v).replace(/\D/g, "").slice(0, 4);

function toDraft(plan: SheetPlan | null, defaults: { name: string; startsOn: string; firstTitle: string }): Draft {
  if (!plan) {
    return {
      name: defaults.name,
      notes: "",
      weekCount: 3,
      startsOn: defaults.startsOn,
      tables: [newTable(defaults.firstTitle)],
      schedule: Array(7).fill(null),
    };
  }
  return {
    name: plan.name,
    notes: plan.notes ?? "",
    weekCount: Math.max(1, plan.weekCount),
    startsOn: plan.startsOn ?? defaults.startsOn,
    schedule: plan.schedule.map((id) => (id ? (plan.workouts.find((w) => w.id === id)?.key ?? null) : null)),
    tables: plan.workouts.map((w) => ({
      key: w.key,
      id: w.id,
      title: w.title,
      muscleGroup: w.muscleGroup ?? "",
      instructions: w.instructions ?? "",
      setCount: Math.max(1, w.setCount),
      exercises: w.exercises.map((e) => {
        const cells: Cell[][] = [];
        for (const s of e.sets) {
          (cells[s.week] ??= [])[s.setNumber - 1] = { w: s.targetWeight == null ? "" : String(s.targetWeight), r: String(s.targetReps) };
        }
        for (const row of cells) if (row) for (let i = 0; i < row.length; i++) row[i] ??= EMPTY;
        for (let i = 0; i < cells.length; i++) cells[i] ??= [];
        return {
          key: e.key,
          name: e.name,
          restSeconds: e.restSeconds == null ? "" : String(e.restSeconds),
          tempo: e.tempo ?? "",
          notes: e.notes ?? "",
          videoUrl: e.videoUrl ?? "",
          cells,
        };
      }),
    })),
  };
}

function mapTable(d: Draft, key: string, fn: (t: Table) => Table): Draft {
  return { ...d, tables: d.tables.map((t) => (t.key === key ? fn(t) : t)) };
}
function mapEx(t: Table, exKey: string, fn: (e: Ex) => Ex): Table {
  return { ...t, exercises: t.exercises.map((e) => (e.key === exKey ? fn(e) : e)) };
}

function reducer(state: State, a: Action): State {
  if (a.type === "reset") return { draft: a.draft, dirty: false };
  const d = state.draft;
  let next: Draft = d;
  switch (a.type) {
    case "plan":
      next = { ...d, ...a.patch };
      break;
    case "weeks":
      next = { ...d, weekCount: Math.min(MAX_WEEKS, Math.max(1, a.n)) };
      break;
    case "addTable":
      next = { ...d, tables: [...d.tables, a.table] };
      break;
    case "removeTable":
      next = { ...d, tables: d.tables.filter((t) => t.key !== a.key), schedule: d.schedule.map((k) => (k === a.key ? null : k)) };
      break;
    case "table":
      next = mapTable(d, a.key, (t) => ({ ...t, ...a.patch }));
      break;
    case "setCount":
      next = mapTable(d, a.key, (t) => ({ ...t, setCount: Math.min(MAX_SETS, Math.max(1, a.n)) }));
      break;
    case "day":
      next = { ...d, schedule: d.schedule.map((k, dow) => (dow === a.dow ? (k === a.key ? null : a.key) : k)) };
      break;
    case "addEx":
      next = mapTable(d, a.key, (t) => ({ ...t, exercises: [...t.exercises, a.ex] }));
      break;
    case "removeEx":
      next = mapTable(d, a.key, (t) => ({ ...t, exercises: t.exercises.filter((e) => e.key !== a.exKey) }));
      break;
    case "moveEx":
      next = mapTable(d, a.key, (t) => {
        const i = t.exercises.findIndex((e) => e.key === a.exKey);
        const j = i + a.dir;
        if (i < 0 || j < 0 || j >= t.exercises.length) return t;
        const list = t.exercises.slice();
        [list[i], list[j]] = [list[j]!, list[i]!];
        return { ...t, exercises: list };
      });
      break;
    case "ex":
      next = mapTable(d, a.key, (t) => mapEx(t, a.exKey, (e) => ({ ...e, ...a.patch })));
      break;
    case "cell":
      next = mapTable(d, a.key, (t) =>
        mapEx(t, a.exKey, (e) => {
          const cells = e.cells.slice();
          while (cells.length <= a.w) cells.push([]);
          const row = cells[a.w]!.slice();
          while (row.length <= a.s) row.push(EMPTY);
          row[a.s] = { ...row[a.s]!, [a.field]: a.value };
          cells[a.w] = row;
          return { ...e, cells };
        }),
      );
      break;
    case "copyWeek":
      next = mapTable(d, a.key, (t) => ({
        ...t,
        exercises: t.exercises.map((e) => {
          const cells = e.cells.slice();
          while (cells.length <= a.to) cells.push([]);
          cells[a.to] = (e.cells[a.from] ?? []).map((c) => ({ ...c }));
          return { ...e, cells };
        }),
      }));
      break;
  }
  return { draft: next, dirty: true };
}

/* ── editor ────────────────────────────────────────────── */

export function WorkoutSheetEditor({
  clientId,
  initial,
  weightUnit,
  today,
  thisWeekStart,
  results,
}: {
  clientId: string;
  initial: SheetPlan | null;
  weightUnit: string;
  today: string;
  thisWeekStart: string;
  results: SheetResultData[];
}) {
  const { t, f, fmt } = useI18n();
  const router = useRouter();
  const defaults = useMemo(() => ({ name: t.workoutEditor.defaultPlanName, startsOn: thisWeekStart, firstTitle: "PUSH" }), [t, thisWeekStart]);
  const [state, dispatch] = useReducer(reducer, undefined, () => ({ draft: toDraft(initial, defaults), dirty: false }));
  const { draft, dirty } = state;
  const [saving, startSaving] = useTransition();
  const [errors, setErrors] = useState<string[]>([]);
  const [options, setOptions] = useState<{ tableKey: string; exKey: string } | null>(null);

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const week = planWeek(draft.weekCount, draft.startsOn, today);
  const unit = fmt.unit(weightUnit as "kg");

  // results → table id → week → exercise results (matched by name, then by position)
  const resultIndex = useMemo(() => {
    const m = new Map<string, Map<number, { byName: Map<string, ExResult>; byPos: Map<number, ExResult> }>>();
    for (const r of results) {
      const weeks = m.get(r.workoutId) ?? new Map();
      const byName = new Map<string, ExResult>();
      const byPos = new Map<number, ExResult>();
      for (const e of r.exercises) {
        const er = { ...e, date: r.date };
        byName.set(e.name.trim().toLowerCase(), er);
        byPos.set(e.position, er);
      }
      weeks.set(r.week, { byName, byPos });
      m.set(r.workoutId, weeks);
    }
    return m;
  }, [results]);
  const hasResults = results.length > 0;
  // Table titles by key (for "this day belongs to PUSH" hints). Only changes when a title changes,
  // so typing inside one table doesn't re-render the others.
  const titlesKey = draft.tables.map((x) => `${x.key}\u0000${x.title}`).join("\u0001");
  const titles = useMemo(() => Object.fromEntries(titlesKey ? titlesKey.split("\u0001").map((p) => p.split("\u0000")) : []), [titlesKey]);

  const titleFor = useCallback((n: number) => ["PUSH", "PULL", "LEG", "UPPER", "LOWER", "FULL BODY"][n] ?? f(t.workoutEditor.dayN, { n: n + 1 }), [f, t]);
  const onOptions = useCallback((tableKey: string, exKey: string) => setOptions({ tableKey, exKey }), []);

  const validate = () => {
    const errs: string[] = [];
    const we = t.workoutEditor;
    if (!draft.name.trim()) errs.push(we.errName);
    for (const tb of draft.tables) {
      const tName = tb.title.trim() || t.sheet.tableTitle;
      if (!tb.title.trim()) errs.push(we.errTitle);
      for (const e of tb.exercises) {
        const filled: { w: number; s: number; c: Cell }[] = [];
        for (let w = 0; w < draft.weekCount; w++)
          for (let s = 0; s < tb.setCount; s++) {
            const c = cellOf(e, w, s);
            if (c.w !== "" || c.r !== "") filled.push({ w, s, c });
          }
        if (!e.name.trim()) {
          if (filled.length) errs.push(f(t.sheet.errNoName, { table: tName }));
          continue;
        }
        const missing = filled.find((x) => x.c.r === "");
        if (missing) errs.push(f(t.sheet.errReps, { table: tName, exercise: e.name.trim(), w: missing.w + 1, s: missing.s + 1 }));
        if (!filled.some((x) => x.c.r !== "")) errs.push(f(t.sheet.errNoSets, { table: tName, exercise: e.name.trim() }));
        if (e.videoUrl.trim() && !/^https?:\/\//i.test(e.videoUrl.trim())) errs.push(f(we.errVideo, { exercise: e.name.trim() }));
      }
    }
    return [...new Set(errs)];
  };

  const save = () => {
    const errs = validate();
    setErrors(errs);
    if (errs.length) {
      toast.error(errs[0]);
      return;
    }
    const num = (v: string) => (v.trim() === "" || Number.isNaN(Number(v)) ? null : Number(v));
    const payload = {
      name: draft.name.trim(),
      notes: draft.notes.trim() || null,
      weekCount: draft.weekCount,
      startsOn: draft.startsOn || null,
      schedule: draft.schedule,
      workouts: draft.tables.map((tb) => ({
        id: tb.id,
        key: tb.key,
        title: tb.title.trim(),
        muscleGroup: tb.muscleGroup.trim() || null,
        instructions: tb.instructions.trim() || null,
        setCount: tb.setCount,
        exercises: tb.exercises
          .filter((e) => e.name.trim())
          .map((e) => {
            const sets: { week: number; setNumber: number; targetReps: number; targetWeight: number | null }[] = [];
            for (let w = 0; w < draft.weekCount; w++)
              for (let s = 0; s < tb.setCount; s++) {
                const c = cellOf(e, w, s);
                if (c.r !== "") sets.push({ week: w, setNumber: s + 1, targetReps: Number(c.r), targetWeight: num(c.w) });
              }
            return {
              name: e.name.trim(),
              restSeconds: num(e.restSeconds),
              tempo: e.tempo.trim() || null,
              notes: e.notes.trim() || null,
              videoUrl: e.videoUrl.trim() || null,
              sets,
            };
          }),
      })),
    };
    startSaving(async () => {
      const res = await saveWorkoutPlanAction(clientId, payload);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(t.workoutEditor.saved);
      dispatch({ type: "reset", draft }); // the refreshed page remounts the editor with the saved copy
      router.refresh();
    });
  };

  const discard = () => {
    dispatch({ type: "reset", draft: toDraft(initial, defaults) });
    setErrors([]);
  };

  const optTable = options ? draft.tables.find((x) => x.key === options.tableKey) : undefined;
  const optEx = optTable?.exercises.find((e) => e.key === options?.exKey);
  const optIndex = optTable && optEx ? optTable.exercises.indexOf(optEx) : -1;

  return (
    <div className="space-y-4 pb-24">
      {/* plan settings */}
      <section className="rounded-2xl border border-line bg-surface p-3 shadow-card sm:p-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-end">
          <Field label={t.workoutEditor.planName} htmlFor="plan-name" className="col-span-2 sm:col-span-1">
            <Input id="plan-name" value={draft.name} maxLength={120} onChange={(e) => dispatch({ type: "plan", patch: { name: e.target.value } })} />
          </Field>
          <Field label={t.sheet.weeks}>
            <Stepper value={draft.weekCount} min={1} max={MAX_WEEKS} onChange={(n) => dispatch({ type: "weeks", n })} label={t.sheet.weeks} />
          </Field>
          <Field label={t.sheet.startsOn} htmlFor="plan-start">
            <Input
              id="plan-start"
              type="date"
              value={draft.startsOn}
              onChange={(e) => e.target.value && dispatch({ type: "plan", patch: { startsOn: e.target.value } })}
              className="w-full sm:w-40"
            />
          </Field>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
          <span className="font-semibold">{f(t.sheet.currentWeek, { n: week.index + 1, total: draft.weekCount })}</span>
          <span className="text-xs text-muted">{f(t.sheet.weightIn, { unit })}</span>
          {hasResults ? (
            <span className="flex flex-wrap items-center gap-3 text-xs text-muted">
              <span className="inline-flex items-center gap-1.5">
                <i className="inline-block size-3 rounded-sm border border-good bg-good-soft" aria-hidden /> {t.sheet.legendDone}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <i className="inline-block size-3 rounded-sm border border-warn bg-warn-soft" aria-hidden /> {t.sheet.legendLess}
              </span>
            </span>
          ) : null}
        </div>
        {week.finished ? (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-warn-soft px-3 py-2.5 text-sm text-warn-text">
            <span>{f(t.sheet.cycleDone, { n: draft.weekCount })}</span>
            <Button size="sm" variant="secondary" onClick={() => dispatch({ type: "plan", patch: { startsOn: thisWeekStart } })}>
              <RotateCcw /> {t.sheet.restart}
            </Button>
          </div>
        ) : null}
        <Disclosure title={t.sheet.options} className="mt-2">
          <Field label={t.workoutEditor.planNotes} htmlFor="plan-notes" optional>
            <Textarea
              id="plan-notes"
              rows={2}
              value={draft.notes}
              maxLength={4000}
              placeholder={t.workoutEditor.planNotesPh}
              onChange={(e) => dispatch({ type: "plan", patch: { notes: e.target.value } })}
            />
          </Field>
        </Disclosure>
      </section>

      {draft.tables.length ? (
        draft.tables.map((tb) => (
          <TableSheet
            key={tb.key}
            table={tb}
            weekCount={draft.weekCount}
            startsOn={draft.startsOn}
            currentWeek={week.index}
            schedule={draft.schedule}
            titles={titles}
            results={tb.id ? resultIndex.get(tb.id) : undefined}
            today={today}
            dispatch={dispatch}
            onOptions={onOptions}
          />
        ))
      ) : (
        <EmptyState title={t.sheet.emptyTitle} description={t.sheet.emptyText} />
      )}

      <Button
        variant="secondary"
        className="w-full border-dashed"
        onClick={() => dispatch({ type: "addTable", table: newTable(titleFor(draft.tables.length)) })}
      >
        <Plus /> {t.sheet.addTable}
      </Button>

      {errors.length ? (
        <div className="rounded-xl bg-crit-soft px-4 py-3 text-sm text-crit-text" role="alert">
          <ul className="list-inside list-disc space-y-0.5">
            {errors.slice(0, 6).map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <Dialog open={!!(optTable && optEx)} onOpenChange={(o) => !o && setOptions(null)}>
        {optTable && optEx ? (
          <DialogContent title={optEx.name || t.workoutEditor.exerciseName} description={t.sheet.exerciseOptions}>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={t.workoutEditor.restSeconds} optional>
                <Input
                  inputMode="numeric"
                  value={optEx.restSeconds}
                  onChange={(e) => dispatch({ type: "ex", key: optTable.key, exKey: optEx.key, patch: { restSeconds: cleanReps(e.target.value) } })}
                />
              </Field>
              <Field label={t.workoutEditor.tempo} optional>
                <Input
                  maxLength={20}
                  value={optEx.tempo}
                  onChange={(e) => dispatch({ type: "ex", key: optTable.key, exKey: optEx.key, patch: { tempo: e.target.value } })}
                />
              </Field>
              <Field label={t.workoutEditor.video} optional className="sm:col-span-2">
                <Input
                  dir="ltr"
                  maxLength={500}
                  placeholder="https://…"
                  value={optEx.videoUrl}
                  onChange={(e) => dispatch({ type: "ex", key: optTable.key, exKey: optEx.key, patch: { videoUrl: e.target.value } })}
                />
              </Field>
              <Field label={t.workoutEditor.cues} optional className="sm:col-span-2">
                <Textarea
                  rows={2}
                  maxLength={2000}
                  placeholder={t.workoutEditor.cuesPh}
                  value={optEx.notes}
                  onChange={(e) => dispatch({ type: "ex", key: optTable.key, exKey: optEx.key, patch: { notes: e.target.value } })}
                />
              </Field>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                disabled={optIndex <= 0}
                onClick={() => dispatch({ type: "moveEx", key: optTable.key, exKey: optEx.key, dir: -1 })}
              >
                <ArrowUp /> {t.workoutEditor.moveUp}
              </Button>
              <Button
                variant="secondary"
                size="sm"
                disabled={optIndex >= optTable.exercises.length - 1}
                onClick={() => dispatch({ type: "moveEx", key: optTable.key, exKey: optEx.key, dir: 1 })}
              >
                <ArrowDown /> {t.workoutEditor.moveDown}
              </Button>
              <Button
                variant="danger-ghost"
                size="sm"
                className="ms-auto"
                onClick={() => {
                  dispatch({ type: "removeEx", key: optTable.key, exKey: optEx.key });
                  setOptions(null);
                }}
              >
                <Trash2 /> {t.workoutEditor.deleteExercise}
              </Button>
            </div>
          </DialogContent>
        ) : null}
      </Dialog>

      <div
        className={cn(
          "fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface px-4 py-3 transition-[transform,visibility] duration-200 safe-bottom lg:start-64",
          dirty || saving ? "visible translate-y-0" : "invisible translate-y-full",
        )}
      >
        <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-3 sm:px-2 lg:px-4">
          <p className="text-sm font-medium">
            <span className="me-2 inline-block size-2 rounded-full bg-warn align-middle" aria-hidden />
            {t.common.unsavedChanges}
          </p>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={discard} disabled={saving}>
              <RotateCcw /> {t.common.discard}
            </Button>
            <Button onClick={save} loading={saving}>
              {!saving ? <Save /> : null} {t.workoutEditor.savePlan}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── one table (= one training day) ─────────────────────── */

const TableSheet = memo(function TableSheet({
  table,
  weekCount,
  startsOn,
  currentWeek,
  schedule,
  titles,
  results,
  today,
  dispatch,
  onOptions,
}: {
  table: Table;
  weekCount: number;
  startsOn: string;
  currentWeek: number;
  schedule: (string | null)[];
  titles: Record<string, string>;
  results: Map<number, { byName: Map<string, ExResult>; byPos: Map<number, ExResult> }> | undefined;
  today: string;
  dispatch: Dispatch<Action>;
  onOptions: (tableKey: string, exKey: string) => void;
}) {
  const { t, f, fmt } = useI18n();
  const S = table.setCount;
  const weeks = Array.from({ length: weekCount }, (_, w) => w);
  const setCols = Array.from({ length: S }, (_, s) => s);
  const resultFor = (w: number, e: Ex, i: number) => {
    const r = results?.get(w);
    if (!r) return undefined;
    return r.byName.get(e.name.trim().toLowerCase()) ?? r.byPos.get(i);
  };

  return (
    <section
      className="rounded-2xl border border-line bg-surface p-2.5 shadow-card [contain-intrinsic-size:auto_900px] [content-visibility:auto] sm:p-4"
      aria-label={table.title || t.sheet.tableTitle}
      data-sheet-table
    >
      <div className="mb-2.5 flex flex-wrap items-center gap-2">
        <input
          value={table.title}
          maxLength={80}
          onChange={(e) => dispatch({ type: "table", key: table.key, patch: { title: e.target.value.toUpperCase() } })}
          aria-label={t.sheet.tableTitle}
          placeholder={t.sheet.tableTitle}
          className="h-10 w-32 min-w-0 rounded-xl border border-line bg-surface-2 px-3 text-base font-extrabold tracking-wide outline-none focus:border-ring"
        />
        <div className="flex flex-wrap gap-1" role="group" aria-label={t.sheet.days}>
          {DAY_ORDER.map((dow) => {
            const owner = schedule[dow];
            const mine = owner === table.key;
            const other = owner && !mine ? titles[owner] : null;
            return (
              <button
                key={dow}
                type="button"
                onClick={() => dispatch({ type: "day", key: table.key, dow })}
                aria-pressed={mine}
                title={other ?? undefined}
                className={cn(
                  "h-8 rounded-lg border px-1.5 text-xs font-bold transition",
                  mine
                    ? "border-ink bg-ink text-page"
                    : other
                      ? "border-dashed border-line-strong text-muted/70"
                      : "border-line text-muted hover:border-ink hover:text-ink",
                )}
              >
                {fmt.weekdayName(dow, "short").replace(/^ال/, "")}
              </button>
            );
          })}
        </div>
        <div className="ms-auto flex items-center gap-2">
          <span className="text-xs font-medium text-muted">{t.sheet.sets}</span>
          <Stepper value={S} min={1} max={MAX_SETS} onChange={(n) => dispatch({ type: "setCount", key: table.key, n })} label={t.sheet.sets} small />
          <ConfirmDialog
            title={f(t.workoutEditor.deleteDayTitle, { name: table.title || t.sheet.tableTitle })}
            description={t.workoutEditor.deleteDayText}
            confirmLabel={t.sheet.deleteTable}
            onConfirm={() => dispatch({ type: "removeTable", key: table.key })}
            trigger={
              <Button variant="ghost" size="icon-sm" aria-label={t.sheet.deleteTable} className="text-crit-text hover:bg-crit-soft">
                <Trash2 />
              </Button>
            }
          />
        </div>
      </div>

      <div className="overflow-x-auto rounded-md border-2 border-ink" dir="ltr">
        <table className="w-full table-fixed border-collapse text-sm" style={{ minWidth: 126 + S * 44 }}>
          <colgroup>
            <col style={{ width: "28%", minWidth: 96 }} />
            <col style={{ width: 32 }} />
            {setCols.map((s) => (
              <col key={s} />
            ))}
          </colgroup>
          {weeks.map((w) => {
            const from = addDays(startsOn, w * 7);
            const current = w === currentWeek;
            // Same layout as the paper sheet: "Exercise" on the left, "Week (n)" over the set columns.
            return (
              <tbody key={w}>
                <tr className={cn("text-xs", w > 0 && "border-t-[3px] border-ink")}>
                  <th
                    scope="colgroup"
                    colSpan={2}
                    rowSpan={2}
                    className="border-b-2 border-e-2 border-ink bg-surface-2 px-1.5 text-start text-sm font-extrabold"
                  >
                    {t.sheet.exercise}
                  </th>
                  <th scope="col" colSpan={S} className={cn("border-b border-ink px-2 py-1.5", current ? "bg-ink text-page" : "bg-surface-2 text-ink")}>
                    <div className="flex flex-wrap items-center justify-center gap-x-2.5 gap-y-1">
                      <span className="text-base font-extrabold">{f(t.sheet.weekN, { n: w + 1 })}</span>
                      <span dir="auto" className={cn("text-[11px] font-medium", current ? "text-page/70" : "text-muted")}>
                        {fmt.dateShort(from)} – {fmt.dateShort(addDays(from, 6))}
                      </span>
                      {current ? (
                        <span dir="auto" className="rounded-full bg-brand px-2 py-0.5 text-[10px] font-bold text-brand-ink">
                          {t.sheet.thisWeek}
                        </span>
                      ) : null}
                      {w > 0 ? (
                        <button
                          type="button"
                          onClick={() => dispatch({ type: "copyWeek", key: table.key, from: w - 1, to: w })}
                          className={cn(
                            "inline-flex h-6 items-center gap-1 rounded-md px-2 text-[11px] font-semibold",
                            current ? "bg-page/15 text-page hover:bg-page/25" : "bg-surface text-ink-2 hover:text-ink",
                          )}
                        >
                          <Copy className="size-3" /> <span dir="auto">{f(t.sheet.copyPrev, { n: w })}</span>
                        </button>
                      ) : null}
                    </div>
                  </th>
                </tr>
                <tr className="bg-surface-2 text-xs">
                  {setCols.map((s) => (
                    <th key={s} scope="col" className="border-b-2 border-e border-ink border-e-line-strong py-1.5 font-medium last:border-e-0">
                      {f(t.sheet.setN, { n: s + 1 })}
                    </th>
                  ))}
                </tr>
                {table.exercises.map((e, i) => (
                  <ExerciseRows
                    key={e.key}
                    tableKey={table.key}
                    ex={e}
                    index={i}
                    week={w}
                    setCount={S}
                    result={resultFor(w, e, i)}
                    today={today}
                    dispatch={dispatch}
                    onOptions={onOptions}
                  />
                ))}
              </tbody>
            );
          })}
        </table>
      </div>

      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        <Button variant="secondary" size="sm" onClick={() => dispatch({ type: "addEx", key: table.key, ex: newExercise() })}>
          <Plus /> {t.sheet.addExercise}
        </Button>
      </div>
      <Disclosure title={t.workoutEditor.instructions} className="mt-1" defaultOpen={!!table.instructions}>
        <Textarea
          rows={2}
          maxLength={4000}
          value={table.instructions}
          placeholder={t.workoutEditor.instructionsPh}
          onChange={(e) => dispatch({ type: "table", key: table.key, patch: { instructions: e.target.value } })}
        />
      </Disclosure>
    </section>
  );
});

/* ── one exercise in one week: a weight row and a reps row ─ */

const ExerciseRows = memo(function ExerciseRows({
  tableKey,
  ex,
  index,
  week,
  setCount,
  result,
  today,
  dispatch,
  onOptions,
}: {
  tableKey: string;
  ex: Ex;
  index: number;
  week: number;
  setCount: number;
  result: ExResult | undefined;
  today: string;
  dispatch: Dispatch<Action>;
  onOptions: (tableKey: string, exKey: string) => void;
}) {
  const { t, f } = useI18n();
  const cols = Array.from({ length: setCount }, (_, s) => s);
  const outcome = (s: number) => {
    const r = result?.sets.find((x) => x.setNumber === s + 1);
    if (!r) return null;
    // A different weight than prescribed is shown under the "wt" cell.
    const lifted = r.actualWeightKg != null && r.actualWeightKg !== r.targetWeightKg ? r.actualWeightKg : null;
    if (r.status === "completed") return { tone: "good" as const, actual: r.actualReps ?? r.targetReps, lifted };
    if (r.status === "partial" || r.status === "skipped") return { tone: "less" as const, actual: r.actualReps ?? 0, lifted };
    return result!.date < today ? { tone: "less" as const, actual: 0, lifted: null } : null;
  };
  const cellCls = (o: ReturnType<typeof outcome>) => (o?.tone === "good" ? "bg-good-soft" : o?.tone === "less" ? "bg-warn-soft" : "");
  const label = ex.name.trim() || `#${index + 1}`;

  return (
    <>
      <tr>
        <td rowSpan={2} className="border-b-2 border-e border-ink border-e-line-strong p-1 align-top">
          {week === 0 ? (
            <div className="flex h-full flex-col">
              <textarea
                value={ex.name}
                rows={2}
                maxLength={120}
                onChange={(e) => dispatch({ type: "ex", key: tableKey, exKey: ex.key, patch: { name: e.target.value } })}
                placeholder={t.workoutEditor.exerciseName}
                aria-label={t.workoutEditor.exerciseName}
                className="w-full min-w-0 resize-none rounded-md bg-transparent px-1 py-0.5 text-[13px] font-bold leading-tight outline-none focus:bg-surface-2"
              />
              <button
                type="button"
                onClick={() => onOptions(tableKey, ex.key)}
                aria-label={`${t.sheet.exerciseOptions}: ${label}`}
                className="mt-auto grid h-6 w-8 place-items-center rounded-md text-muted hover:bg-surface-2 hover:text-ink"
              >
                <MoreHorizontal className="size-4" />
              </button>
            </div>
          ) : (
            <span className="block px-1 py-0.5 text-[13px] font-bold leading-tight break-words">{ex.name || "—"}</span>
          )}
        </td>
        <td className="border-b border-e-2 border-ink border-b-line-strong text-center text-[10px] font-extrabold text-muted">{t.sheet.wt}</td>
        {cols.map((s) => {
          const o = outcome(s);
          return (
            <td key={s} className={cn("border-b border-e border-line-strong p-0 last:border-e-0", cellCls(o))}>
              <input
                inputMode="decimal"
                value={cellOf(ex, week, s).w}
                onChange={(e) => dispatch({ type: "cell", key: tableKey, exKey: ex.key, w: week, s, field: "w", value: cleanWeight(e.target.value) })}
                aria-label={`${label} · ${f(t.sheet.weekN, { n: week + 1 })} · ${f(t.sheet.setN, { n: s + 1 })} · ${t.sheet.wt}`}
                className="h-9 w-full min-w-0 bg-transparent text-center text-sm font-bold tabular outline-none focus:bg-brand/20"
              />
              {o?.lifted != null ? (
                <span className="-mt-1.5 block pb-0.5 text-center text-[9px] font-bold leading-none text-ink-2">{f(t.sheet.lifted, { n: o.lifted })}</span>
              ) : null}
            </td>
          );
        })}
      </tr>
      <tr>
        <td className="border-b-2 border-e-2 border-ink text-center text-[10px] font-extrabold text-muted">{t.sheet.rep}</td>
        {cols.map((s) => {
          const o = outcome(s);
          return (
            <td key={s} className={cn("border-b-2 border-e border-b-ink border-e-line-strong p-0 last:border-e-0", cellCls(o))}>
              <input
                inputMode="numeric"
                value={cellOf(ex, week, s).r}
                onChange={(e) => dispatch({ type: "cell", key: tableKey, exKey: ex.key, w: week, s, field: "r", value: cleanReps(e.target.value) })}
                aria-label={`${label} · ${f(t.sheet.weekN, { n: week + 1 })} · ${f(t.sheet.setN, { n: s + 1 })} · ${t.sheet.rep}`}
                className={cn(
                  "h-9 w-full min-w-0 bg-transparent text-center text-sm tabular outline-none focus:bg-brand/20",
                  o?.tone === "good" ? "text-good-text" : o?.tone === "less" ? "text-warn-text" : "text-ink-2",
                )}
              />
              {o?.tone === "less" ? (
                <span className="-mt-1.5 block pb-0.5 text-center text-[9px] font-bold leading-none text-warn-text">{f(t.sheet.did, { n: o.actual })}</span>
              ) : null}
            </td>
          );
        })}
      </tr>
    </>
  );
});

function Stepper({
  value,
  min,
  max,
  onChange,
  label,
  small,
}: {
  value: number;
  min: number;
  max: number;
  onChange: (n: number) => void;
  label: string;
  small?: boolean;
}) {
  const btn = cn(
    "grid place-items-center rounded-lg border border-line bg-surface-2 font-bold hover:border-ink disabled:opacity-40",
    small ? "size-8" : "size-10",
  );
  return (
    <div className="inline-flex items-center gap-1.5" role="group" aria-label={label}>
      <button type="button" className={btn} onClick={() => onChange(value - 1)} disabled={value <= min} aria-label={`${label} −`}>
        −
      </button>
      <span className={cn("min-w-6 text-center font-bold tabular", small ? "text-sm" : "text-base")} aria-live="polite">
        {value}
      </span>
      <button type="button" className={btn} onClick={() => onChange(value + 1)} disabled={value >= max} aria-label={`${label} +`}>
        +
      </button>
    </div>
  );
}
