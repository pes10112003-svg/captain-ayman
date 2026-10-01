import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import type { ProgressData } from "@/server/services/progress";
import { cn } from "@/lib/utils";
import { getI18n } from "@/i18n/server";

/** Starting / current / difference + body-fat, muscle mass and BMI tiles. */
export async function BodyComposition({ progress }: { progress: ProgressData }) {
  const { t, f, fmt } = await getI18n();
  const s = progress.summary;
  const u = progress.prefs.weightUnit;
  const delta = (a?: number | null, b?: number | null) => (a != null && b != null ? Math.round((a - b) * 10) / 10 : null);
  const signed = (n: number, unit: string) => `${n > 0 ? "+" : n < 0 ? "−" : ""}${fmt.measure(Math.abs(n), unit)}`;
  const bfDelta = delta(s.bodyFat?.value, s.bodyFatStart?.value);
  const mmDelta = delta(s.muscleMass?.value, s.muscleMassStart?.value);
  const tiles = [
    { id: "start", label: t.progress.startingWeight, value: fmt.weight(s.startingWeightKg, u) },
    { id: "current", label: t.progress.currentWeight, value: fmt.weight(s.currentWeightKg, u), strong: true },
    { id: "diff", label: t.progress.weightDifference, value: fmt.signedWeight(s.changeKg, u), trend: s.changeKg },
    {
      id: "bf",
      label: t.progress.bodyFat,
      value: s.bodyFat ? fmt.measure(s.bodyFat.value, "%") : "—",
      sub: bfDelta != null && bfDelta !== 0 ? f(t.progress.sinceStart, { v: signed(bfDelta, "%") }) : undefined,
      trend: bfDelta,
    },
    {
      id: "mm",
      label: t.progress.muscleMass,
      value: s.muscleMass ? fmt.measure(s.muscleMass.value, u) : "—",
      sub: mmDelta != null && mmDelta !== 0 ? f(t.progress.sinceStart, { v: signed(mmDelta, u) }) : undefined,
      trend: mmDelta,
      upIsGood: true,
    },
    { id: "bmi", label: t.progress.bmi, value: s.bmi != null ? fmt.num(s.bmi) : "—" },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
      {tiles.map((tile) => {
        const Icon = tile.trend == null || tile.trend === 0 ? Minus : tile.trend < 0 ? ArrowDownRight : ArrowUpRight;
        return (
          <div key={tile.id} className={cn("rounded-2xl border border-line bg-surface p-4 shadow-card", tile.strong && "border-ink/70")}>
            <p className="text-xs font-medium text-muted">{tile.label}</p>
            <p className="mt-1.5 flex items-center gap-1 text-xl font-semibold tabular tracking-tight">
              {tile.value}
              {tile.trend != null && tile.trend !== 0 ? <Icon className="rtl-flip size-4 text-muted" aria-hidden /> : null}
            </p>
            {tile.sub ? <p className="mt-0.5 text-[11px] text-muted">{tile.sub}</p> : null}
          </div>
        );
      })}
    </div>
  );
}
