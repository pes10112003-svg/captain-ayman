"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ArrowDown, ArrowUp, ChevronDown, Copy, Dumbbell, GripVertical, Link2, Plus, RotateCcw, Save, Trash2, X } from "lucide-react";
import { saveWorkoutPlanAction } from "@/server/actions/workouts";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";
import { Disclosure } from "@/components/ui/disclosure";
import { useI18n } from "@/i18n/client";

/* ── draft types ─────────────────────────────────────────── */

type Num = number | "";
type SetDraft = { key: string; targetReps: Num; targetWeight: Num };
type ExerciseDraft = {
  key: string;
  name: string;
  restSeconds: Num;
  tempo: string;
  notes: string;
  videoUrl: string;
  sets: SetDraft[];
};
type WorkoutDraft = {
  id: string | null;
  key: string;
  title: string;
  muscleGroup: string;
  instructions: string;
  exercises: ExerciseDraft[];
};
type PlanDraft = {
  name: string;
  notes: string;
  workouts: WorkoutDraft[];
  schedule: (string | null)[];
};

export type EditorPlan = {
  name: string;
  notes: string | null;
  schedule: (string | null)[];
  workouts: {
    id: string;
    key: string;
    title: string;
    muscleGroup: string | null;
    instructions: string | null;
    exercises: {
      key: string;
      name: string;
      restSeconds: number | null;
      tempo: string | null;
      notes: string | null;
      videoUrl: string | null;
      sets: { key: string; targetReps: number; targetWeight: number | null }[];
    }[];
  }[];
} | null;

