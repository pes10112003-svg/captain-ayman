import { Activity, Camera, Dumbbell, LayoutGrid, LineChart, ShieldCheck, UserCog, Utensils } from "lucide-react";
import { requireCoachPage } from "@/server/auth/guards";
import { getClientProfile } from "@/server/services/clients";
import { orNotFound } from "@/server/page-helpers";
import { LinkTabs } from "@/components/ui/link-tabs";
import { ClientHeader } from "@/components/coach/client-header";
import { getI18n } from "@/i18n/server";

export default async function ClientLayout({ children, params }: { children: React.ReactNode; params: Promise<{ clientId: string }> }) {
  const actor = await requireCoachPage();
  const { clientId } = await params;
  // Resource-level check: 404 unless this client belongs to the signed-in coach.
  const { client } = await orNotFound(getClientProfile(actor, clientId));
  const { t } = await getI18n();
  const base = `/coach/clients/${client.id}`;
  return (
    <>
      <ClientHeader client={client} />
      <LinkTabs
        className="mb-6"
        items={[
          { href: base, label: t.tabs.overview, icon: <LayoutGrid />, exact: true },
          { href: `${base}/workouts`, label: t.tabs.workouts, icon: <Dumbbell /> },
          { href: `${base}/nutrition`, label: t.tabs.nutrition, icon: <Utensils /> },
          { href: `${base}/progress`, label: t.tabs.progress, icon: <LineChart /> },
          { href: `${base}/photos`, label: t.tabs.photos, icon: <Camera /> },
          { href: `${base}/activity`, label: t.tabs.activity, icon: <Activity /> },
          { href: `${base}/permissions`, label: t.tabs.permissions, icon: <ShieldCheck /> },
          { href: `${base}/settings`, label: t.tabs.profile, icon: <UserCog /> },
        ]}
      />
      {children}
    </>
  );
}
