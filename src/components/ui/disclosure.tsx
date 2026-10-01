"use client";

import { useId, useState, type ReactNode } from "react";
import { ChevronDown, SlidersHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";

/** Collapsible "More options" area: keeps rarely used fields out of the way. */
export function Disclosure({
  title,
  defaultOpen = false,
  children,
  className,
  icon = <SlidersHorizontal />,
}: {
  title: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
  className?: string;
  icon?: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const id = useId();
  return (
    <div className={className}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={id}
        className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2 text-[13px] font-medium text-ink-2 transition hover:bg-surface-2 hover:text-ink [&_svg]:size-3.5"
      >
        {icon}
        {title}
        <ChevronDown className={cn("transition-transform duration-200", open && "rotate-180")} />
      </button>
      {open ? (
        <div id={id} className="mt-2 animate-fade-in">
          {children}
        </div>
      ) : null}
    </div>
  );
}
