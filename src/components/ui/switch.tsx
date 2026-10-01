"use client";

import { cn } from "@/lib/utils";

export function Switch({
  checked,
  onCheckedChange,
  disabled,
  id,
  label,
  size = "md",
}: {
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
  disabled?: boolean;
  id?: string;
  label?: string;
  size?: "sm" | "md";
}) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        "relative inline-flex shrink-0 items-center rounded-full border border-transparent transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-50",
        size === "md" ? "h-6 w-11" : "h-5 w-9",
        checked ? "bg-primary" : "bg-surface-3",
      )}
    >
      <span
        className={cn(
          "pointer-events-none inline-block rounded-full bg-white shadow-sm ring-0 transition-transform duration-200",
          size === "md" ? "size-5" : "size-4",
          checked
            ? size === "md"
              ? "translate-x-[21px] rtl:-translate-x-[21px]"
              : "translate-x-[17px] rtl:-translate-x-[17px]"
            : "translate-x-0.5 rtl:-translate-x-0.5",
          checked && "bg-primary-fg",
        )}
      />
    </button>
  );
}
