"use client";

import { useId } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { cn } from "@/lib/utils";
import { useI18n } from "@/i18n/client";

export type SeriesColor = "series-1" | "series-2" | "series-3";
const colorVar = (c: SeriesColor) => `var(--${c})`;

type TooltipRow = { name: string; value: string; color: string };

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Chart formatting helpers. Charts always render left→right (dir="ltr"), so Arabic text drawn inside the
 * SVG is wrapped in a right-to-left embedding to keep its word order ("30 سبتمبر", "الهدف 75 كجم").
 */
function useChartFormat() {
  const { t, f, fmt, dir, locale } = useI18n();
  const svgText = (s: string) => (locale === "ar" ? `\u202B${s}\u202C` : s);
  /** ISO calendar days ("2026-09-30") are formatted for the viewer; anything else is shown as given. */
  const day = (v: unknown) => {
    const s = v == null ? "" : String(v);
    return ISO_DAY.test(s) ? fmt.dateShort(s) : s;
  };
  return { t, f, fmt, dir, svgText, day };
}

function TooltipCard({ title, rows, dir }: { title: string; rows: TooltipRow[]; dir: "ltr" | "rtl" }) {
  return (
    <div dir={dir} className="min-w-36 rounded-xl border border-line bg-surface px-3 py-2.5 shadow-pop">
      <p className="mb-1.5 text-[11px] font-medium text-muted">{title}</p>
      <div className="space-y-1">
        {rows.map((r) => (
          <div key={r.name} className="flex items-center gap-2">
            <span className="h-0.5 w-3 rounded-full" style={{ background: r.color }} aria-hidden />
            <span className="text-sm font-semibold tabular text-ink">{r.value}</span>
            <span className="text-xs text-muted">{r.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const axisProps = {
  tickLine: false,
  axisLine: false,
  tick: { fontSize: 11, fill: "var(--muted)" },
} as const;

/** Single-series trend over time (weight, body fat, any measurement). */
export function TrendChart({
  data,
  unit,
  color = "series-1",
  height = 220,
  name,
  goal,
  goalLabel,
  className,
}: {
  data: { date: string; value: number }[];
  /** Display unit ("kg", "lb", "cm", "%", …) — translated for the viewer. */
  unit: string;
  color?: SeriesColor;
  height?: number;
  name: string;
  goal?: number | null;
  /** Defaults to the translated "Goal". */
  goalLabel?: string;
  className?: string;
}) {
  const { t, fmt, dir, svgText, day } = useChartFormat();
  const values = data.map((d) => d.value).concat(goal != null ? [goal] : []);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const pad = Math.max((max - min) * 0.15, max * 0.01, 0.5);
  const gradientId = `grad-${color}-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  return (
    <div dir="ltr" className={cn("w-full", className)} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={colorVar(color)} stopOpacity={0.18} />
              <stop offset="100%" stopColor={colorVar(color)} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} strokeDasharray="0" />
          <XAxis dataKey="date" {...axisProps} tickFormatter={(d: string) => svgText(day(d))} minTickGap={24} />
          <YAxis
            {...axisProps}
            width={44}
            domain={[Math.floor((min - pad) * 10) / 10, Math.ceil((max + pad) * 10) / 10]}
            tickCount={5}
            tickFormatter={(v: number) => (max - min < 6 ? fmt.num(v, 1) : fmt.num(Math.round(v), 0))}
          />
          {goal != null ? (
            <ReferenceLine
              y={goal}
              stroke="var(--muted)"
              strokeDasharray="4 4"
              label={{
                value: svgText(`${goalLabel ?? t.progress.goal} ${fmt.measure(goal, unit)}`),
                position: "insideTopRight",
                fill: "var(--muted)",
                fontSize: 11,
              }}
            />
          ) : null}
          <Tooltip
            cursor={{ stroke: "var(--axis)", strokeWidth: 1 }}
            content={({ active, payload, label }) =>
              active && payload?.length ? (
                <TooltipCard
                  dir={dir}
                  title={ISO_DAY.test(String(label)) ? fmt.date(String(label)) : String(label)}
                  rows={[{ name, value: fmt.measure(Number(payload[0]!.value), unit), color: colorVar(color) }]}
                />
              ) : null
            }
          />
          <Area
            type="monotone"
            dataKey="value"
            name={name}
            stroke={colorVar(color)}
            strokeWidth={2}
            fill={`url(#${gradientId})`}
            dot={data.length <= 24 ? { r: 3.5, strokeWidth: 2, stroke: "var(--surface)", fill: colorVar(color) } : false}
            activeDot={{ r: 5, strokeWidth: 2, stroke: "var(--surface)", fill: colorVar(color) }}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Percentage lines over time (weekly adherence). Always 0–100 on one axis. */
export function PercentLinesChart({
  data,
  series,
  xKey = "label",
  height = 240,
  className,
}: {
  data: Record<string, string | number | null>[];
  series: { key: string; name: string; color: SeriesColor }[];
  /** Field holding the week's ISO start date (formatted for the viewer). */
  xKey?: string;
  height?: number;
  className?: string;
}) {
  const { t, f, fmt, dir, svgText, day } = useChartFormat();
  return (
    <div className={cn("w-full", className)}>
      {series.length > 1 ? (
        <div className="mb-3 flex flex-wrap gap-4">
          {series.map((s) => (
            <span key={s.key} className="inline-flex items-center gap-2 text-xs text-ink-2">
              <span className="h-0.5 w-4 rounded-full" style={{ background: colorVar(s.color) }} aria-hidden />
              {s.name}
            </span>
          ))}
        </div>
      ) : null}
      <div dir="ltr" style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey={xKey} {...axisProps} minTickGap={16} tickFormatter={(v: string) => svgText(day(v))} />
            <YAxis {...axisProps} width={44} domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} tickFormatter={(v: number) => fmt.pct(v)} />
            <Tooltip
              cursor={{ stroke: "var(--axis)", strokeWidth: 1 }}
              content={({ active, payload, label }) =>
                active && payload?.length ? (
                  <TooltipCard
                    dir={dir}
                    title={f(t.charts.weekOf, { label: day(label) })}
                    rows={series.map((s) => {
                      const p = payload.find((x) => x.dataKey === s.key);
                      return { name: s.name, value: p?.value == null ? "—" : fmt.pct(Math.round(Number(p.value))), color: colorVar(s.color) };
                    })}
                  />
                ) : null
              }
            />
            {series.map((s) => (
              <Line
                key={s.key}
                type="monotone"
                dataKey={s.key}
                name={s.name}
                stroke={colorVar(s.color)}
                strokeWidth={2}
                connectNulls
                dot={{ r: 3.5, strokeWidth: 2, stroke: "var(--surface)", fill: colorVar(s.color) }}
                activeDot={{ r: 5, strokeWidth: 2, stroke: "var(--surface)" }}
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/** Daily count bars (e.g. workouts completed per day). */
export function DailyBars({
  data,
  valueKey,
  xKey = "date",
  name,
  color = "series-1",
  height = 200,
  percent,
}: {
  data: Record<string, string | number | null>[];
  valueKey: string;
  /** Field holding the day's ISO date (formatted for the viewer). */
  xKey?: string;
  name: string;
  color?: SeriesColor;
  height?: number;
  /** Values are percentages (0–100): fixes the axis and formats labels with "%". */
  percent?: boolean;
}) {
  const { fmt, dir, svgText, day } = useChartFormat();
  const formatValue = (v: number) => (percent ? fmt.pct(Math.round(v)) : fmt.num(v, 0));
  return (
    <div dir="ltr" style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: percent ? -4 : -16 }} barCategoryGap="28%">
          <CartesianGrid vertical={false} />
          <XAxis dataKey={xKey} {...axisProps} minTickGap={8} interval="preserveStartEnd" tickFormatter={(v: string) => svgText(day(v))} />
          <YAxis
            {...axisProps}
            width={44}
            allowDecimals={false}
            domain={percent ? [0, 100] : [0, "auto"]}
            tickFormatter={(v: number) => (percent ? fmt.pct(v) : fmt.num(v, 0))}
          />
          <Tooltip
            cursor={{ fill: "var(--surface-2)" }}
            content={({ active, payload, label }) =>
              active && payload?.length ? (
                <TooltipCard
                  dir={dir}
                  title={day(label)}
                  rows={[{ name, value: payload[0]!.value == null ? "—" : formatValue(Number(payload[0]!.value)), color: colorVar(color) }]}
                />
              ) : null
            }
          />
          <Bar dataKey={valueKey} name={name} fill={colorVar(color)} radius={[4, 4, 0, 0]} maxBarSize={28} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Tiny inline sparkline for cards. */
export function Sparkline({ data, color = "series-3", height = 40 }: { data: number[]; color?: SeriesColor; height?: number }) {
  if (data.length < 2) return null;
  const rows = data.map((v, i) => ({ i, v }));
  return (
    <div dir="ltr" style={{ height }} className="w-full" aria-hidden>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={rows} margin={{ top: 4, right: 2, bottom: 4, left: 2 }}>
          <YAxis hide domain={["dataMin", "dataMax"]} />
          <Line type="monotone" dataKey="v" stroke={colorVar(color)} strokeWidth={2} dot={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
