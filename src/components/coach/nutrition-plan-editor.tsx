"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ArrowDownUp, ChevronDown, Clock, Copy, Eraser, Flame, GripVertical, Link2, Plus, RotateCcw, Save, Trash2, Utensils, X } from "lucide-react";
import { saveNutritionPlanAction } from "@/server/actions/nutrition";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { Field, Input, Textarea } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";
import { Disclosure } from "@/components/ui/disclosure";
import { useI18n } from "@/i18n/client";
import type { Dict } from "@/i18n/en";

type Num = number | "";
type ItemDraft = {
  key: string;
  name: string;
  quantity: string;
  calories: Num;
  protein: Num;
  carbs: Num;
  fats: Num;
};
type MealDraft = {
  id: string | null;
  key: string;
  name: string;
  time: string;
  notes: string;
  referenceUrl: string;
  items: ItemDraft[];
};
type PlanDraft = { name: string; notes: string; meals: MealDraft[] };

export type NutritionEditorPlan = {
  name: string;
  notes: string | null;
  meals: {
    id: string;
    key: string;
    name: string;
    time: string;
    notes: string | null;
    referenceUrl: string | null;
    items: {
      key: string;
      name: string;
      quantity: string | null;
      calories: number | null;
      protein: number | null;
      carbs: number | null;
      fats: number | null;
    }[];
  }[];
} | null;

