"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, Dumbbell, History, LayoutDashboard, LineChart, Settings, Users, Utensils } from "lucide-react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/i18n/client";
import type { Dict } from "@/i18n/en";

type NavKey = keyof Dict["nav"];
type NavItem = { href: string; key: NavKey; icon: typeof Users; exact?: boolean };

export const COACH_NAV: NavItem[] = [
  { href: "/coach", key: "dashboard", icon: LayoutDashboard, exact: true },
  { href: "/coach/clients", key: "clients", icon: Users },
  { href: "/coach/workouts", key: "workouts", icon: Dumbbell },
  { href: "/coach/nutrition", key: "nutrition", icon: Utensils },
  { href: "/coach/progress", key: "progress", icon: LineChart },
  { href: "/coach/reports", key: "reports", icon: BarChart3 },
];
export const COACH_NAV_SECONDARY: NavItem[] = [
  { href: "/coach/activity", key: "activity", icon: History },
  { href: "/coach/settings", key: "settings", icon: Settings },
];

export function CoachNavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { t } = useI18n();
  const render = (items: NavItem[]) =>
    items.map(({ href, key, icon: Icon, exact }) => {
      const active = exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
      return (
        <li key={href}>
          <Link
            href={href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "group relative flex h-10 items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors",
              active ? "bg-white/[0.07] text-white" : "text-sidebar-muted hover:bg-sidebar-hover hover:text-sidebar-fg",
            )}
          >
            <span className={cn("absolute start-0 top-2.5 h-5 w-[3px] rounded-e-full transition", active ? "bg-brand" : "bg-transparent")} />
            <Icon className={cn("size-[18px]", active ? "text-brand" : "text-sidebar-muted group-hover:text-sidebar-fg")} aria-hidden />
            {t.nav[key]}
          </Link>
        </li>
      );
    });
  return (
    <nav aria-label={t.nav.main} className="flex flex-1 flex-col">
      <ul className="space-y-0.5">{render(COACH_NAV)}</ul>
      <p className="mb-2 mt-7 px-3 text-[11px] font-medium uppercase tracking-[0.08em] text-sidebar-muted/70">{t.nav.workspace}</p>
      <ul className="space-y-0.5">{render(COACH_NAV_SECONDARY)}</ul>
    </nav>
  );
}
