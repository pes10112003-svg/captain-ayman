"use client";

import { useState } from "react";
import { TrendChart } from "@/components/charts/charts";
import { Select } from "@/components/ui/input";
import { useI18n } from "@/i18n/client";
import { measureTypeLabel } from "@/i18n/labels";

type T = { id: string; name: string; kind: string; unit: string; key?: string | null; isSystem?: boolean | null };

/** Pick any measurement type and see its trend over time. */
export function MeasurementTrend({ types, series, weightUnit, lengthUnit }: { types: T[]; series: Record<string, { date: string; value: number }[]>; weightUnit: string; lengthUnit: string }) {
  const { t, fmt, locale } = useI18n();
  const withData = types.filter((ty) => (series[ty.id]?.length ?? 0) >= 2);
  const [selected, setSelected] = useState(withData[0]?.id ?? "");
  const type = withData.find((ty) => ty.id === selected);
  if (!withData.length) return <p className="py-8 text-center text-sm text-muted">{t.progress.trendHint}</p>;
  const unit = type ? (type.kind === "mass" ? weightUnit : type.kind === "length" ? lengthUnit : type.unit) : "";
  const data = series[selected] ?? [];
  const first = data[0]?.value;
  const last = data[data.length - 1]?.value;
  const diff = first != null && last != null ? Math.round((last - first) * 10) / 10 : null;
  const label = (ty: T) => measureTypeLabel(t, ty);
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="w-52">
          <Select value={selected} onChange={(e) => setSelected(e.target.value)} aria-label={t.progress.measurement}>
            {withData.map((ty) => (
              <option key={ty.id} value={ty.id}>
                {label(ty)}
              </option>
            ))}
          </Select>
        </div>
        {diff != null && first != null && last != null ? (
          <p className="text-sm text-muted">
            <span className="tabular">{fmt.measure(first, unit)}</span> {locale === "ar" ? "←" : "→"}{" "}
            <span className="font-semibold text-ink tabular">{fmt.measure(last, unit)}</span>{" "}
            <span className="tabular">
              ({diff > 0 ? "+" : ""}
              {fmt.measure(diff, unit)})
            </span>
          </p>
        ) : null}
      </div>
      {type ? <TrendChart data={data} unit={fmt.unit(unit)} name={label(type)} color="series-1" /> : null}
    </div>
  );
}
