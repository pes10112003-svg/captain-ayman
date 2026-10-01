"use client";

import { useLayoutEffect, useRef } from "react";

const NUM = /-?\d[\d,]*(?:\.\d+)?/;

/**
 * Counts the first number in a formatted value up from zero ("82.5 kg", "75%", "12").
 * Server HTML and the final frame are always the exact original text; only the digits animate.
 */
export function CountUp({ text, duration = 900 }: { text: string; duration?: number }) {
  const ref = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    const m = NUM.exec(text);
    if (!el || !m || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const raw = m[0];
    const target = Number(raw.replace(/,/g, ""));
    if (!Number.isFinite(target) || target === 0) return;
    const decimals = raw.includes(".") ? raw.split(".")[1]!.length : 0;
    const grouped = raw.includes(",");
    const before = text.slice(0, m.index);
    const after = text.slice(m.index + raw.length);
    const format = (v: number) =>
      before +
      v.toLocaleString("en-US", {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
        useGrouping: grouped,
      }) +
      after;

    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      el.textContent = p < 1 ? format(target * eased) : text;
      if (p < 1) frame = requestAnimationFrame(tick);
    };
    el.textContent = format(0);
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      el.textContent = text;
    };
  }, [text, duration]);

  return (
    <span ref={ref} className="tabular">
      {text}
    </span>
  );
}
