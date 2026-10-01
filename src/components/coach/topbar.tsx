"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import * as RD from "@radix-ui/react-dialog";
import { Bell, LogOut, Menu as MenuIcon, Plus, Settings, X } from "lucide-react";
import { logoutAction } from "@/server/actions/auth";
import { markNotificationsReadAction } from "@/server/actions/settings";
import { LinkButton } from "@/components/ui/button";
import { Menu, MenuContent, MenuItem, MenuLabel, MenuSeparator, MenuTrigger } from "@/components/ui/menu";
import { Logo } from "@/components/shared/logo";
import { LanguageIconButton, ThemeIconButton } from "@/components/shared/preferences";
import { cn, initials } from "@/lib/utils";
import { useI18n } from "@/i18n/client";
import type { Dict } from "@/i18n/en";
import { interpolate } from "@/i18n/format";
import { CoachNavLinks } from "./nav";
import { GlobalSearch } from "./global-search";

export type CoachNotification = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  data: Record<string, unknown> | null;
  createdAt: string;
  readAt: string | null;
  clientId?: string | null;
};

/** Notifications are rendered from their type + data so they follow the viewer's language. */
export function notificationText(n: CoachNotification, t: Dict): { title: string; body: string | null } {
  const d = n.data ?? {};
  const s = (v: unknown) => (typeof v === "string" || typeof v === "number" ? String(v) : "");
  if (n.type === "workout.completed" && d.clientName)
    return {
      title: interpolate(t.notifications.workoutCompleted, { name: s(d.clientName), workout: s(d.workout) }),
      body: d.pct != null ? interpolate(t.notifications.completion, { pct: s(d.pct) }) : n.body,
    };
  if (n.type === "photo.uploaded_by_client" && d.clientName) return { title: interpolate(t.notifications.photoUploaded, { name: s(d.clientName) }), body: null };
  if (n.type === "plan.updated" && d.plan)
    return { title: d.plan === "workout" ? t.notifications.workoutPlanUpdated : t.notifications.nutritionPlanUpdated, body: null };
  return { title: n.title, body: n.body };
}

export function CoachTopbar({ name, email, brand, notifications, unread }: { name: string; email: string; brand?: string | null; notifications: CoachNotification[]; unread: number }) {
  const { t, f, fmt } = useI18n();
  const [menuOpen, setMenuOpen] = useState(false);
  const [pending, start] = useTransition();
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-page/85 backdrop-blur-xl">
      <div className="flex h-16 items-center gap-2 px-4 sm:gap-3 sm:px-6 lg:px-8">
        <RD.Root open={menuOpen} onOpenChange={setMenuOpen}>
          <RD.Trigger className="grid size-10 shrink-0 place-items-center rounded-xl text-ink-2 hover:bg-surface-2 lg:hidden" aria-label={t.nav.open}>
            <MenuIcon className="size-5" />
          </RD.Trigger>
          <RD.Portal>
            <RD.Overlay className="fixed inset-0 z-50 bg-black/50 data-[state=open]:animate-fade-in lg:hidden" />
            <RD.Content className="fixed inset-y-0 start-0 z-50 flex w-72 flex-col bg-sidebar p-4 text-sidebar-fg shadow-modal data-[state=open]:animate-fade-in lg:hidden">
              <RD.Title className="sr-only">{t.nav.main}</RD.Title>
              <RD.Description className="sr-only">{t.nav.main}</RD.Description>
              <div className="mb-6 flex items-center justify-between px-1 pt-1">
                <Logo invert subtitle={brand ?? t.brand.tagline} />
                <RD.Close className="grid size-9 place-items-center rounded-lg text-sidebar-muted hover:bg-sidebar-hover hover:text-white" aria-label={t.nav.close}>
                  <X className="size-5" />
                </RD.Close>
              </div>
              <CoachNavLinks onNavigate={() => setMenuOpen(false)} />
              <div className="mt-4 flex items-center gap-1 border-t border-sidebar-border pt-3">
                <LanguageIconButton tone="sidebar" />
                <ThemeIconButton tone="sidebar" />
              </div>
            </RD.Content>
          </RD.Portal>
        </RD.Root>

        <GlobalSearch className="min-w-0 flex-1 lg:max-w-md" />
        <div className="ms-auto flex shrink-0 items-center gap-1 sm:gap-1.5">
          <LinkButton href="/coach/clients/new" size="sm" className="hidden sm:inline-flex">
            <Plus /> {t.clients.addClient}
          </LinkButton>
          <LanguageIconButton className="hidden sm:grid" />
          <ThemeIconButton className="hidden sm:grid" />

          <Menu
            onOpenChange={(o) => {
              if (!o && unread > 0) start(() => void markNotificationsReadAction());
            }}
          >
            <MenuTrigger
              className="relative grid size-10 place-items-center rounded-xl text-ink-2 hover:bg-surface-2"
              aria-label={unread ? `${t.notifications.label} (${f(t.notifications.unread, { n: fmt.num(unread, 0) })})` : t.notifications.label}
            >
              <Bell className="size-[18px]" />
              {unread > 0 && !pending ? (
                <span className="absolute end-2 top-2 grid min-w-4 place-items-center rounded-full bg-crit px-1 text-[10px] font-semibold leading-4 text-white">
                  {unread > 9 ? "9+" : unread}
                </span>
              ) : null}
            </MenuTrigger>
            <MenuContent className="w-80 p-0">
              <div className="border-b border-line px-4 py-3">
                <p className="text-sm font-semibold">{t.notifications.title}</p>
              </div>
              {notifications.length ? (
                <ul className="max-h-96 overflow-y-auto p-1.5">
                  {notifications.map((n) => {
                    const text = notificationText(n, t);
                    return (
                      <li key={n.id}>
                        <MenuItem asChild>
                          <Link href={n.clientId ? `/coach/clients/${n.clientId}` : "/coach"} className="items-start">
                            <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", n.readAt ? "bg-transparent" : "bg-info")} aria-hidden />
                            <span className="min-w-0">
                              <span className="block text-sm text-ink">{text.title}</span>
                              <span className="block text-xs text-muted">
                                {text.body ? `${text.body} · ` : ""}
                                {fmt.timeAgo(n.createdAt)}
                              </span>
                            </span>
                          </Link>
                        </MenuItem>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="px-4 py-8 text-center text-sm text-muted">{t.notifications.empty}</p>
              )}
            </MenuContent>
          </Menu>

          <Menu>
            <MenuTrigger
              className="ms-1 grid size-9 place-items-center rounded-full bg-primary text-xs font-semibold text-primary-fg ring-2 ring-surface hover:opacity-90"
              aria-label={t.nav.account}
            >
              {initials(name)}
            </MenuTrigger>
            <MenuContent>
              <MenuLabel>
                <span className="block text-sm font-semibold text-ink">{name}</span>
                <span className="block font-normal" dir="ltr">
                  {email}
                </span>
              </MenuLabel>
              <MenuSeparator />
              <MenuItem asChild>
                <Link href="/coach/settings">
                  <Settings /> {t.common.settings}
                </Link>
              </MenuItem>
              <MenuItem asChild>
                <Link href="/coach/clients/new" className="sm:hidden">
                  <Plus /> {t.clients.addClient}
                </Link>
              </MenuItem>
              <MenuSeparator />
              <MenuItem onSelect={() => void logoutAction()}>
                <LogOut className="rtl-flip" /> {t.common.signOut}
              </MenuItem>
            </MenuContent>
          </Menu>
        </div>
      </div>
    </header>
  );
}
