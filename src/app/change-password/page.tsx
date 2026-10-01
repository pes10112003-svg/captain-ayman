import { requirePageActor } from "@/server/auth/guards";
import { logoutAction } from "@/server/actions/auth";
import { ChangePasswordForm } from "@/components/shared/password-form";
import { Logo } from "@/components/shared/logo";
import { LanguageIconButton, ThemeIconButton } from "@/components/shared/preferences";
import { getI18n } from "@/i18n/server";

export async function generateMetadata() {
  const { t } = await getI18n();
  return { title: t.titles.setPassword };
}

export default async function ChangePasswordPage() {
  const actor = await requirePageActor({ allowPasswordChange: true });
  const { t, f } = await getI18n();
  return (
    <main className="relative flex min-h-dvh items-center justify-center px-5 py-16">
      <div className="absolute end-3 top-3 flex items-center gap-0.5">
        <LanguageIconButton />
        <ThemeIconButton />
      </div>
      <div className="w-full max-w-sm">
        <Logo className="mb-10" subtitle={t.brand.tagline} />
        <h1 className="text-2xl font-semibold tracking-tight">
          {actor.mustChangePassword ? f(t.auth.welcomeName, { name: actor.name.split(" ")[0] }) : t.auth.changePassword}
        </h1>
        <p className="mb-8 mt-1.5 text-sm text-muted">{actor.mustChangePassword ? t.auth.choosePasswordIntro : t.auth.changePasswordIntro}</p>
        <ChangePasswordForm requireCurrent={!actor.mustChangePassword} redirectHome submitLabel={t.auth.saveContinue} />
        <form action={logoutAction} className="mt-6 text-center">
          <button type="submit" className="text-sm text-muted hover:text-ink hover:underline">
            {t.common.signOut}
          </button>
        </form>
      </div>
    </main>
  );
}
