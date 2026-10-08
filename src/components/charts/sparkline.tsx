/**
 * Tiny trend line for cards, drawn as plain SVG — no charting library, so it costs nothing to
 * load (the client home page used to pull the whole chart library just for this).
 */
export function Sparkline({ data, color = "series-3", height = 40 }: { data: number[]; color?: "series-1" | "series-2" | "series-3"; height?: number }) {
  if (data.length < 2) return null;
  const W = 100;
  const pad = 3;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = max - min || 1;
  const x = (i: number) => (i / (data.length - 1)) * W;
  const y = (v: number) => pad + (1 - (v - min) / span) * (height - pad * 2);
  const d = data.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(2)} ${y(v).toFixed(2)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${height}`} preserveAspectRatio="none" className="block w-full" style={{ height }} aria-hidden>
      <path d={d} fill="none" stroke={`var(--${color})`} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
