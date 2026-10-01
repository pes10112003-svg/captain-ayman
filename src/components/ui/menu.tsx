"use client";

import * as DM from "@radix-ui/react-dropdown-menu";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export const Menu = DM.Root;
export const MenuTrigger = DM.Trigger;

export function MenuContent({ children, align = "end", className }: { children: ReactNode; align?: "start" | "end" | "center"; className?: string }) {
  return (
    <DM.Portal>
      <DM.Content
        align={align}
        sideOffset={6}
        className={cn(
          "z-50 min-w-48 overflow-hidden rounded-xl border border-line bg-surface p-1 shadow-pop data-[state=open]:animate-fade-in",
          className,
        )}
      >
        {children}
      </DM.Content>
    </DM.Portal>
  );
}

export function MenuItem({
  children,
  onSelect,
  danger,
  disabled,
  asChild,
}: {
  children: ReactNode;
  onSelect?: (e: Event) => void;
  danger?: boolean;
  disabled?: boolean;
  asChild?: boolean;
}) {
  return (
    <DM.Item
      asChild={asChild}
      disabled={disabled}
      onSelect={onSelect}
      className={cn(
        "flex cursor-pointer select-none items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm outline-none transition data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:size-4",
        danger ? "text-crit-text data-[highlighted]:bg-crit-soft" : "text-ink-2 data-[highlighted]:bg-surface-2 data-[highlighted]:text-ink",
      )}
    >
      {children}
    </DM.Item>
  );
}

export function MenuLabel({ children }: { children: ReactNode }) {
  return <DM.Label className="px-2.5 pb-1 pt-2 text-xs font-medium text-muted">{children}</DM.Label>;
}

export function MenuSeparator() {
  return <DM.Separator className="my-1 h-px bg-line" />;
}
