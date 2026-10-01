"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/i18n/client";

export type TabItem = { href: string; label: string; icon?: ReactNode; exact?: boolean };

/** Route-based tabs — each tab is a real URL (deep-linkable, back-button friendly). */
export function LinkTabs({ items, className }: { items: TabItem[]; className?: string }) {
  const pathname = usePathname();
  const { t } = useI18n();
  return (
    <nav className={cn("-mx-4 overflow-x-auto px-4 scrollbar-none sm:mx-0 sm:px-0", className)} aria-label={t.nav.sections}>
      <ul className="flex min-w-max gap-1 border-b border-line">
        {items.map((item) => {
          const active = item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex h-11 items-center gap-2 px-3 text-sm font-medium transition-colors [&_svg]:size-4",
                  active ? "text-ink" : "text-muted hover:text-ink",
                )}
              >
                {item.icon}
                {item.label}
                <span className={cn("absolute inset-x-2 -bottom-px h-0.5 rounded-full transition", active ? "bg-ink" : "bg-transparent")} />
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Segmented control (pill style) for switching sub-views. */
export function Segmented({ items, className }: { items: TabItem[]; className?: string }) {
  const pathname = usePathname();
  return (
    <div className={cn("inline-flex rounded-xl border border-line bg-surface-2 p-1", className)}>
      {items.map((item) => {
        const active = item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex h-8 items-center gap-1.5 rounded-lg px-3 text-[13px] font-medium transition [&_svg]:size-3.5",
              active ? "bg-surface text-ink shadow-card" : "text-muted hover:text-ink",
            )}
          >
            {item.icon}
            {item.label}
          </Link>
        );
      })}
    </div>
  );
}
