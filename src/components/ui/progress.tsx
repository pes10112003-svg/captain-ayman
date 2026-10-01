import { cn } from "@/lib/utils";

export function ProgressBar({
  value,
  className,
  tone = "brand",
  size = "md",
  label,
}: {
  value: number | null | undefined;
  className?: string;
  tone?: "brand" | "ink" | "good" | "warn" | "series-1" | "series-2";
  size?: "sm" | "md" | "lg";
  label?: string;
}) {
  const v = Math.max(0, Math.min(100, value ?? 0));
  const fill = {
    brand: "bg-brand",
    ink: "bg-primary",
    good: "bg-good",
    warn: "bg-warn",
    "series-1": "bg-series-1",
    "series-2": "bg-series-2",
  }[tone];
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(v)}
      aria-label={label}
      className={cn("w-full overflow-hidden rounded-full bg-surface-3", { sm: "h-1.5", md: "h-2", lg: "h-3" }[size], className)}
    >
      <div
        className={cn("h-full origin-left animate-bar-grow rounded-full transition-[width] duration-500 ease-out rtl:origin-right", fill)}
        style={{ width: `${v}%` }}
      />
    </div>
  );
}

/** Circular progress ring with centred content. */
export function ProgressRing({
  value,
  size = 72,
  stroke = 7,
  children,
  className,
  tone = "brand",
  label,
}: {
  value: number | null | undefined;
  size?: number;
  stroke?: number;
  children?: React.ReactNode;
  className?: string;
  tone?: "brand" | "lime" | "series-1" | "series-2" | "good";
  label?: string;
}) {
  const v = Math.max(0, Math.min(100, value ?? 0));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const color = {
    brand: "var(--primary)",
    lime: "#C4F042",
    "series-1": "var(--series-1)",
    "series-2": "var(--series-2)",
    good: "var(--good)",
  }[tone];
  return (
    <div
      className={cn("relative inline-grid shrink-0 place-items-center", className)}
      style={{ width: size, height: size }}
      role="img"
      aria-label={label ?? `${Math.round(v)}%`}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={tone === "lime" ? "rgb(255 255 255 / 0.14)" : "var(--surface-3)"} strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c - (v / 100) * c}
          className="animate-ring-draw"
          style={{
            transition: "stroke-dashoffset 600ms ease-out",
            ["--ring-c" as string]: c,
          }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center">{children}</div>
    </div>
  );
}
