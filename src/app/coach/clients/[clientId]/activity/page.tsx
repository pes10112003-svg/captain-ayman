import { History } from "lucide-react";
import { requireCoachPage } from "@/server/auth/guards";
import { listActivity } from "@/server/services/activity-feed";
import { getCoachPrefs } from "@/server/services/settings";
import { orNotFound } from "@/server/page-helpers";
import { Card, CardBody } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Pagination } from "@/components/ui/pagination";
import { ActivityList } from "@/components/shared/activity-list";
import { getI18n } from "@/i18n/server";

export default async function ClientActivityPage({ params, searchParams }: { params: Promise<{ clientId: string }>; searchParams: Promise<{ page?: string }> }) {
  const actor = await requireCoachPage();
  const { clientId } = await params;
  const { page } = await searchParams;
  const [data, prefs] = await Promise.all([orNotFound(listActivity(actor, { clientId, page: Number(page) || 1, pageSize: 30 })), getCoachPrefs(actor.userId)]);
  const { t } = await getI18n();
  if (!data.rows.length) return <EmptyState icon={<History />} title={t.activity.emptyTitle} description={t.activity.emptyText} />;
  return (
    <Card>
      <CardBody>
        <ActivityList rows={data.rows} timezone={prefs.timezone} showClient={false} />
        <div className="mt-6 border-t border-line pt-4">
          <Pagination page={data.page} pages={data.pages} total={data.total} label={t.activity.events} hrefFor={(p) => `/coach/clients/${clientId}/activity?page=${p}`} />
        </div>
      </CardBody>
    </Card>
  );
}
