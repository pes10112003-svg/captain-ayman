import { redirect } from "next/navigation";
import { getCurrentActor } from "@/server/auth/session";
import { homePathFor } from "@/server/auth/guards";
import { requireAccess } from "@/server/auth/gate";
import { FormMessage } from "@/components/shared/form-message";
import { getI18n } from "@/i18n/server";
import { LoginForm } from "./login-form";

export async function generateMetadata() {
  const { t } = await getI18n();
  return { title: t.titles.signIn };
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; reset?: string }> }) {
  await requireAccess();
  const actor = await getCurrentActor();
  if (actor) redirect(actor.mustChangePassword ? "/change-password" : homePathFor(actor));
  const [{ next, reset }, { t }] = await Promise.all([searchParams, getI18n()]);
  const showDemo = process.env.NODE_ENV !== "production" || process.env.SHOW_DEMO_LOGINS === "true";

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">{t.auth.welcomeBack}</h1>
      <p className="mb-8 mt-1.5 text-sm text-muted">{t.auth.signInSubtitle}</p>
      {reset ? (
        <FormMessage tone="success" className="mb-4">
          {t.auth.resetDone}
        </FormMessage>
      ) : null}
      <LoginForm next={typeof next === "string" ? next : undefined} />
      {showDemo ? (
        <div className="mt-8 rounded-2xl border border-dashed border-line-strong p-4 text-xs text-muted">
          <p className="mb-2 font-semibold uppercase tracking-wide text-ink-2">{t.auth.demoAccounts}</p>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[11px]">
            <dt>{t.auth.coach}</dt>
            <dd className="font-mono text-ink" dir="ltr">
              coach@kinetic.test · CoachDemo!2026
            </dd>
            <dt>{t.auth.clientA}</dt>
            <dd className="font-mono text-ink" dir="ltr">
              omar@kinetic.test · ClientDemo!2026
            </dd>
            <dt>{t.auth.clientB}</dt>
            <dd className="font-mono text-ink" dir="ltr">
              mariam@kinetic.test · ClientDemo!2026
            </dd>
          </dl>
        </div>
      ) : null}
    </div>
  );
}
