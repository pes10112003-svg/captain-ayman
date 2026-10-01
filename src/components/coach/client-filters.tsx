"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Loader2, Search, X } from "lucide-react";
import { GOAL_KEYS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { useI18n } from "@/i18n/client";
import type { Dict } from "@/i18n/en";
import { goalLabel } from "@/i18n/labels";

const FILTER_KEYS = ["status", "workout", "nutrition", "goal", "activity"] as const;

function buildSelects(t: Dict): { key: (typeof FILTER_KEYS)[number]; label: string; options: [string, string][] }[] {
  const c = t.clients;
  return [
    {
      key: "status",
      label: c.fStatus,
      options: [
        ["all", c.fAllStatuses],
        ["active", t.status.active],
        ["inactive", t.status.inactive],
      ],
    },
    {
      key: "workout",
      label: c.fWorkout,
      options: [
        ["all", c.fAnyWorkout],
        ["completed", c.wCompleted],
        ["in_progress", c.wInProgress],
        ["pending", c.wPending],
        ["rest", c.wRest],
        ["no_plan", c.wNoPlan],
      ],
    },
    {
      key: "nutrition",
      label: c.fNutrition,
      options: [
        ["all", c.fAnyNutrition],
        ["done", c.nDone],
        ["partial", c.nPartial],
        ["not_started", c.nNotStarted],
        ["no_plan", c.nNoPlan],
      ],
    },
    { key: "goal", label: c.fGoal, options: [["all", c.fAllGoals], ...GOAL_KEYS.map((g): [string, string] => [g, goalLabel(t, g)])] },
    {
      key: "activity",
      label: c.fActivity,
      options: [
        ["all", c.fAnyActivity],
        ["24h", c.f24h],
        ["7d", c.f7d],
        ["stale", c.fStale],
        ["never", c.fNever],
      ],
    },
  ];
}

export function ClientFilters() {
  const { t } = useI18n();
  const selects = buildSelects(t);
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, start] = useTransition();
  const [q, setQ] = useState(params.get("q") ?? "");

  const update = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (!v || v === "all") next.delete(k);
      else next.set(k, v);
    }
    next.delete("page");
    start(() => router.replace(`${pathname}?${next.toString()}`, { scroll: false }));
  };

  useEffect(() => {
    const current = params.get("q") ?? "";
    if (q === current) return;
    const timer = setTimeout(() => update({ q: q.trim() || null }), 250);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const active = FILTER_KEYS.filter((k) => (params.get(k) ?? "all") !== "all").length + (params.get("q") ? 1 : 0);

  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
      <div className="relative lg:w-72">
        {pending ? (
          <Loader2 className="absolute start-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted" />
        ) : (
          <Search className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
        )}
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t.clients.searchPlaceholder}
          aria-label={t.clients.search}
          className="h-10 w-full rounded-xl border border-line bg-surface pe-3 ps-9 text-sm shadow-card outline-none focus:border-ring focus:ring-4 focus:ring-ring/15"
        />
      </div>
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 scrollbar-none lg:mx-0 lg:flex-wrap lg:overflow-visible lg:px-0 lg:pb-0">
        {selects.map((s) => {
          const value = params.get(s.key) ?? "all";
          return (
            <select
              key={s.key}
              aria-label={s.label}
              value={value}
              onChange={(e) => update({ [s.key]: e.target.value })}
              className={cn(
                "h-9 shrink-0 cursor-pointer appearance-none rounded-full border px-3.5 text-[13px] font-medium outline-none transition focus:ring-4 focus:ring-ring/15",
                value !== "all" ? "border-primary bg-primary text-primary-fg" : "border-line bg-surface text-ink-2 hover:border-line-strong",
              )}
            >
              {s.options.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          );
        })}
        {active ? (
          <button
            type="button"
            onClick={() => {
              setQ("");
              start(() => router.replace(pathname, { scroll: false }));
            }}
            className="inline-flex h-9 shrink-0 items-center gap-1 rounded-full px-3 text-[13px] font-medium text-muted hover:bg-surface-2 hover:text-ink"
          >
            <X className="size-3.5" /> {t.clients.clear}
          </button>
        ) : null}
      </div>
    </div>
  );
}