let counter = 0;
const uid = () => `k${Date.now().toString(36)}${(counter++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const n = (v: Num | null | undefined): Num => (v == null ? "" : v);
const numOrNull = (v: Num) => (v === "" || Number.isNaN(Number(v)) ? null : Number(v));

function toDraft(plan: NutritionEditorPlan, defaultName: string): PlanDraft {
  if (!plan) return { name: defaultName, notes: "", meals: [] };
  return {
    name: plan.name,
    notes: plan.notes ?? "",
    meals: plan.meals.map((m) => ({
      id: m.id,
      key: m.key,
      name: m.name,
      time: m.time,
      notes: m.notes ?? "",
      referenceUrl: m.referenceUrl ?? "",
      items: m.items.map((i) => ({
        key: i.key,
        name: i.name,
        quantity: i.quantity ?? "",
        calories: n(i.calories),
        protein: n(i.protein),
        carbs: n(i.carbs),
        fats: n(i.fats),
      })),
    })),
  };
}

const newItem = (): ItemDraft => ({
  key: uid(),
  name: "",
  quantity: "",
  calories: "",
  protein: "",
  carbs: "",
  fats: "",
});
const MEAL_PRESETS: {
  key: Exclude<keyof Dict["nutritionEditor"]["presets"], "meal">;
  time: string;
}[] = [
  { key: "breakfast", time: "08:00" },
  { key: "snack", time: "11:00" },
  { key: "lunch", time: "14:00" },
  { key: "preWorkout", time: "17:00" },
  { key: "dinner", time: "20:00" },
  { key: "eveningSnack", time: "22:00" },
];

function totals(items: ItemDraft[]) {
  const t = (k: "calories" | "protein" | "carbs" | "fats") => items.reduce((a, i) => a + (i[k] === "" ? 0 : Number(i[k])), 0);
  return {
    calories: t("calories"),
    protein: t("protein"),
    carbs: t("carbs"),
    fats: t("fats"),
  };
}
const r = (v: number) => Math.round(v * 10) / 10;
const MACROS = ["calories", "protein", "carbs", "fats"] as const;

export function NutritionPlanEditor({ clientId, initial }: { clientId: string; initial: NutritionEditorPlan }) {
  const { t, f, fmt } = useI18n();
  const ne = t.nutritionEditor;
  const defaultName = ne.defaultPlanName;
  const router = useRouter();
  const initialJson = useMemo(() => JSON.stringify(toDraft(initial, defaultName)), [initial, defaultName]);
  const [baseline, setBaseline] = useState(initialJson);
  const [plan, setPlan] = useState<PlanDraft>(() => JSON.parse(initialJson));
  const [saving, start] = useTransition();
  const dirty = useMemo(() => JSON.stringify(plan) !== baseline, [plan, baseline]);

  const [seen, setSeen] = useState(initialJson);
  if (seen !== initialJson) {
    setSeen(initialJson);
    if (!dirty || saving) {
      setPlan(JSON.parse(initialJson));
      setBaseline(initialJson);
    }
  }

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const day = totals(plan.meals.flatMap((m) => m.items));
  // Calories & macros are optional — the daily totals only show once at least one value is entered.
  const hasDayMacros = day.calories + day.protein + day.carbs + day.fats > 0;
  const setMeal = (key: string, patch: Partial<MealDraft>) =>
    setPlan((p) => ({
      ...p,
      meals: p.meals.map((m) => (m.key === key ? { ...m, ...patch } : m)),
    }));

  const addMeal = () => {
    const used = new Set(plan.meals.map((m) => m.name));
    const presets = MEAL_PRESETS.map((p) => ({
      name: ne.presets[p.key],
      time: p.time,
    }));
    const preset = presets.find((p) => !used.has(p.name)) ?? {
      name: f(ne.presets.meal, { n: plan.meals.length + 1 }),
      time: "12:00",
    };
    setPlan((p) => ({
      ...p,
      meals: [
        ...p.meals,
        {
          id: null,
          key: uid(),
          name: preset.name,
          time: preset.time,
          notes: "",
          referenceUrl: "",
          items: [newItem()],
        },
      ],
    }));
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
    setPlan((p) => {
      const from = p.meals.findIndex((m) => m.key === e.active.id);
      const to = p.meals.findIndex((m) => m.key === e.over!.id);
      return { ...p, meals: arrayMove(p.meals, from, to) };
    });
  };

  const save = () => {
    const errs: string[] = [];
    if (!plan.name.trim()) errs.push(ne.errName);
    plan.meals.forEach((m, idx) => {
      if (!m.name.trim()) errs.push(ne.errMealName);
      if (!/^\d{2}:\d{2}$/.test(m.time)) errs.push(f(ne.errTime, { meal: m.name || f(ne.presets.meal, { n: idx + 1 }) }));
      m.items.forEach((i) => {
        if (!i.name.trim()) errs.push(f(ne.errFood, { meal: m.name }));
      });
      if (m.referenceUrl && !/^https?:\/\//i.test(m.referenceUrl)) errs.push(f(ne.errLink, { meal: m.name }));
    });
    if (errs.length) return void toast.error(errs[0]);

    const payload = {
      name: plan.name.trim(),
      notes: plan.notes.trim() || null,
      meals: plan.meals.map((m) => ({
        id: m.id,
        name: m.name.trim(),
        time: m.time,
        notes: m.notes.trim() || null,
        referenceUrl: m.referenceUrl.trim() || null,
        items: m.items.map((i) => ({
          name: i.name.trim(),
          quantity: i.quantity.trim() || null,
          calories: numOrNull(i.calories),
          protein: numOrNull(i.protein),
          carbs: numOrNull(i.carbs),
          fats: numOrNull(i.fats),
        })),
      })),
    };
    start(async () => {
      const res = await saveNutritionPlanAction(clientId, payload);
      if (!res.ok) return void toast.error(res.error);
      toast.success(ne.saved);
      setBaseline(JSON.stringify(plan));
      router.refresh();
    });
  };

  return (
    <div className="space-y-6 pb-24">
      <Card>
        <CardBody className={cn("grid gap-4", hasDayMacros ? "lg:grid-cols-[1fr_1fr_auto]" : "lg:grid-cols-2")}>
          <Field label={ne.planName} htmlFor="np-name">
            <Input id="np-name" value={plan.name} maxLength={120} onChange={(e) => setPlan((p) => ({ ...p, name: e.target.value }))} />
          </Field>
          <Field label={ne.planNotes} htmlFor="np-notes" optional>
            <Input
              id="np-notes"
              value={plan.notes}
              maxLength={4000}
              placeholder={ne.planNotesPh}
              onChange={(e) => setPlan((p) => ({ ...p, notes: e.target.value }))}
            />
          </Field>
          {hasDayMacros ? (
            <div className="grid grid-cols-4 gap-2 rounded-xl bg-surface-2 p-3 text-center lg:min-w-80">
              {[
                [ne.kcal, fmt.num(r(day.calories))],
                [ne.protein, fmt.measure(r(day.protein), "g")],
                [ne.carbs, fmt.measure(r(day.carbs), "g")],
                [ne.fats, fmt.measure(r(day.fats), "g")],
              ].map(([k, v]) => (
                <div key={String(k)}>
                  <p className="text-[11px] text-muted">{k}</p>
                  <p className="text-sm font-semibold tabular">{v}</p>
                </div>
              ))}
              <p className="col-span-4 text-[10px] uppercase tracking-wide text-muted">{ne.dailyTotal}</p>
            </div>
          ) : null}
        </CardBody>
      </Card>

      {plan.meals.length ? (
        <>
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted">{f(ne.mealsPerDay, { n: fmt.num(plan.meals.length, 0) })}</p>
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                setPlan((p) => ({
                  ...p,
                  meals: [...p.meals].sort((a, b) => a.time.localeCompare(b.time)),
                }))
              }
            >
              <ArrowDownUp /> {ne.sortByTime}
            </Button>
          </div>
          <DndContext id={dndId} sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={plan.meals.map((m) => m.key)} strategy={verticalListSortingStrategy}>
              <ol className="space-y-3">
                {plan.meals.map((m, i) => (
                  <SortableMeal
                    key={m.key}
                    meal={m}
                    index={i}
                    onChange={(patch) => setMeal(m.key, patch)}
                    onDuplicate={() =>
                      setPlan((p) => ({
                        ...p,
                        meals: [
                          ...p.meals.slice(0, i + 1),
                          {
                            ...m,
                            id: null,
                            key: uid(),
                            name: `${m.name}${t.workoutEditor.copySuffix}`.slice(0, 80),
                            items: m.items.map((it) => ({ ...it, key: uid() })),
                          },
                          ...p.meals.slice(i + 1),
                        ],
                      }))
                    }
                    onReplace={() =>
                      setMeal(m.key, {
                        name: m.name,
                        notes: "",
                        referenceUrl: "",
                        items: [newItem()],
                      })
                    }
                    onRemove={() =>
                      setPlan((p) => ({
                        ...p,
                        meals: p.meals.filter((x) => x.key !== m.key),
                      }))
                    }
                  />
                ))}
              </ol>
            </SortableContext>
          </DndContext>
          <Button variant="secondary" className="w-full border-dashed" onClick={addMeal}>
            <Plus /> {ne.addMeal}
          </Button>
        </>
      ) : (
        <EmptyState
          icon={<Utensils />}
          title={ne.emptyTitle}
          description={ne.emptyText}
          action={
            <Button onClick={addMeal}>
              <Plus /> {ne.addFirstMeal}
            </Button>
          }
        />
      )}

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
            <Button variant="ghost" onClick={() => setPlan(JSON.parse(baseline))} disabled={saving}>
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

function SortableMeal({
  meal: m,
  index,
  onChange,
  onDuplicate,
  onReplace,
  onRemove,
}: {
  meal: MealDraft;
  index: number;
  onChange: (patch: Partial<MealDraft>) => void;
  onDuplicate: () => void;
  onReplace: () => void;
  onRemove: () => void;
}) {
  const { t, f, fmt } = useI18n();
  const ne = t.nutritionEditor;
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: m.key });
  const [open, setOpen] = useState(true);
  const tot = totals(m.items);
  const hasMacros = m.items.some((i) => i.calories !== "" || i.protein !== "" || i.carbs !== "" || i.fats !== "");
  // Optional nutrition values: hidden until the coach asks for them (or the meal already has some).
  const [showMacros, setShowMacros] = useState(hasMacros);
  const macroLabel = {
    calories: ne.kcal,
    protein: ne.proteinG,
    carbs: ne.carbsG,
    fats: ne.fatsG,
  } as const;
  const setItem = (key: string, patch: Partial<ItemDraft>) =>
    onChange({
      items: m.items.map((i) => (i.key === key ? { ...i, ...patch } : i)),
    });
  const parse = (v: string): Num => (v === "" ? "" : Number(v));
  const numCell =
    "h-9 w-full min-w-0 rounded-lg border border-line bg-surface px-2 text-end tabular outline-none focus:border-ring focus:ring-2 focus:ring-ring/20";
  // Phones: food | quantity | ✕ (values wrap below). Wider screens: one row with every column.
  const rowCols = "grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_2rem]";
  const gridCols = showMacros ? "sm:grid-cols-[minmax(0,2fr)_minmax(0,1.3fr)_repeat(4,4.75rem)_2rem]" : "sm:grid-cols-[minmax(0,2fr)_minmax(0,1.3fr)_2rem]";

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn("rounded-2xl border border-line bg-surface shadow-card", isDragging && "relative z-10 shadow-pop ring-2 ring-ring/30")}
    >
      <div className="flex flex-wrap items-center gap-2 p-3 sm:p-4">
        <button
          ref={setActivatorNodeRef}
          type="button"
          {...attributes}
          {...listeners}
          className="grid size-8 shrink-0 cursor-grab touch-none place-items-center rounded-lg text-muted hover:bg-surface-2"
          aria-label={f(ne.reorder, { name: m.name })}
        >
          <GripVertical className="size-4" />
        </button>
        <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-surface-2 text-xs font-semibold text-ink-2">{index + 1}</span>
        <input
          value={m.name}
          onChange={(e) => onChange({ name: e.target.value })}
          maxLength={80}
          aria-label={ne.mealName}
          placeholder={ne.mealName}
          className="min-w-36 flex-1 rounded-lg bg-transparent px-1 py-1 text-[15px] font-semibold outline-none focus:bg-surface-2"
        />
        <label className="relative flex items-center">
          <Clock className="pointer-events-none absolute start-2.5 size-3.5 text-muted" />
          <input
            type="time"
            value={m.time}
            onChange={(e) => onChange({ time: e.target.value })}
            aria-label={f(ne.mealTime, { name: m.name })}
            className="h-9 rounded-lg border border-line bg-surface pe-2 ps-8 text-sm tabular outline-none focus:border-ring"
          />
        </label>
        <div className="ms-auto flex items-center">
          <Button variant="ghost" size="icon-sm" onClick={onDuplicate} aria-label={ne.duplicateMeal}>
            <Copy />
          </Button>
          <Button variant="ghost" size="icon-sm" onClick={onReplace} aria-label={ne.replaceMeal} title={ne.replaceMeal}>
            <Eraser />
          </Button>
          <Button variant="ghost" size="icon-sm" onClick={onRemove} aria-label={ne.deleteMeal} className="text-crit-text hover:bg-crit-soft">
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
      {!open ? (
        <p className="-mt-2 px-4 pb-3 text-xs text-muted">
          {m.items
            .map((i) => i.name)
            .filter(Boolean)
            .join(", ") || ne.noFoods}
          {hasMacros ? ` · ${fmt.num(r(tot.calories))} ${fmt.unit("kcal")}` : ""}
        </p>
      ) : (
        <div className="border-t border-line p-3 sm:p-4">
          {/* Food items: a table-like grid on wider screens; on phones each item wraps
              (food + quantity on one line, the optional values underneath) so nothing scrolls sideways. */}
          <div className="rounded-xl border border-line text-sm">
            <div className={cn("hidden gap-1.5 bg-surface-2 px-3 py-2 text-xs font-medium text-muted sm:grid", gridCols)}>
              <span>{ne.food}</span>
              <span>{ne.quantity}</span>
              {showMacros
                ? MACROS.map((k) => (
                    <span key={k} className="text-end">
                      {macroLabel[k]}
                    </span>
                  ))
                : null}
              <span />
            </div>
            <ul className="divide-y divide-line">
              {m.items.map((i) => (
                <li key={i.key} className={cn("grid items-center gap-1.5 px-2 py-2 sm:px-3 sm:py-1.5", rowCols, gridCols)}>
                  <input
                    value={i.name}
                    maxLength={120}
                    onChange={(e) => setItem(i.key, { name: e.target.value })}
                    placeholder={ne.foodPh}
                    aria-label={ne.food}
                    className="h-9 w-full min-w-0 rounded-lg border border-line bg-surface px-2.5 outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"
                  />
                  <input
                    value={i.quantity}
                    maxLength={60}
                    onChange={(e) => setItem(i.key, { quantity: e.target.value })}
                    placeholder={ne.quantityPh}
                    aria-label={ne.quantity}
                    className="h-9 w-full min-w-0 rounded-lg border border-line bg-surface px-2.5 outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"
                  />
                  {showMacros ? (
                    <div className="grid grid-cols-4 gap-1.5 max-sm:col-span-3 max-sm:row-start-2 sm:contents">
                      {MACROS.map((k) => (
                        <label key={k} className="min-w-0">
                          <span className="mb-0.5 block truncate text-[10px] text-muted sm:hidden">{macroLabel[k]}</span>
                          <input
                            type="number"
                            inputMode="decimal"
                            min={0}
                            step="0.1"
                            value={i[k]}
                            onChange={(e) => setItem(i.key, { [k]: parse(e.target.value) })}
                            aria-label={macroLabel[k]}
                            className={numCell}
                          />
                        </label>
                      ))}
                    </div>
                  ) : null}
                  <button
                    type="button"
                    onClick={() =>
                      onChange({
                        items: m.items.filter((x) => x.key !== i.key),
                      })
                    }
                    className="grid size-8 place-items-center justify-self-end rounded-lg text-muted hover:bg-crit-soft hover:text-crit-text max-sm:col-start-3 max-sm:row-start-1"
                    aria-label={ne.removeFood}
                  >
                    <X className="size-4" />
                  </button>
                </li>
              ))}
            </ul>
            <div className={cn("grid items-center gap-1.5 border-t border-line bg-surface-2/50 px-3 py-2 text-xs font-semibold", rowCols, gridCols)}>
              <button
                type="button"
                onClick={() => onChange({ items: [...m.items, newItem()] })}
                className="col-span-2 inline-flex items-center gap-1.5 justify-self-start font-medium text-ink-2 hover:text-ink"
              >
                <Plus className="size-3.5" /> {ne.addFood}
              </button>
              {showMacros ? (
                <div className="grid grid-cols-4 gap-1.5 max-sm:col-span-3 max-sm:row-start-2 sm:contents">
                  {MACROS.map((k) => (
                    <span key={k} className="min-w-0 text-end tabular max-sm:text-start">
                      <span className="block text-[10px] font-normal text-muted sm:hidden">{macroLabel[k]}</span>
                      {fmt.num(r(tot[k]))}
                    </span>
                  ))}
                </div>
              ) : null}
              <span />
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-start gap-x-2 gap-y-1">
            <button
              type="button"
              onClick={() => setShowMacros((v) => !v)}
              aria-pressed={showMacros}
              className={cn(
                "inline-flex h-8 items-center gap-1.5 rounded-lg px-2 text-[13px] font-medium transition [&_svg]:size-3.5",
                showMacros ? "bg-surface-2 text-ink" : "text-ink-2 hover:bg-surface-2 hover:text-ink",
              )}
            >
              <Flame /> {ne.macrosToggle}
            </button>
          </div>
          <Disclosure title={t.common.moreOptions} defaultOpen={!!(m.notes || m.referenceUrl)} className="mt-1">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={ne.notes} optional>
                <Textarea rows={2} value={m.notes} maxLength={2000} placeholder={ne.notesPh} onChange={(e) => onChange({ notes: e.target.value })} />
              </Field>
              <Field label={ne.reference} optional>
                <div className="relative" dir="ltr">
                  <Link2 className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
                  <Input
                    value={m.referenceUrl}
                    maxLength={500}
                    placeholder="https://…"
                    className="ps-9"
                    onChange={(e) => onChange({ referenceUrl: e.target.value })}
                  />
                </div>
              </Field>
            </div>
          </Disclosure>
        </div>
      )}
    </li>
  );
}
