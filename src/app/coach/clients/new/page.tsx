import { requireCoachPage } from "@/server/auth/guards";
import { coachToday } from "@/server/services/settings";
import { getAccessSettings } from "@/server/services/access";
import { env } from "@/server/env";
import { PageHeader } from "@/components/ui/page-header";
import { ClientForm } from "@/components/coach/client-form";
import { getI18n } from "@/i18n/server";

export async function generateMetadata() {
  const { t } = await getI18n();
  return { title: t.titles.addClient };
}

export default async function NewClientPage() {
  const actor = await requireCoachPage();
  const [{ prefs, today }, access, { t }] = await Promise.all([coachToday(actor.userId), getAccessSettings(actor), getI18n()]);
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader eyebrow={t.nav.clients} title={t.clientForm.newTitle} description={t.clientForm.newSubtitle} />
      <ClientForm
        mode="create"
        weightUnit={prefs.weightUnit}
        lengthUnit={prefs.lengthUnit}
        today={today}
        invite={{ url: env().APP_URL, accessCode: access.code }}
      />
    </div>
  );
}
