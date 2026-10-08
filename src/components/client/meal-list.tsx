"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Check, Clock, Loader2, Undo2 } from "lucide-react";
import { setMealConsumedAction } from "@/server/actions/nutrition";
import { celebrate } from "@/lib/celebrate";
import { clockToMinutes } from "@/lib/time";
import { cn } from "@/lib/utils";
import { useI18n } from "@/i18n/client";

export type ClientMeal = {
  id: string;
  mealName: string;
  scheduledTime: string;
  notes: string | null;
  items: {
    name: string;
    quantity: string | null;
    calories: number | null;
    protein: number | null;
    carbs: number | null;
    fats: number | null;
  }[];
  totalCalories: number | null;
  totalProtein: number | null;
  totalCarbs: number | null;
  totalFats: number | null;
  status: "pending" | "completed";
  consumedAt: string | null;
};

export function MealList({
  meals: initial,
  canComplete,
  timezone,
  nowMinutes,
}: {
  meals: ClientMeal[];
  canComplete: boolean;
  timezone: string;
  nowMinutes: number;
}) {
  const router = useRouter();
  const { t, f, fmt } = useI18n();
  const [meals, setMeals] = useState(initial);
  // Per-meal "saving" flags: one slow save never blocks ticking another meal.
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const firstPending = meals.find((m) => m.status === "pending")?.id;

  const setConsumed = async (m: ClientMeal, consumed: boolean) => {
    if (!canComplete || busy[m.id]) return;
    setBusy((b) => ({ ...b, [m.id]: true }));
    // Optimistic: show as eaten immediately; the authoritative time comes back from the server.
    setMeals((all) =>
      all.map((x) =>
        x.id === m.id
          ? {
              ...x,
              status: consumed ? "completed" : "pending",
              consumedAt: consumed ? x.consumedAt : null,
            }
          : x,
      ),
    );
    if (consumed && "vibrate" in navigator) navigator.vibrate?.(12);
    let res: Awaited<ReturnType<typeof setMealConsumedAction>> | null = null;
    for (let attempt = 0; attempt < 3 && !res; attempt++) {
      try {
        res = await setMealConsumedAction(m.id, consumed);
      } catch {
        if (attempt < 2) await new Promise((r) => setTimeout(r, 700 * (attempt + 1)));
      }
    }
    setBusy((b) => ({ ...b, [m.id]: false }));
    if (!res) {
      setMeals((all) => all.map((x) => (x.id === m.id ? m : x)));
      toast.error(t.errors.offlineText);
      return;
    }
    if (!res.ok) {
      setMeals((all) => all.map((x) => (x.id === m.id ? m : x)));
      toast.error(res.error);
      if (res.code === "not_found") router.refresh();
      return;
    }
    setMeals((all) => all.map((x) => (x.id === m.id ? { ...x, status: res.data.status, consumedAt: res.data.consumedAt } : x)));
    if (consumed && res.data.consumedAt)
      toast.success(
        f(t.meals.logged, {
          meal: m.mealName,
          time: fmt.time(res.data.consumedAt, timezone),
        }),
      );
    if (consumed && meals.every((x) => x.id === m.id || x.status === "completed")) celebrate();
    router.refresh();
  };

  return (
    <ol className="space-y-3" aria-label={t.meals.list}>
      {meals.map((m) => {
        const eaten = m.status === "completed";
        const late = !eaten && clockToMinutes(m.scheduledTime) < nowMinutes;
        const isNext = m.id === firstPending;
        return (
          <li
            key={m.id}
            className={cn(
              "overflow-hidden rounded-3xl border bg-surface shadow-card transition",
              eaten ? "border-good/40" : isNext ? "border-ink/70" : "border-line",
            )}
          >
            <div className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.1em] text-muted">
                    <Clock className="size-3.5" /> {fmt.clock(m.scheduledTime)}
                    {isNext && !eaten ? <span className="rounded-full bg-brand px-2 py-0.5 text-[10px] text-brand-ink">{t.meals.next}</span> : null}
                    {late && !isNext ? <span className="text-warn-text">{t.meals.overdue}</span> : null}
                  </p>
                  <h3 className={cn("mt-1 text-lg font-semibold", eaten && "text-ink-2")}>{m.mealName}</h3>
                </div>
                {m.totalCalories != null ? (
                  <span className="shrink-0 rounded-full bg-surface-2 px-2.5 py-1 text-xs font-semibold tabular">
                    {fmt.num(Math.round(m.totalCalories), 0)} {t.units.kcal}
                  </span>
                ) : null}
              </div>
              <ul className="mt-3 space-y-1.5">
                {m.items.map((i, idx) => (
                  <li key={idx} className="flex items-baseline justify-between gap-3 text-sm">
                    <span className={cn(eaten && "text-muted")}>{i.name}</span>
                    {i.quantity ? <span className="shrink-0 text-xs text-muted">{i.quantity}</span> : null}
                  </li>
                ))}
              </ul>
              {m.totalProtein != null || m.totalCarbs != null || m.totalFats != null ? (
                <p className="mt-3 flex gap-3 text-xs text-muted tabular">
                  <span>
                    {f(t.meals.macroProtein, {
                      v: fmt.num(m.totalProtein ?? 0),
                    })}
                  </span>
                  <span>{f(t.meals.macroCarbs, { v: fmt.num(m.totalCarbs ?? 0) })}</span>
                  <span>{f(t.meals.macroFats, { v: fmt.num(m.totalFats ?? 0) })}</span>
                </p>
              ) : null}
              {m.notes ? (
                <p dir="auto" className="mt-3 rounded-xl bg-surface-2 px-3 py-2 text-start text-xs text-ink-2">
                  {m.notes}
                </p>
              ) : null}
            </div>
            {eaten ? (
              <div className="flex items-center justify-between gap-3 border-t border-good/30 bg-good-soft px-4 py-3">
                <span className="flex items-center gap-2 text-sm font-semibold text-good-text">
                  <span className="grid size-7 place-items-center rounded-full bg-good text-white">
                    <Check className="size-4 animate-pop" strokeWidth={3} />
                  </span>
                  {m.consumedAt
                    ? f(t.meals.eatenAt, {
                        time: fmt.time(m.consumedAt, timezone),
                      })
                    : t.meals.saving}
                </span>
                {canComplete ? (
                  <button
                    type="button"
                    onClick={() => setConsumed(m, false)}
                    disabled={!!busy[m.id]}
                    className="inline-flex items-center gap-1 text-xs font-medium text-good-text/80 hover:text-good-text"
                  >
                    {busy[m.id] ? <Loader2 className="size-3.5 animate-spin" /> : <Undo2 className="rtl-flip size-3.5" />} {t.meals.undo}
                  </button>
                ) : null}
              </div>
            ) : canComplete ? (
              <div className="border-t border-line p-3">
                <button
                  type="button"
                  onClick={() => setConsumed(m, true)}
                  disabled={!!busy[m.id]}
                  className={cn(
                    "flex h-12 w-full items-center justify-center gap-2 rounded-2xl text-[15px] font-semibold transition active:scale-[0.98] disabled:opacity-60",
                    isNext ? "bg-primary text-primary-fg" : "bg-surface-2 text-ink hover:bg-surface-3",
                  )}
                >
                  {busy[m.id] ? <Loader2 className="size-5 animate-spin" /> : <Check className="size-5" strokeWidth={3} />}
                  {t.meals.markEaten}
                </button>
              </div>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