let counter = 0;
const uid = () => `k${Date.now().toString(36)}${(counter++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;

function toDraft(plan: EditorPlan, defaultName: string): PlanDraft {
  if (!plan)
    return {
      name: defaultName,
      notes: "",
      workouts: [],
      schedule: Array(7).fill(null),
    };
  return {
    name: plan.name,
    notes: plan.notes ?? "",
    schedule: plan.schedule,
    workouts: plan.workouts.map((w) => ({
      id: w.id,
      key: w.key,
      title: w.title,
      muscleGroup: w.muscleGroup ?? "",
      instructions: w.instructions ?? "",
      exercises: w.exercises.map((e) => ({
        key: e.key,
        name: e.name,
        restSeconds: e.restSeconds ?? "",
        tempo: e.tempo ?? "",
        notes: e.notes ?? "",
        videoUrl: e.videoUrl ?? "",
        sets: e.sets.map((s) => ({
          key: s.key,
          targetReps: s.targetReps,
          targetWeight: s.targetWeight ?? "",
        })),
      })),
    })),
  };
}

const newExercise = (): ExerciseDraft => ({
  key: uid(),
  name: "",
  restSeconds: 90,
  tempo: "",
  notes: "",
  videoUrl: "",
  sets: [0, 1, 2].map(() => ({ key: uid(), targetReps: 10, targetWeight: "" })),
});

const cloneExercise = (e: ExerciseDraft): ExerciseDraft => ({
  ...e,
  key: uid(),
  sets: e.sets.map((s) => ({ ...s, key: uid() })),
});

const numOrNull = (v: Num) => (v === "" || Number.isNaN(Number(v)) ? null : Number(v));

/* ── component ─────────────────────────────────────────── */

export function WorkoutPlanEditor({
  clientId,
  initial,
  weightUnit,
  weekStartsOn,
}: {
  clientId: string;
  initial: EditorPlan;
  weightUnit: string;
  weekStartsOn: number;
}) {
  const { t, f, fmt, locale } = useI18n();
  const defaultName = t.workoutEditor.defaultPlanName;
  const router = useRouter();
  const [baseline, setBaseline] = useState(() => JSON.stringify(toDraft(initial, defaultName)));
  const [plan, setPlan] = useState<PlanDraft>(() => toDraft(initial, defaultName));
  const [selected, setSelected] = useState<string | null>(plan.workouts[0]?.key ?? null);
  const [saving, startSaving] = useTransition();
  const [errors, setErrors] = useState<string[]>([]);
  const dirty = useMemo(() => JSON.stringify(plan) !== baseline, [plan, baseline]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const current = plan.workouts.find((w) => w.key === selected) ?? null;
  const dayOrder = Array.from({ length: 7 }, (_, i) => (weekStartsOn + i) % 7);
  const trainingDays = plan.schedule.filter(Boolean).length;

  /* mutators */
  const updateWorkout = (key: string, patch: Partial<WorkoutDraft>) =>
    setPlan((p) => ({
      ...p,
      workouts: p.workouts.map((w) => (w.key === key ? { ...w, ...patch } : w)),
    }));

  const updateExercises = (fn: (list: ExerciseDraft[]) => ExerciseDraft[]) => {
    if (!current) return;
    updateWorkout(current.key, { exercises: fn(current.exercises) });
  };

  const updateExercise = (key: string, patch: Partial<ExerciseDraft>) => updateExercises((list) => list.map((e) => (e.key === key ? { ...e, ...patch } : e)));

  const addWorkout = () => {
    const key = uid();
    const title = ["PUSH", "PULL", "LEGS", "UPPER", "LOWER", "FULL BODY"][plan.workouts.length] ?? f(t.workoutEditor.dayN, { n: plan.workouts.length + 1 });
    setPlan((p) => ({
      ...p,
      workouts: [
        ...p.workouts,
        {
          id: null,
          key,
          title,
          muscleGroup: "",
          instructions: "",
          exercises: [newExercise()],
        },
      ],
    }));
    setSelected(key);
  };

  const duplicateWorkout = (w: WorkoutDraft) => {
    const key = uid();
    setPlan((p) => ({
      ...p,
      workouts: [
        ...p.workouts,
        {
          ...w,
          id: null,
          key,
          title: `${w.title}${t.workoutEditor.copySuffix}`.slice(0, 80),
          exercises: w.exercises.map(cloneExercise),
        },
      ],
    }));
    setSelected(key);
    toast.success(f(t.workoutEditor.duplicated, { name: w.title }));
  };

  const removeWorkout = (w: WorkoutDraft) => {
    setPlan((p) => ({
      ...p,
      workouts: p.workouts.filter((x) => x.key !== w.key),
      schedule: p.schedule.map((k) => (k === w.key ? null : k)),
    }));
    setSelected(plan.workouts.find((x) => x.key !== w.key)?.key ?? null);
  };

  const dndId = useId();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );
  const onDragEnd = (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return;
    updateExercises((list) => {
      const from = list.findIndex((x) => x.key === e.active.id);
      const to = list.findIndex((x) => x.key === e.over!.id);
      return arrayMove(list, from, to);
    });
  };

  const validate = () => {
    const errs: string[] = [];
    const we = t.workoutEditor;
    if (!plan.name.trim()) errs.push(we.errName);
    plan.workouts.forEach((w) => {
      if (!w.title.trim()) errs.push(we.errTitle);
      w.exercises.forEach((e, i) => {
        if (!e.name.trim())
          errs.push(
            f(we.errExerciseName, {
              workout: w.title || t.overview.workout,
              n: i + 1,
            }),
          );
        if (!e.sets.length)
          errs.push(
            f(we.errSets, {
              workout: w.title,
              exercise: e.name || `${we.exercise} #${i + 1}`,
            }),
          );
        e.sets.forEach((s) => {
          if (s.targetReps === "" || Number(s.targetReps) < 0)
            errs.push(
              f(we.errReps, {
                workout: w.title,
                exercise: e.name || we.exercise,
              }),
            );
        });
        if (e.videoUrl && !/^https?:\/\//i.test(e.videoUrl)) errs.push(f(we.errVideo, { exercise: e.name }));
      });
    });
    return [...new Set(errs)];
  };

  const save = () => {
    const errs = validate();
    setErrors(errs);
    if (errs.length) {
      toast.error(errs[0]);
      return;
    }
    const payload = {
      name: plan.name.trim(),
      notes: plan.notes.trim() || null,
      schedule: plan.schedule,
      workouts: plan.workouts.map((w) => ({
        id: w.id,
        key: w.key,
        title: w.title.trim(),
        muscleGroup: w.muscleGroup.trim() || null,
        instructions: w.instructions.trim() || null,
        exercises: w.exercises.map((e) => ({
          name: e.name.trim(),
          restSeconds: numOrNull(e.restSeconds),
          tempo: e.tempo.trim() || null,
          notes: e.notes.trim() || null,
          videoUrl: e.videoUrl.trim() || null,
          sets: e.sets.map((s) => ({
            targetReps: Number(s.targetReps),
            targetWeight: numOrNull(s.targetWeight),
          })),
        })),
      })),
    };
    startSaving(async () => {
      const res = await saveWorkoutPlanAction(clientId, payload);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(t.workoutEditor.saved);
      setBaseline(JSON.stringify(plan));
      router.refresh();
    });
  };

  const discard = () => {
    const d = JSON.parse(baseline) as PlanDraft;
    setPlan(d);
    setSelected(d.workouts[0]?.key ?? null);
    setErrors([]);
  };

  // When the server copy changes (e.g. after saving, new rows get real ids) re-seed the editor —
  // but never clobber unsaved local edits because of an unrelated refresh.
  const initialJson = useMemo(() => JSON.stringify(toDraft(initial, defaultName)), [initial, defaultName]);
  const [seenInitial, setSeenInitial] = useState(initialJson);
  if (initialJson !== seenInitial) {
    setSeenInitial(initialJson);
    if (!dirty || saving) {
      const d = JSON.parse(initialJson) as PlanDraft;
      const idx = plan.workouts.findIndex((w) => w.key === selected);
      setPlan(d);
      setBaseline(initialJson);
      setSelected(d.workouts.some((w) => w.key === selected) ? selected : (d.workouts[Math.max(idx, 0)]?.key ?? null));
    }
  }

  return (
    <div className="space-y-6 pb-24">
      <Card>
        <CardBody className="grid gap-4 sm:grid-cols-[1fr_2fr]">
          <Field label={t.workoutEditor.planName} htmlFor="plan-name">
            <Input id="plan-name" value={plan.name} maxLength={120} onChange={(e) => setPlan((p) => ({ ...p, name: e.target.value }))} />
          </Field>
          <Field label={t.workoutEditor.planNotes} htmlFor="plan-notes" optional>
            <Input
              id="plan-notes"
              value={plan.notes}
              maxLength={4000}
              placeholder={t.workoutEditor.planNotesPh}
              onChange={(e) => setPlan((p) => ({ ...p, notes: e.target.value }))}
            />
          </Field>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title={t.workoutEditor.schedule}
          description={f(t.workoutEditor.scheduleSub, {
            n: fmt.num(trainingDays, 0),
          })}
        />
        <CardBody>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
            {dayOrder.map((dow) => {
              const value = plan.schedule[dow];
              return (
                <label
                  key={dow}
                  className={cn("rounded-xl border p-3 transition", value ? "border-ink/80 bg-surface" : "border-dashed border-line-strong bg-surface-2/60")}
                >
                  <span className="mb-1.5 block text-xs font-medium text-muted">
                    <span className="sm:hidden lg:inline">{fmt.weekdayName(dow, "long")}</span>
                    <span className="hidden sm:inline lg:hidden">{fmt.weekdayName(dow, "short")}</span>
                  </span>
                  <Select
                    aria-label={f(t.workoutEditor.dayWorkout, {
                      day: fmt.weekdayName(dow, "long"),
                    })}
                    value={value ?? ""}
                    onChange={(e) =>
                      setPlan((p) => ({
                        ...p,
                        schedule: p.schedule.map((k, i) => (i === dow ? e.target.value || null : k)),
                      }))
                    }
                    className="h-9 text-[13px] font-semibold"
                  >
                    <option value="">{t.workoutEditor.rest}</option>
                    {plan.workouts.map((w) => (
                      <option key={w.key} value={w.key}>
                        {w.title || t.workoutEditor.untitled}
                      </option>
                    ))}
                  </Select>
                </label>
              );
            })}
          </div>
        </CardBody>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">{t.workoutEditor.workoutDays}</p>
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 scrollbar-none lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0">
            {plan.workouts.map((w) => {
              const days = plan.schedule.map((k, i) => (k === w.key ? fmt.weekdayName(i, "short") : null)).filter(Boolean);
              return (
                <button
                  key={w.key}
                  type="button"
                  onClick={() => setSelected(w.key)}
                  className={cn(
                    "flex min-w-40 shrink-0 flex-col items-start rounded-xl border px-3.5 py-3 text-start transition lg:min-w-0",
                    selected === w.key ? "border-ink bg-surface shadow-card" : "border-line bg-surface/60 hover:border-line-strong",
                  )}
                >
                  <span className="text-sm font-semibold">{w.title || t.workoutEditor.untitled}</span>
                  <span className="mt-0.5 text-xs text-muted">
                    {f(t.workoutEditor.exercisesShort, {
                      n: fmt.num(w.exercises.length, 0),
                      days: days.length ? days.join(locale === "ar" ? "، " : ", ") : t.workoutEditor.notScheduled,
                    })}
                  </span>
                </button>
              );
            })}
            <Button variant="secondary" className="shrink-0 justify-start lg:w-full" onClick={addWorkout}>
              <Plus /> {t.workoutEditor.addDay}
            </Button>
          </div>
        </div>

        {current ? (
          <div className="space-y-4">
            <Card>
              <CardBody className="grid gap-4 sm:grid-cols-2">
                <Field label={t.workoutEditor.title} htmlFor="w-title">
                  <Input
                    id="w-title"
                    value={current.title}
                    maxLength={80}
                    onChange={(e) =>
                      updateWorkout(current.key, {
                        title: e.target.value.toUpperCase(),
                      })
                    }
                    className="font-semibold tracking-wide"
                  />
                </Field>
                <Field label={t.workoutEditor.muscleGroup} htmlFor="w-mg" optional>
                  <Input
                    id="w-mg"
                    list="muscle-groups"
                    value={current.muscleGroup}
                    maxLength={80}
                    onChange={(e) =>
                      updateWorkout(current.key, {
                        muscleGroup: e.target.value,
                      })
                    }
                    placeholder={t.workoutEditor.muscleGroupPh}
                  />
                  <datalist id="muscle-groups">
                    {t.workoutEditor.muscleGroupSuggestions.map((m) => (
                      <option key={m} value={m} />
                    ))}
                  </datalist>
                </Field>
                <Field label={t.workoutEditor.instructions} htmlFor="w-ins" optional className="sm:col-span-2">
                  <Textarea
                    id="w-ins"
                    rows={2}
                    value={current.instructions}
                    maxLength={4000}
                    onChange={(e) =>
                      updateWorkout(current.key, {
                        instructions: e.target.value,
                      })
                    }
                    placeholder={t.workoutEditor.instructionsPh}
                  />
                </Field>
                <div className="flex flex-wrap gap-2 sm:col-span-2">
                  <Button variant="secondary" size="sm" onClick={() => duplicateWorkout(current)}>
                    <Copy /> {t.workoutEditor.duplicateDay}
                  </Button>
                  <ConfirmDialog
                    title={f(t.workoutEditor.deleteDayTitle, {
                      name: current.title || t.workoutEditor.untitled,
                    })}
                    description={t.workoutEditor.deleteDayText}
                    confirmLabel={t.workoutEditor.deleteWorkout}
                    onConfirm={() => removeWorkout(current)}
                    trigger={
                      <Button variant="danger-ghost" size="sm">
                        <Trash2 /> {t.workoutEditor.deleteDay}
                      </Button>
                    }
                  />
                </div>
              </CardBody>
            </Card>

            <DndContext id={dndId} sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
              <SortableContext items={current.exercises.map((e) => e.key)} strategy={verticalListSortingStrategy}>
                <ol className="space-y-3">
                  {current.exercises.map((e, i) => (
                    <SortableExercise
                      key={e.key}
                      index={i}
                      count={current.exercises.length}
                      exercise={e}
                      weightUnit={weightUnit}
                      onChange={(patch) => updateExercise(e.key, patch)}
                      onMove={(dir) => updateExercises((list) => arrayMove(list, i, i + dir))}
                      onDuplicate={() => updateExercises((list) => [...list.slice(0, i + 1), cloneExercise(e), ...list.slice(i + 1)])}
                      onRemove={() => updateExercises((list) => list.filter((x) => x.key !== e.key))}
                    />
                  ))}
                </ol>
              </SortableContext>
            </DndContext>

            <Button variant="secondary" className="w-full border-dashed" onClick={() => updateExercises((list) => [...list, newExercise()])}>
              <Plus /> {t.workoutEditor.addExercise}
            </Button>
          </div>
        ) : (
          <EmptyState
            icon={<Dumbbell />}
            title={t.workoutEditor.emptyTitle}
            description={t.workoutEditor.emptyText}
            action={
              <Button onClick={addWorkout}>
                <Plus /> {t.workoutEditor.createFirst}
              </Button>
            }
          />
        )}
      </div>

      {errors.length ? (
        <div className="rounded-xl bg-crit-soft px-4 py-3 text-sm text-crit-text" role="alert">
          <ul className="list-inside list-disc space-y-0.5">
            {errors.slice(0, 5).map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div
        className={cn(
          "fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 px-4 py-3 backdrop-blur-xl transition-[transform,visibility] duration-200 safe-bottom lg:start-64",
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

/* ── exercise card ─────────────────────────────────────── */

function SortableExercise({
  exercise: e,
  index,
  count,
  weightUnit,
  onChange,
  onMove,
  onDuplicate,
  onRemove,
}: {
  exercise: ExerciseDraft;
  index: number;
  count: number;
  weightUnit: string;
  onChange: (patch: Partial<ExerciseDraft>) => void;
  onMove: (dir: -1 | 1) => void;
  onDuplicate: () => void;
  onRemove: () => void;
}) {
  const { t, f, fmt } = useI18n();
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: e.key });
  const [open, setOpen] = useState(!e.name);
  const setSet = (key: string, patch: Partial<SetDraft>) =>
    onChange({
      sets: e.sets.map((s) => (s.key === key ? { ...s, ...patch } : s)),
    });
  const parse = (v: string): Num => (v === "" ? "" : Number(v));
  const summary = e.sets.length
    ? `${f(t.workoutEditor.summary, { sets: fmt.num(e.sets.length, 0), reps: [...new Set(e.sets.map((s) => s.targetReps))].join("/") })}${
        e.sets.some((s) => s.targetWeight !== "")
          ? ` · ${[...new Set(e.sets.map((s) => (s.targetWeight === "" ? t.common.bodyweight : s.targetWeight)))].join("/")} ${fmt.unit(weightUnit)}`
          : ""
      }`
    : t.workoutEditor.noSets;

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn("rounded-2xl border border-line bg-surface shadow-card", isDragging && "relative z-10 shadow-pop ring-2 ring-ring/30")}
    >
      <div className="flex items-center gap-2 p-3 sm:p-4">
        <button
          ref={setActivatorNodeRef}
          type="button"
          {...attributes}
          {...listeners}
          className="grid size-8 shrink-0 cursor-grab touch-none place-items-center rounded-lg text-muted hover:bg-surface-2 active:cursor-grabbing"
          aria-label={f(t.workoutEditor.reorder, {
            name: e.name || t.workoutEditor.exercise,
          })}
        >
          <GripVertical className="size-4" />
        </button>
        <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-surface-2 text-xs font-semibold tabular text-ink-2">{index + 1}</span>
        <div className="min-w-0 flex-1">
          <input
            value={e.name}
            onChange={(ev) => onChange({ name: ev.target.value })}
            placeholder={t.workoutEditor.exerciseNamePh}
            maxLength={120}
            aria-label={t.workoutEditor.exerciseName}
            className="w-full rounded-lg bg-transparent px-1 py-1 text-[15px] font-semibold outline-none placeholder:font-normal placeholder:text-muted focus:bg-surface-2"
          />
          {!open ? <p className="px-1 text-xs text-muted">{summary}</p> : null}
        </div>
        <div className="flex shrink-0 items-center">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => onMove(-1)}
            disabled={index === 0}
            aria-label={t.workoutEditor.moveUp}
            className="hidden sm:inline-flex"
          >
            <ArrowUp />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => onMove(1)}
            disabled={index === count - 1}
            aria-label={t.workoutEditor.moveDown}
            className="hidden sm:inline-flex"
          >
            <ArrowDown />
          </Button>
          <Button variant="ghost" size="icon-sm" onClick={onDuplicate} aria-label={t.workoutEditor.duplicateExercise}>
            <Copy />
          </Button>
          <Button variant="ghost" size="icon-sm" onClick={onRemove} aria-label={t.workoutEditor.deleteExercise} className="text-crit-text hover:bg-crit-soft">
            <Trash2 />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setOpen((o) => !o)}
            aria-label={open ? t.workoutEditor.collapse : t.workoutEditor.expand}
            aria-expanded={open}
          >
            <ChevronDown className={cn("transition-transform", open && "rotate-180")} />
          </Button>
        </div>
      </div>

      {open ? (
        <div className="border-t border-line p-3 sm:p-4">
          <div className="overflow-hidden rounded-xl border border-line">
            <table className="w-full text-sm">
              <thead className="bg-surface-2 text-xs text-muted">
                <tr>
                  <th className="w-20 py-2 ps-3 pe-2 text-start font-medium">{t.workoutEditor.set}</th>
                  <th className="py-2 text-start font-medium">{t.workoutEditor.targetReps}</th>
                  <th className="py-2 text-start font-medium">
                    {f(t.workoutEditor.weightUnit, {
                      unit: fmt.unit(weightUnit),
                    })}
                  </th>
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {e.sets.map((s, i) => (
                  <tr key={s.key}>
                    <td className="py-1.5 ps-3 font-semibold tabular text-ink-2">{i + 1}</td>
                    <td className="py-1.5 pe-2">
                      <input
                        type="number"
                        inputMode="numeric"
                        min={0}
                        max={1000}
                        value={s.targetReps}
                        onChange={(ev) => setSet(s.key, { targetReps: parse(ev.target.value) })}
                        aria-label={f(t.workoutEditor.setTargetReps, {
                          n: i + 1,
                        })}
                        className="h-9 w-full max-w-28 rounded-lg border border-line bg-surface px-2.5 tabular outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"
                      />
                    </td>
                    <td className="py-1.5 pe-2">
                      <input
                        type="number"
                        inputMode="decimal"
                        min={0}
                        step="0.5"
                        value={s.targetWeight}
                        placeholder={t.workoutEditor.bodyweightPh}
                        onChange={(ev) =>
                          setSet(s.key, {
                            targetWeight: parse(ev.target.value),
                          })
                        }
                        aria-label={f(t.workoutEditor.setWeight, { n: i + 1 })}
                        className="h-9 w-full max-w-32 rounded-lg border border-line bg-surface px-2.5 tabular outline-none placeholder:text-xs placeholder:text-muted focus:border-ring focus:ring-2 focus:ring-ring/20"
                      />
                    </td>
                    <td className="pe-1.5 text-end">
                      <button
                        type="button"
                        onClick={() =>
                          onChange({
                            sets: e.sets.filter((x) => x.key !== s.key),
                          })
                        }
                        className="grid size-8 place-items-center rounded-lg text-muted hover:bg-crit-soft hover:text-crit-text"
                        aria-label={f(t.workoutEditor.removeSet, { n: i + 1 })}
                      >
                        <X className="size-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button
              type="button"
              onClick={() => {
                const last = e.sets[e.sets.length - 1];
                onChange({
                  sets: [
                    ...e.sets,
                    {
                      key: uid(),
                      targetReps: last?.targetReps ?? 10,
                      targetWeight: last?.targetWeight ?? "",
                    },
                  ],
                });
              }}
              className="flex w-full items-center justify-center gap-1.5 border-t border-line bg-surface-2/50 py-2 text-[13px] font-medium text-ink-2 hover:bg-surface-2 hover:text-ink"
            >
              <Plus className="size-3.5" /> {t.workoutEditor.addSet}
            </button>
          </div>

          <Disclosure title={t.common.moreOptions} defaultOpen={!!(e.tempo || e.videoUrl || e.notes)} className="mt-3">
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label={t.workoutEditor.restSeconds} optional>
                <Input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={3600}
                  value={e.restSeconds}
                  onChange={(ev) => onChange({ restSeconds: parse(ev.target.value) })}
                />
              </Field>
              <Field label={t.workoutEditor.tempo} optional>
                <Input value={e.tempo} maxLength={20} placeholder="3-1-1-0" dir="ltr" onChange={(ev) => onChange({ tempo: ev.target.value })} />
              </Field>
              <Field label={t.workoutEditor.video} optional>
                <div className="relative" dir="ltr">
                  <Link2 className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
                  <Input
                    value={e.videoUrl}
                    maxLength={500}
                    placeholder="https://…"
                    className="ps-9"
                    onChange={(ev) => onChange({ videoUrl: ev.target.value })}
                  />
                </div>
              </Field>
              <Field label={t.workoutEditor.cues} optional className="sm:col-span-3">
                <Textarea
                  rows={2}
                  value={e.notes}
                  maxLength={2000}
                  placeholder={t.workoutEditor.cuesPh}
                  onChange={(ev) => onChange({ notes: ev.target.value })}
                />
              </Field>
            </div>
          </Disclosure>
        </div>
      ) : null}
    </li>
  );
}
