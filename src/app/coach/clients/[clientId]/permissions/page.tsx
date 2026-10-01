import { requireCoachPage } from "@/server/auth/guards";
import { getClientProfile } from "@/server/services/clients";
import { orNotFound } from "@/server/page-helpers";
import { PermissionsForm } from "@/components/coach/permissions-form";

export default async function PermissionsPage({ params }: { params: Promise<{ clientId: string }> }) {
  const actor = await requireCoachPage();
  const { clientId } = await params;
  const { client, permissions } = await orNotFound(getClientProfile(actor, clientId));
  return <PermissionsForm clientId={client.id} clientName={client.fullName} initial={permissions} />;
}
