import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { requireClientPage } from "@/server/auth/guards";
import { getClientProfile } from "@/server/services/clients";
import { Avatar } from "@/components/ui/avatar";
import { Logo } from "@/components/shared/logo";
import { LanguageIconButton, ThemeIconButton } from "@/components/shared/preferences";
import { ClientBottomNav, ClientTopNav } from "@/components/client/client-nav";
import { ContentProtection } from "@/components/client/content-protection";
import { getI18n } from "@/i18n/server";
import { clientAreaAllowed } from "@/lib/app-shell";
import { AppBridge } from "@/components/client/app-bridge";
import { getMealReminders } from "@/server/services/nutrition";

export default async function ClientAreaLayout({ children }: { children: React.ReactNode }) {
  const actor = await requireClientPage();
  // Also enforced in src/proxy.ts; repeated here because prefetch requests skip the proxy.
  if (!clientAreaAllowed((await headers()).get("user-agent"))) redirect("/get-app");
  // The client id always comes from the session — there is no client id in any client URL.
  const [{ client, permissions }, { t, f }] = await Promise.all([getClientProfile(actor, actor.clientId), getI18n()]);
  const reminders = permissions.viewNutrition
    ? await getMealReminders(actor.clientId, (meal) => ({ title: f(t.app.reminderTitle, { meal }), body: t.app.reminderBody }))
    : null;
  return (
    <div className="min-h-dvh">
      <ContentProtection name={client.fullName} />
      <AppBridge reminders={reminders} />
      <header className="sticky top-0 z-30 border-b border-line/70 bg-page md:bg-page/85 md:backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between gap-3 px-4 md:h-16">
          <Link href="/client" className="flex min-w-0 items-center gap-2">
            <Logo size="sm" />
          </Link>
          <ClientTopNav permissions={permissions} />
          <div className="flex shrink-0 items-center gap-0.5">
            <LanguageIconButton className="size-9 min-w-9" />
            <ThemeIconButton className="size-9" />
            <Link href="/client/profile" aria-label={t.nav.yourProfile} className="ms-1 md:hidden">
              <Avatar name={client.fullName} clientId={client.id} avatarKey={client.avatarKey} size="sm" />
            </Link>
          </div>
        </div>
      </header>
      <main className="page-stagger mx-auto w-full max-w-3xl px-4 pb-safe-nav pt-5 md:pb-16 md:pt-8">{children}</main>
      <ClientBottomNav permissions={permissions} />
    </div>
  );
}
