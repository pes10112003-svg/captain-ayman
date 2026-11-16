import { Bell } from "lucide-react";
import { requireClientPage } from "@/server/auth/guards";
import { listClientNotifications } from "@/server/services/chat";
import { getClientProfile } from "@/server/services/clients";
import { getCoachPrefs } from "@/server/services/settings";
import { EmptyState } from "@/components/ui/empty-state";
import { NotificationList } from "@/components/client/notification-list";
import { getI18n } from "@/i18n/server";

export async function generateMetadata() {
  const { t } = await getI18n();
  return { title: t.notifications.title };
}

export default async function ClientNotificationsPage() {
  const actor = await requireClientPage();
  const { t } = await getI18n();
  const [{ rows }, { client }] = await Promise.all([listClientNotifications(actor, 40), getClientProfile(actor, actor.clientId)]);
  const prefs = await getCoachPrefs(client.coachId);
  return (
    <div className="space-y-5">
      <h1 className="text-[26px] font-semibold tracking-tight">{t.notifications.title}</h1>
      {rows.length ? (
        <NotificationList
          timezone={prefs.timezone}
          items={rows.map((n) => ({
            id: n.id,
            type: n.type,
            title: n.title,
            body: n.body,
            data: n.data ?? null,
            createdAt: n.createdAt.toISOString(),
            unread: !n.readAt,
          }))}
        />
      ) : (
        <EmptyState icon={<Bell />} title={t.notifications.empty} />
      )}
    </div>
  );
}
