import { History } from "lucide-react";
import { requireCoachPage } from "@/server/auth/guards";
import { listActivity } from "@/server/services/activity-feed";
import { getCoachPrefs } from "@/server/services/settings";
import { Card, CardBody } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Pagination } from "@/components/ui/pagination";
import { ActivityList } from "@/components/shared/activity-list";
import { getI18n } from "@/i18n/server";

export async function generateMetadata() {
  const { t } = await getI18n();
  return { title: t.titles.activity };
}

export default async function ActivityPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const actor = await requireCoachPage();
  const { page } = await searchParams;
  const [data, prefs] = await Promise.all([listActivity(actor, { page: Number(page) || 1, pageSize: 40 }), getCoachPrefs(actor.userId)]);
  const { t } = await getI18n();
  return (
    <>
      <PageHeader title={t.activity.title} description={t.activity.subtitle} />
      {data.rows.length ? (
        <Card>
          <CardBody>
            <ActivityList rows={data.rows} timezone={prefs.timezone} />
            <div className="mt-6 border-t border-line pt-4">
              <Pagination page={data.page} pages={data.pages} total={data.total} label={t.activity.events} hrefFor={(p) => `/coach/activity?page=${p}`} />
            </div>
          </CardBody>
        </Card>
      ) : (
        <EmptyState icon={<History />} title={t.activity.emptyTitle} />
      )}
    </>
  );
}
