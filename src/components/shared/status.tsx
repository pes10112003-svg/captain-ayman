"use client";

import { CheckCircle2, CircleDashed, Clock3, Coffee, MinusCircle, PlayCircle, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useI18n } from "@/i18n/client";
import { goalLabel } from "@/i18n/labels";
import type { Goal } from "@/lib/constants";

type WorkoutStatus = "completed" | "in_progress" | "pending" | "rest" | "no_plan" | "missed" | "incomplete";

export function WorkoutStatusBadge({ status, pct }: { status: WorkoutStatus; pct?: number | null }) {
  const { t, fmt } = useI18n();
  const suffix = pct != null ? ` · ${fmt.pct(Math.round(pct))}` : "";
  switch (status) {
    case "completed":
      return (
        <Badge tone="good">
          <CheckCircle2 /> {t.status.completed}
          {suffix}
        </Badge>
      );
    case "in_progress":
      return (
        <Badge tone="info">
          <PlayCircle /> {t.status.inProgress}
          {suffix}
        </Badge>
      );
    case "pending":
      return (
        <Badge tone="neutral">
          <Clock3 /> {t.status.notStarted}
        </Badge>
      );
    case "rest":
      return (
        <Badge tone="outline">
          <Coffee /> {t.status.restDay}
        </Badge>
      );
    case "missed":
      return (
        <Badge tone="crit">
          <XCircle /> {t.status.missed}
        </Badge>
      );
    case "incomplete":
      return (
        <Badge tone="warn">
          <MinusCircle /> {t.status.incomplete}
          {suffix}
        </Badge>
      );
    default:
      return (
        <Badge tone="outline">
          <CircleDashed /> {t.status.noPlan}
        </Badge>
      );
  }
}

export function NutritionStatusBadge({ status, done, total }: { status: "done" | "partial" | "not_started" | "no_plan"; done: number; total: number }) {
  const { t, f, fmt } = useI18n();
  if (status === "no_plan")
    return (
      <Badge tone="outline">
        <CircleDashed /> {t.status.noPlan}
      </Badge>
    );
  const tone = status === "done" ? "good" : status === "partial" ? "info" : "neutral";
  return (
    <Badge tone={tone}>
      <span className="tabular">{f(t.status.meals, { done: fmt.num(done, 0), total: fmt.num(total, 0) })}</span>
    </Badge>
  );
}

export function ClientStatusBadge({ status }: { status: "active" | "inactive" }) {
  const { t } = useI18n();
  return status === "active" ? (
    <Badge tone="good" dot>
      {t.status.active}
    </Badge>
  ) : (
    <Badge tone="neutral" dot>
      {t.status.inactive}
    </Badge>
  );
}

export function GoalLabel({ goal }: { goal: Goal }) {
  const { t } = useI18n();
  return <span>{goalLabel(t, goal)}</span>;
}
