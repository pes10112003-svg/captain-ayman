import { requireCoachPage } from "@/server/auth/guards";
import { getClientProfile } from "@/server/services/clients";
import { coachToday } from "@/server/services/settings";
import { orNotFound } from "@/server/page-helpers";
import { ClientForm } from "@/components/coach/client-form";
import { ClientAccountPanel } from "@/components/coach/client-account-panel";
import { PermissionsForm } from "@/components/coach/permissions-form";
import { getI18n } from "@/i18n/server";
import { cmTo, kgTo, round } from "@/lib/units";
import { env } from "@/server/env";

export default async function ClientSettingsPage({ params }: { params: Promise<{ clientId: string }> }) {
  const actor = await requireCoachPage();
  const { clientId } = await params;
  const [{ client, permissions }, { prefs, today }, { t }] = await Promise.all([
    orNotFound(getClientProfile(actor, clientId)),
    coachToday(actor.userId),
    getI18n(),
  ]);
  const invite = { url: env().APP_URL };
  const w = (kg: number | null) => (kg == null ? null : round(kgTo(kg, prefs.weightUnit), 1));
  return (
    <div className="space-y-10">
      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <ClientForm
          mode="edit"
          clientId={client.id}
          weightUnit={prefs.weightUnit}
          lengthUnit={prefs.lengthUnit}
          today={today}
          defaults={{
            fullName: client.fullName,
            email: client.email,
            phone: client.phone,
            dateOfBirth: client.dateOfBirth,
            gender: client.gender,
            height: client.heightCm == null ? null : round(cmTo(client.heightCm, prefs.lengthUnit), 1),
            startingWeight: w(client.startingWeightKg),
            goalWeight: w(client.goalWeightKg),
            goal: client.goal,
            goalNote: client.goalNote,
            coachNotes: client.coachNotes,
            status: client.status,
          }}
        />
        <ClientAccountPanel
          client={{
            id: client.id,
            fullName: client.fullName,
            email: client.email,
            status: client.status,
            avatarKey: client.avatarKey,
          }}
          invite={invite}
        />
      </div>
      <section id="permissions" className="scroll-mt-24">
        <h2 className="mb-4 text-lg font-semibold tracking-tight">{t.permissionsPage.title}</h2>
        <PermissionsForm clientId={client.id} clientName={client.fullName} initial={permissions} />
      </section>
    </div>
  );
}
