"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Dumbbell, Home, LineChart, UserRound, Utensils } from "lucide-react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/i18n/client";
import type { Dict } from "@/i18n/en";

type Perms = { viewWorkouts: boolean; viewNutrition: boolean; viewProgress: boolean };

function items(p: Perms, t: Dict) {
  return [
    { href: "/client", label: t.nav.home, icon: Home, exact: true, show: true },
    { href: "/client/workout", label: t.nav.workout, icon: Dumbbell, show: p.viewWorkouts },
    { href: "/client/nutrition", label: t.nav.nutrition, icon: Utensils, show: p.viewNutrition },
    { href: "/client/progress", label: t.nav.progress, icon: LineChart, show: p.viewProgress },
    { href: "/client/profile", label: t.nav.profile, icon: UserRound, show: true },
  ].filter((i) => i.show);
}

export function ClientBottomNav({ permissions }: { permissions: Perms }) {
  const pathname = usePathname();
  const { t } = useI18n();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/90 backdrop-blur-xl safe-bottom md:hidden" aria-label={t.nav.main}>
      <ul className="mx-auto flex max-w-lg justify-around px-2">
        {items(permissions, t).map(({ href, label, icon: Icon, exact }) => {
          const active = exact ? pathname === href : pathname.startsWith(href);
          return (
            <li key={href} className="flex-1">
              <Link href={href} aria-current={active ? "page" : undefined} className="flex flex-col items-center gap-1 pb-2 pt-2.5 text-[11px] font-medium">
                <span className={cn("grid h-8 w-14 place-items-center rounded-full transition", active ? "bg-brand text-brand-ink" : "text-muted")}>
                  <Icon className="size-5" aria-hidden />
                </span>
                <span className={active ? "text-ink" : "text-muted"}>{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function ClientTopNav({ permissions }: { permissions: Perms }) {
  const pathname = usePathname();
  const { t } = useI18n();
  return (
    <nav className="hidden md:block" aria-label={t.nav.main}>
      <ul className="flex gap-1">
        {items(permissions, t).map(({ href, label, icon: Icon, exact }) => {
          const active = exact ? pathname === href : pathname.startsWith(href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn("flex h-9 items-center gap-2 rounded-xl px-3 text-sm font-medium transition", active ? "bg-primary text-primary-fg" : "text-ink-2 hover:bg-surface-2")}
              >
                <Icon className="size-4" aria-hidden />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
