import Link from "next/link";
import { requireCoachPage } from "@/server/auth/guards";
import { listNotifications } from "@/server/services/notifications";
import { getCoachPrefs } from "@/server/services/settings";
import { CoachNavLinks } from "@/components/coach/nav";
import { CoachTopbar } from "@/components/coach/topbar";
import { Logo } from "@/components/shared/logo";
import { LanguageIconButton, ThemeIconButton } from "@/components/shared/preferences";
import { getI18n } from "@/i18n/server";
import { initials } from "@/lib/utils";

export default async function CoachLayout({ children }: { children: React.ReactNode }) {
  const actor = await requireCoachPage();
  const [{ rows, unread }, prefs, { t }] = await Promise.all([listNotifications(actor, 12), getCoachPrefs(actor.userId), getI18n()]);
  return (
    <div className="min-h-dvh lg:ps-64">
      <aside className="fixed inset-y-0 start-0 z-40 hidden w-64 flex-col border-e border-sidebar-border bg-sidebar px-4 pb-4 pt-5 text-sidebar-fg lg:flex">
        <Link href="/coach" className="px-2">
          <Logo invert subtitle={prefs.businessName ?? t.brand.tagline} />
        </Link>
        <div className="mt-8 flex flex-1 flex-col overflow-y-auto">
          <CoachNavLinks />
        </div>
        <div className="mb-3 flex items-center gap-1 px-1">
          <LanguageIconButton tone="sidebar" />
          <ThemeIconButton tone="sidebar" />
        </div>
        <div className="flex items-center gap-3 rounded-xl border border-sidebar-border bg-white/[0.03] p-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-brand text-xs font-bold text-brand-ink">{initials(actor.name)}</span>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-white">{actor.name}</p>
            <p className="truncate text-xs text-sidebar-muted" dir="ltr">
              {actor.email}
            </p>
          </div>
        </div>
      </aside>
      <CoachTopbar
        name={actor.name}
        email={actor.email}
        brand={prefs.businessName}
        unread={unread}
        notifications={rows.map((n) => ({
          id: n.id,
          type: n.type,
          title: n.title,
          body: n.body,
          data: n.data ?? null,
          createdAt: n.createdAt.toISOString(),
          readAt: n.readAt?.toISOString() ?? null,
          clientId: typeof n.data?.clientId === "string" ? n.data.clientId : null,
        }))}
      />
      <main className="mx-auto w-full max-w-[1400px] px-4 pb-16 pt-6 sm:px-6 lg:px-8 lg:pt-8">{children}</main>
    </div>
  );
}
