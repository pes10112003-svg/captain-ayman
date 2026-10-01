import Link from "next/link";
import { requireClientPage } from "@/server/auth/guards";
import { getClientProfile } from "@/server/services/clients";
import { Avatar } from "@/components/ui/avatar";
import { BrandName, LogoMark } from "@/components/shared/logo";
import { LanguageIconButton, ThemeIconButton } from "@/components/shared/preferences";
import { ClientBottomNav, ClientTopNav } from "@/components/client/client-nav";
import { getI18n } from "@/i18n/server";

export default async function ClientAreaLayout({ children }: { children: React.ReactNode }) {
  const actor = await requireClientPage();
  // The client id always comes from the session — there is no client id in any client URL.
  const [{ client, permissions }, { t }] = await Promise.all([getClientProfile(actor, actor.clientId), getI18n()]);
  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-30 border-b border-line/70 bg-page/85 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between gap-3 px-4 md:h-16">
          <Link href="/client" className="flex min-w-0 items-center gap-2">
            <LogoMark className="size-7 shrink-0" />
            <BrandName className="truncate text-[15px] font-semibold tracking-tight" />
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
      <main className="mx-auto w-full max-w-3xl px-4 pb-safe-nav pt-5 md:pb-16 md:pt-8">{children}</main>
      <ClientBottomNav permissions={permissions} />
    </div>
  );
}
