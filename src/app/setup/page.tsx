import { ShieldAlert } from "lucide-react";
import { AuthShell } from "@/components/shared/auth-shell";
import { FormMessage } from "@/components/shared/form-message";
import { setupStatus } from "@/server/services/setup";
import { getI18n } from "@/i18n/server";
import { SetupForm } from "./setup-form";

export async function generateMetadata() {
  const { t } = await getI18n();
  return { title: t.titles.setup, robots: { index: false, follow: false } };
}

/** Administrator page: first coach account + recovery. Requires ADMIN_KEY (set in the hosting settings). */
export default async function SetupPage() {
  const [{ t }, status] = await Promise.all([getI18n(), setupStatus()]);
  return (
    <AuthShell>
      <div>
        <span className="mb-5 inline-flex items-center gap-1.5 rounded-full bg-warn-soft px-3 py-1 text-xs font-semibold text-warn-text">
          <ShieldAlert className="size-3.5" aria-hidden /> {t.titles.setup}
        </span>
        <h1 className="text-2xl font-semibold tracking-tight">{t.setup.title}</h1>
        <p className="mb-8 mt-1.5 text-sm leading-relaxed text-muted">{t.setup.subtitle}</p>
        {status.enabled ? <SetupForm hasCoach={status.hasCoach} /> : <FormMessage tone="info">{t.setup.notConfigured}</FormMessage>}
      </div>
    </AuthShell>
  );
}
