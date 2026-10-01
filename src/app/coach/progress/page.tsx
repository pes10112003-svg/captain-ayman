import Link from "next/link";
import { LineChart } from "lucide-react";
import { requireCoachPage } from "@/server/auth/guards";
import { getProgressOverview } from "@/server/services/coach-overviews";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Avatar } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/empty-state";
import { angleLabel, measureTypeLabel } from "@/i18n/labels";
import { getI18n } from "@/i18n/server";
import { displayMeasurement } from "@/lib/units";
import { cn } from "@/lib/utils";

export async function generateMetadata() {
  const { t } = await getI18n();
  return { title: t.titles.progress };
}

export default async function ProgressOverviewPage() {
  const actor = await requireCoachPage();
  const d = await getProgressOverview(actor);
  const { t, f, fmt } = await getI18n();
  const u = d.prefs.weightUnit;
  if (!d.changes.length) return <EmptyState icon={<LineChart />} title={t.coachPages.noClientsYet} />;
  return (
    <>
      <PageHeader title={t.titles.progress} description={t.coachPages.progressSub} />
      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title={t.coachPages.weightChange} />
          <CardBody className="p-0 pt-2">
            <table className="w-full text-sm">
              <thead className="text-start text-xs text-muted">
                <tr className="border-b border-line">
                  <th className="py-2.5 ps-5 text-start font-medium">{t.coachPages.colClient}</th>
                  <th className="py-2.5 text-start font-medium">{t.coachPages.start}</th>
                  <th className="py-2.5 text-start font-medium">{t.coachPages.current}</th>
                  <th className="hidden py-2.5 text-start font-medium sm:table-cell">{t.coachPages.goal}</th>
                  <th className="py-2.5 pe-5 text-end font-medium">{t.coachPages.change}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {d.changes.map((c) => {
                  const toward = c.goalWeightKg != null && c.startingWeightKg != null && c.changeKg != null ? (c.goalWeightKg < c.startingWeightKg ? c.changeKg < 0 : c.changeKg > 0) : null;
                  return (
                    <tr key={c.id}>
                      <td className="py-2.5 ps-5">
                        <Link href={`/coach/clients/${c.id}/progress`} className="flex items-center gap-2.5 hover:underline">
                          <Avatar name={c.fullName} clientId={c.id} avatarKey={c.avatarKey} size="xs" />
                          <span className="truncate font-medium">{c.fullName}</span>
                        </Link>
                      </td>
                      <td className="py-2.5 tabular text-ink-2">{fmt.weight(c.startingWeightKg, u)}</td>
                      <td className="py-2.5 font-medium tabular">{fmt.weight(c.currentWeightKg, u)}</td>
                      <td className="hidden py-2.5 tabular text-ink-2 sm:table-cell">{fmt.weight(c.goalWeightKg, u)}</td>
                      <td className={cn("py-2.5 pe-5 text-end font-semibold tabular", toward == null ? "" : toward ? "text-good-text" : "text-crit-text")}>
                        {/* LRM keeps the +/− sign in front of the number in right-to-left text. */}
                        {`\u200E${fmt.signedWeight(c.changeKg, u)}`}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </CardBody>
        </Card>
        <div className="space-y-6">
          <Card>
            <CardHeader title={t.coachPages.latestMeasurements} />
            <CardBody>
              {d.latest.length ? (
                <ul className="space-y-2.5">
                  {d.latest.slice(0, 12).map((m) => {
                    const v = displayMeasurement(m.kind, m.value, m.unit, d.prefs);
                    return (
                      <li key={m.id} className="flex items-center justify-between gap-3 text-sm">
                        <Link href={`/coach/clients/${m.clientId}/progress`} className="min-w-0 truncate hover:underline">
                          <span className="font-medium">{m.client.fullName.split(" ")[0]}</span> <span className="text-muted">· {measureTypeLabel(t, m)}</span>
                        </Link>
                        <span className="shrink-0 tabular">
                          <span className="font-semibold">{fmt.measure(v.value, v.unit)}</span>{" "}
                          <span className="text-xs text-muted">{fmt.dateShort(m.measuredOn)}</span>
                        </span>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="text-sm text-muted">{t.progress.emptyTitle}</p>
              )}
            </CardBody>
          </Card>
          <Card>
            <CardHeader title={t.coachPages.latestPhotos} />
            <CardBody>
              {d.photos.length ? (
                <ul className="grid grid-cols-3 gap-2">
                  {d.photos.slice(0, 9).map((p) => (
                    <li key={p.id}>
                      <Link href={`/coach/clients/${p.clientId}/photos`} className="block overflow-hidden rounded-xl border border-line">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={`/api/media/photos/${p.id}?size=thumb`} alt={`${p.client.fullName} · ${f(t.dashboard.photo, { angle: angleLabel(t, p.angle) })}`} loading="lazy" className="aspect-[3/4] w-full object-cover" />
                      </Link>
                      <p className="mt-1 truncate text-[11px] text-muted">{p.client.fullName.split(" ")[0]} · {fmt.dateShort(p.takenOn)}</p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted">{t.photos.emptyTitle}</p>
              )}
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
