"use client";

/**
 * Charts load after the page is usable: the charting library is big, and parsing it while a page
 * opens made phones stutter. Each placeholder keeps the chart's height so nothing jumps.
 */

import dynamic from "next/dynamic";
import type { ComponentProps } from "react";
import type * as C from "./charts";

const box = (height: number) =>
  function ChartPlaceholder() {
    return <div className="w-full animate-pulse rounded-xl bg-surface-2" style={{ height }} aria-hidden />;
  };

export const TrendChart = dynamic<ComponentProps<typeof C.TrendChart>>(() => import("./charts").then((m) => m.TrendChart), { ssr: false, loading: box(200) });
export const PercentLinesChart = dynamic<ComponentProps<typeof C.PercentLinesChart>>(() => import("./charts").then((m) => m.PercentLinesChart), {
  ssr: false,
  loading: box(200),
});
export const DailyBars = dynamic<ComponentProps<typeof C.DailyBars>>(() => import("./charts").then((m) => m.DailyBars), { ssr: false, loading: box(180) });
