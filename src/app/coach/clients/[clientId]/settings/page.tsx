import { requireCoachPage } from "@/server/auth/guards";
import { getClientProfile } from "@/server/services/clients";
import { coachToday } from "@/server/services/settings";
import { orNotFound } from "@/server/page-helpers";
import { ClientForm } from "@/components/coach/client-form";
import { ClientAccountPanel } from "@/components/coach/client-account-panel";
import { cmTo, kgTo, round } from "@/lib/units";
import { getAccessSettings } from "@/server/services/access";
import { env } from "@/server/env";

export default async function ClientSettingsPage({ params }: { params: Promise<{ clientId: string }> }) {
  const actor = await requireCoachPage();
  const { clientId } = await params;
  const [{ client }, { prefs, today }, access] = await Promise.all([orNotFound(getClientProfile(actor, clientId)), coachToday(actor.userId), getAccessSettings(actor)]);
  const invite = { url: env().APP_URL, accessCode: access.code };
  const w = (kg: number | null) => (kg == null ? null : round(kgTo(kg, prefs.weightUnit), 1));
  return (
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
      <ClientAccountPanel client={{ id: client.id, fullName: client.fullName, email: client.email, status: client.status, avatarKey: client.avatarKey }} invite={invite} />
    </div>
  );
}
